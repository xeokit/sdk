import {SDKErrorType, SDKInternalException, type SDKResult} from "../../../../../../base/core";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../../../../../base/constants";
import type {Mat4} from "../../../../../../base/math/matrix";
import type {Vec3} from "../../../../../../base/math/vector";
import type {SceneGeometry, SceneMesh} from "../../../../../../model/scene";
import type {MemoryConfigs} from "../../../MemoryConfigs";
import {RENDER_PASSES, type RenderPassValue} from "../../RENDER_PASSES";
import type {BatchGPUResources} from "../BatchGPUResources";
import {GPUMemoryCheckResult} from "../GPUMemoryCheckResult";
import type {GeometryAttributeTexture} from "../dataTextures/GeometryAttributeTexture";
import {GeometryQuantRangeTexture} from "../dataTextures/GeometryQuantRangeTexture";
import {IndexTexture} from "../dataTextures/IndexTexture";
import {PrimitiveMeshIndexTexture} from "../dataTextures/PrimitiveMeshIndexTexture";
import {VertexColorTexture} from "../dataTextures/VertexColorTexture";
import {VertexPositionTexture} from "../dataTextures/VertexPositionTexture";
import type {
  BatchGeometryStorage,
  BatchGeometryMeshViewAttribs,
  BatchGeometryViewResources,
  DTXGeometryAllocation,
  DTXGeometryMeshHandle,
  DTXGeometryResources
} from "./BatchGeometryStorage";
import type {MeshManagerStepStats} from "../../meshManager/MeshManagerStepStats";
import {
  allocateGeometryResources,
  destroyGeometryResources,
  getGeometryResourcesAllocatedBytes,
  getGeometryResourcesUsedBytes,
  restoreGeometryResources,
  type BatchGeometryResource
} from "./GeometryResourceUtils";

/**
 * Geometry storage that stores draw lists, indices, positions, and colors in
 * data textures.
 *
 * This is the original renderer geometry path. It supports triangles, lines,
 * and points, and keeps one primitive-to-mesh draw list per view so visibility
 * and render-pass changes can be updated independently for each view.
 *
 * @internal
 */
export class DTXGeometryStorage implements BatchGeometryStorage<DTXGeometryResources, DTXGeometryAllocation, DTXGeometryMeshHandle> {
  readonly kind = "dtx" as const;
  private readonly _primitiveMeshIndexTextures: PrimitiveMeshIndexTexture[] = [];
  private readonly _edgeMeshIndexTextures: PrimitiveMeshIndexTexture[] = [];
  private readonly _geometryQuantRangeTexture: GeometryQuantRangeTexture;
  private readonly _indexTexture: IndexTexture;
  private readonly _edgeIndexTexture: IndexTexture;
  private readonly _vertexPositionTexture: VertexPositionTexture;
  private readonly _vertexColorTexture: VertexColorTexture;
  private readonly _resources: BatchGeometryResource[];
  private readonly _memoryConfigs: MemoryConfigs;

  constructor(params: {
    gl: WebGL2RenderingContext;
    batchIndex: number;
    memoryConfigs: MemoryConfigs;
    bins: RenderPassValue[];
    getNumGeometries: () => number;
  }) {
    const {gl, batchIndex, memoryConfigs, bins, getNumGeometries} = params;
    this._memoryConfigs = memoryConfigs;
    for (let viewIndex = 0; viewIndex < memoryConfigs.maxViews; viewIndex++) {
      this._primitiveMeshIndexTextures.push(
        new PrimitiveMeshIndexTexture({
          gl,
          maxItems: memoryConfigs.maxBatchPrims,
          bins,
          description: `[Batch ${batchIndex}, View ${viewIndex}] - primIndex -> meshIndex`
        }));

      this._edgeMeshIndexTextures.push(
        new PrimitiveMeshIndexTexture({
          gl,
          maxItems: memoryConfigs.maxBatchPrims,
          bins,
          description: `[Batch ${batchIndex}, View ${viewIndex}] - edgeIndex -> meshIndex`
        }));
    }

    this._geometryQuantRangeTexture = new GeometryQuantRangeTexture({
      gl,
      maxItems: memoryConfigs.maxBatchGeometries,
      getNumItems: getNumGeometries,
      description: `[Batch ${batchIndex}] - geometryIndex -> quantization ranges (offset, scale)`
    });

    this._indexTexture = new IndexTexture({
      gl,
      maxItems: memoryConfigs.maxBatchIndices,
      description: `[Batch ${batchIndex}] - primitive indices`
    });

    this._edgeIndexTexture = new IndexTexture({
      gl,
      maxItems: memoryConfigs.maxBatchIndices,
      description: `[Batch ${batchIndex}] - edge indices`
    });

    this._vertexPositionTexture = new VertexPositionTexture({
      gl,
      maxItems: memoryConfigs.maxBatchVertices,
      description: `[Batch ${batchIndex}] - vertex XYZ positions`
    });

    this._vertexColorTexture = new VertexColorTexture({
      gl,
      maxItems: memoryConfigs.maxBatchVertices,
      description: `[Batch ${batchIndex}] - vertex RGB colors`
    });

    this._resources = [
      ...this._primitiveMeshIndexTextures,
      ...this._edgeMeshIndexTextures,
      this._geometryQuantRangeTexture,
      this._indexTexture,
      this._edgeIndexTexture,
      this._vertexPositionTexture,
      this._vertexColorTexture
    ];
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

  beginBulkMeshAdd(_stats?: MeshManagerStepStats | null): void {
  }

  endBulkMeshAdd(_stats?: MeshManagerStepStats | null): void {
  }

  uploadChanges(batchResources: BatchGPUResources): boolean {
    let didFlush = false;
    didFlush = this._indexTexture.uploadChanges() || didFlush;
    didFlush = this._geometryQuantRangeTexture.uploadChanges() || didFlush;
    didFlush = this._edgeIndexTexture.uploadChanges() || didFlush;
    didFlush = this._vertexPositionTexture.uploadChanges() || didFlush;
    didFlush = this._vertexColorTexture.uploadChanges() || didFlush;
    for (let i = 0, len = this._primitiveMeshIndexTextures.length; i < len; i++) {
      const primitiveMeshIndexTexture = this._primitiveMeshIndexTextures[i];
      const primitiveMeshIndexTextureFlushed = primitiveMeshIndexTexture.uploadChanges();
      didFlush = primitiveMeshIndexTextureFlushed || didFlush;
      if (primitiveMeshIndexTextureFlushed) {
        batchResources.views[i].numDrawablePrims = primitiveMeshIndexTexture.numPrimitives;
      }
      didFlush = this._edgeMeshIndexTextures[i].uploadChanges() || didFlush;
    }
    return didFlush;
  }

  getAllocatedBytes(): number {
    return getGeometryResourcesAllocatedBytes(this._resources);
  }

  getUsedBytes(): number {
    return getGeometryResourcesUsedBytes(this._resources);
  }

  getResources(): DTXGeometryResources {
    return {
      kind: this.kind,
      geometryQuantRangeTexture: this._geometryQuantRangeTexture,
      indexTexture: this._indexTexture,
      edgeIndexTexture: this._edgeIndexTexture,
      primitiveMeshIndexTextures: this._primitiveMeshIndexTextures,
      edgeMeshIndexTextures: this._edgeMeshIndexTextures,
      vertexPositionTexture: this._vertexPositionTexture,
      vertexColorTexture: this._vertexColorTexture
    };
  }

  getViewResources(viewIndex: number): BatchGeometryViewResources {
    const primitiveMeshIndexTexture = this._primitiveMeshIndexTextures[viewIndex];
    const edgeMeshIndexTexture = this._edgeMeshIndexTextures[viewIndex];
    return {
      primitiveMeshIndexTexture,
      edgeMeshIndexTexture,
      renderPassPrimitiveRanges: primitiveMeshIndexTexture.passRanges,
      renderPassEdgePrimitiveRanges: edgeMeshIndexTexture.passRanges,
      pickPrimitiveRange: primitiveMeshIndexTexture.primRange,
      pickEdgePrimitiveRange: edgeMeshIndexTexture.primRange
    };
  }

  canAddMesh(sceneMesh: SceneMesh, geometryExists: boolean): GPUMemoryCheckResult {
    const geometry = sceneMesh.geometry;
    const vertCount = (geometry.positionsCompressed?.length ?? 0) / 3;
    if (!geometryExists) {
      if (this._vertexPositionTexture.canGetPortion(vertCount) === false) {
        return GPUMemoryCheckResult.NotEnoughVertexSpace;
      }
      if (geometry.indices && this._indexTexture.canGetPortion(geometry.indices.length) === false) {
        return GPUMemoryCheckResult.NotEnoughIndexSpace;
      }
      if (geometry.edgeIndices && this._edgeIndexTexture.canGetPortion(geometry.edgeIndices.length) === false) {
        return GPUMemoryCheckResult.NotEnoughEdgeIndexSpace;
      }
      if (geometry.colorsCompressed && this._vertexColorTexture.canGetPortion(geometry.colorsCompressed.length / 4) === false) {
        return GPUMemoryCheckResult.NotEnoughColorSpace;
      }
    }
    const primitiveCount = getPrimitiveCount(geometry);
    if (geometry.primitive === TrianglesPrimitive && geometry.edgeIndices) {
      const edgePrimCount = (geometry.edgeIndices.length / 2) | 0;
      if (edgePrimCount > 0 && !canGetPortionInEveryView(this._edgeMeshIndexTextures, edgePrimCount)) {
        return GPUMemoryCheckResult.NotEnoughEdgeIndexSpace;
      }
    }
    if (!canGetPortionInEveryView(this._primitiveMeshIndexTextures, primitiveCount)) {
      return GPUMemoryCheckResult.NotEnoughPrimSpace;
    }
    return GPUMemoryCheckResult.OK;
  }

  allocateGeometry(params: {
    sceneGeometry: SceneGeometry;
    geometryIndex: number;
    geometryAttributeTexture: GeometryAttributeTexture;
  }): SDKResult<DTXGeometryAllocation> {
    const {sceneGeometry, geometryIndex, geometryAttributeTexture} = params;
    const allocation: DTXGeometryAllocation = {kind: this.kind};

    allocation.positionsPortion = this._vertexPositionTexture.getPortion(
      sceneGeometry.positionsCompressed,
      (newBase: number) => {
        geometryAttributeTexture.setItem(geometryIndex, {
          verticesBase: newBase
        });
      });

    if (allocation.positionsPortion === null) {
      this.freeGeometryAllocation(allocation);
      return {
        ok: false,
        type: SDKErrorType.MemoryAllocationFailed,
        error: `GPUMemoryBatch.addMesh: Unable to allocate positions portion (of length ${sceneGeometry.positionsCompressed.length}) for geometry ${sceneGeometry.id} - limit is ${this._memoryConfigs.maxBatchVertices * 3} position components`
      };
    }

    const [xmin, ymin, zmin, xmax, ymax, zmax] = sceneGeometry.aabb;

    this._geometryQuantRangeTexture.setItem(geometryIndex, {
      offset: [xmin, ymin, zmin],
      scale: [(xmax - xmin) / 65536, (ymax - ymin) / 65536, (zmax - zmin) / 65536]
    });

    if (sceneGeometry.colorsCompressed) {
      allocation.vertexColorsPortion = this._vertexColorTexture.getPortion(
        sceneGeometry.colorsCompressed,
        (newBase: number) => {
          geometryAttributeTexture.setItem(geometryIndex, {
            vertexColorsBase: newBase
          });
        }
      );
      if (allocation.vertexColorsPortion === null) {
        this.freeGeometryAllocation(allocation);
        return {
          ok: false,
          type: SDKErrorType.MemoryAllocationFailed,
          error: `GPUMemoryBatch.addMesh: Unable to allocate vertex colors portion (of length ${sceneGeometry.colorsCompressed.length}) geometry ${sceneGeometry.id} - limit is ${this._memoryConfigs.maxBatchVertices * 4} color components`
        };
      }
    }

    if (sceneGeometry.primitive !== PointsPrimitive && sceneGeometry.indices) {
      allocation.indicesHandle = this._indexTexture.getPortion(
        sceneGeometry.indices,
        (newBase: number) => {
          geometryAttributeTexture.setItem(geometryIndex, {
            indicesBase: newBase
          });
        }
      );

      if (allocation.indicesHandle === null) {
        this.freeGeometryAllocation(allocation);
        return {
          ok: false,
          type: SDKErrorType.MemoryAllocationFailed,
          error: `GPUMemoryBatch.addMesh: Unable to allocate indices portion (of length ${sceneGeometry.indices.length}) for geometry ${sceneGeometry.id} - limit is ${this._memoryConfigs.maxBatchIndices} indices`
        };
      }

      if (sceneGeometry.primitive === TrianglesPrimitive
        && sceneGeometry.edgeIndices
        && sceneGeometry.edgeIndices.length > 0) {
        allocation.edgeIndicesHandle = this._edgeIndexTexture.getPortion(
          sceneGeometry.edgeIndices,
          (newBase: number) => {
            geometryAttributeTexture.setItem(geometryIndex, {
              edgeIndicesBase: newBase
            });
          }
        );

        if (allocation.edgeIndicesHandle === null) {
          this.freeGeometryAllocation(allocation);
          return {
            ok: false,
            type: SDKErrorType.MemoryAllocationFailed,
            error: `GPUMemoryBatch.addMesh: Unable to allocate edge indices portion (of length ${sceneGeometry.edgeIndices.length}) for geometry ${sceneGeometry.id} - limit is ${this._memoryConfigs.maxBatchIndices} indices`
          };
        }
      }
    }

    return {ok: true, value: allocation};
  }

  freeGeometryAllocation(allocation: DTXGeometryAllocation): void {
    if (allocation.positionsPortion) {
      this._vertexPositionTexture.putPortion(allocation.positionsPortion);
      allocation.positionsPortion = undefined;
    }
    if (allocation.vertexColorsPortion) {
      this._vertexColorTexture.putPortion(allocation.vertexColorsPortion);
      allocation.vertexColorsPortion = undefined;
    }
    if (allocation.indicesHandle) {
      this._indexTexture.putPortion(allocation.indicesHandle);
      allocation.indicesHandle = undefined;
    }
    if (allocation.edgeIndicesHandle) {
      this._edgeIndexTexture.putPortion(allocation.edgeIndicesHandle);
      allocation.edgeIndicesHandle = undefined;
    }
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
  }): SDKResult<DTXGeometryMeshHandle> {
    const {sceneMesh, meshIndex, primitiveCount, numViews} = params;
    const primitiveMeshIndexTextureHandles = numViews === 1
      ? this._primitiveMeshIndexTextures[0].createPortion(primitiveCount, meshIndex, RENDER_PASSES.OPAQUE)
      : (() => {
        const handles = [];
        for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
          handles.push(this._primitiveMeshIndexTextures[viewIndex].createPortion(primitiveCount, meshIndex, RENDER_PASSES.OPAQUE));
        }
        return handles;
      })();

    let edgeMeshIndexTextureHandles;

    if (sceneMesh.geometry.primitive === TrianglesPrimitive) {
      const edgeCount = sceneMesh.geometry.edgeIndices ? (sceneMesh.geometry.edgeIndices.length / 2) | 0 : 0;
      if (edgeCount > 0) {
        edgeMeshIndexTextureHandles = numViews === 1
          ? this._edgeMeshIndexTextures[0].createPortion(edgeCount, meshIndex, RENDER_PASSES.OPAQUE)
          : (() => {
            const handles = [];
            for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
              handles.push(this._edgeMeshIndexTextures[viewIndex].createPortion(edgeCount, meshIndex, RENDER_PASSES.OPAQUE));
            }
            return handles;
          })();
      }
    }

    return {
      ok: true,
      value: {
        kind: this.kind,
        primitiveMeshIndexTextureHandles,
        edgeMeshIndexTextureHandles
      }
    };
  }

  deleteMeshHandle(handle: DTXGeometryMeshHandle, _meshIndex: number, numViews: number): void {
    forEachPerViewHandle(handle.primitiveMeshIndexTextureHandles, numViews, (viewIndex, portionHandle) => {
      this._primitiveMeshIndexTextures[viewIndex]?.deletePortion(portionHandle);
    });
    forEachPerViewHandle(handle.edgeMeshIndexTextureHandles, numViews, (viewIndex, portionHandle) => {
      this._edgeMeshIndexTextures[viewIndex]?.deletePortion(portionHandle);
    });
  }

  setMeshMatrix(_meshIndex: number, _matrix: Mat4): void {
  }

  setMeshTile(_meshIndex: number, _tileIndex: number): void {
  }

  setMeshPlacement(_meshIndex: number, _tileIndex: number, _matrix: Mat4): void {
  }

  setMeshViewAttribs(_meshIndex: number, _viewIndex: number, _params: BatchGeometryMeshViewAttribs): void {
  }

  setMeshRenderPass(handle: DTXGeometryMeshHandle, meshIndex: number, viewIndex: number, renderPass: RenderPassValue): void {
    const primitiveMeshIndexTextureHandle = getPerViewHandle(handle.primitiveMeshIndexTextureHandles, viewIndex);
    if (!primitiveMeshIndexTextureHandle) {
      throw new SDKInternalException(`DTXGeometryStorage.setMeshRenderPass: Mesh ${meshIndex} has no primitiveMeshIndexTextureHandle`);
    }
    this._primitiveMeshIndexTextures[viewIndex].setRenderPass(primitiveMeshIndexTextureHandle, renderPass);
    if (handle.edgeMeshIndexTextureHandles) {
      const edgeMeshIndexTextureHandle = getPerViewHandle(handle.edgeMeshIndexTextureHandles, viewIndex);
      if (!edgeMeshIndexTextureHandle) {
        throw new SDKInternalException(`DTXGeometryStorage.setMeshRenderPass: Mesh ${meshIndex} has no edgeMeshIndexTextureHandle`);
      }
      this._edgeMeshIndexTextures[viewIndex].setRenderPass(edgeMeshIndexTextureHandle, renderPass);
    }
  }

  setMeshVisible(handle: DTXGeometryMeshHandle, meshIndex: number, viewIndex: number, visible: boolean): void {
    const primitiveMeshIndexTextureHandle = getPerViewHandle(handle.primitiveMeshIndexTextureHandles, viewIndex);
    if (!primitiveMeshIndexTextureHandle) {
      throw new SDKInternalException(`DTXGeometryStorage.setMeshVisible: Mesh ${meshIndex} has no primitiveMeshIndexTextureHandle`);
    }
    this._primitiveMeshIndexTextures[viewIndex].setMeshVisible(primitiveMeshIndexTextureHandle, visible);
    if (handle.edgeMeshIndexTextureHandles) {
      const edgeMeshIndexTextureHandle = getPerViewHandle(handle.edgeMeshIndexTextureHandles, viewIndex);
      if (!edgeMeshIndexTextureHandle) {
        throw new SDKInternalException(`DTXGeometryStorage.setMeshVisible: Mesh ${meshIndex} has no edgeMeshIndexTextureHandle`);
      }
      this._edgeMeshIndexTextures[viewIndex].setObjectVisible(edgeMeshIndexTextureHandle, visible);
    }
  }

  getDrawArraysParamsForMesh(handle: DTXGeometryMeshHandle, sceneGeometry: SceneGeometry, viewIndex: number): { first: number; count: number } | null {
    const primitiveMeshIndexTextureHandle = getPerViewHandle(handle.primitiveMeshIndexTextureHandles, viewIndex);
    if (!primitiveMeshIndexTextureHandle) {
      return null;
    }

    const primsBase = primitiveMeshIndexTextureHandle.base ?? primitiveMeshIndexTextureHandle.start ?? 0;

    if (sceneGeometry.primitive === PointsPrimitive) {
      return {
        count: sceneGeometry.positionsCompressed.length / 3,
        first: primsBase
      };
    } else if (sceneGeometry.primitive === LinesPrimitive || sceneGeometry.primitive === TrianglesPrimitive) {
      return {
        count: sceneGeometry.indices?.length ?? 0,
        first: primsBase
      };
    }
    return null;
  }
}

function getPrimitiveCount(sceneGeometry: SceneGeometry): number {
  const vertCount = (sceneGeometry.positionsCompressed?.length ?? 0) / 3;
  if (sceneGeometry.primitive === PointsPrimitive) {
    return vertCount;
  }
  if (sceneGeometry.primitive === LinesPrimitive) {
    return (sceneGeometry.indices.length / 2) | 0;
  }
  return (sceneGeometry.indices.length / 3) | 0;
}

function canGetPortionInEveryView(textures: PrimitiveMeshIndexTexture[], size: number): boolean {
  for (let viewIndex = 0, len = textures.length; viewIndex < len; viewIndex++) {
    if (textures[viewIndex].canGetPortion(size) === false) {
      return false;
    }
  }
  return true;
}

function getPerViewHandle(handles: any | any[] | undefined, viewIndex: number): any | undefined {
  if (!handles) {
    return undefined;
  }
  return Array.isArray(handles)
    ? handles[viewIndex]
    : viewIndex === 0 ? handles : undefined;
}

function forEachPerViewHandle(
  handles: any | any[] | undefined,
  numViews: number,
  callback: (viewIndex: number, handle: any) => void
): void {
  if (!handles) {
    return;
  }
  if (Array.isArray(handles)) {
    for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
      callback(viewIndex, handles[viewIndex]);
    }
  } else {
    callback(0, handles);
  }
}
