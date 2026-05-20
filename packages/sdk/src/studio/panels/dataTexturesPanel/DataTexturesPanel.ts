/**
 * Floating, draggable, closeable panel that surfaces the live
 * GPU {@link DataTextures} owned by a {@link WebGLRenderer} —
 * the per-view global matrix tables, every per-batch
 * {@link DataTexture}, and the per-batch PBR atlas family
 * ({@link TextureAtlas} for albedo / metallic-roughness /
 * normal-map), with capacity / utilisation bars, MEM STRESS
 * indicators when a texture is at ≥ 90 % of its capacity, and
 * an expandable "Details" body per row that includes a CPU-side
 * occupancy preview canvas plus the raw `getItems()` JSON.
 *
 * Same chrome and lifecycle as the sister diagnostic panels
 * ({@link demo/shadersPanel!ShadersPanel | ShadersPanel},
 * {@link demo/tasksPanel!TasksPanel | TasksPanel},
 * {@link demo/issuesPanel!IssuesPanel | IssuesPanel}) — per-DataTextures
 * WeakMap registry, idempotent `getFor` / `openFor`, drag
 * header, close button + reopen pill, layout persistence,
 * bring-to-front on pointer-down, scoped `xkt-dtx-` CSS prefix.
 *
 * @module demo/dataTexturesPanel
 */
import type {DataTextures} from "../../../viewing/webGLRenderer/internal/gpuMemoryManager/DataTextures";
import {clamp01} from "../../../base/math";

import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";


// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface DataTexturesPanelParams {

  /**
   * Snapshot of the renderer's GPU data textures to surface.
   * Doubles as the WeakMap key for {@link DataTexturesPanel.openFor}
   * idempotence — one panel per `DataTextures` instance.
   */
  dataTextures: DataTextures;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed
   * state. Defaults to `"xkt-dtx-panel"`.
   */
  storageKey?: string;

  /** Show on construction (default `true`). */
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-dtx-styles";
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
// CSS — scoped under `.xkt-dtx-panel`, classes prefixed
// `xkt-dtx-`. Visual palette tracks the other floating panels.
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-dtx-panel {
  position: fixed;
  top: 88px;
  right: 17px;
  width: 920px;
  max-width: calc(100vw - 34px);
  height: auto;
  max-height: calc(100vh - 116px);
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
.xkt-dtx-panel *, .xkt-dtx-panel *::before, .xkt-dtx-panel *::after {
  box-sizing: border-box;
}
.xkt-dtx-panel[hidden] { display: none; }

.xkt-dtx-panel .xkt-dtx-header {
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
.xkt-dtx-panel .xkt-dtx-header.xkt-dtx-dragging { cursor: grabbing; }
.xkt-dtx-panel .xkt-dtx-title {
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
.xkt-dtx-panel .xkt-dtx-title-icon {
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
.xkt-dtx-panel .xkt-dtx-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-dtx-panel .xkt-dtx-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-dtx-panel .xkt-dtx-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-dtx-panel .xkt-dtx-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
.xkt-dtx-panel .xkt-dtx-counter {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: #2d5e8c;
  border-radius: 11px;
  letter-spacing: 0.2px;
}
.xkt-dtx-panel .xkt-dtx-counter[data-count="0"] {
  background: #94a3b8;
}
.xkt-dtx-panel .xkt-dtx-close {
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
.xkt-dtx-panel .xkt-dtx-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-dtx-pill {
  position: fixed;
  bottom: 17px;
  right: 17px;
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
.xkt-dtx-pill:hover { background: #1f4669; }
.xkt-dtx-pill[hidden] { display: none; }

.xkt-dtx-panel .xkt-dtx-summary-strip {
  flex: 0 0 auto;
  display: flex;
  gap: 18px;
  padding: 10px 14px;
  border-bottom: 1px solid #ececec;
  background: #fafcff;
  font-size: 11.5px;
  color: #475569;
}
.xkt-dtx-panel .xkt-dtx-summary-strip strong {
  color: #2d5e8c;
  font-weight: 700;
  margin-right: 4px;
}

.xkt-dtx-panel .xkt-dtx-body {
  flex: 1 1 auto;
  overflow: auto;
  padding: 0;
}

.xkt-dtx-panel .xkt-dtx-section {
  border-bottom: 1px solid #ececec;
}
.xkt-dtx-panel .xkt-dtx-section:last-child {
  border-bottom: none;
}
.xkt-dtx-panel .xkt-dtx-section > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  background: #f8fafc;
  user-select: none;
  -webkit-user-select: none;
  font-weight: 600;
  font-size: 12.5px;
  color: #2d5e8c;
}
.xkt-dtx-panel .xkt-dtx-section > summary::-webkit-details-marker { display: none; }
.xkt-dtx-panel .xkt-dtx-section > summary:hover { background: #f1f5f9; }
.xkt-dtx-panel .xkt-dtx-section[open] > summary {
  border-bottom: 1px solid #ececec;
}
.xkt-dtx-panel .xkt-dtx-twisty {
  flex-shrink: 0;
  width: 12px;
  text-align: center;
  font-size: 10px;
  color: #64748b;
  transition: transform 120ms ease;
  display: inline-block;
}
.xkt-dtx-panel .xkt-dtx-section[open] > summary .xkt-dtx-twisty {
  transform: rotate(90deg);
}
.xkt-dtx-panel .xkt-dtx-section-spacer { flex: 1; }
.xkt-dtx-panel .xkt-dtx-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  border: 1px solid #e6e6e6;
  background: #f7fafc;
  color: #2d5e8c;
}
.xkt-dtx-panel .xkt-dtx-chip-stress {
  border-color: rgba(210, 35, 35, 0.35);
  background: rgba(210, 35, 35, 0.10);
  color: #aa1414;
}
.xkt-dtx-panel .xkt-dtx-chip-stress-lite {
  border-color: rgba(210, 35, 35, 0.22);
  background: rgba(210, 35, 35, 0.06);
  color: #aa1414;
  opacity: 0.9;
}

.xkt-dtx-panel .xkt-dtx-subsection {
  padding: 6px 14px 10px 28px;
  background: #fff;
}
.xkt-dtx-panel .xkt-dtx-subsection > details {
  margin-top: 6px;
}
.xkt-dtx-panel .xkt-dtx-subsection-label {
  font-size: 10px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 8px 0 4px;
}

.xkt-dtx-panel .xkt-dtx-view-section {
  border: 1px solid #ececec;
  border-radius: 8px;
  background: #fcfdff;
  margin: 4px 0;
}
.xkt-dtx-panel .xkt-dtx-view-section > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  font-weight: 600;
  font-size: 11.5px;
  color: #475569;
  user-select: none;
}
.xkt-dtx-panel .xkt-dtx-view-section > summary::-webkit-details-marker { display: none; }
.xkt-dtx-panel .xkt-dtx-view-section[open] > summary {
  border-bottom: 1px solid #ececec;
}

.xkt-dtx-panel .xkt-dtx-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11.5px;
}
.xkt-dtx-panel .xkt-dtx-table th {
  text-align: left;
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #64748b;
  padding: 6px 8px;
  border-bottom: 1px solid #f1f5f9;
  background: #fcfcfd;
}
.xkt-dtx-panel .xkt-dtx-table td {
  padding: 6px 8px;
  border-top: 1px solid #f1f5f9;
  vertical-align: middle;
}

.xkt-dtx-panel .xkt-dtx-namecell {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #111;
  min-width: 320px;
  white-space: nowrap;
}
.xkt-dtx-panel .xkt-dtx-namecell .xkt-dtx-title {
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1 1 auto;
  min-width: 0;
}
.xkt-dtx-panel .xkt-dtx-namecell .xkt-dtx-caret {
  width: 12px;
  font-size: 10px;
  color: #64748b;
  transition: transform 120ms ease;
}
.xkt-dtx-panel .xkt-dtx-row[data-open="1"] .xkt-dtx-caret { transform: rotate(90deg); }
.xkt-dtx-panel .xkt-dtx-row[data-kind="atlas"] .xkt-dtx-title { color: #b45309; }

.xkt-dtx-panel .xkt-dtx-pct {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: #111;
}
.xkt-dtx-panel .xkt-dtx-type {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10.5px;
  color: #475569;
}
.xkt-dtx-panel .xkt-dtx-capacity,
.xkt-dtx-panel .xkt-dtx-usedtext {
  font-variant-numeric: tabular-nums;
}
.xkt-dtx-panel .xkt-dtx-usedcell { position: relative; min-width: 130px; }
.xkt-dtx-panel .xkt-dtx-usedbar {
  display: block;
  margin-top: 3px;
  height: 6px;
  border-radius: 999px;
  background: #f0f3f6;
  border: 1px solid #e6e6e6;
  overflow: hidden;
  position: relative;
}
.xkt-dtx-panel .xkt-dtx-usedbar::before {
  content: "";
  position: absolute;
  inset: 0;
  width: var(--xkt-dtx-fill);
  background: var(--xkt-dtx-color);
}
.xkt-dtx-panel .xkt-dtx-btn {
  padding: 3px 8px;
  font: inherit;
  font-size: 10.5px;
  font-weight: 600;
  color: #2d5e8c;
  background: #fff;
  border: 1px solid #c8d6e6;
  border-radius: 5px;
  cursor: pointer;
}
.xkt-dtx-panel .xkt-dtx-btn:hover {
  background: #eef3f9;
  border-color: #2d5e8c;
}

.xkt-dtx-panel .xkt-dtx-row { cursor: pointer; }
.xkt-dtx-panel .xkt-dtx-row[data-open="1"] { background: #fbfdff; }
.xkt-dtx-panel .xkt-dtx-detail-row td {
  padding: 10px 12px 12px 28px;
  background: #fbfdff;
  border-top: none;
}
.xkt-dtx-panel .xkt-dtx-detail-wrap {
  border: 1px solid #eef2f5;
  border-radius: 8px;
  background: #fff;
  padding: 10px 12px 12px;
}
.xkt-dtx-panel .xkt-dtx-detail-hdr {
  font-size: 11.5px;
  font-weight: 700;
  color: #2d5e8c;
  margin-bottom: 6px;
}
.xkt-dtx-panel .xkt-dtx-preview {
  display: block;
  width: 100%;
  max-width: 600px;
  height: auto;
  border-radius: 3px;
  border: 1px solid rgba(0,0,0,0.12);
  background: rgba(0,0,0,0.03);
}
.xkt-dtx-panel .xkt-dtx-preview-hint {
  font-size: 10.5px;
  color: #667;
  line-height: 1.3;
  margin: 4px 0 10px;
  font-style: italic;
}
.xkt-dtx-panel .xkt-dtx-subhdr {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.2px;
  text-transform: uppercase;
  color: #2d5e8c;
  margin: 10px 0 4px;
  padding-top: 6px;
  border-top: 1px solid #eef2f5;
}
.xkt-dtx-panel .xkt-dtx-props {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 3px 10px;
  margin: 0;
}
.xkt-dtx-panel .xkt-dtx-prop-k {
  margin: 0;
  color: #667;
  font-size: 11px;
  font-weight: 600;
}
.xkt-dtx-panel .xkt-dtx-prop-v {
  margin: 0;
  color: #111;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  word-break: break-word;
}

.xkt-dtx-json-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 200000001;
}
.xkt-dtx-json-modal {
  position: fixed;
  top: 6vh;
  left: 50%;
  transform: translateX(-50%);
  width: min(1100px, 92vw);
  height: min(78vh, 900px);
  background: #0f1116;
  border: 1px solid #1c2028;
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.30);
  z-index: 200000002;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #eee;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.xkt-dtx-json-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #1c2028;
  background: #14171d;
}
.xkt-dtx-json-title {
  flex: 1;
  font-size: 12px;
  font-weight: 700;
  color: #cfd6df;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-dtx-json-actions { display: flex; gap: 8px; }
.xkt-dtx-json-actions button {
  padding: 4px 10px;
  font: inherit;
  font-size: 11px;
  color: #cfd6df;
  background: #1f242d;
  border: 1px solid #2a313c;
  border-radius: 5px;
  cursor: pointer;
}
.xkt-dtx-json-actions button:hover {
  background: #2a313c;
  border-color: #3a4452;
}
.xkt-dtx-json-pre {
  margin: 0;
  padding: 12px;
  overflow: auto;
  flex: 1 1 auto;
  font-size: 12px;
  line-height: 1.4;
}
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

/** Threshold beyond which a texture/atlas is flagged as stressed. */
const STRESS_THRESHOLD = 0.9;

interface RowEntry {
  /** Display name (property key on the batch / view / atlas group). */
  name: string;
  /** Underlying object — either a `DataTexture` or a `TextureAtlas`. */
  obj: any;
  /** Display kind, drives styling + which columns make sense. */
  kind: "texture" | "atlas";
}


export class DataTexturesPanel extends FloatingPanelBase {

  /**
   * Per-DataTextures instance registry. WeakMap so a renderer
   * whose `DataTextures` is torn down doesn't keep the panel
   * alive for GC.
   */
  private static readonly _instances = new WeakMap<DataTextures, DataTexturesPanel>();

  /**
   * SVG markup for the panel's title-bar glyph — a four-quadrant
   * grid suggesting a packed texture atlas. Strokes use
   * `currentColor`.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="3" y="3" width="18" height="18" rx="2" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<path d="M12 3 V21 M3 12 H21" ` +
            `fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.7"/>` +
      `<rect x="5.5"  y="5.5"  width="3"   height="3"   rx="0.5" fill="currentColor" opacity="0.85"/>` +
      `<rect x="13.5" y="5.5"  width="5"   height="2"   rx="0.5" fill="currentColor" opacity="0.55"/>` +
      `<rect x="13.5" y="9"    width="3.5" height="2"   rx="0.5" fill="currentColor" opacity="0.7"/>` +
      `<rect x="5.5"  y="13.5" width="4"   height="4"   rx="0.5" fill="currentColor" opacity="0.4"/>` +
      `<rect x="13.5" y="13.5" width="5"   height="2.5" rx="0.5" fill="currentColor" opacity="0.75"/>` +
      `<rect x="13.5" y="17"   width="3"   height="1.5" rx="0.5" fill="currentColor" opacity="0.5"/>` +
    `</svg>`;
  }

  static getFor(dataTextures: DataTextures): DataTexturesPanel | undefined {
    const inst = DataTexturesPanel._instances.get(dataTextures);
    return inst && !inst._destroyed ? inst : undefined;
  }

  /**
   * Reveal (or lazily mount) a panel for `params.dataTextures`.
   * Idempotent — if a panel already exists for this instance
   * and is still alive, it's brought back to the foreground;
   * otherwise a fresh one is constructed.
   */
  static openFor(params: DataTexturesPanelParams): DataTexturesPanel {
    let inst = DataTexturesPanel._instances.get(params.dataTextures);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new DataTexturesPanel(params);
    return inst;
  }

  readonly dataTextures: DataTextures;

  // Panel-content DOM refs (chrome refs live on FloatingPanelBase).
  private _counterEl!: HTMLElement;
  private _summaryStripEl!: HTMLElement;
  private _bodyEl!: HTMLElement;

  // Per-row preview canvas cache so repeated open/close doesn't
  // re-rasterise the buffer occupancy map.
  private readonly _previewCache = new WeakMap<object, HTMLCanvasElement>();

  /** Live JSON modal (one at a time). */
  private _jsonBackdrop: HTMLElement | null = null;
  private _jsonModal: HTMLElement | null = null;
  private _jsonKeyHandler: ((ev: KeyboardEvent) => void) | null = null;

  /** Unsubscribe handle for `onBatchCreated` so a new batch
   *  refreshes the panel without polling. */
  private _onBatchCreatedUnsub: (() => void) | null = null;

  constructor(params: DataTexturesPanelParams) {
    if (!params || !params.dataTextures) {
      throw new Error("DataTexturesPanel: dataTextures is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-dtx-panel",
      classPrefix: "xkt-dtx",
    });
    this.dataTextures = params.dataTextures;

    // Replace any prior panel bound to the same DataTextures —
    // keeps openFor idempotent and avoids stale DOM after a
    // hot reload.
    const prior = DataTexturesPanel._instances.get(params.dataTextures);
    if (prior && !prior._destroyed) prior.destroy();
    DataTexturesPanel._instances.set(params.dataTextures, this);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();
    this._render();

    // Subscribe to batch-creation so a model load surfaces its
    // batches in the panel without the user having to reopen it.
    if (this.dataTextures.onBatchCreated?.subscribe) {
      this._onBatchCreatedUnsub = this.dataTextures.onBatchCreated.subscribe(() => {
        if (this._destroyed) return;
        this._render();
      });
    }

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
    // Resyncing on every show is cheap (a few dozen DOM nodes
    // even on a large model) and means the panel is correct
    // after a model was loaded while the panel was hidden.
    this._render();
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
    if (this._onBatchCreatedUnsub) {
      try { this._onBatchCreatedUnsub(); } catch { /* ignore */ }
      this._onBatchCreatedUnsub = null;
    }
    this._closeJsonModal();
    if (DataTexturesPanel._instances.get(this.dataTextures) === this) {
      DataTexturesPanel._instances.delete(this.dataTextures);
    }
    super.destroy();
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-dtx-pill", {
      type: "button",
      title: "Reopen the Data Textures panel",
      hidden: true,
      textContent: "Data Textures",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-dtx-panel");

    this._header = el("div", "xkt-dtx-header");
    const title = el("h2", "xkt-dtx-title");
    title.innerHTML =
      `<span class="xkt-dtx-title-icon">${DataTexturesPanel.iconSvg()}</span>` +
      `<span class="xkt-dtx-title-stack">` +
        `<span class="xkt-dtx-title-text">Data Textures</span>` +
        `<span class="xkt-dtx-subtitle">GPU data textures and atlases.</span>` +
      `</span>`;

    this._counterEl = el("span", "xkt-dtx-counter");
    this._counterEl.textContent = "0";
    this._counterEl.dataset.count = "0";
    this._counterEl.title = "Total GPU data textures + atlases tracked";

    this._closeBtn = el("button", "xkt-dtx-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;

    this._header.append(title, this._counterEl, this._closeBtn);
    this._panel.appendChild(this._header);

    this._summaryStripEl = el("div", "xkt-dtx-summary-strip");
    this._panel.appendChild(this._summaryStripEl);

    this._bodyEl = el("div", "xkt-dtx-body");
    this._panel.appendChild(this._bodyEl);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }


  // ── Rendering ─────────────────────────────────────────────────

  /**
   * Rebuild the entire body. Cheap — runs on `show()`, on
   * `onBatchCreated`, and on construction. No per-frame polling.
   */
  private _render(): void {
    const dt = this.dataTextures;

    // Header counter — total rows across globals + batches +
    // per-view subsections. Computed alongside row emission so
    // we don't double-walk.
    let totalRows = 0;

    this._bodyEl.replaceChildren();
    this._summaryStripEl.replaceChildren();
    this._summaryStripEl.append(
      summaryItem("Tiles",   dt.numTiles ?? 0),
      summaryItem("Batches", dt.batches?.length ?? 0),
      summaryItem("Views",   dt.viewTileCameraMatrixTexture?.length ?? 0),
    );

    // ── Global per-view matrix tables ──
    {
      const rows: RowEntry[] = [];
      for (let i = 0; i < (dt.viewTileCameraMatrixTexture?.length ?? 0); i++) {
        rows.push({
          name: dt.viewTileCameraMatrixTexture.length > 1
            ? `viewTileCameraMatrixTexture #${i}`
            : "viewTileCameraMatrixTexture",
          obj: dt.viewTileCameraMatrixTexture[i],
          kind: "texture",
        });
      }
      for (let i = 0; i < (dt.viewTilePickMatrixTexture?.length ?? 0); i++) {
        rows.push({
          name: dt.viewTilePickMatrixTexture.length > 1
            ? `viewTilePickMatrixTexture #${i}`
            : "viewTilePickMatrixTexture",
          obj: dt.viewTilePickMatrixTexture[i],
          kind: "texture",
        });
      }
      const section = this._buildSection("Global Per-View Textures", rowStress(rows));
      section.body.appendChild(this._buildRowTable(rows));
      this._bodyEl.appendChild(section.details);
      totalRows += rows.length;
    }

    // ── Per-batch sections ──
    const batches = dt.batches || [];
    for (let bi = 0; bi < batches.length; bi++) {
      const batch = batches[bi];
      if (!batch) continue;
      const batchRows = collectBatchRows(batch);
      const stress = aggregateStress(batchRows);
      const section = this._buildSection(`Batch ${bi}`, stress);
      // Sub-section: textures + atlases on the batch itself.
      if (batchRows.length) {
        section.body.appendChild(this._buildSubsectionLabel(`Batch ${bi} textures`));
        section.body.appendChild(this._buildRowTable(batchRows));
        totalRows += batchRows.length;
      }
      // Per-view sub-sections.
      const views = (batch as any).views as any[] | undefined;
      if (Array.isArray(views) && views.length) {
        for (let vi = 0; vi < views.length; vi++) {
          const view = views[vi];
          if (!view) continue;
          const viewRows = collectGenericRows(view);
          const viewStress = aggregateStress(viewRows);
          const viewSection = this._buildViewSection(`View ${vi}`, viewStress);
          viewSection.body.appendChild(this._buildRowTable(viewRows));
          section.body.appendChild(viewSection.details);
          totalRows += viewRows.length;
        }
      }
      this._bodyEl.appendChild(section.details);
    }

    this._counterEl.textContent = String(totalRows);
    this._counterEl.dataset.count = String(totalRows);
  }

  private _buildSection(label: string, stress: StressSummary): {
    details: HTMLDetailsElement;
    body: HTMLElement;
  } {
    const details = document.createElement("details");
    details.className = "xkt-dtx-section";
    details.open = false;

    const summary = document.createElement("summary");
    const twisty = el("span", "xkt-dtx-twisty", {textContent: "▶"});
    const labelEl = el("span", "xkt-dtx-section-label", {textContent: label});
    const spacer = el("span", "xkt-dtx-section-spacer");
    summary.append(twisty, labelEl, spacer);
    if (stress.stressed) {
      summary.appendChild(stressChip(stress));
      summary.appendChild(stressLiteChip(stress));
    }
    details.appendChild(summary);

    const body = el("div", "xkt-dtx-subsection");
    details.appendChild(body);

    return {details, body};
  }

  private _buildViewSection(label: string, stress: StressSummary): {
    details: HTMLDetailsElement;
    body: HTMLElement;
  } {
    const details = document.createElement("details");
    details.className = "xkt-dtx-view-section";
    details.open = false;

    const summary = document.createElement("summary");
    const twisty = el("span", "xkt-dtx-twisty", {textContent: "▶"});
    const labelEl = el("span", "xkt-dtx-view-label", {textContent: label});
    const spacer = el("span", "xkt-dtx-section-spacer");
    summary.append(twisty, labelEl, spacer);
    if (stress.stressed) {
      summary.appendChild(stressChip(stress));
      summary.appendChild(stressLiteChip(stress));
    }
    details.appendChild(summary);

    const body = el("div");
    body.style.padding = "0 10px 10px";
    details.appendChild(body);

    return {details, body};
  }

  private _buildSubsectionLabel(text: string): HTMLElement {
    return el("div", "xkt-dtx-subsection-label", {textContent: text});
  }

  private _buildRowTable(rows: RowEntry[]): HTMLElement {
    const table = el("table", "xkt-dtx-table");
    const thead = el("thead");
    const hr = el("tr");
    hr.append(
      el("th", undefined, {textContent: "Name"}),
      el("th", undefined, {textContent: "Type"}),
      el("th", undefined, {textContent: "JSON"}),
      el("th", undefined, {textContent: "Capacity"}),
      el("th", undefined, {textContent: "Used"}),
    );
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = el("tbody");
    for (const r of rows) tbody.append(...this._buildRowPair(r));
    table.appendChild(tbody);
    return table;
  }

  /**
   * Build a (summary, detail) row pair for one texture / atlas.
   * The summary row is always visible; clicking it toggles the
   * detail row's display.
   */
  private _buildRowPair(row: RowEntry): HTMLTableRowElement[] {
    const isAtlas = row.kind === "atlas";
    const stats = readRowStats(row);
    const pct = Math.round(clamp01(stats.fullness) * 100);
    const color = heatColor(stats.fullness);

    const summaryTr = document.createElement("tr");
    summaryTr.className = "xkt-dtx-row";
    summaryTr.dataset.open = "0";
    summaryTr.dataset.kind = row.kind;

    const nameTd = el("td", undefined);
    const nameCell = el("div", "xkt-dtx-namecell");
    nameCell.append(
      el("span", "xkt-dtx-caret", {textContent: "▶"}),
      el("span", "xkt-dtx-title", {textContent: row.name}),
      el("span", "xkt-dtx-pct", {textContent: `${pct}%`}),
    );
    nameTd.appendChild(nameCell);

    const typeTd = el("td", "xkt-dtx-type", {
      textContent: stats.typeLabel,
      title: stats.typeLabel,
    });

    const jsonTd = el("td");
    if (typeof row.obj?.getItems === "function") {
      const jsonBtn = el("button", "xkt-dtx-btn", {
        type: "button",
        textContent: "JSON",
        title: "Show getItems() in a floating viewer",
      }) as HTMLButtonElement;
      jsonBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        this._openJsonModal(row.obj, `${row.name} — getItems()`);
      });
      jsonTd.appendChild(jsonBtn);
    }

    const capTd = el("td", "xkt-dtx-capacity", {
      textContent: stats.capacityLabel,
    });
    capTd.title = stats.capacityTitle;

    const usedTd = el("td", "xkt-dtx-usedcell");
    usedTd.style.setProperty("--xkt-dtx-fill", `${pct}%`);
    usedTd.style.setProperty("--xkt-dtx-color", color);
    usedTd.title = stats.usedTitle;
    usedTd.append(
      el("span", "xkt-dtx-usedtext", {textContent: stats.usedLabel}),
      el("span", "xkt-dtx-usedbar"),
    );

    summaryTr.append(nameTd, typeTd, jsonTd, capTd, usedTd);

    // Detail row.
    const detailTr = document.createElement("tr");
    detailTr.className = "xkt-dtx-detail-row";
    detailTr.style.display = "none";
    const detailTd = document.createElement("td");
    detailTd.colSpan = 5;
    detailTd.appendChild(this._buildDetailContent(row, isAtlas));
    detailTr.appendChild(detailTd);

    const toggle = () => {
      const isOpen = summaryTr.dataset.open === "1";
      summaryTr.dataset.open = isOpen ? "0" : "1";
      detailTr.style.display = isOpen ? "none" : "";
    };
    summaryTr.addEventListener("click", toggle);
    summaryTr.tabIndex = 0;
    summaryTr.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        toggle();
      }
    });

    return [summaryTr, detailTr];
  }

  private _buildDetailContent(row: RowEntry, isAtlas: boolean): HTMLElement {
    const wrap = el("div", "xkt-dtx-detail-wrap");
    wrap.appendChild(el("div", "xkt-dtx-detail-hdr", {
      textContent: isAtlas ? "TextureAtlas Details" : "DataTexture Details",
    }));

    if (!isAtlas) {
      const canvas = this._getOrBuildPreview(row.obj);
      wrap.appendChild(canvas);
      wrap.appendChild(el("div", "xkt-dtx-preview-hint", {
        textContent: "Preview shows CPU buffer occupancy mapped to texels; unused capacity is dimmed.",
      }));
    }

    const sections = isAtlas
      ? atlasDetailSections(row.obj)
      : textureDetailSections(row.obj);
    for (const sec of sections) {
      if (!sec.pairs.length) continue;
      wrap.appendChild(el("div", "xkt-dtx-subhdr", {textContent: sec.title}));
      wrap.appendChild(propGrid(sec.pairs));
    }

    return wrap;
  }

  private _getOrBuildPreview(tex: any): HTMLCanvasElement {
    const cached = this._previewCache.get(tex);
    if (cached) return cached;
    const canvas = document.createElement("canvas");
    canvas.className = "xkt-dtx-preview";
    this._previewCache.set(tex, canvas);
    // Defer the rasterisation; opening the detail row often
    // happens during a re-render so the canvas isn't sized yet.
    requestAnimationFrame(() => {
      const targetW = Math.max(120, canvas.clientWidth || 600);
      renderTexturePreview(tex, canvas, targetW);
    });
    return canvas;
  }


  // ── JSON modal ────────────────────────────────────────────────

  private _openJsonModal(obj: any, title: string): void {
    this._closeJsonModal();
    let jsonText = "";
    try {
      const payload = typeof obj?.getItems === "function" ? obj.getItems() : obj;
      jsonText = JSON.stringify(payload, null, 2);
    } catch (err: any) {
      jsonText = JSON.stringify({
        error: "getItems() / JSON.stringify failed",
        message: String(err?.message ?? err),
      }, null, 2);
    }

    const backdrop = el("div", "xkt-dtx-json-backdrop");
    backdrop.addEventListener("click", () => this._closeJsonModal());

    const modal = el("div", "xkt-dtx-json-modal");
    const header = el("div", "xkt-dtx-json-header");
    const titleEl = el("div", "xkt-dtx-json-title", {textContent: title});
    const actions = el("div", "xkt-dtx-json-actions");
    const copyBtn = el("button", undefined, {
      type: "button",
      textContent: "Copy",
      title: "Copy JSON to clipboard",
    }) as HTMLButtonElement;
    copyBtn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      try {
        await navigator.clipboard.writeText(jsonText);
        copyBtn.textContent = "Copied";
        window.setTimeout(() => { copyBtn.textContent = "Copy"; }, 1200);
      } catch { /* clipboard blocked */ }
    });
    const closeBtn = el("button", undefined, {
      type: "button",
      textContent: "Close",
      title: "Close",
    }) as HTMLButtonElement;
    closeBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._closeJsonModal();
    });
    actions.append(copyBtn, closeBtn);
    header.append(titleEl, actions);

    const pre = el("pre", "xkt-dtx-json-pre", {textContent: jsonText});

    modal.append(header, pre);

    document.body.append(backdrop, modal);
    this._jsonBackdrop = backdrop;
    this._jsonModal = modal;

    this._jsonKeyHandler = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        this._closeJsonModal();
      }
    };
    window.addEventListener("keydown", this._jsonKeyHandler, true);
  }

  private _closeJsonModal(): void {
    if (this._jsonBackdrop) {
      try { this._jsonBackdrop.remove(); } catch { /* ignore */ }
      this._jsonBackdrop = null;
    }
    if (this._jsonModal) {
      try { this._jsonModal.remove(); } catch { /* ignore */ }
      this._jsonModal = null;
    }
    if (this._jsonKeyHandler) {
      window.removeEventListener("keydown", this._jsonKeyHandler, true);
      this._jsonKeyHandler = null;
    }
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────

interface StressSummary {
  stressed: boolean;
  stressedCount: number;
  maxFullness: number;
}

function summaryItem(label: string, value: number | string): HTMLElement {
  const span = el("span");
  const strong = el("strong", undefined, {textContent: `${label}:`});
  span.append(strong, ` ${value}`);
  return span;
}

function isTextureLike(v: any): boolean {
  return !!(v && typeof v === "object" && typeof v.getItem === "function" && "maxItems" in v);
}

function isAtlasLike(v: any): boolean {
  return !!(v && typeof v === "object"
    && typeof v.getAllocatedBytes === "function"
    && "internalFormat" in v
    && "size" in v);
}

/**
 * Walk every non-array property on `batch` and classify it as a
 * DataTexture or a TextureAtlas. Returns an array of {@link RowEntry}.
 */
function collectBatchRows(batch: any): RowEntry[] {
  const rows: RowEntry[] = [];
  for (const [name, v] of Object.entries(batch)) {
    if (Array.isArray(v)) continue;     // `views` is an array, handled separately
    if (isTextureLike(v)) {
      rows.push({name, obj: v, kind: "texture"});
    } else if (isAtlasLike(v)) {
      rows.push({name, obj: v, kind: "atlas"});
    }
  }
  return rows;
}

function collectGenericRows(obj: any): RowEntry[] {
  const rows: RowEntry[] = [];
  for (const [name, v] of Object.entries(obj)) {
    if (Array.isArray(v)) continue;
    if (isTextureLike(v))      rows.push({name, obj: v, kind: "texture"});
    else if (isAtlasLike(v))   rows.push({name, obj: v, kind: "atlas"});
  }
  return rows;
}

function rowFullness(row: RowEntry): number {
  if (row.kind === "texture") {
    const used = Number(row.obj?.numItems) || 0;
    const cap  = Number(row.obj?.maxItems) || 0;
    return cap > 0 ? used / cap : 0;
  }
  // Atlas: utilisation by bytes used vs allocated.
  const used  = Number(row.obj?.getUsedBytes?.()) || 0;
  const alloc = Number(row.obj?.getAllocatedBytes?.()) || 0;
  return alloc > 0 ? used / alloc : 0;
}

function rowStress(rows: RowEntry[]): StressSummary {
  return aggregateStress(rows);
}

function aggregateStress(rows: RowEntry[]): StressSummary {
  let stressedCount = 0;
  let maxFullness = 0;
  for (const r of rows) {
    const f = rowFullness(r);
    if (f > maxFullness) maxFullness = f;
    if (f >= STRESS_THRESHOLD) stressedCount++;
  }
  return {stressed: stressedCount > 0, stressedCount, maxFullness};
}

function stressChip(s: StressSummary): HTMLElement {
  return el("span", "xkt-dtx-chip xkt-dtx-chip-stress", {
    textContent: `MEM STRESS (${s.stressedCount})`,
  });
}

function stressLiteChip(s: StressSummary): HTMLElement {
  return el("span", "xkt-dtx-chip xkt-dtx-chip-stress-lite", {
    textContent: `max ${(s.maxFullness * 100).toFixed(0)}%`,
  });
}

interface RowStats {
  typeLabel: string;
  capacityLabel: string;
  capacityTitle: string;
  usedLabel: string;
  usedTitle: string;
  fullness: number;
}

function readRowStats(row: RowEntry): RowStats {
  const t = row.obj;
  if (row.kind === "texture") {
    const used = Number(t?.numItems) || 0;
    const cap  = Number(t?.maxItems) || 0;
    const fullness = cap > 0 ? used / cap : 0;
    return {
      typeLabel: t?.description || t?.constructor?.name || "DataTexture",
      capacityLabel: cap.toLocaleString(),
      capacityTitle: `${used.toLocaleString()} / ${cap.toLocaleString()} items`,
      usedLabel: used.toLocaleString(),
      usedTitle: `${used.toLocaleString()} / ${cap.toLocaleString()} items (${(fullness * 100).toFixed(1)}%)`,
      fullness,
    };
  }
  const used  = Number(t?.getUsedBytes?.()) || 0;
  const alloc = Number(t?.getAllocatedBytes?.()) || 0;
  const fullness = alloc > 0 ? used / alloc : 0;
  return {
    typeLabel: t?.constructor?.name || "TextureAtlas",
    capacityLabel: fmtBytes(alloc),
    capacityTitle: `${fmtBytes(used)} / ${fmtBytes(alloc)} allocated`,
    usedLabel: fmtBytes(used),
    usedTitle: `${fmtBytes(used)} / ${fmtBytes(alloc)} (${(fullness * 100).toFixed(1)}%)`,
    fullness,
  };
}

function textureDetailSections(tex: any): Array<{title: string; pairs: Array<[string, string]>}> {
  const used = toNumber(tex?.numItems);
  const cap  = toNumber(tex?.maxItems);
  const w    = toNumber(tex?.width);
  const h    = toNumber(tex?.height);
  const tpi  = toNumber(tex?.texelsPerItem);
  const ept  = toNumber(tex?.elementsPerTexel);
  const epi  = toNumber(tex?.elementsPerItem);
  const bpt  = toNumber(tex?.bytesPerTexel);
  const isb  = toNumber(tex?.itemSizeInBytes);
  const totalTexels = Math.max(0, w * h);
  const usedTexels  = Math.max(0, Math.min(totalTexels, used * Math.max(1, tpi)));
  const allocBytes  = toNumber(tex?.getAllocatedBytes?.());
  const usedBytes   = toNumber(tex?.getUsedBytes?.());
  const bufferLen   = toNumber(tex?.buffer?.length);
  const bufferClass = tex?.bufferClass?.name || tex?.buffer?.constructor?.name || "";
  const fullness = cap > 0 ? used / cap : 0;

  const capacity: Array<[string, string]> = [
    ["Capacity (items)", cap.toLocaleString()],
    ["Used (items)",     used.toLocaleString()],
    ["Free (items)",     Math.max(0, cap - used).toLocaleString()],
    ["Utilization",      `${Math.round(fullness * 100)}%`],
    ["Used texels",      usedTexels.toLocaleString()],
    ["Total texels",     totalTexels.toLocaleString()],
  ];
  if (allocBytes) capacity.push(["Allocated", fmtBytes(allocBytes)]);
  if (usedBytes)  capacity.push(["Used",      fmtBytes(usedBytes)]);

  const layout: Array<[string, string]> = [
    ["Description",     String(tex?.description || "")],
    ["Width × Height",  `${w.toLocaleString()} × ${h.toLocaleString()}`],
    ["Texels / item",   tpi.toLocaleString()],
    ["Elements / texel", ept.toLocaleString()],
    ["Elements / item", epi.toLocaleString()],
    ["Bytes / texel",   bpt.toLocaleString()],
    ["Bytes / item",    isb.toLocaleString()],
  ];

  const gl = tex?.gl as WebGL2RenderingContext | undefined;
  const webgl: Array<[string, string]> = [
    ["Format",          fmtGl(gl, tex?.format)],
    ["Type",            fmtGl(gl, tex?.type)],
    ["Internal format", fmtGl(gl, tex?.internalFormat)],
  ];

  const buffer: Array<[string, string]> = [
    ["Buffer class",     bufferClass || "(unknown)"],
    ["Buffer length",    bufferLen.toLocaleString()],
    ["Expected length",  (w * h * Math.max(1, ept)).toLocaleString()],
  ];

  const runtime: Array<[string, string]> = [
    ["Last upload (ms)",  toNumber(tex?.lastUploadTimeMS).toFixed(3)],
    ["Debugging",         tex?.debugging ? "true" : "false"],
    ["Has WebGL texture", tex?.texture ? "true" : "false"],
    ["Has GL context",    tex?.gl ? "true" : "false"],
  ];

  return [
    {title: "Capacity", pairs: capacity},
    {title: "Layout",   pairs: layout},
    {title: "WebGL",    pairs: webgl},
    {title: "Buffer",   pairs: buffer},
    {title: "Runtime",  pairs: runtime},
  ];
}

function atlasDetailSections(atlas: any): Array<{title: string; pairs: Array<[string, string]>}> {
  const allocBytes = toNumber(atlas?.getAllocatedBytes?.());
  const usedBytes  = toNumber(atlas?.getUsedBytes?.());
  const size       = toNumber(atlas?.size);
  const padding    = toNumber(atlas?.padding);
  const fullness   = allocBytes > 0 ? usedBytes / allocBytes : 0;

  const sentinel = atlas?.sentinelColor;
  const sentinelTxt = Array.isArray(sentinel)
    ? `(${sentinel.join(", ")})`
    : "—";

  const capacity: Array<[string, string]> = [
    ["Allocated",   fmtBytes(allocBytes)],
    ["Used",        fmtBytes(usedBytes)],
    ["Free",        fmtBytes(Math.max(0, allocBytes - usedBytes))],
    ["Utilization", `${Math.round(fullness * 100)}%`],
  ];

  const gl = atlas?.gl as WebGL2RenderingContext | undefined;
  const layout: Array<[string, string]> = [
    ["Size",            `${size} × ${size} px`],
    ["Padding",         `${padding} px`],
    ["Mipmapped",       atlas?.mipmap ? "true" : "false"],
    ["Internal format", fmtGl(gl, atlas?.internalFormat)],
    ["Sentinel colour", sentinelTxt],
    ["Allocated",       atlas?.allocated ? "true" : "false"],
  ];

  const runtime: Array<[string, string]> = [
    ["Has WebGL texture", atlas?.texture ? "true" : "false"],
    ["Has GL context",    atlas?.gl ? "true" : "false"],
  ];

  return [
    {title: "Capacity", pairs: capacity},
    {title: "Layout",   pairs: layout},
    {title: "Runtime",  pairs: runtime},
  ];
}

function propGrid(pairs: Array<[string, string]>): HTMLElement {
  const dl = el("dl", "xkt-dtx-props");
  for (const [k, v] of pairs) {
    dl.append(
      el("dt", "xkt-dtx-prop-k", {textContent: k}),
      el("dd", "xkt-dtx-prop-v", {textContent: v}),
    );
  }
  return dl;
}

function fmtBytes(b: number): string {
  if (!Number.isFinite(b)) return String(b);
  const abs = Math.abs(b);
  if (abs >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GiB`;
  if (abs >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(2)} MiB`;
  if (abs >= 1024)      return `${(b / 1024).toFixed(2)} KiB`;
  return `${b} B`;
}

function fmtGl(gl: WebGL2RenderingContext | undefined, v: any): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? "");
  const hex = `0x${n.toString(16)}`;
  if (!gl) return `${n} (${hex})`;
  const name = glEnumName(gl, n);
  return name ? `${name} (${n} / ${hex})` : `${n} (${hex})`;
}

function glEnumName(gl: WebGL2RenderingContext, v: number): string {
  const map: Record<number, string> = {
    [gl.RGBA]:          "RGBA",
    [gl.RGB]:           "RGB",
    [gl.RED]:           "RED",
    [gl.RED_INTEGER]:   "RED_INTEGER",
    [gl.RGBA_INTEGER]:  "RGBA_INTEGER",
    [gl.UNSIGNED_BYTE]: "UNSIGNED_BYTE",
    [gl.UNSIGNED_SHORT]:"UNSIGNED_SHORT",
    [gl.UNSIGNED_INT]:  "UNSIGNED_INT",
    [gl.FLOAT]:         "FLOAT",
    // @ts-ignore — WebGL2 constants
    [gl.HALF_FLOAT ?? -1]:  "HALF_FLOAT",
    // @ts-ignore
    [gl.RGBA8   ?? -1]: "RGBA8",
    // @ts-ignore
    [gl.SRGB8_ALPHA8 ?? -1]: "SRGB8_ALPHA8",
    // @ts-ignore
    [gl.RGBA16F ?? -1]: "RGBA16F",
    // @ts-ignore
    [gl.RGBA32F ?? -1]: "RGBA32F",
    // @ts-ignore
    [gl.RGBA32UI ?? -1]: "RGBA32UI",
    // @ts-ignore
    [gl.RGBA16UI ?? -1]: "RGBA16UI",
    // @ts-ignore
    [gl.R32F    ?? -1]: "R32F",
    // @ts-ignore
    [gl.RG32F   ?? -1]: "RG32F",
    // @ts-ignore
    [gl.RG16UI  ?? -1]: "RG16UI",
  };
  return map[v] || "";
}

function toNumber(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Heat-map gradient (green → red) for utilisation %. Matches
 * the legacy panel exactly so users carry over their visual
 * intuition.
 */
function heatColor(t: number): string {
  const c = clamp01(t);
  const hue = 120 * (1 - c);
  return `hsl(${hue} 80% 45%)`;
}

/**
 * Rasterise a CPU-side occupancy preview of `tex` into `canvas`.
 * Each texel is rendered as one preview pixel — green where the
 * underlying CPU buffer holds non-zero data, dark where it
 * doesn't, with the unused-capacity region dimmed so the
 * "used vs spare" boundary is obvious at a glance.
 */
function renderTexturePreview(tex: any, canvas: HTMLCanvasElement, targetW: number): void {
  const w = Math.max(1, toNumber(tex?.width));
  const h = Math.max(1, toNumber(tex?.height));
  const ept = Math.max(1, toNumber(tex?.elementsPerTexel, 1));
  const buffer: any = tex?.buffer;

  const aspect = h / w;
  // The "10 *" multiplier (carried over from the legacy panel)
  // gives a taller-than-square strip so the layout is readable
  // at narrow widths.
  const targetH = 10 * Math.max(1, Math.round(targetW * aspect));

  const ctx = canvas.getContext("2d");
  canvas.width = targetW;
  canvas.height = targetH;

  if (!ctx || !buffer || typeof buffer.length !== "number" || w <= 0 || h <= 0) {
    if (ctx) {
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.font = "10px system-ui";
      ctx.fillText("n/a", 6, 14);
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.strokeRect(0.5, 0.5, targetW - 1, targetH - 1);
    }
    return;
  }

  const totalTexels = w * h;
  const usedTexels = Math.max(
    0,
    Math.min(totalTexels, toNumber(tex?.numItems) * toNumber(tex?.texelsPerItem, 1)),
  );

  const img = ctx.createImageData(targetW, targetH);
  const data = img.data;
  const abs = Math.abs;
  const eps = 1e-12;

  const occupied = (texelIndex: number): number => {
    const base = texelIndex * ept;
    for (let c = 0; c < ept; c++) {
      const v = Number(buffer[base + c] ?? 0);
      if (!Number.isFinite(v)) continue;
      if (abs(v) > eps) return 1;
    }
    return 0;
  };

  for (let py = 0; py < targetH; py++) {
    const yy = Math.floor((py / targetH) * h);
    for (let px = 0; px < targetW; px++) {
      const xx = Math.floor((px / targetW) * w);
      const texelIndex = yy * w + xx;
      const occ = occupied(texelIndex) === 1;

      let r = 0, g = 0, b = 0, a = 255;
      if (occ) {
        r = 0; g = 220; b = 255; a = 255;
      } else {
        r = 6; g = 6; b = 8;   a = 255;
      }
      if (texelIndex >= usedTexels) {
        r = Math.round(r * 0.18 + 10);
        g = Math.round(g * 0.18 + 10);
        b = Math.round(b * 0.18 + 12);
        a = 120;
      }
      const i = (py * targetW + px) * 4;
      data[i + 0] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Checkerboard behind so alpha-dimmed regions are readable.
  ctx.globalCompositeOperation = "destination-over";
  const s = 8;
  for (let y = 0; y < targetH; y += s) {
    for (let x = 0; x < targetW; x += s) {
      ctx.fillStyle = (x / s + y / s) % 2 === 0 ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.10)";
      ctx.fillRect(x, y, s, s);
    }
  }
  ctx.globalCompositeOperation = "source-over";

  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.strokeRect(0.5, 0.5, targetW - 1, targetH - 1);
}
