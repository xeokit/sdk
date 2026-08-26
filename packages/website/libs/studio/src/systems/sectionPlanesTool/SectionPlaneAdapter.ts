import type {Vec3} from "@xeokit/sdk/base/math/vector";
import {cross3Vec3, dotVec3, normalizeVec3} from "@xeokit/sdk/base/math/vector";
import type {Mat4} from "@xeokit/sdk/base/math/matrix";
import type {SectionPlane} from "@xeokit/sdk/viewing/viewer";


/**
 * Bridges a {@link SectionPlane} to the
 * {@link viewing!transformControls.TransformControls | TransformControls}
 * adapter contract — `{getMatrix, setMatrix}`. The gizmo manipulates a
 * 4×4 world matrix; we synthesise that matrix from the plane's
 * `pos` + `dir` on read, and decompose it back into `pos` + `dir`
 * on write.
 *
 * Matrix convention: the plane's local **+Z** axis equals its
 * `dir` (the side fragments are discarded in). The other two
 * axes (X, Y) span the plane's surface — they're arbitrary
 * (any orthonormal basis on the plane works), so we pick one
 * deterministically by Gram-Schmidt-ing against a fixed
 * world-up vector.
 *
 * In this frame the useful operations are:
 *
 *   - **Translate Z** — slide the plane along its normal.
 *   - **Rotate X / Y** — tilt the plane (re-orient `dir`).
 *
 * Matrix writes are collapsed back to the plane equation. Tangent
 * translations and twists about the normal do not move the finite
 * proxy away from the actual clipping plane.
 */
export class SectionPlaneAdapter {

  constructor(
    public readonly plane: SectionPlane,
    private readonly matrixNormalSign: 1 | -1 = 1,
  ) {}

  /**
   * Build the plane's world matrix from its current `pos`/`dir`.
   * Called by the gizmo at attach-time and whenever it needs to
   * re-read the target's transform (e.g. after external
   * `plane.pos = …`).
   */
  getMatrix(): number[] {
    const out = new Array(16) as unknown as Mat4;
    const dir = this.matrixNormalSign === 1
      ? this.plane.dir
      : ([-this.plane.dir[0], -this.plane.dir[1], -this.plane.dir[2]] as Vec3);
    fillPlaneMatrix(this.plane.pos, dir, out);
    return Array.from(out);
  }

  /**
   * Decompose the gizmo-supplied matrix back into `pos` + `dir`
   * and write through to the section plane. The plane's
   * `dist` recomputes automatically inside the setters.
   */
  setMatrix(m: Float64Array | number[]): void {
    const previousPos: Vec3 = [this.plane.pos[0], this.plane.pos[1], this.plane.pos[2]];
    const previousDir = safeNormalizeVec3(this.plane.dir, [0, 0, -1]);
    const previousMatrixDir: Vec3 = this.matrixNormalSign === 1
      ? previousDir
      : [-previousDir[0], -previousDir[1], -previousDir[2]];
    // Local +Z column (matrix elements [8, 9, 10]) — the plane's
    // new normal. Renormalise so accumulated drag drift doesn't
    // shrink/grow it.
    const dirRaw: Vec3 = [m[8], m[9], m[10]];
    const matrixDir = safeNormalizeVec3(dirRaw, previousMatrixDir);
    const dir: Vec3 = this.matrixNormalSign === 1
      ? matrixDir
      : [-matrixDir[0], -matrixDir[1], -matrixDir[2]];

    // Translation column (matrix elements [12, 13, 14]). Only its
    // component along the plane normal changes the infinite clipping
    // plane. Dropping the tangent component keeps the translucent
    // proxy centered on the same rendered section instead of letting
    // it drift sideways while the slice stays put.
    const rawPos: Vec3 = [m[12], m[13], m[14]];
    const delta: Vec3 = [
      rawPos[0] - previousPos[0],
      rawPos[1] - previousPos[1],
      rawPos[2] - previousPos[2],
    ];
    const slide = dotVec3(delta, dir);
    const pos: Vec3 = [
      previousPos[0] + dir[0] * slide,
      previousPos[1] + dir[1] * slide,
      previousPos[2] + dir[2] * slide,
    ];

    this.plane.dir = dir;
    this.plane.pos = pos;
  }
}


/**
 * Compose a 4×4 column-major matrix whose translation is `pos`
 * and whose local +Z axis is `dir`. The remaining axes (X, Y)
 * form an orthonormal basis spanning the plane's surface.
 *
 * Exposed because the section-planes proxy quad also needs the
 * same matrix to align its visual quad with the plane.
 */
export function fillPlaneMatrix(pos: Vec3, dir: Vec3, out: Mat4): Mat4 {
  // Renormalise the supplied direction — sloppy callers may
  // hand us an unnormalised vector.
  const n: Vec3 = safeNormalizeVec3(dir, [0, 0, -1]);

  // Pick a "tentative up" that's well clear of `n` so the cross
  // product produces a numerically stable tangent. World-Y is
  // the default; fall back to world-X when the normal is too
  // close to Y (otherwise the cross goes to zero).
  const tentativeUp: Vec3 =
    Math.abs(n[1]) > 0.999 ? [1, 0, 0] : [0, 1, 0];

  // X = normalize(tentativeUp × N)
  const x = normalizeVec3(cross3Vec3(tentativeUp, n, [0, 0, 0]));
  // Y = N × X (already unit length when X and N are)
  const y = cross3Vec3(n, x, [0, 0, 0]);

  // Column-major fill: each column is one basis vector.
  out[0]  = x[0]; out[1]  = x[1]; out[2]  = x[2]; out[3]  = 0;
  out[4]  = y[0]; out[5]  = y[1]; out[6]  = y[2]; out[7]  = 0;
  out[8]  = n[0]; out[9]  = n[1]; out[10] = n[2]; out[11] = 0;
  out[12] = pos[0]; out[13] = pos[1]; out[14] = pos[2]; out[15] = 1;

  return out;
}

function safeNormalizeVec3(v: Vec3, fallback: Vec3): Vec3 {
  const x = v[0], y = v[1], z = v[2];
  const len = Math.hypot(x, y, z);
  if (!Number.isFinite(len) || len < 1e-12) {
    return [fallback[0], fallback[1], fallback[2]];
  }
  return [x / len, y / len, z / len];
}
