import { SplineCurve } from "../../base/math/curves/SplineCurve";
import { subVec3, lenVec3, type Vec3, createVec3Float64 } from "../../base/math/vector";

const tempVec3a = createVec3Float64();

type CameraPathFrame = {
  t: number;
  eye: Vec3;
  look: Vec3;
  up: Vec3;
};

type CameraLike = {
  eye: Vec3;
  look: Vec3;
  up: Vec3;
};

type SceneLike = {
  camera: CameraLike;
};

/**
 * Sequence of camera frames that can be sampled or played back over time.
 *
 * Stores frame data plus spline curves for eye, look, and up.
 */
class CameraPath {
  protected _frames: CameraPathFrame[] = [];
  protected _eyeCurve: SplineCurve;
  protected _lookCurve: SplineCurve;
  protected _upCurve: SplineCurve;

  /**
   * The target camera.
   */
  camera: CameraLike;

  /**
   * Creates a camera path.
   *
   * @param camera The camera to control with this path. The camera's eye, look, and up will be sampled when saving frames and updated when loading frames.
   * @param cfg Configuration options
   * @param cfg.frames Initial frames to add to the path
   */
  constructor(camera: CameraLike, cfg: { frames?: CameraPathFrame[] } = {}) {
    this.camera = camera;

    this._eyeCurve = new SplineCurve();
    this._lookCurve = new SplineCurve();
    this._upCurve = new SplineCurve();

    if (cfg.frames) {
      this.addFrames(cfg.frames);
      this.smoothFrameTimes(1);
    }
  }

  /**
   * Frames in insertion order.
   */
  get frames(): CameraPathFrame[] {
    return this._frames;
  }

  /**
   * Spline for camera eye positions.
   */
  get eyeCurve(): SplineCurve {
    return this._eyeCurve;
  }

  /**
   * Spline for camera look positions.
   */
  get lookCurve(): SplineCurve {
    return this._lookCurve;
  }

  /**
   * Spline for camera up vectors.
   */
  get upCurve(): SplineCurve {
    return this._upCurve;
  }

  /**
   * Captures the current camera state as a new frame.
   *
   * @param t Time for the new frame
   */
  saveFrame(t: number): void {
    const camera = this.camera;
    this.addFrame(t, camera.eye, camera.look, camera.up);
  }

  /**
   * Adds a frame to the path.
   *
   * Vector values are copied before storage.
   *
   * @param t Time for the new frame
   * @param eye Eye position
   * @param look Look position
   * @param up Up vector
   */
  addFrame(t: number, eye: Vec3, look: Vec3, up: Vec3): void {
    const frame: CameraPathFrame = {
      t,
      eye: eye.slice(0) as Vec3,
      look: look.slice(0) as Vec3,
      up: up.slice(0) as Vec3
    };

    this._frames.push(frame);
    this._eyeCurve.points.push(frame.eye);
    this._lookCurve.points.push(frame.look);
    this._upCurve.points.push(frame.up);
  }

  /**
   * Adds multiple frames to the path.
   *
   * @param frames Frames to append
   */
  addFrames(frames: CameraPathFrame[]): void {
    for (let i = 0, len = frames.length; i < len; i++) {
      const frame = frames[i];
      this.addFrame(frame.t || 0, frame.eye, frame.look, frame.up);
    }
  }

  /**
   * Loads the interpolated camera state at the given path time.
   *
   * Input time is normalized using the first and last frame times.
   *
   * @param t Time along the path
   */
  loadFrame(t: number): void {
    if (this._frames.length === 0) {
      return;
    }

    const camera = this.camera;
    const startTime = this._frames[0].t;
    const endTime = this._frames[this._frames.length - 1].t;
    const range = endTime - startTime;

    t = range !== 0 ? t / range : 0;
    t = t < 0.0 ? 0.0 : t > 1.0 ? 1.0 : t;

    camera.eye = this._eyeCurve.getPoint(t);
    camera.look = this._lookCurve.getPoint(t);
    camera.up = this._upCurve.getPoint(t);
  }

  /**
   * Samples the path at normalized parameter `t`.
   *
   * @param t Normalized parameter in the range `[0..1]`
   * @param eye Target eye vector to write into
   * @param look Target look vector to write into
   * @param up Target up vector to write into
   */
  sampleFrame(t: number, eye: Vec3, look: Vec3, up: Vec3): void {
    t = t < 0.0 ? 0.0 : t > 1.0 ? 1.0 : t;

    const eyePoint = this._eyeCurve.getPoint(t);
    const lookPoint = this._lookCurve.getPoint(t);
    const upPoint = this._upCurve.getPoint(t);

    eye[0] = eyePoint[0];
    eye[1] = eyePoint[1];
    eye[2] = eyePoint[2];

    look[0] = lookPoint[0];
    look[1] = lookPoint[1];
    look[2] = lookPoint[2];

    up[0] = upPoint[0];
    up[1] = upPoint[1];
    up[2] = upPoint[2];
  }

  /**
   * Redistributes frame times so camera motion is closer to constant speed.
   *
   * Uses distance between consecutive eye positions.
   *
   * @param duration Total duration to distribute across all frames
   */
  smoothFrameTimes(duration: number): void {
    const numFrames = this._frames.length;

    if (numFrames === 0) {
      return;
    }

    const vec = createVec3Float64();
    let totalLen = 0;
    this._frames[0].t = 0;

    const lens: number[] = [];

    for (let i = 1, len = this._frames.length; i < len; i++) {
      const lenVec = lenVec3(subVec3(this._frames[i].eye, this._frames[i - 1].eye, vec));
      lens[i] = lenVec;
      totalLen += lenVec;
    }

    for (let i = 1, len = this._frames.length; i < len; i++) {
      const interFrameRate = totalLen !== 0 ? (lens[i] / totalLen) * duration : 0;
      this._frames[i].t = this._frames[i - 1].t + interFrameRate;
    }
  }

  /**
   * Removes all frames and clears all spline control points.
   */
  clearFrames(): void {
    this._frames = [];
    this._eyeCurve.points = [];
    this._lookCurve.points = [];
    this._upCurve.points = [];
  }
}

export { CameraPath };
export type { CameraPathFrame, CameraLike, SceneLike };
