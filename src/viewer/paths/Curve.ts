import {Component} from "../Component"
import * as math from "../math/index";

/**
 * Abstract base class for curve classes.
 */
abstract class Curve extends Component {
    protected _t: number;
    #arcLengthDivisions: number;
    private cacheArcLengths: number[];
    private needsUpdate: Boolean;

    /**
     * @constructor
     * @param owner  Owner component. When destroyed, the owner will destroy this Curve as well.
     * @param cfg Configs for this Curve.
     * @param cfg.t Current position on this Curve, in range between ````0..1````.
     */
    constructor(owner: Component, cfg?: {
        t?: number
    }) {
        super(owner, cfg);
        this.t = cfg.t;
    }

    /**
     * Returns point on this Curve at the given position.
     *
     * @param t Position to get point at.
     * @returns {Number[]} Point at the given position.
     */
    abstract getPoint(t: number, result?: math.FloatArrayType): math.FloatArrayType ;

    /**
     * Sets the progress along this Curve.
     *
     * Automatically clamps to range ````[0..1]````.
     *
     * Default value is ````0````.
     *
     * @param value The progress value.
     */
    set t(value: number) {
        value = value || 0;
        this._t = value < 0.0 ? 0.0 : (value > 1.0 ? 1.0 : value);
    }

    /**
     * Gets the progress along this Curve.
     *
     * @returns {Number} The progress value.
     */
    get t(): number {
        return this._t;
    }

    /**
     * Gets the tangent on this Curve at position {@link Curve#t}.
     *
     * @returns {{math.FloatArrayType}} The tangent.
     */
    get tangent(): math.FloatArrayType {
        return this.getTangent(this._t);
    }

    /**
     * Gets the length of this Curve.
     *
     * @returns {Number} The Curve length.
     */
    get length(): number {
        let lengths = this._getLengths();
        return lengths[lengths.length - 1];
    }

    /**
     * Returns a normalized tangent vector on this Curve at the given position.
     *
     * @param t Position to get tangent at.
     * @returns {{math.FloatArrayType}} Normalized tangent vector
     */
    getTangent(t: number): math.FloatArrayType {
        let delta = 0.0001;
        if (t === undefined) {
            t = this._t;
        }
        let t1 = t - delta;
        let t2 = t + delta;
        if (t1 < 0) {
            t1 = 0;
        }
        if (t2 > 1) {
            t2 = 1;
        }
        let pt1 = this.getPoint(t1);
        let pt2 = this.getPoint(t2);
        let vec = math.subVec3(pt2, pt1, []);
        return math.normalizeVec3(vec, []);
    }

    getPointAt(u: number = 0): math.FloatArrayType {
        let t = this.getUToTMapping(u);
        return this.getPoint(t);
    }

    /**
     * Samples points on this Curve, at the given number of equally-spaced divisions.
     *
     * @param divisions The number of divisions.
     * @returns {{Array of Array}} Array of sampled 3D points.
     */
    getPoints(divisions: number = 5): math.FloatArrayType[] {
        if (!divisions) {
            divisions = 5;
        }
        let d, pts = [];
        for (d = 0; d <= divisions; d++) {
            pts.push(this.getPoint(d / divisions));
        }
        return pts;
    }

    _getLengths(divisions: number = 200): math.FloatArrayType {
        if (!divisions) {
            divisions = (this.#arcLengthDivisions) ? (this.#arcLengthDivisions) : 200;
        }
        if (this.cacheArcLengths && (this.cacheArcLengths.length === divisions + 1) && !this.needsUpdate) {
            return this.cacheArcLengths;

        }
        this.needsUpdate = false;
        let cache = [];
        let current;
        let last = this.getPoint(0);
        let p;
        let sum = 0;
        cache.push(0);
        for (p = 1; p <= divisions; p++) {
            current = this.getPoint(p / divisions);
            sum += math.lenVec3(math.subVec3(current, last, []));
            cache.push(sum);
            last = current;
        }
        this.cacheArcLengths = cache;
        return cache; // { sums: cache, sum:sum }, Sum is in the last element.
    }

    #updateArcLengths() {
        this.needsUpdate = true;
        this._getLengths();
    }

    getUToTMapping(u: number = 0, distance: number = 0): number {
        let arcLengths = this._getLengths();
        let i = 0;
        let il = arcLengths.length;
        let t;
        let targetArcLength; // The targeted u distance value to get
        if (distance) {
            targetArcLength = distance;
        } else {
            targetArcLength = u * arcLengths[il - 1];
        }
        //let time = Date.now();
        let low = 0, high = il - 1, comparison;
        while (low <= high) {
            i = Math.floor(low + (high - low) / 2); // less likely to overflow, though probably not issue here, JS doesn't really have integers, all numbers are floats
            comparison = arcLengths[i] - targetArcLength;
            if (comparison < 0) {
                low = i + 1;
            } else if (comparison > 0) {
                high = i - 1;
            } else {
                high = i;
                break;
                // DONE
            }
        }
        i = high;
        if (arcLengths[i] === targetArcLength) {
            t = i / (il - 1);
            return t;
        }
        let lengthBefore = arcLengths[i];
        let lengthAfter = arcLengths[i + 1];
        let segmentLength = lengthAfter - lengthBefore;
        let segmentFraction = (targetArcLength - lengthBefore) / segmentLength;
        t = (i + segmentFraction) / (il - 1);
        return t;
    }
}

export {Curve}