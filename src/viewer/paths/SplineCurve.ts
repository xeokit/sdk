import {Curve} from "./Curve.js"
import * as math from "../math";
import {Component} from "../Component";

/**
 * @desc A {@link Curve} along which a 3D position can be animated.
 *
 * * As shown in the diagram below, a SplineCurve is defined by three or more control points.
 * * You can sample a {@link SplineCurve#point} and a {@link Curve#tangent} vector on a SplineCurve for any given value of {@link SplineCurve#t} in the range ````[0..1]````.
 * * When you set {@link SplineCurve#t} on a SplineCurve, its {@link SplineCurve#point} and {@link Curve#tangent} will update accordingly.
 * * To build a complex path, you can combine an unlimited combination of SplineCurves, {@link CubicBezierCurve} and {@link QuadraticBezierCurve} into a {@link Path}.
 * <br>
 * <img style="border:1px solid; background: white;" src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Quadratic_spline_six_segments.svg/200px-Quadratic_spline_six_segments.svg.png"/><br>
 *
 * * <a href="https://en.wikipedia.org/wiki/Spline_(mathematics)">Spline Curve from Wikipedia</a>*
 */
class SplineCurve extends Curve {

    #points: math.FloatArrayType[];

    /**
     * @constructor
     * @param {Component} [owner]  Owner component. When destroyed, the owner will destroy this SplineCurve as well.
     * @param cfg Configs
     * @param [cfg.id] Optional ID, unique among all components in the parent {@link Scene}, generated automatically when omitted.
     * @param {Array} [cfg.points=[]] Control points on this SplineCurve.
     * @param [cfg.t=0] Current position on this SplineCurve, in range between 0..1.
     * @param [cfg.t=0] Current position on this CubicBezierCurve, in range between 0..1.
     */
    constructor(owner: Component, cfg: {
        points: math.FloatArrayType[],
        t: 0
    } = {
        points: [],
        t: 0
    }) {
        super(owner, cfg);
        this.points = cfg.points;
        this.t = cfg.t;
    }

    /**
     * Sets the control points on this SplineCurve.
     *
     * Default value is ````[]````.
     *
     * @param value New control points.
     */
    set points(value: math.FloatArrayType[]) {
        this.#points = value || [];
    }

    /**
     * Gets the control points on this SplineCurve.
     *
     * Default value is ````[]````.
     *
     * @returns {Number[]} The control points.
     */
    get points(): math.FloatArrayType[] {
        return this.#points;
    }

    /**
     * Sets the progress along this SplineCurve.
     *
     * Automatically clamps to range ````[0..1]````.
     *
     * Default value is ````0````.
     *
     * @param value The new progress.
     */
    set t(value: number) {
        value = value || 0;
        this._t = value < 0.0 ? 0.0 : (value > 1.0 ? 1.0 : value);
    }

    /**
     * Gets the progress along this SplineCurve.
     *
     * Automatically clamps to range ````[0..1]````.
     *
     * Default value is ````0````.
     *
     * @returns {Number} The new progress.
     */
    get t(): number {
        return this._t;
    }

    /**
     * Gets the point on this SplineCurve at position {@link SplineCurve#t}.
     *
     * @returns {Number[]} The point at {@link SplineCurve#t}.
     */
    get point(): math.FloatArrayType{
        return this.getPoint(this._t);
    }

    /**
     * Returns point on this SplineCurve at the given position.
     *
     * @param t Position to get point at.
     * @param result Point at the given position.
     * @returns {Number[]} Point at the given position.
     */
    getPoint(t: number, result?: math.FloatArrayType): math.FloatArrayType{

        if (!result) {
            result = math.vec3();
        }

        let points = this.points;

        if (points.length < 3) {
            this.error("Can't sample point from SplineCurve - not enough points on curve - returning [0,0,0].");
            return;
        }

        let point = (points.length - 1) * t;

        let intPoint = Math.floor(point);
        let weight = point - intPoint;

        let point0 = points[intPoint === 0 ? intPoint : intPoint - 1];
        let point1 = points[intPoint];
        let point2 = points[intPoint > points.length - 2 ? points.length - 1 : intPoint + 1];
        let point3 = points[intPoint > points.length - 3 ? points.length - 1 : intPoint + 2];

        result[0] = math.catmullRomInterpolate(point0[0], point1[0], point2[0], point3[0], weight);
        result[1] = math.catmullRomInterpolate(point0[1], point1[1], point2[1], point3[1], weight);
        result[2] = math.catmullRomInterpolate(point0[2], point1[2], point2[2], point3[2], weight);

        return result;
    }

}

export {SplineCurve}