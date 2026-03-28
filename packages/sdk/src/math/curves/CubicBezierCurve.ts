import { Curve } from "./Curve";
import { type Vec3, createVec3Float64 } from "../vector";
import { b3 } from "./index";

/**
 * A Curve along which a 3D position can be animated.
 *
 * A CubicBezierCurve is defined by four control points.
 */
class CubicBezierCurve extends Curve {
  protected _v0: Vec3 = createVec3Float64();
  protected _v1: Vec3 = createVec3Float64();
  protected _v2: Vec3 = createVec3Float64();
  protected _v3: Vec3 = createVec3Float64();

  /**
   * @param cfg Configs
   * @param cfg.v0 The starting point.
   * @param cfg.v1 The first control point.
   * @param cfg.v2 The second control point.
   * @param cfg.v3 The ending point.
   * @param cfg.t Current position on this CubicBezierCurve, in range between 0..1.
   */
  constructor(cfg: { v0?: Vec3; v1?: Vec3; v2?: Vec3; v3?: Vec3; t?: number } = {}) {
    super(cfg);

    this.v0 = cfg.v0 ?? createVec3Float64();
    this.v1 = cfg.v1 ?? createVec3Float64();
    this.v2 = cfg.v2 ?? createVec3Float64();
    this.v3 = cfg.v3 ?? createVec3Float64();
    this.t = cfg.t ?? 0;
  }

  /**
   * Starting point.
   */
  set v0(value: Vec3) {
    this._v0 = value || createVec3Float64();
    this._updateArcLengths();
  }

  get v0(): Vec3 {
    return this._v0;
  }

  /**
   * First control point.
   */
  set v1(value: Vec3) {
    this._v1 = value || createVec3Float64();
    this._updateArcLengths();
  }

  get v1(): Vec3 {
    return this._v1;
  }

  /**
   * Second control point.
   */
  set v2(value: Vec3) {
    this._v2 = value || createVec3Float64();
    this._updateArcLengths();
  }

  get v2(): Vec3 {
    return this._v2;
  }

  /**
   * End point.
   */
  set v3(value: Vec3) {
    this._v3 = value || createVec3Float64();
    this._updateArcLengths();
  }

  get v3(): Vec3 {
    return this._v3;
  }

  /**
   * Point on the curve at the current t.
   */
  get point(): Vec3 {
    return this.getPoint(this._t);
  }

  /**
   * Returns point on this CubicBezierCurve at the given position.
   */
  getPoint(t: number): Vec3 {
    const vector = createVec3Float64();

    vector[0] = b3(t, this._v0[0], this._v1[0], this._v2[0], this._v3[0]);
    vector[1] = b3(t, this._v0[1], this._v1[1], this._v2[1], this._v3[1]);
    vector[2] = b3(t, this._v0[2], this._v1[2], this._v2[2], this._v3[2]);

    return vector;
  }

  /**
   *
   */
  getJSON(): { v0: Vec3; v1: Vec3; v2: Vec3; v3: Vec3; t: number } {
    return {
      v0: this._v0,
      v1: this._v1,
      v2: this._v2,
      v3: this._v3,
      t: this._t
    };
  }
}

export { CubicBezierCurve };
