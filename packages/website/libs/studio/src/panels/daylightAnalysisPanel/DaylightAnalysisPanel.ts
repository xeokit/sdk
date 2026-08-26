import type {SunStudy} from "@xeokit/website-presentations/sunStudy";
import type {Scene, SceneModel} from "@xeokit/sdk/model/scene";
import {
  DaylightAnalysis,
  type DaylightAnalysisResult,
  type AnalysisGrid,
  type SkyModel,
  buildAnalysisHeatmap,
} from "@xeokit/website-presentations/daylightAnalysis";
import {getSceneCollisionIndex} from "@xeokit/sdk/spatial/collision";
import {EventEmitter} from "@xeokit/sdk/base/core";
import {EventDispatcher} from "strongly-typed-events";
import {el} from "../../utils/el";
import {FloatingPanelBase, type FloatingPanelBaseParams} from "../floatingPanelBase";


/**
 * Constructor parameters for {@link DaylightAnalysisPanel | DaylightAnalysisPanel}.
 *
 */
export interface DaylightAnalysisPanelParams {

  /** SunStudy whose `latitude` / `longitude` / `northAngleDegrees`
   *  feed every analysis run from this panel. */
  sunStudy: SunStudy;

  /** Scene that the analysis raycasts against for occlusion. */
  scene: Scene;

  /** Optional starting grid. When omitted, the panel auto-fits to
   *  the Scene's AABB on first mount. */
  initialGrid?: AnalysisGrid;

  /** Year to evaluate. Default `new Date().getUTCFullYear()`. */
  initialYear?: number;
  /** Days sampled per year. Default `12` (monthly cadence). */
  initialDaysPerYear?: number;
  /** Hours sampled per day. Default `24` (hourly cadence). */
  initialHoursPerDay?: number;
  /** Initial sky-luminance model. Default `"none"` (direct-sun only). */
  initialSkyModel?: SkyModel;

  container?: HTMLElement;
  storageKey?: string;
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-dla-styles";
let _stylesInjected = false;

const PANEL_CSS = `
.xkt-dla-panel {
  position: fixed;
  top: 17px;
  right: 17px;
  width: 320px;
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
  color: #111;
  z-index: 200000000;
  overflow: hidden;
  box-sizing: border-box;
}
.xkt-dla-panel *, .xkt-dla-panel *::before, .xkt-dla-panel *::after { box-sizing: inherit; }
.xkt-dla-panel[hidden] { display: none; }

.xkt-dla-header {
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
.xkt-dla-header.xkt-dla-dragging { cursor: grabbing; }
.xkt-dla-title {
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
.xkt-dla-title-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  color: #e87b1c;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.xkt-dla-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-dla-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-dla-close {
  appearance: none;
  background: transparent;
  border: 0;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  color: #666;
}
.xkt-dla-close:hover { color: #111; background: #f0f0f0; }

.xkt-dla-body {
  padding: 8px 12px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: calc(100vh - 64px);
  overflow: auto;
}

.xkt-dla-section-title {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #888;
  margin: 4px 0 2px 0;
  font-weight: 600;
}

.xkt-dla-grid {
  display: grid;
  grid-template-columns: 60px 1fr 1fr 1fr;
  gap: 4px;
  align-items: center;
}
.xkt-dla-grid label {
  font-size: 11px;
  color: #555;
}
.xkt-dla-grid input {
  width: 100%;
  font: inherit;
  font-size: 11px;
  padding: 2px 4px;
  border: 1px solid #d8dde6;
  border-radius: 3px;
  min-width: 0;
}
.xkt-dla-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.xkt-dla-row label {
  flex: 0 0 110px;
  font-size: 11px;
  color: #444;
}
.xkt-dla-row input {
  flex: 1;
  font: inherit;
  padding: 2px 6px;
  border: 1px solid #d8dde6;
  border-radius: 4px;
  min-width: 0;
}

.xkt-dla-runbtn {
  appearance: none;
  background: #e87b1c;
  color: white;
  border: 0;
  border-radius: 4px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}
.xkt-dla-runbtn:hover { background: #ca6a14; }
.xkt-dla-runbtn:disabled {
  background: #d8dde6;
  color: #777;
  cursor: not-allowed;
}

.xkt-dla-fitbtn,
.xkt-dla-clearbtn {
  appearance: none;
  background: #eef2f7;
  color: #333;
  border: 1px solid #d8dde6;
  border-radius: 4px;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 11px;
}
.xkt-dla-fitbtn:hover,
.xkt-dla-clearbtn:hover { background: #dfe5ee; }

.xkt-dla-progress {
  height: 6px;
  background: #eef2f7;
  border-radius: 3px;
  overflow: hidden;
}
.xkt-dla-progress-fill {
  height: 100%;
  width: 0%;
  background: #e87b1c;
  transition: width 80ms linear;
}
.xkt-dla-status {
  font-size: 11px;
  color: #555;
}

.xkt-dla-legend {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.xkt-dla-legend-bar {
  height: 14px;
  border-radius: 3px;
  border: 1px solid #ccd;
}
.xkt-dla-legend-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  color: #555;
}

.xkt-dla-stats {
  display: grid;
  grid-template-columns: 60px 1fr 60px 1fr;
  gap: 4px;
  font-size: 11px;
}
.xkt-dla-stats > .xkt-dla-statlbl {
  color: #888;
  text-align: right;
}
.xkt-dla-stats > .xkt-dla-statval {
  font-variant-numeric: tabular-nums;
  color: #222;
}
`;

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


// Default heatmap gradient — has to match buildAnalysisHeatmap so the
// panel's legend visually agrees with what's painted on the scene.
const LEGEND_GRADIENT: Array<[number, number, number]> = [
  [0.05, 0.07, 0.30],
  [0.10, 0.45, 0.75],
  [0.95, 0.95, 0.30],
  [0.95, 0.55, 0.15],
  [1.00, 1.00, 0.95],
];

function unitSuffix(result: DaylightAnalysisResult): string {
  return result.unit === "klux-hours" ? " klx·h" : " h";
}

function gradientCss(): string {
  const stops = LEGEND_GRADIENT.map((c, i) => {
    const pct = (i / (LEGEND_GRADIENT.length - 1)) * 100;
    return `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}) ${pct}%`;
  }).join(", ");
  return `linear-gradient(to right, ${stops})`;
}


/**
 * Floating Studio panel for configuring and triggering
 * {@link presentations!daylightAnalysis.DaylightAnalysis | DaylightAnalysis}
 * runs, with a live progress bar, last-result stats, and a colour-
 * gradient legend that matches the heatmap painted on the scene.
 *
 * The panel owns the lifecycle of the heatmap SceneModel it builds:
 * each "Run" replaces any prior heatmap, the "Clear" button removes
 * the current one, and {@link destroy} cleans up at the end. Anyone
 * needing the result data outside the panel can subscribe to
 * {@link onResult}.
 *
 */
export class DaylightAnalysisPanel extends FloatingPanelBase {

  private static readonly _instances = new WeakMap<SunStudy, DaylightAnalysisPanel>();

  /**
   * Most recently opened panel — used by the toolbar's Present
   * group to operate on whichever (SunStudy, Scene) pair the
   * application is currently driving without needing the toolbar
   * to carry direct references. Cleared on destroy when the
   * current slot matches.
   */
  private static _latest: DaylightAnalysisPanel | null = null;

  /**
   * Returns the most recently opened DaylightAnalysisPanel, or
   * `undefined` when none is open. The Toolbar's "Daylight
   * Analysis" button uses this so the user can toggle the panel
   * from the Toolbar even though the Toolbar has no direct
   * {@link SunStudy} or {@link Scene} reference.
   */
  static getLatest(): DaylightAnalysisPanel | undefined {
    const inst = DaylightAnalysisPanel._latest;
    return inst && !inst._destroyed ? inst : undefined;
  }

  /** Title-bar glyph: a small sun-over-floor-grid icon, the symbolic
   *  shorthand for "annual solar exposure on a horizontal plane". */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<circle cx="12" cy="6" r="3" fill="currentColor"/>` +
      `<g stroke="currentColor" stroke-width="1.6" stroke-linecap="round">` +
        `<line x1="12" y1="1"  x2="12" y2="2.5"/>` +
        `<line x1="6"  y1="6"  x2="7.5" y2="6"/>` +
        `<line x1="16.5" y1="6" x2="18" y2="6"/>` +
        `<line x1="7.5" y1="2"  x2="8.5" y2="3"/>` +
        `<line x1="15.5" y1="2" x2="14.5" y2="3"/>` +
      `</g>` +
      `<g stroke="currentColor" stroke-width="1.2" fill="none" opacity="0.85">` +
        `<path d="M3 15 L21 15"/>` +
        `<path d="M3 18 L21 18"/>` +
        `<path d="M3 21 L21 21"/>` +
        `<path d="M5 13 L7 23"/>` +
        `<path d="M12 13 L12 23"/>` +
        `<path d="M19 13 L17 23"/>` +
      `</g>` +
    `</svg>`;
  }

  static getFor(sunStudy: SunStudy): DaylightAnalysisPanel | undefined {
    const inst = DaylightAnalysisPanel._instances.get(sunStudy);
    return inst && !inst._destroyed ? inst : undefined;
  }

  static openFor(params: DaylightAnalysisPanelParams): DaylightAnalysisPanel {
    let inst = DaylightAnalysisPanel._instances.get(params.sunStudy);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new DaylightAnalysisPanel(params);
    return inst;
  }

  public readonly sunStudy: SunStudy;
  public readonly scene: Scene;

  /** Fires after every completed run. Subscribers receive the
   *  freshly-computed result; consult `latestResult` afterward for
   *  the same data. */
  public readonly onResult: EventEmitter<DaylightAnalysisPanel, DaylightAnalysisResult>;

  /** Most recent successful result, or `null` before the first run. */
  public latestResult: DaylightAnalysisResult | null = null;

  /** Heatmap SceneModel the panel is currently displaying, or `null`. */
  public heatmapModel: SceneModel | null = null;

  // DOM refs.
  private _gridInputs: HTMLInputElement[] = [];   // [minX, minY, minZ, maxX, maxY, maxZ]
  private _resInputs:  HTMLInputElement[] = [];   // [resX, resY]
  private _yearInput!:        HTMLInputElement;
  private _daysInput!:        HTMLInputElement;
  private _hoursInput!:       HTMLInputElement;
  private _skyModelSelect!:   HTMLSelectElement;
  private _runBtn!:           HTMLButtonElement;
  private _fitBtn!:           HTMLButtonElement;
  private _clearBtn!:         HTMLButtonElement;
  private _progressFill!:     HTMLElement;
  private _statusEl!:         HTMLElement;
  private _statMin!:          HTMLElement;
  private _statMean!:         HTMLElement;
  private _statMax!:          HTMLElement;
  private _legendLabelLo!:    HTMLElement;
  private _legendLabelHi!:    HTMLElement;

  private _running: boolean = false;

  constructor(params: DaylightAnalysisPanelParams) {
    if (!params || !params.sunStudy || !params.scene) {
      throw new Error("DaylightAnalysisPanel: sunStudy and scene are required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-dla-panel",
      classPrefix: "xkt-dla",
    } as FloatingPanelBaseParams);

    this.sunStudy = params.sunStudy;
    this.scene = params.scene;

    const prior = DaylightAnalysisPanel._instances.get(params.sunStudy);
    if (prior && !prior._destroyed) prior.destroy();
    DaylightAnalysisPanel._instances.set(params.sunStudy, this);
    DaylightAnalysisPanel._latest = this;

    this.onResult = new EventEmitter(new EventDispatcher<DaylightAnalysisPanel, DaylightAnalysisResult>());

    injectStylesOnce();
    this._buildDom();
    this._wireDomEvents();

    // Seed inputs from params, or auto-fit to the scene AABB.
    if (params.initialGrid) {
      this._writeGridInputs(params.initialGrid);
    } else {
      this._fitGridToScene();
    }
    this._yearInput.value         = String(params.initialYear  ?? new Date().getUTCFullYear());
    this._daysInput.value         = String(params.initialDaysPerYear ?? 12);
    this._hoursInput.value        = String(params.initialHoursPerDay ?? 24);
    this._skyModelSelect.value    = params.initialSkyModel ?? "none";

    this._refreshLegend(null);

    if (params.visible === false) this.hide();
  }

  // ── DOM ───────────────────────────────────────────────────────────

  protected _buildDom(): void {
    this._panel = el("div", "xkt-dla-panel");

    this._header = el("div", "xkt-dla-header");
    const title = el("h2", "xkt-dla-title");
    title.innerHTML =
      `<span class="xkt-dla-title-icon">${DaylightAnalysisPanel.iconSvg()}</span>` +
      `<span class="xkt-dla-title-text">Daylight Analysis</span>`;
    this._closeBtn = el("button", "xkt-dla-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;
    this._header.append(title, this._closeBtn);

    this._pill = el("button", "xkt-dla-pill", {
      type: "button",
      hidden: true,
      textContent: "Daylight",
    }) as HTMLButtonElement;

    const body = el("div", "xkt-dla-body");

    // Grid section.
    body.appendChild(this._sectionTitle("Work-plane grid"));
    const gridEl = el("div", "xkt-dla-grid");
    const headerCells = ["", "X", "Y", "Z"];
    for (const t of headerCells) {
      const c = el("div");
      c.style.fontSize = "10.5px";
      c.style.color = "#888";
      c.textContent = t;
      gridEl.appendChild(c);
    }
    for (const corner of ["Min", "Max"]) {
      const lbl = el("label");
      lbl.textContent = corner;
      gridEl.appendChild(lbl);
      for (let i = 0; i < 3; i++) {
        const input = el("input", "", {
          type: "number", step: "0.1",
        }) as HTMLInputElement;
        gridEl.appendChild(input);
        this._gridInputs.push(input);
      }
    }
    body.appendChild(gridEl);

    const resRow = el("div", "xkt-dla-row");
    const resLbl = el("label");
    resLbl.textContent = "Resolution";
    resRow.appendChild(resLbl);
    for (const _ of [0, 1]) {
      const input = el("input", "", {
        type: "number", min: "1", max: "200", step: "1",
      }) as HTMLInputElement;
      resRow.appendChild(input);
      this._resInputs.push(input);
    }
    this._fitBtn = el("button", "xkt-dla-fitbtn", {
      type: "button",
      textContent: "Fit",
      title: "Fit grid bounds to the scene AABB",
    }) as HTMLButtonElement;
    resRow.appendChild(this._fitBtn);
    body.appendChild(resRow);

    // Time section.
    body.appendChild(this._sectionTitle("Time resolution"));
    const yearRow = this._labelledNumberRow("Year");
    this._yearInput = yearRow.querySelector("input")!;
    this._yearInput.min = "1970";
    this._yearInput.max = "2100";
    body.appendChild(yearRow);

    const daysRow = this._labelledNumberRow("Days / year");
    this._daysInput = daysRow.querySelector("input")!;
    this._daysInput.min = "1";
    this._daysInput.max = "365";
    body.appendChild(daysRow);

    const hoursRow = this._labelledNumberRow("Hours / day");
    this._hoursInput = hoursRow.querySelector("input")!;
    this._hoursInput.min = "1";
    this._hoursInput.max = "48";
    body.appendChild(hoursRow);

    // Sky model section. Choosing anything other than "None"
    // enables the diffuse hemisphere pass and switches the result
    // units from `hours` (direct-sun only) to `klux·hours/year`
    // (combined direct + diffuse horizontal illuminance proxy).
    body.appendChild(this._sectionTitle("Sky model"));
    const skyRow = el("div", "xkt-dla-row");
    const skyLbl = el("label");
    skyLbl.textContent = "Diffuse sky";
    this._skyModelSelect = el("select") as HTMLSelectElement;
    for (const [value, label] of [
      ["none",         "None (direct-sun only)"],
      ["cie-overcast", "CIE Overcast"],
      ["uniform",      "Uniform"],
    ] as Array<[SkyModel, string]>) {
      const opt = el("option") as HTMLOptionElement;
      opt.value = value;
      opt.textContent = label;
      this._skyModelSelect.appendChild(opt);
    }
    skyRow.append(skyLbl, this._skyModelSelect);
    body.appendChild(skyRow);

    // Run / Clear section.
    body.appendChild(this._sectionTitle("Run"));
    const runRow = el("div", "xkt-dla-row");
    this._runBtn = el("button", "xkt-dla-runbtn", {
      type: "button",
      textContent: "Run analysis",
    }) as HTMLButtonElement;
    this._clearBtn = el("button", "xkt-dla-clearbtn", {
      type: "button",
      textContent: "Clear",
      title: "Destroy the current heatmap",
    }) as HTMLButtonElement;
    runRow.append(this._runBtn, this._clearBtn);
    body.appendChild(runRow);

    const progress = el("div", "xkt-dla-progress");
    this._progressFill = el("div", "xkt-dla-progress-fill");
    progress.appendChild(this._progressFill);
    body.appendChild(progress);
    this._statusEl = el("div", "xkt-dla-status");
    this._statusEl.textContent = "Idle";
    body.appendChild(this._statusEl);

    // Result section.
    body.appendChild(this._sectionTitle("Result"));
    const stats = el("div", "xkt-dla-stats");
    for (const [label, idx] of [["Min", "min"], ["Mean", "mean"], ["Max", "max"]] as const) {
      const lbl = el("div", "xkt-dla-statlbl");
      lbl.textContent = label;
      const val = el("div", "xkt-dla-statval");
      val.textContent = "—";
      stats.append(lbl, val);
      if (idx === "min")  this._statMin = val;
      if (idx === "mean") this._statMean = val;
      if (idx === "max")  this._statMax = val;
    }
    // Fourth column padding so the grid stays 4-wide.
    stats.append(el("div"), el("div"));
    body.appendChild(stats);

    const legend = el("div", "xkt-dla-legend");
    const bar = el("div", "xkt-dla-legend-bar");
    bar.style.background = gradientCss();
    legend.appendChild(bar);
    const labels = el("div", "xkt-dla-legend-labels");
    this._legendLabelLo = el("span");
    this._legendLabelHi = el("span");
    this._legendLabelLo.textContent = "0 h";
    this._legendLabelHi.textContent = "— h";
    labels.append(this._legendLabelLo, this._legendLabelHi);
    legend.appendChild(labels);
    body.appendChild(legend);

    this._panel.append(this._header, body);
    this._container.append(this._pill, this._panel);

    this._bindChrome();
  }

  protected _wireDomEvents(): void {
    this._closeBtn.addEventListener("click", () => this.hide());
    this._fitBtn.addEventListener("click",   () => this._fitGridToScene());
    this._clearBtn.addEventListener("click", () => this._destroyHeatmap());
    this._runBtn.addEventListener("click",   () => this._runAnalysis());
  }

  // ── Behaviour ─────────────────────────────────────────────────────

  private _fitGridToScene(): void {
    const ci = getSceneCollisionIndex(this.scene);
    const aabb = (ci as any).getSceneAABB?.();
    if (!aabb) return;
    const pad = 4;
    const z = aabb[2] + 0.05;
    this._writeGridInputs({
      min: [aabb[0] - pad, aabb[1] - pad, z],
      max: [aabb[3] + pad, aabb[4] + pad, z],
      resolution: this._readResolution(),
    });
  }

  private _readGrid(): AnalysisGrid {
    const v = this._gridInputs.map(i => parseFloat(i.value) || 0);
    const [resX, resY] = this._readResolution();
    return {
      min: [v[0], v[1], v[2]],
      max: [v[3], v[4], v[5]],
      resolution: [resX, resY],
    };
  }

  private _readResolution(): [number, number] {
    const rx = parseInt(this._resInputs[0].value, 10);
    const ry = parseInt(this._resInputs[1].value, 10);
    return [
      Number.isFinite(rx) && rx > 0 ? rx : 30,
      Number.isFinite(ry) && ry > 0 ? ry : 30,
    ];
  }

  private _writeGridInputs(grid: AnalysisGrid): void {
    const flat = [...grid.min, ...grid.max];
    for (let i = 0; i < 6; i++) this._gridInputs[i].value = flat[i].toFixed(2);
    this._resInputs[0].value = String(grid.resolution[0]);
    this._resInputs[1].value = String(grid.resolution[1]);
  }

  private _destroyHeatmap(): void {
    if (this.heatmapModel && !(this.heatmapModel as any).destroyed) {
      this.heatmapModel.destroy();
    }
    this.heatmapModel = null;
  }

  private async _runAnalysis(): Promise<void> {
    if (this._running) return;
    this._running = true;
    this._runBtn.disabled = true;

    // Drop any previous heatmap so re-runs replace cleanly.
    this._destroyHeatmap();

    const analysis = new DaylightAnalysis({
      sunStudy:     this.sunStudy,
      scene:        this.scene,
      grid:         this._readGrid(),
      year:         parseInt(this._yearInput.value,  10),
      daysPerYear:  parseInt(this._daysInput.value,  10),
      hoursPerDay:  parseInt(this._hoursInput.value, 10),
      skyModel:     this._skyModelSelect.value as SkyModel,
    });

    this._setProgress(0, "Running…");

    try {
      const result = await analysis.run((frac) => {
        this._setProgress(frac, `Running… ${Math.round(frac * 100)}%`);
      });
      this.latestResult = result;
      this.heatmapModel = buildAnalysisHeatmap(this.scene, result, { opacity: 0.85 });
      this._refreshStats(result);
      this._refreshLegend(result);
      const skyTag = result.skyModel === "none" ? "direct only" : `+ ${result.skyModel} sky`;
      this._setProgress(1, `Done — ${result.daysEvaluated} days × ${result.hoursPerDay} h (${skyTag})`);
      this.onResult.dispatch(this, result);
    } catch (err) {
      this._setProgress(0, `Failed: ${(err as Error)?.message ?? err}`);
    } finally {
      this._running = false;
      this._runBtn.disabled = false;
    }
  }

  private _setProgress(frac: number, status: string): void {
    this._progressFill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    this._statusEl.textContent = status;
  }

  private _refreshStats(result: DaylightAnalysisResult | null): void {
    if (!result) {
      this._statMin.textContent  = "—";
      this._statMean.textContent = "—";
      this._statMax.textContent  = "—";
      return;
    }
    const u = unitSuffix(result);
    this._statMin.textContent  = `${result.min.toFixed(1)}${u}`;
    this._statMean.textContent = `${result.mean.toFixed(1)}${u}`;
    this._statMax.textContent  = `${result.max.toFixed(1)}${u}`;
  }

  private _refreshLegend(result: DaylightAnalysisResult | null): void {
    if (!result) {
      this._legendLabelLo.textContent = "0 h";
      this._legendLabelHi.textContent = "— h";
      return;
    }
    const u = unitSuffix(result);
    this._legendLabelLo.textContent = `0${u}`;
    this._legendLabelHi.textContent = `${result.max.toFixed(0)}${u}`;
  }

  // ── DOM helpers ───────────────────────────────────────────────────

  private _sectionTitle(text: string): HTMLElement {
    const e = el("div", "xkt-dla-section-title");
    e.textContent = text;
    return e;
  }

  private _labelledNumberRow(labelText: string): HTMLElement {
    const row = el("div", "xkt-dla-row");
    const lbl = el("label");
    lbl.textContent = labelText;
    const input = el("input", "", { type: "number", step: "1" }) as HTMLInputElement;
    row.append(lbl, input);
    return row;
  }

  public override destroy(): void {
    if (this._destroyed) return;
    this._destroyHeatmap();
    this.onResult.clear();
    DaylightAnalysisPanel._instances.delete(this.sunStudy);
    if (DaylightAnalysisPanel._latest === this) DaylightAnalysisPanel._latest = null;
    super.destroy();
  }
}
