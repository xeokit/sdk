//----------------------------------------------------------------------------------------------------------------------
// This file is named "Metriqs.js" because "Metrics.js" is blocked by uBlock Origin (https://en.wikipedia.org/wiki/UBlock#origin)
//----------------------------------------------------------------------------------------------------------------------

import {Component} from "../Component";
import * as math from "../math/index";
import type {View} from "./View";
import * as constants from "./../constants";
import {EventDispatcher, IEvent} from "strongly-typed-events";
import {EventEmitter} from "./../EventEmitter";
import {ViewObject} from "@xeokit-viewer/viewer";

const unitsInfo = {
    [constants.MetersUnit]: {
        abbrev: "m"
    },
    [constants.CentimetersUnit]: {
        abbrev: "cm"
    },
    [constants.MillimetersUnit]: {
        abbrev: "mm"
    },
    [constants.YardsUnit]: {
        abbrev: "yd"
    },
    [constants.FeetUnit]: {
        abbrev: "ft"
    },
    [constants.InchesUnit]: {
        abbrev: "in"
    }
};

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
 * metrics.units = constants.MetersUnit;
 * metrics.scale = 10.0;
 * metrics.origin = [100.0, 0.0, 200.0];
 * ````
 */
class Metrics extends Component {

    #units: number;
    #scale: number;
    #origin: math.FloatArrayParam;

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
    constructor(view: View, cfg: {
        origin?: math.FloatArrayParam;
        scale?: number;
        units?: number
    } = {
        units: constants.MetersUnit,
        scale: 1.0,
        origin: [1, 1, 1]
    }) {

        super(view, cfg);

        this.onUnits = new EventEmitter(new EventDispatcher<Metrics, number>());
        this.onScale = new EventEmitter(new EventDispatcher<Metrics, number>());
        this.onOrigin = new EventEmitter(new EventDispatcher<Metrics, math.FloatArrayParam>());

        this.#units = constants.MetersUnit;
        this.#scale = 1.0;
        this.#origin = math.vec3([0, 0, 0]);

        this.units = cfg.units;
        this.scale = cfg.scale;
        this.origin = cfg.origin;
    }

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
    get unitsInfo(): {} {
        return unitsInfo;
    }

    /**
     * Gets the {@link View}'s Real-space unit type.
     */
    get units(): number {
        return this.#units;
    }

    /**
     * Sets the {@link View}'s Real-space unit type.
     *
     * Accepted values are {@link MetersUnit}, {@link CentimetersUnit}, {@link MillimetersUnit}, {@link YardsUnit}, {@link FeetUnit} and {@link InchesUnit}.
     */
    set units(value: number | undefined) {
        if (!value) {
            value = constants.MetersUnit;
        }
        // @ts-ignore
        const info = unitsInfo[value];
        if (!info) {
            this.error("Unsupported value for 'units': " + value + " defaulting to MetersUnit");
            value = constants.MetersUnit;
        }
        this.#units = value;
        this.onUnits.dispatch(this, this.#units);
    }

    /**
     * Gets the number of Real-space units represented by each unit of the {@link View}'s World-space coordinate system.
     */
    get scale(): number {
        return this.#scale;
    }

    /**
     * Sets the number of Real-space units represented by each unit of the {@link View}'s World-space coordinate system.
     *
     * For example, if {@link Metrics.units} is {@link MetersUnit}, and there are ten meters per World-space coordinate system unit, then ````scale```` would have a value of ````10.0````.
     */
    set scale(value: number | undefined) {
        value = value || 1;
        if (value <= 0) {
            this.error("scale value should be larger than zero");
            return;
        }
        this.#scale = value;
        this.onScale.dispatch(this, this.#scale);
    }

    /**
     * Gets the 3D Real-space origin, in Real-space units, at which this {@link View}'s World-space coordinate origin ````[0,0,0]```` sits.
     */
    get origin(): math.FloatArrayParam {
        return this.#origin;
    }

    /**
     * Sets the Real-space 3D origin, in Real-space units, at which this {@link View}'s World-space coordinate origin ````[0,0,0]```` sits.
     */
    set origin(value: math.FloatArrayParam | undefined) {
        if (!value) {
            this.#origin[0] = 0;
            this.#origin[1] = 0;
            this.#origin[2] = 0;
            return;
        }
        this.#origin[0] = value[0];
        this.#origin[1] = value[1];
        this.#origin[2] = value[2];
        this.onOrigin.dispatch(this, this.#origin);
    }

    /**
     * Converts a 3D position from World-space to Real-space.
     *
     * This is equivalent to ````realPos = #origin + (worldPos * #scale)````.
     *
     * @param worldPos World-space 3D position, in World coordinate system units.
     * @param [realPos] Destination for Real-space 3D position.
     * @returns  Real-space 3D position, in units indicated by {@link Metrics#units}.
     */
    worldToRealPos(worldPos: math.FloatArrayParam, realPos: math.FloatArrayParam = math.vec3()): math.FloatArrayParam {
        realPos[0] = this.#origin[0] + (this.#scale * worldPos[0]);
        realPos[1] = this.#origin[1] + (this.#scale * worldPos[1]);
        realPos[2] = this.#origin[2] + (this.#scale * worldPos[2]);
        return realPos;
    }

    /**
     * Converts a 3D position from Real-space to World-space.
     *
     * This is equivalent to ````worldPos = (worldPos - #origin) / #scale````.
     *
     * @param realPos Real-space 3D position.
     * @param [worldPos] Destination for World-space 3D position.
     * @returns  World-space 3D position.
     */
    realToWorldPos(realPos: math.FloatArrayParam, worldPos: math.FloatArrayParam = math.vec3()): math.FloatArrayParam {
        worldPos[0] = (realPos[0] - this.#origin[0]) / this.#scale;
        worldPos[1] = (realPos[1] - this.#origin[1]) / this.#scale;
        worldPos[2] = (realPos[2] - this.#origin[2]) / this.#scale;
        return worldPos;
    }

    /**
     * @private
     */
    destroy() {
        super.destroy();
        this.onUnits.clear();
        this.onScale.clear();
        this.onOrigin.clear();
    }
}

export {Metrics};