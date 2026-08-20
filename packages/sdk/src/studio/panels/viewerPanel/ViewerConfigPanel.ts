/**
 * Floating, draggable, **editable** Viewer-config panel.
 *
 * Walks the Viewer's serialised `ViewerParams`, renders one
 * collapsible `<details>` section per top-level group (Viewer
 * meta, then per-View: General · Camera · Effects · Lights ·
 * Materials · Section Planes · Resolution Scale · Layers), and
 * lets the user edit any primitive / number-array / nested-object
 * field through inline input controls. Each edit mutates the
 * params object in place and re-applies via
 * `Viewer.fromParams(params)` so canvas-side state tracks the
 * panel-side state on every keystroke.
 *
 * Same chrome and lifecycle as the rest of the panel set
 * (`SceneHealthPanel`, `SchemaMaterialsPanel`,
 * `SceneStatsPanel`, …): per-Viewer WeakMap registry, idempotent
 * `getFor` / `openFor`, drag header, close + pill, layout
 * persistence, bring-to-front on pointer-down, scoped
 * `xkt-vcp-` CSS prefix.
 *
 */
import type {Viewer} from "../../../viewing/viewer";
import type {View} from "../../../viewing/viewer/View";
import type {ViewerParams} from "../../../viewing/viewer/ViewerParams";
import type {ViewParams} from "../../../viewing/viewer/ViewParams";
import type {ViewLayerParams} from "../../../viewing/viewer/ViewLayerParams";
import type {Studio} from "../../Studio";


import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";

/**
 * Single-field apply callback handed down through the render
 * pipeline. Each leaf input invokes `apply(key, value)` to push
 * just the field that changed back to the live SDK object —
 * never the whole `ViewerParams` snapshot — so unrelated state
 * (notably the camera) is left untouched between edits.
 */
type ApplyFn = (key: string | number, value: any) => void;
// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface ViewerConfigPanelParams {

  /**
   * Viewer to inspect and edit. Doubles as the WeakMap key for
   * {@link ViewerConfigPanel.openFor} idempotence — one panel per
   * Viewer.
   */
  viewer: Viewer;

  /**
   * Optional helper that wires the panel's "New View" footer
   * button and the per-View destroy buttons. When absent, both
   * actions still work — "New View" calls `Viewer.createView({})`
   * and destroy calls `view.destroy()` — but the helper's
   * per-View bookkeeping (auto-canvas, CameraFlight, controllers)
   * is skipped.
   */
  studio?: Studio;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed
   * state. Defaults to `"xkt-vcp-panel"`.
   */
  storageKey?: string;

  /** Show on construction (default `true`). */
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard for the whole page.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-vcp-styles";
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
// CSS — same chrome as SceneHealthPanel / SchemaMaterialsPanel,
// scoped to `.xkt-vcp-panel` and `.xkt-vcp-pill`.
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-vcp-panel {
  position: fixed;
  top: 115px;
  right: 17px;
  width: 640px;
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
.xkt-vcp-panel *, .xkt-vcp-panel *::before, .xkt-vcp-panel *::after {
  box-sizing: border-box;
}
.xkt-vcp-panel[hidden] { display: none; }

.xkt-vcp-panel .xkt-vcp-header {
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
.xkt-vcp-panel .xkt-vcp-header.xkt-vcp-dragging { cursor: grabbing; }
.xkt-vcp-panel .xkt-vcp-title {
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
.xkt-vcp-panel .xkt-vcp-title-icon {
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
.xkt-vcp-panel .xkt-vcp-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-vcp-panel .xkt-vcp-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-vcp-panel .xkt-vcp-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-vcp-panel .xkt-vcp-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
.xkt-vcp-panel .xkt-vcp-title-id {
  flex-shrink: 0;
  padding: 2px 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 500;
  color: #555;
  background: #f0f0f0;
  border-radius: 4px;
  letter-spacing: 0.1px;
}
.xkt-vcp-panel .xkt-vcp-close {
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
.xkt-vcp-panel .xkt-vcp-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-vcp-pill {
  position: fixed;
  bottom: 17px;
  right: 339px;
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
.xkt-vcp-pill:hover { background: #1f4669; }
.xkt-vcp-pill[hidden] { display: none; }

/* Top actions row — sits under the header and hosts the "New View"
 * primary button. The panel auto-updates from Viewer events, so no
 * Refresh button is needed. */
.xkt-vcp-panel .xkt-vcp-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid #ececec;
  background: #fafafa;
}

.xkt-vcp-panel .xkt-vcp-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px 12px 14px;
}
.xkt-vcp-panel .xkt-vcp-empty {
  padding: 24px 12px;
  text-align: center;
  color: #777;
  font-size: 12px;
}

/* Top-level summary row (Viewer ID + view count). */
.xkt-vcp-panel .xkt-vcp-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 4px;
  font-size: 11px;
}
.xkt-vcp-panel .xkt-vcp-summary-k {
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  font-size: 9.5px;
  font-weight: 600;
}
.xkt-vcp-panel .xkt-vcp-summary-v {
  font-weight: 600;
  color: #111;
  font-variant-numeric: tabular-nums;
}
.xkt-vcp-panel .xkt-vcp-summary input.xkt-vcp-input {
  font-size: 11px;
  padding: 2px 6px;
  width: 18ch;
}

/* Section <details> — outer (per-View) and inner (per-group). */
.xkt-vcp-panel .xkt-vcp-section {
  margin: 6px 0;
  background: #fff;
  border: 1px solid #ececec;
  border-left: 3px solid #2d5e8c;
  border-radius: 6px;
  overflow: hidden;
}
.xkt-vcp-panel .xkt-vcp-section[data-kind="view"]    { border-left-color: #2d5e8c; }
.xkt-vcp-panel .xkt-vcp-section[data-kind="group"]   { border-left-color: #2c7e6f; }
.xkt-vcp-panel .xkt-vcp-section[data-kind="layers"]  { border-left-color: #9c4666; }
.xkt-vcp-panel .xkt-vcp-section > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  user-select: none;
}
.xkt-vcp-panel .xkt-vcp-section > summary::-webkit-details-marker { display: none; }
.xkt-vcp-panel .xkt-vcp-section > summary::marker                  { display: none; }
.xkt-vcp-panel .xkt-vcp-section > summary::before {
  content: "›";
  display: inline-block;
  transform: rotate(0deg);
  transition: transform 120ms ease-out;
  color: #888;
  font-size: 12px;
}
.xkt-vcp-panel .xkt-vcp-section[open] > summary::before { transform: rotate(90deg); }
.xkt-vcp-panel .xkt-vcp-section > summary:hover { background: #fafafa; }
.xkt-vcp-panel .xkt-vcp-section-label {
  flex: 1;
  font-size: 12px;
  font-weight: 650;
  color: #2d5e8c;
  letter-spacing: -0.1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-vcp-panel .xkt-vcp-section[data-kind="group"]  .xkt-vcp-section-label { color: #2c7e6f; }
.xkt-vcp-panel .xkt-vcp-section[data-kind="layers"] .xkt-vcp-section-label { color: #9c4666; }
.xkt-vcp-panel .xkt-vcp-section-id {
  flex-shrink: 0;
  padding: 1px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.2px;
  color: #666;
  background: #f0f0f0;
  border-radius: 3px;
  white-space: nowrap;
}
.xkt-vcp-panel .xkt-vcp-section-count {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  font-variant-numeric: tabular-nums;
}
/* Per-View destroy button — sits at the right end of the summary row,
 * subdued by default and reddens on hover. Hidden until the row is
 * hovered to keep the chrome quiet. */
.xkt-vcp-panel .xkt-vcp-section-destroy {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  font: inherit;
  font-size: 16px;
  line-height: 1;
  color: #888;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 100ms ease-out, background 100ms ease-out, color 100ms ease-out, border-color 100ms ease-out;
}
.xkt-vcp-panel .xkt-vcp-section > summary:hover .xkt-vcp-section-destroy { opacity: 1; }
.xkt-vcp-panel .xkt-vcp-section-destroy:hover {
  color: #b73d3d;
  background: #fff3f3;
  border-color: #f0c8c8;
}
.xkt-vcp-panel .xkt-vcp-section-destroy:focus-visible {
  opacity: 1;
  border-color: #b73d3d;
  box-shadow: 0 0 0 2px rgba(183, 61, 61, 0.18);
}
.xkt-vcp-panel .xkt-vcp-section > .xkt-vcp-section-body {
  padding: 6px 10px 10px;
  border-top: 1px solid #f4f4f4;
  background: #fcfcfc;
}

/* Nested sections use no left-border stripe so nesting is visually
   quieter than the top-level View block. */
.xkt-vcp-panel .xkt-vcp-section .xkt-vcp-section {
  border-left-width: 1px;
  border-left-color: #ececec;
  margin: 4px 0;
}

/* KV table — label col + value col, value col gets inputs in
   editable mode. */
.xkt-vcp-panel .xkt-vcp-kv {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.xkt-vcp-panel .xkt-vcp-kv th {
  width: var(--xkt-vcp-keyw, 16ch);
  vertical-align: top;
  padding: 4px 8px 4px 4px;
  text-align: left;
  font-weight: 600;
  color: #2d5e8c;
  font-size: 11px;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-vcp-panel .xkt-vcp-kv td {
  vertical-align: top;
  padding: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #111;
  word-break: break-word;
}

/* Inputs — light chrome, monospace numerics, focus ring matches
   the panel accent. */
.xkt-vcp-panel .xkt-vcp-input {
  font: 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #111;
  background: #fff;
  border: 1px solid #d0d4da;
  border-radius: 4px;
  padding: 3px 6px;
  line-height: 1.3;
  outline: none;
  transition: border-color 120ms ease-out, box-shadow 120ms ease-out;
}
.xkt-vcp-panel .xkt-vcp-input:focus {
  border-color: #2d5e8c;
  box-shadow: 0 0 0 2px rgba(45, 94, 140, 0.15);
}
.xkt-vcp-panel .xkt-vcp-input--str  { width: 100%; min-width: 8ch; }
.xkt-vcp-panel .xkt-vcp-input--num  { width: 12ch; font-variant-numeric: tabular-nums; }
.xkt-vcp-panel .xkt-vcp-input--narrow { width: 8ch; padding: 3px 4px; }
.xkt-vcp-panel .xkt-vcp-input--bool {
  appearance: auto;
  width: 14px;
  height: 14px;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  vertical-align: middle;
  cursor: pointer;
}
.xkt-vcp-panel .xkt-vcp-arr { display: inline-flex; gap: 4px; flex-wrap: wrap; align-items: center; }
/* Slider + number-input pair for bounded numeric options. The slider
   takes the remaining width; the number readout stays a fixed
   monospace width so values right-align cleanly. */
.xkt-vcp-panel .xkt-vcp-slider {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 12ch;
}
.xkt-vcp-panel .xkt-vcp-input--slider {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0;
}
.xkt-vcp-panel .xkt-vcp-input--slider-num {
  flex: 0 0 auto;
  width: 8ch;
}
/* Render-mode controls — string labels for the three predefined
 * modes. Checkboxes for the per-effect enabled state list and a
 * native dropdown for the per-View active profile field. */
.xkt-vcp-panel .xkt-vcp-render-modes {
  gap: 10px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.xkt-vcp-panel .xkt-vcp-render-mode {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}
.xkt-vcp-panel .xkt-vcp-render-mode-extras {
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 600;
  color: #9c4666;
  background: #fbeef3;
  border-radius: 3px;
}
.xkt-vcp-panel .xkt-vcp-input--enum {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  padding: 2px 6px;
  min-width: 11ch;
}
.xkt-vcp-panel .xkt-vcp-color { gap: 6px; }
.xkt-vcp-panel .xkt-vcp-input--color {
  appearance: auto;
  width: 22px;
  height: 22px;
  padding: 1px;
  margin: 0;
  border: 1px solid #d0d4da;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  flex-shrink: 0;
}
.xkt-vcp-panel .xkt-vcp-input--color::-webkit-color-swatch-wrapper { padding: 0; }
.xkt-vcp-panel .xkt-vcp-input--color::-webkit-color-swatch { border: none; border-radius: 3px; }
.xkt-vcp-panel .xkt-vcp-input--color::-moz-color-swatch { border: none; border-radius: 3px; }
.xkt-vcp-panel .xkt-vcp-readonly {
  color: #555;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  word-break: break-word;
}
.xkt-vcp-panel .xkt-vcp-readonly--null { color: #aaa; }

/* Footer — status + reset. */
.xkt-vcp-panel .xkt-vcp-footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid #ececec;
  background: #fafafa;
}
.xkt-vcp-panel .xkt-vcp-status {
  flex: 1;
  font-size: 11px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-vcp-panel .xkt-vcp-status.xkt-vcp-status-error { color: #b73d3d; }
.xkt-vcp-panel .xkt-vcp-status.xkt-vcp-status-ok    { color: #2c7e6f; }
.xkt-vcp-panel .xkt-vcp-btn {
  flex-shrink: 0;
  padding: 6px 14px;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
  border-radius: 6px;
  border: 1px solid #d0d0d0;
  background: #fff;
  color: #333;
  cursor: pointer;
}
.xkt-vcp-panel .xkt-vcp-btn:hover { background: #f0f0f0; }
.xkt-vcp-panel .xkt-vcp-btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}
/* Primary footer button (New View) — accent fill in the panel's
 * blue, white text. Sits next to the neutral Refresh button. */
.xkt-vcp-panel .xkt-vcp-btn-primary {
  color: #fff;
  background: #2d5e8c;
  border-color: #1f4669;
}
.xkt-vcp-panel .xkt-vcp-btn-primary:hover {
  background: #1f4669;
  border-color: #1f4669;
}
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

export class ViewerConfigPanel extends FloatingPanelBase {

  /**
   * Per-Viewer instance registry. WeakMap so a Viewer that gets
   * destroyed elsewhere doesn't keep this panel alive for GC.
   */
  private static readonly _instances = new WeakMap<Viewer, ViewerConfigPanel>();

  /**
   * SVG markup for the panel's title-bar glyph (eye-in-circle:
   * a "viewer" eye, matching the camera/IBL theme of Viewer
   * configuration). Strokes use `currentColor`.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<ellipse cx="12" cy="12" rx="9" ry="6" ` +
              `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<circle cx="12" cy="12" r="3.4" ` +
              `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<circle cx="12" cy="12" r="1.4" fill="currentColor"/>` +
    `</svg>`;
  }

  static getFor(viewer: Viewer): ViewerConfigPanel | undefined {
    const inst = ViewerConfigPanel._instances.get(viewer);
    return inst && !inst._destroyed ? inst : undefined;
  }

  static openFor(params: ViewerConfigPanelParams): ViewerConfigPanel {
    let inst = ViewerConfigPanel._instances.get(params.viewer);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new ViewerConfigPanel(params);
    return inst;
  }

  readonly viewer: Viewer;

  /**
   * Optional Studio — when wired, "New View" and the per-View
   * destroy buttons route through it so its per-View bookkeeping
   * (auto-canvas, CameraFlight, controllers) stays in sync.
   */
  readonly studio?: Studio;

  // DOM refs.
  private _titleIdEl!: HTMLElement;
  private _bodyEl!: HTMLElement;
  private _statusEl!: HTMLElement;
  private _newViewBtn!: HTMLButtonElement;
  private _saveBtn!: HTMLButtonElement;
  private _loadBtn!: HTMLButtonElement;
  private _fileInput!: HTMLInputElement;

  /** Subscriptions to `viewer.events.onViewCreated/onViewDestroyed`. */
  private readonly _viewEventUnsubs: Array<() => void> = [];
  private _viewListenersAttached = false;

  /**
   * Live, mutable copy of the Viewer's params. Inputs write
   * through to this object, and {@link _applyToViewer} pushes it
   * back onto the live Viewer. Refreshed from `viewer.toParams()`
   * on every {@link refresh}.
   */
  private _params: ViewerParams = {};

  /**
   * Per-section open/closed memory keyed by a stable section id
   * (e.g. `"view:main"`, `"view:main:effects"`). Survives
   * {@link refresh} so re-rendering doesn't snap every section
   * shut.
   */
  private readonly _openSections = new Map<string, boolean>();

  // Lifecycle state.

  // Drag state.

  constructor(params: ViewerConfigPanelParams) {
    if (!params || !params.viewer) {
      throw new Error("ViewerConfigPanel: viewer is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-vcp-panel",
      classPrefix: "xkt-vcp",
    });
    this.viewer = params.viewer;
    this.studio = params.studio;

    // Replace any prior panel bound to the same Viewer.
    const prior = ViewerConfigPanel._instances.get(params.viewer);
    if (prior && !prior._destroyed) prior.destroy();
    ViewerConfigPanel._instances.set(params.viewer, this);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();
    this._wireDomEvents();
    this.refresh();


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
    this._attachViewListeners();
  }

  hide(): void {
    if (this._destroyed) return;
    super.hide();
    this._detachViewListeners();
  }

  toggle(): void {
    if (this.visible) this.hide(); else this.show();
  }

  destroy(): void {
    if (this._destroyed) return;
    this._detachViewListeners();
    if (ViewerConfigPanel._instances.get(this.viewer) === this) {
      ViewerConfigPanel._instances.delete(this.viewer);
    }
    super.destroy();
  }

  /**
   * Subscribe to {@link Viewer.events} so the panel re-reads
   * `ViewerParams` and rebuilds whenever a View is created or
   * destroyed elsewhere — keeping the per-View sections aligned
   * with the live Viewer.
   */
  private _attachViewListeners(): void {
    if (this._viewListenersAttached || this._destroyed) return;
    this._viewListenersAttached = true;
    const events = this.viewer.events;
    const onChange = () => this.refresh();
    this._viewEventUnsubs.push(events.onViewCreated.subscribe(onChange));
    this._viewEventUnsubs.push(events.onViewDestroyed.subscribe(onChange));
  }

  private _detachViewListeners(): void {
    if (!this._viewListenersAttached) return;
    for (const u of this._viewEventUnsubs) {
      try { u(); } catch { /* ignore */ }
    }
    this._viewEventUnsubs.length = 0;
    this._viewListenersAttached = false;
  }

  /**
   * Pull a fresh `ViewerParams` snapshot from the Viewer and
   * rebuild the body. Per-section open/closed state is preserved
   * across refresh via {@link _openSections}.
   */
  refresh(): void {
    if (this._destroyed) return;
    const r: any = (this.viewer as any).toParams?.();
    if (r && r.ok) {
      this._params = r.value as ViewerParams;
    } else {
      this._params = {};
      const err = r && r.error ? String(r.error) : "Viewer.toParams returned no value";
      this._setStatus(`Failed to read Viewer params: ${err}`, "error");
    }
    this._renderBody();
  }


  // ── Apply / status ────────────────────────────────────────────

  /**
   * Push the live `_params` object back to the Viewer. Used by
   * the Save / Load codepaths when a full snapshot apply is the
   * right thing — interactive edits use the per-field apply
   * pipeline (see {@link _makeTargetApply}) so a single field
   * edit no longer replays the entire ViewerParams (and, in
   * particular, no longer resets the camera).
   */
  private _applyToViewer(): void {
    const r: any = (this.viewer as any).fromParams?.(this._params);
    if (r && r.ok === false) {
      this._setStatus(`Apply failed: ${r.error}`, "error");
    } else {
      this._setStatus("Applied", "ok");
    }
  }

  /**
   * Build a focused apply callback for a live SDK object that
   * carries its own `fromParams` (View, Camera, SAO, Shadows,
   * Material, ViewLayer, …). Each panel-driven edit becomes a
   * single-key patch — `target.fromParams({key: value})` — so
   * the renderer only replays the field that actually changed.
   *
   * Returns a no-op apply (with a single status line) when no
   * suitable target was found, so the panel keeps working in
   * read-only mode rather than throwing.
   */
  private _makeTargetApply(target: any): ApplyFn {
    if (!target || typeof target.fromParams !== "function") {
      return () => {
        this._setStatus("Apply skipped: target has no fromParams", "error");
      };
    }
    return (key, value) => {
      const r: any = target.fromParams({[key]: value});
      if (r && r.ok === false) {
        this._setStatus(`Apply failed: ${r.error}`, "error");
      } else {
        this._setStatus("Applied", "ok");
      }
    };
  }

  /**
   * Build a child apply that nests one level deeper under
   * `parentKey`. Used when the renderer descends into a plain
   * sub-object that doesn't itself expose `fromParams` (e.g. the
   * `effects` container under a View — it has no `fromParams` of
   * its own, but the parent View dispatches per child key).
   */
  private _nestedApply(parentApply: ApplyFn, parentKey: string | number): ApplyFn {
    return (key, value) => parentApply(parentKey, {[key]: value});
  }

  private _setStatus(text: string, kind: "ok" | "error" | "neutral"): void {
    this._statusEl.textContent = text;
    this._statusEl.classList.remove("xkt-vcp-status-ok", "xkt-vcp-status-error");
    if (kind === "ok")    this._statusEl.classList.add("xkt-vcp-status-ok");
    if (kind === "error") this._statusEl.classList.add("xkt-vcp-status-error");
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-vcp-pill", {
      type: "button",
      title: "Reopen the Views panel",
      hidden: true,
      textContent: "Views",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-vcp-panel");

    // Header.
    this._header = el("div", "xkt-vcp-header");
    const title = el("h2", "xkt-vcp-title");
    title.innerHTML =
      `<span class="xkt-vcp-title-icon">${ViewerConfigPanel.iconSvg()}</span>` +
      `<span class="xkt-vcp-title-stack">` +
        `<span class="xkt-vcp-title-text">Views</span>` +
        `<span class="xkt-vcp-subtitle">Manage the Views within the Viewer.</span>` +
      `</span>` +
      `<span class="xkt-vcp-title-id" title="Viewer id"></span>`;
    this._titleIdEl = title.querySelector(".xkt-vcp-title-id") as HTMLElement;

    this._closeBtn = el("button", "xkt-vcp-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;

    this._header.append(title, this._closeBtn);
    this._panel.appendChild(this._header);

    // Actions row — sits between the header and the body, hosts
    // the primary "New View" button alongside Save / Load buttons
    // that round-trip `ViewerParams` as JSON. The panel rebuilds
    // itself from Viewer events so there is no manual Refresh
    // control.
    const actions = el("div", "xkt-vcp-actions");
    this._newViewBtn = el("button", "xkt-vcp-btn xkt-vcp-btn-primary", {
      type: "button",
      textContent: "New View",
      title: "Create a new View, cloning the active View's camera",
    }) as HTMLButtonElement;
    this._saveBtn = el("button", "xkt-vcp-btn", {
      type: "button",
      textContent: "Save",
      title: "Save the current Viewer configuration to a JSON file",
    }) as HTMLButtonElement;
    this._loadBtn = el("button", "xkt-vcp-btn", {
      type: "button",
      textContent: "Load",
      title: "Load a Viewer configuration from a JSON file — replaces all current Views",
    }) as HTMLButtonElement;
    // Hidden file picker reused by every Load click.
    this._fileInput = el("input", "xkt-vcp-file", {
      type: "file",
      accept: "application/json,.json",
    }) as HTMLInputElement;
    this._fileInput.style.display = "none";
    actions.append(this._newViewBtn, this._saveBtn, this._loadBtn, this._fileInput);
    this._panel.appendChild(actions);

    // Body.
    this._bodyEl = el("div", "xkt-vcp-body");
    this._panel.appendChild(this._bodyEl);

    // Footer — status line only (apply errors / acks).
    const footer = el("div", "xkt-vcp-footer");
    this._statusEl = el("div", "xkt-vcp-status", {textContent: ""});
    footer.append(this._statusEl);
    this._panel.appendChild(footer);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }

  private _wireDomEvents(): void {
    this._newViewBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._createView();
    });
    this._saveBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._saveToFile();
    });
    this._loadBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      // Reset value so the same file twice in a row still fires `change`.
      this._fileInput.value = "";
      this._fileInput.click();
    });
    this._fileInput.addEventListener("change", () => {
      const file = this._fileInput.files?.[0];
      if (file) this._loadFromFile(file);
    });
  }

  /**
   * Serialise the live `ViewerParams` to JSON and trigger a browser
   * download. The Refresh-equivalent read is implicit — `toParams`
   * always reads fresh from the live Viewer.
   */
  private _saveToFile(): void {
    if (this._destroyed) return;
    const result: any = (this.viewer as any).toParams?.();
    if (!result || result.ok === false) {
      const err = result && result.error ? String(result.error) : "Viewer.toParams returned no value";
      this._setStatus(`Save failed: ${err}`, "error");
      return;
    }
    const json = JSON.stringify(result.value, null, 2);
    const blob = new Blob([json], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stem = (this._params.id ?? "viewer").replace(/[^A-Za-z0-9._-]+/g, "_");
    a.download = `${stem}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Hand the URL back to the GC after the click has been dispatched.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    this._setStatus(`Saved ${a.download}`, "ok");
  }

  /**
   * Read a JSON `ViewerParams` from `file`, destroy every existing
   * View (clearing their auto-canvases through {@link Studio})
   * and recreate each one from the loaded params. Routing through
   * the Studio is what keeps the canvas DOM in sync — the
   * Viewer itself expects canvases to exist before each View is
   * created, and Studio auto-creates them when no explicit
   * `htmlElement` / `elementId` is supplied (which is always the
   * case after a JSON round-trip).
   */
  private _loadFromFile(file: File): void {
    if (this._destroyed) return;
    file.text().then((text) => {
      if (this._destroyed) return;
      let parsed: ViewerParams;
      try {
        parsed = JSON.parse(text) as ViewerParams;
      } catch (e: any) {
        this._setStatus(`Load failed: ${e?.message ?? String(e)}`, "error");
        return;
      }
      this._applyLoadedParams(parsed);
    }).catch((e) => {
      this._setStatus(`Load failed: ${e?.message ?? String(e)}`, "error");
    });
  }

  /**
   * Tear down every current View and rebuild from `params`. Each
   * destroy goes through the Studio so its per-View canvas /
   * CameraFlight / controller bookkeeping is cleared; each create
   * goes through the Studio too so a fresh auto-canvas is
   * inserted into the DOM before the underlying `Viewer.createView`
   * call runs (the Viewer expects the canvas to exist already).
   *
   * Without a Studio we fall back to `view.destroy()` +
   * `Viewer.fromParams` — the canvas hand-off then becomes the
   * embedder's problem.
   */
  private _applyLoadedParams(params: ViewerParams): void {
    if (this._destroyed) return;
    const helper = this.studio;
    const existing = [...this.viewer.viewList];
    if (helper) {
      for (const view of existing) {
        try { helper.viewManager.destroyView(view); } catch (e) {
          this.studio.reportWarning(`[ViewerConfigPanel] destroyView failed during load:: ${e}`);
        }
      }
    } else {
      for (const view of existing) {
        try { view.destroy(); } catch (e) {
          this.studio.reportWarning(`[ViewerConfigPanel] view.destroy failed during load:: ${e}`);
        }
      }
    }

    const views = Array.isArray(params.views) ? params.views : [];
    let created = 0;
    if (helper) {
      for (const viewParams of views) {
        // Strip any stale DOM references that survived JSON
        // serialisation in name only — studio.viewManager.createView
        // auto-creates a canvas when none is supplied.
        const sanitised = {...viewParams} as ViewParams;
        delete (sanitised as any).htmlElement;
        delete (sanitised as any).elementId;
        try {
          helper.viewManager.createView(sanitised);
          created++;
        } catch (e: any) {
          this.studio.reportWarning(`[ViewerConfigPanel] createView failed during load:: ${e}`);
          this._setStatus(`Load: createView failed: ${e?.message ?? String(e)}`, "error");
        }
      }
    } else {
      const r: any = (this.viewer as any).fromParams?.(params);
      if (r && r.ok === false) {
        this._setStatus(`Load failed: ${r.error}`, "error");
        return;
      }
      created = views.length;
    }

    this.refresh();
    this._setStatus(`Loaded ${created} View${created === 1 ? "" : "s"}`, "ok");
  }

  /**
   * Create a fresh View, cloning the first existing View's camera
   * when one can be serialised. Routes through {@link Studio}
   * when supplied so its per-View bookkeeping stays consistent.
   *
   * The View is opened in a floating {@link ViewPanel} — the "New
   * View" button is meant to feel like the other demo panels
   * (drag-handle header, reopen pill, persistent layout). Pass
   * `floating: false` via the lower-level `helper.createView` if
   * the tiled-in-layout behaviour is what you want.
   */
  private _createView(): void {
    if (this._destroyed) return;
    const active = this.viewer.viewList[0] ?? null;
    let cameraParams: any = undefined;
    if (active) {
      const cameraResult = active.camera.toParams();
      if (cameraResult.ok === false) {
        this.studio.reportWarning(`[ViewerConfigPanel] camera.toParams failed; creating View with default camera:: ${cameraResult.error}`);
      } else {
        cameraParams = cameraResult.value;
      }
    }
    if (this.studio) {
      this.studio.viewManager.createView({
        ...(cameraParams ? {camera: cameraParams} : {}),
        floating: true,
      });
    } else {
      // No Studio: fall back to the raw Viewer.createView, which
      // doesn't know about the floating panel. The caller wires the
      // canvas themselves in that case.
      (this.viewer as any).createView?.(cameraParams ? {camera: cameraParams} : {});
    }
  }

  /**
   * Destroy a View through the Studio when one is wired —
   * keeps its per-View bookkeeping in sync — otherwise call
   * {@link View.destroy} directly.
   */
  private _destroyView(view: View): void {
    if (this.studio) {
      this.studio.viewManager.destroyView(view);
    } else {
      view.destroy();
    }
  }


  // ── Layout persistence ────────────────────────────────────────



  // ── Body rendering ────────────────────────────────────────────

  private _renderBody(): void {
    this._bodyEl.innerHTML = "";

    this._titleIdEl.textContent = this._params.id ?? "—";

    // Top summary — view count only.
    const summary = el("div", "xkt-vcp-summary");
    summary.append(
      el("span", "xkt-vcp-summary-k", {textContent: "Views"}),
      el("span", "xkt-vcp-summary-v", {textContent: String(this._params.views?.length ?? 0)}),
    );
    this._bodyEl.appendChild(summary);

    if (!this._params.views || this._params.views.length === 0) {
      this._bodyEl.appendChild(el("div", "xkt-vcp-empty", {
        textContent: "No views defined.",
      }));
      return;
    }

    for (let i = 0; i < this._params.views.length; i++) {
      const view = this._params.views[i];
      this._bodyEl.appendChild(this._renderViewSection(view, i));
    }
  }

  /**
   * One outer collapsible per `ViewParams`, with nested
   * collapsibles per group (Camera / Effects / Lights / …) inside
   * its body.
   */
  private _renderViewSection(view: ViewParams, viewIndex: number): HTMLElement {
    const viewKey = `view:${view.id ?? viewIndex}`;
    // Resolve the live View instance up-front so the destroy button
    // captures the right reference — match by id first, fall back
    // to positional index (params order mirrors `viewList`).
    const liveView: View | undefined = (view.id != null
      ? this.viewer.viewList.find(v => v.id === view.id)
      : undefined) ?? this.viewer.viewList[viewIndex];
    const section = this._buildSection({
      kind: "view",
      label: "View",
      id: view.id,
      sectionKey: viewKey,
      defaultOpen: true,
      onDestroy: liveView
        ? () => this._destroyView(liveView)
        : undefined,
    });

    // Split view fields into groups. Anything that fits a known
    // category gets its own subsection; everything else lands in
    // the General table.
    const general: Array<[string, any]> = [];
    const groups: Array<{key: string; label: string; obj: any; parent: any; parentKey: string}> = [];
    const layers: ViewLayerParams[] | null = Array.isArray(view.layers) ? view.layers : null;

    for (const k of Object.keys(view).sort()) {
      const v = (view as any)[k];
      if (k === "layers") continue;
      if (KNOWN_GROUPS.has(k) && v != null && typeof v === "object" && !Array.isArray(v)) {
        groups.push({
          key:       k,
          label:     KNOWN_GROUPS_LABELS[k] ?? k,
          obj:       v,
          parent:    view,
          parentKey: k,
        });
      } else {
        general.push([k, v]);
      }
    }

    // Root apply for everything inside this View section — every
    // leaf edit routes through `liveView.fromParams({…})`, which
    // dispatches per-field so only the field that actually changed
    // hits the live View. When no live View is available (e.g.
    // mid-load) the apply silently no-ops with a status line.
    const viewApply: ApplyFn = liveView
      ? this._makeTargetApply(liveView)
      : () => this._setStatus("Apply skipped: no live View for this section", "error");

    if (general.length > 0) {
      const sub = this._buildSection({
        kind: "group",
        label: "General",
        sectionKey: `${viewKey}:general`,
        defaultOpen: true,
      });
      sub.body.appendChild(this._renderKVTable(view, general, viewApply, liveView));
      section.body.appendChild(sub.section);
    }

    for (const g of groups) {
      const sub = this._buildSection({
        kind: "group",
        label: g.label,
        sectionKey: `${viewKey}:${g.key}`,
        defaultOpen: false,
      });
      // Each known group's live counterpart sits at `liveView[g.key]`
      // (camera, effects, lights, selectedMaterial, …). If that
      // object has its own `fromParams` (Camera, Material,
      // ResolutionScale, …), we route edits straight through it; if
      // it doesn't (effects is just a container — its children carry
      // the fromParams), we nest the apply under `g.key` on the View
      // so View.fromParams' dispatch picks the right per-child
      // fromParams.
      const liveGroup = (liveView as any)?.[g.key];
      const groupApply: ApplyFn =
        liveGroup && typeof liveGroup.fromParams === "function"
          ? this._makeTargetApply(liveGroup)
          : this._nestedApply(viewApply, g.key);

      if (g.key === "effects") {
        // Effects is a container of independent renderer-effect
        // components, each with its own `fromParams`. Render each
        // child as its own collapsible sub-section with a
        // properly-cased label, so the section reads as a list of
        // named effects rather than a flat key/value table.
        this._renderEffectsGroup(
          g.obj as Record<string, any>,
          groupApply,
          liveGroup,
          `${viewKey}:${g.key}`,
          sub.body,
        );
      } else {
        sub.body.appendChild(this._renderObjectTable(g.obj, groupApply, liveGroup));
      }
      section.body.appendChild(sub.section);
    }

    if (layers) {
      const sub = this._buildSection({
        kind: "layers",
        label: "Layers",
        countText: `${layers.length} layer${layers.length === 1 ? "" : "s"}`,
        sectionKey: `${viewKey}:layers`,
        defaultOpen: false,
      });
      sub.body.appendChild(this._renderLayersTable(layers, liveView));
      section.body.appendChild(sub.section);
    }

    return section.section;
  }

  /**
   * Build a `<details>` block whose open/closed state is restored
   * from {@link _openSections} and persisted on toggle.
   */
  private _buildSection(opts: {
    kind: "view" | "group" | "layers";
    label: string;
    id?: string;
    countText?: string;
    sectionKey: string;
    defaultOpen?: boolean;
    /**
     * When supplied, the summary row gets a trailing × button that
     * invokes the callback. The button stops propagation so it
     * doesn't also toggle the `<details>` open/closed.
     */
    onDestroy?: () => void;
  }): {section: HTMLDetailsElement; body: HTMLElement} {
    const section = el("details", "xkt-vcp-section") as HTMLDetailsElement;
    section.setAttribute("data-kind", opts.kind);

    const memo = this._openSections.get(opts.sectionKey);
    section.open = memo === undefined ? !!opts.defaultOpen : memo;

    section.addEventListener("toggle", () => {
      this._openSections.set(opts.sectionKey, section.open);
    });

    const summary = el("summary");
    const label = el("span", "xkt-vcp-section-label", {textContent: opts.label});
    summary.append(label);
    if (opts.id) {
      summary.append(el("span", "xkt-vcp-section-id", {
        textContent: opts.id,
        title: "id",
      }));
    }
    if (opts.countText) {
      summary.append(el("span", "xkt-vcp-section-count", {textContent: opts.countText}));
    }
    if (opts.onDestroy) {
      const destroyBtn = el("button", "xkt-vcp-section-destroy", {
        type: "button",
        title: opts.id ? `Destroy ${opts.id}` : "Destroy View",
        "aria-label": opts.id ? `Destroy ${opts.id}` : "Destroy View",
        innerHTML: "×",
      }) as HTMLButtonElement;
      destroyBtn.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      destroyBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        opts.onDestroy!();
      });
      summary.appendChild(destroyBtn);
    }
    section.appendChild(summary);

    const body = el("div", "xkt-vcp-section-body");
    section.appendChild(body);
    return {section, body};
  }

  /**
   * Two-column key/value table for a fixed list of `[key, value]`
   * entries that all live under the same `parent` object. `apply`
   * targets the live SDK counterpart of `parent`; `liveTarget`
   * is that counterpart (when known) so child rows can switch to
   * a more specific apply if their own live counterpart carries
   * its own `fromParams`.
   */
  private _renderKVTable(
    parent: any,
    entries: Array<[string, any]>,
    apply: ApplyFn,
    liveTarget?: any,
  ): HTMLElement {
    const table = el("table", "xkt-vcp-kv");
    applyKeyColumnWidth(table, entries.map(e => e[0]));
    for (const [k, v] of entries) {
      const tr = el("tr");
      tr.appendChild(el("th", undefined, {textContent: k, title: k}));
      const td = el("td");
      td.appendChild(this._renderValue(parent, k, v, apply, liveTarget) as any);
      tr.appendChild(td);
      table.appendChild(tr);
    }
    return table;
  }

  /**
   * Render the Effects group as a list of collapsible sub-sections —
   * one per effect, in {@link EFFECT_ORDER} order, with the
   * properly-cased label from {@link EFFECT_LABELS}.
   *
   * Each sub-section's apply targets the live effect instance
   * (`liveEffects[effectKey]`) so a single field edit hits exactly
   * one `fromParams` call on the right instance — same routing the
   * recursive panel renderer uses internally for any object with a
   * `fromParams`, just bypassed up front because we know the shape.
   */
  private _renderEffectsGroup(
    effects: Record<string, any>,
    groupApply: ApplyFn,
    liveEffects: any,
    parentKey: string,
    body: HTMLElement,
  ): void {
    const childKeys: string[] = [
      ...EFFECT_ORDER.filter(k => k in effects),
      ...Object.keys(effects).filter(k => !EFFECT_LABELS.has(k)).sort(),
    ];
    for (const key of childKeys) {
      const val = effects[key];
      if (val == null || typeof val !== "object") continue;
      const sub = this._buildSection({
        kind: "group",
        label: EFFECT_LABELS.get(key) ?? key,
        sectionKey: `${parentKey}:${key}`,
        defaultOpen: false,
      });
      const liveChild = liveEffects ? liveEffects[key] : undefined;
      const childApply: ApplyFn =
        liveChild && typeof liveChild.fromParams === "function"
          ? this._makeTargetApply(liveChild)
          : this._nestedApply(groupApply, key);
      sub.body.appendChild(this._renderObjectTable(val, childApply, liveChild));
      body.appendChild(sub.section);
    }
  }

  /**
   * Recursive object renderer — used for nested groups (Camera,
   * Effects, Lights, …). Sorts entries alphabetically. `apply`
   * and `liveTarget` carry the same meaning as in
   * {@link _renderKVTable}.
   */
  private _renderObjectTable(obj: any, apply: ApplyFn, liveTarget?: any): HTMLElement {
    const entries = Object.entries(obj || {}).sort((a, b) => a[0].localeCompare(b[0]));
    return this._renderKVTable(obj, entries, apply, liveTarget);
  }

  /**
   * Choose the right input control for a value's type. Mutations
   * write through `parent[key] = newValue` (or, for arrays, into
   * the array slot in place) and call `_applyToViewer()` to push
   * the change to the live Viewer.
   */
  private _renderValue(
    parent: any,
    key: string | number,
    val: any,
    apply: ApplyFn,
    liveTarget?: any,
  ): Node {
    if (typeof val === "boolean") return this._mkBoolInput(parent, key, val, apply);
    if (typeof val === "number")  return this._mkNumberInput(parent, key, val, apply, liveTarget);
    if (typeof val === "string" && key === "mode" && looksLikeAntiAliasingParams(parent)) {
      return this._mkStringEnumSelect(parent, key, val, apply, [
        ["none", "None"],
        ["fxaa", "FXAA"],
        ["smaa", "SMAA"],
      ]);
    }
    if (typeof val === "string")  return this._mkTextInput(parent, key, val, apply);
    if (isNumberArray(val)) {
      if (looksLikeColor(key, val)) return this._mkColorArrayInput(parent, key, val, apply);
      return this._mkNumberArrayInput(parent, key, val, apply);
    }
    if (val == null)              return el("span", "xkt-vcp-readonly xkt-vcp-readonly--null", {textContent: "—"});
    if (Array.isArray(val))       return el("span", "xkt-vcp-readonly", {textContent: formatValueInline(val)});
    if (isPlainObject(val)) {
      // Descend. If the nested live counterpart has its own
      // `fromParams`, switch the apply to call it directly so
      // children patch the most specific subtree. Otherwise nest
      // the current apply one level deeper under `key`.
      const liveChild = liveTarget ? (liveTarget as any)[key] : undefined;
      const childApply: ApplyFn = (liveChild && typeof liveChild.fromParams === "function")
        ? this._makeTargetApply(liveChild)
        : this._nestedApply(apply, key);
      return this._renderObjectTable(val, childApply, liveChild);
    }
    return el("span", "xkt-vcp-readonly", {textContent: String(val)});
  }

      private _mkBoolInput(parent: any, key: string | number, val: boolean, apply: ApplyFn): HTMLInputElement {
    const inp = el("input", "xkt-vcp-input xkt-vcp-input--bool", {type: "checkbox"}) as HTMLInputElement;
    inp.checked = val;
    inp.addEventListener("change", () => {
      parent[key] = inp.checked;
      apply(key, inp.checked);
    });
    return inp;
  }

  private _mkNumberInput(parent: any, key: string | number, val: number, apply: ApplyFn, liveTarget?: any): HTMLElement {
    // Known-range option → slider + number-input pair, two-way bound.
    // Drag the slider for quick eyeballing, type in the number for
    // precision. Falls through to a plain number input for anything
    // that has no defined range (camera positions, timestamps, etc).
    const range = this._getSliderRange(parent, key, liveTarget);
    if (range) {
      return this._mkSliderInput(parent, key, val, apply, range);
    }
    const inp = el("input", "xkt-vcp-input xkt-vcp-input--num", {type: "number", step: "any"}) as HTMLInputElement;
    inp.value = String(val);
    inp.addEventListener("change", () => {
      const n = parseFloat(inp.value);
      const next = Number.isFinite(n) ? n : 0;
      parent[key] = next;
      apply(key, next);
    });
    return inp;
  }

  private _getSliderRange(parent: any, key: string | number, liveTarget?: any): [number, number, number] | undefined {
    if (typeof key !== "string") {
      return undefined;
    }
    if (key === "intensity" && looksLikeIBL(parent, liveTarget)) {
      return [0, 2, 0.01];
    }
    return SLIDER_RANGES.get(key);
  }

  /**
   * Slider + number-input pair, sharing a single backing value. The
   * range slider provides quick drag-to-eyeball; the number input is
   * the precise / out-of-range fallback. Both write through the
   * same `apply` call so the live target only sees one update per
   * change. Used when a key appears in {@link SLIDER_RANGES}.
   */
  private _mkSliderInput(
    parent: any,
    key: string | number,
    val: number,
    apply: ApplyFn,
    range: [min: number, max: number, step: number],
  ): HTMLElement {
    const [min, max, step] = range;
    const wrap = el("span", "xkt-vcp-slider");
    const slider = el("input", "xkt-vcp-input xkt-vcp-input--slider", {
      type: "range",
      min:  String(min),
      max:  String(max),
      step: String(step),
    }) as HTMLInputElement;
    const num = el("input", "xkt-vcp-input xkt-vcp-input--num xkt-vcp-input--slider-num", {
      type: "number",
      step: String(step),
    }) as HTMLInputElement;

    const decimals = step < 1 ? Math.max(0, -Math.floor(Math.log10(step))) : 0;
    const fmt = (n: number): string =>
      decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));

    slider.value = String(Math.min(max, Math.max(min, val)));
    num.value = fmt(val);

    const commit = (n: number): void => {
      const next = Number.isFinite(n) ? n : 0;
      parent[key] = next;
      apply(key, next);
    };

    // Slider drags fire `input` continuously — apply live so the user
    // sees the effect tune in real time.
    slider.addEventListener("input", () => {
      const n = parseFloat(slider.value);
      num.value = fmt(n);
      commit(n);
    });

    // Number input commits on change (Enter / blur). Push the value
    // back to the slider, clamped to the slider's range so we never
    // visually de-sync — the underlying state keeps the out-of-range
    // value the user typed.
    num.addEventListener("change", () => {
      const n = parseFloat(num.value);
      if (!Number.isFinite(n)) {
        num.value = fmt(slider.valueAsNumber);
        return;
      }
      slider.value = String(Math.min(max, Math.max(min, n)));
      commit(n);
    });

    wrap.append(slider, num);
    return wrap;
  }

  private _mkTextInput(parent: any, key: string | number, val: string, apply: ApplyFn): HTMLInputElement {
    const inp = el("input", "xkt-vcp-input xkt-vcp-input--str", {type: "text"}) as HTMLInputElement;
    inp.value = val;
    inp.addEventListener("change", () => {
      parent[key] = inp.value;
      apply(key, inp.value);
    });
    return inp;
  }

  private _mkStringEnumSelect(
    parent: any,
    key: string | number,
    val: string,
    apply: ApplyFn,
    options: Array<[value: string, label: string]>,
  ): HTMLSelectElement {
    const sel = el("select", "xkt-vcp-input xkt-vcp-input--enum") as HTMLSelectElement;
    let known = false;
    for (const [value, label] of options) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      if (value === val) known = true;
      sel.appendChild(opt);
    }
    if (!known) {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = val;
      opt.disabled = true;
      sel.appendChild(opt);
    }
    sel.value = val;
    sel.addEventListener("change", () => {
      parent[key] = sel.value;
      apply(key, sel.value);
    });
    return sel;
  }

  private _mkNumberArrayInput(parent: any, key: string | number, arr: number[], apply: ApplyFn): HTMLElement {
    const wrap = el("span", "xkt-vcp-arr");
    for (let i = 0; i < arr.length; i++) {
      const inp = el("input", "xkt-vcp-input xkt-vcp-input--num xkt-vcp-input--narrow", {
        type:  "number",
        step:  "any",
      }) as HTMLInputElement;
      inp.value = String(arr[i]);
      const idx = i;
      inp.addEventListener("change", () => {
        const n = parseFloat(inp.value);
        arr[idx] = Number.isFinite(n) ? n : 0;
        parent[key] = arr;
        apply(key, arr);
      });
      wrap.appendChild(inp);
    }
    return wrap;
  }

  /**
   * Color-array input — same per-channel number inputs as
   * {@link _mkNumberArrayInput}, with a leading native
   * `<input type="color">` swatch two-way-bound to the first
   * three channels (R/G/B).
   *
   * Alpha (channel 4 in RGBA arrays) stays editable through its
   * own number input — `<input type="color">` doesn't support
   * alpha. The swatch is the eyedropper / palette chip; the
   * channel boxes stay for fine-grained float editing.
   */
  private _mkColorArrayInput(parent: any, key: string | number, arr: number[], apply: ApplyFn): HTMLElement {
    const wrap = el("span", "xkt-vcp-arr xkt-vcp-color");

    const swatch = el("input", "xkt-vcp-input xkt-vcp-input--color", {type: "color"}) as HTMLInputElement;
    swatch.value = floatsToHex(arr[0], arr[1], arr[2]);

    const channelInputs: HTMLInputElement[] = [];

    swatch.addEventListener("input", () => {
      const [r, g, b] = hexToFloats(swatch.value);
      arr[0] = r; arr[1] = g; arr[2] = b;
      // Sync the visible channel boxes back from the swatch so
      // the user sees consistent numbers immediately.
      for (let i = 0; i < 3 && i < channelInputs.length; i++) {
        channelInputs[i].value = String(arr[i]);
      }
      parent[key] = arr;
      apply(key, arr);
    });

    wrap.appendChild(swatch);

    for (let i = 0; i < arr.length; i++) {
      const inp = el("input", "xkt-vcp-input xkt-vcp-input--num xkt-vcp-input--narrow", {
        type: "number",
        step: "any",
      }) as HTMLInputElement;
      inp.value = String(arr[i]);
      const idx = i;
      inp.addEventListener("change", () => {
        const n = parseFloat(inp.value);
        arr[idx] = Number.isFinite(n) ? n : 0;
        // Keep the swatch in sync when an RGB channel changes;
        // alpha edits leave it alone.
        if (idx < 3) {
          swatch.value = floatsToHex(arr[0], arr[1], arr[2]);
        }
        parent[key] = arr;
        apply(key, arr);
      });
      channelInputs.push(inp);
      wrap.appendChild(inp);
    }
    return wrap;
  }

  private _renderLayersTable(layers: ViewLayerParams[], liveView?: View): HTMLElement {
    if (!layers.length) {
      return el("div", "xkt-vcp-empty", {textContent: "No layers"});
    }
    const table = el("table", "xkt-vcp-kv");
    applyKeyColumnWidth(table, ["id", "visible", "autoDestroy"]);
    const head = el("tr");
    head.append(
      el("th", undefined, {textContent: "id"}),
      el("th", undefined, {textContent: "visible"}),
      el("th", undefined, {textContent: "autoDestroy"}),
    );
    table.appendChild(head);

    for (const layer of layers) {
      // Per-layer apply: route through the matching live
      // {@link ViewLayer.fromParams}. Falls back to a no-op when
      // the live layer isn't around so the panel keeps rendering.
      const liveLayer = liveView && layer.id != null
        ? (liveView.layers as any)?.[String(layer.id)]
        : undefined;
      const layerApply: ApplyFn = liveLayer
        ? this._makeTargetApply(liveLayer)
        : () => this._setStatus("Apply skipped: no live layer", "error");

      const tr = el("tr");
      const idTd = el("td");
      idTd.appendChild(this._mkTextInput(layer, "id", String(layer.id ?? ""), layerApply));
      tr.appendChild(idTd);

      tr.appendChild(this._renderLayerFlagCell(layer, "visible", layerApply));
      tr.appendChild(this._renderLayerFlagCell(layer, "autoDestroy", layerApply));
      table.appendChild(tr);
    }
    return table;
  }

  private _renderLayerFlagCell(layer: ViewLayerParams, key: "visible" | "autoDestroy", apply: ApplyFn): HTMLElement {
    const td = el("td");
    // undefined materialises to true so the checkbox represents
    // the live state the View ends up with.
    const current = (layer as any)[key] === undefined ? true : !!(layer as any)[key];
    td.appendChild(this._mkBoolInput(layer, key, current, apply));
    return td;
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────

/** ViewParams keys whose value is a sub-object worth its own
 * collapsible subsection. Anything not listed lands in the
 * General table. */
const KNOWN_GROUPS = new Set<string>([
  "camera",
  "effects",
  "lights",
  "selectedMaterial",
  "highlightMaterial",
  "xrayMaterial",
  "pointsMaterial",
  "resolutionScale",
  "sectionPlanes",
]);

const KNOWN_GROUPS_LABELS: Record<string, string> = {
  camera:            "Camera",
  effects:           "Effects",
  lights:            "Lights",
  selectedMaterial:  "Selected Material",
  highlightMaterial: "Highlight Material",
  xrayMaterial:      "X-Ray Material",
  pointsMaterial:    "Points Material",
  resolutionScale:   "Resolution Scale",
  sectionPlanes:     "Section Planes",
};

/**
 * Effect keys in the order they're shown inside the Effects section.
 * Roughly grouped: scene shading → post-processing → environment →
 * mode-specific shading variants. Unknown effect keys (effects we
 * haven't named here) trail in alphabetical order.
 */
const EFFECT_ORDER: string[] = [
  "ibl",
  "shadows",
  "sao",
  "bloom",
  "atmosphere",
  "depthOfField",
  "tonemap",
  "antiAliasing",
  "edges",
  "sky",
  "sectionPlaneCaps",
  "bodyHatch",
];

/**
 * Numeric options whose range is well-bounded enough that a slider
 * makes sense alongside the number input. Keyed by leaf property
 * name (the same camelCase key the params object carries), so the
 * range applies wherever the option appears. Target-specific controls
 * such as IBL can override this generic range in `_getSliderRange`.
 *
 * Tuple shape: `[min, max, step]`. The slider clamps to this range
 * visually; the number input is the precise / out-of-range escape
 * hatch and the panel never overwrites a value the user typed.
 *
 * Keys not in this table render as a plain number input, same as
 * before — so anything we don't have a confident range for stays
 * unbounded.
 */
const SLIDER_RANGES = new Map<string, [number, number, number]>([
  // Effect intensities / mix coefficients — universal 0–1.
  ["intensity",          [0, 1,   0.01]],
  ["knee",               [0, 1,   0.01]],
  ["edgeAlpha",          [0, 1,   0.01]],
  ["edgeDarken",         [0, 1,   0.01]],
  ["horizonBlend",       [0, 1,   0.01]],
  ["sunGlowIntensity",   [0, 1,   0.01]],
  ["cascadeSplitLambda", [0, 1,   0.01]],
  // Effect thresholds / exposure-like — small handful with HDR headroom.
  ["threshold",          [0,  10, 0.05]],
  ["exposure",           [0,  3,  0.01]],
  ["focusDistance",      [0, 500, 1]],
  ["focalRange",         [0.1, 250, 0.5]],
  ["radius",             [0, 12, 0.25]],
  ["startDistance",      [0, 1000, 1]],
  ["endDistance",        [1, 5000, 1]],
  ["maxOpacity",         [0, 1, 0.01]],
  // Edge / sun sizes — small integer-ish dials.
  ["edgeWidth",          [1, 5,    1]],
  ["sunAngularSize",     [0, 30,   0.1]],
  ["sunGlowSize",        [0, 64,   1]],
  // Resolution scales — 5–200 %.
  ["renderScale",        [0.5, 2,  0.05]],
  ["resolutionScale",    [0.05, 2, 0.05]],
  // Shadow tuning — bias and cascade tuning sit in narrow ranges.
  ["bias",               [0, 0.01,   0.0001]],
  ["normalOffsetBias",   [0, 0.5,    0.001]],
  ["slopeBias",          [0, 0.05,   0.0001]],
  ["padding",            [1, 2,      0.01]],
  ["maxDistance",        [0, 500,    1]],
  ["projectionSize",     [1, 200,    0.5]],
  ["lightDistance",      [1, 500,    1]],
  ["cascadeCount",       [1, 6,      1]],
  ["pcfKernelSize",      [1, 7,      2]],
  ["resolution",         [256, 4096, 256]],
]);

/**
 * Display labels for known effect keys. Keys not in this map fall
 * through to the camelCase key as-is.
 */
const EFFECT_LABELS = new Map<string, string>([
  ["ibl",              "IBL"],
  ["sao",              "SAO"],
  ["shadows",          "Shadows"],
  ["bloom",            "Bloom"],
  ["atmosphere",       "Atmosphere"],
  ["depthOfField",     "Depth of Field"],
  ["tonemap",          "Tonemap"],
  ["antiAliasing",     "Anti-Aliasing"],
  ["edges",            "Edges"],
  ["sky",              "Sky"],
  ["sectionPlaneCaps", "Section Plane Caps"],
  ["bodyHatch",        "Body Hatch"],
]);


function isPlainObject(v: any): boolean {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isNumberArray(v: any): v is number[] {
  return Array.isArray(v) && v.length > 0 && v.every(x => typeof x === "number" && Number.isFinite(x));
}

function looksLikeAntiAliasingParams(v: any): boolean {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  return keys.length > 0 && keys.every((key) => key === "mode" || key === "enabled");
}

function looksLikeIBL(params: any, liveTarget?: any): boolean {
  if (liveTarget && typeof liveTarget.setEnvironmentHDRBuffer === "function") {
    return true;
  }
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return false;
  }
  const keys = Object.keys(params);
  return keys.includes("intensity") &&
    keys.includes("enabled") &&
    !keys.some((key) => key !== "intensity" && key !== "enabled");
}

/**
 * Heuristic: does this `(key, value)` pair look like an RGB or
 * RGBA color in 0..1 float space?
 *
 * Three guard conditions:
 *
 *   1. Length 3 (RGB) or 4 (RGBA) — anything else can't be a
 *      colour, regardless of the name.
 *   2. Every channel is in `[0, 1]` — protects against tints
 *      like `[1.6, 1.6, 1.6]` (used by `applyIFCMaterials` to
 *      compensate for the diffuse `albedo / π` term) and against
 *      world-space vectors that happen to be normalised.
 *   3. The key name contains "color" (case-insensitive). Catches
 *      `color`, `backgroundColor`, `fillColor`, `edgeColor`,
 *      `selectedMaterial.fillColor`, etc., without false-firing
 *      on `up`, `eye`, `look`, `worldUp`, etc.
 */
function looksLikeColor(key: string | number, arr: number[]): boolean {
  if (arr.length !== 3 && arr.length !== 4) return false;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < 0 || arr[i] > 1) return false;
  }
  return String(key).toLowerCase().includes("color");
}

/**
 * Three floats in `[0, 1]` → `#rrggbb` lowercase. Clamps out-of
 * range values rather than rejecting them so transient
 * re-renders mid-edit don't crash the swatch.
 */
function floatsToHex(r: number, g: number, b: number): string {
  const toHex = (v: number): string => {
    const c = Math.max(0, Math.min(1, v));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** `#rrggbb` (or `#rgb`) → three floats in `[0, 1]`. */
function hexToFloats(hex: string): [number, number, number] {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) {
    // CSS-style shorthand `#rgb` → `#rrggbb`.
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return [r, g, b];
}

function formatValueInline(val: any): string {
  if (val == null) return "—";
  if (typeof val === "number") return formatNumber(val);
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return `[${val.map(x => formatValueInline(x)).join(", ")}]`;
  if (isPlainObject(val)) {
    try { return JSON.stringify(val); } catch { return String(val); }
  }
  return String(val);
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const t = Math.trunc(n * 100) / 100;
  if (Math.abs(t - Math.trunc(t)) < 1e-12) return String(Math.trunc(t));
  return t.toFixed(2);
}

/**
 * Set the `--xkt-vcp-keyw` CSS var on a KV table so its key
 * column is "as wide as the longest label, clamped". Keeps every
 * row's value column aligned.
 */
function applyKeyColumnWidth(table: HTMLElement, keys: string[]): void {
  const maxLen = keys.reduce((m, k) => Math.max(m, (k ?? "").length), 0);
  const minCh = 10;
  const maxCh = 26;
  const keyCh = Math.max(minCh, Math.min(maxCh, maxLen + 2));
  table.style.setProperty("--xkt-vcp-keyw", `${keyCh}ch`);
}
