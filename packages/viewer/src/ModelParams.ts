
import type {FloatArrayParam} from "@xeokit/math/math";

/**
 * {@link @xeokit/core/components!SceneModel | SceneModel} creation parameters for {@link Scene.createModel}.
 */
export interface ModelParams {

    /**
     * Unique ID for the SceneModel.
     *
     * The SceneModel is stored with this ID in {@link Scene.models | Scene.models}
     */
    id: string;

    /**
     * 4x4 transform matrix.
     */
    matrix?: FloatArrayParam;

    /**
     * Scale of the SceneModel.
     *
     * Default is ````[1,1,1]````.
     */
    scale?: FloatArrayParam;

    /**
     * Quaternion defining the orientation of the SceneModel.
     */
    quaternion?: FloatArrayParam;

    /**
     * Orientation of the SceneModel, given as Euler angles in degrees for X, Y and Z axis.
     */
    rotation?: FloatArrayParam;

    /**
     * World-space position of the SceneModel.
     */
    position?: FloatArrayParam;

    /**
     * Optional ID of the {@link @xeokit/viewer!ViewLayer | ViewLayer} this SceneModel appears in.
     */
    readonly viewLayerId?: string;
}