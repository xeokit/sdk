/**
 * Floating, draggable, closeable panel that shows the demo's
 * model catalog (one row per model, expandable to a list of
 * available datasets) and lets the user load any dataset into
 * the {@link Studio}'s {@link model!scene.Scene | Scene} + {@link Data} with a
 * single click.
 *
 * Sister widget to the other floating panels — same chrome,
 * same colour palette, same drag / close / reopen-pill mechanics,
 * same `getFor` / `openFor` registry pattern.
 *
 * ## Catalog format
 *
 * Reads `models/index.json` (or whatever URL is supplied via
 * {@link SampleModelsPanelParams.sampleModelsUrl}). Expected shape:
 *
 * ```jsonc
 * {
 *   "Duplex": {
 *     "coordSys": { "basis": [...], "origin": [...], "units": "meters" },
 *     "formats": ["gltf", "ifc", "xgf"],
 *     "dataset": ["xgf", "gltf", "ifc", "datamodel, scenemodel"]
 *   },
 *   ...
 * }
 * ```
 *
 * Each entry in `dataset` is a comma-separated list of format
 * ids. The panel renders one row per dataset; clicking the row's
 * "Load" button calls `studio.loadDataset` with the modelId
 * + the parsed format list.
 *
 * ## Lazy fetch
 *
 * The catalog is fetched on first {@link show} (not in the
 * constructor), so a panel constructed with `visible: false`
 * costs nothing until the user opens it.
 *
 * ```ts
 * import {SampleModelsPanel} from "@xeokit/sdk/studio";
 *
 * const cat = new SampleModelsPanel({studio});
 * cat.show();
 * cat.hide();
 * cat.destroy();
 * ```
 *
 */
import type {Studio} from "../../Studio";


import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";
// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface SampleModelsPanelParams {

  /** Studio that owns the Scene + Data the catalog loads into. */
  studio: Studio;

  /**
   * URL of the catalog JSON file. Defaults to
   * `${studio.modelsDir}/index.json` (typically
   * `../../models/index.json` relative to a website example).
   */
  sampleModelsUrl?: string;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed
   * state. Defaults to `"xkt-sam-panel"`.
   */
  storageKey?: string;

  /** Show on construction (default `true`). */
  visible?: boolean;
}

/**
 * One catalog entry as parsed from `models/index.json`.
 */
export interface SampleModelEntry {
  coordSys?: {
    basis?: number[];
    origin?: number[];
    units?: string;
    [k: string]: unknown;
  };
  formats?: string[];
  dataset?: string[];
  [k: string]: unknown;
}


// ─────────────────────────────────────────────────────────────────
// Module state
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-sam-styles";
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
// CSS — every selector rooted at `.xkt-sam-panel` /
// `.xkt-sam-pill`. Visually matches the other floating panels.
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-sam-panel {
  position: fixed;
  top: 115px;
  right: 17px;
  width: 760px;
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
.xkt-sam-panel *, .xkt-sam-panel *::before, .xkt-sam-panel *::after {
  box-sizing: border-box;
}
.xkt-sam-panel[hidden] { display: none; }

.xkt-sam-panel .xkt-sam-header {
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
.xkt-sam-panel .xkt-sam-header.xkt-sam-dragging { cursor: grabbing; }
.xkt-sam-panel .xkt-sam-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 24px;
  font-weight: 650;
  color: #111;
  display: flex;
  align-items: center;
  gap: 8px;
}
.xkt-sam-panel .xkt-sam-title-icon {
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
.xkt-sam-panel .xkt-sam-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-sam-panel .xkt-sam-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-sam-panel .xkt-sam-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-sam-panel .xkt-sam-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
.xkt-sam-panel .xkt-sam-title-id {
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
.xkt-sam-panel .xkt-sam-close {
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
.xkt-sam-panel .xkt-sam-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-sam-pill {
  position: fixed;
  bottom: 17px;
  left: 17px;
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
.xkt-sam-pill:hover { background: #1f4669; }
.xkt-sam-pill[hidden] { display: none; }

.xkt-sam-panel .xkt-sam-body {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 260px 1fr;
}

/* Master list (left) */
.xkt-sam-panel .xkt-sam-list {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid #ececec;
  background: #fcfcfc;
}
.xkt-sam-panel .xkt-sam-search {
  flex: 0 0 auto;
  padding: 10px 12px 8px;
  border-bottom: 1px solid #ececec;
  background: #fcfcfc;
}
.xkt-sam-panel .xkt-sam-search input {
  width: 100%;
  padding: 6px 10px;
  font: inherit;
  font-size: 12px;
  color: #111;
  background: #fff;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
}
.xkt-sam-panel .xkt-sam-list-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 6px;
}
.xkt-sam-panel .xkt-sam-list-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  color: #111;
}
.xkt-sam-panel .xkt-sam-list-row:hover { background: #eef3f9; }
.xkt-sam-panel .xkt-sam-list-row.xkt-sam-list-row-selected {
  background: #2d5e8c;
  color: #fff;
}
.xkt-sam-panel .xkt-sam-list-row-id {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}
.xkt-sam-panel .xkt-sam-list-row-meta {
  flex-shrink: 0;
  font-size: 10.5px;
  color: #777;
}
.xkt-sam-panel .xkt-sam-list-row-selected .xkt-sam-list-row-meta { color: #dbeafe; }
.xkt-sam-panel .xkt-sam-list-empty {
  padding: 18px 14px;
  color: #777;
  font-size: 11.5px;
  text-align: center;
}

/* Detail pane (right) */
.xkt-sam-panel .xkt-sam-detail {
  min-height: 0;
  overflow-y: auto;
  padding: 14px 16px 16px;
}
.xkt-sam-panel .xkt-sam-detail-id {
  font-size: 15px;
  font-weight: 600;
  color: #111;
  margin: 0 0 4px;
  word-break: break-all;
}
.xkt-sam-panel .xkt-sam-detail-empty {
  padding: 24px 12px;
  text-align: center;
  color: #777;
  font-size: 12px;
}
.xkt-sam-panel .xkt-sam-empty {
  padding: 24px 12px;
  text-align: center;
  color: #777;
  font-size: 12px;
}
.xkt-sam-panel .xkt-sam-error {
  padding: 14px 14px;
  margin: 6px 0;
  background: #fdf3f3;
  border: 1px solid #f3d7d7;
  border-left: 3px solid #a02020;
  border-radius: 6px;
  font-size: 11.5px;
  color: #a02020;
  word-break: break-word;
}

/* Load-error banner — non-destructive, sits between the
   controls strip and the catalog body. Keeps the row list
   visible so the user can immediately retry with another
   dataset. */
.xkt-sam-panel .xkt-sam-load-error {
  flex: 0 0 auto;
  margin: 8px 12px 0;
  padding: 8px 10px;
  background: #fdf3f3;
  border: 1px solid #f3d7d7;
  border-left: 3px solid #a02020;
  border-radius: 6px;
  font-size: 11.5px;
  color: #6f1e1e;
}
.xkt-sam-panel .xkt-sam-load-error[hidden] { display: none; }
.xkt-sam-panel .xkt-sam-load-error-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.xkt-sam-panel .xkt-sam-load-error-title {
  flex: 1;
  font-weight: 700;
  color: #a02020;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-sam-panel .xkt-sam-load-error-dismiss {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  font: inherit;
  font-size: 16px;
  line-height: 1;
  color: #a02020;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
}
.xkt-sam-panel .xkt-sam-load-error-dismiss:hover {
  background: rgba(160, 32, 32, 0.08);
  border-color: rgba(160, 32, 32, 0.25);
}
.xkt-sam-panel .xkt-sam-load-error-msg {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  line-height: 1.45;
  word-break: break-word;
  white-space: pre-wrap;
  /* The panel root sets user-select:none; re-enable it here so the error
     text can be selected and copied. */
  user-select: text;
  -webkit-user-select: text;
  cursor: text;
}
.xkt-sam-panel .xkt-sam-load-error-copy {
  flex-shrink: 0;
  padding: 2px 8px;
  font: inherit;
  font-size: 11px;
  color: #a02020;
  background: transparent;
  border: 1px solid rgba(160, 32, 32, 0.35);
  border-radius: 4px;
  cursor: pointer;
}
.xkt-sam-panel .xkt-sam-load-error-copy:hover {
  background: rgba(160, 32, 32, 0.08);
}

/* Top-of-body status strip: shown only while a load is in
   flight. Mirrors the run-progress vocabulary used by the
   SceneHealthPanel — pinned-height idle / amber active. */
.xkt-sam-panel .xkt-sam-progress {
  flex: 0 0 auto;
  display: none;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  min-height: 32px;
  border-bottom: 1px solid #f0e3b0;
  background: #fff8e1;
  font-size: 11px;
  color: #6b5300;
  font-weight: 500;
}
.xkt-sam-panel.xkt-sam-loading .xkt-sam-progress { display: flex; }
.xkt-sam-panel .xkt-sam-progress-bar {
  flex-shrink: 0;
  width: 110px;
  height: 8px;
}

/* Controls strip — currently the "Add to scene" toggle that
   flips loadDataset between replace and additive modes. Sits
   between the progress strip and the catalog body so the
   choice is visible above every Load button. */
.xkt-sam-panel .xkt-sam-controls {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-bottom: 1px solid #ececec;
  background: #fcfcfc;
}
.xkt-sam-panel .xkt-sam-add-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #333;
  cursor: pointer;
  user-select: none;
}
.xkt-sam-panel .xkt-sam-add-toggle input[type="checkbox"] {
  appearance: auto;
  width: 14px;
  height: 14px;
  margin: 0;
  cursor: pointer;
}
.xkt-sam-panel .xkt-sam-add-toggle-text {
  font-weight: 600;
  color: #2d5e8c;
}
.xkt-sam-panel .xkt-sam-add-toggle-hint {
  color: #888;
  font-size: 10.5px;
}

/* Per-model section — collapsible. */
.xkt-sam-panel .xkt-sam-section {
  margin: 6px 0;
  background: #fff;
  border: 1px solid #ececec;
  border-left: 3px solid #2d5e8c;
  border-radius: 6px;
  overflow: hidden;
}
.xkt-sam-panel .xkt-sam-section > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  user-select: none;
}
.xkt-sam-panel .xkt-sam-section > summary::-webkit-details-marker { display: none; }
.xkt-sam-panel .xkt-sam-section > summary::marker                  { display: none; }
.xkt-sam-panel .xkt-sam-section > summary::before {
  content: "›";
  display: inline-block;
  transform: rotate(0deg);
  transition: transform 120ms ease-out;
  color: #888;
  font-size: 12px;
}
.xkt-sam-panel .xkt-sam-section[open] > summary::before { transform: rotate(90deg); }
.xkt-sam-panel .xkt-sam-section > summary:hover { background: #fafafa; }
.xkt-sam-panel .xkt-sam-section-label {
  flex: 1;
  font-size: 12px;
  font-weight: 650;
  color: #2d5e8c;
  letter-spacing: -0.1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-sam-panel .xkt-sam-section-meta {
  flex-shrink: 0;
  font-size: 10.5px;
  font-weight: 500;
  color: #888;
  font-variant-numeric: tabular-nums;
}
.xkt-sam-panel .xkt-sam-section > .xkt-sam-section-body {
  border-top: 1px solid #f4f4f4;
  background: #fcfcfc;
}

/* Coord-system blurb — a single muted line under the model
   summary. Just enough to disambiguate Y-up vs Z-up models
   without unfolding a full table. */
.xkt-sam-panel .xkt-sam-coord {
  padding: 6px 12px;
  font-size: 10.5px;
  color: #666;
  border-bottom: 1px solid #f4f4f4;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.xkt-sam-panel .xkt-sam-datasets {
  display: flex;
  flex-direction: column;
}
.xkt-sam-panel .xkt-sam-dataset {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-top: 1px solid #f4f4f4;
}
.xkt-sam-panel .xkt-sam-dataset:first-child { border-top: none; }
.xkt-sam-panel .xkt-sam-dataset-formats {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.xkt-sam-panel .xkt-sam-format-chip {
  flex-shrink: 0;
  padding: 1px 7px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.2px;
  color: #555;
  background: #f0f0f0;
  border-radius: 999px;
}
.xkt-sam-panel .xkt-sam-load-btn {
  flex-shrink: 0;
  padding: 4px 12px;
  font: inherit;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: #fff;
  background: #2d5e8c;
  border: 1px solid #1f4669;
  border-radius: 999px;
  cursor: pointer;
}
.xkt-sam-panel .xkt-sam-load-btn:hover:not(:disabled) { background: #1f4669; }
.xkt-sam-panel .xkt-sam-load-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

export class SampleModelsPanel extends FloatingPanelBase {

  /**
   * Per-Studio instance registry. Keyed by helper because
   * the catalog is conceptually "what can this helper load" —
   * different helpers (different Scene/Data pairs) get
   * independent panels.
   */
  private static readonly _instances = new WeakMap<Studio, SampleModelsPanel>();

  static getFor(studio: Studio): SampleModelsPanel | undefined {
    const inst = SampleModelsPanel._instances.get(studio);
    return inst && !inst._destroyed ? inst : undefined;
  }

  /**
   * Reveal (or lazily mount) a panel for `params.studio`.
   * Idempotent.
   */
  static openFor(params: SampleModelsPanelParams): SampleModelsPanel {
    let inst = SampleModelsPanel._instances.get(params.studio);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new SampleModelsPanel(params);
    return inst;
  }

  /**
   * Title-bar "import" mark — matches {@link ImportDialog.iconSvg}
   * so all "import …" surfaces share one visual.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      // Open tray.
      `<path d="M 5 13 L 5 20 L 19 20 L 19 13" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" ` +
            `stroke-linecap="round" stroke-linejoin="round"/>` +
      // Down-arrow shaft + chevron.
      `<path d="M 12 4 L 12 14 M 7.5 9.5 L 12 14 L 16.5 9.5" ` +
            `fill="none" stroke="currentColor" stroke-width="1.8" ` +
            `stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;
  }

  readonly studio: Studio;
  private readonly _sampleModelsUrl: string;

  // DOM refs.
  private _titleIdEl!: HTMLElement;
  private _bodyEl!: HTMLElement;
  private _listScrollEl!: HTMLElement;
  private _detailEl!: HTMLElement;
  private _searchInput!: HTMLInputElement;
  private _selectedId: string | null = null;
  private _filter: string = "";
  private _progressEl!: HTMLElement;
  private _progressLabelEl!: HTMLElement;
  /**
   * Banner that surfaces load failures without clobbering the
   * catalog list (the previous behaviour, where an exception
   * replaced the entire body, locked the user out of retrying
   * with a different dataset).
   */
  private _loadErrorEl!: HTMLElement;

  // Catalog state.
  private _sampleModels: Record<string, SampleModelEntry> | null = null;
  private _fetchInFlight = false;
  private _loadInFlight = false;
  /**
   * When `true`, "Load" buttons add the dataset alongside any
   * already-loaded models (calls `loadDataset` with `clear:
   * false`); when `false` (default), a load replaces every
   * existing SceneModel + DataModel in the helper. Toggled via
   * the "Add to scene" checkbox above the catalog list.
   */
  // "Import Sample Models" semantics: every Load is additive —
  // datasets land alongside whatever is already in the scene.
  private _addMode = true;

  /**
   * Per-row registry, populated as the catalog renders. Used by
   * the load/unload state machine to (a) flip a loaded row's
   * button to "Unload" and disable its siblings, and (b) revert
   * those changes when the loaded SceneModel is destroyed —
   * whether by the row's own Unload button or by an external
   * action (e.g. Delete Model in the context menu).
   */
  private _rows: RowEntry[] = [];
  private _rowsByModelId: Map<string, RowEntry[]> = new Map();
  private _rowsBySceneModelId: Map<string, RowEntry> = new Map();

  /**
   * Live subscription unsubscribe handles. Currently just the
   * Scene's `onSceneModelDestroyed`; cleared in destroy().
   */
  private readonly _unsubs: Array<() => void> = [];

  // Lifecycle state.

  // Drag state.

  constructor(params: SampleModelsPanelParams) {
    if (!params || !params.studio) {
      throw new Error("SampleModelsPanel: studio is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-sam-panel",
      classPrefix: "xkt-sam",
      modal:       true,
    });
    this.studio = params.studio;
    this._sampleModelsUrl =
      params.sampleModelsUrl ||
      `${(this.studio as any).modelsDir || "../../models"}/index.json`;

    // Replace any prior panel bound to the same Studio —
    // keeps openFor's idempotence honest and clears stale DOM
    // from a hot-reload / re-import.
    const prior = SampleModelsPanel._instances.get(this.studio);
    if (prior && !prior._destroyed) prior.destroy();
    SampleModelsPanel._instances.set(this.studio, this);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();
    this._wireDomEvents();
    this._attachSceneListeners();


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
    // Lazy fetch: only the first show triggers a network request;
    // subsequent shows reuse the cached catalog.
    if (!this._sampleModels && !this._fetchInFlight) {
      void this._fetchAndRender();
    }
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
    for (const u of this._unsubs) {
      try { u(); } catch { /* ignore */ }
    }
    this._unsubs.length = 0;
    if (SampleModelsPanel._instances.get(this.studio) === this) {
      SampleModelsPanel._instances.delete(this.studio);
    }
    super.destroy();
  }


  // ── Scene lifecycle setup ────────────────────────────────────

  /**
   * Subscribe to the Scene's `onSceneModelDestroyed` so the
   * panel can revert a row's "Unload" button back to "Load" —
   * and re-enable its siblings — when the SceneModel goes away,
   * regardless of who destroyed it. Click of the row's own
   * Unload button, the context-menu Delete Model action, or any
   * programmatic destroy all funnel through this listener.
   */
  private _attachSceneListeners(): void {
    const scene: any = (this.studio as any).scene;
    const ev = scene && scene.events;
    if (!ev || !ev.onSceneModelDestroyed?.subscribe) return;
    const unsub = ev.onSceneModelDestroyed.subscribe((_sender: any, sceneModel: any) => {
      this._handleSceneModelDestroyed(sceneModel?.id);
    });
    this._unsubs.push(unsub);
  }

  private _handleSceneModelDestroyed(sceneModelId?: string): void {
    if (this._destroyed || !sceneModelId) return;
    const entry = this._rowsBySceneModelId.get(sceneModelId);
    if (!entry) return;
    this._rowsBySceneModelId.delete(sceneModelId);
    entry.loadedSceneModelId = undefined;
    this._refreshButtonStates();
  }


  // ── Catalog fetch + render ────────────────────────────────────

  private async _fetchAndRender(): Promise<void> {
    if (this._fetchInFlight || this._destroyed) return;
    this._fetchInFlight = true;
    this._setBodyMessage("Loading catalog…");
    try {
      const res = await fetch(this._sampleModelsUrl, {cache: "no-cache"});
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const json = await res.json() as Record<string, SampleModelEntry>;
      if (this._destroyed) return;
      this._sampleModels = json;
      this._renderSampleModels();
    } catch (err: any) {
      if (this._destroyed) return;
      this._setBodyError(
        `Couldn't load catalog from ${this._sampleModelsUrl}: ${err && err.message || err}`,
      );
    } finally {
      this._fetchInFlight = false;
    }
  }

  private _setBodyMessage(text: string): void {
    this._bodyEl.innerHTML = "";
    const empty = el("div", "xkt-sam-empty", {textContent: text});
    this._bodyEl.appendChild(empty);
  }

  private _setBodyError(text: string): void {
    this._bodyEl.innerHTML = "";
    const errBox = el("div", "xkt-sam-error", {textContent: text});
    this._bodyEl.appendChild(errBox);
  }

  private _renderSampleModels(): void {
    if (!this._sampleModels) return;
    const ids = Object.keys(this._sampleModels).sort((a, b) => a.localeCompare(b));
    if (ids.length === 0) {
      this._setBodyMessage("Catalog is empty.");
      this._titleIdEl.textContent = "0 models";
      return;
    }
    this._titleIdEl.textContent = `${ids.length} model${ids.length === 1 ? "" : "s"}`;

    // Per-row state is rebuilt against the new DOM.
    this._rows.length = 0;
    this._rowsByModelId.clear();
    this._rowsBySceneModelId.clear();

    if (!this._selectedId || !(this._selectedId in this._sampleModels)) {
      this._selectedId = ids[0];
    }

    this._buildMasterDetailDom();
    this._renderList();
    this._renderDetail();
    this._reconcileWithLoadedScene();
  }

  /**
   * One-shot DOM scaffold for the body: search input + scrollable
   * list (left) and the detail host (right). Re-rendering the
   * catalog rebuilds the content of each, not the scaffold.
   */
  private _buildMasterDetailDom(): void {
    this._bodyEl.innerHTML = "";

    const list = el("div", "xkt-sam-list");
    const searchHost = el("div", "xkt-sam-search");
    this._searchInput = el("input", undefined, {
      type: "search",
      placeholder: "Filter…",
      "aria-label": "Filter sample models",
      value: this._filter,
    }) as HTMLInputElement;
    this._searchInput.addEventListener("input", () => {
      this._filter = this._searchInput.value;
      this._renderList();
    });
    searchHost.appendChild(this._searchInput);
    list.appendChild(searchHost);

    this._listScrollEl = el("div", "xkt-sam-list-scroll");
    list.appendChild(this._listScrollEl);

    this._detailEl = el("div", "xkt-sam-detail");

    this._bodyEl.appendChild(list);
    this._bodyEl.appendChild(this._detailEl);
  }

  private _renderList(): void {
    if (!this._sampleModels) return;
    this._listScrollEl.innerHTML = "";

    const ids = Object.keys(this._sampleModels)
      .filter(id => this._matchesFilter(id))
      .sort((a, b) => a.localeCompare(b));

    if (ids.length === 0) {
      this._listScrollEl.appendChild(el("div", "xkt-sam-list-empty", {
        textContent: this._filter ? "No matches." : "Catalog is empty.",
      }));
      return;
    }

    // Keep the selection visible when possible — if the filter
    // dropped the currently-selected model, fall back to the
    // first visible match (but don't auto-rerender the detail).
    if (!this._selectedId || !ids.includes(this._selectedId)) {
      this._selectedId = ids[0];
      this._renderDetail();
    }

    for (const id of ids) {
      const entry = this._sampleModels[id];
      const datasets = entry.dataset || [];
      const row = el("div", "xkt-sam-list-row");
      if (id === this._selectedId) row.classList.add("xkt-sam-list-row-selected");
      row.append(
        el("span", "xkt-sam-list-row-id", {textContent: id, title: id}),
        el("span", "xkt-sam-list-row-meta", {
          textContent: `${datasets.length} dataset${datasets.length === 1 ? "" : "s"}`,
        }),
      );
      row.addEventListener("click", () => {
        if (this._selectedId === id) return;
        this._selectedId = id;
        this._renderList();
        this._renderDetail();
      });
      this._listScrollEl.appendChild(row);
    }
  }

  private _renderDetail(): void {
    if (!this._sampleModels) return;
    this._detailEl.innerHTML = "";
    const id = this._selectedId;
    if (!id || !(id in this._sampleModels)) {
      this._detailEl.appendChild(el("div", "xkt-sam-detail-empty", {
        textContent: "Pick a model on the left to see its datasets.",
      }));
      return;
    }
    this._detailEl.appendChild(this._renderModelDetail(id, this._sampleModels[id]));
  }

  private _matchesFilter(id: string): boolean {
    const q = this._filter.trim().toLowerCase();
    if (q.length === 0) return true;
    return id.toLowerCase().includes(q);
  }

  private _renderModelDetail(id: string, entry: SampleModelEntry): HTMLElement {
    const root = el("div");
    const datasets = entry.dataset || [];

    root.appendChild(el("h3", "xkt-sam-detail-id", {textContent: id}));

    // Coord-system summary line — a one-liner so the user can
    // tell Y-up from Z-up at a glance.
    if (entry.coordSys) {
      const cs = entry.coordSys;
      const parts: string[] = [];
      if (cs.units) parts.push(String(cs.units));
      if (Array.isArray(cs.basis)) {
        parts.push(`basis [${cs.basis.join(", ")}]`);
      }
      if (Array.isArray(cs.origin) && cs.origin.some(v => v !== 0)) {
        parts.push(`origin [${cs.origin.join(", ")}]`);
      }
      if (parts.length > 0) {
        root.appendChild(el("div", "xkt-sam-coord", {textContent: parts.join(" · ")}));
      }
    }

    // One row per dataset.
    const list = el("div", "xkt-sam-datasets");
    if (datasets.length === 0) {
      list.appendChild(el("div", "xkt-sam-detail-empty", {
        textContent: "No datasets declared for this model.",
      }));
    } else {
      for (const dataset of datasets) {
        const formats = parseDatasetFormats(dataset);
        list.appendChild(this._renderDatasetRow(id, dataset, formats));
      }
    }
    root.appendChild(list);

    return root;
  }

  private _renderDatasetRow(modelId: string, datasetLabel: string, formats: string[]): HTMLElement {
    const row = el("div", "xkt-sam-dataset");
    const formatsEl = el("div", "xkt-sam-dataset-formats");
    for (const f of formats) {
      formatsEl.appendChild(el("span", "xkt-sam-format-chip", {textContent: f}));
    }
    const baseTitle = `${modelId} (${formats.join(", ")})`;
    const loadBtn = el("button", "xkt-sam-load-btn", {
      type: "button",
      textContent: "Load",
      title: `Load ${baseTitle} into the viewer`,
    }) as HTMLButtonElement;
    loadBtn.dataset.baseTitle = baseTitle;

    const entry: RowEntry = {
      modelId,
      datasetLabel,
      formats,
      baseTitle,
      button: loadBtn,
      loadedSceneModelId: undefined,
    };
    this._rows.push(entry);
    let bucket = this._rowsByModelId.get(modelId);
    if (!bucket) {
      bucket = [];
      this._rowsByModelId.set(modelId, bucket);
    }
    bucket.push(entry);

    loadBtn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      if (this._loadInFlight || this._destroyed) return;
      // The same button doubles as Load and Unload — branch on
      // the row's tracked SceneModel rather than on button text,
      // since text-driven branching is fragile against future
      // label tweaks.
      if (entry.loadedSceneModelId) {
        this._runUnload(entry);
      } else {
        await this._runLoad(modelId, formats, loadBtn, entry);
      }
    });
    row.append(formatsEl, loadBtn);
    return row;
  }

  private async _runLoad(
    modelId: string,
    formats: string[],
    button: HTMLButtonElement,
    entry: RowEntry,
  ): Promise<void> {
    const additive = this._addMode;
    this._loadInFlight = true;
    this._panel.classList.add("xkt-sam-loading");
    this._progressLabelEl.textContent =
      `Loading ${modelId} (${formats.join(", ")})…`;
    // Lock every button while the load is in flight so the user
    // can't kick off a second load mid-flight; the in-flight
    // button gets the "Loading…" label.
    this._setAllButtonsDisabled(true);
    button.textContent = "Loading…";
    // Clear any banner from a previous failed run — starting a
    // new load is the user's "I've moved on" signal.
    this._clearLoadError();
    try {
      const result = await (this.studio as any).loadDataset({
        modelId,
        formats,
        clear: !additive,
      });
      if (result && result.ok === false) {
        this._showLoadError(modelId, formats, String(result.error));
      } else if (result && result.ok === true && result.value && result.value.sceneModel) {
        // Record the actual SceneModel.id (which may differ from
        // catalog `modelId` when `addMode` appended a unique
        // suffix) so onSceneModelDestroyed can match it later.
        const sceneModelId: string = result.value.sceneModel.id;
        entry.loadedSceneModelId = sceneModelId;
        this._rowsBySceneModelId.set(sceneModelId, entry);
      }
    } catch (err: any) {
      // Recover gracefully — report the error in the banner and
      // keep the catalog list intact so the user can try another
      // dataset. The previous _setBodyError(...) path cleared the
      // body, which trapped the user with no recovery path.
      const msg = err && err.message ? err.message : String(err);
      this._showLoadError(modelId, formats, msg);
      this.studio.reportError(`${(`[SampleModelsPanel] Load failed for '${modelId}' (${formats.join(", ")}):`)}: ${err}`);
    } finally {
      this._loadInFlight = false;
      this._panel.classList.remove("xkt-sam-loading");
      this._progressLabelEl.textContent = "";
      this._refreshButtonStates();
    }
  }

  /**
   * Tear down a row's loaded model. Defers to
   * `Studio.destroyModel` so both the SceneModel and any
   * matching DataModel go away together; the
   * `onSceneModelDestroyed` listener then flips the row state
   * back to "Load" and re-enables siblings.
   */
  private _runUnload(entry: RowEntry): void {
    const id = entry.loadedSceneModelId;
    if (!id) return;
    try {
      (this.studio as any).destroyModel(id);
    } catch (e: any) {
      this.studio.reportWarning(`${(`[SampleModelsPanel] Unload failed for '${id}':`)}: ${e?.message ?? e}`);
    }
    // If the helper didn't fire onSceneModelDestroyed for some
    // reason (e.g. the model was already gone), force the row
    // back to its idle state so the UI doesn't get stuck.
    if ((this.studio as any).scene?.models?.[id] === undefined) {
      this._handleSceneModelDestroyed(id);
    }
  }

  /**
   * Reflect any already-loaded SceneModels in the row state
   * after a fresh catalog render. Looks for a SceneModel whose
   * id exactly matches a row's catalog `modelId` — the
   * non-additive `loadDataset` case — and marks the row as
   * loaded. The additive (`addMode`) suffix path uses
   * `${modelId}-${Date.now()}` ids that we can't reverse-map
   * confidently, so those go unmarked.
   */
  private _reconcileWithLoadedScene(): void {
    const sceneModels: Record<string, any> = (this.studio as any).scene?.models || {};
    for (const [modelId, rows] of this._rowsByModelId) {
      const sm = sceneModels[modelId];
      if (sm && !sm.destroyed && rows.length > 0) {
        // Pick the first row arbitrarily — without a "which
        // dataset was loaded" hint we can't disambiguate among
        // sibling rows. The user can re-load the right dataset
        // explicitly to correct the choice.
        const entry = rows[0];
        entry.loadedSceneModelId = modelId;
        this._rowsBySceneModelId.set(modelId, entry);
      }
    }
    this._refreshButtonStates();
  }

  /**
   * Surface a load failure in the banner above the catalog list
   * without disturbing the rest of the body, so the user can
   * pick another dataset and try again.
   */
  private _showLoadError(modelId: string, formats: string[], message: string): void {
    this._loadErrorEl.innerHTML = "";
    const head = el("div", "xkt-sam-load-error-head");
    head.appendChild(el("span", "xkt-sam-load-error-title", {
      textContent: `Load failed: ${modelId} (${formats.join(", ")})`,
    }));
    const copy = el("button", "xkt-sam-load-error-copy", {
      type: "button",
      "aria-label": "Copy error message",
      title: "Copy error message",
      textContent: "Copy",
    }) as HTMLButtonElement;
    copy.addEventListener("click", () => {
      const done = () => { copy.textContent = "Copied"; setTimeout(() => { copy.textContent = "Copy"; }, 1500); };
      const text = `Load failed: ${modelId} (${formats.join(", ")})\n${message}`;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done, () => {});
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); done(); } finally { ta.remove(); }
      }
    });
    head.appendChild(copy);
    const dismiss = el("button", "xkt-sam-load-error-dismiss", {
      type: "button",
      "aria-label": "Dismiss error",
      title: "Dismiss",
      innerHTML: "×",
    }) as HTMLButtonElement;
    dismiss.addEventListener("click", () => this._clearLoadError());
    head.appendChild(dismiss);
    this._loadErrorEl.appendChild(head);
    this._loadErrorEl.appendChild(el("div", "xkt-sam-load-error-msg", {
      textContent: message,
    }));
    this._loadErrorEl.hidden = false;
  }

  private _clearLoadError(): void {
    this._loadErrorEl.innerHTML = "";
    this._loadErrorEl.hidden = true;
  }

  /**
   * Walk every registered row and set its button's label,
   * tooltip, and disabled state based on:
   *
   *   - whether a load is currently in flight (locks every
   *     button regardless of per-row state),
   *   - the row's own load state (loaded → "Unload"; idle →
   *     "Load"),
   *   - any sibling row's load state (a sibling is loaded →
   *     "Load" but disabled, so the user has to unload first).
   *
   * Single source of truth so the rules are visible in one
   * place rather than spread across `_runLoad` /
   * `_handleSceneModelDestroyed` / etc.
   */
  private _refreshButtonStates(): void {
    for (const entry of this._rows) {
      const b = entry.button;
      if (this._loadInFlight) {
        // In-flight load: leave the "Loading…" label on the
        // active button; everything else is just disabled but
        // keeps its idle/loaded label so the user can read what
        // they'd get on resume.
        const isInFlight = /…$/.test(b.textContent || "");
        if (!isInFlight) {
          b.textContent = entry.loadedSceneModelId ? "Unload" : "Load";
        }
        b.disabled = true;
        continue;
      }
      if (entry.loadedSceneModelId) {
        b.textContent = "Unload";
        b.title = `Unload ${entry.baseTitle} from the viewer`;
        b.disabled = false;
      } else {
        const sibling = this._anySiblingLoaded(entry);
        b.textContent = "Load";
        b.title = sibling
          ? `Unload the loaded dataset for ${entry.modelId} first`
          : `Load ${entry.baseTitle} into the viewer`;
        b.disabled = !!sibling;
      }
    }
  }

  /** True iff some other row in the same model bucket has a
   * loaded SceneModel — meaning this row should be Load-disabled
   * until that sibling is unloaded. */
  private _anySiblingLoaded(entry: RowEntry): boolean {
    const bucket = this._rowsByModelId.get(entry.modelId);
    if (!bucket) return false;
    for (const r of bucket) {
      if (r !== entry && r.loadedSceneModelId) return true;
    }
    return false;
  }

  private _setAllButtonsDisabled(disabled: boolean): void {
    for (const entry of this._rows) {
      entry.button.disabled = disabled;
    }
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-sam-pill", {
      type: "button",
      title: "Reopen the Import Sample Models panel",
      hidden: true,
      textContent: "Import Sample Models",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-sam-panel");

    this._header = el("div", "xkt-sam-header");
    const title = el("h2", "xkt-sam-title");
    title.innerHTML =
      `<span class="xkt-sam-title-icon">${SampleModelsPanel.iconSvg()}</span>` +
      `<span class="xkt-sam-title-stack">` +
        `<span class="xkt-sam-title-text">Import Sample Models</span>` +
        `<span class="xkt-sam-subtitle">Pick a sample dataset.</span>` +
      `</span>` +
      `<span class="xkt-sam-title-id" title="Catalog summary">…</span>`;
    this._titleIdEl = title.querySelector(".xkt-sam-title-id") as HTMLElement;

    this._closeBtn = el("button", "xkt-sam-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;

    this._header.append(title, this._closeBtn);
    this._panel.appendChild(this._header);

    // Progress strip — hidden by default, shown via the
    // `xkt-sam-loading` class on the panel root.
    this._progressEl = el("div", "xkt-sam-progress");
    this._progressLabelEl = el("div", "xkt-sam-progress-label");
    const progressBar = el("progress", "xkt-sam-progress-bar") as HTMLProgressElement;
    this._progressEl.append(this._progressLabelEl, progressBar);
    this._panel.appendChild(this._progressEl);


    // Load-error banner — sits above the body so the catalog
    // list stays visible and the user can pick another dataset
    // after a failed load. Hidden until populated.
    this._loadErrorEl = el("div", "xkt-sam-load-error");
    this._loadErrorEl.hidden = true;
    this._panel.appendChild(this._loadErrorEl);

    this._bodyEl = el("div", "xkt-sam-body");
    this._panel.appendChild(this._bodyEl);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }

  private _wireDomEvents(): void {
  }


  // ── Layout persistence ────────────────────────────────────────

}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────

/** Per-rendered-row state used by the load/unload state machine. */
interface RowEntry {
  /** Catalog model id (e.g. `"Duplex"`). */
  modelId: string;
  /** Original `dataset` array entry, e.g. `"xgf, datamodel"`. */
  datasetLabel: string;
  /** Parsed format ids from {@link datasetLabel}. */
  formats: string[];
  /** Pre-computed `"<modelId> (<formats>)"` string used in tooltips. */
  baseTitle: string;
  /** The row's Load/Unload `<button>`. */
  button: HTMLButtonElement;
  /** SceneModel.id of this row's currently-loaded model, when one
   * is loaded; `undefined` while idle. Set on a successful
   * `_runLoad`, cleared by `_handleSceneModelDestroyed`. */
  loadedSceneModelId: string | undefined;
}


/**
 * Parse a dataset descriptor like `"datamodel, scenemodel"` into
 * its component format ids. The catalog stores combined-format
 * datasets as comma-separated strings rather than nested arrays;
 * we split + trim + drop empties so a single dataset string
 * always becomes a clean `["datamodel", "scenemodel"]`.
 */
function parseDatasetFormats(dataset: string): string[] {
  return String(dataset)
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}
