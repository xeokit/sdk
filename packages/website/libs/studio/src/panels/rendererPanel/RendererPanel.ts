/**
 * Floating, draggable, live-updating renderer diagnostic panel.
 *
 * Surfaces the per-frame log the renderer's
 * {@link RenderInspector | RenderInspector} accumulates — per-view
 * draw calls, primitives, frame time, fps, plus the render-bin and
 * draw-call breakdown for whichever view the user has selected. The
 * panel re-paints once per animation frame while visible (coalesced
 * via `requestAnimationFrame`); listeners detach entirely when the
 * panel is hidden, so a dismissed panel costs nothing.
 *
 * Replaces the static-class {@link inspectors/RendererPanel} mounted
 * inside the `FloatingPanelFlowHost`. Same diagnostic content, but
 * wrapped in the standard floating-panel chrome (drag header, close +
 * pill, layout persistence) and reachable via
 * `studio.panels.open("rendererPanel")`.
 *
 */
import type {
  DrawCallStats,
  RenderBinStats,
  RenderStats,
  ViewRenderStats,
} from "@xeokit/sdk/viewing/renderers/webGL/internal/inspectors";
import type {Renderer} from "@xeokit/sdk/viewing/rendering";
import {SDKErrorType, type SDKResult} from "@xeokit/sdk/base/core";

import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";

interface RenderInspectorLike {
  enabled: boolean;
  renderStats: RenderStats;
  frameRates?: Array<number | null>;
  getFrameRate?: (viewId: string) => number | null;
}

type RendererWithInspector = Renderer & {
  getRenderInspector?: () => SDKResult<RenderInspectorLike>;
};


// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface RendererPanelParams {

  /**
   * Renderer whose {@link RenderInspector} the panel surfaces.
   * Doubles as the WeakMap key for {@link RendererPanel.openFor}
   * idempotence — one panel per renderer.
   */
  renderer: Renderer;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed
   * state. Defaults to `"xkt-rp-panel"`.
   */
  storageKey?: string;

  /** Show on construction (default `true`). */
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard for the whole page.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-rp-styles";
let _stylesInjected = false;

function injectStylesOnce(): void {
  if (_stylesInjected) return;
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_TAG_ID)) {
    _stylesInjected = true;
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_TAG_ID;
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);
  _stylesInjected = true;
}


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

export class RendererPanel extends FloatingPanelBase {

  /** Per-renderer instance registry — one panel per renderer. */
  private static readonly _instances = new WeakMap<Renderer, RendererPanel>();

  /** SVG glyph for the title bar — a scope trace over a grid. */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="3" y="4" width="18" height="16" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<g opacity="0.35" stroke="currentColor" stroke-width="1">` +
        `<line x1="3" y1="10" x2="21" y2="10"/>` +
        `<line x1="3" y1="14" x2="21" y2="14"/>` +
        `<line x1="9"  y1="4" x2="9"  y2="20"/>` +
        `<line x1="15" y1="4" x2="15" y2="20"/>` +
      `</g>` +
      `<path d="M5 14 L8 14 L9 11 L11 17 L13 8 L15 14 L17 12 L19 14" ` +
        `fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>` +
    `</svg>`;
  }

  static getFor(renderer: Renderer): RendererPanel | undefined {
    const inst = RendererPanel._instances.get(renderer);
    return inst && !inst._destroyed ? inst : undefined;
  }

  static openFor(params: RendererPanelParams): RendererPanel {
    let inst = RendererPanel._instances.get(params.renderer);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new RendererPanel(params);
    return inst;
  }

  readonly renderer: Renderer;
  private readonly _rendererWithInspector: RendererWithInspector;

  // DOM refs.
  private _bodyEl!: HTMLElement;
  private _headStatsEl!: HTMLElement;
  private _viewsTableBody!: HTMLElement;
  private _viewDetailEl!: HTMLElement;
  private _pulseEl!: HTMLElement;

  // State.
  private _selectedViewIndex = 0;
  private _listenersAttached = false;
  private _refreshScheduled = false;
  private _pulseTimer: ReturnType<typeof setTimeout> | null = null;
  private _onViewRenderedUnsub: (() => void) | null = null;

  constructor(params: RendererPanelParams) {
    if (!params || !params.renderer) {
      throw new Error("RendererPanel: renderer is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-rp-panel",
      classPrefix: "xkt-rp",
    });
    this.renderer = params.renderer;
    this._rendererWithInspector = params.renderer as RendererWithInspector;

    // Restore the last-selected view from sessionStorage so the panel
    // resumes on the same row across opens within a session.
    this._selectedViewIndex = readNumber(`${this._storageKey}::viewsel`, 0);

    // Replace any prior panel bound to the same renderer.
    const prior = RendererPanel._instances.get(params.renderer);
    if (prior && !prior._destroyed) prior.destroy();
    RendererPanel._instances.set(params.renderer, this);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();

    if (params.visible === false) {
      this.hide();
    } else {
      this.show();
    }
  }


  // ── Public lifecycle ──────────────────────────────────────────

  get visible(): boolean {
    return this._panel.style.display !== "none";
  }

  show(): void {
    if (this._destroyed) return;
    super.show();
    this._attachListeners();
    this._renderAll();
  }

  hide(): void {
    if (this._destroyed) return;
    super.hide();
    this._detachListeners();
  }

  toggle(): void {
    if (this.visible) this.hide(); else this.show();
  }

  destroy(): void {
    if (this._destroyed) return;
    this._detachListeners();
    if (RendererPanel._instances.get(this.renderer) === this) {
      RendererPanel._instances.delete(this.renderer);
    }
    super.destroy();
  }

  /** Public entry point — re-paint every section. */
  refresh(): void {
    if (this._destroyed) return;
    this._renderAll();
  }


  // ── Listener attach / detach ──────────────────────────────────

  private _attachListeners(): void {
    if (this._listenersAttached || this._destroyed) return;
    this._listenersAttached = true;

    // Make sure the inspector is on, otherwise renderStats stays empty.
    const inspectorRes = this._getRenderInspector();
    if (inspectorRes.ok && inspectorRes.value) {
      inspectorRes.value.enabled = true;
    }

    const ev: any = (this.renderer as any).events;
    if (ev && ev.onViewRendered && typeof ev.onViewRendered.subscribe === "function") {
      this._onViewRenderedUnsub = ev.onViewRendered.subscribe(() => {
        this._scheduleRefresh();
      });
    }
  }

  private _detachListeners(): void {
    if (!this._listenersAttached) return;
    if (this._onViewRenderedUnsub) {
      try { this._onViewRenderedUnsub(); } catch { /* ignore */ }
      this._onViewRenderedUnsub = null;
    }
    if (this._pulseTimer) {
      clearTimeout(this._pulseTimer);
      this._pulseTimer = null;
    }
    this._listenersAttached = false;
    this._refreshScheduled = false;
  }

  /**
   * Coalesce per-frame `onViewRendered` events into one paint per
   * animation frame — without this, a renderer doing dozens of
   * view-renders per second would trigger dozens of repaints.
   */
  private _scheduleRefresh(): void {
    if (this._destroyed || !this._listenersAttached) return;
    if (this._refreshScheduled) return;
    this._refreshScheduled = true;
    requestAnimationFrame(() => {
      this._refreshScheduled = false;
      if (this._destroyed || !this._listenersAttached) return;
      this._renderAll();
    });
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-rp-pill", {
      type: "button",
      title: "Reopen the Renderer panel",
      hidden: true,
      textContent: "Renderer",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-rp-panel");

    // Header.
    this._header = el("div", "xkt-rp-header");
    const title = el("h2", "xkt-rp-title");
    title.innerHTML =
      `<span class="xkt-rp-title-icon">${RendererPanel.iconSvg()}</span>` +
      `<span class="xkt-rp-title-stack">` +
        `<span class="xkt-rp-title-text">Renderer</span>` +
        `<span class="xkt-rp-subtitle">Renderer execution log — last frame per view.</span>` +
      `</span>`;

    this._closeBtn = el("button", "xkt-rp-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;

    this._header.append(title, this._closeBtn);
    this._panel.appendChild(this._header);

    // Headline stats row (pills) + live-pulse dot.
    const headStrip = el("div", "xkt-rp-headstrip");
    this._headStatsEl = el("div", "xkt-rp-headstats");
    this._pulseEl = el("span", "xkt-rp-pulse", {title: "Live"});
    headStrip.append(this._headStatsEl, this._pulseEl);
    this._panel.appendChild(headStrip);

    // Body — scrollable.
    this._bodyEl = el("div", "xkt-rp-body");

    // Views table section.
    const viewsSection = el("details", "xkt-rp-section") as HTMLDetailsElement;
    viewsSection.setAttribute("data-kind", "views");
    viewsSection.open = true;
    {
      const summary = el("summary");
      summary.append(el("span", "xkt-rp-section-label", {textContent: "Views"}));
      viewsSection.appendChild(summary);

      const body = el("div", "xkt-rp-section-body");
      const tableWrap = el("div", "xkt-rp-tablewrap");
      const table = el("table", "xkt-rp-viewtable");
      table.appendChild(makeViewsColgroup());
      table.appendChild(makeViewsThead());
      this._viewsTableBody = el("tbody");
      table.appendChild(this._viewsTableBody);
      tableWrap.appendChild(table);
      body.appendChild(tableWrap);

      // Row clicks select a view.
      this._viewsTableBody.addEventListener("click", (e) => {
        const t = e.target as HTMLElement;
        const row = t.closest("[data-rp-viewrow]") as HTMLElement | null;
        if (!row) return;
        const idx = Number(row.getAttribute("data-rp-viewrow"));
        if (!Number.isFinite(idx)) return;
        this._selectedViewIndex = idx;
        writeNumber(`${this._storageKey}::viewsel`, idx);
        this._renderAll();
      });

      viewsSection.appendChild(body);
      this._bodyEl.appendChild(viewsSection);
    }

    // Selected-view details section.
    const detailSection = el("details", "xkt-rp-section") as HTMLDetailsElement;
    detailSection.setAttribute("data-kind", "detail");
    detailSection.open = true;
    {
      const summary = el("summary");
      summary.append(el("span", "xkt-rp-section-label", {textContent: "Selected view"}));
      detailSection.appendChild(summary);

      this._viewDetailEl = el("div", "xkt-rp-section-body");
      detailSection.appendChild(this._viewDetailEl);
      this._bodyEl.appendChild(detailSection);
    }

    this._panel.appendChild(this._bodyEl);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }


  // ── Rendering ─────────────────────────────────────────────────

  private _renderAll(): void {
    const inspector = this._currentInspector();
    const renderStats = inspector?.renderStats;
    const views = (renderStats?.views ?? []) as Array<ViewRenderStats | null | undefined>;

    // Clamp selection — views array can shrink across renderer rebinds.
    if (views.length > 0) {
      this._selectedViewIndex = clampInt(this._selectedViewIndex, 0, views.length - 1);
    } else {
      this._selectedViewIndex = 0;
    }
    const selectedFrame = views[this._selectedViewIndex] ?? null;
    const selectedFps = this._frameRate(inspector, selectedFrame, this._selectedViewIndex);

    this._renderHeadStats(views, selectedFrame);
    this._renderViewsTable(views, inspector);
    this._renderViewDetail(this._selectedViewIndex, selectedFrame, selectedFps);
    this._flashPulse();
  }

  private _renderHeadStats(views: Array<ViewRenderStats | null | undefined>, selected: ViewRenderStats | null): void {
    this._headStatsEl.replaceChildren();
    const completed = views.filter((v) => !!v).length;
    appendPill(this._headStatsEl, `${completed}/${views.length} frames`, "neutral");
    appendPill(this._headStatsEl, `drawCalls: ${selected?.numDrawCalls ?? "—"}`, selected ? "info" : "muted");
    appendPill(this._headStatsEl, `prims: ${selected?.numPrims ?? "—"}`, selected ? "info" : "muted");
    appendPill(this._headStatsEl, `time: ${formatTimeMs(selected?.timeMs)}`, selected?.timeMs ? "info" : "muted");
  }

  private _renderViewsTable(
    views: Array<ViewRenderStats | null | undefined>,
    inspector: RenderInspectorLike | null,
  ): void {
    this._viewsTableBody.replaceChildren();
    if (!views.length) {
      const tr = el("tr");
      const td = el("td", "xkt-rp-td xkt-rp-empty");
      td.setAttribute("colspan", "7");
      td.textContent = "No view slots yet.";
      tr.appendChild(td);
      this._viewsTableBody.appendChild(tr);
      return;
    }

    for (let i = 0; i < views.length; i++) {
      const frame = views[i] ?? null;
      const fps = this._frameRate(inspector, frame, i);
      const isSelected = i === this._selectedViewIndex;

      const tr = el("tr", `xkt-rp-viewrow ${isSelected ? "is-selected" : ""} ${frame ? "is-ready" : "is-empty"}`);
      tr.setAttribute("data-rp-viewrow", String(i));
      tr.title = frame ? "Select this view" : "No completed frame yet";

      tr.append(
        el("td", "xkt-rp-td xkt-rp-td-num", {textContent: String(i)}),
        el("td", "xkt-rp-td xkt-rp-td-mono", {textContent: frame?.viewId ?? "—"}),
        el("td", "xkt-rp-td xkt-rp-td-mono", {
          textContent: frame ? `${frame.canvasSize?.[0] ?? "—"} × ${frame.canvasSize?.[1] ?? "—"}` : "—",
        }),
        el("td", "xkt-rp-td xkt-rp-td-num", {textContent: fps == null ? "—" : fps.toFixed(2)}),
        el("td", "xkt-rp-td xkt-rp-td-num", {textContent: frame ? String(frame.numDrawCalls ?? "—") : "—"}),
        el("td", "xkt-rp-td xkt-rp-td-num", {textContent: frame ? String(frame.numPrims ?? "—") : "—"}),
        el("td", "xkt-rp-td xkt-rp-td-mono", {textContent: frame ? formatTimeMs(frame.timeMs) : "—"}),
      );

      this._viewsTableBody.appendChild(tr);
    }
  }

  private _renderViewDetail(viewIndex: number, frame: ViewRenderStats | null, fps: number | null): void {
    this._viewDetailEl.replaceChildren();

    const head = el("div", "xkt-rp-detail-head");
    head.append(
      el("div", "xkt-rp-detail-h", {textContent: `View ${viewIndex}`}),
      el("div", "xkt-rp-detail-sub", {textContent: frame?.viewId ?? "—"}),
    );
    this._viewDetailEl.appendChild(head);

    if (!frame) {
      this._viewDetailEl.appendChild(
        el("div", "xkt-rp-empty", {textContent: "No completed frame for this view yet."}),
      );
      return;
    }

    // Metric strip.
    const metrics = el("div", "xkt-rp-metrics");
    appendMetric(metrics, "Canvas", `${frame.canvasSize?.[0] ?? "—"} × ${frame.canvasSize?.[1] ?? "—"}`);
    appendMetric(metrics, "FPS", fps == null ? "—" : fps.toFixed(2));
    appendMetric(metrics, "Draw calls", String(frame.numDrawCalls ?? "—"));
    appendMetric(metrics, "Prims", String(frame.numPrims ?? "—"));
    appendMetric(metrics, "Time", formatTimeMs(frame.timeMs));
    this._viewDetailEl.appendChild(metrics);

    // Render bins table.
    const bins = (frame.renderBins ?? []) as RenderBinStats[];
    this._viewDetailEl.appendChild(this._renderBinsTable(bins));

    // Draw calls <details>.
    this._viewDetailEl.appendChild(this._renderDrawCalls(bins));
  }

  private _renderBinsTable(bins: RenderBinStats[]): HTMLElement {
    const wrap = el("div", "xkt-rp-bins");

    wrap.appendChild(el("div", "xkt-rp-subhead", {textContent: `Render bins executed (${bins.length})`}));

    if (!bins.length) {
      wrap.appendChild(el("div", "xkt-rp-empty", {textContent: "No render bins executed."}));
      return wrap;
    }

    // Sort bins by time desc.
    const sorted = bins.slice().sort((a, b) => Number(b?.timeMs?.duration ?? 0) - Number(a?.timeMs?.duration ?? 0));

    const tableWrap = el("div", "xkt-rp-tablewrap");
    const table = el("table", "xkt-rp-bintable");
    const colgroup = el("colgroup");
    colgroup.append(
      el("col", "xkt-rp-col-bin-name"),
      el("col", "xkt-rp-col-bin-dc"),
      el("col", "xkt-rp-col-bin-time"),
    );
    table.appendChild(colgroup);

    const thead = el("thead");
    const headRow = el("tr");
    headRow.append(
      el("th", "xkt-rp-th", {textContent: "name"}),
      el("th", "xkt-rp-th xkt-rp-th-num", {textContent: "drawCalls"}),
      el("th", "xkt-rp-th", {textContent: "time"}),
    );
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = el("tbody");
    for (const b of sorted) {
      const calls = (b.drawCalls ?? []) as DrawCallStats[];
      const tr = el("tr");
      tr.append(
        el("td", "xkt-rp-td xkt-rp-td-mono", {textContent: b.name}),
        el("td", "xkt-rp-td xkt-rp-td-num", {textContent: String(calls.length)}),
        el("td", "xkt-rp-td xkt-rp-td-mono", {textContent: formatTimeMs(b.timeMs)}),
      );
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    wrap.appendChild(tableWrap);
    return wrap;
  }

  private _renderDrawCalls(bins: RenderBinStats[]): HTMLElement {
    const details = el("details", "xkt-rp-dcdetails") as HTMLDetailsElement;
    details.open = false;
    details.appendChild(el("summary", "xkt-rp-dcsum", {textContent: "Draw calls executed"}));

    const all: Array<{ binName: string; dc: DrawCallStats }> = [];
    for (const b of bins) {
      for (const dc of (b.drawCalls ?? []) as DrawCallStats[]) all.push({binName: b.name, dc});
    }

    if (!all.length) {
      details.appendChild(el("div", "xkt-rp-empty", {textContent: "No draw calls."}));
      return details;
    }

    // Sort draw calls by time desc.
    all.sort((a, b) => Number(b.dc?.timeMs?.duration ?? 0) - Number(a.dc?.timeMs?.duration ?? 0));

    const MAX = 200;
    const slice = all.slice(0, MAX);

    const tableWrap = el("div", "xkt-rp-tablewrap");
    const table = el("table", "xkt-rp-dctable");
    const colgroup = el("colgroup");
    colgroup.append(
      el("col", "xkt-rp-col-dc-bin"),
      el("col", "xkt-rp-col-dc-pass"),
      el("col", "xkt-rp-col-dc-prim"),
      el("col", "xkt-rp-col-dc-batch"),
      el("col", "xkt-rp-col-dc-range"),
      el("col", "xkt-rp-col-dc-time"),
    );
    table.appendChild(colgroup);

    const thead = el("thead");
    const headRow = el("tr");
    headRow.append(
      el("th", "xkt-rp-th", {textContent: "bin"}),
      el("th", "xkt-rp-th", {textContent: "renderPass"}),
      el("th", "xkt-rp-th", {textContent: "primitive"}),
      el("th", "xkt-rp-th xkt-rp-th-num", {textContent: "batch"}),
      el("th", "xkt-rp-th", {textContent: "primRange"}),
      el("th", "xkt-rp-th", {textContent: "time"}),
    );
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = el("tbody");
    for (const {binName, dc} of slice) {
      const pr0 = dc.primRange?.firstPrim ?? "—";
      const prn = dc.primRange?.numPrims ?? "—";
      const tr = el("tr");
      tr.append(
        el("td", "xkt-rp-td xkt-rp-td-mono", {textContent: binName}),
        el("td", "xkt-rp-td xkt-rp-td-mono", {textContent: dc.renderPass}),
        el("td", "xkt-rp-td xkt-rp-td-mono", {textContent: dc.primitive}),
        el("td", "xkt-rp-td xkt-rp-td-num", {textContent: String(dc.batchIndex)}),
        el("td", "xkt-rp-td xkt-rp-td-mono", {textContent: `${pr0} / ${prn}`}),
        el("td", "xkt-rp-td xkt-rp-td-mono", {textContent: formatTimeMs(dc.timeMs)}),
      );
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    details.appendChild(tableWrap);

    if (all.length > MAX) {
      details.appendChild(
        el("div", "xkt-rp-empty", {
          textContent: `Showing first ${MAX.toLocaleString()} draw calls (of ${all.length.toLocaleString()}).`,
        }),
      );
    }

    return details;
  }


  // ── Helpers ───────────────────────────────────────────────────

  private _currentInspector(): RenderInspectorLike | null {
    const res = this._getRenderInspector();
    return res.ok ? res.value : null;
  }

  private _getRenderInspector(): SDKResult<RenderInspectorLike> {
    const getRenderInspector = this._rendererWithInspector.getRenderInspector;
    if (typeof getRenderInspector !== "function") {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[RendererPanel] Renderer does not expose getRenderInspector().",
      };
    }
    return getRenderInspector.call(this._rendererWithInspector);
  }

  private _frameRate(
    inspector: RenderInspectorLike | null,
    frame: ViewRenderStats | null,
    viewIndex: number,
  ): number | null {
    return inspector?.frameRates?.[viewIndex] ?? (frame?.viewId ? inspector?.getFrameRate?.(frame.viewId) : null) ?? null;
  }

  /**
   * Flicker the live-pulse dot for a few hundred ms after each
   * coalesced refresh, so the user can tell at a glance that the
   * panel is tracking the renderer.
   */
  private _flashPulse(): void {
    if (!this._pulseEl) return;
    this._pulseEl.classList.add("xkt-rp-pulse-active");
    if (this._pulseTimer) clearTimeout(this._pulseTimer);
    this._pulseTimer = setTimeout(() => {
      this._pulseEl.classList.remove("xkt-rp-pulse-active");
      this._pulseTimer = null;
    }, 600);
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────

function appendPill(host: HTMLElement, text: string, tone: "neutral" | "info" | "muted"): void {
  host.appendChild(el("span", `xkt-rp-pill xkt-rp-pill-${tone}`, {textContent: text}));
}

function appendMetric(host: HTMLElement, label: string, value: string): void {
  const metric = el("div", "xkt-rp-metric");
  metric.append(
    el("div", "xkt-rp-metric-k", {textContent: label}),
    el("div", "xkt-rp-metric-v", {textContent: value}),
  );
  host.appendChild(metric);
}

function makeViewsColgroup(): HTMLElement {
  const colgroup = el("colgroup");
  colgroup.append(
    el("col", "xkt-rp-col-idx"),
    el("col", "xkt-rp-col-id"),
    el("col", "xkt-rp-col-canvas"),
    el("col", "xkt-rp-col-fps"),
    el("col", "xkt-rp-col-dc"),
    el("col", "xkt-rp-col-pr"),
    el("col", "xkt-rp-col-time"),
  );
  return colgroup;
}

function makeViewsThead(): HTMLElement {
  const thead = el("thead");
  const row = el("tr");
  row.append(
    el("th", "xkt-rp-th xkt-rp-th-num", {textContent: "#"}),
    el("th", "xkt-rp-th", {textContent: "viewId"}),
    el("th", "xkt-rp-th", {textContent: "canvas"}),
    el("th", "xkt-rp-th xkt-rp-th-num", {textContent: "fps"}),
    el("th", "xkt-rp-th xkt-rp-th-num", {textContent: "drawCalls"}),
    el("th", "xkt-rp-th xkt-rp-th-num", {textContent: "prims"}),
    el("th", "xkt-rp-th", {textContent: "time"}),
  );
  thead.appendChild(row);
  return thead;
}

function formatTimeMs(timeMs: any): string {
  if (!timeMs) return "—";
  const d = Number(timeMs.duration);
  return Number.isFinite(d) ? `${d.toFixed(2)} ms` : "—";
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.trunc(v)));
}

function readNumber(key: string, fallback: number): number {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function writeNumber(key: string, value: number): void {
  try {
    sessionStorage.setItem(key, String(value));
  } catch { /* ignore quota / disabled */ }
}


// ─────────────────────────────────────────────────────────────────
// CSS — `xkt-rp-` scoped.
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-rp-panel {
  position: fixed;
  top: 115px;
  right: 17px;
  width: 720px;
  height: auto;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.14);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  color: #111;
  z-index: 200000000;
  overflow: hidden;
  box-sizing: border-box;
}
.xkt-rp-panel *, .xkt-rp-panel *::before, .xkt-rp-panel *::after { box-sizing: border-box; }
.xkt-rp-panel[hidden] { display: none; }

.xkt-rp-panel .xkt-rp-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px 12px 16px;
  border-bottom: 1px solid #ececec;
  flex: 0 0 auto;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
.xkt-rp-panel .xkt-rp-header.xkt-rp-dragging { cursor: grabbing; }
.xkt-rp-panel .xkt-rp-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 20px;
  font-weight: 650;
  color: #111;
  display: flex;
  align-items: center;
  gap: 8px;
}
.xkt-rp-panel .xkt-rp-title-icon {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
  width: 24px;
  height: 24px;
  color: #2d5e8c;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.xkt-rp-panel .xkt-rp-title-icon svg { width: 100%; height: 100%; display: block; }
.xkt-rp-panel .xkt-rp-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-rp-panel .xkt-rp-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-rp-panel .xkt-rp-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
.xkt-rp-panel .xkt-rp-close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  font: inherit;
  font-size: 22px;
  line-height: 1;
  color: #777;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
}
.xkt-rp-panel .xkt-rp-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-rp-pill {
  position: fixed;
  bottom: 17px;
  right: 500px;
  z-index: 200000000;
  padding: 9px 16px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #fff;
  background: #2d5e8c;
  border: 1px solid #1f4368;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.xkt-rp-pill:hover { background: #1f4368; }
.xkt-rp-pill[hidden] { display: none; }

/* Headline stats row */
.xkt-rp-panel .xkt-rp-headstrip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid #ececec;
  background: #fbfdff;
}
.xkt-rp-panel .xkt-rp-headstats { display: flex; gap: 6px; flex-wrap: wrap; flex: 1; min-width: 0; }
.xkt-rp-panel .xkt-rp-pulse {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #2d5e8c;
  opacity: 0;
  transition: opacity 600ms ease-out;
}
.xkt-rp-panel .xkt-rp-pulse.xkt-rp-pulse-active { opacity: 0.85; transition: none; }

.xkt-rp-pill, .xkt-rp-panel .xkt-rp-pill {
  /* override generic .xkt-rp-pill below — keep the standalone pill rule */
}
.xkt-rp-panel .xkt-rp-headstats .xkt-rp-pill {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 650;
  border: 1px solid #e6e6e6;
  background: #fff;
  color: #2d5e8c;
  letter-spacing: 0.02em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.xkt-rp-panel .xkt-rp-pill-neutral { background: #f7fafc; }
.xkt-rp-panel .xkt-rp-pill-info    { background: #f4f9ff; border-color: rgba(45,94,140,0.20); }
.xkt-rp-panel .xkt-rp-pill-muted   { background: #fafafa; color: #7a7f87; }

/* Body / sections */
.xkt-rp-panel .xkt-rp-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px 12px 12px;
}

.xkt-rp-panel .xkt-rp-section {
  margin: 6px 0;
  background: #fff;
  border: 1px solid #ececec;
  border-left: 3px solid #2d5e8c;
  border-radius: 6px;
  overflow: hidden;
}
.xkt-rp-panel .xkt-rp-section[data-kind="detail"] { border-left-color: #4a90e2; }
.xkt-rp-panel .xkt-rp-section > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  user-select: none;
}
.xkt-rp-panel .xkt-rp-section > summary::-webkit-details-marker { display: none; }
.xkt-rp-panel .xkt-rp-section > summary::marker { display: none; }
.xkt-rp-panel .xkt-rp-section > summary::before {
  content: "›";
  display: inline-block;
  transform: rotate(0deg);
  transition: transform 120ms ease-out;
  color: #888;
  font-size: 12px;
}
.xkt-rp-panel .xkt-rp-section[open] > summary::before { transform: rotate(90deg); }
.xkt-rp-panel .xkt-rp-section > summary:hover { background: #fafafa; }
.xkt-rp-panel .xkt-rp-section-label {
  flex: 1;
  font-size: 12px;
  font-weight: 650;
  color: #2d5e8c;
  letter-spacing: -0.1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-rp-panel .xkt-rp-section[data-kind="detail"] .xkt-rp-section-label { color: #4a90e2; }
.xkt-rp-panel .xkt-rp-section > .xkt-rp-section-body {
  padding: 8px 12px 10px;
  border-top: 1px solid #f4f4f4;
  background: #fcfcfc;
}

/* Tables */
.xkt-rp-panel .xkt-rp-tablewrap {
  width: 100%;
  overflow-x: auto;
  border: 1px solid #ececec;
  border-radius: 8px;
  background: #fff;
}
.xkt-rp-panel .xkt-rp-viewtable,
.xkt-rp-panel .xkt-rp-bintable,
.xkt-rp-panel .xkt-rp-dctable {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 12px;
}
.xkt-rp-panel .xkt-rp-th {
  text-align: left;
  color: #666;
  font-weight: 650;
  padding: 8px 10px;
  border-bottom: 1px solid #f0f0f0;
  background: #f7fafc;
}
.xkt-rp-panel .xkt-rp-th-num { text-align: left; font-variant-numeric: tabular-nums; }
.xkt-rp-panel .xkt-rp-td {
  padding: 8px 10px;
  border-top: 1px solid #f7f7f7;
  vertical-align: top;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.xkt-rp-panel .xkt-rp-td-num  { text-align: left; font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.xkt-rp-panel .xkt-rp-td-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

/* Column widths */
.xkt-rp-panel .xkt-rp-col-idx    { width: 44px; }
.xkt-rp-panel .xkt-rp-col-fps    { width: 70px; }
.xkt-rp-panel .xkt-rp-col-dc     { width: 80px; }
.xkt-rp-panel .xkt-rp-col-pr     { width: 80px; }
.xkt-rp-panel .xkt-rp-col-time   { width: 110px; }
.xkt-rp-panel .xkt-rp-col-bin-dc { width: 90px; }
.xkt-rp-panel .xkt-rp-col-bin-time { width: 120px; }
.xkt-rp-panel .xkt-rp-col-dc-batch { width: 80px; }
.xkt-rp-panel .xkt-rp-col-dc-time  { width: 110px; }
.xkt-rp-panel .xkt-rp-col-dc-range { width: 120px; }

.xkt-rp-panel .xkt-rp-viewrow { cursor: pointer; }
.xkt-rp-panel .xkt-rp-viewrow:hover { background: #fafafa; }
.xkt-rp-panel .xkt-rp-viewrow.is-selected { background: #f4f9ff; }
.xkt-rp-panel .xkt-rp-viewrow.is-empty { color: #8a8f98; }

.xkt-rp-panel .xkt-rp-empty {
  padding: 10px 12px;
  text-align: center;
  color: #777;
  font-size: 11px;
}

/* Detail block */
.xkt-rp-panel .xkt-rp-detail-head { display: grid; gap: 2px; margin-bottom: 8px; }
.xkt-rp-panel .xkt-rp-detail-h { font-size: 13px; font-weight: 650; }
.xkt-rp-panel .xkt-rp-detail-sub { font-size: 12px; color: #666; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

.xkt-rp-panel .xkt-rp-metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(110px, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}
.xkt-rp-panel .xkt-rp-metric {
  border: 1px solid #ececec;
  background: #fff;
  border-radius: 8px;
  padding: 8px 10px;
}
.xkt-rp-panel .xkt-rp-metric-k {
  font-size: 9.5px;
  color: #666;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 2px;
}
.xkt-rp-panel .xkt-rp-metric-v {
  font-size: 12px;
  font-weight: 700;
  color: #2d5e8c;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
@media (max-width: 880px) {
  .xkt-rp-panel .xkt-rp-metrics { grid-template-columns: repeat(2, minmax(110px, 1fr)); }
}

.xkt-rp-panel .xkt-rp-subhead {
  margin: 6px 0 4px;
  font-size: 9.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: #2c7e6f;
}

.xkt-rp-panel .xkt-rp-bins { margin-bottom: 8px; }

.xkt-rp-panel .xkt-rp-dcdetails {
  border: 1px solid #ececec;
  border-radius: 8px;
  background: #fff;
  padding: 8px 10px;
}
.xkt-rp-panel .xkt-rp-dcsum {
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  color: #2d5e8c;
  list-style: none;
}
.xkt-rp-panel .xkt-rp-dcsum::-webkit-details-marker { display: none; }
`;
