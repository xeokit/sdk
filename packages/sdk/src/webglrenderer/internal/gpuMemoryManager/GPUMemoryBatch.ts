import {SceneGeometry, SceneMesh} from "../../../scene";
import {RenderContext} from "../RenderContext";
import {MeshViewAttributeTexture} from "./dataTextures/MeshViewAttributeTexture";
import {MeshAttributeTexture} from "./dataTextures/MeshAttributeTexture";
import {GeometryQuantRangeTexture} from "./dataTextures/GeometryQuantRangeTexture";
import {VertexPositionTexture} from "./dataTextures/VertexPositionTexture";
import {VertexColorTexture} from "./dataTextures/VertexColorTexture";
import {VertexNormalTexture} from "./dataTextures/VertexNormalTexture";
import {VertexUVTexture} from "./dataTextures/VertexUVTexture";
import {TextureAtlas, type AtlasTransform} from "./dataTextures/TextureAtlas";
import {MatrixTexture} from "./dataTextures/MatrixTexture";
import {IndexTexture} from "./dataTextures/IndexTexture";
import {GeometryAttributeTexture} from "./dataTextures/GeometryAttributeTexture";
import {type BatchDataTextures} from "./BatchDataTextures";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../../constants";
import {PrimitiveMeshIndexTexture} from "./dataTextures/PrimitiveMeshIndexTexture";
import {RENDER_PASSES, type RenderPassValue} from "../RENDER_PASSES";
import {SDKErrorType, SDKInternalException, type SDKResult} from "../../../core";
import {type MemoryConfigs} from "../../MemoryConfigs";
import type {Mat4} from "../../../math/matrix";
import type {Vec3} from "../../../math/vector";
import {GPUMemoryCheckResult} from "./GPUMemoryCheckResult";

/**
 * Folds the "atlas exists?" / "mesh has texture?" / "upload succeeded?" /
 * "fall back to sentinel" sequence used by every PBR-map slot in addMesh.
 *
 * Returns the canonical zero transform when the batch has no atlas (so
 * the per-mesh attribute buffer ends up with deterministic zeros) or
 * the atlas's sentinel transform when no texture is attached or upload
 * failed.
 */
const ZERO_ATLAS_TRANSFORM: AtlasTransform = { uOffset: 0, vOffset: 0, uScale: 0, vScale: 0 };

/**
 * Probe used by {@link GPUMemoryBatch.hasMemoryForMesh} to decide
 * whether a mesh's texture would fit in the batch's atlas of the same
 * type. Returns true when the texture would fit in a fresh same-size
 * atlas but not this one — the caller should spawn a new batch.
 *
 * "Too big for any atlas" is treated as not-overflow here, because
 * spawning a new batch wouldn't help. Those go to the sentinel at
 * upload time and the user sees a console warning.
 */
function atlasOverflow(
  atlas: TextureAtlas | null,
  sceneTexture: { id: string; image?: any; imageData?: any; width?: number; height?: number } | undefined
): boolean {
  if (!atlas || !sceneTexture) return false;
  const source = sceneTexture.image ?? sceneTexture.imageData ?? null;
  const w = (source && source.width)  ?? sceneTexture.width  ?? 0;
  const h = (source && source.height) ?? sceneTexture.height ?? 0;
  if (w <= 0 || h <= 0) return false;
  return atlas.canFitTexture(sceneTexture.id, w, h) === "would-fit-in-fresh-atlas";
}

function resolveAtlasTransform(
  atlas: TextureAtlas | null,
  sceneTexture: { id: string; image?: any; imageData?: any } | undefined,
  label: string
): AtlasTransform {
  if (!atlas) {
    return ZERO_ATLAS_TRANSFORM;
  }
  if (sceneTexture) {
    // Prefer `image` (decoded HTMLImageElement) and fall back to
    // `imageData` (ImageBitmap | Canvas | OffscreenCanvas) — both forms
    // are what `texSubImage2D` natively accepts in WebGL2.
    const source = sceneTexture.image ?? sceneTexture.imageData ?? null;
    if (source) {
      const t = atlas.addTexture(sceneTexture.id, source);
      if (t) return t;
      console.warn(`GPUMemoryBatch.addMesh: ${label} atlas full or upload failed for SceneTexture '${sceneTexture.id}' — falling back to sentinel`);
    }
  }
  return atlas.sentinelTransform;
}

type GeometryHandle = {
  sceneGeometry: SceneGeometry;
  positionsPortion: any;
  vertexColorsPortion: any;
  vertexNormalsPortion: any;
  vertexUVsPortion: any;
  geometryIndex: number;
  indicesHandle: any;
  edgeIndicesHandle: any;
  useCount: number;
};

type MeshHandle = {
  sceneMesh: SceneMesh;
  meshIndex: number;
  primitiveMeshIndexTextureHandles: any[];
  edgeMeshIndexTextureHandles?: any[];
};

/**
 * Manages GPU-resident, dynamically-editable data storage for model geometry and attributes.
 *
 * @internal
 */
export class GPUMemoryBatch {

  /**
   * The data textures that implement GPU-side model storage for this GPUMemoryBatch.
   */
  public dataTextures: BatchDataTextures;

  /**
   * Index of this GPUMemoryBatch within the GPUMemoryManager.sortedBatches array.
   */
  public index: number;

  private _indexTexture: IndexTexture;
  private _meshAttributeTexture: MeshAttributeTexture;
  private _meshViewAttributeTexture: MeshViewAttributeTexture[];
  private _geometryQuantRangeTexture: GeometryQuantRangeTexture;
  private _geometryAttributeTexture: GeometryAttributeTexture;
  private _edgeIndexTexture: IndexTexture;
  private _primitiveMeshIndexTexture: PrimitiveMeshIndexTexture[];
  private _edgeMeshIndexTexture: PrimitiveMeshIndexTexture[];
  private _vertexPositionTexture: VertexPositionTexture;
  private _vertexColorTexture: VertexColorTexture;
  private _vertexNormalTexture: VertexNormalTexture | null;
  private _vertexUVTexture: VertexUVTexture | null;
  private _albedoAtlasTexture: TextureAtlas | null;
  private _metallicRoughnessAtlasTexture: TextureAtlas | null;
  private _normalMapAtlasTexture: TextureAtlas | null;
  private _meshMatrixTexture: MatrixTexture;
  private _meshIndicesUsed: boolean[];
  private _meshes: {};
  private _numMeshes: number;
  private _geometryIndicesUsed: boolean[];
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
   * Creates a new GPUMemoryBatch.
   */
  constructor(index: number, renderContext: RenderContext, options: { hasNormals?: boolean, hasUVs?: boolean } = {}) {

    this.index = index;

    this._renderContext = renderContext;
    this.hasNormals = options.hasNormals === true;
    this.hasUVs = options.hasUVs === true;

    this._geometryHandles = {};
    this._meshHandles = {};
    this._meshIndicesByUniqueId = {};

    this._meshIndicesUsed = [];
    this._lastFreeMeshIndex = 0;
    this._meshes = {};
    this._geometryIndicesUsed = [];
    this._lastFreeGeometryIndex = 0;
    this._sceneGeometries = {};
    this._vertexNormalTexture = null;
    this._vertexUVTexture = null;
    this._albedoAtlasTexture = null;
    this._metallicRoughnessAtlasTexture = null;
    this._normalMapAtlasTexture = null;

    this._numGeometries = 0;
    this._numMeshes = 0;
  }

  /**
   * Allocates all data textures for this GPUMemoryBatch.
   */
  allocate(): SDKResult<void> {

    const gl = this._renderContext.gl;

    const memoryConfigs: MemoryConfigs = this._renderContext.memoryConfigs;

    const bins = [
      RENDER_PASSES.OPAQUE,
      RENDER_PASSES.TRANSPARENT,
      RENDER_PASSES.HIGHLIGHTED,
      RENDER_PASSES.SELECTED,
      RENDER_PASSES.XRAYED
    ];

    const numViews = memoryConfigs.maxViews;

    this._primitiveMeshIndexTexture = [];
    this._edgeMeshIndexTexture = [];
    this._meshViewAttributeTexture = [];

    for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
      this._primitiveMeshIndexTexture.push(
        new PrimitiveMeshIndexTexture({
          gl,
          maxItems: memoryConfigs.maxBatchPrims,
          bins,
          description: `[Batch ${this.index}, View ${viewIndex}] - primIndex -> meshIndex`
        }));

      this._edgeMeshIndexTexture.push(
        new PrimitiveMeshIndexTexture({
          gl,
          maxItems: memoryConfigs.maxBatchPrims,
          bins,
          description: `[Batch ${this.index}, View ${viewIndex}] - edgeIndex -> meshIndex`
        }));

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

    this._geometryQuantRangeTexture = new GeometryQuantRangeTexture({
      gl,
      maxItems: memoryConfigs.maxBatchGeometries,
      getNumItems: () => this._numGeometries,
      description: `[Batch ${this.index}] - geometryIndex -> quantization ranges (offset, scale)`
    });

    this._indexTexture = new IndexTexture({
      gl,
      maxItems: memoryConfigs.maxBatchIndices,
      description: `[Batch ${this.index}] - primitive indices`
    });

    this._edgeIndexTexture = new IndexTexture({
      gl,
      maxItems: memoryConfigs.maxBatchIndices,
      description: `[Batch ${this.index}] - edge indices`
    });

    this._vertexPositionTexture = new VertexPositionTexture({
      gl,
      maxItems: memoryConfigs.maxBatchVertices,
      description: `[Batch ${this.index}] - vertex XYZ positions`
    });

    this._vertexColorTexture = new VertexColorTexture({
      gl,
      maxItems: memoryConfigs.maxBatchVertices,
      description: `[Batch ${this.index}] - vertex RGB colors`
    });

    if (this.hasNormals) {
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
      // The albedo atlas is bound by the UV-bearing technique variants
      // unconditionally — always-allocate keeps the shader path
      // branch-free. Untextured meshes write the atlas's sentinel
      // transform (scale = 0) and sample its pre-stamped white block.
      this._albedoAtlasTexture = new TextureAtlas({
        gl,
        description: `[Batch ${this.index}] - albedo atlas (sRGB 2D, shelf-packed)`
        // internalFormat defaults to SRGB8_ALPHA8.
      });
      // Metallic-roughness atlas — same shape, but linear RGBA8 since the
      // values are reflectance parameters, not colour. Sentinel = white,
      // which is exactly the multiplicative identity for the BRDF (`mr.g
      // * material.roughness` and `mr.b * material.metallic` both pass
      // the material values through unchanged when the texture is the
      // sentinel).
      this._metallicRoughnessAtlasTexture = new TextureAtlas({
        gl,
        description: `[Batch ${this.index}] - metallic-roughness atlas (linear 2D, shelf-packed)`,
        internalFormat: gl.RGBA8
      });
      // Tangent-space normal-map atlas. Sentinel `(128, 128, 255, 255)`
      // decodes to (0, 0, 1) — i.e. surface normal — so untextured
      // meshes get an identity perturbation and look exactly as they
      // did before normal-mapping landed.
      this._normalMapAtlasTexture = new TextureAtlas({
        gl,
        description: `[Batch ${this.index}] - normal-map atlas (linear 2D, shelf-packed)`,
        internalFormat: gl.RGBA8,
        sentinelColor: [128, 128, 255, 255]
      });
    }

    const textures: {
      allocate(): SDKResult<void>;
      destroy(): void;
    }[] = [
      ...this._primitiveMeshIndexTexture,
      ...this._edgeMeshIndexTexture,
      this._meshAttributeTexture,
      ...this._meshViewAttributeTexture,
      this._meshMatrixTexture,
      this._geometryAttributeTexture,
      this._geometryQuantRangeTexture,
      this._indexTexture,
      this._edgeIndexTexture,
      this._vertexPositionTexture,
      this._vertexColorTexture,
      ...(this._vertexNormalTexture ? [this._vertexNormalTexture] : []),
      ...(this._vertexUVTexture ? [this._vertexUVTexture] : []),
      ...(this._albedoAtlasTexture ? [this._albedoAtlasTexture] : []),
      ...(this._metallicRoughnessAtlasTexture ? [this._metallicRoughnessAtlasTexture] : []),
      ...(this._normalMapAtlasTexture ? [this._normalMapAtlasTexture] : [])
    ];

    for (let i = 0, leni = textures.length; i < leni; i++) {
      const result = textures[i].allocate();
      if (result.ok === false) {
        for (let j = i - 1; j >= 0; j--) {
          textures[j].destroy();
        }
        return result;
      }
    }

    const views = [];
    for (let i = 0; i < numViews; i++) {
      views.push({
        numDrawablePrims: 0,
        primitiveMeshIndexTexture: this._primitiveMeshIndexTexture[i],
        edgeMeshIndexTexture: this._edgeMeshIndexTexture[i],
        meshViewAttributeTexture: this._meshViewAttributeTexture[i],
        renderPassPrimitiveRanges: this._primitiveMeshIndexTexture[i].passRanges,
        renderPassEdgePrimitiveRanges: this._edgeMeshIndexTexture[i].passRanges,
        pickPrimitiveRange: this._primitiveMeshIndexTexture[i].primRange
      });
    }

    this.dataTextures = {
      views,
      indexTexture: this._indexTexture,
      edgeIndexTexture: this._edgeIndexTexture,
      meshMatrixTexture: this._meshMatrixTexture,
      meshAttributeTexture: this._meshAttributeTexture,
      geometryAttributeTexture: this._geometryAttributeTexture,
      geometryQuantRangeTexture: this._geometryQuantRangeTexture,
      vertexPositionTexture: this._vertexPositionTexture,
      vertexColorTexture: this._vertexColorTexture,
      vertexNormalTexture: this._vertexNormalTexture ?? undefined,
      vertexUVTexture: this._vertexUVTexture ?? undefined,
      albedoAtlasTexture: this._albedoAtlasTexture ?? undefined,
      metallicRoughnessAtlasTexture: this._metallicRoughnessAtlasTexture ?? undefined,
      normalMapAtlasTexture: this._normalMapAtlasTexture ?? undefined
    };

    // this.structSpecs = {
    //   MeshAttribs: this._meshAttributeTexture.structSpec
    // }

    return {
      ok: true,
      value: undefined
    };
  }

  static get itemSizesInBytes(): { [key: string]: number } {
    return {
      mesh: MeshAttributeTexture.itemSizeInBytes
        + MeshViewAttributeTexture.itemSizeInBytes * 4 // 4 views FIXME
        + MatrixTexture.itemSizeInBytes,
      geometry: GeometryAttributeTexture.itemSizeInBytes + GeometryQuantRangeTexture.itemSizeInBytes,
      vertex: VertexPositionTexture.itemSizeInBytes + VertexColorTexture.itemSizeInBytes,
      index: IndexTexture.itemSizeInBytes,
      prim: PrimitiveMeshIndexTexture.itemSizeInBytes,
      edge: PrimitiveMeshIndexTexture.itemSizeInBytes
    }
  }

  getAllocatedBytes(): number {
    let total = 0;
    total += this._vertexPositionTexture.getAllocatedBytes();
    total += this._vertexColorTexture.getAllocatedBytes();
    if (this._vertexNormalTexture) total += this._vertexNormalTexture.getAllocatedBytes();
    if (this._vertexUVTexture)     total += this._vertexUVTexture.getAllocatedBytes();
    if (this._albedoAtlasTexture)  total += this._albedoAtlasTexture.getAllocatedBytes();
    if (this._metallicRoughnessAtlasTexture) total += this._metallicRoughnessAtlasTexture.getAllocatedBytes();
    if (this._normalMapAtlasTexture) total += this._normalMapAtlasTexture.getAllocatedBytes();
    total += this._indexTexture.getAllocatedBytes();
    total += this._edgeIndexTexture.getAllocatedBytes();
    total += this._meshAttributeTexture.getAllocatedBytes();
    total += this._geometryAttributeTexture.getAllocatedBytes();
    total += this._geometryQuantRangeTexture.getAllocatedBytes();
    total += this._meshMatrixTexture.getAllocatedBytes();
    for (let i = 0; i < this._primitiveMeshIndexTexture.length; i++) {
      total += this._primitiveMeshIndexTexture[i].getAllocatedBytes();
    }
    for (let i = 0; i < this._edgeMeshIndexTexture.length; i++) {
      total += this._edgeMeshIndexTexture[i].getAllocatedBytes();
    }
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
    let total = 0;
    total += this._vertexPositionTexture.getUsedBytes();
    total += this._vertexColorTexture.getUsedBytes();
    if (this._vertexNormalTexture) total += this._vertexNormalTexture.getUsedBytes();
    if (this._vertexUVTexture)     total += this._vertexUVTexture.getUsedBytes();
    if (this._albedoAtlasTexture)  total += this._albedoAtlasTexture.getUsedBytes();
    if (this._metallicRoughnessAtlasTexture) total += this._metallicRoughnessAtlasTexture.getUsedBytes();
    if (this._normalMapAtlasTexture) total += this._normalMapAtlasTexture.getUsedBytes();
    total += this._indexTexture.getUsedBytes();
    total += this._edgeIndexTexture.getUsedBytes();
    total += this._meshAttributeTexture.getUsedBytes();
    total += this._geometryAttributeTexture.getUsedBytes();
    total += this._geometryQuantRangeTexture.getUsedBytes();
    total += this._meshMatrixTexture.getUsedBytes();
    for (let i = 0; i < this._primitiveMeshIndexTexture.length; i++) {
      total += this._primitiveMeshIndexTexture[i].getUsedBytes();
    }
    for (let i = 0; i < this._edgeMeshIndexTexture.length; i++) {
      total += this._edgeMeshIndexTexture[i].getUsedBytes();
    }
    const numViews = this._meshViewAttributeTexture.length;
    for (let i = 0; i < numViews; i++) {
      total += this._meshViewAttributeTexture[i].getUsedBytes();
    }
    return total;
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
      if (vertCount <= 0 || this._vertexPositionTexture.canGetPortion(vertCount) === false) {
        return GPUMemoryCheckResult.NotEnoughVertexSpace;
      }
      if (geometry.indices && this._indexTexture.canGetPortion(geometry.indices.length) === false) {
        return GPUMemoryCheckResult.NotEnoughIndexSpace;
      }
      if (geometry.edgeIndices && this._edgeIndexTexture.canGetPortion(geometry.edgeIndices.length) === false) {
        return GPUMemoryCheckResult.NotEnoughEdgeIndexSpace;
      }
    }
    const isPoints = geometry.primitive === PointsPrimitive;
    if (!geometryExists) {
      if (geometry.colorsCompressed && this._vertexColorTexture.canGetPortion(geometry.colorsCompressed.length) === false) {
        return GPUMemoryCheckResult.NotEnoughColorSpace;
      }
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
    const primCount = isPoints
      ? vertCount
      : geometry.primitive === LinesPrimitive
        ? geometry.indices.length / 2
        : geometry.indices.length / 3;
    if (geometry.primitive === TrianglesPrimitive && geometry.edgeIndices) {
      const edgePrimCount = geometry.edgeIndices.length / 2;
      if (edgePrimCount > 0 && this._edgeMeshIndexTexture[0].canGetPortion(edgePrimCount) === false) { // FIXME: Only defined for View 0
        return GPUMemoryCheckResult.NotEnoughEdgeIndexSpace;
      }
    }
    if (this._primitiveMeshIndexTexture[0].canGetPortion(primCount) === false) { // FIXME: Only defined for View 0
      return GPUMemoryCheckResult.NotEnoughPrimSpace;
    }
    // Atlas-fit probe — if any of the mesh's PBR-map textures wouldn't
    // fit in the corresponding batch atlas but WOULD fit in a fresh
    // atlas, route the mesh to a new batch. Textures that are simply
    // too big for any atlas of this size fall through here and end up
    // on the sentinel at upload time.
    if (atlasOverflow(this._albedoAtlasTexture, sceneMesh.effectiveColorTexture)
      || atlasOverflow(this._metallicRoughnessAtlasTexture, sceneMesh.effectiveMetallicRoughnessTexture)
      || atlasOverflow(this._normalMapAtlasTexture, sceneMesh.effectiveNormalsTexture)) {
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
  addMesh(sceneMesh: SceneMesh): SDKResult<number> {

    const existingMeshIndex = this._meshIndicesByUniqueId[sceneMesh.uniqueId];
    if (existingMeshIndex !== undefined) {
      return {ok: true, value: existingMeshIndex};
    }

    const maxBatchMeshes = this._renderContext.memoryConfigs.maxBatchMeshes;

    if ((this._numMeshes + 1) >= maxBatchMeshes) {
      return {
        ok: false,
        type: SDKErrorType.MemoryAllocationFailed,
        error: `GPUMemoryBatch.addMesh: Exceeded maximum number of meshes (${maxBatchMeshes})`
      }
    }

    const sceneGeometry = sceneMesh.geometry;
    let geometryHandle = this._geometryHandles[sceneGeometry.uniqueId];

    if (!geometryHandle) {
      const maxGeometries = this._renderContext.memoryConfigs.maxBatchGeometries;
      if ((this._numGeometries + 1) >= maxGeometries) {
        return {
          ok: false,
          type: SDKErrorType.MemoryAllocationFailed,
          error: `GPUMemoryBatch.addMesh: Exceeded maximum number of geometries (${maxGeometries})`
        }
      }
    }

    let positionsPortion = null;
    let vertexColorsPortion = null;
    let vertexNormalsPortion = null;
    let vertexUVsPortion = null;
    let indicesHandle = null;
    let edgeIndicesHandle = null;
    let geometryIndex = -1;
    let meshIndex = -1;

    const cleanup = () => {
      if (positionsPortion) {
        this._vertexPositionTexture.putPortion(positionsPortion);
      }
      if (vertexColorsPortion) {
        this._vertexColorTexture.putPortion(vertexColorsPortion);
      }
      if (vertexNormalsPortion && this._vertexNormalTexture) {
        this._vertexNormalTexture.putPortion(vertexNormalsPortion);
      }
      if (vertexUVsPortion && this._vertexUVTexture) {
        this._vertexUVTexture.putPortion(vertexUVsPortion);
      }
      if (indicesHandle) {
        this._indexTexture.putPortion(indicesHandle);
      }
      if (edgeIndicesHandle) {
        this._edgeIndexTexture.putPortion(edgeIndicesHandle);
      }
      if (geometryIndex !== -1) {
        this._putFreeGeometryIndex(geometryIndex);
      }
      if (meshIndex !== -1) {
        this._putFreeMeshIndex(meshIndex);
      }
    };

    meshIndex = this._getFreeMeshIndex();

    if (this._meshHandles[meshIndex]) {
      cleanup();
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `GPUMemoryBatch.addMesh: Mesh handle already exists at meshIndex ${meshIndex}`
      };
    }

    if (!geometryHandle) {

      geometryIndex = this._getFreeGeometryIndex();

      positionsPortion = this._vertexPositionTexture.getPortion(
        sceneGeometry.positionsCompressed,
        (newBase: number) => {
          this._geometryAttributeTexture.setItem(geometryIndex, {
            verticesBase: newBase
          });
        });

      if (positionsPortion === null) {
        cleanup();
        return {
          ok: false,
          type: SDKErrorType.MemoryAllocationFailed,
          error: `GPUMemoryBatch.addMesh: Unable to allocate positions portion (of length ${sceneGeometry.positionsCompressed.length}) for geometry ${sceneGeometry.id} - limit is ${this._renderContext.memoryConfigs.maxBatchVertices * 3} position components`
        }
      }

      const [xmin, ymin, zmin, xmax, ymax, zmax] = sceneGeometry.aabb;

      this._geometryQuantRangeTexture.setItem(geometryIndex, {
        offset: [xmin, ymin, zmin],
        scale: [(xmax - xmin) / 65536, (ymax - ymin) / 65536, (zmax - zmin) / 65536]
      });

      if (sceneGeometry.colorsCompressed) {
        vertexColorsPortion = this._vertexColorTexture.getPortion(sceneGeometry.colorsCompressed); // RGBA (0..255, 0..255, 0..255, 0..255)
        if (vertexColorsPortion === null) {
          cleanup();
          return {
            ok: false,
            type: SDKErrorType.MemoryAllocationFailed,
            error: `GPUMemoryBatch.addMesh: Unable to allocate vertex colors portion (of length ${sceneGeometry.colorsCompressed.length}) geometry ${sceneGeometry.id} - limit is ${this._renderContext.memoryConfigs.maxBatchVertices * 4} color components`
          }
        }
      }

      // Normals are only stored on batches that opted in; the geometry-side
      // `normalsCompressed` is octahedral RG16UI pairs (2 elements per vertex),
      // matching VertexNormalTexture.elementsPerItem so we can pass the array
      // straight to getPortion.
      if (this._vertexNormalTexture && sceneGeometry.normalsCompressed) {
        const normalsBaseGeometryIndex = geometryIndex;
        vertexNormalsPortion = this._vertexNormalTexture.getPortion(
          sceneGeometry.normalsCompressed,
          (newBase: number) => {
            this._geometryAttributeTexture.setItem(normalsBaseGeometryIndex, {
              normalsBase: newBase
            });
          }
        );
        if (vertexNormalsPortion === null) {
          cleanup();
          return {
            ok: false,
            type: SDKErrorType.MemoryAllocationFailed,
            error: `GPUMemoryBatch.addMesh: Unable to allocate vertex normals portion (of length ${sceneGeometry.normalsCompressed.length}) for geometry ${sceneGeometry.id} - limit is ${this._renderContext.memoryConfigs.maxBatchVertices * 2} normal components`
          }
        }
      }

      // UVs follow the same shape — 2 u16s per vertex, one item per vertex.
      // Stored only on batches with the hasUVs flag set.
      if (this._vertexUVTexture && sceneGeometry.uvsCompressed) {
        const uvsBaseGeometryIndex = geometryIndex;
        vertexUVsPortion = this._vertexUVTexture.getPortion(
          sceneGeometry.uvsCompressed,
          (newBase: number) => {
            this._geometryAttributeTexture.setItem(uvsBaseGeometryIndex, {
              uvsBase: newBase
            });
          }
        );
        if (vertexUVsPortion === null) {
          cleanup();
          return {
            ok: false,
            type: SDKErrorType.MemoryAllocationFailed,
            error: `GPUMemoryBatch.addMesh: Unable to allocate vertex UVs portion (of length ${sceneGeometry.uvsCompressed.length}) for geometry ${sceneGeometry.id} - limit is ${this._renderContext.memoryConfigs.maxBatchVertices * 2} UV components`
          }
        }
      }

      if (sceneGeometry.primitive !== PointsPrimitive && sceneGeometry.indices) {
        indicesHandle = this._indexTexture.getPortion(
          sceneGeometry.indices,
          (newBase: number) => {
            this._geometryAttributeTexture.setItem(geometryIndex, {
              indicesBase: newBase
            });
          }
        );

        if (indicesHandle === null) {
          cleanup();
          return {
            ok: false,
            type: SDKErrorType.MemoryAllocationFailed,
            error: `GPUMemoryBatch.addMesh: Unable to allocate indices portion (of length ${sceneGeometry.indices.length}) for geometry ${sceneGeometry.id} - limit is ${this._renderContext.memoryConfigs.maxBatchIndices} indices`
          }
        }

        if (sceneGeometry.primitive === TrianglesPrimitive
          && sceneGeometry.edgeIndices
          && sceneGeometry.edgeIndices.length > 0) {
          edgeIndicesHandle = this._edgeIndexTexture.getPortion(
            sceneGeometry.edgeIndices,
            (newBase: number) => {
              this._geometryAttributeTexture.setItem(geometryIndex, {
                edgeIndicesBase: newBase
              });
            }
          );

          if (edgeIndicesHandle === null) {
            cleanup();
            return {
              ok: false,
              type: SDKErrorType.MemoryAllocationFailed,
              error: `GPUMemoryBatch.addMesh: Unable to allocate edge indices portion (of length ${sceneGeometry.edgeIndices.length}) for geometry ${sceneGeometry.id} - limit is ${this._renderContext.memoryConfigs.maxBatchIndices} indices`
            }
          }
        }
      }

      this._geometryAttributeTexture.setItem(geometryIndex, {
        verticesBase: positionsPortion.base, // XYZ
        indicesBase: indicesHandle ? indicesHandle.base : 0,
        edgeIndicesBase: edgeIndicesHandle ? edgeIndicesHandle.base : 0,
        normalsBase: vertexNormalsPortion ? vertexNormalsPortion.base : 0,
        uvsBase: vertexUVsPortion ? vertexUVsPortion.base : 0
      });

      geometryHandle = {
        sceneGeometry,
        positionsPortion,
        vertexColorsPortion,
        vertexNormalsPortion,
        vertexUVsPortion,
        geometryIndex,
        indicesHandle,
        edgeIndicesHandle,
        useCount: 0
      };

      this._geometryHandles[sceneGeometry.uniqueId] = geometryHandle;

      this._numGeometries++;
    }

    geometryHandle.useCount++;

    // Resolve each PBR-map texture into a sub-rect of its atlas when the
    // batch carries one. Untextured slots get the sentinel transform —
    // every fragment samples a white texel, so the BRDF's multiplier
    // collapses to passthrough and the shader stays branch-free.
    const albedoXform = resolveAtlasTransform(
      this._albedoAtlasTexture,
      sceneMesh.effectiveColorTexture,
      "albedo"
    );
    const mrXform = resolveAtlasTransform(
      this._metallicRoughnessAtlasTexture,
      sceneMesh.effectiveMetallicRoughnessTexture,
      "metallic-roughness"
    );
    const nmXform = resolveAtlasTransform(
      this._normalMapAtlasTexture,
      sceneMesh.effectiveNormalsTexture,
      "normal-map"
    );

    this._meshAttributeTexture.setItem(meshIndex, {
      tileIndex: 0, // Set by setMeshAttribs()
      geometryIndex: geometryHandle.geometryIndex,
      // Cook-Torrance material params written once at attach time. The
      // smooth-shaded technique unpacks them per-fragment; flat-shaded
      // batches' shaders never read this slot. Sourced from the mesh's
      // material (or renderer defaults when no material is attached).
      roughness: sceneMesh.effectiveRoughness,
      metallic:  sceneMesh.effectiveMetallic,
      // Alpha mode + cutoff. The shader uses these to discard fragments
      // for `MASK` materials (cutout foliage / fences / Sponza drapes)
      // and to pass the sampled alpha through to the framebuffer for
      // `BLEND` materials.
      alphaMode:   sceneMesh.effectiveAlphaMode,
      alphaCutoff: sceneMesh.effectiveAlphaCutoff,
      albedoUVOffset: [albedoXform.uOffset, albedoXform.vOffset],
      albedoUVScale:  [albedoXform.uScale,  albedoXform.vScale],
      metallicRoughnessUVOffset: [mrXform.uOffset, mrXform.vOffset],
      metallicRoughnessUVScale:  [mrXform.uScale,  mrXform.vScale],
      normalMapUVOffset: [nmXform.uOffset, nmXform.vOffset],
      normalMapUVScale:  [nmXform.uScale,  nmXform.vScale]
    });

    const numViews = this._renderContext.memoryConfigs.maxViews;

    const color = [
      Math.floor(sceneMesh.effectiveColor[0] * 255.0),
      Math.floor(sceneMesh.effectiveColor[1] * 255.0),
      Math.floor(sceneMesh.effectiveColor[2] * 255.0)
    ] as Vec3;

    const opacity = Math.floor(sceneMesh.effectiveOpacity * 255.0);

    for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
      this._meshViewAttributeTexture[viewIndex].setItem(meshIndex, {
        color,
        opacity,
        pickable: true,
        clippable: true
      });
    }

    this._meshMatrixTexture.setItem(meshIndex, new Float32Array(sceneMesh.matrix));

    const primitiveCount = sceneGeometry.primitive === PointsPrimitive
      ? sceneGeometry.positionsCompressed.length / 3
      : sceneGeometry.primitive === LinesPrimitive
        ? sceneGeometry.indices.length / 2
        : sceneGeometry.indices.length / 3;

    const primitiveMeshIndexTextureHandles = [];

    for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
      primitiveMeshIndexTextureHandles.push(
        this._primitiveMeshIndexTexture[viewIndex].createPortion(primitiveCount, meshIndex, RENDER_PASSES.OPAQUE));
    }

    let edgeMeshIndexTextureHandles: any[] | undefined;

    if (sceneGeometry.primitive === TrianglesPrimitive) {
      const edgeCount = sceneGeometry.edgeIndices ? sceneGeometry.edgeIndices.length / 2 : 0;
      edgeMeshIndexTextureHandles = [];
      for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
        edgeMeshIndexTextureHandles.push(
          this._edgeMeshIndexTexture[viewIndex].createPortion(edgeCount, meshIndex, RENDER_PASSES.OPAQUE));
      }
    }

    this._meshHandles[meshIndex] = {
      sceneMesh,
      meshIndex,
      primitiveMeshIndexTextureHandles,
      edgeMeshIndexTextureHandles
    };

    this._meshIndicesByUniqueId[sceneMesh.uniqueId] = meshIndex;
    this._sceneGeometries[geometryHandle.geometryIndex] = sceneGeometry;

    this._numMeshes++;

    return {
      ok: true,
      value: meshIndex
    };
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
    }) {
    this._meshAttributeTexture.setItem(meshIndex, params);
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
    const primitiveMeshIndexTextureHandle = meshHandle.primitiveMeshIndexTextureHandles[viewIndex];
    if (!primitiveMeshIndexTextureHandle) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshRenderBin: Mesh ${meshIndex} has no primitiveMeshIndexTextureHandle`);
    }
    this._primitiveMeshIndexTexture[viewIndex].setRenderPass(primitiveMeshIndexTextureHandle, renderPass);
    if (meshHandle.edgeMeshIndexTextureHandles) {
      const edgeMeshIndexTextureHandle = meshHandle.edgeMeshIndexTextureHandles[viewIndex];
      if (!edgeMeshIndexTextureHandle) {
        throw new SDKInternalException(`GPUMemoryBatch.setMeshRenderBin: Mesh ${meshIndex} has no edgeMeshIndexTextureHandle`);
      }
      this._edgeMeshIndexTexture[viewIndex].setRenderPass(edgeMeshIndexTextureHandle, renderPass);
    }
  }

  /**
   * TODO
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
    const primitiveMeshIndexTextureHandle = meshHandle.primitiveMeshIndexTextureHandles[viewIndex];
    if (!primitiveMeshIndexTextureHandle) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshVisible: Mesh ${meshIndex} has no primitiveMeshIndexTextureHandle`);
    }
    this._primitiveMeshIndexTexture[viewIndex].setMeshVisible(primitiveMeshIndexTextureHandle, visible);
    if (meshHandle.edgeMeshIndexTextureHandles) {
      const edgeMeshIndexTextureHandle = meshHandle.edgeMeshIndexTextureHandles[viewIndex];
      if (!edgeMeshIndexTextureHandle) {
        throw new SDKInternalException(`GPUMemoryBatch.setMeshVisible: Mesh ${meshIndex} has no edgeMeshIndexTextureHandle`);
      }
      this._edgeMeshIndexTexture[viewIndex].setObjectVisible(edgeMeshIndexTextureHandle, visible);
    }
  }

  // setGeometryPositions(geometryIndex: number, positionsCompressed: FloatArrayParam): SDKResult<void> {
  //   const geometryHandle = this._geometryHandles[geometryIndex];
  //   if (!geometryHandle) {
  //     return {
  //       ok: false,
  //       type: SDKErrorType.ResourceNotFound,
  //       error: `GPUMemoryBatch.setGeometryPositions: No geometryHandle for geometryIndex ${geometryIndex}`
  //     }
  //   }
  //   const newPositionsPortion = this._vertexPositionTexture.getPortion(
  //     positionsCompressed,
  //     (newBase: number) => {
  //       const verticesBase = newBase / 3 // 3xcomponents per position
  //       this._geometryAttributeTexture.setItem(geometryIndex, {
  //         verticesBase
  //       });
  //     });
  //
  //   if (newPositionsPortion === null) {
  //     return {
  //       ok: false,
  //       type: SDKErrorType.MemoryAllocationFailed,
  //       error: `GPUMemoryBatch.setGeometryPositions: Unable to allocate new positions portion for geometryIndex ${geometryIndex}`
  //     }
  //   }
  //
  //   // Free old portion
  //   if (geometryHandle.positionsPortion) {
  //     this._vertexPositionTexture.putPortion(geometryHandle.positionsPortion);
  //   }
  //
  //   // Update handle
  //   geometryHandle.positionsPortion = newPositionsPortion;
  //
  //   return {
  //     ok: true,
  //     value: undefined
  //   };
  // }

  /**
   * Removes a SceneMesh from data texture manager.
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
      if (geometryHandle.positionsPortion) {
        this._vertexPositionTexture.putPortion(geometryHandle.positionsPortion);
      }
      if (geometryHandle.vertexColorsPortion) {
        this._vertexColorTexture.putPortion(geometryHandle.vertexColorsPortion);
      }
      if (geometryHandle.vertexNormalsPortion && this._vertexNormalTexture) {
        this._vertexNormalTexture.putPortion(geometryHandle.vertexNormalsPortion);
      }
      if (geometryHandle.vertexUVsPortion && this._vertexUVTexture) {
        this._vertexUVTexture.putPortion(geometryHandle.vertexUVsPortion);
      }
      if (geometryHandle.indicesHandle) {
        this._indexTexture.putPortion(geometryHandle.indicesHandle);
      }
      if (geometryHandle.edgeIndicesHandle) {
        this._edgeIndexTexture.putPortion(geometryHandle.edgeIndicesHandle);
      }
      delete this._geometryHandles[sceneGeometry.uniqueId];
      delete this._sceneGeometries[geometryHandle.geometryIndex];
      this._putFreeGeometryIndex(geometryHandle.geometryIndex);
      this._numGeometries--;
    }

    const numViews = this._renderContext.memoryConfigs.maxViews;

    if (meshHandle.primitiveMeshIndexTextureHandles) {
      for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
        this._primitiveMeshIndexTexture[viewIndex].deletePortion(meshHandle.primitiveMeshIndexTextureHandles[viewIndex]);
      }
    }
    if (meshHandle.edgeMeshIndexTextureHandles) {
      for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
        this._edgeMeshIndexTexture[viewIndex].deletePortion(meshHandle.edgeMeshIndexTextureHandles[viewIndex]);
      }
    }

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

    const primitiveMeshIndexTextureHandle = meshHandle.primitiveMeshIndexTextureHandles?.[0];
    if (!primitiveMeshIndexTextureHandle) {
      return null;
    }

    const primsBase = primitiveMeshIndexTextureHandle.base ?? primitiveMeshIndexTextureHandle.start ?? 0;

    if (sceneGeometry.primitive === PointsPrimitive) {
      const count = sceneGeometry.positionsCompressed.length / 3; // 3xcomponents per position
      return {
        count,
        first: primsBase
      };
    } else if (sceneGeometry.primitive === LinesPrimitive) {
      const count = (sceneGeometry.indices?.length ?? 0);
      return {
        count,
        first: primsBase
      };
    } else if (sceneGeometry.primitive === TrianglesPrimitive) {
      const count = (sceneGeometry.indices?.length ?? 0);
      return {
        count,
        first: primsBase
      };
    }
    return null;
  }

  _getFreeMeshIndex(): number {
    const maxMeshes = this._renderContext.memoryConfigs.maxBatchMeshes;
    for (let i = this._lastFreeMeshIndex; ; i = (i + 1) % maxMeshes) {
      if (!this._meshIndicesUsed[i]) {
        this._meshIndicesUsed[i] = true;
        return i;
      }
    }
  }

  _putFreeMeshIndex(index: number): void {
    if (this._meshIndicesUsed[index]) {
      delete this._meshIndicesUsed[index];
      this._lastFreeMeshIndex = index;
    }
  }

  _getFreeGeometryIndex(): number {
    const maxGeometries = this._renderContext.memoryConfigs.maxBatchGeometries;
    for (let i = this._lastFreeGeometryIndex; ; i = (i + 1) % maxGeometries) {
      if (!this._geometryIndicesUsed[i]) {
        this._geometryIndicesUsed[i] = true;
        return i;
      }
    }
  }

  _putFreeGeometryIndex(index: number): void {
    if (this._geometryIndicesUsed[index]) {
      delete this._geometryIndicesUsed[index];
      this._lastFreeGeometryIndex = index;
    }
  }

  /**
   * Flush any pending updates to the GPU.
   */
  uploadChanges(): boolean {
    let didFlush = false;
    didFlush = this._indexTexture.uploadChanges() || didFlush;
    didFlush = this._meshAttributeTexture.uploadChanges() || didFlush;
    for (let i = 0, len = this._meshViewAttributeTexture.length; i < len; i++) {
      didFlush = this._meshViewAttributeTexture[i].uploadChanges() || didFlush;
    }
    didFlush = this._geometryQuantRangeTexture.uploadChanges() || didFlush;
    didFlush = this._geometryAttributeTexture.uploadChanges() || didFlush;
    didFlush = this._edgeIndexTexture.uploadChanges() || didFlush;
    didFlush = this._vertexPositionTexture.uploadChanges() || didFlush;
    didFlush = this._vertexColorTexture.uploadChanges() || didFlush;
    if (this._vertexNormalTexture) {
      didFlush = this._vertexNormalTexture.uploadChanges() || didFlush;
    }
    if (this._vertexUVTexture) {
      didFlush = this._vertexUVTexture.uploadChanges() || didFlush;
    }
    didFlush = this._meshMatrixTexture.uploadChanges() || didFlush;
    const numViews = this._renderContext.memoryConfigs.maxViews;
    for (let i = 0; i < numViews; i++) {
      const primitiveMeshIndexTexture = this._primitiveMeshIndexTexture[i];
      if (primitiveMeshIndexTexture) {
        const primitiveMeshIndexTextureFlushed = primitiveMeshIndexTexture.uploadChanges();
        didFlush = primitiveMeshIndexTextureFlushed || didFlush;
        if (primitiveMeshIndexTextureFlushed) {
          this.dataTextures.views[i].numDrawablePrims = primitiveMeshIndexTexture.numPrimitives;
        }
      }
      const edgeMeshIndexTexture = this._edgeMeshIndexTexture[i];
      if (edgeMeshIndexTexture) {
        didFlush = edgeMeshIndexTexture.uploadChanges() || didFlush;
      }
    }
    return didFlush;
  }

  webglContextRestored(): SDKResult<void> {
    const dataTextures = [
      ...this._primitiveMeshIndexTexture,
      ...this._edgeMeshIndexTexture,
      this._meshAttributeTexture,
      ...this._meshViewAttributeTexture,
      this._meshMatrixTexture,
      this._geometryAttributeTexture,
      this._geometryQuantRangeTexture,
      this._indexTexture,
      this._edgeIndexTexture,
      this._vertexPositionTexture,
      this._vertexColorTexture,
      ...(this._vertexNormalTexture ? [this._vertexNormalTexture] : []),
      ...(this._vertexUVTexture ? [this._vertexUVTexture] : []),
      ...(this._albedoAtlasTexture ? [this._albedoAtlasTexture] : []),
      ...(this._metallicRoughnessAtlasTexture ? [this._metallicRoughnessAtlasTexture] : []),
      ...(this._normalMapAtlasTexture ? [this._normalMapAtlasTexture] : [])
    ];

    for (const dataTexture of dataTextures) {
      const result = (dataTexture as any).webglContextRestored();
      if (!result.ok) {
        return result;
      }
    }
    return {ok: true, value: undefined};
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
    for (let i = 0; i < this._primitiveMeshIndexTexture.length; i++) {
      this._primitiveMeshIndexTexture[i].destroy();
    }
    for (let i = 0; i < this._edgeMeshIndexTexture.length; i++) {
      this._edgeMeshIndexTexture[i].destroy();
    }
    this._primitiveMeshIndexTexture = [];
    this._edgeMeshIndexTexture = [];
    this._meshAttributeTexture = clear(this._meshAttributeTexture);
    this._meshViewAttributeTexture = this._meshViewAttributeTexture.map(clear);
    this._geometryAttributeTexture = clear(this._geometryAttributeTexture);
    this._geometryQuantRangeTexture = clear(this._geometryQuantRangeTexture);
    this._indexTexture = clear(this._indexTexture);
    this._edgeIndexTexture = clear(this._edgeIndexTexture);
    this._vertexPositionTexture = clear(this._vertexPositionTexture);
    this._vertexColorTexture = clear(this._vertexColorTexture);
    this._vertexNormalTexture = clear(this._vertexNormalTexture);
    this._vertexUVTexture = clear(this._vertexUVTexture);
    this._albedoAtlasTexture = clear(this._albedoAtlasTexture);
    this._metallicRoughnessAtlasTexture = clear(this._metallicRoughnessAtlasTexture);
    this._normalMapAtlasTexture = clear(this._normalMapAtlasTexture);
    this._meshMatrixTexture = clear(this._meshMatrixTexture);
    this._meshHandles = {};
    this._meshIndicesByUniqueId = {};
    this._geometryHandles = {};
    this._sceneGeometries = {};
  }
}
