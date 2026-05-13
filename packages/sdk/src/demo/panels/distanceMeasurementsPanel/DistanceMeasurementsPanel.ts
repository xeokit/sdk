import type {View} from "../../../viewer";
import {FloatingPanelBase} from "../floatingPanelBase";
import {DistanceMeasurementTool} from "../../systems/measurements/distance/DistanceMeasurementTool";
import type {DistanceMeasurementsPanelParams} from "./DistanceMeasurementsPanelParams";


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-dm-panel-styles";
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
// CSS — visually consistent with sister floating panels (matches
// the `xkt-bnd-` chrome from BoundariesPanel).
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-dm-panel {
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
.xkt-dm-panel *, .xkt-dm-panel *::before, .xkt-dm-panel *::after {
  box-sizing: border-box;
}
.xkt-dm-panel[hidden] { display: none; }

.xkt-dm-panel .xkt-dm-header {
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
.xkt-dm-panel .xkt-dm-header.xkt-dm-dragging { cursor: grabbing; }
.xkt-dm-panel .xkt-dm-title {
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
.xkt-dm-panel .xkt-dm-title-icon {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
  width: 24px;
  height: 24px;
  color: #FFA500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.xkt-dm-panel .xkt-dm-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-dm-panel .xkt-dm-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-dm-panel .xkt-dm-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-dm-panel .xkt-dm-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
.xkt-dm-panel .xkt-dm-close {
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
.xkt-dm-panel .xkt-dm-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-dm-pill {
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
  background: #FFA500;
  border: 1px solid #cc8400;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.xkt-dm-pill:hover { background: #cc8400; }
.xkt-dm-pill[hidden] { display: none; }

.xkt-dm-panel .xkt-dm-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px 12px 14px;
}
.xkt-dm-panel .xkt-dm-empty {
  padding: 20px 12px;
  text-align: center;
  color: #777;
  font-size: 12px;
}
.xkt-dm-panel .xkt-dm-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.xkt-dm-panel .xkt-dm-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #fafafa;
  border: 1px solid #ececec;
  border-radius: 6px;
}
.xkt-dm-panel .xkt-dm-row:hover {
  background: #f3f3f3;
  border-color: #d8d8d8;
}
.xkt-dm-panel .xkt-dm-row-label {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.xkt-dm-panel .xkt-dm-row-id {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #555;
}
.xkt-dm-panel .xkt-dm-row-length {
  flex-shrink: 0;
  font-weight: 600;
  color: #111;
  font-variant-numeric: tabular-nums;
}
.xkt-dm-panel .xkt-dm-row-destroy {
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
.xkt-dm-panel .xkt-dm-row-destroy:hover {
  background: #ffe6e6;
  color: #c0392b;
  border-color: #f0c0c0;
}

.xkt-dm-panel .xkt-dm-footer {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding: 8px 12px 12px;
  border-top: 1px solid #ececec;
}
.xkt-dm-panel .xkt-dm-clear {
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
.xkt-dm-panel .xkt-dm-clear:hover {
  background: #ffe6e6;
  color: #c0392b;
  border-color: #f0c0c0;
}
.xkt-dm-panel .xkt-dm-clear:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
`;


/**
 * Floating panel that lists every {@link DistanceMeasurement}
 * currently mounted on a {@link DistanceMeasurementTool}, with a
 * destroy button on each row and a "Clear all" footer button.
 *
 * Per-View singleton — keyed off the tool's
 * {@link DistanceMeasurementTool.view | View}, so opening the panel
 * twice for the same View returns the live instance and brings it
 * back to the foreground.
 *
 * Refreshes its row list on every
 * {@link DistanceMeasurementTool.onMeasurementsChanged} dispatch
 * while visible. Hidden panels detach the listener; the floating
 * pill stands in for them and costs nothing per-event.
 *
 * Construction is normally indirect, via
 * {@link DemoHelper.openDistanceMeasurementsPanel | DemoHelper}'s
 * factory or the View / Canvas context-menu entry; both ensure the
 * tool exists before the panel is constructed.
 */
export class DistanceMeasurementsPanel extends FloatingPanelBase {

  /**
   * Per-View instance registry. WeakMap so a View that is destroyed
   * elsewhere does not retain the panel for GC.
   */
  private static readonly _instances = new WeakMap<View, DistanceMeasurementsPanel>();

  /**
   * SVG glyph used in context-menu rows that toggle this panel —
   * a small ruler with three tick marks. Strokes use `currentColor`.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="3" y="9" width="18" height="6" rx="1.2" ` +
        `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<path d="M8 9 V12 M12 9 V13 M16 9 V12" ` +
        `stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>` +
    `</svg>`;
  }

  /**
   * Returns the live panel bound to {@link view}, or `undefined`
   * if none has been constructed (or the prior instance was
   * destroyed). Lets callers check for an existing panel without
   * the show side-effect of {@link openFor}.
   */
  static getFor(view: View): DistanceMeasurementsPanel | undefined {
    const inst = DistanceMeasurementsPanel._instances.get(view);
    return inst && !inst._destroyed ? inst : undefined;
  }

  /**
   * Reveal (or lazily mount) a panel for `params.tool.view`.
   * Idempotent — if a panel already exists for this View and is
   * still alive, it is brought back to the foreground; otherwise
   * a fresh one is constructed.
   */
  static openFor(params: DistanceMeasurementsPanelParams): DistanceMeasurementsPanel {
    const view = params.tool.view;
    const existing = DistanceMeasurementsPanel._instances.get(view);
    if (existing && !existing._destroyed) {
      existing.show();
      return existing;
    }
    return new DistanceMeasurementsPanel(params);
  }

  /** The tool whose measurements this panel renders. */
  readonly tool: DistanceMeasurementTool;

  /** The View this panel is scoped to (mirrors `tool.view`). */
  readonly view: View;

  // DOM refs.
  private _bodyEl!: HTMLElement;
  private _listEl!: HTMLElement;
  private _clearBtn!: HTMLButtonElement;

  // Lifecycle state.
  private _listenersAttached = false;
  private _unsubChanged: (() => void) | null = null;

  constructor(params: DistanceMeasurementsPanelParams) {
    if (!params || !params.tool) {
      throw new Error("DistanceMeasurementsPanel: params.tool is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-dm-panel",
      classPrefix: "xkt-dm",
    });
    this.tool = params.tool;
    this.view = this.tool.view;

    // Replace any prior panel bound to the same View — keeps
    // openFor's idempotence honest and avoids stale DOM left over
    // from hot-reload or re-import.
    const prior = DistanceMeasurementsPanel._instances.get(this.view);
    if (prior && !prior._destroyed) prior.destroy();
    DistanceMeasurementsPanel._instances.set(this.view, this);

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
    if (DistanceMeasurementsPanel._instances.get(this.view) === this) {
      DistanceMeasurementsPanel._instances.delete(this.view);
    }
    super.destroy();
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    const pill = document.createElement("button");
    pill.className = "xkt-dm-pill";
    pill.type = "button";
    pill.title = "Reopen the Distance Measurements panel";
    pill.hidden = true;
    pill.textContent = "Distance Measurements";
    this._pill = pill;

    this._panel = document.createElement("div");
    this._panel.className = "xkt-dm-panel";

    // Header.
    this._header = document.createElement("div");
    this._header.className = "xkt-dm-header";

    const title = document.createElement("h2");
    title.className = "xkt-dm-title";
    const titleIcon = document.createElement("span");
    titleIcon.className = "xkt-dm-title-icon";
    titleIcon.innerHTML = DistanceMeasurementsPanel.iconSvg();
    const titleStack = document.createElement("span");
    titleStack.className = "xkt-dm-title-stack";
    const titleText = document.createElement("span");
    titleText.className = "xkt-dm-title-text";
    titleText.textContent = "Distance Measurements";
    const subtitle = document.createElement("span");
    subtitle.className = "xkt-dm-subtitle";
    subtitle.textContent = "Distance measurements on this View.";
    titleStack.append(titleText, subtitle);
    title.append(titleIcon, titleStack);

    this._closeBtn = document.createElement("button");
    this._closeBtn.className = "xkt-dm-close";
    this._closeBtn.type = "button";
    this._closeBtn.setAttribute("aria-label", "Close panel");
    this._closeBtn.title = "Close panel";
    this._closeBtn.textContent = "×";

    this._header.append(title, this._closeBtn);
    this._panel.appendChild(this._header);

    // Body — populated on each render.
    this._bodyEl = document.createElement("div");
    this._bodyEl.className = "xkt-dm-body";
    this._listEl = document.createElement("div");
    this._listEl.className = "xkt-dm-list";
    this._bodyEl.appendChild(this._listEl);
    this._panel.appendChild(this._bodyEl);

    // Footer — clear-all button.
    const footer = document.createElement("div");
    footer.className = "xkt-dm-footer";
    this._clearBtn = document.createElement("button");
    this._clearBtn.className = "xkt-dm-clear";
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
   * {@link DistanceMeasurementTool.measurements} map. Cheap — the
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
      empty.className = "xkt-dm-empty";
      empty.textContent = "No distance measurements. Use \"Measure Distance…\" to create one.";
      this._listEl.appendChild(empty);
      this._clearBtn.disabled = true;
      return;
    }

    this._clearBtn.disabled = false;

    for (const id of ids) {
      const m = measurements[id];

      const row = document.createElement("div");
      row.className = "xkt-dm-row";

      const label = document.createElement("div");
      label.className = "xkt-dm-row-label";

      const idEl = document.createElement("span");
      idEl.className = "xkt-dm-row-id";
      idEl.textContent = id;
      idEl.title = id;

      const lengthEl = document.createElement("span");
      lengthEl.className = "xkt-dm-row-length";
      lengthEl.textContent = formatLength(m.length);

      label.append(idEl, lengthEl);

      const destroyBtn = document.createElement("button");
      destroyBtn.className = "xkt-dm-row-destroy";
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
 * Format a length value for display in a row. Mirrors the
 * resolution policy used by {@link DistanceMeasurement}'s on-canvas
 * label so the panel and the in-scene label show the same number
 * of significant digits.
 */
function formatLength(v: number): string {
  const av = Math.abs(v);
  if (av >= 100)  return v.toFixed(0);
  if (av >= 10)   return v.toFixed(1);
  if (av >= 1)    return v.toFixed(2);
  if (av >= 0.01) return v.toFixed(3);
  return v.toExponential(2);
}
