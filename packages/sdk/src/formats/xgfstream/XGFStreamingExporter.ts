import {SDKErrorType, type SDKResult} from "../../base/core";
import type {SceneMaterial, SceneModel, SceneTexture} from "../../model/scene";
import {XGFExporter} from "../xgf/XGFExporter";
import type {XGFChunkDependency} from "./chunk/XGFChunkDependency";
import type {XGFChunkManifest} from "./chunk/XGFChunkManifest";
import {createXGFManifest} from "./XGFManifest";
import type {XGFAssetLibraryExportSpec} from "./export/XGFAssetLibraryExportSpec";
import type {XGFStreamingChunkExportSpec} from "./export/XGFStreamingChunkExportSpec";
import type {XGFStreamingExportParams} from "./export/XGFStreamingExportParams";
import type {XGFStreamingExportResult} from "./export/XGFStreamingExportResult";
import type {XGFStreamingIndex} from "./index/XGFStreamingIndex";
import type {XGFStreamingRuntimeIndex} from "./index/XGFStreamingRuntimeIndex";
import {writeXGFStreamingIndex} from "./index/writeXGFStreamingIndex";
import {writeXGFStreamingRuntimeIndex} from "./index/writeXGFStreamingRuntimeIndex";

/** @internal */
export class XGFStreamingExporter {

  private readonly _xgfExporter: XGFExporter;

  constructor(params: {
    xgfExporter?: XGFExporter;
  } = {}) {
    this._xgfExporter = params.xgfExporter || new XGFExporter();
  }

  async write(params: XGFStreamingExportParams): Promise<SDKResult<XGFStreamingExportResult>> {
    const validation = validateParams(params);
    if (validation.ok === false) {
      return validation;
    }

    const {sceneModel} = params;
    const outputCoordinateSystem = params.coordinateSystem || sceneModel.coordinateSystem;
    const files: Record<string, ArrayBuffer | XGFChunkManifest | XGFStreamingIndex | XGFStreamingRuntimeIndex> = {};
    const manifests: XGFChunkManifest[] = [];
    const librarySpecsById: Record<string, XGFAssetLibraryExportSpec> = {};

    try {
      for (const spec of params.assetLibraries) {
        librarySpecsById[spec.id] = spec;
        const view = createAssetLibraryView(sceneModel, spec);
        const fileData = await this._xgfExporter.write({sceneModel: view as SceneModel}, {
          assetMode: "assetLibrary",
          coordinateSystem: outputCoordinateSystem,
          ignoreNormals: params.ignoreNormals,
          ignoreUVs: params.ignoreUVs
        });
        const manifest = createXGFManifest(
          {sceneModel: view as SceneModel},
          {
            id: spec.id,
            uri: spec.uri,
            assetMode: "assetLibrary",
            priority: spec.priority,
            lod: spec.lod,
            coordinateSystem: outputCoordinateSystem
          }
        );
        files[spec.uri] = fileData;
        manifests.push(manifest);
      }

      for (const spec of params.chunks) {
        const view = createChunkView(sceneModel, spec, params.collapseChunkObjects === true);
        const dependencies = dependenciesForChunk(spec, params.assetLibraries, librarySpecsById);
        const fileData = await this._xgfExporter.write({sceneModel: view as SceneModel}, {
          assetMode: "referencesOnly",
          coordinateSystem: outputCoordinateSystem,
          ignoreNormals: params.ignoreNormals,
          ignoreUVs: params.ignoreUVs
        });
        const manifest = createXGFManifest(
          {sceneModel: view as SceneModel},
          {
            id: spec.id,
            uri: spec.uri,
            assetMode: "referencesOnly",
            dependencies,
            priority: spec.priority,
            lod: spec.lod,
            coordinateSystem: outputCoordinateSystem
          }
        );
        files[spec.uri] = fileData;
        manifests.push(manifest);
      }

      const index = {
        format: "XGFStreamingIndex" as const,
        indexVersion: "1.2.0" as const,
        chunks: manifests,
        rootChunkIds: params.chunks.map(chunk => chunk.id),
        aabb: aggregateManifestAABB(manifests),
        coordinateSystem: cloneCoordinateSystem(outputCoordinateSystem)
      };
      files[params.indexUri || "index.json"] = writeXGFStreamingIndex(index);
      if (params.runtimeIndexUri) {
        files[params.runtimeIndexUri] = writeXGFStreamingRuntimeIndex(index);
      }

      return {
        ok: true,
        value: {
          index,
          manifests,
          files
        }
      };
    } catch (error: any) {
      return invalid(`[XGFStreamingExporter.write] ${error?.message || error}`);
    }
  }
}

function cloneCoordinateSystem(coordinateSystem: any): any | undefined {
  if (!coordinateSystem) {
    return undefined;
  }
  return {
    basis: Array.from(coordinateSystem.basis || []),
    origin: Array.from(coordinateSystem.origin || [0, 0, 0]),
    units: coordinateSystem.units,
    scaleToMeters: coordinateSystem.scaleToMeters
  };
}

function validateParams(params: XGFStreamingExportParams): SDKResult<void> {
  if (!params || !params.sceneModel) {
    return invalid("[XGFStreamingExporter.write] sceneModel is required");
  }
  if (!Array.isArray(params.assetLibraries)) {
    return invalid("[XGFStreamingExporter.write] assetLibraries array is required");
  }
  if (!Array.isArray(params.chunks)) {
    return invalid("[XGFStreamingExporter.write] chunks array is required");
  }
  const ids = new Set<string>();
  const assetLibraryIds = new Set<string>();
  for (const spec of params.assetLibraries) {
    const result = validateSpecIdUri(spec, "assetLibraries");
    if (result.ok === false) return result;
    if (ids.has(spec.id)) return invalid(`[XGFStreamingExporter.write] Duplicate chunk id '${spec.id}'`);
    ids.add(spec.id);
    assetLibraryIds.add(spec.id);
  }
  for (const spec of params.chunks) {
    const result = validateSpecIdUri(spec, "chunks");
    if (result.ok === false) return result;
    if (!Array.isArray(spec.objectIds) || spec.objectIds.length === 0) {
      return invalid(`[XGFStreamingExporter.write] Chunk '${spec.id}' requires objectIds`);
    }
    if (ids.has(spec.id)) return invalid(`[XGFStreamingExporter.write] Duplicate chunk id '${spec.id}'`);
    if (spec.assetLibraryIds) {
      for (const assetLibraryId of spec.assetLibraryIds) {
        if (!assetLibraryIds.has(assetLibraryId)) {
          return invalid(`[XGFStreamingExporter.write] Chunk '${spec.id}' references unknown asset library '${assetLibraryId}'`);
        }
      }
    }
    ids.add(spec.id);
  }
  return {ok: true, value: undefined};
}

function validateSpecIdUri(spec: { id?: string; uri?: string }, path: string): SDKResult<void> {
  if (!spec || typeof spec.id !== "string" || spec.id.length === 0) {
    return invalid(`[XGFStreamingExporter.write] ${path} entry requires id`);
  }
  if (typeof spec.uri !== "string" || spec.uri.length === 0) {
    return invalid(`[XGFStreamingExporter.write] ${path} '${spec.id}' requires uri`);
  }
  return {ok: true, value: undefined};
}

function createAssetLibraryView(sceneModel: SceneModel, spec: XGFAssetLibraryExportSpec): any {
  const assetIds = collectAssetIds(sceneModel, spec.objectIds || []);
  addIds(assetIds.geometries, spec.geometryIds);
  addIds(assetIds.materials, spec.materialIds);
  addIds(assetIds.textures, spec.textureIds);
  includeMaterialTextures(sceneModel, assetIds);
  return createView(sceneModel, {
    objectIds: new Set<string>(),
    meshIds: new Set<string>(),
    transformIds: new Set<string>(),
    geometryIds: assetIds.geometries,
    materialIds: assetIds.materials,
    textureIds: assetIds.textures
  });
}

function createChunkView(sceneModel: SceneModel, spec: XGFStreamingChunkExportSpec, collapseObjects: boolean): any {
  const objectSet = new Set<string>();
  const meshSet = new Set<string>();
  const transformSet = new Set<string>();
  const chunkMeshes: any[] = [];
  for (const objectId of spec.objectIds) {
    const object = sceneModel.objects[objectId];
    if (!object) {
      continue;
    }
    if (!collapseObjects) {
      objectSet.add(objectId);
    }
    for (const mesh of object.meshes) {
      meshSet.add(mesh.id);
      chunkMeshes.push(mesh);
      addTransformAncestors(transformSet, mesh.parentTransform);
    }
  }
  const view = createView(sceneModel, {
    objectIds: objectSet,
    meshIds: meshSet,
    transformIds: transformSet,
    geometryIds: new Set<string>(),
    materialIds: new Set<string>(),
    textureIds: new Set<string>()
  });
  if (collapseObjects && chunkMeshes.length > 0) {
    view.objects = {
      [`${spec.id}/object`]: {
        id: `${spec.id}/object`,
        originalSystemId: `${spec.id}/object`,
        layerId: spec.id,
        meshes: chunkMeshes
      }
    };
  }
  return view;
}

function createView(sceneModel: SceneModel, ids: {
  objectIds: Set<string>;
  meshIds: Set<string>;
  transformIds: Set<string>;
  geometryIds: Set<string>;
  materialIds: Set<string>;
  textureIds: Set<string>;
}): any {
  return {
    id: sceneModel.id,
    scene: sceneModel.scene,
    coordinateSystem: sceneModel.coordinateSystem,
    coordinateSystemMatrix: sceneModel.coordinateSystemMatrix,
    objects: pick(sceneModel.objects, ids.objectIds),
    meshes: pick(sceneModel.meshes, ids.meshIds),
    transforms: pick((sceneModel as any).transforms || {}, ids.transformIds),
    geometries: pick(sceneModel.geometries, ids.geometryIds),
    materials: pick(sceneModel.materials, ids.materialIds),
    textures: pick(sceneModel.textures, ids.textureIds)
  };
}

function collectAssetIds(sceneModel: SceneModel, objectIds: string[]): {
  geometries: Set<string>;
  materials: Set<string>;
  textures: Set<string>;
} {
  const geometries = new Set<string>();
  const materials = new Set<string>();
  const textures = new Set<string>();
  for (const objectId of objectIds) {
    const object = sceneModel.objects[objectId];
    if (!object) {
      continue;
    }
    for (const mesh of object.meshes) {
      geometries.add(mesh.geometry.id);
      if (mesh.material) {
        materials.add(mesh.material.id);
        addMaterialTextureIds(mesh.material, textures);
      }
    }
  }
  return {geometries, materials, textures};
}

function includeMaterialTextures(sceneModel: SceneModel, ids: {
  materials: Set<string>;
  textures: Set<string>;
}): void {
  for (const materialId of ids.materials) {
    const material = sceneModel.materials[materialId];
    if (material) {
      addMaterialTextureIds(material, ids.textures);
    }
  }
}

function addMaterialTextureIds(material: SceneMaterial, textures: Set<string>): void {
  addTextureId(textures, material.colorTexture);
  addTextureId(textures, material.metallicRoughnessTexture);
  addTextureId(textures, material.normalsTexture);
  addTextureId(textures, material.occlusionTexture);
  addTextureId(textures, material.emissiveTexture);
}

function addTextureId(textures: Set<string>, texture?: SceneTexture): void {
  if (texture) {
    textures.add(texture.id);
  }
}

function addTransformAncestors(transformIds: Set<string>, transform: any): void {
  for (let current = transform; current; current = current.parentTransform) {
    transformIds.add(current.id);
  }
}

function addIds(target: Set<string>, ids?: string[]): void {
  if (!ids) {
    return;
  }
  for (const id of ids) {
    target.add(id);
  }
}

function pick<T>(source: Record<string, T>, ids: Set<string>): Record<string, T> {
  const result: Record<string, T> = {};
  for (const id of ids) {
    if (source[id]) {
      result[id] = source[id];
    }
  }
  return result;
}

function dependenciesForChunk(
  spec: XGFStreamingChunkExportSpec,
  assetLibraries: XGFAssetLibraryExportSpec[],
  librarySpecsById: Record<string, XGFAssetLibraryExportSpec>
): XGFChunkDependency[] {
  if (spec.dependencies) {
    return spec.dependencies.slice();
  }
  const librarySpecs = spec.assetLibraryIds
    ? spec.assetLibraryIds.map(id => librarySpecsById[id]).filter(Boolean)
    : assetLibraries;
  return librarySpecs.map(library => ({id: library.id, uri: library.uri}));
}

function aggregateManifestAABB(manifests: Array<{ aabb?: number[] }>): number[] | undefined {
  let aabb: number[] | undefined;
  for (const manifest of manifests) {
    if (!manifest.aabb) {
      continue;
    }
    if (!aabb) {
      aabb = manifest.aabb.slice();
      continue;
    }
    aabb[0] = Math.min(aabb[0], manifest.aabb[0]);
    aabb[1] = Math.min(aabb[1], manifest.aabb[1]);
    aabb[2] = Math.min(aabb[2], manifest.aabb[2]);
    aabb[3] = Math.max(aabb[3], manifest.aabb[3]);
    aabb[4] = Math.max(aabb[4], manifest.aabb[4]);
    aabb[5] = Math.max(aabb[5], manifest.aabb[5]);
  }
  return aabb;
}

function invalid<T>(error: string): SDKResult<T> {
  return {
    ok: false,
    type: SDKErrorType.InvalidInput,
    error
  };
}
