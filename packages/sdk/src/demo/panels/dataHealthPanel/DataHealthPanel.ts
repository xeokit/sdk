/**
 * Floating, draggable Data Health panel — UI surface for the
 * `dataModelInspector` toolkit. Same chrome / lifecycle as
 * {@link demo/sceneHealthPanel!SceneHealthPanel | SceneHealthPanel}, minus the fix
 * half (the SDK doesn't auto-fix DataModels).
 *
 * ```ts
 * import {DataHealthPanel} from "@xeokit/sdk/demo";
 *
 * const panel = new DataHealthPanel({
 *   data,                 // Data instance — tab strip lists every loaded DataModel
 *   focusDataModel,       // optional — first model to focus
 *   schema,               // optional DataFormatSchema
 *   inspectParams: {
 *     checkSchemaTagging:           true,
 *     checkRelationshipTypeBinding: true,
 *     checkRelationshipCycles:      true,
 *     checkIfcSpatialHierarchy:     true,
 *     checkIfcElementContainment:   true,
 *   },
 * });
 *
 * await panel.inspect();    // run + render
 * panel.hide();             // collapse to the floating "Show" pill
 * panel.destroy();          // tear down DOM + listeners
 * ```
 *
 * Class names are prefixed `xkt-dh-` and every CSS rule is rooted
 * at `.xkt-dh-panel` (or the dedicated `.xkt-dh-pill`). The
 * stylesheet is injected once per page regardless of instance
 * count.
 *
 * @module demo/dataHealthPanel
 */
import type {Data, DataModel} from "../../../model/data";
import type {DataFormatSchema} from "../../../inspect/dataModel/DataFormatSchema";
import type {Inspection} from "../../../inspect/dataModel/Inspection";
import type {Issue} from "../../../inspect/dataModel/Issue";
import type {InspectionReport} from "../../../inspect/dataModel/InspectionReport";
import type {InspectDataModelParams} from "../../../inspect/dataModel/params/InspectDataModelParams";
import {DEFAULT_INSPECTION_REGISTRY} from "../../../inspect/dataModel/DEFAULT_INSPECTION_REGISTRY";
import {InspectionRegistry} from "../../../inspect/dataModel/InspectionRegistry";
import {inspectDataModel} from "../../../inspect/dataModel/inspectDataModel";
import {inspectDataModelAsync} from "../../../inspect/dataModel/async/inspectDataModelAsync";
import {inspectionReportToJson} from "../../../inspect/dataModel/serializers/inspectionReportToJson";
import {labelForCode} from "../../../inspect/dataModel/labels/labelForCode";
import {descriptionForCode} from "../../../inspect/dataModel/labels/descriptionForCode";


import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";
// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

/** Constructor parameters for {@link DataHealthPanel}. */
export interface DataHealthPanelParams {

  /**
   * The Data to surface. If omitted, derived from
   * {@link focusDataModel}'s `.data`.
   */
  data?: Data;

  /**
   * DataModel to focus on first open. Optional — when omitted, the
   * first DataModel in the Data is selected.
   */
  focusDataModel?: DataModel;

  /**
   * Backwards-compatible alias for {@link focusDataModel}.
   * @deprecated Prefer `focusDataModel`.
   */
  dataModel?: DataModel;

  /**
   * Optional {@link DataFormatSchema} the DataModel is expected to
   * conform to. When supplied, schema-aware inspections light up;
   * otherwise only structural always-on inspections fire.
   */
  schema?: DataFormatSchema;

  /** DOM element to mount into. Defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * Initial inspection params. Each opt-in inspection's flag here
   * lights up the matching toggle in the Inspections subpanel.
   * Defaults to all opt-in checks enabled.
   */
  inspectParams?: Partial<InspectDataModelParams>;

  /** Show the panel on construction (default `true`). */
  visible?: boolean;

  /**
   * localStorage key for persisting drag position + closed state.
   * Defaults to `"xkt-dh-panel"`.
   */
  storageKey?: string;
}


// ─────────────────────────────────────────────────────────────────
// Module-level constants
// ─────────────────────────────────────────────────────────────────

/**
 * Impact bucket → user-visible label + member codes. Drives the
 * three-bucket rendering of issues:
 *   - structural   · violates schema or invariant; needs fix
 *   - conformance  · deviates from convention / schema policy
 *   - cleanup      · noise; harmless but worth pruning
 */
const IMPACT_BUCKETS: Readonly<Record<string, {label: string; codes: readonly string[]}>> = {
  structural: {
    label: "Structural · Schema Violations",
    codes: [
      "OBJECT_MISSING_TYPE",
      "OBJECT_UNKNOWN_TYPE",
      "RELATIONSHIP_UNKNOWN_TYPE",
      "RELATIONSHIP_FORBIDDEN_RELATING_TYPE",
      "RELATIONSHIP_FORBIDDEN_RELATED_TYPE",
      "RELATIONSHIP_SELF_REFERENCE_FORBIDDEN",
      "RELATIONSHIP_CYCLE",
      "IFC_NO_PROJECT",
      "IFC_MULTIPLE_PROJECTS",
      "IFC_PROJECT_HAS_PARENT",
      "IFC_SPATIAL_PARENT_TYPE_MISMATCH",
    ],
  },
  conformance: {
    label: "Conformance · Authoring Convention",
    codes: [
      "OBJECT_REQUIRED_PROPERTY_SET_MISSING",
      "OBJECT_FORBIDDEN_PROPERTY_SET",
      "OBJECT_SCHEMA_MISMATCH",
      "RELATIONSHIP_SCHEMA_MISMATCH",
      "IFC_SPATIAL_ORPHAN",
      "IFC_ELEMENT_AGGREGATED_NOT_CONTAINED",
    ],
  },
  cleanup: {
    label: "Cleanup · Noise",
    codes: [
      "OBJECT_DUPLICATE_PROPERTY_SET_REF",
      "RELATIONSHIP_SELF_REFERENCE",
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

const STYLE_TAG_ID = "xkt-dh-styles";

const DEFAULT_INSPECT_PARAMS: Partial<InspectDataModelParams> = {
  checkSchemaTagging:           true,
  checkRelationshipTypeBinding: true,
  checkRelationshipCycles:      true,
  checkIfcSpatialHierarchy:     true,
  checkIfcElementContainment:   true,
};


// ─────────────────────────────────────────────────────────────────
// CSS — every selector rooted at `.xkt-dh-panel` or
// `.xkt-dh-pill`. Class names prefixed `xkt-dh-`. Visually matches
// SceneHealthPanel so the two read as a coherent set.
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-dh-panel {
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
.xkt-dh-panel *, .xkt-dh-panel *::before, .xkt-dh-panel *::after {
  box-sizing: border-box;
}
.xkt-dh-panel[hidden] { display: none; }

.xkt-dh-panel .xkt-dh-header {
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
.xkt-dh-panel .xkt-dh-header.xkt-dh-dragging { cursor: grabbing; }
.xkt-dh-panel .xkt-dh-title {
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
.xkt-dh-panel .xkt-dh-title-icon {
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
.xkt-dh-panel .xkt-dh-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-dh-panel .xkt-dh-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-dh-panel .xkt-dh-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-dh-panel .xkt-dh-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
.xkt-dh-panel .xkt-dh-title-id {
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
.xkt-dh-panel .xkt-dh-close {
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
.xkt-dh-panel .xkt-dh-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-dh-pill {
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
  background: #2c7e6f;
  border: 1px solid #1f5a4f;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.xkt-dh-pill:hover { background: #1f5a4f; }
.xkt-dh-pill[hidden] { display: none; }

.xkt-dh-panel .xkt-dh-progress {
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
.xkt-dh-panel .xkt-dh-progress.xkt-dh-active {
  background: #fff8e1;
  border-bottom-color: #f0e3b0;
}
.xkt-dh-panel .xkt-dh-progress-label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #888;
  font-weight: 500;
  transition: color 150ms ease-out;
}
.xkt-dh-panel .xkt-dh-progress.xkt-dh-active .xkt-dh-progress-label { color: #6b5300; }
.xkt-dh-panel .xkt-dh-progress-bar {
  flex-shrink: 0;
  width: 110px;
  height: 8px;
  opacity: 0.4;
  transition: opacity 150ms ease-out;
}
.xkt-dh-panel .xkt-dh-progress.xkt-dh-active .xkt-dh-progress-bar { opacity: 1; }
.xkt-dh-panel .xkt-dh-progress-cancel {
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
.xkt-dh-panel .xkt-dh-progress-cancel[hidden] { display: none; }
.xkt-dh-panel .xkt-dh-progress-cancel:hover {
  background: #f1e3b6;
  color: #4a3a00;
}


.xkt-dh-panel.xkt-dh-busy .xkt-dh-progress { pointer-events: auto; }

.xkt-dh-panel .xkt-dh-health {
  flex: 0 0 auto;
  padding: 14px 16px;
  border-bottom: 1px solid #ececec;
  background: #fafafa;
}
.xkt-dh-panel .xkt-dh-health[data-state="critical"]  { background: #fdf3f3; border-bottom-color: #f3d7d7; }
.xkt-dh-panel .xkt-dh-health[data-state="warning"]   { background: #fff8e6; border-bottom-color: #f0e3b0; }
.xkt-dh-panel .xkt-dh-health[data-state="review"]    { background: #ecf6f3; border-bottom-color: #c5dad3; }
.xkt-dh-panel .xkt-dh-health[data-state="healthy"]   { background: #f0f8f0; border-bottom-color: #cfe4cf; }
.xkt-dh-panel .xkt-dh-health[data-state="loading"]   { background: #fafafa; border-bottom-color: #ececec; }
.xkt-dh-panel .xkt-dh-health-row1 {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.xkt-dh-panel .xkt-dh-health-status {
  flex: 1;
  font-size: 18px;
  font-weight: 650;
  color: #111;
  letter-spacing: -0.2px;
}
.xkt-dh-panel .xkt-dh-health[data-state="critical"] .xkt-dh-health-status { color: #a02020; }
.xkt-dh-panel .xkt-dh-health[data-state="warning"]  .xkt-dh-health-status { color: #8a5a00; }
.xkt-dh-panel .xkt-dh-health[data-state="review"]   .xkt-dh-health-status { color: #2c7e6f; }
.xkt-dh-panel .xkt-dh-health[data-state="healthy"]  .xkt-dh-health-status { color: #1f7a1f; }
.xkt-dh-panel .xkt-dh-health-counts {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  font-variant-numeric: tabular-nums;
}
.xkt-dh-panel .xkt-dh-health-counts .xkt-dh-c-error  { color: #a02020; }
.xkt-dh-panel .xkt-dh-health-counts .xkt-dh-c-warn   { color: #8a5a00; }
.xkt-dh-panel .xkt-dh-health-counts .xkt-dh-c-review { color: #2c7e6f; }
.xkt-dh-panel .xkt-dh-health-rec {
  margin-top: 6px;
  font-size: 12px;
  color: #555;
  line-height: 1.4;
}
.xkt-dh-panel .xkt-dh-health-rec:empty { display: none; }

.xkt-dh-panel .xkt-dh-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid #ececec;
  background: #fcfcfc;
}





.xkt-dh-panel .xkt-dh-secondary {
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
.xkt-dh-panel .xkt-dh-secondary:hover {
  background: #f0f0f0;
  color: #222;
}
.xkt-dh-panel .xkt-dh-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.xkt-dh-panel .xkt-dh-stats {
  flex: 0 0 auto;
  padding: 8px 12px 10px;
  border-bottom: 1px solid #ececec;
  background: #fcfcfc;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px 14px;
}
.xkt-dh-panel .xkt-dh-stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 11px;
  min-width: 0;
}
.xkt-dh-panel .xkt-dh-stat-label {
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
.xkt-dh-panel .xkt-dh-stat-value {
  flex-shrink: 0;
  color: #111;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.xkt-dh-panel .xkt-dh-stat-value.xkt-dh-zero { color: #aaa; font-weight: 400; }





.xkt-dh-panel .xkt-dh-inspections {
  flex: 0 0 auto;
  border-bottom: 1px solid #ececec;
  background: #f3f9f7;
}
.xkt-dh-panel .xkt-dh-inspections > summary {
  list-style: none;
  cursor: pointer;
  padding: 8px 12px;
  display: flex;
  gap: 6px;
  align-items: center;
  font-weight: 600;
  font-size: 12px;
  color: #2c7e6f;
  user-select: none;
}
.xkt-dh-panel .xkt-dh-inspections > summary::-webkit-details-marker { display: none; }
.xkt-dh-panel .xkt-dh-inspections > summary::marker                  { display: none; }
.xkt-dh-panel .xkt-dh-inspections > summary::before {
  content: "›";
  display: inline-block;
  width: 10px;
  color: #888;
  transform: translateY(-1px) rotate(0deg);
  transition: transform 120ms ease;
  font-size: 13px;
  line-height: 1;
}
.xkt-dh-panel .xkt-dh-inspections[open] > summary::before {
  transform: translateY(-1px) rotate(90deg);
}
.xkt-dh-panel .xkt-dh-inspections > summary:hover { background: #e7f1ee; }
.xkt-dh-panel .xkt-dh-inspections-count {
  margin-left: auto;
  color: #777;
  font-weight: normal;
  font-size: 11px;
}
.xkt-dh-panel .xkt-dh-inspections-toggle {
  flex-shrink: 0;
  padding: 2px 8px;
  font: inherit;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: #2c7e6f;
  background: transparent;
  border: 1px solid #b3cdc6;
  border-radius: 999px;
  cursor: pointer;
}
.xkt-dh-panel .xkt-dh-inspections-toggle:hover {
  background: #e7f1ee;
  border-color: #2c7e6f;
}
.xkt-dh-panel .xkt-dh-inspections-body {
  padding: 4px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.xkt-dh-panel .xkt-dh-inspection-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 3px;
  cursor: pointer;
}
.xkt-dh-panel .xkt-dh-inspection-row:hover { background: #e7f1ee; }
.xkt-dh-panel .xkt-dh-inspection-row > input[type="checkbox"] {
  margin: 1px 0 0 0;
  flex-shrink: 0;
  cursor: pointer;
}
.xkt-dh-panel .xkt-dh-inspection-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.xkt-dh-panel .xkt-dh-inspection-desc {
  color: #222;
  font-size: 11px;
  line-height: 1.3;
}
.xkt-dh-panel .xkt-dh-inspection-codes {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
  color: #444;
  font-size: 10.5px;
  line-height: 1.4;
}
.xkt-dh-panel .xkt-dh-inspection-codes > span {
  padding-left: 12px;
  position: relative;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-dh-panel .xkt-dh-inspection-codes > span::before {
  content: "•";
  position: absolute;
  left: 2px;
  top: 0;
  color: #999;
  font-weight: 700;
}
.xkt-dh-panel .xkt-dh-inspection-codes strong {
  color: #222;
  font-weight: 600;
}
.xkt-dh-panel .xkt-dh-inspection-code-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9.5px;
  color: #888;
}
.xkt-dh-panel .xkt-dh-inspection-row.xkt-dh-opt-in .xkt-dh-inspection-desc::after {
  content: "  · opt-in";
  color: #b88500;
  font-size: 10px;
  font-weight: 600;
}

.xkt-dh-panel .xkt-dh-issues {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px 12px 14px;
}
.xkt-dh-panel .xkt-dh-empty {
  padding: 24px 12px;
  text-align: center;
  color: #777;
  font-size: 12px;
}

.xkt-dh-panel .xkt-dh-impact {
  margin: 6px 0;
  background: #fff;
  border: 1px solid #ececec;
  border-left: 3px solid var(--xkt-dh-impact-color, #888);
  border-radius: 6px;
  overflow: hidden;
}
.xkt-dh-panel .xkt-dh-impact[data-impact="critical"]     { --xkt-dh-impact-color: #a02020; }
.xkt-dh-panel .xkt-dh-impact[data-impact="optimization"] { --xkt-dh-impact-color: #8a5a00; }
.xkt-dh-panel .xkt-dh-impact[data-impact="cleanup"]      { --xkt-dh-impact-color: #2c7e6f; }
.xkt-dh-panel .xkt-dh-impact > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  user-select: none;
}
.xkt-dh-panel .xkt-dh-impact > summary::-webkit-details-marker { display: none; }
.xkt-dh-panel .xkt-dh-impact > summary::marker                  { display: none; }
.xkt-dh-panel .xkt-dh-impact > summary::before {
  content: "›";
  display: inline-block;
  transform: rotate(0deg);
  transition: transform 120ms ease-out;
  color: #888;
  font-size: 12px;
}
.xkt-dh-panel .xkt-dh-impact[open] > summary::before { transform: rotate(90deg); }
.xkt-dh-panel .xkt-dh-impact > summary:hover { background: #fafafa; }
.xkt-dh-panel .xkt-dh-impact-label {
  flex: 1;
  font-size: 12px;
  font-weight: 650;
  color: #222;
  letter-spacing: -0.1px;
}
.xkt-dh-panel .xkt-dh-impact[data-impact="critical"]     .xkt-dh-impact-label { color: #a02020; }
.xkt-dh-panel .xkt-dh-impact[data-impact="optimization"] .xkt-dh-impact-label { color: #8a5a00; }
.xkt-dh-panel .xkt-dh-impact[data-impact="cleanup"]      .xkt-dh-impact-label { color: #2c7e6f; }
.xkt-dh-panel .xkt-dh-impact-count {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  font-variant-numeric: tabular-nums;
}
.xkt-dh-panel .xkt-dh-impact > .xkt-dh-body {
  padding: 4px 8px 6px;
  border-top: 1px solid #f4f4f4;
  background: #fcfcfc;
}

.xkt-dh-panel [data-category="object"]        { --xkt-dh-cat-color: #2d5e8c; }
.xkt-dh-panel [data-category="relationship"]  { --xkt-dh-cat-color: #7c459e; }
.xkt-dh-panel [data-category="ifc"]           { --xkt-dh-cat-color: #9c4666; }
.xkt-dh-panel [data-category="data-model"]    { --xkt-dh-cat-color: #b06e2c; }
.xkt-dh-panel [data-category="misc"]          { --xkt-dh-cat-color: #777;    }

.xkt-dh-panel .xkt-dh-type-group {
  margin: 4px 0;
  background: #fff;
  border: 1px solid #ececec;
  border-radius: 5px;
  overflow: hidden;
}
.xkt-dh-panel .xkt-dh-type-group[data-category] {
  border-left: 3px solid var(--xkt-dh-cat-color);
}
.xkt-dh-panel .xkt-dh-type-group > summary {
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
.xkt-dh-panel .xkt-dh-type-group > summary::-webkit-details-marker { display: none; }
.xkt-dh-panel .xkt-dh-type-group > summary::marker                  { display: none; }
.xkt-dh-panel .xkt-dh-type-group > summary::before {
  content: "›";
  display: inline-block;
  width: 10px;
  color: #888;
  transform: translateY(-1px) rotate(0deg);
  transition: transform 120ms ease;
  font-size: 13px;
  line-height: 1;
}
.xkt-dh-panel .xkt-dh-type-group[open] > summary::before {
  transform: translateY(-1px) rotate(90deg);
}
.xkt-dh-panel .xkt-dh-type-group > summary:hover { background: #f3f3f3; }
.xkt-dh-panel .xkt-dh-group-summary-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.xkt-dh-panel .xkt-dh-title-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.xkt-dh-panel .xkt-dh-friendly-label {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  color: #222;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-dh-panel .xkt-dh-code-badge {
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
.xkt-dh-panel .xkt-dh-count {
  margin-left: auto;
  color: #777;
  font-weight: normal;
  font-size: 11px;
}

/* Severity glyph at the left of each type-group row — the
   primary "what kind of issue is this?" signal. ✕ red for
   error, ⚠ amber for warning, · grey for info. Sized to keep
   line-height stable across rows. */
.xkt-dh-panel .xkt-dh-sev-icon {
  flex-shrink: 0;
  width: 14px;
  text-align: center;
  font-size: 12px;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  line-height: 1;
}
.xkt-dh-panel .xkt-dh-sev-icon[data-severity="error"]   { color: #c8332c; }
.xkt-dh-panel .xkt-dh-sev-icon[data-severity="warning"] { color: #b78400; }
.xkt-dh-panel .xkt-dh-sev-icon[data-severity="info"]    { color: #888;    font-weight: 700; }

/* Tinted summary background on error type-groups so the eye
   locks onto error rows before reading. Warnings get a much
   subtler wash; info groups stay neutral. */
.xkt-dh-panel .xkt-dh-type-group[data-severity="error"] > summary {
  background: rgba(200, 51, 44, 0.06);
}
.xkt-dh-panel .xkt-dh-type-group[data-severity="error"] > summary:hover {
  background: rgba(200, 51, 44, 0.10);
}
.xkt-dh-panel .xkt-dh-type-group[data-severity="warning"] > summary {
  background: rgba(214, 160, 32, 0.05);
}
.xkt-dh-panel .xkt-dh-type-group[data-severity="warning"] > summary:hover {
  background: rgba(214, 160, 32, 0.10);
}
/* Push the category-stripe colour aside when severity is
   error/warning — readers expect the stripe to track severity
   on a triage panel. */
.xkt-dh-panel .xkt-dh-type-group[data-severity="error"][data-category] {
  border-left-color: #c8332c;
}
.xkt-dh-panel .xkt-dh-type-group[data-severity="warning"][data-category] {
  border-left-color: #d6a020;
}

/* Split count chip on impact-group rows — replaces the bare
   total with a per-severity breakdown so a "13" reads as e.g.
   "3✕ · 10⚠" at a glance. */
.xkt-dh-panel .xkt-dh-impact-count-split {
  margin-left: auto;
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 600;
}
.xkt-dh-panel .xkt-dh-impact-count-split > .xkt-dh-cnt {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
}
.xkt-dh-panel .xkt-dh-impact-count-split > .xkt-dh-cnt-err  { color: #c8332c; }
.xkt-dh-panel .xkt-dh-impact-count-split > .xkt-dh-cnt-warn { color: #b78400; }
.xkt-dh-panel .xkt-dh-impact-count-split > .xkt-dh-cnt-info { color: #888;    }





.xkt-dh-panel .xkt-dh-type-group > .xkt-dh-body {
  padding: 4px 8px 6px;
  border-top: 1px solid #f4f4f4;
  background: #fcfcfc;
}
.xkt-dh-panel .xkt-dh-issue {
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
.xkt-dh-panel .xkt-dh-issue:nth-child(odd)  { background: #fafafa; }
.xkt-dh-panel .xkt-dh-issue:nth-child(even) { background: #f4f4f4; }
.xkt-dh-panel .xkt-dh-issue-headline {
  flex: 1;
  min-width: 0;
  color: #777;
  font-weight: normal;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-dh-panel .xkt-dh-issue-headline > strong {
  color: #222;
  font-weight: 600;
}
.xkt-dh-panel .xkt-dh-issue-blurb {
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
.xkt-dh-panel .xkt-dh-show-more {
  display: block;
  width: 100%;
  margin: 4px 0 2px;
  padding: 5px 8px;
  font: inherit;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #2c7e6f;
  background: transparent;
  border: 1px dashed #c8d2da;
  border-radius: 4px;
  cursor: pointer;
}
.xkt-dh-panel .xkt-dh-show-more:hover { background: #e9f1ee; border-color: #2c7e6f; }








































.xkt-dh-panel .xkt-dh-entry-header {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 6px;
  align-items: center;
}
.xkt-dh-panel .xkt-dh-action-label {
  flex: 1;
  min-width: 0;
  color: #222;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-dh-panel .xkt-dh-counts {
  font-weight: normal;
  font-size: 10.5px;
  color: #555;
}
.xkt-dh-panel .xkt-dh-counts .xkt-dh-c-fixed  { color: #1f7a1f; font-weight: 600; }
.xkt-dh-panel .xkt-dh-counts .xkt-dh-c-errors { color: #a02020; font-weight: 600; }








.xkt-dh-panel .xkt-dh-reason-chip {
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
.xkt-dh-panel .xkt-dh-reason-chip.xkt-dh-r-target-missing      { background: #ecf0f7; color: #2c7e6f; }
.xkt-dh-panel .xkt-dh-reason-chip.xkt-dh-r-malformed-issue     { background: #fbeed1; color: #8a5a00; }
.xkt-dh-panel .xkt-dh-reason-chip.xkt-dh-r-precondition-failed { background: #fde7e7; color: #a02020; }
.xkt-dh-panel .xkt-dh-reason-chip.xkt-dh-r-no-op               { background: #e6f0e6; color: #1a7a3c; }
.xkt-dh-panel .xkt-dh-reason-chip.xkt-dh-r-no-strategy         { background: #f0eaf5; color: #6a3f8a; }
.xkt-dh-panel .xkt-dh-reason-chip.xkt-dh-r-filter-excluded     { background: #f0f0f0; color: #555;   }



.xkt-dh-panel .xkt-dh-footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-top: 1px solid #ececec;
  background: #fafafa;
}
.xkt-dh-panel .xkt-dh-footer[hidden] { display: none; }
.xkt-dh-panel .xkt-dh-footer-message {
  flex: 1;
  font-size: 11px;
  color: #555;
  line-height: 1.4;
}
.xkt-dh-panel .xkt-dh-re-inspect {
  flex-shrink: 0;
  padding: 7px 14px;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  color: #2c7e6f;
  background: transparent;
  border: 1px solid #2c7e6f;
  border-radius: 6px;
  cursor: pointer;
}
.xkt-dh-panel .xkt-dh-re-inspect:hover { background: #ecf2f7; }

@keyframes xkt-dh-pulse {
  0%   { background-color: #fff5d4; }
  100% { background-color: transparent; }
}


/* Model tabs — one chip per loaded SceneModel, with the active
   one taking the panel-blue accent. Horizontally scrollable for
   scenes that load many models. */
.xkt-dh-panel .xkt-dh-tabs {
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
.xkt-dh-panel .xkt-dh-tabs::-webkit-scrollbar          { width: 6px; }
.xkt-dh-panel .xkt-dh-tabs::-webkit-scrollbar-thumb    { background: #d0d0d0; border-radius: 999px; }
.xkt-dh-panel .xkt-dh-tabs-empty {
  font-size: 11px;
  color: #888;
  font-style: italic;
  padding: 2px 4px;
}
.xkt-dh-panel .xkt-dh-tab {
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
.xkt-dh-panel .xkt-dh-tab:hover {
  background: #e7f1ee;
  border-color: #bcd4cd;
}
.xkt-dh-panel .xkt-dh-tab.xkt-dh-tab-active {
  background: #2c7e6f;
  border-color: #1f5a4f;
  color: #fff;
}
.xkt-dh-panel .xkt-dh-tab-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  max-width: 18ch;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-dh-panel .xkt-dh-tab-count {
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
.xkt-dh-panel .xkt-dh-tab-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #d0d0d0;
  border: 1px solid #b8b8b8;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.85);
}
.xkt-dh-panel .xkt-dh-tab-dot[data-status="error"]   { background: #c8332c; border-color: #8d231d; }
.xkt-dh-panel .xkt-dh-tab-dot[data-status="warning"] { background: #d6a020; border-color: #97700a; }
.xkt-dh-panel .xkt-dh-tab-dot[data-status="healthy"] { background: #2c8f55; border-color: #1c5a35; }
.xkt-dh-panel .xkt-dh-tab-dot[data-status="pending"] {
  background: transparent;
  border-color: #2c7e6f;
  animation: xkt-dh-tab-pulse 1s ease-in-out infinite;
}
.xkt-dh-panel .xkt-dh-tab-dot[data-status="unknown"] { background: transparent; }
@keyframes xkt-dh-tab-pulse {
  0%, 100% { opacity: 0.35; }
  50%      { opacity: 1; }
}

/* Inline issue counter — small chip after the object count when
   a model has errors or warnings. Suppressed for healthy /
   pending / unknown (the dot already says it). */
.xkt-dh-panel .xkt-dh-tab-issues {
  font-variant-numeric: tabular-nums;
  font-size: 10px;
  font-weight: 650;
  padding: 0 4px;
  border-radius: 3px;
  letter-spacing: 0.2px;
}
.xkt-dh-panel .xkt-dh-tab-issues-error { background: #fdf3f3; color: #a02020; border: 1px solid #f3d7d7; }
.xkt-dh-panel .xkt-dh-tab-issues-warn  { background: #fff8e1; color: #6b5300; border: 1px solid #f0e3b0; }
/* On the active (dark-blue) tab, swap to translucent overlays
   so the chips don't fight the navy background. */
.xkt-dh-panel .xkt-dh-tab-active .xkt-dh-tab-issues-error { background: rgba(255, 220, 220, 0.18); color: #ffd9d6; border-color: rgba(255, 200, 200, 0.35); }
.xkt-dh-panel .xkt-dh-tab-active .xkt-dh-tab-issues-warn  { background: rgba(255, 240, 200, 0.18); color: #ffeaa6; border-color: rgba(255, 230, 170, 0.35); }
/* Active tab: outline the dot in white so it pops against the
   navy fill. */
.xkt-dh-panel .xkt-dh-tab-active .xkt-dh-tab-dot {
  box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.9);
}

/* Run-status badges injected by _renderInspectionsPanel after each
   inspection pass — green "ran" pill, gray "skipped" pill. The
   skipped row dims its label so the eye reads them as inactive. */
.xkt-dh-panel .xkt-dh-inspection-ran,
.xkt-dh-panel .xkt-dh-inspection-skipped {
  flex-shrink: 0;
  font-size: 9.5px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  border-radius: 3px;
  padding: 0 4px;
  cursor: help;
}
.xkt-dh-panel .xkt-dh-inspection-ran     { color: #047857; background: #d1fae5; }
.xkt-dh-panel .xkt-dh-inspection-skipped { color: #475569; background: #e2e8f0; }
.xkt-dh-panel .xkt-dh-inspection-row:has(.xkt-dh-inspection-skipped) .xkt-dh-inspection-desc {
  color: #94a3b8;
}
`;



// ─────────────────────────────────────────────────────────────────
// Module-private helper types
// ─────────────────────────────────────────────────────────────────

interface ModelHealthSummary {
  state: "error" | "warning" | "healthy";
  errors: number;
  warnings: number;
}

interface ProgressState {
  label: string;
  current: number;
  total: number;
  indeterminate: boolean;
}

interface PanelOpenState {
  openCodes: Set<string>;
  closedImpacts: Set<string>;
  isFirstRender: boolean;
}

type StatRow = readonly [string, number];


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

export class DataHealthPanel extends FloatingPanelBase {

  private static readonly _instances = new WeakMap<Data, DataHealthPanel>();

  /** Returns the existing live panel bound to a Data, or undefined. */
  static getFor(target: Data | DataModel): DataHealthPanel | undefined {
    const data = (target as any).data ?? target;
    const inst = DataHealthPanel._instances.get(data as Data);
    return inst && !inst._destroyed ? inst : undefined;
  }

  /** Tick-in-box glyph — matches the Import / Export icon tone. */
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
   * Reveal (or lazily mount) a panel for `params.data`, run an
   * inspection, and return the instance. Idempotent — same Data
   * returns the existing instance.
   */
  static openFor(params: DataHealthPanelParams): DataHealthPanel {
    const focus = params.focusDataModel ?? params.dataModel;
    const data = params.data ?? (focus ? focus.data : undefined);
    if (!data) {
      throw new Error("DataHealthPanel.openFor: data or focusDataModel is required");
    }
    let inst = DataHealthPanel._instances.get(data);
    if (inst && !inst._destroyed) {
      inst.show();
      if (focus && inst.dataModel !== focus) inst.focusModel(focus);
      else if (!inst._activeController) void inst.inspect("Inspecting model");
      return inst;
    }
    inst = new DataHealthPanel(params);
    void inst.inspect("Inspecting model");
    return inst;
  }


  readonly data: Data;

  /** DataModel currently being inspected. Mutated by
   *  {@link focusModel}. */
  dataModel!: DataModel;

  private readonly _schema: DataFormatSchema | undefined;
  private readonly _inspectParams: Partial<InspectDataModelParams>;

  // DOM refs.
  private _modelTabsEl!: HTMLElement;
  private _progressEl!: HTMLElement;
  private _progressLabel!: HTMLElement;
  private _progressBar!: HTMLProgressElement;
  private _progressCancel!: HTMLButtonElement;
  private _healthCard!: HTMLElement;
  private _healthStatus!: HTMLElement;
  private _healthCounts!: HTMLElement;
  private _healthRec!: HTMLElement;
  private _reInspectBtn!: HTMLButtonElement;
  private _getReportBtn!: HTMLButtonElement;
  private _statsEl!: HTMLElement;
  private _inspectionsPanel!: HTMLDetailsElement;
  private _inspectionsBody!: HTMLElement;
  private _inspectionsCount!: HTMLElement;
  private _inspectionsEnableAll!: HTMLButtonElement;
  private _inspectionsDisableAll!: HTMLButtonElement;
  private _issuesEl!: HTMLElement;

  // State.
  private _activeController: AbortController | null = null;
  private _lastReport: InspectionReport | null = null;
  private readonly _enabledInspections = new Set<Inspection>();

  // Drag state.

  // Live-sync.
  private readonly _dataUnsubs: Array<() => void> = [];
  private _modelsRefreshScheduled = false;
  private readonly _modelSummaries = new Map<string, ModelHealthSummary | "running">();
  private _backgroundController: AbortController | null = null;


  constructor(params: DataHealthPanelParams) {
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-dh-panel",
      classPrefix: "xkt-dh",
    });
    const focus = params.focusDataModel ?? params.dataModel;
    const data  = params.data ?? (focus ? focus.data : undefined);
    if (!data) throw new Error("DataHealthPanel: data or focusDataModel is required");
    this.data    = data;
    this._schema = params.schema;
    this._inspectParams = {...DEFAULT_INSPECT_PARAMS, ...(params.inspectParams ?? {})};

    // Replace any prior instance bound to the same Data.
    const prior = DataHealthPanel._instances.get(data);
    if (prior && !prior._destroyed) prior.destroy();
    DataHealthPanel._instances.set(data, this);

    // Initial focus: requested model, otherwise first model in the
    // Data, otherwise leave undefined and surface the empty state.
    const initial = focus ?? firstAliveDataModel(data);
    if (initial) this.dataModel = initial;

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();
    this._wireEvents();
    this._initInspectionToggles();
    this._renderInspectionsPanel();
    this._renderModelTabs();
    this._renderStats();
    this._attachDataListeners();


    if (params.visible === false) this.hide(); else this.show();
  }


  // ── Public API ────────────────────────────────────────────────

  get visible(): boolean { return this._panel.style.display !== "none"; }

  show(): void {
    if (this._destroyed) return;
    super.show();
  }

  hide(): void {
    if (this._destroyed) return;
    super.hide();
  }

  toggle(): void { if (this.visible) this.hide(); else this.show(); }

  destroy(): void {
    if (this._destroyed) return;
    if (this._activeController)     try { this._activeController.abort(); }     catch { /* ignore */ }
    if (this._backgroundController) try { this._backgroundController.abort(); } catch { /* ignore */ }
    this._detachDataListeners();
    if (DataHealthPanel._instances.get(this.data) === this) {
      DataHealthPanel._instances.delete(this.data);
    }
    super.destroy();
  }

  /** Run an inspection on the focused DataModel and re-render. */
  async inspect(label = "Inspecting"): Promise<InspectionReport | null> {
    if (this._destroyed) return null;
    if (!this.dataModel) return null;
    if (this._activeController) return null;

    const ctrl = new AbortController();
    this._activeController = ctrl;
    this._panel.classList.add("xkt-dh-busy");
    this._showProgress({label, current: 0, total: 1, indeterminate: true});
    this._progressCancel.hidden = false;

    try {
      const report = await inspectDataModelAsync({
        dataModel: this.dataModel,
        schema:    this._schema,
        signal:    ctrl.signal,
        registry:  this._buildInspectionRegistry(),
        ...this._inspectParams,
        onProgress: (p) => {
          if (p.phase === "before") {
            this._showProgress({
              label: p.label || label,
              current: p.current,
              total: p.total,
              indeterminate: false,
            });
          }
        },
      } as InspectDataModelParams);
      this._renderReport(report);
      this._cacheModelSummary(this.dataModel.id, report);
      this._renderModelTabs();
      return report;
    } catch (err: any) {
      if (err && err.name === "AbortError") {
        // Aborted — caller will re-run with new params if they want.
      } else {
        console.error("[DataHealthPanel] inspect failed:", err);
      }
      return null;
    } finally {
      if (this._activeController === ctrl) this._activeController = null;
      this._panel.classList.remove("xkt-dh-busy");
      this._hideProgress();
      // Kick a background pass over the other models' tab dots.
      this._kickBackgroundInspections();
    }
  }

  /** Switch the focused DataModel + re-inspect. */
  focusModel(dm: DataModel): void {
    if (this._destroyed) return;
    if (dm === this.dataModel) return;
    if (this._activeController) {
      try { this._activeController.abort(); } catch { /* ignore */ }
      this._activeController = null;
    }
    this.dataModel = dm;
    this._lastReport = null;
    this._renderModelTabs();
    this._renderStats();
    this._issuesEl.innerHTML = "";
    this._healthCard.setAttribute("data-state", "loading");
    this._healthStatus.textContent = "Inspecting…";
    this._healthCounts.innerHTML = "";
    this._healthRec.textContent = "";
    void this.inspect("Inspecting model");
  }


  // ── Listeners on the Data ─────────────────────────────────────

  private _attachDataListeners(): void {
    const events: any = (this.data as any).events;
    if (!events) return;
    const sub = (handle: any) => {
      if (handle && typeof handle.subscribe === "function") {
        const unsub = handle.subscribe(() => this._scheduleModelsRefresh());
        if (typeof unsub === "function") this._dataUnsubs.push(unsub);
      }
    };
    sub(events.onDataModelCreated);
    sub(events.onDataModelDestroyed);
  }

  private _detachDataListeners(): void {
    for (const u of this._dataUnsubs) {
      try { u(); } catch { /* ignore */ }
    }
    this._dataUnsubs.length = 0;
  }

  private _scheduleModelsRefresh(): void {
    if (this._modelsRefreshScheduled) return;
    this._modelsRefreshScheduled = true;
    requestAnimationFrame(() => {
      this._modelsRefreshScheduled = false;
      if (this._destroyed) return;
      // If the focused model went away, refocus.
      if (!this.dataModel || (this.dataModel as any).destroyed) {
        const next = firstAliveDataModel(this.data);
        if (next) {
          this.dataModel = next;
          this._lastReport = null;
          void this.inspect("Inspecting model");
        }
      }
      this._renderModelTabs();
      this._kickBackgroundInspections();
    });
  }


  // ── Background pass over non-focused models for tab dots ──────

  private _kickBackgroundInspections(): void {
    if (this._destroyed) return;
    if (this._backgroundController) {
      try { this._backgroundController.abort(); } catch { /* ignore */ }
    }
    const ctrl = new AbortController();
    this._backgroundController = ctrl;

    const models = listAliveDataModels(this.data).filter(dm => dm !== this.dataModel);
    if (models.length === 0) {
      this._backgroundController = null;
      return;
    }

    void (async () => {
      for (const dm of models) {
        if (ctrl.signal.aborted) break;
        const id = String(dm.id);
        if (this._modelSummaries.get(id) && this._modelSummaries.get(id) !== "running") continue;
        this._modelSummaries.set(id, "running");
        this._renderModelTabs();
        try {
          const report = inspectDataModel({
            dataModel: dm,
            schema:    this._schema,
            registry:  this._buildInspectionRegistry(),
            ...this._inspectParams,
          } as InspectDataModelParams);
          this._cacheModelSummary(id, report);
        } catch {
          this._modelSummaries.delete(id);
        }
        this._renderModelTabs();
      }
      if (this._backgroundController === ctrl) this._backgroundController = null;
    })();
  }

  private _cacheModelSummary(id: string, report: InspectionReport): void {
    const errors   = report.errors.length;
    const warnings = report.warnings.length;
    const state: ModelHealthSummary["state"] =
      errors   > 0 ? "error"
      : warnings > 0 ? "warning"
      : "healthy";
    this._modelSummaries.set(String(id), {state, errors, warnings});
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-dh-pill", {
      type: "button",
      title: "Reopen the Data Health panel",
      hidden: true,
      textContent: "Data Health",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-dh-panel");

    // Header.
    this._header = el("div", "xkt-dh-header");
    const title = el("h2", "xkt-dh-title");
    title.innerHTML =
      `<span class="xkt-dh-title-icon">${DataHealthPanel.iconSvg()}</span>` +
      `<span class="xkt-dh-title-stack">` +
        `<span class="xkt-dh-title-text">Data Health</span>` +
        `<span class="xkt-dh-subtitle">Data graph problems and one-click fixes.</span>` +
      `</span>`;
    this._closeBtn = el("button", "xkt-dh-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;
    this._header.append(title, this._closeBtn);
    this._panel.appendChild(this._header);

    // Tabs.
    this._modelTabsEl = el("div", "xkt-dh-tabs");
    this._panel.appendChild(this._modelTabsEl);

    // Progress.
    this._progressEl = el("div", "xkt-dh-progress");
    this._progressLabel = el("div", "xkt-dh-progress-label", {textContent: "Ready"});
    this._progressBar = el("progress", "xkt-dh-progress-bar") as HTMLProgressElement;
    this._progressBar.max = 1;
    this._progressBar.value = 0;
    this._progressCancel = el("button", "xkt-dh-progress-cancel", {
      type: "button",
      title: "Abort the running inspection",
      hidden: true,
      textContent: "Cancel",
    }) as HTMLButtonElement;
    this._progressEl.append(this._progressLabel, this._progressBar, this._progressCancel);
    this._panel.appendChild(this._progressEl);

    // Health card.
    this._healthCard = el("div", "xkt-dh-health");
    this._healthCard.setAttribute("data-state", "loading");
    const healthRow1 = el("div", "xkt-dh-health-row1");
    this._healthStatus = el("div", "xkt-dh-health-status", {textContent: "Inspecting…"});
    this._healthCounts = el("div", "xkt-dh-health-counts");
    healthRow1.append(this._healthStatus, this._healthCounts);
    this._healthRec = el("div", "xkt-dh-health-rec");
    this._healthCard.append(healthRow1, this._healthRec);
    this._panel.appendChild(this._healthCard);

    // Actions row — Re-inspect (primary) + Get Report (secondary).
    const actions = el("div", "xkt-dh-actions");
    this._reInspectBtn = el("button", "xkt-dh-re-inspect", {
      type: "button",
      textContent: "Re-run Inspection",
    }) as HTMLButtonElement;
    this._getReportBtn = el("button", "xkt-dh-secondary", {
      type: "button",
      title: "Open the latest InspectionReport as JSON in a new tab",
      textContent: "Report",
    }) as HTMLButtonElement;
    actions.append(this._reInspectBtn, this._getReportBtn);
    this._panel.appendChild(actions);

    // Stats.
    this._statsEl = el("div", "xkt-dh-stats");
    this._panel.appendChild(this._statsEl);

    // Inspections subpanel.
    this._inspectionsPanel = el("details", "xkt-dh-inspections") as HTMLDetailsElement;
    const inspSummary = el("summary");
    const inspLabel = el("span", undefined, {textContent: "Inspections"});
    this._inspectionsCount = el("span", "xkt-dh-inspections-count");
    this._inspectionsEnableAll = el("button", "xkt-dh-inspections-toggle", {
      type: "button",
      title: "Enable every inspection",
      textContent: "All",
    }) as HTMLButtonElement;
    this._inspectionsDisableAll = el("button", "xkt-dh-inspections-toggle", {
      type: "button",
      title: "Disable every inspection",
      textContent: "None",
    }) as HTMLButtonElement;
    inspSummary.append(inspLabel, this._inspectionsCount, this._inspectionsEnableAll, this._inspectionsDisableAll);
    this._inspectionsBody = el("div", "xkt-dh-inspections-body");
    this._inspectionsPanel.append(inspSummary, this._inspectionsBody);
    this._panel.appendChild(this._inspectionsPanel);

    // Issues tree.
    this._issuesEl = el("div", "xkt-dh-issues");
    this._panel.appendChild(this._issuesEl);

    // Mount.
    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }

  private _wireEvents(): void {
    this._progressCancel.addEventListener("click", () => {
      if (this._activeController) this._activeController.abort();
    });

    this._reInspectBtn.addEventListener("click", () => {
      if (this._activeController) return;
      void this.inspect("Re-inspecting");
    });

    this._getReportBtn.addEventListener("click", () => {
      if (!this._lastReport) return;
      const json = inspectionReportToJson(this._lastReport);
      openJsonInNewTab(json, `Data inspection report — ${this.dataModel?.id ?? ""}`);
    });

    this._inspectionsEnableAll.addEventListener("click",  () => this._setAllInspectionsEnabled(true));
    this._inspectionsDisableAll.addEventListener("click", () => this._setAllInspectionsEnabled(false));
  }


  // ── Layout persistence ────────────────────────────────────────



  // ── Tabs ──────────────────────────────────────────────────────

  private _renderModelTabs(): void {
    if (!this._modelTabsEl) return;
    this._modelTabsEl.innerHTML = "";

    const models = listAliveDataModels(this.data);
    if (models.length === 0) {
      this._modelTabsEl.appendChild(el("div", "xkt-dh-tabs-empty", {
        textContent: "No DataModels loaded",
      }));
      return;
    }

    for (const dm of models) {
      const fullId = String(dm.id);
      const summary = this._modelSummaries.get(fullId);
      const state =
        summary === "running"  ? "pending"
        : summary === undefined ? "unknown"
        : summary.state;
      const counts = (summary && summary !== "running")
        ? {errors: summary.errors, warnings: summary.warnings}
        : {errors: 0, warnings: 0};

      const tab = el("button", "xkt-dh-tab", {
        type:  "button",
        title: tabTooltip(fullId, state, counts),
      }) as HTMLButtonElement;
      tab.setAttribute("data-status", state);
      if (dm === this.dataModel) tab.classList.add("xkt-dh-tab-active");

      const dot = el("span", "xkt-dh-tab-dot");
      dot.setAttribute("data-status", state);
      tab.appendChild(dot);

      tab.appendChild(el("span", "xkt-dh-tab-id", {textContent: fullId}));

      const stats: any = (dm as any).stats;
      if (stats && Number.isFinite(stats.numObjects)) {
        tab.appendChild(el("span", "xkt-dh-tab-count", {
          textContent: `${stats.numObjects.toLocaleString()} objs`,
        }));
      }

      if (state === "error" && counts.errors > 0) {
        tab.appendChild(el("span", "xkt-dh-tab-issues xkt-dh-tab-issues-error", {
          textContent: `${counts.errors} ✕`,
        }));
      } else if (state === "warning" && counts.warnings > 0) {
        tab.appendChild(el("span", "xkt-dh-tab-issues xkt-dh-tab-issues-warn", {
          textContent: `${counts.warnings} ⚠`,
        }));
      }

      tab.addEventListener("click", () => this.focusModel(dm));
      this._modelTabsEl.appendChild(tab);
    }
  }


  // ── Inspections subpanel ──────────────────────────────────────

  private _initInspectionToggles(): void {
    this._enabledInspections.clear();
    for (const insp of DEFAULT_INSPECTION_REGISTRY.inspections()) {
      // Always-on inspections start enabled. Opt-ins read from
      // _inspectParams (which already merged user overrides over
      // DEFAULT_INSPECT_PARAMS).
      const optIn = !!insp.optIn;
      const flag = insp.paramsKey ? (this._inspectParams as any)[insp.paramsKey] : undefined;
      const enabled = optIn ? !!flag : true;
      if (enabled) this._enabledInspections.add(insp);
    }
  }

  private _buildInspectionRegistry(): InspectionRegistry {
    const reg = new InspectionRegistry();
    for (const insp of DEFAULT_INSPECTION_REGISTRY.inspections()) {
      if (this._enabledInspections.has(insp)) reg.register(insp);
    }
    return reg;
  }

  private _renderInspectionsPanel(): void {
    const all = Array.from(DEFAULT_INSPECTION_REGISTRY.inspections());
    let on = 0;
    for (const insp of all) if (this._enabledInspections.has(insp)) on++;

    // Inspection refs that fired in the most recent run. Empty
    // before the first inspection — rows render without a status
    // badge until we have a report to compare against.
    const ran = this._lastReport
      ? new Set(this._lastReport.inspectionsRun)
      : null;

    this._inspectionsCount.textContent = ran
      ? `${ran.size} ran · ${on} / ${all.length}`
      : `${on} / ${all.length}`;

    this._inspectionsBody.innerHTML = "";
    for (const insp of all) {
      const row = el("label", "xkt-dh-inspection-row" + (insp.optIn ? " xkt-dh-opt-in" : ""));
      const cb = el("input") as HTMLInputElement;
      cb.type = "checkbox";
      cb.checked = this._enabledInspections.has(insp);
      cb.addEventListener("change", () => {
        if (cb.checked) this._enabledInspections.add(insp);
        else            this._enabledInspections.delete(insp);
        if (insp.paramsKey) (this._inspectParams as any)[insp.paramsKey] = cb.checked || undefined;
        this._renderInspectionsPanel();
      });
      row.appendChild(cb);

      const text = el("span", "xkt-dh-inspection-text");
      const desc = el("span", "xkt-dh-inspection-desc", {textContent: insp.description});
      text.appendChild(desc);
      const codes = el("span", "xkt-dh-inspection-codes");
      for (const c of insp.codes) {
        const line = document.createElement("span");
        const friendly = (insp.labels && insp.labels[c]) || c;
        line.innerHTML =
          `<strong>${escapeHtml(friendly)}</strong>` +
          ` <span class="xkt-dh-inspection-code-id">(${escapeHtml(c)})</span>`;
        codes.appendChild(line);
      }
      text.appendChild(codes);
      row.appendChild(text);

      // ran / skipped status badge — only after at least one
      // inspection pass; tooltip on "skipped" explains the reason
      // (disabled, opt-in flag off, schema gate mismatch).
      if (ran) {
        if (ran.has(insp)) {
          row.appendChild(el("span", "xkt-dh-inspection-ran", {
            textContent: "ran",
            title: "Fired in the latest run.",
          }));
        } else {
          row.appendChild(el("span", "xkt-dh-inspection-skipped", {
            textContent: "skipped",
            title: skippedReason(
              insp,
              this._enabledInspections,
              this._inspectParams,
              this._schema?.id ?? this.dataModel?.schema,
            ),
          }));
        }
      }

      this._inspectionsBody.appendChild(row);
    }
  }

  private _setAllInspectionsEnabled(enabled: boolean): void {
    for (const insp of DEFAULT_INSPECTION_REGISTRY.inspections()) {
      if (enabled) this._enabledInspections.add(insp);
      else this._enabledInspections.delete(insp);
      if (insp.paramsKey) {
        (this._inspectParams as any)[insp.paramsKey] = enabled || undefined;
      }
    }
    this._renderInspectionsPanel();
  }


  // ── Progress ──────────────────────────────────────────────────

  private _showProgress({label, current, total, indeterminate}: ProgressState): void {
    this._progressEl.classList.add("xkt-dh-active");
    this._progressLabel.textContent = label;
    if (indeterminate || total === 0) {
      this._progressBar.removeAttribute("value");
    } else {
      this._progressBar.max   = Math.max(1, total);
      this._progressBar.value = Math.max(0, Math.min(current, total));
    }
  }

  private _hideProgress(): void {
    this._progressEl.classList.remove("xkt-dh-active");
    this._progressLabel.textContent = "Ready";
    this._progressBar.max = 1;
    this._progressBar.value = 0;
    this._progressCancel.hidden = true;
  }


  // ── Stats ─────────────────────────────────────────────────────

  private _collectStats(): StatRow[] {
    const dm = this.dataModel;
    if (!dm) return [];
    const types = new Set<string>();
    for (const id in dm.objects) types.add(dm.objects[id].type);
    const relTypes = new Set<string>();
    for (const r of dm.relationships) relTypes.add(r.type);
    return [
      ["Objects",       countMap(dm.objects)],
      ["Relationships", dm.relationships.length],
      ["Property Sets", countMap(dm.propertySets)],
      ["Object Types",  types.size],
      ["Rel Types",     relTypes.size],
      ["Schema",        this._schema ? 1 : 0], // sentinel for "schema attached"
    ];
  }

  private _renderStats(): void {
    const dm = this.dataModel;
    if (!dm || (dm as any).destroyed) {
      this._statsEl.innerHTML = "";
      return;
    }
    const items = this._collectStats();
    const fmt = (n: number) => n.toLocaleString();
    const html = items.map(([label, n]) => {
      // The Schema row is a yes/no sentinel; render the schema id
      // when available, "—" otherwise.
      if (label === "Schema") {
        const txt = this._schema ? this._schema.id : "—";
        const cls = this._schema ? "" : " xkt-dh-zero";
        return `<div class="xkt-dh-stat">
          <span class="xkt-dh-stat-label">${escapeHtml(label)}</span>
          <span class="xkt-dh-stat-value${cls}">${escapeHtml(txt)}</span>
        </div>`;
      }
      return `<div class="xkt-dh-stat">
        <span class="xkt-dh-stat-label">${escapeHtml(label)}</span>
        <span class="xkt-dh-stat-value${n === 0 ? " xkt-dh-zero" : ""}">${escapeHtml(fmt(n))}</span>
      </div>`;
    }).join("");
    this._statsEl.innerHTML = html;
  }


  // ── Report rendering ──────────────────────────────────────────

  private _renderReport(report: InspectionReport): void {
    this._lastReport = report;
    this._renderStats();
    // Refresh the inspections subpanel so each row picks up its
    // ran / skipped badge from this report's inspectionsRun list.
    this._renderInspectionsPanel();

    const previousOpen = this._capturePanelOpenState();
    this._renderHealthCard(report);

    if (report.errors.length === 0 && report.warnings.length === 0 && report.info.length === 0) {
      this._issuesEl.innerHTML = `<div class="xkt-dh-empty">Nothing to report. ✓</div>`;
      return;
    }

    const buckets: Record<string, Issue[]> = {structural: [], conformance: [], cleanup: []};
    for (const issue of report.issues) {
      const k = issue.severity === "error" ? "structural" : impactForCode(issue.code);
      buckets[k].push(issue);
    }
    const frag = document.createDocumentFragment();
    for (const key of ["structural", "conformance", "cleanup"]) {
      if (buckets[key].length === 0) continue;
      frag.appendChild(this._buildImpactGroupNode(key, buckets[key], previousOpen));
    }
    this._issuesEl.innerHTML = "";
    this._issuesEl.appendChild(frag);
  }

  private _renderHealthCard(report: InspectionReport): void {
    const errors   = report.errors.length;
    const warnings = report.warnings.length;

    let state: string, status: string, recommendation: string;
    if (errors > 0) {
      state = "critical";
      status = "Schema Violations Found";
      recommendation = `${errors} structural error${errors === 1 ? "" : "s"} need manual triage. The SDK doesn't auto-fix DataModel issues — review each one and edit the source data or broaden the schema.`;
    } else if (warnings > 0) {
      state = "warning";
      status = "Needs Review";
      recommendation = `${warnings} advisory issue${warnings === 1 ? "" : "s"} — authoring conventions, schema tag drift, structural noise. Inspect them in the list below and triage manually.`;
    } else {
      state = "healthy";
      status = "Clean";
      recommendation = "No issues detected.";
    }

    this._healthCard.setAttribute("data-state", state);
    this._healthStatus.textContent = status;

    const chips: string[] = [];
    if (errors   > 0) chips.push(`<span class="xkt-dh-c-error">${errors} error${errors === 1 ? "" : "s"}</span>`);
    if (warnings > 0) chips.push(`<span class="xkt-dh-c-warn">${warnings} warning${warnings === 1 ? "" : "s"}</span>`);
    this._healthCounts.innerHTML = chips.join(" · ");
    this._healthRec.textContent = recommendation;
  }

  private _capturePanelOpenState(): PanelOpenState {
    const openCodes = new Set<string>();
    const closedImpacts = new Set<string>();
    if (!this._issuesEl.firstChild) return {openCodes, closedImpacts, isFirstRender: true};
    const opened = Array.from(this._issuesEl.querySelectorAll(".xkt-dh-type-group[open]"));
    for (const det of opened) {
      const code = det.getAttribute("data-code");
      if (code) openCodes.add(code);
    }
    const impacts = Array.from(this._issuesEl.querySelectorAll(".xkt-dh-impact"));
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
    const det = el("details", "xkt-dh-impact") as HTMLDetailsElement;
    det.setAttribute("data-impact", impactKey);
    det.open = previousOpen.isFirstRender
      ? impactKey === "structural"
      : !previousOpen.closedImpacts.has(impactKey);

    // Per-severity breakdown so the eye lands on errors first.
    let nErr = 0, nWarn = 0, nInfo = 0;
    for (const issue of issues) {
      if      (issue.severity === "error")   nErr++;
      else if (issue.severity === "warning") nWarn++;
      else                                    nInfo++;
    }

    const summary = el("summary");
    summary.innerHTML = `
      <span class="xkt-dh-impact-label">${escapeHtml(info.label)}</span>
      ${renderSplitCount(nErr, nWarn, nInfo)}
    `;
    det.appendChild(summary);

    // Body wraps the per-code groups — same structure as
    // SceneHealth so the inner scroll / striping rules apply.
    const body = el("div", "xkt-dh-body");

    const byCode = new Map<string, Issue[]>();
    for (const issue of issues) {
      let bucket = byCode.get(issue.code);
      if (!bucket) { bucket = []; byCode.set(issue.code, bucket); }
      bucket.push(issue);
    }
    const groups = [...byCode.entries()].map(([code, list]) => ({
      code, severity: list[0].severity, issues: list,
    }));
    const sevOrder: Record<string, number> = {error: 0, warning: 1, info: 2};
    groups.sort((a, b) => (sevOrder[a.severity] - sevOrder[b.severity]) || (b.issues.length - a.issues.length));

    for (const g of groups) body.appendChild(this._buildTypeGroupNode(g, previousOpen));
    det.appendChild(body);
    return det;
  }

  private _buildTypeGroupNode(
    group:        {code: string; severity: string; issues: Issue[]},
    previousOpen: PanelOpenState,
  ): HTMLElement {
    const det = el("details", "xkt-dh-type-group") as HTMLDetailsElement;
    det.setAttribute("data-code", group.code);
    det.setAttribute("data-category", categoryForCode(group.code));
    det.setAttribute("data-severity", group.severity);
    det.open = previousOpen.isFirstRender
      ? group.severity === "error"
      : previousOpen.openCodes.has(group.code);

    // Summary — severity glyph + friendly label + code badge + count
    // (right-aligned via margin-left:auto on .xkt-dh-count). The
    // glyph is the primary "what kind of issue is this?" cue;
    // everything to its right reads as supporting detail.
    const summary = el("summary");
    const content = el("span", "xkt-dh-group-summary-content");
    const titleRow = el("span", "xkt-dh-title-row");

    const description = descriptionForCode(group.code);
    const labelTitleAttr = description ? ` title="${escapeHtml(description)}"` : "";
    const sevTitleAttr = ` title="${group.severity[0].toUpperCase()}${group.severity.slice(1)}"`;
    titleRow.innerHTML = `
      <span class="xkt-dh-sev-icon" data-severity="${group.severity}"${sevTitleAttr}>${severityGlyph(group.severity)}</span>
      <span class="xkt-dh-friendly-label"${labelTitleAttr}>${escapeHtml(labelForCode(group.code))}</span>
      <span class="xkt-dh-code-badge" title="Issue code">${escapeHtml(group.code)}</span>
      <span class="xkt-dh-count">${group.issues.length}</span>
    `;
    content.appendChild(titleRow);
    summary.appendChild(content);
    det.appendChild(summary);

    // Body — first PAGE_SIZE issues, plus a "Show N more" button
    // that paginates the remainder. Mirrors SceneHealth.
    const body = el("div", "xkt-dh-body");
    const PAGE_SIZE = 25;
    const total = group.issues.length;
    const initial = Math.min(total, PAGE_SIZE);
    for (let i = 0; i < initial; i++) {
      body.appendChild(this._buildIssueNode(group.issues[i]));
    }
    if (total > PAGE_SIZE) {
      const more = el("button", "xkt-dh-show-more", {
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
    const row = el("div", "xkt-dh-issue");
    const headlineEl = el("span", "xkt-dh-issue-headline");
    if (issue.resourceId) {
      headlineEl.innerHTML =
        `<strong>${escapeHtml(issue.resourceId)}</strong>`;
    } else {
      headlineEl.textContent = collapseWhitespace(issue.message);
    }
    row.appendChild(headlineEl);
    if (issue.summary) {
      row.appendChild(el("span", "xkt-dh-issue-blurb", {textContent: issue.summary}));
    }
    return row;
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
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


function listAliveDataModels(data: Data): DataModel[] {
  const out: DataModel[] = [];
  const map = (data as any).models;
  if (!map) return out;
  for (const id in map) {
    const dm = map[id];
    if (!dm || (dm as any).destroyed) continue;
    out.push(dm);
  }
  return out;
}

function firstAliveDataModel(data: Data): DataModel | undefined {
  return listAliveDataModels(data)[0];
}

/** Map an issue code to a stripe-colour category — used by the
 *  per-type-group `data-category` attribute. Mirrors the
 *  SceneHealth pattern; categories below are DataModel-themed. */
function categoryForCode(code: string): string {
  if (code.startsWith("OBJECT_"))       return "object";
  if (code.startsWith("RELATIONSHIP_")) return "relationship";
  if (code.startsWith("IFC_"))          return "ifc";
  if (code.startsWith("DATA_MODEL_"))   return "data-model";
  return "misc";
}

/** Collapse runs of whitespace so a free-text message renders on
 *  one line. Truncation is left to the headline cell's CSS
 *  `text-overflow: ellipsis`, which clips on the right edge based
 *  on the actual rendered width. */
function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function impactForCode(code: string): string {
  return IMPACT_BY_CODE[code] ?? "cleanup";
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
 *  single-severity group renders as just `4✕` rather than the
 *  full triple. */
function renderSplitCount(nErr: number, nWarn: number, nInfo: number): string {
  const parts: string[] = [];
  if (nErr > 0) {
    parts.push(`<span class="xkt-dh-cnt xkt-dh-cnt-err">${nErr}<span aria-hidden="true">✕</span></span>`);
  }
  if (nWarn > 0) {
    parts.push(`<span class="xkt-dh-cnt xkt-dh-cnt-warn">${nWarn}<span aria-hidden="true">⚠</span></span>`);
  }
  if (nInfo > 0) {
    parts.push(`<span class="xkt-dh-cnt xkt-dh-cnt-info">${nInfo}<span aria-hidden="true">·</span></span>`);
  }
  return `<span class="xkt-dh-impact-count-split">${parts.join("")}</span>`;
}

function tabTooltip(
  id: string,
  state: string,
  counts: {errors: number; warnings: number},
): string {
  if (state === "error")   return `${id} — ${counts.errors} error${counts.errors === 1 ? "" : "s"}, ${counts.warnings} warning${counts.warnings === 1 ? "" : "s"}`;
  if (state === "warning") return `${id} — ${counts.warnings} warning${counts.warnings === 1 ? "" : "s"}`;
  if (state === "healthy") return `${id} — clean`;
  if (state === "pending") return `${id} — inspecting…`;
  return `${id} — not yet inspected`;
}

/** One-line reason an inspection didn't fire — for the
 *  "skipped" badge tooltip in the Inspections subpanel. */
function skippedReason(
  insp:           Inspection,
  enabled:        ReadonlySet<Inspection>,
  params:         Partial<InspectDataModelParams>,
  expectedSchema: string | undefined,
): string {
  if (!enabled.has(insp)) {
    return "Skipped: disabled in the Inspections list above.";
  }
  if (insp.optIn && insp.paramsKey && !(params as any)[insp.paramsKey]) {
    return `Skipped: opt-in flag '${insp.paramsKey}' not set.`;
  }
  const schemas = insp.schemas;
  if (schemas && schemas.length > 0) {
    if (!expectedSchema) {
      return `Skipped: tied to schema [${schemas.join(", ")}], but the model has no schema id.`;
    }
    if (schemas.indexOf(expectedSchema) === -1) {
      return `Skipped: tied to schema [${schemas.join(", ")}], model is '${expectedSchema}'.`;
    }
  }
  return "Skipped.";
}

function countMap(map: Record<string, unknown>): number {
  let n = 0;
  for (const _id in map) n++;
  return n;
}

function escapeHtml(s: string | number): string {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  }[c] as string));
}

function openJsonInNewTab(obj: unknown, title: string): void {
  const json = JSON.stringify(obj, null, 2);
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  <meta charset="utf-8"/>
  <style>
    body { background: #0f1116; color: #e7e7e7; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 0; padding: 0; }
    .json-pre { background: #0f1116; border-radius: 10px; margin: 24px; padding: 24px 32px; max-width: 1100px; font-size: 13px; }
    h1 { color: #fff; font-size: 20px; font-weight: 650; margin: 24px 24px 12px 24px; }
    .meta { color: #aaa; font-size: 13px; margin: 0 24px 18px 24px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">DataModel inspection report</div>
  <pre class="json-pre">${escapeHtml(json)}</pre>
</body>
</html>
  `.trim();
  const win = window.open();
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
