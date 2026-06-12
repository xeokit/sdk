import type {Mat4} from "../../../base/math/matrix";
import type {Vec3} from "../../../base/math/vector";
import type {TransformControlsSpace} from "../TransformControlsSpace";

const X_AXIS: Vec3 = [1, 0, 0];
const Y_AXIS: Vec3 = [0, 1, 0];
const Z_AXIS: Vec3 = [0, 0, 1];

/**
 * Resolves an axis label (`"X"`/`"Y"`/`"Z"`) to a world-space direction.
 *
 * In `"world"` space the canonical axis is returned as-is; in `"local"`
 * space it is rotated by the target's world rotation (`rotationWorld`, the
 * rotation part of a column-major Mat4). Unknown labels yield `[0,0,0]`.
 */
export function axisFromLabel(label: string, space: TransformControlsSpace, rotationWorld: Mat4): Vec3 {
  let base: Vec3;
  switch (label) {
    case "X": base = X_AXIS; break;
    case "Y": base = Y_AXIS; break;
    case "Z": base = Z_AXIS; break;
    default: return [0, 0, 0];
  }
  if (space === "world") return [base[0], base[1], base[2]];
  const r = rotationWorld;
  return [
    r[0] * base[0] + r[4] * base[1] + r[8]  * base[2],
    r[1] * base[0] + r[5] * base[1] + r[9]  * base[2],
    r[2] * base[0] + r[6] * base[1] + r[10] * base[2],
  ];
}
