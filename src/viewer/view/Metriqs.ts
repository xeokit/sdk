//----------------------------------------------------------------------------------------------------------------------
// This file is named "Metriqs.js" because "Metrics.js" is blocked by uBlock Origin (https://en.wikipedia.org/wiki/UBlock#origin)
//----------------------------------------------------------------------------------------------------------------------

import {Component} from "../Component";
import * as math from "../math/index";
import {View} from "./View";

const unitsInfo = {
    meters: {
        abbrev: "m"
    },
    metres: {
        abbrev: "m"
    },
    centimeters: {
        abbrev: "cm"
    },
    centimetres: {
        abbrev: "cm"
    },
    millimeters: {
        abbrev: "mm"
    },
    millimetres: {
        abbrev: "mm"
    },
    yards: {
        abbrev: "yd"
    },
    feet: {
        abbrev: "ft"
    },
    inches: {
        abbrev: "in"
    }
};

/**
 * Configures its {@link Viewer}'s measurement unit and mapping between the Real-space and World-space 3D Cartesian coordinate systems.
 *
 *
 * ## Overview
 *
 * * Located at {@link Viewer#metrics}.
 * * {@link Metrics#units} configures the Real-space unit type, which is ````"meters"```` by default.
 * * {@link Metrics#scale} configures the number of Real-space units represented by each unit within the World-space 3D coordinate system. This is ````1.0```` by default.
 * * {@link Metrics#origin} configures the 3D Real-space origin, in current Real-space units, at which this {@link Viewer}'s World-space coordinate origin sits, This is ````[0,0,0]```` by default.
 *
 * ## Usage
 *
 * Let's load a model using an {@link XKTLoaderPlugin}, then configure the Real-space unit type and the coordinate
 * mapping between the Real-space and World-space 3D coordinate systems.
 *
 * ````JavaScript
 * import {Viewer, XKTLoaderPlugin} from "xeokit-viewer.es.js";
 *
 * const viewer = new Viewer({
 *     canvasId: "myCanvas"
 * });
 *
 * viewer.scene.camera.eye = [-2.37, 18.97, -26.12];
 * viewer.scene.camera.look = [10.97, 5.82, -11.22];
 * viewer.scene.camera.up = [0.36, 0.83, 0.40];
 *
 * const xktLoader = new XKTLoaderPlugin(viewer);
 *
 * const model = xktLoader.load({
 *     src: "./models/xkt/duplex/duplex.xkt"
 * });
 *
 * const metrics = viewer.scene.metrics;
 *
 * metrics.units = "meters";
 * metrics.scale = 10.0;
 * metrics.origin = [100.0, 0.0, 200.0];
 * ````
 */
class Metrics extends Component {

    #units: string;
    #scale: number;
    #origin: math.FloatArrayParam;

    /**
     * @private
     */
    constructor(view: View, cfg: {
        origin: math.FloatArrayParam;
        scale: number;
        units: string
    } = {
        units: "meters",
        scale: 1.0,
        origin: [1, 1, 1]
    }) {

        super(view, cfg);

        this.#units = "meters";
        this.#scale = 1.0;
        this.#origin = math.vec3([0, 0, 0]);

        this.units = cfg.units;
        this.scale = cfg.scale;
        this.origin = cfg.origin;
    }

    /**
     * Gets info about the supported Real-space unit types.
     *
     * This will be:
     *
     * ````javascript
     * {
     *      {
     *          meters: {
     *              abbrev: "m"
     *          },
     *          metres: {
     *              abbrev: "m"
     *          },
     *          centimeters: {
     *              abbrev: "cm"
     *          },
     *          centimetres: {
     *              abbrev: "cm"
     *          },
     *          millimeters: {
     *              abbrev: "mm"
     *          },
     *          millimetres: {
     *              abbrev: "mm"
     *          },
     *          yards: {
     *              abbrev: "yd"
     *          },
     *          feet: {
     *              abbrev: "ft"
     *          },
     *          inches: {
     *              abbrev: "in"
     *          }
     *      }
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
    get units(): string {
        return this.#units;
    }

    /**
     * Sets the {@link View}'s Real-space unit type.
     *
     * Accepted values are ````"meters"````, ````"centimeters"````, ````"millimeters"````, ````"metres"````, ````"centimetres"````, ````"millimetres"````, ````"yards"````, ````"feet"```` and ````"inches"````.
     */
    set units(value: string) {
        if (!value) {
            value = "meters";
        }
        // @ts-ignore
        const info = unitsInfo[value];
        if (!info) {
            this.error("Unsupported value for 'units': " + value + " defaulting to 'meters'");
            value = "meters";
        }
        this.#units = value;
        this.events.fire("units", this.#units);
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
     * For example, if {@link Metrics#units} is ````"meters"````, and there are ten meters per World-space coordinate system unit, then ````scale```` would have a value of ````10.0````.
     */
    set scale(value: number) {
        value = value || 1;
        if (value <= 0) {
            this.error("scale value should be larger than zero");
            return;
        }
        this.#scale = value;
        this.events.fire("scale", this.#scale);
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
    set origin(value: math.FloatArrayParam) {
        if (!value) {
            this.#origin[0] = 0;
            this.#origin[1] = 0;
            this.#origin[2] = 0;
            return;
        }
        this.#origin[0] = value[0];
        this.#origin[1] = value[1];
        this.#origin[2] = value[2];
        this.events.fire("origin", this.#origin);
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
}

export {Metrics};