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
import type {Viewer, View} from "../../viewer";
import type {DemoHelper} from "../DemoHelper";
import {ExplorerPanel} from "../explorerPanel/ExplorerPanel";
import {NavCube} from "../navCube/NavCube";
import {DistanceMeasurementTool} from "../measurements/distance/DistanceMeasurementTool";
import {AngleMeasurementsTool} from "../measurements/angle/AngleMeasurementsTool";
import {DistanceMeasurementsPanel} from "../distanceMeasurementsPanel/DistanceMeasurementsPanel";
import {AngleMeasurementsPanel} from "../angleMeasurementsPanel/AngleMeasurementsPanel";
import {OrthoProjectionType, PerspectiveProjectionType} from "../../constants";


import {el} from "../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";
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
  | "measureAngle";

/**
 * Stable ids for the toolbar's actions, fired through the
 * {@link ToolbarParams.onAction} callback. Stable across SDK
 * versions so hosts can switch on them.
 */
export type ToolbarAction =
  | "openFiles"
  | "importModel"
  | "openExport"
  | "toggleExplorer"
  | "toggleViews"
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
   * Optional DemoHelper. Used by Fit-All / Reset-View to read
   * the Scene's overall AABB out of the helper's collision
   * index; without it the camera-framing buttons fall back to a
   * console-warn no-op.
   */
  demoHelper?: DemoHelper;

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
  display: flex;
  align-items: center;
  gap: 0;
  padding: 6px 8px;
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

.xkt-tb-toolbar .xkt-tb-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
}
.xkt-tb-toolbar .xkt-tb-sep {
  width: 1px;
  align-self: stretch;
  background: #ececec;
  margin: 4px 0;
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
  margin-left: 6px;
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

/* ── Flyout — mode picker dropdown. ───────────────────────── */
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
  z-index: 200000001;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.xkt-tb-flyout-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 10px;
  font: inherit;
  font-size: 12px;
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
  readonly demoHelper?: DemoHelper;
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
    });
    this.viewer = params.viewer;
    this.demoHelper = params.demoHelper;
    this._onAction = params.onAction;

    // Replace any prior toolbar bound to the same Viewer.
    const prior = Toolbar._instances.get(params.viewer);
    if (prior && !prior._destroyed) prior.destroy();
    Toolbar._instances.set(params.viewer, this);

    injectStylesOnce();
    this._buildDom();
    this._wireDomEvents();


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

    // ── Group 0 — Files menu (Import, Export)
    const g0 = el("div", "xkt-tb-group");
    g0.appendChild(this._mkFilesMenuBtn());
    this._toolbar.appendChild(g0);

    this._toolbar.appendChild(el("div", "xkt-tb-sep"));

    // ── Group 1 — Panels (Explorer, Views)
    const g1 = el("div", "xkt-tb-group");
    g1.appendChild(this._mkBtn({
      action: "toggleExplorer",
      title:  "Toggle Explorer",
      svg:    ICONS.explorer,
      handler: () => this._actionToggleExplorer(),
      toggle:  true,
    }));
    g1.appendChild(this._mkBtn({
      action: "toggleViews",
      title:  "Toggle Views Panel",
      svg:    ICONS.views,
      handler: () => this._actionToggleViews(),
      toggle:  true,
    }));
    this._toolbar.appendChild(g1);

    this._toolbar.appendChild(el("div", "xkt-tb-sep"));

    // ── Group 2 — Camera / projection / framing
    const g2 = el("div", "xkt-tb-group");
    g2.appendChild(this._mkBtn({
      action:  "resetView",
      title:   "Reset View",
      svg:     ICONS.home,
      handler: () => this._actionResetView(),
    }));
    g2.appendChild(this._mkBtn({
      action:  "toggle2D3D",
      title:   "Toggle 2D / 3D",
      svg:     ICONS.cube,
      handler: () => this._actionToggle2D3D(),
      toggle:  true,
    }));
    g2.appendChild(this._mkBtn({
      action:  "toggleProjection",
      title:   "Toggle Perspective / Ortho",
      svg:     ICONS.frustum,
      handler: () => this._actionToggleProjection(),
      toggle:  true,
    }));
    g2.appendChild(this._mkBtn({
      action:  "fitAll",
      title:   "View Fit All",
      svg:     ICONS.fitAll,
      handler: () => this._actionFitAll(),
    }));
    g2.appendChild(this._mkBtn({
      action:  "toggleFirstPerson",
      title:   "Toggle First-Person Navigation",
      svg:     ICONS.person,
      handler: () => this._actionToggleFirstPerson(),
      toggle:  true,
    }));
    g2.appendChild(this._mkBtn({
      action:  "toggleNavCube",
      title:   "Toggle NavCube",
      svg:     ICONS.navCube,
      handler: () => this._actionToggleNavCube(),
      toggle:  true,
    }));
    this._toolbar.appendChild(g2);

    this._toolbar.appendChild(el("div", "xkt-tb-sep"));

    // ── Group 3 — Mutually-exclusive object tool modes
    const g3 = el("div", "xkt-tb-group");
    g3.appendChild(this._mkToolModeBtn("hide",    "Hide Objects",    ICONS.eraser));
    g3.appendChild(this._mkToolModeBtn("select",  "Select Objects",  ICONS.pointer));
    g3.appendChild(this._mkToolModeBtn("marquee", "Marquee Select",  ICONS.marquee));
    this._toolbar.appendChild(g3);

    this._toolbar.appendChild(el("div", "xkt-tb-sep"));

    // ── Group 4 — Measurement cluster (split-button mode + panels)
    const g4 = el("div", "xkt-tb-group");
    g4.appendChild(this._mkMeasureSplitBtn());
    g4.appendChild(this._mkBtn({
      action:  "toggleDistancePanel",
      title:   "Toggle Distance Measurements Panel",
      svg:     ICONS.distancePanel,
      handler: () => this._actionToggleDistancePanel(),
      toggle:  true,
    }));
    g4.appendChild(this._mkBtn({
      action:  "toggleAnglePanel",
      title:   "Toggle Angle Measurements Panel",
      svg:     ICONS.anglePanel,
      handler: () => this._actionToggleAnglePanel(),
      toggle:  true,
    }));
    this._toolbar.appendChild(g4);

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

  private _mkBtn(opts: {
    action:  ToolbarAction;
    title:   string;
    svg:     string;
    handler: () => void;
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
      opts.handler();
    });
    this._btns[opts.action] = btn;
    return btn;
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

    const items: Array<{ action: ToolbarAction; label: string; svg: string; handler: () => void }> = [
      {
        action:  "importModel",
        label:   "Import Model…",
        svg:     ICONS.fileImport,
        handler: () => this._actionImportModel(),
      },
      {
        action:  "openExport",
        label:   "Export…",
        svg:     ICONS.fileExport,
        handler: () => this._actionExportModel(),
      },
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
        item.handler();
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
   * entry in {@link Viewer.viewList} — same convention as
   * {@link ViewsPanel}'s "active" badge.
   */
  private _applyMeasureMode(prev: ToolbarToolMode, next: ToolbarToolMode): void {
    const view = this._activeView();
    if (!view || !this.demoHelper) return;

    // Deactivate the previous measure sub-mode if there was one.
    if (prev === "measureDistance" || prev === "measureAngle") {
      const tool = (prev === "measureDistance")
        ? DistanceMeasurementTool.getFor(view)
        : AngleMeasurementsTool.getFor(view);
      if (tool) tool.mouseControl.deactivate();
    }

    // Activate the new measure sub-mode if there is one.
    if (next === "measureDistance") {
      const tool = this.demoHelper.openDistanceMeasurements(view);
      tool.mouseControl.activate();
    } else if (next === "measureAngle") {
      const tool = this.demoHelper.openAngleMeasurements(view);
      tool.mouseControl.activate();
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
    if (!view || !this.demoHelper) return;
    const canvas = view.htmlElement;
    const picker = this.demoHelper.picker;

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

  private _activeView(): View | null {
    return this.viewer.viewList[0] ?? null;
  }

  /**
   * Look up the {@link CameraFlightAnimation} the {@link DemoHelper}
   * registered alongside the active View. The flight isn't a
   * property of {@link View} itself — `DemoHelper.createView()`
   * stashes it on `demoHelper.views[viewId].cameraFlight`. Returns
   * `null` when no helper is wired or the active View has no
   * registered flight.
   */
  private _cameraFlight(): { flyTo: (p: any) => void; jumpTo: (p: any) => void } | null {
    const view = this._activeView();
    if (!view || !this.demoHelper) return null;
    const record = (this.demoHelper.views as any)?.[view.id];
    return record?.cameraFlight ?? null;
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

  /**
   * Open a native file picker, sniff the format from the chosen
   * file's extension, then load it through {@link
   * DemoHelper.loadModel}. JSON files are ambiguous between
   * SceneModelParams / DataModelParams / MetaModelParams /
   * CityJSON, so a follow-up format picker prompts the user
   * before the load. Hosts can intercept `importModel` to drive
   * their own importer.
   */
  private _actionImportModel(): void {
    if (this._fireAction("importModel")) return;
    if (!this.demoHelper) {
      console.warn("[Toolbar] importModel — no DemoHelper passed; nothing to load into.");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    // Accept the formats DemoHelper.loadModel knows about. Browsers
    // still let the user override with "All files", so the format
    // sniffer below has to be robust.
    input.accept = [
      ".ifc", ".glb", ".gltf", ".xgf", ".obj", ".mtl",
      ".bim", ".json",
    ].join(",");
    input.style.display = "none";
    document.body.appendChild(input);
    const cleanup = () => { try { input.remove(); } catch { /* ignore */ } };
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      cleanup();
      if (!file) return;
      this._importFile(file);
    }, {once: true});
    // Cancel from the OS picker fires neither change nor cancel
    // on every browser, so a focus-back fallback removes the
    // input rather than leaving it in the DOM.
    window.addEventListener("focus", () => {
      setTimeout(() => { if (!input.files || input.files.length === 0) cleanup(); }, 500);
    }, {once: true});
    input.click();
  }

  /**
   * Resolve `file`'s format and forward to {@link
   * DemoHelper.loadModel}. JSON files trigger the format-picker
   * sub-flyout (CityJSON / SceneModel / DataModel / MetaModel)
   * before the load.
   */
  private async _importFile(file: File): Promise<void> {
    if (!this.demoHelper) return;
    const sniffed = sniffFormatFromName(file.name);
    let format: string | null = sniffed;
    if (sniffed === "json") {
      format = await this._promptJsonFormat();
      if (!format) return;
    }
    if (!format) {
      console.warn(`[Toolbar] importModel — unrecognised file extension: ${file.name}`);
      return;
    }
    const src = URL.createObjectURL(file);
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const modelId = `${baseName}-${Date.now().toString(36)}`;
    try {
      const result = await this.demoHelper.loadModel({src, modelId, format}, {});
      if (result && (result as any).ok === false) {
        console.warn(`[Toolbar] importModel — loader reported error: ${(result as any).error}`);
      }
    } catch (e) {
      console.warn(`[Toolbar] importModel — load failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      URL.revokeObjectURL(src);
    }
  }

  /**
   * Show a centered flyout that asks the user which JSON format
   * the just-picked file represents. Resolves with the chosen
   * `loadModel` format string, or `null` if dismissed.
   */
  private _promptJsonFormat(): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      const flyout = el("div", "xkt-tb-flyout") as HTMLDivElement;
      flyout.setAttribute("role", "menu");
      flyout.style.position = "fixed";
      flyout.style.left = "50%";
      flyout.style.top  = "50%";
      flyout.style.transform = "translate(-50%, -50%)";
      flyout.style.minWidth = "240px";

      const header = el("div", "xkt-tb-flyout-item");
      header.style.fontWeight = "600";
      header.style.color = "#2d5e8c";
      header.style.cursor = "default";
      header.textContent = "Choose JSON format";
      flyout.appendChild(header);

      const items: Array<{ format: string; label: string }> = [
        {format: "scenemodel", label: "SceneModel (geometry)"},
        {format: "datamodel",  label: "DataModel (semantics)"},
        {format: "metamodel",  label: "MetaModel (legacy semantics)"},
        {format: "cityjson",   label: "CityJSON"},
      ];
      let settled = false;
      const finish = (value: string | null) => {
        if (settled) return;
        settled = true;
        flyout.remove();
        window.removeEventListener("pointerdown", outside, true);
        window.removeEventListener("keydown", keydown);
        resolve(value);
      };
      for (const item of items) {
        const row = el("button", "xkt-tb-flyout-item", {
          type: "button",
          role: "menuitem",
        }) as HTMLButtonElement;
        const labelEl = el("span", "xkt-tb-flyout-label");
        labelEl.textContent = item.label;
        row.appendChild(labelEl);
        row.addEventListener("click", (ev) => {
          ev.stopPropagation();
          finish(item.format);
        });
        flyout.appendChild(row);
      }
      const outside = (e: PointerEvent) => {
        const target = e.target as Node;
        if (flyout.contains(target)) return;
        finish(null);
      };
      const keydown = (e: KeyboardEvent) => {
        if (e.key === "Escape") finish(null);
      };
      document.body.appendChild(flyout);
      setTimeout(() => {
        window.addEventListener("pointerdown", outside, true);
        window.addEventListener("keydown", keydown);
      }, 0);
    });
  }

  /**
   * Open the demo's {@link ExportDialog} — the floating panel
   * that pairs the loaded scene/data with each registered
   * exporter and writes a downloadable file. Hosts can intercept
   * `openExport` to substitute their own dialog.
   */
  private _actionExportModel(): void {
    if (this._fireAction("openExport")) return;
    if (!this.demoHelper) {
      console.warn("[Toolbar] openExport — no DemoHelper passed; nothing to export.");
      return;
    }
    this.demoHelper.openExportDialog();
  }

  /**
   * Toggle the demo's {@link ExplorerPanel} — the data-tree
   * browser keyed off the helper's `Data` graph. Hosts that
   * want a different explorer can intercept the `toggleExplorer`
   * action and return `true`.
   */
  private _actionToggleExplorer(): void {
    if (this._fireAction("toggleExplorer")) return;
    if (!this.demoHelper) {
      console.warn("[Toolbar] toggleExplorer — no DemoHelper passed; nothing to toggle.");
      this._setPressed("toggleExplorer", false);
      return;
    }
    const existing = ExplorerPanel.getFor(this.demoHelper.data);
    if (existing && existing.visible) {
      existing.hide();
      this._setPressed("toggleExplorer", false);
      this._bindPanelSync(existing, "toggleExplorer");
      return;
    }
    const panel = this.demoHelper.getExplorer();
    if (!panel) {
      // getExplorer warns and bails when there is no View yet.
      this._setPressed("toggleExplorer", false);
      return;
    }
    this._setPressed("toggleExplorer", panel.visible);
    this._bindPanelSync(panel, "toggleExplorer");
  }

  /**
   * Toggle the demo's {@link ViewsPanel} — the floating list of
   * the Viewer's open Views, with per-row close buttons and a
   * "New View" footer button. Hosts that want a different
   * implementation can intercept the `toggleViews` action and
   * return `true`.
   */
  private _actionToggleViews(): void {
    if (this._fireAction("toggleViews")) return;
    if (!this.demoHelper) {
      console.warn("[Toolbar] toggleViews — no DemoHelper passed; nothing to toggle.");
      this._setPressed("toggleViews", false);
      return;
    }
    const panel = this.demoHelper.toggleViewsPanel();
    this._setPressed("toggleViews", panel.visible);
    this._bindPanelSync(panel, "toggleViews");
  }

  /**
   * Toggle the {@link NavCube} on the active View. The active
   * View is the first entry in {@link Viewer.viewList} (same
   * convention as {@link _applyMeasureMode}). Hosts that want a
   * different selection can intercept `toggleNavCube` and return
   * `true`.
   */
  private _actionToggleNavCube(): void {
    if (this._fireAction("toggleNavCube")) return;
    const view = this._activeView();
    if (!view || !this.demoHelper) {
      console.warn("[Toolbar] toggleNavCube — no active View or no DemoHelper.");
      this._setPressed("toggleNavCube", false);
      return;
    }
    const cube = this.demoHelper.toggleNavCube(view);
    this._setPressed("toggleNavCube", cube.visible);
  }

  /**
   * Toggle the {@link DistanceMeasurementsPanel} on the active
   * View. Mirrors the behaviour of the View-context-menu entry
   * that used to live here.
   */
  private _actionToggleDistancePanel(): void {
    if (this._fireAction("toggleDistancePanel")) return;
    const view = this._activeView();
    if (!view || !this.demoHelper) {
      console.warn("[Toolbar] toggleDistancePanel — no active View or no DemoHelper.");
      this._setPressed("toggleDistancePanel", false);
      return;
    }
    const panel = this.demoHelper.toggleDistanceMeasurementsPanel(view);
    this._setPressed("toggleDistancePanel", panel.visible);
    this._bindPanelSync(panel, "toggleDistancePanel");
  }

  /**
   * Toggle the {@link AngleMeasurementsPanel} on the active
   * View.
   */
  private _actionToggleAnglePanel(): void {
    if (this._fireAction("toggleAnglePanel")) return;
    const view = this._activeView();
    if (!view || !this.demoHelper) {
      console.warn("[Toolbar] toggleAnglePanel — no active View or no DemoHelper.");
      this._setPressed("toggleAnglePanel", false);
      return;
    }
    const panel = this.demoHelper.toggleAngleMeasurementsPanel(view);
    this._setPressed("toggleAnglePanel", panel.visible);
    this._bindPanelSync(panel, "toggleAnglePanel");
  }

  /**
   * Reset View — fly to the scene's overall AABB at a default
   * isometric-ish angle. Uses the DemoHelper's collision index
   * to read the AABB; without it the action is a no-op (warning
   * logged, host can always intercept).
   */
  private _actionResetView(): void {
    if (this._fireAction("resetView")) return;
    const aabb = this._sceneAabb();
    if (!aabb) {
      console.warn("[Toolbar] resetView — no scene AABB available.");
      return;
    }
    const flight = this._cameraFlight();
    if (!flight) {
      console.warn("[Toolbar] resetView — no CameraFlight on the active View.");
      return;
    }
    flight.jumpTo({aabb});
  }

  /**
   * Fly the camera to the scene AABB (animated).
   */
  private _actionFitAll(): void {
    if (this._fireAction("fitAll")) return;
    const aabb = this._sceneAabb();
    if (!aabb) {
      console.warn("[Toolbar] fitAll — no scene AABB available.");
      return;
    }
    const flight = this._cameraFlight();
    if (!flight) {
      console.warn("[Toolbar] fitAll — no CameraFlight on the active View.");
      return;
    }
    flight.flyTo({aabb});
  }

  /**
   * Toggle 2D ↔ 3D — 2D = top-down ortho, 3D = perspective at
   * the saved camera pose. Uses `Camera.projectionType` and
   * (best-effort) sets a top-down `eye`/`look`/`up` when entering
   * 2D.
   */
  private _actionToggle2D3D(): void {
    if (this._fireAction("toggle2D3D")) return;
    const view = this._activeView();
    const camera: any = view && (view as any).camera;
    if (!camera) {
      console.warn("[Toolbar] toggle2D3D — no Camera on the active View.");
      return;
    }
    const wasOrtho = camera.projectionType === OrthoProjectionType;
    camera.projectionType = wasOrtho ? PerspectiveProjectionType : OrthoProjectionType;
    if (!wasOrtho) {
      // Entering 2D → plan view on the scene's AABB centre.
      // Read worldUp so Z-up scenes (the AEC convention) get a
      // top-down look down −Z, while Y-up scenes get the look
      // down −Y. Without the worldUp branch the camera ends up
      // inside the model on Z-up scenes.
      const aabb = this._sceneAabb();
      if (aabb) {
        const cx = (aabb[0] + aabb[3]) * 0.5;
        const cy = (aabb[1] + aabb[4]) * 0.5;
        const cz = (aabb[2] + aabb[5]) * 0.5;
        const sz = Math.max(aabb[3] - aabb[0], aabb[4] - aabb[1], aabb[5] - aabb[2]) || 10;
        const worldUp = (this.viewer.scene as any)?.coordinateSystem?.worldUp;
        const zUp = !!worldUp && Math.abs(worldUp[2] ?? 0) > Math.abs(worldUp[1] ?? 0);
        try {
          if (zUp) {
            // Camera above the centre on +Z, looking down −Z.
            // "up" on screen is world +Y (typical CAD plan view).
            camera.eye  = [cx, cy, cz + sz];
            camera.look = [cx, cy, cz];
            camera.up   = [0, 1, 0];
          } else {
            // Y-up: above on +Y, looking down −Y; up = world +Z
            // so the view aligns with the AABB's other lateral.
            camera.eye  = [cx, cy + sz, cz];
            camera.look = [cx, cy, cz];
            camera.up   = [0, 0, 1];
          }
        } catch { /* setters might be guarded — best-effort */ }
      }
    }
    this._setPressed("toggle2D3D",  !wasOrtho);
    // Keep the perspective/ortho toggle's pressed state in sync —
    // entering 2D also flips projection to ortho.
    this._setPressed("toggleProjection", !wasOrtho);
  }

  /**
   * Toggle camera projection between perspective and ortho —
   * orientation untouched.
   */
  private _actionToggleProjection(): void {
    if (this._fireAction("toggleProjection")) return;
    const view = this._activeView();
    const camera: any = view && (view as any).camera;
    if (!camera) {
      console.warn("[Toolbar] toggleProjection — no Camera on the active View.");
      return;
    }
    const wasOrtho = camera.projectionType === OrthoProjectionType;
    camera.projectionType = wasOrtho ? PerspectiveProjectionType : OrthoProjectionType;
    this._setPressed("toggleProjection", !wasOrtho);
    if (wasOrtho) this._setPressed("toggle2D3D", false);
  }

  /**
   * First-person navigation isn't first-class on the SDK's
   * Camera yet — fire the action through to the host so it can
   * own the wiring (e.g. swap CameraControl modes), and toggle
   * the button's pressed state optimistically.
   */
  private _actionToggleFirstPerson(): void {
    const btn = this._btns["toggleFirstPerson"];
    const next = btn ? btn.getAttribute("aria-pressed") !== "true" : true;
    if (this._fireAction("toggleFirstPerson")) {
      this._setPressed("toggleFirstPerson", next);
      return;
    }
    // No built-in handler — log + still toggle button state so a
    // listening host can pick it up off the next click.
    console.info(`[Toolbar] toggleFirstPerson — host did not handle action; pressed=${next}`);
    this._setPressed("toggleFirstPerson", next);
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
   * Scene's overall AABB, read off the DemoHelper's collision
   * index. Returns `null` when the helper isn't available or the
   * scene has nothing to frame yet.
   */
  private _sceneAabb(): number[] | null {
    if (!this.demoHelper) return null;
    const idx: any = (this.demoHelper as any).collisionIndex;
    if (!idx || typeof idx.getSceneAABB !== "function") return null;
    const aabb = idx.getSceneAABB();
    return aabb ? Array.from(aabb) : null;
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Maps a file's extension to the `format` string {@link
 * DemoHelper.loadModel} understands. Returns `"json"` for any
 * `.json` file (the caller disambiguates between SceneModel /
 * DataModel / MetaModel / CityJSON via {@link Toolbar._promptJsonFormat}),
 * or `null` if the extension is unknown.
 */
function sniffFormatFromName(name: string): string | null {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = lower.slice(dot + 1);
  switch (ext) {
    case "ifc":  return "ifc";
    case "glb":
    case "gltf": return "gltf";
    case "xgf":  return "xgf";
    case "obj":  return "obj";
    case "mtl":  return "mtl";
    case "bim":  return "dotbim";
    case "json": return "json";
    default:     return null;
  }
}



// ─────────────────────────────────────────────────────────────────
// Inline icon library — monochrome SVGs sized 24×24, strokes use
// `currentColor`. CSS scales them to 18×18 inside 32×32 buttons.
// ─────────────────────────────────────────────────────────────────

const ICONS = {
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

  // Hierarchy / sitemap — root box on top with three child boxes.
  explorer:
    `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="9"  y="3"  width="6" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<rect x="3"  y="16" width="6" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<rect x="9"  y="16" width="6" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<rect x="15" y="16" width="6" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<path d="M12 7 L12 12 M6 16 L6 12 L18 12 L18 16" fill="none" stroke="currentColor" stroke-width="1.6"/>` +
    `</svg>`,

  // Stack of three frames — Views panel.
  views:
    `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="3.5" y="4.5"  width="17" height="4" rx="1" ` +
        `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<rect x="3.5" y="10"   width="17" height="4" rx="1" ` +
        `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<rect x="3.5" y="15.5" width="17" height="4" rx="1" ` +
        `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
    `</svg>`,

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
