/**
 * Floating, draggable, closeable panel that manages
 * wireframe-projection "drawing" SceneModels for every other
 * SceneModel currently loaded in the Scene.
 *
 * For each loaded SceneModel that isn't one of the panel's own
 * projection outputs, the panel offers per-view toggles (plan +
 * front + right elevation by default, plus optional back / left
 * / bottom), a hidden-line-elimination toggle, and an offset
 * slider. Toggling any control rebuilds that model's projection
 * set in place; closing the panel or destroying its source
 * SceneModel tears the projections down.
 *
 * The panel filters its own output out of the candidate list by
 * tracking each projection's target SceneModel id in
 * {@link _ownedProjectionIds} — so projection SceneModels never
 * recurse into projections of themselves.
 *
 * Same chrome / lifecycle as the sister panels: per-DemoHelper
 * WeakMap registry, idempotent `getFor` / `openFor`, drag
 * header, close button + reopen pill, layout persistence,
 * scoped `xkt-bp-` CSS prefix.
 *
 * @module demo/drawings
 */
import type {SceneModel} from "../../../model/scene";
import type {DemoHelper} from "../../DemoHelper";

import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";
import {
  canBuildDrawing,
  clearDrawing,
  buildDrawing,
  type DrawingProjectionFace,
} from "../../../presentations/drawings";


// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface DrawingsPanelParams {
  /**
   * DemoHelper whose Scene the panel manages drawings for.
   * Doubles as the WeakMap key for {@link DrawingsPanel.openFor}
   * idempotence — one panel per helper.
   */
  demoHelper: DemoHelper;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed
   * state. Defaults to `"xkt-bp-panel"`.
   */
  storageKey?: string;

  /** Show on construction (default `true`). */
  visible?: boolean;
}


/** A user-facing view label paired with the projector face name. */
interface ViewSpec {
  /** Short label shown in the UI and used as the config key. */
  label: string;
  /** Description shown in tooltips. */
  description: string;
  /** Projector face — the `+/− axis` direction in the source model. */
  face: DrawingProjectionFace;
  /** Whether this view is enabled by default when drawings are first turned on. */
  defaultOn: boolean;
}


interface DrawingConfig {
  enabled: boolean;
  /** Per-view enable map, keyed by `ViewSpec.label`. */
  views: Record<string, boolean>;
  hle: boolean;
  offset: number;
  frameMargin: number;
  /**
   * Pixel thickness for the projection's line meshes (wireframe
   * + frame border). `0` means "fall back to the View's
   * `linesMaterial.lineWidth`".
   */
  lineWidth: number;
  /**
   * Output style: `false` (default) emits wireframe line meshes
   * with optional HLE; `true` emits filled-silhouette triangle
   * meshes (one TrianglesPrimitive per source SceneObject, with
   * hidden-surface removal from the same depth buffer the
   * wireframe path would use).
   */
  solid: boolean;
  /**
   * Effective output resolution (along the longer of u, v) for
   * the depth/owner buffer that drives both HLE clipping and
   * fill-silhouette tracing. 2048 → ~5 mm/pixel on a 10 m model;
   * 4096 → ~2.5 mm/pixel, 8192 → ~1.2 mm/pixel.
   */
  resolution: number;
  /**
   * Per-tile pixel size for the fill extractor. Memory peaks at
   * `O(tileSize²)` regardless of `resolution`, so leaving this
   * below `resolution` is what makes very-high-resolution
   * drawings affordable.
   */
  tileSize: number;
  /**
   * When true, a cut-away clip plane perpendicular to the
   * projection direction is applied at {@link clipDepth}
   * (basis-d coordinate). Anything closer to the camera than
   * the plane is dropped from the drawing.
   */
  clipEnabled: boolean;
  /**
   * Basis-d coordinate of the clip plane in world units along
   * `basis.forward`. For face-aligned views, this means: top
   * view (forward = -worldUp), `clipDepth` is the negated world-up
   * coordinate of the cut; bottom view, the world-up coord
   * directly; front/back/left/right, the signed world coord
   * along the camera-look direction.
   */
  clipDepth: number;
}


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-bp-styles";
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
.xkt-bp-panel {
  position: fixed;
  top: 88px;
  right: 17px;
  width: 520px;
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
.xkt-bp-panel *, .xkt-bp-panel *::before, .xkt-bp-panel *::after {
  box-sizing: border-box;
}
.xkt-bp-panel[hidden] { display: none; }

.xkt-bp-panel .xkt-bp-header {
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
.xkt-bp-panel .xkt-bp-header.xkt-bp-dragging { cursor: grabbing; }
.xkt-bp-panel .xkt-bp-title {
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
.xkt-bp-panel .xkt-bp-title-icon {
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
.xkt-bp-panel .xkt-bp-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-bp-panel .xkt-bp-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-bp-panel .xkt-bp-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-bp-panel .xkt-bp-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
.xkt-bp-panel .xkt-bp-close {
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
.xkt-bp-panel .xkt-bp-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-bp-pill {
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
.xkt-bp-pill:hover { background: #1f4669; }
.xkt-bp-pill[hidden] { display: none; }

.xkt-bp-panel .xkt-bp-body {
  flex: 1 1 auto;
  overflow: auto;
  padding: 4px 0 8px;
}

.xkt-bp-panel .xkt-bp-empty {
  padding: 24px 14px;
  text-align: center;
  color: #94a3b8;
  font-style: italic;
}

.xkt-bp-panel .xkt-bp-row {
  border-top: 1px solid #f1f5f9;
  padding: 10px 14px;
}
.xkt-bp-panel .xkt-bp-row:first-child {
  border-top: none;
}
.xkt-bp-panel .xkt-bp-row-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.xkt-bp-panel .xkt-bp-row-name {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11.5px;
  color: #111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-bp-panel .xkt-bp-master-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: #2d5e8c;
  cursor: pointer;
  user-select: none;
}

.xkt-bp-panel .xkt-bp-row-detail {
  margin-top: 8px;
  padding: 8px 10px;
  background: #f8fafc;
  border: 1px solid #ececec;
  border-radius: 8px;
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 12px;
  align-items: center;
  font-size: 11px;
}
.xkt-bp-panel .xkt-bp-row-detail .xkt-bp-detail-label {
  color: #475569;
  font-weight: 600;
  letter-spacing: 0.2px;
  text-transform: uppercase;
  font-size: 10px;
}
.xkt-bp-panel .xkt-bp-views-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
}
.xkt-bp-panel .xkt-bp-view-check {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #1f2937;
  cursor: pointer;
  user-select: none;
}
.xkt-bp-panel input[type="checkbox"] {
  accent-color: #2d5e8c;
  cursor: pointer;
}
.xkt-bp-panel .xkt-bp-num {
  width: 64px;
  padding: 3px 6px;
  font: inherit;
  font-size: 11px;
  border: 1px solid #d0d7de;
  border-radius: 5px;
  background: #fff;
}
.xkt-bp-panel .xkt-bp-num:focus {
  outline: none;
  border-color: #2d5e8c;
  box-shadow: 0 0 0 2px rgba(45, 94, 140, 0.18);
}
.xkt-bp-panel .xkt-bp-row[data-disabled="1"] .xkt-bp-row-detail {
  /* Visual cue only — controls stay interactive so the user
     can configure a drawing *before* toggling "Generate" on. */
  opacity: 0.65;
}
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

export class DrawingsPanel extends FloatingPanelBase {

  /**
   * Per-DemoHelper instance registry. One panel per helper.
   * WeakMap so a helper that gets dropped doesn't keep the panel
   * alive for GC.
   */
  private static readonly _instances = new WeakMap<DemoHelper, DrawingsPanel>();

  /**
   * SVG markup for the panel's title-bar glyph — three stacked
   * rectangles suggesting a folded drawing sheet. Strokes use
   * `currentColor`.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="3.5" y="4"  width="14" height="11" rx="1" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<rect x="5.5" y="6"  width="14" height="11" rx="1" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" opacity="0.55"/>` +
      `<rect x="7.5" y="8"  width="14" height="11" rx="1" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" opacity="0.85"/>` +
      `<path d="M9 12 H17 M9 14.5 H15 M9 17 H17" ` +
            `fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.7"/>` +
    `</svg>`;
  }

  static getFor(demoHelper: DemoHelper): DrawingsPanel | undefined {
    const inst = DrawingsPanel._instances.get(demoHelper);
    return inst && !inst._destroyed ? inst : undefined;
  }

  /**
   * Returns `true` when `modelId` matches the panel's drawing
   * target-id pattern (`{srcId}__bp_{viewLabel}`). Used to filter
   * candidate source SceneModels — drawings, including ones
   * left over from a previous panel instance or produced
   * directly through `buildDrawing(...)` with the panel's
   * id convention, never reappear as something the user can
   * project from.
   */
  static isDrawingModelId(modelId: string): boolean {
    return DRAWING_ID_PATTERN.test(modelId);
  }

  static openFor(params: DrawingsPanelParams): DrawingsPanel {
    let inst = DrawingsPanel._instances.get(params.demoHelper);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new DrawingsPanel(params);
    return inst;
  }

  readonly demoHelper: DemoHelper;

  /**
   * View specs derived once from the Scene's world coordinate
   * system so the panel offers the right axis mapping for both
   * Z-up and Y-up worlds.
   */
  private readonly _viewSpecs: ViewSpec[];

  /** Per-source-SceneModel config, keyed by source model id. */
  private readonly _configs = new Map<string, DrawingConfig>();

  /**
   * Set of projection-SceneModel ids the panel has produced. The
   * onSceneModelCreated subscription filters these out so the
   * panel never tries to project drawings of its own
   * drawings. The set also bounds {@link clearAll} on destroy
   * so we tear down exactly what we created.
   */
  private readonly _ownedProjectionIds = new Set<string>();

  private _bodyEl!: HTMLElement;
  private readonly _unsubs: Array<() => void> = [];

  constructor(params: DrawingsPanelParams) {
    if (!params?.demoHelper) {
      throw new Error("DrawingsPanel: demoHelper is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-bp-panel",
      classPrefix: "xkt-bp",
    });
    this.demoHelper = params.demoHelper;
    this._viewSpecs = computeViewSpecs(this.demoHelper);

    const prior = DrawingsPanel._instances.get(this.demoHelper);
    if (prior && !prior._destroyed) prior.destroy();
    DrawingsPanel._instances.set(this.demoHelper, this);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();
    this._attachSubscriptions();
    this._renderBody();

    if (params.visible === false) this.hide(); else this.show();
  }


  // ── Public lifecycle ──────────────────────────────────────────

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
    // Tear down every projection SceneModel we ever produced —
    // closing the panel shouldn't leave orphan drawings
    // hanging around the Scene.
    for (const id of this._ownedProjectionIds) {
      clearDrawing(this.demoHelper.scene.models?.[id]);
    }
    this._ownedProjectionIds.clear();
    this._configs.clear();
    for (const u of this._unsubs) {
      try { u(); } catch { /* ignore */ }
    }
    this._unsubs.length = 0;
    if (DrawingsPanel._instances.get(this.demoHelper) === this) {
      DrawingsPanel._instances.delete(this.demoHelper);
    }
    super.destroy();
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-bp-pill", {
      type: "button",
      title: "Reopen Drawings",
      hidden: true,
      textContent: "Drawings",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-bp-panel");

    this._header = el("div", "xkt-bp-header");
    const title = el("h2", "xkt-bp-title");
    title.innerHTML =
      `<span class="xkt-bp-title-icon">${DrawingsPanel.iconSvg()}</span>` +
      `<span class="xkt-bp-title-stack">` +
        `<span class="xkt-bp-title-text">Drawings</span>` +
        `<span class="xkt-bp-subtitle">Ortho wireframe plan + elevations.</span>` +
      `</span>`;

    this._closeBtn = el("button", "xkt-bp-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;

    this._header.append(title, this._closeBtn);
    this._panel.appendChild(this._header);

    this._bodyEl = el("div", "xkt-bp-body");
    this._panel.appendChild(this._bodyEl);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }


  // ── Scene subscriptions ───────────────────────────────────────

  private _attachSubscriptions(): void {
    const sceneEv = (this.demoHelper.scene as any).events;
    if (!sceneEv) return;
    const sub = (unsub: () => void) => this._unsubs.push(unsub);

    // Re-render the list whenever a non-owned SceneModel is
    // created. Ignore creations of our own projection outputs
    // so we don't recurse into projections-of-projections.
    if (sceneEv.onSceneModelCreated?.subscribe) {
      sub(sceneEv.onSceneModelCreated.subscribe((_: unknown, model: SceneModel) => {
        if (this._ownedProjectionIds.has(model.id)) return;
        if (DrawingsPanel.isDrawingModelId(model.id)) return;
        this._renderBody();
      }));
    }
    if (sceneEv.onSceneModelDestroyed?.subscribe) {
      sub(sceneEv.onSceneModelDestroyed.subscribe((_: unknown, model: SceneModel) => {
        if (this._ownedProjectionIds.has(model.id)) {
          // One of our projections was destroyed externally —
          // forget the id so a re-enable can reuse it.
          this._ownedProjectionIds.delete(model.id);
          return;
        }
        if (DrawingsPanel.isDrawingModelId(model.id)) {
          // External drawing vanished — nothing for the panel
          // to do; it never offered the source row anyway.
          return;
        }
        // Source SceneModel went away — tear down its projections
        // and forget its config.
        this._teardown(model.id);
        this._configs.delete(model.id);
        this._renderBody();
      }));
    }
  }


  // ── Rendering ─────────────────────────────────────────────────

  private _renderBody(): void {
    this._bodyEl.replaceChildren();

    const sourceModels = this._listSourceModels();
    if (sourceModels.length === 0) {
      this._bodyEl.appendChild(el("div", "xkt-bp-empty", {
        textContent: "No SceneModels loaded.",
      }));
      return;
    }

    for (const model of sourceModels) {
      this._bodyEl.appendChild(this._renderModelRow(model));
    }
  }

  /**
   * Every SceneModel currently in the Scene, *excluding* the
   * projection SceneModels we built ourselves. The filter is
   * the panel's correctness guarantee — without it, listing
   * projections back in this panel would let the user recurse
   * into projections-of-projections.
   */
  private _listSourceModels(): SceneModel[] {
    const out: SceneModel[] = [];
    const models = (this.demoHelper.scene as any).models as Record<string, SceneModel>;
    if (!models) return out;
    for (const id of Object.keys(models)) {
      if (this._ownedProjectionIds.has(id)) continue;
      // Skip SceneModels that match the panel's own drawing
      // id pattern, regardless of whether *this* panel instance
      // created them. Covers drawings left over from a prior
      // panel session or generated by a direct call to
      // `buildDrawing(...)` with the panel's id convention.
      if (DrawingsPanel.isDrawingModelId(id)) continue;
      out.push(models[id]);
    }
    return out;
  }

  private _renderModelRow(model: SceneModel): HTMLElement {
    const row = el("div", "xkt-bp-row");
    const cfg = this._getOrInitConfig(model.id);
    row.dataset.disabled = cfg.enabled ? "0" : "1";

    // ── Header line: id + master enable ──
    const head = el("div", "xkt-bp-row-head");
    const name = el("span", "xkt-bp-row-name", {
      textContent: model.id,
      title: model.id,
    });
    const masterLabel = el("label", "xkt-bp-master-label");
    const masterCb = el("input") as HTMLInputElement;
    masterCb.type = "checkbox";
    masterCb.checked = cfg.enabled;
    masterCb.addEventListener("change", () => {
      cfg.enabled = masterCb.checked;
      row.dataset.disabled = cfg.enabled ? "0" : "1";
      this._apply(model.id);
    });
    masterLabel.append(masterCb, document.createTextNode("Generate"));
    head.append(name, masterLabel);
    row.appendChild(head);

    // ── Detail grid: views, HLE, offset ──
    const detail = el("div", "xkt-bp-row-detail");

    detail.appendChild(el("div", "xkt-bp-detail-label", {textContent: "Views"}));
    const viewsCell = el("div", "xkt-bp-views-cell");
    for (const spec of this._viewSpecs) {
      const viewLabel = el("label", "xkt-bp-view-check");
      const viewCb = el("input") as HTMLInputElement;
      viewCb.type = "checkbox";
      viewCb.checked = !!cfg.views[spec.label];
      viewCb.title = spec.description;
      viewCb.addEventListener("change", () => {
        cfg.views[spec.label] = viewCb.checked;
        this._apply(model.id);
      });
      viewLabel.append(viewCb, document.createTextNode(spec.label));
      viewsCell.appendChild(viewLabel);
    }
    detail.appendChild(viewsCell);

    detail.appendChild(el("div", "xkt-bp-detail-label", {textContent: "Style"}));
    const styleCell = el("div");
    const solidLabel = el("label", "xkt-bp-view-check");
    const solidCb = el("input") as HTMLInputElement;
    solidCb.type = "checkbox";
    solidCb.checked = cfg.solid;
    solidCb.title = "Emit filled triangle silhouettes (with hidden-surface removal) instead of wireframe lines.";
    solidCb.addEventListener("change", () => {
      cfg.solid = solidCb.checked;
      this._apply(model.id);
    });
    solidLabel.append(solidCb, document.createTextNode("Solid fill (instead of wireframe)"));
    styleCell.appendChild(solidLabel);
    detail.appendChild(styleCell);

    detail.appendChild(el("div", "xkt-bp-detail-label", {textContent: "HLE"}));
    const hleLabel = el("label", "xkt-bp-view-check");
    const hleCb = el("input") as HTMLInputElement;
    hleCb.type = "checkbox";
    hleCb.checked = cfg.hle;
    hleCb.title = "Hidden-line elimination — drop edges occluded by the source geometry. Applies in wireframe mode only.";
    hleCb.addEventListener("change", () => {
      cfg.hle = hleCb.checked;
      this._apply(model.id);
    });
    hleLabel.append(hleCb, document.createTextNode("Hide occluded edges"));
    detail.appendChild(hleLabel);

    detail.appendChild(el("div", "xkt-bp-detail-label", {textContent: "Offset"}));
    const offsetCell = el("div");
    const offsetInput = el("input", "xkt-bp-num") as HTMLInputElement;
    offsetInput.type = "number";
    offsetInput.min = "0";
    offsetInput.step = "0.5";
    offsetInput.value = String(cfg.offset);
    offsetInput.addEventListener("change", () => {
      const n = Number(offsetInput.value);
      if (!Number.isFinite(n) || n < 0) {
        offsetInput.value = String(cfg.offset);
        return;
      }
      cfg.offset = n;
      this._apply(model.id);
    });
    offsetCell.append(offsetInput, document.createTextNode(" world units"));
    detail.appendChild(offsetCell);

    detail.appendChild(el("div", "xkt-bp-detail-label", {textContent: "Line width"}));
    const lineWidthCell = el("div");
    const lineWidthInput = el("input", "xkt-bp-num") as HTMLInputElement;
    lineWidthInput.type = "number";
    lineWidthInput.min = "0";
    lineWidthInput.step = "0.5";
    lineWidthInput.value = String(cfg.lineWidth);
    lineWidthInput.title = "Pixel thickness for the projected lines. 0 = use View default.";
    lineWidthInput.addEventListener("change", () => {
      const n = Number(lineWidthInput.value);
      if (!Number.isFinite(n) || n < 0) {
        lineWidthInput.value = String(cfg.lineWidth);
        return;
      }
      cfg.lineWidth = n;
      this._apply(model.id);
    });
    lineWidthCell.append(lineWidthInput, document.createTextNode(" px"));
    detail.appendChild(lineWidthCell);

    detail.appendChild(el("div", "xkt-bp-detail-label", {textContent: "Resolution"}));
    const resCell = el("div");
    const resInput = el("input", "xkt-bp-num") as HTMLInputElement;
    resInput.type = "number";
    resInput.min = "256";
    resInput.step = "256";
    resInput.value = String(cfg.resolution);
    resInput.title = "Depth-buffer resolution along the longer (u, v) axis. Drives both HLE clipping precision and fill-silhouette crispness — higher = sharper, scales linearly in tile work.";
    resInput.addEventListener("change", () => {
      const n = Number(resInput.value);
      if (!Number.isFinite(n) || n < 16) {
        resInput.value = String(cfg.resolution);
        return;
      }
      cfg.resolution = n;
      this._apply(model.id);
    });
    resCell.append(resInput, document.createTextNode(" px"));
    detail.appendChild(resCell);

    detail.appendChild(el("div", "xkt-bp-detail-label", {textContent: "Tile size"}));
    const tileCell = el("div");
    const tileInput = el("input", "xkt-bp-num") as HTMLInputElement;
    tileInput.type = "number";
    tileInput.min = "0";
    tileInput.step = "256";
    tileInput.value = String(cfg.tileSize);
    tileInput.title = "Per-tile pixel size for the fill extractor. Memory peaks at O(tileSize²) regardless of resolution. 0 = no tiling (single full-resolution buffer, peaks at O(resolution²)).";
    tileInput.addEventListener("change", () => {
      const n = Number(tileInput.value);
      if (!Number.isFinite(n) || n < 0) {
        tileInput.value = String(cfg.tileSize);
        return;
      }
      cfg.tileSize = n;
      this._apply(model.id);
    });
    tileCell.append(tileInput, document.createTextNode(" px"));
    detail.appendChild(tileCell);

    detail.appendChild(el("div", "xkt-bp-detail-label", {textContent: "Clip"}));
    const clipCell = el("div");
    const clipLabel = el("label", "xkt-bp-view-check");
    const clipCb = el("input") as HTMLInputElement;
    clipCb.type = "checkbox";
    clipCb.checked = cfg.clipEnabled;
    clipCb.title = "Cut-away the projection at a plane perpendicular to the viewing direction. Everything closer to the camera than the plane is dropped.";
    clipCb.addEventListener("change", () => {
      cfg.clipEnabled = clipCb.checked;
      clipDepthInput.disabled = !cfg.clipEnabled;
      this._apply(model.id);
    });
    clipLabel.append(clipCb, document.createTextNode("Cut-away"));
    const clipDepthInput = el("input", "xkt-bp-num") as HTMLInputElement;
    clipDepthInput.type = "number";
    clipDepthInput.step = "0.5";
    clipDepthInput.value = String(cfg.clipDepth);
    clipDepthInput.disabled = !cfg.clipEnabled;
    clipDepthInput.title = "Basis-d coordinate of the clip plane along the camera-look direction.";
    clipDepthInput.addEventListener("change", () => {
      const n = Number(clipDepthInput.value);
      if (!Number.isFinite(n)) {
        clipDepthInput.value = String(cfg.clipDepth);
        return;
      }
      cfg.clipDepth = n;
      if (cfg.clipEnabled) this._apply(model.id);
    });
    clipCell.append(clipLabel, document.createTextNode(" @ "), clipDepthInput);
    detail.appendChild(clipCell);

    row.appendChild(detail);
    return row;
  }


  // ── Config + projection management ────────────────────────────

  private _getOrInitConfig(modelId: string): DrawingConfig {
    let cfg = this._configs.get(modelId);
    if (cfg) return cfg;
    const views: Record<string, boolean> = {};
    for (const spec of this._viewSpecs) {
      views[spec.label] = spec.defaultOn;
    }
    cfg = {
      enabled: false,
      views,
      hle: true,
      offset: 2,
      frameMargin: 1.5,
      lineWidth: 3,
      solid: true,
      resolution: 2048,
      tileSize: 1024,
      clipEnabled: false,
      clipDepth: 0,
    };
    this._configs.set(modelId, cfg);
    return cfg;
  }

  /**
   * Apply (or re-apply) the saved config for one source model:
   * tear down any existing projections we own for it, then
   * rebuild based on the current enabled-views set. No-op when
   * the source model has been destroyed in the meantime.
   */
  private async _apply(modelId: string): Promise<void> {
    this._teardown(modelId);
    const cfg = this._configs.get(modelId);
    if (!cfg || !cfg.enabled) return;
    const models = (this.demoHelper.scene as any).models as Record<string, SceneModel>;
    const sourceModel = models?.[modelId];
    if (!sourceModel) return;

    // Skip silently when there's nothing the projector could
    // emit in the chosen style — e.g. solid mode on a model
    // with no indexed triangle geometry, or wireframe mode on
    // a model whose triangle geometries have no edgeIndices.
    // Without this guard, buildDrawing would build and
    // destroy one empty target SceneModel per view and log a
    // misleading "no projectable edges or fills" warning.
    const requiredMode: "lines" | "fill" = cfg.solid ? "fill" : "lines";
    if (!canBuildDrawing(sourceModel, requiredMode)) return;

    for (const spec of this._viewSpecs) {
      if (!cfg.views[spec.label]) continue;
      const targetId = projectionTargetId(modelId, spec.label);
      // Two mutually-exclusive output styles: wireframe lines
      // (with optional HLE) or filled silhouette triangles
      // (with HSR baked in). The per-model "Solid fill" toggle
      // picks one and the projection gets either lines or fills
      // — never both — to keep the drawing look consistent
      // per source model.
      const styleParams = cfg.solid
        ? {
            // Solid mode: opaque per-source-mesh silhouettes
            // with hidden-surface removal baked in. Per-pixel
            // ownership is rasterised tile-by-tile inside the
            // fill extractor, so `cfg.resolution` can scale
            // freely while peak memory stays bounded by
            // `cfg.tileSize` (set to 0 for un-tiled).
            lines: false as const,
            fill: {
              opacity:    1.0,
              resolution: cfg.resolution,
              tileSize:   cfg.tileSize,
            },
          }
        : {
            // Wireframe mode: line work only, HLE optional.
            // HLE samples a full-resolution depth buffer at
            // `cfg.resolution` to drop edges occluded by other
            // source geometry.
            hideHidden: cfg.hle
              ? {samples: 7, tolerance: 0.02, resolution: cfg.resolution}
              : false,
          };
      // Create the target SceneModel up front so we own its
      // lifecycle — buildDrawing now populates a caller-supplied
      // target rather than creating one itself. Eagerly add the
      // id to `_ownedProjectionIds` so a concurrent teardown
      // (e.g. the user toggling "Generate" off while an earlier
      // _apply is still streaming objects in) destroys our
      // in-flight target via `clearDrawing`. The projector
      // notices target.destroyed at its next yield and returns
      // an error which we silently drop.
      const targetResult = this.demoHelper.scene.createModel({id: targetId});
      if (targetResult.ok === false) {
        console.warn(`[DrawingsPanel] createModel(${targetId}) failed:`, targetResult.error);
        continue;
      }
      const targetModel = targetResult.value;
      this._ownedProjectionIds.add(targetId);
      const result = await buildDrawing({
        sourceModel,
        targetModel,
        direction:     spec.face,
        offset:        cfg.offset,
        color:         [0.05, 0.25, 0.85],
        frame:         cfg.frameMargin,
        frameColor:    [0.05, 0.25, 0.85],
        panel:         {color: [0.96, 0.97, 0.99], opacity: 0.55},
        ...styleParams,
        ...(cfg.lineWidth > 0 ? {lineWidth: cfg.lineWidth} : {}),
        // Park every emitted SceneObject on a dedicated
        // "drawings" ViewLayer so the default layer stays
        // clear for the source SceneModels the panel projects.
        layerId: "drawings",
        // Yield to the renderer between batches so the drawing
        // paints progressively instead of locking up the UI on
        // models with thousands of source objects.
        progressive: true,
        // Optional cut-away plane perpendicular to the view
        // direction at `cfg.clipDepth` basis-d coordinate.
        ...(cfg.clipEnabled ? {clip: {depth: cfg.clipDepth}} : {}),
      });
      if (result.ok === false) {
        // Mid-flight teardown by a concurrent _apply is expected
        // (the projector's `target.destroyed` check fires after
        // each yield); only warn for genuine failures. Don't
        // touch `_ownedProjectionIds` here — a concurrent _apply
        // may already have re-claimed the same id with a fresh
        // SceneModel, and the next teardown for this model will
        // sweep stale ids via the no-op `clearDrawing` path.
        if (!result.error.includes("destroyed mid-projection")) {
          console.warn(`[DrawingsPanel] buildDrawing(${targetId}) failed:`, result.error);
        }
        // buildDrawing no longer destroys the target on failure;
        // we own that here. Tear down any partial state so we
        // don't leak an empty SceneModel.
        clearDrawing(targetModel);
        continue;
      }
    }
  }

  /**
   * Destroy every projection SceneModel the panel produced for
   * `modelId`. Idempotent — quietly skips ids that have already
   * been destroyed (e.g. by the user via the Models panel).
   */
  private _teardown(modelId: string): void {
    for (const spec of this._viewSpecs) {
      const targetId = projectionTargetId(modelId, spec.label);
      if (!this._ownedProjectionIds.has(targetId)) continue;
      clearDrawing(this.demoHelper.scene.models?.[targetId]);
      this._ownedProjectionIds.delete(targetId);
    }
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Compose the SceneModel id of a single projection. Stable
 * across runs so the panel's filter set repopulates correctly
 * after a hot reload.
 */
function projectionTargetId(modelId: string, viewLabel: string): string {
  return `${modelId}__bp_${viewLabel.toLowerCase().replace(/\s+/g, "_")}`;
}

/**
 * Regex matching any SceneModel id the panel could ever emit
 * as a projection target. Used by {@link
 * DrawingsPanel.isDrawingModelId} to filter drawings out
 * of the candidate source list, regardless of which panel
 * instance created them.
 */
const DRAWING_ID_PATTERN = /__bp_[a-z0-9_]+$/;

/**
 * Derive the view-spec list from the Scene's world up axis.
 * Z-up worlds get `Plan` mapped to the projector's `+Z` face;
 * Y-up worlds get it mapped to `+Y`. The two elevation faces
 * (`Front` / `Right`) follow the same convention so the panel
 * works without per-axis configuration from the caller.
 */
function computeViewSpecs(demoHelper: DemoHelper): ViewSpec[] {
  const cs = (demoHelper.scene as any)?.coordinateSystem;
  const worldUp = cs?.worldUp;
  // Default to Y-up if we can't read the world up vector.
  const upZ = !!worldUp && Math.abs(worldUp[2]) > 0.9;
  if (upZ) {
    return [
      {label: "Plan",  description: "Top-down plan view (+Z)",       face: "back",   defaultOn: true},
      {label: "Front", description: "Front elevation (−Y)",          face: "bottom", defaultOn: true},
      {label: "Right", description: "Right elevation (+X)",          face: "right",  defaultOn: true},
      {label: "Back",  description: "Back elevation (+Y)",           face: "top",    defaultOn: false},
      {label: "Left",  description: "Left elevation (−X)",           face: "left",   defaultOn: false},
    ];
  }
  return [
    {label: "Plan",  description: "Top-down plan view (+Y)",       face: "top",    defaultOn: true},
    {label: "Front", description: "Front elevation (−Z)",          face: "front",  defaultOn: true},
    {label: "Right", description: "Right elevation (+X)",          face: "right",  defaultOn: true},
    {label: "Back",  description: "Back elevation (+Z)",           face: "back",   defaultOn: false},
    {label: "Left",  description: "Left elevation (−X)",           face: "left",   defaultOn: false},
  ];
}
