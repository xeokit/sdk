/**
 * Hand-rolled mesh builders for the RVM primitive types that aren't
 * covered by `procgen`. Each function returns positions / normals /
 * indices in the same shape `procgen` does, so the v2 parser can feed
 * them straight into a `SceneGeometry`.
 *
 * The math here is the standard parametric form for each primitive,
 * matching the conventions used by AVEVA tooling and the open-source
 * pmuc / rvmparser readers:
 *
 *   - Pyramid    — 4-sided frustum (top can be offset / smaller)
 *   - RectTorus  — rectangular cross-section swept around Z
 *   - CircTorus  — circular cross-section swept around Z (donut)
 *   - SpherDish  — spherical cap (vessel head)
 *   - EllipDish  — ellipsoidal cap (vessel head)
 *   - FacetGroup — polygon soup; convex contours fan-triangulated
 *
 * @internal
 */

export interface BuiltMesh {
  positions: Float32Array;
  normals:   Float32Array;
  indices:   Uint32Array;
}

const TAU = Math.PI * 2;

/* ─────────────────────────────────────────────────────────────────────
 * Pyramid (frustum) — 7 floats:
 *   bottomX, bottomY, topX, topY, offsetX, offsetY, height
 *
 * Bottom rectangle of (bottomX × bottomY) at z = -height/2, top
 * rectangle of (topX × topY) at z = +height/2 shifted by
 * (offsetX, offsetY). 6 faces, 12 triangles. Per-face normals (no
 * smoothing — a pyramid's edges are creases).
 * ──────────────────────────────────────────────────────────────────── */
export function buildPyramid(
  bottomX: number, bottomY: number,
  topX: number, topY: number,
  offsetX: number, offsetY: number,
  height: number
): BuiltMesh {
  const hx = bottomX * 0.5, hy = bottomY * 0.5;
  const tx = topX    * 0.5, ty = topY    * 0.5;
  const z0 = -height * 0.5, z1 = height * 0.5;
  const ox = offsetX,        oy = offsetY;

  // 8 unique corner positions. We expand to 24 vertices (4 per face)
  // so each face can carry its own normal.
  const b0 = [-hx, -hy, z0], b1 = [ hx, -hy, z0];
  const b2 = [ hx,  hy, z0], b3 = [-hx,  hy, z0];
  const t0 = [-tx + ox, -ty + oy, z1], t1 = [ tx + ox, -ty + oy, z1];
  const t2 = [ tx + ox,  ty + oy, z1], t3 = [-tx + ox,  ty + oy, z1];

  const faces = [
    // Each entry: [v0, v1, v2, v3] (CCW from outside)
    [b3, b2, b1, b0],   // bottom — normal -Z
    [t0, t1, t2, t3],   // top    — normal +Z
    [b0, b1, t1, t0],   // -Y face
    [b1, b2, t2, t1],   // +X face
    [b2, b3, t3, t2],   // +Y face
    [b3, b0, t0, t3]    // -X face
  ];

  const positions: number[] = [];
  const normals:   number[] = [];
  const indices:   number[] = [];

  for (const face of faces) {
    const [v0, v1, v2, v3] = face;
    const u = sub3(v1, v0), w = sub3(v3, v0);
    const n = norm3(cross3(u, w));
    const base = positions.length / 3;
    for (const v of face) {
      positions.push(v[0], v[1], v[2]);
      normals.push(n[0], n[1], n[2]);
    }
    indices.push(base, base + 1, base + 2,  base, base + 2, base + 3);
  }

  return finalize(positions, normals, indices);
}

/* ─────────────────────────────────────────────────────────────────────
 * Rectangular torus — 4 floats:
 *   innerRadius, outerRadius, height, sweepAngle
 *
 * A rectangular cross-section (width = outer-inner, height = height,
 * centred on the sweep plane) revolved around the local Z axis from
 * 0 to sweepAngle. Sweep is closed when sweepAngle ≥ 2π — caller
 * doesn't need to special-case.
 * ──────────────────────────────────────────────────────────────────── */
export function buildRectTorus(
  innerRadius: number, outerRadius: number,
  height: number, sweepAngle: number
): BuiltMesh {
  const segments = Math.max(8, Math.ceil(sweepAngle * 16 / TAU));
  const closed = sweepAngle >= TAU - 1e-4;
  const halfH = height * 0.5;

  const positions: number[] = [];
  const normals:   number[] = [];
  const indices:   number[] = [];

  // Cross-section corners (in r/z space): [outer-bottom, outer-top,
  // inner-top, inner-bottom]. Each gets its own normal so adjacent
  // faces don't share smooth normals.
  const corners = [
    { r: outerRadius, z: -halfH, n: [+1, 0, 0] }, // 0
    { r: outerRadius, z: +halfH, n: [+1, 0, 0] }, // 1
    { r: outerRadius, z: +halfH, n: [ 0, 0,+1] }, // 2
    { r: innerRadius, z: +halfH, n: [ 0, 0,+1] }, // 3
    { r: innerRadius, z: +halfH, n: [-1, 0, 0] }, // 4
    { r: innerRadius, z: -halfH, n: [-1, 0, 0] }, // 5
    { r: innerRadius, z: -halfH, n: [ 0, 0,-1] }, // 6
    { r: outerRadius, z: -halfH, n: [ 0, 0,-1] }  // 7
  ];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = sweepAngle * t;
    const cosA = Math.cos(a), sinA = Math.sin(a);
    for (const c of corners) {
      positions.push(c.r * cosA, c.r * sinA, c.z);
      // Rotate the cross-section normal around Z by the same angle.
      const nx = c.n[0] * cosA - c.n[1] * sinA;
      const ny = c.n[0] * sinA + c.n[1] * cosA;
      normals.push(nx, ny, c.n[2]);
    }
  }

  // Each pair of adjacent rings forms 4 outward-facing quads.
  const ringSize = corners.length;
  for (let i = 0; i < segments; i++) {
    const a = i * ringSize, b = (i + 1) * ringSize;
    for (const k of [0, 2, 4, 6]) {
      // (k, k+1) is the radial edge of one face on the cross-section.
      const v0 = a + k, v1 = a + k + 1, v2 = b + k + 1, v3 = b + k;
      indices.push(v0, v1, v2,  v0, v2, v3);
    }
  }

  // Open caps when not a full revolution.
  if (!closed) {
    const startBase = positions.length / 3;
    pushCapRect(positions, normals, indices, 0,           innerRadius, outerRadius, -halfH, halfH, true);
    const endBase = positions.length / 3;
    pushCapRect(positions, normals, indices, sweepAngle,  innerRadius, outerRadius, -halfH, halfH, false);
    void startBase; void endBase;
  }

  return finalize(positions, normals, indices);
}

/* ─────────────────────────────────────────────────────────────────────
 * Circular torus — 3 floats:
 *   innerRadius (= sweep major radius)
 *   sweepRadius (= tube minor radius)
 *   sweepAngle
 *
 * Standard donut. Caller's note: AVEVA names the major/minor radii
 * inversely to the math convention — "inner" is the centre-line
 * radius, not the hole radius.
 * ──────────────────────────────────────────────────────────────────── */
export function buildCircTorus(
  centreRadius: number, tubeRadius: number,
  sweepAngle: number
): BuiltMesh {
  const sweepSegments = Math.max(8, Math.ceil(sweepAngle * 32 / TAU));
  const tubeSegments = 24;
  const closed = sweepAngle >= TAU - 1e-4;

  const positions: number[] = [];
  const normals:   number[] = [];
  const indices:   number[] = [];

  for (let i = 0; i <= sweepSegments; i++) {
    const u = sweepAngle * (i / sweepSegments);
    const cosU = Math.cos(u), sinU = Math.sin(u);
    for (let j = 0; j <= tubeSegments; j++) {
      const v = TAU * (j / tubeSegments);
      const cosV = Math.cos(v), sinV = Math.sin(v);
      const r = centreRadius + tubeRadius * cosV;
      positions.push(r * cosU, r * sinU, tubeRadius * sinV);
      // Normal is along the cross-section radial direction in world
      // space — outward from the centre-line circle.
      normals.push(cosV * cosU, cosV * sinU, sinV);
    }
  }

  const stride = tubeSegments + 1;
  for (let i = 0; i < sweepSegments; i++) {
    for (let j = 0; j < tubeSegments; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, b, d,  a, d, c);
    }
  }

  if (!closed) {
    pushCapCircle(positions, normals, indices, 0,          centreRadius, tubeRadius, tubeSegments, true);
    pushCapCircle(positions, normals, indices, sweepAngle, centreRadius, tubeRadius, tubeSegments, false);
  }

  return finalize(positions, normals, indices);
}

/* ─────────────────────────────────────────────────────────────────────
 * Spherical dish — 2 floats:
 *   baseRadius, height (the dish bulges from the equator plane up by
 *                       `height` along +Z).
 *
 * For a true hemisphere, height == baseRadius. If height < baseRadius
 * the dish is shallower; height > baseRadius is unusual but valid.
 * ──────────────────────────────────────────────────────────────────── */
export function buildSpherDish(baseRadius: number, height: number): BuiltMesh {
  // Sphere centre lies at z = height - sphereRadius; sphereRadius
  // satisfies sphereRadius² = baseRadius² + (sphereRadius-height)².
  const sphereRadius = (baseRadius * baseRadius + height * height) / (2 * height);
  const centreZ = height - sphereRadius;
  const phiMax = Math.asin(baseRadius / sphereRadius); // colatitude at base

  return buildSphericalCap(sphereRadius, centreZ, phiMax);
}

/* ─────────────────────────────────────────────────────────────────────
 * Ellipsoidal dish — 2 floats:
 *   baseRadius, height
 *
 * Ellipsoid with equatorial radius = baseRadius and polar radius
 * = height, taking only the +Z hemisphere.
 * ──────────────────────────────────────────────────────────────────── */
export function buildEllipDish(baseRadius: number, height: number): BuiltMesh {
  const stacks = 12, slices = 24;
  const positions: number[] = [];
  const normals:   number[] = [];
  const indices:   number[] = [];

  for (let i = 0; i <= stacks; i++) {
    const phi = (Math.PI * 0.5) * (i / stacks); // 0 at top, π/2 at base
    const cosP = Math.cos(phi), sinP = Math.sin(phi);
    for (let j = 0; j <= slices; j++) {
      const theta = TAU * (j / slices);
      const cosT = Math.cos(theta), sinT = Math.sin(theta);
      const x = baseRadius * sinP * cosT;
      const y = baseRadius * sinP * sinT;
      const z = height     * cosP;
      positions.push(x, y, z);
      // Ellipsoid normal: (x/a², y/b², z/c²) normalised. a=b=baseRadius, c=height.
      const nx = x / (baseRadius * baseRadius);
      const ny = y / (baseRadius * baseRadius);
      const nz = z / (height * height);
      const n = norm3([nx, ny, nz]);
      normals.push(n[0], n[1], n[2]);
    }
  }

  const stride = slices + 1;
  for (let i = 0; i < stacks; i++) {
    for (let j = 0; j < slices; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, b, d,  a, d, c);
    }
  }

  return finalize(positions, normals, indices);
}

/* ─────────────────────────────────────────────────────────────────────
 * Facet group — variable payload:
 *   uint32 polygonCount
 *   for each polygon:
 *     uint32 contourCount
 *     for each contour:
 *       uint32 vertexCount
 *       for each vertex:
 *         3 floats position
 *         3 floats normal
 *
 * Plant data uses convex outer contours plus optional convex hole
 * contours. We fan-triangulate the outer contour and ignore holes —
 * good enough for visualisation; correct hole-handling needs a real
 * triangulator.
 * ──────────────────────────────────────────────────────────────────── */
export function buildFacetGroup(
  reader: { readUint32(): number, readFloat32(): number },
  positionScale: number = 1
): BuiltMesh {
  const positions: number[] = [];
  const normals:   number[] = [];
  const indices:   number[] = [];

  const polyCount = reader.readUint32();
  for (let p = 0; p < polyCount; p++) {
    const contourCount = reader.readUint32();
    for (let c = 0; c < contourCount; c++) {
      const vertexCount = reader.readUint32();
      const startIdx = positions.length / 3;
      for (let v = 0; v < vertexCount; v++) {
        const px = reader.readFloat32() * positionScale;
        const py = reader.readFloat32() * positionScale;
        const pz = reader.readFloat32() * positionScale;
        const nx = reader.readFloat32(); // normals are unitless — no scale
        const ny = reader.readFloat32();
        const nz = reader.readFloat32();
        positions.push(px, py, pz);
        normals.push(nx, ny, nz);
      }
      // Fan-triangulate the OUTER contour only. Subsequent contours
      // (c > 0) are typically holes — left as raw vertices in the
      // buffer but not emitted as triangles.
      if (c === 0) {
        for (let i = 1; i < vertexCount - 1; i++) {
          indices.push(startIdx, startIdx + i, startIdx + i + 1);
        }
      }
    }
  }

  return finalize(positions, normals, indices);
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function buildSphericalCap(sphereRadius: number, centreZ: number, phiMax: number): BuiltMesh {
  const stacks = 12, slices = 24;
  const positions: number[] = [];
  const normals:   number[] = [];
  const indices:   number[] = [];

  for (let i = 0; i <= stacks; i++) {
    const phi = phiMax * (i / stacks);
    const cosP = Math.cos(phi), sinP = Math.sin(phi);
    for (let j = 0; j <= slices; j++) {
      const theta = TAU * (j / slices);
      const cosT = Math.cos(theta), sinT = Math.sin(theta);
      const x = sphereRadius * sinP * cosT;
      const y = sphereRadius * sinP * sinT;
      const z = centreZ + sphereRadius * cosP;
      positions.push(x, y, z);
      // Outward sphere normal — (x, y, z-centreZ) / sphereRadius.
      normals.push(sinP * cosT, sinP * sinT, cosP);
    }
  }

  const stride = slices + 1;
  for (let i = 0; i < stacks; i++) {
    for (let j = 0; j < slices; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, b, d,  a, d, c);
    }
  }
  return finalize(positions, normals, indices);
}

function pushCapRect(
  positions: number[], normals: number[], indices: number[],
  angle: number,
  innerR: number, outerR: number,
  zMin: number, zMax: number,
  isStart: boolean
): void {
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  const base = positions.length / 3;
  // Cap normal points along the cross-section's perpendicular direction
  // — sign flips between start and end caps so each faces outward.
  const sign = isStart ? -1 : +1;
  const nx = -sinA * sign, ny = cosA * sign, nz = 0;
  const corners: [number, number][] = [
    [outerR, zMin], [outerR, zMax],
    [innerR, zMax], [innerR, zMin]
  ];
  for (const [r, z] of corners) {
    positions.push(r * cosA, r * sinA, z);
    normals.push(nx, ny, nz);
  }
  if (isStart) {
    indices.push(base, base + 1, base + 2,  base, base + 2, base + 3);
  } else {
    indices.push(base, base + 2, base + 1,  base, base + 3, base + 2);
  }
}

function pushCapCircle(
  positions: number[], normals: number[], indices: number[],
  angle: number, centreRadius: number, tubeRadius: number,
  tubeSegments: number, isStart: boolean
): void {
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  const sign = isStart ? -1 : +1;
  const nx = -sinA * sign, ny = cosA * sign, nz = 0;
  const centreIdx = positions.length / 3;
  positions.push(centreRadius * cosA, centreRadius * sinA, 0);
  normals.push(nx, ny, nz);
  const ringStart = positions.length / 3;
  for (let j = 0; j <= tubeSegments; j++) {
    const v = TAU * (j / tubeSegments);
    const cosV = Math.cos(v), sinV = Math.sin(v);
    const r = centreRadius + tubeRadius * cosV;
    positions.push(r * cosA, r * sinA, tubeRadius * sinV);
    normals.push(nx, ny, nz);
  }
  for (let j = 0; j < tubeSegments; j++) {
    if (isStart) {
      indices.push(centreIdx, ringStart + j + 1, ringStart + j);
    } else {
      indices.push(centreIdx, ringStart + j, ringStart + j + 1);
    }
  }
}

function finalize(positions: number[], normals: number[], indices: number[]): BuiltMesh {
  return {
    positions: new Float32Array(positions),
    normals:   new Float32Array(normals),
    indices:   new Uint32Array(indices)
  };
}

function sub3(a: number[], b: number[]): number[] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross3(a: number[], b: number[]): number[] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function norm3(v: number[]): number[] {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}
