import type {AnnualSunPlayerParams} from "./AnnualSunPlayerParams";
import type {SunStudy} from "./SunStudy";
import {EventEmitter, SDKTask} from "@xeokit/sdk/base/core";
import {EventDispatcher} from "strongly-typed-events";


const MS_PER_DAY  = 24 * 60 * 60 * 1000;
const MS_PER_YEAR = 365.2422 * MS_PER_DAY;   // tropical year, good enough


/**
 * Plays a SunStudy's date cursor on a loop — sweeps either a single
 * day (sunrise → sunset → next sunrise) or a whole year (Jan 1 →
 * Dec 31 → Jan 1) at the configured wall-clock pace.
 *
 * Uses the SDK's cooperative scheduler: a repeating
 * {@link base!core.SDKTask | SDKTask} on the `AnimateStage` ticks
 * every frame and advances the SunStudy's `currentDate` by an
 * amount derived from `dtRealSeconds * (mode === "day"
 * ? MS_PER_DAY/duration : MS_PER_YEAR/duration)`. Same pattern as
 * `SchedulePlayer` — non-repeating self-rescheduling tasks fall off
 * the runner the same frame they execute (see the
 * `CameraFlightAnimation` rewrite earlier in the SDK for the bug
 * history), so a repeating task gated on `_playing` is the right
 * pattern.
 *
 * Switching modes mid-playback re-anchors the cursor's "carried
 * coordinate" — switching from day to year preserves the current
 * hour-of-day across the rest of the sweep; switching from year to
 * day preserves the current date.
 *
 * @module presentations/sunStudy
 */
export class AnnualSunPlayer {

  public readonly sunStudy: SunStudy;

  /** Real-time seconds per full sweep of the active mode. */
  public durationSeconds: number;

  public readonly onPlay:  EventEmitter<AnnualSunPlayer, null>;
  public readonly onPause: EventEmitter<AnnualSunPlayer, null>;
  public readonly onModeChanged: EventEmitter<AnnualSunPlayer, "day" | "year">;

  private _mode: "day" | "year";
  private _playing: boolean;
  private _destroyed: boolean;
  private _lastTickMs: number;
  private _animationTask: SDKTask;

  constructor(params: AnnualSunPlayerParams) {

    if (!params || !params.sunStudy) {
      throw new Error("[AnnualSunPlayer] params.sunStudy is required");
    }
    this.sunStudy = params.sunStudy;

    this._mode  = params.mode ?? "day";
    this.durationSeconds = params.durationSeconds ?? (this._mode === "day" ? 8 : 30);
    this._playing    = false;
    this._destroyed  = false;
    this._lastTickMs = 0;

    this.onPlay        = new EventEmitter(new EventDispatcher<AnnualSunPlayer, null>());
    this.onPause       = new EventEmitter(new EventDispatcher<AnnualSunPlayer, null>());
    this.onModeChanged = new EventEmitter(new EventDispatcher<AnnualSunPlayer, "day" | "year">());

    this._animationTask = new SDKTask({
      name:   "AnnualSunPlayer.tick",
      stage:  SDKTask.AnimateStage,
      repeat: true,
      task:   () => this._tick(),
    });

    if (params.autoPlay) this.play();
  }

  public get mode():    "day" | "year" { return this._mode;    }
  public get playing(): boolean        { return this._playing; }

  public set mode(m: "day" | "year") {
    if (m === this._mode || this._destroyed) return;
    this._mode = m;
    // Snap the cursor to a clean starting boundary for the new mode.
    // For "day" mode, reset to midnight UTC of the current date so
    // the next play kicks off at sunrise. For "year" mode, snap to
    // Jan 1 at the cursor's current hour.
    const d = this.sunStudy.currentDate;
    if (m === "day") {
      d.setUTCHours(0, 0, 0, 0);
    } else {
      const hr = d.getUTCHours(), mn = d.getUTCMinutes();
      d.setUTCMonth(0, 1);
      d.setUTCHours(hr, mn, 0, 0);
    }
    this.sunStudy.setDateMs(d.getTime());
    this.onModeChanged.dispatch(this, m);
  }

  public play(): void {
    if (this._destroyed || this._playing) return;
    this._playing = true;
    this._lastTickMs = 0;            // skips dt on first frame
    this.onPlay.dispatch(this, null);
  }

  public pause(): void {
    if (this._destroyed || !this._playing) return;
    this._playing = false;
    this.onPause.dispatch(this, null);
  }

  public destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._playing = false;
    this._animationTask.destroy();
    this.onPlay.clear();
    this.onPause.clear();
    this.onModeChanged.clear();
  }

  // ── internals ───────────────────────────────────────────────────

  private _tick(): void {
    if (this._destroyed || !this._playing) return;

    const now = (typeof performance !== "undefined" && performance.now)
                ? performance.now()
                : Date.now();
    if (this._lastTickMs === 0) {
      this._lastTickMs = now;
      return;
    }
    const dtSec = (now - this._lastTickMs) / 1000;
    this._lastTickMs = now;
    if (dtSec <= 0 || this.durationSeconds <= 0) return;

    // Each real second consumes (sweepSpanMs / durationSeconds) sim ms.
    const spanMs = this._mode === "day" ? MS_PER_DAY : MS_PER_YEAR;
    const advanceMs = (spanMs / this.durationSeconds) * dtSec;

    const next = this.sunStudy.currentDateMs + advanceMs;

    // Wrap the cursor at the sweep boundary so the loop continues.
    let wrapped = next;
    if (this._mode === "day") {
      const d = new Date(this.sunStudy.currentDateMs);
      const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      const dayEnd   = dayStart + MS_PER_DAY;
      if (wrapped >= dayEnd) wrapped = dayStart + (wrapped - dayEnd);
    } else {
      const d = new Date(this.sunStudy.currentDateMs);
      const yearStart = Date.UTC(d.getUTCFullYear(),     0, 1);
      const yearEnd   = Date.UTC(d.getUTCFullYear() + 1, 0, 1);
      if (wrapped >= yearEnd) wrapped = yearStart + (wrapped - yearEnd);
    }
    this.sunStudy.setDateMs(wrapped);
  }
}
