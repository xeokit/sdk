import {composeMat4, eulerToQuat, identityMat4, identityQuat} from "@xeokit/matrix";
import {FloatArrayParam} from "@xeokit/math";

const identityQuaternion = identityQuat();

/**
 * Helper function to build 4x4 transform matrices.
 *
 * @param params
 */
export function buildMat4(params: {
    quaternion?: FloatArrayParam;
    rotation?: FloatArrayParam;
    scale?: FloatArrayParam;
    position?: FloatArrayParam;

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
