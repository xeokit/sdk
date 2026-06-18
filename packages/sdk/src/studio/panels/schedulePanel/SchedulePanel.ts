import {EventEmitter, type SDKResult, SDKErrorType} from "../../../base/core";
import {EventDispatcher} from "strongly-typed-events";
import type {SchedulePlayer, ScheduleTask, Schedule} from "../../../presentations/schedule";
import {el} from "../../utils/el";
import {FloatingPanelBase, type FloatingPanelBaseParams} from "../floatingPanelBase";


/**
 * Constructor parameters for {@link SchedulePanel | SchedulePanel}.
 *
 */
export interface SchedulePanelParams {

  /**
   * The player whose schedule is rendered. The panel two-way-binds
   * to the player: the player's `onDateChanged` updates the cursor;
   * dragging the cursor or clicking a milestone calls back into the
   * player's `setDateMs` / `nextMilestone` / `play` / `pause`.
   */
  player: SchedulePlayer;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed state.
   * Defaults to `"xkt-sch-panel"`.
   */
  storageKey?: string;

  /** Show on construction (default `true`). */
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────────
// CSS — same shape as BoundariesPanel / InfoPanel: emitted once on
// first construction via injectStylesOnce(). Every class prefixed
// `xkt-sch-` so the panel can coexist with other Studio surfaces.
// ─────────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-sch-styles";
let _stylesInjected = false;

const PANEL_CSS = `
.xkt-sch-panel {
  position: fixed;
  bottom: 17px;
  left: 17px;
  width: 720px;
  height: auto;
  max-height: calc(50vh);
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
.xkt-sch-panel *, .xkt-sch-panel *::before, .xkt-sch-panel *::after { box-sizing: inherit; }
.xkt-sch-panel[hidden] { display: none; }

.xkt-sch-header {
  display: flex;
  align-items: center;
  padding: 8px 10px 6px 12px;
  border-bottom: 1px solid #eee;
  cursor: grab;
  user-select: none;
  flex: 0 0 auto;
}
.xkt-sch-header.xkt-sch-dragging { cursor: grabbing; }
.xkt-sch-title {
  flex: 1;
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.xkt-sch-title svg { width: 16px; height: 16px; }
.xkt-sch-close {
  appearance: none;
  background: transparent;
  border: 0;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  color: #666;
}
.xkt-sch-close:hover { color: #111; background: #f0f0f0; }

.xkt-sch-body {
  padding: 8px 10px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
}

.xkt-sch-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}
.xkt-sch-playbtn {
  appearance: none;
  background: #1f6feb;
  color: white;
  border: 0;
  border-radius: 4px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}
.xkt-sch-playbtn:hover { background: #1758c0; }
.xkt-sch-step {
  appearance: none;
  background: #eef2f7;
  color: #333;
  border: 1px solid #d8dde6;
  border-radius: 4px;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 12px;
}
.xkt-sch-step:hover { background: #dfe5ee; }
.xkt-sch-current {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: #444;
}
.xkt-sch-speed {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #555;
}
.xkt-sch-speed input {
  width: 88px;
}

.xkt-sch-gantt {
  border-top: 1px solid #eee;
  padding-top: 6px;
}
.xkt-sch-gantt svg {
  display: block;
  width: 100%;
  user-select: none;
}
.xkt-sch-gantt-row-label {
  fill: #333;
  font-size: 11px;
  font-family: inherit;
}
.xkt-sch-gantt-axis-label {
  fill: #777;
  font-size: 10px;
  font-family: inherit;
  text-anchor: middle;
}
.xkt-sch-gantt-grid {
  stroke: #ececec;
  stroke-width: 1;
  shape-rendering: crispEdges;
}
.xkt-sch-gantt-cursor {
  stroke: #1f6feb;
  stroke-width: 2;
  cursor: ew-resize;
}
.xkt-sch-gantt-cursor-hit {
  fill: transparent;
  cursor: ew-resize;
}
.xkt-sch-gantt-bar {
  cursor: pointer;
}
.xkt-sch-gantt-bar:hover { filter: brightness(1.1); }
.xkt-sch-gantt-bar-name {
  fill: #fff;
  font-size: 10px;
  font-family: inherit;
  pointer-events: none;
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.35);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.xkt-sch-gantt-milestone {
  cursor: pointer;
}
.xkt-sch-gantt-milestone:hover { filter: brightness(1.2); }
.xkt-sch-gantt-clickarea {
  fill: transparent;
  cursor: ew-resize;
}
`;

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


// ─────────────────────────────────────────────────────────────────────

const SVG_NS = "http://www.w3.org/2000/svg";

// Layout constants for the Gantt body. Heights chosen so 6-12 tasks
// fit without scrolling at the panel's default 720×auto size.
const LEFT_GUTTER_PX = 130;
const ROW_HEIGHT_PX  = 22;
const ROW_GAP_PX     = 4;
const AXIS_HEIGHT_PX = 22;
const RIGHT_PAD_PX   = 12;
const BAR_INSET_PX   = 4;   // top/bottom margin inside each row


/**
 * Draggable Gantt-style schedule visualisation, two-way bound to a
 * {@link presentations!schedule.SchedulePlayer | SchedulePlayer}.
 *
 * - Renders every task in the player's schedule as a horizontal bar
 *   coloured by its `tradeColor`, with the task's display name baked
 *   into the bar.
 * - Renders milestones as diamond chevrons on the time axis.
 * - Draws a vertical cursor at the player's current date.
 * - Click anywhere in the timeline area scrubs the cursor to that
 *   date. Drag the cursor itself for fine-grain scrubbing.
 * - Play / pause / step-to-milestone buttons in the chrome bar.
 * - A speed slider exposes the player's `playbackSpeed` directly.
 *
 * The panel subscribes to `player.onDateChanged / onPlay / onPause`
 * so any other UI (an InfoPanel slider, programmatic `setDateMs`,
 * etc.) keeps the panel in sync. `destroy()` unsubscribes everything.
 *
 */
export class SchedulePanel extends FloatingPanelBase {

  /** Per-player instance registry — `openFor` returns the existing
   *  live panel for a player rather than stacking duplicates. */
  private static readonly _instances = new WeakMap<SchedulePlayer, SchedulePanel>();

  /** Title-bar glyph: a small Gantt chart silhouette. */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="3"  y="4"  width="11" height="3" rx="1" fill="currentColor" opacity="0.85"/>` +
      `<rect x="6"  y="10" width="13" height="3" rx="1" fill="currentColor" opacity="0.6"/>` +
      `<rect x="9"  y="16" width="9"  height="3" rx="1" fill="currentColor" opacity="0.4"/>` +
    `</svg>`;
  }

  /** Returns the live panel for `player` if one exists. */
  static getFor(player: SchedulePlayer): SchedulePanel | undefined {
    const inst = SchedulePanel._instances.get(player);
    return inst && !inst._destroyed ? inst : undefined;
  }

  /** Reveal (or lazily mount) a panel for the given player.
   *  Idempotent. */
  static openFor(params: SchedulePanelParams): SchedulePanel {
    let inst = SchedulePanel._instances.get(params.player);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new SchedulePanel(params);
    return inst;
  }

  public readonly player: SchedulePlayer;
  public readonly onTaskClicked: EventEmitter<SchedulePanel, ScheduleTask>;

  // DOM refs.
  private _bodyEl!: HTMLElement;
  private _ganttEl!: HTMLElement;
  private _svg!: SVGSVGElement;
  private _playBtn!: HTMLButtonElement;
  private _currentEl!: HTMLSpanElement;
  private _speedSlider!: HTMLInputElement;
  private _cursorEl!: SVGLineElement;

  // Cached layout — recomputed on rebuild.
  private _scheduleStartMs: number = 0;
  private _scheduleSpanMs:  number = 1;
  private _innerLeftPx:     number = LEFT_GUTTER_PX;
  private _innerWidthPx:    number = 0;
  private _innerHeightPx:   number = 0;

  // Subscription cleanup.
  private _unsubDate:       (() => void) | null = null;
  private _unsubPlay:       (() => void) | null = null;
  private _unsubPause:      (() => void) | null = null;
  private _resizeObserver:  ResizeObserver | null = null;

  constructor(params: SchedulePanelParams) {
    if (!params || !params.player) {
      throw new Error("SchedulePanel: player is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-sch-panel",
      classPrefix: "xkt-sch",
    } as FloatingPanelBaseParams);

    this.player = params.player;
    this.onTaskClicked = new EventEmitter(new EventDispatcher<SchedulePanel, ScheduleTask>());

    // Single-panel-per-player: replace any prior instance.
    const prior = SchedulePanel._instances.get(params.player);
    if (prior && !prior._destroyed) prior.destroy();
    SchedulePanel._instances.set(params.player, this);

    injectStylesOnce();
    this._buildDom();
    this._wireDomEvents();
    this._subscribePlayer();
    this._rebuildGantt();
    this._refreshCursor();
    this._refreshReadout();
    this._refreshPlayButton();

    if (params.visible === false) {
      this.hide();
    }
  }

  // ── DOM ───────────────────────────────────────────────────────────

  protected _buildDom(): void {
    this._panel = el("div", "xkt-sch-panel");

    // Header.
    this._header = el("div", "xkt-sch-header");
    const title = el("h2", "xkt-sch-title");
    title.innerHTML =
      `<span>${SchedulePanel.iconSvg()}</span>` +
      `<span>Schedule</span>`;
    this._closeBtn = el("button", "xkt-sch-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;
    this._header.append(title, this._closeBtn);

    // Pill (reopen affordance after `hide()`).
    this._pill = el("button", "xkt-sch-pill", {
      type:       "button",
      hidden:     true,
      textContent:"Schedule",
    }) as HTMLButtonElement;

    // Body: controls row + Gantt SVG host.
    this._bodyEl = el("div", "xkt-sch-body");

    const controls = el("div", "xkt-sch-controls");

    this._playBtn = el("button", "xkt-sch-playbtn", {
      type: "button",
      textContent: "▶ Play",
      title: "Play / pause schedule playback",
    }) as HTMLButtonElement;

    const prevBtn = el("button", "xkt-sch-step", {
      type: "button",
      textContent: "⏮",
      title: "Jump to previous milestone",
    }) as HTMLButtonElement;
    const nextBtn = el("button", "xkt-sch-step", {
      type: "button",
      textContent: "⏭",
      title: "Jump to next milestone",
    }) as HTMLButtonElement;

    const speedWrap = el("label", "xkt-sch-speed");
    speedWrap.appendChild(document.createTextNode("Speed"));
    this._speedSlider = el("input", "", {
      type:  "range",
      min:   "1",
      max:   "60",
      step:  "1",
      value: String(this.player.playbackSpeed),
      title: "Schedule-days advanced per real-time second",
    }) as HTMLInputElement;
    speedWrap.appendChild(this._speedSlider);

    this._currentEl = el("span", "xkt-sch-current") as HTMLSpanElement;

    controls.append(this._playBtn, prevBtn, nextBtn, speedWrap, this._currentEl);

    // Buttons retained on the instance for later setup.
    (this as any)._prevBtn = prevBtn;
    (this as any)._nextBtn = nextBtn;

    // Gantt host + SVG.
    this._ganttEl = el("div", "xkt-sch-gantt");
    this._svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
    this._svg.setAttribute("preserveAspectRatio", "none");
    this._ganttEl.appendChild(this._svg);

    this._bodyEl.append(controls, this._ganttEl);
    this._panel.append(this._header, this._bodyEl);
    this._container.append(this._pill, this._panel);
  }

  protected _wireDomEvents(): void {
    this._closeBtn.addEventListener("click", () => this.hide());

    this._playBtn.addEventListener("click", () => {
      if (this.player.playing) this.player.pause();
      else                     this.player.play();
    });
    (this as any)._prevBtn.addEventListener("click", () => {
      this.player.previousMilestone();
    });
    (this as any)._nextBtn.addEventListener("click", () => {
      this.player.nextMilestone();
    });

    this._speedSlider.addEventListener("input", () => {
      const v = parseFloat(this._speedSlider.value);
      if (Number.isFinite(v) && v > 0) this.player.playbackSpeed = v;
    });

    // Clicks inside the timeline area scrub the cursor.
    this._svg.addEventListener("click", (ev) => this._handleTimelineClick(ev));

    // Drag the cursor for fine-grain scrubbing.
    let dragging = false;
    this._svg.addEventListener("pointerdown", (ev) => {
      const target = ev.target as Element | null;
      if (!target) return;
      if (target.classList.contains("xkt-sch-gantt-cursor") ||
          target.classList.contains("xkt-sch-gantt-cursor-hit")) {
        dragging = true;
        this._svg.setPointerCapture(ev.pointerId);
        this._scrubFromEvent(ev);
        ev.preventDefault();
      }
    });
    this._svg.addEventListener("pointermove", (ev) => {
      if (!dragging) return;
      this._scrubFromEvent(ev);
    });
    this._svg.addEventListener("pointerup", (ev) => {
      if (!dragging) return;
      dragging = false;
      this._svg.releasePointerCapture(ev.pointerId);
    });

    // Re-layout on container resize (collapses LEFT_GUTTER on narrow widths).
    if (typeof ResizeObserver !== "undefined") {
      this._resizeObserver = new ResizeObserver(() => {
        this._rebuildGantt();
        this._refreshCursor();
      });
      this._resizeObserver.observe(this._ganttEl);
    }
  }

  private _subscribePlayer(): void {
    this._unsubDate  = this.player.onDateChanged.subscribe(() => {
      this._refreshCursor();
      this._refreshReadout();
    });
    this._unsubPlay  = this.player.onPlay.subscribe(() => this._refreshPlayButton());
    this._unsubPause = this.player.onPause.subscribe(() => this._refreshPlayButton());
  }

  // ── Gantt drawing ────────────────────────────────────────────────

  private _rebuildGantt(): void {
    const schedule = this.player.schedule;
    const tasks = schedule.tasksList;
    const milestones = schedule.milestones;
    const startMs = schedule.startDate.getTime();
    const endMs   = schedule.endDate.getTime();

    this._scheduleStartMs = startMs;
    this._scheduleSpanMs  = Math.max(1, endMs - startMs);

    // Geometry. Width follows the host element; height is task count.
    const widthPx = Math.max(360, this._ganttEl.clientWidth || 720);
    const taskRowHeight = ROW_HEIGHT_PX + ROW_GAP_PX;
    const nonMilestoneTasks = tasks.filter(t => !t.milestone);
    const rowCount = nonMilestoneTasks.length;
    const heightPx = AXIS_HEIGHT_PX + rowCount * taskRowHeight + 6;

    this._innerLeftPx   = LEFT_GUTTER_PX;
    this._innerWidthPx  = widthPx - LEFT_GUTTER_PX - RIGHT_PAD_PX;
    this._innerHeightPx = heightPx;

    this._svg.setAttribute("width",  String(widthPx));
    this._svg.setAttribute("height", String(heightPx));
    this._svg.setAttribute("viewBox", `0 0 ${widthPx} ${heightPx}`);

    // Clear and repopulate.
    while (this._svg.firstChild) this._svg.removeChild(this._svg.firstChild);

    const timeToX = (ms: number) =>
      this._innerLeftPx
      + ((ms - startMs) / this._scheduleSpanMs) * this._innerWidthPx;

    // ── Date-axis labels (5 ticks) ───────────────────────────────
    const axisY = AXIS_HEIGHT_PX - 6;
    const TICKS = 5;
    for (let i = 0; i <= TICKS; i++) {
      const ms = startMs + (i / TICKS) * (endMs - startMs);
      const x  = timeToX(ms);
      // Vertical grid line into the body.
      const gl = document.createElementNS(SVG_NS, "line");
      gl.setAttribute("class", "xkt-sch-gantt-grid");
      gl.setAttribute("x1", String(x));
      gl.setAttribute("x2", String(x));
      gl.setAttribute("y1", String(AXIS_HEIGHT_PX - 2));
      gl.setAttribute("y2", String(heightPx - 2));
      this._svg.appendChild(gl);
      // Label.
      const lbl = document.createElementNS(SVG_NS, "text");
      lbl.setAttribute("class", "xkt-sch-gantt-axis-label");
      lbl.setAttribute("x", String(x));
      lbl.setAttribute("y", String(axisY));
      lbl.textContent = new Date(ms).toLocaleDateString("en-GB",
        { day: "numeric", month: "short" });
      this._svg.appendChild(lbl);
    }

    // ── Task rows ────────────────────────────────────────────────
    for (let r = 0; r < nonMilestoneTasks.length; r++) {
      const task = nonMilestoneTasks[r];
      const rowY = AXIS_HEIGHT_PX + r * taskRowHeight;

      // Row label (left gutter).
      const lbl = document.createElementNS(SVG_NS, "text");
      lbl.setAttribute("class", "xkt-sch-gantt-row-label");
      lbl.setAttribute("x", String(LEFT_GUTTER_PX - 8));
      lbl.setAttribute("y", String(rowY + ROW_HEIGHT_PX / 2 + 4));
      lbl.setAttribute("text-anchor", "end");
      lbl.textContent = task.name ?? task.id;
      this._svg.appendChild(lbl);

      // Task bar.
      const x0 = timeToX(task.startMs);
      const x1 = timeToX(task.endMs);
      const w  = Math.max(2, x1 - x0);
      const c  = task.tradeColor;
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("class", "xkt-sch-gantt-bar");
      rect.setAttribute("x", String(x0));
      rect.setAttribute("y", String(rowY + BAR_INSET_PX));
      rect.setAttribute("width", String(w));
      rect.setAttribute("height", String(ROW_HEIGHT_PX - 2 * BAR_INSET_PX));
      rect.setAttribute("rx", "3");
      rect.setAttribute("ry", "3");
      rect.setAttribute("fill", `rgb(${Math.round(c[0]*255)}, ${Math.round(c[1]*255)}, ${Math.round(c[2]*255)})`);
      rect.setAttribute("data-task-id", task.id);
      rect.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.onTaskClicked.dispatch(this, task);
        // Convenience: clicking a task jumps the cursor to its start.
        this.player.setDateMs(task.startMs);
      });
      this._svg.appendChild(rect);

      // Bar caption — only if it fits.
      if (w > 70) {
        const cap = document.createElementNS(SVG_NS, "text");
        cap.setAttribute("class", "xkt-sch-gantt-bar-name");
        cap.setAttribute("x", String(x0 + 6));
        cap.setAttribute("y", String(rowY + ROW_HEIGHT_PX / 2 + 3.5));
        cap.textContent = task.name ?? task.id;
        this._svg.appendChild(cap);
      }
    }

    // ── Milestones (on the axis row) ─────────────────────────────
    for (const m of milestones) {
      const x = timeToX(m.startMs);
      const y = AXIS_HEIGHT_PX - 2;
      const diamond = document.createElementNS(SVG_NS, "path");
      diamond.setAttribute("class", "xkt-sch-gantt-milestone");
      diamond.setAttribute("d", `M ${x} ${y - 6} L ${x + 5} ${y} L ${x} ${y + 6} L ${x - 5} ${y} Z`);
      diamond.setAttribute("fill", "#1f2a44");
      diamond.setAttribute("data-milestone-id", m.id);
      const title = document.createElementNS(SVG_NS, "title");
      title.textContent = `${m.name ?? m.id} — ${new Date(m.startMs).toLocaleDateString("en-GB")}`;
      diamond.appendChild(title);
      diamond.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.player.setDateMs(m.startMs);
      });
      this._svg.appendChild(diamond);
    }

    // ── Click area covering the timeline body ────────────────────
    const clickArea = document.createElementNS(SVG_NS, "rect");
    clickArea.setAttribute("class", "xkt-sch-gantt-clickarea");
    clickArea.setAttribute("x", String(this._innerLeftPx));
    clickArea.setAttribute("y", String(AXIS_HEIGHT_PX));
    clickArea.setAttribute("width", String(this._innerWidthPx));
    clickArea.setAttribute("height", String(heightPx - AXIS_HEIGHT_PX - 2));
    this._svg.appendChild(clickArea);

    // ── Cursor (drawn last so it's on top) ───────────────────────
    this._cursorEl = document.createElementNS(SVG_NS, "line") as SVGLineElement;
    this._cursorEl.setAttribute("class", "xkt-sch-gantt-cursor");
    this._cursorEl.setAttribute("y1", String(AXIS_HEIGHT_PX - 8));
    this._cursorEl.setAttribute("y2", String(heightPx - 2));
    this._svg.appendChild(this._cursorEl);

    // Wider invisible hit-rect under the cursor for easier grabbing.
    const cursorHit = document.createElementNS(SVG_NS, "rect");
    cursorHit.setAttribute("class", "xkt-sch-gantt-cursor-hit");
    cursorHit.setAttribute("y", String(AXIS_HEIGHT_PX - 8));
    cursorHit.setAttribute("width", "12");
    cursorHit.setAttribute("height", String(heightPx - AXIS_HEIGHT_PX - 6));
    this._svg.appendChild(cursorHit);
    (this as any)._cursorHit = cursorHit;
  }

  // ── Live state updates ───────────────────────────────────────────

  private _refreshCursor(): void {
    if (!this._cursorEl) return;
    const x = this._innerLeftPx
      + ((this.player.currentDateMs - this._scheduleStartMs) / this._scheduleSpanMs)
        * this._innerWidthPx;
    this._cursorEl.setAttribute("x1", String(x));
    this._cursorEl.setAttribute("x2", String(x));
    const hit = (this as any)._cursorHit as SVGRectElement | undefined;
    if (hit) hit.setAttribute("x", String(x - 6));
  }

  private _refreshReadout(): void {
    if (!this._currentEl) return;
    const d = this.player.currentDate;
    const formatted = d.toLocaleDateString("en-GB",
      { day: "numeric", month: "short", year: "numeric" });
    const startMs = this._scheduleStartMs;
    const week = 1 + Math.floor((d.getTime() - startMs) / (7 * 24 * 60 * 60 * 1000));
    this._currentEl.textContent = `${formatted} • Week ${week}`;
  }

  private _refreshPlayButton(): void {
    if (!this._playBtn) return;
    this._playBtn.textContent = this.player.playing ? "❚❚ Pause" : "▶ Play";
  }

  // ── Click / drag scrubbing ───────────────────────────────────────

  private _handleTimelineClick(ev: MouseEvent): void {
    // Only react if the click was on the click-area or cursor — not
    // on a task bar or a milestone (those have their own handlers).
    const target = ev.target as Element | null;
    if (!target) return;
    if (!target.classList.contains("xkt-sch-gantt-clickarea") &&
        !target.classList.contains("xkt-sch-gantt-cursor") &&
        !target.classList.contains("xkt-sch-gantt-cursor-hit")) return;
    this._scrubFromEvent(ev);
  }

  private _scrubFromEvent(ev: MouseEvent | PointerEvent): void {
    const rect = this._svg.getBoundingClientRect();
    // The SVG's viewBox matches its bounding rect because we use
    // preserveAspectRatio="none", so we can map pixels straight to
    // viewBox coords without an explicit CTM inversion.
    const px = ev.clientX - rect.left;
    const within = px - this._innerLeftPx;
    if (within < 0 || within > this._innerWidthPx) return;
    const t = within / this._innerWidthPx;
    const ms = this._scheduleStartMs + t * this._scheduleSpanMs;
    this.player.setDateMs(ms);
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  /**
   * Rebuild the gantt against the player's current schedule. Call
   * if the caller has mutated the schedule out from under the
   * player (rare — `Schedule` is immutable, so the more common
   * path is to construct a new player and a new panel).
   */
  public rebuild(): void {
    this._rebuildGantt();
    this._refreshCursor();
    this._refreshReadout();
    this._refreshPlayButton();
  }

  public override destroy(): void {
    if (this._destroyed) return;
    this._unsubDate?.();    this._unsubDate  = null;
    this._unsubPlay?.();    this._unsubPlay  = null;
    this._unsubPause?.();   this._unsubPause = null;
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this.onTaskClicked.clear();
    SchedulePanel._instances.delete(this.player);
    super.destroy();
  }
}
