import {SceneGeometry, SceneMaterial, SceneMesh} from "../../../../model/scene";
import {RenderContext} from "../RenderContext";
import {MeshViewAttributeTexture} from "./dataTextures/MeshViewAttributeTexture";
import {MeshAttributeTexture} from "./dataTextures/MeshAttributeTexture";
import {LinePatternTexture} from "./dataTextures/LinePatternTexture";
import {HatchPatternTexture} from "./dataTextures/HatchPatternTexture";
import {PolylineCumDistTexture} from "./dataTextures/PolylineCumDistTexture";

/**
 * Maximum number of distinct line-pattern slots a single
 * {@link GPUMemoryBatch} can carry. Each slot consumes 2 RGBA32UI
 * texels (= 32 bytes); 256 slots cap the per-batch overhead at
 * 8 KB and stay well within the 8-bit accidental-overflow-proof
 * range — though the encoded slot index itself is a u16 in the
 * MeshAttributeTexture, so the hard cap is actually 65535.
 *
 * Slots are allocated lazily by {@link GPUMemoryBatch.addMesh}
 * for materials whose {@link SceneMaterial.linePattern} is set
 * to anything other than the default "solid". Real-world
 * engineering drawings rarely exceed a handful of distinct
 * linetypes (visible, hidden, centre, phantom — that's four),
 * so a budget of 256 is generous.
 */
export const MAX_LINE_PATTERN_SLOTS = 256;

/**
 * Maximum number of distinct hatch-pattern slots a single
 * {@link GPUMemoryBatch} can carry. Each slot consumes 5 RGBA32F
 * texels (= 80 bytes); the cap keeps the per-batch overhead
 * under ~20 KB. The encoded slot index is a u16 in
 * {@link MeshAttributeTexture}'s material slot, so the hard
 * ceiling is 65535.
 *
 * Engineering drawings rarely reference more than a handful of
 * distinct hatch fills (concrete, steel, brick, insulation —
 * that's four), so a budget of 256 is generous.
 */
export const MAX_HATCH_PATTERN_SLOTS = 256;

/**
 * Zero-filled scratch buffers used by
 * {@link GPUMemoryBatch.updateMaterialPattern} when a material
 * is edited from a styled pattern back to "no pattern". The
 * shader's slot-length check sees the zeros and short-circuits
 * the walk — no need to free the slot or rewrite the per-mesh
 * attribute index.
 */
const EMPTY_LINE_PATTERN_ENTRIES = new Float32Array(8);
const EMPTY_HATCH_FAMILIES = new Float32Array(4 * 4);
const EMPTY_HATCH_COLOR = new Float32Array(4);
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
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../../../base/constants";
import {PrimitiveMeshIndexTexture} from "./dataTextures/PrimitiveMeshIndexTexture";
import {RENDER_PASSES, type RenderPassValue} from "../RENDER_PASSES";
import {SDKErrorType, SDKInternalException, type SDKResult} from "../../../../base/core";
import {type MemoryConfigs} from "../../MemoryConfigs";
import type {Mat4} from "../../../../base/math/matrix";
import type {Vec3} from "../../../../base/math/vector";
import {quantizeColor3} from "../../../../base/math/compression";
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
const DEFAULT_EMISSIVE_COLOR: [number, number, number] = [0, 0, 0];
const tempQuantizedColor: Vec3 = [0, 0, 0];

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

type PerViewHandle = any | any[];

type MeshHandle = {
  sceneMesh: SceneMesh;
  meshIndex: number;
  primitiveMeshIndexTextureHandles: PerViewHandle;
  edgeMeshIndexTextureHandles?: PerViewHandle;
  // Per-view inputs to draw inclusion. A mesh is drawn in a view only
  // when it is visible AND not culled; both `setMeshVisible` and
  // `setMeshCulled` recompute the effective flag from these.
  visibleMask: number;
  culledMask: number;
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

function getPerViewHandle(handles: PerViewHandle | undefined, viewIndex: number): any | undefined {
  if (!handles) {
    return undefined;
  }
  return Array.isArray(handles)
    ? handles[viewIndex]
    : viewIndex === 0 ? handles : undefined;
}

function forEachPerViewHandle(
  handles: PerViewHandle | undefined,
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
  /**
   * Eager-allocated per-batch line-pattern table. Sized to
   * {@link MAX_LINE_PATTERN_SLOTS}; slots are written lazily
   * by {@link _allocateLinePatternSlot} as materials with
   * non-default patterns appear.
   */
  private _linePatternTexture: LinePatternTexture;
  /**
   * Eager-allocated per-batch hatch-pattern table. Sized to
   * {@link MAX_HATCH_PATTERN_SLOTS}; slots written lazily by
   * {@link _allocateHatchPatternSlot}.
   */
  private _hatchPatternTexture: HatchPatternTexture;
  /**
   * Eager-allocated per-batch table of per-segment cumulative
   * model-space distance from the segment's parent polyline
   * start. Indexed parallel to the line index buffer via
   * `geometryAttributes.polylineCumDistBase + primOffset`.
   * Drives the thick-line shader's continuous-pattern phase
   * across polyline joints. Portions are reserved lazily by
   * {@link addGeometry} for each `LinesPrimitive` geometry.
   */
  private _polylineCumDistTexture: PolylineCumDistTexture;
  /**
   * Per-batch line-pattern slot allocator. Maps a SceneMaterial's
   * uniqueId to its slot index in {@link _linePatternTexture}. Slot
   * 0 is reserved as the "no per-mesh pattern" sentinel — meshes
   * whose materials carry the default empty pattern leave their
   * `linePatternSlot` at 0 and fall back to the View-level
   * `linesMaterial.linePattern` uniform.
   *
   * Slots are allocated lazily on the first {@link addMesh} that
   * references a material with a non-default pattern, and never
   * freed within a batch's lifetime — a slot vacated by mesh
   * destruction stays around (32 bytes) until the batch itself
   * is destroyed. Simpler than refcounting + reclamation, and
   * the worst-case waste is bounded by {@link MAX_LINE_PATTERN_SLOTS}.
   */
  private _linePatternSlotsByMaterial: Map<string, number>;
  private _nextLinePatternSlot: number;
  /**
   * Parallel slot allocator for the per-batch hatch-pattern
   * table — same shape as {@link _linePatternSlotsByMaterial},
   * but indexes into {@link _hatchPatternTexture}. Slot 0 is
   * reserved as the "no hatch" sentinel.
   */
  private _hatchPatternSlotsByMaterial: Map<string, number>;
  private _nextHatchPatternSlot: number;
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
  private _emissiveAtlasTexture: TextureAtlas | null;
  private _occlusionAtlasTexture: TextureAtlas | null;
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
   * Creates a new GPUMemoryBatch.
   */
  constructor(index: number, renderContext: RenderContext, options: { hasNormals?: boolean, hasUVs?: boolean, triplanar?: boolean, mipmap?: boolean } = {}) {

    this.index = index;

    this._renderContext = renderContext;
    this.hasNormals = options.hasNormals === true;
    this.hasUVs = options.hasUVs === true;
    this.triplanar = options.triplanar === true;
    this.mipmap = options.mipmap === true;

    this._geometryHandles = {};
    this._meshHandles = {};
    this._meshIndicesByUniqueId = {};

    const memoryConfigs = renderContext.memoryConfigs;

    this._meshIndicesUsed = new Uint8Array(memoryConfigs.maxBatchMeshes);
    this._lastFreeMeshIndex = 0;
    this._geometryIndicesUsed = new Uint8Array(memoryConfigs.maxBatchGeometries);
    this._lastFreeGeometryIndex = 0;
    this._sceneGeometries = {};
    this._vertexNormalTexture = null;
    this._vertexUVTexture = null;
    this._albedoAtlasTexture = null;
    this._metallicRoughnessAtlasTexture = null;
    this._normalMapAtlasTexture = null;
    this._emissiveAtlasTexture = null;
    this._occlusionAtlasTexture = null;

    this._numGeometries = 0;
    this._numMeshes = 0;
    this._linePatternSlotsByMaterial = new Map();
    // Slot 0 is reserved as the "no pattern" sentinel — never
    // allocated, never written. Real materials start at slot 1.
    this._nextLinePatternSlot = 1;
    this._hatchPatternSlotsByMaterial = new Map();
    this._nextHatchPatternSlot = 1;
    // _linePatternTexture / _hatchPatternTexture /
    // _polylineCumDistTexture are eagerly allocated in
    // allocate() — they're undefined here, same pattern as the
    // other per-batch textures.
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

    // Per-batch line-pattern + hatch-pattern + polyline-cum-dist
    // tables. Allocated eagerly so the per-program samplers
    // always have a valid texture binding — WebGL2 rejects a
    // draw if a declared sampler points to a texture unit where
    // a differently-typed texture is bound, and an unbound
    // sampler defaults to unit 0 (which holds a float sampler2D
    // for other binds). Combined overhead is ~28 KB per batch,
    // negligible against the rest of the per-batch GPU memory.
    this._linePatternTexture = new LinePatternTexture({
      gl,
      maxItems: MAX_LINE_PATTERN_SLOTS,
      description: `[Batch ${this.index}] - lineMaterialSlot -> 8 pattern entries`,
      getNumItems: () => this._nextLinePatternSlot,
    });
    this._hatchPatternTexture = new HatchPatternTexture({
      gl,
      maxItems: MAX_HATCH_PATTERN_SLOTS,
      description: `[Batch ${this.index}] - hatchMaterialSlot -> 4 line families + RGBA colour + flags`,
      getNumItems: () => this._nextHatchPatternSlot,
    });
    this._polylineCumDistTexture = new PolylineCumDistTexture({
      gl,
      maxItems: Math.max(1, Math.floor(memoryConfigs.maxBatchIndices / 2)),
      description: `[Batch ${this.index}] - per-segment cumulative model distance from polyline start`,
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
    }
    // Atlases are needed by both the UV-bearing technique variant
    // (samples via `vUV`) and the triplanar variant (samples via
    // world-space UVs derived from `vWorldPos`). Allocate whenever
    // either flag is set.
    if (this.hasUVs || this.triplanar) {
      const atlasMipmap = this.mipmap;
      // The albedo atlas is bound by the textured technique variants
      // unconditionally — always-allocate keeps the shader path
      // branch-free. Untextured meshes write the atlas's sentinel
      // transform (scale = 0) and sample its pre-stamped white block.
      this._albedoAtlasTexture = new TextureAtlas({
        gl,
        description: `[Batch ${this.index}] - albedo atlas (sRGB 2D, shelf-packed${atlasMipmap ? ", mipmapped" : ""})`,
        // internalFormat defaults to SRGB8_ALPHA8.
        mipmap: atlasMipmap
      });
      // Metallic-roughness atlas — same shape, but linear RGBA8 since the
      // values are reflectance parameters, not colour. Sentinel = white,
      // which is exactly the multiplicative identity for the BRDF (`mr.g
      // * material.roughness` and `mr.b * material.metallic` both pass
      // the material values through unchanged when the texture is the
      // sentinel).
      this._metallicRoughnessAtlasTexture = new TextureAtlas({
        gl,
        description: `[Batch ${this.index}] - metallic-roughness atlas (linear 2D, shelf-packed${atlasMipmap ? ", mipmapped" : ""})`,
        internalFormat: gl.RGBA8,
        mipmap: atlasMipmap
      });
      // Tangent-space normal-map atlas. Sentinel `(128, 128, 255, 255)`
      // decodes to (0, 0, 1) — i.e. surface normal — so untextured
      // meshes get an identity perturbation and look exactly as they
      // did before normal-mapping landed.
      this._normalMapAtlasTexture = new TextureAtlas({
        gl,
        description: `[Batch ${this.index}] - normal-map atlas (linear 2D, shelf-packed${atlasMipmap ? ", mipmapped" : ""})`,
        internalFormat: gl.RGBA8,
        sentinelColor: [128, 128, 255, 255],
        mipmap: atlasMipmap
      });
      // Emissive atlas — sRGB like albedo (emissive textures are colour data,
      // glTF channel = sRGB). Sentinel = white; untextured meshes carry a
      // `[0,0,0]` emissive factor, so the white sentinel × 0 = no glow.
      this._emissiveAtlasTexture = new TextureAtlas({
        gl,
        description: `[Batch ${this.index}] - emissive atlas (sRGB 2D, shelf-packed${atlasMipmap ? ", mipmapped" : ""})`,
        // internalFormat defaults to SRGB8_ALPHA8.
        mipmap: atlasMipmap
      });
      // Ambient-occlusion atlas — linear RGBA8 (AO in R). Sentinel = white,
      // so `R = 1` for untextured meshes = no occlusion.
      this._occlusionAtlasTexture = new TextureAtlas({
        gl,
        description: `[Batch ${this.index}] - occlusion atlas (linear 2D, shelf-packed${atlasMipmap ? ", mipmapped" : ""})`,
        internalFormat: gl.RGBA8,
        mipmap: atlasMipmap
      });
    }

    const textures: {
      allocate(): SDKResult<void>;
      destroy(): void;
    }[] = [
      ...this._primitiveMeshIndexTexture,
      ...this._edgeMeshIndexTexture,
      this._meshAttributeTexture,
      this._linePatternTexture,
      this._hatchPatternTexture,
      this._polylineCumDistTexture,
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
      ...(this._normalMapAtlasTexture ? [this._normalMapAtlasTexture] : []),
      ...(this._emissiveAtlasTexture ? [this._emissiveAtlasTexture] : []),
      ...(this._occlusionAtlasTexture ? [this._occlusionAtlasTexture] : [])
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
        pickPrimitiveRange: this._primitiveMeshIndexTexture[i].primRange,
        pickEdgePrimitiveRange: this._edgeMeshIndexTexture[i].primRange,
      });
    }

    this.dataTextures = {
      views,
      indexTexture: this._indexTexture,
      edgeIndexTexture: this._edgeIndexTexture,
      meshMatrixTexture: this._meshMatrixTexture,
      meshAttributeTexture: this._meshAttributeTexture,
      // Lazy fields — `null` until first slot is allocated.
      linePatternTexture: this._linePatternTexture,
      hatchPatternTexture: this._hatchPatternTexture,
      polylineCumDistTexture: this._polylineCumDistTexture,
      geometryAttributeTexture: this._geometryAttributeTexture,
      geometryQuantRangeTexture: this._geometryQuantRangeTexture,
      vertexPositionTexture: this._vertexPositionTexture,
      vertexColorTexture: this._vertexColorTexture,
      vertexNormalTexture: this._vertexNormalTexture ?? undefined,
      vertexUVTexture: this._vertexUVTexture ?? undefined,
      albedoAtlasTexture: this._albedoAtlasTexture ?? undefined,
      metallicRoughnessAtlasTexture: this._metallicRoughnessAtlasTexture ?? undefined,
      normalMapAtlasTexture: this._normalMapAtlasTexture ?? undefined,
      emissiveAtlasTexture: this._emissiveAtlasTexture ?? undefined,
      occlusionAtlasTexture: this._occlusionAtlasTexture ?? undefined
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

  /**
   * Re-upload the pixels of an already-cached SceneTexture from this
   * batch's atlases. Walks all three atlases (albedo,
   * metallic-roughness, normal-map) and re-uploads wherever the id
   * matches; returns `true` if any of them held the texture.
   *
   * Used by the post-finalize `onSceneTextureImageDataChanged` flow.
   * The source's dimensions must match the placement — heat-map
   * painting mutates pixels in place but never resizes.
   */
  updateSceneTexture(sceneTexture: { id: string; image?: any; imageData?: any }): boolean {
    const source = sceneTexture.image ?? sceneTexture.imageData ?? null;
    if (!source) return false;
    let updated = false;
    if (this._albedoAtlasTexture)            updated = this._albedoAtlasTexture.updateTexture(sceneTexture.id, source) || updated;
    if (this._metallicRoughnessAtlasTexture) updated = this._metallicRoughnessAtlasTexture.updateTexture(sceneTexture.id, source) || updated;
    if (this._normalMapAtlasTexture)         updated = this._normalMapAtlasTexture.updateTexture(sceneTexture.id, source) || updated;
    if (this._emissiveAtlasTexture)          updated = this._emissiveAtlasTexture.updateTexture(sceneTexture.id, source) || updated;
    if (this._occlusionAtlasTexture)         updated = this._occlusionAtlasTexture.updateTexture(sceneTexture.id, source) || updated;
    return updated;
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
    if (this._emissiveAtlasTexture)  total += this._emissiveAtlasTexture.getAllocatedBytes();
    if (this._occlusionAtlasTexture) total += this._occlusionAtlasTexture.getAllocatedBytes();
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
    if (this._emissiveAtlasTexture)  total += this._emissiveAtlasTexture.getUsedBytes();
    if (this._occlusionAtlasTexture) total += this._occlusionAtlasTexture.getUsedBytes();
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
        ? (geometry.indices.length / 2) | 0
        : (geometry.indices.length / 3) | 0;
    if (geometry.primitive === TrianglesPrimitive && geometry.edgeIndices) {
      const edgePrimCount = (geometry.edgeIndices.length / 2) | 0;
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
      || atlasOverflow(this._normalMapAtlasTexture, sceneMesh.effectiveNormalsTexture)
      || atlasOverflow(this._emissiveAtlasTexture, sceneMesh.effectiveEmissiveTexture)
      || atlasOverflow(this._occlusionAtlasTexture, sceneMesh.effectiveOcclusionTexture)) {
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

    if (this._numMeshes >= maxBatchMeshes) {
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
      if (this._numGeometries >= maxGeometries) {
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

      // ── Polyline cumulative distance (LinesPrimitive only) ──
      //
      // Walk the index buffer once, detecting polyline chains
      // (consecutive segments sharing endpoints), and compute
      // the per-segment cumulative model-space distance from
      // the polyline start. The thick-line shader uses this to
      // keep the dash phase continuous across joints rather
      // than restarting at every segment.
      //
      // Triangle and point geometries skip this entirely —
      // `polylineCumDistBase` stays `0` in the attribute table
      // and the shader's polyline-aware branch is gated on
      // `LinesPrimitive` flags anyway.
      let polylineCumDistHandle: any = null;
      if (sceneGeometry.primitive === LinesPrimitive && sceneGeometry.indices && sceneGeometry.aabb) {
        const cumDistData = computePolylineCumDist(
          sceneGeometry.indices,
          sceneGeometry.positionsCompressed,
          sceneGeometry.aabb,
        );
        if (cumDistData.length > 0) {
          polylineCumDistHandle = this._polylineCumDistTexture!.getPortion(
            cumDistData,
            (newBase: number) => {
              this._geometryAttributeTexture.setItem(geometryIndex, {
                polylineCumDistBase: newBase
              });
            }
          );
          // Portion-allocation failure is a quiet downgrade:
          // the shader sees polylineCumDistBase = 0, behaves
          // as if the geometry isn't a polyline, and the
          // per-segment dash phase restarts at every joint.
          // Matches the pre-polyline-pattern visual exactly.
        }
      }

      this._geometryAttributeTexture.setItem(geometryIndex, {
        verticesBase: positionsPortion.base, // XYZ
        indicesBase: indicesHandle ? indicesHandle.base : 0,
        edgeIndicesBase: edgeIndicesHandle ? edgeIndicesHandle.base : 0,
        normalsBase: vertexNormalsPortion ? vertexNormalsPortion.base : 0,
        uvsBase: vertexUVsPortion ? vertexUVsPortion.base : 0,
        polylineCumDistBase: polylineCumDistHandle ? polylineCumDistHandle.base : 0,
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
    const emXform = resolveAtlasTransform(
      this._emissiveAtlasTexture,
      sceneMesh.effectiveEmissiveTexture,
      "emissive"
    );
    const aoXform = resolveAtlasTransform(
      this._occlusionAtlasTexture,
      sceneMesh.effectiveOcclusionTexture,
      "occlusion"
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
      normalMapUVScale:  [nmXform.uScale,  nmXform.vScale],
      emissiveUVOffset: [emXform.uOffset, emXform.vOffset],
      emissiveUVScale:  [emXform.uScale,  emXform.vScale],
      occlusionUVOffset: [aoXform.uOffset, aoXform.vOffset],
      occlusionUVScale:  [aoXform.uScale,  aoXform.vScale],
      // Emissive colour factor — `[0,0,0]` for materials with no emissive
      // texture suppresses the white sentinel; auto-`[1,1,1]` (set in
      // createMaterial) when textured so emissive = factor × texture.
      emissiveColor: sceneMesh.material
        ? sceneMesh.material.emissiveColor as [number, number, number]
        : DEFAULT_EMISSIVE_COLOR,
      // Sampled by the triplanar shader variant; UV-bearing batches
      // ignore the slot. Stored at full Float32 precision so users
      // can pick an arbitrary world-units-per-repeat without
      // quantisation surprises.
      triplanarScale: sceneMesh.effectiveTriplanarScale,
      // Per-mesh thick-line width (pixels). `0` flags fallback to
      // the View's `linesMaterial.lineWidth`; the thick-line
      // shader implements that fallback so unwired meshes keep
      // the global thickness.
      lineWidth: sceneMesh.effectiveLineWidth,
      // Per-mesh dash / gap pattern slot. `0` means "no override
      // — inherit the View's `linesMaterial.linePattern`"; any
      // positive value indexes into the per-batch
      // {@link LinePatternTexture}. Slot allocation is keyed on
      // the material so meshes that share a material share a slot
      // (and pay the per-mesh attribute storage cost only).
      linePatternSlot:  this._allocateLinePatternSlot(sceneMesh),
      // Per-mesh screen-space hatch slot. Same shape as
      // linePatternSlot — material-keyed, lazy-allocated.
      hatchPatternSlot: this._allocateHatchPatternSlot(sceneMesh),
    });

    const numViews = this._renderContext.memoryConfigs.maxViews;

    const color: Vec3 = quantizeColor3(sceneMesh.effectiveColor, tempQuantizedColor);

    const opacity = Math.floor(sceneMesh.effectiveOpacity * 255.0);

    for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
      this._meshViewAttributeTexture[viewIndex].setItem(meshIndex, {
        color,
        opacity,
        pickable: true,
        clippable: true
      });
    }

    // Upload the WORLD matrix — `sceneMesh.matrix` is the local matrix
    // and silently drops the SceneModel's coordinateSystemMatrix on
    // models whose basis differs from the scene's (e.g. a Z-up model in
    // a Y-up scene), leaving any mesh whose initial GPU upload happens
    // here unrotated until a follow-up setMatrix() overwrite arrives.
    // `worldMatrix` already includes the coord-system pre-multiply and
    // any parent-transform chain.
    this._meshMatrixTexture.setItem(meshIndex, sceneMesh.worldMatrix);

    // Floor: a primitive count is a whole number. A malformed index buffer
    // (length not a clean multiple of the primitive's index stride) would
    // otherwise yield a fractional count that propagates into the index
    // texture's run lengths and surfaces as a half-count in render stats.
    const primitiveCount = sceneGeometry.primitive === PointsPrimitive
      ? (sceneGeometry.positionsCompressed.length / 3) | 0
      : sceneGeometry.primitive === LinesPrimitive
        ? (sceneGeometry.indices.length / 2) | 0
        : (sceneGeometry.indices.length / 3) | 0;

    const primitiveMeshIndexTextureHandles = numViews === 1
      ? this._primitiveMeshIndexTexture[0].createPortion(primitiveCount, meshIndex, RENDER_PASSES.OPAQUE)
      : (() => {
        const handles = [];
        for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
          handles.push(this._primitiveMeshIndexTexture[viewIndex].createPortion(primitiveCount, meshIndex, RENDER_PASSES.OPAQUE));
        }
        return handles;
      })();

    let edgeMeshIndexTextureHandles: PerViewHandle | undefined;

    if (sceneGeometry.primitive === TrianglesPrimitive) {
      const edgeCount = sceneGeometry.edgeIndices ? (sceneGeometry.edgeIndices.length / 2) | 0 : 0;
      // Skip the per-view edge portion when the geometry has no
      // feature edges (typical of fully-coplanar earcut output from
      // SVG / PDF / drawing imports). Without this guard,
      // `createPortion(0)` throws `SDKInternalException` mid
      // sceneMeshCreated dispatch, aborting the mesh creation and
      // leaving the SceneObject with a dangling globalId. The
      // primitive-side portion (line 1129 above) is allocated
      // unconditionally because primitiveCount is already validated
      // by SceneModel.createGeometry's empty-indices check.
      if (edgeCount > 0) {
        edgeMeshIndexTextureHandles = numViews === 1
          ? this._edgeMeshIndexTexture[0].createPortion(edgeCount, meshIndex, RENDER_PASSES.OPAQUE)
          : (() => {
            const handles = [];
            for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
              handles.push(this._edgeMeshIndexTexture[viewIndex].createPortion(edgeCount, meshIndex, RENDER_PASSES.OPAQUE));
            }
            return handles;
          })();
      }
    }

    this._meshHandles[meshIndex] = {
      sceneMesh,
      meshIndex,
      primitiveMeshIndexTextureHandles,
      edgeMeshIndexTextureHandles,
      // Meshes start visible and un-culled in every view; the index
      // texture portions created above are already included in the
      // draw list, so this matches the initial GPU state.
      visibleMask: createVisibleMask(numViews),
      culledMask: 0
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
      emissiveColor?: [number, number, number];
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
    const primitiveMeshIndexTextureHandle = getPerViewHandle(meshHandle.primitiveMeshIndexTextureHandles, viewIndex);
    if (!primitiveMeshIndexTextureHandle) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshRenderBin: Mesh ${meshIndex} has no primitiveMeshIndexTextureHandle`);
    }
    this._primitiveMeshIndexTexture[viewIndex].setRenderPass(primitiveMeshIndexTextureHandle, renderPass);
    if (meshHandle.edgeMeshIndexTextureHandles) {
      const edgeMeshIndexTextureHandle = getPerViewHandle(meshHandle.edgeMeshIndexTextureHandles, viewIndex);
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
    const primitiveMeshIndexTextureHandle = getPerViewHandle(meshHandle.primitiveMeshIndexTextureHandles, viewIndex);
    if (!primitiveMeshIndexTextureHandle) {
      throw new SDKInternalException(`GPUMemoryBatch._applyMeshDrawInclusion: Mesh ${meshHandle.meshIndex} has no primitiveMeshIndexTextureHandle`);
    }
    this._primitiveMeshIndexTexture[viewIndex].setMeshVisible(primitiveMeshIndexTextureHandle, include);
    if (meshHandle.edgeMeshIndexTextureHandles) {
      const edgeMeshIndexTextureHandle = getPerViewHandle(meshHandle.edgeMeshIndexTextureHandles, viewIndex);
      if (!edgeMeshIndexTextureHandle) {
        throw new SDKInternalException(`GPUMemoryBatch._applyMeshDrawInclusion: Mesh ${meshHandle.meshIndex} has no edgeMeshIndexTextureHandle`);
      }
      this._edgeMeshIndexTexture[viewIndex].setObjectVisible(edgeMeshIndexTextureHandle, include);
    }
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

    forEachPerViewHandle(meshHandle.primitiveMeshIndexTextureHandles, numViews, (viewIndex, handle) => {
      this._primitiveMeshIndexTexture[viewIndex].deletePortion(handle);
    });
    forEachPerViewHandle(meshHandle.edgeMeshIndexTextureHandles, numViews, (viewIndex, handle) => {
      this._edgeMeshIndexTexture[viewIndex].deletePortion(handle);
    });

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

    const primitiveMeshIndexTextureHandle = getPerViewHandle(meshHandle.primitiveMeshIndexTextureHandles, 0);
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

  _putFreeMeshIndex(index: number): void {
    if (this._meshIndicesUsed[index] !== 0) {
      this._meshIndicesUsed[index] = 0;
      this._lastFreeMeshIndex = index;
    }
  }

  _getFreeGeometryIndex(): number {
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

  _putFreeGeometryIndex(index: number): void {
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
    didFlush = this._indexTexture.uploadChanges() || didFlush;
    didFlush = this._meshAttributeTexture.uploadChanges() || didFlush;
    didFlush = this._linePatternTexture.uploadChanges() || didFlush;
    didFlush = this._hatchPatternTexture.uploadChanges() || didFlush;
    didFlush = this._polylineCumDistTexture.uploadChanges() || didFlush;
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
      this._linePatternTexture,
      this._hatchPatternTexture,
      this._polylineCumDistTexture,
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
      ...(this._normalMapAtlasTexture ? [this._normalMapAtlasTexture] : []),
      ...(this._emissiveAtlasTexture ? [this._emissiveAtlasTexture] : []),
      ...(this._occlusionAtlasTexture ? [this._occlusionAtlasTexture] : [])
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
    this._linePatternTexture = clear(this._linePatternTexture);
    this._hatchPatternTexture = clear(this._hatchPatternTexture);
    this._polylineCumDistTexture = clear(this._polylineCumDistTexture);
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
    this._linePatternSlotsByMaterial.clear();
    this._nextLinePatternSlot = 1;
    this._hatchPatternSlotsByMaterial.clear();
    this._nextHatchPatternSlot = 1;
  }

  /**
   * Allocate or look up a {@link LinePatternTexture} slot for
   * the supplied mesh's material. Returns `0` when:
   *   - the mesh has no material attached, or
   *   - the material's `linePattern` is the default (empty / solid),
   *   - or the per-batch slot budget is exhausted (caps at
   *     {@link MAX_LINE_PATTERN_SLOTS}).
   *
   * `0` is the "no per-mesh pattern" sentinel — the shader
   * skips the lookup and falls back to the View-level
   * `linesMaterial.linePattern` uniform.
   *
   * Slots are keyed on `material.uniqueId` so meshes that
   * share a material share a slot. Slots are never freed
   * during the batch's lifetime — the per-mesh cost of doing
   * so (refcount bookkeeping, write-back on free) is more
   * expensive than the 32 bytes of GPU storage a stale slot
   * occupies.
   */
  private _allocateLinePatternSlot(sceneMesh: SceneMesh): number {
    const len = sceneMesh.effectiveLinePatternLen;
    if (len === 0) {
      return 0;
    }
    const entries = sceneMesh.effectiveLinePatternEntries;
    const material = sceneMesh.material;
    // Fall through to "no pattern" if either piece is missing —
    // the FS sentinel is robust against that case.
    if (!entries || !material) {
      return 0;
    }
    const key = material.uniqueId;
    const existing = this._linePatternSlotsByMaterial.get(key);
    if (existing !== undefined) {
      return existing;
    }
    if (this._nextLinePatternSlot >= MAX_LINE_PATTERN_SLOTS) {
      // Budget exhausted — pretend the material has no pattern
      // rather than thrash the slot table. Real engineering
      // drawings never come close to 256 distinct linetypes.
      return 0;
    }
    const slot = this._nextLinePatternSlot++;
    this._linePatternTexture!.setSlot(slot, entries);
    this._linePatternSlotsByMaterial.set(key, slot);
    return slot;
  }

  /**
   * Allocate or look up a {@link HatchPatternTexture} slot for
   * the supplied mesh's material. Returns `0` when:
   *   - the mesh has no material, or
   *   - the material's `hatchPattern` is the default (no
   *     families / count = 0), or
   *   - the per-batch slot budget is exhausted (capped at
   *     {@link MAX_HATCH_PATTERN_SLOTS}).
   *
   * Slot 0 is the "no hatch" sentinel — downstream consumers
   * skip the lookup and render the surface without overlay.
   * Slots are keyed on `material.uniqueId` so meshes that
   * share a material share a slot, and never freed during the
   * batch's lifetime.
   */
  private _allocateHatchPatternSlot(sceneMesh: SceneMesh): number {
    const count = sceneMesh.effectiveHatchPatternCount;
    if (count === 0) {
      return 0;
    }
    const families = sceneMesh.effectiveHatchPatternFamilies;
    const color    = sceneMesh.effectiveHatchPatternColor;
    const material = sceneMesh.material;
    if (!families || !color || !material) {
      return 0;
    }
    const key = material.uniqueId;
    const existing = this._hatchPatternSlotsByMaterial.get(key);
    if (existing !== undefined) {
      return existing;
    }
    if (this._nextHatchPatternSlot >= MAX_HATCH_PATTERN_SLOTS) {
      return 0;
    }
    const slot = this._nextHatchPatternSlot++;
    this._hatchPatternTexture!.setSlot(slot, families, color, sceneMesh.effectiveHatchPatternSpace);
    this._hatchPatternSlotsByMaterial.set(key, slot);
    return slot;
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
    const key = material.uniqueId;
    let updated = false;
    const lineSlot = this._linePatternSlotsByMaterial.get(key);
    if (lineSlot !== undefined && this._linePatternTexture) {
      const entries = material._linePatternEntries;
      const len = material._linePatternLen;
      // If the material was edited to have NO pattern any
      // more, the slot data is overwritten with zeros — the
      // shader's slot-length check sees a zero pattern and
      // skips the walk. We deliberately don't reclaim the
      // slot or re-point the per-mesh attribute texture's
      // index field (would require iterating every mesh that
      // references this material).
      if (len > 0) {
        this._linePatternTexture.setSlot(lineSlot, entries);
      } else {
        this._linePatternTexture.setSlot(lineSlot, EMPTY_LINE_PATTERN_ENTRIES);
      }
      updated = true;
    }
    const hatchSlot = this._hatchPatternSlotsByMaterial.get(key);
    if (hatchSlot !== undefined && this._hatchPatternTexture) {
      const families = material._hatchPatternFamilies;
      const color    = material._hatchPatternColor;
      const count    = material._hatchPatternCount;
      const space    = material._hatchPatternSpace;
      if (count > 0) {
        this._hatchPatternTexture.setSlot(hatchSlot, families, color, space);
      } else {
        this._hatchPatternTexture.setSlot(hatchSlot, EMPTY_HATCH_FAMILIES, EMPTY_HATCH_COLOR, 0);
      }
      updated = true;
    }
    return updated;
  }

}

/**
 * Walk the line index buffer once, detecting polyline chains
 * (consecutive segments where segment N's start index equals
 * segment N-1's end index), and emit a `Float32Array` of
 * per-segment cumulative model-space distance from the parent
 * polyline's start.
 *
 * A "polyline" here is the same notion the shader's miter-join
 * detector uses — segments are linked only when (a) they're
 * consecutive in the index buffer, and (b) they share an
 * endpoint vertex id. Isolated segments and polyline starts
 * get `cumDist = 0`.
 *
 * Distances are computed in geometry-local model space — the
 * shader multiplies by a per-frame screen-space ratio to
 * derive pixel offsets.
 *
 * Returns an empty array when the geometry has no indices or
 * no AABB; the caller then skips the portion allocation.
 */
function computePolylineCumDist(
  indices: ArrayLike<number>,
  positionsCompressed: ArrayLike<number>,
  aabb: ArrayLike<number>,
): Float32Array {
  const numSegments = (indices.length / 2) | 0;
  if (numSegments <= 0) {
    return new Float32Array(0);
  }
  // Dequantization parameters — same shape as the renderer's
  // GeometryQuantRangeTexture, but evaluated CPU-side so we
  // can compute Euclidean distances on the actual model values.
  const xMin = aabb[0], yMin = aabb[1], zMin = aabb[2];
  const xMax = aabb[3], yMax = aabb[4], zMax = aabb[5];
  const sx = (xMax - xMin) / 65535;
  const sy = (yMax - yMin) / 65535;
  const sz = (zMax - zMin) / 65535;
  const pos = (vertexIdx: number, out: [number, number, number]): void => {
    const o = vertexIdx * 3;
    out[0] = xMin + positionsCompressed[o] * sx;
    out[1] = yMin + positionsCompressed[o + 1] * sy;
    out[2] = zMin + positionsCompressed[o + 2] * sz;
  };
  const out = new Float32Array(numSegments);
  const pA: [number, number, number] = [0, 0, 0];
  const pB: [number, number, number] = [0, 0, 0];
  let prevEndIdx = -1;
  let cumDist = 0;
  let prevLen = 0;
  for (let i = 0; i < numSegments; i++) {
    const aIdx = indices[i * 2];
    const bIdx = indices[i * 2 + 1];
    if (aIdx === prevEndIdx) {
      // Continuation of a polyline — accumulate previous
      // segment's model length.
      cumDist += prevLen;
    } else {
      // Polyline start (or isolated segment).
      cumDist = 0;
    }
    out[i] = cumDist;
    pos(aIdx, pA);
    pos(bIdx, pB);
    const dx = pB[0] - pA[0];
    const dy = pB[1] - pA[1];
    const dz = pB[2] - pA[2];
    prevLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
    prevEndIdx = bIdx;
  }
  return out;
}
