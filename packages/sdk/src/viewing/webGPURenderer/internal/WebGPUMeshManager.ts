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
import type {SceneGeometry, SceneMesh} from "../../../model/scene";
import type {View, ViewObject} from "../../viewer";
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
  private readonly _normalMatrix: Mat4 = createMat4Float64();
  private readonly _meshCenter: Vec3 = createVec3Float64();
  private readonly _worldMeshCenter: Vec3 = createVec3Float64();
  private readonly _viewMeshCenter: Vec3 = createVec3Float64();

  constructor(params: {
    geometryManager: WebGPUGeometryManager;
  }) {
    this._geometryManager = params.geometryManager;
  }

  public get meshStates(): WebGPUMeshState[] {
    return this._meshStateList;
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
      geometryState: geometryResult.value
    };
    this._meshStates[sceneMesh.uniqueId] = meshState;
    this._meshStateIndices[sceneMesh.uniqueId] = this._meshStateList.length;
    this._meshStateList.push(meshState);

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

    const geometryState = meshState.geometryState;
    geometryState.numMeshes = Math.max(0, geometryState.numMeshes - 1);
    if (geometryState.numMeshes === 0) {
      this._geometryManager.destroyGeometryState(geometryState.geometry);
    }
  }

  public destroyGeometryState(sceneGeometry: SceneGeometry): void {
    this._geometryManager.destroyGeometryState(sceneGeometry);
  }

  public destroyAll(): void {
    for (const meshUniqueId of Object.keys(this._meshStates)) {
      this.destroyMeshState(this._meshStates[meshUniqueId].mesh);
    }
    this._meshStates = {};
    this._meshStateIndices = {};
    this._meshStateList.length = 0;
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

    const worldMatrix = (meshState.mesh.worldMatrix ?? meshState.mesh.matrix ?? IDENTITY_MATRIX) as Mat4;
    const viewMatrix = (view.camera?.viewMatrix ?? IDENTITY_MATRIX) as Mat4;
    transformPoint3(worldMatrix, this._meshCenter, this._worldMeshCenter);
    transformPoint3(viewMatrix, this._worldMeshCenter, this._viewMeshCenter);
    return this._viewMeshCenter[2];
  }

  public writeInstanceData(drawItem: WebGPUDrawItem, view: View, target: Float32Array, targetOffset: number): void {
    const meshState = drawItem.meshState;
    const worldMatrix = (meshState.mesh.worldMatrix ?? meshState.mesh.matrix ?? IDENTITY_MATRIX) as Mat4;
    const viewObject = this._getViewObject(meshState.mesh, view);
    const color = viewObject?.colorize ?? meshState.mesh.effectiveColor ?? meshState.mesh.color ?? [1, 1, 1];

    inverseMat4(worldMatrix, this._normalMatrix);
    transposeMat4(this._normalMatrix, this._normalMatrix);

    for (let i = 0; i < 16; i++) {
      target[targetOffset + i] = worldMatrix[i];
      target[targetOffset + 16 + i] = Number.isFinite(this._normalMatrix[i])
        ? this._normalMatrix[i]
        : IDENTITY_MATRIX[i];
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

}
