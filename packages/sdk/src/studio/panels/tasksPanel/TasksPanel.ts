/**
 * Floating, draggable, closeable panel that surfaces the live
 * {@link SDKTask} population registered with an
 * {@link SDKTaskRunner} — grouped by update-cycle stage
 * (CollectInput, Animate, Compute, Compute2, Render, PostRender),
 * with per-task name, scheduled / repeating / destroyed status,
 * and a refresh that ticks on every animation frame while the
 * panel is visible.
 *
 * Same chrome and lifecycle as the sister diagnostic panels
 * ({@link studio/issuesPanel!IssuesPanel | IssuesPanel},
 * {@link studio/sceneStats!SceneStatsPanel | SceneStatsPanel},
 * {@link studio/dataStats!DataStatsPanel | DataStatsPanel}) — per-runner WeakMap
 * registry, idempotent `getFor` / `openFor`, drag-header, close
 * button + reopen pill, layout persistence, bring-to-front on
 * pointer-down, scoped `xkt-tasks-` CSS prefix.
 *
 */
import {SDKTask} from "../../../base/core/SDKTask";
import {SDKTaskRunner} from "../../../base/core/SDKTaskRunner";

import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";


// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface TasksPanelParams {

  /**
   * The {@link SDKTaskRunner} whose currently-registered
   * {@link SDKTask | SDKTasks} this panel surfaces. Doubles as
   * the WeakMap key for {@link TasksPanel.openFor} idempotence —
   * one panel per runner.
   */
  runner: SDKTaskRunner;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed
   * state. Defaults to `"xkt-tasks-panel"`.
   */
  storageKey?: string;

  /** Show on construction (default `true`). */
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-tasks-styles";
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
// CSS — scoped under `.xkt-tasks-panel`, classes prefixed
// `xkt-tasks-`. Visual palette tracks the other diagnostic panels.
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-tasks-panel {
  position: fixed;
  top: 88px;
  right: 17px;
  width: 500px;
  max-width: calc(100vw - 34px);
  height: auto;
  max-height: calc(100vh - 116px);
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
.xkt-tasks-panel *, .xkt-tasks-panel *::before, .xkt-tasks-panel *::after {
  box-sizing: border-box;
}
.xkt-tasks-panel[hidden] { display: none; }

.xkt-tasks-panel .xkt-tasks-header {
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
.xkt-tasks-panel .xkt-tasks-header.xkt-tasks-dragging { cursor: grabbing; }
.xkt-tasks-panel .xkt-tasks-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 20px;
  font-weight: 650;
  color: #111;
  display: flex;
  align-items: center;
  gap: 8px;
}
.xkt-tasks-panel .xkt-tasks-title-icon {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
  width: 24px;
  height: 24px;
  color: #2d5e8c;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.xkt-tasks-panel .xkt-tasks-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-tasks-panel .xkt-tasks-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-tasks-panel .xkt-tasks-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-tasks-panel .xkt-tasks-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
.xkt-tasks-panel .xkt-tasks-counter {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: #2d5e8c;
  border-radius: 11px;
  letter-spacing: 0.2px;
}
.xkt-tasks-panel .xkt-tasks-counter[data-count="0"] {
  background: #94a3b8;
}
.xkt-tasks-panel .xkt-tasks-close {
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
.xkt-tasks-panel .xkt-tasks-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-tasks-pill {
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
.xkt-tasks-pill:hover { background: #1f4669; }
.xkt-tasks-pill[hidden] { display: none; }

.xkt-tasks-panel .xkt-tasks-body {
  flex: 1 1 auto;
  overflow: auto;
  padding: 0;
}

.xkt-tasks-panel .xkt-tasks-section {
  border-bottom: 1px solid #ececec;
}
.xkt-tasks-panel .xkt-tasks-section:last-child {
  border-bottom: none;
}
.xkt-tasks-panel .xkt-tasks-section > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  background: #f8fafc;
  user-select: none;
  -webkit-user-select: none;
  font-weight: 600;
  font-size: 12px;
  color: #1f2937;
}
.xkt-tasks-panel .xkt-tasks-section > summary::-webkit-details-marker { display: none; }
.xkt-tasks-panel .xkt-tasks-section > summary:hover { background: #f1f5f9; }
.xkt-tasks-panel .xkt-tasks-section[open] > summary {
  border-bottom: 1px solid #ececec;
}
.xkt-tasks-panel .xkt-tasks-twisty {
  flex-shrink: 0;
  width: 12px;
  text-align: center;
  font-size: 10px;
  color: #64748b;
  transition: transform 120ms ease;
  transform: rotate(0deg);
  display: inline-block;
}
.xkt-tasks-panel .xkt-tasks-section[open] .xkt-tasks-twisty {
  transform: rotate(90deg);
}
.xkt-tasks-panel .xkt-tasks-section-name {
  font-size: 13px;
  letter-spacing: 0.2px;
  color: #2d5e8c;
}
.xkt-tasks-panel .xkt-tasks-section-summary {
  flex: 1;
  min-width: 0;
  font-weight: 400;
  font-size: 11.5px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-tasks-panel .xkt-tasks-section-empty .xkt-tasks-section-summary {
  font-style: italic;
  color: #94a3b8;
}
.xkt-tasks-panel .xkt-tasks-section-count {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 18px;
  padding: 0 6px;
  font-size: 10.5px;
  font-weight: 700;
  color: #fff;
  background: #2d5e8c;
  border-radius: 9px;
  letter-spacing: 0.2px;
}
.xkt-tasks-panel .xkt-tasks-section-count[data-count="0"] {
  background: #cbd5e1;
  color: #475569;
}

.xkt-tasks-panel .xkt-tasks-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.xkt-tasks-panel .xkt-tasks-table th {
  text-align: left;
  font-weight: 600;
  color: #475569;
  padding: 6px 14px 6px 28px;
  border-bottom: 1px solid #f1f5f9;
  background: #fcfcfd;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.xkt-tasks-panel .xkt-tasks-table td {
  padding: 6px 14px;
  border-top: 1px solid #f1f5f9;
  vertical-align: top;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 11.5px;
  word-break: break-word;
}
.xkt-tasks-panel .xkt-tasks-table td.xkt-tasks-name {
  padding-left: 28px;
  color: #111827;
}
.xkt-tasks-panel .xkt-tasks-status {
  display: inline-block;
  padding: 1px 7px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  border-radius: 4px;
  white-space: nowrap;
}
.xkt-tasks-panel .xkt-tasks-status[data-status="repeating"] {
  color: #1d4ed8;
  background: rgba(29, 78, 216, 0.12);
}
.xkt-tasks-panel .xkt-tasks-status[data-status="scheduled"] {
  color: #047857;
  background: rgba(4, 120, 87, 0.12);
}
.xkt-tasks-panel .xkt-tasks-status[data-status="idle"] {
  color: #475569;
  background: rgba(148, 163, 184, 0.18);
}
.xkt-tasks-panel .xkt-tasks-status[data-status="destroyed"] {
  color: #b91c1c;
  background: rgba(185, 28, 28, 0.12);
}
.xkt-tasks-panel .xkt-tasks-empty {
  padding: 10px 14px 10px 28px;
  color: #94a3b8;
  font-style: italic;
  font-size: 11.5px;
}
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

/**
 * Status bucket reported in the panel's per-task row. Derived from
 * the live {@link SDKTask} flags on every refresh.
 */
type TaskStatus = "repeating" | "scheduled" | "idle" | "destroyed";

interface SectionView {
  details: HTMLDetailsElement;
  summary: HTMLElement;
  tbody: HTMLElement;
  countEl: HTMLElement;
}

/**
 * Display order + label for each {@link SDKTask} stage.
 */
const STAGES: ReadonlyArray<{ stage: number; label: string }> = [
  {stage: SDKTask.CollectInputStage, label: "Collect Input"},
  {stage: SDKTask.AnimateStage,      label: "Animate"},
  {stage: SDKTask.ComputeStage,      label: "Compute"},
  {stage: SDKTask.ComputeStage2,     label: "Compute 2"},
  {stage: SDKTask.RenderStage,       label: "Render"},
  {stage: SDKTask.PostRenderStage,   label: "Post-Render"},
];


export class TasksPanel extends FloatingPanelBase {

  /**
   * Per-runner instance registry. Lets {@link openFor} hand back
   * the existing live panel for a runner instead of stacking
   * duplicates. WeakMap so a runner that gets dropped doesn't
   * keep the panel alive for GC.
   */
  private static readonly _instances = new WeakMap<SDKTaskRunner, TasksPanel>();

  /**
   * SVG markup for the panel's title-bar glyph — a three-stage
   * pipeline with a small "running" indicator, matching the
   * vocabulary of the legacy `TaskPanel`. Strokes use
   * `currentColor` so the icon recolours with the title text.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="2.5"  y="6" width="5" height="5" rx="1" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<rect x="9.5"  y="6" width="5" height="5" rx="1" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" opacity="0.65"/>` +
      `<rect x="16.5" y="6" width="5" height="5" rx="1" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" opacity="0.4"/>` +
      `<path d="M5 14 L19 14" fill="none" stroke="currentColor" stroke-width="1.4" ` +
            `stroke-linecap="round" opacity="0.5"/>` +
      `<circle cx="12" cy="18" r="3.2" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.4"/>` +
      `<path d="M12 14.8 A3.2 3.2 0 0 1 15.2 18" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>` +
    `</svg>`;
  }

  /**
   * Returns the existing live panel bound to `runner`, or
   * `undefined` if none has been constructed (or the prior
   * instance was destroyed). Lets callers ask "is there already
   * a panel here?" without the show side effect that
   * {@link openFor} performs.
   */
  static getFor(runner: SDKTaskRunner): TasksPanel | undefined {
    const inst = TasksPanel._instances.get(runner);
    return inst && !inst._destroyed ? inst : undefined;
  }

  /**
   * Reveal (or lazily mount) a panel for `params.runner`.
   * Idempotent — if a panel already exists for this runner and
   * is still alive, it's brought back to the foreground;
   * otherwise a fresh one is constructed.
   */
  static openFor(params: TasksPanelParams): TasksPanel {
    let inst = TasksPanel._instances.get(params.runner);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new TasksPanel(params);
    return inst;
  }

  readonly runner: SDKTaskRunner;

  // Panel-content DOM refs (chrome refs live on FloatingPanelBase).
  private _counterEl!: HTMLElement;
  private _bodyEl!: HTMLElement;
  private _sections: SectionView[] = [];

  // Polling state — the SDKTaskRunner does not expose change
  // events, so the panel re-reads its task set on every animation
  // frame while visible. Cheap: a few small Set iterations + a
  // DOM diff against the previous frame's row count.
  private _pollHandle = 0;
  private _polling = false;

  constructor(params: TasksPanelParams) {
    if (!params || !params.runner) {
      throw new Error("TasksPanel: runner is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-tasks-panel",
      classPrefix: "xkt-tasks",
    });
    this.runner = params.runner;

    // Replace any prior panel bound to the same runner — keeps
    // openFor idempotent and avoids stale DOM after a hot reload.
    const prior = TasksPanel._instances.get(params.runner);
    if (prior && !prior._destroyed) prior.destroy();
    TasksPanel._instances.set(params.runner, this);

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

  get visible(): boolean {
    return this._panel.style.display !== "none";
  }

  show(): void {
    if (this._destroyed) return;
    super.show();
    this._render();
    this._startPolling();
  }

  hide(): void {
    if (this._destroyed) return;
    this._stopPolling();
    super.hide();
  }

  toggle(): void {
    if (this.visible) this.hide(); else this.show();
  }

  destroy(): void {
    if (this._destroyed) return;
    this._stopPolling();
    if (TasksPanel._instances.get(this.runner) === this) {
      TasksPanel._instances.delete(this.runner);
    }
    super.destroy();
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-tasks-pill", {
      type: "button",
      title: "Reopen the Tasks panel",
      hidden: true,
      textContent: "Tasks",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-tasks-panel");

    this._header = el("div", "xkt-tasks-header");
    const title = el("h2", "xkt-tasks-title");
    title.innerHTML =
      `<span class="xkt-tasks-title-icon">${TasksPanel.iconSvg()}</span>` +
      `<span class="xkt-tasks-title-stack">` +
        `<span class="xkt-tasks-title-text">Tasks</span>` +
        `<span class="xkt-tasks-subtitle">SDKTasks by stage, live.</span>` +
      `</span>`;

    this._counterEl = el("span", "xkt-tasks-counter");
    this._counterEl.textContent = "0";
    this._counterEl.dataset.count = "0";
    this._counterEl.title = "Total tasks registered with the runner";

    this._closeBtn = el("button", "xkt-tasks-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;

    this._header.append(title, this._counterEl, this._closeBtn);
    this._panel.appendChild(this._header);

    this._bodyEl = el("div", "xkt-tasks-body");
    for (const {stage, label} of STAGES) {
      this._sections.push(this._buildSection(stage, label));
    }
    for (const sec of this._sections) {
      this._bodyEl.appendChild(sec.details);
    }
    this._panel.appendChild(this._bodyEl);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }

  private _buildSection(stage: number, label: string): SectionView {
    const details = document.createElement("details");
    details.className = "xkt-tasks-section xkt-tasks-section-empty";
    details.dataset.stage = String(stage);

    const summary = document.createElement("summary");

    const twisty = el("span", "xkt-tasks-twisty");
    twisty.textContent = "▶";

    const name = el("span", "xkt-tasks-section-name");
    name.textContent = label;

    const summaryEl = el("span", "xkt-tasks-section-summary");
    summaryEl.textContent = "no tasks";

    const countEl = el("span", "xkt-tasks-section-count");
    countEl.textContent = "0";
    countEl.dataset.count = "0";

    summary.append(twisty, name, summaryEl, countEl);
    details.appendChild(summary);

    const table = el("table", "xkt-tasks-table");
    const thead = el("thead");
    const headRow = el("tr");
    const thName = el("th", undefined, {textContent: "Task"});
    const thStatus = el("th", undefined, {textContent: "Status"});
    thStatus.style.width = "100px";
    thStatus.style.whiteSpace = "nowrap";
    headRow.append(thName, thStatus);
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = el("tbody");
    table.appendChild(tbody);

    details.appendChild(table);

    return {details, summary: summaryEl, tbody, countEl};
  }


  // ── Polling ───────────────────────────────────────────────────

  /**
   * Begin per-frame refreshes. {@link SDKTaskRunner} doesn't emit
   * change events, so the panel re-reads the task set every
   * animation frame while visible. Stops on `hide()` / `destroy()`
   * so a closed panel pays nothing.
   */
  private _startPolling(): void {
    if (this._polling || this._destroyed) return;
    this._polling = true;
    const tick = () => {
      if (!this._polling || this._destroyed) {
        this._pollHandle = 0;
        return;
      }
      this._render();
      this._pollHandle = requestAnimationFrame(tick);
    };
    this._pollHandle = requestAnimationFrame(tick);
  }

  private _stopPolling(): void {
    this._polling = false;
    if (this._pollHandle) {
      cancelAnimationFrame(this._pollHandle);
      this._pollHandle = 0;
    }
  }


  // ── Rendering ─────────────────────────────────────────────────

  /**
   * Re-read the runner's task set and rebuild every section's
   * `<tbody>` rows. Each section's count badge and summary text
   * are refreshed alongside the rows.
   */
  private _render(): void {
    const tasksByStage = this._readTaskSets();
    let total = 0;
    for (let i = 0; i < STAGES.length; i++) {
      const {stage} = STAGES[i];
      const tasks = tasksByStage.get(stage) ?? [];
      total += tasks.length;
      this._renderSection(this._sections[i], tasks);
    }
    this._counterEl.textContent = String(total);
    this._counterEl.dataset.count = String(total);
  }

  /**
   * Read the live `tasksByStage` map off the runner. The field is
   * `private` on the class but exposed here through a structural
   * cast — the panel sits one layer above the runner in the demo
   * harness, so it is allowed to peek at the registry the runner
   * keeps for its own bookkeeping.
   */
  private _readTaskSets(): Map<number, SDKTask[]> {
    const byStage = new Map<number, SDKTask[]>();
    const raw = (this.runner as unknown as {
      tasksByStage?: Map<number, Set<SDKTask>>;
    }).tasksByStage;
    if (!raw) return byStage;
    for (const {stage} of STAGES) {
      const set = raw.get(stage);
      byStage.set(stage, set ? Array.from(set) : []);
    }
    return byStage;
  }

  private _renderSection(section: SectionView, tasks: SDKTask[]): void {
    const n = tasks.length;
    section.countEl.textContent = String(n);
    section.countEl.dataset.count = String(n);

    if (n === 0) {
      section.details.classList.add("xkt-tasks-section-empty");
      section.summary.textContent = "no tasks";
    } else {
      section.details.classList.remove("xkt-tasks-section-empty");
      section.summary.textContent = `${n} ${n === 1 ? "task" : "tasks"}`;
    }

    section.tbody.replaceChildren();
    if (n === 0) {
      const tr = el("tr");
      const td = el("td", "xkt-tasks-empty", {textContent: "No tasks registered.", colSpan: 2});
      tr.appendChild(td);
      section.tbody.appendChild(tr);
      return;
    }

    for (const task of tasks) {
      const status = taskStatus(task);
      const tr = el("tr");
      const nameTd = el("td", "xkt-tasks-name");
      nameTd.textContent = task.name || task.constructor?.name || "SDKTask";
      const statusTd = el("td");
      const badge = el("span", "xkt-tasks-status");
      badge.dataset.status = status;
      badge.textContent = status;
      statusTd.appendChild(badge);
      tr.append(nameTd, statusTd);
      section.tbody.appendChild(tr);
    }
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────

function taskStatus(task: SDKTask): TaskStatus {
  if (task.destroyed) return "destroyed";
  if (task.repeating) return "repeating";
  if (task.scheduled) return "scheduled";
  return "idle";
}
