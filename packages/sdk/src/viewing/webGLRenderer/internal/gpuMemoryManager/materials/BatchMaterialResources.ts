import type {SceneMesh} from "../../../../../model/scene";
import {type SDKResult} from "../../../../../base/core";
import {TextureAtlas, type AtlasTransform} from "../dataTextures/TextureAtlas";

type SceneTextureLike = {
  id: string;
  image?: any;
  imageData?: any;
  width?: number;
  height?: number;
};

type BatchMaterialResourcesOptions = {
  gl: WebGL2RenderingContext;
  batchIndex: number;
  hasUVs: boolean;
  triplanar: boolean;
  mipmap: boolean;
};

/**
 * Texture-atlas resources exposed through a batch's public renderer resource bag.
 *
 * @internal
 */
export type BatchMaterialAtlasResources = {
  albedoAtlasTexture?: TextureAtlas;
  metallicRoughnessAtlasTexture?: TextureAtlas;
  normalMapAtlasTexture?: TextureAtlas;
  emissiveAtlasTexture?: TextureAtlas;
  occlusionAtlasTexture?: TextureAtlas;
};

/**
 * Per-mesh atlas UV transforms that get written into MeshAttributeTexture.
 *
 * @internal
 */
export type BatchMaterialTextureTransforms = {
  albedo: AtlasTransform;
  metallicRoughness: AtlasTransform;
  normalMap: AtlasTransform;
  emissive: AtlasTransform;
  occlusion: AtlasTransform;
};

const ZERO_ATLAS_TRANSFORM: AtlasTransform = { uOffset: 0, vOffset: 0, uScale: 0, vScale: 0 };

/**
 * Probe used before adding a mesh to decide whether the mesh's texture would
 * fit in this batch atlas. Returns true only when a fresh same-size atlas would
 * help; textures too large for any atlas are allowed through and later fall
 * back to the atlas sentinel at upload time.
 */
function atlasOverflow(
  atlas: TextureAtlas | null,
  sceneTexture: SceneTextureLike | undefined
): boolean {
  if (!atlas || !sceneTexture) return false;
  const source = sceneTexture.image ?? sceneTexture.imageData ?? null;
  const w = (source && source.width)  ?? sceneTexture.width  ?? 0;
  const h = (source && source.height) ?? sceneTexture.height ?? 0;
  if (w <= 0 || h <= 0) return false;
  return atlas.canFitTexture(sceneTexture.id, w, h) === "would-fit-in-fresh-atlas";
}

/**
 * Resolves one SceneTexture reference into a sub-rectangle of its batch atlas.
 * Missing atlases write deterministic zeros; missing or failed uploads use the
 * atlas sentinel so shaders can sample without branching.
 */
function resolveAtlasTransform(
  atlas: TextureAtlas | null,
  sceneTexture: SceneTextureLike | undefined,
  label: string
): AtlasTransform {
  if (!atlas) {
    return ZERO_ATLAS_TRANSFORM;
  }
  if (sceneTexture) {
    const source = sceneTexture.image ?? sceneTexture.imageData ?? null;
    if (source) {
      const t = atlas.addTexture(sceneTexture.id, source);
      if (t) return t;
      console.warn(`GPUMemoryBatch.addMesh: ${label} atlas full or upload failed for SceneTexture '${sceneTexture.id}' - falling back to sentinel`);
    }
  }
  return atlas.sentinelTransform;
}

/**
 * Owns the per-batch PBR texture atlases and the policy for assigning mesh
 * material textures into them.
 *
 * GPUMemoryBatch owns mesh and geometry lifetimes; this class owns only the
 * atlas resources derived from `hasUVs`, `triplanar`, and `mipmap`. It keeps
 * atlas allocation, texture updates, fit checks, restore, and byte accounting
 * out of the batch coordinator.
 *
 * @internal
 */
export class BatchMaterialResources {

  private _albedoAtlasTexture: TextureAtlas | null;
  private _metallicRoughnessAtlasTexture: TextureAtlas | null;
  private _normalMapAtlasTexture: TextureAtlas | null;
  private _emissiveAtlasTexture: TextureAtlas | null;
  private _occlusionAtlasTexture: TextureAtlas | null;

  constructor(options: BatchMaterialResourcesOptions) {
    this._albedoAtlasTexture = null;
    this._metallicRoughnessAtlasTexture = null;
    this._normalMapAtlasTexture = null;
    this._emissiveAtlasTexture = null;
    this._occlusionAtlasTexture = null;

    if (!options.hasUVs && !options.triplanar) {
      return;
    }

    const {gl, batchIndex, mipmap} = options;
    const mipmapLabel = mipmap ? ", mipmapped" : "";

    // The albedo atlas is bound by textured technique variants
    // unconditionally. Untextured meshes sample its white sentinel.
    this._albedoAtlasTexture = new TextureAtlas({
      gl,
      description: `[Batch ${batchIndex}] - albedo atlas (sRGB 2D, shelf-packed${mipmapLabel})`,
      mipmap
    });

    // Linear RGBA8 because metallic-roughness values are reflectance
    // parameters, not colour data. The white sentinel is a BRDF passthrough.
    this._metallicRoughnessAtlasTexture = new TextureAtlas({
      gl,
      description: `[Batch ${batchIndex}] - metallic-roughness atlas (linear 2D, shelf-packed${mipmapLabel})`,
      internalFormat: gl.RGBA8,
      mipmap
    });

    // Tangent-space normal maps use an identity-normal sentinel.
    this._normalMapAtlasTexture = new TextureAtlas({
      gl,
      description: `[Batch ${batchIndex}] - normal-map atlas (linear 2D, shelf-packed${mipmapLabel})`,
      internalFormat: gl.RGBA8,
      sentinelColor: [128, 128, 255, 255],
      mipmap
    });

    // Emissive is colour data, so keep the sRGB default. The material's
    // emissive factor controls whether the white sentinel contributes.
    this._emissiveAtlasTexture = new TextureAtlas({
      gl,
      description: `[Batch ${batchIndex}] - emissive atlas (sRGB 2D, shelf-packed${mipmapLabel})`,
      mipmap
    });

    // AO is linear data; the white sentinel means no occlusion.
    this._occlusionAtlasTexture = new TextureAtlas({
      gl,
      description: `[Batch ${batchIndex}] - occlusion atlas (linear 2D, shelf-packed${mipmapLabel})`,
      internalFormat: gl.RGBA8,
      mipmap
    });
  }

  /**
   * Returns all atlas textures that need normal allocate/destroy handling.
   */
  getAllocatableResources(): TextureAtlas[] {
    return this._getAtlases();
  }

  /**
   * Returns the atlas fields to flatten into BatchGPUResources.
   */
  getDataTextureResources(): BatchMaterialAtlasResources {
    return {
      albedoAtlasTexture: this._albedoAtlasTexture ?? undefined,
      metallicRoughnessAtlasTexture: this._metallicRoughnessAtlasTexture ?? undefined,
      normalMapAtlasTexture: this._normalMapAtlasTexture ?? undefined,
      emissiveAtlasTexture: this._emissiveAtlasTexture ?? undefined,
      occlusionAtlasTexture: this._occlusionAtlasTexture ?? undefined
    };
  }

  /**
   * Re-upload an edited SceneTexture into every atlas that already stores it.
   */
  updateSceneTexture(sceneTexture: SceneTextureLike): boolean {
    const source = sceneTexture.image ?? sceneTexture.imageData ?? null;
    if (!source) return false;
    let updated = false;
    for (const atlas of this._getAtlases()) {
      updated = atlas.updateTexture(sceneTexture.id, source) || updated;
    }
    return updated;
  }

  /**
   * Tests whether any atlas would force this mesh into another batch.
   */
  hasAtlasOverflow(sceneMesh: SceneMesh): boolean {
    return atlasOverflow(this._albedoAtlasTexture, sceneMesh.effectiveColorTexture)
      || atlasOverflow(this._metallicRoughnessAtlasTexture, sceneMesh.effectiveMetallicRoughnessTexture)
      || atlasOverflow(this._normalMapAtlasTexture, sceneMesh.effectiveNormalsTexture)
      || atlasOverflow(this._emissiveAtlasTexture, sceneMesh.effectiveEmissiveTexture)
      || atlasOverflow(this._occlusionAtlasTexture, sceneMesh.effectiveOcclusionTexture);
  }

  /**
   * Adds the mesh's textures to the atlases and returns their UV transforms.
   */
  resolveTextureTransforms(sceneMesh: SceneMesh): BatchMaterialTextureTransforms {
    return {
      albedo: resolveAtlasTransform(
        this._albedoAtlasTexture,
        sceneMesh.effectiveColorTexture,
        "albedo"
      ),
      metallicRoughness: resolveAtlasTransform(
        this._metallicRoughnessAtlasTexture,
        sceneMesh.effectiveMetallicRoughnessTexture,
        "metallic-roughness"
      ),
      normalMap: resolveAtlasTransform(
        this._normalMapAtlasTexture,
        sceneMesh.effectiveNormalsTexture,
        "normal-map"
      ),
      emissive: resolveAtlasTransform(
        this._emissiveAtlasTexture,
        sceneMesh.effectiveEmissiveTexture,
        "emissive"
      ),
      occlusion: resolveAtlasTransform(
        this._occlusionAtlasTexture,
        sceneMesh.effectiveOcclusionTexture,
        "occlusion"
      )
    };
  }

  /**
   * Rebinds and restores all owned atlases after WebGL context restoration.
   */
  webglContextRestored(gl: WebGL2RenderingContext): SDKResult<void> {
    for (const atlas of this._getAtlases()) {
      atlas.setWebGLContext(gl);
      const result = atlas.webglContextRestored();
      if (result.ok === false) {
        return result;
      }
    }
    return {ok: true, value: undefined};
  }

  getAllocatedBytes(): number {
    let total = 0;
    for (const atlas of this._getAtlases()) {
      total += atlas.getAllocatedBytes();
    }
    return total;
  }

  getUsedBytes(): number {
    let total = 0;
    for (const atlas of this._getAtlases()) {
      total += atlas.getUsedBytes();
    }
    return total;
  }

  destroy(): void {
    this._albedoAtlasTexture = this._clearAtlas(this._albedoAtlasTexture);
    this._metallicRoughnessAtlasTexture = this._clearAtlas(this._metallicRoughnessAtlasTexture);
    this._normalMapAtlasTexture = this._clearAtlas(this._normalMapAtlasTexture);
    this._emissiveAtlasTexture = this._clearAtlas(this._emissiveAtlasTexture);
    this._occlusionAtlasTexture = this._clearAtlas(this._occlusionAtlasTexture);
  }

  private _getAtlases(): TextureAtlas[] {
    return [
      ...(this._albedoAtlasTexture ? [this._albedoAtlasTexture] : []),
      ...(this._metallicRoughnessAtlasTexture ? [this._metallicRoughnessAtlasTexture] : []),
      ...(this._normalMapAtlasTexture ? [this._normalMapAtlasTexture] : []),
      ...(this._emissiveAtlasTexture ? [this._emissiveAtlasTexture] : []),
      ...(this._occlusionAtlasTexture ? [this._occlusionAtlasTexture] : [])
    ];
  }

  private _clearAtlas(atlas: TextureAtlas | null): null {
    if (atlas) {
      atlas.destroy();
    }
    return null;
  }
}
