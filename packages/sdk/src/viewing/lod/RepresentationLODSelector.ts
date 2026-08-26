import {CustomProjectionType, OrthoProjectionType, PerspectiveProjectionType} from "../../base/constants";
import {
  AABB3ToOBB3,
  collapseAABB3,
  createAABB3Float64,
  expandAABB3,
  getAABB3Center,
  getAABB3Diag,
  OBB3ToAABB3,
  type AABB3
} from "../../base/math/boundaries";
import {transformVec4} from "../../base/math/matrix";
import {createVec4Float64} from "../../base/math/vector";
import type {SceneModel, SceneObject, SceneRep, SceneRepSet} from "../../model/scene";
import type {View, Viewer} from "../viewer";
import type {LODRepSelection} from "./LODVisibility";
import type {RepresentationLODSelectorParams} from "./RepresentationLODSelectorParams";

/**
 * Per-view representation selection mode for one SceneModel representation set.
 */
export type RepresentationLODMode = "default" | "selected" | "invalid";

interface RepSetState {
  repSet: SceneRepSet;
  selectionId: string;
  reps: LODRepSelection[];
  center: [number, number, number];
  radius: number;
  activeByViewId: Map<string, string>;
}

const tempOBBPoint = createVec4Float64();

/**
 * Selects SceneModel representations as LODs.
 *
 * The selector consumes representation sets authored in SceneModels. It does
 * not generate shells, create meshes or mutate SceneModel content. For each
 * view, it selects one representation from each eligible representation set
 * and updates {@link LODVisibility} so renderers draw only that representation.
 * This provides a fast path for switching visibility of large object groups:
 * selection changes record the active representation per View, while renderers
 * suppress non-selected representation memberships without rewriting ordinary
 * object visibility for every object.
 *
 * A representation set is eligible when it declares:
 *
 * ```ts
 * selection: {
 *   strategy: "projectedSize"
 * }
 * ```
 *
 * Selection uses the representation `range.minPixels` and `range.maxPixels`
 * metadata. If no range matches, the set's default representation is used.
 */
export class RepresentationLODSelector {
  /**
   * Whether this selector is actively applying representation suppression.
   */
  public enabled: boolean;

  private readonly _viewer: Viewer;
  private readonly _subs: (() => void)[] = [];
  private readonly _sceneSubs: (() => void)[] = [];
  private readonly _states = new Map<SceneRepSet, RepSetState>();

  /**
   * Creates a representation LOD selector.
   *
   * @param params Selector parameters.
   */
  constructor(params: RepresentationLODSelectorParams) {
    this._viewer = params.viewer;
    this.enabled = params.enabled !== false;
    const events = this._viewer.events;
    this._subs.push(
      events.onCameraViewMatrixUpdated.subscribe((view) => this.updateView(view)),
      events.onCameraProjMatrixUpdated.subscribe((view) => this.updateView(view)),
      events.onCameraProjectionTypeChanged.subscribe((view) => this.updateView(view)),
      events.onViewCanvasBoundaryChanged.subscribe((view) => this.updateView(view)),
      events.onViewCreated.subscribe((_viewer, view) => this.updateView(view)),
      events.onViewDestroyed.subscribe((_viewer, view) => this.clearView(view.id)),
      events.onSceneAttached.subscribe(() => this._installScene()),
      events.onSceneDetached.subscribe(() => this._clearScene())
    );
    this._installScene();
    this.updateAllViews();
  }

  /**
   * Enables or disables the selector.
   *
   * Disabling clears only selector-owned LOD suppression. It does not mutate
   * ordinary ViewObject visibility.
   *
   * @param enabled New enabled state.
   */
  public setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) {
      return;
    }
    this.enabled = enabled;
    if (enabled) {
      this.updateAllViews();
    } else {
      this.clear();
    }
  }

  /**
   * Updates representation selection for every current view.
   */
  public updateAllViews(): void {
    const views = this._viewer.viewList;
    for (let i = 0, len = views.length; i < len; i++) {
      const view = views[i];
      if (view && !view.destroyed) {
        this.updateView(view);
      }
    }
  }

  /**
   * Updates representation selection for one view.
   *
   * @param view View to update.
   */
  public updateView(view: View): void {
    if (!this.enabled || view.destroyed) {
      return;
    }
    for (const state of this._states.values()) {
      this._updateRepSetForView(state, view);
    }
  }

  /**
   * Gets the selected representation ID for one view and representation set.
   *
   * @param view View to inspect.
   * @param repSet Representation set.
   * @returns Selected representation ID, or the default representation ID when
   * the selector has not selected the set in that view.
   */
  public getActiveRepId(view: View, repSet: SceneRepSet): string {
    return this._states.get(repSet)?.activeByViewId.get(view.id) ?? repSet.defaultRepId;
  }

  /**
   * Gets the selector mode for a representation set in one view.
   *
   * @param view View to inspect.
   * @param repSet Representation set.
   */
  public getMode(view: View, repSet: SceneRepSet): RepresentationLODMode {
    const state = this._states.get(repSet);
    if (!state || state.radius <= 0 || repSet.destroyed) {
      return "invalid";
    }
    return this.getActiveRepId(view, repSet) === repSet.defaultRepId ? "default" : "selected";
  }

  /**
   * Clears all selector-owned LOD suppression state.
   */
  public clear(): void {
    for (const state of this._states.values()) {
      for (const viewId of Array.from(state.activeByViewId.keys())) {
        this._setAllUnsuppressed(viewId, state);
      }
      state.activeByViewId.clear();
    }
  }

  /**
   * Clears selector state for one view.
   *
   * @param viewId View ID.
   */
  public clearView(viewId: string): void {
    for (const state of this._states.values()) {
      this._setAllUnsuppressed(viewId, state);
      state.activeByViewId.delete(viewId);
    }
  }

  /**
   * Destroys the selector and clears its LOD suppression state.
   */
  public destroy(): void {
    this.clear();
    for (let i = 0, len = this._subs.length; i < len; i++) {
      this._subs[i]();
    }
    this._subs.length = 0;
    this._clearScene();
  }

  private _installScene(): void {
    this._clearScene();
    const scene = this._viewer.scene;
    if (!scene) {
      return;
    }
    for (const modelId in scene.models) {
      this._addModel(scene.models[modelId]);
    }
    const events = scene.events;
    this._sceneSubs.push(
      events.onSceneModelCreated.subscribe((_scene, model) => this._addModel(model)),
      events.onSceneModelDestroyed.subscribe((_scene, model) => this._removeModel(model)),
      events.onSceneRepSetCreated.subscribe((_model, repSet) => {
        const state = this._addRepSet(repSet);
        if (state) {
          this._updateStateAllViews(state);
        }
      }),
      events.onSceneRepSetDestroyed.subscribe((_model, repSet) => this._removeRepSet(repSet)),
      events.onSceneObjectDestroyed.subscribe((_scene, object) => this._removeObject(object)),
      events.onSceneObjectMeshAdded.subscribe((object) => this._refreshObject(object)),
      events.onSceneObjectMeshRemoved.subscribe((object) => this._refreshObject(object)),
      events.onSceneMeshMatrixChanged.subscribe((_scene, mesh) => mesh.object && this._refreshObject(mesh.object)),
      events.onSceneMeshMoved.subscribe((_scene, mesh) => mesh.object && this._refreshObject(mesh.object)),
      events.onSceneGeometryUpdated.subscribe((_scene, geometry) => this._refreshGeometry(geometry.id, geometry.model)),
      events.onSceneGeometryDestroyed.subscribe((_scene, geometry) => this._refreshGeometry(geometry.id, geometry.model))
    );
  }

  private _clearScene(): void {
    this.clear();
    for (let i = 0, len = this._sceneSubs.length; i < len; i++) {
      this._sceneSubs[i]();
    }
    this._sceneSubs.length = 0;
    this._states.clear();
  }

  private _addModel(model: SceneModel): void {
    for (const id in model.repSets) {
      this._addRepSet(model.repSets[id]);
    }
  }

  private _removeModel(model: SceneModel): void {
    for (const state of Array.from(this._states.values())) {
      if (state.repSet.model === model) {
        this._removeRepSet(state.repSet);
      }
    }
  }

  private _addRepSet(repSet: SceneRepSet): RepSetState | null {
    if (repSet.destroyed || repSet.selection?.strategy !== "projectedSize" || this._states.has(repSet)) {
      return null;
    }
    const state = this._createState(repSet);
    if (state) {
      this._states.set(repSet, state);
      return state;
    }
    return null;
  }

  private _removeRepSet(repSet: SceneRepSet): void {
    const state = this._states.get(repSet);
    if (!state) {
      return;
    }
    for (const viewId of Array.from(state.activeByViewId.keys())) {
      this._setAllUnsuppressed(viewId, state);
    }
    this._states.delete(repSet);
  }

  private _removeObject(object: SceneObject): void {
    const repSets = object.model.getRepSetsForObject(object.id);
    for (let i = 0, len = repSets.length; i < len; i++) {
      this._removeRepSet(repSets[i]);
    }
  }

  private _refreshObject(object: SceneObject): void {
    const repSets = object.model.getRepSetsForObject(object.id);
    for (let i = 0, len = repSets.length; i < len; i++) {
      this._refreshRepSet(repSets[i]);
    }
  }

  private _refreshGeometry(_geometryId: string, model: SceneModel | null): void {
    if (!model) {
      return;
    }
    for (const repSet of Object.values(model.repSets)) {
      this._refreshRepSet(repSet);
    }
  }

  private _refreshRepSet(repSet: SceneRepSet): void {
    const previous = this._states.get(repSet);
    if (!previous) {
      this._addRepSet(repSet);
      return;
    }
    const refreshed = this._createState(repSet);
    if (!refreshed) {
      this._removeRepSet(repSet);
      return;
    }
    this._states.set(repSet, refreshed);
    for (const viewId of Array.from(previous.activeByViewId.keys())) {
      this._viewer.lodVisibility.clearSelectedRep(viewId, previous.selectionId);
    }
    this._updateStateAllViews(refreshed);
  }

  private _createState(repSet: SceneRepSet): RepSetState | null {
    const aabb = computeRepSetAABB(repSet);
    if (!aabb) {
      return null;
    }
    const center = getAABB3Center(aabb, [0, 0, 0] as any) as [number, number, number];
    return {
      repSet,
      selectionId: `${repSet.model.id}:${repSet.id}`,
      reps: Object.values(repSet.reps).map((rep) => ({
        id: rep.id,
        objectIds: rep.objectIds
      })),
      center,
      radius: getAABB3Diag(aabb) * 0.5,
      activeByViewId: new Map()
    };
  }

  private _updateRepSetForView(state: RepSetState, view: View): void {
    if (state.radius <= 0 || state.repSet.destroyed) {
      return;
    }
    const selectedRepId = this._selectRepId(state, view);
    const previousRepId = state.activeByViewId.get(view.id);
    if (previousRepId === selectedRepId) {
      return;
    }
    state.activeByViewId.set(view.id, selectedRepId);
    const changed = this._viewer.lodVisibility.setSelectedRep(view.id, state.selectionId, state.reps, selectedRepId);
    if (changed) {
      view.needsRender();
    }
  }

  private _updateStateAllViews(state: RepSetState): void {
    const views = this._viewer.viewList;
    for (let i = 0, len = views.length; i < len; i++) {
      const view = views[i];
      if (view && !view.destroyed) {
        this._updateRepSetForView(state, view);
      }
    }
  }

  private _selectRepId(state: RepSetState, view: View): string {
    const projectedPixels = getProjectedDiameterPixels(view, state.center, state.radius);
    if (!Number.isFinite(projectedPixels)) {
      return state.repSet.defaultRepId;
    }

    const previousRepId = state.activeByViewId.get(view.id);
    if (previousRepId) {
      const previous = state.repSet.reps[previousRepId];
      const hysteresisPixels = state.repSet.selection?.hysteresisPixels ?? 0;
      if (previous && rangeContains(previous, projectedPixels, hysteresisPixels)) {
        return previous.id;
      }
    }

    for (const rep of Object.values(state.repSet.reps)) {
      if (rangeContains(rep, projectedPixels, 0)) {
        return rep.id;
      }
    }
    return state.repSet.defaultRepId;
  }

  private _setAllUnsuppressed(viewId: string, state: RepSetState): void {
    this._viewer.lodVisibility.clearSelectedRep(viewId, state.selectionId);
  }
}

function rangeContains(rep: SceneRep, projectedPixels: number, hysteresisPixels: number): boolean {
  const range = rep.range;
  const minPixels = range?.minPixels;
  const maxPixels = range?.maxPixels;
  if (minPixels !== undefined && projectedPixels < minPixels - hysteresisPixels) {
    return false;
  }
  if (maxPixels !== undefined && projectedPixels > maxPixels + hysteresisPixels) {
    return false;
  }
  return true;
}

function collectObjectIds(repSet: SceneRepSet): string[] {
  const objectIds = new Set<string>();
  for (const rep of Object.values(repSet.reps)) {
    for (let i = 0, len = rep.objectIds.length; i < len; i++) {
      objectIds.add(rep.objectIds[i]);
    }
  }
  return Array.from(objectIds);
}

function computeRepSetAABB(repSet: SceneRepSet): AABB3 | null {
  const aabb = collapseAABB3(createAABB3Float64());
  let found = false;
  for (const objectId of collectObjectIds(repSet)) {
    const object = repSet.model.objects[objectId];
    if (!object || object.destroyed) {
      continue;
    }
    for (let i = 0, len = object.meshes.length; i < len; i++) {
      const mesh = object.meshes[i];
      const meshAABB = mesh.geometry.aabb;
      if (!meshAABB) {
        continue;
      }
      const obb = AABB3ToOBB3(meshAABB);
      for (let j = 0; j < obb.length; j += 4) {
        const p = transformVec4(mesh.worldMatrix, [obb[j], obb[j + 1], obb[j + 2], obb[j + 3]], tempOBBPoint);
        obb[j] = p[0];
        obb[j + 1] = p[1];
        obb[j + 2] = p[2];
        obb[j + 3] = p[3];
      }
      expandAABB3(aabb, OBB3ToAABB3(obb));
      found = true;
    }
  }
  return found ? aabb : null;
}

function getProjectedDiameterPixels(view: View, center: [number, number, number], radius: number): number {
  const width = Math.max(1, Number(view.boundary?.[2] || view.htmlElement?.clientWidth || 1));
  const height = Math.max(1, Number(view.boundary?.[3] || view.htmlElement?.clientHeight || 1));
  const camera = view.camera;
  if (camera.projectionType === OrthoProjectionType) {
    const proj = camera.projMatrix as ArrayLike<number>;
    const radiusX = Math.abs(proj[0]) * radius * width * 0.5;
    const radiusY = Math.abs(proj[5]) * radius * height * 0.5;
    return Math.max(radiusX, radiusY) * 2;
  }
  if (camera.projectionType !== PerspectiveProjectionType && camera.projectionType !== CustomProjectionType) {
    return Number.POSITIVE_INFINITY;
  }
  const eye = camera.eye;
  const dx = eye[0] - center[0];
  const dy = eye[1] - center[1];
  const dz = eye[2] - center[2];
  if (Math.sqrt(dx * dx + dy * dy + dz * dz) <= radius) {
    return Number.POSITIVE_INFINITY;
  }

  const viewMatrix = camera.viewMatrix as ArrayLike<number>;
  const x = center[0], y = center[1], z = center[2];
  const vx = viewMatrix[0] * x + viewMatrix[4] * y + viewMatrix[8] * z + viewMatrix[12];
  const vy = viewMatrix[1] * x + viewMatrix[5] * y + viewMatrix[9] * z + viewMatrix[13];
  const vz = viewMatrix[2] * x + viewMatrix[6] * y + viewMatrix[10] * z + viewMatrix[14];
  const vw = viewMatrix[3] * x + viewMatrix[7] * y + viewMatrix[11] * z + viewMatrix[15];
  const proj = camera.projMatrix as ArrayLike<number>;
  const clipW = proj[3] * vx + proj[7] * vy + proj[11] * vz + proj[15] * vw;
  const near = Math.max(0, Number(camera.perspectiveProjection?.near ?? 0));
  if (!Number.isFinite(clipW) || clipW <= 0 || clipW - radius <= near) {
    return Number.POSITIVE_INFINITY;
  }

  const radiusX = Math.abs(proj[0]) * radius / clipW * width * 0.5;
  const radiusY = Math.abs(proj[5]) * radius / clipW * height * 0.5;
  return Math.max(radiusX, radiusY) * 2;
}
