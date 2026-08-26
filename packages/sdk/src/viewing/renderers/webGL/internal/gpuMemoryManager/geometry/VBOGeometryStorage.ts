import {SDKErrorType, type SDKResult} from "../../../../../../base/core";
import {TrianglesPrimitive} from "../../../../../../base/constants";
import type {Mat4} from "../../../../../../base/math/matrix";
import type {Vec3} from "../../../../../../base/math/vector";
import type {SceneGeometry, SceneMesh} from "../../../../../../model/scene";
import type {MemoryConfigs} from "../../../MemoryConfigs";
import {type RenderPassValue} from "../../RENDER_PASSES";
import type {BatchGPUResources} from "../BatchGPUResources";
import {GPUMemoryCheckResult} from "../GPUMemoryCheckResult";
import type {GeometryAttributeTexture} from "../dataTextures/GeometryAttributeTexture";
import type {TriangleGeometryVBOBatch} from "../vbos/TriangleGeometryVBOBatch";
import {TriangleGeometryVBOBatch as TriangleGeometryVBOBatchImpl} from "../vbos/TriangleGeometryVBOBatch";
import type {
  BatchGeometryStorage,
  BatchGeometryMeshViewAttribs,
  BatchGeometryViewResources,
  VBOGeometryAllocation,
  VBOGeometryMeshHandle,
  VBOGeometryResources
} from "./BatchGeometryStorage";
import {
  allocateGeometryResources,
  destroyGeometryResources,
  getGeometryResourcesAllocatedBytes,
  getGeometryResourcesUsedBytes,
  restoreGeometryResources,
  type BatchGeometryResource
} from "./GeometryResourceUtils";
import type {MeshManagerStepStats} from "../../meshManager/MeshManagerStepStats";

const EMPTY_PRIM_RANGE = {firstPrim: 0, numPrims: 0};

/**
 * Geometry storage that stores triangle geometry in batch-owned VBOs.
 *
 * This storage is used for triangle batches that should draw from vertex and
 * index buffers instead of fetching primitive geometry from data textures. It
 * still lets GPUMemoryBatch keep the normal mesh/material/view data textures for
 * per-mesh state.
 *
 * @internal
 */
export class VBOGeometryStorage implements BatchGeometryStorage<VBOGeometryResources, VBOGeometryAllocation, VBOGeometryMeshHandle> {
  readonly kind = "vbo" as const;
  private readonly _triangleGeometryVBO: TriangleGeometryVBOBatch;
  private readonly _resources: BatchGeometryResource[];

  constructor(params: {
    gl: WebGL2RenderingContext;
    batchIndex: number;
    memoryConfigs: MemoryConfigs;
    hasNormals?: boolean;
  }) {
    const {gl, batchIndex, memoryConfigs} = params;
    this._triangleGeometryVBO = new TriangleGeometryVBOBatchImpl({
      gl,
      batchIndex,
      maxPrims: memoryConfigs.vboGeometry?.maxBatchPrims ?? memoryConfigs.maxBatchPrims,
      maxViews: memoryConfigs.maxViews,
      hasNormals: params.hasNormals === true
    });
    this._resources = [this._triangleGeometryVBO];
  }

  allocate(): SDKResult<void> {
    return allocateGeometryResources(this._resources);
  }

  destroy(): void {
    destroyGeometryResources(this._resources);
  }

  webglContextRestored(gl: WebGL2RenderingContext): SDKResult<void> {
    return restoreGeometryResources(this._resources, gl);
  }

  beginBulkMeshAdd(stats?: MeshManagerStepStats | null): void {
    this._triangleGeometryVBO.beginBulkMeshAdd(stats);
  }

  endBulkMeshAdd(stats?: MeshManagerStepStats | null): void {
    this._triangleGeometryVBO.endBulkMeshAdd(stats);
  }

  uploadChanges(batchResources: BatchGPUResources): boolean {
    const didFlush = this._triangleGeometryVBO.uploadChanges();
    for (let i = 0, len = batchResources.views.length; i < len; i++) {
      batchResources.views[i].numDrawablePrims = this._triangleGeometryVBO.getNumDrawablePrims(i);
    }
    return didFlush;
  }

  getAllocatedBytes(): number {
    return getGeometryResourcesAllocatedBytes(this._resources);
  }

  getUsedBytes(): number {
    return getGeometryResourcesUsedBytes(this._resources);
  }

  getResources(): VBOGeometryResources {
    return {
      kind: this.kind,
      triangleGeometryVBO: this._triangleGeometryVBO
    };
  }

  getViewResources(viewIndex: number): BatchGeometryViewResources {
    return {
      renderPassPrimitiveRanges: this._triangleGeometryVBO.getRenderPassPrimitiveRanges(viewIndex),
      renderPassEdgePrimitiveRanges: this._triangleGeometryVBO.getRenderPassEdgePrimitiveRanges(viewIndex),
      pickPrimitiveRange: this._triangleGeometryVBO.getPickPrimitiveRange(viewIndex) ?? EMPTY_PRIM_RANGE,
      pickEdgePrimitiveRange: this._triangleGeometryVBO.getPickEdgePrimitiveRange(viewIndex) ?? EMPTY_PRIM_RANGE
    };
  }

  canAddMesh(sceneMesh: SceneMesh, _geometryExists: boolean): GPUMemoryCheckResult {
    return this._triangleGeometryVBO.canAddMesh(sceneMesh)
      ? GPUMemoryCheckResult.OK
      : GPUMemoryCheckResult.NotEnoughPrimSpace;
  }

  allocateGeometry(_params: {
    sceneGeometry: SceneGeometry;
    geometryIndex: number;
    geometryAttributeTexture: GeometryAttributeTexture;
  }): SDKResult<VBOGeometryAllocation> {
    return {ok: true, value: {kind: this.kind}};
  }

  freeGeometryAllocation(_allocation: VBOGeometryAllocation): void {
  }

  createMeshHandle(params: {
    sceneMesh: SceneMesh;
    meshIndex: number;
    primitiveCount: number;
    numViews: number;
    color: Vec3;
    opacity: number;
    matrix: Mat4;
    tileIndex: number;
    stats?: MeshManagerStepStats | null;
  }): SDKResult<VBOGeometryMeshHandle> {
    if (params.sceneMesh.geometry.primitive !== TrianglesPrimitive) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "VBOGeometryStorage.createMeshHandle: VBO geometry is only supported for triangle meshes"
      };
    }
    const result = this._triangleGeometryVBO.addMesh({
      meshIndex: params.meshIndex,
      sceneMesh: params.sceneMesh,
      tileIndex: params.tileIndex,
      matrix: params.matrix,
      color: params.color,
      opacity: params.opacity,
      stats: params.stats
    });
    if (result.ok === false) {
      return result;
    }
    return {
      ok: true,
      value: {
        kind: this.kind,
        triangleGeometryVBOHandle: result.value
      }
    };
  }

  deleteMeshHandle(_handle: VBOGeometryMeshHandle, meshIndex: number, _numViews: number): void {
    this._triangleGeometryVBO.removeMesh(meshIndex);
  }

  setMeshMatrix(meshIndex: number, matrix: Mat4): void {
    this._triangleGeometryVBO.setMeshMatrix(meshIndex, matrix);
  }

  setMeshTile(meshIndex: number, tileIndex: number): void {
    this._triangleGeometryVBO.setMeshTile(meshIndex, tileIndex);
  }

  setMeshPlacement(meshIndex: number, tileIndex: number, matrix: Mat4): void {
    this._triangleGeometryVBO.setMeshPlacement(meshIndex, tileIndex, matrix);
  }

  setMeshViewAttribs(meshIndex: number, viewIndex: number, params: BatchGeometryMeshViewAttribs): void {
    this._triangleGeometryVBO.setMeshViewAttribs(meshIndex, viewIndex, params);
  }

  setMeshRenderPass(_handle: VBOGeometryMeshHandle, meshIndex: number, viewIndex: number, renderPass: RenderPassValue): void {
    this._triangleGeometryVBO.setMeshRenderPass(meshIndex, viewIndex, renderPass);
  }

  setMeshVisible(_handle: VBOGeometryMeshHandle, meshIndex: number, viewIndex: number, visible: boolean): void {
    this._triangleGeometryVBO.setMeshVisible(meshIndex, viewIndex, visible);
  }

  getDrawArraysParamsForMesh(_handle: VBOGeometryMeshHandle, _sceneGeometry: SceneGeometry, _viewIndex: number): { first: number; count: number } | null {
    return null;
  }
}
