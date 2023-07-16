import {Component} from "@xeokit/core";
import type {View} from "./View";

/**
 * Configures the size and shape of {@link @xeokit/viewer!ViewObject | ViewObjects} that represent clouds of points.
 *
 * ## Summary
 *
 * * Located at {@link View.pointsMaterial}.
 * * Supports round and square points.
 * * Optional perspective point scaling.
 */
class PointsMaterial extends Component {

    /**
     * The View to which this PointsMaterial belongs.
     */
    public readonly view: View;

    #state: {
        pointSize: number,
        roundPoints: boolean,
        perspectivePoints: boolean,
        minPerspectivePointSize: number,
        maxPerspectivePointSize: number,
        filterIntensity: boolean,
        minIntensity: number,
        maxIntensity: number
    };

    /**
     * @private
     */
    constructor(view: View, options: {
        pointSize?: number,
        roundPoints?: boolean,
        perspectivePoints?: boolean,
        minPerspectivePointSize?: number,
        maxPerspectivePointSize?: number,
        filterIntensity?: boolean,
        minIntensity?: number,
        maxIntensity?: number
    } = {}) {

        super(view, options);

        this.view = view;

        this.#state = {
            pointSize: (options.pointSize !== undefined && options.pointSize !== null) ? options.pointSize : 1,
            roundPoints: options.roundPoints !== false,
            perspectivePoints: options.perspectivePoints !== false,
            minPerspectivePointSize: (options.minPerspectivePointSize !== undefined && options.minPerspectivePointSize !== null) ? options.minPerspectivePointSize : 1,
            maxPerspectivePointSize: (options.maxPerspectivePointSize !== undefined && options.maxPerspectivePointSize !== null) ? options.maxPerspectivePointSize : 6,
            filterIntensity: !!options.filterIntensity,
            minIntensity: (options.minIntensity !== undefined && options.minIntensity !== null) ? options.minIntensity : 0,
            maxIntensity: (options.maxIntensity !== undefined && options.maxIntensity !== null) ? options.maxIntensity : 1
        };
    }

    /**
     * Sets point size.
     *
     * Default value is ````2.0```` pixels.
     */
    set pointSize(value: number) {
        this.#state.pointSize = value;
        this.view.redraw();
    }

    /**
     * Gets point size.
     *
     * Default value is ````2.0```` pixels.
     */
    get pointSize(): number {
        return this.#state.pointSize;
    }


    /**
     * Sets if points are round or square.
     *
     * Default is ````true```` to set points round.
     */
    set roundPoints(value: boolean) {
        if (this.#state.roundPoints === value) {
            return;
        }
        this.#state.roundPoints = value;
        this.view.rebuild();
    }

    /**
     * Gets if points are round or square.
     *
     * Default is ````true```` to set points round.
     */
    get roundPoints(): boolean {
        return this.#state.roundPoints;
    }

    /**
     * Sets if rendered point size reduces with distance when {@link Camera.projection} is set to ````PerspectiveProjectionType````.
     *
     * Default is ````true````.
     */
    set perspectivePoints(value: boolean) {
        if (this.#state.perspectivePoints === value) {
            return;
        }
        this.#state.perspectivePoints = value;
        this.view.rebuild();
    }

    /**
     * Gets if rendered point size reduces with distance when {@link Camera.projection} is set to PerspectiveProjectionType.
     *
     * Default is ````false````.
     */
    get perspectivePoints(): boolean {
        return this.#state.perspectivePoints;
    }

    /**
     * Sets the minimum rendered size of points when {@link PointsMaterial.perspectivePoints} is ````true````.
     *
     * Default value is ````1.0```` pixels.
     */
    set minPerspectivePointSize(value: number) {
        if (this.#state.minPerspectivePointSize === value) {
            return;
        }
        this.#state.minPerspectivePointSize = value;
        this.view.rebuild();
    }

    /**
     * Gets the minimum rendered size of points when {@link PointsMaterial.perspectivePoints} is ````true````.
     *
     * Default value is ````1.0```` pixels.
     *
     * @type {Number}
     */
    get minPerspectivePointSize(): number {
        return this.#state.minPerspectivePointSize;
    }

    /**
     * Sets the maximum rendered size of points when {@link PointsMaterial.perspectivePoints} is ````true````.
     *
     * Default value is ````6```` pixels.
     */
    set maxPerspectivePointSize(value: number) {
        if (this.#state.maxPerspectivePointSize === value) {
            return;
        }
        this.#state.maxPerspectivePointSize = value;
        this.view.rebuild();
    }

    /**
     * Gets the maximum rendered size of points when {@link PointsMaterial.perspectivePoints} is ````true````.
     *
     * Default value is ````6```` pixels.
     */
    get maxPerspectivePointSize(): number {
        return this.#state.maxPerspectivePointSize;
    }

    /**
     * Sets if rendered point size reduces with distance when {@link Camera.projection} is set to ````PerspectiveProjectionType````.
     *
     * Default is ````false````.
     */
    set filterIntensity(value: boolean) {
        if (this.#state.filterIntensity === value) {
            return;
        }
        this.#state.filterIntensity = value;
        this.view.rebuild();
    }

    /**
     * Gets if rendered point size reduces with distance when {@link Camera.projection} is set to PerspectiveProjectionType.
     *
     * Default is ````false````.
     */
    get filterIntensity(): boolean {
        return this.#state.filterIntensity;
    }

    /**
     * Sets the minimum rendered size of points when {@link PointsMaterial.perspectivePoints} is ````true````.
     *
     * Default value is ````0````.
     */
    set minIntensity(value: number) {
        if (this.#state.minIntensity === value) {
            return;
        }
        this.#state.minIntensity = value;
        this.view.redraw();
    }

    /**
     * Gets the minimum rendered size of points when {@link PointsMaterial.filterIntensity} is ````true````.
     *
     * Default value is ````0````.
     */
    get minIntensity(): number {
        return this.#state.minIntensity;
    }

    /**
     * Sets the maximum rendered size of points when {@link PointsMaterial.filterIntensity} is ````true````.
     *
     * Default value is ````1````.
     */
    set maxIntensity(value: number) {
        if (this.#state.maxIntensity === value) {
            return;
        }
        this.#state.maxIntensity = value;
        this.view.redraw();
    }

    /**
     * Gets the maximum rendered size of points when {@link PointsMaterial.filterIntensity} is ````true````.
     *
     * Default value is ````1````.
     */
    get maxIntensity(): number {
        return this.#state.maxIntensity;
    }

    /**
     * @private
     */
    get hash(): string {
        const state = this.#state;
        return `${state.pointSize};
        ${state.roundPoints};
        ${state.perspectivePoints};
        ${state.minPerspectivePointSize};
        ${state.maxPerspectivePointSize};
        ${state.filterIntensity}`;
    }

    /**
     * @private
     */
    destroy() {
        super.destroy();
    }
}

export {PointsMaterial};