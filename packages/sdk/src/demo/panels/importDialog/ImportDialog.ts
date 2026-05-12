/**
 * Modal-style floating dialog that lets the user import a model
 * from local disk. Driven by the declarative {@link IMPORT_DATA_SETS}
 * registry — a new data set is added by editing that array, not
 * this file.
 *
 * @module demo/panels/importDialog/ImportDialog
 */

import type {DemoHelper} from "../../DemoHelper";
import type {CoordinateSystemParams} from "../../../scene";
import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";
import {IMPORT_DATA_SETS} from "./IMPORT_DATA_SETS";
import {IMPORT_BASES} from "./IMPORT_BASES";
import type {ImportDataSet} from "./ImportDataSet";
import type {ImportDataSetFile} from "./ImportDataSetFile";
import type {ImportCoordSysBasis} from "./ImportCoordSysBasis";


type Units = CoordinateSystemParams["units"];
const UNITS: ReadonlyArray<Units> = ["meters", "millimeters", "inches", "feet"];


// ─────────────────────────────────────────────────────────────────
// Module CSS — visually matches the toolbar flyout / context menu.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-imp-styles";
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

const PANEL_CSS = `
.xkt-imp-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 400px;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  color: #111;
  z-index: 200000000;
  overflow: hidden;
  box-sizing: border-box;
}
.xkt-imp-panel *, .xkt-imp-panel *::before, .xkt-imp-panel *::after {
  box-sizing: border-box;
}
.xkt-imp-panel[hidden] { display: none; }

.xkt-imp-panel .xkt-imp-header {
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
.xkt-imp-panel .xkt-imp-header.xkt-imp-dragging { cursor: grabbing; }
.xkt-imp-panel .xkt-imp-title {
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
.xkt-imp-panel .xkt-imp-title-icon {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  color: #2d5e8c;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.xkt-imp-panel .xkt-imp-title-icon svg { width: 100%; height: 100%; display: block; }
.xkt-imp-panel .xkt-imp-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-imp-panel .xkt-imp-close {
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
.xkt-imp-panel .xkt-imp-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-imp-panel .xkt-imp-body {
  flex: 1 1 auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.xkt-imp-panel .xkt-imp-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.xkt-imp-panel .xkt-imp-row-label {
  font-size: 9.5px;
  font-weight: 650;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: #2d5e8c;
  margin-bottom: 4px;
}

.xkt-imp-panel .xkt-imp-select {
  width: 100%;
  padding: 7px 10px;
  font: inherit;
  font-size: 13px;
  color: #111;
  background: #fff;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  cursor: pointer;
}

.xkt-imp-panel .xkt-imp-slot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  background: #fafafa;
  border: 1px solid #ececec;
  border-radius: 6px;
}
.xkt-imp-panel .xkt-imp-slot-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #555;
  cursor: pointer;
}
.xkt-imp-panel .xkt-imp-slot-name.xkt-imp-slot-chosen {
  color: #111;
  font-weight: 500;
}
.xkt-imp-panel .xkt-imp-slot-btn {
  flex-shrink: 0;
  padding: 5px 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  color: #2d5e8c;
  background: #fff;
  border: 1px solid #c8d6e6;
  border-radius: 5px;
  cursor: pointer;
}
.xkt-imp-panel .xkt-imp-slot-btn:hover { background: #eef3f9; }
.xkt-imp-panel .xkt-imp-slot input[type=file] { display: none; }

.xkt-imp-panel .xkt-imp-note {
  padding: 8px 10px;
  font-size: 12px;
  color: #555;
  background: #fafafa;
  border: 1px solid #ececec;
  border-radius: 6px;
}

.xkt-imp-panel .xkt-imp-cs-grid {
  display: grid;
  grid-template-columns: 70px 1fr;
  align-items: center;
  gap: 6px 10px;
}
.xkt-imp-panel .xkt-imp-cs-sublabel {
  font-size: 12px;
  color: #555;
}
.xkt-imp-panel .xkt-imp-cs-grid select,
.xkt-imp-panel .xkt-imp-cs-grid input[type=number] {
  width: 100%;
  padding: 5px 8px;
  font: inherit;
  font-size: 13px;
  color: #111;
  background: #fff;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
}
.xkt-imp-panel .xkt-imp-cs-grid select { cursor: pointer; }
.xkt-imp-panel .xkt-imp-cs-origin {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
}
.xkt-imp-panel .xkt-imp-disabled { opacity: 0.5; }

.xkt-imp-panel .xkt-imp-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid #ececec;
  flex: 0 0 auto;
}
.xkt-imp-panel .xkt-imp-btn {
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
.xkt-imp-panel .xkt-imp-btn:hover { background: #f0f0f0; }
.xkt-imp-panel .xkt-imp-btn-load {
  background: #2d5e8c;
  border-color: #1f4669;
  color: #fff;
}
.xkt-imp-panel .xkt-imp-btn-load:hover { background: #1f4669; }
.xkt-imp-panel .xkt-imp-btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

.xkt-imp-pill {
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
.xkt-imp-pill:hover { background: #1f4669; }
.xkt-imp-pill[hidden] { display: none; }
`;


/** Construction params for {@link ImportDialog}. */
export interface ImportDialogParams {
  demoHelper: DemoHelper;
  container?: HTMLElement;
}


export class ImportDialog extends FloatingPanelBase {

  private static readonly _instances = new WeakMap<DemoHelper, ImportDialog>();

  /**
   * Title-bar "import" mark — down-arrow descending into an open
   * tray. Mirrors {@link ExportDialog.iconSvg}'s tray-and-arrow
   * vocabulary (same strokes, same tray) so the two dialogs read
   * as a matched in/out pair.
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

  static getFor(demoHelper: DemoHelper): ImportDialog | undefined {
    const inst = ImportDialog._instances.get(demoHelper);
    return inst && !inst._destroyed ? inst : undefined;
  }

  static openFor(params: ImportDialogParams): ImportDialog {
    let inst = ImportDialog._instances.get(params.demoHelper);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new ImportDialog(params);
    return inst;
  }

  readonly demoHelper: DemoHelper;

  private _filesHost!: HTMLElement;
  private _dataSetSelect!: HTMLSelectElement;
  private _basisSelect!: HTMLSelectElement;
  private _coordSysSection!: HTMLElement;
  private _loadBtn!: HTMLButtonElement;

  private _activeDataSet!: ImportDataSet;
  private readonly _chosenFiles = new Map<string, File>();

  private _basis!: ImportCoordSysBasis;
  private _units: Units = "meters";
  private _origin: [number, number, number] = [0, 0, 0];

  constructor(params: ImportDialogParams) {
    if (!params || !params.demoHelper) {
      throw new Error("ImportDialog: demoHelper is required");
    }
    super({
      container:   params.container,
      storageKey:  "xkt-imp-panel",
      classPrefix: "xkt-imp",
      modal:       true,
    });
    this.demoHelper = params.demoHelper;

    const prior = ImportDialog._instances.get(this.demoHelper);
    if (prior && !prior._destroyed) prior.destroy();
    ImportDialog._instances.set(this.demoHelper, this);

    injectStylesOnce();
    this._activeDataSet = pickById(IMPORT_DATA_SETS, "xgf");
    this._basis = this._defaultBasisFor(this._activeDataSet);
    this._buildDom();
    this._bindChrome();
    this._renderFileRows();
    this._refreshLoadEnabled();
    // Always open on construction. The base class's _restoreLayout
    // can flip the panel to hidden when localStorage remembers a
    // prior close — fine for ambient panels (Boundaries, Stats),
    // wrong for a menu-triggered dialog where the user always
    // expects it to appear.
    this.show();
  }

  destroy(): void {
    if (this._destroyed) return;
    if (ImportDialog._instances.get(this.demoHelper) === this) {
      ImportDialog._instances.delete(this.demoHelper);
    }
    super.destroy();
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-imp-pill", {
      type: "button",
      title: "Reopen Import",
      hidden: true,
      textContent: "Import",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-imp-panel");

    this._header = el("div", "xkt-imp-header");
    const title = el("h2", "xkt-imp-title");
    title.innerHTML =
      `<span class="xkt-imp-title-icon">${ImportDialog.iconSvg()}</span>` +
      `<span class="xkt-imp-title-text">Import Model</span>`;
    this._closeBtn = el("button", "xkt-imp-close", {
      type: "button",
      "aria-label": "Close Import dialog",
      title: "Close",
      innerHTML: "×",
    }) as HTMLButtonElement;
    this._header.append(title, this._closeBtn);
    this._panel.appendChild(this._header);

    const body = el("div", "xkt-imp-body");

    const dataSetRow = el("div", "xkt-imp-row");
    dataSetRow.append(
      el("label", "xkt-imp-row-label", {textContent: "Data set", htmlFor: "xkt-imp-data-set"}),
      this._buildDataSetSelect(),
    );
    body.appendChild(dataSetRow);

    this._filesHost = el("div", "xkt-imp-row");
    this._filesHost.append(el("label", "xkt-imp-row-label", {textContent: "Files"}));
    body.appendChild(this._filesHost);

    this._coordSysSection = this._buildCoordSysSection();
    body.appendChild(this._coordSysSection);
    this._applyCoordSysEnabled();

    this._panel.appendChild(body);

    const footer = el("div", "xkt-imp-footer");
    const cancelBtn = el("button", "xkt-imp-btn", {
      type: "button",
      textContent: "Cancel",
    }) as HTMLButtonElement;
    cancelBtn.addEventListener("click", () => this.hide());
    this._loadBtn = el("button", "xkt-imp-btn xkt-imp-btn-load", {
      type: "button",
      textContent: "Load",
    }) as HTMLButtonElement;
    this._loadBtn.addEventListener("click", () => this._runLoad());
    footer.append(cancelBtn, this._loadBtn);
    this._panel.appendChild(footer);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }

  private _buildDataSetSelect(): HTMLSelectElement {
    const select = el("select", "xkt-imp-select", {
      id: "xkt-imp-data-set",
      name: "data-set",
      "aria-label": "Data set",
    }) as HTMLSelectElement;
    for (const ds of IMPORT_DATA_SETS) {
      const opt = document.createElement("option");
      opt.value = ds.id;
      opt.textContent = ds.label;
      select.appendChild(opt);
    }
    select.value = this._activeDataSet.id;
    select.addEventListener("change", () => {
      const next = IMPORT_DATA_SETS.find(d => d.id === select.value);
      if (!next) return;
      this._activeDataSet = next;
      this._chosenFiles.clear();
      this._renderFileRows();
      this._applyDefaultBasis();
      this._applyCoordSysEnabled();
      this._refreshLoadEnabled();
    });
    this._dataSetSelect = select;
    return select;
  }

  private _applyCoordSysEnabled(): void {
    const enabled = this._activeDataSet.loadsSceneGeometry !== false;
    this._coordSysSection.classList.toggle("xkt-imp-disabled", !enabled);
    this._coordSysSection.querySelectorAll("select, input").forEach((field) => {
      (field as HTMLSelectElement | HTMLInputElement).disabled = !enabled;
    });
  }

  /** Re-pick the basis from the active data set's hint + update the select. */
  private _applyDefaultBasis(): void {
    this._basis = this._defaultBasisFor(this._activeDataSet);
    if (this._basisSelect) {
      this._basisSelect.value = this._basis.id;
    }
  }

  private _defaultBasisFor(ds: ImportDataSet): ImportCoordSysBasis {
    return pickById(IMPORT_BASES, ds.defaultBasisId ?? "unknown");
  }

  private _renderFileRows(): void {
    // Keep the row label; clear and re-emit the file rows.
    while (this._filesHost.childNodes.length > 1) {
      this._filesHost.removeChild(this._filesHost.lastChild!);
    }
    if (this._activeDataSet.files.length === 0) {
      const note = el("div", "xkt-imp-note", {
        textContent: this._activeDataSet.description ?? "",
      });
      this._filesHost.appendChild(note);
      return;
    }
    for (const file of this._activeDataSet.files) {
      this._filesHost.appendChild(this._buildFileRow(file));
    }
  }

  private _buildFileRow(spec: ImportDataSetFile): HTMLElement {
    const row = el("div", "xkt-imp-slot");

    const inputId = `xkt-imp-file-${this._activeDataSet.id}-${spec.key}`;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = spec.accept;
    input.id = inputId;
    input.name = `file-${spec.key}`;
    input.setAttribute("aria-label", spec.label);

    const name = el("label", "xkt-imp-slot-name", {textContent: spec.label, htmlFor: inputId});

    const btn = el("button", "xkt-imp-slot-btn", {
      type: "button",
      textContent: "Choose…",
    }) as HTMLButtonElement;
    btn.addEventListener("click", () => input.click());

    input.addEventListener("change", () => {
      const picked = input.files && input.files[0];
      if (picked) {
        this._chosenFiles.set(spec.key, picked);
        name.textContent = picked.name;
        name.classList.add("xkt-imp-slot-chosen");
      } else {
        this._chosenFiles.delete(spec.key);
        name.textContent = spec.label;
        name.classList.remove("xkt-imp-slot-chosen");
      }
      this._refreshLoadEnabled();
    });

    row.append(name, btn, input);
    return row;
  }


  // ── Coordinate system ─────────────────────────────────────────

  private _buildCoordSysSection(): HTMLElement {
    const row = el("div", "xkt-imp-row");
    row.appendChild(el("label", "xkt-imp-row-label", {
      textContent: "Source coordinate system",
    }));

    const grid = el("div", "xkt-imp-cs-grid");

    grid.append(
      el("label", "xkt-imp-cs-sublabel", {textContent: "Basis", htmlFor: "xkt-imp-basis"}),
      this._buildBasisSelect(),
      el("label", "xkt-imp-cs-sublabel", {textContent: "Units", htmlFor: "xkt-imp-units"}),
      this._buildUnitsSelect(),
      el("span", "xkt-imp-cs-sublabel", {textContent: "Origin"}),
      this._buildOriginInputs(),
    );

    row.appendChild(grid);
    return row;
  }

  private _buildBasisSelect(): HTMLSelectElement {
    const select = el("select", "xkt-imp-select", {
      id: "xkt-imp-basis",
      name: "basis",
      "aria-label": "Basis",
    }) as HTMLSelectElement;
    for (const b of IMPORT_BASES) {
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = b.label;
      select.appendChild(opt);
    }
    select.value = this._basis.id;
    select.addEventListener("change", () => {
      const next = IMPORT_BASES.find(b => b.id === select.value);
      if (next) this._basis = next;
    });
    this._basisSelect = select;
    return select;
  }

  private _buildUnitsSelect(): HTMLSelectElement {
    const select = el("select", "xkt-imp-select", {
      id: "xkt-imp-units",
      name: "units",
      "aria-label": "Units",
    }) as HTMLSelectElement;
    for (const u of UNITS) {
      const opt = document.createElement("option");
      opt.value = u;
      opt.textContent = u;
      select.appendChild(opt);
    }
    select.value = this._units;
    select.addEventListener("change", () => {
      this._units = select.value as Units;
    });
    return select;
  }

  private _buildOriginInputs(): HTMLElement {
    const wrap = el("div", "xkt-imp-cs-origin");
    (["x", "y", "z"] as const).forEach((axis, i) => {
      const input = document.createElement("input");
      input.type = "number";
      input.step = "any";
      input.value = "0";
      input.id = `xkt-imp-origin-${axis}`;
      input.name = `origin-${axis}`;
      input.setAttribute("aria-label", `Origin ${axis.toUpperCase()}`);
      input.addEventListener("change", () => {
        const n = parseFloat(input.value);
        this._origin[i] = Number.isFinite(n) ? n : 0;
      });
      wrap.appendChild(input);
    });
    return wrap;
  }

  /**
   * Build the `CoordinateSystemParams` the dialog will pass to
   * `scene.createModel`, or `undefined` when the user left Basis
   * on `"auto"` (so the loader / sidecar default wins).
   */
  private _resolveCoordSys(): CoordinateSystemParams | undefined {
    if (this._activeDataSet.loadsSceneGeometry === false) return undefined;
    if (this._basis.basis === null) return undefined;
    return {
      basis:  this._basis.basis,
      origin: [...this._origin],
      units:  this._units,
    };
  }


  // ── Load ──────────────────────────────────────────────────────

  private _refreshLoadEnabled(): void {
    const ds = this._activeDataSet;
    const ready = ds.onLoad
      ? true
      : ds.files.filter(f => f.required).every(f => this._chosenFiles.has(f.key));
    this._loadBtn.disabled = !ready;
  }

  private async _runLoad(): Promise<void> {
    if (this._loadBtn.disabled) return;
    this._loadBtn.disabled = true;
    try {
      if (this._activeDataSet.onLoad) {
        this._activeDataSet.onLoad(this.demoHelper);
      } else {
        await this._loadActiveDataSet();
      }
      this.hide();
    } finally {
      this._refreshLoadEnabled();
    }
  }

  private async _loadActiveDataSet(): Promise<void> {
    const filesToLoad = this._activeDataSet.files.filter(f => this._chosenFiles.has(f.key));
    if (filesToLoad.length === 0) return;

    const baseName = stripExt(this._chosenFiles.get(filesToLoad[0].key)!.name);
    const modelId  = `${baseName}-${Date.now().toString(36)}`;

    const wantsScene = this._activeDataSet.loadsSceneGeometry !== false;
    const wantsData  = this._activeDataSet.loadsDataSemantics !== false;

    let sceneModel: any;
    if (wantsScene) {
      const res = this.demoHelper.scene.createModel({
        id: modelId,
        coordinateSystem: this._resolveCoordSys(),
      });
      if (res.ok === false) {
        console.error(`[ImportDialog] createModel failed: ${res.error}`);
        return;
      }
      sceneModel = res.value;
    }

    let dataModel: any;
    if (wantsData) {
      const res = this.demoHelper.data.createModel({id: modelId});
      if (res.ok === false) {
        console.error(`[ImportDialog] createModel (data) failed: ${res.error}`);
        if (sceneModel) sceneModel.destroy();
        return;
      }
      dataModel = res.value;
    }

    const urls: string[] = [];

    try {
      for (const spec of filesToLoad) {
        const file = this._chosenFiles.get(spec.key)!;
        const url  = URL.createObjectURL(file);
        urls.push(url);
        const result = await this.demoHelper.loadModel(
          {src: url, modelId, format: spec.loadFormat, sceneModel, dataModel},
          {},
        );
        if (result && (result as any).ok === false) {
          console.warn(`[ImportDialog] ${spec.loadFormat} load failed: ${(result as any).error}`);
        }
      }
      this.demoHelper.recordModelOrigin(modelId, {
        dataSetId:        this._activeDataSet.id,
        dataSetLabel:     this._activeDataSet.label,
        fileNames:        filesToLoad.map(f => this._chosenFiles.get(f.key)!.name),
        coordinateSystem: this._resolveCoordSys(),
      });
    } catch (e) {
      console.warn(`[ImportDialog] load threw: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      for (const u of urls) URL.revokeObjectURL(u);
    }
  }
}


function pickById<T extends {id: string}>(list: ReadonlyArray<T>, id: string): T {
  const found = list.find(e => e.id === id);
  return found ?? list[0];
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}
