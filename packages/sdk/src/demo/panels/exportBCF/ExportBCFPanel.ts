/**
 * Floating, draggable BCF Viewpoint export panel.
 *
 * Lists the active {@link View}'s {@link ViewLayer}s as
 * checkboxes (with a per-layer object count) so the user can
 * choose which layers' component states the BCF viewpoint
 * captures, exposes the most-used `saveBCFViewpoint` options
 * (snapshot / defaultInvisible / originatingSystem), and ships
 * the result as a JSON download on **Export**.
 *
 * Same chrome and lifecycle as the rest of the panel set
 * (`SceneHealthPanel`, `SchemaMaterialsPanel`,
 * `ViewerConfigPanel`, `GPUMemoryPanel`, …): per-View WeakMap
 * registry, idempotent `getFor` / `openFor`, drag header,
 * close + pill, layout persistence, bring-to-front on
 * pointer-down, scoped `xkt-bcf-` CSS prefix.
 *
 * @module demo/exportBCF
 */
import type {View, ViewLayer} from "../../../viewer";
import type {WebGLRenderer} from "../../../webGLRenderer";
import {saveBCFViewpoint} from "../../../bcf";
import {FloatingPanelBase} from "../floatingPanelBase";
import {el} from "../../utils/el";


// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface ExportBCFPanelParams {

  /**
   * View whose state gets captured into the BCF viewpoint.
   * Doubles as the WeakMap key for {@link ExportBCFPanel.openFor}
   * idempotence — one panel per View.
   */
  view: View;

  /**
   * Renderer used to capture the snapshot image. When omitted,
   * the **Snapshot** option is disabled — `saveBCFViewpoint`
   * itself never reads the canvas, so the snapshot field has to
   * be filled in by the panel from `renderer.getSnapshot(view)`.
   */
  renderer?: WebGLRenderer;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed
   * state. Defaults to `"xkt-bcf-panel"`.
   */
  storageKey?: string;

  /** Show on construction (default `true`). */
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-bcf-styles";
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
// CSS — same chrome vocabulary as the panel set, with the
// teal accent borrowed from DataHealthPanel so the BCF dialog
// reads as part of the same family.
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-bcf-panel {
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
.xkt-bcf-panel *, .xkt-bcf-panel *::before, .xkt-bcf-panel *::after {
  box-sizing: border-box;
}
.xkt-bcf-panel[hidden] { display: none; }

.xkt-bcf-panel .xkt-bcf-header {
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
.xkt-bcf-panel .xkt-bcf-header.xkt-bcf-dragging { cursor: grabbing; }
.xkt-bcf-panel .xkt-bcf-title {
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
.xkt-bcf-panel .xkt-bcf-title-icon {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
  width: 24px;
  height: 24px;
  color: #2c7e6f;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.xkt-bcf-panel .xkt-bcf-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-bcf-panel .xkt-bcf-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-bcf-panel .xkt-bcf-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-bcf-panel .xkt-bcf-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
.xkt-bcf-panel .xkt-bcf-close {
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
.xkt-bcf-panel .xkt-bcf-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-bcf-pill {
  position: fixed;
  bottom: 17px;
  right: 661px;
  z-index: 200000000;
  padding: 9px 16px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #fff;
  background: #2c7e6f;
  border: 1px solid #1d5e52;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.xkt-bcf-pill:hover { background: #1d5e52; }
.xkt-bcf-pill[hidden] { display: none; }

.xkt-bcf-panel .xkt-bcf-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px 12px 4px;
}

/* Section blocks — shared shape with the rest of the panel set. */
.xkt-bcf-panel .xkt-bcf-section {
  margin: 6px 0;
  background: #fff;
  border: 1px solid #ececec;
  border-left: 3px solid #2c7e6f;
  border-radius: 6px;
  overflow: hidden;
}
.xkt-bcf-panel .xkt-bcf-section[data-kind="options"] { border-left-color: #2d5e8c; }
.xkt-bcf-panel .xkt-bcf-section > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  user-select: none;
}
.xkt-bcf-panel .xkt-bcf-section > summary::-webkit-details-marker { display: none; }
.xkt-bcf-panel .xkt-bcf-section > summary::marker                  { display: none; }
.xkt-bcf-panel .xkt-bcf-section > summary::before {
  content: "›";
  display: inline-block;
  transform: rotate(0deg);
  transition: transform 120ms ease-out;
  color: #888;
  font-size: 12px;
}
.xkt-bcf-panel .xkt-bcf-section[open] > summary::before { transform: rotate(90deg); }
.xkt-bcf-panel .xkt-bcf-section > summary:hover { background: #fafafa; }
.xkt-bcf-panel .xkt-bcf-section-label {
  flex: 1;
  font-size: 12px;
  font-weight: 650;
  color: #2c7e6f;
  letter-spacing: -0.1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-bcf-panel .xkt-bcf-section[data-kind="options"] .xkt-bcf-section-label { color: #2d5e8c; }
.xkt-bcf-panel .xkt-bcf-section-count {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  font-variant-numeric: tabular-nums;
}
.xkt-bcf-panel .xkt-bcf-section > .xkt-bcf-section-body {
  padding: 6px 8px 8px;
  border-top: 1px solid #f4f4f4;
  background: #fcfcfc;
}

/* Bulk-toggle pills inside the layers <summary>. Click events
   stopPropagation so they don't toggle the surrounding details. */
.xkt-bcf-panel .xkt-bcf-toggle-all {
  flex-shrink: 0;
  padding: 2px 8px;
  font: inherit;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: #2c7e6f;
  background: transparent;
  border: 1px solid #b8d6cf;
  border-radius: 999px;
  cursor: pointer;
}
.xkt-bcf-panel .xkt-bcf-toggle-all:hover {
  background: #eaf3f0;
  border-color: #2c7e6f;
}

/* Per-layer row. */
.xkt-bcf-panel .xkt-bcf-layer-row {
  display: grid;
  grid-template-columns: 18px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
}
.xkt-bcf-panel .xkt-bcf-layer-row:hover { background: #eaf3f0; }
.xkt-bcf-panel .xkt-bcf-layer-row > input[type="checkbox"] { margin: 0; cursor: pointer; }
.xkt-bcf-panel .xkt-bcf-layer-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11.5px;
  color: #222;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-bcf-panel .xkt-bcf-layer-count {
  font-size: 10.5px;
  font-weight: 600;
  color: #777;
  font-variant-numeric: tabular-nums;
}
.xkt-bcf-panel .xkt-bcf-empty {
  padding: 14px 8px;
  text-align: center;
  color: #777;
  font-size: 11.5px;
  font-style: italic;
}

/* Options grid — checkbox rows + a free-text input. */
.xkt-bcf-panel .xkt-bcf-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
}
.xkt-bcf-panel .xkt-bcf-option:hover { background: #eef3f9; }
.xkt-bcf-panel .xkt-bcf-option-text {
  flex: 1;
  min-width: 0;
  font-size: 11.5px;
  color: #222;
}
.xkt-bcf-panel .xkt-bcf-option-text > .xkt-bcf-option-desc {
  display: block;
  font-size: 10.5px;
  font-weight: normal;
  color: #666;
  margin-top: 1px;
}
.xkt-bcf-panel .xkt-bcf-input {
  width: 100%;
  font: inherit;
  font-size: 11.5px;
  padding: 4px 6px;
  margin-top: 4px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: #fff;
  color: #222;
}
.xkt-bcf-panel .xkt-bcf-input:focus {
  outline: none;
  border-color: #2c7e6f;
  box-shadow: 0 0 0 2px rgba(44, 126, 111, 0.15);
}

/* Footer — Cancel + Export. */
.xkt-bcf-panel .xkt-bcf-footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid #ececec;
  background: #fafafa;
}
.xkt-bcf-panel .xkt-bcf-status {
  flex: 1;
  font-size: 11px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-bcf-panel .xkt-bcf-status.xkt-bcf-status-error { color: #b73d3d; }
.xkt-bcf-panel .xkt-bcf-status.xkt-bcf-status-ok    { color: #2c7e6f; }
.xkt-bcf-panel .xkt-bcf-btn {
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
.xkt-bcf-panel .xkt-bcf-btn:hover { background: #f0f0f0; }
.xkt-bcf-panel .xkt-bcf-btn-primary {
  background: #2c7e6f;
  border-color: #1d5e52;
  color: #fff;
}
.xkt-bcf-panel .xkt-bcf-btn-primary:hover { background: #1d5e52; }
.xkt-bcf-panel .xkt-bcf-btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

export class ExportBCFPanel extends FloatingPanelBase {

  /**
   * Per-View instance registry. Lets {@link openFor} return the
   * existing panel for a View instead of stacking duplicates.
   */
  private static readonly _instances = new WeakMap<View, ExportBCFPanel>();

  /**
   * SVG markup for the panel's title-bar glyph — the standard
   * "export" mark: an up-arrow rising out of an open tray.
   * Strokes use `currentColor` so the icon picks up whichever
   * colour the host element sets.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      // Open tray.
      `<path d="M 5 13 L 5 20 L 19 20 L 19 13" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" ` +
            `stroke-linecap="round" stroke-linejoin="round"/>` +
      // Up-arrow shaft + chevron.
      `<path d="M 12 4 L 12 14 M 7.5 8.5 L 12 4 L 16.5 8.5" ` +
            `fill="none" stroke="currentColor" stroke-width="1.8" ` +
            `stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;
  }

  static getFor(view: View): ExportBCFPanel | undefined {
    const inst = ExportBCFPanel._instances.get(view);
    return inst && !inst._destroyed ? inst : undefined;
  }

  static openFor(params: ExportBCFPanelParams): ExportBCFPanel {
    let inst = ExportBCFPanel._instances.get(params.view);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new ExportBCFPanel(params);
    return inst;
  }

  /** The View whose state the panel exports. */
  readonly view: View;

  /** Renderer used to capture the snapshot image, when set. */
  readonly renderer: WebGLRenderer | undefined;

  // Panel-content DOM refs.
  private _bodyEl!: HTMLElement;
  private _layersBodyEl!: HTMLElement;
  private _layersCountEl!: HTMLElement;
  private _enableAllBtn!: HTMLButtonElement;
  private _disableAllBtn!: HTMLButtonElement;
  private _snapshotCb!: HTMLInputElement;
  private _defaultInvisibleCb!: HTMLInputElement;
  private _reverseClippingCb!: HTMLInputElement;
  private _originatingSystemInput!: HTMLInputElement;
  private _statusEl!: HTMLElement;
  private _exportBtn!: HTMLButtonElement;
  private _cancelBtn!: HTMLButtonElement;

  /** Per-ViewLayer-id include flag. Re-read from the View's
   * `layers` map every time the layers section is rendered. */
  private readonly _selection = new Map<string, boolean>();

  /** Live-sync handles. */
  private readonly _unsubs: Array<() => void> = [];
  private _refreshScheduled = false;

  constructor(params: ExportBCFPanelParams) {
    if (!params || !params.view) {
      throw new Error("ExportBCFPanel: view is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-bcf-panel",
      classPrefix: "xkt-bcf",
    });
    this.view = params.view;
    this.renderer = params.renderer;

    // Replace any prior panel bound to the same View.
    const prior = ExportBCFPanel._instances.get(params.view);
    if (prior && !prior._destroyed) prior.destroy();
    ExportBCFPanel._instances.set(params.view, this);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();
    this._wireDomEvents();
    this._renderLayers();
    this._attachLiveSync();

    if (params.visible === false) {
      this.hide();
    } else {
      this.show();
    }
  }


  // ── Public lifecycle ──────────────────────────────────────────

  destroy(): void {
    if (this._destroyed) return;
    for (const u of this._unsubs) {
      try { u(); } catch { /* ignore */ }
    }
    this._unsubs.length = 0;
    if (ExportBCFPanel._instances.get(this.view) === this) {
      ExportBCFPanel._instances.delete(this.view);
    }
    super.destroy();
  }


  // ── Export ────────────────────────────────────────────────────

  /**
   * Run `saveBCFViewpoint` against the current selection and
   * trigger a JSON download. Updates the footer status with
   * the result. Public so callers can also drive it from a
   * keyboard shortcut.
   */
  async runExport(): Promise<void> {
    if (this._destroyed) return;
    this._setStatus("Exporting…", "neutral");
    this._setActionsDisabled(true);
    try {
      const includeViewLayerIds: string[] = [];
      for (const [id, on] of this._selection) {
        if (on) includeViewLayerIds.push(id);
      }
      const originatingSystem = this._originatingSystemInput.value.trim();
      const wantsSnapshot = this._snapshotCb.checked && !!this.renderer;
      const result = saveBCFViewpoint({
        view: this.view,
        snapshot:                wantsSnapshot,
        ...(wantsSnapshot ? {renderer: this.renderer!} : {}),
        defaultInvisible:        this._defaultInvisibleCb.checked,
        reverseClippingPlanes:   this._reverseClippingCb.checked,
        ...(originatingSystem ? {originatingSystem} : {}),
        // An empty array would tell saveBCFViewpoint to include
        // *no* layers; fall back to omitting the field, which
        // means "every layer".
        ...(includeViewLayerIds.length > 0 ? {includeViewLayerIds} : {}),
      });
      if (result.ok === false) {
        this._setStatus(`Export failed: ${result.error}`, "error");
        return;
      }
      const filename = bcfFilename(this.view);
      downloadJson(result.value, filename);
      this._setStatus(`Saved ${filename}`, "ok");
    } catch (e: any) {
      this._setStatus(`Export failed: ${e?.message ?? String(e)}`, "error");
    } finally {
      this._setActionsDisabled(false);
    }
  }

  private _setActionsDisabled(disabled: boolean): void {
    this._exportBtn.disabled = disabled;
    this._cancelBtn.disabled = disabled;
    this._enableAllBtn.disabled  = disabled;
    this._disableAllBtn.disabled = disabled;
  }


  // ── Live sync ─────────────────────────────────────────────────

  private _attachLiveSync(): void {
    const ev: any = (this.view as any).viewer?.events;
    const sub = (unsub: (() => void) | undefined): void => {
      if (typeof unsub === "function") this._unsubs.push(unsub);
    };
    if (ev?.onViewLayerCreated?.subscribe) {
      sub(ev.onViewLayerCreated.subscribe(() => this._scheduleRefresh()));
    }
    if (ev?.onViewLayerDestroyed?.subscribe) {
      sub(ev.onViewLayerDestroyed.subscribe(() => this._scheduleRefresh()));
    }
  }

  private _scheduleRefresh(): void {
    if (this._destroyed) return;
    if (this._refreshScheduled) return;
    this._refreshScheduled = true;
    requestAnimationFrame(() => {
      this._refreshScheduled = false;
      if (this._destroyed) return;
      this._renderLayers();
    });
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-bcf-pill", {
      type: "button",
      title: "Reopen the BCF Export panel",
      hidden: true,
      textContent: "BCF Viewpoint",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-bcf-panel");

    // Header.
    this._header = el("div", "xkt-bcf-header");
    const title = el("h2", "xkt-bcf-title");
    title.innerHTML =
      `<span class="xkt-bcf-title-icon">${ExportBCFPanel.iconSvg()}</span>` +
      `<span class="xkt-bcf-title-stack">` +
        `<span class="xkt-bcf-title-text">Export BCF Viewpoint</span>` +
        `<span class="xkt-bcf-subtitle">Capture a BCF viewpoint.</span>` +
      `</span>`;
    this._closeBtn = el("button", "xkt-bcf-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;
    this._header.append(title, this._closeBtn);
    this._panel.appendChild(this._header);

    // Body — layers section + options section.
    this._bodyEl = el("div", "xkt-bcf-body");

    // ── Layers section ──
    {
      const section = el("details", "xkt-bcf-section") as HTMLDetailsElement;
      section.setAttribute("data-kind", "layers");
      section.open = true;
      const summary = el("summary");
      const label = el("span", "xkt-bcf-section-label", {textContent: "ViewLayers"});
      this._layersCountEl = el("span", "xkt-bcf-section-count");
      this._enableAllBtn = el("button", "xkt-bcf-toggle-all", {
        type: "button",
        textContent: "All",
        title: "Include every ViewLayer",
      }) as HTMLButtonElement;
      this._disableAllBtn = el("button", "xkt-bcf-toggle-all", {
        type: "button",
        textContent: "None",
        title: "Exclude every ViewLayer",
      }) as HTMLButtonElement;
      summary.append(label, this._layersCountEl, this._enableAllBtn, this._disableAllBtn);
      section.appendChild(summary);

      this._layersBodyEl = el("div", "xkt-bcf-section-body");
      section.appendChild(this._layersBodyEl);
      this._bodyEl.appendChild(section);
    }

    // ── Options section ──
    {
      const section = el("details", "xkt-bcf-section") as HTMLDetailsElement;
      section.setAttribute("data-kind", "options");
      section.open = false;
      const summary = el("summary");
      summary.append(el("span", "xkt-bcf-section-label", {textContent: "Options"}));
      section.appendChild(summary);

      const body = el("div", "xkt-bcf-section-body");

      this._snapshotCb         = mkOptionRow(body,
        "Snapshot",
        this.renderer
          ? "Embed a PNG of the current canvas in BCFViewpoint.snapshot."
          : "Snapshot capture needs a renderer reference — disabled here.",
        !!this.renderer);
      if (!this.renderer) {
        this._snapshotCb.disabled = true;
      }
      this._defaultInvisibleCb = mkOptionRow(body,
        "Default invisible",
        "Encode visibility as exceptions to a hidden default — smaller payload when most objects are hidden.",
        false);
      this._reverseClippingCb  = mkOptionRow(body,
        "Reverse clipping planes",
        "Flip the clipping-plane normal direction captured in the BCF.",
        false);

      // Free-text originating-system input.
      const inputRow = el("div", "xkt-bcf-option");
      const inputLabel = el("span", "xkt-bcf-option-text");
      inputLabel.innerHTML =
        `Originating system` +
        `<span class="xkt-bcf-option-desc">Authoring system label written into the BCF (free text).</span>`;
      this._originatingSystemInput = el("input", "xkt-bcf-input", {
        type:        "text",
        placeholder: "e.g. xeokit-sdk demo",
        value:       "xeokit-sdk demo",
      }) as HTMLInputElement;
      inputRow.append(inputLabel);
      body.appendChild(inputRow);
      // Sit the text input under the option row so the layout
      // doesn't get awkward when its label wraps.
      body.appendChild(this._originatingSystemInput);

      section.appendChild(body);
      this._bodyEl.appendChild(section);
    }

    this._panel.appendChild(this._bodyEl);

    // Footer.
    const footer = el("div", "xkt-bcf-footer");
    this._statusEl = el("div", "xkt-bcf-status", {textContent: ""});
    this._cancelBtn = el("button", "xkt-bcf-btn", {
      type: "button",
      textContent: "Cancel",
      title: "Close without exporting",
    }) as HTMLButtonElement;
    this._exportBtn = el("button", "xkt-bcf-btn xkt-bcf-btn-primary", {
      type: "button",
      textContent: "Export",
      title: "Save a BCFViewpoint JSON file from the current selection",
    }) as HTMLButtonElement;
    footer.append(this._statusEl, this._cancelBtn, this._exportBtn);
    this._panel.appendChild(footer);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }

  private _wireDomEvents(): void {
    this._cancelBtn.addEventListener("click", () => this.hide());
    this._exportBtn.addEventListener("click", () => this.runExport());

    const stop = (ev: Event): void => ev.stopPropagation();
    this._enableAllBtn.addEventListener("click", (ev) => {
      stop(ev);
      this._setAllSelected(true);
    });
    this._disableAllBtn.addEventListener("click", (ev) => {
      stop(ev);
      this._setAllSelected(false);
    });
  }


  // ── Layers list ───────────────────────────────────────────────

  private _renderLayers(): void {
    this._layersBodyEl.innerHTML = "";
    const layers = listLayers(this.view);

    // Drop selection entries for layers that no longer exist.
    for (const id of [...this._selection.keys()]) {
      if (!layers.some((l) => l.id === id)) this._selection.delete(id);
    }
    // Default-include any layer we haven't seen yet.
    for (const layer of layers) {
      if (!this._selection.has(layer.id)) this._selection.set(layer.id, true);
    }

    if (layers.length === 0) {
      this._layersCountEl.textContent = "0 layers";
      this._layersBodyEl.appendChild(el("div", "xkt-bcf-empty", {
        textContent: "View has no ViewLayers.",
      }));
      return;
    }
    this._layersCountEl.textContent = `${layers.length} layer${layers.length === 1 ? "" : "s"}`;

    for (const layer of layers) {
      const row = el("label", "xkt-bcf-layer-row");
      const cb = el("input", undefined, {type: "checkbox"}) as HTMLInputElement;
      cb.checked = !!this._selection.get(layer.id);
      cb.addEventListener("change", () => {
        this._selection.set(layer.id, cb.checked);
      });
      const idEl    = el("span", "xkt-bcf-layer-id",    {textContent: layer.id, title: layer.id});
      const countEl = el("span", "xkt-bcf-layer-count", {textContent: formatLayerCount(layer)});
      row.append(cb, idEl, countEl);
      this._layersBodyEl.appendChild(row);
    }
  }

  private _setAllSelected(on: boolean): void {
    for (const id of this._selection.keys()) this._selection.set(id, on);
    const cbs = this._layersBodyEl.querySelectorAll<HTMLInputElement>(`input[type="checkbox"]`);
    cbs.forEach((cb) => { cb.checked = on; });
  }


  // ── Status helper ─────────────────────────────────────────────

  private _setStatus(text: string, kind: "ok" | "error" | "neutral"): void {
    this._statusEl.textContent = text;
    this._statusEl.classList.remove("xkt-bcf-status-ok", "xkt-bcf-status-error");
    if (kind === "ok")    this._statusEl.classList.add("xkt-bcf-status-ok");
    if (kind === "error") this._statusEl.classList.add("xkt-bcf-status-error");
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────

function mkOptionRow(
  host: HTMLElement,
  title: string,
  desc:  string,
  defaultChecked: boolean,
): HTMLInputElement {
  const row = el("label", "xkt-bcf-option");
  const cb = el("input", undefined, {type: "checkbox"}) as HTMLInputElement;
  cb.checked = defaultChecked;
  const text = el("span", "xkt-bcf-option-text");
  text.innerHTML = `${escapeHtml(title)}<span class="xkt-bcf-option-desc">${escapeHtml(desc)}</span>`;
  row.append(cb, text);
  host.appendChild(row);
  return cb;
}

function listLayers(view: View): ViewLayer[] {
  const layers = (view as any).layers as Record<string, ViewLayer> | undefined;
  if (!layers) return [];
  const out: ViewLayer[] = [];
  for (const id of Object.keys(layers)) {
    const l = layers[id];
    if (l) out.push(l);
  }
  out.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return out;
}

/** Best-effort label for the per-layer object count. ViewLayers
 *  expose various shape under different SDK versions; fall back
 *  silently if none of the known fields are present. */
function formatLayerCount(layer: ViewLayer): string {
  const candidates: Array<unknown> = [
    (layer as any).numObjects,
    (layer as any).objectsCount,
    Object.keys((layer as any).objects ?? {}).length,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n)) return `${n.toLocaleString()} objs`;
  }
  return "";
}

function bcfFilename(view: View): string {
  const id = String((view as any).id ?? "view");
  const stamp = nowStamp();
  return `${sanitize(id)}-bcf-${stamp}.json`;
}

function nowStamp(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function sanitize(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_") || "view";
}

function downloadJson(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[c] as string));
}
