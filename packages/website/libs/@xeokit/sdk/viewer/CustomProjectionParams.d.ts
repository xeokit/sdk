import { FloatArrayParam } from "../math";
/**
 * Parameters for a {@link CustomProjection}.
 *
 * * Returned by {@link CustomProjection.toParams | CustomProjection.toParams}
 * * Passed to {@link CustomProjection.fromParams | CustomProjection.fromParams}
 * * Located at {@link CameraParams.customProjection | CameraParams.customProjection}
 */
export interface CustomProjectionParams {
    /**
     * The {@link CustomProjection | CustomProjection's} projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     */
    projMatrix?: FloatArrayParam;
}
//# sourceMappingURL=CustomProjectionParams.d.ts.map