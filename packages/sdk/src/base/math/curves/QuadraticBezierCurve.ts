import { Curve } from "./Curve";
import { type Vec3, createVec3Float64 } from "../vector";
import { b2 } from "./index";

/**
 * A QuadraticBezierCurve is a Curve along which a 3D position can be animated.
 */
class QuadraticBezierCurve extends Curve {
  private _v0: Vec3 = createVec3Float64();
  private _v1: Vec3 = createVec3Float64();
  private _v2: Vec3 = createVec3Float64();

  /**
   * @param cfg Configuration
   * @param cfg.v0 The starting point.
   * @param cfg.v1 The middle control point.
   * @param cfg.v2 The end point.
   * @param cfg.t Current position on this QuadraticBezierCurve, in range between 0..1.
   */
  constructor(cfg: { v0?: Vec3; v1?: Vec3; v2?: Vec3; t?: number } = {}) {
    super(cfg);
    this.v0 = cfg.v0 ?? createVec3Float64();
    this.v1 = cfg.v1 ?? createVec3Float64();
    this.v2 = cfg.v2 ?? createVec3Float64();
    this.t = cfg.t ?? 0;
  }

  /**
   * Sets the starting point on this QuadraticBezierCurve.
   *
   * Default value is [0, 0, 0].
   */
  set v0(value: Vec3) {
    this._v0 = value || createVec3Float64();
    this._updateArcLengths();
  }

  /**
   * Gets the starting point on this QuadraticBezierCurve.
   */
  get v0(): Vec3 {
    return this._v0;
  }

  /**
   * Sets the middle control point on this QuadraticBezierCurve.
   *
   * Default value is [0, 0, 0].
   */
  set v1(value: Vec3) {
    this._v1 = value || createVec3Float64();
    this._updateArcLengths();
  }

  /**
   * Gets the middle control point on this QuadraticBezierCurve.
   */
  get v1(): Vec3 {
    return this._v1;
  }

  /**
   * Sets the end point on this QuadraticBezierCurve.
   *
   * Default value is [0, 0, 0].
   */
  set v2(value: Vec3) {
    this._v2 = value || createVec3Float64();
    this._updateArcLengths();
  }

  /**
   * Gets the end point on this QuadraticBezierCurve.
   */
  get v2(): Vec3 {
    return this._v2;
  }

  /**
   * Point on this QuadraticBezierCurve at position t.
   */
  get point(): Vec3 {
    return this.getPoint(this._t);
  }

  /**
   * Returns the point on this QuadraticBezierCurve at the given position.
   */
  getPoint(t: number): Vec3 {
    const vector = createVec3Float64();
    vector[0] = b2(t, this._v0[0], this._v1[0], this._v2[0]);
    vector[1] = b2(t, this._v0[1], this._v1[1], this._v2[1]);
    vector[2] = b2(t, this._v0[2], this._v1[2], this._v2[2]);
    return vector;
  }

  getJSON(): { v0: Vec3; v1: Vec3; v2: Vec3; t: number } {
    return {
      v0: this._v0,
      v1: this._v1,
      v2: this._v2,
      t: this._t
    };
  }
}

export { QuadraticBezierCurve };
