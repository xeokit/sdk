import type {SceneRaycaster} from "../../../spatial/collision";
import type {ModelNavigationController} from "../model";

/**
 * Configures {@link WalkNavigationController}.
 */
export interface WalkNavigationControllerParams {
    /**
     * Whether the controller starts active.
     *
     * Default is ``true``.
     */
    active?: boolean;

    /**
     * Optional raycaster used for floor following and obstacle tests.
     *
     * When omitted, the controller creates a {@link SceneRaycaster} for the
     * View's Scene.
     */
    raycaster?: SceneRaycaster;

    /**
     * Optional standard ModelNavigationController to suspend while walk navigation is active.
     *
     * Use this when enabling walk navigation inside Viewer/Studio applications
     * that already have the default camera controller installed.
     */
    suspendModelNavigationController?: ModelNavigationController;

    /**
     * Camera height above the walked surface, in world-space units.
     *
     * Default is ``1.7``.
     */
    eyeHeight?: number;

    /**
     * Approximate body radius used for horizontal obstacle tests.
     *
     * Default is ``0.28``.
     */
    bodyRadius?: number;

    /**
     * Normal walking speed, in world-space units per second.
     *
     * Default is ``4``.
     */
    walkSpeed?: number;

    /**
     * Walking speed while holding Shift, in world-space units per second.
     *
     * Default is ``8.5``.
     */
    runSpeed?: number;

    /**
     * Maximum height that the controller can step up onto.
     *
     * Default is ``0.35``.
     */
    stepHeight?: number;

    /**
     * Maximum drop that the controller will snap down to while floor following.
     * Larger unsupported drops become an actual fall.
     *
     * Default is ``1.5``.
     */
    maxFall?: number;

    /**
     * Downward acceleration while falling, in world-space units per second squared.
     *
     * Default is ``9.8``.
     */
    fallAcceleration?: number;

    /**
     * Maximum downward falling speed, in world-space units per second.
     *
     * Default is ``30``.
     */
    maxFallSpeed?: number;

    /**
     * Maximum walkable surface slope, in degrees.
     *
     * Default is ``50``.
     */
    maxSlopeDegrees?: number;

    /**
     * Mouse-look sensitivity, in degrees per pointer pixel.
     *
     * Default is ``0.12``.
     */
    mouseLookDegreesPerPixel?: number;

    /**
     * Arrow-key look speed, in degrees per second.
     *
     * Default is ``90``.
     */
    keyboardLookDegreesPerSecond?: number;

    /**
     * Maximum up/down look angle from the horizontal plane, in degrees.
     *
     * Default is ``85``.
     */
    maxPitchDegrees?: number;

    /**
     * Only handle keyboard movement while the pointer is over the View element.
     *
     * Default is ``true``.
     */
    keyboardEnabledOnlyOnMouseover?: boolean;

    /**
     * Enables horizontal obstacle tests.
     *
     * Default is ``true``.
     */
    collision?: boolean;

    /**
     * Enables floor following.
     *
     * Default is ``true``.
     */
    gravity?: boolean;

    /**
     * Optional object filter for horizontal obstacle tests.
     */
    obstacleFilter?: (objectId: string) => boolean;

    /**
     * Optional object filter for floor-following raycasts.
     */
    walkSurfaceFilter?: (objectId: string) => boolean;
}
