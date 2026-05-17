import {eulerToQuat, identityQuat, type Quat} from "../../base/math/quat";
import {composeMat4, identityMat4} from "../../base/math/matrix";
import {type Vec3Float} from "../../base/math/vector"

const identityQuaternion = identityQuat();

/**
 * Helper function to build a 4x4 transformation matrix from position, scale, and rotation or quaternion.
 *
 * @param params - Transformation parameters.
 * @param params.position - Optional translation as [x, y, z].
 * @param params.scale - Optional scale as [x, y, z].
 * @param params.rotation - Optional Euler rotation as [x, y, z] in radians.
 * @param params.quaternion - Optional quaternion rotation as [x, y, z, w].
 * @returns The resulting 4x4 transformation matrix.
 */
export function buildMat4(params: {
  quaternion?: Quat;
  rotation?: Vec3Float;
  scale?: Vec3Float;
  position?: Vec3Float;

}) {
  const matrix = identityMat4();
  const position = params.position;
  const scale = params.scale;
  const rotation = params.rotation;
  const quaternion = params.quaternion;
  if (position || scale || rotation || quaternion) {
    composeMat4(
      position || [0, 0, 0],
      quaternion || (rotation
        ? eulerToQuat(rotation, "XYZ", identityQuat())
        : identityQuaternion),
      scale || [1, 1, 1],
      matrix);
  }
  return matrix;
}
