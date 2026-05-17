// Minimal triangle-mesh primitive generators used by the gizmo geometry
// builder.
//
// Every primitive returns flat-shaded per-vertex normals alongside its
// positions / indices. The renderer's lit path uses these to shade the
// faces — without them, every fragment evaluates against a zero normal
// and renders solid black.

export interface PrimitiveMesh {
  positions: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
}

/**
 * Computes flat per-vertex normals from positions + indices: each
 * vertex receives the area-weighted sum of its incident triangle face
 * normals, then re-normalised. For meshes whose vertices aren't shared
 * across faces (like our box / cone / quad generators) this gives true
 * flat shading.
 */
function flatNormals(positions: Float32Array, indices: Uint32Array): Float32Array {
  const out = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i]     * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    const ux = positions[b]     - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c]     - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const ln = Math.hypot(nx, ny, nz) || 1;
    nx /= ln; ny /= ln; nz /= ln;
    out[a]     += nx; out[a + 1] += ny; out[a + 2] += nz;
    out[b]     += nx; out[b + 1] += ny; out[b + 2] += nz;
    out[c]     += nx; out[c + 1] += ny; out[c + 2] += nz;
  }
  for (let i = 0; i < out.length; i += 3) {
    const x = out[i], y = out[i + 1], z = out[i + 2];
    const ln = Math.hypot(x, y, z) || 1;
    out[i] /= ln; out[i + 1] /= ln; out[i + 2] /= ln;
  }
  return out;
}

function pack(positions: Float32Array, indices: Uint32Array): PrimitiveMesh {
  return {positions, indices, normals: flatNormals(positions, indices)};
}

/**
 * Axis-aligned box from (mn) to (mx). 6 quads, 12 triangles.
 */
export function box(mnX: number, mnY: number, mnZ: number,
                    mxX: number, mxY: number, mxZ: number): PrimitiveMesh {
  const positions = new Float32Array([
    mnX, mnY, mnZ,  mnX, mxY, mnZ,  mnX, mxY, mxZ,  mnX, mnY, mxZ,
    mxX, mnY, mxZ,  mxX, mxY, mxZ,  mxX, mxY, mnZ,  mxX, mnY, mnZ,
    mnX, mnY, mnZ,  mnX, mnY, mxZ,  mxX, mnY, mxZ,  mxX, mnY, mnZ,
    mnX, mxY, mxZ,  mnX, mxY, mnZ,  mxX, mxY, mnZ,  mxX, mxY, mxZ,
    mxX, mnY, mnZ,  mxX, mxY, mnZ,  mnX, mxY, mnZ,  mnX, mnY, mnZ,
    mnX, mnY, mxZ,  mnX, mxY, mxZ,  mxX, mxY, mxZ,  mxX, mnY, mxZ,
  ]);
  const indices = new Uint32Array(36);
  for (let face = 0; face < 6; face++) {
    const v = face * 4;
    const i = face * 6;
    indices[i + 0] = v + 0;
    indices[i + 1] = v + 1;
    indices[i + 2] = v + 2;
    indices[i + 3] = v + 0;
    indices[i + 4] = v + 2;
    indices[i + 5] = v + 3;
  }
  return pack(positions, indices);
}

/**
 * Cone with apex at +X = apexX, base circle at +X = baseX with given radius,
 * `segments` sides around the X axis.
 */
export function coneX(baseX: number, apexX: number, radius: number, segments: number): PrimitiveMesh {
  const verts: number[] = [];
  verts.push(apexX, 0, 0);
  for (let s = 0; s < segments; s++) {
    const a = (s / segments) * Math.PI * 2;
    verts.push(baseX, Math.cos(a) * radius, Math.sin(a) * radius);
  }
  verts.push(baseX, 0, 0);
  const positions = new Float32Array(verts);
  const idx: number[] = [];
  const baseCentre = 1 + segments;
  for (let s = 0; s < segments; s++) {
    const a = 1 + s;
    const b = 1 + ((s + 1) % segments);
    idx.push(0, a, b);
    idx.push(baseCentre, b, a);
  }
  return pack(positions, new Uint32Array(idx));
}

/**
 * Torus encircling the X axis (ring in the YZ plane).
 */
export function torusX(R: number, r: number, majorSegs: number, tubeSegs: number): PrimitiveMesh {
  const verts: number[] = [];
  for (let i = 0; i < majorSegs; i++) {
    const u = (i / majorSegs) * Math.PI * 2;
    const cu = Math.cos(u), su = Math.sin(u);
    const cy = R * cu;
    const cz = R * su;
    for (let j = 0; j < tubeSegs; j++) {
      const v = (j / tubeSegs) * Math.PI * 2;
      const cv = Math.cos(v), sv = Math.sin(v);
      verts.push(r * cv, cy + r * sv * cu, cz + r * sv * su);
    }
  }
  const positions = new Float32Array(verts);
  const idx: number[] = [];
  for (let i = 0; i < majorSegs; i++) {
    for (let j = 0; j < tubeSegs; j++) {
      const a = i * tubeSegs + j;
      const b = i * tubeSegs + ((j + 1) % tubeSegs);
      const c = ((i + 1) % majorSegs) * tubeSegs + j;
      const d = ((i + 1) % majorSegs) * tubeSegs + ((j + 1) % tubeSegs);
      idx.push(a, b, d, a, d, c);
    }
  }
  return pack(positions, new Uint32Array(idx));
}

/**
 * Sphere centred at origin. Pickable surrogate for the XYZ free-move /
 * uniform-scale / view-aligned trackball handles.
 */
export function sphere(r: number, segs: number, rings: number): PrimitiveMesh {
  const verts: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const phi = (i / rings) * Math.PI;
    const cp = Math.cos(phi), sp = Math.sin(phi);
    for (let j = 0; j <= segs; j++) {
      const theta = (j / segs) * Math.PI * 2;
      const ct = Math.cos(theta), st = Math.sin(theta);
      verts.push(r * sp * ct, r * cp, r * sp * st);
    }
  }
  const positions = new Float32Array(verts);
  const idx: number[] = [];
  const stride = segs + 1;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  }
  return pack(positions, new Uint32Array(idx));
}

/**
 * Quad in the XY plane.
 */
export function quadXY(mnX: number, mnY: number, mxX: number, mxY: number): PrimitiveMesh {
  const positions = new Float32Array([
    mnX, mnY, 0,  mxX, mnY, 0,  mxX, mxY, 0,  mnX, mxY, 0,
  ]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
  return pack(positions, indices);
}
