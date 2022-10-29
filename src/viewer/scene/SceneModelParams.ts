import {FloatArrayType} from "../math/math";

/**
 * {@link SceneModel} creation parameters for {@link Scene.createModel}.
 */
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
    matrix?: FloatArrayType;

    /**
     * Scale of the SceneModel.
     *
     * Default is ````[1,1,1]````.
     */
    scale?: FloatArrayType;

    /**
     * Quaternion defining the orientation of the SceneModel.
     */
    quaternion?: FloatArrayType;

    /**
     * Orientation of the SceneModel, given as Euler angles in degrees for X, Y and Z axis.
     */
    rotation?: FloatArrayType;

    /**
     * World-space position of the SceneModel.
     */
    position?: FloatArrayType;

    /**
     * RTC coordinate origin for the SceneModel.
     *
     * Default is ````[0, 0, 0]````.
     */
    origin?: FloatArrayType;
}