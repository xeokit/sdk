import { Component } from "../Component";
import * as math from "../math/index";
import type { View } from "./View";
import { EventEmitter } from "./../EventEmitter";
/**
 * Configures its {@link View}'s measurement unit and mapping between the Real-space and World-space 3D Cartesian coordinate systems.
 *
 *
 * ## Summary
 *
 * * Located at {@link View.metrics}.
 * * {@link Metrics.units} configures the Real-space unit type, which is {@link MetersUnit} by default.
 * * {@link Metrics.scale} configures the number of Real-space units represented by each unit within the World-space 3D coordinate system. This is ````1.0```` by default.
 * * {@link Metrics.origin} configures the 3D Real-space origin, in current Real-space units, at which this {@link View}'s World-space coordinate origin sits, This is ````[0,0,0]```` by default.
 *
 * ## Usage
 *
 * ````JavaScript
 * import {WebViewer, constants} from "xeokit-viewer.es.js";
 *
 * const viewer = new WebViewer();
 *
 * const view1 = myViewer.createView({
 *      id: "myView",
 *      canvasId: "myView1"
 * });
 *
 * const metrics = view1.metrics;
 *
 * metrics.units = constants.MetersUnit;
 * metrics.scale = 10.0;
 * metrics.origin = [100.0, 0.0, 200.0];
 * ````
 */
declare class Metrics extends Component {
    #private;
    /**
     * Emits an event each time {@link Metrics.units} changes.
     *
     * @event
     */
    readonly onUnits: EventEmitter<Metrics, number>;
    /**
     * Emits an event each time {@link Metrics.scale} changes.
     *
     * @event
     */
    readonly onScale: EventEmitter<Metrics, number>;
    /**
     * Emits an event each time {@link Metrics.origin} changes.
     *
     * @event
     */
    readonly onOrigin: EventEmitter<Metrics, math.FloatArrayParam>;
    /**
     * @private
     */
    constructor(view: View, cfg?: {
        origin?: math.FloatArrayParam;
        scale?: number;
        units?: number;
    });
    /**
     * Gets info about the supported Real-space unit types.
     *
     * With {@link constants} indicating each unit type, the info will be:
     *
     * ````javascript
     * {
     *     [constants.MetersUnit]: {
     *         abbrev: "m"
     *     },
     *     [constants.CentimetersUnit]: {
     *         abbrev: "cm"
     *     },
     *     [constants.MillimetersUnit]: {
     *         abbrev: "mm"
     *     },
     *     [constants.YardsUnit]: {
     *         abbrev: "yd"
     *     },
     *     [constants.FeetUnit]: {
     *         abbrev: "ft"
     *     },
     *     [constants.InchesUnit]: {
     *         abbrev: "in"
     *     }
     * }
     * ````
     *
     * @type {*}
     */
    get unitsInfo(): {};
    /**
     * Gets the {@link View}'s Real-space unit type.
     */
    get units(): number;
    /**
     * Sets the {@link View}'s Real-space unit type.
     *
     * Accepted values are {@link MetersUnit}, {@link CentimetersUnit}, {@link MillimetersUnit}, {@link YardsUnit}, {@link FeetUnit} and {@link InchesUnit}.
     */
    set units(value: number | undefined);
    /**
     * Gets the number of Real-space units represented by each unit of the {@link View}'s World-space coordinate system.
     */
    get scale(): number;
    /**
     * Sets the number of Real-space units represented by each unit of the {@link View}'s World-space coordinate system.
     *
     * For example, if {@link Metrics.units} is {@link MetersUnit}, and there are ten meters per World-space coordinate system unit, then ````scale```` would have a value of ````10.0````.
     */
    set scale(value: number | undefined);
    /**
     * Gets the 3D Real-space origin, in Real-space units, at which this {@link View}'s World-space coordinate origin ````[0,0,0]```` sits.
     */
    get origin(): math.FloatArrayParam;
    /**
     * Sets the Real-space 3D origin, in Real-space units, at which this {@link View}'s World-space coordinate origin ````[0,0,0]```` sits.
     */
    set origin(value: math.FloatArrayParam | undefined);
    /**
     * Converts a 3D position from World-space to Real-space.
     *
     * This is equivalent to ````realPos = #origin + (worldPos * #scale)````.
     *
     * @param worldPos World-space 3D position, in World coordinate system units.
     * @param [realPos] Destination for Real-space 3D position.
     * @returns  Real-space 3D position, in units indicated by {@link Metrics#units}.
     */
    worldToRealPos(worldPos: math.FloatArrayParam, realPos?: math.FloatArrayParam): math.FloatArrayParam;
    /**
     * Converts a 3D position from Real-space to World-space.
     *
     * This is equivalent to ````worldPos = (worldPos - #origin) / #scale````.
     *
     * @param realPos Real-space 3D position.
     * @param [worldPos] Destination for World-space 3D position.
     * @returns  World-space 3D position.
     */
    realToWorldPos(realPos: math.FloatArrayParam, worldPos?: math.FloatArrayParam): math.FloatArrayParam;
    /**
     * @private
     */
    destroy(): void;
}
export { Metrics };
