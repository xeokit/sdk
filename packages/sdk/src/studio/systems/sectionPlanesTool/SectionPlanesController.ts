import {EventDispatcher} from "strongly-typed-events";
import {EventEmitter} from "../../../base/core";
import {TrianglesPrimitive} from "../../../base/constants";
import type {Vec3} from "../../../base/math/vector";
import type {Mat4} from "../../../base/math/matrix";
import type {SceneModel} from "../../../model/scene";
import {TransformControls} from "../../../viewing/transformControls";
import type {SectionPlane, View, Viewer} from "../../../viewing/viewer";
import {SectionPlaneAdapter, fillPlaneMatrix} from "./SectionPlaneAdapter";


/** Mutually-exclusive gizmo mode for editing the active plane. */
export type SectionPlanesEditMode = "translate" | "rotate";


/**
 * Per-{@link View} bridge between {@link SectionPlane | section
 * planes}, a translucent visual proxy quad for each, and the
 * {@link TransformControls} gizmo used to drag / orient them.
 *
 * The controller manages **every** section plane in its View, not
 * just the ones it created — it subscribes to
 * {@link Viewer.events.onSectionPlaneCreated} /
 * `onSectionPlaneDestroyed` so a plane added by other code still
 * gets a proxy and shows up in the panel.
 *
 * The proxy quad is a single 2D-ish surface in a dedicated
 * {@link SceneModel} on a dedicated {@link ViewLayer}, drawn in
 * the renderer's `"overlay"` bin so it isn't clipped by its own
 * plane (or any other plane) and survives the depth-cleared
 * overlay pass.
 *
 * {@link SectionPlanesPanel} reads the controller's state and
 * forwards UI events (delete, select, mode toggle, active toggle)
 * to the matching public API.
 */
export class SectionPlanesController {

  private static readonly _instances = new WeakMap<View, SectionPlanesController>();

  static getFor(view: View): SectionPlanesController | undefined {
    const inst = SectionPlanesController._instances.get(view);
    return inst && !inst._destroyed ? inst : undefined;
  }

  static openFor(view: View): SectionPlanesController {
    const existing = SectionPlanesController._instances.get(view);
    if (existing && !existing._destroyed) return existing;
    return new SectionPlanesController(view);
  }

  readonly view: View;
  readonly sceneModel: SceneModel;

  /**
   * Fires when a section plane has been added or removed (either
   * via {@link createSectionPlane} or because external code
   * created / destroyed one). The panel listens to redraw.
   */
  readonly onChanged = new EventEmitter<SectionPlanesController, void>(
    new EventDispatcher<SectionPlanesController, void>(),
  );

  /**
   * Fires whenever the controller's gizmo target or edit mode
   * changes — including detach (`{plane: null}`).
   */
  readonly onSelectionChanged = new EventEmitter<SectionPlanesController, {
    plane: SectionPlane | null;
    mode: SectionPlanesEditMode;
  }>(new EventDispatcher<SectionPlanesController, {plane: SectionPlane | null; mode: SectionPlanesEditMode}>());

  /** Half-size, in world units, of the per-plane translucent
   *  proxy quad. The visual is `2 * halfSize` across. */
  private readonly _proxyHalf = 2.0;

  /** Per-plane proxy mesh id (in the controller's SceneModel). */
  private readonly _meshes = new Map<SectionPlane, string>();

  /** Currently-attached plane (gizmo target), or null. */
  private _selected: SectionPlane | null = null;
  /** Gizmo edit mode. */
  private _mode: SectionPlanesEditMode = "translate";

  /** True while the tool is active — controls proxy visibility. */
  private _visible = false;

  /** Subscription handles for the viewer-level events. */
  private readonly _unsubs: Array<() => void> = [];

  private _destroyed = false;

  /** Suppress `onSectionPlanePosChanged` / `onSectionPlaneDirChanged`
   *  re-entry while the gizmo is the source of a change. Otherwise
   *  the controller's listeners would re-issue setMatrix during a
   *  drag and stutter the gizmo. */
  private _dragging = false;

  private constructor(view: View) {
    this.view = view;
    SectionPlanesController._instances.set(view, this);

    const viewer: Viewer = view.viewer;

    const sceneCoord = viewer.scene.coordinateSystem.toParams();
    const layerId = `__sp.${view.id}`;
    // autoDestroy: false matches TransformControls — the layer
    // and SceneModel are owned by this controller's lifetime,
    // not by any single SceneObject's destruction.
    const layerRes = view.createLayer({id: layerId, autoDestroy: false});
    if (layerRes.ok !== true) {
      throw new Error(`[SectionPlanesController] createLayer failed: ${layerRes.error}`);
    }
    const modelRes = viewer.scene.createModel({
      id: layerId,
      layerId,
      coordinateSystem: sceneCoord,
    });
    if (modelRes.ok !== true) {
      throw new Error(`[SectionPlanesController] createModel failed: ${modelRes.error}`);
    }
    this.sceneModel = modelRes.value;

    // Single shared quad geometry; per-mesh matrices place each
    // plane's proxy. The geometry is XY-aligned and 4 units
    // across (2 * _proxyHalf); the matrix's local +Z axis
    // becomes the plane's normal direction.
    const h = this._proxyHalf;
    const geomRes = this.sceneModel.createGeometry({
      id: "__sp.quad",
      primitive: TrianglesPrimitive,
      positions: [
        -h, -h, 0,   h, -h, 0,   h,  h, 0,   -h,  h, 0,
      ],
      indices: [0, 1, 2,  0, 2, 3],
    });
    if (geomRes.ok !== true) {
      throw new Error(`[SectionPlanesController] createGeometry failed: ${geomRes.error}`);
    }

    // Pick up any section planes that already exist on the view
    // at construction time — keeps the controller idempotent
    // across re-openings of the tool.
    for (const plane of view.sectionPlanesList) {
      this._addProxy(plane);
    }

    // Track future creations / destructions from any source.
    this._unsubs.push(
      viewer.events.onSectionPlaneCreated.subscribe((srcView, plane) => {
        if (srcView !== view) return;
        this._addProxy(plane);
        this.onChanged.dispatch(this, undefined);
      }),
      viewer.events.onSectionPlaneDestroyed.subscribe((srcView, plane) => {
        if (srcView !== view) return;
        this._removeProxy(plane);
        if (this._selected === plane) this.clearSelection();
        this.onChanged.dispatch(this, undefined);
      }),
      viewer.events.onSectionPlanePosChanged.subscribe((plane) => {
        if (plane.view !== view) return;
        if (this._dragging) return;
        this._syncProxyMatrix(plane);
      }),
      viewer.events.onSectionPlaneDirChanged.subscribe((plane) => {
        if (plane.view !== view) return;
        if (this._dragging) return;
        this._syncProxyMatrix(plane);
      }),
    );
  }


  // ── Public API ─────────────────────────────────────────────────

  /**
   * Create a new section plane at the world point `pos` with
   * normal `dir`. Auto-selects the new plane as the gizmo target.
   * Returns the created plane on success.
   */
  createSectionPlane(pos: Vec3, dir: Vec3): SectionPlane | null {
    if (this._destroyed) return null;
    const res = this.view.createSectionPlane({pos, dir, active: true});
    if (res.ok !== true) {
      console.warn("[SectionPlanesController] createSectionPlane failed:", res.error);
      return null;
    }
    // `onSectionPlaneCreated` already fired during createSectionPlane
    // and added the proxy + dispatched onChanged.
    this.select(res.value);
    return res.value;
  }

  /** All section planes managed by this controller (which equals
   *  every section plane in the controller's View). */
  list(): SectionPlane[] {
    return this.view.sectionPlanesList.filter((p) => !p.destroyed);
  }

  /** Currently-attached plane, or `null`. */
  get selected(): SectionPlane | null { return this._selected; }

  /** Active gizmo mode. */
  get mode(): SectionPlanesEditMode { return this._mode; }

  /** Attach the gizmo to `plane` and switch the controller's
   *  edit mode if necessary. Detach with `null`. */
  select(plane: SectionPlane | null): void {
    if (this._destroyed) return;
    if (plane && plane.destroyed) plane = null;
    if (plane === this._selected) {
      if (plane) this._applyGizmo(plane, this._mode);
      return;
    }
    this._selected = plane;
    if (plane) {
      this._applyGizmo(plane, this._mode);
    } else {
      const tc = TransformControls.getFor(this.view);
      if (tc) tc.detach();
    }
    this.onSelectionChanged.dispatch(this, {plane, mode: this._mode});
  }

  clearSelection(): void { this.select(null); }

  /** Toggle between translate and rotate gizmo handles. */
  setMode(mode: SectionPlanesEditMode): void {
    if (this._destroyed) return;
    if (mode === this._mode) return;
    this._mode = mode;
    if (this._selected) this._applyGizmo(this._selected, mode);
    this.onSelectionChanged.dispatch(this, {plane: this._selected, mode});
  }

  /** Destroy a plane (and its proxy). The
   *  `onSectionPlaneDestroyed` listener handles the cleanup. */
  remove(plane: SectionPlane): void {
    if (plane.destroyed) return;
    plane.destroy();
  }

  /** Show or hide every proxy quad and (when hiding) detach the
   *  gizmo. Called by the toolbar as the section-planes tool is
   *  turned on / off. */
  setVisible(visible: boolean): void {
    if (this._destroyed) return;
    if (visible === this._visible) return;
    this._visible = visible;
    // Toggle per-proxy visibility via the View's ViewObject layer.
    for (const [, meshId] of this._meshes) {
      const objId = this._objectIdForMesh(meshId);
      const vo = this.view.objects[objId];
      if (vo) vo.visible = visible;
    }
    if (!visible) this.clearSelection();
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    for (const u of this._unsubs) { try { u(); } catch { /* ignore */ } }
    this._unsubs.length = 0;
    this.clearSelection();
    // Destroying the SceneModel cascades through its meshes and
    // objects. The dedicated ViewLayer keeps existing until the
    // view itself is destroyed (autoDestroy: false).
    if (!this.sceneModel.destroyed) this.sceneModel.destroy();
    if (SectionPlanesController._instances.get(this.view) === this) {
      SectionPlanesController._instances.delete(this.view);
    }
  }


  // ── Proxy management ───────────────────────────────────────────

  private _addProxy(plane: SectionPlane): void {
    if (this._meshes.has(plane)) return;
    const meshId = `__sp.mesh.${plane.id}`;
    const objId  = `__sp.obj.${plane.id}`;
    const matrix = new Array(16) as unknown as Mat4;
    fillPlaneMatrix(plane.pos, plane.dir, matrix);

    const meshRes = this.sceneModel.createMesh({
      id: meshId,
      geometryId: "__sp.quad",
      color: [0.30, 0.65, 0.90],
      opacity: 0.28,
      matrix: Array.from(matrix) as unknown as Mat4,
      bin: "overlay",
    });
    if (meshRes.ok !== true) {
      console.warn("[SectionPlanesController] createMesh failed:", meshRes.error);
      return;
    }
    const objRes = this.sceneModel.createObject({
      id: objId,
      meshIds: [meshId],
      layerId: this.sceneModel.id,
      // Proxy quads are tool UI — they must never self-clip
      // against the very plane they represent, nor against any
      // other section plane in the View.
      clippable: false,
    });
    if (objRes.ok !== true) {
      console.warn("[SectionPlanesController] createObject failed:", objRes.error);
      return;
    }
    this._meshes.set(plane, meshId);

    // Honour the controller's overall visibility setting at
    // construction — proxies stay hidden until the tool is turned
    // on so a freshly-imported model doesn't show its planes
    // until the user reaches for them.
    const vo = this.view.objects[objId];
    if (vo) vo.visible = this._visible;
  }

  private _removeProxy(plane: SectionPlane): void {
    const meshId = this._meshes.get(plane);
    if (!meshId) return;
    this._meshes.delete(plane);
    const objId = this._objectIdForMesh(meshId);
    // Destroying the SceneObject cascades to its mesh; if you
    // re-add a plane with the same id, the geometry handle on
    // the SceneModel is shared and survives.
    const obj = this.sceneModel.objects?.[objId];
    if (obj) obj.destroy();
  }

  /** Re-write the proxy mesh's matrix to match the plane's
   *  current `pos` / `dir`. Called when external code mutates
   *  the plane (drag-from-gizmo updates are flowing through
   *  `_dragging`-suppressed paths). */
  private _syncProxyMatrix(plane: SectionPlane): void {
    const meshId = this._meshes.get(plane);
    if (!meshId) return;
    const mesh = this.sceneModel.meshes?.[meshId];
    if (!mesh) return;
    const matrix = new Array(16) as unknown as Mat4;
    fillPlaneMatrix(plane.pos, plane.dir, matrix);
    mesh.matrix = matrix;
  }

  private _objectIdForMesh(meshId: string): string {
    // Mirrors the `__sp.mesh.<id>` / `__sp.obj.<id>` naming
    // convention from `_addProxy`. Kept as a derived lookup
    // rather than a second Map to keep `_meshes` the single
    // source of truth.
    return meshId.replace("__sp.mesh.", "__sp.obj.");
  }


  // ── Gizmo wiring ───────────────────────────────────────────────

  /**
   * Attach the gizmo to `plane` and configure its mode + the
   * synced-proxy update path. The adapter writes through to
   * the section plane's `pos` / `dir`; we mark `_dragging` true
   * around the write so our own `onSectionPlanePosChanged`
   * listener doesn't bounce back into a redundant proxy-matrix
   * sync (the proxy will track the SectionPlane via the same
   * matrix that the gizmo just installed on its own target).
   */
  private _applyGizmo(plane: SectionPlane, mode: SectionPlanesEditMode): void {
    const tc = TransformControls.getFor(this.view) ?? new TransformControls({view: this.view});
    const baseAdapter = new SectionPlaneAdapter(plane);
    const adapter = {
      getMatrix: () => baseAdapter.getMatrix(),
      setMatrix: (m: Float64Array | number[]) => {
        this._dragging = true;
        try {
          baseAdapter.setMatrix(m);
        } finally {
          this._dragging = false;
        }
        // The proxy mesh's own matrix needs to track the gizmo
        // even though we suppressed the listener — keep it in
        // step here.
        this._syncProxyMatrix(plane);
      },
    };
    tc.attach(adapter as unknown as Parameters<TransformControls["attach"]>[0]);
    tc.setMode(mode);
  }
}
