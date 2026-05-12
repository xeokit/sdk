/**
 * Floating progress dialog for long-running loader calls. Pairs
 * with the cooperative-yield loader sweep
 * ({@link "@xeokit/sdk/utils".yieldToHost | yieldToHost} +
 * {@link "@xeokit/sdk/formats".LoaderProgress | LoaderProgress}
 * + `ModelLoadOptions.signal`) so the bar advances while the
 * load runs, the phase label tracks what the loader is doing,
 * and a Cancel button propagates an `AbortSignal` to abort
 * within ≈one yield interval.
 *
 * ## Usage
 *
 * Most callers use the static {@link runWith} helper — it owns
 * the dialog lifecycle (delayed first paint, min display time,
 * cancel button, error pane), and you supply the loader call:
 *
 * ```ts
 * import {LoaderProgressDialog} from "@xeokit/sdk/demo";
 *
 * const result = await LoaderProgressDialog.runWith({
 *   title: "Loading Duplex (ifc)",
 *   run: async (onProgress, signal) => {
 *     return demoHelper.loadModel(
 *       {modelId: "Duplex", format: "ifc", sceneModel, dataModel},
 *       {onProgress, signal},
 *     );
 *   },
 * });
 * ```
 *
 * ## UX policies
 *
 * 1. **Delayed first paint (~250 ms)** — sub-quarter-second
 *    loads finish without the dialog ever appearing. Avoids a
 *    flash of progress UI on near-instant loads.
 * 2. **Min display time (~400 ms once shown)** — once visible,
 *    stay visible long enough to read.
 * 3. **Phase-aware bar** — indeterminate spinner when `total === 0`
 *    (e.g. "Fetching", "Opening WASM"), determinate bar when
 *    `total > 0`.
 * 4. **Smoothed ETA** — once enough progress samples are in,
 *    show a smoothed time-remaining estimate. Drop ETA when the
 *    fraction hasn't moved in 2 s — don't lie about a stall.
 * 5. **"Cancelling…" intermediate state** — between Cancel
 *    click and the loader actually returning, switch to a
 *    non-cancellable spinner so the user doesn't think the
 *    click was eaten.
 * 6. **Error pane on failure** — the dialog flips to an error
 *    panel with the message + a Dismiss button instead of just
 *    disappearing. The `runWith` promise rejects immediately;
 *    the dialog stays until the user dismisses it.
 *
 * @module demo/loaderProgressDialog
 */
import type {LoaderProgress} from "../../formats/LoaderProgress";


import {el} from "../utils/el";
import {bringFloatingPanelToFront} from "../panels/floatingPanelZ";
import {showBackdrop, hideBackdrop} from "../panels/modalBackdrop";
// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

/**
 * Function the consumer hands to {@link LoaderProgressDialog.runWith}.
 * Receives a progress callback wired to the dialog's bar /
 * phase label, and an `AbortSignal` wired to the Cancel button.
 *
 * Loaders that respect the cooperative-yield contract pass these
 * straight into `ModelLoadOptions.{onProgress, signal}` —
 * they're the same shape.
 */
export type LoaderProgressDialogRun<T> = (
  onProgress: (p: LoaderProgress) => void,
  signal: AbortSignal,
) => Promise<T>;

export interface LoaderProgressDialogRunWithParams<T> {

  /** Header title shown at the top of the dialog. */
  title?: string;

  /**
   * The loader call. Receives a progress callback + abort
   * signal; pass them through to your loader's options.
   */
  run: LoaderProgressDialogRun<T>;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * Delay before the dialog first appears, in ms. Loads that
   * finish before this fire never paint a dialog. Default 250.
   */
  delayMs?: number;

  /**
   * Once the dialog has appeared, minimum time it stays
   * visible before being hidden, in ms. Prevents the dialog
   * from blinking off if the load finishes immediately after
   * the delay threshold. Default 400.
   */
  minVisibleMs?: number;
}


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-lpd-styles";
let _stylesInjected = false;

function injectStylesOnce(): void {
  if (_stylesInjected) return;
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_TAG_ID)) {
    _stylesInjected = true;
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_TAG_ID;
  style.textContent = DIALOG_CSS;
  document.head.appendChild(style);
  _stylesInjected = true;
}


// ─────────────────────────────────────────────────────────────────
// CSS — every selector rooted at `.xkt-lpd-dialog`. Visually
// matches the other floating panels (same fonts / palette /
// radii / shadow) but the dialog is centered + non-draggable
// since it's transient.
// ─────────────────────────────────────────────────────────────────

const DIALOG_CSS = `
.xkt-lpd-dialog {
  position: fixed;
  top: 88px;
  left: 50%;
  transform: translateX(-50%);
  width: 440px;
  max-width: calc(100vw - 32px);
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  color: #111;
  z-index: 200000001;
  overflow: hidden;
  box-sizing: border-box;
}
.xkt-lpd-dialog *, .xkt-lpd-dialog *::before, .xkt-lpd-dialog *::after {
  box-sizing: border-box;
}
.xkt-lpd-dialog[hidden] { display: none; }

.xkt-lpd-dialog .xkt-lpd-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid #ececec;
}
.xkt-lpd-dialog .xkt-lpd-title {
  flex: 1;
  margin: 0;
  font-size: 22px;
  font-weight: 650;
  color: #111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.xkt-lpd-dialog .xkt-lpd-body {
  padding: 12px 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.xkt-lpd-dialog .xkt-lpd-phase {
  font-size: 12px;
  color: #444;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-height: 1.4em;
}
.xkt-lpd-dialog .xkt-lpd-bar {
  width: 100%;
  height: 8px;
  appearance: none;
  -webkit-appearance: none;
  border: none;
  border-radius: 999px;
  background: #ececec;
  overflow: hidden;
}
/* Determinate bar (Chrome/Safari) */
.xkt-lpd-dialog .xkt-lpd-bar::-webkit-progress-bar {
  background: #ececec;
  border-radius: 999px;
}
.xkt-lpd-dialog .xkt-lpd-bar::-webkit-progress-value {
  background: #2d5e8c;
  border-radius: 999px;
  transition: width 80ms linear;
}
/* Determinate bar (Firefox) */
.xkt-lpd-dialog .xkt-lpd-bar::-moz-progress-bar {
  background: #2d5e8c;
  border-radius: 999px;
}
.xkt-lpd-dialog .xkt-lpd-meta {
  display: flex;
  gap: 12px;
  font-size: 10.5px;
  color: #777;
  font-variant-numeric: tabular-nums;
  min-height: 1.4em;
}
.xkt-lpd-dialog .xkt-lpd-meta-counts { flex: 1; }
.xkt-lpd-dialog .xkt-lpd-meta-eta    { flex-shrink: 0; }

.xkt-lpd-dialog .xkt-lpd-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid #ececec;
  background: #fafafa;
}
.xkt-lpd-dialog .xkt-lpd-cancel,
.xkt-lpd-dialog .xkt-lpd-dismiss {
  padding: 7px 14px;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
  cursor: pointer;
  border-radius: 6px;
}
.xkt-lpd-dialog .xkt-lpd-cancel {
  color: #555;
  background: transparent;
  border: 1px solid #d0d0d0;
}
.xkt-lpd-dialog .xkt-lpd-cancel:hover:not(:disabled) {
  background: #f0f0f0;
  color: #222;
}
.xkt-lpd-dialog .xkt-lpd-cancel:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.xkt-lpd-dialog .xkt-lpd-dismiss {
  color: #fff;
  background: #2d5e8c;
  border: 1px solid #1f4669;
}
.xkt-lpd-dialog .xkt-lpd-dismiss:hover { background: #1f4669; }

/* Error pane — replaces the body when the loader rejects with
   anything other than AbortError. The dialog stays open until
   the user dismisses, so the error message is readable rather
   than a flash on the way to console.error. */
.xkt-lpd-dialog .xkt-lpd-error {
  padding: 12px 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #fdf3f3;
  border-top: 1px solid #f3d7d7;
}
.xkt-lpd-dialog .xkt-lpd-error-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: #a02020;
}
.xkt-lpd-dialog .xkt-lpd-error-message {
  font-size: 12px;
  color: #5a1414;
  word-break: break-word;
  white-space: pre-wrap;
}

/* Cancelling intermediate state — the bar greys out and the
   Cancel button disables. Helps the user see that the click
   landed but the loader hasn't yielded yet. */
.xkt-lpd-dialog.xkt-lpd-cancelling .xkt-lpd-bar {
  opacity: 0.5;
}
.xkt-lpd-dialog.xkt-lpd-cancelling .xkt-lpd-phase::after {
  content: " · cancelling…";
  color: #888;
}

/* Indeterminate-bar fallback. The browser's <progress> handles
   indeterminate natively (the value-less element shows a
   shimmer in Chrome/Firefox), but we add a subtle pulse on the
   container so it reads as "active" even on browsers that
   render an empty bar. */
.xkt-lpd-dialog .xkt-lpd-bar:not([value]) {
  background: linear-gradient(
    90deg, #ececec 0%, #c8d6e6 50%, #ececec 100%
  );
  background-size: 200% 100%;
  animation: xkt-lpd-shimmer 1.4s linear infinite;
}
@keyframes xkt-lpd-shimmer {
  from { background-position: 200% 0; }
  to   { background-position: -200% 0; }
}
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

/**
 * Internal state machine — used to enforce the UX policies
 * (delayed paint, min visible time, error-pane override).
 */
type DialogState = "pending" | "running" | "cancelling" | "error" | "done";

export class LoaderProgressDialog {

  /**
   * Static convenience: run an async loader call inside a
   * dialog that follows every UX policy from the module doc
   * (delayed first paint, min display time, cancel +
   * "cancelling…" state, error pane).
   *
   * Resolves with whatever the `run` function resolves with.
   * Rejects with the underlying error — including
   * `AbortError` when the user clicks Cancel — so callers can
   * differentiate user-cancellation from a real failure.
   */
  static runWith<T>(params: LoaderProgressDialogRunWithParams<T>): Promise<T> {
    const dialog = new LoaderProgressDialog({
      title: params.title,
      container: params.container,
      delayMs: params.delayMs,
      minVisibleMs: params.minVisibleMs,
    });
    return dialog._run(params.run);
  }

  private readonly _container: HTMLElement;
  private readonly _delayMs: number;
  private readonly _minVisibleMs: number;

  // DOM refs.
  private _root!: HTMLElement;
  private _titleEl!: HTMLElement;
  private _bodyEl!: HTMLElement;
  private _phaseEl!: HTMLElement;
  private _bar!: HTMLProgressElement;
  private _countsEl!: HTMLElement;
  private _etaEl!: HTMLElement;
  private _footerEl!: HTMLElement;
  private _cancelBtn!: HTMLButtonElement;

  // State.
  private _state: DialogState = "pending";
  private _shown = false;
  private _shownAtMs = 0;
  private _delayTimer: ReturnType<typeof setTimeout> | null = null;
  private _abortController: AbortController = new AbortController();

  // ETA tracking.
  private _startMs = 0;
  private _lastFractionAtMs = 0;
  private _lastFraction = 0;
  private _smoothedEtaMs = 0;

  private _backdrop: HTMLElement | null = null;

  constructor(params: {title?: string; container?: HTMLElement; delayMs?: number; minVisibleMs?: number} = {}) {
    this._container   = params.container || document.body;
    this._delayMs     = params.delayMs ?? 250;
    this._minVisibleMs = params.minVisibleMs ?? 400;

    injectStylesOnce();
    this._buildDom();
    if (params.title) this.setTitle(params.title);
  }


  // ── Public surface (instance API) ─────────────────────────────

  /** Set / change the dialog header title. */
  setTitle(title: string): void {
    this._titleEl.textContent = title;
  }

  /**
   * Update the progress payload — phase label, determinate bar
   * fraction, counts, smoothed ETA. Safe to call before the
   * dialog has actually appeared (the new state is held until
   * the delayed first paint).
   */
  setProgress(p: LoaderProgress): void {
    this._phaseEl.textContent = p.phase || "";
    if (p.total > 0) {
      // Determinate bar.
      const frac = Math.max(0, Math.min(1, p.current / p.total));
      this._bar.max = 1;
      this._bar.value = frac;
      this._countsEl.textContent = `${formatNumber(p.current)} / ${formatNumber(p.total)}`;
      this._updateEta(frac);
    } else {
      // Indeterminate — strip the value attribute so <progress>
      // renders its native indeterminate shimmer.
      this._bar.removeAttribute("value");
      this._countsEl.textContent = "";
      this._etaEl.textContent = "";
    }
  }

  /** Force-show the dialog (skips the delayed-paint policy). */
  show(): void {
    if (this._shown) return;
    this._shown = true;
    this._shownAtMs = nowMs();
    this._root.style.display = "flex";
    bringFloatingPanelToFront(this._root, /* aboveModals */ true);
    // Modal scrim. No click-outside dismiss — a running load
    // shouldn't be cancellable by a stray backdrop click; the
    // Cancel / Dismiss buttons own that path.
    this._backdrop = showBackdrop(this._container, this._root);
  }

  /**
   * Hide + tear down the dialog. Idempotent. Honours
   * `minVisibleMs` if the dialog has already appeared, so we
   * don't blink off as soon as a load finishes.
   */
  async hide(): Promise<void> {
    if (this._delayTimer !== null) {
      clearTimeout(this._delayTimer);
      this._delayTimer = null;
    }
    if (this._shown) {
      const elapsed = nowMs() - this._shownAtMs;
      const remaining = this._minVisibleMs - elapsed;
      if (remaining > 0) {
        await new Promise<void>(r => setTimeout(r, remaining));
      }
    }
    this.destroy();
  }

  /** Tear down DOM immediately, ignoring min-visible. */
  destroy(): void {
    if (this._state === "done") return;
    this._state = "done";
    if (this._delayTimer !== null) {
      clearTimeout(this._delayTimer);
      this._delayTimer = null;
    }
    hideBackdrop(this._backdrop);
    this._backdrop = null;
    this._root.remove();
  }

  /** AbortSignal driven by the Cancel button. */
  get signal(): AbortSignal {
    return this._abortController.signal;
  }


  // ── runWith implementation ────────────────────────────────────

  private async _run<T>(run: LoaderProgressDialogRun<T>): Promise<T> {
    this._state = "running";
    this._startMs = nowMs();
    this._lastFractionAtMs = this._startMs;

    // Schedule delayed first paint. If the load completes before
    // this fires, the dialog never appears at all.
    this._delayTimer = setTimeout(() => {
      this._delayTimer = null;
      if (this._state === "running" || this._state === "cancelling") {
        this.show();
      }
    }, this._delayMs);

    const onProgress = (p: LoaderProgress): void => {
      // Cheap update — we always track state so when the dialog
      // finally appears it's already showing the latest progress
      // (no flash of stale state).
      this.setProgress(p);
    };

    try {
      const result = await run(onProgress, this._abortController.signal);
      await this.hide();
      return result;
    } catch (err: any) {
      if (err && err.name === "AbortError") {
        // User-driven cancellation — close cleanly + propagate.
        await this.hide();
        throw err;
      }
      // Real error — flip to the error pane so the user sees the
      // message instead of a flash. The promise still rejects
      // immediately; the dialog persists until the user clicks
      // Dismiss (which destroys it).
      this._showError(err && err.message || String(err));
      throw err;
    }
  }

  private _showError(message: string): void {
    this._state = "error";
    if (this._delayTimer !== null) {
      clearTimeout(this._delayTimer);
      this._delayTimer = null;
    }
    if (!this._shown) {
      // Don't suppress — even a fast-failing load deserves an
      // error dialog, since the user has no other channel to
      // see the message.
      this.show();
    }

    // Replace body with the error pane.
    this._bodyEl.style.display = "none";
    const errorPane = el("div", "xkt-lpd-error");
    errorPane.append(
      el("div", "xkt-lpd-error-label", {textContent: "Load failed"}),
      el("div", "xkt-lpd-error-message", {textContent: message}),
    );
    this._bodyEl.parentElement!.insertBefore(errorPane, this._footerEl);

    // Swap Cancel → Dismiss in the footer.
    this._cancelBtn.remove();
    const dismissBtn = el("button", "xkt-lpd-dismiss", {
      type: "button",
      textContent: "Dismiss",
    }) as HTMLButtonElement;
    dismissBtn.addEventListener("click", () => this.destroy());
    this._footerEl.appendChild(dismissBtn);
  }


  // ── ETA ───────────────────────────────────────────────────────

  /**
   * Update the smoothed ETA from the current progress fraction.
   * Drops the ETA when the fraction hasn't moved for >2 s — we
   * don't want to lie about a stalled load.
   */
  private _updateEta(fraction: number): void {
    const now = nowMs();
    const elapsed = now - this._startMs;

    if (fraction !== this._lastFraction) {
      this._lastFraction = fraction;
      this._lastFractionAtMs = now;
    }
    const stalledMs = now - this._lastFractionAtMs;

    // Need at least 250 ms of elapsed time + a non-zero fraction
    // to compute a meaningful ETA. Below either threshold show
    // just the elapsed time.
    if (fraction <= 0 || elapsed < 250 || stalledMs > 2000) {
      this._etaEl.textContent = `${formatSeconds(elapsed)} elapsed`;
      return;
    }

    const rawEta = (elapsed / fraction) - elapsed;
    // Exponential smoothing — α=0.3 keeps the ETA from jittering
    // every emit but still reflects a consistent slow-down.
    if (this._smoothedEtaMs <= 0) {
      this._smoothedEtaMs = rawEta;
    } else {
      this._smoothedEtaMs = 0.3 * rawEta + 0.7 * this._smoothedEtaMs;
    }
    this._etaEl.textContent =
      `${formatSeconds(elapsed)} elapsed · ${formatSeconds(this._smoothedEtaMs)} remaining`;
  }


  // ── DOM construction ──────────────────────────────────────────

  private _buildDom(): void {
    this._root = el("div", "xkt-lpd-dialog");
    this._root.style.display = "none";   // hidden until delayed-show fires

    const header = el("div", "xkt-lpd-header");
    this._titleEl = el("h3", "xkt-lpd-title", {textContent: "Loading…"});
    header.appendChild(this._titleEl);
    this._root.appendChild(header);

    this._bodyEl = el("div", "xkt-lpd-body");
    this._phaseEl = el("div", "xkt-lpd-phase");
    this._bar = el("progress", "xkt-lpd-bar") as HTMLProgressElement;
    this._bar.max = 1;
    this._bar.removeAttribute("value");     // start indeterminate
    const meta = el("div", "xkt-lpd-meta");
    this._countsEl = el("span", "xkt-lpd-meta-counts");
    this._etaEl    = el("span", "xkt-lpd-meta-eta");
    meta.append(this._countsEl, this._etaEl);
    this._bodyEl.append(this._phaseEl, this._bar, meta);
    this._root.appendChild(this._bodyEl);

    this._footerEl = el("div", "xkt-lpd-footer");
    this._cancelBtn = el("button", "xkt-lpd-cancel", {
      type: "button",
      textContent: "Cancel",
    }) as HTMLButtonElement;
    this._cancelBtn.addEventListener("click", () => this._onCancel());
    this._footerEl.appendChild(this._cancelBtn);
    this._root.appendChild(this._footerEl);

    this._container.appendChild(this._root);
  }

  private _onCancel(): void {
    if (this._state !== "running") return;
    this._state = "cancelling";
    this._cancelBtn.disabled = true;
    this._root.classList.add("xkt-lpd-cancelling");
    this._abortController.abort();
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────


function nowMs(): number {
  return (typeof performance !== "undefined" && performance.now)
    ? performance.now()
    : Date.now();
}

function formatNumber(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString() : String(n);
}

/**
 * Compact "0.4s" / "12.3s" / "1m 23s" formatter — keeps the
 * meta line readable as durations vary from sub-second to many
 * minutes.
 */
function formatSeconds(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const s = ms / 1000;
  if (s < 10)   return `${s.toFixed(1)}s`;
  if (s < 60)   return `${Math.round(s)}s`;
  const mins = Math.floor(s / 60);
  const rem  = Math.round(s - mins * 60);
  return `${mins}m ${rem}s`;
}
