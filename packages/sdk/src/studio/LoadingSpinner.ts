import { sdkProgress } from "../base/core";

/**
 * Configuration for {@link LoadingSpinner}.
 */
export type ProgressBarOptions = {
  /**
   * Initial number of completed items.
   *
   * Defaults to ``0``.
   */
  initialLoaded?: number;

  /**
   * When ``true``, clamps loaded progress to the range ``[0..total]``.
   *
   * Defaults to ``true``.
   */
  clamp?: boolean;

  /**
   * When ``true``, automatically hides the spinner when loading completes.
   *
   * Defaults to ``true``.
   */
  autoHide?: boolean;

  /**
   * Delay, in milliseconds, before auto-hiding after loading completes.
   *
   * Defaults to ``300``.
   */
  autoHideDelayMs?: number;

  /**
   * Generates the secondary progress label.
   *
   * @param loaded Number of completed items.
   * @param total Total number of items.
   * @param pct Completion percentage in the range ``[0..100]``.
   * @returns Label text.
   */
  label?: (loaded: number, total: number, pct: number) => string;
};

/**
 * Full-screen loading spinner with an animated 3D cube and progress bar.
 *
 * ## Overview
 *
 * ``LoadingSpinner`` displays a modal loading overlay intended for model loading workflows.
 *
 * The spinner listens to {@link sdkProgress} task events to increment total and completed work,
 * while also allowing progress to be driven explicitly with {@link LoadingSpinner.setTotal},
 * {@link LoadingSpinner.setLoaded} and {@link LoadingSpinner.itemLoaded}.
 *
 * ## Usage
 *
 * ```ts
 * const spinner = new LoadingSpinner();
 *
 * spinner.setTotal(10);
 *
 * // Later...
 * spinner.itemLoaded();
 * ```
 *
 * ## Auto-hide
 *
 * When configured with ``autoHide: true``, the spinner hides itself shortly after progress reaches 100%.
 */
export class LoadingSpinner {
  private static readonly MAX_LOG_ENTRIES = 12;

  private total = 0;
  private loaded = 0;
  private phase = sdkProgress.phase;
  private lastLoggedPhase = "";

  private readonly overlay: HTMLDivElement;
  private readonly container: HTMLDivElement;
  private readonly text: HTMLDivElement;
  private readonly subtext: HTMLDivElement;
  private readonly phaseLog: HTMLDivElement;
  private readonly progressTrack: HTMLDivElement;
  private readonly progressFill: HTMLDivElement;

  private hideTimer: number | null = null;

  private readonly opts: Required<Pick<ProgressBarOptions, "clamp" | "autoHide" | "autoHideDelayMs">> &
    Omit<ProgressBarOptions, "clamp" | "autoHide" | "autoHideDelayMs">;

  private static stylesInjected = false;

  /**
   * Creates a ``LoadingSpinner``.
   *
   * @param options Spinner configuration.
   */
  constructor(options: ProgressBarOptions = {}) {
    this.opts = {
      clamp: options.clamp ?? true,
      autoHide: options.autoHide ?? true,
      autoHideDelayMs: options.autoHideDelayMs ?? 300,
      ...options,
    };

    document.body.classList.add("xeokit-loading-spinner-ready");
    this.injectStylesOnce();

    // Overlay
    this.overlay = (
      document.getElementById("xeokit-boot-loading-overlay") as HTMLDivElement | null
    ) ?? document.createElement("div");
    this.overlay.id = "xeokit-boot-loading-overlay";
    this.overlay.className = "xeokit-loading-overlay";
    this.overlay.innerHTML = "";

    // Container
    this.container = document.createElement("div");
    this.container.className = "xeokit-loading-card";
    this.container.setAttribute("role", "progressbar");
    this.container.setAttribute("aria-valuemin", "0");

    // Main text
    this.text = document.createElement("div");
    this.text.className = "xeokit-loading-text";
    this.text.textContent = this.phase;

    // Secondary text
    this.subtext = document.createElement("div");
    this.subtext.className = "xeokit-loading-subtext";
    this.subtext.textContent = "";

    this.phaseLog = document.createElement("div");
    this.phaseLog.className = "xeokit-loading-log";
    this.phaseLog.setAttribute("aria-live", "polite");

    // Progress bar
    this.progressTrack = document.createElement("div");
    this.progressTrack.className = "xeokit-loading-progress-track";

    this.progressFill = document.createElement("div");
    this.progressFill.className = "xeokit-loading-progress-fill";

    this.progressTrack.appendChild(this.progressFill);

    this.container.appendChild(this.text);
    this.container.appendChild(this.subtext);
    this.container.appendChild(this.phaseLog);
    this.container.appendChild(this.progressTrack);
    this.overlay.appendChild(this.container);
    if (!this.overlay.parentElement) {
      document.body.appendChild(this.overlay);
    }

    if (typeof this.opts.initialLoaded === "number") {
      this.loaded = Math.max(0, this.opts.initialLoaded);
    }

    this.render();
    this.appendPhaseLog(this.phase);

    sdkProgress.onTasksAdded.subscribe((_sdkProgress, numAdded) => {
      this.total += numAdded;
      this.cancelAutoHide();
      this.show();
      this.render();
    });

    sdkProgress.onTaskCompleted.subscribe((_sdkProgress, remainingTasks) => {
      this.itemLoaded();
      if (remainingTasks === 0 && this.opts.autoHide) {
        this.scheduleAutoHide();
      }
    });

    sdkProgress.onPhaseUpdated.subscribe((_sdkProgress, phase) => {
      this.phase = phase;
      this.appendPhaseLog(phase);
      if (_sdkProgress.numTasks > 0) {
        this.cancelAutoHide();
        this.show();
      }
      this.render();
    });
  }

  /**
   * Sets the total number of items to load.
   *
   * Optionally preserves the current loaded count.
   *
   * @param totalThings Total number of items.
   * @param keepLoaded When ``true``, preserves the current loaded count instead of resetting it.
   */
  setTotal(totalThings: number, keepLoaded = false): void {
    this.total = Math.max(0, Math.floor(totalThings));
    if (!keepLoaded) this.loaded = 0;

    this.cancelAutoHide();
    this.show();
    this.render();
  }

  /**
   * Increments the number of loaded items.
   *
   * @param count Number of items completed.
   */
  itemLoaded(count = 1): void {
    if (this.total <= 0) return;

    this.loaded += count;

    if (this.opts.clamp) {
      this.loaded = Math.min(Math.max(this.loaded, 0), this.total);
    }

    this.render();

    if (this.loaded >= this.total && this.opts.autoHide) {
      this.scheduleAutoHide();
    }
  }

  /**
   * Sets the number of loaded items directly.
   *
   * @param loadedThings Number of loaded items.
   */
  setLoaded(loadedThings: number): void {
    this.loaded = Math.floor(loadedThings);

    if (this.opts.clamp && this.total > 0) {
      this.loaded = Math.min(Math.max(this.loaded, 0), this.total);
    }

    this.cancelAutoHide();
    this.show();
    this.render();

    if (this.total > 0 && this.loaded >= this.total && this.opts.autoHide) {
      this.scheduleAutoHide();
    }
  }

  /**
   * Resets progress to zero and shows the spinner.
   */
  reset(): void {
    this.loaded = 0;
    this.cancelAutoHide();
    this.show();
    this.render();
  }

  /**
   * Shows the spinner overlay.
   */
  show(): void {
    this.overlay.style.display = "flex";
  }

  /**
   * Hides the spinner overlay.
   */
  hide(): void {
    this.overlay.style.display = "none";
  }

  /**
   * Destroys this spinner and removes its DOM elements.
   */
  destroy(): void {
    this.cancelAutoHide();
    this.overlay.remove();
  }

  /**
   * Renders the current progress state to the DOM.
   */
  private render(): void {
    const pct = this.total <= 0 ? 0 : (this.loaded / this.total) * 100;
    const safePct = Math.min(Math.max(pct, 0), 100);

    this.container.setAttribute("aria-valuemax", String(this.total));
    this.container.setAttribute("aria-valuenow", String(this.loaded));
    this.progressFill.style.width = `${safePct}%`;

    const labelText =
      this.opts.label?.(this.loaded, this.total, safePct) ??
      (this.total > 0
        ? `${this.loaded} / ${this.total} (${Math.round(safePct)}%)`
        : `Preparing scene…`);

    this.text.textContent = this.phase;
    this.subtext.textContent = labelText;
  }

  private appendPhaseLog(phase: string): void {
    const text = phase.trim();
    if (!text || text === this.lastLoggedPhase) {
      return;
    }
    this.lastLoggedPhase = text;

    const entry = document.createElement("div");
    entry.className = "xeokit-loading-log-entry";
    entry.textContent = text;
    entry.title = text;
    this.phaseLog.appendChild(entry);

    while (this.phaseLog.childElementCount > LoadingSpinner.MAX_LOG_ENTRIES) {
      this.phaseLog.firstElementChild?.remove();
    }
    this.phaseLog.scrollTop = this.phaseLog.scrollHeight;
  }

  /**
   * Schedules the spinner to hide after the configured auto-hide delay.
   */
  private scheduleAutoHide(): void {
    this.cancelAutoHide();
    this.hideTimer = window.setTimeout(() => this.hide(), this.opts.autoHideDelayMs);
  }

  /**
   * Cancels any pending auto-hide timer.
   */
  private cancelAutoHide(): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  /**
   * Injects shared CSS styles for the spinner once per page.
   */
  private injectStylesOnce(): void {
    if (LoadingSpinner.stylesInjected) return;
    LoadingSpinner.stylesInjected = true;

    const style = document.createElement("style");
    style.textContent = `
      .xeokit-loading-overlay {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        background:
          radial-gradient(circle at 50% 50%, rgba(80, 140, 255, 0.10), rgba(0, 0, 0, 0.50)),
          rgba(7, 10, 18, 0.45);
        backdrop-filter: blur(4px);
        z-index: 2000000;
      }

      .xeokit-loading-card {
        min-width: 280px;
        width: min(420px, calc(100vw - 48px));
        max-width: 80%;
        padding: 20px 22px 18px;
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(20,24,36,0.96), rgba(11,14,22,0.96));
        box-shadow:
          0 18px 50px rgba(0,0,0,0.45),
          inset 0 1px 0 rgba(255,255,255,0.06);
        border: 1px solid rgba(120, 160, 255, 0.18);
        text-align: center;
        color: #e8eefc;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .xeokit-loading-text {
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.2px;
        margin-bottom: 4px;
        color: #f4f7ff;
      }

      .xeokit-loading-subtext {
        font-size: 12px;
        line-height: 1.4;
        color: rgba(225, 234, 255, 0.72);
        margin-bottom: 12px;
        min-height: 17px;
      }

      .xeokit-loading-log {
        height: 116px;
        margin: 0 0 12px;
        padding: 9px 10px;
        overflow: hidden auto;
        border-radius: 8px;
        background: rgba(4, 8, 18, 0.58);
        border: 1px solid rgba(145, 176, 230, 0.18);
        box-shadow: inset 0 1px 8px rgba(0, 0, 0, 0.22);
        text-align: left;
        box-sizing: border-box;
        scrollbar-width: thin;
        scrollbar-color: rgba(150, 180, 235, 0.48) transparent;
      }

      .xeokit-loading-log::-webkit-scrollbar {
        width: 6px;
      }

      .xeokit-loading-log::-webkit-scrollbar-track {
        background: transparent;
      }

      .xeokit-loading-log::-webkit-scrollbar-thumb {
        border-radius: 999px;
        background: rgba(150, 180, 235, 0.42);
      }

      .xeokit-loading-log-entry {
        position: relative;
        min-height: 17px;
        padding: 2px 0 2px 16px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
        font-size: 12px;
        line-height: 1.35;
        color: rgba(224, 234, 255, 0.74);
      }

      .xeokit-loading-log-entry::before {
        content: "";
        position: absolute;
        top: 9px;
        left: 3px;
        width: 5px;
        height: 5px;
        border-radius: 999px;
        background: rgba(135, 178, 255, 0.44);
      }

      .xeokit-loading-log-entry:last-child {
        color: #ffffff;
        font-weight: 600;
      }

      .xeokit-loading-log-entry:last-child::before {
        background: #7db6ff;
        box-shadow: 0 0 8px rgba(125, 182, 255, 0.55);
      }

      .xeokit-loading-progress-track {
        width: 100%;
        height: 8px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(255,255,255,0.08);
        box-shadow: inset 0 1px 3px rgba(0,0,0,0.35);
      }

      .xeokit-loading-progress-fill {
        width: 0%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #4f8cff, #7db6ff);
        box-shadow: 0 0 16px rgba(87, 151, 255, 0.5);
        transition: width 160ms ease;
      }

    `;
    document.head.appendChild(style);
  }
}
