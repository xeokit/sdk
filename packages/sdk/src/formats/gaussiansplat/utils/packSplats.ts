import {decompressPositions3WithAABB3} from "../../../base/math/compression";
import {computeCovariance3D} from "./computeCovariance3D";
import type {AABB3} from "../../../base/math/boundaries";
import type {FloatArrayParam} from "../../../base/math";

/** Floats per splat in the packed GPU record (4 RGBA32F texels). */
export const SPLAT_FLOATS_PER_ITEM = 16;

/**
 * Source attributes for a gaussian-splat geometry (as stored on a
 * {@link SceneGeometry} with `primitive === GaussianSplatsPrimitive`).
 */
export interface SplatAttributes {
  /** Quantised splat centres (uint16, 3 per splat) + their AABB. */
  positionsCompressed: FloatArrayParam;
  aabb: AABB3;
  /** Per-axis scales (3 per splat). */
  scales: FloatArrayParam;
  /** Rotation quaternions, `xyzw` (4 per splat). */
  rotations: FloatArrayParam;
  /** RGBA bytes 0..255 (4 per splat); white/opaque if omitted. */
  colorsCompressed?: FloatArrayParam;
}

/**
 * Packs splat attributes into the GPU texture record consumed by the splat
 * technique — `SPLAT_FLOATS_PER_ITEM` floats per splat, laid out as 4 RGBA32F
 * texels (matching the validated spike):
 *
 *   texel0: centre.xyz, opacity
 *   texel1: colour.rgb (0..1), meshPickId
 *   texel2: Σxx, Σxy, Σxz, 0     (3D covariance, row a)
 *   texel3: Σyy, Σyz, Σzz, 0     (row b)
 *
 * When `worldMatrix` is given (the splat mesh's world matrix), centres are
 * transformed by it and the covariance by its upper-3×3 (`Σ' = M·Σ·Mᵀ`), so
 * splats sit in world space exactly like mesh geometry — and the model's
 * coordinate system / mesh transform orient them (no renderer-side Y-flip).
 *
 * `meshPickId` tags every splat with its owning mesh's pick id, so the pick
 * pass can draw the whole batch in one instanced call and still resolve which
 * mesh was hit (the colour pass ignores the channel).
 *
 * Pure (no GL) so the decompress + covariance + transform + packing is testable.
 */
export function packSplats(attrs: SplatAttributes, worldMatrix?: FloatArrayParam, meshPickId = 0): Float32Array {
  const count = (attrs.positionsCompressed.length / 3) | 0;
  const centres = decompressPositions3WithAABB3(attrs.positionsCompressed, attrs.aabb);
  const colors = attrs.colorsCompressed;
  const out = new Float32Array(count * SPLAT_FLOATS_PER_ITEM);
  const m = worldMatrix; // column-major Mat4

  for (let i = 0; i < count; i++) {
    let cov = computeCovariance3D(
      [attrs.scales[i * 3], attrs.scales[i * 3 + 1], attrs.scales[i * 3 + 2]],
      [attrs.rotations[i * 4], attrs.rotations[i * 4 + 1], attrs.rotations[i * 4 + 2], attrs.rotations[i * 4 + 3]],
    );
    let cx = centres[i * 3], cy = centres[i * 3 + 1], cz = centres[i * 3 + 2];

    if (m) {
      // Centre: world = M · localCentre (column-major).
      const wx = m[0] * cx + m[4] * cy + m[8]  * cz + m[12];
      const wy = m[1] * cx + m[5] * cy + m[9]  * cz + m[13];
      const wz = m[2] * cx + m[6] * cy + m[10] * cz + m[14];
      cx = wx;
      cy = wy;
      cz = wz;
      cov = transformCovariance(cov, m);
    }

    const o = i * SPLAT_FLOATS_PER_ITEM;
    out[o]     = cx;
    out[o + 1] = cy;
    out[o + 2] = cz;
    out[o + 3] = colors ? colors[i * 4 + 3] / 255 : 1;           // opacity
    out[o + 4] = colors ? colors[i * 4] / 255 : 1;               // r
    out[o + 5] = colors ? colors[i * 4 + 1] / 255 : 1;           // g
    out[o + 6] = colors ? colors[i * 4 + 2] / 255 : 1;           // b
    out[o + 7] = meshPickId;                                     // owning mesh's pick id
    out[o + 8]  = cov[0]; out[o + 9]  = cov[1]; out[o + 10] = cov[2]; out[o + 11] = 0; // Σ row a
    out[o + 12] = cov[3]; out[o + 13] = cov[4]; out[o + 14] = cov[5]; out[o + 15] = 0; // Σ row b
  }
  return out;
}

/**
 * Applies a world matrix's upper-3×3 to a symmetric covariance: `Σ' = M·Σ·Mᵀ`.
 * `cov`/result are `[Σxx, Σxy, Σxz, Σyy, Σyz, Σzz]`; `m` is a column-major Mat4.
 */
function transformCovariance(
  cov: [number, number, number, number, number, number],
  m: FloatArrayParam,
): [number, number, number, number, number, number] {
  // Upper-3×3 rows of M (column-major Mat4 → row r = (m[r], m[4+r], m[8+r])).
  const a = m[0], b = m[4], c = m[8];   // row 0
  const d = m[1], e = m[5], f = m[9];   // row 1
  const g = m[2], h = m[6], i = m[10];  // row 2
  const [sxx, sxy, sxz, syy, syz, szz] = cov;
  // u_r = M_r · Σ  (Σ symmetric, columns = (sxx,sxy,sxz),(sxy,syy,syz),(sxz,syz,szz))
  const u0x = a * sxx + b * sxy + c * sxz, u0y = a * sxy + b * syy + c * syz, u0z = a * sxz + b * syz + c * szz;
  const u1x = d * sxx + e * sxy + f * sxz, u1y = d * sxy + e * syy + f * syz, u1z = d * sxz + e * syz + f * szz;
  const u2x = g * sxx + h * sxy + i * sxz, u2y = g * sxy + h * syy + i * syz, u2z = g * sxz + h * syz + i * szz;
  // Σ'[r][c] = u_r · M_c
  return [
    u0x * a + u0y * b + u0z * c,  // xx
    u0x * d + u0y * e + u0z * f,  // xy
    u0x * g + u0y * h + u0z * i,  // xz
    u1x * d + u1y * e + u1z * f,  // yy
    u1x * g + u1y * h + u1z * i,  // yz
    u2x * g + u2y * h + u2z * i,  // zz
  ];
}
