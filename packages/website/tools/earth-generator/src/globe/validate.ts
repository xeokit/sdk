import type {LineData, MeshData} from "../types";

export function validateMeshes(meshes: MeshData[], landRadius: number, tileDegrees: number): void {
  let triangles = 0;
  const maxChord = 2 * landRadius * Math.sin((Math.max(tileDegrees * 2.5, 2) * Math.PI / 180) / 2);
  for (const mesh of meshes) {
    if (mesh.indices.length % 3 !== 0) throw new Error(`${mesh.id}: triangle index count is not divisible by 3`);
    if (mesh.indices.length === 0) continue;
    const vertexCount = mesh.positions.length / 3;
    for (let i = 0; i < mesh.positions.length; i++) {
      if (!Number.isFinite(mesh.positions[i])) throw new Error(`${mesh.id}: non-finite position at ${i}`);
    }
    for (const index of mesh.indices) {
      if (index >= vertexCount) throw new Error(`${mesh.id}: index ${index} out of range ${vertexCount}`);
    }
    for (let i = 0; i + 2 < mesh.indices.length; i += 3) {
      triangles++;
      const a = mesh.indices[i], b = mesh.indices[i + 1], c = mesh.indices[i + 2];
      const sign = windingSign(mesh.positions, a, b, c);
      if (sign < -1e-3) {
        throw new Error(`${mesh.id}: inward triangle winding at triangle ${i / 3}`);
      }
      const ab = dist(mesh.positions, a, b);
      const bc = dist(mesh.positions, b, c);
      const ca = dist(mesh.positions, c, a);
      if (Math.max(ab, bc, ca) > maxChord && !mesh.id.includes("ocean")) {
        throw new Error(`${mesh.id}: absurd triangle chord length ${Math.max(ab, bc, ca).toFixed(3)}`);
      }
    }
    if (!mesh.id.includes("ocean") && !mesh.id.includes("water")) {
      for (let i = 0; i < vertexCount; i++) {
        const r = Math.hypot(mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]);
        if (Math.abs(r - landRadius) > 0.25) throw new Error(`${mesh.id}: vertex radius ${r} differs from ${landRadius}`);
      }
    }
  }
  if (triangles <= 0) throw new Error("Generated triangle count is zero");
}

export function validateLines(lines: LineData[]): void {
  for (const line of lines) {
    const vertexCount = line.positions.length / 3;
    for (let i = 0; i < line.positions.length; i++) {
      if (!Number.isFinite(line.positions[i])) throw new Error(`${line.id}: non-finite position at ${i}`);
    }
    for (const index of line.indices) {
      if (index >= vertexCount) throw new Error(`${line.id}: line index ${index} out of range ${vertexCount}`);
    }
  }
}

function dist(p: Float64Array, ia: number, ib: number): number {
  const ax = p[ia * 3], ay = p[ia * 3 + 1], az = p[ia * 3 + 2];
  const bx = p[ib * 3], by = p[ib * 3 + 1], bz = p[ib * 3 + 2];
  return Math.hypot(bx - ax, by - ay, bz - az);
}

function windingSign(p: Float64Array, ia: number, ib: number, ic: number): number {
  const ax = p[ia * 3], ay = p[ia * 3 + 1], az = p[ia * 3 + 2];
  const bx = p[ib * 3], by = p[ib * 3 + 1], bz = p[ib * 3 + 2];
  const cx = p[ic * 3], cy = p[ic * 3 + 1], cz = p[ic * 3 + 2];
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx - ax, acy = cy - ay, acz = cz - az;
  return (aby * acz - abz * acy) * ((ax + bx + cx) / 3)
    + (abz * acx - abx * acz) * ((ay + by + cy) / 3)
    + (abx * acy - aby * acx) * ((az + bz + cz) / 3);
}
