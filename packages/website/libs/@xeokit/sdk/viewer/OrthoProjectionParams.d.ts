/**
 * Parameters for an {@link OrthoProjection}.
 *
 * * Returned by {@link OrthoProjection.toParams | OrthoProjection.toParams}
 * * Passed to {@link OrthoProjection.fromParams | OrthoProjection.fromParams}
 * * Located at {@link CameraParams.orthoProjection | CameraParams.orthoProjection}
 */
export interface OrthoProjectionParams {
    /**
     * Position of the {@link OrthoProjection | OrthoProjection's} far plane on the View-space Z-axis.
     *
     * Default value is ````10000````.
     */
    far?: number;
    /**
     * Position of the {@link OrthoProjection | OrthoProjection's} near plane on the View-space Z-axis.
     *
     * Default value is ````0.1````.
     */
    near?: number;
    /**
     * Sets scale factor for the {@link OrthoProjection | OrthoProjection's} extents on the View-space X and Y axis.
     *
     * A larger value will include more objects within the extents, while a lower value will include less.
     *
     * Clamps to minimum value of ````0.01```.
     *
     * Default value is ````1.0````
     */
    scale?: number;
}
//# sourceMappingURL=OrthoProjectionParams.d.ts.map