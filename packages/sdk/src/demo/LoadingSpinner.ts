import { sdkProgress } from "../core";

/**
 * Configuration for {@link LoadingSpinner}.
 */
type ProgressBarOptions = {
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
  private total = 0;
  private loaded = 0;

  private readonly overlay: HTMLDivElement;
  private readonly container: HTMLDivElement;
  private readonly spinnerWrap: HTMLDivElement;
  private readonly cube: HTMLDivElement;
  private readonly text: HTMLDivElement;
  private readonly subtext: HTMLDivElement;
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

    this.injectStylesOnce();

    // Overlay
    this.overlay = document.createElement("div");
    this.overlay.className = "xeokit-loading-overlay";

    // Container
    this.container = document.createElement("div");
    this.container.className = "xeokit-loading-card";
    this.container.setAttribute("role", "progressbar");
    this.container.setAttribute("aria-valuemin", "0");

    // Spinner wrapper
    this.spinnerWrap = document.createElement("div");
    this.spinnerWrap.className = "xeokit-spinner-wrap";

    const scene = document.createElement("div");
    scene.className = "xeokit-spinner-scene";

    this.cube = document.createElement("div");
    this.cube.className = "xeokit-cube";

    const faces = ["front", "back", "right", "left", "top", "bottom"];
    for (const face of faces) {
      const faceEl = document.createElement("div");
      faceEl.className = `xeokit-cube-face xeokit-cube-face-${face}`;
      this.cube.appendChild(faceEl);
    }

    const orbit = document.createElement("div");
    orbit.className = "xeokit-orbit-ring";

    const glow = document.createElement("div");
    glow.className = "xeokit-spinner-glow";

    scene.appendChild(glow);
    scene.appendChild(orbit);
    scene.appendChild(this.cube);
    this.spinnerWrap.appendChild(scene);

    // Main text
    this.text = document.createElement("div");
    this.text.className = "xeokit-loading-text";
    this.text.textContent = "Loading model…";

    // Secondary text
    this.subtext = document.createElement("div");
    this.subtext.className = "xeokit-loading-subtext";
    this.subtext.textContent = "";

    // Progress bar
    this.progressTrack = document.createElement("div");
    this.progressTrack.className = "xeokit-loading-progress-track";

    this.progressFill = document.createElement("div");
    this.progressFill.className = "xeokit-loading-progress-fill";

    this.progressTrack.appendChild(this.progressFill);

    this.container.appendChild(this.spinnerWrap);
    this.container.appendChild(this.text);
    this.container.appendChild(this.subtext);
    this.container.appendChild(this.progressTrack);
    this.overlay.appendChild(this.container);
    document.body.appendChild(this.overlay);

    if (typeof this.opts.initialLoaded === "number") {
      this.loaded = Math.max(0, this.opts.initialLoaded);
    }

    this.render();

    sdkProgress.onTasksAdded.subscribe((_sdkProgress, numAdded) => {
      this.total += numAdded;
      this.cancelAutoHide();
      this.show();
      this.render();
    });

    sdkProgress.onTaskCompleted.subscribe(() => {
      this.itemLoaded();
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
        ? `Loading model… ${this.loaded} / ${this.total} (${Math.round(safePct)}%)`
        : `Preparing scene…`);

    this.subtext.textContent = labelText;

    // Slightly brighten as progress advances
    const glowStrength = 0.35 + safePct / 180;
    this.spinnerWrap.style.setProperty("--xeokit-glow-alpha", String(glowStrength));
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

      .xeokit-spinner-wrap {
        --xeokit-glow-alpha: 0.5;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: 12px;
      }

      .xeokit-spinner-scene {
        position: relative;
        width: 80px;
        height: 80px;
        perspective: 700px;
      }

      .xeokit-spinner-glow {
        position: absolute;
        inset: 50% auto auto 50%;
        width: 64px;
        height: 64px;
        transform: translate(-50%, -50%);
        border-radius: 999px;
        background: radial-gradient(circle, rgba(92, 153, 255, var(--xeokit-glow-alpha)) 0%, rgba(92, 153, 255, 0.06) 55%, rgba(92, 153, 255, 0) 72%);
        filter: blur(6px);
        animation: xeokit-pulse 1.8s ease-in-out infinite;
        pointer-events: none;
      }

      .xeokit-orbit-ring {
        position: absolute;
        inset: 50% auto auto 50%;
        width: 74px;
        height: 74px;
        transform: translate(-50%, -50%) rotateX(70deg);
        border-radius: 999px;
        border: 1px solid rgba(120, 170, 255, 0.4);
        box-shadow: 0 0 14px rgba(90, 150, 255, 0.15);
        animation: xeokit-ring-spin 2.8s linear infinite;
      }

      .xeokit-orbit-ring::before,
      .xeokit-orbit-ring::after {
        content: "";
        position: absolute;
        inset: -1px;
        border-radius: 999px;
        border: 1px solid rgba(120, 170, 255, 0.18);
      }

      .xeokit-orbit-ring::before {
        transform: rotate(60deg);
      }

      .xeokit-orbit-ring::after {
        transform: rotate(120deg);
      }

      .xeokit-cube {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 34px;
        height: 34px;
        transform-style: preserve-3d;
        transform: translate(-50%, -50%) rotateX(-24deg) rotateY(35deg);
        animation: xeokit-cube-spin 2.2s cubic-bezier(.65,.05,.36,1) infinite;
      }

      .xeokit-cube-face {
        position: absolute;
        width: 34px;
        height: 34px;
        box-sizing: border-box;
        border: 1px solid rgba(168, 206, 255, 0.55);
        background:
          linear-gradient(135deg, rgba(95, 155, 255, 0.22), rgba(95, 155, 255, 0.04));
        box-shadow:
          inset 0 0 12px rgba(110, 170, 255, 0.12),
          0 0 10px rgba(80, 140, 255, 0.08);
        backdrop-filter: blur(2px);
      }

      .xeokit-cube-face::after {
        content: "";
        position: absolute;
        inset: 5px;
        border: 1px solid rgba(180, 220, 255, 0.22);
      }

      .xeokit-cube-face-front  { transform: translateZ(17px); }
      .xeokit-cube-face-back   { transform: rotateY(180deg) translateZ(17px); }
      .xeokit-cube-face-right  { transform: rotateY(90deg) translateZ(17px); }
      .xeokit-cube-face-left   { transform: rotateY(-90deg) translateZ(17px); }
      .xeokit-cube-face-top    { transform: rotateX(90deg) translateZ(17px); }
      .xeokit-cube-face-bottom { transform: rotateX(-90deg) translateZ(17px); }

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

      @keyframes xeokit-cube-spin {
        0% {
          transform: translate(-50%, -50%) rotateX(-24deg) rotateY(0deg) rotateZ(0deg);
        }
        25% {
          transform: translate(-50%, -50%) rotateX(56deg) rotateY(90deg) rotateZ(8deg);
        }
        50% {
          transform: translate(-50%, -50%) rotateX(156deg) rotateY(180deg) rotateZ(0deg);
        }
        75% {
          transform: translate(-50%, -50%) rotateX(236deg) rotateY(270deg) rotateZ(-8deg);
        }
        100% {
          transform: translate(-50%, -50%) rotateX(336deg) rotateY(360deg) rotateZ(0deg);
        }
      }

      @keyframes xeokit-ring-spin {
        from {
          transform: translate(-50%, -50%) rotateX(70deg) rotateZ(0deg);
        }
        to {
          transform: translate(-50%, -50%) rotateX(70deg) rotateZ(360deg);
        }
      }

      @keyframes xeokit-pulse {
        0%, 100% {
          transform: translate(-50%, -50%) scale(0.92);
          opacity: 0.72;
        }
        50% {
          transform: translate(-50%, -50%) scale(1.08);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }
}
