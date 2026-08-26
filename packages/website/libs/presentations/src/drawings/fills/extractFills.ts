/**
 * Per-source-object filled-polygon extraction for the wireframe
 * projector. Consumes an {@link HLEDepthBuffer} built with
 * `withOwners`, walks the parallel owner buffer once per source
 * SceneObject, traces the binary visibility mask via marching
 * squares, simplifies the contour with Douglas-Peucker, classifies
 * outer-vs-hole topology, and triangulates with earcut. The
 * returned positions live on the projection plane in world space —
 * one filled polygon set per source SceneObject that has at least
 * one frontmost pixel in the depth buffer.
 *
 * Both the wireframe edges and these fills are derived from the
 * same depth buffer, so their pixel-accurate boundaries coincide:
 * the wireframe sits exactly on the fill silhouette, no halo at
 * occlusion edges.
 *
 * @module studio/systems/drawings/extractFills
 */
import {earcut} from "@xeokit/sdk/formats/cityjson/versions/v1_0/earcut";
import {
  douglasPeuckerClosed2D,
  marchingSquares2D,
  pointInPolygon2D,
  polygonSignedArea2D,
  type Point2D,
} from "@xeokit/sdk/base/math/polygon2D";

import type {HLEDepthBuffer} from "../hle/HLEDepthBuffer";
import type {FillPolygons} from "./FillPolygons";
import type {ExtractFillsOptions} from "./ExtractFillsOptions";




/**
 * Extract filled-polygon geometry, one per source SceneMesh
 * that contributed at least one frontmost pixel to `buffer`.
 *
 * @param buffer Depth buffer built with `withOwners: true`.
 * @param planeDepth Basis-space d-coordinate of the projection
 *   plane (i.e. `dot(planePoint, buffer.basis.forward)`). The
 *   orchestrator computes this from the AABB extent along
 *   `basis.forward` plus the user-supplied offset, and the
 *   extractor uses it to lift each pixel back to a 3D world
 *   point on the plane.
 * @param options Tuning parameters.
 */
export function extractFills(
  buffer: HLEDepthBuffer,
  planeDepth: number,
  options: ExtractFillsOptions = {},
): FillPolygons[] {
  const owners         = buffer.owners;
  const ownerMeshIds   = buffer.ownerMeshIds;
  const ownerObjectIds = buffer.ownerObjectIds;
  if (!owners || !ownerMeshIds || !ownerObjectIds) {
    throw new Error(
      "[extractFills] HLEDepthBuffer was built without owner tracking. " +
      "Pass `withOwners: true` to buildHLEDepthBuffer.",
    );
  }
  const minPixelArea     = Math.max(0, options.minPixelArea     ?? 4);
  const simplifyEpsilon  = Math.max(0, options.simplifyEpsilon  ?? 0.25);

  const {width: W, height: H, uMin, uMax, vMin, vMax, basis} = buffer;
  const dU = uMax - uMin;
  const dV = vMax - vMin;
  const right   = basis.right;
  const upAxis  = basis.up;
  const forward = basis.forward;
  // Pre-multiply forward by the constant plane-depth — every
  // emitted vertex's depth contribution is the same, so the
  // multiplication only needs doing once per call.
  const fx = forward[0] * planeDepth;
  const fy = forward[1] * planeDepth;
  const fz = forward[2] * planeDepth;

  // Histogram pass — pixel count per owner, so a single pass
  // tells us which owners to bother extracting. Skipping owners
  // under the minimum-area threshold here saves both the
  // per-owner mask allocation and the marching-squares walk.
  const pixelCounts = new Int32Array(ownerMeshIds.length);
  for (let i = 0, len = owners.length; i < len; i++) {
    const owner = owners[i];
    if (owner >= 0) pixelCounts[owner]++;
  }

  const out: FillPolygons[] = [];
  // Scratch mask reused for each owner — Uint8 is plenty for a
  // binary 0/1 buffer and is fast to memset.
  const mask = new Uint8Array(W * H);

  for (let ownerIndex = 0; ownerIndex < ownerMeshIds.length; ownerIndex++) {
    if (pixelCounts[ownerIndex] < minPixelArea) continue;

    mask.fill(0);
    for (let i = 0, len = owners.length; i < len; i++) {
      if (owners[i] === ownerIndex) mask[i] = 1;
    }

    // Trace closed contours along the 0/1 boundary in pixel space.
    const loops = marchingSquares2D(mask, W, H);
    if (loops.length === 0) continue;

    // Classify each loop as outer (1-region inside) or hole
    // (0-region inside) by signed shoelace area. The marching-
    // squares table walks every ring with the 1-region on the
    // LEFT — in *image-y-down* coordinates (pixel y grows
    // downward), that walk produces a NEGATIVE shoelace area
    // for outer rings of 1-regions and a POSITIVE area for
    // holes. (Same walk in math-y-up convention flips signs, so
    // the more familiar "positive area = CCW = outer" rule is
    // not what applies here.) We store absolute areas so the
    // containment-by-smallest-enclosing-outer pass works
    // sign-agnostically.
    const outers: Array<{points: Point2D[]; area: number}> = [];
    const holes:  Array<{points: Point2D[]; area: number}> = [];
    for (const raw of loops) {
      const simplified = simplifyEpsilon > 0
        ? douglasPeuckerClosed2D(raw, simplifyEpsilon)
        : raw.slice();
      if (simplified.length < 3) continue;
      const signedArea = polygonSignedArea2D(simplified);
      if (signedArea < 0) outers.push({points: simplified, area: -signedArea});
      else if (signedArea > 0) holes.push({points: simplified, area: signedArea});
    }
    if (outers.length === 0) continue;

    // Group each hole under its smallest containing outer. For
    // a single outer (the common case for BIM objects whose
    // projection is one connected blob), every hole pairs with
    // that outer and the containment test is skipped.
    const holeAssignments: number[][] = outers.map(() => []);
    if (outers.length === 1) {
      for (let h = 0; h < holes.length; h++) holeAssignments[0].push(h);
    } else {
      for (let h = 0; h < holes.length; h++) {
        const probe = holes[h].points[0];
        let bestOuter = -1;
        let bestArea = Infinity;
        for (let o = 0; o < outers.length; o++) {
          if (outers[o].area >= bestArea) continue;
          if (pointInPolygon2D(probe, outers[o].points)) {
            bestOuter = o;
            bestArea = outers[o].area;
          }
        }
        if (bestOuter >= 0) holeAssignments[bestOuter].push(h);
      }
    }

    // Triangulate each outer + its holes via earcut, mapping
    // pixel coordinates to world coordinates on the projection
    // plane as we build the position buffer.
    const positions: number[] = [];
    const indices:   number[] = [];
    for (let o = 0; o < outers.length; o++) {
      const ring = outers[o].points;
      const myHoles = holeAssignments[o];

      // Flat 2D coords for earcut, in pixel space. World mapping
      // is order-preserving and affine, so triangulating in
      // pixel space and remapping is equivalent to triangulating
      // in world space — and pixel-space avoids the precision
      // tax of the (potentially very large) world coords.
      const flat: number[] = [];
      const holeIndices: number[] = [];
      for (const p of ring) flat.push(p[0], p[1]);
      for (const hi of myHoles) {
        holeIndices.push(flat.length / 2);
        for (const p of holes[hi].points) flat.push(p[0], p[1]);
      }

      const tris = earcut(flat, holeIndices.length > 0 ? holeIndices : undefined, 2);
      if (tris.length === 0) continue;

      // Emit world-space positions. Each pixel (px, py) lifts to
      // basis-space (u, v, planeDepth), then to world via
      // `u*right + v*up + planeDepth*forward`. The depth-axis
      // contribution `planeDepth*forward` is pre-computed into
      // (fx, fy, fz) above so each vertex only pays for the
      // u- and v-axis multiply-adds.
      const base = positions.length / 3;
      for (let i = 0; i < flat.length; i += 2) {
        const px = flat[i];
        const py = flat[i + 1];
        const u = uMin + (px / W) * dU;
        const v = vMin + (py / H) * dV;
        positions.push(
          u * right[0] + v * upAxis[0] + fx,
          u * right[1] + v * upAxis[1] + fy,
          u * right[2] + v * upAxis[2] + fz,
        );
      }
      for (let i = 0; i < tris.length; i++) indices.push(base + tris[i]);
    }

    if (indices.length === 0) continue;
    out.push({
      sourceObjectId: ownerObjectIds[ownerIndex],
      sourceMeshId:   ownerMeshIds[ownerIndex],
      positions,
      indices,
    });
  }

  return out;
}

