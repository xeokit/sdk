/**
 * Floating, draggable, pill-restorable **Toolbar**: a row of icon
 * buttons split into three groups —
 *
 *   1. Explorer toggle
 *   2. Camera / projection / framing — Reset View · Toggle 2D/3D ·
 *      Toggle Perspective/Ortho · Fit All · Toggle First-Person
 *   3. Mutually-exclusive object tool modes — Hide · Select · Marquee
 *
 * Modeled visually after the xeokit v2 BIM viewer toolbar but
 * dropped into the same panel chrome as `SceneHealthPanel` /
 * `SchemaMaterialsPanel` / `ViewerConfigPanel` / `GPUMemoryPanel`
 * (white card, soft shadow, rounded corners, system-ui font), so
 * it reads as a member of the panel set.
 *
 * Architecture mirrors the panels: per-Viewer WeakMap registry,
 * idempotent `getFor` / `openFor`, drag the row to reposition,
 * close button + reopen pill, layout persistence, scoped
 * `xkt-tb-` CSS prefix, `iconSvg()` for the pill / context-menu
 * glyph.
 *
 * @module demo/toolbar
 */
import type {Viewer, View} from "../../../viewing/viewer";
import type {Studio} from "../../Studio";
import {ModelsPanel} from "../modelsPanel/ModelsPanel";
import {NavCube} from "../navCube/NavCube";
import {SampleModelsPanel} from "../sampleModelsPanel/SampleModelsPanel";
import {ImportDialog} from "../importDialog/ImportDialog";
import {ExportDialog} from "../exportDialog/ExportDialog";
import {SceneHealthPanel} from "../sceneHealthPanel/SceneHealthPanel";
import {DataHealthPanel} from "../dataHealthPanel/DataHealthPanel";
import {ExplorerPanel} from "../explorerPanel/ExplorerPanel";
import {ViewerConfigPanel} from "../viewerPanel/ViewerConfigPanel";
import {SceneStatsPanel} from "../sceneStats/SceneStatsPanel";
import {DataStatsPanel} from "../dataStats/DataStatsPanel";
import {BoundariesPanel} from "../boundariesPanel/BoundariesPanel";
import {TilesPanel} from "../tilesPanel/TilesPanel";
import {GPUMemoryPanel} from "../gpuMemoryUsage/GPUMemoryUsage";
import {IssuesPanel} from "../issuesPanel/IssuesPanel";
import {TasksPanel} from "../tasksPanel/TasksPanel";
import {ShadersPanel} from "../shadersPanel/ShadersPanel";
import {DataTexturesPanel} from "../dataTexturesPanel/DataTexturesPanel";
import {RendererPanel} from "../rendererPanel/RendererPanel";
import {DrawingsPanel} from "../drawings/DrawingsPanel";
import {SchemaMaterialsPanel} from "../schemaMaterialsPanel/SchemaMaterialsPanel";
import {DistanceMeasurementTool} from "../../../tools/measurements/distance/DistanceMeasurementTool";
import {AngleMeasurementsTool} from "../../../tools/measurements/angle/AngleMeasurementsTool";
import {DistanceMeasurementsPanel} from "../distanceMeasurementsPanel/DistanceMeasurementsPanel";
import {AngleMeasurementsPanel} from "../angleMeasurementsPanel/AngleMeasurementsPanel";
import {TransformControls} from "../../../viewing/transformControls";
import {SectionPlanesController} from "../../systems/sectionPlanesTool/SectionPlanesController";
import {SectionPlanesPanel} from "../sectionPlanesPanel/SectionPlanesPanel";
import {FirstPersonNavigationMode} from "../../../base/constants";
import type {ViewController} from "../../../viewing/viewController";


import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";
import {TOOLBAR_ACTIONS} from "./actions";
import type {ToolbarActionContext, CameraFlightLike} from "./actions/ToolbarActionContext";
// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

/**
 * Mutually-exclusive object tool modes. `null` means no tool is
 * active (default click/orbit camera control).
 */
export type ToolbarToolMode =
  | null
  | "hide"
  | "select"
  | "marquee"
  | "measureDistance"
  | "measureAngle"
  | "transformTranslate"
  | "transformRotate"
  | "transformScale"
  | "sectionPlanes";

/**
 * Stable ids for the toolbar's actions, fired through the
 * {@link ToolbarParams.onAction} callback. Stable across SDK
 * versions so hosts can switch on them.
 */
export type ToolbarAction =
  | "openFiles"
  | "importModel"
  | "importSampleModel"
  | "openExport"
  | "openDrawings"
  | "openSchemaMaterials"
  | "toggleExplorer"
  | "toggleViews"
  | "toggleModels"
  | "resetView"
  | "toggle2D3D"
  | "toggleProjection"
  | "fitAll"
  | "toggleFirstPerson"
  | "toggleNavCube"
  | "toggleDistancePanel"
  | "toggleAnglePanel"
  | "toolModeChanged";

export interface ToolbarParams {

  /**
   * Viewer the toolbar drives. Camera / projection actions read
   * the active `View` off this Viewer; doubles as the WeakMap
   * key for {@link Toolbar.openFor} idempotence — one toolbar
   * per Viewer.
   */
  viewer: Viewer;

  /**
   * Optional Studio. Used by Fit-All / Reset-View to read
   * the Scene's overall AABB out of the helper's collision
   * index; without it the camera-framing buttons fall back to a
   * console-warn no-op.
   */
  studio?: Studio;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed
   * state. Defaults to `"xkt-tb-toolbar"`.
   */
  storageKey?: string;

  /** Show on construction (default `true`). */
  visible?: boolean;

  /**
   * Optional override called instead of the toolbar's built-in
   * action handler. Returning `false` (or `undefined`) lets the
   * built-in handler also run; returning `true` short-circuits
   * the default behaviour. Useful when a host wants to
   * customise Reset / Fit All / Explorer toggle without forking
   * the whole toolbar.
   */
  onAction?: (action: ToolbarAction, ctx: {
    toolbar: Toolbar;
    viewer:  Viewer;
    /** Populated when `action === "toolModeChanged"`. */
    mode?:   ToolbarToolMode;
  }) => boolean | void;
}


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard for the whole page.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-tb-styles";
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
  style.textContent = TOOLBAR_CSS;
  document.head.appendChild(style);
  _stylesInjected = true;
}


// ─────────────────────────────────────────────────────────────────
// CSS — same chrome vocabulary as the panels (white card, 12px
// radius, soft shadow), with the navy-on-white button scheme
// borrowed from the xeokit v2 reference toolbar.
// ─────────────────────────────────────────────────────────────────

const TOOLBAR_CSS = `
.xkt-tb-toolbar {
  position: fixed;
  top: 17px;
  left: 50%;
  transform: translateX(-50%);
  /* Two rows of captioned groups, stacked vertically. Inner
   * .xkt-tb-row divs hold each row's groups; the toolbar itself
   * is now a column container rather than a single flex row. */
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  padding: 6px 36px 8px 8px;
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.14);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  z-index: 200000000;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
.xkt-tb-toolbar.xkt-tb-dragging { cursor: grabbing; }
.xkt-tb-toolbar[hidden] { display: none; }

/* One row of captioned groups. The toolbar holds two of these. */
.xkt-tb-toolbar .xkt-tb-row {
  display: flex;
  align-items: flex-end;
  gap: 4px;
}

/* A group — its caption + button strip stacked. */
.xkt-tb-toolbar .xkt-tb-group {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
  padding: 0 4px;
}

/* The "Inspect" group on row 2 sits flush right, pushed there by
 * an auto-margin so close button + group hug the right edge. */
.xkt-tb-toolbar .xkt-tb-group-end {
  margin-left: auto;
}

/* Mini section caption above each group's button strip. */
.xkt-tb-toolbar .xkt-tb-group-title {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: #6c8194;
  line-height: 1;
  padding: 0 2px;
}

/* Horizontal button strip within a group. */
.xkt-tb-toolbar .xkt-tb-group-btns {
  display: flex;
  align-items: center;
  gap: 4px;
}

.xkt-tb-toolbar .xkt-tb-btn {
  width: 40px;
  height: 40px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  color: #2d5e8c;
  border: 1px solid #e6e6e6;
  border-radius: 7px;
  cursor: pointer;
  outline: none;
  transition: background 80ms ease-out, border-color 80ms ease-out, color 80ms ease-out;
}
.xkt-tb-toolbar .xkt-tb-btn:hover {
  background: #eef3f9;
  border-color: #c8d6e6;
}
.xkt-tb-toolbar .xkt-tb-btn:focus-visible {
  border-color: #2d5e8c;
  box-shadow: 0 0 0 2px rgba(45, 94, 140, 0.18);
}
.xkt-tb-toolbar .xkt-tb-btn[aria-pressed="true"],
.xkt-tb-toolbar .xkt-tb-btn.xkt-tb-active {
  background: #2d5e8c;
  border-color: #1f4669;
  color: #fff;
}
.xkt-tb-toolbar .xkt-tb-btn[aria-pressed="true"]:hover,
.xkt-tb-toolbar .xkt-tb-btn.xkt-tb-active:hover {
  background: #1f4669;
  border-color: #1f4669;
}
.xkt-tb-toolbar .xkt-tb-btn svg {
  width: 22px;
  height: 22px;
  display: block;
  pointer-events: none;
}

.xkt-tb-toolbar .xkt-tb-close {
  /* Anchored to the toolbar's top-right corner so it doesn't
   * push the last group around when the row contents change. */
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  padding: 0;
  font: inherit;
  font-size: 18px;
  line-height: 1;
  color: #777;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
}
.xkt-tb-toolbar .xkt-tb-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-tb-pill {
  position: fixed;
  top: 17px;
  left: 50%;
  transform: translateX(-50%);
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
.xkt-tb-pill:hover { background: #1f4669; }
.xkt-tb-pill[hidden] { display: none; }

/* ── Split button — main slot + chevron half. ──────────────── */
.xkt-tb-toolbar .xkt-tb-split {
  display: inline-flex;
  align-items: center;
}
.xkt-tb-toolbar .xkt-tb-split-main {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-right: none;
}
.xkt-tb-toolbar .xkt-tb-split-chevron {
  width: 18px;
  height: 40px;
  padding: 0;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
.xkt-tb-toolbar .xkt-tb-split-chevron svg {
  width: 12px;
  height: 12px;
}

/* ── Flyout — toolbar dropdown.
 *
 * Sits well above the floating-panel stack (which is anchored at
 * 200000000 and walks upward via bringFloatingPanelToFront) and
 * above modal backdrops (panel.z - 1). 2147483600 is just shy
 * of the 32-bit z-index ceiling — picked so a toolbar flyout is
 * unconditionally on top of every panel / modal / pill, no matter
 * how many bring-to-front calls have stacked up. ─────────────── */
.xkt-tb-flyout {
  position: fixed;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  padding: 4px;
  min-width: 180px;
  z-index: 2147483600;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.xkt-tb-flyout-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 12px;
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
  color: #111;
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
}
.xkt-tb-flyout-item:hover {
  background: #eef3f9;
  border-color: #c8d6e6;
}
.xkt-tb-flyout-item.xkt-tb-flyout-current {
  font-weight: 600;
  color: #2d5e8c;
}
.xkt-tb-flyout-item .xkt-tb-flyout-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: #2d5e8c;
}
.xkt-tb-flyout-item .xkt-tb-flyout-icon svg {
  width: 18px;
  height: 18px;
  display: block;
}
.xkt-tb-flyout-item .xkt-tb-flyout-label {
  flex: 1;
  min-width: 0;
}
/* Grouped variant — Inspect dropdown — section heading rows
 * separate the Health / Statistics / Diagnostics clusters. Small
 * caps, muted, non-interactive. */
.xkt-tb-flyout-grouped { min-width: 220px; }
.xkt-tb-flyout-heading {
  padding: 8px 12px 3px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: #6a7a8a;
  pointer-events: none;
  user-select: none;
}
.xkt-tb-flyout-grouped .xkt-tb-flyout-heading:first-child {
  padding-top: 4px;
}
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

export class Toolbar extends FloatingPanelBase {

  /**
   * Per-Viewer instance registry. WeakMap so a Viewer that gets
   * destroyed elsewhere doesn't keep this toolbar alive for GC.
   */
  private static readonly _instances = new WeakMap<Viewer, Toolbar>();

  /**
   * SVG for the toolbar's pill/context-menu glyph (a tiny stack
   * of three horizontal bars — generic toolbar / "tools"
   * indicator). Strokes use `currentColor`.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="3"  y="6"  width="6" height="3" rx="0.6" fill="currentColor"/>` +
      `<rect x="11" y="6"  width="10" height="3" rx="0.6" fill="currentColor" opacity="0.55"/>` +
      `<rect x="3"  y="11" width="10" height="3" rx="0.6" fill="currentColor" opacity="0.55"/>` +
      `<rect x="15" y="11" width="6"  height="3" rx="0.6" fill="currentColor"/>` +
      `<rect x="3"  y="16" width="6"  height="3" rx="0.6" fill="currentColor" opacity="0.55"/>` +
      `<rect x="11" y="16" width="10" height="3" rx="0.6" fill="currentColor"/>` +
    `</svg>`;
  }

  static getFor(viewer: Viewer): Toolbar | undefined {
    const inst = Toolbar._instances.get(viewer);
    return inst && !inst._destroyed ? inst : undefined;
  }

  static openFor(params: ToolbarParams): Toolbar {
    let inst = Toolbar._instances.get(params.viewer);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new Toolbar(params);
    return inst;
  }

  readonly viewer: Viewer;
  readonly studio?: Studio;
  private readonly _onAction: ToolbarParams["onAction"];

  // DOM refs.
  private _toolbar!: HTMLElement;

  /** All buttons keyed by action id, for state updates. */
  private readonly _btns: Partial<Record<ToolbarAction | ToolbarToolMode, HTMLButtonElement>> = {};

  /** Active mutually-exclusive tool mode. */
  private _toolMode: ToolbarToolMode = null;

  /**
   * Last-used measure sub-mode. Drives the Measure split button's
   * main slot — clicking the main part activates whichever
   * sub-mode this points at. Updated whenever the user picks a
   * mode through the chevron flyout. Defaults to distance.
   */
  private _measureLastUsed: "measureDistance" | "measureAngle" = "measureDistance";

  /**
   * The main half of the Measure split button. Held separately
   * from {@link _btns} because two distinct ToolbarToolMode keys
   * (`"measureDistance"` / `"measureAngle"`) share visual state
   * here.
   */
  private _measureMainBtn: HTMLButtonElement | null = null;

  /** Currently-open flyout, if any. Closed on outside-click / ESC. */
  private _activeFlyout: HTMLElement | null = null;
  private _flyoutOutsideHandler: ((e: PointerEvent) => void) | null = null;
  private _flyoutKeydownHandler: ((e: KeyboardEvent) => void) | null = null;

  /**
   * Panels we have already wired a visibility-sync subscription
   * onto. Keeps `_bindPanelSync` idempotent so repeated toggles
   * do not stack handlers.
   */
  private readonly _syncedPanels = new WeakSet<FloatingPanelBase>();

  /**
   * Click handler installed on the active View's canvas while a
   * pick-driven tool mode (Hide / Select) is active. Held so
   * {@link _applyObjectMode} can detach it on mode exit.
   */
  private _objectModeClick: ((e: MouseEvent) => void) | null = null;
  private _objectModeCanvas: HTMLElement | null = null;

  /**
   * Click handler installed on the active View's canvas while one
   * of the transform tool modes (Translate / Rotate / Scale) is
   * active. The handler picks the clicked object and attaches the
   * gizmo to it. Held so {@link _applyTransformMode} can detach it
   * on transform-mode exit.
   */
  private _transformModeClick: ((e: MouseEvent) => void) | null = null;
  private _transformModeCanvas: HTMLElement | null = null;

  /**
   * Pointer-down handler installed on the active View's canvas
   * while the Section Planes tool is active. Each click on a
   * surface creates a new section plane there with the hit's
   * surface normal as the plane's `dir`. Held so
   * {@link _applySectionPlanesMode} can detach it on exit.
   */
  private _sectionPlanesClick: ((e: MouseEvent) => void) | null = null;
  private _sectionPlanesCanvas: HTMLElement | null = null;

  // Lifecycle state.

  // Drag state.

  constructor(params: ToolbarParams) {
    if (!params || !params.viewer) {
      throw new Error("Toolbar: viewer is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-tb-toolbar",
      classPrefix: "xkt-tb",
      resizable:   false, // horizontal icon strip; resize has no useful meaning
    });
    this.viewer = params.viewer;
    this.studio = params.studio;
    this._onAction = params.onAction;

    // Replace any prior toolbar bound to the same Viewer.
    const prior = Toolbar._instances.get(params.viewer);
    if (prior && !prior._destroyed) prior.destroy();
    Toolbar._instances.set(params.viewer, this);

    injectStylesOnce();
    this._buildDom();
    // Chrome wiring (close, drag, pill registration, layout
    // persistence) is owned by the base class.
    this._bindChrome();
    this._wireDomEvents();

    // Mirror the active ViewController's current navMode into the
    // First-Person button so the toolbar reflects pre-existing
    // state if the host configured the controller before mounting.
    const vc = this._viewController();
    if (vc) {
      this._setPressed("toggleFirstPerson", vc.navMode === FirstPersonNavigationMode);
    }

    if (params.visible === false) {
      this.hide();
    } else {
      this.show();
    }
  }


  // ── Public lifecycle ──────────────────────────────────────────

  get visible(): boolean {
    return this._toolbar.style.display !== "none";
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
    if (Toolbar._instances.get(this.viewer) === this) {
      Toolbar._instances.delete(this.viewer);
    }
    super.destroy();
  }


  // ── Tool-mode state ───────────────────────────────────────────

  /**
   * Active mutually-exclusive object tool mode (`null` /
   * `"hide"` / `"select"` / `"marquee"`).
   *
   * Setting through this property updates the visible button
   * state and fires the `"toolModeChanged"` action through
   * {@link ToolbarParams.onAction}. Setting to the same mode
   * twice flips it off (toggle) — matching the "click an active
   * tool again to exit it" convention.
   */
  get toolMode(): ToolbarToolMode {
    return this._toolMode;
  }

  set toolMode(mode: ToolbarToolMode) {
    if (this._toolMode === mode) return;
    const prev = this._toolMode;
    this._toolMode = mode;

    // Per-button pressed state for the tool-mode buttons.
    const tracked: ToolbarToolMode[] = [
      "hide", "select", "marquee", "measureDistance", "measureAngle",
      "transformTranslate", "transformRotate", "transformScale",
      "sectionPlanes",
    ];
    for (const m of tracked) {
      const btn = this._btns[m as keyof typeof this._btns];
      if (!btn) continue;
      if (m === mode) btn.classList.add("xkt-tb-active");
      else            btn.classList.remove("xkt-tb-active");
    }

    // The split-button main slot represents the Measure cluster
    // as a whole. Pressed when *any* measure sub-mode is active.
    const measureMain = this._btns["measureDistance"] || this._btns["measureAngle"];
    if (this._measureMainBtn) {
      const measureActive = mode === "measureDistance" || mode === "measureAngle";
      if (measureActive) this._measureMainBtn.classList.add("xkt-tb-active");
      else               this._measureMainBtn.classList.remove("xkt-tb-active");
      // Sync the main-slot icon to the active sub-mode so a glance
      // tells the user which mode one click will activate. Falls
      // back to the last-used sub-mode when no measure mode is
      // active — that's the Photoshop flyout convention.
      this._measureMainBtn.innerHTML = (mode === "measureAngle")
        ? ICONS.measureAngle
        : (mode === "measureDistance")
          ? ICONS.measureDistance
          : (this._measureLastUsed === "measureAngle"
              ? ICONS.measureAngle
              : ICONS.measureDistance);
    }

    // Drive the actual mouse-control activation for measure modes.
    this._applyMeasureMode(prev, mode);

    // Drive the canvas click handler for object pick-driven modes.
    this._applyObjectMode(prev, mode);

    // Drive the TransformControls attach / mode transitions for the
    // transform-mode cluster (Translate / Rotate / Scale).
    this._applyTransformMode(prev, mode);

    // Section Planes: open / close the controller's proxies +
    // panel, install the canvas click handler that places a new
    // plane on each surface click.
    this._applySectionPlanesMode(prev, mode);

    if (this._onAction) {
      this._onAction("toolModeChanged", {toolbar: this, viewer: this.viewer, mode});
    }
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-tb-pill", {
      type: "button",
      title: "Reopen the toolbar",
      hidden: true,
      textContent: "Toolbar",
    }) as HTMLButtonElement;

    this._toolbar = el("div", "xkt-tb-toolbar");
    this._toolbar.setAttribute("role", "toolbar");
    this._toolbar.setAttribute("aria-label", "Viewer toolbar");
    // The toolbar uses its own root element as both the
    // FloatingPanelBase `_panel` (target of bring-to-front,
    // snap, layout-persistence) and `_header` (drag handle —
    // the whole toolbar surface drags, minus its buttons).
    this._panel  = this._toolbar;
    this._header = this._toolbar;

    // Two captioned rows: row 1 holds Files / Panels / Camera,
    // row 2 holds Tools / Transform / Measure / Inspect. Each
    // group is a vertical stack of its caption + button strip;
    // the rows are independent flex containers so the layout is
    // predictable on every screen width — no responsive wrap.
    const row1 = el("div", "xkt-tb-row");
    const row2 = el("div", "xkt-tb-row");
    this._toolbar.appendChild(row1);
    this._toolbar.appendChild(row2);

    // ── Row 1 — Files · Panels · Camera ────────────────────────
    const gFiles = this._mkGroup("Files");
    gFiles.btns.appendChild(this._mkFilesMenuBtn());
    row1.appendChild(gFiles.wrap);

    const gPanels = this._mkGroup("Panels");
    gPanels.btns.appendChild(this._mkBtn({
      action: "toggleExplorer",
      title:  "Toggle Explorer",
      svg:    ICONS.explorer,
      toggle: true,
    }));
    gPanels.btns.appendChild(this._mkBtn({
      action: "toggleModels",
      title:  "Toggle Models Panel",
      svg:    ICONS.models,
      toggle: true,
    }));
    gPanels.btns.appendChild(this._mkBtn({
      action: "toggleViews",
      title:  "Toggle Views Panel",
      svg:    ICONS.views,
      toggle: true,
    }));
    row1.appendChild(gPanels.wrap);

    const gCamera = this._mkGroup("Camera");
    gCamera.btns.appendChild(this._mkBtn({
      action: "resetView",
      title:  "Reset View",
      svg:    ICONS.home,
    }));
    gCamera.btns.appendChild(this._mkBtn({
      action: "toggle2D3D",
      title:  "Toggle 2D / 3D",
      svg:    ICONS.cube,
      toggle: true,
    }));
    gCamera.btns.appendChild(this._mkBtn({
      action: "toggleProjection",
      title:  "Toggle Perspective / Ortho",
      svg:    ICONS.frustum,
      toggle: true,
    }));
    gCamera.btns.appendChild(this._mkBtn({
      action: "fitAll",
      title:  "View Fit All",
      svg:    ICONS.fitAll,
    }));
    gCamera.btns.appendChild(this._mkBtn({
      action: "toggleFirstPerson",
      title:  "Toggle First-Person Navigation",
      svg:    ICONS.person,
      toggle: true,
    }));
    gCamera.btns.appendChild(this._mkBtn({
      action: "toggleNavCube",
      title:  "Toggle NavCube",
      svg:    ICONS.navCube,
      toggle: true,
    }));
    row1.appendChild(gCamera.wrap);

    // ── Row 2 — Tools · Transform · Measure · Inspect ──────────
    const gTools = this._mkGroup("Tools");
    gTools.btns.appendChild(this._mkToolModeBtn("hide",    "Hide Objects",   ICONS.eraser));
    gTools.btns.appendChild(this._mkToolModeBtn("select",  "Select Objects", ICONS.pointer));
    gTools.btns.appendChild(this._mkToolModeBtn("marquee", "Marquee Select", ICONS.marquee));
    row2.appendChild(gTools.wrap);

    // Transform cluster — activates the TransformControls gizmo
    // on the active View in the matching mode, then waits for a
    // canvas click to choose the target. Same "click the tool,
    // then click an object" pattern as Hide / Select / Marquee.
    const gXform = this._mkGroup("Transform");
    gXform.btns.appendChild(this._mkToolModeBtn("transformTranslate", "Translate", ICONS.transformTranslate));
    gXform.btns.appendChild(this._mkToolModeBtn("transformRotate",    "Rotate",    ICONS.transformRotate));
    gXform.btns.appendChild(this._mkToolModeBtn("transformScale",     "Scale",     ICONS.transformScale));
    row2.appendChild(gXform.wrap);

    const gSection = this._mkGroup("Section");
    gSection.btns.appendChild(this._mkToolModeBtn("sectionPlanes", "Section Planes", ICONS.sectionPlanes));
    row2.appendChild(gSection.wrap);

    const gMeasure = this._mkGroup("Measure");
    gMeasure.btns.appendChild(this._mkMeasureSplitBtn());
    gMeasure.btns.appendChild(this._mkBtn({
      action: "toggleDistancePanel",
      title:  "Toggle Distance Measurements Panel",
      svg:    ICONS.distancePanel,
      toggle: true,
    }));
    gMeasure.btns.appendChild(this._mkBtn({
      action: "toggleAnglePanel",
      title:  "Toggle Angle Measurements Panel",
      svg:    ICONS.anglePanel,
      toggle: true,
    }));
    row2.appendChild(gMeasure.wrap);

    const gInspect = this._mkGroup("Inspect");
    gInspect.btns.appendChild(this._mkInspectMenuBtn());
    row2.appendChild(gInspect.wrap);

    // Present — output / presentation features. Future
    // additions like report export or animation playback land
    // here too.
    const gPresent = this._mkGroup("Present");
    gPresent.wrap.classList.add("xkt-tb-group-end");
    gPresent.btns.appendChild(this._mkBtn({
      action: "openDrawings",
      title:  "Drawings",
      svg:    DrawingsPanel.iconSvg(),
    }));
    gPresent.btns.appendChild(this._mkBtn({
      action: "openSchemaMaterials",
      title:  "Schema Materials",
      svg:    SchemaMaterialsPanel.iconSvg(),
    }));
    row2.appendChild(gPresent.wrap);

    // ── Close
    this._closeBtn = el("button", "xkt-tb-close", {
      type: "button",
      "aria-label": "Hide toolbar",
      title: "Hide toolbar",
      innerHTML: "×",
    }) as HTMLButtonElement;
    this._toolbar.appendChild(this._closeBtn);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._toolbar);
  }

  /**
   * Build one captioned group — outer `wrap` holds the title row
   * and the buttons row, `btns` is the inner button-strip element
   * the caller appends buttons into. Captions render in the small
   * uppercase style above each strip; section boundaries come
   * from the captions, not from vertical dividers.
   */
  private _mkGroup(title: string): {wrap: HTMLElement; btns: HTMLElement} {
    const wrap = el("div", "xkt-tb-group");
    const titleEl = el("div", "xkt-tb-group-title");
    titleEl.textContent = title;
    const btns = el("div", "xkt-tb-group-btns");
    wrap.appendChild(titleEl);
    wrap.appendChild(btns);
    return {wrap, btns};
  }

  private _mkBtn(opts: {
    action:  ToolbarAction;
    title:   string;
    svg:     string;
    toggle?: boolean;
  }): HTMLButtonElement {
    const btn = el("button", "xkt-tb-btn", {
      type:  "button",
      title: opts.title,
      "aria-label": opts.title,
    }) as HTMLButtonElement;
    if (opts.toggle) btn.setAttribute("aria-pressed", "false");
    btn.innerHTML = opts.svg;
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._dispatch(opts.action);
    });
    this._btns[opts.action] = btn;
    return btn;
  }

  /**
   * Look the action up in {@link TOOLBAR_ACTIONS} and run it
   * against a freshly-built {@link ToolbarActionContext}. The
   * registry is the single source of truth for action behaviour.
   */
  private _dispatch(action: ToolbarAction): void {
    const descriptor = TOOLBAR_ACTIONS[action];
    if (!descriptor) {
      console.warn(`[Toolbar] No handler registered for action '${action}'.`);
      return;
    }
    descriptor.do(this._makeActionCtx());
  }

  /**
   * Build a {@link ToolbarActionContext} bound to this Toolbar's
   * Viewer / Studio / button-state plumbing. The context is
   * the only surface action implementations see — they never
   * reach back into Toolbar internals.
   */
  private _makeActionCtx(): ToolbarActionContext {
    return {
      viewer:        this.viewer,
      studio:    this.studio,
      activeView:    () => this._activeView(),
      viewController:() => this._viewController(),
      cameraFlight:  () => this._cameraFlight(),
      sceneAabb:     () => this._sceneAabb(),
      fireAction:    (action) => this._fireAction(action),
      setPressed:    (action, pressed) => this._setPressed(action, pressed),
      bindPanelSync: (panel, action) => this._bindPanelSync(panel, action),
    };
  }

  private _mkToolModeBtn(mode: Exclude<ToolbarToolMode, null>, title: string, svg: string): HTMLButtonElement {
    const btn = el("button", "xkt-tb-btn", {
      type:  "button",
      title,
      "aria-label": title,
    }) as HTMLButtonElement;
    btn.innerHTML = svg;
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      // Click active tool to exit it; click inactive tool to switch.
      this.toolMode = (this._toolMode === mode) ? null : mode;
    });
    this._btns[mode] = btn;
    return btn;
  }

  /**
   * Builds the Measurement split button — a main slot that
   * activates / deactivates the {@link _measureLastUsed |
   * last-used} measure sub-mode, plus a chevron half that opens
   * a flyout for picking which sub-mode to use.
   *
   * The visual is two adjacent buttons sharing a wrapper. They
   * both register against the relevant `ToolbarToolMode` keys in
   * {@link _btns} so the existing pressed-state plumbing still
   * applies — the main slot's pressed state is composed in
   * {@link toolMode}'s setter from the union of the two
   * sub-modes.
   */
  private _mkMeasureSplitBtn(): HTMLElement {
    const wrapper = el("div", "xkt-tb-split");

    const main = el("button", "xkt-tb-btn xkt-tb-split-main", {
      type:  "button",
      title: "Measure (click to start, chevron to switch mode)",
      "aria-label": "Measure",
    }) as HTMLButtonElement;
    main.innerHTML = ICONS.measureDistance;
    main.addEventListener("click", (ev) => {
      ev.stopPropagation();
      // Toggle the last-used sub-mode. Clicking the main half
      // when an unrelated mode is active still sets to the
      // last-used measure mode (consistent with the Photoshop
      // flyout convention).
      const mode = this._measureLastUsed;
      this.toolMode = (this._toolMode === mode) ? null : mode;
    });
    this._measureMainBtn = main;
    // Both sub-modes register the main slot too — used by the
    // pressed-state plumbing in toolMode's setter.
    this._btns["measureDistance"] = main;
    this._btns["measureAngle"] = main;
    wrapper.appendChild(main);

    const chevron = el("button", "xkt-tb-btn xkt-tb-split-chevron", {
      type:  "button",
      title: "Switch measure mode",
      "aria-label": "Switch measure mode",
      "aria-haspopup": "menu",
      "aria-expanded": "false",
    }) as HTMLButtonElement;
    chevron.innerHTML = ICONS.chevronDown;
    chevron.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._toggleMeasureFlyout(chevron);
    });
    wrapper.appendChild(chevron);

    return wrapper;
  }

  /**
   * Builds the Files menu button — a single-slot icon that opens a
   * dropdown of file-level actions ({@link _actionImportModel |
   * Import Model…}, {@link _actionExportModel | Export…}). Lives
   * at the leftmost position of the toolbar to match the
   * file-menu convention of every desktop and BIM-viewer
   * application.
   */
  private _mkFilesMenuBtn(): HTMLButtonElement {
    const btn = el("button", "xkt-tb-btn", {
      type:  "button",
      title: "Files",
      "aria-label": "Files",
      "aria-haspopup": "menu",
      "aria-expanded": "false",
    }) as HTMLButtonElement;
    btn.innerHTML = ICONS.files;
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._toggleFilesFlyout(btn);
    });
    this._btns["openFiles"] = btn;
    return btn;
  }

  private _mkInspectMenuBtn(): HTMLButtonElement {
    const btn = el("button", "xkt-tb-btn", {
      type:  "button",
      title: "Inspect",
      "aria-label": "Inspect",
      "aria-haspopup": "menu",
      "aria-expanded": "false",
    }) as HTMLButtonElement;
    btn.innerHTML = ICONS.inspect;
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._toggleInspectFlyout(btn);
    });
    return btn;
  }

  /**
   * Open / close the Files dropdown. Lists the standard
   * Import / Export actions; closes on outside-click and ESC.
   */
  private _toggleFilesFlyout(anchor: HTMLButtonElement): void {
    if (this._activeFlyout) {
      this._closeFlyout();
      return;
    }

    const flyout = el("div", "xkt-tb-flyout") as HTMLDivElement;
    flyout.setAttribute("role", "menu");

    const items: Array<{ action: ToolbarAction; label: string; svg: string }> = [
      {action: "importModel",       label: "Import Model",        svg: ImportDialog.iconSvg()},
      {action: "importSampleModel", label: "Import Sample Model", svg: SampleModelsPanel.iconSvg()},
      {action: "openExport",        label: "Export Model",        svg: ExportDialog.iconSvg()},
    ];
    for (const item of items) {
      const row = el("button", "xkt-tb-flyout-item", {
        type: "button",
        role: "menuitem",
      }) as HTMLButtonElement;
      const iconEl = el("span", "xkt-tb-flyout-icon");
      iconEl.innerHTML = item.svg;
      const labelEl = el("span", "xkt-tb-flyout-label");
      labelEl.textContent = item.label;
      row.append(iconEl, labelEl);
      row.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this._closeFlyout();
        this._dispatch(item.action);
      });
      flyout.appendChild(row);
    }

    const rect = anchor.getBoundingClientRect();
    flyout.style.left = `${rect.left}px`;
    flyout.style.top  = `${rect.bottom + 4}px`;
    document.body.appendChild(flyout);
    anchor.setAttribute("aria-expanded", "true");

    this._activeFlyout = flyout;

    this._flyoutOutsideHandler = (e: PointerEvent) => {
      if (!this._activeFlyout) return;
      const target = e.target as Node;
      if (this._activeFlyout.contains(target) || anchor.contains(target)) return;
      this._closeFlyout();
    };
    this._flyoutKeydownHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") this._closeFlyout();
    };
    setTimeout(() => {
      if (this._flyoutOutsideHandler) {
        window.addEventListener("pointerdown", this._flyoutOutsideHandler, true);
      }
      if (this._flyoutKeydownHandler) {
        window.addEventListener("keydown", this._flyoutKeydownHandler);
      }
    }, 0);
  }

  /**
   * Open / close the Inspect dropdown. Three labelled groups —
   * Health (Scene Health, Data Health), Statistics (Scene Stats,
   * Data Stats), Diagnostics (Boundaries, GPU Tiles, GPU Memory,
   * Events) — each separated by a small caps heading row.
   * Closes on outside-click and ESC.
   */
  private _toggleInspectFlyout(anchor: HTMLButtonElement): void {
    if (this._activeFlyout) {
      this._closeFlyout();
      return;
    }

    const flyout = el("div", "xkt-tb-flyout xkt-tb-flyout-grouped") as HTMLDivElement;
    flyout.setAttribute("role", "menu");

    type Row = { label: string; svg: string; run: () => void };
    const groups: Array<{ heading: string; rows: Row[] }> = [
      {
        heading: "Health",
        rows: [
          {
            label: "Scene Health",
            svg:   SceneHealthPanel.iconSvg(),
            run:   () => { this.studio?.panels.open("sceneHealth"); },
          },
          {
            label: "Data Health",
            svg:   DataHealthPanel.iconSvg(),
            run:   () => { this.studio?.panels.open("dataHealth"); },
          },
        ],
      },
      {
        heading: "Statistics",
        rows: [
          {
            label: "Scene Statistics",
            svg:   SceneStatsPanel.iconSvg(),
            run:   () => { this.studio?.panels.open("sceneStats"); },
          },
          {
            label: "Data Statistics",
            svg:   DataStatsPanel.iconSvg(),
            run:   () => { this.studio?.panels.open("dataStats"); },
          },
        ],
      },
      {
        heading: "Diagnostics",
        rows: [
          {
            label: "Scene Boundaries",
            svg:   BoundariesPanel.iconSvg(),
            run:   () => { this.studio?.panels.open("boundariesPanel"); },
          },
          {
            label: "GPU Tiles",
            svg:   TilesPanel.iconSvg(),
            run:   () => { this.studio?.panels.open("tilesPanel"); },
          },
          {
            label: "GPU Memory",
            svg:   GPUMemoryPanel.iconSvg(),
            run:   () => { this.studio?.panels.open("gpuMemory"); },
          },
          {
            label: "Issues",
            svg:   IssuesPanel.iconSvg(),
            run:   () => { this.studio?.panels.open("issuesPanel"); },
          },
          {
            label: "Tasks",
            svg:   TasksPanel.iconSvg(),
            run:   () => { this.studio?.panels.open("tasksPanel"); },
          },
          {
            label: "Renderer",
            svg:   RendererPanel.iconSvg(),
            run:   () => { this.studio?.panels.open("rendererPanel"); },
          },
          {
            label: "Shaders",
            svg:   ShadersPanel.iconSvg(),
            run:   () => { this.studio?.panels.open("shadersPanel"); },
          },
          {
            label: "Data Textures",
            svg:   DataTexturesPanel.iconSvg(),
            run:   () => { this.studio?.panels.open("dataTexturesPanel"); },
          },
        ],
      },
    ];

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const heading = el("div", "xkt-tb-flyout-heading", {
        role: "presentation",
      });
      heading.textContent = group.heading;
      flyout.appendChild(heading);

      for (const item of group.rows) {
        const row = el("button", "xkt-tb-flyout-item", {
          type: "button",
          role: "menuitem",
        }) as HTMLButtonElement;
        const iconEl = el("span", "xkt-tb-flyout-icon");
        iconEl.innerHTML = item.svg;
        const labelEl = el("span", "xkt-tb-flyout-label");
        labelEl.textContent = item.label;
        row.append(iconEl, labelEl);
        row.addEventListener("click", (ev) => {
          ev.stopPropagation();
          this._closeFlyout();
          item.run();
        });
        flyout.appendChild(row);
      }
    }

    // Right-anchor the flyout: Inspect sits at the toolbar's right
    // edge, so a left-anchored popup would overflow the viewport.
    document.body.appendChild(flyout);
    const rect = anchor.getBoundingClientRect();
    const flyoutWidth = flyout.offsetWidth;
    const desiredLeft = rect.right - flyoutWidth;
    const left = Math.max(8, Math.min(window.innerWidth - flyoutWidth - 8, desiredLeft));
    flyout.style.left = `${left}px`;
    flyout.style.top  = `${rect.bottom + 4}px`;
    anchor.setAttribute("aria-expanded", "true");

    this._activeFlyout = flyout;
    this._flyoutOutsideHandler = (e: PointerEvent) => {
      if (!this._activeFlyout) return;
      const target = e.target as Node;
      if (this._activeFlyout.contains(target) || anchor.contains(target)) return;
      this._closeFlyout();
    };
    this._flyoutKeydownHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") this._closeFlyout();
    };
    setTimeout(() => {
      if (this._flyoutOutsideHandler) {
        window.addEventListener("pointerdown", this._flyoutOutsideHandler, true);
      }
      if (this._flyoutKeydownHandler) {
        window.addEventListener("keydown", this._flyoutKeydownHandler);
      }
    }, 0);
  }

  /**
   * Open / close the Measure mode-picker flyout. Positions it
   * just below the chevron; closes on outside-click and ESC.
   */
  private _toggleMeasureFlyout(anchor: HTMLButtonElement): void {
    if (this._activeFlyout) {
      this._closeFlyout();
      return;
    }

    const flyout = el("div", "xkt-tb-flyout") as HTMLDivElement;
    flyout.setAttribute("role", "menu");

    const items: Array<{ mode: Exclude<ToolbarToolMode, null>; label: string; svg: string }> = [
      {mode: "measureDistance", label: "Distance", svg: ICONS.measureDistance},
      {mode: "measureAngle",    label: "Angle",    svg: ICONS.measureAngle},
    ];
    for (const item of items) {
      const row = el("button", "xkt-tb-flyout-item", {
        type: "button",
        role: "menuitem",
      }) as HTMLButtonElement;
      if (item.mode === this._measureLastUsed) {
        row.classList.add("xkt-tb-flyout-current");
      }
      const iconEl = el("span", "xkt-tb-flyout-icon");
      iconEl.innerHTML = item.svg;
      const labelEl = el("span", "xkt-tb-flyout-label");
      labelEl.textContent = item.label;
      row.append(iconEl, labelEl);
      row.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this._measureLastUsed = item.mode as "measureDistance" | "measureAngle";
        this.toolMode = item.mode;
        this._closeFlyout();
      });
      flyout.appendChild(row);
    }

    // Position below chevron in viewport coords.
    const rect = anchor.getBoundingClientRect();
    flyout.style.left = `${rect.left}px`;
    flyout.style.top  = `${rect.bottom + 4}px`;
    document.body.appendChild(flyout);
    anchor.setAttribute("aria-expanded", "true");

    this._activeFlyout = flyout;

    // Close on outside-click / ESC. Defer attaching the
    // outside-click handler to the next event-loop tick so the
    // click that opened the flyout doesn't immediately close it.
    this._flyoutOutsideHandler = (e: PointerEvent) => {
      if (!this._activeFlyout) return;
      const target = e.target as Node;
      if (this._activeFlyout.contains(target) || anchor.contains(target)) return;
      this._closeFlyout();
    };
    this._flyoutKeydownHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") this._closeFlyout();
    };
    setTimeout(() => {
      if (this._flyoutOutsideHandler) {
        window.addEventListener("pointerdown", this._flyoutOutsideHandler, true);
      }
      if (this._flyoutKeydownHandler) {
        window.addEventListener("keydown", this._flyoutKeydownHandler);
      }
    }, 0);
  }

  private _closeFlyout(): void {
    if (this._activeFlyout) {
      this._activeFlyout.remove();
      this._activeFlyout = null;
    }
    if (this._flyoutOutsideHandler) {
      window.removeEventListener("pointerdown", this._flyoutOutsideHandler, true);
      this._flyoutOutsideHandler = null;
    }
    if (this._flyoutKeydownHandler) {
      window.removeEventListener("keydown", this._flyoutKeydownHandler);
      this._flyoutKeydownHandler = null;
    }
    // Reset aria-expanded on every menu-opening control we might
    // have opened — chevrons (Measure split) and any toolbar button
    // marked as a menu trigger (Files menu).
    const triggers = this._toolbar.querySelectorAll(
      ".xkt-tb-split-chevron, .xkt-tb-btn[aria-haspopup=\"menu\"]"
    );
    triggers.forEach((c) => c.setAttribute("aria-expanded", "false"));
  }

  /**
   * Activate / deactivate the per-View measurement mouse control
   * for the active View when {@link toolMode} transitions in or
   * out of a measure sub-mode. The active View is the first
   * entry in {@link Viewer.viewList} — same convention as the
   * Views panel uses to pick the View whose camera "New View"
   * clones.
   */
  private _applyMeasureMode(prev: ToolbarToolMode, next: ToolbarToolMode): void {
    const view = this._activeView();
    if (!view || !this.studio) return;

    // Deactivate the previous measure sub-mode if there was one.
    if (prev === "measureDistance" || prev === "measureAngle") {
      const tool = (prev === "measureDistance")
        ? DistanceMeasurementTool.getFor(view)
        : AngleMeasurementsTool.getFor(view);
      if (tool) tool.mouseControl.deactivate();
    }

    // Activate the new measure sub-mode if there is one.
    if (next === "measureDistance") {
      const tool = this.studio.panels.open("distanceMeasurements", {view});
      tool?.mouseControl.activate();
    } else if (next === "measureAngle") {
      const tool = this.studio.panels.open("angleMeasurements", {view});
      tool?.mouseControl.activate();
    }
  }

  /**
   * Install / uninstall the canvas click handler for object
   * pick-driven tool modes (Hide, Select). Each mode picks the
   * object under the cursor on click and applies the relevant
   * action.
   *
   * Marquee select is more complex (drag-rectangle) and isn't
   * wired here; the button still fires `toolModeChanged` so a
   * host can implement it externally.
   */
  private _applyObjectMode(prev: ToolbarToolMode, next: ToolbarToolMode): void {
    const PICK_MODES: ToolbarToolMode[] = ["hide", "select"];
    const wasPick = PICK_MODES.includes(prev);
    const isPick  = PICK_MODES.includes(next);

    if (wasPick && this._objectModeClick && this._objectModeCanvas) {
      this._objectModeCanvas.removeEventListener("click", this._objectModeClick);
      this._objectModeClick = null;
      this._objectModeCanvas.style.cursor = "";
      this._objectModeCanvas = null;
    }

    if (!isPick) return;

    const view = this._activeView();
    if (!view || !this.studio) return;
    const canvas = view.htmlElement;
    const picker = this.studio.picking.picker;

    const handler = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const result = picker.pick({
        view,
        canvasPos: [e.clientX - rect.left, e.clientY - rect.top],
      });
      if (!result.hit || !result.objectId) return;
      const viewObject = view.objects[result.objectId];
      if (!viewObject) return;
      if (next === "hide") {
        viewObject.visible = false;
      } else if (next === "select") {
        // Toggle selection — clicking an already-selected object
        // deselects, matching the Photoshop / Figma convention.
        viewObject.selected = !viewObject.selected;
      }
    };

    canvas.addEventListener("click", handler);
    canvas.style.cursor = "crosshair";
    this._objectModeClick = handler;
    this._objectModeCanvas = canvas;
  }

  /**
   * Drive {@link TransformControls} lifecycle when {@link toolMode}
   * transitions in or out of the transform cluster
   * (`"transformTranslate" / "transformRotate" / "transformScale"`).
   *
   * - Entering a transform mode from a non-transform mode: ensure
   *   the controls exist on the active View, install a canvas
   *   click-pick handler so the user can choose a target, and set
   *   the controls' interaction mode to match the button.
   * - Switching between transform modes: just retarget the
   *   existing controls' mode. The click handler stays installed
   *   so the user can still pick a different target.
   * - Leaving the transform cluster: detach the controls and tear
   *   down the click handler.
   *
   * The click handler picks via the unified BVH picker but ignores
   * hits on the gizmo's own SceneObjects (ids prefixed with
   * `"__tc."`) — without this skip, clicking a gizmo handle would
   * re-attach to the handle's own SceneObject as if it were a
   * scene target.
   */
  private _applyTransformMode(prev: ToolbarToolMode, next: ToolbarToolMode): void {
    const TRANSFORM_MODES: ToolbarToolMode[] = [
      "transformTranslate", "transformRotate", "transformScale",
    ];
    const wasTransform = TRANSFORM_MODES.includes(prev);
    const isTransform  = TRANSFORM_MODES.includes(next);

    // Tear down on the way out (or when no longer in any transform
    // mode). Detach also resets the gizmo's UI state.
    if (wasTransform && !isTransform) {
      const view = this._activeView();
      if (view) {
        const tc = TransformControls.getFor(view);
        if (tc) tc.detach();
      }
      if (this._transformModeClick && this._transformModeCanvas) {
        this._transformModeCanvas.removeEventListener("pointerdown", this._transformModeClick, true);
        this._transformModeCanvas.style.cursor = "";
        this._transformModeClick = null;
        this._transformModeCanvas = null;
      }
      return;
    }

    if (!isTransform) return;

    const view = this._activeView();
    if (!view || !this.studio) return;

    const tcMode = next === "transformTranslate" ? "translate"
                 : next === "transformRotate"    ? "rotate"
                                                  : "scale";
    const tc = this.studio.panels.open("transformControls", {view});
    if (!tc) return;
    tc.setMode(tcMode);

    if (wasTransform) return; // mode-only switch — click handler already installed

    const canvas = view.htmlElement;
    const picker = this.studio.picking.picker;
    // Listen on `pointerdown` (not `click`) so the attach happens
    // at the press position, not the release. The `click` event
    // fires at the pointerup location, so any drift between press
    // and release would re-pick under the release point and move
    // the gizmo from where the user actually clicked.
    //
    // Capture-phase registration so this handler sits in the same
    // event-flow lane as TC's own pointerdown listener. TC was
    // registered first (by openTransformControls above), so the
    // capture-phase order is: TC → this handler. When TC consumes
    // a gizmo-handle click it calls `stopImmediatePropagation`
    // and this handler is silently skipped; when TC's pick
    // returns null (the click missed all handles) propagation
    // continues and we pick / attach normally.
    const handler = (e: MouseEvent) => {
      // Primary button only — `click` was implicitly left-button
      // filtered; pointerdown isn't.
      if (e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const result = picker.pick({
        view,
        canvasPos: [e.clientX - rect.left, e.clientY - rect.top],
      });
      if (!result.hit || !result.objectId) return;
      // Skip clicks on the gizmo's own SceneObjects — defensive
      // belt-and-braces against the same id leaking through some
      // host PickStrategy that doesn't apply TC's filter.
      if (result.objectId.startsWith("__tc.")) return;
      const viewObject = view.objects[result.objectId];
      if (!viewObject) return;
      // Pass the picked surface point through as the gizmo's
      // pivot so rotate / scale operate about exactly where the
      // user clicked, not the SceneObject's geometric origin.
      const pivotWorld = result.worldPos ?? undefined;
      tc.attach(viewObject.sceneObject, pivotWorld ? {pivotWorld} : undefined);
    };
    canvas.addEventListener("pointerdown", handler, true);
    canvas.style.cursor = "crosshair";
    this._transformModeClick = handler;
    this._transformModeCanvas = canvas;
  }

  /**
   * Drive the Section Planes tool's lifecycle when
   * {@link toolMode} transitions in or out of `"sectionPlanes"`.
   *
   * - Entering: open the panel + controller for the active View,
   *   make every plane proxy visible, install a canvas pointer-
   *   down handler that picks a surface and creates a new plane
   *   at the hit point with the surface normal.
   * - Leaving: hide every proxy, detach the gizmo, close the
   *   panel, tear down the click handler.
   *
   * The click handler skips picks on the gizmo's own meshes
   * (`__tc.`) and on the proxy quads themselves (`__sp.`), so
   * clicking on existing tool UI doesn't spawn a redundant
   * plane.
   */
  private _applySectionPlanesMode(prev: ToolbarToolMode, next: ToolbarToolMode): void {
    const wasSection = prev === "sectionPlanes";
    const isSection  = next === "sectionPlanes";
    if (!wasSection && !isSection) return;

    // Tear down on the way out.
    if (wasSection && !isSection) {
      const view = this._activeView();
      if (view) {
        const ctrl = SectionPlanesController.getFor(view);
        if (ctrl) ctrl.setVisible(false);
        const panel = SectionPlanesPanel.getFor(view);
        if (panel) panel.hide();
      }
      if (this._sectionPlanesClick && this._sectionPlanesCanvas) {
        this._sectionPlanesCanvas.removeEventListener("pointerdown", this._sectionPlanesClick, true);
        this._sectionPlanesCanvas.style.cursor = "";
        this._sectionPlanesClick = null;
        this._sectionPlanesCanvas = null;
      }
      return;
    }

    // Entering.
    const view = this._activeView();
    if (!view || !this.studio) return;

    const ctrl = SectionPlanesController.openFor(view);
    ctrl.setVisible(true);
    this.studio.panels.open("sectionPlanesPanel", {view});

    const canvas = view.htmlElement;
    const picker = this.studio.picking.picker;
    const handler = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const result = picker.pick({
        view,
        canvasPos: [e.clientX - rect.left, e.clientY - rect.top],
      });
      if (!result.hit || !result.worldPos) return;
      // Skip clicks on TC / section-plane tool meshes so the user
      // can interact with existing UI without spawning a new
      // plane underneath it.
      if (result.objectId && (result.objectId.startsWith("__tc.") || result.objectId.startsWith("__sp."))) return;
      // Prefer the picked surface normal; fall back to camera-Z
      // when the picker didn't return one.
      const normal = result.worldNormal ?? [0, 0, 1];
      ctrl.createSectionPlane(
        [result.worldPos[0], result.worldPos[1], result.worldPos[2]],
        [normal[0], normal[1], normal[2]],
      );
    };
    canvas.addEventListener("pointerdown", handler, true);
    canvas.style.cursor = "crosshair";
    this._sectionPlanesClick = handler;
    this._sectionPlanesCanvas = canvas;
  }

  private _activeView(): View | null {
    return this.viewer.viewList[0] ?? null;
  }

  /**
   * Look up the {@link CameraFlightAnimation} the {@link Studio}
   * registered alongside the active View. The flight isn't a
   * property of {@link viewing!viewer.View | View} itself —
   * `ViewManager.createView()` stashes it on
   * `studio.viewManager.views[viewId].cameraFlight`. Returns
   * `null` when no helper is wired or the active View has no
   * registered flight.
   */
  private _cameraFlight(): CameraFlightLike | null {
    const view = this._activeView();
    if (!view || !this.studio) return null;
    const record = (this.studio.viewManager.views as any)?.[view.id];
    return record?.cameraFlight ?? null;
  }

  /**
   * Look up the {@link ViewController} the {@link Studio}
   * registered alongside the active View. Same shape as
   * {@link _cameraFlight}: the `ViewController` is not a property
   * of {@link viewing!viewer.View | View} itself —
   * `ViewManager.createView()` stashes it on
   * `studio.viewManager.views[viewId].viewController`. Returns
   * `null` when no helper is wired or the active View has no
   * registered controller.
   */
  private _viewController(): ViewController | null {
    const view = this._activeView();
    if (!view || !this.studio) return null;
    const record = (this.studio.viewManager.views as any)?.[view.id];
    return record?.viewController ?? null;
  }

  private _wireDomEvents(): void {
    /* Drag, close, pill, snap, layout persistence — all owned by
       the FloatingPanelBase via `_bindChrome()`. The toolbar uses
       its root element as both `_panel` and `_header`, so the
       whole toolbar surface (minus buttons) acts as a drag
       handle. */
  }


  // ── Layout persistence ────────────────────────────────────────



  // ── Action handlers ───────────────────────────────────────────

  /** Returns true when a host override consumed the action. */
  private _fireAction(action: ToolbarAction, mode?: ToolbarToolMode): boolean {
    if (!this._onAction) return false;
    const result = this._onAction(action, {toolbar: this, viewer: this.viewer, mode});
    return result === true;
  }

  private _setPressed(action: ToolbarAction | ToolbarToolMode, pressed: boolean): void {
    const btn = this._btns[action as keyof typeof this._btns];
    if (!btn) return;
    btn.setAttribute("aria-pressed", String(pressed));
  }

  /**
   * Subscribe a panel-toggle Toolbar button to its panel's
   * visibility, so the button's pressed state stays in sync if
   * the user closes the panel via its X (or any other path that
   * does not go through the Toolbar). Idempotent — safe to call
   * on every action invocation.
   */
  private _bindPanelSync(panel: FloatingPanelBase, action: ToolbarAction): void {
    if (this._syncedPanels.has(panel)) return;
    this._syncedPanels.add(panel);
    panel.onVisibilityChanged.subscribe((_p, visible) => {
      this._setPressed(action, visible);
    });
  }


  // ── Helpers ───────────────────────────────────────────────────

  /**
   * Scene's overall AABB, read off the Studio's collision
   * index. Returns `null` when the helper isn't available or the
   * scene has nothing to frame yet.
   */
  private _sceneAabb(): number[] | null {
    if (!this.studio) return null;
    const idx: any = (this.studio as any).collisionIndex;
    if (!idx || typeof idx.getSceneAABB !== "function") return null;
    const aabb = idx.getSceneAABB();
    return aabb ? Array.from(aabb) : null;
  }
}


// ─────────────────────────────────────────────────────────────────
// Inline icon library — monochrome SVGs sized 24×24, strokes use
// `currentColor`. CSS scales them to 18×18 inside 32×32 buttons.
// ─────────────────────────────────────────────────────────────────

const ICONS = {
  // Magnifier — Inspect dropdown (Health, Statistics, Diagnostics).
  // Matches the tone of the Import / Export tray icons (1.6 strokes,
  // rounded caps / joins, currentColor).
  inspect:
    `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<circle cx="10.5" cy="10.5" r="5.5" ` +
              `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<path d="M 14.7 14.7 L 19.5 19.5" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" ` +
            `stroke-linecap="round"/>` +
    `</svg>`,

  // Folder with a small chevron — Files dropdown.
  files:
    `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M3 7 L3 19 A1 1 0 0 0 4 20 L20 20 A1 1 0 0 0 21 19 L21 9 A1 1 0 0 0 20 8 L11 8 L9 6 L4 6 A1 1 0 0 0 3 7 Z" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M9 14 L12 17 L15 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`,

  // Document with a downward arrow — Import (load into scene).
  fileImport:
    `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M6 3 L14 3 L19 8 L19 21 L6 21 Z" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M14 3 L14 8 L19 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M12 11 L12 17 M9 14 L12 17 L15 14" ` +
            `fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`,

  // Document with an upward arrow — Export (save out of scene).
  fileExport:
    `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M6 3 L14 3 L19 8 L19 21 L6 21 Z" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M14 3 L14 8 L19 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M12 17 L12 11 M9 14 L12 11 L15 14" ` +
            `fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`,

  // Tree / hierarchy — Explorer panel (sourced from the panel
  // class so the toolbar button and the panel title-bar stay
  // visually paired).
  explorer: ExplorerPanel.iconSvg(),

  // Stack of three labelled rows — Models panel.
  models: ModelsPanel.iconSvg(),

  // Eye — Views panel (sourced from the panel class for the same
  // toolbar / title-bar pairing reason).
  views: ViewerConfigPanel.iconSvg(),

  // Home / reset.
  home:
    `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M3 11 L12 3 L21 11 L21 20 L15 20 L15 14 L9 14 L9 20 L3 20 Z" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` +
    `</svg>`,

  // Isometric cube — toggle 2D / 3D.
  cube:
    `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M12 3 L21 8 L21 17 L12 22 L3 17 L3 8 Z" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M3 8 L12 13 L21 8 M12 13 L12 22" ` +
            `fill="none" stroke="currentColor" stroke-width="1.4"/>` +
    `</svg>`,

  // Frustum trapezoid — toggle perspective / ortho.
  frustum:
    `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="3"  y="9"  width="6" height="6" rx="0.6" fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<rect x="14" y="6"  width="7" height="12" rx="0.8" fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<path d="M9 9 L14 6 M9 15 L14 18" fill="none" stroke="currentColor" stroke-width="1.4"/>` +
    `</svg>`,

  // Four corner brackets — fit all.
  fitAll:
    `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M4 9 L4 4 L9 4"   fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>` +
      `<path d="M15 4 L20 4 L20 9"  fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>` +
      `<path d="M20 15 L20 20 L15 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>` +
      `<path d="M9 20 L4 20 L4 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>` +
    `</svg>`,

  // Standing person — first-person nav.
  person:
    `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<circle cx="12" cy="5.5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<path d="M7 21 L7 13 C 7 11 8.5 10 12 10 C 15.5 10 17 11 17 13 L 17 21" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`,

  // Eraser — hide objects mode.
  eraser:
    `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M3 16 L13 6 L19 12 L9 22 L3 22 L3 16 Z" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M9 22 L20 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>` +
    `</svg>`,

  // Mouse pointer — select objects mode.
  pointer:
    `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M5 3 L5 19 L9 15 L11.5 21 L14 20 L11.5 14 L17 14 Z" ` +
            `fill="currentColor"/>` +
    `</svg>`,

  // Dashed selection rectangle — marquee select.
  marquee:
    `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="3" y="3" width="18" height="18" rx="0.5" ` +
            `fill="none" stroke="currentColor" stroke-width="1.7" ` +
            `stroke-dasharray="2.4 2.4" stroke-linecap="round"/>` +
    `</svg>`,

  // Three-axis arrows — translate mode (TransformControls).
  transformTranslate:
    `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<circle cx="11" cy="13" r="1.5" fill="currentColor" stroke="none"/>` +
      `<line x1="11" y1="13" x2="21" y2="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>` +
      `<polyline points="19 11 21 13 19 15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<line x1="11" y1="13" x2="11" y2="3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>` +
      `<polyline points="9 5 11 3 13 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<line x1="11" y1="13" x2="4" y2="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>` +
      `<polyline points="4.5 17.5 4 20 6.5 19.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`,

  // Curved arrow — rotate mode (TransformControls).
  transformRotate:
    `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M5 12 A 7 7 0 1 1 12 19" ` +
            `fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>` +
      `<polyline points="9 17 12 19 13 16" ` +
            `fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="12" cy="12" r="1.4" fill="currentColor"/>` +
    `</svg>`,

  // Box with directional arrows — scale mode (TransformControls).
  transformScale:
    `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="8" y="8" width="8" height="8" rx="0.6" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<polyline points="3 3 6 6 4 6 6 6 6 4" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<polyline points="21 3 18 6 20 6 18 6 18 4" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<polyline points="3 21 6 18 6 20 6 18 4 18" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<polyline points="21 21 18 18 20 18 18 18 18 20" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`,

  // Cube intersected by a diagonal plane — section-planes mode.
  sectionPlanes: SectionPlanesPanel.iconSvg(),

  // Tilted ruler — measure distance mode.
  measureDistance: DistanceMeasurementTool.iconSvg(),

  // Angle arms with arc — measure angle mode.
  measureAngle: AngleMeasurementsTool.iconSvg(),

  // Small downward triangle — split-button chevron.
  chevronDown:
    `<svg viewBox="0 0 12 12" aria-hidden="true">` +
      `<path d="M3 4.5 L6 8 L9 4.5 Z" fill="currentColor"/>` +
    `</svg>`,

  // Generic isometric cube — NavCube viewport widget.
  navCube: NavCube.iconSvg(),

  // List with ruler — Distance Measurements panel.
  distancePanel: DistanceMeasurementsPanel.iconSvg(),

  // List with angle — Angle Measurements panel.
  anglePanel: AngleMeasurementsPanel.iconSvg(),
};
