import { CameraFlightAnimation } from "./CameraFlightAnimation";
import { type CameraPath, type CameraLike, type SceneLike } from "./CameraPath";

type TickEvent = {
  deltaTime?: number;
};

type TickListener = (tickEvent?: TickEvent) => void;

type SceneWithEvents = SceneLike & {
  on(event: "tick", callback: TickListener): unknown;
  off(handle: unknown): void;
};

enum CameraPathAnimationState {
  STOPPED = 0,
  SCRUBBING = 1,
  PLAYING = 2,
  PLAYING_TO = 3
}

/**
 * Animates a camera along a {@link CameraPath}.
 *
 * Supports continuous playback, playback to a target time, scrubbing, and
 * direct flight to a recorded frame.
 */
class CameraPathAnimation {
  protected _cameraFlightAnimation: CameraFlightAnimation;
  protected _cameraPath?: CameraPath;
  protected _t = 0;
  protected _playingFromT = 0;
  protected _playingToT = 0;
  protected _playingRate = 1.0;
  protected _playingDir = 1.0;
  protected _lastTime: number | null = null;
  protected _tick: unknown;

  /**
   * Current playback state.
   */
  state = CameraPathAnimationState.SCRUBBING;

  /**
   * Scene containing the camera and tick event source.
   */
  scene: SceneWithEvents;

  /**
   * Creates a camera path animation.
   *
   * @param scene Scene containing the target camera
   * @param cfg Configuration options
   * @param cfg.cameraPath Path to animate along
   * @param cfg.playingRate Playback rate in time units per second
   */
  constructor(
    scene: SceneWithEvents,
    cfg: {
      cameraPath?: CameraPath;
      playingRate?: number;
    } = {}
  ) {
    this.scene = scene;
    this._cameraFlightAnimation = new CameraFlightAnimation(scene as never);
    this._playingRate = cfg.playingRate ?? 1.0;
    this.cameraPath = cfg.cameraPath;

    this._tick = this.scene.on("tick", this._updateT);
  }

  /**
   * Advances animation state on each scene tick.
   */
  protected _updateT = (): void => {
    const cameraPath = this._cameraPath;

    if (!cameraPath) {
      return;
    }

    let numFrames: number;
    let t: number;

    const time = performance.now();
    const elapsedSecs = this._lastTime !== null ? (time - this._lastTime) * 0.001 : 0;
    this._lastTime = time;

    if (elapsedSecs === 0) {
      return;
    }

    switch (this.state) {
      case CameraPathAnimationState.SCRUBBING:
      case CameraPathAnimationState.STOPPED:
        return;

      case CameraPathAnimationState.PLAYING:
        this._t += this._playingRate * elapsedSecs;
        numFrames = cameraPath.frames.length;

        if (
          numFrames === 0 ||
          (this._playingDir < 0 && this._t <= 0) ||
          (this._playingDir > 0 && this._t >= cameraPath.frames[numFrames - 1].t)
        ) {
          this.state = CameraPathAnimationState.SCRUBBING;
          this._t = numFrames > 0 ? cameraPath.frames[numFrames - 1].t : 0;
          this._onStopped();
          return;
        }

        cameraPath.loadFrame(this._t);
        break;

      case CameraPathAnimationState.PLAYING_TO:
        t = this._t + this._playingRate * elapsedSecs * this._playingDir;

        if (
          (this._playingDir < 0 && t <= this._playingToT) ||
          (this._playingDir > 0 && t >= this._playingToT)
        ) {
          t = this._playingToT;
          this.state = CameraPathAnimationState.SCRUBBING;
          this._onStopped();
        }

        this._t = t;
        cameraPath.loadFrame(this._t);
        break;
    }
  };

  /**
   * Simple quadratic ease-out helper.
   *
   * @param t Current time
   * @param b Start value
   * @param c Delta value
   * @param d Duration
   * @returns Interpolated value
   */
  protected _ease(t: number, b: number, c: number, d: number): number {
    t /= d;
    return -c * t * (t - 2) + b;
  }

  /**
   * Path currently animated by this instance.
   */
  set cameraPath(value: CameraPath | undefined) {
    this._cameraPath = value;
  }

  get cameraPath(): CameraPath | undefined {
    return this._cameraPath;
  }

  /**
   * Playback rate in time units per second.
   */
  set rate(value: number) {
    this._playingRate = value;
  }

  get rate(): number {
    return this._playingRate;
  }

  /**
   * Starts playback from the current time.
   */
  play(): void {
    if (!this._cameraPath) {
      return;
    }

    this._lastTime = null;
    this._playingDir = 1.0;
    this.state = CameraPathAnimationState.PLAYING;
  }

  /**
   * Plays from the current time to the target time.
   *
   * @param t Target time on the path
   */
  playToT(t: number): void {
    const cameraPath = this._cameraPath;

    if (!cameraPath) {
      return;
    }

    this._playingFromT = this._t;
    this._playingToT = t;
    this._playingDir = this._playingToT - this._playingFromT < 0 ? -1 : 1;
    this._lastTime = null;
    this.state = CameraPathAnimationState.PLAYING_TO;
  }

  /**
   * Plays from the current time to the given frame.
   *
   * @param frameIdx Frame index
   */
  playToFrame(frameIdx: number): void {
    const cameraPath = this._cameraPath;

    if (!cameraPath) {
      return;
    }

    const frame = cameraPath.frames[frameIdx];

    if (!frame) {
      throw new Error(`playToFrame - frame index out of range: ${frameIdx}`);
    }

    this.playToT(frame.t);
  }

  /**
   * Flies directly to a frame using {@link CameraFlightAnimation}.
   *
   * @param frameIdx Frame index
   * @param ok Callback fired when the flight completes
   */
  flyToFrame(frameIdx: number, ok?: () => void): void {
    const cameraPath = this._cameraPath;

    if (!cameraPath) {
      return;
    }

    const frame = cameraPath.frames[frameIdx];

    if (!frame) {
      throw new Error(`flyToFrame - frame index out of range: ${frameIdx}`);
    }

    this.state = CameraPathAnimationState.SCRUBBING;
    this._cameraFlightAnimation.flyTo(frame, ok);
  }

  /**
   * Scrubs directly to a time on the path.
   *
   * @param t Time on the path
   */
  scrubToT(t: number): void {
    const cameraPath = this._cameraPath;
    const camera = this.scene.camera;

    if (!cameraPath || !camera) {
      return;
    }

    this._t = t;
    cameraPath.loadFrame(this._t);
    this.state = CameraPathAnimationState.SCRUBBING;
  }

  /**
   * Scrubs directly to a recorded frame.
   *
   * @param frameIdx Frame index
   */
  scrubToFrame(frameIdx: number): void {
    const cameraPath = this._cameraPath;
    const camera = this.scene.camera;

    if (!cameraPath || !camera) {
      return;
    }

    const frame = cameraPath.frames[frameIdx];

    if (!frame) {
      throw new Error(`scrubToFrame - frame index out of range: ${frameIdx}`);
    }

    this._t = frame.t;
    cameraPath.loadFrame(this._t);
    this.state = CameraPathAnimationState.SCRUBBING;
  }

  /**
   * Stops playback.
   */
  stop(): void {
    this.state = CameraPathAnimationState.SCRUBBING;
    this._onStopped();
  }

  /**
   * Releases scene event subscriptions.
   */
  destroy(): void {
    this.scene.off(this._tick);
  }

  /**
   * Internal stopped hook.
   *
   * Replace or extend if you add an event system.
   */
  protected _onStopped(): void {
    // no-op
  }

  static readonly STOPPED = CameraPathAnimationState.STOPPED;
  static readonly SCRUBBING = CameraPathAnimationState.SCRUBBING;
  static readonly PLAYING = CameraPathAnimationState.PLAYING;
  static readonly PLAYING_TO = CameraPathAnimationState.PLAYING_TO;
}

export { CameraPathAnimation, CameraPathAnimationState };
export type { SceneWithEvents, TickEvent, TickListener, CameraLike };
