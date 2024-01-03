import type { View } from "./View";
import { Component, EventEmitter } from "@xeokit/core";
import type { FloatArrayParam } from "@xeokit/math";
/**
 * Configures its {@link @xeokit/viewer!View}'s measurement unit and mapping between the Real-space and World-space 3D Cartesian coordinate systems.
 *
 *
 * ## Summary
 *
 * * Located at {@link View.metrics}.
 * * {@link Metrics.units} configures the Real-space unit type, which is {@link @xeokit/constants!MetersUnit} by default.
 * * {@link Metrics.scale} configures the number of Real-space units represented by each unit within the World-space 3D coordinate system. This is ````1.0```` by default.
 * * {@link Metrics.origin} configures the 3D Real-space origin, in current Real-space units, at which this {@link @xeokit/viewer!View}'s World-space coordinate origin sits, This is ````[0,0,0]```` by default.
 *
 * ## Usage
 *
 * ````JavaScript
 * import {Viewer, constants} from "xeokit-viewer.es.js";
 *
 * const viewer = new Viewer();
 *
 * const view1 = myViewer.createView({
 *      id: "myView",
 *      canvasId: "myCanvas1"
 * });
 *
 * const metrics = view1.metrics;
 *
 * metrics.units = MetersUnit;
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
    readonly onOrigin: EventEmitter<Metrics, FloatArrayParam>;
    /**
     * @private
     */
    constructor(view: View, cfg?: {
        origin?: FloatArrayParam;
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
     *     [MetersUnit]: {
     *         abbrev: "m"
     *     },
     *     [CentimetersUnit]: {
     *         abbrev: "cm"
     *     },
     *     [MillimetersUnit]: {
     *         abbrev: "mm"
     *     },
     *     [YardsUnit]: {
     *         abbrev: "yd"
     *     },
     *     [FeetUnit]: {
     *         abbrev: "ft"
     *     },
     *     [InchesUnit]: {
     *         abbrev: "in"
     *     }
     * }
     * ````
     *
     * @type {*}
     */
    get unitsInfo(): {};
    /**
     * Gets the {@link @xeokit/viewer!View}'s Real-space unit type.
     */
    get units(): number;
    /**
     * Sets the {@link @xeokit/viewer!View}'s Real-space unit type.
     *
     * Accepted values are {@link @xeokit/constants!MetersUnit}, {@link @xeokit/constants!CentimetersUnit}, {@link @xeokit/constants!MillimetersUnit}, {@link @xeokit/constants!YardsUnit}, {@link @xeokit/constants!FeetUnit} and {@link @xeokit/constants!InchesUnit}.
     */
    set units(value: number | undefined);
    /**
     * Gets the number of Real-space units represented by each unit of the {@link @xeokit/viewer!View}'s World-space coordinate system.
     */
    get scale(): number;
    /**
     * Sets the number of Real-space units represented by each unit of the {@link @xeokit/viewer!View}'s World-space coordinate system.
     *
     * For example, if {@link Metrics.units} is {@link @xeokit/constants!MetersUnit}, and there are ten meters per World-space coordinate system unit, then ````scale```` would have a value of ````10.0````.
     */
    set scale(value: number | undefined);
    /**
     * Gets the 3D Real-space origin, in Real-space units, at which this {@link @xeokit/viewer!View}'s World-space coordinate origin ````[0,0,0]```` sits.
     */
    get origin(): FloatArrayParam;
    /**
     * Sets the Real-space 3D origin, in Real-space units, at which this {@link @xeokit/viewer!View}'s World-space coordinate origin ````[0,0,0]```` sits.
     */
    set origin(value: FloatArrayParam | undefined);
    /**
     * Converts a 3D position from World-space to Real-space.
     *
     * This is equivalent to ````realPos = #origin + (worldPos * #scale)````.
     *
     * @param worldPos World-space 3D position, in World coordinate system units.
     * @param [realPos] Destination for Real-space 3D position.
     * @returns  Real-space 3D position, in units indicated by {@link Metrics#units}.
     */
    worldToRealPos(worldPos: FloatArrayParam, realPos?: FloatArrayParam): FloatArrayParam;
    /**
     * Converts a 3D position from Real-space to World-space.
     *
     * This is equivalent to ````worldPos = (worldPos - #origin) / #scale````.
     *
     * @param realPos Real-space 3D position.
     * @param [worldPos] Destination for World-space 3D position.
     * @returns  World-space 3D position.
     */
    realToWorldPos(realPos: FloatArrayParam, worldPos?: FloatArrayParam): FloatArrayParam;
    /**
     * @private
     */
    destroy(): void;
}
export { Metrics };
