/**
 * Parameters for a {@link PerspectiveProjection}.
 *
 * * Returned by {@link PerspectiveProjection.toParams | PerspectiveProjection.toParams}
 * * Passed to {@link PerspectiveProjection.fromParams | PerspectiveProjection.fromParams}
 * * Located at {@link CameraParams.perspectiveProjection | CameraParams.perspectiveProjection}
 */
export interface PerspectiveProjectionParams {
    /**
     * Position of the {@link PerspectiveProjection | PerspectiveProjection's} far plane on the View-space Z-axis.
     *
     * Default value is ````10000````.
     */
    far?: number;
    /**
     * Position of the {@link PerspectiveProjection | PerspectiveProjection's} near plane on the View-space Z-axis.
     *
     * Default value is ````0.1````.
     */
    near?: number;
    /**
     * The {@link PerspectiveProjection | PerspectiveProjection's} field-of-view angle (FOV) in degrees.
     *
     * Default value is ````60.0````.
     *
     * @param value New field-of-view.
     */
    fov?: number;
    /**
     * The {@link PerspectiveProjection | PerspectiveProjection's} FOV axis.
     *
     * Options are ````"x"````, ````"y"```` or ````"min"````, to use the minimum axis.
     *
     * Default value is ````"min"````.
     *
     * @returns {String} The current FOV axis value.
     */
    fovAxis?: string;
}
//# sourceMappingURL=PerspectiveProjectionParams.d.ts.map