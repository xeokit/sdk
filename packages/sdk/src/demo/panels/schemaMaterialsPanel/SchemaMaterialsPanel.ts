/**
 * Floating, draggable panel that lets the user assign procedural
 * PBR materials to every {@link SceneModel} in a {@link Scene},
 * keyed by the matching {@link DataModel}'s schema and types.
 *
 * Modeled after {@link SceneHealthPanel}: one panel per Scene,
 * with a tab strip across the top listing every loaded
 * SceneModel and a status dot (applied / none / running / error /
 * unknown) so the user can see at a glance which models have
 * materials applied. Clicking a tab swaps the body to that
 * model's painter selections; per-model selection survives
 * focus changes. Apply, Reset and Remove all operate on the
 * currently-focused SceneModel.
 *
 * Live-syncs with `scene.events.onSceneModelCreated` /
 * `onSceneModelDestroyed` and `data.events.onDataModelCreated` /
 * `onDataModelDestroyed` so the tab strip stays in lockstep with
 * the live Scene + Data contents.
 *
 * Panel chrome (header / pill / drag / z-stacking) matches every
 * other floating panel — same singleton-stylesheet pattern, same
 * `getFor` / `openFor` registry idempotence keyed off the Scene,
 * same icon contract, same layout-persistence localStorage key.
 *
 * @module demo/schemaMaterialsPanel
 */
import type {Scene, SceneModel} from "../../../scene";
import type {Data, DataModel, DataObject} from "../../../data";
import {applyIFCMaterials} from "../../applyIFCMaterials/applyIFCMaterials";
import {removeAttachedMaterials} from "../../applyIFCMaterials/removeAttachedMaterials";
import {DEFAULT_IFC_PAINTERS} from "../../applyIFCMaterials/DEFAULT_IFC_PAINTERS";
import type {IfcPainterEntry} from "../../applyIFCMaterials/IfcPainterEntry";
import {MaterialsPalette} from "../../systems/materials/MaterialsPalette";
import type {PainterCatalogEntry} from "../../systems/materials/PainterCatalogEntry";


import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";
// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface SchemaMaterialsPanelParams {

  /**
   * Scene the panel is bound to. The panel manages every
   * {@link SceneModel} in this Scene; new SceneModels appear in
   * the tab strip automatically as they're created. Required
   * unless `focusSceneModel` is given (its `.scene` is used).
   */
  scene?: Scene;

  /**
   * Data graph containing the DataModels that pair with the
   * Scene's SceneModels. Looked up by id (`data.models[sceneModel.id]`).
   * Required unless `dataModel` is given (its `.data` is used).
   * SceneModels without a matching DataModel render an "unknown"
   * tab — the body explains that materials need a DataModel to
   * group types by schema.
   */
  data?: Data;

  /**
   * Optional initial focus. When supplied, the panel opens with
   * this SceneModel selected in the tab strip. Defaults to the
   * first alive SceneModel in the Scene.
   */
  focusSceneModel?: SceneModel;

  /**
   * Single-model legacy entry point — equivalent to passing
   * `scene = sceneModel.scene` and `focusSceneModel = sceneModel`.
   * Kept so existing single-model call sites don't need to change.
   */
  sceneModel?: SceneModel;

  /**
   * Single-model legacy entry point — equivalent to passing
   * `data = dataModel.data`. Kept so existing single-model call
   * sites don't need to change.
   */
  dataModel?: DataModel;

  /**
   * Catalog of painters offered in each row's dropdown. Defaults
   * to a freshly-constructed {@link MaterialsPalette} (every
   * applicable `procgen/paintMaterials` painter pre-registered).
   */
  palette?: MaterialsPalette;

  /**
   * Initial type → painterId assignments for the focused
   * SceneModel, applied to the dropdowns on first render
   * before the defaults derived from {@link DEFAULT_IFC_PAINTERS}.
   */
  initialAssignments?: Record<string, string>;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed
   * state. Defaults to `"xkt-smp-panel"`.
   */
  storageKey?: string;

  /** Show on construction (default `true`). */
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────
// Internal per-model state
// ─────────────────────────────────────────────────────────────────

/**
 * Per-SceneModel apply status reflected in the tab strip's dot.
 *
 * - `applied`  — `_attached_mat_*` materials are live in the SceneModel.
 * - `none`     — no `_attached_mat_*` materials present.
 * - `running`  — apply or remove is in flight.
 * - `error`    — the last apply / remove call failed.
 * - `unknown`  — the SceneModel has no matching DataModel; the
 *                panel can't paint by schema until one shows up.
 */
type ModelStatus = "applied" | "none" | "running" | "error" | "unknown";

interface ModelState {
  selection: Map<string, string>;
  status:    ModelStatus;
  lastError?: string;
}


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard for the whole page.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-smp-styles";
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
.xkt-smp-panel {
  position: fixed;
  top: 115px;
  left: 17px;
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
.xkt-smp-panel *, .xkt-smp-panel *::before, .xkt-smp-panel *::after {
  box-sizing: border-box;
}
.xkt-smp-panel[hidden] { display: none; }

.xkt-smp-panel .xkt-smp-header {
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
.xkt-smp-panel .xkt-smp-header.xkt-smp-dragging { cursor: grabbing; }
.xkt-smp-panel .xkt-smp-title {
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
.xkt-smp-panel .xkt-smp-title-icon {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
  width: 24px;
  height: 24px;
  color: #6b3aa0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.xkt-smp-panel .xkt-smp-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-smp-panel .xkt-smp-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-smp-panel .xkt-smp-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-smp-panel .xkt-smp-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
.xkt-smp-panel .xkt-smp-close {
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
.xkt-smp-panel .xkt-smp-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-smp-pill {
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
  background: #6b3aa0;
  border: 1px solid #4d287a;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.xkt-smp-pill:hover { background: #4d287a; }
.xkt-smp-pill[hidden] { display: none; }

/* Model tabs strip — one chip per loaded SceneModel, with a
   status dot reflecting the per-model apply state. Mirrors
   SceneHealthPanel's xkt-sh-tabs layout/colours, swapped to
   the SchemaMaterials purple accent on the active tab. */
.xkt-smp-panel .xkt-smp-tabs {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid #ececec;
  background: #fcfcfc;
  max-height: 110px;
  overflow-y: auto;
  scrollbar-width: thin;
}
.xkt-smp-panel .xkt-smp-tabs::-webkit-scrollbar       { width: 6px; }
.xkt-smp-panel .xkt-smp-tabs::-webkit-scrollbar-thumb { background: #d0d0d0; border-radius: 999px; }
.xkt-smp-panel .xkt-smp-tabs-empty {
  font-size: 11px;
  color: #888;
  font-style: italic;
  padding: 2px 4px;
}
.xkt-smp-panel .xkt-smp-tab {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  font: inherit;
  font-size: 11px;
  color: #333;
  background: #fff;
  border: 1px solid #d0d0d0;
  border-radius: 999px;
  cursor: pointer;
  transition: background 80ms ease-out, border-color 80ms ease-out, color 80ms ease-out;
}
.xkt-smp-panel .xkt-smp-tab:hover {
  background: #f5f0fa;
  border-color: #d0c5e0;
}
.xkt-smp-panel .xkt-smp-tab.xkt-smp-tab-active {
  background: #6b3aa0;
  border-color: #4d287a;
  color: #fff;
}
.xkt-smp-panel .xkt-smp-tab-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  max-width: 18ch;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-smp-panel .xkt-smp-tab-count {
  font-variant-numeric: tabular-nums;
  font-size: 10px;
  font-weight: 500;
  opacity: 0.75;
}

/* Status dot — at-a-glance apply state for each model. Filled
   green for applied, hollow grey for none, pulsing purple for
   running, filled red for error, transparent for unknown. */
.xkt-smp-panel .xkt-smp-tab-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #d0d0d0;
  border: 1px solid #b8b8b8;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.85);
}
.xkt-smp-panel .xkt-smp-tab-dot[data-status="applied"] { background: #2c8f55; border-color: #1c5a35; }
.xkt-smp-panel .xkt-smp-tab-dot[data-status="none"]    { background: #e6e6e6; border-color: #c8c8c8; }
.xkt-smp-panel .xkt-smp-tab-dot[data-status="running"] {
  background: transparent;
  border-color: #6b3aa0;
  animation: xkt-smp-tab-pulse 1s ease-in-out infinite;
}
.xkt-smp-panel .xkt-smp-tab-dot[data-status="error"]   { background: #c8332c; border-color: #8d231d; }
.xkt-smp-panel .xkt-smp-tab-dot[data-status="unknown"] { background: transparent; }
@keyframes xkt-smp-tab-pulse {
  0%, 100% { opacity: 0.35; }
  50%      { opacity: 1; }
}
.xkt-smp-panel .xkt-smp-tab-active .xkt-smp-tab-dot {
  box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.9);
}

/* Progress strip — sits between the tabs and the status banner;
   yellow when active, idle grey otherwise. */
.xkt-smp-panel .xkt-smp-progress {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  min-height: 32px;
  border-bottom: 1px solid #ececec;
  background: #fafafa;
  font-size: 11px;
  transition: background-color 150ms ease-out, border-color 150ms ease-out;
}
.xkt-smp-panel .xkt-smp-progress.xkt-smp-active {
  background: #fff8e1;
  border-bottom-color: #f0e3b0;
}
.xkt-smp-panel .xkt-smp-progress-label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #888;
  font-weight: 500;
  transition: color 150ms ease-out;
}
.xkt-smp-panel .xkt-smp-progress.xkt-smp-active .xkt-smp-progress-label { color: #6b5300; }
.xkt-smp-panel .xkt-smp-progress-bar {
  flex-shrink: 0;
  width: 110px;
  height: 8px;
  opacity: 0.4;
  transition: opacity 150ms ease-out;
}
.xkt-smp-panel .xkt-smp-progress.xkt-smp-active .xkt-smp-progress-bar { opacity: 1; }

.xkt-smp-panel.xkt-smp-busy .xkt-smp-tabs,
.xkt-smp-panel.xkt-smp-busy .xkt-smp-state,
.xkt-smp-panel.xkt-smp-busy .xkt-smp-stats,
.xkt-smp-panel.xkt-smp-busy .xkt-smp-body,
.xkt-smp-panel.xkt-smp-busy .xkt-smp-footer {
  pointer-events: none;
  opacity: 0.55;
  user-select: none;
}
.xkt-smp-panel.xkt-smp-busy .xkt-smp-progress { pointer-events: auto; }

/* Status banner — banner-style block above the stats, state-tinted
   to match the SceneHealthPanel health card. */
.xkt-smp-panel .xkt-smp-state {
  flex: 0 0 auto;
  padding: 12px 16px;
  border-bottom: 1px solid #ececec;
  background: #fafafa;
}
.xkt-smp-panel .xkt-smp-state[data-state="applied"] { background: #f0f8f0; border-bottom-color: #cfe4cf; }
.xkt-smp-panel .xkt-smp-state[data-state="none"]    { background: #fafafa; border-bottom-color: #ececec; }
.xkt-smp-panel .xkt-smp-state[data-state="busy"]    { background: #f4eef9; border-bottom-color: #dccfe9; }
.xkt-smp-panel .xkt-smp-state[data-state="error"]   { background: #fdf3f3; border-bottom-color: #f3d7d7; }
.xkt-smp-panel .xkt-smp-state[data-state="unknown"] { background: #fafafa; border-bottom-color: #ececec; }
.xkt-smp-panel .xkt-smp-state-row1 {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.xkt-smp-panel .xkt-smp-state-status {
  flex: 1;
  font-size: 16px;
  font-weight: 650;
  color: #111;
  letter-spacing: -0.2px;
}
.xkt-smp-panel .xkt-smp-state[data-state="applied"] .xkt-smp-state-status { color: #1f7a1f; }
.xkt-smp-panel .xkt-smp-state[data-state="none"]    .xkt-smp-state-status { color: #555;    }
.xkt-smp-panel .xkt-smp-state[data-state="busy"]    .xkt-smp-state-status { color: #6b3aa0; }
.xkt-smp-panel .xkt-smp-state[data-state="error"]   .xkt-smp-state-status { color: #a02020; }
.xkt-smp-panel .xkt-smp-state[data-state="unknown"] .xkt-smp-state-status { color: #555;    }
.xkt-smp-panel .xkt-smp-state-detail {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  font-variant-numeric: tabular-nums;
}
.xkt-smp-panel .xkt-smp-state-rec {
  margin-top: 4px;
  font-size: 11.5px;
  color: #555;
  line-height: 1.4;
}
.xkt-smp-panel .xkt-smp-state-rec:empty { display: none; }

/* Stats grid — schemas / types / objects / selections / applied. */
.xkt-smp-panel .xkt-smp-stats {
  flex: 0 0 auto;
  padding: 8px 12px 10px;
  border-bottom: 1px solid #ececec;
  background: #fcfcfc;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px 14px;
}
.xkt-smp-panel .xkt-smp-stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 11px;
  min-width: 0;
}
.xkt-smp-panel .xkt-smp-stat-label {
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
.xkt-smp-panel .xkt-smp-stat-value {
  flex-shrink: 0;
  color: #111;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.xkt-smp-panel .xkt-smp-stat-value.xkt-smp-zero { color: #aaa; font-weight: 400; }

.xkt-smp-panel .xkt-smp-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px 12px 4px;
}
.xkt-smp-panel .xkt-smp-empty {
  padding: 24px 12px;
  text-align: center;
  color: #777;
  font-size: 12px;
}

/* Schema section block. */
.xkt-smp-panel .xkt-smp-section {
  margin: 6px 0;
  background: #fff;
  border: 1px solid #ececec;
  border-left: 3px solid #6b3aa0;
  border-radius: 6px;
  overflow: hidden;
}
.xkt-smp-panel .xkt-smp-section > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  user-select: none;
}
.xkt-smp-panel .xkt-smp-section > summary::-webkit-details-marker { display: none; }
.xkt-smp-panel .xkt-smp-section > summary::marker                  { display: none; }
.xkt-smp-panel .xkt-smp-section > summary::before {
  content: "›";
  display: inline-block;
  transform: rotate(0deg);
  transition: transform 120ms ease-out;
  color: #888;
  font-size: 12px;
}
.xkt-smp-panel .xkt-smp-section[open] > summary::before { transform: rotate(90deg); }
.xkt-smp-panel .xkt-smp-section > summary:hover { background: #fafafa; }
.xkt-smp-panel .xkt-smp-section-label {
  flex: 1;
  font-size: 12px;
  font-weight: 650;
  color: #6b3aa0;
  letter-spacing: -0.1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-smp-panel .xkt-smp-section-count {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  font-variant-numeric: tabular-nums;
}
.xkt-smp-panel .xkt-smp-section > .xkt-smp-section-body {
  padding: 4px 8px 8px;
  border-top: 1px solid #f4f4f4;
  background: #fcfcfc;
}

/* Per-type row. */
.xkt-smp-panel .xkt-smp-row {
  display: grid;
  grid-template-columns: 14px 1fr auto 150px;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  border-radius: 4px;
}
.xkt-smp-panel .xkt-smp-row:hover { background: #f5f0fa; }
.xkt-smp-panel .xkt-smp-swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 1px solid #d0c5e0;
  background: #f0f0f0;
}
.xkt-smp-panel .xkt-smp-type {
  font-size: 11.5px;
  color: #222;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-smp-panel .xkt-smp-count {
  font-size: 10.5px;
  font-weight: 600;
  color: #777;
  font-variant-numeric: tabular-nums;
}
.xkt-smp-panel .xkt-smp-select {
  width: 100%;
  font: inherit;
  font-size: 11px;
  padding: 3px 6px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: #fff;
  color: #222;
  cursor: pointer;
}
.xkt-smp-panel .xkt-smp-select:focus {
  outline: none;
  border-color: #6b3aa0;
  box-shadow: 0 0 0 2px rgba(107, 58, 160, 0.15);
}

/* Footer — apply / reset / status. */
.xkt-smp-panel .xkt-smp-footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid #ececec;
  background: #fafafa;
}
.xkt-smp-panel .xkt-smp-status {
  flex: 1;
  font-size: 11px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-smp-panel .xkt-smp-status.xkt-smp-status-error { color: #b73d3d; }
.xkt-smp-panel .xkt-smp-status.xkt-smp-status-ok    { color: #2c7e6f; }
.xkt-smp-panel .xkt-smp-btn {
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
.xkt-smp-panel .xkt-smp-btn:hover { background: #f0f0f0; }
.xkt-smp-panel .xkt-smp-btn-primary {
  background: #6b3aa0;
  border-color: #4d287a;
  color: #fff;
}
.xkt-smp-panel .xkt-smp-btn-primary:hover { background: #4d287a; }
.xkt-smp-panel .xkt-smp-btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

export class SchemaMaterialsPanel extends FloatingPanelBase {

  /**
   * Per-Scene instance registry. One panel per Scene; the registry
   * gates {@link openFor} idempotence so the right-click menu can
   * be wired into any example without each example having to
   * track its own panel reference.
   */
  private static readonly _instances = new WeakMap<Scene, SchemaMaterialsPanel>();

  /**
   * SVG markup for the panel's title-bar glyph (a 3×3 colour-grid
   * evoking a material palette). Strokes use `currentColor`.
   * Single source of truth — shared by `_buildDom` and any
   * external caller (e.g. `ViewObjectContextMenu`).
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="3.5" y="3.5" width="17" height="17" rx="2.5" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<rect x="6"   y="6"   width="4" height="4" rx="0.6" fill="currentColor" opacity="0.85"/>` +
      `<rect x="11"  y="6"   width="4" height="4" rx="0.6" fill="currentColor" opacity="0.55"/>` +
      `<rect x="16"  y="6"   width="2" height="4" rx="0.6" fill="currentColor" opacity="0.30"/>` +
      `<rect x="6"   y="11"  width="4" height="4" rx="0.6" fill="currentColor" opacity="0.55"/>` +
      `<rect x="11"  y="11"  width="4" height="4" rx="0.6" fill="currentColor" opacity="0.30"/>` +
      `<rect x="16"  y="11"  width="2" height="4" rx="0.6" fill="currentColor" opacity="0.85"/>` +
      `<rect x="6"   y="16"  width="4" height="2" rx="0.6" fill="currentColor" opacity="0.30"/>` +
      `<rect x="11"  y="16"  width="4" height="2" rx="0.6" fill="currentColor" opacity="0.85"/>` +
      `<rect x="16"  y="16"  width="2" height="2" rx="0.6" fill="currentColor" opacity="0.55"/>` +
    `</svg>`;
  }

  /**
   * Returns the existing live panel bound to a Scene, or
   * `undefined` if none has been constructed. Accepts either a
   * `Scene` directly or a `SceneModel` (its `.scene` is used) for
   * symmetry with {@link SceneHealthPanel.getFor}.
   */
  static getFor(target: Scene | SceneModel): SchemaMaterialsPanel | undefined {
    const scene = (target as any).scene ?? target;
    const inst = SchemaMaterialsPanel._instances.get(scene as Scene);
    return inst && !inst._destroyed ? inst : undefined;
  }

  /**
   * Reveal (or lazily mount) a panel for the target Scene.
   * Idempotent — if a panel already exists for this Scene and is
   * still alive, it's brought back to the foreground (and focus
   * switches to `focusSceneModel` if supplied); otherwise a fresh
   * panel is constructed.
   */
  static openFor(params: SchemaMaterialsPanelParams): SchemaMaterialsPanel {
    const focus = params.focusSceneModel ?? params.sceneModel;
    const scene = params.scene ?? (focus ? focus.scene : undefined);
    if (!scene) {
      throw new Error("SchemaMaterialsPanel.openFor: scene or focusSceneModel is required");
    }
    let inst = SchemaMaterialsPanel._instances.get(scene);
    if (inst && !inst._destroyed) {
      inst.show();
      if (focus && inst.sceneModel !== focus) inst.focusModel(focus);
      return inst;
    }
    inst = new SchemaMaterialsPanel(params);
    return inst;
  }

  readonly scene: Scene;
  readonly data: Data | undefined;
  readonly palette: MaterialsPalette;
  sceneModel: SceneModel | undefined;

  // DOM refs.
  private _modelTabsEl!: HTMLElement;
  private _bodyEl!: HTMLElement;
  private _progressEl!: HTMLElement;
  private _progressLabel!: HTMLElement;
  private _progressBar!: HTMLProgressElement;
  private _stateCard!: HTMLElement;
  private _stateStatus!: HTMLElement;
  private _stateDetail!: HTMLElement;
  private _stateRec!: HTMLElement;
  private _statsEl!: HTMLElement;
  private _statusEl!: HTMLElement;
  private _applyBtn!: HTMLButtonElement;
  private _resetBtn!: HTMLButtonElement;
  private _removeBtn!: HTMLButtonElement;

  /**
   * Per-SceneModel state, keyed by SceneModel id (so a destroyed
   * model leaves its entry behind — cheap; cleaned on
   * `onSceneModelDestroyed` to avoid stale state if a re-load
   * with the same id arrives).
   */
  private readonly _modelStates = new Map<string, ModelState>();

  /**
   * Per-type `<select>` element for the *currently focused*
   * SceneModel — rebuilt on focus changes. Lets the **Reset**
   * button re-sync the dropdowns to a freshly-cleared selection
   * without rebuilding the body.
   */
  private readonly _selectEls = new Map<string, HTMLSelectElement>();

  // Lifecycle state.
  private _busy = false;

  // Live-sync handles.
  private readonly _unsubs: Array<() => void> = [];
  private _refreshScheduled = false;

  // Drag state.

  constructor(params: SchemaMaterialsPanelParams) {
    if (!params) {
      throw new Error("SchemaMaterialsPanel: params required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-smp-panel",
      classPrefix: "xkt-smp",
    });
    const focus = params.focusSceneModel ?? params.sceneModel;
    const scene = params.scene ?? (focus ? focus.scene : undefined);
    if (!scene) {
      throw new Error("SchemaMaterialsPanel: scene or focusSceneModel is required");
    }
    this.scene = scene;
    this.data = params.data ?? params.dataModel?.data;
    this.palette    = params.palette || new MaterialsPalette();

    // Replace any prior panel bound to the same Scene.
    const prior = SchemaMaterialsPanel._instances.get(scene);
    if (prior && !prior._destroyed) prior.destroy();
    SchemaMaterialsPanel._instances.set(scene, this);

    // Pick an initial focus: explicit if alive, else the first
    // alive SceneModel in the Scene (panel renders an empty state
    // until the first model arrives via onSceneModelCreated).
    const initial = (focus && !focus.destroyed) ? focus : firstAliveSceneModel(scene);
    if (initial) this.sceneModel = initial;

    // Seed the focused model's selection from defaults / overrides.
    if (this.sceneModel) {
      this._ensureModelState(this.sceneModel);
      if (params.initialAssignments) {
        const state = this._modelStates.get(String(this.sceneModel.id))!;
        for (const k of Object.keys(params.initialAssignments)) {
          state.selection.set(k, params.initialAssignments[k]);
        }
      }
    }

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();
    this._wireDomEvents();
    this._renderTabs();
    this._renderFocus();

    this._attachLiveSync();

    if (params.visible === false) {
      this.hide();
    } else {
      this.show();
    }
  }


  // ── Public lifecycle ──────────────────────────────────────────

  /** Currently-focused {@link DataModel}, derived from the
   *  Data graph by id of the focused SceneModel. `undefined`
   *  when no SceneModel is focused or no DataModel exists yet
   *  for the focused SceneModel's id. */
  get dataModel(): DataModel | undefined {
    if (!this.sceneModel || !this.data) return undefined;
    return this.data.models[String(this.sceneModel.id)];
  }

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
    if (SchemaMaterialsPanel._instances.get(this.scene) === this) {
      SchemaMaterialsPanel._instances.delete(this.scene);
    }
    this._detachLiveSync();
    super.destroy();
  }

  /**
   * Switch the panel's focused SceneModel — repaints the tab
   * strip and rebuilds the body for the new model. Cheap when
   * the requested model matches the current focus (no-op).
   */
  focusModel(sceneModel: SceneModel): void {
    if (this._destroyed) return;
    if (sceneModel.scene !== this.scene) {
      console.warn("[SchemaMaterialsPanel.focusModel] SceneModel belongs to a different Scene; ignored");
      return;
    }
    if (this.sceneModel === sceneModel) return;
    this.sceneModel = sceneModel;
    this._ensureModelState(sceneModel);
    this._renderTabs();
    this._renderFocus();
  }


  // ── Apply / Reset / Remove ────────────────────────────────────

  /**
   * Walks the focused SceneModel's selection map, resolves each
   * picked painter id to its catalog entry, and calls
   * {@link applyIFCMaterials} with the resulting type → entry
   * map. Types whose row is left at "(default)" are omitted from
   * the override map so the SDK's default IFC painter (or
   * fallback) still applies for them.
   */
  async apply(): Promise<void> {
    const sm = this.sceneModel;
    const dm = this.dataModel;
    if (!sm || !dm) {
      this._setStatus("No DataModel available for this SceneModel.", "error");
      return;
    }

    const state = this._ensureModelState(sm);
    const painters: Record<string, IfcPainterEntry> = {};
    for (const [type, painterId] of state.selection.entries()) {
      if (!painterId) continue;
      const entry = this.palette.getEntry(painterId);
      if (!entry) continue;
      painters[type] = catalogEntryToIfcPainter(entry);
    }

    state.status = "running";
    state.lastError = undefined;
    this._setStatus("Applying materials…", "neutral");
    this._setActionsDisabled(true);
    this._renderState({state: "busy", status: "Applying materials…"});
    this._showProgress("Applying materials…", 0, 0);
    this._renderTabs();

    try {
      const result = await applyIFCMaterials({
        sceneModel: sm,
        dataModel:  dm,
        painters,
        onProgress: (p) => {
          this._showProgress(p.phase, p.current, p.total);
        },
      });
      if (result.ok === false) {
        state.status = "error";
        state.lastError = result.error;
        this._setStatus(`Apply failed: ${result.error}`, "error");
        this._renderState({state: "error", status: "Apply failed", rec: result.error});
      } else {
        state.status = countAttachedMaterials(sm) > 0 ? "applied" : "none";
        this._setStatus("Materials applied.", "ok");
        this._renderState();
      }
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      state.status = "error";
      state.lastError = msg;
      this._setStatus(`Apply failed: ${msg}`, "error");
      this._renderState({state: "error", status: "Apply failed", rec: msg});
    } finally {
      this._hideProgress();
      this._setActionsDisabled(false);
      this._renderTabs();
    }
  }

  /**
   * Strip every `_attached_*` material and texture from the
   * focused SceneModel and rebuild affected meshes with their
   * original per-mesh `color`.
   */
  async remove(): Promise<void> {
    const sm = this.sceneModel;
    if (!sm) return;
    const state = this._ensureModelState(sm);

    state.status = "running";
    state.lastError = undefined;
    this._setStatus("Removing materials…", "neutral");
    this._setActionsDisabled(true);
    this._renderState({state: "busy", status: "Removing materials…"});
    this._showProgress("Removing materials…", 0, 0);
    this._renderTabs();

    try {
      const result = await removeAttachedMaterials({
        sceneModel: sm,
        onProgress: (p) => {
          this._showProgress(p.phase, p.current, p.total);
        },
      });
      if (result.ok === false) {
        state.status = "error";
        state.lastError = result.error;
        this._setStatus(`Remove failed: ${result.error}`, "error");
        this._renderState({state: "error", status: "Remove failed", rec: result.error});
      } else {
        state.status = countAttachedMaterials(sm) > 0 ? "applied" : "none";
        this._setStatus("Materials removed.", "ok");
        this._renderState();
      }
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      state.status = "error";
      state.lastError = msg;
      this._setStatus(`Remove failed: ${msg}`, "error");
      this._renderState({state: "error", status: "Remove failed", rec: msg});
    } finally {
      this._hideProgress();
      this._setActionsDisabled(false);
      this._renderTabs();
    }
  }

  /**
   * Clear every per-type painter selection on the focused
   * SceneModel and re-sync the dropdowns. Doesn't mutate the
   * SceneModel — the user must click **Apply** to actually un-do
   * what they last applied.
   */
  reset(): void {
    if (!this.sceneModel) return;
    const state = this._ensureModelState(this.sceneModel);
    state.selection.clear();
    this._seedDefaultSelection(state.selection);
    for (const [type, sel] of this._selectEls.entries()) {
      sel.value = state.selection.get(type) || "";
      this._refreshRowSwatch(type);
    }
    this._setStatus("Selection reset to defaults.", "neutral");
    this._renderState();
  }

  private _setActionsDisabled(disabled: boolean): void {
    this._busy = disabled;
    this._applyBtn.disabled  = disabled;
    this._resetBtn.disabled  = disabled;
    this._removeBtn.disabled = disabled;
    if (disabled) this._panel.classList.add("xkt-smp-busy");
    else          this._panel.classList.remove("xkt-smp-busy");
  }


  // ── Progress strip ────────────────────────────────────────────

  private _showProgress(label: string, current: number, total: number): void {
    this._progressEl.classList.add("xkt-smp-active");
    this._progressLabel.textContent = label;
    if (total <= 0) {
      this._progressBar.removeAttribute("value");
    } else {
      this._progressBar.max   = total;
      this._progressBar.value = current;
    }
  }

  private _hideProgress(): void {
    this._progressEl.classList.remove("xkt-smp-active");
    this._progressLabel.textContent = "Ready";
    this._progressBar.max = 1;
    this._progressBar.value = 0;
  }


  // ── Selection seeding ─────────────────────────────────────────

  /**
   * Pick a sensible default painter id per type by reverse-mapping
   * each {@link DEFAULT_IFC_PAINTERS} entry's `paint` callable
   * against the palette catalog.
   */
  private _seedDefaultSelection(selection: Map<string, string>): void {
    const paintToId = new Map<unknown, string>();
    for (const entry of this.palette.catalog) {
      if (!paintToId.has(entry.paint)) {
        paintToId.set(entry.paint, entry.id);
      }
    }
    for (const [ifcType, ifcEntry] of Object.entries(DEFAULT_IFC_PAINTERS)) {
      const matchedPainterId = paintToId.get(ifcEntry.paint);
      if (matchedPainterId && !selection.has(ifcType)) {
        selection.set(ifcType, matchedPainterId);
      }
    }
  }

  /**
   * Lazy-creates the per-model state entry, seeding the selection
   * from defaults and probing the SceneModel for its current
   * apply state. Idempotent; cached after first call.
   */
  private _ensureModelState(sm: SceneModel): ModelState {
    const id = String(sm.id);
    let state = this._modelStates.get(id);
    if (!state) {
      const selection = new Map<string, string>();
      this._seedDefaultSelection(selection);
      const dm = this.data?.models[id];
      const status: ModelStatus = !dm
        ? "unknown"
        : countAttachedMaterials(sm) > 0 ? "applied" : "none";
      state = {selection, status};
      this._modelStates.set(id, state);
    } else if (state.status !== "running" && state.status !== "error") {
      // Refresh the cached status against live model state — the
      // user might have applied / removed via another code path.
      const dm = this.data?.models[id];
      state.status = !dm
        ? "unknown"
        : countAttachedMaterials(sm) > 0 ? "applied" : "none";
    }
    return state;
  }


  // ── Live-sync to scene + data ─────────────────────────────────

  private _attachLiveSync(): void {
    const sceneEv: any = (this.scene as any).events;
    const dataEv:  any = this.data ? (this.data as any).events : null;
    const sub = (unsub: () => void) => this._unsubs.push(unsub);
    if (sceneEv?.onSceneModelCreated?.subscribe) {
      sub(sceneEv.onSceneModelCreated.subscribe(() => this._scheduleRefresh()));
    }
    if (sceneEv?.onSceneModelDestroyed?.subscribe) {
      sub(sceneEv.onSceneModelDestroyed.subscribe((_s: any, sm: SceneModel) => {
        this._scheduleRefresh(sm);
      }));
    }
    if (dataEv?.onDataModelCreated?.subscribe) {
      sub(dataEv.onDataModelCreated.subscribe(() => this._scheduleRefresh()));
    }
    if (dataEv?.onDataModelDestroyed?.subscribe) {
      sub(dataEv.onDataModelDestroyed.subscribe(() => this._scheduleRefresh()));
    }
  }

  private _detachLiveSync(): void {
    for (const u of this._unsubs) {
      try { u(); } catch { /* ignore */ }
    }
    this._unsubs.length = 0;
    this._refreshScheduled = false;
  }

  /**
   * Coalesce per-model create/destroy events into one repaint per
   * frame. When the focused SceneModel is the one being destroyed,
   * fall back to the first surviving SceneModel so the body
   * doesn't render against a stale reference.
   */
  private _scheduleRefresh(destroyed?: SceneModel): void {
    if (this._destroyed) return;
    if (destroyed) {
      this._modelStates.delete(String(destroyed.id));
    }
    if (destroyed && this.sceneModel === destroyed) {
      const next = firstAliveSceneModel(this.scene, destroyed);
      if (next) {
        this.focusModel(next);
        return;
      }
      this.sceneModel = undefined;
    }
    if (this._refreshScheduled) return;
    this._refreshScheduled = true;
    requestAnimationFrame(() => {
      this._refreshScheduled = false;
      if (this._destroyed) return;
      // Pick up a newly-arrived model when no focus is set.
      if (!this.sceneModel) {
        const next = firstAliveSceneModel(this.scene);
        if (next) {
          this.focusModel(next);
          return;
        }
      }
      this._renderTabs();
      // The focused model's DataModel may have just landed —
      // rebuild the body so type rows show up.
      this._renderFocus();
    });
  }


  // ── Tab strip ─────────────────────────────────────────────────

  private _renderTabs(): void {
    if (!this._modelTabsEl) return;
    this._modelTabsEl.innerHTML = "";

    const models = listAliveSceneModels(this.scene);
    if (models.length === 0) {
      this._modelTabsEl.appendChild(el("div", "xkt-smp-tabs-empty", {
        textContent: "No SceneModels loaded",
      }));
      return;
    }

    // Disambiguate same-display-id tabs with a "(2)", "(3)" suffix.
    const labelCounts = new Map<string, number>();

    for (const sm of models) {
      const fullId = String(sm.id);
      const baseLabel = displaySceneModelId(fullId);
      const seen = (labelCounts.get(baseLabel) ?? 0) + 1;
      labelCounts.set(baseLabel, seen);
      const label = seen === 1 ? baseLabel : `${baseLabel} (${seen})`;

      const state = this._ensureModelState(sm);

      const tab = el("button", "xkt-smp-tab", {
        type:  "button",
        title: tabTooltip(fullId, state),
      }) as HTMLButtonElement;
      tab.setAttribute("data-status", state.status);
      if (sm === this.sceneModel) tab.classList.add("xkt-smp-tab-active");

      const dot = el("span", "xkt-smp-tab-dot");
      dot.setAttribute("data-status", state.status);
      tab.appendChild(dot);

      tab.appendChild(el("span", "xkt-smp-tab-id", {textContent: label}));

      const stats: any = (sm as any).stats;
      const objs = stats && Number.isFinite(stats.numObjects) ? stats.numObjects : null;
      if (objs !== null) {
        tab.appendChild(el("span", "xkt-smp-tab-count", {
          textContent: `${objs.toLocaleString()} objs`,
        }));
      }

      tab.addEventListener("click", () => this.focusModel(sm));
      this._modelTabsEl.appendChild(tab);
    }
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-smp-pill", {
      type: "button",
      title: "Reopen the Schema Materials panel",
      hidden: true,
      textContent: "Schema Materials",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-smp-panel");

    // Header.
    this._header = el("div", "xkt-smp-header");
    const title = el("h2", "xkt-smp-title");
    title.innerHTML =
      `<span class="xkt-smp-title-icon">${SchemaMaterialsPanel.iconSvg()}</span>` +
      `<span class="xkt-smp-title-stack">` +
        `<span class="xkt-smp-title-text">Schema Materials</span>` +
        `<span class="xkt-smp-subtitle">Schema-code to material map.</span>` +
      `</span>`;
    this._closeBtn = el("button", "xkt-smp-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;

    this._header.append(title, this._closeBtn);
    this._panel.appendChild(this._header);

    // Model tabs strip.
    this._modelTabsEl = el("div", "xkt-smp-tabs");
    this._panel.appendChild(this._modelTabsEl);

    // Progress strip.
    this._progressEl = el("div", "xkt-smp-progress");
    this._progressLabel = el("div", "xkt-smp-progress-label", {textContent: "Ready"});
    this._progressBar = el("progress", "xkt-smp-progress-bar") as HTMLProgressElement;
    this._progressBar.max = 1;
    this._progressBar.value = 0;
    this._progressEl.append(this._progressLabel, this._progressBar);
    this._panel.appendChild(this._progressEl);

    // Status banner.
    this._stateCard = el("div", "xkt-smp-state");
    this._stateCard.setAttribute("data-state", "none");
    const stateRow1 = el("div", "xkt-smp-state-row1");
    this._stateStatus = el("div", "xkt-smp-state-status", {textContent: "No materials applied"});
    this._stateDetail = el("div", "xkt-smp-state-detail");
    stateRow1.append(this._stateStatus, this._stateDetail);
    this._stateRec = el("div", "xkt-smp-state-rec");
    this._stateCard.append(stateRow1, this._stateRec);
    this._panel.appendChild(this._stateCard);

    // Stats grid.
    this._statsEl = el("div", "xkt-smp-stats");
    this._panel.appendChild(this._statsEl);

    // Body.
    this._bodyEl = el("div", "xkt-smp-body");
    this._panel.appendChild(this._bodyEl);

    // Footer.
    const footer = el("div", "xkt-smp-footer");
    this._statusEl = el("div", "xkt-smp-status", {textContent: ""});
    this._removeBtn = el("button", "xkt-smp-btn", {
      type: "button",
      textContent: "Remove",
      title: "Strip applied materials and restore the meshes' original colours",
    }) as HTMLButtonElement;
    this._resetBtn = el("button", "xkt-smp-btn", {
      type: "button",
      textContent: "Reset",
      title: "Restore default painter selections",
    }) as HTMLButtonElement;
    this._applyBtn = el("button", "xkt-smp-btn xkt-smp-btn-primary", {
      type: "button",
      textContent: "Apply",
      title: "Apply painters to the focused SceneModel",
    }) as HTMLButtonElement;
    footer.append(this._statusEl, this._removeBtn, this._resetBtn, this._applyBtn);
    this._panel.appendChild(footer);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }

  private _wireDomEvents(): void {
    this._applyBtn.addEventListener("click", () => this.apply());
    this._resetBtn.addEventListener("click", () => this.reset());
    this._removeBtn.addEventListener("click", () => this.remove());
  }


  // ── Layout persistence ────────────────────────────────────────



  // ── Focus rendering ───────────────────────────────────────────

  /**
   * Refresh the body + state + stats for the currently-focused
   * SceneModel. Called on focus change, on `_scheduleRefresh`, and
   * after apply / reset / remove.
   */
  private _renderFocus(): void {
    this._renderBody();
    this._renderState();
  }

  private _renderBody(): void {
    this._bodyEl.innerHTML = "";
    this._selectEls.clear();

    const sm = this.sceneModel;
    if (!sm) {
      this._bodyEl.appendChild(el("div", "xkt-smp-empty", {
        textContent: "No SceneModel loaded.",
      }));
      return;
    }
    const dm = this.dataModel;
    if (!dm) {
      this._bodyEl.appendChild(el("div", "xkt-smp-empty", {
        textContent:
          "This SceneModel has no matching DataModel — Schema Materials needs DataObjects to group by schema and type.",
      }));
      return;
    }

    const grouped = groupTypesBySchema(dm);
    const schemaNames = Object.keys(grouped).sort(schemaOrder);
    if (schemaNames.length === 0) {
      this._bodyEl.appendChild(el("div", "xkt-smp-empty", {
        textContent: "DataModel has no objects.",
      }));
      return;
    }

    const state = this._ensureModelState(sm);
    for (const schema of schemaNames) {
      const types = grouped[schema];
      const typeNames = Object.keys(types).sort();

      const section = el("details", "xkt-smp-section") as HTMLDetailsElement;
      section.open = true;
      const summary = el("summary");
      const label = el("span", "xkt-smp-section-label", {textContent: schema});
      const totalObjects = typeNames.reduce((acc, t) => acc + types[t], 0);
      const count = el("span", "xkt-smp-section-count", {
        textContent: `${typeNames.length} types · ${formatNumber(totalObjects)} objects`,
      });
      summary.append(label, count);
      section.appendChild(summary);

      const body = el("div", "xkt-smp-section-body");
      for (const type of typeNames) {
        body.appendChild(this._buildRow(type, types[type], state));
      }
      section.appendChild(body);
      this._bodyEl.appendChild(section);
    }
  }

  private _buildRow(type: string, count: number, state: ModelState): HTMLElement {
    const row = el("div", "xkt-smp-row");

    const swatch = el("span", "xkt-smp-swatch");
    const typeEl = el("span", "xkt-smp-type", {
      textContent: type,
      title: type,
    });
    const countEl = el("span", "xkt-smp-count", {
      textContent: formatNumber(count),
    });

    const select = el("select", "xkt-smp-select") as HTMLSelectElement;
    select.appendChild(optionEl("", "(default)"));
    const byCategory = groupByCategory(this.palette.catalog);
    const cats = Object.keys(byCategory);
    for (const cat of cats) {
      const grp = document.createElement("optgroup");
      grp.label = cat;
      for (const entry of byCategory[cat]) {
        grp.appendChild(optionEl(entry.id, entry.label));
      }
      select.appendChild(grp);
    }
    select.value = state.selection.get(type) || "";

    select.addEventListener("change", () => {
      const v = select.value;
      if (v) state.selection.set(type, v);
      else   state.selection.delete(type);
      this._refreshRowSwatch(type);
      this._renderState();
    });

    row.append(swatch, typeEl, countEl, select);
    this._selectEls.set(type, select);
    this._paintSwatch(swatch, state.selection.get(type) || "");
    return row;
  }

  private _refreshRowSwatch(type: string): void {
    const sel = this._selectEls.get(type);
    if (!sel) return;
    const swatch = sel.parentElement?.querySelector(".xkt-smp-swatch") as HTMLElement | null;
    if (!swatch) return;
    const sm = this.sceneModel;
    if (!sm) return;
    const state = this._ensureModelState(sm);
    this._paintSwatch(swatch, state.selection.get(type) || "");
  }

  private _paintSwatch(swatchEl: HTMLElement, painterId: string): void {
    if (!painterId) {
      swatchEl.style.background = "#f0f0f0";
      swatchEl.style.borderColor = "#d0c5e0";
      return;
    }
    const entry = this.palette.getEntry(painterId);
    if (!entry) {
      swatchEl.style.background = "#f0f0f0";
      return;
    }
    swatchEl.style.background = swatchColorForCategory(entry.category);
    swatchEl.style.borderColor = "rgba(0,0,0,0.15)";
  }


  // ── Status helper ─────────────────────────────────────────────

  private _setStatus(text: string, kind: "ok" | "error" | "neutral"): void {
    this._statusEl.textContent = text;
    this._statusEl.classList.remove("xkt-smp-status-ok", "xkt-smp-status-error");
    if (kind === "ok")    this._statusEl.classList.add("xkt-smp-status-ok");
    if (kind === "error") this._statusEl.classList.add("xkt-smp-status-error");
  }


  // ── State + stats rendering ───────────────────────────────────

  /**
   * Repaint the status banner + stats grid from the live state of
   * the focused SceneModel and its selection map. Cheap — runs on
   * dropdown change, after apply / remove / reset, and after
   * focusModel().
   */
  private _renderState(override?: {
    state:  "applied" | "none" | "busy" | "error" | "unknown";
    status: string;
    rec?:   string;
  }): void {
    const sm = this.sceneModel;
    const dm = this.dataModel;

    const grouped = dm ? groupTypesBySchema(dm) : {};
    const numSchemas = Object.keys(grouped).length;
    let numTypes   = 0;
    let numObjects = 0;
    for (const schema of Object.keys(grouped)) {
      const types = grouped[schema];
      for (const type of Object.keys(types)) {
        numTypes++;
        numObjects += types[type];
      }
    }
    const state = sm ? this._ensureModelState(sm) : undefined;
    const numSelections = state?.selection.size ?? 0;
    const numApplied = sm ? countAttachedMaterials(sm) : 0;

    if (override) {
      this._stateCard.setAttribute("data-state", override.state);
      this._stateStatus.textContent = override.status;
      this._stateRec.textContent    = override.rec || "";
    } else if (!sm) {
      this._stateCard.setAttribute("data-state", "none");
      this._stateStatus.textContent = "No SceneModel focused";
      this._stateRec.textContent    = "Pick a model from the tab strip above.";
    } else if (!dm) {
      this._stateCard.setAttribute("data-state", "unknown");
      this._stateStatus.textContent = "No DataModel for this SceneModel";
      this._stateRec.textContent    = "Schema Materials needs a DataModel keyed by the SceneModel's id.";
    } else if (state?.status === "error") {
      this._stateCard.setAttribute("data-state", "error");
      this._stateStatus.textContent = "Last apply failed";
      this._stateRec.textContent    = state.lastError || "";
    } else if (numApplied > 0) {
      this._stateCard.setAttribute("data-state", "applied");
      this._stateStatus.textContent = "Materials applied";
      this._stateRec.textContent    = "Pick a different painter and click Apply to repaint, or Remove to restore the loaded colours.";
    } else {
      this._stateCard.setAttribute("data-state", "none");
      this._stateStatus.textContent = "No materials applied";
      this._stateRec.textContent    = numSelections > 0
        ? "Click Apply to repaint the SceneModel with the selected painters."
        : "Pick a painter for one or more types, then click Apply.";
    }
    this._stateDetail.textContent = numApplied > 0
      ? `${formatNumber(numApplied)} ${numApplied === 1 ? "material" : "materials"}`
      : "";

    const stats: Array<[string, number]> = [
      ["Schemas",    numSchemas],
      ["Types",      numTypes],
      ["Objects",    numObjects],
      ["Selections", numSelections],
      ["Applied",    numApplied],
    ];
    let html = "";
    for (const [label, n] of stats) {
      html +=
        `<div class="xkt-smp-stat">` +
          `<span class="xkt-smp-stat-label">${escapeHtml(label)}</span>` +
          `<span class="xkt-smp-stat-value${n === 0 ? " xkt-smp-zero" : ""}">${escapeHtml(formatNumber(n))}</span>` +
        `</div>`;
    }
    this._statsEl.innerHTML = html;

    // Apply / Remove gating: disable when the panel can't drive
    // the SceneModel (no data model, or busy).
    const canApply = !!dm && !this._busy;
    this._applyBtn.disabled  = !canApply;
    this._resetBtn.disabled  = !dm || this._busy;
    this._removeBtn.disabled = !sm || this._busy;
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────


function optionEl(value: string, label: string): HTMLOptionElement {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = label;
  return o;
}

function groupByCategory(
  catalog: ReadonlyArray<PainterCatalogEntry>,
): Record<string, PainterCatalogEntry[]> {
  const out: Record<string, PainterCatalogEntry[]> = {};
  for (const entry of catalog) {
    (out[entry.category] ||= []).push(entry);
  }
  return out;
}

/**
 * Walk the DataModel's `objectsByType` and partition each type's
 * objects by the `schema` they declare. Objects without a schema
 * land under `"unknown"`.
 */
function groupTypesBySchema(dataModel: DataModel): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  const byType = (dataModel as any).objectsByType as
    Record<string, Record<string, DataObject>> | undefined;
  if (!byType) return out;
  for (const type of Object.keys(byType)) {
    const objs = byType[type];
    for (const id of Object.keys(objs)) {
      const obj = objs[id];
      const schema = obj.schema || "unknown";
      const bucket = (out[schema] ||= {});
      bucket[type] = (bucket[type] || 0) + 1;
    }
  }
  return out;
}

function swatchColorForCategory(category: string): string {
  switch (category) {
    case "Masonry":  return "#a37a52";
    case "Interior": return "#c8a878";
    case "Metal":    return "#9aa3ad";
    case "Glass":    return "#86c2d6";
    default:         return "#cccccc";
  }
}

function catalogEntryToIfcPainter(entry: PainterCatalogEntry): IfcPainterEntry {
  return {
    paint:    entry.paint,
    material: entry.material,
  };
}

/**
 * Count `_attached_mat_*` entries currently in the SceneModel.
 * Reflects whether {@link applyIFCMaterials} has run successfully
 * — those ids are stable across apply/remove cycles.
 */
function countAttachedMaterials(sm: SceneModel): number {
  const mats = sm.materials;
  let n = 0;
  for (const id of Object.keys(mats)) {
    if (id.startsWith("_attached_mat_")) n++;
  }
  return n;
}

function escapeHtml(s: string | number): string {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[c] as string));
}

function formatNumber(v: any): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v ?? "—");
}

/**
 * Stable schema sort: known IFC schemas first, then alphabetical,
 * then `"unknown"` last.
 */
function schemaOrder(a: string, b: string): number {
  if (a === b) return 0;
  if (a === "unknown") return 1;
  if (b === "unknown") return -1;
  const rank = (s: string): number => {
    if (s.startsWith("IFC")) return 0;
    if (s.startsWith("ifc")) return 0;
    return 1;
  };
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  return a.localeCompare(b);
}

/**
 * First alive SceneModel in the Scene, optionally skipping a
 * given model (handy when handling a destruction event whose
 * target hasn't yet been removed from the map).
 */
function firstAliveSceneModel(scene: Scene, skip?: SceneModel): SceneModel | undefined {
  const models = (scene as any).models;
  if (!models) return undefined;
  for (const id of Object.keys(models)) {
    const sm = models[id] as SceneModel;
    if (!sm || sm.destroyed || sm === skip) continue;
    return sm;
  }
  return undefined;
}

/**
 * Snapshot of all live SceneModels in the Scene, sorted by id
 * for stable tab order across refreshes.
 */
function listAliveSceneModels(scene: Scene): SceneModel[] {
  const models = (scene as any).models;
  if (!models) return [];
  const out: SceneModel[] = [];
  for (const id of Object.keys(models)) {
    const sm = models[id] as SceneModel;
    if (sm && !sm.destroyed) out.push(sm);
  }
  out.sort((a, b) => String((a as any).id).localeCompare(String((b as any).id)));
  return out;
}

/**
 * Strip the auto-generated `-${Date.now()}` suffix that
 * `DemoHelper.loadDataset({clear: false})` appends to ids when
 * the user loads alongside existing models.
 */
function displaySceneModelId(id: string): string {
  const m = /^(.+?)-(\d{13})$/.exec(id);
  return m ? m[1] : id;
}

function tabTooltip(fullId: string, state: ModelState): string {
  const head = `Schema Materials — '${fullId}'`;
  switch (state.status) {
    case "applied": return `${head}\nMaterials applied`;
    case "none":    return `${head}\nNo materials applied`;
    case "running": return `${head}\nApply / Remove in flight…`;
    case "error":   return `${head}\nLast attempt failed${state.lastError ? `: ${state.lastError}` : ""}`;
    case "unknown": return `${head}\nNo matching DataModel`;
  }
}
