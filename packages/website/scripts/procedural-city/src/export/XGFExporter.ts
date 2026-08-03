import fs from "node:fs/promises";
import path from "node:path";
import type {CityScene, MeshData} from "../types";
import {Scene} from "../../../../../sdk/src/model/scene/Scene";
import {TrianglesPrimitive} from "../../../../../sdk/src/base/constants";
import {XGFExporter as SDKXGFExporter} from "../../../../../sdk/src/formats/xgf/XGFExporter";
import {XGFStreamExporter as SDKXGFStreamExporter} from "../../../../../sdk/src/formats/xgfstream/XGFStreamExporter";

const MAX_GEOMETRY_NORMAL_COMPONENTS = 900_000;
const MAX_GEOMETRY_TRIANGLES = 180_000;

const Z_UP_COORDINATE_SYSTEM = {
  basis: [
    1, 0, 0,
    0, 0, 1,
    0, 1, 0
  ],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

export interface XGFStreamExportResult {
  outputDir: string;
  fileCount: number;
  chunkCount: number;
}

export async function exportXGF(cityScene: CityScene, options: {outputPath: string}): Promise<void> {
  const {sceneModel} = buildSceneModel(cityScene);
  await fs.mkdir(path.dirname(options.outputPath), {recursive: true});
  const fileData = await new SDKXGFExporter().write({sceneModel}, {
    coordinateSystem: Z_UP_COORDINATE_SYSTEM,
    yieldIntervalMs: 80
  });
  await fs.writeFile(options.outputPath, Buffer.from(fileData));
  await writeCoordSys(sidecarDirectory(options.outputPath));
}

export async function exportXGFStream(cityScene: CityScene, options: {
  outputDir: string;
  chunkBudget?: number;
  minChunkBudget?: number;
  gridCellSize?: number;
}): Promise<XGFStreamExportResult> {
  const {sceneModel} = buildSceneModel(cityScene);
  await fs.rm(options.outputDir, {recursive: true, force: true});
  await fs.mkdir(options.outputDir, {recursive: true});

  const stream = await new SDKXGFStreamExporter().write({sceneModel}, {
    coordinateSystem: Z_UP_COORDINATE_SYSTEM,
    partition: "grid",
    chunkMetric: "meshes",
    chunkBudget: options.chunkBudget ?? 420,
    minChunkBudget: options.minChunkBudget ?? 120,
    gridCellSize: options.gridCellSize ?? 260,
    index: "index.json",
    runtimeIndex: "index.runtime.json",
    assetId: `${cityScene.id}-assets`,
    assetLibraryChunkSize: 16,
    sharedAssetMinLibraryUses: 1000000,
    yieldIntervalMs: 80
  });

  for (const [uri, fileData] of Object.entries(stream.files)) {
    const filePath = path.join(options.outputDir, uri);
    await fs.mkdir(path.dirname(filePath), {recursive: true});
    if (fileData instanceof ArrayBuffer) {
      await fs.writeFile(filePath, Buffer.from(fileData));
    } else if (ArrayBuffer.isView(fileData)) {
      await fs.writeFile(filePath, Buffer.from(fileData.buffer, fileData.byteOffset, fileData.byteLength));
    } else {
      await fs.writeFile(filePath, `${JSON.stringify(fileData, null, 2)}\n`, "utf8");
    }
  }

  await writeCoordSys(sidecarDirectoryForStream(options.outputDir));
  return {
    outputDir: options.outputDir,
    fileCount: Object.keys(stream.files).length,
    chunkCount: stream.manifests.filter((manifest: any) => manifest.role !== "asset-library").length
  };
}

function buildSceneModel(cityScene: CityScene): {scene: Scene; sceneModel: any} {
  const scene = new Scene({coordinateSystem: Z_UP_COORDINATE_SYSTEM, logging: false});
  const sceneModel = must(scene.createModel({
    id: cityScene.id,
    coordinateSystem: Z_UP_COORDINATE_SYSTEM,
    updateHint: "static"
  }));

  for (const material of cityScene.materials) {
    must(sceneModel.createMaterial({
      id: material.id,
      color: material.color,
      opacity: material.opacity ?? 1,
      roughness: material.roughness ?? 0.8,
      metallic: material.metallic ?? 0,
      alphaMode: material.alphaMode
    }));
  }

  let meshOrdinal = 0;
  for (const object of cityScene.objects) {
    const meshIds: string[] = [];
    for (const mesh of object.meshes) {
      for (const meshPart of splitOversizedMesh(mesh)) {
        if (!meshPart || meshPart.indices.length === 0 || meshPart.positions.length === 0) {
          continue;
        }
        const geometryId = `${object.id}-geometry-${meshOrdinal}`;
        const meshId = `${object.id}-mesh-${meshOrdinal}`;
        createGeometry(sceneModel, geometryId, meshPart);
        must(sceneModel.createMesh({
          id: meshId,
          geometryId,
          materialId: meshPart.materialId
        }));
        meshIds.push(meshId);
        meshOrdinal++;
      }
    }
    if (meshIds.length === 0) {
      continue;
    }
    must(sceneModel.createObject({
      id: object.id,
      name: object.name,
      meshIds,
      layerId: object.layerId,
      originalSystemId: object.id
    }));
  }
  return {scene, sceneModel};
}

function sidecarDirectory(outputPath: string): string {
  const parent = path.dirname(outputPath);
  return path.basename(parent) === "xgf" ? path.dirname(parent) : parent;
}

function sidecarDirectoryForStream(outputDir: string): string {
  return path.basename(outputDir) === "xgfstream" ? path.dirname(outputDir) : outputDir;
}

async function writeCoordSys(directory: string): Promise<void> {
  await fs.mkdir(directory, {recursive: true});
  await fs.writeFile(path.join(directory, "coordSys.json"), `${JSON.stringify(Z_UP_COORDINATE_SYSTEM, null, 2)}\n`);
}

function createGeometry(sceneModel: any, geometryId: string, mesh: MeshData): void {
  must(sceneModel.createGeometry({
    id: geometryId,
    primitive: TrianglesPrimitive,
    positions: mesh.positions,
    normals: mesh.normals,
    indices: mesh.indices
  }));
}

function splitOversizedMesh(mesh: MeshData): MeshData[] {
  if (!mesh
    || (mesh.normals.length <= MAX_GEOMETRY_NORMAL_COMPONENTS
      && mesh.indices.length <= MAX_GEOMETRY_TRIANGLES * 3)) {
    return [mesh];
  }
  const maxVertices = Math.floor(MAX_GEOMETRY_NORMAL_COMPONENTS / 3);
  const parts: MeshData[] = [];
  let positions: number[] = [];
  let normals: number[] = [];
  let indices: number[] = [];
  let vertexMap = new Map<number, number>();

  const flush = () => {
    if (indices.length === 0) {
      return;
    }
    const suffix = parts.length.toString().padStart(3, "0");
    parts.push({
      id: mesh.id ? `${mesh.id}-${suffix}` : undefined,
      materialId: mesh.materialId,
      positions,
      normals,
      indices
    });
    positions = [];
    normals = [];
    indices = [];
    vertexMap = new Map();
  };

  for (let i = 0; i + 2 < mesh.indices.length; i += 3) {
    const tri = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]];
    let requiredVertices = 0;
    for (const index of tri) {
      if (!vertexMap.has(index)) {
        requiredVertices++;
      }
    }
    if (indices.length > 0
      && ((positions.length / 3) + requiredVertices > maxVertices
        || (indices.length / 3) + 1 > MAX_GEOMETRY_TRIANGLES)) {
      flush();
    }
    for (const index of tri) {
      let mappedIndex = vertexMap.get(index);
      if (mappedIndex === undefined) {
        mappedIndex = positions.length / 3;
        vertexMap.set(index, mappedIndex);
        const src = index * 3;
        positions.push(mesh.positions[src] ?? 0, mesh.positions[src + 1] ?? 0, mesh.positions[src + 2] ?? 0);
        normals.push(mesh.normals[src] ?? 0, mesh.normals[src + 1] ?? 0, mesh.normals[src + 2] ?? 1);
      }
      indices.push(mappedIndex);
    }
  }
  flush();
  return parts;
}

function must<T>(result: {ok: boolean; value?: T; error?: string}): T {
  if (!result.ok) {
    throw new Error(result.error || "xeokit operation failed");
  }
  return result.value as T;
}
