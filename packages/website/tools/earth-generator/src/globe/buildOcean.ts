import type {MeshData} from "../types";
import {lonLatToXYZ, normalize3} from "../geo/lonLatToXYZ";

export function buildOcean(radius: number, segments = 96, rings = 48): MeshData {
  const vertexCount = (rings + 1) * (segments + 1);
  const positions = new Float64Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  let v = 0;
  for (let y = 0; y <= rings; y++) {
    const lat = -90 + 180 * y / rings;
    for (let x = 0; x <= segments; x++) {
      const lon = -180 + 360 * x / segments;
      const p = lonLatToXYZ([lon, lat], radius);
      positions[v * 3] = p[0];
      positions[v * 3 + 1] = p[1];
      positions[v * 3 + 2] = p[2];
      const n = normalize3(...p);
      normals[v * 3] = n[0];
      normals[v * 3 + 1] = n[1];
      normals[v * 3 + 2] = n[2];
      v++;
    }
  }
  const indices = new Uint32Array(rings * segments * 6);
  let k = 0;
  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * (segments + 1) + x;
      const b = a + 1;
      const c = a + segments + 1;
      const d = c + 1;
      indices[k++] = a; indices[k++] = c; indices[k++] = b;
      indices[k++] = b; indices[k++] = c; indices[k++] = d;
    }
  }
  return {id: "earth.ocean", positions, normals, indices, materialId: "earth.ocean"};
}
