/**
 * Throttled cooperative yield used inside long-running parsers
 * (model loaders, etc) to keep the main thread responsive.
 *
 * Loaders typically have inner loops over many small items
 * (entities, primitives, vertices…). Without yielding, those
 * loops monopolise the JS event loop and block paint, input,
 * and progress-bar updates until the load finishes — even when
 * each item only takes microseconds. Inserting a yield after
 * every item, on the other hand, would tank throughput because
 * the per-yield overhead would dwarf the per-item work.
 *
 * `yieldToHost` is the middle path: a cheap timestamp check on
 * every call, with an actual yield only when at least
 * `intervalMs` has elapsed since the last one. At the default
 * 16 ms (≈60 Hz) the host gets one yield per frame — enough for
 * smooth UI without measurable parser slowdown.
 *
 * ## Macrotask, not microtask
 *
 * The yield uses `setTimeout(0)` rather than `await
 * Promise.resolve()`. Microtasks all drain before the browser
 * can paint or run input handlers, so yielding to a microtask
 * doesn't actually let a progress bar advance — it just delays
 * the next bit of parsing by a few microseconds. The macrotask
 * yield gives the browser a real opportunity to render and
 * service input.
 *
 * ## Cancellation
 *
 * If `signal` is supplied, it's checked **before** and **after**
 * the yield. So a load aborts within at most one yield interval
 * of the request — even mid-loop, even when the cancel happened
 * during the yield itself.
 *
 * ## Usage
 *
 * ```ts
 * import {yieldToHost} from "@xeokit/sdk/utils";
 *
 * for (const entity of entities) {
 *   parseEntity(entity);
 *   await yieldToHost(opts.signal);
 *   opts.onProgress?.({phase: "Parsing entities", current: i, total: n});
 * }
 * ```
 *
 * @param signal Optional `AbortSignal`. `yieldToHost` throws a
 *               `DOMException("Aborted", "AbortError")` if the
 *               signal is aborted at call time *or* during the
 *               yield itself.
 * @param intervalMs Minimum gap between actual yields, in
 *                   milliseconds. Default 16 (≈60 Hz).
 * @returns A promise that resolves on the next macrotask when
 *          the throttle gate is open, or synchronously
 *          (already-resolved promise) when the gate is closed.
 *
 * @module utils
 */
let _lastYieldMs = 0;
let _intervalOverrideMs: number | undefined = undefined;

const DEFAULT_INTERVAL_MS = 16;

const _now: () => number =
  (typeof performance !== "undefined" && typeof performance.now === "function")
    ? () => performance.now()
    : () => Date.now();

export async function yieldToHost(
  signal?: AbortSignal,
  intervalMs?: number,
): Promise<void> {
  if (signal && signal.aborted) {
    throw _abortError();
  }
  const interval = intervalMs ?? _intervalOverrideMs ?? DEFAULT_INTERVAL_MS;
  const now = _now();
  if (now - _lastYieldMs < interval) return;
  _lastYieldMs = now;
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  if (signal && signal.aborted) {
    throw _abortError();
  }
}

/**
 * Reset the internal throttle timestamp. Optional — only useful
 * at the start of a load if the previous load left the
 * timestamp warm and you want the very first hot-loop iteration
 * to yield immediately (e.g. so the progress dialog paints its
 * first frame without lag).
 */
export function resetYieldThrottle(): void {
  _lastYieldMs = 0;
}

/**
 * Override the throttle interval used by every subsequent
 * {@link yieldToHost} call that doesn't pass its own
 * `intervalMs`. Returns the previous override (which the caller
 * should restore in a `finally` block) so overrides nest
 * cleanly across nested loaders.
 *
 * The intended use is: a loader/exporter's top-level entry
 * reads the new `yieldIntervalMs` option from
 * {@link "@xeokit/sdk/formats".ModelLoadOptions} /
 * {@link "@xeokit/sdk/formats".ModelExportOptions} and pushes
 * it here, so every `yieldToHost` deeper in the parser picks
 * it up without each call site having to thread the value
 * through. Larger intervals (e.g. 100ms ≈ 10 Hz) noticeably
 * speed up large loads at the cost of less-frequent UI updates;
 * the default 16ms (≈ 60 Hz) keeps animation smooth but the
 * `setTimeout(0)` overhead at every yield can accumulate to
 * a meaningful slice of a multi-second load.
 *
 * Pass `undefined` to clear the override and return to the
 * library default (16ms).
 *
 * @returns The previous override value, for restoration.
 */
export function setYieldIntervalOverride(
  intervalMs: number | undefined,
): number | undefined {
  const prev = _intervalOverrideMs;
  _intervalOverrideMs = intervalMs;
  return prev;
}

function _abortError(): DOMException {
  // DOMException is the right shape so `err.name === "AbortError"`
  // matches the convention `fetch` and other Web APIs use. Falls
  // back to a plain Error in environments without DOMException
  // (some Node test runners).
  if (typeof DOMException !== "undefined") {
    return new DOMException("Aborted", "AbortError");
  }
  const err = new Error("Aborted");
  err.name = "AbortError";
  return err as DOMException;
}
