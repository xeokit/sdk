
import {FloatArrayParam} from "@xeokit/math/math";

/**
 * {@link @xeokit/core/components!SceneModel | SceneModel} creation parameters for {@link Viewer.createModel}.
 */
export interface ViewerModelParams {

    /**
     * Unique ID for the ViewerModel.
     *
     * The ViewerModel is stored with this ID in {@link Viewer.viewerModels}
     */
    id?: string;

    /**
     * Whether quality rendering is enabled for the ViewerModel.
     *
     * Default is ````true````.
     */
 //   qualityRender: boolean;

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

    /**
     * RTC coordinate origin for the ViewerModel.
     *
     * Default is ````[0, 0, 0]````.
     */
    origin?: FloatArrayParam;

    /**
     * Causes each {@link @xeokit/viewer!View} to put {@link ViewObject | ViewObjects} for the new {@link @xeokit/core/components!SceneModel | SceneModel}
     * into a {@link ViewLayer} with this ID.
     *
     * Each View will create the ViewLayer first, if required.
     *
     * Overridden by {@link ObjectParams.viewLayerId}.
     */
    viewLayerId?: string;
}