import {sdkProgress} from "../core";

type ProgressBarOptions = {
  initialLoaded?: number;
  clamp?: boolean;
  autoHide?: boolean;
  autoHideDelayMs?: number;
  label?: (loaded: number, total: number, pct: number) => string;
};

export class LoadingProgressBar {
  private total = 0;
  private loaded = 0;

  private readonly overlay: HTMLDivElement;
  private readonly container: HTMLDivElement;
  private readonly track: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly text: HTMLDivElement;

  private hideTimer: number | null = null;

  private readonly opts: Required<Pick<ProgressBarOptions, "clamp" | "autoHide" | "autoHideDelayMs">> &
    Omit<ProgressBarOptions, "clamp" | "autoHide" | "autoHideDelayMs">;

  constructor(options: ProgressBarOptions = {}) {
    this.opts = {
      clamp: options.clamp ?? true,
      autoHide: options.autoHide ?? true,
      autoHideDelayMs: options.autoHideDelayMs ?? 300,
      ...options,
    };

    // Overlay (full screen)
    this.overlay = document.createElement("div");
    this.overlay.style.position = "fixed";
    this.overlay.style.inset = "0";
    this.overlay.style.display = "flex";
    this.overlay.style.alignItems = "center";
    this.overlay.style.justifyContent = "center";
    this.overlay.style.background = "rgba(0, 0, 0, 0.25)";
    this.overlay.style.zIndex = "2000000";

    // Container (center box)
    this.container = document.createElement("div");
    this.container.style.minWidth = "280px";
    this.container.style.maxWidth = "80%";
    this.container.style.padding = "20px 24px";
    this.container.style.background = "#fff";
    this.container.style.borderRadius = "12px";
    this.container.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)";
    this.container.style.textAlign = "center";
    this.container.setAttribute("role", "progressbar");
    this.container.setAttribute("aria-valuemin", "0");

    // Track
    this.track = document.createElement("div");
    this.track.style.width = "100%";
    this.track.style.height = "12px";
    this.track.style.borderRadius = "999px";
    this.track.style.background = "rgba(0,0,0,0.1)";
    this.track.style.overflow = "hidden";
    this.track.style.marginTop = "8px";

    // Fill
    this.fill = document.createElement("div");
    this.fill.style.height = "100%";
    this.fill.style.width = "0%";
    this.fill.style.background = "#4a90e2";
    this.fill.style.transition = "width 150ms ease";

    // Text
    this.text = document.createElement("div");
    this.text.style.fontSize = "14px";
    this.text.style.marginBottom = "8px";
    this.text.style.fontFamily = "sans-serif";
    this.text.textContent = "";

    this.track.appendChild(this.fill);
    this.container.appendChild(this.text);
    this.container.appendChild(this.track);
    this.overlay.appendChild(this.container);

    document.body.appendChild(this.overlay);

    if (typeof this.opts.initialLoaded === "number") {
      this.loaded = Math.max(0, this.opts.initialLoaded);
    }

    this.render();

  //  this.hide(); // hidden by default until setTotal is called

    sdkProgress.onTasksAdded.subscribe((sdkProgress, numAdded) => {
      this.total+= numAdded;
      this.cancelAutoHide();
      this.show();
      this.render();
    });

    sdkProgress.onTaskCompleted.subscribe(() => {
      this.itemLoaded();
    });
  }

  setTotal(totalThings: number, keepLoaded = false): void {
    this.total = Math.max(0, Math.floor(totalThings));
    if (!keepLoaded) this.loaded = 0;

    this.cancelAutoHide();
    this.show();
    this.render();
  }

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

  reset(): void {
    this.loaded = 0;
    this.cancelAutoHide();
    this.show();
    this.render();
  }

  show(): void {
    this.overlay.style.display = "flex";
  }

  hide(): void {
    this.overlay.style.display = "none";
  }

  destroy(): void {
    this.cancelAutoHide();
    this.overlay.remove();
  }

  private render(): void {
    const pct = this.total <= 0 ? 0 : (this.loaded / this.total) * 100;
    const safePct = Math.min(Math.max(pct, 0), 100);

    this.fill.style.width = `${safePct}%`;
    this.container.setAttribute("aria-valuemax", String(this.total));
    this.container.setAttribute("aria-valuenow", String(this.loaded));

    const labelText =
      this.opts.label?.(this.loaded, this.total, safePct) ??
      (this.total > 0
        ? `Loading… ${this.loaded} / ${this.total} (${Math.round(safePct)}%)`
        : "");

    this.text.textContent = labelText;
  }

  private scheduleAutoHide(): void {
    this.cancelAutoHide();
    this.hideTimer = window.setTimeout(() => this.hide(), this.opts.autoHideDelayMs);
  }

  private cancelAutoHide(): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}
