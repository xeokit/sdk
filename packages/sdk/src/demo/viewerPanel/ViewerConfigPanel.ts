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
 * @module demo/viewerPanel
 */
import type {Viewer} from "../../viewer";
import type {ViewerParams} from "../../viewer/ViewerParams";
import type {ViewParams} from "../../viewer/ViewParams";
import type {ViewLayerParams} from "../../viewer/ViewLayerParams";


import {el} from "../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";
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
  width: 480px;
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
  width: 22px;
  height: 22px;
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

  // DOM refs.
  private _titleIdEl!: HTMLElement;
  private _bodyEl!: HTMLElement;
  private _statusEl!: HTMLElement;
  private _resetBtn!: HTMLButtonElement;

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
  }

  hide(): void {
    if (this._destroyed) return;
    super.hide();
  }

  toggle(): void {
    if (this.visible) this.hide(); else this.show();
  }

  destroy(): void {
    if (this._destroyed) return;
    if (ViewerConfigPanel._instances.get(this.viewer) === this) {
      ViewerConfigPanel._instances.delete(this.viewer);
    }
    super.destroy();
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
   * Push the live `_params` object back to the Viewer. Called
   * after every input change. Failures land in the footer status
   * line (red); successes clear the line.
   */
  private _applyToViewer(): void {
    const r: any = (this.viewer as any).fromParams?.(this._params);
    if (r && r.ok === false) {
      this._setStatus(`Apply failed: ${r.error}`, "error");
    } else {
      this._setStatus("Applied", "ok");
    }
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
      title: "Reopen the Viewer Configuration panel",
      hidden: true,
      textContent: "Viewer",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-vcp-panel");

    // Header.
    this._header = el("div", "xkt-vcp-header");
    const title = el("h2", "xkt-vcp-title");
    title.innerHTML =
      `<span class="xkt-vcp-title-icon">${ViewerConfigPanel.iconSvg()}</span>` +
      `<span class="xkt-vcp-title-text">Viewer</span>` +
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

    // Body.
    this._bodyEl = el("div", "xkt-vcp-body");
    this._panel.appendChild(this._bodyEl);

    // Footer.
    const footer = el("div", "xkt-vcp-footer");
    this._statusEl = el("div", "xkt-vcp-status", {textContent: ""});
    this._resetBtn = el("button", "xkt-vcp-btn", {
      type: "button",
      textContent: "Refresh",
      title: "Re-read params from the Viewer (discards in-flight edits)",
    }) as HTMLButtonElement;
    footer.append(this._statusEl, this._resetBtn);
    this._panel.appendChild(footer);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }

  private _wireDomEvents(): void {
    this._resetBtn.addEventListener("click", () => this.refresh());
  }


  // ── Layout persistence ────────────────────────────────────────



  // ── Body rendering ────────────────────────────────────────────

  private _renderBody(): void {
    this._bodyEl.innerHTML = "";

    this._titleIdEl.textContent = this._params.id ?? "—";

    // Top summary — Viewer ID (editable) + view count.
    const summary = el("div", "xkt-vcp-summary");
    summary.append(
      el("span", "xkt-vcp-summary-k", {textContent: "Viewer ID"}),
      this._renderValue(this._params, "id", this._params.id ?? ""),
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
    const section = this._buildSection({
      kind: "view",
      label: "View",
      id: view.id,
      sectionKey: viewKey,
      defaultOpen: true,
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

    if (general.length > 0) {
      const sub = this._buildSection({
        kind: "group",
        label: "General",
        sectionKey: `${viewKey}:general`,
        defaultOpen: true,
      });
      sub.body.appendChild(this._renderKVTable(view, general));
      section.body.appendChild(sub.section);
    }

    for (const g of groups) {
      const sub = this._buildSection({
        kind: "group",
        label: g.label,
        sectionKey: `${viewKey}:${g.key}`,
        defaultOpen: false,
      });
      sub.body.appendChild(this._renderObjectTable(g.obj));
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
      sub.body.appendChild(this._renderLayersTable(layers));
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
    section.appendChild(summary);

    const body = el("div", "xkt-vcp-section-body");
    section.appendChild(body);
    return {section, body};
  }

  /**
   * Two-column key/value table for a fixed list of `[key, value]`
   * entries that all live under the same `parent` object.
   */
  private _renderKVTable(parent: any, entries: Array<[string, any]>): HTMLElement {
    const table = el("table", "xkt-vcp-kv");
    applyKeyColumnWidth(table, entries.map(e => e[0]));
    for (const [k, v] of entries) {
      const tr = el("tr");
      tr.appendChild(el("th", undefined, {textContent: k, title: k}));
      const td = el("td");
      td.appendChild(this._renderValue(parent, k, v) as any);
      tr.appendChild(td);
      table.appendChild(tr);
    }
    return table;
  }

  /**
   * Recursive object renderer — used for nested groups (Camera,
   * Effects, Lights, …). Sorts entries alphabetically.
   */
  private _renderObjectTable(obj: any): HTMLElement {
    const entries = Object.entries(obj || {}).sort((a, b) => a[0].localeCompare(b[0]));
    return this._renderKVTable(obj, entries);
  }

  /**
   * Choose the right input control for a value's type. Mutations
   * write through `parent[key] = newValue` (or, for arrays, into
   * the array slot in place) and call `_applyToViewer()` to push
   * the change to the live Viewer.
   */
  private _renderValue(parent: any, key: string | number, val: any): Node {
    if (typeof val === "boolean") return this._mkBoolInput(parent, key, val);
    if (typeof val === "number")  return this._mkNumberInput(parent, key, val);
    if (typeof val === "string")  return this._mkTextInput(parent, key, val);
    if (isNumberArray(val)) {
      if (looksLikeColor(key, val)) return this._mkColorArrayInput(val);
      return this._mkNumberArrayInput(val);
    }
    if (val == null)              return el("span", "xkt-vcp-readonly xkt-vcp-readonly--null", {textContent: "—"});
    if (Array.isArray(val))       return el("span", "xkt-vcp-readonly", {textContent: formatValueInline(val)});
    if (isPlainObject(val))       return this._renderObjectTable(val);
    return el("span", "xkt-vcp-readonly", {textContent: String(val)});
  }

  private _mkBoolInput(parent: any, key: string | number, val: boolean): HTMLInputElement {
    const inp = el("input", "xkt-vcp-input xkt-vcp-input--bool", {type: "checkbox"}) as HTMLInputElement;
    inp.checked = val;
    inp.addEventListener("change", () => {
      parent[key] = inp.checked;
      this._applyToViewer();
    });
    return inp;
  }

  private _mkNumberInput(parent: any, key: string | number, val: number): HTMLInputElement {
    const inp = el("input", "xkt-vcp-input xkt-vcp-input--num", {type: "number", step: "any"}) as HTMLInputElement;
    inp.value = String(val);
    inp.addEventListener("change", () => {
      const n = parseFloat(inp.value);
      parent[key] = Number.isFinite(n) ? n : 0;
      this._applyToViewer();
    });
    return inp;
  }

  private _mkTextInput(parent: any, key: string | number, val: string): HTMLInputElement {
    const inp = el("input", "xkt-vcp-input xkt-vcp-input--str", {type: "text"}) as HTMLInputElement;
    inp.value = val;
    inp.addEventListener("change", () => {
      parent[key] = inp.value;
      this._applyToViewer();
    });
    return inp;
  }

  private _mkNumberArrayInput(arr: number[]): HTMLElement {
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
        this._applyToViewer();
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
  private _mkColorArrayInput(arr: number[]): HTMLElement {
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
      this._applyToViewer();
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
        this._applyToViewer();
      });
      channelInputs.push(inp);
      wrap.appendChild(inp);
    }
    return wrap;
  }

  private _renderLayersTable(layers: ViewLayerParams[]): HTMLElement {
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
      const tr = el("tr");
      const idTd = el("td");
      idTd.appendChild(this._mkTextInput(layer, "id", String(layer.id ?? "")));
      tr.appendChild(idTd);

      tr.appendChild(this._renderLayerFlagCell(layer, "visible"));
      tr.appendChild(this._renderLayerFlagCell(layer, "autoDestroy"));
      table.appendChild(tr);
    }
    return table;
  }

  private _renderLayerFlagCell(layer: ViewLayerParams, key: "visible" | "autoDestroy"): HTMLElement {
    const td = el("td");
    // undefined materialises to true so the checkbox represents
    // the live state the View ends up with.
    const current = (layer as any)[key] === undefined ? true : !!(layer as any)[key];
    td.appendChild(this._mkBoolInput(layer, key, current));
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


function isPlainObject(v: any): boolean {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isNumberArray(v: any): v is number[] {
  return Array.isArray(v) && v.length > 0 && v.every(x => typeof x === "number" && Number.isFinite(x));
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
