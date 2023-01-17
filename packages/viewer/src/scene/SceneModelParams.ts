/**
 * {@link SceneModel} creation parameters for {@link Scene.createModel}.
 */
import {FloatArrayParam} from "@xeokit/math/math";


export interface SceneModelParams {

    /**
     * Unique ID for the SceneModel.
     *
     * The SceneModel is stored with this ID in {@link Scene.sceneModels}
     */
    id?: string;

    /**
     * Whether quality rendering is enabled for the SceneModel.
     *
     * Default is ````true````.
     */
    qualityRender: boolean;

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
     * RTC coordinate origin for the SceneModel.
     *
     * Default is ````[0, 0, 0]````.
     */
    origin?: FloatArrayParam;

    /**
     * Causes each {@link View} to put {@link ViewObject|ViewObjects} for the new {@link SceneModel}
     * into a {@link ViewLayer} with this ID.
     *
     * Each View will create the ViewLayer first, if required.
     *
     * Overridden by {@link SceneObjectParams.viewLayerId}.
     */
    viewLayerId?: string;
}