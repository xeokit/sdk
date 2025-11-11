
import {FloatArrayParam} from "../math";

/**
 * Parameters for a {@link SceneTransform}.
 *
 * * Passed to  {@link SceneModel.createTransform | SceneModel.createTransform}
 * * Located at {@link SceneModelParams.transforms | SceneModelParams.transforms}
 *
 * See {@link scene | @xeokit/sdk/scene} for usage.
 */
export class SceneTransformParams {

    /**
     * Unique ID of this SceneTransform.
     */
    id: string;

    /**
     * A flat 4x4 matrix that defines the local transform.
     */
    matrix?: FloatArrayParam;

    /**
     * Optional local 3D translation vector.
     */
    position?: FloatArrayParam;

    /**
     * Optional local 3D scale vector.
     */
    scale?: FloatArrayParam;

    /**
     * Optional local 3D rotation quaternion.
     */
    quaternion?: FloatArrayParam;

    /**
     * Optional local 3D rotation as Euler angles in degrees for X, Y and Z axis.
     */
    rotation?: FloatArrayParam;

    /**
     * ID of the parent {@link ViewTransform} that was created previously
     * with {@link SceneModel.createTransform | SceneModel.createTransform}.
     */
    parentTransformId?: string;
}