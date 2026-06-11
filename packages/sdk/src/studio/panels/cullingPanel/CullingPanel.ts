/**
 * Floating, draggable, closeable panel that drives the SDK's
 * worker-based view culling (see {@link spatial!culling}) from the
 * Studio toolbar.
 *
 * The panel owns one {@link spatial!culling.ViewCuller | ViewCuller}
 * per {@link viewing!viewer.View | View}, created and destroyed on a
 * per-View enable toggle so culling can be switched on for each View
 * independently. The {@link spatial!culling.CullParams | CullParams}
 * (solid-angle limit + cull cadence) are global to the panel; changing
 * one re-creates any active cullers with the new settings.
 *
 * A live readout per View shows FPS, frame time, and the culled-object
 * count — read from the renderer's {@link viewing!webGLRenderer.WebGLRenderer | WebGLRenderer}
 * render inspector and each View's object set, the same numbers the
 * `building_doublePrecision_archipelago` example surfaces.
 *
 * ## Lazy event wiring
 *
 * Per-frame stat listeners attach **only while the panel is visible**.
 * While hidden, the panel costs nothing per render. The View-lifecycle
 * watcher stays subscribed even when hidden so the per-View rows track
 * Views coming and going.
 *
 * ```ts
 * import {CullingPanel} from "@xeokit/sdk/studio";
 *
 * const panel = CullingPanel.openFor({viewer, renderer});
 * panel.hide();
 * panel.destroy();    // tears down DOM, listeners, and every ViewCuller it owns
 * ```
 */
import type {Viewer, View} from "../../../viewing/viewer";
import type {WebGLRenderer} from "../../../viewing/webGLRenderer";
import {ViewCuller, DEFAULT_CULL_PARAMS} from "../../../spatial/culling";

import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";


// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface CullingPanelParams {

  /** Viewer whose Views the panel can enable culling on. */
  viewer: Viewer;

  /** Renderer queried for per-View FPS / frame-time / primitive stats. */
  renderer: WebGLRenderer;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed state.
   * Defaults to `"xkt-cull-panel"`.
   */
  storageKey?: string;

  /** Show on construction (default `true`). */
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-cull-styles";
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
// CSS — every selector rooted at `.xkt-cull-panel` / `.xkt-cull-pill`,
// every class prefixed `xkt-cull-`. Matches the other stats panels.
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-cull-panel {
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
.xkt-cull-panel *, .xkt-cull-panel *::before, .xkt-cull-panel *::after {
  box-sizing: border-box;
}
.xkt-cull-panel[hidden] { display: none; }

.xkt-cull-panel .xkt-cull-header {
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
.xkt-cull-panel .xkt-cull-header.xkt-cull-dragging { cursor: grabbing; }
.xkt-cull-panel .xkt-cull-title {
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
.xkt-cull-panel .xkt-cull-title-icon {
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
.xkt-cull-panel .xkt-cull-title-icon svg { width: 100%; height: 100%; display: block; }
.xkt-cull-panel .xkt-cull-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-cull-panel .xkt-cull-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-cull-panel .xkt-cull-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
.xkt-cull-panel .xkt-cull-pulse {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #c9d3df;
  transition: background 120ms ease-out;
}
.xkt-cull-panel .xkt-cull-pulse.xkt-cull-pulse-active { background: #27ae60; }
.xkt-cull-panel .xkt-cull-close {
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
.xkt-cull-panel .xkt-cull-close:hover { background: #f0f0f0; color: #222; border-color: #d0d0d0; }

.xkt-cull-pill {
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
  background: #2d5e8c;
  border: 1px solid #1f4669;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.xkt-cull-pill:hover { background: #1f4669; }
.xkt-cull-pill[hidden] { display: none; }

.xkt-cull-panel .xkt-cull-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 10px 12px 14px;
}

/* Section — config + views. */
.xkt-cull-panel .xkt-cull-section {
  margin: 6px 0 10px;
  background: #fff;
  border: 1px solid #ececec;
  border-left: 3px solid #2d5e8c;
  border-radius: 6px;
  overflow: hidden;
}
.xkt-cull-panel .xkt-cull-section-title {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: #2d5e8c;
  background: #fafcff;
  border-bottom: 1px solid #f0f0f0;
}
.xkt-cull-panel .xkt-cull-section-body { padding: 8px 12px 10px; }

/* Config rows — label + slider + readout. */
.xkt-cull-panel .xkt-cull-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 0;
}
.xkt-cull-panel .xkt-cull-row > label {
  flex: 0 0 96px;
  color: #333;
  font-size: 11.5px;
}
.xkt-cull-panel .xkt-cull-row input[type="range"] { flex: 1 1 auto; min-width: 0; }
.xkt-cull-panel .xkt-cull-val {
  flex: 0 0 56px;
  text-align: right;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #475569;
}

/* Per-view rows. */
.xkt-cull-panel .xkt-cull-empty {
  padding: 18px 12px;
  text-align: center;
  color: #777;
}
.xkt-cull-panel .xkt-cull-view {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  border-bottom: 1px solid #f4f4f4;
}
.xkt-cull-panel .xkt-cull-view:last-child { border-bottom: none; }
.xkt-cull-panel .xkt-cull-toggle {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}
.xkt-cull-panel .xkt-cull-toggle input { cursor: pointer; }
.xkt-cull-panel .xkt-cull-view-name {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 600;
  color: #222;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-cull-panel .xkt-cull-stats {
  flex: 0 0 auto;
  display: flex;
  gap: 6px;
}
.xkt-cull-panel .xkt-cull-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 999px;
  background: #f3f5f8;
  border: 1px solid #e3e8ee;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10.5px;
  color: #334155;
  white-space: nowrap;
}
.xkt-cull-panel .xkt-cull-chip .xkt-cull-chip-k {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 9px;
  letter-spacing: 0.2px;
  text-transform: uppercase;
  color: #94a3b8;
}
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

interface ViewRow {
  view: View;
  toggle: HTMLInputElement;
  fpsEl: HTMLElement;
  frameEl: HTMLElement;
  culledEl: HTMLElement;
}

export class CullingPanel extends FloatingPanelBase {

  /**
   * Per-Viewer instance registry — one culling panel per Viewer.
   * Lets {@link openFor} hand back the live panel instead of stacking
   * duplicates, and {@link getFor} probe without disturbing it.
   * WeakMap so a dropped Viewer doesn't keep the panel alive for GC.
   */
  private static readonly _instances = new WeakMap<Viewer, CullingPanel>();

  /**
   * SVG markup for the panel's title-bar / toolbar glyph: a camera
   * frustum with one box kept inside and one dashed box culled
   * outside. Strokes use `currentColor`.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<circle cx="3.5" cy="12" r="1.3" fill="currentColor" stroke="none"/>` +
      `<path d="M3.5 12 L21 5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>` +
      `<path d="M3.5 12 L21 19" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>` +
      `<line x1="21" y1="5" x2="21" y2="19" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>` +
      `<rect x="10.5" y="10" width="4.4" height="4.4" rx="0.6" fill="none" stroke="currentColor" stroke-width="1.4"/>` +
      `<rect x="16.5" y="2.2" width="3.6" height="3.6" rx="0.6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="1.6 1.4"/>` +
    `</svg>`;
  }

  /**
   * Returns the existing live panel bound to `viewer`, or `undefined`
   * if none has been constructed (or the prior instance was destroyed).
   */
  static getFor(viewer: Viewer): CullingPanel | undefined {
    const inst = CullingPanel._instances.get(viewer);
    return inst && !inst._destroyed ? inst : undefined;
  }

  /**
   * Reveal (or lazily mount) a panel for `params.viewer`. Idempotent —
   * an existing live panel is brought to the foreground; otherwise a
   * fresh one is constructed.
   */
  static openFor(params: CullingPanelParams): CullingPanel {
    let inst = CullingPanel._instances.get(params.viewer);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new CullingPanel(params);
    return inst;
  }

  readonly viewer: Viewer;
  readonly renderer: WebGLRenderer;

  // Config — global to the panel, applied to every ViewCuller.
  private _solidAngleLimit = DEFAULT_CULL_PARAMS.solidAngleLimit;
  private _cullEveryNUpdates = DEFAULT_CULL_PARAMS.cullEveryNUpdates;

  // One culler per enabled View, keyed by View.id.
  private readonly _cullers = new Map<string, ViewCuller>();

  // DOM refs.
  private _bodyEl!: HTMLElement;
  private _viewsEl!: HTMLElement;
  private _pulseEl!: HTMLElement;
  private _solidAngleVal!: HTMLElement;
  private _cullEveryVal!: HTMLElement;
  private readonly _viewRows = new Map<string, ViewRow>();

  // Lifecycle state.
  private _statsListenersAttached = false;
  private _refreshScheduled = false;
  private _pulseTimer: ReturnType<typeof setTimeout> | null = null;
  private _onViewRenderedUnsub: (() => void) | null = null;
  private readonly _viewLifecycleUnsubs: Array<() => void> = [];

  constructor(params: CullingPanelParams) {
    if (!params || !params.viewer || !params.renderer) {
      throw new Error("CullingPanel: viewer and renderer are required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-cull-panel",
      classPrefix: "xkt-cull",
      minWidth:    320,
      minHeight:   200,
    });
    this.viewer = params.viewer;
    this.renderer = params.renderer;

    // Replace any prior panel bound to the same Viewer.
    const prior = CullingPanel._instances.get(params.viewer);
    if (prior && !prior._destroyed) prior.destroy();
    CullingPanel._instances.set(params.viewer, this);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();
    this._renderConfig();

    // Always-on View-lifecycle watcher so the per-View rows stay in
    // step even while the panel is hidden. A View being destroyed also
    // self-destroys its ViewCuller (the culler subscribes to
    // onViewDestroyed), so we just drop our map entry and rebuild.
    const ve = this.viewer.events;
    this._viewLifecycleUnsubs.push(
      ve.onViewCreated.subscribe(() => this._renderViews()),
      ve.onViewDestroyed.subscribe((_viewer, view) => {
        this._cullers.delete(view.id);
        this._renderViews();
      }),
    );

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

  /** Reveal panel. Attaches per-frame listeners + paints fresh content. */
  show(): void {
    if (this._destroyed) return;
    super.show();
    this._enableInspector();
    this._attachStatsListeners();
    this._renderViews();
    this._renderStats();
  }

  /** Hide panel and detach the per-frame stat listener. */
  hide(): void {
    if (this._destroyed) return;
    super.hide();
    this._detachStatsListeners();
  }

  /** Toggle visibility. */
  toggle(): void {
    if (this.visible) this.hide(); else this.show();
  }

  /** Tear down DOM, listeners, and every ViewCuller the panel owns. */
  destroy(): void {
    if (this._destroyed) return;
    this._detachStatsListeners();
    for (const u of this._viewLifecycleUnsubs) {
      try { u(); } catch { /* ignore */ }
    }
    this._viewLifecycleUnsubs.length = 0;
    for (const culler of this._cullers.values()) {
      try { culler.destroy(); } catch { /* ignore */ }
    }
    this._cullers.clear();
    if (CullingPanel._instances.get(this.viewer) === this) {
      CullingPanel._instances.delete(this.viewer);
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

  /**
   * Coalesce the renderer's many `onViewRendered` events into at most
   * one stat repaint per animation frame.
   */
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
    this._pill = el("button", "xkt-cull-pill", {
      type: "button",
      title: "Reopen the Culling panel",
      hidden: true,
      textContent: "Culling",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-cull-panel");

    // Header.
    this._header = el("div", "xkt-cull-header");
    const title = el("h2", "xkt-cull-title");
    title.innerHTML =
      `<span class="xkt-cull-title-icon">${CullingPanel.iconSvg()}</span>` +
      `<span class="xkt-cull-title-stack">` +
        `<span class="xkt-cull-title-text">Culling</span>` +
        `<span class="xkt-cull-subtitle">Worker-based frustum + solid-angle culling, per View.</span>` +
      `</span>`;
    this._pulseEl = el("span", "xkt-cull-pulse", {
      title: "Flashes each time the stats update from a render.",
    });
    this._closeBtn = el("button", "xkt-cull-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;
    this._header.append(title, this._pulseEl, this._closeBtn);
    this._panel.appendChild(this._header);

    // Body.
    this._bodyEl = el("div", "xkt-cull-body");
    this._panel.appendChild(this._bodyEl);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }

  /** Build the config sliders once. Wired to recreate active cullers. */
  private _renderConfig(): void {
    const section = el("div", "xkt-cull-section");
    section.appendChild(el("div", "xkt-cull-section-title", {textContent: "Settings"}));
    const body = el("div", "xkt-cull-section-body");

    // Solid-angle limit.
    {
      const row = el("div", "xkt-cull-row");
      row.appendChild(el("label", undefined, {
        textContent: "Min size",
        title: "Solid-angle limit (radians) — objects subtending less are culled.",
      }));
      const slider = el("input", undefined, {
        type: "range", min: "0", max: "0.05", step: "0.001",
        value: String(this._solidAngleLimit),
      }) as HTMLInputElement;
      this._solidAngleVal = el("span", "xkt-cull-val", {
        textContent: this._solidAngleLimit.toFixed(3),
      });
      slider.addEventListener("input", () => {
        this._solidAngleLimit = parseFloat(slider.value);
        this._solidAngleVal.textContent = this._solidAngleLimit.toFixed(3);
        this._applyConfigToActiveCullers();
      });
      row.append(slider, this._solidAngleVal);
      body.appendChild(row);
    }

    // Cull cadence.
    {
      const row = el("div", "xkt-cull-row");
      row.appendChild(el("label", undefined, {
        textContent: "Every Nth",
        title: "Run a cull pass only every Nth camera-movement event.",
      }));
      const slider = el("input", undefined, {
        type: "range", min: "1", max: "20", step: "1",
        value: String(this._cullEveryNUpdates),
      }) as HTMLInputElement;
      this._cullEveryVal = el("span", "xkt-cull-val", {
        textContent: String(this._cullEveryNUpdates),
      });
      slider.addEventListener("input", () => {
        this._cullEveryNUpdates = parseInt(slider.value, 10);
        this._cullEveryVal.textContent = String(this._cullEveryNUpdates);
        this._applyConfigToActiveCullers();
      });
      row.append(slider, this._cullEveryVal);
      body.appendChild(row);
    }

    section.appendChild(body);
    this._bodyEl.appendChild(section);

    // Views section shell — rows filled by _renderViews().
    const viewsSection = el("div", "xkt-cull-section");
    viewsSection.appendChild(el("div", "xkt-cull-section-title", {textContent: "Views"}));
    this._viewsEl = el("div", "xkt-cull-section-body");
    viewsSection.appendChild(this._viewsEl);
    this._bodyEl.appendChild(viewsSection);
  }

  /**
   * Recreate every active ViewCuller with the current config. ViewCuller
   * takes its params at construction and exposes no setters, so a config
   * change destroys the existing culler and builds a fresh one (the
   * destroy-then-create order also satisfies the one-culler-per-View
   * guard).
   */
  private _applyConfigToActiveCullers(): void {
    for (const [viewId, culler] of this._cullers) {
      const view = culler.view;
      try { culler.destroy(); } catch { /* ignore */ }
      this._cullers.set(viewId, new ViewCuller(view, {
        solidAngleLimit:   this._solidAngleLimit,
        cullEveryNUpdates: this._cullEveryNUpdates,
      }));
    }
  }


  // ── Per-View rows ─────────────────────────────────────────────

  /** Rebuild the per-View rows from the Viewer's current View list. */
  private _renderViews(): void {
    if (this._destroyed) return;
    // Prune cullers for Views that no longer exist.
    const liveIds = new Set(this.viewer.viewList.map((v) => v.id));
    for (const id of [...this._cullers.keys()]) {
      if (!liveIds.has(id)) {
        try { this._cullers.get(id)!.destroy(); } catch { /* ignore */ }
        this._cullers.delete(id);
      }
    }

    this._viewsEl.replaceChildren();
    this._viewRows.clear();

    const views = this.viewer.viewList;
    if (views.length === 0) {
      this._viewsEl.appendChild(el("div", "xkt-cull-empty", {textContent: "No Views."}));
      return;
    }

    for (const view of views) {
      this._viewsEl.appendChild(this._buildViewRow(view));
    }
    this._renderStats();
  }

  private _buildViewRow(view: View): HTMLElement {
    const row = el("div", "xkt-cull-view");

    const toggleLabel = el("label", "xkt-cull-toggle", {
      title: "Enable culling for this View.",
    });
    const toggle = el("input", undefined, {type: "checkbox"}) as HTMLInputElement;
    toggle.checked = this._cullers.has(view.id);
    toggle.addEventListener("change", () => this._setViewCulling(view, toggle.checked));
    toggleLabel.appendChild(toggle);

    const name = el("span", "xkt-cull-view-name", {
      textContent: `View ${view.viewIndex} · ${view.id}`,
      title: view.id,
    });

    const stats = el("div", "xkt-cull-stats");
    const fpsEl = chip(stats, "fps");
    const frameEl = chip(stats, "ms");
    const culledEl = chip(stats, "culled");

    row.append(toggleLabel, name, stats);
    this._viewRows.set(view.id, {view, toggle, fpsEl, frameEl, culledEl});
    return row;
  }

  /** Enable or disable culling for a single View. */
  private _setViewCulling(view: View, enabled: boolean): void {
    if (enabled) {
      if (this._cullers.has(view.id)) return;
      this._cullers.set(view.id, new ViewCuller(view, {
        solidAngleLimit:   this._solidAngleLimit,
        cullEveryNUpdates: this._cullEveryNUpdates,
      }));
    } else {
      const culler = this._cullers.get(view.id);
      if (culler) {
        try { culler.destroy(); } catch { /* ignore */ }
        this._cullers.delete(view.id);
      }
    }
    this._renderStats();
  }


  // ── Live stats ────────────────────────────────────────────────

  private _enableInspector(): void {
    const res = this.renderer.getRenderInspector();
    if (res.ok) res.value.enabled = true;
  }

  /** Update FPS / frame time / culled count for every View row. */
  private _renderStats(): void {
    if (this._destroyed) return;
    const res = this.renderer.getRenderInspector();
    const inspector = res.ok ? res.value : null;

    for (const {view, fpsEl, frameEl, culledEl} of this._viewRows.values()) {
      const i = view.viewIndex;
      const fps = inspector?.frameRates?.[i] ?? null;
      const frame = inspector?.renderStats?.views?.[i] ?? null;
      const duration = (frame?.timeMs as any)?.duration;

      fpsEl.textContent = fps == null ? "—" : fps.toFixed(0);
      frameEl.textContent = Number.isFinite(duration) ? duration.toFixed(1) : "—";
      culledEl.textContent = countCulled(view);
    }
  }

  /** Flicker the live-pulse dot after each coalesced stat repaint. */
  private _flashPulse(): void {
    if (!this._pulseEl) return;
    this._pulseEl.classList.add("xkt-cull-pulse-active");
    if (this._pulseTimer) clearTimeout(this._pulseTimer);
    this._pulseTimer = setTimeout(() => {
      this._pulseEl.classList.remove("xkt-cull-pulse-active");
      this._pulseTimer = null;
    }, 500);
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────

/** Append a labelled stat chip to `host` and return its value span. */
function chip(host: HTMLElement, key: string): HTMLElement {
  const c = el("span", "xkt-cull-chip");
  c.appendChild(el("span", "xkt-cull-chip-k", {textContent: key}));
  const v = el("span", undefined, {textContent: "—"});
  c.appendChild(v);
  host.appendChild(c);
  return v;
}

/** `"<culled> / <total>"` over the View's objects — matches the example. */
function countCulled(view: View): string {
  const objects = view.objects;
  const ids = Object.keys(objects);
  let culled = 0;
  for (let i = 0; i < ids.length; i++) {
    if (objects[ids[i]]?.culled) culled++;
  }
  return `${culled} / ${ids.length}`;
}
