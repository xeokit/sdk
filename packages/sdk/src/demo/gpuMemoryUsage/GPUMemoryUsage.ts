/**
 * Floating, draggable, **live-updating** GPU Memory panel.
 *
 * Combines the legacy `GPUMemoryUsagePanel` (allocated / used MB
 * + utilization bar) and `GPUMemoryConfigsPanel` (tile size,
 * batch limits, …) into a single panel with two collapsible
 * sections.
 *
 * Live sync — when the panel is visible, it subscribes to the
 * renderer's `onViewRendered` event (fires after every painted
 * frame) and coalesces re-paints to one per `requestAnimationFrame`,
 * so a busy renderer doesn't trigger a paint per draw call. While
 * the panel is hidden the listener is detached entirely, so a
 * dismissed panel costs nothing.
 *
 * Same chrome and lifecycle as the rest of the panel set
 * (`SceneHealthPanel`, `SchemaMaterialsPanel`,
 * `ViewerConfigPanel`, …): per-renderer WeakMap registry,
 * idempotent `getFor` / `openFor`, drag header, close + pill,
 * layout persistence, bring-to-front on pointer-down, scoped
 * `xkt-gpu-` CSS prefix.
 *
 * @module demo/gpuMemoryUsage
 */
import type {WebGLRenderer, MemoryUsage, MemoryConfigs} from "../../webGLRenderer";


import {el} from "../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";
// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface GPUMemoryPanelParams {

  /**
   * Renderer whose memory usage + configs the panel surfaces.
   * Doubles as the WeakMap key for
   * {@link GPUMemoryPanel.openFor} idempotence — one panel per
   * renderer.
   */
  renderer: WebGLRenderer;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed
   * state. Defaults to `"xkt-gpu-panel"`.
   */
  storageKey?: string;

  /** Show on construction (default `true`). */
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard for the whole page.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-gpu-styles";
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
// CSS
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-gpu-panel {
  position: fixed;
  top: 115px;
  right: 17px;
  width: 460px;
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
.xkt-gpu-panel *, .xkt-gpu-panel *::before, .xkt-gpu-panel *::after {
  box-sizing: border-box;
}
.xkt-gpu-panel[hidden] { display: none; }

.xkt-gpu-panel .xkt-gpu-header {
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
.xkt-gpu-panel .xkt-gpu-header.xkt-gpu-dragging { cursor: grabbing; }
.xkt-gpu-panel .xkt-gpu-title {
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
.xkt-gpu-panel .xkt-gpu-title-icon {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  color: #4a90e2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.xkt-gpu-panel .xkt-gpu-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-gpu-panel .xkt-gpu-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-gpu-panel .xkt-gpu-close {
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
.xkt-gpu-panel .xkt-gpu-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-gpu-pill {
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
  background: #4a90e2;
  border: 1px solid #2a6bb8;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.xkt-gpu-pill:hover { background: #2a6bb8; }
.xkt-gpu-pill[hidden] { display: none; }

.xkt-gpu-panel .xkt-gpu-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px 12px 12px;
}

/* Section <details> — Usage and Configs. */
.xkt-gpu-panel .xkt-gpu-section {
  margin: 6px 0;
  background: #fff;
  border: 1px solid #ececec;
  border-left: 3px solid #4a90e2;
  border-radius: 6px;
  overflow: hidden;
}
.xkt-gpu-panel .xkt-gpu-section[data-kind="configs"] { border-left-color: #2c7e6f; }
.xkt-gpu-panel .xkt-gpu-section > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  user-select: none;
}
.xkt-gpu-panel .xkt-gpu-section > summary::-webkit-details-marker { display: none; }
.xkt-gpu-panel .xkt-gpu-section > summary::marker                  { display: none; }
.xkt-gpu-panel .xkt-gpu-section > summary::before {
  content: "›";
  display: inline-block;
  transform: rotate(0deg);
  transition: transform 120ms ease-out;
  color: #888;
  font-size: 12px;
}
.xkt-gpu-panel .xkt-gpu-section[open] > summary::before { transform: rotate(90deg); }
.xkt-gpu-panel .xkt-gpu-section > summary:hover { background: #fafafa; }
.xkt-gpu-panel .xkt-gpu-section-label {
  flex: 1;
  font-size: 12px;
  font-weight: 650;
  color: #4a90e2;
  letter-spacing: -0.1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-gpu-panel .xkt-gpu-section[data-kind="configs"] .xkt-gpu-section-label { color: #2c7e6f; }
.xkt-gpu-panel .xkt-gpu-section-pulse {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #4a90e2;
  opacity: 0;
  transition: opacity 600ms ease-out;
}
.xkt-gpu-panel .xkt-gpu-section-pulse.xkt-gpu-pulse-active { opacity: 0.85; transition: none; }
.xkt-gpu-panel .xkt-gpu-section > .xkt-gpu-section-body {
  padding: 8px 12px 10px;
  border-top: 1px solid #f4f4f4;
  background: #fcfcfc;
}

/* Stat grid (allocated / used / utilization). */
.xkt-gpu-panel .xkt-gpu-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px 14px;
  margin-bottom: 8px;
}
.xkt-gpu-panel .xkt-gpu-stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 11px;
  min-width: 0;
}
.xkt-gpu-panel .xkt-gpu-stat-label {
  flex: 1;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  font-size: 9.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.xkt-gpu-panel .xkt-gpu-stat-value {
  flex-shrink: 0;
  color: #111;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.xkt-gpu-panel .xkt-gpu-stat-value.xkt-gpu-zero { color: #aaa; font-weight: 400; }

/* Utilization bar. */
.xkt-gpu-panel .xkt-gpu-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 11px;
}
.xkt-gpu-panel .xkt-gpu-bar-label {
  flex-shrink: 0;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  font-size: 9.5px;
  font-weight: 600;
}
.xkt-gpu-panel .xkt-gpu-bar-track {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: #f0f0f0;
  overflow: hidden;
  border: 1px solid #e6e6e6;
}
.xkt-gpu-panel .xkt-gpu-bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #cfe5ff 0%, #4a90e2 100%);
  width: 0%;
  transition: width 180ms ease-out, background 180ms ease-out;
}
.xkt-gpu-panel .xkt-gpu-bar-fill.xkt-gpu-bar-warn   { background: linear-gradient(90deg, #ffe7b3 0%, #d0a040 100%); }
.xkt-gpu-panel .xkt-gpu-bar-fill.xkt-gpu-bar-danger { background: linear-gradient(90deg, #ffcccc 0%, #c83232 100%); }
.xkt-gpu-panel .xkt-gpu-bar-pct {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: #444;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  min-width: 5ch;
  text-align: right;
}

/* Configs subsection group + KV table. */
.xkt-gpu-panel .xkt-gpu-subhead {
  margin: 6px 0 4px;
  font-size: 9.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: #2c7e6f;
}
.xkt-gpu-panel .xkt-gpu-subhead:first-child { margin-top: 0; }
.xkt-gpu-panel .xkt-gpu-kv {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 6px;
}
.xkt-gpu-panel .xkt-gpu-kv th {
  text-align: left;
  font-size: 11px;
  font-weight: 500;
  color: #555;
  padding: 3px 6px 3px 0;
  vertical-align: top;
  white-space: nowrap;
  width: 18ch;
}
.xkt-gpu-panel .xkt-gpu-kv td {
  padding: 3px 0;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
  color: #111;
  font-variant-numeric: tabular-nums;
  word-break: break-word;
}
.xkt-gpu-panel .xkt-gpu-empty {
  padding: 16px 8px;
  text-align: center;
  color: #777;
  font-size: 11px;
}
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

export class GPUMemoryPanel extends FloatingPanelBase {

  /**
   * Per-renderer instance registry. WeakMap so a renderer that
   * gets destroyed elsewhere doesn't keep the panel alive for
   * GC.
   */
  private static readonly _instances = new WeakMap<WebGLRenderer, GPUMemoryPanel>();

  /**
   * SVG markup for the panel's title-bar glyph (RAM stick — chip
   * outline + contact teeth). Strokes use `currentColor`.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="2.5" y="6"  width="19" height="10" rx="1.6" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<rect x="5"   y="8.5" width="3.4" height="5" rx="0.6" fill="currentColor" opacity="0.85"/>` +
      `<rect x="10.3" y="8.5" width="3.4" height="5" rx="0.6" fill="currentColor" opacity="0.65"/>` +
      `<rect x="15.6" y="8.5" width="3.4" height="5" rx="0.6" fill="currentColor" opacity="0.45"/>` +
      `<rect x="4"   y="16.6" width="1.6" height="1.6" rx="0.3" fill="currentColor"/>` +
      `<rect x="6.6" y="16.6" width="1.6" height="1.6" rx="0.3" fill="currentColor"/>` +
      `<rect x="9.2" y="16.6" width="1.6" height="1.6" rx="0.3" fill="currentColor"/>` +
      `<rect x="11.8" y="16.6" width="1.6" height="1.6" rx="0.3" fill="currentColor"/>` +
      `<rect x="14.4" y="16.6" width="1.6" height="1.6" rx="0.3" fill="currentColor"/>` +
      `<rect x="17"   y="16.6" width="1.6" height="1.6" rx="0.3" fill="currentColor"/>` +
    `</svg>`;
  }

  static getFor(renderer: WebGLRenderer): GPUMemoryPanel | undefined {
    const inst = GPUMemoryPanel._instances.get(renderer);
    return inst && !inst._destroyed ? inst : undefined;
  }

  static openFor(params: GPUMemoryPanelParams): GPUMemoryPanel {
    let inst = GPUMemoryPanel._instances.get(params.renderer);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new GPUMemoryPanel(params);
    return inst;
  }

  readonly renderer: WebGLRenderer;

  // DOM refs.
  private _bodyEl!: HTMLElement;

  private _allocatedEl!: HTMLElement;
  private _usedEl!: HTMLElement;
  private _freeEl!: HTMLElement;
  private _utilEl!: HTMLElement;
  private _barFill!: HTMLElement;
  private _barPct!: HTMLElement;
  private _pulseEl!: HTMLElement;
  private _configsBody!: HTMLElement;

  // Lifecycle state.
  private _listenersAttached = false;
  private _refreshScheduled = false;
  private _pulseTimer: ReturnType<typeof setTimeout> | null = null;
  private _onViewRenderedUnsub: (() => void) | null = null;

  // Drag state.

  constructor(params: GPUMemoryPanelParams) {
    if (!params || !params.renderer) {
      throw new Error("GPUMemoryPanel: renderer is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-gpu-panel",
      classPrefix: "xkt-gpu",
    });
    this.renderer = params.renderer;

    // Replace any prior panel bound to the same renderer.
    const prior = GPUMemoryPanel._instances.get(params.renderer);
    if (prior && !prior._destroyed) prior.destroy();
    GPUMemoryPanel._instances.set(params.renderer, this);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();
    this._wireDomEvents();


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
    this._renderConfigs();
    this._renderUsage();
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
    if (GPUMemoryPanel._instances.get(this.renderer) === this) {
      GPUMemoryPanel._instances.delete(this.renderer);
    }
    super.destroy();
  }


  // ── Listener attach / detach ──────────────────────────────────

  /**
   * Subscribe to the renderer's `onViewRendered` event so the
   * usage figures track the live state. A fresh frame ⇒ schedule
   * a coalesced refresh; per-frame busy renderers don't end up
   * triggering a paint per draw because
   * {@link _scheduleRefresh} folds bursts into one paint per
   * animation frame.
   *
   * Memory configs don't change at runtime under normal use, so
   * we paint them once on `show()` and leave them alone. If a
   * caller does mutate configs out-of-band, calling
   * {@link refresh} repaints both halves.
   */
  private _attachListeners(): void {
    if (this._listenersAttached || this._destroyed) return;
    this._listenersAttached = true;

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
   * Coalesce per-frame `onViewRendered` events into one paint
   * per animation frame. Without this, a renderer doing dozens
   * of view-renders per second would trigger dozens of usage
   * repaints — visually identical, just wasteful.
   */
  private _scheduleRefresh(): void {
    if (this._destroyed || !this._listenersAttached) return;
    if (this._refreshScheduled) return;
    this._refreshScheduled = true;
    requestAnimationFrame(() => {
      this._refreshScheduled = false;
      if (this._destroyed || !this._listenersAttached) return;
      this._renderUsage();
    });
  }

  /**
   * Public entry point — re-paint both halves of the panel.
   * Cheap; calls into `getMemoryUsage()` and `getMemoryConfigs()`
   * once each.
   */
  refresh(): void {
    if (this._destroyed) return;
    this._renderUsage();
    this._renderConfigs();
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-gpu-pill", {
      type: "button",
      title: "Reopen the GPU Memory panel",
      hidden: true,
      textContent: "GPU Memory",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-gpu-panel");

    // Header.
    this._header = el("div", "xkt-gpu-header");
    const title = el("h2", "xkt-gpu-title");
    title.innerHTML =
      `<span class="xkt-gpu-title-icon">${GPUMemoryPanel.iconSvg()}</span>` +
      `<span class="xkt-gpu-title-text">GPU Memory</span>`;

    this._closeBtn = el("button", "xkt-gpu-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;

    this._header.append(title, this._closeBtn);
    this._panel.appendChild(this._header);

    // Body — Usage section + Configs section.
    this._bodyEl = el("div", "xkt-gpu-body");

    // ── Usage section ──
    const usageSection = el("details", "xkt-gpu-section") as HTMLDetailsElement;
    usageSection.setAttribute("data-kind", "usage");
    usageSection.open = true;
    {
      const summary = el("summary");
      const label = el("span", "xkt-gpu-section-label", {textContent: "GPU Memory Usage"});
      this._pulseEl = el("span", "xkt-gpu-section-pulse", {title: "Live"});
      summary.append(label, this._pulseEl);
      usageSection.appendChild(summary);

      const body = el("div", "xkt-gpu-section-body");
      const stats = el("div", "xkt-gpu-stats");
      this._allocatedEl = this._mkStatRow(stats, "Allocated");
      this._usedEl      = this._mkStatRow(stats, "Used");
      this._freeEl      = this._mkStatRow(stats, "Free");
      this._utilEl      = this._mkStatRow(stats, "Utilization");
      body.appendChild(stats);

      const barRow = el("div", "xkt-gpu-bar-row");
      barRow.appendChild(el("span", "xkt-gpu-bar-label", {textContent: "Bar"}));
      const track = el("div", "xkt-gpu-bar-track");
      this._barFill = el("div", "xkt-gpu-bar-fill");
      track.appendChild(this._barFill);
      this._barPct = el("span", "xkt-gpu-bar-pct", {textContent: "0.0%"});
      barRow.append(track, this._barPct);
      body.appendChild(barRow);

      usageSection.appendChild(body);
      this._bodyEl.appendChild(usageSection);
    }

    // ── Configs section ──
    const configsSection = el("details", "xkt-gpu-section") as HTMLDetailsElement;
    configsSection.setAttribute("data-kind", "configs");
    configsSection.open = false;
    {
      const summary = el("summary");
      const label = el("span", "xkt-gpu-section-label", {textContent: "GPU Memory Configs"});
      summary.append(label);
      configsSection.appendChild(summary);

      this._configsBody = el("div", "xkt-gpu-section-body");
      configsSection.appendChild(this._configsBody);
      this._bodyEl.appendChild(configsSection);
    }

    this._panel.appendChild(this._bodyEl);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }

  private _mkStatRow(host: HTMLElement, label: string): HTMLElement {
    const row = el("div", "xkt-gpu-stat");
    row.append(
      el("span", "xkt-gpu-stat-label", {textContent: label}),
      el("span", "xkt-gpu-stat-value", {textContent: "—"}),
    );
    host.appendChild(row);
    return row.lastElementChild as HTMLElement;
  }

  private _wireDomEvents(): void {
  }


  // ── Layout persistence ────────────────────────────────────────



  // ── Rendering ─────────────────────────────────────────────────

  private _renderUsage(): void {
    const usage: MemoryUsage = this.renderer.getMemoryUsage();
    const allocated = Number(usage?.allocatedMB) || 0;
    const used      = Number(usage?.usedMB)      || 0;
    const free      = Math.max(0, allocated - used);
    const pct       = allocated > 0 ? clamp((used / allocated) * 100, 0, 100) : 0;

    this._allocatedEl.textContent = formatMB(allocated);
    this._usedEl.textContent      = formatMB(used);
    this._freeEl.textContent      = formatMB(free);
    this._utilEl.textContent      = `${pct.toFixed(1)}%`;
    setZero(this._allocatedEl, allocated === 0);
    setZero(this._usedEl,      used      === 0);
    setZero(this._freeEl,      free      === 0);
    setZero(this._utilEl,      pct       === 0);

    this._barFill.style.width = `${pct}%`;
    this._barFill.classList.remove("xkt-gpu-bar-warn", "xkt-gpu-bar-danger");
    if      (pct >= 90) this._barFill.classList.add("xkt-gpu-bar-danger");
    else if (pct >= 75) this._barFill.classList.add("xkt-gpu-bar-warn");
    this._barPct.textContent = `${pct.toFixed(1)}%`;

    this._flashPulse();
  }

  private _renderConfigs(): void {
    this._configsBody.innerHTML = "";
    const configs: MemoryConfigs = this.renderer.getMemoryConfigs();
    if (!configs) {
      this._configsBody.appendChild(el("div", "xkt-gpu-empty", {textContent: "No memory configs available."}));
      return;
    }

    appendSubsection(this._configsBody, "RTC Tiling", [
      ["tileSize",  configs.tileSize],
      ["maxTiles",  configs.maxTiles],
      ["maxViews",  (configs as any).maxViews],
    ]);
    appendSubsection(this._configsBody, "Batching", [
      ["maxBatches",          configs.maxBatches],
      ["maxBatchVertices",    configs.maxBatchVertices],
      ["maxBatchIndices",     configs.maxBatchIndices],
      ["maxBatchGeometries",  configs.maxBatchGeometries],
      ["maxBatchMeshes",      configs.maxBatchMeshes],
      ["maxBatchPrims",       configs.maxBatchPrims],
    ]);
  }

  /** Flicker the live-pulse dot for a few hundred ms after each
   * coalesced refresh, so the user can tell at a glance that the
   * panel is tracking the renderer (rather than going stale). */
  private _flashPulse(): void {
    if (!this._pulseEl) return;
    this._pulseEl.classList.add("xkt-gpu-pulse-active");
    if (this._pulseTimer) clearTimeout(this._pulseTimer);
    this._pulseTimer = setTimeout(() => {
      this._pulseEl.classList.remove("xkt-gpu-pulse-active");
      this._pulseTimer = null;
    }, 600);
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────


function appendSubsection(host: HTMLElement, title: string, rows: Array<[string, any]>): void {
  host.appendChild(el("div", "xkt-gpu-subhead", {textContent: title}));
  const table = el("table", "xkt-gpu-kv");
  for (const [k, v] of rows) {
    if (v === undefined) continue;     // skip absent fields
    const tr = el("tr");
    tr.append(
      el("th", undefined, {textContent: k, title: k}),
      el("td", undefined, {textContent: formatNumber(v)}),
    );
    table.appendChild(tr);
  }
  host.appendChild(table);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function formatNumber(v: any): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v ?? "—");
}

function formatMB(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `${v.toLocaleString(undefined, {maximumFractionDigits: 2})} MB`;
}

function setZero(el: HTMLElement, isZero: boolean): void {
  if (isZero) el.classList.add("xkt-gpu-zero");
  else        el.classList.remove("xkt-gpu-zero");
}
