import { Curve } from "./Curve";
import { type Vec3, createVec3Float64 } from "../vector";
import { catmullRomInterpolate } from "./index";

/**
 * A Curve along which a 3D position can be animated.
 *
 * - A SplineCurve is defined by three or more control points.
 * - You can sample a point and a tangent vector on a SplineCurve for any given value of t in the range [0..1].
 * - When you set t on a SplineCurve, its point and tangent update accordingly.
 */
class SplineCurve extends Curve {

  protected _points: Vec3[] = [];

  /**
   * @param cfg Configs
   * @param cfg.points Control points on this SplineCurve.
   * @param cfg.t Current position on this SplineCurve, in range between 0..1.
   */
  constructor(cfg: { points?: Vec3[]; t?: number } = {}) {
    super(cfg);
    this.points = cfg.points ?? [];
    this.t = cfg.t ?? 0;
  }

  /**
   * Sets the control points on this SplineCurve.
   *
   * Default value is [].
   */
  set points(value: Vec3[]) {
    this._points = value || [];
    this._updateArcLengths();
  }

  /**
   * Gets the control points on this SplineCurve.
   *
   * Default value is [].
   */
  get points(): Vec3[] {
    return this._points;
  }

  /**
   * Gets the point on this SplineCurve at position t.
   */
  get point(): Vec3 {
    return this.getPoint(this._t);
  }

  /**
   * Returns point on this SplineCurve at the given position.
   */
  getPoint(t: number): Vec3 {
    const points = this.points;

    if (points.length < 3) {
      return createVec3Float64();
    }

    const point = (points.length - 1) * t;

    const intPoint = Math.floor(point);
    const weight = point - intPoint;

    const point0 = points[intPoint === 0 ? intPoint : intPoint - 1];
    const point1 = points[intPoint];
    const point2 = points[intPoint > points.length - 2 ? points.length - 1 : intPoint + 1];
    const point3 = points[intPoint > points.length - 3 ? points.length - 1 : intPoint + 2];

    const vector = createVec3Float64();

    vector[0] = catmullRomInterpolate(point0[0], point1[0], point2[0], point3[0], weight);
    vector[1] = catmullRomInterpolate(point0[1], point1[1], point2[1], point3[1], weight);
    vector[2] = catmullRomInterpolate(point0[2], point1[2], point2[2], point3[2], weight);

    return vector;
  }

  getJSON(): { points: Vec3[]; t: number } {
    return {
      points: this._points,
      t: this._t
    };
  }
}

export { SplineCurve };
