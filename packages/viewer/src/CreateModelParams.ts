import type {FloatArrayParam} from "@xeokit/math/math";
import {SceneModel} from "@xeokit/scene";



/**
 * {@link @xeokit/scene!SceneModel | SceneModel} creation parameters for {@link Scene.createModel}.
 */
export interface CreateModelParams {

    /**
     * Unique ID for the SceneModel.
     *
     * The SceneModel is stored with this ID in {@link Scene.models | Scene.models}
     */
    id: string;

    /**
     * The SceneMode to add.
     */
    sceneModel: SceneModel;

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
    viewLayerId?: string;
}