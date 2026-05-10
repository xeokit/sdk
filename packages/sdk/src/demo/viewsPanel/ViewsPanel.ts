import type {Viewer, View} from "../../viewer";
import type {DemoHelper} from "../DemoHelper";
import {FloatingPanelBase} from "../floatingPanelBase";
import type {ViewsPanelParams} from "./ViewsPanelParams";


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-vw-panel-styles";
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
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);
  _stylesInjected = true;
}


// ─────────────────────────────────────────────────────────────────
// CSS — visually consistent with sister floating panels.
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-vw-panel {
  position: fixed;
  top: 115px;
  right: 17px;
  width: 320px;
  height: auto;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.14);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  color: #111;
  z-index: 200000000;
  overflow: hidden;
  box-sizing: border-box;
}
.xkt-vw-panel *, .xkt-vw-panel *::before, .xkt-vw-panel *::after {
  box-sizing: border-box;
}

.xkt-vw-panel .xkt-vw-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px 12px 16px;
  border-bottom: 1px solid #ececec;
  flex: 0 0 auto;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
.xkt-vw-panel .xkt-vw-header.xkt-vw-dragging { cursor: grabbing; }
.xkt-vw-panel .xkt-vw-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  color: #111;
  display: flex;
  align-items: center;
  gap: 8px;
}
.xkt-vw-panel .xkt-vw-title-icon {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  color: #2d5e8c;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.xkt-vw-panel .xkt-vw-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-vw-panel .xkt-vw-close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  font: inherit;
  font-size: 22px;
  line-height: 1;
  color: #777;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
}
.xkt-vw-panel .xkt-vw-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-vw-pill {
  position: fixed;
  bottom: 17px;
  right: 17px;
  z-index: 200000000;
  padding: 9px 16px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #fff;
  background: #2d5e8c;
  border: 1px solid #1f4669;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.xkt-vw-pill:hover { background: #1f4669; }
.xkt-vw-pill[hidden] { display: none; }

.xkt-vw-panel .xkt-vw-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px 12px 14px;
}
.xkt-vw-panel .xkt-vw-empty {
  padding: 20px 12px;
  text-align: center;
  color: #777;
  font-size: 12px;
}
.xkt-vw-panel .xkt-vw-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.xkt-vw-panel .xkt-vw-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #fafafa;
  border: 1px solid #ececec;
  border-radius: 6px;
}
.xkt-vw-panel .xkt-vw-row:hover {
  background: #f3f3f3;
  border-color: #d8d8d8;
}
.xkt-vw-panel .xkt-vw-row-label {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.xkt-vw-panel .xkt-vw-row-id {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #555;
}
.xkt-vw-panel .xkt-vw-row-active {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #2d5e8c;
}
.xkt-vw-panel .xkt-vw-row-destroy {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  padding: 0;
  font: inherit;
  font-size: 16px;
  line-height: 1;
  color: #777;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
}
.xkt-vw-panel .xkt-vw-row-destroy:hover {
  background: #ffe6e6;
  color: #c0392b;
  border-color: #f0c0c0;
}

.xkt-vw-panel .xkt-vw-footer {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding: 8px 12px 12px;
  border-top: 1px solid #ececec;
}
.xkt-vw-panel .xkt-vw-new {
  padding: 5px 12px;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: #2d5e8c;
  border: 1px solid #1f4669;
  border-radius: 4px;
  cursor: pointer;
}
.xkt-vw-panel .xkt-vw-new:hover {
  background: #1f4669;
}
.xkt-vw-panel .xkt-vw-new:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
`;


/**
 * Floating panel that lists every {@link View} mounted on a
 * {@link Viewer}, with a destroy button on each row and a
 * "New View" footer button.
 *
 * Per-Viewer singleton — one panel per Viewer, keyed off the
 * Viewer for the registry. Refreshes on
 * {@link "../viewer".ViewerEvents.onViewCreated | onViewCreated} /
 * {@link "../viewer".ViewerEvents.onViewDestroyed | onViewDestroyed}
 * while visible.
 *
 * Rows are descriptive only — clicking a row does not change
 * focus or active-View state. Construction goes through
 * {@link DemoHelper.openViewsPanel | DemoHelper}'s factory or
 * the Toolbar's Views button.
 */
export class ViewsPanel extends FloatingPanelBase {

  /** Per-Viewer instance registry. */
  private static readonly _instances = new WeakMap<Viewer, ViewsPanel>();

  /**
   * SVG glyph used in toolbar / context-menu rows that toggle
   * this panel — three small horizontal frames stacked. Strokes
   * use `currentColor`.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="3.5" y="4.5"  width="17" height="4" rx="1" ` +
        `fill="none" stroke="currentColor" stroke-width="1.4"/>` +
      `<rect x="3.5" y="10"   width="17" height="4" rx="1" ` +
        `fill="none" stroke="currentColor" stroke-width="1.4"/>` +
      `<rect x="3.5" y="15.5" width="17" height="4" rx="1" ` +
        `fill="none" stroke="currentColor" stroke-width="1.4"/>` +
    `</svg>`;
  }

  /**
   * Returns the live panel bound to {@link viewer}, or
   * `undefined` if none has been constructed (or the prior
   * instance was destroyed).
   */
  static getFor(viewer: Viewer): ViewsPanel | undefined {
    const inst = ViewsPanel._instances.get(viewer);
    return inst && !inst._destroyed ? inst : undefined;
  }

  /**
   * Reveal (or lazily mount) a panel for `params.viewer`.
   * Idempotent — if a panel already exists for this Viewer and
   * is still alive, it is brought back to the foreground;
   * otherwise a fresh one is constructed.
   */
  static openFor(params: ViewsPanelParams): ViewsPanel {
    const existing = ViewsPanel._instances.get(params.viewer);
    if (existing && !existing._destroyed) {
      existing.show();
      return existing;
    }
    return new ViewsPanel(params);
  }

  /** The Viewer this panel lists Views from. */
  readonly viewer: Viewer;

  /** Optional helper used to wire the "New View" footer button. */
  readonly demoHelper?: DemoHelper;

  // DOM refs.
  private _bodyEl!: HTMLElement;
  private _listEl!: HTMLElement;
  private _newBtn!: HTMLButtonElement;

  // Lifecycle state.
  private _listenersAttached = false;
  private readonly _unsubs: Array<() => void> = [];

  constructor(params: ViewsPanelParams) {
    if (!params || !params.viewer) {
      throw new Error("ViewsPanel: params.viewer is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-vw-panel",
      classPrefix: "xkt-vw",
    });
    this.viewer = params.viewer;
    this.demoHelper = params.demoHelper;

    const prior = ViewsPanel._instances.get(this.viewer);
    if (prior && !prior._destroyed) prior.destroy();
    ViewsPanel._instances.set(this.viewer, this);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();

    if (params.visible === false) {
      this.hide();
    } else {
      this.show();
    }
  }


  // ── Public lifecycle ──────────────────────────────────────────

  show(): void {
    if (this._destroyed) return;
    super.show();
    this._attachListeners();
    this._renderList();
  }

  hide(): void {
    if (this._destroyed) return;
    super.hide();
    this._detachListeners();
  }

  destroy(): void {
    if (this._destroyed) return;
    this._detachListeners();
    if (ViewsPanel._instances.get(this.viewer) === this) {
      ViewsPanel._instances.delete(this.viewer);
    }
    super.destroy();
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    const pill = document.createElement("button");
    pill.className = "xkt-vw-pill";
    pill.type = "button";
    pill.title = "Reopen the Views panel";
    pill.hidden = true;
    pill.textContent = "Views";
    this._pill = pill;

    this._panel = document.createElement("div");
    this._panel.className = "xkt-vw-panel";

    // Header.
    this._header = document.createElement("div");
    this._header.className = "xkt-vw-header";

    const title = document.createElement("h2");
    title.className = "xkt-vw-title";
    const titleIcon = document.createElement("span");
    titleIcon.className = "xkt-vw-title-icon";
    titleIcon.innerHTML = ViewsPanel.iconSvg();
    const titleText = document.createElement("span");
    titleText.className = "xkt-vw-title-text";
    titleText.textContent = "Views";
    title.append(titleIcon, titleText);

    this._closeBtn = document.createElement("button");
    this._closeBtn.className = "xkt-vw-close";
    this._closeBtn.type = "button";
    this._closeBtn.setAttribute("aria-label", "Close panel");
    this._closeBtn.title = "Close panel";
    this._closeBtn.textContent = "×";

    this._header.append(title, this._closeBtn);
    this._panel.appendChild(this._header);

    // Body.
    this._bodyEl = document.createElement("div");
    this._bodyEl.className = "xkt-vw-body";
    this._listEl = document.createElement("div");
    this._listEl.className = "xkt-vw-list";
    this._bodyEl.appendChild(this._listEl);
    this._panel.appendChild(this._bodyEl);

    // Footer.
    const footer = document.createElement("div");
    footer.className = "xkt-vw-footer";
    this._newBtn = document.createElement("button");
    this._newBtn.className = "xkt-vw-new";
    this._newBtn.type = "button";
    this._newBtn.title = this.demoHelper
      ? "Create a new View, cloning the active View's camera"
      : "Construct the panel with a DemoHelper to enable New View";
    this._newBtn.textContent = "New View";
    this._newBtn.disabled = !this.demoHelper;
    this._newBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._createView();
    });
    footer.appendChild(this._newBtn);
    this._panel.appendChild(footer);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }


  // ── Listener attach / detach ──────────────────────────────────

  private _attachListeners(): void {
    if (this._listenersAttached || this._destroyed) return;
    this._listenersAttached = true;
    const events = this.viewer.events;
    const onChange = () => this._renderList();
    this._unsubs.push(events.onViewCreated.subscribe(onChange));
    this._unsubs.push(events.onViewDestroyed.subscribe(onChange));
  }

  private _detachListeners(): void {
    if (!this._listenersAttached) return;
    for (const u of this._unsubs) {
      try { u(); } catch { /* ignore */ }
    }
    this._unsubs.length = 0;
    this._listenersAttached = false;
  }


  // ── Actions ───────────────────────────────────────────────────

  /**
   * Create a fresh View by cloning the active View's camera.
   * No-op when no DemoHelper was supplied or the active View
   * cannot serialise its camera.
   */
  private _createView(): void {
    if (!this.demoHelper || this._destroyed) return;
    const active = this._getActiveView();
    if (!active) {
      this.demoHelper.createView({});
      return;
    }
    const cameraResult = active.camera.toParams();
    if (cameraResult.ok === false) {
      console.warn("[ViewsPanel] toParams failed; creating View with default camera:", cameraResult.error);
      this.demoHelper.createView({});
      return;
    }
    this.demoHelper.createView({camera: cameraResult.value});
  }


  // ── Rendering ─────────────────────────────────────────────────

  /**
   * Repaint the row list from the current
   * {@link "../viewer".Viewer.viewList | Viewer.viewList}.
   */
  private _renderList(): void {
    if (this._destroyed) return;

    const views = this.viewer.viewList;
    this._listEl.replaceChildren();

    if (views.length === 0) {
      const empty = document.createElement("div");
      empty.className = "xkt-vw-empty";
      empty.textContent = "No Views. Use \"New View\" to create one.";
      this._listEl.appendChild(empty);
      return;
    }

    const active = this._getActiveView();

    for (const view of views) {
      const row = document.createElement("div");
      row.className = "xkt-vw-row";

      const label = document.createElement("div");
      label.className = "xkt-vw-row-label";

      const idEl = document.createElement("span");
      idEl.className = "xkt-vw-row-id";
      idEl.textContent = view.id;
      idEl.title = view.id;
      label.appendChild(idEl);

      if (view === active) {
        const activeEl = document.createElement("span");
        activeEl.className = "xkt-vw-row-active";
        activeEl.textContent = "active";
        label.appendChild(activeEl);
      }

      const destroyBtn = document.createElement("button");
      destroyBtn.className = "xkt-vw-row-destroy";
      destroyBtn.type = "button";
      destroyBtn.title = `Close ${view.id}`;
      destroyBtn.setAttribute("aria-label", `Close ${view.id}`);
      destroyBtn.textContent = "×";
      destroyBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this._destroyView(view);
      });

      row.append(label, destroyBtn);
      this._listEl.appendChild(row);
    }
  }


  // ── Helpers ──────────────────────────────────────────────────

  /**
   * Resolve the View whose camera the next
   * {@link DemoHelper.createView} call should clone, and which
   * earns the "active" badge in the row list. Defaults to the
   * first View; callers with a more nuanced notion of active can
   * subclass and override.
   */
  private _getActiveView(): View | null {
    return this.viewer.viewList[0] ?? null;
  }

  /**
   * Destroy a view through the DemoHelper when one is wired —
   * that path keeps the helper's per-View bookkeeping
   * (CameraFlight, ViewController, auto-canvas) in sync.
   * Otherwise call `view.destroy()` directly.
   */
  private _destroyView(view: View): void {
    if (this.demoHelper) {
      this.demoHelper.destroyView(view);
    } else {
      view.destroy();
    }
  }
}
