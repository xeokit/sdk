import type {Scene, SceneModel} from "../../../model/scene";
import {
  type VoxelGrid,
  type VectorGrid,
  voxelGridDataRange,
  vectorGridMagnitudeRange,
  COLORMAPS,
  colormapToCssGradient,
  type ColormapStops,
  type SliceAxis,
  buildVolumeSlicePlane,
  buildVolumeIsosurface,
  buildVolumeStreamlines,
  loadVTI,
} from "../../../presentations/volumeOverlay";
import {el} from "../../utils/el";
import {FloatingPanelBase, type FloatingPanelBaseParams} from "../floatingPanelBase";
import {SDKErrorType} from "../../../base/core";
import type {Studio} from "../../Studio";


/** Visualisation technique the panel exposes. */
export type VolumeTechnique = "slice" | "isosurface" | "streamlines";


/**
 * Constructor parameters for {@link VolumeOverlayPanel}.
 *
 */
export interface VolumeOverlayPanelParams {

  /** The scalar voxel field this panel controls. The panel takes a
   *  reference to the grid; it doesn't copy the data. */
  grid: VoxelGrid;

  /**
   * Optional vector field over the same volume — when supplied,
   * the "Streamlines" technique becomes available. The vector
   * grid's bbox should match `grid.min` / `grid.max` for sensible
   * results.
   */
  vectorGrid?: VectorGrid;

  /** Scene the overlay SceneModel lives in. */
  scene: Scene;

  /**
   * Optional Studio for routing build / load errors through
   * `studio.reportError` / `reportWarning` (so they land in the
   * IssuesPanel alongside other Studio-side failures). When
   * omitted, errors are dropped silently — the panel still
   * stays in a consistent state but the failure isn't surfaced.
   */
  studio?: Studio;

  /** Initial visualisation technique. Default `"slice"`. */
  initialTechnique?: VolumeTechnique;

  /** Optional starting slice axis. Default `"z"`. */
  initialAxis?: SliceAxis;

  /** Optional starting slice position. Default = midpoint along axis. */
  initialPosition?: number;

  /** Optional initial colormap name (key of {@link COLORMAPS}). Default `"viridis"`. */
  initialColormap?: string;

  /** Initial iso-surface value. Default = midpoint of `grid.valueRange`. */
  initialIsovalue?: number;

  /** Initial streamline seed density (one axis). Default `8`
   *  (≈ 512 streamlines). */
  initialSeedDensity?: number;

  container?: HTMLElement;
  storageKey?: string;
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-vol-styles";
let _stylesInjected = false;

const PANEL_CSS = `
.xkt-vol-panel {
  position: fixed;
  top: 17px;
  right: 17px;
  width: 360px;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.97);
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.14);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  color: #111;
  z-index: 200000000;
  overflow: hidden;
  box-sizing: border-box;
}
.xkt-vol-panel *, .xkt-vol-panel *::before, .xkt-vol-panel *::after { box-sizing: inherit; }
.xkt-vol-panel[hidden] { display: none; }

.xkt-vol-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px 12px 16px;
  border-bottom: 1px solid #ececec;
  flex: 0 0 auto;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
.xkt-vol-header.xkt-vol-dragging { cursor: grabbing; }
.xkt-vol-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 18px;
  line-height: 1.18;
  font-weight: 650;
  color: #111;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.xkt-vol-title-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  margin-top: 1px;
  color: #6b8fb5;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.xkt-vol-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-vol-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
}
.xkt-vol-close {
  appearance: none;
  background: transparent;
  border: 0;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
  flex: 0 0 auto;
  border-radius: 4px;
  color: #666;
}
.xkt-vol-close:hover { color: #111; background: #f0f0f0; }

.xkt-vol-pill {
  position: fixed;
  bottom: 17px;
  right: 17px;
  background: #3a4252;
  color: white;
  border: 0;
  border-radius: 999px;
  padding: 8px 18px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  z-index: 200000000;
}

.xkt-vol-body {
  padding: 10px 16px 14px;
  overflow-y: auto;
  font-size: 12px;
}
.xkt-vol-section-title {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #5a6273;
  margin: 8px 0 4px;
}
.xkt-vol-section-title:first-of-type { margin-top: 0; }
.xkt-vol-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
}
.xkt-vol-row label {
  flex: 0 0 100px;
  color: #475569;
  font-size: 11px;
}
.xkt-vol-row input[type="number"], .xkt-vol-row select {
  flex: 1;
  font-size: 12px;
  padding: 3px 6px;
  border: 1px solid #d0d4da;
  border-radius: 4px;
  background: white;
  min-width: 0;
}
.xkt-vol-row input[type="range"] {
  flex: 1;
}
.xkt-vol-row .xkt-vol-val {
  width: 70px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: #555;
  font-size: 11px;
}
.xkt-vol-axis {
  display: flex;
  background: #eef2f7;
  border-radius: 4px;
  padding: 2px;
  flex: 1;
}
.xkt-vol-axis button {
  flex: 1;
  appearance: none;
  background: transparent;
  border: 0;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  border-radius: 3px;
  cursor: pointer;
}
.xkt-vol-axis button.xkt-vol-axis-active {
  background: white;
  color: #111;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}

.xkt-vol-data-label {
  flex: 1;
  font-size: 11px;
  color: #475569;
  font-style: italic;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.xkt-vol-loadbtn {
  appearance: none;
  background: #eef2f7;
  border: 1px solid #d0d4da;
  border-radius: 4px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #2d5e8c;
  white-space: nowrap;
}
.xkt-vol-loadbtn:hover { background: #e3e9f1; }

.xkt-vol-stats {
  display: grid;
  grid-template-columns: auto 1fr auto 1fr;
  gap: 4px 8px;
  margin: 6px 0;
  font-size: 11px;
}
.xkt-vol-statlbl { color: #6b7280; }
.xkt-vol-statval { font-variant-numeric: tabular-nums; color: #111; text-align: right; }

.xkt-vol-legend {
  margin: 6px 0 2px;
}
.xkt-vol-legend-barwrap {
  position: relative;
}
.xkt-vol-legend-bar {
  height: 14px;
  border-radius: 3px;
  border: 1px solid #ccc;
}
/* Iso-value indicator — vertical bar with a small triangle pointer
   sitting at the normalised isovalue position. */
.xkt-vol-legend-marker {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  background: #111;
  border-radius: 1px;
  transform: translateX(-1px);
  pointer-events: none;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.85);
}
.xkt-vol-legend-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 2px;
  font-size: 10.5px;
  color: #5a6273;
}
`;


function injectStylesOnce(): void {
  if (_stylesInjected || typeof document === "undefined") return;
  const tag = document.createElement("style");
  tag.id = STYLE_TAG_ID;
  tag.textContent = PANEL_CSS;
  document.head.appendChild(tag);
  _stylesInjected = true;
}


/**
 * Floating Studio panel for slicing a {@link VoxelGrid} —
 * axis-selector, in-axis position slider, colormap picker, value-
 * range + opacity controls, slice stats, and a live colourbar
 * legend. Owns the lifetime of the slice {@link SceneModel} it
 * builds; each parameter change rebakes the slice.
 *
 * Per-grid singleton: opening the panel a second time for the same
 * grid reveals the existing instance rather than constructing a new
 * one. Use the static {@link getFor} / {@link openFor} factories
 * for that behaviour.
 *
 */
export class VolumeOverlayPanel extends FloatingPanelBase {

  private static readonly _instances = new WeakMap<VoxelGrid, VolumeOverlayPanel>();

  /** Most recently opened panel — toolbar fallback. */
  private static _latest: VolumeOverlayPanel | null = null;

  static getLatest(): VolumeOverlayPanel | undefined {
    const inst = VolumeOverlayPanel._latest;
    return inst && !inst._destroyed ? inst : undefined;
  }

  /** Title-bar glyph — a cube with a horizontal slice plane through
   *  it, the symbolic shorthand for "volume cross-section". */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">` +
        `<path d="M3 7 L12 3 L21 7 L21 17 L12 21 L3 17 Z"/>` +
        `<path d="M3 7 L12 11 L21 7"/>` +
        `<path d="M12 11 L12 21"/>` +
      `</g>` +
      `<path d="M2.5 12.5 L21.5 12.5" stroke="currentColor" ` +
            `stroke-width="1.4" stroke-dasharray="2 1.5" fill="none"/>` +
    `</svg>`;
  }

  static getFor(grid: VoxelGrid): VolumeOverlayPanel | undefined {
    const inst = VolumeOverlayPanel._instances.get(grid);
    return inst && !inst._destroyed ? inst : undefined;
  }

  static openFor(params: VolumeOverlayPanelParams): VolumeOverlayPanel {
    let inst = VolumeOverlayPanel._instances.get(params.grid);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new VolumeOverlayPanel(params);
    return inst;
  }

  /** The scalar field currently driving slice / iso techniques.
   *  Public — but mutate via {@link setGrids} so the panel can
   *  resync its derived state (value-range, slider bounds, etc). */
  public grid: VoxelGrid;

  /** Optional vector field — `null` when streamlines aren't available. */
  public vectorGrid: VectorGrid | null;

  public readonly scene: Scene;

  /** Optional Studio handle for error routing — see {@link VolumeOverlayPanelParams.studio}. */
  private readonly _studio?: Studio;

  /** Heatmap SceneModel the panel currently shows, or `null`. */
  public sliceModel: SceneModel | null = null;

  // DOM refs.
  private _techButtons: Record<VolumeTechnique, HTMLButtonElement> = {} as any;
  private _dataLabel!:      HTMLElement;
  private _loadVtiBtn!:     HTMLButtonElement;
  private _vtiFileInput!:   HTMLInputElement;
  private _titleEl!:        HTMLElement;
  private _sliceSection!:   HTMLElement;
  private _isoSection!:     HTMLElement;
  private _streamlinesSection!: HTMLElement;
  private _seedDensitySlider!:  HTMLInputElement;
  private _seedDensityValue!:   HTMLSpanElement;
  private _axisButtons: Record<SliceAxis, HTMLButtonElement> = {} as any;
  private _positionSlider!: HTMLInputElement;
  private _positionValue!:  HTMLSpanElement;
  private _isovalueSlider!: HTMLInputElement;
  private _isovalueValue!:  HTMLSpanElement;
  private _colormapSelect!: HTMLSelectElement;
  private _resInput!:       HTMLInputElement;
  private _rangeMinInput!:  HTMLInputElement;
  private _rangeMaxInput!:  HTMLInputElement;
  private _opacitySlider!:  HTMLInputElement;
  private _opacityValue!:   HTMLSpanElement;
  private _filterSelect!:   HTMLSelectElement;
  private _statMin!:        HTMLElement;
  private _statMax!:        HTMLElement;
  private _statMean!:       HTMLElement;
  private _statTris!:       HTMLElement;
  private _legendBar!:      HTMLElement;
  private _legendLo!:       HTMLSpanElement;
  private _legendHi!:       HTMLSpanElement;
  private _legendMarker!:   HTMLElement;

  private _technique: VolumeTechnique = "slice";
  private _axis: SliceAxis = "z";
  private _position: number = 0;
  private _isovalue: number = 0;
  private _seedDensity: number = 8;
  private _colormapName: string = "viridis";
  private _resolution: number = 80;
  private _rangeMin: number = 0;
  private _rangeMax: number = 1;
  private _opacity: number = 0.85;
  private _filter: "linear" | "nearest" = "linear";
  /** Debounce timer for slider input — avoids rebaking on every micro-move. */
  private _rebakeTimer: number | null = null;

  constructor(params: VolumeOverlayPanelParams) {
    if (!params || !params.grid || !params.scene) {
      throw new Error("VolumeOverlayPanel: grid and scene are required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || `xkt-vol-panel-${params.grid.name ?? "field"}`,
      classPrefix: "xkt-vol",
      initialPlacement: "css",
    } as FloatingPanelBaseParams);

    this.grid       = params.grid;
    this.vectorGrid = params.vectorGrid ?? null;
    this.scene      = params.scene;
    this._studio    = params.studio;

    const prior = VolumeOverlayPanel._instances.get(params.grid);
    if (prior && !prior._destroyed) prior.destroy();
    VolumeOverlayPanel._instances.set(params.grid, this);
    VolumeOverlayPanel._latest = this;

    // Seed from params or sensible defaults.
    this._technique    = params.initialTechnique ?? "slice";
    this._axis         = params.initialAxis ?? "z";
    this._colormapName = params.initialColormap ?? "viridis";
    this._opacity      = 0.85;
    const dataRange    = params.grid.valueRange ?? voxelGridDataRange(params.grid);
    this._rangeMin     = dataRange[0];
    this._rangeMax     = dataRange[1];
    this._position     = params.initialPosition ?? this._defaultPosition(this._axis);
    this._isovalue     = params.initialIsovalue ?? (this._rangeMin + this._rangeMax) * 0.5;
    this._seedDensity  = Math.max(2, Math.round(params.initialSeedDensity ?? 6));

    injectStylesOnce();
    this._buildDom();
    this._wireDomEvents();
    this._refreshLegend();
    this._rebake();

    if (params.visible === false) this.hide();
  }

  // ── DOM ───────────────────────────────────────────────────────

  protected _buildDom(): void {
    this._panel = el("div", "xkt-vol-panel");

    this._header = el("div", "xkt-vol-header");
    const title = el("h2", "xkt-vol-title");
    this._titleEl = title;
    title.innerHTML =
      `<span class="xkt-vol-title-icon">${VolumeOverlayPanel.iconSvg()}</span>` +
      `<span class="xkt-vol-title-text">${this.grid.name ?? "Volume Overlay"}</span>`;
    this._closeBtn = el("button", "xkt-vol-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;
    this._header.append(title, this._closeBtn);

    this._pill = el("button", "xkt-vol-pill", {
      type: "button",
      hidden: true,
      textContent: "Volume",
    }) as HTMLButtonElement;

    const body = el("div", "xkt-vol-body");

    // ── Data source ────────────────────────────────────────────
    // Shows the current field's name + a "Load .vti…" button that
    // swaps it for one parsed from a VTK XML ImageData file. The
    // file input is a hidden <input type="file"> that the visible
    // button clicks programmatically — standard cross-browser
    // pattern that avoids the ugly native file-picker chrome.
    body.appendChild(this._sectionTitle("Data"));
    const dataRow = el("div", "xkt-vol-row");
    this._dataLabel = el("div", "xkt-vol-data-label");
    this._dataLabel.textContent = this.grid.name ?? "—";
    this._loadVtiBtn = el("button", "xkt-vol-loadbtn", {
      type:        "button",
      textContent: "Load .vti…",
      title:       "Load a VTK XML ImageData file (scalar + optional vector fields)",
    }) as HTMLButtonElement;
    this._vtiFileInput = el("input", "", {
      type:   "file",
      accept: ".vti,application/xml,text/xml",
    }) as HTMLInputElement;
    this._vtiFileInput.style.display = "none";
    dataRow.append(this._dataLabel, this._loadVtiBtn, this._vtiFileInput);
    body.appendChild(dataRow);

    // ── Technique selector ────────────────────────────────────
    // "Streamlines" only enabled when a vector field was supplied
    // (`params.vectorGrid`); for scalar-only setups the button is
    // present but disabled so the user sees the technique exists.
    body.appendChild(this._sectionTitle("Technique"));
    const techRow = this._row("");
    const techGroup = el("div", "xkt-vol-axis");
    const techLabel: Record<VolumeTechnique, string> = {
      slice:       "Slice",
      isosurface:  "Iso",
      streamlines: "Streamlines",
    };
    for (const t of ["slice", "isosurface", "streamlines"] as const) {
      const btn = el("button", t === this._technique ? "xkt-vol-axis-active" : "", {
        type: "button",
        textContent: techLabel[t],
      }) as HTMLButtonElement;
      if (t === "streamlines" && !this.vectorGrid) {
        btn.disabled = true;
        btn.title = "Supply a vectorGrid to enable streamlines";
      }
      this._techButtons[t] = btn;
      techGroup.appendChild(btn);
    }
    techRow.appendChild(techGroup);
    body.appendChild(techRow);

    // ── Slice section (visible when technique === "slice") ────
    this._sliceSection = el("div");
    this._sliceSection.appendChild(this._sectionTitle("Slice"));

    // Axis selector.
    const axisRow = this._row("Axis");
    const axisGroup = el("div", "xkt-vol-axis");
    for (const a of ["x", "y", "z"] as const) {
      const btn = el("button", a === this._axis ? "xkt-vol-axis-active" : "", {
        type: "button",
        textContent: a.toUpperCase(),
      }) as HTMLButtonElement;
      this._axisButtons[a] = btn;
      axisGroup.appendChild(btn);
    }
    axisRow.appendChild(axisGroup);
    this._sliceSection.appendChild(axisRow);

    // Position slider — range spans the chosen axis's world extent.
    const posRow = this._row("Position");
    this._positionSlider = el("input", "", {type: "range", step: "0.05"}) as HTMLInputElement;
    this._positionValue  = el("span", "xkt-vol-val") as HTMLSpanElement;
    this._updatePositionSliderRange();
    posRow.append(this._positionSlider, this._positionValue);
    this._sliceSection.appendChild(posRow);

    // Resolution.
    const resRow = this._row("Resolution");
    this._resInput = el("input", "", {
      type: "number", min: "8", max: "400", step: "1",
    }) as HTMLInputElement;
    this._resInput.value = String(this._resolution);
    resRow.appendChild(this._resInput);
    this._sliceSection.appendChild(resRow);
    body.appendChild(this._sliceSection);

    // ── Iso-surface section (visible when technique === "isosurface") ─
    this._isoSection = el("div");
    this._isoSection.appendChild(this._sectionTitle("Iso-surface"));

    const isoRow = this._row("Value");
    this._isovalueSlider = el("input", "", {type: "range", step: "0.01"}) as HTMLInputElement;
    this._isovalueValue  = el("span", "xkt-vol-val") as HTMLSpanElement;
    this._updateIsovalueSliderRange();
    isoRow.append(this._isovalueSlider, this._isovalueValue);
    this._isoSection.appendChild(isoRow);
    body.appendChild(this._isoSection);

    // ── Streamlines section (visible when technique === "streamlines") ─
    this._streamlinesSection = el("div");
    this._streamlinesSection.appendChild(this._sectionTitle("Streamlines"));

    const seedRow = this._row("Density");
    this._seedDensitySlider = el("input", "", {
      type: "range", min: "2", max: "16", step: "1",
    }) as HTMLInputElement;
    this._seedDensitySlider.value = String(this._seedDensity);
    this._seedDensityValue = el("span", "xkt-vol-val") as HTMLSpanElement;
    this._seedDensityValue.textContent = `${this._seedDensity}³`;
    seedRow.append(this._seedDensitySlider, this._seedDensityValue);
    this._streamlinesSection.appendChild(seedRow);
    body.appendChild(this._streamlinesSection);

    this._applyTechniqueVisibility();

    // ── Appearance section ────────────────────────────────────
    body.appendChild(this._sectionTitle("Appearance"));

    const cmRow = this._row("Colormap");
    this._colormapSelect = el("select") as HTMLSelectElement;
    for (const name of Object.keys(COLORMAPS)) {
      const opt = el("option") as HTMLOptionElement;
      opt.value = name;
      opt.textContent = name;
      if (name === this._colormapName) opt.selected = true;
      this._colormapSelect.appendChild(opt);
    }
    cmRow.appendChild(this._colormapSelect);
    body.appendChild(cmRow);

    const filterRow = this._row("Filter");
    this._filterSelect = el("select") as HTMLSelectElement;
    for (const f of ["linear", "nearest"] as const) {
      const opt = el("option") as HTMLOptionElement;
      opt.value = f;
      opt.textContent = f;
      if (f === this._filter) opt.selected = true;
      this._filterSelect.appendChild(opt);
    }
    filterRow.appendChild(this._filterSelect);
    body.appendChild(filterRow);

    const opacityRow = this._row("Opacity");
    this._opacitySlider = el("input", "", {
      type: "range", min: "0", max: "1", step: "0.01",
    }) as HTMLInputElement;
    this._opacitySlider.value = String(this._opacity);
    this._opacityValue = el("span", "xkt-vol-val") as HTMLSpanElement;
    this._opacityValue.textContent = this._opacity.toFixed(2);
    opacityRow.append(this._opacitySlider, this._opacityValue);
    body.appendChild(opacityRow);

    // ── Range section ──────────────────────────────────────────
    body.appendChild(this._sectionTitle("Value range"));

    const rangeRow = this._row("Range");
    this._rangeMinInput = el("input", "", {type: "number", step: "0.1"}) as HTMLInputElement;
    this._rangeMaxInput = el("input", "", {type: "number", step: "0.1"}) as HTMLInputElement;
    this._rangeMinInput.value = this._rangeMin.toFixed(2);
    this._rangeMaxInput.value = this._rangeMax.toFixed(2);
    rangeRow.append(this._rangeMinInput, this._rangeMaxInput);
    body.appendChild(rangeRow);

    // ── Stats + legend ─────────────────────────────────────────
    body.appendChild(this._sectionTitle("Field"));
    const stats = el("div", "xkt-vol-stats");
    for (const [label, key] of [
      ["Min", "min"], ["Mean", "mean"], ["Max", "max"], ["Tris", "tris"],
    ] as const) {
      const lbl = el("div", "xkt-vol-statlbl");
      lbl.textContent = label;
      const val = el("div", "xkt-vol-statval");
      val.textContent = "—";
      stats.append(lbl, val);
      if (key === "min")  this._statMin  = val;
      if (key === "mean") this._statMean = val;
      if (key === "max")  this._statMax  = val;
      if (key === "tris") this._statTris = val;
    }
    body.appendChild(stats);

    const legend = el("div", "xkt-vol-legend");
    const barWrap = el("div", "xkt-vol-legend-barwrap");
    this._legendBar = el("div", "xkt-vol-legend-bar");
    this._legendMarker = el("div", "xkt-vol-legend-marker");
    this._legendMarker.style.display = "none";
    barWrap.append(this._legendBar, this._legendMarker);
    legend.appendChild(barWrap);
    const labels = el("div", "xkt-vol-legend-labels");
    this._legendLo = el("span") as HTMLSpanElement;
    this._legendHi = el("span") as HTMLSpanElement;
    labels.append(this._legendLo, this._legendHi);
    legend.appendChild(labels);
    body.appendChild(legend);

    this._panel.append(this._header, body);
    this._container.append(this._pill, this._panel);

    this._bindChrome();
  }

  protected _wireDomEvents(): void {
    this._closeBtn.addEventListener("click", () => this.hide());

    // Load .vti — opens the native file picker via the hidden input.
    this._loadVtiBtn.addEventListener("click", () => this._vtiFileInput.click());
    this._vtiFileInput.addEventListener("change", async () => {
      const file = this._vtiFileInput.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        this._loadVtiText(text, file.name);
      } catch (err) {
        this._studio?.reportError(
          `[VolumeOverlayPanel] .vti read failed: ${(err as Error)?.message ?? err}`,
          SDKErrorType.InvalidInput,
        );
      } finally {
        this._vtiFileInput.value = "";
      }
    });

    for (const t of ["slice", "isosurface", "streamlines"] as const) {
      this._techButtons[t].addEventListener("click", () => this._setTechnique(t));
    }

    for (const a of ["x", "y", "z"] as const) {
      this._axisButtons[a].addEventListener("click", () => this._setAxis(a));
    }

    this._isovalueSlider.addEventListener("input", () => {
      this._isovalue = parseFloat(this._isovalueSlider.value);
      this._isovalueValue.textContent = this._formatIsovalue(this._isovalue);
      this._refreshLegend();
      this._scheduleRebake();
    });

    this._seedDensitySlider.addEventListener("input", () => {
      const v = parseInt(this._seedDensitySlider.value, 10);
      if (!Number.isFinite(v) || v < 2) return;
      this._seedDensity = v;
      this._seedDensityValue.textContent = `${v}³`;
      this._scheduleRebake();
    });

    this._positionSlider.addEventListener("input", () => {
      this._position = parseFloat(this._positionSlider.value);
      this._positionValue.textContent = this._formatPosition(this._position);
      this._scheduleRebake();
    });

    this._resInput.addEventListener("change", () => {
      const v = parseInt(this._resInput.value, 10);
      if (!Number.isFinite(v) || v < 4) return;
      this._resolution = v;
      this._scheduleRebake();
    });

    this._colormapSelect.addEventListener("change", () => {
      this._colormapName = this._colormapSelect.value;
      this._refreshLegend();
      this._scheduleRebake();
    });

    this._filterSelect.addEventListener("change", () => {
      this._filter = this._filterSelect.value as "linear" | "nearest";
      this._scheduleRebake();
    });

    this._opacitySlider.addEventListener("input", () => {
      this._opacity = parseFloat(this._opacitySlider.value);
      this._opacityValue.textContent = this._opacity.toFixed(2);
      this._scheduleRebake();
    });

    this._rangeMinInput.addEventListener("change", () => {
      const v = parseFloat(this._rangeMinInput.value);
      if (!Number.isFinite(v)) return;
      this._rangeMin = v;
      this._updateIsovalueSliderRange();
      this._refreshLegend();
      this._scheduleRebake();
    });
    this._rangeMaxInput.addEventListener("change", () => {
      const v = parseFloat(this._rangeMaxInput.value);
      if (!Number.isFinite(v)) return;
      this._rangeMax = v;
      this._updateIsovalueSliderRange();
      this._refreshLegend();
      this._scheduleRebake();
    });
  }

  // ── Behaviour ─────────────────────────────────────────────────

  /**
   * Swap the panel's data source. The first scalar array becomes
   * the new `grid`; the first vector array (if any) becomes
   * the new `vectorGrid`. The panel re-derives default
   * value-range, slice-position bounds, isovalue range, etc., from
   * the new field and re-bakes the active technique.
   *
   * The WeakMap singleton key is updated to the new grid so a
   * subsequent `panels.open("volumeOverlayPanel", {grid: ...})`
   * call with the new grid reveals this panel rather than
   * constructing a second one.
   */
  public setGrids(grid: VoxelGrid, vectorGrid: VectorGrid | null): void {
    // Re-key the per-grid singleton.
    VolumeOverlayPanel._instances.delete(this.grid);
    this.grid = grid;
    this.vectorGrid = vectorGrid;
    VolumeOverlayPanel._instances.set(grid, this);

    // Re-derive default range + slider bounds from the new field.
    const dataRange = grid.valueRange ?? voxelGridDataRange(grid);
    this._rangeMin = dataRange[0];
    this._rangeMax = dataRange[1];
    this._isovalue = (this._rangeMin + this._rangeMax) * 0.5;
    this._position = this._defaultPosition(this._axis);

    // Sync the DOM inputs to the new state.
    this._rangeMinInput.value = this._rangeMin.toFixed(2);
    this._rangeMaxInput.value = this._rangeMax.toFixed(2);
    this._updatePositionSliderRange();
    this._updateIsovalueSliderRange();

    // Update title + data-label readouts.
    const titleText = this._titleEl.querySelector(".xkt-vol-title-text");
    if (titleText) titleText.textContent = grid.name ?? "Volume Overlay";
    this._dataLabel.textContent = grid.name ?? "—";

    // Streamlines availability follows the vector grid presence.
    const streamBtn = this._techButtons.streamlines;
    if (streamBtn) {
      streamBtn.disabled = !vectorGrid;
      streamBtn.title = vectorGrid ? "" : "Supply a vectorGrid to enable streamlines";
      // If we just lost vectors while in streamlines mode, fall
      // back to slice — keeps the panel in a valid state.
      if (!vectorGrid && this._technique === "streamlines") {
        this._setTechnique("slice");
        return;       // _setTechnique schedules its own rebake
      }
    }

    this._refreshLegend();
    this._scheduleRebake();
  }

  /**
   * Parse `text` as a VTK XML ImageData (`.vti`) and load the
   * first scalar (+ first vector if present) into the panel. The
   * file name appears in the data-source label as feedback that
   * the file was accepted.
   */
  private _loadVtiText(text: string, fileName: string): void {
    const result = loadVTI(text);
    if (result.ok !== true) {
      this._studio?.reportError({...result, error: `[VolumeOverlayPanel] could not parse "${fileName}": ${result.error}`});
      this._dataLabel.textContent = `${fileName} (parse error)`;
      return;
    }
    const file = result.value;
    for (const w of file.warnings) {
      this._studio?.reportWarning(w, SDKErrorType.NotSupported);
    }
    const scalarNames = Object.keys(file.scalars);
    const vectorNames = Object.keys(file.vectors);
    if (scalarNames.length === 0) {
      this._studio?.reportWarning(
        `[VolumeOverlayPanel] "${fileName}" contains no scalar arrays — nothing to visualise as slice/isosurface.`,
        SDKErrorType.InvalidInput,
      );
      this._dataLabel.textContent = `${fileName} (no scalar field)`;
      return;
    }
    const scalar = file.scalars[scalarNames[0]];
    const vector = vectorNames.length > 0 ? file.vectors[vectorNames[0]] : null;
    this.setGrids(scalar, vector);
    this._dataLabel.textContent = `${scalar.name ?? "(unnamed)"} · ${fileName}`;
  }

  private _setTechnique(tech: VolumeTechnique): void {
    if (tech === this._technique) return;
    // Guard: can't switch to streamlines without a vector field.
    if (tech === "streamlines" && !this.vectorGrid) return;
    this._technique = tech;
    for (const t of ["slice", "isosurface", "streamlines"] as const) {
      this._techButtons[t].classList.toggle("xkt-vol-axis-active", t === tech);
    }
    this._applyTechniqueVisibility();
    this._refreshLegend();
    this._scheduleRebake();
  }

  private _applyTechniqueVisibility(): void {
    this._sliceSection.style.display       = this._technique === "slice"       ? "" : "none";
    this._isoSection.style.display         = this._technique === "isosurface"  ? "" : "none";
    this._streamlinesSection.style.display = this._technique === "streamlines" ? "" : "none";
  }

  private _setAxis(axis: SliceAxis): void {
    if (axis === this._axis) return;
    this._axis = axis;
    for (const a of ["x", "y", "z"] as const) {
      this._axisButtons[a].classList.toggle("xkt-vol-axis-active", a === axis);
    }
    this._position = this._defaultPosition(axis);
    this._updatePositionSliderRange();
    this._scheduleRebake();
  }

  private _updateIsovalueSliderRange(): void {
    this._isovalueSlider.min  = String(this._rangeMin);
    this._isovalueSlider.max  = String(this._rangeMax);
    this._isovalueSlider.step = String(Math.max(0.01, (this._rangeMax - this._rangeMin) / 200));
    this._isovalueSlider.value = String(this._isovalue);
    this._isovalueValue.textContent = this._formatIsovalue(this._isovalue);
  }

  private _formatIsovalue(v: number): string {
    return `${v.toFixed(2)}${this.grid.unit ? " " + this.grid.unit : ""}`;
  }

  private _defaultPosition(axis: SliceAxis): number {
    const i = axis === "x" ? 0 : axis === "y" ? 1 : 2;
    return (this.grid.min[i] + this.grid.max[i]) * 0.5;
  }

  private _updatePositionSliderRange(): void {
    const i = this._axis === "x" ? 0 : this._axis === "y" ? 1 : 2;
    const lo = this.grid.min[i];
    const hi = this.grid.max[i];
    const span = hi - lo;
    this._positionSlider.min  = String(lo);
    this._positionSlider.max  = String(hi);
    this._positionSlider.step = String(span / 200);
    this._positionSlider.value = String(this._position);
    this._positionValue.textContent = this._formatPosition(this._position);
  }

  private _formatPosition(p: number): string {
    return `${p.toFixed(2)} m`;
  }

  /** Debounce rebakes so slider dragging doesn't thrash. */
  private _scheduleRebake(): void {
    if (this._rebakeTimer !== null) {
      clearTimeout(this._rebakeTimer);
    }
    this._rebakeTimer = setTimeout(() => {
      this._rebakeTimer = null;
      this._rebake();
    }, 30) as unknown as number;
  }

  private _rebake(): void {
    this._destroySlice();
    const cmap: ColormapStops = COLORMAPS[this._colormapName] ?? COLORMAPS.viridis;
    const idPrefix = (this.grid.name ?? "field").replace(/\W+/g, "_");

    if (this._technique === "slice") {
      const r = buildVolumeSlicePlane(this.scene, this.grid, {
        id:         `volSlice-${idPrefix}`,
        axis:       this._axis,
        position:   this._position,
        resolution: [this._resolution, this._resolution],
        colormap:   cmap,
        range:      [this._rangeMin, this._rangeMax],
        opacity:    this._opacity,
        filter:     this._filter,
      });
      if (r.ok) this.sliceModel = r.value;
      else this._studio?.reportError(r);
    } else if (this._technique === "isosurface") {
      const r = buildVolumeIsosurface(this.scene, this.grid, {
        id:       `volIso-${idPrefix}`,
        isovalue: this._isovalue,
        colormap: cmap,
        range:    [this._rangeMin, this._rangeMax],
        opacity:  this._opacity,
      });
      if (r.ok) this.sliceModel = r.value;
      else this._studio?.reportError(r);
    } else if (this._technique === "streamlines" && this.vectorGrid) {
      const [magLo, magHi] = this.vectorGrid.magnitudeRange
        ?? vectorGridMagnitudeRange(this.vectorGrid);
      const r = buildVolumeStreamlines(this.scene, this.vectorGrid, {
        id:          `volStream-${idPrefix}`,
        seedDensity: this._seedDensity,
        colormap:    cmap,
        range:       [magLo, magHi],
        colorMode:   "speed",
        lineWidth:   2,
      });
      if (r.ok) this.sliceModel = r.value;
      else this._studio?.reportError(r);
    }
    this._refreshStats();
  }

  private _destroySlice(): void {
    if (this.sliceModel && !(this.sliceModel as any).destroyed) {
      this.sliceModel.destroy();
    }
    this.sliceModel = null;
  }

  private _refreshStats(): void {
    const [lo, hi] = voxelGridDataRange(this.grid);
    let sum = 0, n = 0;
    for (let i = 0; i < this.grid.data.length; i++) {
      const v = this.grid.data[i];
      if (Number.isFinite(v)) { sum += v; n++; }
    }
    const mean = n > 0 ? sum / n : 0;
    const u = this.grid.unit ?? "";
    this._statMin.textContent  = `${lo.toFixed(2)}${u ? " " + u : ""}`;
    this._statMax.textContent  = `${hi.toFixed(2)}${u ? " " + u : ""}`;
    this._statMean.textContent = `${mean.toFixed(2)}${u ? " " + u : ""}`;

    // Triangle-count readout — useful for isosurface to gauge cost
    // (slice plane is always 2 tris so it just shows "—" there).
    if (this._technique === "isosurface" && this.sliceModel) {
      // Inspect the built geometry — there's a single mesh whose
      // primitive count = indices/3.
      const objs = (this.sliceModel as any).objects;
      let triCount = 0;
      for (const oid in objs) {
        const obj = objs[oid];
        for (const m of (obj.meshes ?? [])) {
          const ind = m?.geometry?.indices;
          if (ind?.length) triCount += ind.length / 3;
        }
      }
      this._statTris.textContent = triCount > 0 ? triCount.toLocaleString() : "—";
    } else {
      this._statTris.textContent = "—";
    }
  }

  private _refreshLegend(): void {
    const cmap = COLORMAPS[this._colormapName] ?? COLORMAPS.viridis;
    this._legendBar.style.background = colormapToCssGradient(cmap);
    const u = this.grid.unit ? ` ${this.grid.unit}` : "";
    this._legendLo.textContent = `${this._rangeMin.toFixed(1)}${u}`;
    this._legendHi.textContent = `${this._rangeMax.toFixed(1)}${u}`;

    // Iso-value marker on the legend bar — shows the user where
    // their isovalue lands on the colormap. Hidden when not in
    // isosurface mode.
    if (this._technique === "isosurface") {
      const t = Math.max(0, Math.min(1, (this._isovalue - this._rangeMin) /
        Math.max(1e-6, this._rangeMax - this._rangeMin)));
      this._legendMarker.style.left    = `${(t * 100).toFixed(1)}%`;
      this._legendMarker.style.display = "block";
    } else {
      this._legendMarker.style.display = "none";
    }
  }

  // ── DOM helpers ───────────────────────────────────────────────

  private _sectionTitle(text: string): HTMLElement {
    const e = el("div", "xkt-vol-section-title");
    e.textContent = text;
    return e;
  }

  private _row(labelText: string): HTMLElement {
    const row = el("div", "xkt-vol-row");
    const lbl = el("label");
    lbl.textContent = labelText;
    row.appendChild(lbl);
    return row;
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  public override destroy(): void {
    if (this._destroyed) return;
    if (this._rebakeTimer !== null) clearTimeout(this._rebakeTimer);
    this._destroySlice();
    VolumeOverlayPanel._instances.delete(this.grid);
    if (VolumeOverlayPanel._latest === this) VolumeOverlayPanel._latest = null;
    super.destroy();
  }
}
