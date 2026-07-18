/**
 * Floating, draggable Model Inspection panel — UI surface for the
 * `sceneModelInspector` toolkit. Wraps the inspect / apply-fixes
 * pipeline behind a single class that mounts its own DOM, injects
 * its own scoped stylesheet, and exposes a small lifecycle API
 * (`inspect`, `show`, `hide`, `destroy`).
 *
 * ## Surface
 *
 * ```ts
 * import {SceneHealthPanel} from "@xeokit/sdk/studio";
 *
 * const panel = new SceneHealthPanel({
 *   sceneModel,    // the SceneModel to inspect
 *   view,          // optional — used by Locate to xray + frame objects
 *   studio,    // optional — used by Locate's camera flight
 *   inspectParams: {
 *     checkDuplicateGeometries: true,
 *     checkSimilarGeometries:   true,
 *     checkOverBudget:          true,
 *     checkOverExtent:          true,
 *   },
 * });
 *
 * await panel.inspect();        // run + render
 * panel.hide();                 // collapse to the floating "Show" pill
 * panel.destroy();              // tear down DOM + listeners
 * ```
 *
 * ## CSS portability
 *
 * Every class on the panel is prefixed with `xkt-sh-` and every
 * rule in the injected stylesheet is rooted at `.xkt-sh-panel`
 * (or the dedicated `.xkt-sh-pill`). Nothing leaks onto bare
 * tag selectors and no rule modifies elements the panel doesn't
 * own — the widget can sit alongside arbitrary host-page DOM and
 * other widgets without colliding.
 *
 * The stylesheet is injected once per page (singleton `<style>`
 * tag) regardless of how many panel instances exist.
 *
 */
import type {Scene, SceneModel} from "../../../model/scene";
import {isDefaultLayerModel} from "../../../model/scene";
import type {View} from "../../../viewing/viewer";
import type {Studio} from "../../Studio";
import type {Inspection} from "../../../inspect/sceneModel/Inspection";
import type {ConfigField} from "../../../inspect/sceneModel/Config";
import {resolveConfig} from "../../../inspect/sceneModel/Config";
import type {Issue} from "../../../inspect/sceneModel/Issue";
import type {InspectionReport} from "../../../inspect/sceneModel/InspectionReport";
import type {InspectSceneModelParams} from "../../../inspect/sceneModel/params/InspectSceneModelParams";
import type {ApplyFixesResult} from "../../../inspect/sceneModel/ApplyFixesResult";
import {DEFAULT_INSPECTION_REGISTRY} from "../../../inspect/sceneModel/DEFAULT_INSPECTION_REGISTRY";
import {DEFAULT_FIX_REGISTRY} from "../../../inspect/sceneModel/DEFAULT_FIX_REGISTRY";
import {inspectSceneModel} from "../../../inspect/sceneModel/inspectSceneModel";
import {inspectSceneModelAsync} from "../../../inspect/sceneModel/async/inspectSceneModelAsync";
import {applyFixesAsync} from "../../../inspect/sceneModel/async/applyFixesAsync";
import {inspectionReportToJson} from "../../../inspect/sceneModel/serializers/inspectionReportToJson";
import {applyFixesResultToJson} from "../../../inspect/sceneModel/serializers/applyFixesResultToJson";
import {findResourceLabel} from "../../../inspect/sceneModel/labels/findResourceLabel";
import {labelForCode} from "../../../inspect/sceneModel/labels/labelForCode";
import {descriptionForCode} from "../../../inspect/sceneModel/labels/descriptionForCode";


import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";
// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

/**
 * Constructor parameters for {@link SceneHealthPanel}.
 *
 * The panel is now Scene-scoped — it lists every loaded
 * `SceneModel` in a tab strip and inspects the one the user has
 * focused. Either provide a {@link scene} explicitly or pass a
 * {@link focusSceneModel} (its `.scene` will be used).
 */
export interface SceneHealthPanelParams {

  /**
   * The Scene to surface. If omitted, derived from
   * {@link focusSceneModel}'s `.scene` — at least one of the two
   * must be present.
   */
  scene?: Scene;

  /**
   * SceneModel to focus on first open. Optional — when omitted,
   * the first SceneModel in the Scene is selected. Passing only
   * this (with no `scene`) is equivalent to passing
   * `{scene: sceneModel.scene, focusSceneModel: sceneModel}`.
   */
  focusSceneModel?: SceneModel;

  /**
   * View to highlight / xray / frame-camera against when the user
   * clicks Locate on an issue group. Optional — without a View,
   * Locate buttons are still rendered but won't drive the viewer.
   */
  view?: View;

  /**
   * Studio instance. Used by Locate to read the SDK's
   * spatial AABB index and to drive the View's CameraFlight.
   * Optional — the panel works without it but Locate falls
   * back to no-op camera framing.
   */
  studio?: Studio;

  /**
   * DOM element to mount into. Defaults to `document.body`.
   */
  container?: HTMLElement;

  /**
   * Initial inspection-config overrides. Each schema-keyed field
   * (`checkX`, threshold values, etc.) is folded into the
   * {@link DEFAULT_INSPECTION_REGISTRY}'s config map at
   * construction time — same store the per-row toggles and
   * threshold inputs write through to.
   *
   * Application order (last write wins on overlapping keys):
   *
   *   1. Panel defaults — every opt-in inspection enabled.
   *   2. Persisted localStorage overrides from the user's last
   *      session.
   *   3. The fields supplied here.
   *
   * Note that this writes into the global registry — overrides
   * leak across any other consumer of the same registry until
   * the user resets them. For per-call-only overrides, pass them
   * directly to {@link inspectSceneModel} instead of through
   * this panel.
   */
  inspectParams?: Partial<InspectSceneModelParams>;

  /** Show the panel on construction (default `true`). */
  visible?: boolean;

  /**
   * localStorage key for persisting drag position + closed state.
   * Defaults to `"xkt-sh-panel"`. Provide a unique key per
   * SceneModel if you want per-model layout memory.
   */
  storageKey?: string;

  /**
   * Initial top offset, in CSS pixels. When supplied, this
   * overrides any persisted panel position for the first open.
   */
  initialTop?: number;

  /**
   * Initial right offset, in CSS pixels. When supplied, this
   * anchors the panel from the viewport's right edge and overrides
   * any persisted left position for the first open.
   */
  initialRight?: number;
}


// ─────────────────────────────────────────────────────────────────
// Module-level constants
// ─────────────────────────────────────────────────────────────────

/**
 * Code prefix → category id used for CSS colour stripes. Adding a
 * prefix here just means the matching `[data-category="…"]`
 * stripe rule needs a colour assignment in {@link PANEL_CSS}.
 */
const CODE_CATEGORY_BY_PREFIX: Readonly<Record<string, string>> = {
  GEOMETRY:  "geometry",
  MESH:      "mesh",
  OBJECT:    "object",
  MATERIAL:  "material",
  TEXTURE:   "texture",
  TRANSFORM: "transform",
  SCENE:     "misc",
};

/**
 * Impact bucket → user-visible label + member codes. Drives the
 * three-bucket rendering of issues:
 *   - critical     · blocks rendering, shading, or model load
 *   - optimization · slow renders / wasted GPU
 *   - cleanup      · noise; safe to drop, no rendering impact
 */
const IMPACT_BUCKETS: Readonly<Record<string, {label: string; codes: readonly string[]}>> = {
  critical: {
    label: "Critical · Rendering Risk",
    codes: [
      "GEOMETRY_NO_POSITIONS", "GEOMETRY_POSITIONS_LENGTH", "GEOMETRY_NORMALS_LENGTH",
      "GEOMETRY_UVS_LENGTH",   "GEOMETRY_AABB_NONFINITE",  "GEOMETRY_AABB_INVERTED",
      "GEOMETRY_INDICES_LENGTH", "GEOMETRY_INDEX_OUT_OF_RANGE",
      "MESH_DANGLING_GEOMETRY", "MESH_DANGLING_MATERIAL", "MESH_DANGLING_TRANSFORM",
      "MESH_NONFINITE_MATRIX", "OBJECT_DANGLING_MESH", "TRANSFORM_CYCLE",
      "MATERIAL_TEXTURED_GEOMETRY_NO_UVS", "MATERIAL_PBR_GEOMETRY_NO_NORMALS",
    ],
  },
  optimization: {
    label: "Optimization · Performance",
    codes: [
      "GEOMETRY_DUPLICATE", "GEOMETRY_SIMILAR", "GEOMETRY_OVER_BUDGET",
      "GEOMETRY_OVER_EXTENT", "OBJECT_FAR_FROM_ORIGIN", "OBJECT_DUPLICATE_AABB",
      "GEOMETRY_FAR_FROM_ORIGIN", "TEXTURE_OVERSIZED",
    ],
  },
  cleanup: {
    label: "Geometry Cleanup",
    codes: [
      "MATERIAL_UNUSED", "TEXTURE_UNUSED", "TRANSFORM_UNUSED", "TRANSFORM_IDENTITY",
      "GEOMETRY_ZERO_VOLUME_AABB", "GEOMETRY_DEGENERATE_TRIANGLES",
      "GEOMETRY_UNUSED_VERTICES", "GEOMETRY_DUPLICATE_VERTICES",
      "GEOMETRY_NON_WATERTIGHT", "GEOMETRY_INCONSISTENT_WINDING",
      "GEOMETRY_AABB_NOT_TIGHT", "GEOMETRY_DUPLICATE_INDICES", "TEXTURE_NPOT",
    ],
  },
};

const IMPACT_BY_CODE: Readonly<Record<string, string>> = (() => {
  const m: Record<string, string> = {};
  for (const [bucket, info] of Object.entries(IMPACT_BUCKETS)) {
    for (const c of info.codes) m[c] = bucket;
  }
  return m;
})();

const STYLE_TAG_ID = "xkt-sh-styles";

const DEFAULT_INSPECT_PARAMS: Partial<InspectSceneModelParams> = {
  checkDuplicateGeometries:   true,
  checkSimilarGeometries:     true,
  checkDenseGeometries:       true,
  checkLargeGeometries:       true,
  checkGeometryQuality:       true,
  checkObjectStructure:       true,
  checkTextureSanity:         true,
  checkGeometryFarFromOrigin: true,
};


// ─────────────────────────────────────────────────────────────────
// CSS — every selector is rooted at `.xkt-sh-panel` or
// `.xkt-sh-pill` so nothing leaks onto host-page DOM. Class
// names are prefixed `xkt-sh-` to avoid collisions with other
// widgets that might use generic words like "header", "stats",
// or "issues".
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-sh-panel {
  position: fixed;
  top: 115px;
  right: 17px;
  width: 650px;
  /* Auto height so the panel hugs its content — health card,
     primary actions, stats, inspections list, the issues tree,
     fix history. As the user expands or collapses sections the
     panel grows / shrinks. The max-height bound caps it at the
     viewport so a model with thousands of issues still scrolls
     inside the issues body rather than overflowing the screen. */
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
.xkt-sh-panel *, .xkt-sh-panel *::before, .xkt-sh-panel *::after {
  box-sizing: border-box;
}
.xkt-sh-panel[hidden] { display: none; }

.xkt-sh-panel .xkt-sh-header {
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
.xkt-sh-panel .xkt-sh-header.xkt-sh-dragging { cursor: grabbing; }
.xkt-sh-panel .xkt-sh-title {
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
.xkt-sh-panel .xkt-sh-title-icon {
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
.xkt-sh-panel .xkt-sh-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-sh-panel .xkt-sh-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-sh-panel .xkt-sh-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-sh-panel .xkt-sh-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
.xkt-sh-panel .xkt-sh-title-id {
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
.xkt-sh-panel .xkt-sh-close {
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
.xkt-sh-panel .xkt-sh-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-sh-pill {
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
.xkt-sh-pill:hover { background: #1f4669; }
.xkt-sh-pill[hidden] { display: none; }

.xkt-sh-panel .xkt-sh-progress {
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
.xkt-sh-panel .xkt-sh-progress.xkt-sh-active {
  background: #fff8e1;
  border-bottom-color: #f0e3b0;
}
.xkt-sh-panel .xkt-sh-progress-label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #888;
  font-weight: 500;
  transition: color 150ms ease-out;
}
.xkt-sh-panel .xkt-sh-progress.xkt-sh-active .xkt-sh-progress-label { color: #6b5300; }
.xkt-sh-panel .xkt-sh-progress-bar {
  flex-shrink: 0;
  width: 110px;
  height: 8px;
  opacity: 0.4;
  transition: opacity 150ms ease-out;
}
.xkt-sh-panel .xkt-sh-progress.xkt-sh-active .xkt-sh-progress-bar { opacity: 1; }
.xkt-sh-panel .xkt-sh-progress-cancel {
  flex-shrink: 0;
  padding: 2px 10px;
  font: inherit;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: #6b5300;
  background: transparent;
  border: 1px solid #c0a04c;
  border-radius: 999px;
  cursor: pointer;
}
.xkt-sh-panel .xkt-sh-progress-cancel[hidden] { display: none; }
.xkt-sh-panel .xkt-sh-progress-cancel:hover {
  background: #f1e3b6;
  color: #4a3a00;
}

.xkt-sh-panel.xkt-sh-busy .xkt-sh-health,
.xkt-sh-panel.xkt-sh-busy .xkt-sh-actions,
.xkt-sh-panel.xkt-sh-busy .xkt-sh-stats,
.xkt-sh-panel.xkt-sh-busy .xkt-sh-inspections,
.xkt-sh-panel.xkt-sh-busy .xkt-sh-issues,
.xkt-sh-panel.xkt-sh-busy .xkt-sh-fix-history,
.xkt-sh-panel.xkt-sh-busy .xkt-sh-footer {
  pointer-events: none;
  opacity: 0.55;
  user-select: none;
}
.xkt-sh-panel.xkt-sh-busy .xkt-sh-progress { pointer-events: auto; }

.xkt-sh-panel .xkt-sh-health {
  flex: 0 0 auto;
  padding: 14px 16px;
  border-bottom: 1px solid #ececec;
  background: #fafafa;
}
.xkt-sh-panel .xkt-sh-health[data-state="critical"]  { background: #fdf3f3; border-bottom-color: #f3d7d7; }
.xkt-sh-panel .xkt-sh-health[data-state="warning"]   { background: #fff8e6; border-bottom-color: #f0e3b0; }
.xkt-sh-panel .xkt-sh-health[data-state="review"]    { background: #f1f6fb; border-bottom-color: #d6e3f0; }
.xkt-sh-panel .xkt-sh-health[data-state="healthy"]   { background: #f0f8f0; border-bottom-color: #cfe4cf; }
.xkt-sh-panel .xkt-sh-health[data-state="loading"]   { background: #fafafa; border-bottom-color: #ececec; }
.xkt-sh-panel .xkt-sh-health-row1 {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.xkt-sh-panel .xkt-sh-health-status {
  flex: 1;
  font-size: 18px;
  font-weight: 650;
  color: #111;
  letter-spacing: -0.2px;
}
.xkt-sh-panel .xkt-sh-health[data-state="critical"] .xkt-sh-health-status { color: #a02020; }
.xkt-sh-panel .xkt-sh-health[data-state="warning"]  .xkt-sh-health-status { color: #8a5a00; }
.xkt-sh-panel .xkt-sh-health[data-state="review"]   .xkt-sh-health-status { color: #2d5e8c; }
.xkt-sh-panel .xkt-sh-health[data-state="healthy"]  .xkt-sh-health-status { color: #1f7a1f; }
.xkt-sh-panel .xkt-sh-health-counts {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  font-variant-numeric: tabular-nums;
}
.xkt-sh-panel .xkt-sh-health-counts .xkt-sh-c-error  { color: #a02020; }
.xkt-sh-panel .xkt-sh-health-counts .xkt-sh-c-warn   { color: #8a5a00; }
.xkt-sh-panel .xkt-sh-health-counts .xkt-sh-c-review { color: #2d5e8c; }
.xkt-sh-panel .xkt-sh-health-rec {
  margin-top: 6px;
  font-size: 12px;
  color: #555;
  line-height: 1.4;
}
.xkt-sh-panel .xkt-sh-health-rec:empty { display: none; }

.xkt-sh-panel .xkt-sh-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid #ececec;
  background: #fcfcfc;
}
.xkt-sh-panel .xkt-sh-fix-all {
  flex: 1;
  padding: 9px 14px;
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.2px;
  color: #fff;
  background: #2d5e8c;
  border: 1px solid #1f4669;
  border-radius: 6px;
  cursor: pointer;
  transition: background 80ms ease-out;
}
.xkt-sh-panel .xkt-sh-fix-all:hover:not(:disabled) { background: #1f4669; }
.xkt-sh-panel .xkt-sh-fix-all:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.xkt-sh-panel .xkt-sh-fix-all[data-state="exhausted"]:disabled {
  opacity: 1;
  color: #2d5e8c;
  background: #eef3f9;
  border-color: #c8d6e6;
  font-weight: 600;
}
.xkt-sh-panel .xkt-sh-fix-all[data-state="exhausted"]:disabled::before {
  content: "✓ ";
  font-weight: 700;
  margin-right: 2px;
}
.xkt-sh-panel .xkt-sh-secondary {
  flex-shrink: 0;
  padding: 7px 12px;
  font: inherit;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: #555;
  background: transparent;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  cursor: pointer;
}
.xkt-sh-panel .xkt-sh-secondary:hover {
  background: #f0f0f0;
  color: #222;
}
.xkt-sh-panel .xkt-sh-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.xkt-sh-panel .xkt-sh-stats {
  flex: 0 0 auto;
  padding: 8px 12px 10px;
  border-bottom: 1px solid #ececec;
  background: #fcfcfc;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px 14px;
}
.xkt-sh-panel .xkt-sh-stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 11px;
  min-width: 0;
}
.xkt-sh-panel .xkt-sh-stat-label {
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
.xkt-sh-panel .xkt-sh-stat-value {
  flex-shrink: 0;
  color: #111;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.xkt-sh-panel .xkt-sh-stat-value.xkt-sh-zero { color: #aaa; font-weight: 400; }
.xkt-sh-panel .xkt-sh-stat-delta {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  padding: 1px 4px;
  border-radius: 3px;
}
.xkt-sh-panel .xkt-sh-stat-delta.xkt-sh-saved   { color: #1a7a3c; background: #e3f3e7; }
.xkt-sh-panel .xkt-sh-stat-delta.xkt-sh-added   { color: #8a5a00; background: #fbeed1; }
.xkt-sh-panel .xkt-sh-stat-delta.xkt-sh-neutral { color: #aaa;    background: transparent; }

.xkt-sh-panel .xkt-sh-inspections {
  flex: 0 0 auto;
  border-bottom: 1px solid #ececec;
  background: #f7f9fb;
}
.xkt-sh-panel .xkt-sh-inspections > summary {
  list-style: none;
  cursor: pointer;
  padding: 8px 12px;
  display: flex;
  gap: 6px;
  align-items: center;
  font-weight: 600;
  font-size: 12px;
  color: #2d5e8c;
  user-select: none;
}
.xkt-sh-panel .xkt-sh-inspections > summary::-webkit-details-marker { display: none; }
.xkt-sh-panel .xkt-sh-inspections > summary::marker                  { display: none; }
.xkt-sh-panel .xkt-sh-inspections > summary::before {
  content: "›";
  display: inline-block;
  width: 10px;
  color: #888;
  transform: translateY(-1px) rotate(0deg);
  transition: transform 120ms ease;
  font-size: 13px;
  line-height: 1;
}
.xkt-sh-panel .xkt-sh-inspections[open] > summary::before {
  transform: translateY(-1px) rotate(90deg);
}
.xkt-sh-panel .xkt-sh-inspections > summary:hover { background: #eef3f8; }
.xkt-sh-panel .xkt-sh-inspections-count {
  margin-left: auto;
  color: #777;
  font-weight: normal;
  font-size: 11px;
}
.xkt-sh-panel .xkt-sh-inspections-toggle {
  flex-shrink: 0;
  padding: 2px 8px;
  font: inherit;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: #2d5e8c;
  background: transparent;
  border: 1px solid #c0d2e0;
  border-radius: 999px;
  cursor: pointer;
}
.xkt-sh-panel .xkt-sh-inspections-toggle:hover {
  background: #eef3f8;
  border-color: #2d5e8c;
}
.xkt-sh-panel .xkt-sh-inspections-body {
  padding: 4px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 240px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.xkt-sh-panel .xkt-sh-inspection-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 3px;
  cursor: pointer;
}
.xkt-sh-panel .xkt-sh-inspection-row:hover { background: #eef3f8; }
.xkt-sh-panel .xkt-sh-inspection-row > input[type="checkbox"] {
  margin: 1px 0 0 0;
  flex-shrink: 0;
  cursor: pointer;
}
.xkt-sh-panel .xkt-sh-inspection-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.xkt-sh-panel .xkt-sh-inspection-desc {
  color: #222;
  font-size: 11px;
  line-height: 1.3;
}
.xkt-sh-panel .xkt-sh-inspection-codes {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
  color: #444;
  font-size: 10.5px;
  line-height: 1.4;
}
.xkt-sh-panel .xkt-sh-inspection-codes > span {
  padding-left: 12px;
  position: relative;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-sh-panel .xkt-sh-inspection-codes > span::before {
  content: "•";
  position: absolute;
  left: 2px;
  top: 0;
  color: #999;
  font-weight: 700;
}
.xkt-sh-panel .xkt-sh-inspection-codes strong {
  color: #222;
  font-weight: 600;
}
.xkt-sh-panel .xkt-sh-inspection-code-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9.5px;
  color: #888;
}
.xkt-sh-panel .xkt-sh-inspection-row.xkt-sh-opt-in .xkt-sh-inspection-desc::after {
  content: "  · opt-in";
  color: #b88500;
  font-size: 10px;
  font-weight: 600;
}

/* Per-inspection threshold form. Sits indented under the row's
 * description so the form belongs visibly to its inspection. The
 * "●" suffix on the description marks inspections whose stored
 * overrides differ from the schema defaults. */
.xkt-sh-panel .xkt-sh-inspection-row.xkt-sh-modified .xkt-sh-inspection-desc::after {
  content: "  ●";
  color: #f59e0b;
  font-size: 11px;
}
.xkt-sh-panel .xkt-sh-inspection-row.xkt-sh-opt-in.xkt-sh-modified .xkt-sh-inspection-desc::after {
  content: "  · opt-in  ●";
}

/* Chevron button — collapses an inspection's codes + fields form
 * down to its description. Initial state is collapsed; clicking
 * the chevron toggles the xkt-sh-collapsed class on the row,
 * which hides the codes / fields children via the rules below.
 * Sits between the checkbox and the text column, sized to match
 * the checkbox so the columns line up. */
.xkt-sh-panel .xkt-sh-inspection-chevron {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin: 0;
  padding: 0;
  background: transparent;
  border: 0;
  color: #888;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transform: rotate(90deg);
  transition: transform 120ms ease, color 120ms ease;
}
.xkt-sh-panel .xkt-sh-inspection-chevron:hover { color: #2d5e8c; }
.xkt-sh-panel .xkt-sh-inspection-row.xkt-sh-collapsed .xkt-sh-inspection-chevron {
  transform: rotate(0deg);
}
.xkt-sh-panel .xkt-sh-inspection-row.xkt-sh-collapsed .xkt-sh-inspection-codes,
.xkt-sh-panel .xkt-sh-inspection-row.xkt-sh-collapsed .xkt-sh-inspection-fields {
  display: none;
}
.xkt-sh-panel .xkt-sh-inspection-fields {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 10px;
  margin-top: 6px;
  padding: 6px 8px;
  background: #eef3f8;
  border-radius: 4px;
  cursor: default;
}
.xkt-sh-panel .xkt-sh-inspection-field-label {
  font-size: 10.5px;
  color: #2d3e50;
  align-self: center;
}
.xkt-sh-panel .xkt-sh-inspection-field-description {
  grid-column: 1 / -1;
  font-size: 10px;
  color: #64748b;
  line-height: 1.35;
  margin: -2px 0 2px;
}
.xkt-sh-panel .xkt-sh-inspection-field-input {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}
.xkt-sh-panel .xkt-sh-inspection-field-input input[type="number"] {
  width: 92px;
  padding: 2px 6px;
  font: inherit;
  font-variant-numeric: tabular-nums;
  border: 1px solid #c0d2e0;
  border-radius: 3px;
  background: #fff;
}
.xkt-sh-panel .xkt-sh-inspection-field-input select {
  padding: 2px 6px;
  font: inherit;
  border: 1px solid #c0d2e0;
  border-radius: 3px;
  background: #fff;
}
.xkt-sh-panel .xkt-sh-inspection-field-input .xkt-sh-inspection-field-unit {
  color: #64748b;
  font-size: 10px;
}

.xkt-sh-panel .xkt-sh-issues {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px 12px 14px;
}
.xkt-sh-panel .xkt-sh-empty {
  padding: 24px 12px;
  text-align: center;
  color: #777;
  font-size: 12px;
}

.xkt-sh-panel .xkt-sh-impact {
  margin: 6px 0;
  background: #fff;
  border: 1px solid #ececec;
  border-left: 3px solid var(--xkt-sh-impact-color, #888);
  border-radius: 6px;
  overflow: hidden;
}
.xkt-sh-panel .xkt-sh-impact[data-impact="critical"]     { --xkt-sh-impact-color: #a02020; }
.xkt-sh-panel .xkt-sh-impact[data-impact="optimization"] { --xkt-sh-impact-color: #8a5a00; }
.xkt-sh-panel .xkt-sh-impact[data-impact="cleanup"]      { --xkt-sh-impact-color: #2d5e8c; }
.xkt-sh-panel .xkt-sh-impact > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  user-select: none;
}
.xkt-sh-panel .xkt-sh-impact > summary::-webkit-details-marker { display: none; }
.xkt-sh-panel .xkt-sh-impact > summary::marker                  { display: none; }
.xkt-sh-panel .xkt-sh-impact > summary::before {
  content: "›";
  display: inline-block;
  transform: rotate(0deg);
  transition: transform 120ms ease-out;
  color: #888;
  font-size: 12px;
}
.xkt-sh-panel .xkt-sh-impact[open] > summary::before { transform: rotate(90deg); }
.xkt-sh-panel .xkt-sh-impact > summary:hover { background: #fafafa; }
.xkt-sh-panel .xkt-sh-impact-label {
  flex: 1;
  font-size: 12px;
  font-weight: 650;
  color: #222;
  letter-spacing: -0.1px;
}
.xkt-sh-panel .xkt-sh-impact[data-impact="critical"]     .xkt-sh-impact-label { color: #a02020; }
.xkt-sh-panel .xkt-sh-impact[data-impact="optimization"] .xkt-sh-impact-label { color: #8a5a00; }
.xkt-sh-panel .xkt-sh-impact[data-impact="cleanup"]      .xkt-sh-impact-label { color: #2d5e8c; }
.xkt-sh-panel .xkt-sh-impact-count {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  font-variant-numeric: tabular-nums;
}
.xkt-sh-panel .xkt-sh-impact > .xkt-sh-body {
  padding: 4px 8px 6px;
  border-top: 1px solid #f4f4f4;
  background: #fcfcfc;
}

.xkt-sh-panel [data-category="geometry"]  { --xkt-sh-cat-color: #2d5e8c; }
.xkt-sh-panel [data-category="mesh"]      { --xkt-sh-cat-color: #7c459e; }
.xkt-sh-panel [data-category="object"]    { --xkt-sh-cat-color: #b06e2c; }
.xkt-sh-panel [data-category="material"]  { --xkt-sh-cat-color: #2c7e6f; }
.xkt-sh-panel [data-category="texture"]   { --xkt-sh-cat-color: #8a722c; }
.xkt-sh-panel [data-category="transform"] { --xkt-sh-cat-color: #9c4666; }
.xkt-sh-panel [data-category="misc"]      { --xkt-sh-cat-color: #777;    }

.xkt-sh-panel .xkt-sh-type-group {
  margin: 4px 0;
  background: #fff;
  border: 1px solid #ececec;
  border-radius: 5px;
  overflow: hidden;
}
.xkt-sh-panel .xkt-sh-type-group[data-category] {
  border-left: 3px solid var(--xkt-sh-cat-color);
}
.xkt-sh-panel .xkt-sh-type-group > summary {
  list-style: none;
  cursor: pointer;
  padding: 6px 8px;
  display: flex;
  gap: 6px;
  align-items: flex-start;
  user-select: none;
  font-size: 11.5px;
  font-weight: 600;
}
.xkt-sh-panel .xkt-sh-type-group > summary::-webkit-details-marker { display: none; }
.xkt-sh-panel .xkt-sh-type-group > summary::marker                  { display: none; }
.xkt-sh-panel .xkt-sh-type-group > summary::before {
  content: "›";
  display: inline-block;
  width: 10px;
  color: #888;
  transform: translateY(-1px) rotate(0deg);
  transition: transform 120ms ease;
  font-size: 13px;
  line-height: 1;
}
.xkt-sh-panel .xkt-sh-type-group[open] > summary::before {
  transform: translateY(-1px) rotate(90deg);
}
.xkt-sh-panel .xkt-sh-type-group > summary:hover { background: #f3f3f3; }
.xkt-sh-panel .xkt-sh-group-summary-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.xkt-sh-panel .xkt-sh-title-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.xkt-sh-panel .xkt-sh-friendly-label {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  color: #222;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-sh-panel .xkt-sh-code-badge {
  flex-shrink: 0;
  padding: 1px 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.2px;
  color: #666;
  background: #f0f0f0;
  border-radius: 3px;
  white-space: nowrap;
}
.xkt-sh-panel .xkt-sh-count {
  margin-left: auto;
  color: #777;
  font-weight: normal;
  font-size: 11px;
}

/* Severity glyph at the left of each type-group row — the
   primary "what kind of issue is this?" signal. ✕ red for
   error, ⚠ amber for warning, · grey for info. */
.xkt-sh-panel .xkt-sh-sev-icon {
  flex-shrink: 0;
  width: 14px;
  text-align: center;
  font-size: 12px;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  line-height: 1;
}
.xkt-sh-panel .xkt-sh-sev-icon[data-severity="error"]   { color: #c8332c; }
.xkt-sh-panel .xkt-sh-sev-icon[data-severity="warning"] { color: #b78400; }
.xkt-sh-panel .xkt-sh-sev-icon[data-severity="info"]    { color: #888;    font-weight: 700; }

/* Tinted summary background on error / warning type-groups so
   the eye locks onto error rows before reading. */
.xkt-sh-panel .xkt-sh-type-group[data-severity="error"] > summary {
  background: rgba(200, 51, 44, 0.06);
}
.xkt-sh-panel .xkt-sh-type-group[data-severity="error"] > summary:hover {
  background: rgba(200, 51, 44, 0.10);
}
.xkt-sh-panel .xkt-sh-type-group[data-severity="warning"] > summary {
  background: rgba(214, 160, 32, 0.05);
}
.xkt-sh-panel .xkt-sh-type-group[data-severity="warning"] > summary:hover {
  background: rgba(214, 160, 32, 0.10);
}
/* Severity wins over category for the left-edge stripe colour. */
.xkt-sh-panel .xkt-sh-type-group[data-severity="error"][data-category] {
  border-left-color: #c8332c;
}
.xkt-sh-panel .xkt-sh-type-group[data-severity="warning"][data-category] {
  border-left-color: #d6a020;
}

/* Per-severity split count chip on impact-group rows. */
.xkt-sh-panel .xkt-sh-impact-count-split {
  margin-left: auto;
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 600;
}
.xkt-sh-panel .xkt-sh-impact-count-split > .xkt-sh-cnt {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
}
.xkt-sh-panel .xkt-sh-impact-count-split > .xkt-sh-cnt-err  { color: #c8332c; }
.xkt-sh-panel .xkt-sh-impact-count-split > .xkt-sh-cnt-warn { color: #b78400; }
.xkt-sh-panel .xkt-sh-impact-count-split > .xkt-sh-cnt-info { color: #888;    }
.xkt-sh-panel .xkt-sh-last-fix-badge {
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.2px;
}
.xkt-sh-panel .xkt-sh-last-fix-badge.xkt-sh-fixed   { background: #e3f3e7; color: #1a7a3c; }
.xkt-sh-panel .xkt-sh-last-fix-badge.xkt-sh-partial { background: #fbeed1; color: #8a5a00; }
.xkt-sh-panel .xkt-sh-last-fix-badge.xkt-sh-failed  { background: #fde7e7; color: #a02020; }

.xkt-sh-panel .xkt-sh-type-group > .xkt-sh-body {
  padding: 4px 8px 6px;
  border-top: 1px solid #f4f4f4;
  background: #fcfcfc;
}
.xkt-sh-panel .xkt-sh-issue {
  /* Left padding aligns the resource id with the type-group's
     title text — past the body's own 8px left padding plus the
     summary chevron (10px) + gap (6px). */
  padding: 3px 8px 3px 16px;
  font-size: 10.5px;
  display: flex;
  gap: 6px;
  align-items: center;
  border-radius: 3px;
  color: #333;
}
.xkt-sh-panel .xkt-sh-issue:nth-child(odd)  { background: #fafafa; }
.xkt-sh-panel .xkt-sh-issue:nth-child(even) { background: #f4f4f4; }
.xkt-sh-panel .xkt-sh-issue.xkt-sh-locatable        { cursor: pointer; }
.xkt-sh-panel .xkt-sh-issue.xkt-sh-locatable:hover  { background: #e9eef3; color: #14385c; }
.xkt-sh-panel .xkt-sh-issue.xkt-sh-locatable:focus  { outline: 1px solid #2d5e8c; outline-offset: -1px; }
.xkt-sh-panel .xkt-sh-issue.xkt-sh-locatable:hover .xkt-sh-locate-hint { color: #2d5e8c; }
.xkt-sh-panel .xkt-sh-locate-hint {
  flex-shrink: 0;
  color: #b0b0b0;
  font-size: 12px;
  line-height: 1;
  margin-left: 4px;
}
.xkt-sh-panel .xkt-sh-issue-headline {
  flex: 1;
  min-width: 0;
  color: #777;
  font-weight: normal;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-sh-panel .xkt-sh-issue-headline > strong {
  color: #222;
  font-weight: 600;
}
.xkt-sh-panel .xkt-sh-issue-id-badge {
  margin-left: 4px;
  padding: 0 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9.5px;
  color: #888;
  background: #f0f0f0;
  border-radius: 3px;
}
.xkt-sh-panel .xkt-sh-issue-blurb {
  flex-shrink: 0;
  margin-left: 8px;
  color: #888;
  font-size: 10px;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
}
.xkt-sh-panel .xkt-sh-fix-action {
  margin-left: 6px;
  padding: 2px 8px;
  font: inherit;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: #fff;
  background: #2d5e8c;
  border: 1px solid #25527b;
  border-radius: 999px;
  cursor: pointer;
  flex-shrink: 0;
}
.xkt-sh-panel .xkt-sh-fix-action:hover { background: #366ea3; }
.xkt-sh-panel .xkt-sh-locate-action {
  margin-left: 6px;
  padding: 2px 8px;
  font: inherit;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: #3e6c45;
  background: transparent;
  border: 1px solid #b8cfbb;
  border-radius: 999px;
  cursor: pointer;
  flex-shrink: 0;
}
.xkt-sh-panel .xkt-sh-locate-action:hover {
  background: #eaf3ec;
  border-color: #4d8455;
  color: #2c5232;
}
.xkt-sh-panel .xkt-sh-fix-action-row {
  flex-shrink: 0;
  margin-left: 6px;
  padding: 1px 7px;
  font: inherit;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: #2d5e8c;
  background: transparent;
  border: 1px solid #b6cadb;
  border-radius: 999px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  line-height: 1.2;
}
.xkt-sh-panel .xkt-sh-fix-action-row:hover {
  background: #e7eef5;
  border-color: #2d5e8c;
}
.xkt-sh-panel .xkt-sh-fix-action-row-icon {
  font-size: 10px;
  color: #4a82b6;
}
.xkt-sh-panel .xkt-sh-fix-action-row:hover .xkt-sh-fix-action-row-icon { color: #2d5e8c; }
.xkt-sh-panel .xkt-sh-show-more {
  display: block;
  width: 100%;
  margin: 4px 0 2px;
  padding: 5px 8px;
  font: inherit;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #2d5e8c;
  background: transparent;
  border: 1px dashed #c8d2da;
  border-radius: 4px;
  cursor: pointer;
}
.xkt-sh-panel .xkt-sh-show-more:hover { background: #f0f4f8; border-color: #2d5e8c; }

.xkt-sh-panel .xkt-sh-fix-history {
  flex: 0 0 auto;
  border-top: 1px solid #ececec;
  background: #fafafa;
}
.xkt-sh-panel .xkt-sh-fix-history > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 11px;
  font-weight: 600;
  color: #444;
  letter-spacing: 0.2px;
  user-select: none;
}
.xkt-sh-panel .xkt-sh-fix-history > summary::-webkit-details-marker { display: none; }
.xkt-sh-panel .xkt-sh-fix-history > summary::marker                  { display: none; }
.xkt-sh-panel .xkt-sh-fix-history > summary::before {
  content: "›";
  display: inline-block;
  transform: rotate(0deg);
  transition: transform 120ms ease-out;
  color: #888;
  font-size: 12px;
}
.xkt-sh-panel .xkt-sh-fix-history[open] > summary::before { transform: rotate(90deg); }
.xkt-sh-panel .xkt-sh-fix-history > summary:hover { background: #f0f0f0; }
.xkt-sh-panel .xkt-sh-fix-history-label { flex: 1; }
.xkt-sh-panel .xkt-sh-fix-history-count {
  flex-shrink: 0;
  font-size: 10.5px;
  font-weight: 500;
  color: #888;
  font-variant-numeric: tabular-nums;
}
.xkt-sh-panel .xkt-sh-fix-history-get {
  flex-shrink: 0;
  padding: 3px 9px;
  font: inherit;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: #555;
  background: transparent;
  border: 1px solid #d0d0d0;
  border-radius: 999px;
  cursor: pointer;
}
.xkt-sh-panel .xkt-sh-fix-history-get:hover {
  background: #f0f0f0;
  color: #222;
}
.xkt-sh-panel .xkt-sh-fix-history-entries {
  max-height: 240px;
  overflow-y: auto;
  padding: 0 12px 8px;
  border-top: 1px solid #ececec;
  background: #fff;
}
.xkt-sh-panel .xkt-sh-fix-entry {
  margin: 6px 0;
  background: #fafafa;
  border: 1px solid #ececec;
  border-left: 3px solid #2d5e8c;
  border-radius: 6px;
  overflow: hidden;
}
.xkt-sh-panel .xkt-sh-fix-entry[data-category] > summary {
  border-left: 3px solid var(--xkt-sh-cat-color);
  padding-left: 10px;
}
.xkt-sh-panel .xkt-sh-fix-entry > summary {
  list-style: none;
  cursor: pointer;
  padding: 8px 10px;
  display: flex;
  gap: 6px;
  align-items: center;
  user-select: none;
  font-weight: 600;
  font-size: 11.5px;
}
.xkt-sh-panel .xkt-sh-fix-entry > summary::-webkit-details-marker { display: none; }
.xkt-sh-panel .xkt-sh-fix-entry > summary::marker                  { display: none; }
.xkt-sh-panel .xkt-sh-fix-entry > summary::before {
  content: "›";
  display: inline-block;
  width: 10px;
  color: #888;
  transform: translateY(-1px) rotate(0deg);
  transition: transform 120ms ease;
  font-size: 13px;
  line-height: 1;
}
.xkt-sh-panel .xkt-sh-fix-entry[open] > summary::before {
  transform: translateY(-1px) rotate(90deg);
}
.xkt-sh-panel .xkt-sh-fix-entry > summary:hover { background: #f3f3f3; }
.xkt-sh-panel .xkt-sh-entry-header {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 6px;
  align-items: center;
}
.xkt-sh-panel .xkt-sh-action-label {
  flex: 1;
  min-width: 0;
  color: #222;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-sh-panel .xkt-sh-counts {
  font-weight: normal;
  font-size: 10.5px;
  color: #555;
}
.xkt-sh-panel .xkt-sh-counts .xkt-sh-c-fixed  { color: #1f7a1f; font-weight: 600; }
.xkt-sh-panel .xkt-sh-counts .xkt-sh-c-errors { color: #a02020; font-weight: 600; }
.xkt-sh-panel .xkt-sh-fix-entry > .xkt-sh-body {
  padding: 6px 10px 10px 24px;
  border-top: 1px solid #ececec;
  background: #fff;
  font-size: 11px;
  color: #333;
}
.xkt-sh-panel .xkt-sh-fix-row {
  padding: 3px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: baseline;
}
.xkt-sh-panel .xkt-sh-fix-row[data-category] {
  border-left: 2px solid var(--xkt-sh-cat-color);
  padding-left: 8px;
}
.xkt-sh-panel .xkt-sh-fix-row .xkt-sh-trace {
  flex-basis: 100%;
  margin-left: 62px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9.5px;
  color: #888;
  word-break: break-all;
}
.xkt-sh-panel .xkt-sh-fix-row .xkt-sh-outcome {
  flex-shrink: 0;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 9.5px;
  letter-spacing: 0.4px;
  width: 56px;
}
.xkt-sh-panel .xkt-sh-fix-row.xkt-sh-fixed   .xkt-sh-outcome { color: #1f7a1f; }
.xkt-sh-panel .xkt-sh-fix-row.xkt-sh-skipped .xkt-sh-outcome { color: #888;   }
.xkt-sh-panel .xkt-sh-fix-row.xkt-sh-errors  .xkt-sh-outcome { color: #a02020;}
.xkt-sh-panel .xkt-sh-reason-chip {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 3px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.2px;
  background: #f0f0f0;
  color: #555;
}
.xkt-sh-panel .xkt-sh-reason-chip.xkt-sh-r-target-missing      { background: #ecf0f7; color: #2d5e8c; }
.xkt-sh-panel .xkt-sh-reason-chip.xkt-sh-r-malformed-issue     { background: #fbeed1; color: #8a5a00; }
.xkt-sh-panel .xkt-sh-reason-chip.xkt-sh-r-precondition-failed { background: #fde7e7; color: #a02020; }
.xkt-sh-panel .xkt-sh-reason-chip.xkt-sh-r-no-op               { background: #e6f0e6; color: #1a7a3c; }
.xkt-sh-panel .xkt-sh-reason-chip.xkt-sh-r-no-strategy         { background: #f0eaf5; color: #6a3f8a; }
.xkt-sh-panel .xkt-sh-reason-chip.xkt-sh-r-filter-excluded     { background: #f0f0f0; color: #555;   }
.xkt-sh-panel .xkt-sh-fix-row .xkt-sh-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10.5px;
  color: #555;
}
.xkt-sh-panel .xkt-sh-fix-row .xkt-sh-detail {
  flex: 1;
  min-width: 0;
  color: #444;
  word-break: break-word;
}

.xkt-sh-panel .xkt-sh-footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-top: 1px solid #ececec;
  background: #fafafa;
}
.xkt-sh-panel .xkt-sh-footer[hidden] { display: none; }
.xkt-sh-panel .xkt-sh-footer-message {
  flex: 1;
  font-size: 11px;
  color: #555;
  line-height: 1.4;
}
.xkt-sh-panel .xkt-sh-re-inspect {
  flex-shrink: 0;
  padding: 7px 14px;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  color: #2d5e8c;
  background: transparent;
  border: 1px solid #2d5e8c;
  border-radius: 6px;
  cursor: pointer;
}
.xkt-sh-panel .xkt-sh-re-inspect:hover { background: #ecf2f7; }

@keyframes xkt-sh-pulse {
  0%   { background-color: #fff5d4; }
  100% { background-color: transparent; }
}
.xkt-sh-panel .xkt-sh-type-group.xkt-sh-pulse {
  animation: xkt-sh-pulse 1.2s ease-out;
}

/* Model tabs — one chip per loaded SceneModel, with the active
   one taking the panel-blue accent. Horizontally scrollable for
   scenes that load many models. */
.xkt-sh-panel .xkt-sh-tabs {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid #ececec;
  background: #fcfcfc;
  /* Cap at ~3 rows of pills before the strip itself starts to
     scroll vertically — keeps the panel from devouring the rest
     of the viewport when a scene has dozens of models. */
  max-height: 110px;
  overflow-y: auto;
  scrollbar-width: thin;
}
.xkt-sh-panel .xkt-sh-tabs::-webkit-scrollbar          { width: 6px; }
.xkt-sh-panel .xkt-sh-tabs::-webkit-scrollbar-thumb    { background: #d0d0d0; border-radius: 999px; }
.xkt-sh-panel .xkt-sh-tabs-empty {
  font-size: 11px;
  color: #888;
  font-style: italic;
  padding: 2px 4px;
}
.xkt-sh-panel .xkt-sh-tab {
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
.xkt-sh-panel .xkt-sh-tab:hover {
  background: #eef3f9;
  border-color: #c8d6e6;
}
.xkt-sh-panel .xkt-sh-tab.xkt-sh-tab-active {
  background: #2d5e8c;
  border-color: #1f4669;
  color: #fff;
}
.xkt-sh-panel .xkt-sh-tab-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  max-width: 18ch;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-sh-panel .xkt-sh-tab-count {
  font-variant-numeric: tabular-nums;
  font-size: 10px;
  font-weight: 500;
  opacity: 0.75;
}

/* Status dot — at-a-glance health for each model. Filled colour
   for error / warning / healthy; hollow for pending /
   unknown so the eye reads them as "no answer yet". The dot
   keeps its full saturation on the active (filled) tab too —
   the dark-blue background is dimmer than any of the dot
   colours, so they stay legible. */
.xkt-sh-panel .xkt-sh-tab-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #d0d0d0;
  border: 1px solid #b8b8b8;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.85);
}
.xkt-sh-panel .xkt-sh-tab-dot[data-status="error"]   { background: #c8332c; border-color: #8d231d; }
.xkt-sh-panel .xkt-sh-tab-dot[data-status="warning"] { background: #d6a020; border-color: #97700a; }
.xkt-sh-panel .xkt-sh-tab-dot[data-status="healthy"] { background: #2c8f55; border-color: #1c5a35; }
.xkt-sh-panel .xkt-sh-tab-dot[data-status="pending"] {
  background: transparent;
  border-color: #2d5e8c;
  animation: xkt-sh-tab-pulse 1s ease-in-out infinite;
}
.xkt-sh-panel .xkt-sh-tab-dot[data-status="unknown"] { background: transparent; }
@keyframes xkt-sh-tab-pulse {
  0%, 100% { opacity: 0.35; }
  50%      { opacity: 1; }
}

/* Inline issue counter — small chip after the object count when
   a model has errors or warnings. Suppressed for healthy /
   pending / unknown (the dot already says it). */
.xkt-sh-panel .xkt-sh-tab-issues {
  font-variant-numeric: tabular-nums;
  font-size: 10px;
  font-weight: 650;
  padding: 0 4px;
  border-radius: 3px;
  letter-spacing: 0.2px;
}
.xkt-sh-panel .xkt-sh-tab-issues-error { background: #fdf3f3; color: #a02020; border: 1px solid #f3d7d7; }
.xkt-sh-panel .xkt-sh-tab-issues-warn  { background: #fff8e1; color: #6b5300; border: 1px solid #f0e3b0; }
/* On the active (dark-blue) tab, swap to translucent overlays
   so the chips don't fight the navy background. */
.xkt-sh-panel .xkt-sh-tab-active .xkt-sh-tab-issues-error { background: rgba(255, 220, 220, 0.18); color: #ffd9d6; border-color: rgba(255, 200, 200, 0.35); }
.xkt-sh-panel .xkt-sh-tab-active .xkt-sh-tab-issues-warn  { background: rgba(255, 240, 200, 0.18); color: #ffeaa6; border-color: rgba(255, 230, 170, 0.35); }
/* Active tab: outline the dot in white so it pops against the
   navy fill. */
.xkt-sh-panel .xkt-sh-tab-active .xkt-sh-tab-dot {
  box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.9);
}
`;


// ─────────────────────────────────────────────────────────────────
// Module state — only the singleton CSS-injection flag. All other
// state lives on instances.
// ─────────────────────────────────────────────────────────────────

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
// Internal types
// ─────────────────────────────────────────────────────────────────

interface FixRunLogEntry {
  timestamp: string;
  actionLabel: string;
  codes?: string[];
  result?: ApplyFixesResult;
  error?: string;
}

interface PanelOpenState {
  openCodes: Set<string>;
  closedImpacts: Set<string>;
  isFirstRender: boolean;
}

interface LastFixOutcome {
  fixed: number;
  skipped: number;
  errors: number;
}

type StatRow = readonly [label: string, value: number];

interface ProgressState {
  label?: string;
  current?: number;
  total?: number;
  indeterminate?: boolean;
}


// ─────────────────────────────────────────────────────────────────
// SceneHealthPanel
// ─────────────────────────────────────────────────────────────────

export class SceneHealthPanel extends FloatingPanelBase {

  /**
   * Per-SceneModel instance registry — keeps the right-click
   * `Inspect Model` menu entry self-mounting. The static
   * {@link openFor} helper looks an instance up here before
   * constructing a fresh one, so the menu can be wired into any
   * example without each example also having to construct its own
   * panel up-front. WeakMap so a SceneModel that gets dropped
   * doesn't keep the panel alive for GC.
   */
  private static readonly _instances = new WeakMap<Scene, SceneHealthPanel>();

  /**
   * Returns the existing live panel bound to `sceneModel`, or
   * `undefined` if none has been constructed (or the prior
   * instance was destroyed). Lets callers ask "is there already
   * a panel here?" without triggering the show + inspect side
   * effects that {@link openFor} performs.
   */
  /**
   * Returns the existing live panel bound to a Scene, or
   * `undefined` if none has been constructed. Accepts either a
   * `Scene` directly or a `SceneModel` (its `.scene` is used).
   */
  static getFor(target: Scene | SceneModel): SceneHealthPanel | undefined {
    const scene = (target as any).scene ?? target;
    const inst = SceneHealthPanel._instances.get(scene as Scene);
    return inst && !inst._destroyed ? inst : undefined;
  }

  /**
   * SVG markup for the panel's title-bar glyph (tick-in-a-box).
   * Strokes use `currentColor`, so the icon picks up whichever
   * colour the host element sets — the panel's title bar paints
   * it primary blue; the right-click context menu uses the
   * same colour via its own CSS rule.
   *
   * Single source of truth — both `_buildDom` and any external
   * caller (e.g. `ViewObjectContextMenu`) read from this one
   * method.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="3.5" y="3.5" width="17" height="17" rx="2" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<path d="M 7 12 L 10.5 15.5 L 17 8.5" ` +
            `fill="none" stroke="currentColor" stroke-width="1.8" ` +
            `stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;
  }

  /**
   * Reveal (or lazily mount) a panel for `sceneModel`, run an
   * inspection, and return the instance. Idempotent — if a panel
   * already exists for this SceneModel and is still alive, it's
   * brought back to the foreground; otherwise a fresh one is
   * constructed.
   *
   * Built for the `ViewObjectContextMenu` "Inspect Model" entry,
   * which works in *every* example regardless of whether the
   * host has set up its own SceneHealthPanel — clicking
   * the menu item always opens a panel.
   */
  static openFor(params: SceneHealthPanelParams): SceneHealthPanel {
    const focus = params.focusSceneModel;
    const scene = params.scene ?? (focus ? focus.scene : undefined);
    if (!scene) {
      throw new Error("SceneHealthPanel.openFor: scene or focusSceneModel is required");
    }
    let inst = SceneHealthPanel._instances.get(scene);
    if (inst && !inst._destroyed) {
      inst.show();
      // Switch focus to the requested model when supplied — same
      // panel; user clicked Inspect on a different SceneModel.
      if (focus && inst.sceneModel !== focus) inst.focusModel(focus);
      else if (!inst._activeController) void inst.inspect("Inspecting model");
      return inst;
    }
    inst = new SceneHealthPanel(params);
    void inst.inspect("Inspecting model");
    return inst;
  }

  /**
   * Scene the panel is bound to. Stable across the panel's
   * lifetime; the user-facing surface that changes is which
   * {@link sceneModel} is currently focused.
   */
  readonly scene: Scene;

  /**
   * SceneModel currently being inspected. Mutated by
   * {@link focusModel} as the user picks a different model from
   * the tab strip; readers should treat it as the panel's
   * "current target".
   */
  sceneModel!: SceneModel;
  private readonly _view: View | undefined;
  private readonly _studio: Studio | undefined;

  // Panel + pill DOM roots.

  // Element refs that the render functions need to address.
  private _progressEl!: HTMLElement;
  private _progressLabel!: HTMLElement;
  private _progressBar!: HTMLProgressElement;
  private _progressCancel!: HTMLButtonElement;
  private _modelTabsEl!: HTMLElement;
  private _healthCard!: HTMLElement;
  private _healthStatus!: HTMLElement;
  private _healthCounts!: HTMLElement;
  private _healthRec!: HTMLElement;
  private _fixAllBtn!: HTMLButtonElement;
  private _getReportBtn!: HTMLButtonElement;
  private _clearLocateBtn!: HTMLButtonElement;
  private _statsEl!: HTMLElement;
  private _inspectionsPanel!: HTMLDetailsElement;
  private _inspectionsBody!: HTMLElement;
  private _inspectionsCount!: HTMLElement;
  private _inspectionsEnableAll!: HTMLButtonElement;
  private _inspectionsDisableAll!: HTMLButtonElement;
  private _issuesEl!: HTMLElement;
  private _fixHistory!: HTMLDetailsElement;
  private _fixHistoryCount!: HTMLElement;
  private _fixHistoryGet!: HTMLButtonElement;
  private _fixEntries!: HTMLElement;
  private _footerEl!: HTMLElement;
  private _footerMessage!: HTMLElement;
  private _reInspectBtn!: HTMLButtonElement;

  // Mutable state.
  private _activeController: AbortController | null = null;
  private _lastReport: InspectionReport | null = null;
  private _baselineStats: ReadonlyArray<StatRow> | null = null;
  private readonly _fixRunLog: FixRunLogEntry[] = [];
  private readonly _lastFixResultByCode = new Map<string, LastFixOutcome>();
  /**
   * `localStorage` key under which user-tuned inspection overrides
   * are persisted as the {@link InspectionRegistry.serializeConfigs}
   * blob. Set to `null` to opt out of persistence (used by tests).
   */
  private readonly _overridesStorageKey: string | null = "xkt-sh-inspection-overrides";

  /** Debounce handle for {@link _persistInspectionOverrides}. */
  private _persistTimer: number | null = null;

  // Drag state.

  // Live-sync handles. Subscribed in the constructor; cleared in
  // destroy. Per-rAF coalescing avoids one repaint per event when
  // the helper bulk-loads several models in the same frame.
  private readonly _sceneUnsubs: Array<() => void> = [];
  private _modelsRefreshScheduled = false;

  /**
   * Per-model inspection summaries powering the at-a-glance
   * status dots in the tab strip. Populated by
   * {@link _runBackgroundInspections} for every loaded model
   * other than the foreground-focused one (which gets its
   * summary from the main `inspect()` run). `"running"`
   * indicates an inspection is in-flight so the tab can show
   * a pending state instead of "unknown".
   */
  private readonly _modelSummaries = new Map<string, ModelHealthSummary | "running">();

  /**
   * AbortController for the background inspection sweep —
   * cancelled when models are torn down or the panel is
   * destroyed so we never write a stale summary back into
   * {@link _modelSummaries} after the model has gone.
   */
  private _backgroundController: AbortController | null = null;

  // Bound listeners we need to remove on destroy.
  private readonly _onInspectModelEvent = (ev: Event): void => {
    const detail = (ev as CustomEvent).detail;
    if (!detail || detail.sceneModel !== this.sceneModel) return;
    this.show();
    if (this._activeController) return;
    void this.inspect("Inspecting model");
  };

  constructor(params: SceneHealthPanelParams) {
    if (!params) {
      throw new Error("SceneHealthPanel: params required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-sh-panel",
      classPrefix: "xkt-sh",
    });
    const focus = params.focusSceneModel;
    const scene = params.scene ?? (focus ? focus.scene : undefined);
    if (!scene) {
      throw new Error("SceneHealthPanel: scene or focusSceneModel is required");
    }
    this.scene       = scene;
    // Pick an initial focus: the explicitly-requested SceneModel
    // when alive, else the first SceneModel in the Scene, else
    // null (panel renders an empty-state until the first model
    // shows up via the onSceneModelCreated listener wired below).
    const initial = (focus && !focus.destroyed) ? focus : firstAliveSceneModel(scene);
    if (initial) this.sceneModel = initial;
    this._view       = params.view;
    this._studio = params.studio;

    // Replace any prior instance bound to the same Scene — an old
    // panel left over from a hot-reload / re-import would
    // otherwise stick around with stale DOM. The registry gates
    // SceneHealthPanel.openFor's idempotence.
    const prior = SceneHealthPanel._instances.get(scene);
    if (prior && !prior._destroyed) prior.destroy();
    SceneHealthPanel._instances.set(scene, this);

    injectStylesOnce();

    // Seed the inspection registry. Application order is panel
    // defaults → persisted localStorage → caller-supplied
    // inspectParams, with `loadConfigs` and `setConfig` both
    // merging per-inspection so a later layer only overwrites
    // the keys it actually declares.
    this._seedRegistryFromParams(DEFAULT_INSPECT_PARAMS);
    this._loadInspectionOverrides();
    if (params.inspectParams) {
      this._seedRegistryFromParams(params.inspectParams);
      // Persist the caller's seed so the next session sees them
      // without needing the caller to re-supply.
      this._persistInspectionOverrides();
    }
    this._buildDom();
    this._bindChrome();
    this._applyInitialPosition(params);
    this._wireEvents();
    this._renderInspectionsPanel();

    document.addEventListener("xeokit:inspect-model", this._onInspectModelEvent);

    if (params.visible === false) {
      this.hide();
    } else {
      // `_restoreLayout` (called from `_bindChrome` above) may have
      // re-applied a `{hidden: true}` from a prior session's
      // close-click. Without an explicit show here, the first
      // open-from-menu wouldn't actually reveal the panel — the
      // user would have to click again to hit the
      // already-instantiated `inst.show()` branch in `openFor`.
      this.show();
    }

    // Initial paint of the model-tabs strip + per-model stats.
    this._renderModelTabs();
    if (this.sceneModel) this._renderStats();
    this._attachSceneListeners();
    // Sweep every loaded model for warnings / errors so the tab
    // strip can show health dots without waiting for the user to
    // click each tab. Foreground-focused model is skipped — its
    // summary is recorded by the main `inspect()` run.
    this._kickBackgroundInspections();
  }

  private _applyInitialPosition(params: SceneHealthPanelParams): void {
    if (params.initialTop === undefined && params.initialRight === undefined) {
      return;
    }

    const style = this._panel.style;
    if (params.initialTop !== undefined) {
      style.top = `${params.initialTop}px`;
    }
    if (params.initialRight !== undefined) {
      style.right = `${params.initialRight}px`;
      style.left = "auto";
    }
    style.bottom = "auto";
    style.transform = "none";
  }


  // ── Public API ────────────────────────────────────────────────

  /**
   * `true` when the floating panel is mounted and visible. `false`
   * when the user has dismissed it via the close button (the pill
   * is showing instead).
   */
  get visible(): boolean {
    return this._panel.style.display !== "none";
  }

  /**
   * Run an async inspection against {@link sceneModel}, render the
   * report into the panel, and return it. Returns `null` if the
   * user cancelled the run via the progress strip.
   *
   * @param stageLabel Optional label shown on the progress strip
   *                   while the inspection runs. Defaults to
   *                   "Inspecting model".
   */
  async inspect(stageLabel = "Inspecting model"): Promise<InspectionReport | null> {
    if (this._destroyed) return null;
    if (!this.sceneModel) return null;     // empty Scene — nothing to inspect
    const report = await this._runInspect(stageLabel);
    if (report) {
      // First successful inspect baselines the stats so post-fix
      // delta chips have an anchor to measure against.
      if (!this._baselineStats) this._baselineStats = this._collectStats();
      this._renderReport(report);
      // Update the tab strip's health dot for the focused model.
      if (this.sceneModel) {
        this._modelSummaries.set(String(this.sceneModel.id), summariseReport(report));
        this._renderModelTabs();
      }
    }
    return report;
  }

  /** Reveal the panel; hide the floating reopen pill. */
  show(): void {
    if (this._destroyed) return;
    super.show();
  }

  /** Hide the panel and surface the floating reopen pill instead. */
  hide(): void {
    if (this._destroyed) return;
    super.hide();
  }

  /** Toggle visibility. */
  toggle(): void {
    if (this.visible) this.hide(); else this.show();
  }

  /** Tear down DOM and global listeners. Idempotent. */
  destroy(): void {
    if (this._destroyed) return;
    if (this._activeController) {
      this._activeController.abort();
      this._activeController = null;
    }
    if (this._backgroundController) {
      this._backgroundController.abort();
      this._backgroundController = null;
    }
    if (this._persistTimer !== null) {
      window.clearTimeout(this._persistTimer);
      this._persistTimer = null;
    }
    this._detachSceneListeners();
    if (SceneHealthPanel._instances.get(this.scene) === this) {
      SceneHealthPanel._instances.delete(this.scene);
    }
    document.removeEventListener("xeokit:inspect-model", this._onInspectModelEvent);
    super.destroy();
  }

  /**
   * Switch the panel's focused SceneModel — re-paints the tab
   * strip and the stats grid, clears the previous run's report
   * baseline + fix history (they belong to the old model), and
   * triggers a fresh inspection. Cheap when the requested model
   * matches the current focus (no-op).
   */
  focusModel(sceneModel: SceneModel): void {
    if (this._destroyed) return;
    if (sceneModel.scene !== this.scene) {
      console.warn("[SceneHealthPanel.focusModel] SceneModel belongs to a different Scene; ignored");
      return;
    }
    if (this.sceneModel === sceneModel) return;
    if (this._activeController) {
      this._activeController.abort();
      this._activeController = null;
    }
    this.sceneModel = sceneModel;
    // Reset per-model state: previous baseline / fix log / report
    // belonged to the old SceneModel and would otherwise produce
    // misleading delta chips in the new model's stats grid.
    this._baselineStats = null;
    this._fixRunLog.length = 0;
    this._lastFixResultByCode.clear();
    this._lastReport = null;
    this._renderModelTabs();
    this._renderStats();
    void this.inspect("Inspecting model");
  }


  // ── Scene live-sync ───────────────────────────────────────────

  /**
   * Subscribe to `Scene.onSceneModelCreated` and
   * `onSceneModelDestroyed` so the model tabs stay in lockstep
   * with the live Scene contents — a model loads, a tab appears;
   * the focused model is destroyed, the panel auto-falls back to
   * the next available model. Subscribed for the panel's whole
   * lifetime (cheap — just two callbacks, coalesced into one
   * `requestAnimationFrame` repaint).
   */
  private _attachSceneListeners(): void {
    const ev: any = (this.scene as any).events;
    if (!ev) return;
    const sub = (unsub: () => void) => this._sceneUnsubs.push(unsub);
    if (ev.onSceneModelCreated?.subscribe) {
      sub(ev.onSceneModelCreated.subscribe(() => this._scheduleModelsRefresh()));
    }
    if (ev.onSceneModelDestroyed?.subscribe) {
      sub(ev.onSceneModelDestroyed.subscribe((_s: any, sm: SceneModel) => {
        this._scheduleModelsRefresh(sm);
      }));
    }
  }

  private _detachSceneListeners(): void {
    for (const u of this._sceneUnsubs) {
      try { u(); } catch { /* ignore */ }
    }
    this._sceneUnsubs.length = 0;
    this._modelsRefreshScheduled = false;
  }

  /**
   * Coalesce per-model create/destroy notifications into one
   * tab-strip repaint per animation frame. When the *focused*
   * model is the one being destroyed, switch focus to the first
   * surviving model so the lower panes don't render against a
   * stale reference.
   */
  private _scheduleModelsRefresh(destroyed?: SceneModel): void {
    if (this._destroyed) return;
    // Drop any cached summary for a destroyed model so a re-load
    // with the same id doesn't render the corpse's last status.
    if (destroyed) this._modelSummaries.delete(String(destroyed.id));
    // Eagerly handle focus loss — even before the rAF — so any
    // synchronous render that fires next has a valid focus.
    if (destroyed && this.sceneModel === destroyed) {
      const next = firstAliveSceneModel(this.scene, destroyed);
      if (next) {
        // focusModel re-renders the tabs and runs the inspection,
        // so we don't need to schedule the rAF separately.
        this.focusModel(next);
        return;
      }
      // No surviving model — clear focus + reset stats. The empty
      // tab strip + empty health card communicate the state.
      (this as any).sceneModel = undefined;
      this._baselineStats = null;
      this._lastReport = null;
      this._fixRunLog.length = 0;
      this._lastFixResultByCode.clear();
    }
    if (this._modelsRefreshScheduled) return;
    this._modelsRefreshScheduled = true;
    requestAnimationFrame(() => {
      this._modelsRefreshScheduled = false;
      if (this._destroyed) return;
      this._renderModelTabs();
      // If we previously had no focus and a model just landed,
      // pick it up automatically.
      if (!this.sceneModel) {
        const next = firstAliveSceneModel(this.scene);
        if (next) this.focusModel(next);
      }
      // New model(s) → sweep them for warnings / errors so their
      // tab dots come up green/amber/red rather than staying
      // pending forever.
      this._kickBackgroundInspections();
    });
  }

  /**
   * Sweep every loaded SceneModel for warnings + errors so the
   * tab strip can flag at-a-glance which models need attention.
   *
   * Sequential rather than parallel — `inspectSceneModelAsync`
   * cooperatively yields, so a parallel sweep would just trade
   * one main-thread blocker for many. Skips the foreground
   * focus (its summary is recorded by `inspect()` once that
   * completes), models whose summary is already cached, and
   * models whose inspection is already in flight.
   *
   * Cancellable via {@link _backgroundController}; we abort + replace
   * on every kick so a model destroyed mid-sweep doesn't write a
   * stale summary back into the cache.
   */
  private _kickBackgroundInspections(): void {
    if (this._destroyed) return;
    if (this._backgroundController) {
      this._backgroundController.abort();
    }
    const ctrl = new AbortController();
    this._backgroundController = ctrl;

    void this._runBackgroundInspections(ctrl);
  }

  private async _runBackgroundInspections(ctrl: AbortController): Promise<void> {
    const models = listAliveSceneModels(this.scene);
    for (const sm of models) {
      if (ctrl.signal.aborted || this._destroyed) return;
      const id = String(sm.id);
      if (sm === this.sceneModel) continue;       // covered by foreground inspect()
      if (this._modelSummaries.has(id)) continue; // already done or in flight
      this._modelSummaries.set(id, "running");
      this._renderModelTabs();                    // show the pending dot
      try {
        const report = await inspectSceneModelAsync({
          sceneModel: sm,
          signal: ctrl.signal,
        } as any);
        if (ctrl.signal.aborted || this._destroyed) return;
        if (sm.destroyed) {
          // Model went away mid-inspection — drop the summary
          // so the tab strip doesn't render stale state when
          // another model with the same id loads later.
          this._modelSummaries.delete(id);
        } else {
          this._modelSummaries.set(id, summariseReport(report));
        }
      } catch (e: any) {
        if (ctrl.signal.aborted) return;
        // Inspection failed — record an "unknown" summary so the
        // tab dot stays grey rather than spinning forever.
        console.warn(`[SceneHealthPanel] Background inspection failed for '${id}':`, e?.message ?? e);
        this._modelSummaries.set(id, {state: "unknown", errors: 0, warnings: 0});
      }
      this._renderModelTabs();
    }
  }


  // ── Model tabs strip ──────────────────────────────────────────

  private _renderModelTabs(): void {
    if (!this._modelTabsEl) return;
    this._modelTabsEl.innerHTML = "";

    const models = listAliveSceneModels(this.scene);
    if (models.length === 0) {
      this._modelTabsEl.appendChild(el("div", "xkt-sh-tabs-empty", {
        textContent: "No SceneModels loaded",
      }));
      return;
    }

    // When several models share the same display label (because
    // their auto-generated `-${timestamp}` suffix has been
    // stripped — see displaySceneModelId), append a "(2)", "(3)"
    // counter so the tabs stay distinguishable. Counts are
    // assigned in tab order (i.e. by id sort), so the same model
    // gets the same disambiguator across renders.
    const labelCounts = new Map<string, number>();

    for (const sm of models) {
      const fullId = String(sm.id);
      const baseLabel = displaySceneModelId(fullId);
      const seen = (labelCounts.get(baseLabel) ?? 0) + 1;
      labelCounts.set(baseLabel, seen);
      const label = seen === 1 ? baseLabel : `${baseLabel} (${seen})`;

      // Status dot — error / warning / healthy / pending /
      // unknown — read from the per-model summary cache. The
      // dot is the at-a-glance signal: red on a tab means the
      // user should click in to see what's broken.
      const summary = this._modelSummaries.get(fullId);
      const state =
        summary === "running"           ? "pending"
        : summary === undefined          ? "unknown"
        : summary.state;
      const counts = summary && summary !== "running"
        ? {errors: summary.errors, warnings: summary.warnings}
        : {errors: 0, warnings: 0};

      const tab = el("button", "xkt-sh-tab", {
        type:  "button",
        title: tabTooltip(fullId, state, counts),
      }) as HTMLButtonElement;
      tab.setAttribute("data-status", state);
      if (sm === this.sceneModel) tab.classList.add("xkt-sh-tab-active");

      const dot = el("span", "xkt-sh-tab-dot");
      dot.setAttribute("data-status", state);
      tab.appendChild(dot);

      tab.appendChild(el("span", "xkt-sh-tab-id", {textContent: label}));

      // Optional quick stat — object count read off the live
      // SceneModelStats. Falls back gracefully when stats aren't
      // available yet (very early in load).
      const stats: any = (sm as any).stats;
      const objs = stats && Number.isFinite(stats.numObjects) ? stats.numObjects : null;
      if (objs !== null) {
        tab.appendChild(el("span", "xkt-sh-tab-count", {
          textContent: `${objs.toLocaleString()} objs`,
        }));
      }

      // When the model has issues, surface the count inline —
      // a small "12⚠" / "3✕" chip after the object count so
      // the user can compare severity across tabs without
      // hovering. Suppressed while pending / unknown / healthy
      // (those carry their state in the dot alone).
      if (state === "error" && counts.errors > 0) {
        tab.appendChild(el("span", "xkt-sh-tab-issues xkt-sh-tab-issues-error", {
          textContent: `${counts.errors} ✕`,
        }));
      } else if (state === "warning" && counts.warnings > 0) {
        tab.appendChild(el("span", "xkt-sh-tab-issues xkt-sh-tab-issues-warn", {
          textContent: `${counts.warnings} ⚠`,
        }));
      }

      tab.addEventListener("click", () => this.focusModel(sm));
      this._modelTabsEl.appendChild(tab);
    }
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-sh-pill", {
      type: "button",
      title: "Reopen the Scene Health panel",
      hidden: true,
      textContent: "Scene Health",
    });

    this._panel = el("div", "xkt-sh-panel");

    // Header (drag handle + title + close).
    this._header = el("div", "xkt-sh-header");
    // Title row: [tick-in-a-box icon] [panel name]. The
    // currently-focused SceneModel id no longer lives in the
    // title — it's communicated by the active tab in the
    // model-tabs strip below the header (see _renderModelTabs).
    const title = el("h2", "xkt-sh-title");
    title.innerHTML =
      `<span class="xkt-sh-title-icon">${SceneHealthPanel.iconSvg()}</span>` +
      `<span class="xkt-sh-title-stack">` +
        `<span class="xkt-sh-title-text">Scene Health</span>` +
        `<span class="xkt-sh-subtitle">Scene problems and one-click fixes.</span>` +
      `</span>`;
    this._closeBtn = el("button", "xkt-sh-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;
    this._header.append(title, this._closeBtn);
    this._panel.appendChild(this._header);

    // Model tabs — one chip per loaded SceneModel. Re-rendered
    // on focus changes and on scene.events.onSceneModelCreated /
    // onSceneModelDestroyed so the strip stays in sync with the
    // live Scene contents.
    this._modelTabsEl = el("div", "xkt-sh-tabs");
    this._panel.appendChild(this._modelTabsEl);

    // Progress strip.
    this._progressEl = el("div", "xkt-sh-progress xkt-sh-idle");
    this._progressLabel = el("div", "xkt-sh-progress-label", {textContent: "Ready"});
    this._progressBar = el("progress", "xkt-sh-progress-bar") as HTMLProgressElement;
    this._progressBar.max = 1;
    this._progressBar.value = 0;
    this._progressCancel = el("button", "xkt-sh-progress-cancel", {
      type: "button",
      title: "Abort the running inspection / fix",
      hidden: true,
      textContent: "Cancel",
    }) as HTMLButtonElement;
    this._progressEl.append(this._progressLabel, this._progressBar, this._progressCancel);
    this._panel.appendChild(this._progressEl);

    // Health card.
    this._healthCard = el("div", "xkt-sh-health");
    this._healthCard.setAttribute("data-state", "loading");
    const healthRow1 = el("div", "xkt-sh-health-row1");
    this._healthStatus = el("div", "xkt-sh-health-status", {textContent: "Inspecting…"});
    this._healthCounts = el("div", "xkt-sh-health-counts");
    healthRow1.append(this._healthStatus, this._healthCounts);
    this._healthRec = el("div", "xkt-sh-health-rec");
    this._healthCard.append(healthRow1, this._healthRec);
    this._panel.appendChild(this._healthCard);

    // Primary action row.
    const actions = el("div", "xkt-sh-actions");
    this._fixAllBtn = el("button", "xkt-sh-fix-all", {
      type: "button",
      textContent: "Fix All Issues",
    }) as HTMLButtonElement;
    this._fixAllBtn.disabled = true;
    this._getReportBtn = el("button", "xkt-sh-secondary", {
      type: "button",
      title: "Download the latest InspectionReport as JSON",
      textContent: "Report",
    }) as HTMLButtonElement;
    this._clearLocateBtn = el("button", "xkt-sh-secondary", {
      type: "button",
      title: "Restore default view state",
      textContent: "Clear",
    }) as HTMLButtonElement;
    actions.append(this._fixAllBtn, this._getReportBtn, this._clearLocateBtn);
    this._panel.appendChild(actions);

    // Stats grid.
    this._statsEl = el("div", "xkt-sh-stats");
    this._panel.appendChild(this._statsEl);

    // Inspections subpanel (collapsible).
    this._inspectionsPanel = el("details", "xkt-sh-inspections") as HTMLDetailsElement;
    const inspSummary = el("summary");
    const inspLabel = el("span", undefined, {textContent: "Inspections"});
    this._inspectionsCount = el("span", "xkt-sh-inspections-count");
    this._inspectionsEnableAll = el("button", "xkt-sh-inspections-toggle", {
      type: "button",
      title: "Enable every inspection",
      textContent: "All",
    }) as HTMLButtonElement;
    this._inspectionsDisableAll = el("button", "xkt-sh-inspections-toggle", {
      type: "button",
      title: "Disable every inspection",
      textContent: "None",
    }) as HTMLButtonElement;
    inspSummary.append(inspLabel, this._inspectionsCount, this._inspectionsEnableAll, this._inspectionsDisableAll);
    this._inspectionsBody = el("div", "xkt-sh-inspections-body");
    this._inspectionsPanel.append(inspSummary, this._inspectionsBody);
    this._panel.appendChild(this._inspectionsPanel);

    // Issues tree.
    this._issuesEl = el("div", "xkt-sh-issues");
    this._panel.appendChild(this._issuesEl);

    // Fix history (collapsible).
    this._fixHistory = el("details", "xkt-sh-fix-history") as HTMLDetailsElement;
    const fhSummary = el("summary");
    const fhLabel = el("span", "xkt-sh-fix-history-label", {textContent: "Fix History"});
    this._fixHistoryCount = el("span", "xkt-sh-fix-history-count", {textContent: "0 runs"});
    this._fixHistoryGet = el("button", "xkt-sh-fix-history-get", {
      type: "button",
      title: "Download every applyFixes run since page load as JSON",
      textContent: "Get Report",
    }) as HTMLButtonElement;
    fhSummary.append(fhLabel, this._fixHistoryCount, this._fixHistoryGet);
    this._fixEntries = el("div", "xkt-sh-fix-history-entries");
    this._fixHistory.append(fhSummary, this._fixEntries);
    this._panel.appendChild(this._fixHistory);

    // Footer next-step.
    this._footerEl = el("div", "xkt-sh-footer");
    this._footerEl.hidden = true;
    this._footerMessage = el("span", "xkt-sh-footer-message");
    this._reInspectBtn = el("button", "xkt-sh-re-inspect", {
      type: "button",
      textContent: "Re-run Inspection",
    }) as HTMLButtonElement;
    this._footerEl.append(this._footerMessage, this._reInspectBtn);
    this._panel.appendChild(this._footerEl);

    // Mount.
    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }

  private _wireEvents(): void {
    // Progress cancel.
    this._progressCancel.addEventListener("click", () => {
      if (this._activeController) this._activeController.abort();
    });

    // Reports + actions.
    this._getReportBtn.addEventListener("click", () => {
      if (!this._lastReport) return;
      const json = inspectionReportToJson(this._lastReport);
      downloadJson(json, `inspection-report-${nowStamp()}.json`);
    });
    this._clearLocateBtn.addEventListener("click", () => {
      this._clearLocate();
      if (this._studio && this._view) {
        const aabb = this._studio.picking.collisionIndex.getSceneAABB();
        if (aabb) this._studio.viewManager.fitToAabb(this._view, aabb);
      }
    });
    this._fixAllBtn.addEventListener("click", () => {
      if (!this._lastReport) return;
      const fixableCodes = this._currentFixableCodes(this._lastReport);
      if (fixableCodes.length === 0) return;
      void this._fixCodes(fixableCodes, "Fix all issues");
    });
    this._fixHistoryGet.addEventListener("click", () => {
      const json = this._buildFixResultsReport();
      downloadJson(json, `fix-results-${nowStamp()}.json`);
    });
    this._reInspectBtn.addEventListener("click", async () => {
      if (this._activeController) return;
      this._footerEl.hidden = true;
      const r = await this._runInspect("Re-inspecting");
      if (r) this._renderReport(r);
    });

    // Inspections subpanel toggles.
    this._inspectionsEnableAll.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      this._setAllInspectionsEnabled(true);
    });
    this._inspectionsDisableAll.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      this._setAllInspectionsEnabled(false);
    });
  }


  // ── Layout persistence ────────────────────────────────────────



  // ── Inspect / fix orchestration ───────────────────────────────

  private async _runInspect(stageLabel: string): Promise<InspectionReport | null> {
    if (this._activeController) return null;
    const controller = new AbortController();
    this._activeController = controller;
    try {
      this._showProgress({label: `${stageLabel}…`, indeterminate: true});
      return await inspectSceneModelAsync({
        sceneModel: this.sceneModel,
        registry: DEFAULT_INSPECTION_REGISTRY,
        signal: controller.signal,
        onProgress: ({current, total, label, phase}) => {
          if (phase === "before") {
            this._showProgress({label: `${stageLabel}: ${label}`, current, total});
          }
        },
      });
    } catch (err: any) {
      if (err && err.name === "AbortError") return null;
      console.error(err);
      return null;
    } finally {
      this._hideProgress();
      this._activeController = null;
    }
  }

  private async _fixCodes(codes: string[], actionLabel: string): Promise<void> {
    if (this._activeController) return;
    const controller = new AbortController();
    this._activeController = controller;
    try {
      this._showProgress({label: "Inspecting (pre-fix)…", indeterminate: true});
      const report = await inspectSceneModelAsync({
        sceneModel: this.sceneModel,
        registry: DEFAULT_INSPECTION_REGISTRY,
        signal: controller.signal,
        onProgress: ({current, total, label, phase}) => {
          if (phase === "before") {
            this._showProgress({label: `Inspecting: ${label}`, current, total});
          }
        },
      });
      this._showProgress({label: "Applying fixes…", current: 0, total: report.issues.length});
      const fixRes = await applyFixesAsync({
        sceneModel: this.sceneModel,
        report,
        codes,
        signal: controller.signal,
        onProgress: ({current, total, label, phase}) => {
          if (phase === "before") {
            this._showProgress({label: `Fixing: ${label}`, current, total});
          }
        },
      });
      if (fixRes.ok === false) {
        this._logFixError(actionLabel, fixRes.error, codes);
        return;
      }
      this._logFixRun(actionLabel, fixRes.value, codes);

      this._clearLocate();

      this._showProgress({label: "Re-inspecting (post-fix)…", indeterminate: true});
      const after = await inspectSceneModelAsync({
        sceneModel: this.sceneModel,
        registry: DEFAULT_INSPECTION_REGISTRY,
        signal: controller.signal,
        onProgress: ({current, total, label, phase}) => {
          if (phase === "before") {
            this._showProgress({label: `Inspecting: ${label}`, current, total});
          }
        },
      });
      this._renderReport(after);
    } catch (err: any) {
      if (err && err.name === "AbortError") {
        this._logFixError(actionLabel, "Cancelled by user — model state may be partially mutated", codes);
        try {
          const after = inspectSceneModel({
            sceneModel: this.sceneModel,
            registry: DEFAULT_INSPECTION_REGISTRY,
          });
          this._renderReport(after);
        } catch { /* swallow */ }
      } else {
        this._logFixError(actionLabel, (err && err.message) || String(err), codes);
      }
    } finally {
      this._hideProgress();
      this._activeController = null;
    }
  }

  private async _fixSingleIssue(issue: Issue): Promise<void> {
    if (this._activeController) return;
    const actionLabel = `Fix '${issue.resourceId || "?"}' — ${labelForCode(issue.code)}`;
    const controller = new AbortController();
    this._activeController = controller;
    try {
      const oneReport: InspectionReport = {
        issues:   [issue],
        errors:   issue.severity === "error"   ? [issue] : [],
        warnings: issue.severity === "warning" ? [issue] : [],
        info:     issue.severity === "info"    ? [issue] : [],
        byCode:   new Map([[issue.code, [issue]]]),
      };
      this._showProgress({label: `Fixing: ${issue.code}`, current: 0, total: 1});
      const fixRes = await applyFixesAsync({
        sceneModel: this.sceneModel,
        report: oneReport,
        signal: controller.signal,
        onProgress: ({current, total, label, phase}) => {
          if (phase === "before") {
            this._showProgress({label: `Fixing: ${label}`, current, total});
          }
        },
      });
      if (fixRes.ok === false) {
        this._logFixError(actionLabel, fixRes.error, [issue.code]);
        return;
      }
      this._logFixRun(actionLabel, fixRes.value, [issue.code]);

      this._clearLocate();

      this._showProgress({label: "Re-inspecting (post-fix)…", indeterminate: true});
      const after = await inspectSceneModelAsync({
        sceneModel: this.sceneModel,
        registry: DEFAULT_INSPECTION_REGISTRY,
        signal: controller.signal,
        onProgress: ({current, total, label, phase}) => {
          if (phase === "before") {
            this._showProgress({label: `Inspecting: ${label}`, current, total});
          }
        },
      });
      this._renderReport(after);
    } catch (err: any) {
      if (err && err.name === "AbortError") {
        this._logFixError(actionLabel, "Cancelled by user", [issue.code]);
      } else {
        this._logFixError(actionLabel, (err && err.message) || String(err), [issue.code]);
      }
    } finally {
      this._hideProgress();
      this._activeController = null;
    }
  }


  // ── Inspection toggles ────────────────────────────────────────

  /**
   * `true` when the inspection would run under the current
   * registry + per-call overrides. Mirrors what the orchestrator
   * computes when it merges
   * `{...registry.getConfig(insp), ...params}` and passes the
   * result through `resolveConfig`.
   *
   * Inspections without a `config` schema are always enabled —
   * `resolveConfig(undefined, …)` returns `{enabled: true}`.
   */
  private _isInspectionEnabled(insp: Inspection): boolean {
    return resolveConfig(insp.config, DEFAULT_INSPECTION_REGISTRY.getConfig(insp)).enabled;
  }

  /**
   * Walk a flat `InspectSceneModelParams`-shaped bag and fold any
   * schema-keyed fields into the registry's stored config. The
   * same key can appear on multiple inspections' schemas (e.g.
   * `maxOriginDistance` on both `objectPlacement` and
   * `farFromOriginGeometries`); each schema-having inspection
   * that recognises a key picks that key up.
   *
   * Unrecognised fields are silently ignored — non-schema params
   * like `signal` / `onProgress` have no slot in the registry.
   */
  private _seedRegistryFromParams(bag: Partial<InspectSceneModelParams>): void {
    const flat = bag as Record<string, unknown>;
    for (const insp of DEFAULT_INSPECTION_REGISTRY.inspections()) {
      if (!insp.config) continue;
      const overrides: Record<string, unknown> = {};
      if (insp.config.enabled && insp.config.enabled.key in flat) {
        overrides[insp.config.enabled.key] = flat[insp.config.enabled.key];
      }
      for (const f of insp.config.fields ?? []) {
        if (f.key in flat) overrides[f.key] = flat[f.key];
      }
      if (Object.keys(overrides).length > 0) {
        DEFAULT_INSPECTION_REGISTRY.setConfig(insp, overrides);
      }
    }
  }

  private _renderInspectionsPanel(): void {
    const all = Array.from(DEFAULT_INSPECTION_REGISTRY.inspections());
    let on = 0;
    for (const insp of all) if (this._isInspectionEnabled(insp)) on++;
    this._inspectionsCount.textContent = `${on} / ${all.length}`;

    this._inspectionsBody.innerHTML = "";
    for (const insp of all) {
      // Each inspection row defaults to collapsed — only the
      // description shows. Clicking the chevron expands to reveal
      // the inspection codes and the threshold-fields form.
      const classes = ["xkt-sh-inspection-row", "xkt-sh-collapsed"];
      if (insp.optIn) classes.push("xkt-sh-opt-in");
      if (this._inspectionHasOverrides(insp)) classes.push("xkt-sh-modified");
      const row = el("label", classes.join(" "));
      const cb = el("input") as HTMLInputElement;
      cb.type = "checkbox";
      cb.checked = this._isInspectionEnabled(insp);
      cb.addEventListener("change", () => {
        if (insp.config?.enabled) {
          DEFAULT_INSPECTION_REGISTRY.setConfig(insp, {[insp.config.enabled.key]: cb.checked});
          this._persistInspectionOverrides();
        }
        void this._reInspectAfterToggle();
      });
      row.appendChild(cb);

      // Chevron toggles collapsed state. preventDefault on click
      // stops the surrounding `<label>` from flipping the
      // checkbox; stopPropagation belt-and-braces against any
      // future row-level click handlers.
      const chevron = el("button", "xkt-sh-inspection-chevron", {textContent: "›"}) as HTMLButtonElement;
      chevron.type = "button";
      chevron.setAttribute("aria-label", "Toggle inspection details");
      chevron.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        row.classList.toggle("xkt-sh-collapsed");
      });
      row.appendChild(chevron);

      const text = el("span", "xkt-sh-inspection-text");
      const desc = el("span", "xkt-sh-inspection-desc", {textContent: insp.description});
      text.appendChild(desc);
      const codes = el("span", "xkt-sh-inspection-codes");
      for (const c of insp.codes) {
        const line = document.createElement("span");
        const friendly = (insp.labels && insp.labels[c]) || c;
        line.innerHTML =
          `<strong>${escapeHtml(friendly)}</strong>` +
          ` <span class="xkt-sh-inspection-code-id">(${escapeHtml(c)})</span>`;
        codes.appendChild(line);
      }
      text.appendChild(codes);

      // Threshold form — one row per non-`enabled` schema field.
      // Inspections without `config.fields` render nothing extra,
      // so always-run / opt-in-only inspections look the same as
      // before.
      const fields = insp.config?.fields ?? [];
      if (fields.length > 0) {
        const form = el("div", "xkt-sh-inspection-fields");
        // Stop label-click → checkbox propagation so the user can
        // interact with form controls without flipping the
        // inspection on/off.
        form.addEventListener("click", (ev) => ev.preventDefault());
        for (const f of fields) {
          this._appendInspectionField(form, insp, f, row);
        }
        text.appendChild(form);
      }

      row.appendChild(text);
      this._inspectionsBody.appendChild(row);
    }
  }


  /**
   * Render one input control for a non-`enabled` schema field on
   * an inspection. Commits write through to
   * {@link DEFAULT_INSPECTION_REGISTRY} so the orchestrator's
   * merge layer (`schema-default < registry-stored < per-call`)
   * picks them up on the next pass, then debounce-persist + kick a
   * re-inspect.
   */
  private _appendInspectionField(
    host: HTMLElement,
    insp: Inspection,
    field: ConfigField,
    row: HTMLElement,
  ): void {
    const stored = DEFAULT_INSPECTION_REGISTRY.getConfig(insp);
    const labelEl = el("span", "xkt-sh-inspection-field-label", {textContent: field.label});
    const inputWrap = el("span", "xkt-sh-inspection-field-input");

    const commit = (value: boolean | number | string): void => {
      DEFAULT_INSPECTION_REGISTRY.setConfig(insp, {[field.key]: value});
      row.classList.toggle("xkt-sh-modified", this._inspectionHasOverrides(insp));
      this._persistInspectionOverrides();
      void this._reInspectAfterToggle();
    };

    if (field.kind === "number") {
      const input = document.createElement("input");
      input.type = "number";
      input.value = String(typeof stored?.[field.key] === "number" ? stored![field.key] : field.default);
      if (field.min  !== undefined) input.min  = String(field.min);
      if (field.max  !== undefined) input.max  = String(field.max);
      if (field.step !== undefined) input.step = String(field.step);
      // Eat clicks so they don't bubble to the row's <label> and
      // accidentally toggle the inspection's enabled state.
      input.addEventListener("click", (ev) => ev.stopPropagation());
      input.addEventListener("change", () => {
        const n = parseFloat(input.value);
        if (!Number.isFinite(n)) {
          const cur = DEFAULT_INSPECTION_REGISTRY.getConfig(insp);
          input.value = String(typeof cur?.[field.key] === "number" ? cur![field.key] : field.default);
          return;
        }
        commit(n);
      });
      inputWrap.appendChild(input);
      if (field.unit) {
        const unit = el("span", "xkt-sh-inspection-field-unit", {textContent: field.unit});
        inputWrap.appendChild(unit);
      }
    } else if (field.kind === "select") {
      const select = document.createElement("select");
      for (const opt of field.options) {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        select.appendChild(o);
      }
      const initial = stored?.[field.key];
      select.value = (typeof initial === "string" && field.options.some(o => o.value === initial))
        ? initial : field.default;
      select.addEventListener("click", (ev) => ev.stopPropagation());
      select.addEventListener("change", () => commit(select.value));
      inputWrap.appendChild(select);
    } else {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      const initial = stored?.[field.key];
      cb.checked = typeof initial === "boolean" ? initial : field.default;
      cb.addEventListener("click", (ev) => ev.stopPropagation());
      cb.addEventListener("change", () => commit(cb.checked));
      inputWrap.appendChild(cb);
    }

    if (field.description) {
      const desc = el("span", "xkt-sh-inspection-field-description", {textContent: field.description});
      host.appendChild(desc);
    }
    host.appendChild(labelEl);
    host.appendChild(inputWrap);
  }

  /**
   * `true` when at least one schema-keyed override is currently
   * stored on the registry for this inspection. Drives the "●"
   * marker on the row.
   */
  private _inspectionHasOverrides(insp: Inspection): boolean {
    const o = DEFAULT_INSPECTION_REGISTRY.getConfig(insp);
    return !!o && Object.keys(o).length > 0;
  }

  /**
   * Debounce stored-override writes to `localStorage`. Every
   * threshold tweak fires a `change`; coalescing them into a
   * single flush ~200 ms after the last edit keeps the call rate
   * down to once per tweak-burst.
   */
  private _persistInspectionOverrides(): void {
    if (this._overridesStorageKey === null) return;
    if (this._persistTimer !== null) window.clearTimeout(this._persistTimer);
    this._persistTimer = window.setTimeout(() => {
      this._persistTimer = null;
      try {
        const blob = DEFAULT_INSPECTION_REGISTRY.serializeConfigs();
        window.localStorage.setItem(this._overridesStorageKey!, JSON.stringify(blob));
      } catch {
        // Quota / disabled storage — keep in-memory state.
      }
    }, 200);
  }

  private _loadInspectionOverrides(): void {
    if (this._overridesStorageKey === null) return;
    try {
      const raw = window.localStorage.getItem(this._overridesStorageKey);
      if (!raw) return;
      const blob = JSON.parse(raw) as Record<string, Record<string, unknown>>;
      DEFAULT_INSPECTION_REGISTRY.loadConfigs(blob);
    } catch {
      // Corrupted blob — leave registry untouched.
    }
  }

  private async _reInspectAfterToggle(): Promise<void> {
    const all = Array.from(DEFAULT_INSPECTION_REGISTRY.inspections());
    let on = 0;
    for (const insp of all) if (this._isInspectionEnabled(insp)) on++;
    this._inspectionsCount.textContent = `${on} / ${all.length}`;
    const report = await this._runInspect("Re-inspecting");
    if (report) this._renderReport(report);
  }

  private _setAllInspectionsEnabled(enabled: boolean): void {
    for (const insp of DEFAULT_INSPECTION_REGISTRY.inspections()) {
      if (insp.config?.enabled) {
        DEFAULT_INSPECTION_REGISTRY.setConfig(insp, {[insp.config.enabled.key]: enabled});
      }
    }
    this._persistInspectionOverrides();
    this._renderInspectionsPanel();
    void this._reInspectAfterToggle();
  }


  // ── Progress UI ───────────────────────────────────────────────

  private _showProgress({label, current, total, indeterminate}: ProgressState): void {
    this._panel.classList.add("xkt-sh-busy");
    this._progressEl.classList.remove("xkt-sh-idle");
    this._progressEl.classList.add("xkt-sh-active");
    this._progressCancel.hidden = false;
    if (label !== undefined) this._progressLabel.textContent = label;
    if (indeterminate || typeof total !== "number" || total <= 0) {
      this._progressBar.removeAttribute("value");
    } else {
      this._progressBar.max   = total;
      this._progressBar.value = current ?? 0;
    }
  }

  private _hideProgress(): void {
    this._panel.classList.remove("xkt-sh-busy");
    this._progressEl.classList.remove("xkt-sh-active");
    this._progressEl.classList.add("xkt-sh-idle");
    this._progressCancel.hidden = true;
    this._progressLabel.textContent = "Ready";
    this._progressBar.max = 1;
    this._progressBar.value = 0;
  }


  // ── Locate (viewer integration) ───────────────────────────────

  private _locate(objectIds: string[]): void {
    if (!this._view || objectIds.length === 0) return;
    const view = this._view;
    const allIds = Object.keys(view.objects);
    view.setObjectsHighlighted(allIds, false);
    view.setObjectsXRayed(allIds, true);
    view.setObjectsXRayed(objectIds, false);
    view.setObjectsHighlighted(objectIds, true);

    if (!this._studio) return;
    const idx = this._studio.picking.collisionIndex;
    let union: number[] | null = null;
    for (const id of objectIds) {
      const a = idx.getObjectAABB(id);
      if (!a) continue;
      if (!union) {
        union = [a[0], a[1], a[2], a[3], a[4], a[5]];
      } else {
        if (a[0] < union[0]) union[0] = a[0];
        if (a[1] < union[1]) union[1] = a[1];
        if (a[2] < union[2]) union[2] = a[2];
        if (a[3] > union[3]) union[3] = a[3];
        if (a[4] > union[4]) union[4] = a[4];
        if (a[5] > union[5]) union[5] = a[5];
      }
    }
    if (union) {
      const cf = this._studio.viewManager.views[view.id].cameraFlight;
      cf.flyTo({aabb: union as any, duration: 0.5, fitFOV: 50});
    }
  }

  private _clearLocate(): void {
    if (!this._view) return;
    const allIds = Object.keys(this._view.objects);
    this._view.setObjectsHighlighted(allIds, false);
    this._view.setObjectsXRayed(allIds, false);
  }


  // ── Stats ─────────────────────────────────────────────────────

  private _collectStats(): StatRow[] {
    const sm = this.sceneModel;
    const s = sm.stats;
    let withNormals = 0;
    let withUVs = 0;
    for (const id in sm.geometries) {
      const g: any = sm.geometries[id];
      if (g.destroyed) continue;
      if (g.normalsCompressed && g.normalsCompressed.length > 0) withNormals++;
      if (g.uvsCompressed     && g.uvsCompressed.length     > 0) withUVs++;
    }
    return [
      ["Objects",     s.numObjects],
      ["Meshes",      s.numMeshes],
      ["Geometries",  s.numGeometries],
      ["Transforms",  s.numTransforms],
      ["Materials",   s.numMaterials],
      ["Textures",    s.numTextures],
      ["Vertices",    s.numVertices],
      ["Triangles",   s.numTriangles],
      ["Lines",       s.numLines],
      ["Points",      s.numPoints],
      ["With UVs",    withUVs],
      ["With Normals", withNormals],
    ];
  }

  private _renderStats(): void {
    const sm = this.sceneModel;
    if (!sm || (sm as any).destroyed) {
      this._statsEl.innerHTML = "";
      return;
    }
    const items = this._collectStats();
    const showDelta = !!this._baselineStats && this._fixRunLog.length > 0;
    const fmt = (n: number) => n.toLocaleString();
    const html = items.map(([label, now], i) => {
      let deltaHtml = "";
      if (showDelta && this._baselineStats) {
        const before = this._baselineStats[i][1];
        const delta  = now - before;
        let cls = "xkt-sh-stat-delta", txt = "";
        if (delta < 0)      { cls += " xkt-sh-saved";   txt = `−${fmt(-delta)}`; }
        else if (delta > 0) { cls += " xkt-sh-added";   txt = `+${fmt(delta)}`;  }
        else                { cls += " xkt-sh-neutral"; txt = "±0"; }
        deltaHtml = `<span class="${cls}" title="Was ${escapeHtml(fmt(before))} before fixing">${escapeHtml(txt)}</span>`;
      }
      return `
        <div class="xkt-sh-stat">
          <span class="xkt-sh-stat-label">${escapeHtml(label)}</span>
          <span class="xkt-sh-stat-value${now === 0 ? " xkt-sh-zero" : ""}">${escapeHtml(fmt(now))}</span>
          ${deltaHtml}
        </div>
      `;
    }).join("");
    this._statsEl.innerHTML = html;
  }


  // ── Report rendering ──────────────────────────────────────────

  private _currentFixableCodes(report: InspectionReport): string[] {
    const attempted = new Set<string>();
    for (const [code, row] of this._lastFixResultByCode) {
      if (row.skipped > 0) attempted.add(code);
    }
    return uniqueCodes(report.warnings).filter(c => !attempted.has(c));
  }

  private _renderReport(report: InspectionReport): void {
    this._lastReport = report;
    this._renderStats();

    const previousOpen = this._capturePanelOpenState();
    const errors   = report.errors.length;
    const warnings = report.warnings.length;

    const fixableCodes = this._currentFixableCodes(report);
    const fixableSet = new Set(fixableCodes);
    const fixableWarningCount = report.warnings.filter(w => fixableSet.has(w.code)).length;

    this._renderHealthCard(report, fixableCodes);

    // Primary CTA states.
    const btn = this._fixAllBtn;
    if (fixableCodes.length > 0) {
      btn.disabled = false;
      btn.textContent = `Fix All Issues (${fixableWarningCount})`;
      btn.title = `Run applyFixes filtered to: ${fixableCodes.join(", ")}`;
      btn.removeAttribute("data-state");
    } else if (warnings > 0) {
      btn.disabled = true;
      btn.textContent = "All Auto-Fixes Attempted";
      btn.title = "Every warning code has been attempted by the fix pipeline; the surviving issues need manual review.";
      btn.setAttribute("data-state", "exhausted");
    } else {
      btn.disabled = true;
      btn.textContent = "Fix All Issues";
      btn.title = "";
      btn.removeAttribute("data-state");
    }

    if (errors === 0 && warnings === 0) {
      this._issuesEl.innerHTML = `<div class="xkt-sh-empty">Nothing to report. ✓</div>`;
      return;
    }

    const buckets: Record<string, Issue[]> = {critical: [], optimization: [], cleanup: []};
    for (const issue of report.issues) {
      const k = issue.severity === "error" ? "critical" : impactForCode(issue.code);
      buckets[k].push(issue);
    }
    const frag = document.createDocumentFragment();
    for (const key of ["critical", "optimization", "cleanup"]) {
      if (buckets[key].length === 0) continue;
      frag.appendChild(this._buildImpactGroupNode(key, buckets[key], previousOpen));
    }
    this._issuesEl.innerHTML = "";
    this._issuesEl.appendChild(frag);
  }

  private _renderHealthCard(report: InspectionReport, fixableCodes: string[]): void {
    const errors   = report.errors.length;
    const warnings = report.warnings.length;
    const reviewable = warnings > 0 && fixableCodes.length === 0;

    let state: string, status: string, recommendation: string;
    if (errors > 0) {
      state = "critical";
      status = "Critical Issues Found";
      recommendation = `${errors} rendering-blocking error${errors === 1 ? "" : "s"} need manual triage. Errors aren't auto-fixed — review them before trying any auto-repair.`;
    } else if (reviewable) {
      state = "review";
      status = "Needs Review";
      recommendation = `${warnings} issue${warnings === 1 ? "" : "s"} survived the auto-fix pipeline — they're flagged as needing manual judgement (e.g. winding can't be inferred, geometry is too irregular to recenter safely). Inspect them in the list below; re-run inspection to retry once the underlying data changes.`;
    } else if (warnings > 0) {
      state = "warning";
      status = "Needs Cleanup";
      recommendation = "Click Fix All Issues to apply every safe remediation. Re-run inspection afterwards to verify.";
    } else {
      state = "healthy";
      status = "Optimized";
      recommendation = "No issues detected. The model is ready to ship.";
    }

    this._healthCard.setAttribute("data-state", state);
    this._healthStatus.textContent = status;

    const chips: string[] = [];
    if (errors   > 0) chips.push(`<span class="xkt-sh-c-error">${errors} error${errors === 1 ? "" : "s"}</span>`);
    if (warnings > 0) {
      const cls = reviewable ? "xkt-sh-c-review" : "xkt-sh-c-warn";
      const label = reviewable ? "needs review" : (warnings === 1 ? "warning" : "warnings");
      chips.push(`<span class="${cls}">${warnings} ${label}</span>`);
    }
    this._healthCounts.innerHTML = chips.join(" · ");
    this._healthRec.textContent = recommendation;
  }

  private _capturePanelOpenState(): PanelOpenState {
    const openCodes = new Set<string>();
    const closedImpacts = new Set<string>();
    if (!this._issuesEl.firstChild) return {openCodes, closedImpacts, isFirstRender: true};
    const opened = Array.from(this._issuesEl.querySelectorAll(".xkt-sh-type-group[open]"));
    for (const det of opened) {
      const code = det.getAttribute("data-code");
      if (code) openCodes.add(code);
    }
    const impacts = Array.from(this._issuesEl.querySelectorAll(".xkt-sh-impact"));
    for (const det of impacts) {
      if (!(det as HTMLDetailsElement).open) {
        const k = det.getAttribute("data-impact");
        if (k) closedImpacts.add(k);
      }
    }
    return {openCodes, closedImpacts, isFirstRender: false};
  }

  private _buildImpactGroupNode(impactKey: string, issues: Issue[], previousOpen: PanelOpenState): HTMLElement {
    const info = IMPACT_BUCKETS[impactKey];
    const det = el("details", "xkt-sh-impact") as HTMLDetailsElement;
    det.setAttribute("data-impact", impactKey);
    if (!previousOpen.isFirstRender) {
      det.open = !previousOpen.closedImpacts.has(impactKey);
    } else {
      det.open = impactKey === "critical";
    }
    // Per-severity breakdown so the eye lands on errors first.
    let nErr = 0, nWarn = 0, nInfo = 0;
    for (const issue of issues) {
      if      (issue.severity === "error")   nErr++;
      else if (issue.severity === "warning") nWarn++;
      else                                    nInfo++;
    }

    const summary = el("summary");
    summary.innerHTML = `
      <span class="xkt-sh-impact-label">${escapeHtml(info.label)}</span>
      ${renderSplitCount(nErr, nWarn, nInfo)}
    `;
    const attempted = new Set<string>();
    for (const [code, row] of this._lastFixResultByCode) {
      if (row.skipped > 0) attempted.add(code);
    }
    const fixableCodes = uniqueCodes(issues.filter(i => i.severity === "warning"))
      .filter(c => !attempted.has(c));
    if (fixableCodes.length > 0) {
      const fixBtn = el("button", "xkt-sh-fix-action", {
        type: "button",
        textContent: "Fix Category",
        title: `Run applyFixes filtered to: ${fixableCodes.join(", ")}`,
      }) as HTMLButtonElement;
      fixBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        void this._fixCodes(fixableCodes, `Fix all: ${info.label}`);
      });
      summary.appendChild(fixBtn);
    }
    const groupIds = unionHighlightIds(issues);
    if (groupIds.length > 0) {
      const locateBtn = el("button", "xkt-sh-locate-action", {
        type: "button",
        textContent: "Locate",
        title: `Highlight ${groupIds.length} affected SceneObject${groupIds.length === 1 ? "" : "s"} in the Viewer`,
      }) as HTMLButtonElement;
      locateBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        this._locate(groupIds);
      });
      summary.appendChild(locateBtn);
    }
    det.appendChild(summary);

    const body = el("div", "xkt-sh-body");
    const groupsByCode = new Map<string, {code: string; severity: string; issues: Issue[]}>();
    for (const issue of issues) {
      let g = groupsByCode.get(issue.code);
      if (!g) {
        g = {code: issue.code, severity: issue.severity, issues: []};
        groupsByCode.set(issue.code, g);
      }
      g.issues.push(issue);
    }
    for (const group of groupsByCode.values()) {
      body.appendChild(this._buildTypeGroupNode(group, previousOpen));
    }
    det.appendChild(body);
    return det;
  }

  private _buildTypeGroupNode(group: {code: string; severity: string; issues: Issue[]}, previousOpen: PanelOpenState): HTMLElement {
    const det = el("details", "xkt-sh-type-group") as HTMLDetailsElement;
    det.setAttribute("data-code", group.code);
    det.setAttribute("data-category", categoryForCode(group.code));
    det.setAttribute("data-severity", group.severity);
    if (previousOpen.openCodes.has(group.code)) det.open = true;

    // Summary — severity glyph + friendly label + code badge +
    // last-fix badge + count. The glyph is the primary
    // "what kind of issue is this?" cue.
    const summary = el("summary");
    const content = el("span", "xkt-sh-group-summary-content");
    const titleRow = el("span", "xkt-sh-title-row");

    const description = descriptionForCode(group.code);
    const labelTitleAttr = description ? ` title="${escapeHtml(description)}"` : "";
    const sevTitleAttr = ` title="${group.severity[0].toUpperCase()}${group.severity.slice(1)}"`;
    const lastFix = this._lastFixResultByCode.get(group.code);
    const lastFixBadge = lastFix
      ? `<span class="xkt-sh-last-fix-badge xkt-sh-${lastFixBadgeClass(lastFix)}" title="${escapeHtml(formatLastFix(lastFix, true))}">${escapeHtml(formatLastFix(lastFix, false))}</span>`
      : "";
    titleRow.innerHTML = `
      <span class="xkt-sh-sev-icon" data-severity="${group.severity}"${sevTitleAttr}>${severityGlyph(group.severity)}</span>
      <span class="xkt-sh-friendly-label"${labelTitleAttr}>${escapeHtml(labelForCode(group.code))}</span>
      <span class="xkt-sh-code-badge" title="Issue code">${escapeHtml(group.code)}</span>
      ${lastFixBadge}
      <span class="xkt-sh-count">${group.issues.length}</span>
    `;
    if (group.severity === "warning") {
      const fixBtn = el("button", "xkt-sh-fix-action", {
        type: "button",
        textContent: "Fix all",
        title: `Run applyFixes filtered to ${group.code}`,
      }) as HTMLButtonElement;
      fixBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        void this._fixCodes([group.code], `Fix all ${group.code}`);
      });
      titleRow.appendChild(fixBtn);
    }
    const groupIds = unionHighlightIds(group.issues);
    if (groupIds.length > 0) {
      const locateBtn = el("button", "xkt-sh-locate-action", {
        type: "button",
        textContent: "Locate",
        title: `Highlight ${groupIds.length} affected SceneObject${groupIds.length === 1 ? "" : "s"} in the Viewer`,
      }) as HTMLButtonElement;
      locateBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        this._locate(groupIds);
      });
      titleRow.appendChild(locateBtn);
    }
    content.appendChild(titleRow);
    summary.appendChild(content);
    det.appendChild(summary);

    const body = el("div", "xkt-sh-body");
    const PAGE_SIZE = 25;
    const total = group.issues.length;
    const initial = Math.min(total, PAGE_SIZE);
    for (let i = 0; i < initial; i++) {
      body.appendChild(this._buildIssueNode(group.issues[i]));
    }
    if (total > PAGE_SIZE) {
      const more = el("button", "xkt-sh-show-more", {
        type: "button",
        textContent: `Show ${total - PAGE_SIZE} more`,
      }) as HTMLButtonElement;
      more.addEventListener("click", (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        const frag = document.createDocumentFragment();
        for (let i = PAGE_SIZE; i < total; i++) {
          frag.appendChild(this._buildIssueNode(group.issues[i]));
        }
        body.insertBefore(frag, more);
        more.remove();
      });
      body.appendChild(more);
    }
    det.appendChild(body);
    return det;
  }

  private _buildIssueNode(issue: Issue): HTMLElement {
    const row = el("div", "xkt-sh-issue");
    const headlineEl = el("span", "xkt-sh-issue-headline");
    if (issue.resourceId) {
      const labelInfo = findResourceLabel(this.sceneModel, issue.resourceId);
      const friendly = labelInfo && labelInfo.name ? labelInfo.name : formatId(issue.resourceId);
      const showBadge = labelInfo && labelInfo.name;
      headlineEl.innerHTML =
        `<strong>${escapeHtml(friendly)}</strong>` +
        (showBadge ? ` <span class="xkt-sh-issue-id-badge">${escapeHtml(formatId(issue.resourceId))}</span>` : "");
    } else {
      headlineEl.textContent = collapseWhitespace(issue.message);
    }
    row.appendChild(headlineEl);

    if (issue.summary) {
      const blurbEl = el("span", "xkt-sh-issue-blurb", {textContent: issue.summary});
      row.appendChild(blurbEl);
    }

    if (DEFAULT_FIX_REGISTRY.get(issue.code)) {
      const fixBtn = el("button", "xkt-sh-fix-action-row", {
        type: "button",
        title: `Apply ${labelForCode(issue.code)} fix to this issue`,
      }) as HTMLButtonElement;
      fixBtn.innerHTML = `<span class="xkt-sh-fix-action-row-icon" aria-hidden="true">✦</span>Fix`;
      fixBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        void this._fixSingleIssue(issue);
      });
      row.appendChild(fixBtn);
    }

    if (issue.message) row.title = issue.message;

    if (issue.highlight && issue.highlight.objectIds.length > 0) {
      const ids = issue.highlight.objectIds.slice();
      row.classList.add("xkt-sh-locatable");
      row.title = `${issue.message || ""}\nClick to locate in the Viewer`.trim();
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      const hint = el("span", "xkt-sh-locate-hint", {textContent: "↗"});
      hint.setAttribute("aria-hidden", "true");
      row.appendChild(hint);
      const fire = () => this._locate(ids);
      row.addEventListener("click", fire);
      row.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          fire();
        }
      });
    }
    return row;
  }


  // ── Fix history ───────────────────────────────────────────────

  private _logFixRun(actionLabel: string, result: ApplyFixesResult, codes?: string[]): void {
    this._fixRunLog.push({
      timestamp: new Date().toISOString(),
      actionLabel,
      codes: codes ? codes.slice() : undefined,
      result,
    });

    const codesFilter = codes ? new Set(codes) : null;
    const displaySkipped = codesFilter
      ? result.skipped.filter((o: any) => codesFilter.has(o.issue.code))
      : result.skipped;
    const fixed   = result.fixed.length;
    const skipped = displaySkipped.length;
    const errors  = result.errors.length;

    const det = el("details", "xkt-sh-fix-entry") as HTMLDetailsElement;
    applyEntryCategory(det, codes);

    const summary = el("summary");
    summary.appendChild(buildEntryHeader(actionLabel, codes));

    const reasonCounts: Record<string, number> = {};
    for (const o of displaySkipped) {
      const r = (o as any).reason || "unknown";
      reasonCounts[r] = (reasonCounts[r] || 0) + 1;
    }
    const reasonSummary = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([r, n]) => `${r}: ${n}`)
      .join(", ");

    const counts = el("span", "xkt-sh-counts");
    counts.innerHTML = `
      <span class="xkt-sh-c-fixed">${fixed} fixed</span> ·
      <span class="xkt-sh-c-skipped" title="${escapeHtml(reasonSummary || "no skips")}">${skipped} skipped</span> ·
      <span class="xkt-sh-c-errors">${errors} errors</span>
    `;
    summary.appendChild(counts);
    det.appendChild(summary);

    const body = el("div", "xkt-sh-body");
    const append = (cls: string, label: string, outcomes: any[]): void => {
      for (const o of outcomes) {
        const r = el("div", `xkt-sh-fix-row xkt-sh-${cls}`);
        r.setAttribute("data-category", categoryForCode(o.issue.code));
        const detail = o.error
          ? o.error
          : (o.strategy ? `via ${o.strategy}` : "no matching fix strategy");
        const trace = o.trace || o.issue.resourceId || "";
        const reasonChip = (cls === "skipped" && o.reason)
          ? `<span class="xkt-sh-reason-chip xkt-sh-r-${escapeHtml(o.reason)}">${escapeHtml(o.reason)}</span>`
          : "";
        r.innerHTML = `
          <span class="xkt-sh-outcome">${label}</span>
          ${reasonChip}
          <span class="xkt-sh-code">${escapeHtml(o.issue.code)}</span>
          <span class="xkt-sh-detail">${escapeHtml(detail)}</span>
          ${trace ? `<span class="xkt-sh-trace">${escapeHtml(trace)}</span>` : ""}
        `;
        body.appendChild(r);
      }
    };
    append("fixed",   "fixed",   result.fixed);
    append("errors",  "error",   result.errors);
    append("skipped", "skipped", displaySkipped);

    if (body.childElementCount === 0) {
      body.innerHTML = `<div class="xkt-sh-fix-row"><span class="xkt-sh-detail">No issues matched the filter.</span></div>`;
    }
    det.appendChild(body);
    this._fixEntries.insertBefore(det, this._fixEntries.firstChild);

    // Replace per-code outcomes for every code touched in this run.
    const touched = new Set<string>();
    for (const o of result.fixed)   touched.add(o.issue.code);
    for (const o of displaySkipped) touched.add((o as any).issue.code);
    for (const o of result.errors)  touched.add(o.issue.code);
    for (const code of touched) this._lastFixResultByCode.delete(code);
    this._recordOutcomesByCode(result.fixed,   "fixed");
    this._recordOutcomesByCode(displaySkipped as any[], "skipped");
    this._recordOutcomesByCode(result.errors,  "errors");

    this._refreshFixHistoryCount();
    this._showFooterAction(buildFooterMessage(fixed, skipped, errors));
    this._renderStats();
    this._pulseInspectorMatches(codes);
  }

  private _logFixError(actionLabel: string, error: string, codes?: string[]): void {
    this._fixRunLog.push({
      timestamp: new Date().toISOString(),
      actionLabel,
      codes: codes ? codes.slice() : undefined,
      error,
    });
    const det = el("details", "xkt-sh-fix-entry") as HTMLDetailsElement;
    det.open = true;
    applyEntryCategory(det, codes);

    const summary = el("summary");
    summary.appendChild(buildEntryHeader(actionLabel, codes));
    const counts = el("span", "xkt-sh-counts");
    counts.innerHTML = `<span class="xkt-sh-c-errors">apply error</span>`;
    summary.appendChild(counts);
    det.appendChild(summary);

    const body = el("div", "xkt-sh-body");
    body.innerHTML = `
      <div class="xkt-sh-fix-row xkt-sh-errors">
        <span class="xkt-sh-outcome">error</span>
        <span class="xkt-sh-detail">${escapeHtml(error)}</span>
      </div>
    `;
    det.appendChild(body);
    this._fixEntries.insertBefore(det, this._fixEntries.firstChild);
    this._refreshFixHistoryCount();
    this._showFooterAction(`Last run failed: ${error}`);
    this._renderStats();
  }

  private _recordOutcomesByCode(outcomes: ReadonlyArray<{issue: Issue}>, kind: keyof LastFixOutcome): void {
    for (const o of outcomes) {
      const code = o.issue.code;
      let row = this._lastFixResultByCode.get(code);
      if (!row) {
        row = {fixed: 0, skipped: 0, errors: 0};
        this._lastFixResultByCode.set(code, row);
      }
      row[kind]++;
    }
  }

  private _refreshFixHistoryCount(): void {
    const n = this._fixRunLog.length;
    this._fixHistoryCount.textContent = n === 0 ? "0 runs" : `${n} run${n === 1 ? "" : "s"}`;
  }

  private _showFooterAction(message: string): void {
    this._footerMessage.textContent = message;
    this._footerEl.hidden = false;
  }

  private _pulseInspectorMatches(codes?: string[]): void {
    if (!codes || codes.length === 0) return;
    for (const code of codes) {
      const groups = Array.from(this._issuesEl.querySelectorAll(
        `.xkt-sh-type-group[data-code="${cssEscape(code)}"]`
      ));
      for (const g of groups) {
        g.classList.remove("xkt-sh-pulse");
        // eslint-disable-next-line no-void
        void (g as HTMLElement).offsetWidth;
        g.classList.add("xkt-sh-pulse");
        setTimeout(() => g.classList.remove("xkt-sh-pulse"), 1300);
      }
    }
  }

  private _buildFixResultsReport(): object {
    const runs = this._fixRunLog.map((entry) => {
      const out: any = {
        timestamp: entry.timestamp,
        actionLabel: entry.actionLabel,
      };
      if (entry.codes !== undefined) out.codes = entry.codes;
      if (entry.result) out.result = applyFixesResultToJson(entry.result);
      if (entry.error)  out.error  = entry.error;
      return out;
    });
    return {
      generatedAt: new Date().toISOString(),
      runCount: runs.length,
      runs,
    };
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Tiny element-construction helper. Sets className, then any
 * literal properties (textContent, innerHTML, type, …) and any
 * unknown keys as DOM attributes.
 */

function categoryForCode(code: string): string {
  const prefix = String(code).split("_", 1)[0];
  return CODE_CATEGORY_BY_PREFIX[prefix] || "misc";
}

function impactForCode(code: string): string {
  return IMPACT_BY_CODE[code] || "cleanup";
}

/** Single-char severity glyph used in type-group summary rows
 *  and impact-group split counts. */
function severityGlyph(severity: string): string {
  if (severity === "error")   return "✕";
  if (severity === "warning") return "⚠";
  return "·";
}

/** Render the impact-group's right-side count as a per-severity
 *  breakdown (e.g. `3✕ · 1⚠`). Zero buckets are skipped; a
 *  single-severity group renders as just `4✕`. */
function renderSplitCount(nErr: number, nWarn: number, nInfo: number): string {
  const parts: string[] = [];
  if (nErr > 0) {
    parts.push(`<span class="xkt-sh-cnt xkt-sh-cnt-err">${nErr}<span aria-hidden="true">✕</span></span>`);
  }
  if (nWarn > 0) {
    parts.push(`<span class="xkt-sh-cnt xkt-sh-cnt-warn">${nWarn}<span aria-hidden="true">⚠</span></span>`);
  }
  if (nInfo > 0) {
    parts.push(`<span class="xkt-sh-cnt xkt-sh-cnt-info">${nInfo}<span aria-hidden="true">·</span></span>`);
  }
  return `<span class="xkt-sh-impact-count-split">${parts.join("")}</span>`;
}

function uniqueCodes(issues: ReadonlyArray<Issue>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of issues) {
    if (!seen.has(i.code)) {
      seen.add(i.code);
      out.push(i.code);
    }
  }
  return out;
}

function unionHighlightIds(issues: ReadonlyArray<Issue>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of issues) {
    if (!i.highlight) continue;
    for (const id of i.highlight.objectIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function lastFixBadgeClass(row: LastFixOutcome): string {
  if (row.errors  > 0) return "failed";
  if (row.skipped > 0) return "partial";
  return "fixed";
}

function formatLastFix(row: LastFixOutcome, verbose: boolean): string {
  const parts: string[] = [];
  if (row.fixed   > 0) parts.push(`${row.fixed} fixed`);
  if (row.skipped > 0) parts.push(`${row.skipped} skipped`);
  if (row.errors  > 0) parts.push(`${row.errors} error${row.errors === 1 ? "" : "s"}`);
  if (parts.length === 0) return verbose ? "Last fix made no changes" : "no-op";
  if (verbose) return `Last fix · ${parts.join(" · ")}`;
  if (row.errors  > 0) return `${row.errors} err`;
  if (row.skipped > 0) return `${row.fixed}/${row.fixed + row.skipped} fixed`;
  return `✓ ${row.fixed} fixed`;
}

function buildFooterMessage(fixed: number, skipped: number, errors: number): string {
  const parts: string[] = [];
  if (fixed   > 0) parts.push(`${fixed} fixed`);
  if (skipped > 0) parts.push(`${skipped} skipped`);
  if (errors  > 0) parts.push(`${errors} error${errors === 1 ? "" : "s"}`);
  if (parts.length === 0) return "Last run made no changes.";
  return `Last run · ${parts.join(" · ")}. Re-run to verify.`;
}

function buildEntryHeader(actionLabel: string, codes?: string[]): HTMLElement {
  const wrap = el("span", "xkt-sh-entry-header");
  if (codes && codes.length === 1) {
    const friendly = labelForCode(codes[0]);
    wrap.innerHTML = `
      <span class="xkt-sh-action-label xkt-sh-friendly-label">Fix all: ${escapeHtml(friendly)}</span>
      <span class="xkt-sh-code-badge" title="Issue code">${escapeHtml(codes[0])}</span>
    `;
  } else {
    wrap.innerHTML = `<span class="xkt-sh-action-label xkt-sh-friendly-label">${escapeHtml(actionLabel)}</span>`;
  }
  return wrap;
}

function applyEntryCategory(det: HTMLElement, codes?: string[]): void {
  if (!codes || codes.length === 0) {
    det.setAttribute("data-category", "misc");
    return;
  }
  det.setAttribute("data-codes", codes.join(","));
  const first = categoryForCode(codes[0]);
  let shared = first;
  for (const c of codes) {
    if (categoryForCode(c) !== first) { shared = "misc"; break; }
  }
  det.setAttribute("data-category", shared);
}

function cssEscape(s: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(s);
  return String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function downloadJson(obj: object, filename: string): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {type: "application/json"});
  const url  = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function nowStamp(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function formatId(id: string | number): string {
  const s = String(id);
  return /^\d+$/.test(s) ? `#${s}` : s;
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

function collapseWhitespace(s: string): string {
  return String(s).replace(/\s+/g, " ").trim();
}

/**
 * One-glance health summary for a SceneModel — drives the
 * tab-strip status dot and inline issue counter.
 */
type ModelHealthState = "error" | "warning" | "healthy" | "pending" | "unknown";

interface ModelHealthSummary {
  state:    ModelHealthState;
  errors:   number;
  warnings: number;
}

/** Map an inspection report to a `ModelHealthSummary`. */
function summariseReport(report: InspectionReport): ModelHealthSummary {
  const errors   = report.errors?.length   ?? 0;
  const warnings = report.warnings?.length ?? 0;
  const state: ModelHealthState =
    errors   > 0 ? "error"
    : warnings > 0 ? "warning"
    : "healthy";
  return {state, errors, warnings};
}

/**
 * Tab tooltip — the static `Inspect '<id>'` line plus a state
 * description so a hover on a red dot reads as "Inspect 'Box':
 * 3 errors, 12 warnings", not just an opaque colour.
 */
function tabTooltip(
  fullId: string,
  state: ModelHealthState,
  counts: {errors: number; warnings: number},
): string {
  const head = `Inspect '${fullId}'`;
  if (state === "error")    return `${head}\n${counts.errors} error${counts.errors === 1 ? "" : "s"}, ${counts.warnings} warning${counts.warnings === 1 ? "" : "s"}`;
  if (state === "warning")  return `${head}\n${counts.warnings} warning${counts.warnings === 1 ? "" : "s"}`;
  if (state === "healthy")  return `${head}\nNo issues found`;
  if (state === "pending")  return `${head}\nInspecting…`;
  return `${head}\nInspection pending`;
}

/**
 * Strip the auto-generated `-${Date.now()}` suffix that
 * `Studio.loadDataset({clear: false})` appends to ids when
 * the user loads alongside existing models. The full id stays
 * available in the tab's `title` tooltip; the display string
 * loses the noise so a row of tabs reads as
 * `Box · demoModel · SandDunes · SportsCar` rather than
 * `Box-1777801450985 · demoModel · SandDunes-1777801491463 …`.
 *
 * Heuristic: a 13-digit suffix preceded by a hyphen is treated
 * as a millisecond timestamp. Real model ids that happen to end
 * in 13 digits would be misclassified; in practice the demo
 * sample ids don't, so this is a safe simplification.
 */
function displaySceneModelId(id: string): string {
  const m = /^(.+?)-(\d{13})$/.exec(id);
  return m ? m[1] : id;
}

/**
 * Iterate the Scene's `models` map and return the first alive
 * SceneModel — used for picking a default focus when the panel
 * opens, or after the focused model is destroyed. `skip` lets
 * the caller exclude a specific model (useful when handling a
 * destruction event whose target hasn't yet been removed from
 * the map).
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
 * Snapshot of all live, default-layer SceneModels in the Scene,
 * sorted by id for stable tab order across refreshes. Models
 * assigned to a named ViewLayer (tool helpers via `__…`, user
 * annotations, comparison snapshots, …) are skipped via
 * {@link isDefaultLayerModel}. Cheap (small N).
 */
function listAliveSceneModels(scene: Scene): SceneModel[] {
  const models = (scene as any).models;
  if (!models) return [];
  const out: SceneModel[] = [];
  for (const id of Object.keys(models)) {
    const sm = models[id] as SceneModel;
    if (sm && !sm.destroyed && isDefaultLayerModel(sm)) out.push(sm);
  }
  out.sort((a, b) => String((a as any).id).localeCompare(String((b as any).id)));
  return out;
}
