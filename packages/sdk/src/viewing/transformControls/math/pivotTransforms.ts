import {createMat4Float64, identityMat4, type Mat4, mulMat4, translationMat4v} from "../../../base/math/matrix";
import {angleAxisToQuaternion, type Quat, quatToMat4} from "../../../base/math/quat";
import type {Vec3} from "../../../base/math/vector";

/**
 * Builds the world-space "rotate around pivot" transform
 *
 *   T = T(pivot) × R(axis, angle) × T(-pivot)
 *
 * Applying `T` to a point rotates it by `angle` (radians) about `axis`
 * with `pivot` held fixed as the centre of rotation.
 */
export function composeRotateAroundPivot(axis: Vec3, angle: number, pivot: Vec3): Mat4 {
  const q = angleAxisToQuaternion([axis[0], axis[1], axis[2], angle], [0, 0, 0, 1] as Quat);
  const R = quatToMat4(q, identityMat4(createMat4Float64()));
  const Tneg = translationMat4v([-pivot[0], -pivot[1], -pivot[2]]);
  const Tpos = translationMat4v(pivot);
  const tmp = createMat4Float64();
  mulMat4(R, Tneg, tmp);
  const T = createMat4Float64();
  mulMat4(Tpos, tmp, T);
  return T;
}

/**
 * Builds the world-space "scale around pivot" transform
 *
 *   T = T(pivot) × S(scale) × T(-pivot)
 *
 * Applying `T` to a point scales it per-axis by `scale` with `pivot`
 * held fixed as the scale origin.
 */
export function composeScaleAroundPivot(scale: Vec3, pivot: Vec3): Mat4 {
  const S = identityMat4(createMat4Float64());
  S[0] = scale[0]; S[5] = scale[1]; S[10] = scale[2];
  const Tneg = translationMat4v([-pivot[0], -pivot[1], -pivot[2]]);
  const Tpos = translationMat4v(pivot);
  const tmp = createMat4Float64();
  mulMat4(S, Tneg, tmp);
  const T = createMat4Float64();
  mulMat4(Tpos, tmp, T);
  return T;
}
