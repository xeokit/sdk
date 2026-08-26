import type {ModelNavigationController} from "../model";

/**
 * Configures {@link GlobeNavigationController}.
 */
export interface GlobeNavigationControllerParams {
    /**
     * Whether the controller starts active.
     *
     * Default is ``true``.
     */
    active?: boolean;

    /**
     * Optional standard ModelNavigationController to suspend while globe navigation is active.
     */
    suspendModelNavigationController?: ModelNavigationController;

    /**
     * Globe center in world-space coordinates.
     *
     * Default is ``[0, 0, 0]``.
     */
    center?: number[];

    /**
     * Globe radius in world-space units.
     *
     * Default is ``6371000``.
     */
    radius?: number;

    /**
     * World-space pole axis used for yaw and upright camera reconstruction.
     *
     * Default is ``[0, 0, 1]``.
     */
    worldUp?: number[];

    /**
     * Minimum camera distance from the active zoom target.
     *
     * Default is ``1000``.
     */
    minAltitude?: number;

    /**
     * Maximum camera distance from the active zoom target.
     *
     * Default is ``150000000``.
     */
    maxAltitude?: number;

    /**
     * Screen-drag rotation sensitivity.
     *
     * Default is ``0.006``.
     */
    rotateSpeed?: number;

    /**
     * Multiplier applied to latitudinal, pole-to-pole drag rotation.
     *
     * Lower values make vertical drags less likely to accidentally toss the
     * globe toward a pole while preserving longitudinal spin sensitivity.
     *
     * Default is ``0.55``.
     */
    latitudinalDragScale?: number;

    /**
     * Exponential wheel zoom sensitivity.
     *
     * Default is ``0.0015``.
     */
    zoomSpeed?: number;

    /**
     * Rotation inertia decay time, in milliseconds.
     *
     * Default is ``180``.
     */
    inertiaTime?: number;

    /**
     * Wheel zoom inertia decay time, in milliseconds.
     *
     * Default is ``130``.
     */
    zoomInertiaTime?: number;

    /**
     * Maximum sampled screen-drag velocity in pixels per millisecond.
     *
     * Default is ``0.45``.
     */
    maxInertiaSpeed?: number;

    /**
     * Minimum per-move screen distance required to update release inertia.
     *
     * Default is ``4``.
     */
    minInertiaPixels?: number;

    /**
     * Pointer stillness interval before release momentum is cleared, in milliseconds.
     *
     * Default is ``90``.
     */
    releaseStillnessTime?: number;

    /**
     * Maximum age of the last inertia sample retained at release, in milliseconds.
     *
     * Default is ``55``.
     */
    releaseVelocityMaxAge?: number;

    /**
     * Fraction of sampled drag energy retained when the pointer is released.
     *
     * Default is ``0.65``.
     */
    releaseEnergyRetention?: number;

    /**
     * Maximum camera latitude relative to ``worldUp``.
     *
     * Default is ``80``.
     */
    maxViewLatitudeDegrees?: number;

    /**
     * Duration of the double-click look-at transition, in milliseconds.
     *
     * Default is ``450``.
     */
    doubleClickLookDuration?: number;

    /**
     * Surface latitude where exact surface-drag damping starts.
     *
     * Default is ``55``.
     */
    polarDragDampingStartDegrees?: number;

    /**
     * Surface latitude where exact surface-drag is replaced by damped screen drag.
     *
     * Default is ``72``.
     */
    polarDragFallbackStartDegrees?: number;

    /**
     * Screen-drag scale used inside the polar fallback cap.
     *
     * Default is ``0.35``.
     */
    polarFallbackDragScale?: number;
}
