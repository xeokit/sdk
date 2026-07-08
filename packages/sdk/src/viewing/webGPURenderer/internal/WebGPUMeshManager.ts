import {SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "../../../base/constants";
import {type SDKResult} from "../../../base/core";
import {
  createMat4Float64,
  inverseMat4,
  transformPoint3,
  transposeMat4,
  type Mat4
} from "../../../base/math/matrix";
import {createVec3Float64, type Vec3} from "../../../base/math/vector";
import type {SceneGeometry, SceneMaterial, SceneMesh, SceneModel, SceneObject, SceneTransform} from "../../../model/scene";
import type {Camera, View, ViewObject} from "../../viewer";
import {IDENTITY_MATRIX} from "./constants";
import type {WebGPUDrawItem, WebGPUMeshState} from "./types";
import {WebGPUGeometryManager} from "./WebGPUGeometryManager";

/**
 * Owns renderer mesh records, mesh visibility/material resolution, and
 * mesh-to-geometry links.
 *
 * @internal
 */
export class WebGPUMeshManager {

  private readonly _geometryManager: WebGPUGeometryManager;
  private _meshStates: {[meshUniqueId: string]: WebGPUMeshState} = {};
  private _meshStateIndices: {[meshUniqueId: string]: number} = {};
  private readonly _meshStateList: WebGPUMeshState[] = [];
  private readonly _meshCenter: Vec3 = createVec3Float64();
  private readonly _worldMeshCenter: Vec3 = createVec3Float64();
  private readonly _viewMeshCenter: Vec3 = createVec3Float64();
  private _structureVersion = 0;
  private _instanceDataVersion = 0;
  private _allViewStateVersion = 0;
  private readonly _viewStateVersions: {[viewId: string]: number} = {};
  private readonly _cameraViewVersions: {[viewId: string]: number} = {};

  constructor(params: {
    geometryManager: WebGPUGeometryManager;
  }) {
    this._geometryManager = params.geometryManager;
  }

  public get meshStates(): WebGPUMeshState[] {
    return this._meshStateList;
  }

  public get structureVersion(): number {
    return this._structureVersion;
  }

  public get instanceDataVersion(): number {
    return this._instanceDataVersion;
  }

  public getViewStateVersion(view: View): number {
    return this._allViewStateVersion + (this._viewStateVersions[view.id] ?? 0);
  }

  public getCameraViewVersion(view: View): number {
    return this._cameraViewVersions[view.id] ?? 0;
  }

  public sceneModelCreated(sceneModel: SceneModel): SDKResult<void> {
    const meshes = sceneModel.meshes;
    for (const meshId in meshes) {
      const result = this.registerSceneMesh(meshes[meshId]);
      if (result.ok === false) {
        return result;
      }
    }
    return this._ok();
  }

  public sceneModelDestroyed(sceneModel: SceneModel): SDKResult<void> {
    const meshes = this._meshStateList
      .filter((meshState) => meshState.mesh.model === sceneModel)
      .map((meshState) => meshState.mesh);
    for (const mesh of meshes) {
      this.destroyMeshState(mesh);
    }
    return this._ok();
  }

  public sceneGeometryCreated(sceneGeometry: SceneGeometry): SDKResult<void> {
    void sceneGeometry;
    return this._ok();
  }

  public sceneGeometryDestroyed(sceneGeometry: SceneGeometry): SDKResult<void> {
    this.destroyGeometryState(sceneGeometry);
    return this._ok();
  }

  public sceneGeometryUpdated(sceneGeometry: SceneGeometry): SDKResult<void> {
    const meshes = this._meshStateList
      .filter((meshState) => meshState.geometryState.geometry === sceneGeometry || meshState.mesh.geometry === sceneGeometry)
      .map((meshState) => meshState.mesh);

    this.destroyGeometryState(sceneGeometry);

    for (const mesh of meshes) {
      if (mesh.destroyed) {
        continue;
      }
      const result = this.registerSceneMesh(mesh);
      if (result.ok === false) {
        return result;
      }
    }

    return this._ok();
  }

  public sceneMeshCreated(sceneMesh: SceneMesh): SDKResult<void> {
    return this.registerSceneMesh(sceneMesh);
  }

  public sceneMeshDestroyed(sceneMesh: SceneMesh): SDKResult<void> {
    this.destroyMeshState(sceneMesh);
    return this._ok();
  }

  public sceneObjectCreated(sceneObject: SceneObject): SDKResult<void> {
    const meshes = sceneObject.meshes;
    for (let i = 0, len = meshes.length; i < len; i++) {
      const result = this.registerSceneMesh(meshes[i]);
      if (result.ok === false) {
        return result;
      }
    }
    this._markAllViewStateDirty();
    return this._ok();
  }

  public sceneObjectDestroyed(sceneObject: SceneObject): SDKResult<void> {
    void sceneObject;
    this._markAllViewStateDirty();
    return this._ok();
  }

  public sceneObjectMeshAdded(sceneObject: SceneObject, sceneMesh: SceneMesh): SDKResult<void> {
    void sceneObject;
    const result = this.registerSceneMesh(sceneMesh);
    if (result.ok) {
      this._markAllViewStateDirty();
    }
    return result;
  }

  public sceneObjectMeshRemoved(sceneObject: SceneObject, sceneMesh: SceneMesh): SDKResult<void> {
    void sceneObject;
    void sceneMesh;
    this._markAllViewStateDirty();
    return this._ok();
  }

  public sceneMeshMatrixChanged(sceneMesh: SceneMesh): void {
    const meshState = this._meshStates[sceneMesh.uniqueId];
    if (!meshState) {
      return;
    }
    meshState.matrixDirty = true;
    this._markInstanceDataDirty();
  }

  public sceneMeshMoved(sceneMesh: SceneMesh): void {
    this.sceneMeshMatrixChanged(sceneMesh);
  }

  public sceneMeshColorChanged(sceneMesh: SceneMesh): void {
    if (this._meshStates[sceneMesh.uniqueId]) {
      this._markInstanceDataDirty();
    }
  }

  public sceneMeshOpacityChanged(sceneMesh: SceneMesh): void {
    if (this._meshStates[sceneMesh.uniqueId]) {
      this._markInstanceDataDirty();
    }
  }

  public sceneMaterialPatternChanged(sceneMaterial: SceneMaterial): void {
    if (this._materialHasRegisteredMeshes(sceneMaterial)) {
      this._markInstanceDataDirty();
    }
  }

  public sceneMaterialColorChanged(sceneMaterial: SceneMaterial): void {
    if (this._materialHasRegisteredMeshes(sceneMaterial)) {
      this._markInstanceDataDirty();
    }
  }

  public sceneMaterialEmissiveColorChanged(sceneMaterial: SceneMaterial): void {
    if (this._materialHasRegisteredMeshes(sceneMaterial)) {
      this._markInstanceDataDirty();
    }
  }

  public sceneMaterialOpacityChanged(sceneMaterial: SceneMaterial): void {
    if (this._materialHasRegisteredMeshes(sceneMaterial)) {
      this._markInstanceDataDirty();
    }
  }

  public sceneTransformMatrixChanged(sceneTransform: SceneTransform): void {
    void sceneTransform;
    for (let i = 0, len = this._meshStateList.length; i < len; i++) {
      this._meshStateList[i].matrixDirty = true;
    }
    this._markInstanceDataDirty();
  }

  public viewObjectChanged(viewObject: ViewObject): void {
    const view = this._getViewObjectView(viewObject);
    if (!view) {
      return;
    }
    this._viewStateVersions[view.id] = (this._viewStateVersions[view.id] ?? 0) + 1;
  }

  public cameraViewMatrixUpdated(camera: Camera): void {
    const view = camera.view;
    if (!view) {
      return;
    }
    this._cameraViewVersions[view.id] = (this._cameraViewVersions[view.id] ?? 0) + 1;
  }

  public viewDestroyed(view: View): void {
    delete this._viewStateVersions[view.id];
    delete this._cameraViewVersions[view.id];
  }

  public registerSceneMesh(sceneMesh: SceneMesh): SDKResult<void> {
    if (this._meshStates[sceneMesh.uniqueId]) {
      return {
        ok: true,
        value: undefined
      };
    }
    if (!this.isRenderableMesh(sceneMesh)) {
      return {
        ok: true,
        value: undefined
      };
    }

    const geometryResult = this._geometryManager.getOrCreateGeometryState(sceneMesh.geometry);
    if (geometryResult.ok === false) {
      return geometryResult;
    }

    geometryResult.value.numMeshes++;
    const meshState = {
      mesh: sceneMesh,
      geometryState: geometryResult.value,
      worldMatrix: createMat4Float64(),
      normalMatrix: createMat4Float64(),
      matrixDirty: true
    };
    this._meshStates[sceneMesh.uniqueId] = meshState;
    this._meshStateIndices[sceneMesh.uniqueId] = this._meshStateList.length;
    this._meshStateList.push(meshState);
    this._markStructureDirty();

    return {
      ok: true,
      value: undefined
    };
  }

  public destroyMeshState(sceneMesh: SceneMesh): void {
    const meshState = this._meshStates[sceneMesh.uniqueId];
    if (!meshState) {
      return;
    }

    const index = this._meshStateIndices[sceneMesh.uniqueId];
    const lastIndex = this._meshStateList.length - 1;
    const last = this._meshStateList[lastIndex];
    if (index !== lastIndex) {
      this._meshStateList[index] = last;
      this._meshStateIndices[last.mesh.uniqueId] = index;
    }
    this._meshStateList.pop();
    delete this._meshStates[sceneMesh.uniqueId];
    delete this._meshStateIndices[sceneMesh.uniqueId];
    this._markStructureDirty();

    const geometryState = meshState.geometryState;
    geometryState.numMeshes = Math.max(0, geometryState.numMeshes - 1);
    if (geometryState.numMeshes === 0) {
      this._geometryManager.destroyGeometryState(geometryState.geometry);
    }
  }

  public destroyGeometryState(sceneGeometry: SceneGeometry): void {
    const meshes = this._meshStateList
      .filter((meshState) => meshState.geometryState.geometry === sceneGeometry || meshState.mesh.geometry === sceneGeometry)
      .map((meshState) => meshState.mesh);
    for (const mesh of meshes) {
      this.destroyMeshState(mesh);
    }
    this._geometryManager.destroyGeometryState(sceneGeometry);
  }

  public destroyAll(): void {
    for (const meshUniqueId of Object.keys(this._meshStates)) {
      this.destroyMeshState(this._meshStates[meshUniqueId].mesh);
    }
    this._meshStates = {};
    this._meshStateIndices = {};
    this._meshStateList.length = 0;
    this._markStructureDirty();
  }

  public isRenderableMesh(sceneMesh: SceneMesh): boolean {
    if (!sceneMesh || sceneMesh.destroyed) {
      return false;
    }
    const geometry = sceneMesh.geometry;
    if (!geometry || geometry.destroyed || !geometry.indices) {
      return false;
    }
    return (
      geometry.primitive === TrianglesPrimitive ||
      geometry.primitive === SolidPrimitive ||
      geometry.primitive === SurfacePrimitive
    );
  }

  public isMeshVisibleInView(meshState: WebGPUMeshState, view: View): boolean {
    if (!this.isRenderableMesh(meshState.mesh)) {
      return false;
    }

    const viewObject = this._getViewObject(meshState.mesh, view);
    return !viewObject || (viewObject.visible && !viewObject.culled);
  }

  public getMeshOpacityInView(meshState: WebGPUMeshState, view: View): number {
    const viewObject = this._getViewObject(meshState.mesh, view);
    const opacity = viewObject?.opacityUpdated
      ? viewObject.opacity
      : meshState.mesh.effectiveOpacity ?? meshState.mesh.opacity ?? 1;
    return Math.max(0, Math.min(1, opacity));
  }

  public getMeshViewDepth(meshState: WebGPUMeshState, view: View): number {
    const aabb = meshState.geometryState.geometry.aabb;
    if (!aabb) {
      return 0;
    }

    this._meshCenter[0] = (aabb[0] + aabb[3]) * 0.5;
    this._meshCenter[1] = (aabb[1] + aabb[4]) * 0.5;
    this._meshCenter[2] = (aabb[2] + aabb[5]) * 0.5;

    this._ensureMeshMatrices(meshState);
    const worldMatrix = meshState.worldMatrix;
    const viewMatrix = (view.camera?.viewMatrix ?? IDENTITY_MATRIX) as Mat4;
    transformPoint3(worldMatrix, this._meshCenter, this._worldMeshCenter);
    transformPoint3(viewMatrix, this._worldMeshCenter, this._viewMeshCenter);
    return this._viewMeshCenter[2];
  }

  public writeInstanceData(drawItem: WebGPUDrawItem, view: View, target: Float32Array, targetOffset: number): void {
    const meshState = drawItem.meshState;
    const viewObject = this._getViewObject(meshState.mesh, view);
    const color = viewObject?.colorize ?? meshState.mesh.effectiveColor ?? meshState.mesh.color ?? [1, 1, 1];

    this._ensureMeshMatrices(meshState);

    for (let i = 0; i < 16; i++) {
      target[targetOffset + i] = meshState.worldMatrix[i];
      target[targetOffset + 16 + i] = meshState.normalMatrix[i];
    }
    target[targetOffset + 32] = color[0];
    target[targetOffset + 33] = color[1];
    target[targetOffset + 34] = color[2];
    target[targetOffset + 35] = drawItem.opacity;
  }

  private _getViewObject(sceneMesh: SceneMesh, view: View): ViewObject | null {
    const sceneObject = sceneMesh.object;
    if (!sceneObject) {
      return null;
    }
    return view.objects?.[sceneObject.id] ?? null;
  }

  private _ensureMeshMatrices(meshState: WebGPUMeshState): void {
    if (!meshState.matrixDirty) {
      return;
    }

    const source = (meshState.mesh.worldMatrix ?? meshState.mesh.matrix ?? IDENTITY_MATRIX) as Mat4;
    for (let i = 0; i < 16; i++) {
      meshState.worldMatrix[i] = source[i] ?? IDENTITY_MATRIX[i];
    }

    inverseMat4(meshState.worldMatrix, meshState.normalMatrix);
    transposeMat4(meshState.normalMatrix, meshState.normalMatrix);
    for (let i = 0; i < 16; i++) {
      if (!Number.isFinite(meshState.normalMatrix[i])) {
        meshState.normalMatrix[i] = IDENTITY_MATRIX[i];
      }
    }

    meshState.matrixDirty = false;
  }

  private _materialHasRegisteredMeshes(sceneMaterial: SceneMaterial): boolean {
    const meshes = sceneMaterial.model?.meshes;
    if (!meshes) {
      return false;
    }
    for (const id in meshes) {
      const mesh = meshes[id];
      if (mesh.material === sceneMaterial && this._meshStates[mesh.uniqueId]) {
        return true;
      }
    }
    return false;
  }

  private _getViewObjectView(viewObject: ViewObject): View | null {
    return (viewObject as any).view ?? viewObject.layer?.view ?? null;
  }

  private _markStructureDirty(): void {
    this._structureVersion++;
    this._markInstanceDataDirty();
  }

  private _markInstanceDataDirty(): void {
    this._instanceDataVersion++;
  }

  private _markAllViewStateDirty(): void {
    this._allViewStateVersion++;
  }

  private _ok(): SDKResult<void> {
    return {
      ok: true,
      value: undefined
    };
  }

}
