import {SceneGeometry, SceneMaterial, SceneMesh} from "../../../../../model/scene";
import type {SceneModelMemoryPolicy} from "../../../../../model/scene";
import {RenderContext} from "../RenderContext";
import {MeshViewAttributeTexture} from "./dataTextures/MeshViewAttributeTexture";
import {MeshAttributeTexture} from "./dataTextures/MeshAttributeTexture";
import {GeometryQuantRangeTexture} from "./dataTextures/GeometryQuantRangeTexture";
import {VertexPositionTexture} from "./dataTextures/VertexPositionTexture";
import {VertexColorTexture} from "./dataTextures/VertexColorTexture";
import {VertexNormalTexture} from "./dataTextures/VertexNormalTexture";
import {VertexUVTexture} from "./dataTextures/VertexUVTexture";
import {MatrixTexture} from "./dataTextures/MatrixTexture";
import {IndexTexture} from "./dataTextures/IndexTexture";
import {GeometryAttributeTexture} from "./dataTextures/GeometryAttributeTexture";
import {type BatchGPUResources, type TriangleGeometryStorageKind} from "./BatchGPUResources";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../../../../base/constants";
import {PrimitiveMeshIndexTexture} from "./dataTextures/PrimitiveMeshIndexTexture";
import {RENDER_PASSES, type RenderPassValue} from "../RENDER_PASSES";
import {SDKErrorType, SDKInternalException, type SDKResult} from "../../../../../base/core";
import {type MemoryConfigs} from "../../MemoryConfigs";
import type {Mat4} from "../../../../../base/math/matrix";
import type {Vec3} from "../../../../../base/math/vector";
import {quantizeColor3} from "../../../../../base/math/compression";
import {GPUMemoryCheckResult} from "./GPUMemoryCheckResult";
import {
  createBatchGeometryStorage,
  type BatchGeometryAllocation,
  type BatchGeometryStorage,
  type BatchGeometryMeshHandle
} from "./geometry";
import {BatchMaterialResources} from "./materials/BatchMaterialResources";
import {
  BatchPatternResources,
  type BatchPolylineCumDistHandle
} from "./patterns/BatchPatternResources";
import {
  allocateGPUResources,
  restoreGPUResources,
  type AllocatableGPUResource,
  type RestorableGPUResource
} from "./resources/GPUResourceLifecycle";
import type {GPUMemoryMeshPlacement} from "./GPUMemoryMeshHandle";
import type {MeshManagerStepStats} from "../meshManager/MeshManagerStepStats";

export {
  MAX_HATCH_PATTERN_SLOTS,
  MAX_LINE_PATTERN_SLOTS
} from "./patterns/BatchPatternResources";

const DEFAULT_EMISSIVE_COLOR: [number, number, number] = [0, 0, 0];
const tempQuantizedColor: Vec3 = [0, 0, 0];

function copyMatrix4(matrix: Mat4): Mat4 {
  return new Float64Array(matrix as any) as Mat4;
}

function copyVec3(vec: Vec3): Vec3 {
  return [vec[0], vec[1], vec[2]];
}

export type GPUMemoryBatchOptions = {
  primitive?: number;
  hasNormals?: boolean;
  hasUVs?: boolean;
  triplanar?: boolean;
  mipmap?: boolean;
  geometryStorage?: TriangleGeometryStorageKind;
  allocationKind?: "dynamic" | "sealedModel" | "sealedBatch";
  memoryPolicy?: SceneModelMemoryPolicy;
  sceneModelId?: string;
  sceneBatchId?: string;
};

type GeometryHandle = {
  sceneGeometry: SceneGeometry;
  geometryAllocation: BatchGeometryAllocation;
  vertexNormalsPortion: any;
  vertexUVsPortion: any;
  polylineCumDistHandle: BatchPolylineCumDistHandle | null;
  geometryIndex: number;
  useCount: number;
};

type MeshHandle = {
  sceneMesh: SceneMesh;
  meshIndex: number;
  geometryMeshHandle: BatchGeometryMeshHandle;
  tileIndex: number;
  matrix: Mat4;
  colorByView: Vec3[];
  opacityByView: number[];
  renderPassByView: RenderPassValue[];
  visibleMask: number;
  culledMask: number;
};

type PendingMeshAddition = {
  vertexNormalsPortion: any;
  vertexUVsPortion: any;
  geometryAllocation: BatchGeometryAllocation | null;
  geometryIndex: number;
  meshIndex: number;
  geometryMeshHandle: BatchGeometryMeshHandle | null;
  claimedGeometryHandle: GeometryHandle | null;
  polylineCumDistHandle: BatchPolylineCumDistHandle | null;
};

function getViewMaskBit(mask: number, viewIndex: number): boolean {
  return (mask & (1 << viewIndex)) !== 0;
}

function setViewMaskBit(mask: number, viewIndex: number, enabled: boolean): number {
  const bit = 1 << viewIndex;
  return enabled ? (mask | bit) : (mask & ~bit);
}

function createVisibleMask(numViews: number): number {
  return (1 << numViews) - 1;
}

/**
 * Manages GPU-resident, dynamically-editable data storage for model geometry and attributes.
 *
 * @internal
 */
export class GPUMemoryBatch {

  /**
   * GPU resources that implement this batch's renderer-side storage.
   */
  public batchResources: BatchGPUResources;

  /**
   * Backwards-compatible alias for {@link batchResources}.
   *
   * Some existing renderer call sites still use the old name even though a
   * batch may now carry VBO-backed geometry as well as data textures.
   */
  public dataTextures: BatchGPUResources;

  /**
   * Index of this GPUMemoryBatch within the GPUMemoryManager batch array.
   */
  public index: number;

  private _meshAttributeTexture: MeshAttributeTexture;
  private _patternResources: BatchPatternResources;
  private _meshViewAttributeTexture: MeshViewAttributeTexture[];
  private _geometryAttributeTexture: GeometryAttributeTexture;
  private _vertexNormalTexture: VertexNormalTexture | null;
  private _vertexUVTexture: VertexUVTexture | null;
  private _geometryStorage: BatchGeometryStorage;
  private _materialResources: BatchMaterialResources;
  private _meshMatrixTexture: MatrixTexture;
  private _meshIndicesUsed: Uint8Array;
  private _numMeshes: number;
  private _geometryIndicesUsed: Uint8Array;
  private _sceneGeometries: Record<number, SceneGeometry>;
  private _numGeometries: number;
  private _lastFreeMeshIndex: number;
  private _lastFreeGeometryIndex: number;
  private _geometryHandles: Record<string, GeometryHandle>;
  /**
   * Mesh handles keyed directly by meshIndex for fast lookup in hot paths.
   */
  private _meshHandles: Record<number, MeshHandle>;
  /**
   * Keeps addMesh(SceneMesh) idempotent by allowing lookup of an existing meshIndex for a SceneMesh.uniqueId.
   */
  private _meshIndicesByUniqueId: Record<string, number>;
  private _onTick: () => void;
  private _renderContext: RenderContext;

  /**
   * True when this batch carries per-vertex normals — drives lazy
   * allocation of {@link _vertexNormalTexture} and the technique variant
   * that reads from it.
   */
  public readonly hasNormals: boolean;

  /**
   * True when this batch carries per-vertex UV coordinates — drives lazy
   * allocation of {@link _vertexUVTexture} and the technique variant that
   * binds it.
   */
  public readonly hasUVs: boolean;

  /**
   * When `true`, the batch's per-batch PBR atlases (`albedo`,
   * `metallic-roughness`, `normal-map`) get allocated even when
   * {@link hasUVs} is `false`. The renderer's *triplanar* shader
   * variant samples those atlases via world-space UVs derived from
   * `vWorldPos`, so triplanar batches need the atlases populated even
   * though the geometry itself has no per-vertex UV stream.
   */
  public readonly triplanar: boolean;

  /**
   * When `true`, the batch's per-batch PBR atlases are allocated
   * with a full mip pyramid and sampled trilinearly. Set when at
   * least one of the meshes' materials binds an opted-in
   * {@link model!scene.SceneTexture | SceneTexture}
   * (`SceneTextureParams.mipmap === true`); otherwise the atlases
   * stay on the cheap single-level path.
   */
  public readonly mipmap: boolean;

  /**
   * Geometry storage selected when this batch was constructed.
   *
   * Triangle batches can be backed by data-texture geometry (`"dtx"`) or
   * batch-owned VBO geometry (`"vbo"`). Non-triangle batches are normalized
   * to `"dtx"` because their VBO path is not implemented yet.
   */
  public readonly geometryStorage: TriangleGeometryStorageKind;

  /**
   * Primitive type shared by meshes in this batch.
   */
  public readonly primitive: number | undefined;

  /**
   * Renderer allocation scope represented by this batch.
   */
  public readonly allocationKind: "dynamic" | "sealedModel" | "sealedBatch";

  /**
   * Capacity policy requested by the source SceneModel.
   */
  public readonly memoryPolicy: SceneModelMemoryPolicy;

  /**
   * Source SceneModel ID when the batch is model- or batch-scoped.
   */
  public readonly sceneModelId?: string;

  /**
   * Source SceneModel batch ID when this is a committed-batch allocation.
   */
  public readonly sceneBatchId?: string;

  /**
   * Creates a new GPUMemoryBatch.
   */
  constructor(index: number, renderContext: RenderContext, options: GPUMemoryBatchOptions = {}) {

    this.index = index;

    this._renderContext = renderContext;
    this.primitive = options.primitive;
    this.hasNormals = options.hasNormals === true;
    this.hasUVs = options.hasUVs === true;
    this.triplanar = options.triplanar === true;
    this.mipmap = options.mipmap === true;
    this.geometryStorage = this.primitive === TrianglesPrimitive && options.geometryStorage === "vbo" ? "vbo" : "dtx";
    this.allocationKind = options.allocationKind ?? "dynamic";
    this.memoryPolicy = options.memoryPolicy ?? "stream";
    this.sceneModelId = options.sceneModelId;
    this.sceneBatchId = options.sceneBatchId;

    this._geometryHandles = {};
    this._meshHandles = {};
    this._meshIndicesByUniqueId = {};

    const memoryConfigs = renderContext.memoryConfigs;

    this._meshIndicesUsed = new Uint8Array(memoryConfigs.maxBatchMeshes);
    this._lastFreeMeshIndex = 0;
    this._geometryIndicesUsed = new Uint8Array(memoryConfigs.maxBatchGeometries);
    this._lastFreeGeometryIndex = 0;
    this._sceneGeometries = {};
    this._numGeometries = 0;
    this._numMeshes = 0;
    this._geometryStorage = createBatchGeometryStorage({
      kind: this.geometryStorage,
      gl: renderContext.gl,
      batchIndex: this.index,
      memoryConfigs,
      bins: [
        RENDER_PASSES.OPAQUE,
        RENDER_PASSES.TRANSPARENT,
        RENDER_PASSES.HIGHLIGHTED,
        RENDER_PASSES.SELECTED,
        RENDER_PASSES.XRAYED
      ],
      getNumGeometries: () => this._numGeometries,
      hasNormals: this.hasNormals
    });
    this._vertexNormalTexture = null;
    this._vertexUVTexture = null;
    this._materialResources = new BatchMaterialResources({
      gl: renderContext.gl,
      batchIndex: this.index,
      hasUVs: this.hasUVs,
      triplanar: this.triplanar,
      mipmap: this.mipmap
    });
    this._patternResources = new BatchPatternResources({
      gl: renderContext.gl,
      batchIndex: this.index,
      maxBatchIndices: memoryConfigs.maxBatchIndices
    });
  }

  /**
   * Allocates all data textures for this GPUMemoryBatch.
   */
  allocate(): SDKResult<void> {

    const gl = this._renderContext.gl;

    const memoryConfigs: MemoryConfigs = this._renderContext.memoryConfigs;

    const numViews = memoryConfigs.maxViews;

    this._meshViewAttributeTexture = [];

    for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
      this._meshViewAttributeTexture.push(
        new MeshViewAttributeTexture({
          gl,
          maxItems: memoryConfigs.maxBatchMeshes,
          getNumItems: () => this._numMeshes,
          description: `[Batch ${this.index}, View ${viewIndex}] - meshIndex -> color, opacity, flags`
        }));
    }

    this._meshAttributeTexture = new MeshAttributeTexture({
      gl,
      maxItems: memoryConfigs.maxBatchMeshes,
      description: `[Batch ${this.index}] - meshIndex -> geometryIndex, tileIndex`,
      getNumItems: () => this._numMeshes
    });

    this._meshMatrixTexture = new MatrixTexture({
      gl,
      maxItems: memoryConfigs.maxBatchMeshes,
      getNumItems: () => this._numMeshes,
      description: `[Batch ${this.index}] - meshIndex -> modelMatrix`
    });

    this._geometryAttributeTexture = new GeometryAttributeTexture({
      gl,
      maxItems: memoryConfigs.maxBatchGeometries,
      getNumItems: () => this._numGeometries,
      description: `[Batch ${this.index}] - geometryIndex -> verticesBase, indicesBase, edgeIndicesBase`
    });

    if (this.hasNormals && this.geometryStorage !== "vbo") {
      this._vertexNormalTexture = new VertexNormalTexture({
        gl,
        maxItems: memoryConfigs.maxBatchVertices,
        description: `[Batch ${this.index}] - vertex normals (octahedral RG16UI)`
      });
    }

    if (this.hasUVs) {
      this._vertexUVTexture = new VertexUVTexture({
        gl,
        maxItems: memoryConfigs.maxBatchVertices,
        description: `[Batch ${this.index}] - vertex UVs (RG16UI, [0, 1] mapped to [0, 65535])`
      });
    }

    const resources: AllocatableGPUResource[] = [
      this._geometryStorage,
      this._meshAttributeTexture,
      ...this._patternResources.getAllocatableResources(),
      ...this._meshViewAttributeTexture,
      this._meshMatrixTexture,
      this._geometryAttributeTexture,
      ...(this._vertexNormalTexture ? [this._vertexNormalTexture] : []),
      ...(this._vertexUVTexture ? [this._vertexUVTexture] : []),
      ...this._materialResources.getAllocatableResources()
    ];

    const allocateResult = allocateGPUResources(resources);
    if (allocateResult.ok === false) {
      return allocateResult;
    }

    const views = [];
    for (let i = 0; i < numViews; i++) {
      const geometryViewResources = this._geometryStorage.getViewResources(i);
      views.push({
        numDrawablePrims: 0,
        primitiveMeshIndexTexture: geometryViewResources.primitiveMeshIndexTexture,
        edgeMeshIndexTexture: geometryViewResources.edgeMeshIndexTexture,
        meshViewAttributeTexture: this._meshViewAttributeTexture[i],
        renderPassPrimitiveRanges: geometryViewResources.renderPassPrimitiveRanges,
        renderPassEdgePrimitiveRanges: geometryViewResources.renderPassEdgePrimitiveRanges,
        pickPrimitiveRange: geometryViewResources.pickPrimitiveRange,
        pickEdgePrimitiveRange: geometryViewResources.pickEdgePrimitiveRange,
      });
    }

    const geometryResources = this._geometryStorage.getResources();
    const dtxGeometryResources = geometryResources.kind === "dtx" ? geometryResources : null;
    const vboGeometryResources = geometryResources.kind === "vbo" ? geometryResources : null;

    this.batchResources = {
      allocationKind: this.allocationKind,
      memoryPolicy: this.memoryPolicy,
      sceneModelId: this.sceneModelId,
      sceneBatchId: this.sceneBatchId,
      geometryStorage: this.geometryStorage,
      views,
      indexTexture: dtxGeometryResources?.indexTexture,
      edgeIndexTexture: dtxGeometryResources?.edgeIndexTexture,
      meshMatrixTexture: this._meshMatrixTexture,
      meshAttributeTexture: this._meshAttributeTexture,
      ...this._patternResources.getDataTextureResources(),
      geometryAttributeTexture: this._geometryAttributeTexture,
      geometryQuantRangeTexture: dtxGeometryResources?.geometryQuantRangeTexture,
      vertexPositionTexture: dtxGeometryResources?.vertexPositionTexture,
      vertexColorTexture: dtxGeometryResources?.vertexColorTexture,
      vertexNormalTexture: this._vertexNormalTexture ?? undefined,
      vertexUVTexture: this._vertexUVTexture ?? undefined,
      triangleGeometryVBO: vboGeometryResources?.triangleGeometryVBO,
      ...this._materialResources.getDataTextureResources()
    };
    this.dataTextures = this.batchResources;

    // this.structSpecs = {
    //   MeshAttribs: this._meshAttributeTexture.structSpec
    // }

    return {
      ok: true,
      value: undefined
    };
  }

  static getItemSizesInBytes(numViews = 1): { [key: string]: number } {
    return {
      mesh: MeshAttributeTexture.itemSizeInBytes
        + MeshViewAttributeTexture.itemSizeInBytes * numViews
        + MatrixTexture.itemSizeInBytes,
      geometry: GeometryAttributeTexture.itemSizeInBytes + GeometryQuantRangeTexture.itemSizeInBytes,
      vertex: VertexPositionTexture.itemSizeInBytes + VertexColorTexture.itemSizeInBytes,
      index: IndexTexture.itemSizeInBytes,
      prim: PrimitiveMeshIndexTexture.itemSizeInBytes,
      edge: PrimitiveMeshIndexTexture.itemSizeInBytes
    }
  }

  static get itemSizesInBytes(): { [key: string]: number } {
    return GPUMemoryBatch.getItemSizesInBytes();
  }

  /**
   * Re-upload the pixels of an already-cached SceneTexture from this
   * batch's material atlases. Walks all PBR atlases and re-uploads wherever the id
   * matches; returns `true` if any of them held the texture.
   *
   * Used by the post-finalize `onSceneTextureImageDataChanged` flow.
   * The source's dimensions must match the placement — heat-map
   * painting mutates pixels in place but never resizes.
   */
  updateSceneTexture(sceneTexture: { id: string; image?: any; imageData?: any }): boolean {
    return this._materialResources.updateSceneTexture(sceneTexture);
  }

  getAllocatedBytes(): number {
    let total = this._geometryStorage.getAllocatedBytes();
    if (this._vertexNormalTexture) total += this._vertexNormalTexture.getAllocatedBytes();
    if (this._vertexUVTexture)     total += this._vertexUVTexture.getAllocatedBytes();
    total += this._materialResources.getAllocatedBytes();
    total += this._patternResources.getAllocatedBytes();
    total += this._meshAttributeTexture.getAllocatedBytes();
    total += this._geometryAttributeTexture.getAllocatedBytes();
    total += this._meshMatrixTexture.getAllocatedBytes();
    const numViews = this._meshViewAttributeTexture.length;
    for (let i = 0; i < numViews; i++) {
      total += this._meshViewAttributeTexture[i].getAllocatedBytes();
    }
    return total;
  }

  /**
   * Returns the total number of bytes currently used by all managed arrays in this batch.
   */
  getUsedBytes(): number {
    let total = this._geometryStorage.getUsedBytes();
    if (this._vertexNormalTexture) total += this._vertexNormalTexture.getUsedBytes();
    if (this._vertexUVTexture)     total += this._vertexUVTexture.getUsedBytes();
    total += this._materialResources.getUsedBytes();
    total += this._patternResources.getUsedBytes();
    total += this._meshAttributeTexture.getUsedBytes();
    total += this._geometryAttributeTexture.getUsedBytes();
    total += this._meshMatrixTexture.getUsedBytes();
    const numViews = this._meshViewAttributeTexture.length;
    for (let i = 0; i < numViews; i++) {
      total += this._meshViewAttributeTexture[i].getUsedBytes();
    }
    return total;
  }

  beginBulkMeshAdd(stats?: MeshManagerStepStats | null): void {
    this._geometryStorage.beginBulkMeshAdd(stats);
  }

  endBulkMeshAdd(stats?: MeshManagerStepStats | null): void {
    this._geometryStorage.endBulkMeshAdd(stats);
  }

  /**
   * Check if there is enough memory for a SceneMesh.
   * @param sceneMesh
   * @returns GPUMemoryCheckResult indicating if the mesh can be added, or if not, what resource limit would be exceeded.
   */
  hasMemoryForMesh(sceneMesh: SceneMesh): GPUMemoryCheckResult {
    if (this._numMeshes >= this._renderContext.memoryConfigs.maxBatchMeshes) {
      return GPUMemoryCheckResult.TooManyMeshes;
    }
    const geometry = sceneMesh.geometry;
    if (!geometry) {
      return GPUMemoryCheckResult.NoGeometry;
    }
    const vertCount = (geometry.positionsCompressed?.length ?? 0) / 3;
    const geometryExists = !!this._geometryHandles[geometry.uniqueId];
    if (!geometryExists) {
      if (this._numGeometries >= this._renderContext.memoryConfigs.maxBatchGeometries) {
        return GPUMemoryCheckResult.TooManyGeometries;
      }
      if (vertCount <= 0) {
        return GPUMemoryCheckResult.NotEnoughVertexSpace;
      }
    }
    if (!geometryExists) {
      // For batches with normals, the normals portion size matches the
      // vertex count (two u16s per vertex = one item). A normals-bearing
      // geometry landing in a non-normals batch is filtered out earlier
      // by MeshManager._getMeshBatch, so we don't have to handle that case.
      if (this._vertexNormalTexture && geometry.normalsCompressed
        && this._vertexNormalTexture.canGetPortion(geometry.normalsCompressed.length / 2) === false) {
        return GPUMemoryCheckResult.NotEnoughVertexSpace;
      }
      // Same shape for UVs: 2 u16s per vertex = one item. Same routing
      // guarantee from MeshManager.
      if (this._vertexUVTexture && geometry.uvsCompressed
        && this._vertexUVTexture.canGetPortion(geometry.uvsCompressed.length / 2) === false) {
        return GPUMemoryCheckResult.NotEnoughVertexSpace;
      }
    }
    const storageCheck = this._geometryStorage.canAddMesh(sceneMesh, geometryExists);
    if (storageCheck !== GPUMemoryCheckResult.OK) {
      return storageCheck;
    }
    // Atlas-fit probe — if any of the mesh's PBR-map textures wouldn't
    // fit in the corresponding batch atlas but WOULD fit in a fresh
    // atlas, route the mesh to a new batch. Textures that are simply
    // too big for any atlas of this size fall through here and end up
    // on the sentinel at upload time.
    if (this._materialResources.hasAtlasOverflow(sceneMesh)) {
      return GPUMemoryCheckResult.NotEnoughAtlasSpace;
    }
    return GPUMemoryCheckResult.OK;
  }

  /**
   * Adds a SceneMesh to this GPUMemoryBatch.
   *
   * Returns an index through which you can dynamically update attributes for the mesh.
   *
   * @param sceneMesh
   */
  addMesh(sceneMesh: SceneMesh, placement?: GPUMemoryMeshPlacement, stats?: MeshManagerStepStats | null): SDKResult<number> {
    const addStart = stats ? performance.now() : 0;
    if (stats) {
      stats.gpuAddMeshCalls++;
    }

    const existingMeshIndex = this._meshIndicesByUniqueId[sceneMesh.uniqueId];
    if (existingMeshIndex !== undefined) {
      if (stats) {
        stats.gpuAddMeshMs += performance.now() - addStart;
      }
      return {ok: true, value: existingMeshIndex};
    }

    const maxBatchMeshes = this._renderContext.memoryConfigs.maxBatchMeshes;

    if (this._numMeshes >= maxBatchMeshes) {
      if (stats) {
        stats.gpuAddMeshMs += performance.now() - addStart;
      }
      return {
        ok: false,
        type: SDKErrorType.MemoryAllocationFailed,
        error: `GPUMemoryBatch.addMesh: Exceeded maximum number of meshes (${maxBatchMeshes})`
      }
    }

    const sceneGeometry = sceneMesh.geometry;
    let geometryHandle = this._geometryHandles[sceneGeometry.uniqueId];

    const pending: PendingMeshAddition = {
      vertexNormalsPortion: null,
      vertexUVsPortion: null,
      geometryAllocation: null,
      geometryIndex: -1,
      meshIndex: this._getFreeMeshIndex(),
      geometryMeshHandle: null,
      claimedGeometryHandle: null,
      polylineCumDistHandle: null
    };

    if (this._meshHandles[pending.meshIndex]) {
      this._rollbackMeshAddition(sceneGeometry, pending);
      if (stats) {
        stats.gpuAddMeshMs += performance.now() - addStart;
      }
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `GPUMemoryBatch.addMesh: Mesh handle already exists at meshIndex ${pending.meshIndex}`
      };
    }

    if (!geometryHandle) {
      const geometryHandleStart = stats ? performance.now() : 0;
      const geometryHandleResult = this._createGeometryHandle(sceneGeometry, pending);
      if (stats) {
        stats.gpuCreateGeometryHandleMs += performance.now() - geometryHandleStart;
        stats.gpuCreateGeometryHandleCalls++;
      }
      if (geometryHandleResult.ok === false) {
        this._rollbackMeshAddition(sceneGeometry, pending);
        if (stats) {
          stats.gpuAddMeshMs += performance.now() - addStart;
        }
        return geometryHandleResult;
      }
      geometryHandle = geometryHandleResult.value;
    }

    geometryHandle.useCount++;
    pending.claimedGeometryHandle = geometryHandle;
    const tileIndex = placement?.tileIndex ?? 0;
    const matrix = placement?.rtcMatrix ?? sceneMesh.worldMatrix;
    const meshAttributesStart = stats ? performance.now() : 0;
    this._writeMeshAttributes(pending.meshIndex, sceneMesh, geometryHandle, tileIndex);
    if (stats) {
      stats.gpuWriteMeshAttributesMs += performance.now() - meshAttributesStart;
    }

    const numViews = this._renderContext.memoryConfigs.maxViews;

    const color: Vec3 = quantizeColor3(sceneMesh.effectiveColor, tempQuantizedColor);

    const opacity = Math.floor(sceneMesh.effectiveOpacity * 255.0);

    const meshViewAttributesStart = stats ? performance.now() : 0;
    this._initializeMeshViewAttributes(pending.meshIndex, numViews, color, opacity);
    if (stats) {
      stats.gpuInitMeshViewAttributesMs += performance.now() - meshViewAttributesStart;
    }

    const meshMatrixStart = stats ? performance.now() : 0;
    this._meshMatrixTexture.setItem(pending.meshIndex, matrix);
    if (stats) {
      stats.gpuWriteMeshMatrixMs += performance.now() - meshMatrixStart;
    }

    const primitiveCount = getSceneGeometryPrimitiveCount(sceneGeometry);

    const geometryMeshHandleStart = stats ? performance.now() : 0;
    const geometryMeshHandleResult = this._geometryStorage.createMeshHandle({
      sceneMesh,
      meshIndex: pending.meshIndex,
      primitiveCount,
      numViews,
      color,
      opacity,
      matrix,
      tileIndex,
      stats
    });
    if (stats) {
      stats.gpuCreateGeometryMeshHandleMs += performance.now() - geometryMeshHandleStart;
    }
    if (geometryMeshHandleResult.ok === false) {
      this._rollbackMeshAddition(sceneGeometry, pending);
      if (stats) {
        stats.gpuAddMeshMs += performance.now() - addStart;
      }
      return geometryMeshHandleResult;
    }
    pending.geometryMeshHandle = geometryMeshHandleResult.value;

    const meshRecordStart = stats ? performance.now() : 0;
    this._meshHandles[pending.meshIndex] = this._createMeshHandleRecord({
      sceneMesh,
      meshIndex: pending.meshIndex,
      geometryMeshHandle: pending.geometryMeshHandle,
      matrix,
      color,
      opacity,
      numViews
    });
    if (stats) {
      stats.gpuCreateMeshRecordMs += performance.now() - meshRecordStart;
    }
    pending.claimedGeometryHandle = null;

    this._meshIndicesByUniqueId[sceneMesh.uniqueId] = pending.meshIndex;
    this._sceneGeometries[geometryHandle.geometryIndex] = sceneGeometry;

    this._numMeshes++;
    if (stats) {
      stats.gpuAddMeshMs += performance.now() - addStart;
    }

    return {
      ok: true,
      value: pending.meshIndex
    };
  }

  private _createGeometryHandle(sceneGeometry: SceneGeometry, pending: PendingMeshAddition): SDKResult<GeometryHandle> {
    const maxGeometries = this._renderContext.memoryConfigs.maxBatchGeometries;
    if (this._numGeometries >= maxGeometries) {
      return {
        ok: false,
        type: SDKErrorType.MemoryAllocationFailed,
        error: `GPUMemoryBatch.addMesh: Exceeded maximum number of geometries (${maxGeometries})`
      };
    }

    pending.geometryIndex = this._getFreeGeometryIndex();

    const geometryAllocationResult = this._geometryStorage.allocateGeometry({
      sceneGeometry,
      geometryIndex: pending.geometryIndex,
      geometryAttributeTexture: this._geometryAttributeTexture
    });
    if (geometryAllocationResult.ok === false) {
      return geometryAllocationResult;
    }
    pending.geometryAllocation = geometryAllocationResult.value;

    const vertexNormalsPortionResult = this._allocateVertexNormals(sceneGeometry, pending.geometryIndex);
    if (vertexNormalsPortionResult.ok === false) {
      return vertexNormalsPortionResult;
    }
    pending.vertexNormalsPortion = vertexNormalsPortionResult.value;

    const vertexUVsPortionResult = this._allocateVertexUVs(sceneGeometry, pending.geometryIndex);
    if (vertexUVsPortionResult.ok === false) {
      return vertexUVsPortionResult;
    }
    pending.vertexUVsPortion = vertexUVsPortionResult.value;

    pending.polylineCumDistHandle = this._patternResources.allocatePolylineCumDist(
      sceneGeometry,
      pending.geometryIndex,
      this._geometryAttributeTexture
    );

    this._writeGeometryAttributes(
      sceneGeometry,
      pending.geometryIndex,
      pending.geometryAllocation,
      pending.vertexNormalsPortion,
      pending.vertexUVsPortion,
      pending.polylineCumDistHandle
    );

    const geometryHandle: GeometryHandle = {
      sceneGeometry,
      geometryAllocation: pending.geometryAllocation,
      vertexNormalsPortion: pending.vertexNormalsPortion,
      vertexUVsPortion: pending.vertexUVsPortion,
      polylineCumDistHandle: pending.polylineCumDistHandle,
      geometryIndex: pending.geometryIndex,
      useCount: 0
    };

    this._geometryHandles[sceneGeometry.uniqueId] = geometryHandle;
    this._numGeometries++;

    return {ok: true, value: geometryHandle};
  }

  private _allocateVertexNormals(sceneGeometry: SceneGeometry, geometryIndex: number): SDKResult<any | null> {
    if (!this._vertexNormalTexture || !sceneGeometry.normalsCompressed) {
      return {ok: true, value: null};
    }
    const vertexNormalsPortion = this._vertexNormalTexture.getPortion(
      sceneGeometry.normalsCompressed,
      (newBase: number) => {
        this._geometryAttributeTexture.setItem(geometryIndex, {
          normalsBase: newBase
        });
      }
    );
    if (vertexNormalsPortion === null) {
      return {
        ok: false,
        type: SDKErrorType.MemoryAllocationFailed,
        error: `GPUMemoryBatch.addMesh: Unable to allocate vertex normals portion (of length ${sceneGeometry.normalsCompressed.length}) for geometry ${sceneGeometry.id} - limit is ${this._renderContext.memoryConfigs.maxBatchVertices * 2} normal components`
      };
    }
    return {ok: true, value: vertexNormalsPortion};
  }

  private _allocateVertexUVs(sceneGeometry: SceneGeometry, geometryIndex: number): SDKResult<any | null> {
    if (!this._vertexUVTexture || !sceneGeometry.uvsCompressed) {
      return {ok: true, value: null};
    }
    const vertexUVsPortion = this._vertexUVTexture.getPortion(
      sceneGeometry.uvsCompressed,
      (newBase: number) => {
        this._geometryAttributeTexture.setItem(geometryIndex, {
          uvsBase: newBase
        });
      }
    );
    if (vertexUVsPortion === null) {
      return {
        ok: false,
        type: SDKErrorType.MemoryAllocationFailed,
        error: `GPUMemoryBatch.addMesh: Unable to allocate vertex UVs portion (of length ${sceneGeometry.uvsCompressed.length}) for geometry ${sceneGeometry.id} - limit is ${this._renderContext.memoryConfigs.maxBatchVertices * 2} UV components`
      };
    }
    return {ok: true, value: vertexUVsPortion};
  }

  private _writeGeometryAttributes(
    _sceneGeometry: SceneGeometry,
    geometryIndex: number,
    geometryAllocation: BatchGeometryAllocation,
    vertexNormalsPortion: any,
    vertexUVsPortion: any,
    polylineCumDistHandle: BatchPolylineCumDistHandle | null
  ): void {
    const dtxGeometryAllocation = geometryAllocation.kind === "dtx" ? geometryAllocation : null;
    this._geometryAttributeTexture.setItem(geometryIndex, {
      verticesBase: dtxGeometryAllocation?.positionsPortion?.base ?? 0,
      indicesBase: dtxGeometryAllocation?.indicesHandle?.base ?? 0,
      edgeIndicesBase: dtxGeometryAllocation?.edgeIndicesHandle?.base ?? 0,
      normalsBase: vertexNormalsPortion ? vertexNormalsPortion.base : 0,
      uvsBase: vertexUVsPortion ? vertexUVsPortion.base : 0,
      polylineCumDistBase: polylineCumDistHandle ? polylineCumDistHandle.base : 0,
      vertexColorsBase: dtxGeometryAllocation?.vertexColorsPortion?.base ?? 0,
    });
  }

  private _writeMeshAttributes(meshIndex: number, sceneMesh: SceneMesh, geometryHandle: GeometryHandle, tileIndex: number): void {
    const textureTransforms = this._materialResources.resolveTextureTransforms(sceneMesh);
    const patternSlots = this._patternResources.resolveMeshPatternSlots(sceneMesh);

    this._meshAttributeTexture.setItem(meshIndex, {
      tileIndex,
      geometryIndex: geometryHandle.geometryIndex,
      roughness: sceneMesh.effectiveRoughness,
      metallic: sceneMesh.effectiveMetallic,
      alphaMode: sceneMesh.effectiveAlphaMode,
      alphaCutoff: sceneMesh.effectiveAlphaCutoff,
      albedoUVOffset: [textureTransforms.albedo.uOffset, textureTransforms.albedo.vOffset],
      albedoUVScale: [textureTransforms.albedo.uScale, textureTransforms.albedo.vScale],
      metallicRoughnessUVOffset: [textureTransforms.metallicRoughness.uOffset, textureTransforms.metallicRoughness.vOffset],
      metallicRoughnessUVScale: [textureTransforms.metallicRoughness.uScale, textureTransforms.metallicRoughness.vScale],
      normalMapUVOffset: [textureTransforms.normalMap.uOffset, textureTransforms.normalMap.vOffset],
      normalMapUVScale: [textureTransforms.normalMap.uScale, textureTransforms.normalMap.vScale],
      emissiveUVOffset: [textureTransforms.emissive.uOffset, textureTransforms.emissive.vOffset],
      emissiveUVScale: [textureTransforms.emissive.uScale, textureTransforms.emissive.vScale],
      occlusionUVOffset: [textureTransforms.occlusion.uOffset, textureTransforms.occlusion.vOffset],
      occlusionUVScale: [textureTransforms.occlusion.uScale, textureTransforms.occlusion.vScale],
      emissiveColor: sceneMesh.material
        ? sceneMesh.material.emissiveColor as [number, number, number]
        : DEFAULT_EMISSIVE_COLOR,
      triplanarScale: sceneMesh.effectiveTriplanarScale,
      lineWidth: sceneMesh.effectiveLineWidth,
      linePatternSlot: patternSlots.linePatternSlot,
      hatchPatternSlot: patternSlots.hatchPatternSlot,
      billboard: sceneMesh.billboard === "spherical" ? 1 : 0,
    });
  }

  private _initializeMeshViewAttributes(meshIndex: number, numViews: number, color: Vec3, opacity: number): void {
    for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
      this._meshViewAttributeTexture[viewIndex].setItem(meshIndex, {
        color,
        opacity,
        pickable: true,
        clippable: true
      });
    }
  }

  private _createMeshHandleRecord(params: {
    sceneMesh: SceneMesh;
    meshIndex: number;
    geometryMeshHandle: BatchGeometryMeshHandle;
    matrix: Mat4;
    color: Vec3;
    opacity: number;
    numViews: number;
  }): MeshHandle {
    const colorByView: Vec3[] = [];
    const opacityByView: number[] = [];
    const renderPassByView: RenderPassValue[] = [];
    for (let viewIndex = 0; viewIndex < params.numViews; viewIndex++) {
      colorByView.push(copyVec3(params.color));
      opacityByView.push(params.opacity);
      renderPassByView.push(RENDER_PASSES.OPAQUE);
    }
    return {
      sceneMesh: params.sceneMesh,
      meshIndex: params.meshIndex,
      geometryMeshHandle: params.geometryMeshHandle,
      tileIndex: 0,
      matrix: copyMatrix4(params.matrix),
      colorByView,
      opacityByView,
      renderPassByView,
      visibleMask: createVisibleMask(params.numViews),
      culledMask: 0
    };
  }

  private _rollbackMeshAddition(sceneGeometry: SceneGeometry, pending: PendingMeshAddition): void {
    const numViews = this._renderContext.memoryConfigs.maxViews;
    if (pending.geometryMeshHandle) {
      this._geometryStorage.deleteMeshHandle(pending.geometryMeshHandle, pending.meshIndex, numViews);
      pending.geometryMeshHandle = null;
    }

    if (pending.claimedGeometryHandle) {
      const geometryHandle = pending.claimedGeometryHandle;
      pending.claimedGeometryHandle = null;
      if (--geometryHandle.useCount <= 0) {
        this._geometryStorage.freeGeometryAllocation(geometryHandle.geometryAllocation);
        if (geometryHandle.vertexNormalsPortion && this._vertexNormalTexture) {
          this._vertexNormalTexture.putPortion(geometryHandle.vertexNormalsPortion);
        }
        if (geometryHandle.vertexUVsPortion && this._vertexUVTexture) {
          this._vertexUVTexture.putPortion(geometryHandle.vertexUVsPortion);
        }
        this._patternResources.freePolylineCumDistHandle(geometryHandle.polylineCumDistHandle);
        delete this._geometryHandles[sceneGeometry.uniqueId];
        delete this._sceneGeometries[geometryHandle.geometryIndex];
        this._putFreeGeometryIndex(geometryHandle.geometryIndex);
        this._numGeometries--;
      }
      pending.geometryAllocation = null;
      pending.vertexNormalsPortion = null;
      pending.vertexUVsPortion = null;
      pending.polylineCumDistHandle = null;
      pending.geometryIndex = -1;
    }

    if (pending.geometryAllocation) {
      this._geometryStorage.freeGeometryAllocation(pending.geometryAllocation);
      pending.geometryAllocation = null;
    }
    if (pending.vertexNormalsPortion && this._vertexNormalTexture) {
      this._vertexNormalTexture.putPortion(pending.vertexNormalsPortion);
      pending.vertexNormalsPortion = null;
    }
    if (pending.vertexUVsPortion && this._vertexUVTexture) {
      this._vertexUVTexture.putPortion(pending.vertexUVsPortion);
      pending.vertexUVsPortion = null;
    }
    if (pending.polylineCumDistHandle) {
      this._patternResources.freePolylineCumDistHandle(pending.polylineCumDistHandle);
      pending.polylineCumDistHandle = null;
    }
    if (pending.geometryIndex !== -1) {
      delete this._sceneGeometries[pending.geometryIndex];
      this._putFreeGeometryIndex(pending.geometryIndex);
      pending.geometryIndex = -1;
    }
    if (pending.meshIndex !== -1) {
      delete this._meshHandles[pending.meshIndex];
      delete this._meshIndicesByUniqueId[sceneGeometry.uniqueId];
      this._putFreeMeshIndex(pending.meshIndex);
      pending.meshIndex = -1;
    }
  }

  /**
   * Sets the modeling transform matrix for a mesh.
   * The modeling transform is relative to the center of the meshes tile.
   *
   * Sets RenderContext.viewFlags[...].needsRender to true.
   *
   * @param meshIndex
   * @param matrix
   */
  setMeshMatrix(
    meshIndex: number,
    matrix: Mat4): void {
    this._meshMatrixTexture.setItem(meshIndex, matrix);
    this._geometryStorage.setMeshMatrix(meshIndex, matrix);
    const meshHandle = this._meshHandles[meshIndex];
    if (meshHandle) {
      meshHandle.matrix = copyMatrix4(matrix);
    }
  }

  /**
   * Sets attributes for e mesh to apply across all Views.
   *
   * Sets RenderContext.viewFlags[...].needsRender to true.
   *
   * @param meshIndex
   * @param params
   * @param params.tileIndex Optional tileIndex of the GPUTile containing the mesh. This can be dynamically updated, as mesh can move between tiles.
   */
  setMeshAttribs(
    meshIndex: number,
    params: {
      tileIndex?: number;
      emissiveColor?: [number, number, number];
    }) {
    this._meshAttributeTexture.setItem(meshIndex, params);
    if (params.tileIndex !== undefined) {
      this._geometryStorage.setMeshTile(meshIndex, params.tileIndex);
      const meshHandle = this._meshHandles[meshIndex];
      if (meshHandle) {
        meshHandle.tileIndex = params.tileIndex;
      }
    }
  }

  setMeshPlacement(meshIndex: number, placement: GPUMemoryMeshPlacement): void {
    this._meshAttributeTexture.setItem(meshIndex, {
      tileIndex: placement.tileIndex
    });
    this._meshMatrixTexture.setItem(meshIndex, placement.rtcMatrix);
    this._geometryStorage.setMeshPlacement(meshIndex, placement.tileIndex, placement.rtcMatrix);
    const meshHandle = this._meshHandles[meshIndex];
    if (meshHandle) {
      meshHandle.tileIndex = placement.tileIndex;
      meshHandle.matrix = copyMatrix4(placement.rtcMatrix);
    }
  }

  /**
   * Sets attributes for a mesh within a specific View.
   *
   * Sets RenderContext.viewFlags[viewIndex].needsRender to true.
   *
   * @param meshIndex
   * @param viewIndex
   * @param params
   */
  setMeshViewAttribs(
    meshIndex: number,
    viewIndex: number,
    params: {
      color?: Vec3;   // uvec3 bytes 0..255
      opacity?: number; // byte 0..255
      pickable?: boolean;
      clippable?: boolean;
    }) {
    if (viewIndex < 0 || viewIndex >= this._meshViewAttributeTexture.length) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshViewAttribs: Invalid viewIndex ${viewIndex}`);
    }
    this._meshViewAttributeTexture[viewIndex].setItem(meshIndex, params);
    this._geometryStorage.setMeshViewAttribs(meshIndex, viewIndex, params);
    const meshHandle = this._meshHandles[meshIndex];
    if (meshHandle) {
      if (params.color) {
        meshHandle.colorByView[viewIndex] = copyVec3(params.color);
      }
      if (params.opacity !== undefined) {
        meshHandle.opacityByView[viewIndex] = params.opacity;
      }
    }
  }

  /**
   * Sets the renderPass for a SceneMesh within a specific View.
   *
   * @param meshIndex
   * @param viewIndex
   * @param renderPass
   */
  setMeshRenderPass(
    meshIndex: number,
    viewIndex: number,
    renderPass: RenderPassValue) {
    const meshHandle = this._meshHandles[meshIndex];
    if (!meshHandle) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshRenderBin: Mesh ${meshIndex} has no meshHandle`);
    }
    meshHandle.renderPassByView[viewIndex] = renderPass;
    this._geometryStorage.setMeshRenderPass(meshHandle.geometryMeshHandle, meshIndex, viewIndex, renderPass);
  }

  /**
   * Sets whether a mesh is included in rendering for one view.
   *
   * @param meshIndex
   * @param viewIndex
   * @param visible
   */
  setMeshVisible(
    meshIndex: number,
    viewIndex: number,
    visible: boolean) {
    const meshHandle = this._meshHandles[meshIndex];
    if (!meshHandle) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshVisible: Mesh ${meshIndex} has no meshHandle`);
    }
    meshHandle.visibleMask = setViewMaskBit(meshHandle.visibleMask, viewIndex, visible);
    this._applyMeshDrawInclusion(meshHandle, viewIndex);
  }

  /**
   * Sets per-view mesh cull state. Culling and visibility are
   * independent inputs to the same draw-inclusion decision — a culled
   * mesh is dropped from the view's draw index just like a hidden one,
   * but without disturbing the user-set visibility, so toggling
   * culling never reveals an object the app deliberately hid.
   *
   * @param viewIndex
   * @param culled
   */
  setMeshCulled(
    meshIndex: number,
    viewIndex: number,
    culled: boolean) {
    const meshHandle = this._meshHandles[meshIndex];
    if (!meshHandle) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshCulled: Mesh ${meshIndex} has no meshHandle`);
    }
    meshHandle.culledMask = setViewMaskBit(meshHandle.culledMask, viewIndex, culled);
    this._applyMeshDrawInclusion(meshHandle, viewIndex);
  }

  // Writes the effective draw-inclusion (visible AND not culled) for a
  // mesh in a view to the primitive and edge index textures — the same
  // mechanism plain visibility uses to add/remove a mesh from the
  // view's compacted draw list.
  private _applyMeshDrawInclusion(meshHandle: MeshHandle, viewIndex: number): void {
    const include = getViewMaskBit(meshHandle.visibleMask, viewIndex) && !getViewMaskBit(meshHandle.culledMask, viewIndex);
    this._geometryStorage.setMeshVisible(meshHandle.geometryMeshHandle, meshHandle.meshIndex, viewIndex, include);
  }

  /**
   * Updates the per-view clippable bit for a mesh on the
   * shared MeshViewAttributeTexture. The renderer reads this
   * bit as `vClippable` in the fragment shader's section-plane
   * test.
   */
  setMeshClippable(
    meshIndex: number,
    viewIndex: number,
    clippable: boolean,
  ) {
    const tex = this._meshViewAttributeTexture[viewIndex];
    if (!tex) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshClippable: no MeshViewAttributeTexture for view ${viewIndex}`);
    }
    tex.setItem(meshIndex, {clippable});
    this._geometryStorage.setMeshViewAttribs(meshIndex, viewIndex, {clippable});
  }

  /**
   * Removes a SceneMesh from this GPU memory batch.
   *
   * @param meshIndex
   */
  removeMesh(meshIndex: number): void {
    const meshHandle = this._meshHandles[meshIndex];
    if (!meshHandle) {
      return;
    }

    const sceneMesh = meshHandle.sceneMesh;
    const sceneGeometry = sceneMesh.geometry;
    const geometryHandle = this._geometryHandles[sceneGeometry.uniqueId];

    if (geometryHandle && --geometryHandle.useCount <= 0) {
      this._geometryStorage.freeGeometryAllocation(geometryHandle.geometryAllocation);
      if (geometryHandle.vertexNormalsPortion && this._vertexNormalTexture) {
        this._vertexNormalTexture.putPortion(geometryHandle.vertexNormalsPortion);
      }
      if (geometryHandle.vertexUVsPortion && this._vertexUVTexture) {
        this._vertexUVTexture.putPortion(geometryHandle.vertexUVsPortion);
      }
      this._patternResources.freePolylineCumDistHandle(geometryHandle.polylineCumDistHandle);
      delete this._geometryHandles[sceneGeometry.uniqueId];
      delete this._sceneGeometries[geometryHandle.geometryIndex];
      this._putFreeGeometryIndex(geometryHandle.geometryIndex);
      this._numGeometries--;
    }

    const numViews = this._renderContext.memoryConfigs.maxViews;
    this._geometryStorage.deleteMeshHandle(meshHandle.geometryMeshHandle, meshIndex, numViews);

    delete this._meshHandles[meshIndex];
    delete this._meshIndicesByUniqueId[sceneMesh.uniqueId];

    this._putFreeMeshIndex(meshIndex);

    this._numMeshes--;
  }

  /**
   * Retrieves a SceneGeometry by its geometryIndex.
   * @param geometryIndex
   */
  getGeometryAtIndex(geometryIndex: number): SceneGeometry | null {
    return this._sceneGeometries[geometryIndex] ?? null;
  }

  /**
   * Retrieves a SceneMesh by its meshIndex.
   * @param meshIndex
   */
  getMeshAtIndex(meshIndex: number): SceneMesh | null {
    return this._meshHandles[meshIndex]?.sceneMesh ?? null;
  }

  /**
   * Retrieves parameters for a drawArrays() call to render a specific mesh.
   * @param meshIndex
   */
  getDrawArraysParamsForMesh(meshIndex: number): { first: number, count: number } | null {
    const meshHandle = this._meshHandles[meshIndex];
    if (!meshHandle) {
      return null;
    }
    const sceneGeometry = meshHandle.sceneMesh.geometry;
    if (!sceneGeometry) {
      return null;
    }

    return this._geometryStorage.getDrawArraysParamsForMesh(meshHandle.geometryMeshHandle, sceneGeometry, 0);
  }

  private _getFreeMeshIndex(): number {
    const maxMeshes = this._renderContext.memoryConfigs.maxBatchMeshes;
    for (let i = this._lastFreeMeshIndex; ; i = (i + 1) % maxMeshes) {
      if (this._meshIndicesUsed[i] === 0) {
        this._meshIndicesUsed[i] = 1;
        // Advance the scan hint past the slot just taken so the next allocation
        // doesn't re-scan the run of used slots — without this the scan is O(N)
        // per call, O(N^2) over a model load. Frees reset the hint to the freed
        // slot (see _putFreeMeshIndex), so slot reuse still works.
        this._lastFreeMeshIndex = (i + 1) % maxMeshes;
        return i;
      }
    }
  }

  private _putFreeMeshIndex(index: number): void {
    if (this._meshIndicesUsed[index] !== 0) {
      this._meshIndicesUsed[index] = 0;
      this._lastFreeMeshIndex = index;
    }
  }

  private _getFreeGeometryIndex(): number {
    const maxGeometries = this._renderContext.memoryConfigs.maxBatchGeometries;
    for (let i = this._lastFreeGeometryIndex; ; i = (i + 1) % maxGeometries) {
      if (this._geometryIndicesUsed[i] === 0) {
        this._geometryIndicesUsed[i] = 1;
        // See _getFreeMeshIndex — advance the hint to keep allocation O(1).
        this._lastFreeGeometryIndex = (i + 1) % maxGeometries;
        return i;
      }
    }
  }

  private _putFreeGeometryIndex(index: number): void {
    if (this._geometryIndicesUsed[index] !== 0) {
      this._geometryIndicesUsed[index] = 0;
      this._lastFreeGeometryIndex = index;
    }
  }

  /**
   * Flush any pending updates to the GPU.
   */
  uploadChanges(): boolean {
    let didFlush = false;
    didFlush = this._meshAttributeTexture.uploadChanges() || didFlush;
    didFlush = this._patternResources.uploadChanges() || didFlush;
    for (let i = 0, len = this._meshViewAttributeTexture.length; i < len; i++) {
      didFlush = this._meshViewAttributeTexture[i].uploadChanges() || didFlush;
    }
    didFlush = this._geometryAttributeTexture.uploadChanges() || didFlush;
    if (this._vertexNormalTexture) {
      didFlush = this._vertexNormalTexture.uploadChanges() || didFlush;
    }
    if (this._vertexUVTexture) {
      didFlush = this._vertexUVTexture.uploadChanges() || didFlush;
    }
    didFlush = this._meshMatrixTexture.uploadChanges() || didFlush;
    didFlush = this._geometryStorage.uploadChanges(this.batchResources) || didFlush;
    return didFlush;
  }

  webglContextRestored(): SDKResult<void> {
    const gl = this._renderContext.gl;
    const geometryResult = this._geometryStorage.webglContextRestored(gl);
    if (geometryResult.ok === false) {
      return geometryResult;
    }
    const resources: RestorableGPUResource[] = [
      this._meshAttributeTexture,
      ...this._meshViewAttributeTexture,
      this._meshMatrixTexture,
      this._geometryAttributeTexture,
      ...(this._vertexNormalTexture ? [this._vertexNormalTexture] : []),
      ...(this._vertexUVTexture ? [this._vertexUVTexture] : [])
    ];

    const resourceResult = restoreGPUResources(resources, gl);
    if (resourceResult.ok === false) {
      return resourceResult;
    }
    const patternResult = this._patternResources.webglContextRestored(gl);
    if (patternResult.ok === false) {
      return patternResult;
    }
    return this._materialResources.webglContextRestored(gl);
  }

  destroy() {
    const clear = (ref: any) => {
      if (ref) {
        ref.destroy();
        return null;
      }
      return ref;
    };
    this._onTick = clear(this._onTick);
    this._geometryStorage.destroy();
    this._meshAttributeTexture = clear(this._meshAttributeTexture);
    this._patternResources.destroy();
    this._meshViewAttributeTexture = this._meshViewAttributeTexture.map(clear);
    this._geometryAttributeTexture = clear(this._geometryAttributeTexture);
    this._vertexNormalTexture = clear(this._vertexNormalTexture);
    this._vertexUVTexture = clear(this._vertexUVTexture);
    this._materialResources.destroy();
    this._meshMatrixTexture = clear(this._meshMatrixTexture);
    this._meshHandles = {};
    this._meshIndicesByUniqueId = {};
    this._geometryHandles = {};
    this._sceneGeometries = {};
  }

  /**
   * Re-encode the pattern slots held for the supplied material.
   * Called from {@link GPUMemoryManager.sceneMaterialPatternChanged}
   * when a {@link model!scene.SceneMaterial | SceneMaterial}'s
   * `linePattern` or `hatchPattern` is updated post-create.
   *
   * Looks up the material's slot in this batch's line and
   * hatch tables (if any), overwrites the slot data, and marks
   * the texture dirty for upload on the next frame. Returns
   * `true` when at least one slot was updated, so the caller
   * can short-circuit nudging a re-render on batches that
   * don't reference this material.
   *
   * The per-mesh attribute table is left untouched — the slot
   * index in there is keyed on `material.uniqueId`, which
   * doesn't change.
   */
  public updateMaterialPattern(material: SceneMaterial): boolean {
    return this._patternResources.updateMaterialPattern(material);
  }

}

function getSceneGeometryPrimitiveCount(sceneGeometry: SceneGeometry): number {
  if (sceneGeometry.primitive === PointsPrimitive) {
    return (sceneGeometry.positionsCompressed.length / 3) | 0;
  }
  if (sceneGeometry.primitive === LinesPrimitive) {
    return ((sceneGeometry.indices?.length ?? 0) / 2) | 0;
  }
  return ((sceneGeometry.indices?.length ?? 0) / 3) | 0;
}
