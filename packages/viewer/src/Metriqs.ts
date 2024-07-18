import type {View} from "./View";
import {CentimetersUnit, FeetUnit, InchesUnit, MetersUnit, MillimetersUnit, YardsUnit} from "@xeokit/constants";
import {Component, EventEmitter} from "@xeokit/core";
import type {FloatArrayParam} from "@xeokit/math";
import {EventDispatcher} from "strongly-typed-events";
import {createVec3} from "@xeokit/matrix";


const unitsInfo = {
    [MetersUnit]: {
        abbrev: "m"
    },
    [CentimetersUnit]: {
        abbrev: "cm"
    },
    [MillimetersUnit]: {
        abbrev: "mm"
    },
    [YardsUnit]: {
        abbrev: "yd"
    },
    [FeetUnit]: {
        abbrev: "ft"
    },
    [InchesUnit]: {
        abbrev: "in"
    }
};

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
 *      elementId: "myCanvas1"
 * });
 *
 * const metrics = view1.metrics;
 *
 * metrics.units = MetersUnit;
 * metrics.scale = 10.0;
 * metrics.origin = [100.0, 0.0, 200.0];
 * ````
 */
class Metrics extends Component {

    #units: number;
    #scale: number;
    #origin: FloatArrayParam;

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
    constructor(view: View, cfg: {
        origin?: FloatArrayParam;
        scale?: number;
        units?: number
    } = {
        units: MetersUnit,
        scale: 1.0,
        origin: [1, 1, 1]
    }) {

        super(view, cfg);

        this.onUnits = new EventEmitter(new EventDispatcher<Metrics, number>());
        this.onScale = new EventEmitter(new EventDispatcher<Metrics, number>());
        this.onOrigin = new EventEmitter(new EventDispatcher<Metrics, FloatArrayParam>());

        this.#units = MetersUnit;
        this.#scale = 1.0;
        this.#origin = createVec3([0, 0, 0]);

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
    get unitsInfo(): {} {
        return unitsInfo;
    }

    /**
     * Gets the {@link @xeokit/viewer!View}'s Real-space unit type.
     */
    get units(): number {
        return this.#units;
    }

    /**
     * Sets the {@link @xeokit/viewer!View}'s Real-space unit type.
     *
     * Accepted values are {@link @xeokit/constants!MetersUnit}, {@link @xeokit/constants!CentimetersUnit}, {@link @xeokit/constants!MillimetersUnit}, {@link @xeokit/constants!YardsUnit}, {@link @xeokit/constants!FeetUnit} and {@link @xeokit/constants!InchesUnit}.
     */
    set units(value: number | undefined) {
        if (!value) {
            value = MetersUnit;
        }
        // @ts-ignore
        const info = unitsInfo[value];
        if (!info) {
            this.error("Unsupported value for 'units': " + value + " defaulting to MetersUnit");
            value = MetersUnit;
        }
        this.#units = value;
        this.onUnits.dispatch(this, this.#units);
    }

    /**
     * Gets the number of Real-space units represented by each unit of the {@link @xeokit/viewer!View}'s World-space coordinate system.
     */
    get scale(): number {
        return this.#scale;
    }

    /**
     * Sets the number of Real-space units represented by each unit of the {@link @xeokit/viewer!View}'s World-space coordinate system.
     *
     * For example, if {@link Metrics.units} is {@link @xeokit/constants!MetersUnit}, and there are ten meters per World-space coordinate system unit, then ````scale```` would have a value of ````10.0````.
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
     * Gets the 3D Real-space origin, in Real-space units, at which this {@link @xeokit/viewer!View}'s World-space coordinate origin ````[0,0,0]```` sits.
     */
    get origin(): FloatArrayParam {
        return this.#origin;
    }

    /**
     * Sets the Real-space 3D origin, in Real-space units, at which this {@link @xeokit/viewer!View}'s World-space coordinate origin ````[0,0,0]```` sits.
     */
    set origin(value: FloatArrayParam | undefined) {
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
    worldToRealPos(worldPos: FloatArrayParam, realPos: FloatArrayParam = createVec3()): FloatArrayParam {
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
    realToWorldPos(realPos: FloatArrayParam, worldPos: FloatArrayParam = createVec3()): FloatArrayParam {
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
