import {subVec3, type Vec3, createVec3Float64, normalizeVec3, lenVec3} from "../vector";

/**
 * Base class for parametric 3D curves.
 *
 * Curves are sampled over `t` in the range `[0..1]` and provide helpers for
 * point, tangent, arc-length, and uniform-distance sampling.
 */
abstract class Curve  {
  protected _t: number = 0;
  protected __arcLengthDivisions?: number;
  protected cacheArcLengths?: number[];
  protected needsUpdate?: boolean;

  /**
   * Creates a curve.
   *
   * @param cfg Configuration options
   * @param cfg.t Initial curve parameter in the range `[0..1]`
   */
  constructor(cfg: { t?: number } = {}) {
    this.t = cfg.t ?? 0;
  }

  /**
   * Current curve parameter.
   *
   * Clamped to the range `[0..1]`.
   */
  set t(value: number) {
    value = value || 0;
    this._t = value < 0.0 ? 0.0 : value > 1.0 ? 1.0 : value;
  }

  get t(): number {
    return this._t;
  }

  /**
   * Normalized tangent at the current {@link t}.
   */
  get tangent(): Vec3 {
    return this.getTangent(this._t);
  }

  /**
   * Approximate arc length of the curve.
   *
   * Computed from cached sampled lengths.
   */
  get length(): number {
    const lengths = this._getLengths();
    return lengths[lengths.length - 1];
  }

  /**
   * Returns the normalized tangent at parameter `t`.
   *
   * Uses a small finite difference around `t`.
   *
   * @param t Curve parameter in the range `[0..1]`. Defaults to the current {@link t}.
   * @returns Normalized tangent vector
   */
  getTangent(t?: number): Vec3 {
    const delta = 0.0001;

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

    const pt1 = this.getPoint(t1);
    const pt2 = this.getPoint(t2);
    const vec = subVec3(pt2, pt1, createVec3Float64());
    return normalizeVec3(vec, createVec3Float64());
  }

  /**
   * Returns a point using normalized arc-length parameterization.
   *
   * Unlike {@link getPoint}, `u` maps to distance along the curve rather than
   * directly to the curve parameter.
   *
   * @param u Normalized distance along the curve in the range `[0..1]`
   * @returns Point on the curve
   */
  getPointAt(u: number): Vec3 {
    const t = this.getUToTMapping(u);
    return this.getPoint(t);
  }

  /**
   * Samples points at evenly spaced parameter intervals.
   *
   * @param divisions Number of intervals to divide `[0..1]` into
   * @returns Sampled points, including both endpoints
   */
  getPoints(divisions: number = 5): Vec3[] {
    const pts: Vec3[] = [];

    for (let d = 0; d <= divisions; d++) {
      pts.push(this.getPoint(d / divisions));
    }

    return pts;
  }

  /**
   * Returns cumulative sampled arc lengths for the curve.
   *
   * The returned array starts at `0` and ends at the total sampled length.
   * Results are cached until invalidated.
   *
   * @param divisions Number of sampling divisions used to approximate arc length
   * @returns Cumulative arc lengths
   */
  protected _getLengths(divisions?: number): number[] {
    if (!divisions) {
      divisions = this.__arcLengthDivisions ? this.__arcLengthDivisions : 200;
    }

    if (
      this.cacheArcLengths &&
      this.cacheArcLengths.length === divisions + 1 &&
      !this.needsUpdate
    ) {
      return this.cacheArcLengths;
    }

    this.needsUpdate = false;

    const cache: number[] = [];
    let current: Vec3;
    let last = this.getPoint(0);
    let sum = 0;

    cache.push(0);

    for (let p = 1; p <= divisions; p++) {
      current = this.getPoint(p / divisions);
      sum += lenVec3(subVec3(current, last, createVec3Float64()));
      cache.push(sum);
      last = current;
    }

    this.cacheArcLengths = cache;
    return cache;
  }

  /**
   * Invalidates cached arc-length data and rebuilds it.
   */
  protected _updateArcLengths(): void {
    this.needsUpdate = true;
    this._getLengths();
  }

  /**
   * Maps normalized arc-length parameter `u` to curve parameter `t`.
   *
   * This is useful when you want points spaced by distance along the curve
   * instead of by raw parameter value.
   *
   * @param u Normalized distance along the curve in the range `[0..1]`
   * @param distance Absolute distance along the curve. When provided, overrides `u`.
   * @returns Curve parameter in the range `[0..1]`
   */
  getUToTMapping(u: number, distance?: number): number {
    const arcLengths = this._getLengths();
    let i = 0;
    const il = arcLengths.length;
    let t: number;
    let targetArcLength: number;

    if (distance) {
      targetArcLength = distance;
    } else {
      targetArcLength = u * arcLengths[il - 1];
    }

    let low = 0;
    let high = il - 1;
    let comparison: number;

    while (low <= high) {
      i = Math.floor(low + (high - low) / 2);
      comparison = arcLengths[i] - targetArcLength;

      if (comparison < 0) {
        low = i + 1;
      } else if (comparison > 0) {
        high = i - 1;
      } else {
        high = i;
        break;
      }
    }

    i = high;

    if (arcLengths[i] === targetArcLength) {
      t = i / (il - 1);
      return t;
    }

    const lengthBefore = arcLengths[i];
    const lengthAfter = arcLengths[i + 1];
    const segmentLength = lengthAfter - lengthBefore;
    const segmentFraction = (targetArcLength - lengthBefore) / segmentLength;

    t = (i + segmentFraction) / (il - 1);
    return t;
  }

  /**
   * Samples the curve at parameter `t`.
   *
   * @param t Curve parameter in the range `[0..1]`
   * @returns Point on the curve
   */
  abstract getPoint(t: number): Vec3;
}

export { Curve };
