import type {View} from "../../../viewing/viewer";
import {FloatingPanelBase} from "../floatingPanelBase";
import {AngleMeasurementsTool} from "../../../tools/measurements/angle/AngleMeasurementsTool";
import type {AngleMeasurementsPanelParams} from "./AngleMeasurementsPanelParams";


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-am-panel-styles";
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
// CSS — visually consistent with sister floating panels. Accent
// uses the AngleMeasurementsTool default colour (purple) so the
// panel and the in-scene labels share a palette.
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-am-panel {
  position: fixed;
  top: 115px;
  right: 17px;
  width: 360px;
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
.xkt-am-panel *, .xkt-am-panel *::before, .xkt-am-panel *::after {
  box-sizing: border-box;
}
.xkt-am-panel[hidden] { display: none; }

.xkt-am-panel .xkt-am-header {
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
.xkt-am-panel .xkt-am-header.xkt-am-dragging { cursor: grabbing; }
.xkt-am-panel .xkt-am-title {
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
.xkt-am-panel .xkt-am-title-icon {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
  width: 24px;
  height: 24px;
  color: #9C27B0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.xkt-am-panel .xkt-am-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-am-panel .xkt-am-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-am-panel .xkt-am-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-am-panel .xkt-am-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
.xkt-am-panel .xkt-am-close {
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
.xkt-am-panel .xkt-am-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-am-pill {
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
  background: #9C27B0;
  border: 1px solid #6A1B9A;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.xkt-am-pill:hover { background: #6A1B9A; }
.xkt-am-pill[hidden] { display: none; }

.xkt-am-panel .xkt-am-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px 12px 14px;
}
.xkt-am-panel .xkt-am-empty {
  padding: 20px 12px;
  text-align: center;
  color: #777;
  font-size: 12px;
}
.xkt-am-panel .xkt-am-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.xkt-am-panel .xkt-am-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #fafafa;
  border: 1px solid #ececec;
  border-radius: 6px;
}
.xkt-am-panel .xkt-am-row:hover {
  background: #f3f3f3;
  border-color: #d8d8d8;
}
.xkt-am-panel .xkt-am-row-label {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.xkt-am-panel .xkt-am-row-id {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #555;
}
.xkt-am-panel .xkt-am-row-angle {
  flex-shrink: 0;
  font-weight: 600;
  color: #111;
  font-variant-numeric: tabular-nums;
}
.xkt-am-panel .xkt-am-row-destroy {
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
.xkt-am-panel .xkt-am-row-destroy:hover {
  background: #ffe6e6;
  color: #c0392b;
  border-color: #f0c0c0;
}

.xkt-am-panel .xkt-am-footer {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding: 8px 12px 12px;
  border-top: 1px solid #ececec;
}
.xkt-am-panel .xkt-am-clear {
  padding: 5px 10px;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  color: #777;
  background: transparent;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  cursor: pointer;
}
.xkt-am-panel .xkt-am-clear:hover {
  background: #ffe6e6;
  color: #c0392b;
  border-color: #f0c0c0;
}
.xkt-am-panel .xkt-am-clear:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
`;


/**
 * Floating panel that lists every {@link AngleMeasurement}
 * currently mounted on an {@link AngleMeasurementsTool}, with a
 * destroy button on each row and a "Clear all" footer button.
 *
 * Per-View singleton — keyed off the tool's
 * {@link AngleMeasurementsTool.view | View}, so opening the panel
 * twice for the same View returns the live instance and brings it
 * back to the foreground.
 *
 * Refreshes its row list on every
 * {@link AngleMeasurementsTool.onMeasurementsChanged} dispatch
 * while visible. Hidden panels detach the listener; the floating
 * pill stands in for them and costs nothing per-event.
 *
 * Construction is normally indirect, via
 * {@link Studio.openAngleMeasurementsPanel | Studio}'s
 * factory or the View / Canvas context-menu entry; both ensure the
 * tool exists before the panel is constructed.
 */
export class AngleMeasurementsPanel extends FloatingPanelBase {

  /**
   * Per-View instance registry. WeakMap so a View that is destroyed
   * elsewhere does not retain the panel for GC.
   */
  private static readonly _instances = new WeakMap<View, AngleMeasurementsPanel>();

  /**
   * SVG glyph used in context-menu rows that toggle this panel —
   * a small angle icon (two arms meeting with an arc). Strokes use
   * `currentColor`.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M4 20 L20 20 L4 6 Z" ` +
        `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M9 20 A 5 5 0 0 0 4 15" ` +
        `fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>` +
    `</svg>`;
  }

  /**
   * Returns the live panel bound to {@link view}, or `undefined`
   * if none has been constructed (or the prior instance was
   * destroyed). Lets callers check for an existing panel without
   * the show side-effect of {@link openFor}.
   */
  static getFor(view: View): AngleMeasurementsPanel | undefined {
    const inst = AngleMeasurementsPanel._instances.get(view);
    return inst && !inst._destroyed ? inst : undefined;
  }

  /**
   * Reveal (or lazily mount) a panel for `params.tool.view`.
   * Idempotent — if a panel already exists for this View and is
   * still alive, it is brought back to the foreground; otherwise
   * a fresh one is constructed.
   */
  static openFor(params: AngleMeasurementsPanelParams): AngleMeasurementsPanel {
    const view = params.tool.view;
    const existing = AngleMeasurementsPanel._instances.get(view);
    if (existing && !existing._destroyed) {
      existing.show();
      return existing;
    }
    return new AngleMeasurementsPanel(params);
  }

  /** The tool whose measurements this panel renders. */
  readonly tool: AngleMeasurementsTool;

  /** The View this panel is scoped to (mirrors `tool.view`). */
  readonly view: View;

  // DOM refs.
  private _bodyEl!: HTMLElement;
  private _listEl!: HTMLElement;
  private _clearBtn!: HTMLButtonElement;

  // Lifecycle state.
  private _listenersAttached = false;
  private _unsubChanged: (() => void) | null = null;

  constructor(params: AngleMeasurementsPanelParams) {
    if (!params || !params.tool) {
      throw new Error("AngleMeasurementsPanel: params.tool is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-am-panel",
      classPrefix: "xkt-am",
    });
    this.tool = params.tool;
    this.view = this.tool.view;

    // Replace any prior panel bound to the same View — keeps
    // openFor's idempotence honest and avoids stale DOM left over
    // from hot-reload or re-import.
    const prior = AngleMeasurementsPanel._instances.get(this.view);
    if (prior && !prior._destroyed) prior.destroy();
    AngleMeasurementsPanel._instances.set(this.view, this);

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
    if (AngleMeasurementsPanel._instances.get(this.view) === this) {
      AngleMeasurementsPanel._instances.delete(this.view);
    }
    super.destroy();
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    const pill = document.createElement("button");
    pill.className = "xkt-am-pill";
    pill.type = "button";
    pill.title = "Reopen the Angle Measurements panel";
    pill.hidden = true;
    pill.textContent = "Angle Measurements";
    this._pill = pill;

    this._panel = document.createElement("div");
    this._panel.className = "xkt-am-panel";

    // Header.
    this._header = document.createElement("div");
    this._header.className = "xkt-am-header";

    const title = document.createElement("h2");
    title.className = "xkt-am-title";
    const titleIcon = document.createElement("span");
    titleIcon.className = "xkt-am-title-icon";
    titleIcon.innerHTML = AngleMeasurementsPanel.iconSvg();
    const titleStack = document.createElement("span");
    titleStack.className = "xkt-am-title-stack";
    const titleText = document.createElement("span");
    titleText.className = "xkt-am-title-text";
    titleText.textContent = "Angle Measurements";
    const subtitle = document.createElement("span");
    subtitle.className = "xkt-am-subtitle";
    subtitle.textContent = "Angle measurements on this View.";
    titleStack.append(titleText, subtitle);
    title.append(titleIcon, titleStack);

    this._closeBtn = document.createElement("button");
    this._closeBtn.className = "xkt-am-close";
    this._closeBtn.type = "button";
    this._closeBtn.setAttribute("aria-label", "Close panel");
    this._closeBtn.title = "Close panel";
    this._closeBtn.textContent = "×";

    this._header.append(title, this._closeBtn);
    this._panel.appendChild(this._header);

    // Body — populated on each render.
    this._bodyEl = document.createElement("div");
    this._bodyEl.className = "xkt-am-body";
    this._listEl = document.createElement("div");
    this._listEl.className = "xkt-am-list";
    this._bodyEl.appendChild(this._listEl);
    this._panel.appendChild(this._bodyEl);

    // Footer — clear-all button.
    const footer = document.createElement("div");
    footer.className = "xkt-am-footer";
    this._clearBtn = document.createElement("button");
    this._clearBtn.className = "xkt-am-clear";
    this._clearBtn.type = "button";
    this._clearBtn.title = "Destroy every measurement";
    this._clearBtn.textContent = "Clear all";
    this._clearBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this.tool.clear();
    });
    footer.appendChild(this._clearBtn);
    this._panel.appendChild(footer);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }


  // ── Listener attach / detach ──────────────────────────────────

  private _attachListeners(): void {
    if (this._listenersAttached || this._destroyed) return;
    this._listenersAttached = true;
    this._unsubChanged = this.tool.onMeasurementsChanged.subscribe(
      () => this._renderList(),
    );
  }

  private _detachListeners(): void {
    if (!this._listenersAttached) return;
    if (this._unsubChanged) {
      try { this._unsubChanged(); } catch { /* ignore */ }
      this._unsubChanged = null;
    }
    this._listenersAttached = false;
  }


  // ── Rendering ─────────────────────────────────────────────────

  /**
   * Repaint the row list from the current
   * {@link AngleMeasurementsTool.measurements} map. Cheap — the
   * map is small (typical CAD workflows hold tens, not thousands).
   * If that ceases to hold, replace the wholesale `replaceChildren`
   * with diff-based row reconciliation.
   */
  private _renderList(): void {
    if (this._destroyed) return;

    const measurements = this.tool.measurements;
    const ids = Object.keys(measurements).sort();

    this._listEl.replaceChildren();

    if (ids.length === 0) {
      const empty = document.createElement("div");
      empty.className = "xkt-am-empty";
      empty.textContent = "No angle measurements. Use \"Measure Angle…\" to create one.";
      this._listEl.appendChild(empty);
      this._clearBtn.disabled = true;
      return;
    }

    this._clearBtn.disabled = false;

    for (const id of ids) {
      const m = measurements[id];

      const row = document.createElement("div");
      row.className = "xkt-am-row";

      const label = document.createElement("div");
      label.className = "xkt-am-row-label";

      const idEl = document.createElement("span");
      idEl.className = "xkt-am-row-id";
      idEl.textContent = id;
      idEl.title = id;

      const angleEl = document.createElement("span");
      angleEl.className = "xkt-am-row-angle";
      angleEl.textContent = formatAngle(m.angleDegrees);

      label.append(idEl, angleEl);

      const destroyBtn = document.createElement("button");
      destroyBtn.className = "xkt-am-row-destroy";
      destroyBtn.type = "button";
      destroyBtn.title = `Destroy ${id}`;
      destroyBtn.setAttribute("aria-label", `Destroy ${id}`);
      destroyBtn.textContent = "×";
      destroyBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.tool.destroyMeasurement(id);
      });

      row.append(label, destroyBtn);
      this._listEl.appendChild(row);
    }
  }
}


// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Format a degree value for display in a row. Mirrors the
 * resolution policy used by {@link AngleMeasurement}'s on-canvas
 * label so the panel and the in-scene label show the same number
 * of significant digits, with the degree sign appended.
 */
function formatAngle(deg: number): string {
  const abs = Math.abs(deg);
  if (abs < 10) return `${deg.toFixed(1)}°`;
  return `${deg.toFixed(0)}°`;
}
