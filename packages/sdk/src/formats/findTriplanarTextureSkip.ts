import type {SceneModel} from "../model/scene";

/** The texture-binding fields a SceneMaterial can carry. */
const TEXTURE_REFS = [
  "colorTexture",
  "metallicRoughnessTexture",
  "normalsTexture",
  "occlusionTexture",
  "emissiveTexture",
] as const;

function materialTextureIds(material: any): string[] {
  const ids: string[] = [];
  for (const key of TEXTURE_REFS) {
    if (material[key]) ids.push(material[key].id);
  }
  return ids;
}

/**
 * The materials and textures a SceneModel uses *only* via triplanar
 * (world-projected) sampling, which UV-mapped formats can't represent.
 */
export interface TriplanarTextureSkip {
  /**
   * Material ids that are textured but applied solely to geometry without UVs.
   * UV-format exporters should drop these materials' texture bindings and write
   * them as flat colour/PBR.
   */
  materialIds: Set<string>;
  /**
   * Texture ids referenced only by the above materials — safe to omit entirely
   * from the output rather than embed unusable image data.
   */
  textureIds: Set<string>;
  /** True when anything was flagged — the exporter should warn. */
  any: boolean;
}

/**
 * Finds textures the SceneModel only samples via *triplanar* (world-projected)
 * texturing — i.e. textured materials applied solely to geometry without UVs.
 *
 * Mirrors the renderer's rule (a mesh is triplanar when its geometry has no UVs
 * and its material binds any texture). UV-mapped export formats — glTF, FBX,
 * USDZ, XKT — can't represent triplanar, so these texture bindings would render
 * as missing and only bloat the file; exporters drop them and flatten the
 * material instead.
 */
export function findTriplanarTextureSkip(sceneModel: SceneModel): TriplanarTextureSkip {
  const usedOnUV = new Set<string>();      // material id used on UV-bearing geometry
  const usedOnUVless = new Set<string>();  // material id used on UV-less geometry
  for (const objectId of Object.keys(sceneModel.objects)) {
    for (const mesh of sceneModel.objects[objectId].meshes) {
      const materialId = (mesh as any).material?.id;
      if (!materialId) continue;
      if ((mesh.geometry as any)?.uvsCompressed) usedOnUV.add(materialId);
      else usedOnUVless.add(materialId);
    }
  }

  const materialIds = new Set<string>();
  const texRefTotal = new Map<string, number>();
  const texRefTriplanar = new Map<string, number>();
  for (const materialId of Object.keys(sceneModel.materials)) {
    const material: any = sceneModel.materials[materialId];
    const texIds = materialTextureIds(material);
    for (const t of texIds) texRefTotal.set(t, (texRefTotal.get(t) ?? 0) + 1);
    // Triplanar-only: has textures, rendered on UV-less geometry, never on UV
    // geometry (a material with any UV use keeps its textures for those meshes).
    const triplanarOnly = texIds.length > 0 && usedOnUVless.has(materialId) && !usedOnUV.has(materialId);
    if (triplanarOnly) {
      materialIds.add(materialId);
      for (const t of texIds) texRefTriplanar.set(t, (texRefTriplanar.get(t) ?? 0) + 1);
    }
  }

  // A texture is omittable only when every reference to it comes from a
  // triplanar-only material (so it isn't needed by some UV material).
  const textureIds = new Set<string>();
  for (const [textureId, total] of texRefTotal) {
    if (total > 0 && (texRefTriplanar.get(textureId) ?? 0) === total) {
      textureIds.add(textureId);
    }
  }

  return {materialIds, textureIds, any: materialIds.size > 0};
}

/**
 * The one-line warning an exporter emits when it drops triplanar textures.
 */
export function triplanarSkipWarning(format: string, skip: TriplanarTextureSkip): string {
  return `[${format}] Dropped ${skip.textureIds.size} texture(s) on ${skip.materialIds.size} ` +
    `material(s): they are sampled via triplanar (world-projected) texturing, which ${format} ` +
    `cannot represent — those materials are exported as flat colour. Export to XGF to keep them.`;
}
