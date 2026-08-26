import type {MeshData, Vec2, Vec3} from "../types";
import {MeshBuilder} from "../geometry/MeshBuilder";
import {bbox, scalePolygon} from "../geometry/PolygonUtils";
import {extrudePolygon} from "../geometry/Extrusion";

export type RoofType = "flat" | "gable" | "hip" | "mansard" | "stepped" | "terrace";

export function createRoofMeshes(params: {
  bounds: [number, number, number, number];
  polygon?: Vec2[];
  topZ: number;
  roofType: RoofType;
  roofMaterialId: string;
  trimMaterialId: string;
  equipmentMaterialId: string;
  rng: () => number;
}): MeshData[] {
  const meshes: MeshData[] = [];
  const footprint = params.polygon && params.polygon.length >= 3 ? params.polygon : rectFromBounds(params.bounds);
  const [minX, minY, maxX, maxY] = bbox(footprint);
  const width = maxX - minX;
  const depth = maxY - minY;
  const roof = new MeshBuilder();
  const trim = new MeshBuilder();
  const equipment = new MeshBuilder();

  if (params.roofType === "gable" || params.roofType === "hip") {
    roof.addMesh(extrudePolygon({
      polygon: scalePolygon(footprint, 0.97, 0.97),
      height: 0.22,
      baseZ: params.topZ,
      materialId: params.roofMaterialId
    }));
  } else if (params.roofType === "mansard") {
    roof.addMesh(extrudePolygon({
      polygon: scalePolygon(footprint, 0.94, 0.94),
      height: 2.2,
      baseZ: params.topZ,
      materialId: params.roofMaterialId
    }));
  } else if (params.roofType === "stepped") {
    roof.addMesh(extrudePolygon({
      polygon: scalePolygon(footprint, 0.96, 0.96),
      height: 0.9,
      baseZ: params.topZ,
      materialId: params.roofMaterialId
    }));
    roof.addMesh(extrudePolygon({
      polygon: scalePolygon(footprint, 0.58, 0.54),
      height: 0.7,
      baseZ: params.topZ + 0.9,
      materialId: params.roofMaterialId
    }));
  } else {
    roof.addMesh(extrudePolygon({
      polygon: scalePolygon(footprint, 0.96, 0.96),
      height: 0.16,
      baseZ: params.topZ,
      materialId: params.roofMaterialId
    }));
  }

  const parapetH = params.roofType === "terrace" ? 0.85 : 0.55;
  addEdgeBoxes(trim, footprint, params.topZ + parapetH / 2, parapetH, 0.42);

  if (width > 12 && depth > 12 && params.rng() < 0.74) {
    const count = 1 + Math.floor(params.rng() * 3);
    for (let i = 0; i < count; i++) {
      const x = minX + width * (0.25 + params.rng() * 0.5);
      const y = minY + depth * (0.25 + params.rng() * 0.5);
      equipment.addBox([x, y, params.topZ + parapetH + 0.45], [2.2 + params.rng() * 4.5, 1.4 + params.rng() * 3, 0.9], 0);
    }
  }

  if (params.roofType === "terrace") {
    equipment.addBox([(minX + maxX) / 2, (minY + maxY) / 2, params.topZ + 0.26], [width * 0.34, depth * 0.18, 0.12], 0);
  }

  if (roof.indices.length) {
    meshes.push(roof.toMesh(params.roofMaterialId, "roof"));
  }
  if (trim.indices.length) {
    meshes.push(trim.toMesh(params.trimMaterialId, "roof-parapet"));
  }
  if (equipment.indices.length) {
    meshes.push(equipment.toMesh(params.equipmentMaterialId, "roof-equipment"));
  }
  return meshes;
}

function rectFromBounds(bounds: [number, number, number, number]): Vec2[] {
  const [minX, minY, maxX, maxY] = bounds;
  return [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];
}

function addEdgeBoxes(builder: MeshBuilder, polygon: Vec2[], z: number, height: number, thickness: number): void {
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (length < 2) {
      continue;
    }
    builder.addBox([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z], [length + 0.6, thickness, height], Math.atan2(dy, dx));
  }
}

function createGableRoofMesh(bounds: [number, number, number, number], baseZ: number, height: number, materialId: string): MeshData {
  const [minX, minY, maxX, maxY] = bounds;
  const midY = (minY + maxY) / 2;
  const points: Vec3[] = [
    [minX, minY, baseZ],
    [maxX, minY, baseZ],
    [maxX, maxY, baseZ],
    [minX, maxY, baseZ],
    [minX, midY, baseZ + height],
    [maxX, midY, baseZ + height]
  ];
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const add = (quad: number[]) => {
    const base = positions.length / 3;
    const normal = faceNormal(points[quad[0]], points[quad[1]], points[quad[2]]);
    for (const idx of quad) {
      positions.push(...points[idx]);
      normals.push(...normal);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const addTri = (tri: number[]) => {
    const base = positions.length / 3;
    const normal = faceNormal(points[tri[0]], points[tri[1]], points[tri[2]]);
    for (const idx of tri) {
      positions.push(...points[idx]);
      normals.push(...normal);
    }
    indices.push(base, base + 1, base + 2);
  };
  add([0, 1, 5, 4]);
  add([3, 4, 5, 2]);
  addTri([0, 4, 3]);
  addTri([1, 2, 5]);
  return {materialId, positions, normals, indices};
}

function faceNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}
