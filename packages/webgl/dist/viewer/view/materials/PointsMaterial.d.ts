import type { View } from "../View";
import { Component } from "../../Component";
/**
 * Configures the size and shape of {@link ViewObject|ViewObjects} that represent clouds of points.
 *
 * ## Summary
 *
 * * Located at {@link View.pointsMaterial}.
 * * Supports round and square points.
 * * Optional perspective point scaling.
 */
declare class PointsMaterial extends Component {
    #private;
    /**
     * The View to which this PointsMaterial belongs.
     */
    readonly view: View;
    /**
     * @private
     */
    constructor(view: View, options?: {
        pointSize?: number;
        roundPoints?: boolean;
        perspectivePoints?: boolean;
        minPerspectivePointSize?: number;
        maxPerspectivePointSize?: number;
        filterIntensity?: boolean;
        minIntensity?: number;
        maxIntensity?: number;
    });
    /**
     * Sets point size.
     *
     * Default value is ````2.0```` pixels.
     */
    set pointSize(value: number);
    /**
     * Gets point size.
     *
     * Default value is ````2.0```` pixels.
     */
    get pointSize(): number;
    /**
     * Sets if points are round or square.
     *
     * Default is ````true```` to set points round.
     */
    set roundPoints(value: boolean);
    /**
     * Gets if points are round or square.
     *
     * Default is ````true```` to set points round.
     */
    get roundPoints(): boolean;
    /**
     * Sets if rendered point size reduces with distance when {@link Camera.projection} is set to ````PerspectiveProjectionType````.
     *
     * Default is ````true````.
     */
    set perspectivePoints(value: boolean);
    /**
     * Gets if rendered point size reduces with distance when {@link Camera.projection} is set to PerspectiveProjectionType.
     *
     * Default is ````false````.
     */
    get perspectivePoints(): boolean;
    /**
     * Sets the minimum rendered size of points when {@link PointsMaterial.perspectivePoints} is ````true````.
     *
     * Default value is ````1.0```` pixels.
     */
    set minPerspectivePointSize(value: number);
    /**
     * Gets the minimum rendered size of points when {@link PointsMaterial.perspectivePoints} is ````true````.
     *
     * Default value is ````1.0```` pixels.
     *
     * @type {Number}
     */
    get minPerspectivePointSize(): number;
    /**
     * Sets the maximum rendered size of points when {@link PointsMaterial.perspectivePoints} is ````true````.
     *
     * Default value is ````6```` pixels.
     */
    set maxPerspectivePointSize(value: number);
    /**
     * Gets the maximum rendered size of points when {@link PointsMaterial.perspectivePoints} is ````true````.
     *
     * Default value is ````6```` pixels.
     */
    get maxPerspectivePointSize(): number;
    /**
     * Sets if rendered point size reduces with distance when {@link Camera.projection} is set to ````PerspectiveProjectionType````.
     *
     * Default is ````false````.
     */
    set filterIntensity(value: boolean);
    /**
     * Gets if rendered point size reduces with distance when {@link Camera.projection} is set to PerspectiveProjectionType.
     *
     * Default is ````false````.
     */
    get filterIntensity(): boolean;
    /**
     * Sets the minimum rendered size of points when {@link PointsMaterial.perspectivePoints} is ````true````.
     *
     * Default value is ````0````.
     */
    set minIntensity(value: number);
    /**
     * Gets the minimum rendered size of points when {@link PointsMaterial.filterIntensity} is ````true````.
     *
     * Default value is ````0````.
     */
    get minIntensity(): number;
    /**
     * Sets the maximum rendered size of points when {@link PointsMaterial.filterIntensity} is ````true````.
     *
     * Default value is ````1````.
     */
    set maxIntensity(value: number);
    /**
     * Gets the maximum rendered size of points when {@link PointsMaterial.filterIntensity} is ````true````.
     *
     * Default value is ````1````.
     */
    get maxIntensity(): number;
    /**
     * @private
     */
    get hash(): string;
    /**
     * @private
     */
    destroy(): void;
}
export { PointsMaterial };
