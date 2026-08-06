import type {SceneMaterial, SceneMesh, SceneModel, SceneTexture} from "../../model/scene";
import {getMeshWorldMatrix} from "../../model/scene";
import type {XGFChunkManifest} from "./chunk/XGFChunkManifest";
import type {XGFManifestOptions} from "./manifest/XGFManifestOptions";

/** @internal */
export function createXGFManifest(params: {
  sceneModel: SceneModel;
}, options: XGFManifestOptions = {}): XGFChunkManifest {

  const sceneModel = params.sceneModel;
  const role = options.assetMode === "assetLibrary" || options.assetMode === "referencesOnly"
    ? options.assetMode
    : "full";

  const allGeometryIds = sortedKeys(sceneModel.geometries);
  const allMaterialIds = sortedKeys(sceneModel.materials);
  const allTextureIds = sortedKeys(sceneModel.textures);
  const usedGeometryIds = new Set<string>();
  const usedMaterialIds = new Set<string>();
  const usedTextureIds = new Set<string>();

  forEachMesh(sceneModel, mesh => {
    usedGeometryIds.add(mesh.geometry.id);
    if (mesh.material) {
      addMaterialDependencies(mesh.material, usedMaterialIds, usedTextureIds);
    }
  });

  const createsAssets = role !== "referencesOnly";
  const dependencies = role === "referencesOnly"
    ? {
      chunks: (options.dependencies || []).slice(),
      geometries: sortedSet(usedGeometryIds),
      materials: sortedSet(usedMaterialIds),
      textures: sortedSet(usedTextureIds)
    }
    : {
      chunks: (options.dependencies || []).slice(),
      geometries: [],
      materials: [],
      textures: []
    };

  const manifest: XGFChunkManifest = {
    format: "XGF",
    manifestVersion: "1.0.0",
    xgfVersion: "2.0.0",
    id: options.id || sceneModel.id,
    uri: options.uri,
    role,
    dependencies,
    assets: {
      geometries: createsAssets ? allGeometryIds : [],
      materials: createsAssets ? allMaterialIds : [],
      textures: createsAssets ? allTextureIds : []
    },
    counts: {
      transforms: Object.keys((sceneModel as any).transforms || {}).length,
      geometries: createsAssets ? allGeometryIds.length : 0,
      materials: createsAssets ? allMaterialIds.length : 0,
      textures: createsAssets ? allTextureIds.length : 0,
      meshes: role === "assetLibrary" ? 0 : Object.keys(sceneModel.meshes).length,
      objects: role === "assetLibrary" ? 0 : Object.keys(sceneModel.objects).length
    },
    priority: options.priority,
    lod: options.lod
  };

  const aabb = computeSceneModelAABB(sceneModel, options.coordinateSystem);
  if (aabb) {
    manifest.aabb = aabb;
  }

  return manifest;
}

function sortedKeys(obj: Record<string, any>): string[] {
  return Object.keys(obj).sort();
}

function sortedSet(set: Set<string>): string[] {
  return Array.from(set).sort();
}

function forEachMesh(sceneModel: SceneModel, callback: (mesh: SceneMesh) => void): void {
  for (const id in sceneModel.meshes) {
    callback(sceneModel.meshes[id]);
  }
}

function addMaterialDependencies(
  material: SceneMaterial,
  materialIds: Set<string>,
  textureIds: Set<string>
): void {
  materialIds.add(material.id);
  addTextureId(textureIds, material.colorTexture);
  addTextureId(textureIds, material.metallicRoughnessTexture);
  addTextureId(textureIds, material.normalsTexture);
  addTextureId(textureIds, material.occlusionTexture);
  addTextureId(textureIds, material.emissiveTexture);
}

function addTextureId(textureIds: Set<string>, texture?: SceneTexture): void {
  if (texture) {
    textureIds.add(texture.id);
  }
}

function computeSceneModelAABB(sceneModel: SceneModel, coordinateSystem?: any): number[] | undefined {
  let xmin = Number.POSITIVE_INFINITY;
  let ymin = Number.POSITIVE_INFINITY;
  let zmin = Number.POSITIVE_INFINITY;
  let xmax = Number.NEGATIVE_INFINITY;
  let ymax = Number.NEGATIVE_INFINITY;
  let zmax = Number.NEGATIVE_INFINITY;
  let hasBounds = false;

  forEachMesh(sceneModel, mesh => {
    const aabb = mesh.geometry.aabb;
    if (!aabb || aabb.length !== 6) {
      return;
    }
    const matrix = coordinateSystem ? getMeshWorldMatrix(mesh, coordinateSystem) : mesh.worldMatrix;
    for (let xBit = 0; xBit <= 1; xBit++) {
      const x = aabb[xBit ? 3 : 0];
      for (let yBit = 0; yBit <= 1; yBit++) {
        const y = aabb[yBit ? 4 : 1];
        for (let zBit = 0; zBit <= 1; zBit++) {
          const z = aabb[zBit ? 5 : 2];
          const tx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
          const ty = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
          const tz = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
          xmin = Math.min(xmin, tx);
          ymin = Math.min(ymin, ty);
          zmin = Math.min(zmin, tz);
          xmax = Math.max(xmax, tx);
          ymax = Math.max(ymax, ty);
          zmax = Math.max(zmax, tz);
          hasBounds = true;
        }
      }
    }
  });

  return hasBounds ? [xmin, ymin, zmin, xmax, ymax, zmax] : undefined;
}
