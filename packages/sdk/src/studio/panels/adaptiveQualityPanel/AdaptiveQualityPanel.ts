/**
 * Floating, draggable, closeable panel that drives the SDK's adaptive-
 * quality switch (see {@link viewing!adaptiveQuality}) from the Studio
 * toolbar.
 *
 * Owns one {@link viewing!adaptiveQuality.AdaptiveQuality | AdaptiveQuality}
 * per enabled {@link viewing!viewer.View | View}: each adapter listens to
 * its View's camera events and toggles `view.renderMode` between
 * {@link base!constants.NavigationRender | NavigationRender} (during
 * motion) and {@link base!constants.RealisticRender | RealisticRender}
 * (at rest). The renderer side is fully driven by the View's
 * `renderMode` — every effect (SAO, shadows, bloom, FXAA, ACES tonemap,
 * edges, IBL, section caps) gates its own activation on it via the
 * `renderModes` list, so no per-effect setup lives in the panel.
 *
 * The `restMs` slider is panel-global (it applies to every adapter the
 * panel owns); changing it re-creates any live adapter with the new
 * timing.
 *
 * Per-View row shows live FPS, frame ms (from the renderer's
 * {@link viewing!webGLRenderer.RenderInspector | RenderInspector}), and
 * the View's current `renderMode` so it's visually obvious when the
 * mode flip fires.
 *
 * ```ts
 * import {AdaptiveQualityPanel} from "@xeokit/sdk/studio";
 *
 * const panel = AdaptiveQualityPanel.openFor({viewer, renderer});
 * panel.hide();
 * panel.destroy();   // tears down DOM, listeners, every AdaptiveQuality
 * ```
 */
import type {Viewer, View} from "../../../viewing/viewer";
import type {WebGLRenderer} from "../../../viewing/webGLRenderer";
import {AdaptiveQuality} from "../../../viewing/adaptiveQuality";
import {
  DetailedRender,
  NavigationRender,
  RealisticRender,
} from "../../../base/constants";

import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";


// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface AdaptiveQualityPanelParams {

  /** Viewer whose Views the panel can enable adaptive quality on. */
  viewer: Viewer;

  /** Renderer queried for per-View FPS / frame-time. */
  renderer: WebGLRenderer;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed state.
   * Defaults to `"xkt-aq-panel"`.
   */
  storageKey?: string;

  /** Show on construction (default `true`). */
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-aq-styles";
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
// CSS — every selector rooted at `.xkt-aq-panel` / `.xkt-aq-pill`,
// every class prefixed `xkt-aq-`. Same shape as the culling panel,
// with a purple accent so the two panels read as siblings without
// being confusable.
// ─────────────────────────────────────────────────────────────────

const ACCENT = "#7c3aed";
const ACCENT_DARK = "#5b21b6";

const PANEL_CSS = `
.xkt-aq-panel {
  position: fixed;
  top: 115px;
  right: 17px;
  width: 380px;
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
.xkt-aq-panel *, .xkt-aq-panel *::before, .xkt-aq-panel *::after {
  box-sizing: border-box;
}
.xkt-aq-panel[hidden] { display: none; }

.xkt-aq-panel .xkt-aq-header {
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
.xkt-aq-panel .xkt-aq-header.xkt-aq-dragging { cursor: grabbing; }
.xkt-aq-panel .xkt-aq-title {
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
.xkt-aq-panel .xkt-aq-title-icon {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
  width: 24px;
  height: 24px;
  color: ${ACCENT};
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.xkt-aq-panel .xkt-aq-title-icon svg { width: 100%; height: 100%; display: block; }
.xkt-aq-panel .xkt-aq-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-aq-panel .xkt-aq-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-aq-panel .xkt-aq-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
.xkt-aq-panel .xkt-aq-pulse {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #c9d3df;
  transition: background 120ms ease-out;
}
.xkt-aq-panel .xkt-aq-pulse.xkt-aq-pulse-active { background: ${ACCENT}; }
.xkt-aq-panel .xkt-aq-close {
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
.xkt-aq-panel .xkt-aq-close:hover { background: #f0f0f0; color: #222; border-color: #d0d0d0; }

.xkt-aq-pill {
  position: fixed;
  bottom: 17px;
  right: 438px;
  z-index: 200000000;
  padding: 9px 16px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #fff;
  background: ${ACCENT};
  border: 1px solid ${ACCENT_DARK};
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.xkt-aq-pill:hover { background: ${ACCENT_DARK}; }
.xkt-aq-pill[hidden] { display: none; }

.xkt-aq-panel .xkt-aq-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 10px 12px 14px;
}

.xkt-aq-panel .xkt-aq-section {
  margin: 6px 0 10px;
  background: #fff;
  border: 1px solid #ececec;
  border-left: 3px solid ${ACCENT};
  border-radius: 6px;
  overflow: hidden;
}
.xkt-aq-panel .xkt-aq-section-title {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: ${ACCENT_DARK};
  background: #faf7ff;
  border-bottom: 1px solid #f0f0f0;
}
.xkt-aq-panel .xkt-aq-section-body { padding: 8px 12px 10px; }

.xkt-aq-panel .xkt-aq-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 0;
}
.xkt-aq-panel .xkt-aq-row > label {
  flex: 0 0 96px;
  color: #333;
  font-size: 11.5px;
}
.xkt-aq-panel .xkt-aq-row input[type="range"] { flex: 1 1 auto; min-width: 0; }
.xkt-aq-panel .xkt-aq-val {
  flex: 0 0 56px;
  text-align: right;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #475569;
}

.xkt-aq-panel .xkt-aq-empty {
  padding: 18px 12px;
  text-align: center;
  color: #777;
}
.xkt-aq-panel .xkt-aq-view {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  border-bottom: 1px solid #f4f4f4;
}
.xkt-aq-panel .xkt-aq-view:last-child { border-bottom: none; }
.xkt-aq-panel .xkt-aq-toggle {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}
.xkt-aq-panel .xkt-aq-toggle input { cursor: pointer; }
.xkt-aq-panel .xkt-aq-view-name {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 600;
  color: #222;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-aq-panel .xkt-aq-stats {
  flex: 0 0 auto;
  display: flex;
  gap: 6px;
}
.xkt-aq-panel .xkt-aq-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 999px;
  background: #f3f0fa;
  border: 1px solid #e3def0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10.5px;
  color: #334155;
  white-space: nowrap;
}
.xkt-aq-panel .xkt-aq-chip .xkt-aq-chip-k {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 9px;
  letter-spacing: 0.2px;
  text-transform: uppercase;
  color: #94a3b8;
}
/* Mode-aware chip: shifts colour when the View is in NavigationRender so the
   user can see at a glance which side of the flip each View is on. */
.xkt-aq-panel .xkt-aq-chip.xkt-aq-chip-nav {
  background: ${ACCENT};
  color: #fff;
  border-color: ${ACCENT_DARK};
}
.xkt-aq-panel .xkt-aq-chip.xkt-aq-chip-nav .xkt-aq-chip-k { color: rgba(255, 255, 255, 0.7); }
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

interface ViewRow {
  view: View;
  toggle: HTMLInputElement;
  fpsEl: HTMLElement;
  frameEl: HTMLElement;
  modeChip: HTMLElement;
  modeEl: HTMLElement;
}

const DEFAULT_REST_MS = 150;

export class AdaptiveQualityPanel extends FloatingPanelBase {

  private static readonly _instances = new WeakMap<Viewer, AdaptiveQualityPanel>();

  /** SVG: a tachometer needle, suggesting "speed switch". Strokes use `currentColor`. */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M3.5 17 A 9 9 0 0 1 20.5 17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>` +
      `<path d="M5 17 L 12 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>` +
      `<circle cx="12" cy="17" r="1.5" fill="currentColor"/>` +
      `<line x1="6.5" y1="14.5" x2="7.3" y2="13.7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>` +
      `<line x1="12"  y1="11"   x2="12"  y2="12"   stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>` +
      `<line x1="17.5" y1="14.5" x2="16.7" y2="13.7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>` +
    `</svg>`;
  }

  static getFor(viewer: Viewer): AdaptiveQualityPanel | undefined {
    const inst = AdaptiveQualityPanel._instances.get(viewer);
    return inst && !inst._destroyed ? inst : undefined;
  }

  static openFor(params: AdaptiveQualityPanelParams): AdaptiveQualityPanel {
    let inst = AdaptiveQualityPanel._instances.get(params.viewer);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new AdaptiveQualityPanel(params);
    return inst;
  }

  readonly viewer: Viewer;
  readonly renderer: WebGLRenderer;

  private _restMs = DEFAULT_REST_MS;

  private readonly _adapters = new Map<string, AdaptiveQuality>();

  // DOM refs.
  private _bodyEl!: HTMLElement;
  private _viewsEl!: HTMLElement;
  private _pulseEl!: HTMLElement;
  private _restMsVal!: HTMLElement;
  private readonly _viewRows = new Map<string, ViewRow>();

  // Lifecycle state.
  private _statsListenersAttached = false;
  private _refreshScheduled = false;
  private _pulseTimer: ReturnType<typeof setTimeout> | null = null;
  private _onViewRenderedUnsub: (() => void) | null = null;
  private readonly _viewLifecycleUnsubs: Array<() => void> = [];

  constructor(params: AdaptiveQualityPanelParams) {
    if (!params || !params.viewer || !params.renderer) {
      throw new Error("AdaptiveQualityPanel: viewer and renderer are required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-aq-panel",
      classPrefix: "xkt-aq",
      minWidth:    320,
      minHeight:   200,
    });
    this.viewer = params.viewer;
    this.renderer = params.renderer;

    const prior = AdaptiveQualityPanel._instances.get(params.viewer);
    if (prior && !prior._destroyed) prior.destroy();
    AdaptiveQualityPanel._instances.set(params.viewer, this);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();
    this._renderConfig();

    const ve = this.viewer.events;
    this._viewLifecycleUnsubs.push(
      ve.onViewCreated.subscribe(() => this._renderViews()),
      ve.onViewDestroyed.subscribe((_viewer, view) => {
        // AdaptiveQuality also self-destroys on view destroy; just drop our
        // map entry and rebuild the row list.
        this._adapters.delete(view.id);
        this._renderViews();
      }),
    );

    if (params.visible === false) this.hide(); else this.show();
  }


  // ── Public lifecycle ──────────────────────────────────────────

  get visible(): boolean {
    return this._panel.style.display !== "none";
  }

  show(): void {
    if (this._destroyed) return;
    super.show();
    this._enableInspector();
    this._attachStatsListeners();
    this._renderViews();
    this._renderStats();
  }

  hide(): void {
    if (this._destroyed) return;
    super.hide();
    this._detachStatsListeners();
  }

  toggle(): void {
    if (this.visible) this.hide(); else this.show();
  }

  destroy(): void {
    if (this._destroyed) return;
    this._detachStatsListeners();
    for (const u of this._viewLifecycleUnsubs) {
      try { u(); } catch { /* ignore */ }
    }
    this._viewLifecycleUnsubs.length = 0;
    for (const aq of this._adapters.values()) {
      try { aq.destroy(); } catch { /* ignore */ }
    }
    this._adapters.clear();
    if (AdaptiveQualityPanel._instances.get(this.viewer) === this) {
      AdaptiveQualityPanel._instances.delete(this.viewer);
    }
    super.destroy();
  }


  // ── Listener attach / detach ──────────────────────────────────

  private _attachStatsListeners(): void {
    if (this._statsListenersAttached || this._destroyed) return;
    this._statsListenersAttached = true;
    this._onViewRenderedUnsub = this.renderer.events.onViewRendered.subscribe(
      () => this._scheduleRefresh(),
    );
  }

  private _detachStatsListeners(): void {
    if (!this._statsListenersAttached) return;
    if (this._onViewRenderedUnsub) {
      try { this._onViewRenderedUnsub(); } catch { /* ignore */ }
      this._onViewRenderedUnsub = null;
    }
    if (this._pulseTimer) {
      clearTimeout(this._pulseTimer);
      this._pulseTimer = null;
    }
    this._statsListenersAttached = false;
    this._refreshScheduled = false;
  }

  private _scheduleRefresh(): void {
    if (this._destroyed || !this._statsListenersAttached) return;
    if (this._refreshScheduled) return;
    this._refreshScheduled = true;
    requestAnimationFrame(() => {
      this._refreshScheduled = false;
      if (this._destroyed || !this._statsListenersAttached) return;
      this._renderStats();
      this._flashPulse();
    });
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-aq-pill", {
      type: "button",
      title: "Reopen the Adaptive Quality panel",
      hidden: true,
      textContent: "Adaptive",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-aq-panel");

    this._header = el("div", "xkt-aq-header");
    const title = el("h2", "xkt-aq-title");
    title.innerHTML =
      `<span class="xkt-aq-title-icon">${AdaptiveQualityPanel.iconSvg()}</span>` +
      `<span class="xkt-aq-title-stack">` +
        `<span class="xkt-aq-title-text">Adaptive Quality</span>` +
        `<span class="xkt-aq-subtitle">Switches View into NavigationRender while the camera moves; back at rest.</span>` +
      `</span>`;
    this._pulseEl = el("span", "xkt-aq-pulse", {
      title: "Flashes each time the stats update from a render.",
    });
    this._closeBtn = el("button", "xkt-aq-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;
    this._header.append(title, this._pulseEl, this._closeBtn);
    this._panel.appendChild(this._header);

    this._bodyEl = el("div", "xkt-aq-body");
    this._panel.appendChild(this._bodyEl);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }

  private _renderConfig(): void {
    const section = el("div", "xkt-aq-section");
    section.appendChild(el("div", "xkt-aq-section-title", {textContent: "Settings"}));
    const body = el("div", "xkt-aq-section-body");

    {
      const row = el("div", "xkt-aq-row");
      row.appendChild(el("label", undefined, {
        textContent: "Rest delay",
        title: "Milliseconds the camera must be still before switching back to RealisticRender.",
      }));
      const slider = el("input", undefined, {
        type: "range", min: "0", max: "500", step: "10",
        value: String(this._restMs),
      }) as HTMLInputElement;
      this._restMsVal = el("span", "xkt-aq-val", {
        textContent: `${this._restMs} ms`,
      });
      slider.addEventListener("input", () => {
        this._restMs = parseInt(slider.value, 10);
        this._restMsVal.textContent = `${this._restMs} ms`;
        this._applyConfigToActiveAdapters();
      });
      row.append(slider, this._restMsVal);
      body.appendChild(row);
    }

    section.appendChild(body);
    this._bodyEl.appendChild(section);

    const viewsSection = el("div", "xkt-aq-section");
    viewsSection.appendChild(el("div", "xkt-aq-section-title", {textContent: "Views"}));
    this._viewsEl = el("div", "xkt-aq-section-body");
    viewsSection.appendChild(this._viewsEl);
    this._bodyEl.appendChild(viewsSection);
  }

  /**
   * Recreate every live AdaptiveQuality with the current config —
   * the class takes its params at construction and exposes no setters,
   * so a slider change destroys the existing adapter and builds a fresh
   * one (mirrors how `CullingPanel` handles its sliders).
   */
  private _applyConfigToActiveAdapters(): void {
    for (const [viewId, aq] of this._adapters) {
      const view = aq.view;
      try { aq.destroy(); } catch { /* ignore */ }
      this._adapters.set(viewId, new AdaptiveQuality({view, restMs: this._restMs}));
    }
  }


  // ── Per-View rows ─────────────────────────────────────────────

  private _renderViews(): void {
    if (this._destroyed) return;
    // Prune adapters for Views that no longer exist.
    const liveIds = new Set(this.viewer.viewList.map((v) => v.id));
    for (const id of [...this._adapters.keys()]) {
      if (!liveIds.has(id)) {
        try { this._adapters.get(id)!.destroy(); } catch { /* ignore */ }
        this._adapters.delete(id);
      }
    }

    this._viewsEl.replaceChildren();
    this._viewRows.clear();

    const views = this.viewer.viewList;
    if (views.length === 0) {
      this._viewsEl.appendChild(el("div", "xkt-aq-empty", {textContent: "No Views."}));
      return;
    }

    for (const view of views) {
      this._viewsEl.appendChild(this._buildViewRow(view));
    }
    this._renderStats();
  }

  private _buildViewRow(view: View): HTMLElement {
    const row = el("div", "xkt-aq-view");

    const toggleLabel = el("label", "xkt-aq-toggle", {
      title: "Enable adaptive quality for this View.",
    });
    const toggle = el("input", undefined, {type: "checkbox"}) as HTMLInputElement;
    toggle.checked = this._adapters.has(view.id);
    toggle.addEventListener("change", () => this._setViewAdaptive(view, toggle.checked));
    toggleLabel.appendChild(toggle);

    const name = el("span", "xkt-aq-view-name", {
      textContent: `View ${view.viewIndex} · ${view.id}`,
      title: view.id,
    });

    const stats = el("div", "xkt-aq-stats");
    const fpsEl = chip(stats, "fps");
    const frameEl = chip(stats, "ms");
    const {chipEl: modeChip, valEl: modeEl} = chipWithRef(stats, "mode");

    row.append(toggleLabel, name, stats);
    this._viewRows.set(view.id, {view, toggle, fpsEl, frameEl, modeChip, modeEl});
    return row;
  }

  private _setViewAdaptive(view: View, enabled: boolean): void {
    if (enabled) {
      if (this._adapters.has(view.id)) return;
      this._adapters.set(view.id, new AdaptiveQuality({view, restMs: this._restMs}));
    } else {
      const aq = this._adapters.get(view.id);
      if (aq) {
        try { aq.destroy(); } catch { /* ignore */ }
        this._adapters.delete(view.id);
      }
    }
    this._renderStats();
  }


  // ── Live stats ────────────────────────────────────────────────

  private _enableInspector(): void {
    const res = this.renderer.getRenderInspector();
    if (res.ok) res.value.enabled = true;
  }

  private _renderStats(): void {
    if (this._destroyed) return;
    const res = this.renderer.getRenderInspector();
    const inspector = res.ok ? res.value : null;

    for (const {view, fpsEl, frameEl, modeChip, modeEl} of this._viewRows.values()) {
      const i = view.viewIndex;
      const fps = inspector?.frameRates?.[i] ?? null;
      const frame = inspector?.renderStats?.views?.[i] ?? null;
      const duration = (frame?.timeMs as any)?.duration;

      fpsEl.textContent = fps == null ? "—" : fps.toFixed(0);
      frameEl.textContent = Number.isFinite(duration) ? duration.toFixed(1) : "—";

      const label = modeLabel(view.renderMode);
      modeEl.textContent = label;
      // Light up the chip purple while the View is in NavigationRender so the
      // flip is visible at a glance.
      modeChip.classList.toggle("xkt-aq-chip-nav", view.renderMode === NavigationRender);
    }
  }

  private _flashPulse(): void {
    if (!this._pulseEl) return;
    this._pulseEl.classList.add("xkt-aq-pulse-active");
    if (this._pulseTimer) clearTimeout(this._pulseTimer);
    this._pulseTimer = setTimeout(() => {
      this._pulseEl.classList.remove("xkt-aq-pulse-active");
      this._pulseTimer = null;
    }, 500);
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────

function chip(host: HTMLElement, key: string): HTMLElement {
  return chipWithRef(host, key).valEl;
}

function chipWithRef(host: HTMLElement, key: string): {chipEl: HTMLElement; valEl: HTMLElement} {
  const c = el("span", "xkt-aq-chip");
  c.appendChild(el("span", "xkt-aq-chip-k", {textContent: key}));
  const v = el("span", undefined, {textContent: "—"});
  c.appendChild(v);
  host.appendChild(c);
  return {chipEl: c, valEl: v};
}

function modeLabel(mode: number): string {
  switch (mode) {
    case NavigationRender: return "Nav";
    case DetailedRender:   return "Detail";
    case RealisticRender:  return "Real";
    default:               return String(mode);
  }
}
