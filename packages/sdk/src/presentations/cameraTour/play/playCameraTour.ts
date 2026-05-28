/**
 * Drives a {@link View | View}'s Camera through a {@link CameraTour}'s
 * waypoints. Owns its own per-leg state machine (dwell → transit →
 * dwell → …) so it can honour per-waypoint dwell times, fire
 * waypoint enter/leave callbacks, and pause/resume/seek/loop
 * cleanly — features the constant-speed
 * {@link viewing!cameraFlight.CameraPathAnimation | CameraPathAnimation}
 * doesn't cover.
 *
 * Drives itself off `requestAnimationFrame`, computing wall-clock
 * deltas via `performance.now()`. The Viewer's `events.onTick` is
 * declared but not actually dispatched anywhere in the SDK today,
 * so subscribing to it would never fire — rAF is the reliable
 * cross-browser source of frame ticks. Per leg, eye / look / up
 * are linearly interpolated between the source and destination
 * waypoint with a `smoothstep` ease so the camera accelerates and
 * decelerates instead of stepping with a jerk. Per-waypoint
 * `fovDeg` overrides (if set) snap into place at waypoint arrival.
 *
 * Returns a {@link CameraTourPlayback} handle so the caller can
 * control playback and tear down event subscriptions.
 */
import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {View} from "../../../viewing/viewer";

import type {CameraTour} from "../plan/CameraTour";
import type {CameraTourPlayback} from "./CameraTourPlayback";
import type {CameraTourWaypoint} from "../plan/CameraTourWaypoint";
import type {PlayCameraTourOptions} from "./PlayCameraTourOptions";


/**
 * Drive a `View`'s Camera through a {@link CameraTour}'s waypoints.
 *
 * Snaps the camera to `tour.waypoints[startWaypointIndex]`
 * immediately, then begins the dwell → transit cycle. The first
 * `onWaypointEnter` callback fires synchronously on the success
 * path so the host can sync HUDs / narration overlays before the
 * first tick.
 *
 * Returns an {@link base!core.SDKResult | SDKResult} wrapping the
 * {@link CameraTourPlayback} handle — never throws, matching the
 * SDK's result-monad convention. On invalid input (empty tour,
 * destroyed view), returns
 * `{ok: false, type: SDKErrorType.InvalidInput, error: "…"}`.
 */
export function playCameraTour(
    view: View,
    tour: CameraTour,
    options: PlayCameraTourOptions = {},
): SDKResult<CameraTourPlayback> {

  const waypoints = tour.waypoints;
  if (waypoints.length === 0) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[playCameraTour] tour has no waypoints",
    };
  }
  if (!view || (view as any).destroyed) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[playCameraTour] view is required (and must not be destroyed)",
    };
  }

  const rate              = options.rate              ?? 1.0;
  const defaultFlightMs   = options.flightDurationMs  ?? 1500;
  const startIndex        = clampIndex(options.startWaypointIndex ?? 0, waypoints.length);
  const loop              = options.loop              ?? false;
  const autoStart         = options.autoStart         ?? true;

  // ─── State ────────────────────────────────────────────────────
  type Phase = "dwell" | "transit";
  let phase: Phase = "dwell";
  let currentIdx = startIndex;
  let phaseElapsedMs = 0;      // ms accumulated in the current phase
  let phaseDurationMs = waypoints[startIndex].dwellMs ?? 0;
  let playing = autoStart;
  let lastTickMs = -1;         // -1 = first tick, no delta yet
  let destroyed = false;

  // Snap to the start waypoint immediately.
  applyWaypoint(view, waypoints[startIndex]);
  options.onWaypointEnter?.(waypoints[startIndex], startIndex);

  // ─── rAF tick loop ────────────────────────────────────────────
  // Self-driven via requestAnimationFrame so the playback runs
  // even when the SDK's `viewer.events.onTick` isn't dispatched
  // (currently the case — the event is declared but never fired).
  let rafHandle: number | null = null;
  const schedule: () => void = (typeof requestAnimationFrame === "function")
      ? () => { rafHandle = requestAnimationFrame(tick); }
      : () => { rafHandle = setTimeout(tick, 16) as unknown as number; };
  const cancel: () => void = (typeof cancelAnimationFrame === "function")
      ? () => { if (rafHandle !== null) cancelAnimationFrame(rafHandle); rafHandle = null; }
      : () => { if (rafHandle !== null) clearTimeout(rafHandle as unknown as ReturnType<typeof setTimeout>); rafHandle = null; };

  function tick(): void {
    rafHandle = null;
    if (destroyed) return;
    if (!playing) {
      // Reset delta tracking so a long pause doesn't unleash a
      // huge step on resume.
      lastTickMs = -1;
      schedule();
      return;
    }
    const now = performance.now();
    if (lastTickMs < 0) {
      lastTickMs = now;
      schedule();
      return;
    }
    const deltaMs = (now - lastTickMs) * rate;
    lastTickMs = now;

    phaseElapsedMs += deltaMs;
    while (phaseElapsedMs >= phaseDurationMs) {
      // Phase completed — advance to the next phase.
      const overshoot = phaseElapsedMs - phaseDurationMs;
      advancePhase();
      phaseElapsedMs = overshoot;
      if (!playing) { schedule(); return; }   // advancePhase may have stopped us at the end
    }

    if (phase === "transit") {
      const t = phaseDurationMs > 0 ? phaseElapsedMs / phaseDurationMs : 1;
      const eased = smoothstep(t);
      const from = waypoints[currentIdx];
      const to   = waypoints[currentIdx + 1] ?? waypoints[0];   // loop wrap
      writeInterpolated(view, from, to, eased);
    }
    // During dwell we already snapped on enter — nothing to do.

    schedule();
  }
  schedule();

  function advancePhase(): void {
    if (phase === "dwell") {
      // Dwell → transit: start moving toward the next waypoint.
      const fromIdx = currentIdx;
      const toIdx   = currentIdx + 1;
      if (toIdx >= waypoints.length) {
        if (loop) {
          phase = "transit";
          phaseDurationMs = defaultFlightMs;
          options.onWaypointLeave?.(waypoints[fromIdx], fromIdx);
          // Wrap: transit from last back to first. We keep currentIdx
          // pointing at the last waypoint until the wrap completes
          // (handled in the transit→dwell branch below).
          return;
        }
        // End of tour — stop and notify.
        playing = false;
        options.onFinish?.();
        return;
      }
      phase = "transit";
      phaseDurationMs = defaultFlightMs;
      options.onWaypointLeave?.(waypoints[fromIdx], fromIdx);
      return;
    }
    // Transit → dwell: we've arrived at the next waypoint.
    const arrivedIdx = (currentIdx + 1) % waypoints.length;
    currentIdx = arrivedIdx;
    applyWaypoint(view, waypoints[arrivedIdx]);
    phase = "dwell";
    phaseDurationMs = waypoints[arrivedIdx].dwellMs ?? 0;
    options.onWaypointEnter?.(waypoints[arrivedIdx], arrivedIdx);
  }

  // ─── Control surface ──────────────────────────────────────────
  const playback: CameraTourPlayback = {
    get playing()             { return playing; },
    get currentWaypointIndex() { return currentIdx; },
    get tour()                { return tour; },

    play(): void {
      if (destroyed) return;
      playing = true;
      lastTickMs = -1;   // re-establish delta on next tick
    },

    pause(): void {
      playing = false;
    },

    stop(): void {
      playing = false;
      currentIdx = startIndex;
      phase = "dwell";
      phaseElapsedMs = 0;
      phaseDurationMs = waypoints[startIndex].dwellMs ?? 0;
      applyWaypoint(view, waypoints[startIndex]);
    },

    seek(waypointIndex: number): void {
      if (destroyed) return;
      // Silently clamp out-of-range indices instead of throwing —
      // matches the SDK's no-throw philosophy. A caller scrubbing
      // past the tour ends ends up parked at the first / last
      // waypoint, which is the natural UI behaviour anyway.
      const clamped = waypointIndex < 0
          ? 0
          : waypointIndex >= waypoints.length
              ? waypoints.length - 1
              : waypointIndex;
      currentIdx = clamped;
      phase = "dwell";
      phaseElapsedMs = 0;
      phaseDurationMs = waypoints[clamped].dwellMs ?? 0;
      lastTickMs = -1;
      applyWaypoint(view, waypoints[clamped]);
      options.onWaypointEnter?.(waypoints[clamped], clamped);
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      playing = false;
      cancel();
    },
  };
  return {ok: true, value: playback};
}


// ─── Camera writes ──────────────────────────────────────────────

function applyWaypoint(view: View, waypoint: CameraTourWaypoint): void {
  const camera = view.camera;
  camera.eye  = [waypoint.position[0], waypoint.position[1], waypoint.position[2]];
  camera.look = [waypoint.look[0],     waypoint.look[1],     waypoint.look[2]];
  camera.up   = [waypoint.up[0],       waypoint.up[1],       waypoint.up[2]];
  if (waypoint.fovDeg !== undefined && camera.perspectiveProjection) {
    camera.perspectiveProjection.fov = waypoint.fovDeg;
  }
}

function writeInterpolated(
    view: View,
    from: CameraTourWaypoint,
    to:   CameraTourWaypoint,
    t:    number,
): void {
  const camera = view.camera;
  camera.eye  = lerp3(from.position, to.position, t);
  camera.look = lerp3(from.look,     to.look,     t);
  camera.up   = lerp3(from.up,       to.up,       t);
  if (from.fovDeg !== undefined && to.fovDeg !== undefined && camera.perspectiveProjection) {
    camera.perspectiveProjection.fov = from.fovDeg + (to.fovDeg - from.fovDeg) * t;
  }
}

function lerp3(a: ArrayLike<number>, b: ArrayLike<number>, t: number): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}


// ─── Misc ───────────────────────────────────────────────────────

/**
 * Cubic smoothstep — `3t² − 2t³`. Eases the leg parameter so the
 * camera accelerates from rest at each waypoint, cruises through
 * the middle of the leg, and decelerates back to rest on arrival.
 */
function smoothstep(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

function clampIndex(i: number, n: number): number {
  if (i < 0) return 0;
  if (i >= n) return n - 1;
  return i;
}
