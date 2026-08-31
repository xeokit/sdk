import type {SDKResult} from "../../../../../../base/core";
import type {Mat4} from "../../../../../../base/math/matrix";
import type {Vec3} from "../../../../../../base/math/vector";
import type {SceneGeometry, SceneMesh} from "../../../../../../model/scene";
import {type RenderPassValue} from "../../RENDER_PASSES";
import type {TriangleGeometryStorageKind, BatchGPUResources} from "../BatchGPUResources";
import type {GeometryAttributeTexture} from "../dataTextures/GeometryAttributeTexture";
import type {GeometryQuantRangeTexture} from "../dataTextures/GeometryQuantRangeTexture";
import type {IndexTexture} from "../dataTextures/IndexTexture";
import type {PrimitiveMeshIndexTexture} from "../dataTextures/PrimitiveMeshIndexTexture";
import type {VertexColorTexture} from "../dataTextures/VertexColorTexture";
import type {VertexPositionTexture} from "../dataTextures/VertexPositionTexture";
import type {PrimRange} from "./PrimRange";
import type {TriangleGeometryVBOBatch, TriangleGeometryVBOMeshHandle} from "../vbos/TriangleGeometryVBOBatch";
import type {GPUMemoryCheckResult} from "../GPUMemoryCheckResult";
import type {MeshManagerStepStats} from "../../meshManager/MeshManagerStepStats";

/**
 * One handle or one handle per view.
 *
 * DTX batches use this because single-view batches can store one compact handle,
 * while multi-view batches need a separate portion handle for each view.
 *
 * @internal
 */
export type PerViewGeometryHandle = any | any[];

/**
 * Resources owned by a geometry storage that stores geometry in data textures.
 *
 * These are the textures that draw techniques need when they fetch primitive
 * lists, indices, positions, colors, and quantization ranges from textures.
 *
 * @internal
 */
export type DTXGeometryResources = {
  kind: "dtx";
  geometryQuantRangeTexture: GeometryQuantRangeTexture;
  indexTexture: IndexTexture;
  edgeIndexTexture: IndexTexture;
  primitiveMeshIndexTextures: PrimitiveMeshIndexTexture[];
  edgeMeshIndexTextures: PrimitiveMeshIndexTexture[];
  vertexPositionTexture: VertexPositionTexture;
  vertexColorTexture: VertexColorTexture;
};

/**
 * Resources owned by a geometry storage that stores triangle geometry in VBOs.
 *
 * The VBO batch provides the draw list, indices, baked positions, edge indices,
 * and VAOs for triangle rendering.
 *
 * @internal
 */
export type VBOGeometryResources = {
  kind: "vbo";
  triangleGeometryVBO: TriangleGeometryVBOBatch;
};

/**
 * The renderer-visible resource bundle for whichever geometry storage a batch
 * was created with.
 *
 * @internal
 */
export type BatchGeometryResources = DTXGeometryResources | VBOGeometryResources;

/**
 * Geometry allocation returned by the data-texture storage for one SceneGeometry.
 *
 * The portions are later released when the last mesh using that geometry leaves
 * the batch.
 *
 * @internal
 */
export type DTXGeometryAllocation = {
  kind: "dtx";
  positionsPortion?: any;
  vertexColorsPortion?: any;
  indicesHandle?: any;
  edgeIndicesHandle?: any;
};

/**
 * Geometry allocation returned by the VBO storage for one SceneGeometry.
 *
 * VBO geometry is allocated per mesh, so there are no shared geometry portions
 * to release here.
 *
 * @internal
 */
export type VBOGeometryAllocation = {
  kind: "vbo";
};

/**
 * Storage-specific geometry allocation for one SceneGeometry.
 *
 * @internal
 */
export type BatchGeometryAllocation = DTXGeometryAllocation | VBOGeometryAllocation;

/**
 * Per-mesh draw-list handles used by the data-texture storage.
 *
 * These handles point to the per-view primitive and edge portions that decide
 * whether each mesh is visible in each render pass.
 *
 * @internal
 */
export type DTXGeometryMeshHandle = {
  kind: "dtx";
  primitiveMeshIndexTextureHandles: PerViewGeometryHandle;
  edgeMeshIndexTextureHandles?: PerViewGeometryHandle;
};

/**
 * Per-mesh VBO handle used by the VBO storage.
 *
 * The handle identifies the mesh inside the batch-owned triangle VBO storage.
 *
 * @internal
 */
export type VBOGeometryMeshHandle = {
  kind: "vbo";
  triangleGeometryVBOHandle: TriangleGeometryVBOMeshHandle;
};

/**
 * Storage-specific per-mesh handle stored by GPUMemoryBatch.
 *
 * @internal
 */
export type BatchGeometryMeshHandle = DTXGeometryMeshHandle | VBOGeometryMeshHandle;

/**
 * View-specific mesh attributes that a geometry storage may need to mirror.
 *
 * DTX uses these through mesh/view textures. VBO uses color and opacity for its
 * fast baked-color draw path.
 *
 * @internal
 */
export type BatchGeometryMeshViewAttribs = {
  color?: Vec3;
  opacity?: number;
  pickable?: boolean;
  clippable?: boolean;
  styleBinEdges?: boolean;
  styleBinClearDepthBefore?: boolean;
};

/**
 * Per-view draw ranges exposed by a geometry storage.
 *
 * Draw techniques use these ranges to issue one draw per pass, regardless of
 * whether the underlying geometry is stored in data textures or VBOs.
 *
 * @internal
 */
export type BatchGeometryViewResources = {
  primitiveMeshIndexTexture?: PrimitiveMeshIndexTexture;
  edgeMeshIndexTexture?: PrimitiveMeshIndexTexture;
  renderPassPrimitiveRanges: Map<number, PrimRange>;
  renderPassEdgePrimitiveRanges: Map<number, PrimRange>;
  pickPrimitiveRange: PrimRange;
  pickEdgePrimitiveRange: PrimRange;
};

/**
 * Common internal contract for geometry storage owned by one GPUMemoryBatch.
 *
 * Implementations decide where geometry lives. The data-texture storage owns
 * index/position/color textures; the VBO storage owns batch-local VBO geometry.
 * GPUMemoryBatch calls this interface for allocation, mesh lifecycle changes,
 * visibility changes, uploads, and draw-range lookup without knowing the
 * storage details.
 *
 * @internal
 */
export interface BatchGeometryStorage<
  Resources extends BatchGeometryResources = BatchGeometryResources,
  Allocation extends BatchGeometryAllocation = BatchGeometryAllocation,
  MeshHandle extends BatchGeometryMeshHandle = BatchGeometryMeshHandle
> {
  readonly kind: TriangleGeometryStorageKind;

  allocate(): SDKResult<void>;
  destroy(): void;
  webglContextRestored(gl: WebGL2RenderingContext): SDKResult<void>;
  beginBulkMeshAdd(stats?: MeshManagerStepStats | null): void;
  endBulkMeshAdd(stats?: MeshManagerStepStats | null): void;
  uploadChanges(batchResources: BatchGPUResources): boolean;
  getAllocatedBytes(): number;
  getUsedBytes(): number;
  getResources(): Resources;
  getViewResources(viewIndex: number): BatchGeometryViewResources;
  canAddMesh(sceneMesh: SceneMesh, geometryExists: boolean): GPUMemoryCheckResult;
  allocateGeometry(params: {
    sceneGeometry: SceneGeometry;
    geometryIndex: number;
    geometryAttributeTexture: GeometryAttributeTexture;
  }): SDKResult<Allocation>;
  freeGeometryAllocation(allocation: Allocation): void;
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
  }): SDKResult<MeshHandle>;
  deleteMeshHandle(handle: MeshHandle, meshIndex: number, numViews: number): void;
  setMeshMatrix(meshIndex: number, matrix: Mat4): void;
  setMeshTile(meshIndex: number, tileIndex: number): void;
  setMeshPlacement(meshIndex: number, tileIndex: number, matrix: Mat4): void;
  setMeshViewAttribs(meshIndex: number, viewIndex: number, params: BatchGeometryMeshViewAttribs): void;
  setMeshRenderPass(handle: MeshHandle, meshIndex: number, viewIndex: number, renderPass: RenderPassValue): void;
  setMeshVisible(handle: MeshHandle, meshIndex: number, viewIndex: number, visible: boolean): void;
  getDrawArraysParamsForMesh(handle: MeshHandle, sceneGeometry: SceneGeometry, viewIndex: number): { first: number; count: number } | null;
}
