
import {FloatArrayParam} from "@xeokit/math/math";

/**
 * {@link @xeokit/core/components!Model | Model} creation parameters for {@link Scene.createModel}.
 */
export interface ModelParams {

    /**
     * Unique ID for the ViewerModel.
     *
     * The ViewerModel is stored with this ID in {@link Scene.models}
     */
    id?: string;

    /**
     * 4x4 transform matrix.
     */
    matrix?: FloatArrayParam;

    /**
     * Scale of the ViewerModel.
     *
     * Default is ````[1,1,1]````.
     */
    scale?: FloatArrayParam;

    /**
     * Quaternion defining the orientation of the ViewerModel.
     */
    quaternion?: FloatArrayParam;

    /**
     * Orientation of the ViewerModel, given as Euler angles in degrees for X, Y and Z axis.
     */
    rotation?: FloatArrayParam;

    /**
     * World-space position of the ViewerModel.
     */
    position?: FloatArrayParam;
}