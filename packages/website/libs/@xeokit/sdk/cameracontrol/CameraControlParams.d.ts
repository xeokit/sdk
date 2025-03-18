/**
 * Configuration options for {@link CameraControl}.
 */
export interface CameraControlParams {
    /**
     * Sensitivity of the mouse wheel for dollying (moving forward and backward) with the {@link viewer!Camera | Camera}.
     */
    mouseWheelDollyRate?: number;
    /**
     * Sensitivity of the keyboard for dollying (moving forward and backward) with the {@link viewer!Camera | Camera}.
     */
    keyboardDollyRate?: number;
    /**
     * Amount of inertia applied to panning, allowing the {@link viewer!Camera | Camera} to continue moving briefly after input stops.
     *
     * Default: `0`
     */
    panInertia?: number;
    /**
     * Minimum dolly speed when using keyboard input for continuous movement.
     *
     * Default: `0.04` meters per second.
     */
    dollyMinSpeed?: number;
    /**
     * Distance threshold where dolly speed decreases when approaching objects and increases when moving away.
     *
     * Default: `35` meters.
     */
    dollyProximityThreshold?: number;
    /**
     * Amount of inertia applied to dollying, allowing the {@link viewer!Camera | Camera} to continue moving briefly after input stops.
     *
     * Default: `0`
     */
    dollyInertia?: number;
    /**
     * Sensitivity of touch controls for dollying (moving forward and backward) with the {@link viewer!Camera | Camera}.
     */
    touchDollyRate?: number;
    /**
     * Sensitivity of mouse drag for rotating the {@link viewer!Camera | Camera}.
     */
    dragRotationRate?: number;
    /**
     * Sensitivity of keyboard input for rotating the {@link viewer!Camera | Camera}.
     */
    keyboardRotationRate?: number;
    /**
     * Sensitivity of touch controls for panning the {@link viewer!Camera | Camera}.
     */
    touchPanRate?: number;
    /**
     * Sensitivity of keyboard input for panning the {@link viewer!Camera | Camera}.
     */
    keyboardPanRate?: number;
    /**
     * Amount of inertia applied to rotation, allowing the {@link viewer!Camera | Camera} to continue rotating briefly after input stops.
     *
     * Default: `0`
     */
    rotationInertia?: number;
    /**
     * Enables or disables pointer-based camera control.
     *
     * - Orbit mode: Camera orbits around the pointer and dolly moves toward or away from it.
     * - Fly-to mode: Camera dollies toward or away from the pointer, but rotation occurs around the camera position.
     * - Plan-view mode: Camera dollies toward or away from the pointer without rotation.
     *
     * Default: `true`
     */
    followPointer?: boolean;
    /**
     * Enables or disables {@link cameracontrol!CameraControl}.
     *
     * Default: `true`
     */
    active?: boolean;
    /**
     * Enables right-click mouse dragging for horizontal panning with the {@link viewer!Camera | Camera}.
     *
     * Default: `true`
     */
    panRightClick?: boolean;
    /**
     * Custom key mappings for {@link cameracontrol!CameraControl} actions.
     *
     * This can be a set of custom key mappings or a predefined keyboard layout name, which applies default mappings for that layout.
     */
    keyMap?: any;
    /**
     * Constrains the {@link viewer!Camera | Camera} vertically for first-person navigation.
     *
     * When `true`, the {@link viewer!Camera.eye | Camera.eye} remains fixed at its current vertical position.
     *
     * Applies only when {@link CameraControl.navMode | CameraControl.navMode} is set to {@link constants!FirstPersonNavigationMode | FirstPersonNavigationMode}.
     *
     * Default: `false`
     */
    constrainVertical?: boolean;
    /**
     * Specifies the navigation mode.
     *
     * Accepted values:
     * - {@link constants!OrbitNavigationMode}: Camera rotates around a target or pivot point.
     * - {@link constants!FirstPersonNavigationMode}: Camera rotates from its current eye position.
     * - {@link constants!PlanViewNavigationMode}: Camera rotation is disabled.
     */
    navMode?: number;
    /**
     * Determines whether double-clicking an object causes the {@link viewer!Camera | Camera} to fly to its boundary.
     *
     * Default: `false`
     */
    doublePickFlyTo?: boolean;
    /**
     * Enables keyboard shortcuts only when the mouse is over the canvas.
     *
     * Default: `false`
     */
    keyboardEnabledOnlyOfMouseover?: boolean;
}
//# sourceMappingURL=CameraControlParams.d.ts.map