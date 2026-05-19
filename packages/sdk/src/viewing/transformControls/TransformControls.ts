import {
  createMat4Float64,
  decomposeMat4,
  identityMat4,
  inverseMat4,
  type Mat4,
  mulMat4,
  transformPoint4,
  translationMat4v,
} from "../../base/math/matrix";
import {
  addVec3,
  createVec3Float64,
  createVec4Float64,
  cross3Vec3,
  dotVec3,
  lenVec3,
  mulVec3Scalar,
  normalizeVec3,
  subVec3,
  type Vec3,
  type Vec4,
} from "../../base/math/vector";
import {angleAxisToQuaternion, type Quat, quatToMat4} from "../../base/math/quat";
import type {SceneMesh, SceneModel, SceneObject} from "../../model/scene";
import type {PickStrategy} from "../../spatial/picking";
import type {View} from "../viewer/View";
import type {ViewController} from "../viewController";
import type {ViewLayer} from "../viewer/ViewLayer";
import {buildGeometry, type BuiltGeometry} from "./internal/buildGeometry";
import {COLOR_HIGHLIGHT} from "./internal/colors";
import {
  ALL_HANDLES, axisOf,
  HELPER_IDS, helpersForAxis,
  R_E, R_X, R_XYZE, R_Y, R_Z,
  ROTATE_HANDLES,
  S_X, S_XY, S_XYZ, S_XZ, S_Y, S_YZ, S_Z,
  SCALE_HANDLES,
  T_X, T_XY, T_XYZ, T_XZ, T_Y, T_YZ, T_Z,
  TRANSLATE_HANDLES,
} from "./internal/handleIds";
import {TransformControlsEvents} from "./TransformControlsEvents";
import type {TransformControlsAxis} from "./TransformControlsAxis";
import type {TransformControlsMode} from "./TransformControlsMode";
import type {TransformControlsParams} from "./TransformControlsParams";
import type {TransformControlsSpace} from "./TransformControlsSpace";
import type {TransformControlsTarget} from "./TransformControlsTarget";

const X_AXIS: Vec3 = [1, 0, 0];
const Y_AXIS: Vec3 = [0, 1, 0];
const Z_AXIS: Vec3 = [0, 0, 1];

interface NormalisedTarget {
  /**
   * Returns the primary backing matrix in world space — for a
   * SceneObject group this is the first live mesh's world matrix,
   * for a single SceneMesh it's that mesh's world matrix, for an
   * adapter target it's whatever the adapter returns. Read on
   * every `_syncTransform` call so the gizmo can extract a
   * "local-space" rotation when needed.
   */
  getPrimaryMatrix(): Mat4;
  /**
   * Captures the current world matrix of every backing source so
   * subsequent {@link applyTransform} calls during a drag are
   * always evaluated against the moment of pointer-down — the
   * usual single-snapshot drag model, but generalised to N
   * matrices for SceneObject groups.
   */
  snapshot(): void;
  /**
   * Pre-multiplies `worldTransform` against every snapshotted
   * matrix and writes the result back to each source. Equivalent
   * to `newWorld_i = worldTransform × startWorld_i` for each
   * backing mesh; the entire object moves / rotates / scales as
   * one group.
   */
  applyTransform(worldTransform: Mat4): void;
  /**
   * Optional ownership check. Returns true when the destroyed
   * SceneMesh is the one currently driving this target — used by
   * the scene-destroy handler to decide whether to react.
   * Omitted for adapter targets (no lifecycle).
   */
  involves?: (mesh: SceneMesh) => boolean;
  /**
   * Optional re-resolution hook. Returns true if a live mesh
   * remains under this target after re-walking the source; false
   * if the target has lost its last mesh and should be detached.
   * For SceneObject targets this picks a new primary mesh; for
   * SceneMesh targets it just reports the current destroyed state.
   */
  refresh?: () => boolean;
  /**
   * Optional debug hook — returns the translation column of each
   * snapshotted matrix in world space, in the same order as
   * `applyTransform` writes them. Surfaced through
   * {@link TransformControls.setDebug | setDebug} logging so
   * "this mesh isn't moving" bugs become visible without poking
   * at private fields.
   */
  getStartTranslations?: () => Array<[number, number, number]>;
}

/**
 * Interactive transform gizmo for a {@link viewing!viewer.View | View}.
 *
 * Attaches to a {@link model!scene.SceneObject | SceneObject},
 * {@link model!scene.SceneMesh | SceneMesh}, or matrix adapter, and
 * lets the user translate, rotate, or scale the target through axis
 * arrows, plane handles, rotation rings, and a view-aligned trackball.
 *
 * The rig is built into a dedicated
 * {@link viewing!viewer.ViewLayer | ViewLayer} and
 * {@link model!scene.SceneModel | SceneModel} created in the supplied
 * view's scene, so it does not interfere with the host scene's objects
 * or visibility state. Handles render through an overlay bin
 * (depth-cleared, depth-test always-pass) so they float over host
 * geometry regardless of where the target sits in world space.
 *
 * ## Modes
 *
 * - {@link setMode | setMode("translate")} — drag axis arrows, plane
 *   handles, or the centre cube.
 * - {@link setMode | setMode("rotate")} — drag axis rings, the
 *   view-aligned `E` ring, or the `XYZE` trackball.
 * - {@link setMode | setMode("scale")} — drag axis sticks, plane
 *   handles, or the centre uniform-scale cube.
 * - {@link setMode | setMode("none")} — hide every handle without
 *   detaching the target.
 *
 * ## Coordinate spaces
 *
 * {@link setSpace | setSpace("world")} aligns the handles with the
 * world axes; {@link setSpace | setSpace("local")} aligns them with
 * the target's current rotation.
 *
 * ## Sizing and snap
 *
 * {@link setSize} sets a target screen-space size in pixels. The
 * controls recompute world-space scale on every camera change so the
 * rig stays a constant pixel size regardless of camera distance.
 *
 * {@link setTranslationSnap}, {@link setRotationSnap}, and
 * {@link setScaleSnap} quantise drag deltas; pass `null` to disable.
 *
 * ## Events
 *
 * Subscribe to {@link TransformControls.events} for `onDragStart`,
 * `onDragEnd`, `onChange`, and `onObjectChange`. See
 * {@link TransformControlsEvents | TransformControlsEvents}.
 *
 * ## Picking
 *
 * Drag interaction requires a
 * {@link spatial!picking.PickStrategy | PickStrategy}, supplied via
 * {@link TransformControlsParams.picker | TransformControlsParams.picker}.
 * Without one the handles render but cannot be grabbed.
 */
export class TransformControls {

  /** Per-View instance registry. */
  private static readonly _instances = new WeakMap<View, TransformControls>();

  /**
   * SVG glyph used in toolbar buttons and context-menu rows that
   * activate the gizmo — a three-axis pivot. Strokes use
   * `currentColor`.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<circle cx="11" cy="13" r="1.5" fill="currentColor" stroke="none"/>` +
      `<line x1="11" y1="13" x2="21" y2="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>` +
      `<polyline points="19 11 21 13 19 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<line x1="11" y1="13" x2="11" y2="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>` +
      `<polyline points="9 5 11 3 13 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<line x1="11" y1="13" x2="4" y2="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>` +
      `<polyline points="4.5 17.5 4 20 6.5 19.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;
  }

  /**
   * Returns the live {@link TransformControls} bound to the given
   * {@link viewing!viewer.View | View}, or `undefined` when none has
   * been created (or the last one was destroyed).
   */
  static getFor(view: View): TransformControls | undefined {
    const inst = TransformControls._instances.get(view);
    return inst && !inst._destroyed ? inst : undefined;
  }

  /**
   * Idempotent factory — returns the live
   * {@link TransformControls} for
   * {@link TransformControlsParams.view | params.view}, or
   * constructs one. Use this in preference to direct
   * `new TransformControls(...)` when the host may already have
   * built a gizmo for the same View.
   */
  static openFor(params: TransformControlsParams): TransformControls {
    const existing = TransformControls._instances.get(params.view);
    if (existing && !existing._destroyed) return existing;
    return new TransformControls(params);
  }

  /**
   * The {@link viewing!viewer.View | View} this gizmo lives in.
   */
  public readonly view: View;

  /**
   * Dedicated {@link viewing!viewer.ViewLayer | ViewLayer} that hosts
   * the gizmo handle ViewObjects. Created during construction and
   * destroyed by {@link destroy}.
   */
  public readonly viewLayer: ViewLayer;

  /**
   * Dedicated {@link model!scene.SceneModel | SceneModel} that holds
   * the gizmo's handle, picker, and helper meshes. Created during
   * construction and destroyed by {@link destroy}.
   */
  public readonly sceneModel: SceneModel;

  /**
   * Unique id used as the {@link viewLayer | ViewLayer} and
   * {@link sceneModel | SceneModel} id.
   */
  public readonly id: string;

  /**
   * Typed event emitters fired by this gizmo. See
   * {@link TransformControlsEvents}.
   */
  public readonly events: TransformControlsEvents;

  // ----- State -----
  private _target: NormalisedTarget | null = null;
  private _mode: TransformControlsMode = "translate";
  private _space: TransformControlsSpace = "world";
  private _sizePx: number = 160;
  private _translationSnap: number | null = null;
  private _rotationSnap: number | null = null;
  private _scaleSnap: number | null = null;
  private _showX: boolean = true;
  private _showY: boolean = true;
  private _showZ: boolean = true;
  private _destroyed = false;
  private _enabled = true;

  /**
   * The axis of the handle currently under the pointer, or `null`
   * when no handle is hovered. Updated by the pointer-move handler
   * before {@link TransformControlsEvents.onChange | onChange} fires.
   */
  public hoveredAxis: TransformControlsAxis = null;

  /**
   * The axis of the handle currently being dragged, or `null` when
   * no drag is in progress.
   */
  public dragAxis: TransformControlsAxis = null;

  /**
   * `true` while a drag is in progress (between
   * {@link TransformControlsEvents.onDragStart | onDragStart} and
   * {@link TransformControlsEvents.onDragEnd | onDragEnd}).
   */
  public dragging = false;

  // ----- Per-frame caches -----
  private _rootMatrix: Mat4 = createMat4Float64();
  private _pivotWorld: Vec3 = createVec3Float64();
  private _rotationWorld: Mat4 = createMat4Float64();   // target's rotation as a Mat4

  private _meshLocals: Record<string, Mat4> = {};
  private _meshNormalColor: Record<string, Vec3> = {};
  private _hoveredHandleId: string | null = null;

  /**
   * The mesh the {@link _normaliseMeshGroup | mesh-group normaliser}
   * most recently treated as primary. Surfaced so the `owns`
   * predicate can still recognise a destroy event aimed at that
   * mesh after `m.object` has been cleared by the SceneObject's
   * own destroy path (the cascade clears the backlink before the
   * mesh-destroy event fires).
   */
  private _lastPrimaryMesh: SceneMesh | null = null;

  /**
   * `true` when the gizmo's pivot was supplied explicitly via
   * {@link attach}'s `pivotWorld` option — usually a surface point
   * returned by the picker, so the gizmo anchors to the place the
   * user actually clicked rather than the SceneObject's geometric
   * origin. `false` falls back to the primary mesh's translation,
   * which is the historical behaviour.
   */
  private _explicitPivot: boolean = false;

  /**
   * Verbose console logging during attach / pointerdown / drag —
   * see {@link setDebug}. Off by default; toggle on from the host
   * (or a devtools console) when chasing pivot, snapshot, or
   * per-mesh transform-application issues.
   */
  private _debug: boolean = false;

  // ----- Drag state -----
  private _dragHandle: string | null = null;
  private _dragStartCanvas: [number, number] = [0, 0];
  private _dragStartWorld: Vec3 = createVec3Float64();
  private _dragAxisWorld: Vec3 = createVec3Float64();
  private _dragPlaneNormal: Vec3 = createVec3Float64();
  private _dragPlanePoint: Vec3 = createVec3Float64();
  private _dragStartAngleRef: Vec3 = createVec3Float64();
  private _dragPivot: Vec3 = createVec3Float64();

  // Pre-built handle-id lookup so the PickStrategy filter is O(1).
  private readonly _handleSet: Set<string>;

  // ----- Picker (PickStrategy from spatial/picking) -----
  private readonly _picker: PickStrategy | null;

  // ----- ViewController to suspend during drag (mousemove suppression) -----
  private readonly _viewController: ViewController | null;
  private _viewControllerWasActive: boolean = true;

  // ----- Listeners -----
  private readonly _onPointerDown: (e: PointerEvent) => void;
  private readonly _onPointerMove: (e: PointerEvent) => void;
  private readonly _onPointerUp:   (e: PointerEvent) => void;
  // The orbit controller listens for `mousedown`/`mousemove`/`mouseup` on
  // both the canvas and on document. Browsers dispatch the mouse family
  // independently of the pointer family, so we also intercept and stop
  // mouse events while a drag is in progress.
  private readonly _onMouseDuringDrag: (e: MouseEvent) => void;
  private _camSub: (() => void) | null = null;

  /**
   * Unsubscriber for the `scene.events.onSceneMeshDestroyed`
   * listener that drives target-lifecycle handling. Cleared in
   * {@link destroy}.
   */
  private _meshDestroyedSub: (() => void) | null = null;

  /**
   * Constructs a new {@link TransformControls}.
   *
   * Creates the dedicated {@link viewLayer} and {@link sceneModel},
   * builds every handle / picker / helper SceneObject, and wires up
   * pointer and camera listeners. If
   * {@link TransformControlsParams.target | params.target} is
   * supplied, attaches to it immediately; otherwise the controls
   * stay hidden until {@link attach} is called.
   *
   * @param params - {@link TransformControlsParams} for this gizmo.
   */
  constructor(params: TransformControlsParams) {
    this.view = params.view;
    // Replace any prior controls bound to the same View — direct
    // construction is supported, but it should leave only one gizmo
    // live per View at any time.
    const prior = TransformControls._instances.get(params.view);
    if (prior && !prior._destroyed) prior.destroy();
    TransformControls._instances.set(params.view, this);

    this._picker = params.picker ?? null;
    this._viewController = params.viewController ?? null;
    // The picker filter accepts both the visible handle ids and the
    // companion-picker ids (each handle gets a fat invisible collider
    // SceneObject with id "<handle>.picker" — see addPicker in
    // buildGeometry). The `.picker` suffix is stripped in _pick.
    this._handleSet = new Set<string>();
    for (const h of ALL_HANDLES) {
      this._handleSet.add(h);
      this._handleSet.add(`${h}.picker`);
    }
    // Default id carries the reserved `__` prefix so the
    // gizmo's SceneModel + ViewLayer are auto-excluded from
    // user-facing enumerators (BoundariesPanel, DrawingsPanel,
    // SceneHealthPanel, the scene-AABB aggregator). Callers
    // that override `params.id` are responsible for keeping
    // the prefix if they want the same exclusion.
    this.id = params.id ?? "__transformControls";
    this._mode  = params.mode  ?? "translate";
    this._space = params.space ?? "world";
    this._sizePx = params.size ?? 160;
    this._translationSnap = params.translationSnap ?? null;
    this._rotationSnap = params.rotationSnap ?? null;
    this._scaleSnap = params.scaleSnap ?? null;
    this._showX = params.showX ?? true;
    this._showY = params.showY ?? true;
    this._showZ = params.showZ ?? true;
    this.events = new TransformControlsEvents();

    const layerRes = this.view.createLayer({id: this.id, autoDestroy: false});
    if (layerRes.ok !== true) throw new Error("[TransformControls] Failed to create ViewLayer");
    this.viewLayer = layerRes.value;

    // Inherit the Scene's coordinate system so the gizmo's own
    // SceneModel matches the Scene's basis exactly. Without this,
    // the gizmo defaults to xeokit's Z-up basis even when the host
    // Scene uses a different basis (for example Y-up) — and the
    // gizmo's coordinateSystemMatrix would then re-orient every
    // handle mesh on render, swapping axes between the gizmo's
    // construction frame and the world the user actually sees.
    const sceneCoord = this.view.viewer.scene.coordinateSystem.toParams();
    const modelRes = this.view.viewer.scene.createModel({
      id: this.id,
      layerId: this.id,
      coordinateSystem: sceneCoord,
    });
    if (modelRes.ok !== true) throw new Error("[TransformControls] Failed to create SceneModel");
    this.sceneModel = modelRes.value;

    const built: BuiltGeometry = buildGeometry(this.sceneModel, this.id);
    this._meshLocals = built.meshLocals;
    this._meshNormalColor = built.meshNormalColor;

    // Companion-picker meshes are kept ViewObject-visible on purpose.
    // Their non-rendering in colour comes from being in the
    // `"overlayPicker"` bin (which the colour render path skips) rather
    // than from `ViewObject.visible = false` — flipping a ViewObject
    // invisible drops its primitives out of the renderer's pick index
    // range entirely, defeating the whole picker-tolerance design.

    // Hover helpers (axis lines that flash on while a handle is hovered)
    // start hidden — _setHover toggles them on for the hovered handle's
    // axis(es). They render through the `"overlay"` bin so they float
    // over host geometry like the rest of the rig.
    for (const id of HELPER_IDS) {
      const obj = this.viewLayer.objects[id];
      if (obj) (obj as any).visible = false;
    }

    // Pointer events. Registered in the capture phase so a handle drag
    // wins over host-app listeners (orbit controllers, click-to-pick) on
    // the same canvas element.
    this._onPointerDown = (e) => this._handlePointerDown(e);
    this._onPointerMove = (e) => this._handlePointerMove(e);
    this._onPointerUp   = (e) => this._handlePointerUp(e);
    const el = this.view.htmlElement;
    el.addEventListener("pointerdown",   this._onPointerDown, true);
    el.addEventListener("pointermove",   this._onPointerMove, true);
    el.addEventListener("pointerup",     this._onPointerUp,   true);
    el.addEventListener("pointercancel", this._onPointerUp,   true);

    // Mouse events. The orbit controller subscribes to mouse* events
    // (often on document), and the browser dispatches these independently
    // from the pointer family — stopping pointer propagation does NOT
    // suppress them. While a drag is active, capture-phase listeners on
    // both the canvas and document silently block every mouse* event.
    this._onMouseDuringDrag = (e: MouseEvent) => {
      if (!this._dragHandle) return;
      e.preventDefault();
      e.stopPropagation();
      (e as any).stopImmediatePropagation?.();
    };
    const winDoc = (typeof document !== "undefined") ? document : null;
    el.addEventListener("mousedown", this._onMouseDuringDrag, true);
    el.addEventListener("mousemove", this._onMouseDuringDrag, true);
    el.addEventListener("mouseup",   this._onMouseDuringDrag, true);
    if (winDoc) {
      winDoc.addEventListener("mousedown", this._onMouseDuringDrag, true);
      winDoc.addEventListener("mousemove", this._onMouseDuringDrag, true);
      winDoc.addEventListener("mouseup",   this._onMouseDuringDrag, true);
    }

    // Re-sync on every camera-state change so the screen-space size +
    // the view-aligned rings stay correct. The viewer dispatches:
    //   - onCameraViewMatrixUpdated — orbit, pan, eye/look move
    //   - onCameraProjMatrixUpdated — fov, ortho size, projection swap
    // Both feed into `_syncTransform`'s scale math (pivot distance,
    // worldPerPixel from fov), so we subscribe to both. Without this,
    // the gizmo holds its last-computed *world-space* size during an
    // orbit, which makes it visibly snap to the correct pixel size
    // on the next event that does fire `_syncTransform` (typically
    // the first pointermove of a drag).
    const viewerEvents: any = (this.view as any).viewer?.events;
    const subs: Array<() => void> = [];
    if (viewerEvents?.onCameraViewMatrixUpdated?.subscribe) {
      const sub = viewerEvents.onCameraViewMatrixUpdated.subscribe(() => this._syncTransform());
      subs.push(() => viewerEvents.onCameraViewMatrixUpdated.unsubscribe?.(sub));
    }
    if (viewerEvents?.onCameraProjMatrixUpdated?.subscribe) {
      const sub = viewerEvents.onCameraProjMatrixUpdated.subscribe(() => this._syncTransform());
      subs.push(() => viewerEvents.onCameraProjMatrixUpdated.unsubscribe?.(sub));
    }
    this._camSub = subs.length === 0 ? null : () => { for (const u of subs) u(); };

    // Subscribe to scene-mesh destruction so the gizmo can react when
    // its target is removed out from under it. The handler is cheap
    // for unrelated destructions (single identity check) and only
    // does work when the destroyed mesh is the one this gizmo is
    // currently driving.
    const sceneEvents: any = (this.view as any).viewer?.scene?.events;
    if (sceneEvents?.onSceneMeshDestroyed?.subscribe) {
      const sub = sceneEvents.onSceneMeshDestroyed.subscribe(
        (_scene: unknown, mesh: SceneMesh) => this._onSceneMeshDestroyed(mesh)
      );
      this._meshDestroyedSub = () => sceneEvents.onSceneMeshDestroyed.unsubscribe?.(sub);
    }

    if (params.target !== undefined && params.target !== null) {
      this.attach(params.target);
    } else {
      this._applyVisibility();
    }
  }

  // -------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------

  /**
   * Attaches a target.
   *
   * Accepts a {@link model!scene.SceneObject | SceneObject} (every
   * mesh of which transforms as a rigid group), a
   * {@link model!scene.SceneMesh | SceneMesh}, or a `getMatrix /
   * setMatrix` adapter.
   *
   * The gizmo's pivot — the rotation centre, scale origin, and the
   * world-space anchor the handles render around — is set from
   * `options.pivotWorld` when supplied (use the world position
   * returned by your picker so the gizmo appears exactly at the
   * surface point the user clicked). When omitted, the pivot
   * falls back to the target's primary world-matrix translation.
   *
   * Translation drags move the pivot with the object; rotate and
   * scale drags hold the pivot fixed as the operation's centre,
   * which is what makes "rotate this object about the point I
   * clicked" feel correct.
   *
   * Fires {@link TransformControlsEvents.onChange | onChange} after
   * the rig has been re-posed.
   *
   * @param target  - The {@link TransformControlsTarget} to manipulate.
   * @param options - Optional attach options; `pivotWorld` sets
   *   the gizmo's anchor.
   */
  public attach(
    target: TransformControlsTarget,
    options?: {pivotWorld?: Vec3},
  ): void {
    this._target = this._normalise(target);
    if (options?.pivotWorld) {
      const p = options.pivotWorld;
      this._pivotWorld[0] = p[0];
      this._pivotWorld[1] = p[1];
      this._pivotWorld[2] = p[2];
      this._explicitPivot = true;
    } else {
      const m = this._target.getPrimaryMatrix();
      this._pivotWorld[0] = m[12];
      this._pivotWorld[1] = m[13];
      this._pivotWorld[2] = m[14];
      this._explicitPivot = false;
    }
    if (this._debug) {
      const kind = (target as any).meshes
          ? `SceneObject id="${(target as any).id}" meshes.length=${(target as any).meshes?.length ?? 0}`
          : (target as any).matrix !== undefined && (target as any).geometry !== undefined
            ? `SceneMesh id="${(target as any).id}"`
            : "adapter";
      const f = (n: number) => n.toFixed(3);
      console.log(
          `[TransformControls ${this.id}] attach target="${kind}"` +
          ` pivotWorld=[${f(this._pivotWorld[0])}, ${f(this._pivotWorld[1])}, ${f(this._pivotWorld[2])}]` +
          ` explicit=${this._explicitPivot}`
      );
    }
    this._syncTransform();
    this._applyVisibility();
    this.events.onChange.dispatch(this, undefined);
  }

  /**
   * Detaches the current target and hides the gizmo.
   *
   * Fires {@link TransformControlsEvents.onChange | onChange}.
   */
  public detach(): void {
    this._target = null;
    this._explicitPivot = false;
    this._lastPrimaryMesh = null;
    this._applyVisibility();
    this.events.onChange.dispatch(this, undefined);
  }

  /**
   * Sets the interaction mode.
   *
   * Changes the visible handle set:
   * - `"translate"` — axis arrows + plane handles + centre cube
   * - `"rotate"` — axis rings + view-aligned ring + trackball
   * - `"scale"` — axis sticks + plane handles + centre cube
   * - `"none"` — hides every handle without detaching
   *
   * Clears any current hover state so a stale highlight from the
   * previous mode does not persist. The next pointer move
   * re-establishes hover for whatever handle the pointer is over.
   *
   * Fires {@link TransformControlsEvents.onChange | onChange}.
   *
   * @param mode - The {@link TransformControlsMode} to switch to.
   */
  public setMode(mode: TransformControlsMode): void {
    if (mode === this._mode) return;
    this._mode = mode;
    this._setHover(null);
    this._applyVisibility();
    this.events.onChange.dispatch(this, undefined);
  }

  /**
   * Sets the coordinate space the controls operate in.
   *
   * `"world"` aligns handles with the world axes; `"local"` aligns
   * them with the target's current rotation, so axis drags move /
   * rotate / scale along the target's own local frame.
   *
   * Fires {@link TransformControlsEvents.onChange | onChange}.
   *
   * @param space - The {@link TransformControlsSpace} to use.
   */
  public setSpace(space: TransformControlsSpace): void {
    if (space === this._space) return;
    this._space = space;
    this._syncTransform();
    this.events.onChange.dispatch(this, undefined);
  }

  /**
   * Sets the gizmo's screen-space size in pixels.
   *
   * The handles render at approximately `sizePx` pixels on screen
   * regardless of camera distance — the controls recompute the
   * world-space scale on every camera change. Clamped to a minimum
   * of 8 pixels.
   *
   * Fires {@link TransformControlsEvents.onChange | onChange}.
   *
   * @param sizePx - Target on-screen size in pixels.
   */
  public setSize(sizePx: number): void {
    this._sizePx = Math.max(8, sizePx);
    this._syncTransform();
    this.events.onChange.dispatch(this, undefined);
  }

  /**
   * Sets the translation-mode snap step, in world units.
   *
   * Translation drag deltas are quantised to multiples of `snap`
   * along each axis. Pass `null` to disable snapping.
   *
   * Fires {@link TransformControlsEvents.onChange | onChange}.
   *
   * @param snap - Snap step in world units, or `null` to disable.
   */
  public setTranslationSnap(snap: number | null): void {
    this._translationSnap = snap;
    this.events.onChange.dispatch(this, undefined);
  }

  /**
   * Sets the rotation-mode snap step, in radians.
   *
   * Rotation drag angles are quantised to multiples of `snap`. Pass
   * `null` to disable snapping.
   *
   * Fires {@link TransformControlsEvents.onChange | onChange}.
   *
   * @param snap - Snap step in radians, or `null` to disable.
   */
  public setRotationSnap(snap: number | null): void {
    this._rotationSnap = snap;
    this.events.onChange.dispatch(this, undefined);
  }

  /**
   * Sets the scale-mode snap step, as a multiplicative factor.
   *
   * A value of `0.1` snaps to 10% increments. Pass `null` to disable
   * snapping.
   *
   * Fires {@link TransformControlsEvents.onChange | onChange}.
   *
   * @param snap - Snap step as a multiplicative factor, or `null`
   *   to disable.
   */
  public setScaleSnap(snap: number | null): void {
    this._scaleSnap = snap;
    this.events.onChange.dispatch(this, undefined);
  }

  /**
   * Shows or hides the X-axis handles in every mode.
   *
   * Fires {@link TransformControlsEvents.onChange | onChange}.
   *
   * @param v - `true` to show the X-axis handles, `false` to hide.
   */
  public setShowX(v: boolean): void {
    this._showX = v;
    this._applyVisibility();
    this.events.onChange.dispatch(this, undefined);
  }

  /**
   * Shows or hides the Y-axis handles in every mode.
   *
   * Fires {@link TransformControlsEvents.onChange | onChange}.
   *
   * @param v - `true` to show the Y-axis handles, `false` to hide.
   */
  public setShowY(v: boolean): void {
    this._showY = v;
    this._applyVisibility();
    this.events.onChange.dispatch(this, undefined);
  }

  /**
   * Shows or hides the Z-axis handles in every mode.
   *
   * Fires {@link TransformControlsEvents.onChange | onChange}.
   *
   * @param v - `true` to show the Z-axis handles, `false` to hide.
   */
  public setShowZ(v: boolean): void {
    this._showZ = v;
    this._applyVisibility();
    this.events.onChange.dispatch(this, undefined);
  }

  /**
   * Enables or disables pointer interaction with the gizmo.
   *
   * When disabled the handles still render but do not respond to
   * hover or drag input. Useful for guarding the controls during
   * a transient host-app interaction (for example a modal dialog).
   *
   * @param v - `true` to enable interaction, `false` to disable.
   */
  public setEnabled(v: boolean): void {
    this._enabled = v;
  }

  /**
   * Toggles verbose console logging during attach, pointerdown,
   * and every drag transform.
   *
   * Each log line is prefixed `[TransformControls <id>]` and
   * carries enough state to verify the pivot / drag-pivot /
   * per-mesh translation behaviour without poking at private
   * fields:
   *
   * - **attach** — the resolved pivotWorld, whether it was
   *   explicit, and the target type.
   * - **pointerdown** — the picked handle id, the snapshotted
   *   drag pivot, and the per-mesh start-world translation
   *   columns.
   * - **rotate / scale / translate** — the operation type, axis
   *   and angle (or factors), the pivot used, and per-mesh
   *   translation deltas (start → new) so a mesh that fails to
   *   move shows up immediately.
   *
   * Switch on from the host (or from a devtools console:
   * `viewer.studio.panels.open("transformControls", {view}).setDebug(true)`)
   * when chasing pivot drift, snapshot mismatch, or mid-drag
   * detach issues.
   */
  public setDebug(v: boolean): void {
    this._debug = v;
  }

  /**
   * Current world-space pivot — read-only window onto the
   * internal `_pivotWorld` for diagnostics. Returns the same
   * reference each call (do not mutate).
   */
  public get pivotWorld(): Vec3 { return this._pivotWorld; }

  /**
   * World-space pivot snapshot taken at the most recent
   * pointerdown — read-only window onto the internal
   * `_dragPivot`. Read this from devtools mid-drag to verify the
   * rotate / scale origin matches the surface point you picked.
   * Returns the same reference each call (do not mutate).
   */
  public get dragPivot(): Vec3 { return this._dragPivot; }

  /**
   * `true` when the gizmo's pivot came from an explicit
   * `pivotWorld` option on {@link attach}, `false` when it
   * fell back to the target's primary world-matrix translation.
   * If you supplied a pivot but this reads `false`, your
   * attach-time options chain dropped it somewhere.
   */
  public get isExplicitPivot(): boolean { return this._explicitPivot; }

  /**
   * Whether {@link setDebug | debug logging} is currently on.
   */
  public get debug(): boolean { return this._debug; }

  /**
   * The current interaction mode.
   */
  public get mode(): TransformControlsMode { return this._mode; }

  /**
   * The current coordinate space.
   */
  public get space(): TransformControlsSpace { return this._space; }

  /**
   * The current screen-space size in pixels.
   */
  public get size(): number { return this._sizePx; }

  /**
   * The current translation snap step in world units, or `null`
   * when translation snap is disabled.
   */
  public get translationSnap(): number | null { return this._translationSnap; }

  /**
   * The current rotation snap step in radians, or `null` when
   * rotation snap is disabled.
   */
  public get rotationSnap(): number | null { return this._rotationSnap; }

  /**
   * The current scale snap step as a multiplicative factor, or
   * `null` when scale snap is disabled.
   */
  public get scaleSnap(): number | null { return this._scaleSnap; }

  /**
   * Whether the X-axis handles are visible.
   */
  public get showX(): boolean { return this._showX; }

  /**
   * Whether the Y-axis handles are visible.
   */
  public get showY(): boolean { return this._showY; }

  /**
   * Whether the Z-axis handles are visible.
   */
  public get showZ(): boolean { return this._showZ; }

  /**
   * Whether pointer interaction is enabled.
   */
  public get enabled(): boolean { return this._enabled; }

  /**
   * Destroys this {@link TransformControls}.
   *
   * Unregisters every pointer / mouse / camera listener, destroys
   * the dedicated {@link sceneModel} and {@link viewLayer}, and
   * releases all internal state. Idempotent — calling `destroy`
   * a second time is a no-op.
   */
  public destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    if (TransformControls._instances.get(this.view) === this) {
      TransformControls._instances.delete(this.view);
    }
    const el = this.view.htmlElement;
    el.removeEventListener("pointerdown",   this._onPointerDown, true);
    el.removeEventListener("pointermove",   this._onPointerMove, true);
    el.removeEventListener("pointerup",     this._onPointerUp,   true);
    el.removeEventListener("pointercancel", this._onPointerUp,   true);
    el.removeEventListener("mousedown",     this._onMouseDuringDrag, true);
    el.removeEventListener("mousemove",     this._onMouseDuringDrag, true);
    el.removeEventListener("mouseup",       this._onMouseDuringDrag, true);
    if (typeof document !== "undefined") {
      document.removeEventListener("mousedown", this._onMouseDuringDrag, true);
      document.removeEventListener("mousemove", this._onMouseDuringDrag, true);
      document.removeEventListener("mouseup",   this._onMouseDuringDrag, true);
    }
    if (this._camSub) this._camSub();
    if (this._meshDestroyedSub) this._meshDestroyedSub();
    this.sceneModel.destroy();
    this.viewLayer.destroy();
  }

  // -------------------------------------------------------------
  // Internal: target normalisation
  // -------------------------------------------------------------

  private _normalise(t: TransformControlsTarget): NormalisedTarget {
    // SceneMesh: a single fixed mesh; snapshot captures one
    // world matrix; ownership is identity.
    if ((t as SceneMesh).matrix !== undefined && typeof (t as any).geometry !== "undefined") {
      const mesh = t as SceneMesh;
      return this._normaliseMeshGroup({
        listLiveMeshes: () => mesh.destroyed ? [] : [mesh],
        owns: (m) => m === mesh,
      });
    }
    // SceneObject group: snapshot captures every live owned mesh
    // so a drag transforms them as one. The list is re-walked on
    // every snapshot / read, so mesh-list mutations on the
    // SceneObject (addMesh / removeMesh / cascade destroy) are
    // picked up the next time the gizmo touches the target.
    if ((t as SceneObject).meshes) {
      const obj = t as SceneObject;
      return this._normaliseMeshGroup({
        listLiveMeshes: () => {
          const out: SceneMesh[] = [];
          for (const m of obj.meshes) {
            if (m && !m.destroyed && m.object === obj) out.push(m);
          }
          return out;
        },
        owns: (m) => m.object === obj || m === this._lastPrimaryMesh,
      });
    }
    // Adapter form — host owns the matrix and its lifecycle. We
    // expose a one-snapshot, one-apply wrapper so the drag math
    // path stays uniform; involves / refresh are omitted because
    // the gizmo has no lifecycle hook into the adapter's source.
    const adapter = t as {getMatrix: () => Mat4; setMatrix: (m: Mat4) => void};
    let startWorld: Mat4 = identityMat4(createMat4Float64());
    return {
      getPrimaryMatrix: () => adapter.getMatrix(),
      snapshot: () => {
        startWorld = createMat4Float64();
        const m = adapter.getMatrix();
        for (let i = 0; i < 16; i++) startWorld[i] = m[i];
      },
      applyTransform: (T: Mat4) => {
        const out = createMat4Float64();
        mulMat4(T, startWorld, out);
        adapter.setMatrix(out);
        if (this._debug) {
          const sx = startWorld[12], sy = startWorld[13], sz = startWorld[14];
          const nx = out[12], ny = out[13], nz = out[14];
          const f = (n: number) => n.toFixed(3);
          console.log(
              `[TransformControls ${this.id}]   apply adapter` +
              ` start=[${f(sx)}, ${f(sy)}, ${f(sz)}]` +
              ` new=[${f(nx)}, ${f(ny)}, ${f(nz)}]` +
              ` delta=[${f(nx - sx)}, ${f(ny - sy)}, ${f(nz - sz)}]`
          );
        }
      },
      getStartTranslations: () =>
          [[startWorld[12], startWorld[13], startWorld[14]] as [number, number, number]],
    };
  }

  /**
   * Wraps a mesh-group source (one or more SceneMeshes that should
   * transform as a single rigid group) in a snapshot / apply
   * adapter. The drag math evaluates every operation in world
   * space, and this adapter handles the conversion through each
   * mesh's parent
   * {@link model!scene.SceneModel | SceneModel}'s coordinate
   * system on the read and write paths so the local matrix the
   * renderer stores remains in the SceneModel's own frame.
   *
   * Why this matters: `SceneMesh.matrix` is the **local** matrix
   * in the parent SceneModel's coordinate frame; the renderer
   * composes `worldMatrix = coordinateSystemMatrix × localMatrix`
   * for display. The gizmo's pivot, drag axes, and cursor-ray
   * intersections are all in world space, so a transform built
   * from those values is a world-space transform. We pre-multiply
   * it against each mesh's **world** start matrix, then push the
   * result back through `inverse(coordinateSystemMatrix)` into
   * each mesh's local slot.
   *
   * The mesh list is supplied through a `listLiveMeshes` resolver
   * that is re-invoked on every snapshot / read, so SceneObject
   * mesh-list mutations (`addMesh` / `removeMesh` / cascade
   * destroy) are picked up automatically.
   *
   * Parent transforms are not handled here — a SceneMesh nested
   * under a `SceneTransform` chain uses
   * `parentTransform.worldMatrix × localMatrix` for world, not the
   * coord-system path. Wrap such targets in the adapter form
   * (`{ getMatrix, setMatrix }`) to provide bespoke world ↔ local
   * conversion.
   */
  private _normaliseMeshGroup(opts: {
    listLiveMeshes: () => SceneMesh[];
    owns: (m: SceneMesh) => boolean;
  }): NormalisedTarget {
    interface Snapshot { mesh: SceneMesh; startWorld: Mat4; }
    let snap: Snapshot[] = [];
    const lastPrimaryWorld = identityMat4(createMat4Float64());

    /**
     * Returns the matrix that converts the mesh's **local** matrix
     * into scene-world space. Honours a parent
     * {@link model!scene.SceneTransform | SceneTransform} chain when
     * present (which is what the renderer does — see
     * `SceneMesh.worldMatrix`), otherwise falls back to the parent
     * SceneModel's coord-system matrix. Both paths must be carried
     * through here or the gizmo's read / write composes against the
     * wrong base, and rotation / scale pivot around a point that's
     * offset from where the user actually clicked.
     */
    const baseMatrix = (mesh: SceneMesh): Mat4 | null => {
      if ((mesh as any).parentTransform) {
        return (mesh as any).parentTransform.worldMatrix as Mat4;
      }
      const model = (mesh as any).model as SceneModel | undefined;
      return model ? model.coordinateSystemMatrix : null;
    };

    const readWorld = (mesh: SceneMesh, out: Mat4): Mat4 => {
      const base = baseMatrix(mesh);
      if (!base) {
        for (let i = 0; i < 16; i++) out[i] = mesh.matrix[i];
      } else {
        mulMat4(base, mesh.matrix, out);
      }
      return out;
    };

    const writeWorld = (mesh: SceneMesh, worldM: Mat4): void => {
      const base = baseMatrix(mesh);
      if (!base) { mesh.matrix = worldM; return; }
      const inv = inverseMat4(base, createMat4Float64());
      if (!inv) {
        // Base matrix is singular (shouldn't happen for a valid
        // orthonormal-basis-plus-translation transform, but guard
        // anyway) — fall back to treating world == local.
        mesh.matrix = worldM;
        return;
      }
      const localM = createMat4Float64();
      mulMat4(inv, worldM, localM);
      mesh.matrix = localM;
    };

    return {
      getPrimaryMatrix: () => {
        const meshes = opts.listLiveMeshes();
        if (meshes.length === 0) return lastPrimaryWorld;
        this._lastPrimaryMesh = meshes[0];
        readWorld(meshes[0], lastPrimaryWorld);
        return lastPrimaryWorld;
      },
      snapshot: () => {
        snap = [];
        const meshes = opts.listLiveMeshes();
        for (const m of meshes) {
          const startWorld = createMat4Float64();
          readWorld(m, startWorld);
          snap.push({mesh: m, startWorld});
        }
        if (meshes.length > 0) this._lastPrimaryMesh = meshes[0];
      },
      applyTransform: (T: Mat4) => {
        for (const entry of snap) {
          if (entry.mesh.destroyed) continue;
          const newWorld = createMat4Float64();
          mulMat4(T, entry.startWorld, newWorld);
          writeWorld(entry.mesh, newWorld);
          if (this._debug) {
            const sx = entry.startWorld[12], sy = entry.startWorld[13], sz = entry.startWorld[14];
            const nx = newWorld[12], ny = newWorld[13], nz = newWorld[14];
            const f = (n: number) => n.toFixed(3);
            console.log(
                `[TransformControls ${this.id}]   apply mesh="${entry.mesh.id}"` +
                ` start=[${f(sx)}, ${f(sy)}, ${f(sz)}]` +
                ` new=[${f(nx)}, ${f(ny)}, ${f(nz)}]` +
                ` delta=[${f(nx - sx)}, ${f(ny - sy)}, ${f(nz - sz)}]`
            );
          }
        }
      },
      involves: opts.owns,
      refresh: () => opts.listLiveMeshes().length > 0,
      getStartTranslations: () =>
          snap.map((e) =>
              [e.startWorld[12], e.startWorld[13], e.startWorld[14]] as [number, number, number]),
    };
  }

  /**
   * Cancels an in-progress drag without waiting for a pointerup.
   *
   * Used by {@link _onSceneMeshDestroyed} when the user's target is
   * pulled out of the scene mid-gesture — the gizmo treats the
   * cancellation as a normal drag-end so toolbar pressed state,
   * onDragEnd-bound undo recorders, etc. clean up the same way they
   * would on a real release.
   *
   * No-op when no drag is in progress.
   */
  private _cancelDrag(): void {
    if (!this._dragHandle) return;
    const wasAxis = this.dragAxis;
    this._dragHandle = null;
    this.dragging = false;
    this.dragAxis = null;
    if (this._viewController) {
      this._viewController.active = this._viewControllerWasActive;
    }
    this.events.onDragEnd.dispatch(this, {
      axis: wasAxis,
      mode: this._mode,
      space: this._space,
    });
  }

  /**
   * Reacts to `scene.events.onSceneMeshDestroyed` so the gizmo
   * either follows the user's SceneObject to a sibling mesh, or
   * detaches when the last live mesh under the target is gone.
   *
   * The normalised target's `involves` check is asked first so we
   * only do work for destructions that actually concern this
   * gizmo. Mid-drag destructions are cancelled cleanly via
   * {@link _cancelDrag} before the target mutates, so any host
   * listener on `onDragEnd` sees a normal release rather than a
   * sudden detach. The final {@link TransformControlsEvents.onTargetLost | onTargetLost}
   * fires only when no live mesh remains, after `detach()` has
   * already hidden the handles.
   */
  private _onSceneMeshDestroyed(mesh: SceneMesh): void {
    if (this._destroyed) return;
    const target = this._target;
    if (!target || !target.involves || !target.involves(mesh)) return;

    this._cancelDrag();

    // Try to keep the gizmo on a sibling — SceneObject targets
    // re-pick the first live mesh; SceneMesh targets always lose.
    if (target.refresh && target.refresh()) {
      this._syncTransform();
      return;
    }

    this.detach();
    this.events.onTargetLost.dispatch(this, undefined);
  }

  // -------------------------------------------------------------
  // Internal: target sync + visibility
  // -------------------------------------------------------------

  /**
   * Re-anchors every handle mesh to the target's pivot and applies the
   * screen-space scale + (for local mode) the target's rotation. Also
   * re-orients the view-aligned E ring and XYZE trackball to face the
   * camera.
   */
  private _syncTransform(): void {
    if (!this._target) return;

    // Pivot is owned by the gizmo (set at attach, advanced by
    // translate drags). When the host hasn't supplied an explicit
    // pivot, track the primary mesh's translation column so the
    // gizmo follows external matrix writes — useful for hosts that
    // animate or otherwise mutate the target outside the gizmo.
    const m = this._target.getPrimaryMatrix();
    if (!this._explicitPivot) {
      this._pivotWorld[0] = m[12];
      this._pivotWorld[1] = m[13];
      this._pivotWorld[2] = m[14];
    }

    const t = createVec3Float64();
    const q: Quat = [0, 0, 0, 1];
    const s = createVec3Float64();
    decomposeMat4(m, t, q, s);
    quatToMat4(q, this._rotationWorld);

    // Screen-space scale: convert pixel size → world units at this distance.
    const cam: any = this.view.camera;
    const eye: Vec3 = [cam.eye[0], cam.eye[1], cam.eye[2]];
    const dist = lenVec3(subVec3(this._pivotWorld, eye, createVec3Float64()));
    const canvasH = this._canvasSize()[1];
    let worldPerPixel: number;
    if (cam.projection === "ortho" && cam.orthoProjection) {
      worldPerPixel = (cam.orthoProjection.height ?? 10) / canvasH;
    } else {
      const fov = (cam.perspectiveProjection?.fov ?? 60) * Math.PI / 180;
      worldPerPixel = (2 * dist * Math.tan(fov / 2)) / canvasH;
    }
    const scale = Math.max(1e-6, worldPerPixel * this._sizePx);

    // Root = T(pivot) [× R(targetRot) if local] × S(scale)
    const root = identityMat4(this._rootMatrix);
    root[12] = this._pivotWorld[0];
    root[13] = this._pivotWorld[1];
    root[14] = this._pivotWorld[2];
    if (this._space === "local") {
      mulMat4(root, this._rotationWorld, root);
    }
    root[0] *= scale; root[1] *= scale; root[2]  *= scale;
    root[4] *= scale; root[5] *= scale; root[6]  *= scale;
    root[8] *= scale; root[9] *= scale; root[10] *= scale;

    // Apply root × meshLocal to each pickable handle mesh.
    //
    // SceneObject.meshes is a SceneMesh[] (array, not a record), so we
    // iterate the meshes directly and look up the local matrix by the
    // SceneMesh's own id — the same key buildGeometry used when it
    // recorded _meshLocals. Iterating with `for…in` would give numeric
    // array indices ("0", "1", …) which never match the real ids and
    // every handle would silently stay at the world origin.
    //
    // We also re-pose the companion picker SceneObject (`<id>.picker`)
    // alongside each visible handle. The picker shares the visible
    // handle's local matrix at construction, but it lives outside
    // `ALL_HANDLES`, so without this step the BVH-resident picker mesh
    // would stay at the world origin and the SceneRaycaster would never
    // find it under the pointer — defeating the picking-tolerance the
    // companion was added to provide.
    const reposeMesh = (mesh: SceneMesh, m: Mat4): void => {
      const local = this._meshLocals[mesh.id];
      if (!local) return;
      const composed = createMat4Float64();
      mulMat4(m, local, composed);
      (mesh as any).matrix = composed;
    };
    for (const handleId of ALL_HANDLES) {
      const obj = this.sceneModel.objects[handleId];
      if (!obj) continue;
      // The E ring orients to face the camera regardless of space.
      if (handleId === R_E) {
        const eRoot = this._composeViewAlignedRingRoot(this._pivotWorld, scale, eye);
        for (const mesh of obj.meshes) {
          if (mesh) (mesh as any).matrix = eRoot;
        }
        const ePicker = this.sceneModel.objects[`${handleId}.picker`];
        if (ePicker) {
          for (const mesh of ePicker.meshes) {
            if (mesh) (mesh as any).matrix = eRoot;
          }
        }
        continue;
      }
      for (const mesh of obj.meshes) {
        if (mesh) reposeMesh(mesh, root);
      }
      const picker = this.sceneModel.objects[`${handleId}.picker`];
      if (picker) {
        for (const mesh of picker.meshes) {
          if (mesh) reposeMesh(mesh, root);
        }
      }
    }
    // Hover helpers (axis lines) ride the same `root` transform as the
    // handles, so they sweep with the gizmo. They don't need
    // visibility/state checks here — _setHover owns their ViewObject
    // `visible` flag, but pose must be kept current regardless so the
    // line is in the right place the instant hover toggles it on.
    for (const helperId of HELPER_IDS) {
      const obj = this.sceneModel.objects[helperId];
      if (!obj) continue;
      for (const mesh of obj.meshes) {
        if (mesh) reposeMesh(mesh, root);
      }
    }
  }

  /**
   * Builds the root transform for the view-aligned `E` rotation ring:
   * a ring encircling the camera-look axis, centred on the pivot,
   * scaled by the screen-space `scale`.
   */
  private _composeViewAlignedRingRoot(pivot: Vec3, scale: number, eye: Vec3): Mat4 {
    // Local geometry is a ring encircling +X. We need it to encircle
    // the (eye → pivot) direction. Build a rotation that maps +X to
    // that direction.
    const dir = normalizeVec3(subVec3(pivot, eye, createVec3Float64()), createVec3Float64());
    const X: Vec3 = [1, 0, 0];
    const axis = cross3Vec3(X, dir, createVec3Float64());
    const axisLen = lenVec3(axis);
    let R: Mat4;
    if (axisLen < 1e-8) {
      // X and dir are colinear; use identity or 180° flip
      R = identityMat4(createMat4Float64());
      if (dotVec3(X, dir) < 0) R[0] = -1;
    } else {
      normalizeVec3(axis, axis);
      const angle = Math.acos(Math.max(-1, Math.min(1, dotVec3(X, dir))));
      const q = angleAxisToQuaternion([axis[0], axis[1], axis[2], angle], [0, 0, 0, 1] as Quat);
      R = quatToMat4(q, identityMat4(createMat4Float64()));
    }
    R[12] = pivot[0]; R[13] = pivot[1]; R[14] = pivot[2];
    R[0]  *= scale; R[1]  *= scale; R[2]  *= scale;
    R[4]  *= scale; R[5]  *= scale; R[6]  *= scale;
    R[8]  *= scale; R[9]  *= scale; R[10] *= scale;
    return R;
  }

  private _applyVisibility(): void {
    const showAll = !!this._target && this._mode !== "none";
    const showT = showAll && this._mode === "translate";
    const showR = showAll && this._mode === "rotate";
    const showS = showAll && this._mode === "scale";
    const inAxis = (handleId: string): boolean => {
      const ax = axisOf(handleId);
      if (!this._showX && ax.includes("X")) return false;
      if (!this._showY && ax.includes("Y")) return false;
      if (!this._showZ && ax.includes("Z")) return false;
      return true;
    };
    const set = (ids: string[], v: boolean) => {
      for (const id of ids) {
        const on = v && inAxis(id);
        const obj = this.viewLayer.objects[id];
        if (obj) (obj as any).visible = on;
        // Companion picker is bin-segregated out of the colour pass, so
        // it doesn't need a `visible` toggle; its `pickable` flag
        // tracks the visible handle's visibility, redundant alongside
        // the mode filter in `_pick` but cheap and a useful safety net
        // (e.g. if a host adds extra PickStrategies that don't apply
        // our filter).
        const pick = this.viewLayer.objects[`${id}.picker`];
        if (pick) (pick as any).pickable = on;
      }
    };
    set(TRANSLATE_HANDLES, showT);
    set(ROTATE_HANDLES,    showR);
    set(SCALE_HANDLES,     showS);
  }

  // -------------------------------------------------------------
  // Internal: pointer event handling (hover + drag)
  // -------------------------------------------------------------

  private _handlePointerDown(e: PointerEvent): void {
    if (!this._enabled || !this._target || this._mode === "none") return;
    const canvasPos = this._eventCanvasPos(e);
    const picked = this._pick(canvasPos);
    if (!picked) return;

    this._dragHandle = picked;
    this.dragAxis = axisOf(picked) as TransformControlsAxis;
    this.dragging = true;
    this._dragStartCanvas[0] = canvasPos[0];
    this._dragStartCanvas[1] = canvasPos[1];
    // Snapshot every backing mesh's world matrix — the drag math
    // pre-multiplies a single world-space transform against each
    // snapshot, so a SceneObject group rigidly translates / rotates
    // / scales as one. Done once on pointerdown; no per-frame reads.
    this._target.snapshot();
    // Capture the pivot at drag-start. For rotate / scale this stays
    // fixed as the operation's centre; for translate the live
    // `_pivotWorld` is updated each frame so the gizmo moves with
    // the object.
    this._dragPivot[0] = this._pivotWorld[0];
    this._dragPivot[1] = this._pivotWorld[1];
    this._dragPivot[2] = this._pivotWorld[2];

    if (this._debug) {
      const startTrans = this._target.getStartTranslations?.() ?? [];
      const f = (n: number) => n.toFixed(3);
      const startsStr = startTrans
          .map((t) => `[${f(t[0])}, ${f(t[1])}, ${f(t[2])}]`)
          .join(" ");
      console.log(
          `[TransformControls ${this.id}] pointerdown handle="${picked}"` +
          ` mode=${this._mode} space=${this._space}` +
          ` dragPivot=[${f(this._dragPivot[0])}, ${f(this._dragPivot[1])}, ${f(this._dragPivot[2])}]` +
          ` pivotWorld=[${f(this._pivotWorld[0])}, ${f(this._pivotWorld[1])}, ${f(this._pivotWorld[2])}]` +
          ` explicit=${this._explicitPivot}` +
          ` startTranslations=${startsStr || "<empty>"}`
      );
    }

    this._beginDrag(picked, canvasPos);
    this.view.htmlElement.setPointerCapture?.(e.pointerId);
    // Pause the orbit controller (if one was supplied) for the duration
    // of the drag — see the doc on TransformControlsParams.viewController.
    if (this._viewController) {
      this._viewControllerWasActive = this._viewController.active;
      this._viewController.active = false;
    }
    this.events.onDragStart.dispatch(this, {
      axis: this.dragAxis,
      mode: this._mode,
      space: this._space,
    });
    // Block other listeners on the same element (e.g. the host's
    // own click-to-attach handler, or the orbit controller) so a
    // handle-drag isn't interpreted as a re-targeting click or a
    // camera orbit.
    e.preventDefault();
    e.stopPropagation();
    (e as any).stopImmediatePropagation?.();
  }

  private _handlePointerMove(e: PointerEvent): void {
    if (!this._enabled) return;
    const canvasPos = this._eventCanvasPos(e);

    if (this._dragHandle && this._target) {
      this._updateDrag(this._dragHandle, canvasPos);
      // Block the orbit controller (and any other host pointermove
      // listener) so a handle drag isn't simultaneously interpreted
      // as a camera orbit — that's what was making the target "fly
      // off screen" and the canvas clear-colour show through.
      e.preventDefault();
      e.stopPropagation();
      (e as any).stopImmediatePropagation?.();
      return;
    }

    // Hover update
    const picked = this._target && this._mode !== "none" ? this._pick(canvasPos) : null;
    if (picked !== this._hoveredHandleId) {
      this._setHover(picked);
    }
  }

  private _handlePointerUp(e: PointerEvent): void {
    if (!this._dragHandle) return;
    const wasAxis = this.dragAxis;
    this._dragHandle = null;
    this.dragging = false;
    this.dragAxis = null;
    this.view.htmlElement.releasePointerCapture?.(e.pointerId);
    // Restore the orbit controller's prior active state.
    if (this._viewController) {
      this._viewController.active = this._viewControllerWasActive;
    }
    this.events.onDragEnd.dispatch(this, {
      axis: wasAxis,
      mode: this._mode,
      space: this._space,
    });
    // Match the pointerdown / pointermove suppression so the orbit
    // controller doesn't see a stray click after the drag ends.
    e.preventDefault();
    e.stopPropagation();
    (e as any).stopImmediatePropagation?.();
  }

  /**
   * Highlights the hovered handle via the per-view
   * {@link viewing!viewer.ViewObject.colorize | ViewObject.colorize}
   * channel — a multiplicative tint applied at fragment-shading time.
   *
   * The earlier mesh-`color`-mutation path tripped over a renderer
   * upload subtlety: after one round of "set yellow → set back" the
   * data-texture color sometimes stayed at zero. Routing through
   * `ViewObject.colorize` avoids that path entirely; clearing the
   * colorize (set to `null`) cleanly removes the tint, leaving the
   * mesh's own colour intact.
   *
   * Multiplicative tinting means the highlight isn't pure yellow on
   * a red axis — it's a brightened, slightly-yellow-shifted red — but
   * the visual change is clear enough to read as "this handle is
   * armed" and the rendering path is robust.
   */
  private _setHover(handleId: string | null): void {
    if (this._hoveredHandleId) {
      const prev = this.viewLayer.objects[this._hoveredHandleId];
      if (prev) (prev as any).colorize = null;
    }
    this._hoveredHandleId = handleId;
    this.hoveredAxis = handleId ? (axisOf(handleId) as TransformControlsAxis) : null;
    if (handleId) {
      const next = this.viewLayer.objects[handleId];
      if (next) (next as any).colorize = COLOR_HIGHLIGHT;
    }
    this._updateHoverHelpers();
    this.events.onChange.dispatch(this, undefined);
  }

  /**
   * Drives the hover-helper SceneObjects (axis lines that indicate the
   * constraint of the current handle) off the currently-hovered axis.
   * All helpers default to hidden, then the helper(s) named by
   * `helpersForAxis(hoveredAxis)` flip visible. Centralised here so
   * the dispatch path is one place rather than scattered through
   * `_setHover` / mode-change / detach / drag-start.
   */
  private _updateHoverHelpers(): void {
    const wanted = this.hoveredAxis ? new Set(helpersForAxis(this.hoveredAxis)) : null;
    for (const id of HELPER_IDS) {
      const obj = this.viewLayer.objects[id];
      if (!obj) continue;
      (obj as any).visible = !!wanted && wanted.has(id);
    }
  }

  // -------------------------------------------------------------
  // Internal: drag math
  // -------------------------------------------------------------

  private _beginDrag(handleId: string, canvasPos: [number, number]): void {
    const ray = this._canvasPosToRay(canvasPos);
    if (!ray) return;
    const ax = axisOf(handleId);

    if (this._inSet(handleId, [T_X, T_Y, T_Z, S_X, S_Y, S_Z])) {
      const axis = this._axisFromLabel(ax);
      this._dragAxisWorld = axis;
      const p = closestPointOnLineToRay(this._dragPivot, axis, ray.origin, ray.dir);
      if (p) this._dragStartWorld = p;
    } else if (this._inSet(handleId, [T_XY, T_YZ, T_XZ, S_XY, S_YZ, S_XZ])) {
      const normalLabel = (ax === "XY") ? "Z" : (ax === "YZ" ? "X" : "Y");
      const n = this._axisFromLabel(normalLabel);
      this._dragPlaneNormal = n;
      this._dragPlanePoint[0] = this._dragPivot[0];
      this._dragPlanePoint[1] = this._dragPivot[1];
      this._dragPlanePoint[2] = this._dragPivot[2];
      const hit = rayPlane(ray.origin, ray.dir, this._dragPlanePoint, this._dragPlaneNormal);
      if (hit) this._dragStartWorld = hit;
    } else if (handleId === T_XYZ || handleId === S_XYZ || handleId === R_XYZE) {
      const eye = this._cameraEye();
      const fwd = normalizeVec3(subVec3(this._dragPivot, eye, createVec3Float64()), createVec3Float64());
      this._dragPlaneNormal = fwd;
      this._dragPlanePoint[0] = this._dragPivot[0];
      this._dragPlanePoint[1] = this._dragPivot[1];
      this._dragPlanePoint[2] = this._dragPivot[2];
      const hit = rayPlane(ray.origin, ray.dir, this._dragPlanePoint, this._dragPlaneNormal);
      if (hit) this._dragStartWorld = hit;
      if (handleId === R_XYZE) {
        this._dragAxisWorld = fwd;
      }
    } else if (this._inSet(handleId, [R_X, R_Y, R_Z])) {
      const axis = this._axisFromLabel(ax);
      this._dragAxisWorld = axis;
      this._dragPlaneNormal = axis;
      this._dragPlanePoint[0] = this._dragPivot[0];
      this._dragPlanePoint[1] = this._dragPivot[1];
      this._dragPlanePoint[2] = this._dragPivot[2];
      const hit = rayPlane(ray.origin, ray.dir, this._dragPlanePoint, this._dragPlaneNormal);
      if (hit) {
        this._dragStartAngleRef = normalizeVec3(subVec3(hit, this._dragPivot, createVec3Float64()), createVec3Float64());
      }
    } else if (handleId === R_E) {
      const eye = this._cameraEye();
      const fwd = normalizeVec3(subVec3(this._dragPivot, eye, createVec3Float64()), createVec3Float64());
      this._dragAxisWorld = fwd;
      this._dragPlaneNormal = fwd;
      this._dragPlanePoint[0] = this._dragPivot[0];
      this._dragPlanePoint[1] = this._dragPivot[1];
      this._dragPlanePoint[2] = this._dragPivot[2];
      const hit = rayPlane(ray.origin, ray.dir, this._dragPlanePoint, this._dragPlaneNormal);
      if (hit) {
        this._dragStartAngleRef = normalizeVec3(subVec3(hit, this._dragPivot, createVec3Float64()), createVec3Float64());
      }
    }
  }

  private _updateDrag(handleId: string, canvasPos: [number, number]): void {
    if (!this._target) return;
    const ray = this._canvasPosToRay(canvasPos);
    if (!ray) return;

    // ----- TRANSLATE -----
    if (this._inSet(handleId, [T_X, T_Y, T_Z])) {
      const cur = closestPointOnLineToRay(this._dragPivot, this._dragAxisWorld, ray.origin, ray.dir);
      if (!cur) return;
      let d = subVec3(cur, this._dragStartWorld, createVec3Float64());
      d = this._applyTranslationSnap(d);
      this._translateBy(d);
      return;
    }
    if (this._inSet(handleId, [T_XY, T_YZ, T_XZ, T_XYZ])) {
      const cur = rayPlane(ray.origin, ray.dir, this._dragPlanePoint, this._dragPlaneNormal);
      if (!cur) return;
      let d = subVec3(cur, this._dragStartWorld, createVec3Float64());
      d = this._applyTranslationSnap(d);
      this._translateBy(d);
      return;
    }

    // ----- ROTATE -----
    if (this._inSet(handleId, [R_X, R_Y, R_Z, R_E])) {
      const cur = rayPlane(ray.origin, ray.dir, this._dragPlanePoint, this._dragPlaneNormal);
      if (!cur) return;
      const curRef = normalizeVec3(subVec3(cur, this._dragPivot, createVec3Float64()), createVec3Float64());
      const cosA = Math.max(-1, Math.min(1, dotVec3(this._dragStartAngleRef, curRef)));
      const sign = dotVec3(cross3Vec3(this._dragStartAngleRef, curRef, createVec3Float64()), this._dragAxisWorld) >= 0 ? 1 : -1;
      let angle = Math.acos(cosA) * sign;
      angle = this._applyRotationSnap(angle);
      this._applyRotationAroundAxis(this._dragAxisWorld, angle);
      return;
    }
    if (handleId === R_XYZE) {
      // Trackball: small drag in screen space → rotate around axis
      // perpendicular to both drag direction and camera-forward.
      const eye = this._cameraEye();
      const fwd = normalizeVec3(subVec3(this._dragPivot, eye, createVec3Float64()), createVec3Float64());
      const dx = canvasPos[0] - this._dragStartCanvas[0];
      const dy = canvasPos[1] - this._dragStartCanvas[1];
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1e-3) return;
      // Build screen-space axis (right=+x, up=-y); convert to world by camera basis.
      const up: Vec3 = [(this.view.camera as any).up[0], (this.view.camera as any).up[1], (this.view.camera as any).up[2]];
      const right = cross3Vec3(fwd, up, createVec3Float64());
      normalizeVec3(right, right);
      const upTrue = cross3Vec3(right, fwd, createVec3Float64());
      normalizeVec3(upTrue, upTrue);
      const sx = dx / len, sy = -dy / len;
      const dragWorld = addVec3(mulVec3Scalar(right, sx, createVec3Float64()), mulVec3Scalar(upTrue, sy, createVec3Float64()), createVec3Float64());
      const axis = cross3Vec3(dragWorld, fwd, createVec3Float64());
      normalizeVec3(axis, axis);
      let angle = len * 0.005;
      angle = this._applyRotationSnap(angle);
      this._applyRotationAroundAxis(axis, angle);
      return;
    }

    // ----- SCALE -----
    if (this._inSet(handleId, [S_X, S_Y, S_Z])) {
      const cur = closestPointOnLineToRay(this._dragPivot, this._dragAxisWorld, ray.origin, ray.dir);
      if (!cur) return;
      const startD = dotVec3(subVec3(this._dragStartWorld, this._dragPivot, createVec3Float64()), this._dragAxisWorld);
      const curD   = dotVec3(subVec3(cur, this._dragPivot, createVec3Float64()), this._dragAxisWorld);
      let f = startD === 0 ? 1 : curD / startD;
      f = this._applyScaleSnap(f);
      const ax = axisOf(handleId);
      this._applyScaleFactors([
        ax === "X" ? f : 1,
        ax === "Y" ? f : 1,
        ax === "Z" ? f : 1,
      ]);
      return;
    }
    if (this._inSet(handleId, [S_XY, S_YZ, S_XZ])) {
      const cur = rayPlane(ray.origin, ray.dir, this._dragPlanePoint, this._dragPlaneNormal);
      if (!cur) return;
      const startLen = lenVec3(subVec3(this._dragStartWorld, this._dragPivot, createVec3Float64()));
      const curLen   = lenVec3(subVec3(cur, this._dragPivot, createVec3Float64()));
      let f = startLen === 0 ? 1 : curLen / startLen;
      f = this._applyScaleSnap(f);
      const ax = axisOf(handleId);
      this._applyScaleFactors([
        ax === "YZ" ? 1 : f,
        ax === "XZ" ? 1 : f,
        ax === "XY" ? 1 : f,
      ]);
      return;
    }
    if (handleId === S_XYZ) {
      const dx = canvasPos[0] - this._dragStartCanvas[0];
      const dy = canvasPos[1] - this._dragStartCanvas[1];
      let f = 1 + (dx - dy) / 200;
      f = this._applyScaleSnap(f);
      f = Math.max(0.01, f);
      this._applyScaleFactors([f, f, f]);
      return;
    }
  }

  // -------------------------------------------------------------
  // Internal: matrix helpers
  // -------------------------------------------------------------

  private _applyRotationAroundAxis(axis: Vec3, angle: number): void {
    if (!this._target) return;
    // Build the world-space "rotate around pivot" transform
    //   T = T(pivot) × R(axis, angle) × T(-pivot)
    // and apply it to every backing mesh's start matrix. With
    // SceneObject groups this rotates all member meshes as one.
    const q = angleAxisToQuaternion([axis[0], axis[1], axis[2], angle], [0, 0, 0, 1] as Quat);
    const R = quatToMat4(q, identityMat4(createMat4Float64()));
    const Tneg = translationMat4v([-this._dragPivot[0], -this._dragPivot[1], -this._dragPivot[2]]);
    const Tpos = translationMat4v(this._dragPivot);
    const tmp = createMat4Float64();
    mulMat4(R, Tneg, tmp);
    const T = createMat4Float64();
    mulMat4(Tpos, tmp, T);
    if (this._debug) {
      const f = (n: number) => n.toFixed(3);
      console.log(
          `[TransformControls ${this.id}] rotate` +
          ` axis=[${f(axis[0])}, ${f(axis[1])}, ${f(axis[2])}]` +
          ` angle=${((angle * 180) / Math.PI).toFixed(2)}°` +
          ` pivot=[${f(this._dragPivot[0])}, ${f(this._dragPivot[1])}, ${f(this._dragPivot[2])}]`
      );
    }
    this._onTransform(T);
  }

  private _applyScaleFactors(s: Vec3): void {
    if (!this._target) return;
    // Build the world-space "scale around pivot" transform
    //   T = T(pivot) × S(s) × T(-pivot)
    // and apply it to every backing mesh's start matrix.
    const S = identityMat4(createMat4Float64());
    S[0] = s[0]; S[5] = s[1]; S[10] = s[2];
    const Tneg = translationMat4v([-this._dragPivot[0], -this._dragPivot[1], -this._dragPivot[2]]);
    const Tpos = translationMat4v(this._dragPivot);
    const tmp = createMat4Float64();
    mulMat4(S, Tneg, tmp);
    const T = createMat4Float64();
    mulMat4(Tpos, tmp, T);
    if (this._debug) {
      const f = (n: number) => n.toFixed(3);
      console.log(
          `[TransformControls ${this.id}] scale` +
          ` factors=[${f(s[0])}, ${f(s[1])}, ${f(s[2])}]` +
          ` pivot=[${f(this._dragPivot[0])}, ${f(this._dragPivot[1])}, ${f(this._dragPivot[2])}]`
      );
    }
    this._onTransform(T);
  }

  /**
   * Translates the target by the world-space delta `d` (always
   * evaluated from the drag-start snapshot, so repeated calls
   * during a drag are absolute, not cumulative) and advances the
   * live pivot by the same delta so the gizmo's handles follow
   * the object.
   */
  private _translateBy(d: Vec3): void {
    if (!this._target) return;
    const T = translationMat4v([d[0], d[1], d[2]]);
    if (this._debug) {
      const f = (n: number) => n.toFixed(3);
      console.log(
          `[TransformControls ${this.id}] translate` +
          ` delta=[${f(d[0])}, ${f(d[1])}, ${f(d[2])}]` +
          ` dragPivot=[${f(this._dragPivot[0])}, ${f(this._dragPivot[1])}, ${f(this._dragPivot[2])}]` +
          ` newPivot=[${f(this._dragPivot[0] + d[0])}, ${f(this._dragPivot[1] + d[1])}, ${f(this._dragPivot[2] + d[2])}]`
      );
    }
    this._target.applyTransform(T);
    this._pivotWorld[0] = this._dragPivot[0] + d[0];
    this._pivotWorld[1] = this._dragPivot[1] + d[1];
    this._pivotWorld[2] = this._dragPivot[2] + d[2];
    this._syncTransform();
    this.events.onObjectChange.dispatch(this, undefined);
  }

  /**
   * Applies a world-space transform to every backing matrix of the
   * current target, then re-poses the gizmo. The pivot is owned by
   * the gizmo and is **not** re-derived here — translate drags
   * advance `_pivotWorld` themselves so the rig follows the
   * object, while rotate / scale leave it fixed at the operation's
   * centre.
   */
  private _onTransform(T: Mat4): void {
    if (!this._target) return;
    this._target.applyTransform(T);
    this._syncTransform();
    this.events.onObjectChange.dispatch(this, undefined);
  }

  // -------------------------------------------------------------
  // Internal: snap helpers
  // -------------------------------------------------------------

  private _applyTranslationSnap(d: Vec3): Vec3 {
    if (this._translationSnap === null || this._translationSnap === undefined) return d;
    const s = this._translationSnap;
    d[0] = Math.round(d[0] / s) * s;
    d[1] = Math.round(d[1] / s) * s;
    d[2] = Math.round(d[2] / s) * s;
    return d;
  }

  private _applyRotationSnap(angle: number): number {
    if (this._rotationSnap === null || this._rotationSnap === undefined) return angle;
    return Math.round(angle / this._rotationSnap) * this._rotationSnap;
  }

  private _applyScaleSnap(f: number): number {
    if (this._scaleSnap === null || this._scaleSnap === undefined) return f;
    return Math.round(f / this._scaleSnap) * this._scaleSnap;
  }

  // -------------------------------------------------------------
  // Internal: misc helpers
  // -------------------------------------------------------------

  private _axisFromLabel(label: string): Vec3 {
    let base: Vec3;
    switch (label) {
      case "X": base = X_AXIS; break;
      case "Y": base = Y_AXIS; break;
      case "Z": base = Z_AXIS; break;
      default: return [0, 0, 0];
    }
    if (this._space === "world") return [base[0], base[1], base[2]];
    const r = this._rotationWorld;
    return [
      r[0] * base[0] + r[4] * base[1] + r[8]  * base[2],
      r[1] * base[0] + r[5] * base[1] + r[9]  * base[2],
      r[2] * base[0] + r[6] * base[1] + r[10] * base[2],
    ];
  }

  private _inSet(id: string, set: string[]): boolean {
    return set.indexOf(id) >= 0;
  }

  private _cameraEye(): Vec3 {
    const c = this.view.camera as any;
    return [c.eye[0], c.eye[1], c.eye[2]];
  }

  private _canvasSize(): [number, number] {
    const el = this.view.htmlElement as HTMLElement;
    const rect = (el.getBoundingClientRect ? el.getBoundingClientRect() : {width: 1, height: 1}) as DOMRect;
    return [(rect as any).width || 1, (rect as any).height || 1];
  }

  /**
   * Picks a gizmo handle under `canvasPos`. Delegates to the
   * {@link spatial!picking.PickStrategy | PickStrategy} configured at
   * construction, narrowing it to this gizmo's own handle ids via
   * {@link spatial!picking.PickParams.filter | filter} so the picker
   * never even considers the host scene. Returns the picked handle id,
   * or null when nothing we own is under the cursor.
   */
  private _pick(canvasPos: [number, number]): string | null {
    const p = this._picker;
    if (!p) return null;
    // Mode-scoped pickable set: translate-mode picks may only land on
    // translate handles (+ their pickers), etc. The renderer's
    // viewObject.pickable flag *should* gate this on its own, but in
    // practice translate-axis and scale-axis pickers cover the same
    // world-space region — relying on the GPU pick to honour pickable
    // wasn't deterministic (you'd get a scale drag while in translate
    // mode). Filtering client-side here is unambiguous and cheap.
    const activeHandles =
      this._mode === "translate" ? TRANSLATE_HANDLES :
      this._mode === "rotate"    ? ROTATE_HANDLES :
      this._mode === "scale"     ? SCALE_HANDLES :
      [];
    const allow = new Set<string>();
    for (const h of activeHandles) {
      allow.add(h);
      allow.add(`${h}.picker`);
    }
    // Pickers are now ViewObject-visible (their non-rendering is bin-
    // based, not visibility-based), so `pickInvisible: true` is no
    // longer load-bearing for hitting them — but we keep it on as a
    // safety belt. The filter narrows the pick to the current-mode
    // handle ids (+ their `.picker` siblings), so no other scene
    // content can sneak through whatever visibility state it's in.
    const result = p.pick({
      view: this.view,
      canvasPos,
      pickInvisible: true,
      filter: (objectId: string) => allow.has(objectId),
    });
    if (!result || !result.hit) return null;
    const id = result.objectId as string;
    // Map a picker-collider hit back to the visible handle it shadows.
    return id.endsWith(".picker") ? id.slice(0, -".picker".length) : id;
  }

  /**
   * Builds a world-space ray from a canvas position. Unprojects NDC
   * points at the near and far planes through `inverse(proj × view)`,
   * doing the **perspective division** that `transformPoint3` skips —
   * without it, the resulting world points are scaled by an arbitrary
   * `1/w`, the ray is junk, and the drag math drops the target into
   * outer space (the bug that was making the target "disappear" and
   * the canvas clear-colour bleed through as "black").
   */
  private _canvasPosToRay(canvasPos: [number, number]): {origin: Vec3, dir: Vec3} | null {
    const [w, h] = this._canvasSize();
    const ndcX =  (canvasPos[0] / w) * 2 - 1;
    const ndcY = -(canvasPos[1] / h) * 2 + 1;
    const cam: any = this.view.camera;
    const vp = mulMat4(cam.projMatrix, cam.viewMatrix, createMat4Float64());
    const inv = inverseMat4(vp, createMat4Float64());
    if (!inv) return null;
    const tmp = createVec4Float64();
    transformPoint4(inv, [ndcX, ndcY, -1, 1] as Vec4, tmp);
    if (Math.abs(tmp[3]) < 1e-12) return null;
    const near: Vec3 = [tmp[0] / tmp[3], tmp[1] / tmp[3], tmp[2] / tmp[3]];
    transformPoint4(inv, [ndcX, ndcY,  1, 1] as Vec4, tmp);
    if (Math.abs(tmp[3]) < 1e-12) return null;
    const far: Vec3 = [tmp[0] / tmp[3], tmp[1] / tmp[3], tmp[2] / tmp[3]];
    const dir = normalizeVec3(subVec3(far, near, createVec3Float64()), createVec3Float64());
    return {origin: near, dir};
  }

  private _eventCanvasPos(e: PointerEvent): [number, number] {
    const el = this.view.htmlElement as HTMLElement;
    const rect = (el.getBoundingClientRect ? el.getBoundingClientRect() : {left: 0, top: 0}) as DOMRect;
    return [e.clientX - (rect as any).left, e.clientY - (rect as any).top];
  }
}

// -------------------------------------------------------------
// Geometry helpers (off-class for clarity).
// -------------------------------------------------------------

function rayPlane(origin: Vec3, dir: Vec3, planePoint: Vec3, planeNormal: Vec3): Vec3 | null {
  const denom = dotVec3(dir, planeNormal);
  if (Math.abs(denom) < 1e-8) return null;
  const t = dotVec3(subVec3(planePoint, origin, createVec3Float64()), planeNormal) / denom;
  if (!isFinite(t)) return null;
  return addVec3(origin, mulVec3Scalar(dir, t, createVec3Float64()), createVec3Float64());
}

function closestPointOnLineToRay(linePoint: Vec3, lineDir: Vec3, rayOrigin: Vec3, rayDir: Vec3): Vec3 | null {
  const u = lineDir;
  const v = rayDir;
  const w0 = subVec3(linePoint, rayOrigin, createVec3Float64());
  const a = dotVec3(u, u);
  const b = dotVec3(u, v);
  const c = dotVec3(v, v);
  const d = dotVec3(u, w0);
  const e = dotVec3(v, w0);
  const denom = a * c - b * b;
  if (Math.abs(denom) < 1e-8) return null;
  const sc = (b * e - c * d) / denom;
  return addVec3(linePoint, mulVec3Scalar(u, sc, createVec3Float64()), createVec3Float64());
}

function rayAABB(origin: Vec3, dir: Vec3, aabb: number[]): number | null {
  let tmin = -Infinity;
  let tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    const o = origin[i];
    const d = dir[i];
    const lo = aabb[i];
    const hi = aabb[i + 3];
    if (Math.abs(d) < 1e-8) {
      if (o < lo || o > hi) return null;
    } else {
      const t1 = (lo - o) / d;
      const t2 = (hi - o) / d;
      const tNear = Math.min(t1, t2);
      const tFar  = Math.max(t1, t2);
      tmin = Math.max(tmin, tNear);
      tmax = Math.min(tmax, tFar);
      if (tmin > tmax) return null;
    }
  }
  return tmin >= 0 ? tmin : (tmax >= 0 ? tmax : null);
}
