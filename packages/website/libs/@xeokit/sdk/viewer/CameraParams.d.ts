import { FloatArrayParam } from "../math";
import { PerspectiveProjectionParams } from "./PerspectiveProjectionParams";
import { OrthoProjectionParams } from "./OrthoProjectionParams";
import { FrustumProjectionParams } from "./FrustumProjectionParams";
import { CustomProjectionParams } from "./CustomProjectionParams";
/**
 * Parameters for a {@link Camera}.
 *
 * * Returned by {@link Camera.toParams | Camera.toParams}
 * * Passed to {@link Camera.fromParams | Camera.fromParams}
 * * Located at {@link ViewParams.camera | ViewParams.camera}
 */
export interface CameraParams {
    /**
     * @internal
     */
    deviceMatrix?: FloatArrayParam;
    /**
     * The 3D position of the {@link Camera | Camera's} viewpoint.
     *
     * Default value is ````[0, 0, -10]````.
     */
    eye?: FloatArrayParam;
    /**
     * The 3D point that the {@link Camera} is looking at.
     *
     * Default value is ````[0, 0, 0]````.
     */
    look?: FloatArrayParam;
    /**
     * 3D vector indicating the {@link Camera | Camera's} upwards direction.
     *
     * Default value is ````[0, 1, 0]````.
     */
    up?: FloatArrayParam;
    /**
     * The up, right and forward axis of the {@link Camera | Camera's} World coordinate system.
     *
     * Has format: ````[rightX, rightY, rightZ, upX, upY, upZ, forwardX, forwardY, forwardZ]````.
     *
     * Default value is ````[1, 0, 0, 0, 1, 0, 0, 0, 1]````.
     */
    worldAxis?: FloatArrayParam;
    /**
     * Whether to lock the {@link Camera | Camera's} yaw rotation to pivot about the World-space "up" axis.
     *
     * Default value is `true`.
     */
    gimbalLock?: boolean;
    /**
     * Whether to prevent the {@link Camera} from being pitched upside down.
     *
     * The Camera is upside down when the angle between {@link Camera.up | Camera.up} and {@link Camera.worldUp} is less than one degree.
     *
     * Default value is ````false````.
     */
    constrainPitch?: boolean;
    /**
     * The {@link Camera | Camera's} active projection type.
     *
     * Possible values are {@link constants!PerspectiveProjectionType | PerspectiveProjectionType},
     * {@link constants!OrthoProjectionType | OrthoProjectionType},
     * {@link constants!FrustumProjectionType | FrustumProjectionType} and {@link constants!CustomProjectionType | CustomProjectionType}.
     *
     * Default value is {@link constants!PerspectiveProjectionType | PerspectiveProjectionType}.
     *
     * @returns {number} Identifies the active projection type.
     */
    projectionType?: number;
    /**
     * Parameters for the {@link PerspectiveProjection} at {@link Camera.perspectiveProjection | Camera.perspectiveProjection}.
     */
    perspectiveProjection?: PerspectiveProjectionParams;
    /**
     * Parameters for the {@link OrthoProjection} at {@link Camera.orthoProjection | Camera.orthoProjection}.
     */
    orthoProjection?: OrthoProjectionParams;
    /**
     * Parameters for the {@link FrustumProjection} at {@link Camera.frustumProjection | Camera.frutsumProjection}.
     */
    frustumProjection?: FrustumProjectionParams;
    /**
     * Parameters for the {@link CustomProjection} at {@link Camera.customProjection | Camera.customProjection}.
     */
    customProjection?: CustomProjectionParams;
}
//# sourceMappingURL=CameraParams.d.ts.map