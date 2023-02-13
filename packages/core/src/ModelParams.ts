
import type {FloatArrayParam} from "@xeokit/math/math";

/**
 * {@link @xeokit/core/components!Model | Model} creation parameters for {@link Scene.createModel}.
 */
export interface ModelParams {

    /**
     * Unique ID for the Model.
     *
     * The Model is stored with this ID in {@link Scene.models | Scene.models}
     */
    id: string;

    /**
     * 4x4 transform matrix.
     */
    matrix?: FloatArrayParam;

    /**
     * Scale of the Model.
     *
     * Default is ````[1,1,1]````.
     */
    scale?: FloatArrayParam;

    /**
     * Quaternion defining the orientation of the Model.
     */
    quaternion?: FloatArrayParam;

    /**
     * Orientation of the Model, given as Euler angles in degrees for X, Y and Z axis.
     */
    rotation?: FloatArrayParam;

    /**
     * World-space position of the Model.
     */
    position?: FloatArrayParam;

    /**
     * Optional ID of the {@link @xeokit/viewer!ViewLayer | ViewLayer} this Model appears in.
     */
    readonly viewLayerId?: string;
}