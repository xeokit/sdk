/**
 * Floating, draggable **Export** dialog — multi-select the
 * currently-loaded `SceneModel` / `DataModel` pairs, multi-select
 * one or more dataset types (the same comma-separated descriptors
 * the {@link SampleModelsPanel} uses, e.g. `"xgf,datamodel"`,
 * `"obj,mtl"`, `"scenemodel,datamodel"`), and trigger downloads.
 *
 * For each `(model × datasetType × format)` combination the
 * dialog instantiates the matching exporter, calls `write` on it,
 * wraps the returned bytes in a Blob, and triggers a browser
 * download via `URL.createObjectURL`. Per-format extension and
 * MIME type are looked up against {@link FORMAT_REGISTRY}.
 *
 * Same chrome and lifecycle as the rest of the panel set
 * (`SceneHealthPanel` / `SchemaMaterialsPanel` /
 * `ViewerConfigPanel` / `GPUMemoryPanel` / `Toolbar`):
 * per-DemoHelper WeakMap registry, idempotent `getFor` /
 * `openFor`, drag header, close + pill, layout persistence,
 * bring-to-front on pointer-down, scoped `xkt-exp-` CSS prefix.
 *
 * @module demo/exportDialog
 */
import type {SceneModel} from "../../../scene";
import type {DataModel} from "../../../data";
import type {DemoHelper} from "../../DemoHelper";
import {XGFExporter}              from "../../../formats/xgf/XGFExporter";
import {GLTFExporter}             from "../../../formats/gltf/GLTFExporter";
import {OBJExporter}              from "../../../formats/obj/OBJExporter";
import {MTLExporter}              from "../../../formats/mtl/MTLExporter";
import {IFCExporter}              from "../../../formats/ifc/IFCExporter";
import {DotBIMExporter}           from "../../../formats/dotbim/DotBIMExporter";
import {RVMExporter}              from "../../../formats/rvm/RVMExporter";
import {SceneModelParamsExporter} from "../../../formats/scenemodel/SceneModelParamsExporter";
import {DataModelParamsExporter}  from "../../../formats/datamodel/DataModelParamsExporter";


import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";
// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface ExportDialogParams {

  /**
   * Helper whose `scene.models` / `data.models` populate the
   * model picker. Doubles as the WeakMap key for
   * {@link ExportDialog.openFor} idempotence — one dialog per
   * helper.
   */
  demoHelper: DemoHelper;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed
   * state. Defaults to `"xkt-exp-dialog"`.
   */
  storageKey?: string;

  /**
   * Initial pre-selected dataset descriptors. Defaults to
   * `["xgf,datamodel"]` — the most common round-trip path in
   * the SDK demos.
   */
  defaultDatasets?: string[];

  /** Show on construction (default `true`). */
  visible?: boolean;
}


/**
 * Per-format mapping: a comma-separated descriptor like
 * `"xgf,datamodel"` is split into ids; each id resolves to one
 * row of this table. Filename templates use the SceneModel id as
 * `{id}` so a multi-model export ends up with disambiguated
 * filenames.
 */
interface FormatEntry {
  /** Lower-case format id (matches catalog convention). */
  id:       string;
  /** Human-readable label for the dataset-type chip. */
  label:    string;
  /** File extension without leading dot. */
  ext:      string;
  /** Content-Type used for the Blob. */
  mime:     string;
  /** Build a fresh exporter on each export run. */
  build:    () => any;
  /**
   * Resolve the bytes the exporter returned into something
   * `Blob` can serialise. JSON exporters return objects, text
   * exporters return strings, binary exporters return
   * `ArrayBuffer` / `Uint8Array`.
   */
  toBytes:  (raw: any) => BlobPart;
  /**
   * Whether this format needs a `DataModel` to be useful. When
   * `true` and the helper has no DataModel for a SceneModel,
   * the format is skipped with a warning rather than emitting
   * an empty file.
   */
  needsDataModel?: boolean;
  /**
   * Whether this format needs a `SceneModel` to be useful.
   * Every format except `datamodel` does — the DataModel-only
   * JSON exporter is the lone exception. Defaults to `true`
   * when omitted.
   */
  needsSceneModel?: boolean;
}

const FORMAT_REGISTRY: Record<string, FormatEntry> = {
  xgf: {
    id: "xgf", label: "XGF", ext: "xgf", mime: "application/octet-stream",
    build:   () => new XGFExporter(),
    toBytes: (raw) => raw as ArrayBuffer,
  },
  gltf: {
    id: "gltf", label: "glTF", ext: "glb", mime: "model/gltf-binary",
    build:   () => new GLTFExporter(),
    toBytes: (raw) => raw as ArrayBuffer,
  },
  obj: {
    id: "obj", label: "OBJ", ext: "obj", mime: "model/obj",
    build:   () => new OBJExporter(),
    toBytes: (raw) => String(raw),
  },
  mtl: {
    id: "mtl", label: "MTL", ext: "mtl", mime: "model/mtl",
    build:   () => new MTLExporter(),
    toBytes: (raw) => String(raw),
  },
  ifc: {
    id: "ifc", label: "IFC", ext: "ifc", mime: "application/x-step",
    build:   () => new IFCExporter(),
    toBytes: (raw) => raw instanceof Uint8Array ? raw : String(raw),
  },
  dotbim: {
    id: "dotbim", label: ".bim", ext: "bim", mime: "application/json",
    build:   () => new DotBIMExporter(),
    toBytes: (raw) => JSON.stringify(raw, null, 2),
  },
  rvm: {
    id: "rvm", label: "RVM", ext: "rvm", mime: "application/octet-stream",
    build:   () => new RVMExporter(),
    toBytes: (raw) => raw as ArrayBuffer,
  },
  scenemodel: {
    id: "scenemodel", label: "SceneModel JSON", ext: "scenemodel.json", mime: "application/json",
    build:   () => new SceneModelParamsExporter(),
    toBytes: (raw) => JSON.stringify(raw, null, 2),
  },
  datamodel: {
    id: "datamodel", label: "DataModel JSON", ext: "datamodel.json", mime: "application/json",
    build:   () => new DataModelParamsExporter(),
    toBytes: (raw) => JSON.stringify(raw, null, 2),
    needsDataModel:  true,
    needsSceneModel: false,
  },
};

/**
 * Dataset-type presets — comma-separated format ids, the same
 * shape the {@link SampleModelsPanel} loads from its catalog.
 * Order is the order the chips render.
 *
 * `datamodel` is a standalone dataset rather than an addendum to
 * SceneModel-bearing types, so users can mix and match (e.g.
 * "give me XGF for the geometry and a DataModel JSON dump",
 * without committing to the legacy paired form).
 */
const DEFAULT_DATASET_TYPES: string[] = [
  "xgf",
  "scenemodel",
  "gltf",
  "obj,mtl",
  "ifc",
  "dotbim",
  "rvm",
  "datamodel",
];


/**
 * One configurable parameter on a dataset descriptor.
 *
 * Each `ParamDef` describes a single input the dialog renders
 * inside the **Parameters** section once the user has selected
 * the parent dataset. At export time, the value is folded into
 * the `options` object passed to every exporter whose format id
 * appears in {@link applyTo}.
 *
 * String values may include the `{id}` placeholder, which is
 * substituted with the SceneModel id per-task — so a single
 * input can scale across a multi-model export without losing
 * disambiguation.
 */
interface ParamDef {
  /** Key written into the exporter's `options` object. */
  id:       string;
  /** Label shown next to the input. */
  label:    string;
  /** Input control type. */
  type:     "string" | "number" | "boolean";
  /** Default value rendered into the input on first show. */
  default:  any;
  /**
   * Format ids (within the dataset descriptor) the value should
   * be passed to as an exporter option. Empty array = no
   * exporter receives this value (typical for a filename param,
   * which only controls the download name).
   *
   * `mtlFileName` is the interesting case: `applyTo: ["obj"]`
   * because OBJ writes the value into its `mtllib` directive,
   * AND `filenameFor: "mtl"` because that same value names the
   * MTL download file.
   */
  applyTo:  string[];
  /**
   * When set, the resolved string value of this param is used as
   * the download filename for the named format id. Independent
   * of {@link applyTo} — a value can both name a download file
   * AND be passed to a sibling exporter as an option.
   */
  filenameFor?: string;
  /** Optional help text — small caption under the input. */
  help?:    string;
}

/**
 * Per-dataset parameter schemas.
 *
 * Every dataset declares filename param(s) for its format(s).
 * The OBJ + MTL pair adds `mtlFileName` to OBJ's exporter
 * options as well, so the OBJ file's `mtllib` directive points
 * at whichever name the user picked for the MTL.
 */
const DATASET_PARAMS: Record<string, ParamDef[]> = {
  "xgf": [
    {
      id: "xgfFileName", label: "XGF Filename", type: "string",
      default: "{id}.xgf", applyTo: [], filenameFor: "xgf",
      help: "Filename for the XGF download. `{id}` substitutes the SceneModel id.",
    },
  ],
  "scenemodel": [
    {
      id: "sceneModelFileName", label: "JSON Filename", type: "string",
      default: "{id}.scenemodel.json", applyTo: [], filenameFor: "scenemodel",
      help: "Filename for the SceneModel JSON download.",
    },
  ],
  "gltf": [
    {
      id: "gltfFileName", label: "glTF Filename", type: "string",
      default: "{id}.glb", applyTo: [], filenameFor: "gltf",
      help: "Filename for the glTF binary (.glb) download.",
    },
  ],
  "obj,mtl": [
    {
      id: "objFileName", label: "OBJ Filename", type: "string",
      default: "{id}.obj", applyTo: [], filenameFor: "obj",
      help: "Filename for the OBJ download.",
    },
    {
      id: "mtlFileName", label: "MTL Filename", type: "string",
      default: "{id}.mtl", applyTo: ["obj"], filenameFor: "mtl",
      help: "Filename for the MTL download — also written into the OBJ's `mtllib` directive so the two link up.",
    },
  ],
  "ifc": [
    {
      id: "ifcFileName", label: "IFC Filename", type: "string",
      default: "{id}.ifc", applyTo: [], filenameFor: "ifc",
      help: "Filename for the IFC download.",
    },
  ],
  "dotbim": [
    {
      id: "dotbimFileName", label: ".bim Filename", type: "string",
      default: "{id}.bim", applyTo: [], filenameFor: "dotbim",
      help: "Filename for the .bim download.",
    },
  ],
  "rvm": [
    {
      id: "rvmFileName", label: "RVM Filename", type: "string",
      default: "{id}.rvm", applyTo: [], filenameFor: "rvm",
      help: "Filename for the RVM download.",
    },
  ],
  "datamodel": [
    {
      id: "dataModelFileName", label: "JSON Filename", type: "string",
      default: "{id}.datamodel.json", applyTo: [], filenameFor: "datamodel",
      help: "Filename for the DataModel JSON download.",
    },
  ],
};


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard for the whole page.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-exp-styles";
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
  style.textContent = DIALOG_CSS;
  document.head.appendChild(style);
  _stylesInjected = true;
}


// ─────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────

const DIALOG_CSS = `
.xkt-exp-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 520px;
  max-height: calc(100vh - 64px);
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
.xkt-exp-dialog *, .xkt-exp-dialog *::before, .xkt-exp-dialog *::after {
  box-sizing: border-box;
}
.xkt-exp-dialog[hidden] { display: none; }

.xkt-exp-dialog .xkt-exp-header {
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
.xkt-exp-dialog .xkt-exp-header.xkt-exp-dragging { cursor: grabbing; }
.xkt-exp-dialog .xkt-exp-title {
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
.xkt-exp-dialog .xkt-exp-title-icon {
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
.xkt-exp-dialog .xkt-exp-title-icon svg { width: 100%; height: 100%; display: block; }
.xkt-exp-dialog .xkt-exp-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-exp-dialog .xkt-exp-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-exp-dialog .xkt-exp-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
.xkt-exp-dialog .xkt-exp-close {
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
.xkt-exp-dialog .xkt-exp-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-exp-pill {
  position: fixed;
  top: 17px;
  right: 17px;
  z-index: 200000000;
  padding: 9px 16px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #fff;
  background: #2c7e6f;
  border: 1px solid #1c594d;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.xkt-exp-pill:hover { background: #1c594d; }
.xkt-exp-pill[hidden] { display: none; }

.xkt-exp-dialog .xkt-exp-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 10px 14px 12px;
}

/* Section block. */
.xkt-exp-dialog .xkt-exp-section {
  margin: 6px 0 10px;
}
.xkt-exp-dialog .xkt-exp-section-label {
  font-size: 9.5px;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #2c7e6f;
  margin-bottom: 6px;
}
.xkt-exp-dialog .xkt-exp-section-help {
  font-size: 11px;
  color: #777;
  margin-bottom: 6px;
}

/* Model rows. */
.xkt-exp-dialog .xkt-exp-models {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid #ececec;
  border-radius: 6px;
  background: #fff;
  padding: 4px;
  max-height: 200px;
  overflow-y: auto;
}
.xkt-exp-dialog .xkt-exp-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11.5px;
}
.xkt-exp-dialog .xkt-exp-row:hover { background: #f5fbfa; }
.xkt-exp-dialog .xkt-exp-row.xkt-exp-row-selected {
  background: #2d5e8c;
  color: #fff;
}
.xkt-exp-dialog .xkt-exp-row.xkt-exp-row-selected .xkt-exp-row-id { color: #fff; }
.xkt-exp-dialog .xkt-exp-row-id {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 600;
  color: #111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-exp-dialog .xkt-exp-row-tags {
  flex-shrink: 0;
  display: inline-flex;
  gap: 4px;
}
.xkt-exp-dialog .xkt-exp-tag {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.2px;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid transparent;
}
.xkt-exp-dialog .xkt-exp-tag-scene { background: #eef3f9; color: #2d5e8c; border-color: #c8d6e6; }
.xkt-exp-dialog .xkt-exp-tag-data  { background: #ebf2ee; color: #2c7e6f; border-color: #b8d2c5; }

/* Bulk-select buttons inline with the section label. */
.xkt-exp-dialog .xkt-exp-bulk {
  display: inline-flex;
  gap: 4px;
  margin-left: 8px;
}
.xkt-exp-dialog .xkt-exp-bulk-btn {
  font: inherit;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.2px;
  text-transform: uppercase;
  color: #2c7e6f;
  background: transparent;
  border: 1px solid #b8d2c5;
  border-radius: 999px;
  padding: 1px 8px;
  cursor: pointer;
}
.xkt-exp-dialog .xkt-exp-bulk-btn:hover { background: #ebf2ee; }

/* Dataset chips. */
.xkt-exp-dialog .xkt-exp-datasets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.xkt-exp-dialog .xkt-exp-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid #d0d4da;
  border-radius: 999px;
  font-size: 11px;
  cursor: pointer;
  background: #fff;
  color: #333;
  transition: background 80ms ease-out, border-color 80ms ease-out, color 80ms ease-out;
}
.xkt-exp-dialog .xkt-exp-chip:hover { background: #f5fbfa; }
.xkt-exp-dialog .xkt-exp-chip.xkt-exp-chip-on {
  background: #ebf2ee;
  border-color: #2c7e6f;
  color: #1c594d;
  font-weight: 650;
}
.xkt-exp-dialog .xkt-exp-chip.xkt-exp-chip-disabled,
.xkt-exp-dialog .xkt-exp-chip[disabled] {
  opacity: 0.45;
  cursor: not-allowed;
}
.xkt-exp-dialog .xkt-exp-chip.xkt-exp-chip-disabled:hover { background: #fff; }
/* Footer — status + actions. */
.xkt-exp-dialog .xkt-exp-footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid #ececec;
  background: #fafafa;
}
.xkt-exp-dialog .xkt-exp-status {
  flex: 1;
  font-size: 11px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-exp-dialog .xkt-exp-status.xkt-exp-status-error { color: #b73d3d; }
.xkt-exp-dialog .xkt-exp-status.xkt-exp-status-ok    { color: #2c7e6f; }
.xkt-exp-dialog .xkt-exp-btn {
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
.xkt-exp-dialog .xkt-exp-btn:hover { background: #f0f0f0; }
.xkt-exp-dialog .xkt-exp-btn-primary {
  background: #2c7e6f;
  border-color: #1c594d;
  color: #fff;
}
.xkt-exp-dialog .xkt-exp-btn-primary:hover { background: #1c594d; }
.xkt-exp-dialog .xkt-exp-btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Progress strip — same chrome as SceneModelInspector. */
.xkt-exp-dialog .xkt-exp-progress {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  min-height: 30px;
  border-top: 1px solid #ececec;
  background: #fafafa;
  font-size: 11px;
}
.xkt-exp-dialog .xkt-exp-progress.xkt-exp-active {
  background: #fff8e1;
  border-top-color: #f0e3b0;
}
.xkt-exp-dialog .xkt-exp-progress-label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #888;
  font-weight: 500;
}
.xkt-exp-dialog .xkt-exp-progress.xkt-exp-active .xkt-exp-progress-label { color: #6b5300; }
.xkt-exp-dialog .xkt-exp-progress-bar {
  flex-shrink: 0;
  width: 110px;
  height: 8px;
  opacity: 0.4;
  transition: opacity 150ms ease-out;
}
.xkt-exp-dialog .xkt-exp-progress.xkt-exp-active .xkt-exp-progress-bar { opacity: 1; }

.xkt-exp-dialog .xkt-exp-empty {
  padding: 16px 8px;
  text-align: center;
  color: #777;
  font-size: 11px;
  border: 1px dashed #d0d0d0;
  border-radius: 6px;
  background: #fff;
}

/* Parameters section — per-dataset sub-blocks of label/input
   pairs. Stays hidden when no selected dataset has params. */
.xkt-exp-dialog .xkt-exp-params {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.xkt-exp-dialog .xkt-exp-param-block {
  border: 1px solid #ececec;
  border-left: 3px solid #2c7e6f;
  border-radius: 6px;
  background: #fff;
  padding: 8px 10px;
}
.xkt-exp-dialog .xkt-exp-param-block-label {
  font-size: 10.5px;
  font-weight: 650;
  color: #2c7e6f;
  margin-bottom: 6px;
  letter-spacing: 0.01em;
}
.xkt-exp-dialog .xkt-exp-param-grid {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 10px;
  align-items: baseline;
}
.xkt-exp-dialog .xkt-exp-param-label {
  font-size: 11px;
  font-weight: 600;
  color: #444;
  white-space: nowrap;
}
.xkt-exp-dialog .xkt-exp-param-input {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.xkt-exp-dialog .xkt-exp-param-control {
  font: 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #111;
  background: #fff;
  border: 1px solid #d0d4da;
  border-radius: 4px;
  padding: 3px 6px;
  outline: none;
  transition: border-color 120ms ease-out, box-shadow 120ms ease-out;
}
.xkt-exp-dialog .xkt-exp-param-control:focus {
  border-color: #2c7e6f;
  box-shadow: 0 0 0 2px rgba(44, 126, 111, 0.18);
}
.xkt-exp-dialog .xkt-exp-param-control--str { width: 100%; min-width: 8ch; }
.xkt-exp-dialog .xkt-exp-param-control--num { width: 14ch; font-variant-numeric: tabular-nums; }
.xkt-exp-dialog .xkt-exp-param-control--bool {
  appearance: auto;
  width: 14px;
  height: 14px;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}
.xkt-exp-dialog .xkt-exp-param-help {
  font-size: 10.5px;
  color: #777;
  line-height: 1.4;
}
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

export class ExportDialog extends FloatingPanelBase {

  /** Per-DemoHelper instance registry. */
  private static readonly _instances = new WeakMap<DemoHelper, ExportDialog>();

  /**
   * SVG markup for the dialog's title-bar glyph — the standard
   * "export" mark: an up-arrow rising out of an open tray.
   * Strokes use `currentColor`. Shared visual language with
   * `ExportBCFPanel.iconSvg` so all "export …" actions read as
   * the same gesture.
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

  static getFor(demoHelper: DemoHelper): ExportDialog | undefined {
    const inst = ExportDialog._instances.get(demoHelper);
    return inst && !inst._destroyed ? inst : undefined;
  }

  static openFor(params: ExportDialogParams): ExportDialog {
    let inst = ExportDialog._instances.get(params.demoHelper);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new ExportDialog(params);
    return inst;
  }

  readonly demoHelper: DemoHelper;

  // DOM refs.
  private _bodyEl!: HTMLElement;
  private _modelsListEl!: HTMLElement;
  private _datasetsEl!: HTMLElement;
  private _paramsSectionEl!: HTMLElement;
  private _paramsListEl!: HTMLElement;
  private _statusEl!: HTMLElement;
  private _progressEl!: HTMLElement;
  private _progressLabel!: HTMLElement;
  private _progressBar!: HTMLProgressElement;
  private _exportBtn!: HTMLButtonElement;
  private _cancelBtn!: HTMLButtonElement;

  /** Currently-checked SceneModel ids. */
  private _selectedModelId: string | null = null;
  /** Currently-checked dataset-type descriptors. */
  private readonly _selectedDatasets = new Set<string>();
  /**
   * Per-dataset → per-param values. Survives toggling the
   * dataset chip off and back on, so re-checking a dataset
   * doesn't reset the user's parameter edits.
   */
  private _datasetParamValues: Record<string, Record<string, any>> = {};

  // Lifecycle state.
  private _listenersAttached = false;
  private _refreshScheduled = false;
  private readonly _unsubs: Array<() => void> = [];

  // Drag state.

  constructor(params: ExportDialogParams) {
    if (!params || !params.demoHelper) {
      throw new Error("ExportDialog: demoHelper is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-exp-dialog",
      classPrefix: "xkt-exp",
      modal:       true,
    });
    this.demoHelper = params.demoHelper;

    // Replace any prior dialog bound to the same helper.
    const prior = ExportDialog._instances.get(params.demoHelper);
    if (prior && !prior._destroyed) prior.destroy();
    ExportDialog._instances.set(params.demoHelper, this);

    // Seed default dataset selection.
    const initialDatasets = params.defaultDatasets ?? ["xgf"];
    for (const d of initialDatasets) this._selectedDatasets.add(d);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();
    this._wireDomEvents();
    this._renderModels();
    this._renderDatasets();
    this._renderParams();


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
    this._renderModels();        // catch up on any models loaded while hidden
    this._attachListeners();
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
    if (ExportDialog._instances.get(this.demoHelper) === this) {
      ExportDialog._instances.delete(this.demoHelper);
    }
    super.destroy();
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-exp-pill", {
      type: "button",
      title: "Reopen the Export dialog",
      hidden: true,
      textContent: "Export",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-exp-dialog");

    // Header.
    this._header = el("div", "xkt-exp-header");
    const title = el("h2", "xkt-exp-title");
    title.innerHTML =
      `<span class="xkt-exp-title-icon">${ExportDialog.iconSvg()}</span>` +
      `<span class="xkt-exp-title-stack">` +
        `<span class="xkt-exp-title-text">Export Model</span>` +
        `<span class="xkt-exp-subtitle">Save the current model.</span>` +
      `</span>`;

    this._closeBtn = el("button", "xkt-exp-close", {
      type: "button",
      "aria-label": "Close dialog",
      title: "Close dialog",
      innerHTML: "×",
    }) as HTMLButtonElement;

    this._header.append(title, this._closeBtn);
    this._panel.appendChild(this._header);

    // Body.
    this._bodyEl = el("div", "xkt-exp-body");

    // ── Model section (single-select)
    {
      const section = el("div", "xkt-exp-section");
      section.appendChild(el("div", "xkt-exp-section-label", {textContent: "Model"}));
      this._modelsListEl = el("div", "xkt-exp-models");
      section.appendChild(this._modelsListEl);
      this._bodyEl.appendChild(section);
    }

    // ── Datasets section
    {
      const section = el("div", "xkt-exp-section");
      section.appendChild(el("div", "xkt-exp-section-label", {textContent: "Dataset Types"}));
      section.appendChild(el("div", "xkt-exp-section-help", {
        textContent: "Each dataset writes the listed files per selected model. Multi-select for parallel exports.",
      }));
      this._datasetsEl = el("div", "xkt-exp-datasets");
      section.appendChild(this._datasetsEl);
      this._bodyEl.appendChild(section);
    }

    // ── Parameters section — only renders rows for selected
    // datasets that have configurable params; hides itself when
    // nothing applies, so empty rows don't clutter the dialog.
    {
      this._paramsSectionEl = el("div", "xkt-exp-section");
      this._paramsSectionEl.appendChild(el("div", "xkt-exp-section-label", {textContent: "Parameters"}));
      this._paramsListEl = el("div", "xkt-exp-params");
      this._paramsSectionEl.appendChild(this._paramsListEl);
      this._paramsSectionEl.style.display = "none";
      this._bodyEl.appendChild(this._paramsSectionEl);
    }

    this._panel.appendChild(this._bodyEl);

    // Progress strip (hidden when idle).
    this._progressEl = el("div", "xkt-exp-progress");
    this._progressLabel = el("div", "xkt-exp-progress-label", {textContent: "Idle"});
    this._progressBar = el("progress", "xkt-exp-progress-bar") as HTMLProgressElement;
    this._progressBar.max = 1;
    this._progressBar.value = 0;
    this._progressEl.append(this._progressLabel, this._progressBar);
    this._panel.appendChild(this._progressEl);

    // Footer.
    const footer = el("div", "xkt-exp-footer");
    this._statusEl = el("div", "xkt-exp-status", {textContent: ""});
    this._cancelBtn = el("button", "xkt-exp-btn", {
      type: "button",
      textContent: "Cancel",
      title: "Cancel + close the dialog",
    }) as HTMLButtonElement;
    this._exportBtn = el("button", "xkt-exp-btn xkt-exp-btn-primary", {
      type: "button",
      textContent: "Export",
      title: "Run the export and download the resulting files",
    }) as HTMLButtonElement;
    footer.append(this._statusEl, this._cancelBtn, this._exportBtn);
    this._panel.appendChild(footer);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }

  private _wireDomEvents(): void {
    this._cancelBtn.addEventListener("click", () => this.hide());
    this._exportBtn.addEventListener("click", () => this.runExport());
  }


  // ── Live sync — Scene + Data lifecycle listeners ──────────────

  /**
   * Subscribe to the four lifecycle events that can change the
   * model picker's contents — `Scene.onSceneModelCreated /
   * onSceneModelDestroyed` and `Data.onDataModelCreated /
   * onDataModelDestroyed`. Each one calls
   * {@link _scheduleRefresh}, which coalesces bursts (e.g. a
   * dataset that loads scene + data in quick succession) into
   * one model-list repaint per animation frame.
   *
   * Listeners attach on {@link show} and detach on {@link hide}
   * / {@link destroy}, so a dismissed dialog costs nothing as
   * the helper churns through models.
   */
  private _attachListeners(): void {
    if (this._listenersAttached || this._destroyed) return;
    this._listenersAttached = true;

    const sub = (unsub: () => void) => this._unsubs.push(unsub);
    const onChange = () => this._scheduleRefresh();

    const sceneEv: any = (this.demoHelper.scene as any).events;
    if (sceneEv) {
      if (sceneEv.onSceneModelCreated?.subscribe)   sub(sceneEv.onSceneModelCreated.subscribe(onChange));
      if (sceneEv.onSceneModelDestroyed?.subscribe) sub(sceneEv.onSceneModelDestroyed.subscribe(onChange));
    }
    const dataEv: any = (this.demoHelper.data as any).events;
    if (dataEv) {
      if (dataEv.onDataModelCreated?.subscribe)   sub(dataEv.onDataModelCreated.subscribe(onChange));
      if (dataEv.onDataModelDestroyed?.subscribe) sub(dataEv.onDataModelDestroyed.subscribe(onChange));
    }
  }

  private _detachListeners(): void {
    if (!this._listenersAttached) return;
    for (const u of this._unsubs) {
      try { u(); } catch { /* ignore */ }
    }
    this._unsubs.length = 0;
    this._listenersAttached = false;
    this._refreshScheduled = false;
  }

  /**
   * Coalesce per-event create/destroy notifications into one
   * picker repaint per animation frame. Stale stale-id
   * selections are pruned during the repaint so the model list
   * never references a destroyed model.
   */
  private _scheduleRefresh(): void {
    if (this._destroyed || !this._listenersAttached) return;
    if (this._refreshScheduled) return;
    this._refreshScheduled = true;
    requestAnimationFrame(() => {
      this._refreshScheduled = false;
      if (this._destroyed || !this._listenersAttached) return;
      // _renderModels drops a stale selection and picks the
      // first available model when the previous one was
      // destroyed.
      this._renderModels();
    });
  }


  // ── Layout persistence ────────────────────────────────────────



  // ── Body rendering ────────────────────────────────────────────

  private _renderModels(): void {
    this._modelsListEl.innerHTML = "";

    const sceneModels = this.demoHelper.scene.models as Record<string, SceneModel>;
    const dataModels  = this.demoHelper.data.models as Record<string, DataModel>;

    const idSet = new Set<string>();
    if (sceneModels) for (const id of Object.keys(sceneModels)) idSet.add(id);
    if (dataModels)  for (const id of Object.keys(dataModels))  idSet.add(id);
    const ids = Array.from(idSet).sort();

    if (this._selectedModelId && !idSet.has(this._selectedModelId)) {
      this._selectedModelId = null;
    }
    if (!this._selectedModelId && ids.length > 0) {
      this._selectedModelId = ids[0];
    }

    if (ids.length === 0) {
      this._modelsListEl.appendChild(el("div", "xkt-exp-empty", {
        textContent: "No models loaded.",
      }));
      this._renderDatasets();
      this._refreshExportEnabled();
      return;
    }

    for (const id of ids) {
      const sm = sceneModels ? sceneModels[id] : undefined;
      const dm = dataModels  ? dataModels[id]  : undefined;

      const row = el("div", "xkt-exp-row");
      if (id === this._selectedModelId) row.classList.add("xkt-exp-row-selected");
      row.appendChild(el("span", "xkt-exp-row-id", {textContent: id, title: id}));

      const tags = el("div", "xkt-exp-row-tags");
      if (sm && hasContent((sm as any).objects)) {
        tags.appendChild(el("span", "xkt-exp-tag xkt-exp-tag-scene", {
          textContent: "Scene", title: "SceneModel has content",
        }));
      }
      if (dm && hasContent((dm as any).objects)) {
        tags.appendChild(el("span", "xkt-exp-tag xkt-exp-tag-data", {
          textContent: "Data", title: "DataModel has content",
        }));
      }
      row.appendChild(tags);

      row.addEventListener("click", () => {
        if (this._selectedModelId === id) return;
        this._selectedModelId = id;
        // Fresh slate per model: drop dataset selections and any
        // per-dataset param overrides, so the next render re-fills
        // defaults with the new model's id.
        this._selectedDatasets.clear();
        this._datasetParamValues = {};
        this._renderModels();
        this._renderDatasets();
        this._refreshExportEnabled();
      });

      this._modelsListEl.appendChild(row);
    }

    this._renderDatasets();
    this._refreshExportEnabled();
  }

  private _renderDatasets(): void {
    this._datasetsEl.innerHTML = "";

    // Re-render the Parameters block so any newly-resolved {id}
    // substitutions land in the input defaults.
    this._renderParams();

    for (const desc of DEFAULT_DATASET_TYPES) {
      const ids = parseDatasetFormats(desc);
      if (ids.length === 0) continue;
      if (!ids.every(i => FORMAT_REGISTRY[i])) continue;

      const compatible = this._isDatasetCompatible(desc);

      const chip = el("button", "xkt-exp-chip", {
        type:  "button",
        title: compatible ? desc : `${desc} — incompatible with the selected model`,
      }) as HTMLButtonElement;
      chip.appendChild(el("span", undefined, {textContent: humanReadableDatasetLabel(desc, ids)}));
      chip.disabled = !compatible;
      if (!compatible) chip.classList.add("xkt-exp-chip-disabled");

      const apply = () => chip.classList.toggle("xkt-exp-chip-on", this._selectedDatasets.has(desc));
      apply();

      if (compatible) {
        chip.addEventListener("click", () => {
          if (this._selectedDatasets.has(desc)) this._selectedDatasets.delete(desc);
          else                                  this._selectedDatasets.add(desc);
          apply();
          this._renderParams();
          this._refreshExportEnabled();
        });
      }

      this._datasetsEl.appendChild(chip);
    }
  }

  /**
   * Whether every format in `desc` can run against the currently-
   * selected model — each format's `needsSceneModel` /
   * `needsDataModel` must be satisfied by the model's actual
   * content (not just the bare presence of a SceneModel /
   * DataModel placeholder).
   */
  private _isDatasetCompatible(desc: string): boolean {
    const modelId = this._selectedModelId;
    if (!modelId) return false;
    const sm = (this.demoHelper.scene.models as any)?.[modelId];
    const dm = (this.demoHelper.data.models  as any)?.[modelId];
    const hasScene = !!sm && hasContent((sm as any).objects);
    const hasData  = !!dm && hasContent((dm as any).objects);
    const ids = parseDatasetFormats(desc);
    if (ids.length === 0) return false;
    for (const id of ids) {
      const entry = FORMAT_REGISTRY[id];
      if (!entry) return false;
      if (entry.needsSceneModel !== false && !hasScene) return false;
      if (entry.needsDataModel  && !hasData)             return false;
    }
    return true;
  }

  private _refreshExportEnabled(): void {
    const ok = this._selectedModelId !== null && this._selectedDatasets.size > 0;
    this._exportBtn.disabled = !ok;
  }


  // ── Parameters rendering ──────────────────────────────────────

  /**
   * For every selected dataset that has a `DATASET_PARAMS`
   * schema, emit a sub-block listing its parameter inputs. The
   * whole section hides when nothing applies, so a typical
   * "select XGF + DataModel" run shows no Parameters block at
   * all.
   */
  private _renderParams(): void {
    this._paramsListEl.innerHTML = "";
    let blocks = 0;

    // Render in DEFAULT_DATASET_TYPES order so the layout doesn't
    // jitter as the user toggles chips off and back on.
    for (const desc of DEFAULT_DATASET_TYPES) {
      if (!this._selectedDatasets.has(desc)) continue;
      const defs = DATASET_PARAMS[desc];
      if (!defs || defs.length === 0) continue;

      const block = el("div", "xkt-exp-param-block");
      block.appendChild(el("div", "xkt-exp-param-block-label", {
        textContent: humanReadableDatasetLabel(desc, parseDatasetFormats(desc)),
        title: desc,
      }));

      const grid = el("div", "xkt-exp-param-grid");
      for (const def of defs) {
        const valueRow = (this._datasetParamValues[desc] ||= {});
        if (!(def.id in valueRow)) {
          // Resolve `{id}` in the default so the user sees a real
          // filename (e.g. `myModel.xgf`) instead of the literal
          // placeholder. The selected model is the substitution
          // source; switching models clears `_datasetParamValues`
          // so the new model's id flows into the inputs.
          valueRow[def.id] = resolveIdPlaceholder(def.default, this._selectedModelId);
        }

        const labelCell = el("label", "xkt-exp-param-label", {textContent: def.label});
        const inputCell = el("div", "xkt-exp-param-input");
        inputCell.appendChild(this._mkParamInput(desc, def));
        if (def.help) {
          inputCell.appendChild(el("div", "xkt-exp-param-help", {textContent: def.help}));
        }
        grid.append(labelCell, inputCell);
      }

      block.appendChild(grid);
      this._paramsListEl.appendChild(block);
      blocks++;
    }

    this._paramsSectionEl.style.display = blocks > 0 ? "" : "none";
  }

  private _mkParamInput(desc: string, def: ParamDef): HTMLElement {
    const valueRow = this._datasetParamValues[desc];

    if (def.type === "boolean") {
      const inp = el("input", "xkt-exp-param-control xkt-exp-param-control--bool", {type: "checkbox"}) as HTMLInputElement;
      inp.checked = !!valueRow[def.id];
      inp.addEventListener("change", () => { valueRow[def.id] = inp.checked; });
      return inp;
    }

    if (def.type === "number") {
      const inp = el("input", "xkt-exp-param-control xkt-exp-param-control--num", {
        type: "number",
        step: "any",
      }) as HTMLInputElement;
      inp.value = String(valueRow[def.id] ?? "");
      inp.addEventListener("change", () => {
        const n = parseFloat(inp.value);
        valueRow[def.id] = Number.isFinite(n) ? n : null;
      });
      return inp;
    }

    // string (default)
    const inp = el("input", "xkt-exp-param-control xkt-exp-param-control--str", {type: "text"}) as HTMLInputElement;
    inp.value = String(valueRow[def.id] ?? "");
    inp.addEventListener("input", () => { valueRow[def.id] = inp.value; });
    return inp;
  }


  // ── Status + progress ─────────────────────────────────────────

  private _setStatus(text: string, kind: "ok" | "error" | "neutral"): void {
    this._statusEl.textContent = text;
    this._statusEl.classList.remove("xkt-exp-status-ok", "xkt-exp-status-error");
    if (kind === "ok")    this._statusEl.classList.add("xkt-exp-status-ok");
    if (kind === "error") this._statusEl.classList.add("xkt-exp-status-error");
  }

  private _showProgress(label: string, current: number, total: number): void {
    this._progressEl.classList.add("xkt-exp-active");
    this._progressLabel.textContent = label;
    if (total <= 0) {
      this._progressBar.removeAttribute("value");
    } else {
      this._progressBar.max   = total;
      this._progressBar.value = current;
    }
  }

  private _hideProgress(): void {
    this._progressEl.classList.remove("xkt-exp-active");
    this._progressLabel.textContent = "Idle";
    this._progressBar.max = 1;
    this._progressBar.value = 0;
  }


  /**
   * Build the per-format `options` object for one export task.
   *
   * Walks the dataset's parameter schema; for each param whose
   * `applyTo` includes the current format id, copies the user's
   * value into the resulting options. String values pass through
   * a `{id}` → `sceneModel.id` substitution so a single template
   * can disambiguate filenames in a multi-model export.
   *
   * Filename-only params (those with empty `applyTo`) are
   * skipped here — they're consumed by
   * {@link _resolveFilenameForTask}.
   */
  private _buildOptionsForFormatId(desc: string, formatId: string, subjectId: string): Record<string, any> {
    const out: Record<string, any> = {};
    const defs = DATASET_PARAMS[desc];
    if (!defs || defs.length === 0) return out;
    const valueRow = this._datasetParamValues[desc] || {};
    for (const def of defs) {
      if (!def.applyTo.includes(formatId)) continue;
      let v = valueRow[def.id];
      if (v === undefined || v === null) v = def.default;
      if (typeof v === "string") v = v.replace(/\{id\}/g, subjectId);
      // Skip empty strings — leaving the field blank means "use the
      // exporter's own default".
      if (typeof v === "string" && v.length === 0) continue;
      out[def.id] = v;
    }
    return out;
  }

  /**
   * Resolve the download filename for one `(dataset, format,
   * subjectId)` task by looking up the dataset's first param
   * whose `filenameFor` matches the format id and substituting
   * `{id}` → `subjectId`. Returns `null` when no schema entry
   * matches, so the caller can fall back to the `${id}.${ext}`
   * default.
   */
  private _resolveFilenameForTaskId(desc: string, formatId: string, subjectId: string): string | null {
    const defs = DATASET_PARAMS[desc];
    if (!defs) return null;
    const valueRow = this._datasetParamValues[desc] || {};
    for (const def of defs) {
      if (def.filenameFor !== formatId) continue;
      let v = valueRow[def.id];
      if (v === undefined || v === null) v = def.default;
      if (typeof v !== "string" || v.length === 0) continue;
      return v.replace(/\{id\}/g, subjectId);
    }
    return null;
  }


  // ── Export ────────────────────────────────────────────────────

  /**
   * Run the configured export.
   *
   * For each `(SceneModel × dataset descriptor × format id)`
   * triple, instantiate the matching exporter, call `write` on
   * it, wrap the bytes in a `Blob`, and trigger a browser
   * download. Each dataset descriptor produces one file per
   * format id — `"xgf,datamodel"` ⇒ two files (`.xgf` + JSON).
   *
   * Failures land in the footer status line and skip to the
   * next file — so a single failed exporter doesn't abort the
   * whole batch.
   */
  async runExport(): Promise<void> {
    const selectedIds = this._selectedModelId ? [this._selectedModelId] : [];
    if (selectedIds.length === 0) {
      this._setStatus("No model selected.", "error");
      return;
    }
    const datasets = Array.from(this._selectedDatasets);
    if (datasets.length === 0) {
      this._setStatus("No dataset types selected.", "error");
      return;
    }

    // Plan: iterate selected model ids and look up SceneModel +
    // DataModel per id (either may be missing — only the
    // `datamodel` exporter can run on a DataModel-only entry).
    // Flatten into per-`(model, format)` tasks so the progress
    // bar advances per file. Each task also carries its own
    // pre-resolved `options` object built from the dataset's
    // parameter schema.
    type Task = {
      sceneModel?: SceneModel;
      dataModel?:  DataModel;
      modelId:     string;
      entry:       FormatEntry;
      options:     Record<string, any>;
      filename:    string;
    };
    const tasks: Task[] = [];
    for (const modelId of selectedIds) {
      const sm = (this.demoHelper.scene.models as any)[modelId] as SceneModel | undefined;
      const dm = (this.demoHelper.data.models  as any)[modelId] as DataModel  | undefined;
      if ((sm && sm.destroyed) ? false : (!sm && !dm)) {
        console.warn(`[ExportDialog] Selected '${modelId}' has neither a live SceneModel nor a DataModel`);
        continue;
      }
      for (const desc of datasets) {
        const ids = parseDatasetFormats(desc);
        for (const id of ids) {
          const entry = FORMAT_REGISTRY[id];
          if (!entry) continue;
          if (entry.needsSceneModel !== false && !sm) {
            console.warn(`[ExportDialog] Skipping ${id} for '${modelId}' — no SceneModel (only the DataModel JSON exporter can run on a DataModel-only entry)`);
            continue;
          }
          if (entry.needsDataModel && !dm) {
            console.warn(`[ExportDialog] Skipping ${id} for '${modelId}' — no DataModel`);
            continue;
          }
          // {id} substitution in the filename uses the SceneModel
          // id when present, otherwise the DataModel id, falling
          // back to the picker id in pathological cases.
          const subjectId =
            (sm  && (sm  as any).id) ??
            (dm  && (dm  as any).id) ??
            modelId;
          const filename =
            this._resolveFilenameForTaskId(desc, id, subjectId) ??
            `${subjectId}.${entry.ext}`;
          tasks.push({
            sceneModel: sm,
            dataModel:  dm,
            modelId,
            entry,
            options:    this._buildOptionsForFormatId(desc, id, subjectId),
            filename,
          });
        }
      }
    }

    if (tasks.length === 0) {
      this._setStatus("Nothing to export — every selection was skipped.", "error");
      return;
    }

    this._exportBtn.disabled = true;
    this._cancelBtn.disabled = true;
    this._setStatus(`Exporting ${tasks.length} file${tasks.length === 1 ? "" : "s"}…`, "neutral");

    let okCount = 0;
    let errCount = 0;
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const filename = t.filename;
      this._showProgress(`Writing ${filename} (${i + 1}/${tasks.length})`, i, tasks.length);
      try {
        const exporter = t.entry.build();
        const raw = await exporter.write({
          sceneModel: t.sceneModel,
          dataModel:  t.dataModel,
        }, t.options);
        const bytes = t.entry.toBytes(raw);
        downloadBlob(new Blob([bytes], {type: t.entry.mime}), filename);
        okCount++;
      } catch (e: any) {
        errCount++;
        const msg = e?.message ?? String(e);
        console.error(`[ExportDialog] Failed ${filename}: ${msg}`);
      }
    }
    this._hideProgress();
    this._exportBtn.disabled = false;
    this._cancelBtn.disabled = false;
    this._refreshExportEnabled();

    if (errCount === 0) {
      this._setStatus(`Exported ${okCount} file${okCount === 1 ? "" : "s"}.`, "ok");
      // Dismiss as soon as every requested file landed — failures
      // stay on screen so the user can read the status line.
      this.hide();
    } else if (okCount === 0) {
      this._setStatus(`All ${errCount} export(s) failed — see console.`, "error");
    } else {
      this._setStatus(`Exported ${okCount}, ${errCount} failed — see console.`, "error");
    }
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────


function hasContent(objects: unknown): boolean {
  return !!objects && typeof objects === "object" && Object.keys(objects as Record<string, unknown>).length > 0;
}

function resolveIdPlaceholder(value: unknown, modelId: string | null): unknown {
  if (typeof value !== "string" || !modelId) return value;
  return value.replace(/\{id\}/g, modelId);
}

function parseDatasetFormats(dataset: string): string[] {
  return String(dataset)
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Friendly chip label for a dataset descriptor — falls back to
 * the literal descriptor when no nicer label is known.
 */
function humanReadableDatasetLabel(_descriptor: string, ids: string[]): string {
  // Prefer the first format's display label, then summarise extras.
  const first = FORMAT_REGISTRY[ids[0]];
  if (!first) return ids.join(" + ");
  if (ids.length === 1) return first.label;
  return `${first.label} + ${ids.slice(1).map(i => FORMAT_REGISTRY[i]?.label ?? i).join(" + ")}`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Tiny delay so Chrome has time to start the download before
    // we revoke — matches the snapshot-export helpers in DemoHelper.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
