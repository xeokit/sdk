
import type {  Vec3} from "../math/vector";
import type { Mat4} from "../math/matrix";
import type { Quat } from "../math/quat";

/**
 * Parameters for {@link ViewTransform}.
 */
export class ViewTransformParams {

    /**
     * Unique ID of this SceneTransform.
     */
    id: string;

    /**
     * A flat 4x4 matrix that defines the local transform.
     */
    matrix?: Mat4;

    /**
     * Optional local 3D translation vector.
     */
    position?: Vec3;

    /**
     * Optional local 3D scale vector.
     */
    scale?: Vec3;

    /**
     * Optional local 3D rotation quaternion.
     */
    quaternion?: Quat;

    /**
     * Optional local 3D rotation as Euler angles in degrees for X, Y and Z axis.
     */
    rotation?: Vec3;

    /**
     * ID of the parent {@link ViewTransform} that was created previously
     * with {@link View.createTransform | View.createTransform}.
     */
    parentTransformId?: string;
}
