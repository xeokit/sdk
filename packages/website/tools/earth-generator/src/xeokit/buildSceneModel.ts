import {LinesPrimitive, TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {Scene} from "@xeokit/sdk/model/scene";
import type {LineData, MeshData} from "../types";

const EARTH_COORDINATE_SYSTEM = {
  basis: [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ],
  origin: [0, 0, 0],
  units: "meters" as const,
  scaleToMeters: 1
};

export function buildSceneModel(meshes: MeshData[], lines: LineData[]) {
  const scene = new Scene({coordinateSystem: EARTH_COORDINATE_SYSTEM, logging: false});
  const sceneModel = must(scene.createModel({
    id: "earth",
    coordinateSystem: EARTH_COORDINATE_SYSTEM,
    updateHint: "static"
  }));

  must(sceneModel.createMaterial({id: "earth.land", color: [0.24, 0.31, 0.18], roughness: 1.0, metallic: 0}));
  must(sceneModel.createMaterial({id: "earth.water", color: [0.01, 0.09, 0.22], roughness: 0.35, metallic: 0}));
  must(sceneModel.createMaterial({id: "earth.ocean", color: [0.01, 0.08, 0.18], roughness: 0.18, metallic: 0}));
  must(sceneModel.createMaterial({id: "earth.countryRegion", color: [0.38, 0.46, 0.28], roughness: 0.9, metallic: 0}));
  must(sceneModel.createMaterial({id: "earth.neutralTerritory", color: [0.28, 0.30, 0.27], roughness: 0.95, metallic: 0}));
  must(sceneModel.createMaterial({id: "earth.coastline", color: [0.86, 0.84, 0.76], roughness: 0.85, metallic: 0}));
  must(sceneModel.createMaterial({id: "earth.countryBoundary", color: [0.95, 0.82, 0.48], roughness: 0.85, metallic: 0}));

  let ordinal = 0;
  for (const mesh of splitMeshes(meshes)) {
    const geometryId = `${mesh.id}.geometry.${String(ordinal).padStart(5, "0")}`;
    const meshId = `${mesh.id}.mesh.${String(ordinal).padStart(5, "0")}`;
    must(sceneModel.createGeometry({
      id: geometryId,
      primitive: TrianglesPrimitive,
      positions: mesh.positions,
      normals: mesh.normals,
      indices: mesh.indices
    }));
    must(sceneModel.createMesh({id: meshId, geometryId, materialId: mesh.materialId}));
    must(sceneModel.createObject({
      id: mesh.id === "earth.ocean" ? "earth.ocean" : `${mesh.id}.part.${String(ordinal).padStart(5, "0")}`,
      meshIds: [meshId],
      ...(mesh.layerId ? {layerId: mesh.layerId} : {})
    }));
    ordinal++;
  }

  for (const line of lines) {
    const geometryId = `${line.id}.geometry`;
    const meshId = `${line.id}.mesh`;
    must(sceneModel.createGeometry({
      id: geometryId,
      primitive: LinesPrimitive,
      positions: line.positions,
      indices: line.indices
    }));
    must(sceneModel.createMesh({id: meshId, geometryId, materialId: line.materialId}));
    must(sceneModel.createObject({
      id: line.id,
      meshIds: [meshId],
      ...(line.layerId ? {layerId: line.layerId} : {})
    }));
  }

  return {scene, sceneModel, coordinateSystem: EARTH_COORDINATE_SYSTEM};
}

function splitMeshes(meshes: MeshData[]): MeshData[] {
  const out: MeshData[] = [];
  for (const mesh of meshes) {
    if (mesh.positions.length / 3 <= 300_000 && mesh.indices.length / 3 <= 180_000) {
      out.push(mesh);
      continue;
    }
    let positions: number[] = [];
    let normals: number[] = [];
    let indices: number[] = [];
    let map = new Map<number, number>();
    let part = 0;
    const flush = () => {
      if (indices.length === 0) return;
      out.push({
        id: `${mesh.id}.split.${String(part++).padStart(3, "0")}`,
        positions: Float64Array.from(positions),
        normals: Float32Array.from(normals),
        indices: Uint32Array.from(indices),
        materialId: mesh.materialId,
        layerId: mesh.layerId
      });
      positions = [];
      normals = [];
      indices = [];
      map = new Map();
    };
    for (let i = 0; i + 2 < mesh.indices.length; i += 3) {
      const tri = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]];
      let needed = 0;
      for (const ix of tri) if (!map.has(ix)) needed++;
      if (indices.length > 0 && ((positions.length / 3) + needed > 300_000 || (indices.length / 3) + 1 > 180_000)) {
        flush();
      }
      for (const ix of tri) {
        let mapped = map.get(ix);
        if (mapped === undefined) {
          mapped = positions.length / 3;
          map.set(ix, mapped);
          positions.push(mesh.positions[ix * 3], mesh.positions[ix * 3 + 1], mesh.positions[ix * 3 + 2]);
          normals.push(mesh.normals[ix * 3], mesh.normals[ix * 3 + 1], mesh.normals[ix * 3 + 2]);
        }
        indices.push(mapped);
      }
    }
    flush();
  }
  return out;
}

function must<T>(result: {ok: boolean; value?: T; error?: string}): T {
  if (!result.ok) throw new Error(result.error || "xeokit operation failed");
  return result.value as T;
}
