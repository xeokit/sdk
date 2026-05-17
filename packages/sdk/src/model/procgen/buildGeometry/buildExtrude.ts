import type {GeometryArrays} from "./GeometryArrays";
import {TrianglesPrimitive} from "../../../base/constants";
import {SDKErrorType, type SDKResult} from "../../../base/core";

/**
 * Sweep a 2D polygon cross-section along a 3D centreline path,
 * producing extruded geometry.
 *
 * Useful for beams, mouldings, conduit, gutters, parapets, stair
 * stringers — anything with a constant cross-section along a curve.
 *
 * The cross-section lies in the plane perpendicular to the path's
 * tangent at each path vertex. The local frame `(N, B)` is computed
 * via parallel transport along the path so the cross-section doesn't
 * twist between vertices.
 *
 * ## Conventions
 *
 *   - **`shape`** is a flat array `[x0, y0, x1, y1, ...]` defining
 *     the cross-section in its local plane. List vertices CCW (viewed
 *     from `+T`) so face normals point outward. For closed shapes the
 *     last vertex implicitly connects back to the first — don't
 *     repeat the first vertex.
 *   - **`path`** is a flat array `[x0, y0, z0, x1, y1, z1, ...]`
 *     defining the 3D centreline.
 *   - **`closedShape`** (default `true`) controls whether the
 *     cross-section closes into a loop. Open shapes produce a swept
 *     strip and never get caps.
 *   - **`closedPath`** (default `false`) controls whether the path
 *     itself closes into a loop. Closed paths skip caps.
 *   - **`caps`** (default `true`) fills the start and end with the
 *     cross-section polygon when both `closedShape` is `true` and
 *     `closedPath` is `false`. The cap triangulation is a simple fan
 *     from vertex 0; convex shapes work, non-convex shapes produce
 *     overlapping triangles and should not be capped via this builder.
 *
 * Sharp corners on the path bevel the cross-section (the per-vertex
 * tangent averages the incoming and outgoing edge directions); for
 * cleaner mitres pre-process the path to insert duplicated vertices
 * at the corners with the desired offset.
 *
 * ## Usage
 *
 * ```javascript
 * // 0.2 × 0.2 square beam swept along an L-bend in the XY plane.
 * const result = buildExtrude({
 *   shape: [-0.1, -0.1,  0.1, -0.1,  0.1, 0.1,  -0.1, 0.1],
 *   path:  [0, 0, 0,  1, 0, 0,  1, 1, 0]
 * });
 * if (result.ok) {
 *   const geometry = result.value;
 *   // Pass to sceneModel.createGeometry(...)
 * } else {
 *   console.error("Error creating extrusion:", result.error);
 * }
 * ```
 *
 * @param cfg Configuration for the extrusion.
 * @param cfg.shape Cross-section polygon, flat `[x0, y0, x1, y1, ...]`.
 *   Must contain at least 3 vertices (length ≥ 6, even).
 * @param cfg.path Centreline, flat `[x0, y0, z0, x1, y1, z1, ...]`.
 *   Must contain at least 2 vertices (length ≥ 6, multiple of 3).
 * @param [cfg.closedShape=true] Whether the cross-section is a closed loop.
 * @param [cfg.closedPath=false] Whether the path closes into a loop.
 * @param [cfg.caps=true] Whether to fill the start/end with the cross-section.
 *   Only applied when `closedShape && !closedPath`.
 * @returns Geometry arrays for the extrusion, or an error.
 */
export function buildExtrude(cfg: {
  shape: number[];
  path: number[];
  closedShape?: boolean;
  closedPath?: boolean;
  caps?: boolean;
}): SDKResult<GeometryArrays> {
  const shape = cfg.shape;
  const path  = cfg.path;
  const closedShape = cfg.closedShape ?? true;
  const closedPath  = cfg.closedPath  ?? false;
  const wantCaps    = (cfg.caps ?? true) && closedShape && !closedPath;

  if (!shape || shape.length < 6 || shape.length % 2 !== 0) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildExtrude] shape must be a flat 2D polygon with at least 3 vertices (length >= 6, even)."
    };
  }
  if (!path || path.length < 6 || path.length % 3 !== 0) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildExtrude] path must be a flat 3D polyline with at least 2 vertices (length >= 6, multiple of 3)."
    };
  }

  const shapeCount = shape.length / 2;
  const pathCount  = path.length / 3;

  // ── Path tangents per vertex.
  // Average incoming and outgoing edge directions for interior
  // vertices; use the single adjacent edge at endpoints (open path).
  const tangents = new Float32Array(pathCount * 3);
  for (let i = 0; i < pathCount; i++) {
    let dx = 0, dy = 0, dz = 0;
    const iNext = i < pathCount - 1 ? i + 1 : (closedPath ? 0 : -1);
    if (iNext >= 0) {
      dx += path[iNext * 3]     - path[i * 3];
      dy += path[iNext * 3 + 1] - path[i * 3 + 1];
      dz += path[iNext * 3 + 2] - path[i * 3 + 2];
    }
    const iPrev = i > 0 ? i - 1 : (closedPath ? pathCount - 1 : -1);
    if (iPrev >= 0) {
      dx += path[i * 3]     - path[iPrev * 3];
      dy += path[i * 3 + 1] - path[iPrev * 3 + 1];
      dz += path[i * 3 + 2] - path[iPrev * 3 + 2];
    }
    const len = Math.hypot(dx, dy, dz) || 1;
    tangents[i * 3]     = dx / len;
    tangents[i * 3 + 1] = dy / len;
    tangents[i * 3 + 2] = dz / len;
  }

  // ── Frame at vertex 0.
  // Pick an arbitrary up vector that's not nearly parallel to T0.
  const T0x = tangents[0], T0y = tangents[1], T0z = tangents[2];
  let upX = 0, upY = 1, upZ = 0;
  if (Math.abs(T0x * upX + T0y * upY + T0z * upZ) > 0.95) {
    upX = 1; upY = 0; upZ = 0;
  }
  const dotUp0 = T0x * upX + T0y * upY + T0z * upZ;
  let N0x = upX - T0x * dotUp0;
  let N0y = upY - T0y * dotUp0;
  let N0z = upZ - T0z * dotUp0;
  const n0Len = Math.hypot(N0x, N0y, N0z) || 1;
  N0x /= n0Len; N0y /= n0Len; N0z /= n0Len;

  const Ns = new Float32Array(pathCount * 3);
  const Bs = new Float32Array(pathCount * 3);
  Ns[0] = N0x; Ns[1] = N0y; Ns[2] = N0z;
  Bs[0] = T0y * N0z - T0z * N0y;
  Bs[1] = T0z * N0x - T0x * N0z;
  Bs[2] = T0x * N0y - T0y * N0x;

  // Parallel transport: at each subsequent vertex, project the
  // previous N onto the plane perpendicular to T, renormalise, then
  // re-derive B = T × N.
  for (let i = 1; i < pathCount; i++) {
    const Tx = tangents[i * 3], Ty = tangents[i * 3 + 1], Tz = tangents[i * 3 + 2];
    let Nx = Ns[(i - 1) * 3];
    let Ny = Ns[(i - 1) * 3 + 1];
    let Nz = Ns[(i - 1) * 3 + 2];
    const dotTN = Tx * Nx + Ty * Ny + Tz * Nz;
    Nx -= Tx * dotTN;
    Ny -= Ty * dotTN;
    Nz -= Tz * dotTN;
    const nLen = Math.hypot(Nx, Ny, Nz) || 1;
    Nx /= nLen; Ny /= nLen; Nz /= nLen;
    Ns[i * 3]     = Nx;
    Ns[i * 3 + 1] = Ny;
    Ns[i * 3 + 2] = Nz;
    Bs[i * 3]     = Ty * Nz - Tz * Ny;
    Bs[i * 3 + 1] = Tz * Nx - Tx * Nz;
    Bs[i * 3 + 2] = Tx * Ny - Ty * Nx;
  }

  // ── 2D shape vertex outward normals.
  // For a CCW polygon, the outward perpendicular of edge `[dx, dy]`
  // is `[dy, -dx]`. Per-vertex normal = normalised sum of the two
  // adjacent edges' perpendiculars.
  const shapeNormals = new Float32Array(shapeCount * 2);
  for (let j = 0; j < shapeCount; j++) {
    const jPrev = j > 0 ? j - 1 : (closedShape ? shapeCount - 1 : 0);
    const jNext = j < shapeCount - 1 ? j + 1 : (closedShape ? 0 : shapeCount - 1);
    const eInY  = shape[j * 2 + 1] - shape[jPrev * 2 + 1];
    const eInX  = shape[j * 2]     - shape[jPrev * 2];
    const eOutY = shape[jNext * 2 + 1] - shape[j * 2 + 1];
    const eOutX = shape[jNext * 2]     - shape[j * 2];
    const nx = eInY + eOutY;
    const ny = -(eInX + eOutX);
    const len = Math.hypot(nx, ny) || 1;
    shapeNormals[j * 2]     = nx / len;
    shapeNormals[j * 2 + 1] = ny / len;
  }

  // ── Cumulative shape arc length → U coordinate.
  const shapeUs = new Float32Array(shapeCount);
  let shapePerim = 0;
  shapeUs[0] = 0;
  for (let j = 1; j < shapeCount; j++) {
    const dx = shape[j * 2]     - shape[(j - 1) * 2];
    const dy = shape[j * 2 + 1] - shape[(j - 1) * 2 + 1];
    shapeUs[j] = shapeUs[j - 1] + Math.hypot(dx, dy);
  }
  if (closedShape) {
    const dx = shape[0]                  - shape[(shapeCount - 1) * 2];
    const dy = shape[1]                  - shape[(shapeCount - 1) * 2 + 1];
    shapePerim = shapeUs[shapeCount - 1] + Math.hypot(dx, dy);
  } else {
    shapePerim = shapeUs[shapeCount - 1];
  }
  if (shapePerim === 0) shapePerim = 1;

  // ── Cumulative path arc length → V coordinate.
  const pathVs = new Float32Array(pathCount);
  pathVs[0] = 0;
  for (let i = 1; i < pathCount; i++) {
    const dx = path[i * 3]     - path[(i - 1) * 3];
    const dy = path[i * 3 + 1] - path[(i - 1) * 3 + 1];
    const dz = path[i * 3 + 2] - path[(i - 1) * 3 + 2];
    pathVs[i] = pathVs[i - 1] + Math.hypot(dx, dy, dz);
  }
  let pathLen = pathVs[pathCount - 1];
  if (closedPath) {
    const dx = path[0]                  - path[(pathCount - 1) * 3];
    const dy = path[1]                  - path[(pathCount - 1) * 3 + 1];
    const dz = path[2]                  - path[(pathCount - 1) * 3 + 2];
    pathLen += Math.hypot(dx, dy, dz);
  }
  if (pathLen === 0) pathLen = 1;

  // ── Side vertices: shape × path.
  const positions: number[] = [];
  const normals:   number[] = [];
  const uv:        number[] = [];

  for (let i = 0; i < pathCount; i++) {
    const Px = path[i * 3], Py = path[i * 3 + 1], Pz = path[i * 3 + 2];
    const Nx = Ns[i * 3], Ny = Ns[i * 3 + 1], Nz = Ns[i * 3 + 2];
    const Bx = Bs[i * 3], By = Bs[i * 3 + 1], Bz = Bs[i * 3 + 2];
    const v = pathVs[i] / pathLen;
    for (let j = 0; j < shapeCount; j++) {
      const sx = shape[j * 2];
      const sy = shape[j * 2 + 1];
      positions.push(
        Px + Nx * sx + Bx * sy,
        Py + Ny * sx + By * sy,
        Pz + Nz * sx + Bz * sy
      );
      const sn2x = shapeNormals[j * 2];
      const sn2y = shapeNormals[j * 2 + 1];
      normals.push(
        Nx * sn2x + Bx * sn2y,
        Ny * sn2x + By * sn2y,
        Nz * sn2x + Bz * sn2y
      );
      uv.push(shapeUs[j] / shapePerim, v);
    }
  }

  // ── Side indices.
  const indices: number[] = [];
  const segCountPath  = closedPath  ? pathCount  : pathCount  - 1;
  const segCountShape = closedShape ? shapeCount : shapeCount - 1;
  for (let i = 0; i < segCountPath; i++) {
    const i0 = i;
    const i1 = (i + 1) % pathCount;
    for (let j = 0; j < segCountShape; j++) {
      const j0 = j;
      const j1 = (j + 1) % shapeCount;
      const a = i0 * shapeCount + j0;
      const b = i0 * shapeCount + j1;
      const c = i1 * shapeCount + j1;
      const d = i1 * shapeCount + j0;
      indices.push(a, b, c, a, c, d);
    }
  }

  // ── Caps.
  // Start cap faces -T0; end cap faces +T_{N-1}. Fan triangulation
  // from shape vertex 0; convex shapes only.
  if (wantCaps) {
    // Start cap.
    {
      const baseIdx = positions.length / 3;
      const Px = path[0], Py = path[1], Pz = path[2];
      const Nx = Ns[0], Ny = Ns[1], Nz = Ns[2];
      const Bx = Bs[0], By = Bs[1], Bz = Bs[2];
      const Tx = tangents[0], Ty = tangents[1], Tz = tangents[2];
      for (let j = 0; j < shapeCount; j++) {
        const sx = shape[j * 2];
        const sy = shape[j * 2 + 1];
        positions.push(
          Px + Nx * sx + Bx * sy,
          Py + Ny * sx + By * sy,
          Pz + Nz * sx + Bz * sy
        );
        normals.push(-Tx, -Ty, -Tz);
        // Planar UV in the cross-section plane, mapped to [0..1]
        // assuming shape coordinates roughly fit in that range.
        uv.push(0.5 + sx * 0.5, 0.5 + sy * 0.5);
      }
      // Reverse fan winding so the cap is CCW from the -T side.
      for (let j = 1; j < shapeCount - 1; j++) {
        indices.push(baseIdx, baseIdx + j + 1, baseIdx + j);
      }
    }
    // End cap.
    {
      const last = pathCount - 1;
      const baseIdx = positions.length / 3;
      const Px = path[last * 3], Py = path[last * 3 + 1], Pz = path[last * 3 + 2];
      const Nx = Ns[last * 3], Ny = Ns[last * 3 + 1], Nz = Ns[last * 3 + 2];
      const Bx = Bs[last * 3], By = Bs[last * 3 + 1], Bz = Bs[last * 3 + 2];
      const Tx = tangents[last * 3], Ty = tangents[last * 3 + 1], Tz = tangents[last * 3 + 2];
      for (let j = 0; j < shapeCount; j++) {
        const sx = shape[j * 2];
        const sy = shape[j * 2 + 1];
        positions.push(
          Px + Nx * sx + Bx * sy,
          Py + Ny * sx + By * sy,
          Pz + Nz * sx + Bz * sy
        );
        normals.push(Tx, Ty, Tz);
        uv.push(0.5 + sx * 0.5, 0.5 + sy * 0.5);
      }
      for (let j = 1; j < shapeCount - 1; j++) {
        indices.push(baseIdx, baseIdx + j, baseIdx + j + 1);
      }
    }
  }

  return {
    ok: true,
    value: {
      primitive: TrianglesPrimitive,
      positions,
      normals,
      uv,
      indices
    }
  };
}
