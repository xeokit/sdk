/**
 * Floating, draggable Events panel — collects every `onError`
 * emission from the helper's `Scene`, `Data`, `Viewer`, and
 * `WebGLRenderer` event emitters, retains the full history,
 * and pops the panel into view the first time an error fires
 * so the user notices something went wrong without having to
 * watch the dev console.
 *
 * Same chrome and lifecycle as the rest of the panel set
 * (`ExplorerPanel`, `SceneHealthPanel`, …): per-Viewer WeakMap
 * registry, idempotent `getFor` / `openFor`, drag header,
 * close + pill, layout persistence, bring-to-front on
 * pointer-down, scoped `xkt-events-` CSS prefix.
 *
 * @module demo/eventsPanel
 */
import {Scene} from "../../../scene";
import {Data} from "../../../data";
import {Viewer} from "../../../viewer";
import {WebGLRenderer} from "../../../webGLRenderer";
import {SDKErrorType, type SDKResult} from "../../../core";


import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";
// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

/** Originating emitter of an event record. */
export type EventsPanelSource = "scene" | "data" | "viewer" | "renderer";

/** Severity of an event record. All current SDK emissions land
 * as `"error"`; the field exists so a future `onWarning` event
 * channel can surface here without a panel-side shape change. */
export type EventsPanelLevel = "error" | "warning";

/**
 * One row in the panel's log.
 */
export interface EventsPanelRecord {
  /** `Date.now()` at the time the event fired. */
  timestamp: number;
  /** Which emitter emitted the event. */
  source: EventsPanelSource;
  /** Severity bucket. */
  level: EventsPanelLevel;
  /** SDKErrorType code, when supplied by the emitter. */
  type?: SDKErrorType;
  /** Free-text error/warning message. */
  message: string;
}

export interface EventsPanelParams {

  /**
   * The Viewer whose attached components (Scene, Data, Viewer,
   * WebGLRenderer) this panel monitors. Doubles as the WeakMap
   * key for {@link EventsPanel.openFor} idempotence — one
   * Events panel per Viewer.
   */
  viewer: Viewer;

  /** Scene to monitor. */
  scene: Scene;

  /** Data to monitor. */
  data: Data;

  /** WebGLRenderer to monitor. */
  renderer: WebGLRenderer;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed
   * state. Defaults to `"xkt-events-panel"`.
   */
  storageKey?: string;

  /** Show on construction (default `false` — the panel only
   * pops itself open once an error actually fires). */
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-events-styles";
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
// CSS
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-events-panel {
  position: fixed;
  top: 88px;
  right: 17px;
  width: 460px;
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
.xkt-events-panel *, .xkt-events-panel *::before, .xkt-events-panel *::after {
  box-sizing: border-box;
}
.xkt-events-panel[hidden] { display: none; }

.xkt-events-panel .xkt-events-header {
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
.xkt-events-panel .xkt-events-header.xkt-events-dragging { cursor: grabbing; }
.xkt-events-panel .xkt-events-title {
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
.xkt-events-panel .xkt-events-title-icon {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  color: #b91c1c;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.xkt-events-panel .xkt-events-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-events-panel .xkt-events-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-events-panel .xkt-events-counter {
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
  background: #b91c1c;
  border-radius: 11px;
  letter-spacing: 0.2px;
}
.xkt-events-panel .xkt-events-counter[data-count="0"] {
  background: #94a3b8;
}
.xkt-events-panel .xkt-events-clear,
.xkt-events-panel .xkt-events-copy-log,
.xkt-events-panel .xkt-events-open-log,
.xkt-events-panel .xkt-events-close {
  flex-shrink: 0;
  height: 28px;
  padding: 0;
  font: inherit;
  line-height: 1;
  color: #777;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
}
.xkt-events-panel .xkt-events-clear,
.xkt-events-panel .xkt-events-copy-log,
.xkt-events-panel .xkt-events-open-log {
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
}
.xkt-events-panel .xkt-events-close { width: 28px; font-size: 22px; }
.xkt-events-panel .xkt-events-clear:hover,
.xkt-events-panel .xkt-events-copy-log:hover,
.xkt-events-panel .xkt-events-open-log:hover,
.xkt-events-panel .xkt-events-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}
.xkt-events-panel .xkt-events-copy-log.xkt-events-copy-log-done {
  color: #047857;
  background: rgba(4, 120, 87, 0.10);
  border-color: rgba(4, 120, 87, 0.32);
}
.xkt-events-panel .xkt-events-copy-log:disabled,
.xkt-events-panel .xkt-events-open-log:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.xkt-events-panel .xkt-events-copy-log:disabled:hover,
.xkt-events-panel .xkt-events-open-log:disabled:hover {
  background: transparent;
  color: #777;
  border-color: transparent;
}

.xkt-events-pill {
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
  background: #b91c1c;
  border: 1px solid #7f1d1d;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.xkt-events-pill:hover { background: #7f1d1d; }
.xkt-events-pill[hidden] { display: none; }
.xkt-events-pill[data-count="0"] {
  background: #475569;
  border-color: #334155;
}
.xkt-events-pill[data-count="0"]:hover { background: #334155; }
.xkt-events-pill .xkt-events-pill-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 11px;
  font-weight: 700;
  color: #b91c1c;
  background: #fff;
  border-radius: 9px;
}
.xkt-events-pill[data-count="0"] .xkt-events-pill-count {
  color: #475569;
}

.xkt-events-panel .xkt-events-body {
  flex: 1 1 auto;
  overflow: auto;
  padding: 0;
}

.xkt-events-panel .xkt-events-section {
  border-bottom: 1px solid #ececec;
}
.xkt-events-panel .xkt-events-section:last-child {
  border-bottom: none;
}
/* Native disclosure triangle hidden — we render our own glyph
   in the summary so it lines up with the rest of the layout
   the same way across browsers. */
.xkt-events-panel .xkt-events-section > summary {
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
.xkt-events-panel .xkt-events-section > summary::-webkit-details-marker { display: none; }
.xkt-events-panel .xkt-events-section > summary:hover {
  background: #f1f5f9;
}
.xkt-events-panel .xkt-events-section[open] > summary {
  border-bottom: 1px solid #ececec;
}
.xkt-events-panel .xkt-events-twisty {
  flex-shrink: 0;
  width: 12px;
  text-align: center;
  font-size: 10px;
  color: #64748b;
  transition: transform 120ms ease;
  transform: rotate(0deg);
  display: inline-block;
}
.xkt-events-panel .xkt-events-section[open] .xkt-events-twisty {
  transform: rotate(90deg);
}
.xkt-events-panel .xkt-events-section-name {
  font-size: 13px;
  letter-spacing: 0.2px;
}
.xkt-events-panel .xkt-events-section[data-source="scene"]    .xkt-events-section-name { color: #1d4ed8; }
.xkt-events-panel .xkt-events-section[data-source="data"]     .xkt-events-section-name { color: #047857; }
.xkt-events-panel .xkt-events-section[data-source="viewer"]   .xkt-events-section-name { color: #7c3aed; }
.xkt-events-panel .xkt-events-section[data-source="renderer"] .xkt-events-section-name { color: #c2410c; }
.xkt-events-panel .xkt-events-section-summary {
  flex: 1;
  min-width: 0;
  font-weight: 400;
  font-size: 11.5px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-events-panel .xkt-events-section-empty .xkt-events-section-summary {
  font-style: italic;
  color: #94a3b8;
}
.xkt-events-panel .xkt-events-section-count {
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
  background: #b91c1c;
  border-radius: 9px;
  letter-spacing: 0.2px;
}
.xkt-events-panel .xkt-events-section-count[data-count="0"] {
  background: #cbd5e1;
  color: #475569;
}

.xkt-events-panel .xkt-events-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.xkt-events-panel .xkt-events-row {
  display: grid;
  grid-template-columns: 64px 1fr 26px;
  align-items: start;
  gap: 8px;
  padding: 7px 14px 7px 28px;
  border-top: 1px solid #f1f5f9;
  font-size: 12px;
}
.xkt-events-panel .xkt-events-row:first-child { border-top: none; }
.xkt-events-panel .xkt-events-row[data-level="error"] {
  background: rgba(254, 226, 226, 0.45);
}
.xkt-events-panel .xkt-events-row[data-level="warning"] {
  background: rgba(254, 243, 199, 0.55);
}
.xkt-events-panel .xkt-events-time {
  font-variant-numeric: tabular-nums;
  color: #64748b;
  font-size: 11px;
  white-space: nowrap;
}
.xkt-events-panel .xkt-events-msg {
  min-width: 0;
  word-break: break-word;
  white-space: pre-wrap;
  color: #111827;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 11.5px;
  line-height: 1.5;
}
.xkt-events-panel .xkt-events-type {
  display: inline-block;
  margin-top: 3px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: #475569;
  background: rgba(148, 163, 184, 0.18);
  border-radius: 4px;
}

/* Per-row copy-to-clipboard button. Hidden until row hover so
   it doesn't compete with the message text for attention; the
   24x20 hit-target is generous on mobile too. */
.xkt-events-panel .xkt-events-copy {
  align-self: start;
  width: 24px;
  height: 20px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  opacity: 0;
  transition: opacity 120ms ease, background 120ms ease, color 120ms ease, border-color 120ms ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.xkt-events-panel .xkt-events-row:hover .xkt-events-copy,
.xkt-events-panel .xkt-events-copy:focus-visible {
  opacity: 1;
}
.xkt-events-panel .xkt-events-copy:hover {
  background: rgba(148, 163, 184, 0.18);
  border-color: rgba(148, 163, 184, 0.32);
  color: #1f2937;
}
.xkt-events-panel .xkt-events-copy svg {
  width: 14px;
  height: 14px;
  display: block;
}
.xkt-events-panel .xkt-events-copy.xkt-events-copy-done {
  opacity: 1;
  color: #047857;
  border-color: rgba(4, 120, 87, 0.32);
  background: rgba(4, 120, 87, 0.10);
}
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

export class EventsPanel extends FloatingPanelBase {

  private static readonly _instances = new WeakMap<Viewer, EventsPanel>();

  /**
   * SVG markup for the panel's title-bar glyph (filled triangle
   * with an exclamation mark — the conventional "alert" icon).
   * Stroke uses `currentColor`.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M12 3 L22 20 L2 20 Z" ` +
            `fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<path d="M12 10 V14" ` +
            `fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>` +
      `<circle cx="12" cy="17" r="0.9" fill="currentColor"/>` +
    `</svg>`;
  }

  static getFor(viewer: Viewer): EventsPanel | undefined {
    const inst = EventsPanel._instances.get(viewer);
    return inst && !inst._destroyed ? inst : undefined;
  }

  static openFor(params: EventsPanelParams): EventsPanel {
    let inst = EventsPanel._instances.get(params.viewer);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new EventsPanel(params);
    return inst;
  }

  readonly viewer: Viewer;
  readonly scene: Scene;
  readonly data: Data;
  readonly renderer: WebGLRenderer;

  // DOM refs.
  private _pillCountEl!: HTMLElement;
  private _counterEl!: HTMLElement;
  private _copyLogBtn!: HTMLButtonElement;
  private _openLogBtn!: HTMLButtonElement;
  private _clearBtn!: HTMLButtonElement;
  private _bodyEl!: HTMLElement;
  private _sections!: Record<EventsPanelSource, SectionView>;

  /**
   * Comprehensive event log — every event from every emitter
   * across every source, kept here so the user can hand it off
   * (via the title-bar Copy log button) for offline debugging.
   * Distinct from `_records`, which is just the visible
   * error/warning subset.
   *
   * Implemented as an array with batch-truncation: when the
   * length crosses {@link _LOG_CAPACITY}, the oldest 10% of
   * entries are dropped at once so the cost amortises to O(1)
   * per push instead of O(n) per shift.
   */
  private readonly _log: LogEntry[] = [];
  private _logTruncatedCount = 0;
  private readonly _logStartPerf: number =
    (typeof performance !== "undefined" && typeof performance.now === "function")
      ? performance.now()
      : Date.now();
  private readonly _logStartIso: string = new Date().toISOString();
  private static readonly _LOG_CAPACITY = 50_000;
  /** Per-frame / chatty events that would drown out real signal
   * if logged at full rate. The log captures everything else. */
  private static readonly _LOG_SKIP_EVENTS: ReadonlySet<string> = new Set([
    "onTick",        // viewer per-frame
    "onViewRendered" // renderer per-frame
  ]);

  /**
   * Append-only log of every event surfaced to the panel
   * (newest entries are pushed last; the rendered list shows
   * newest at the top via DOM `prepend`). Cleared by the user
   * via the title-bar trash button.
   */
  private readonly _records: EventsPanelRecord[] = [];

  /**
   * Has the panel auto-shown itself on a fired error yet? Set
   * the first time an error lands while the panel is hidden;
   * checked thereafter so a quick-fire burst of errors during a
   * load doesn't keep yanking the panel back open after the
   * user closes it.
   */
  private _autoShownThisSession = false;

  // Lifecycle handles.
  private readonly _unsubs: Array<() => void> = [];

  // Drag state.

  constructor(params: EventsPanelParams) {
    if (!params || !params.viewer) {
      throw new Error("EventsPanel: viewer is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-events-panel",
      classPrefix: "xkt-events",
    });
    if (!params.scene)    throw new Error("EventsPanel: scene is required");
    if (!params.data)     throw new Error("EventsPanel: data is required");
    if (!params.renderer) throw new Error("EventsPanel: renderer is required");

    this.viewer    = params.viewer;
    this.scene     = params.scene;
    this.data      = params.data;
    this.renderer  = params.renderer;

    // Replace any prior instance bound to the same Viewer — the
    // panel keeps DOM and live event subscriptions, both of
    // which leak across a hot-reload otherwise.
    const prior = EventsPanel._instances.get(params.viewer);
    if (prior && !prior._destroyed) prior.destroy();
    EventsPanel._instances.set(params.viewer, this);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();
    this._wireDomEvents();
    this._attachListeners();
    this._updateAllSectionMeta();
    this._updateCounter();


    // Default-hidden: the panel is meant to lie in wait and
    // surface itself only when something goes wrong. Callers
    // can pass `visible: true` to force it open immediately
    // (e.g. for a "show all events so far" toolbar button).
    if (params.visible === true) {
      this.show();
    } else {
      this.hide();
    }
  }


  // ── Public lifecycle ──────────────────────────────────────────

  get visible(): boolean {
    return this._panel.style.display !== "none";
  }

  /** Snapshot of the current event records (newest last). */
  get records(): readonly EventsPanelRecord[] {
    return this._records;
  }

  show(): void {
    if (this._destroyed) return;
    super.show();
  }

  hide(): void {
    if (this._destroyed) return;
    super.hide();
  }

  toggle(): void {
    if (this.visible) this.hide(); else this.show();
  }

  /**
   * Wipe the in-memory log and every section's rendered rows.
   * Doesn't touch the auto-show flag — i.e. clearing the log
   * doesn't re-arm the auto-show; the user has already seen the
   * panel once this session, so a future error will only update
   * the counter unless they reopen manually. Sections retain
   * their open/closed state so the user's collapse choices
   * survive a clear.
   */
  clear(): void {
    if (this._destroyed) return;
    this._records.length = 0;
    for (const source of SECTION_ORDER) {
      const sec = this._sections[source];
      sec.list.innerHTML = "";
      sec.count = 0;
    }
    this._updateAllSectionMeta();
    this._updateCounter();
  }

  destroy(): void {
    if (this._destroyed) return;
    this._detachListeners();
    if (EventsPanel._instances.get(this.viewer) === this) {
      EventsPanel._instances.delete(this.viewer);
    }
    super.destroy();
  }


  // ── Event listeners ───────────────────────────────────────────

  /**
   * Subscribe to `onError` and `onWarning` only — for now the
   * panel ignores all other event channels, so the rendered list
   * and the comprehensive log both stay focused on actionable
   * signal. Other emitters can be re-introduced later without
   * touching the rest of the pipeline.
   */
  private _attachListeners(): void {
    const subscribe = (events: any, source: EventsPanelSource): void => {
      if (!events) return;
      for (const name of ["onError", "onWarning"] as const) {
        const emitter: any = events[name];
        if (!emitter || typeof emitter.subscribe !== "function") continue;
        const level: EventsPanelLevel = name === "onWarning" ? "warning" : "error";
        const unsub = emitter.subscribe((_sender: any, args: any) => {
          this._logEvent(source, name, args);
          this._handleEvent(source, level, args);
        });
        this._unsubs.push(unsub);
      }
    };
    subscribe((this.scene    as any).events, "scene");
    subscribe((this.data     as any).events, "data");
    subscribe((this.viewer   as any).events, "viewer");
    subscribe((this.renderer as any).events, "renderer");
  }

  /**
   * Push a comprehensive-log entry. Cheap path — runs on every
   * SDK event firing. Truncates in 10% batches once the buffer
   * crosses {@link _LOG_CAPACITY} so a load that emits hundreds
   * of thousands of object-creation events doesn't cost a
   * per-push `Array.shift`.
   */
  private _logEvent(source: EventsPanelSource, name: string, args: any): void {
    if (this._destroyed) return;
    const cap = EventsPanel._LOG_CAPACITY;
    if (this._log.length >= cap) {
      const drop = Math.max(1, Math.floor(cap / 10));
      this._log.splice(0, drop);
      this._logTruncatedCount += drop;
    }
    const tMs = ((typeof performance !== "undefined" && typeof performance.now === "function")
      ? performance.now()
      : Date.now()) - this._logStartPerf;
    this._log.push({
      t:      Math.round(tMs) / 1000, // seconds, ms precision
      source,
      event:  name,
      args:   summarizeArgs(args),
    });
  }

  private _detachListeners(): void {
    for (const u of this._unsubs) {
      try { u(); } catch { /* ignore */ }
    }
    this._unsubs.length = 0;
  }

  private _handleEvent(
    source: EventsPanelSource,
    level: EventsPanelLevel,
    result: SDKResult<any> | any,
  ): void {
    if (this._destroyed) return;
    // The `onError` channel emits an `SDKResult` shape whose
    // `error` field is the human-readable message and `type`
    // is the SDKErrorType enum. Defensive-grab so a malformed
    // payload doesn't crash the listener.
    const message = (result && typeof result.error === "string")
      ? result.error
      : (typeof result === "string" ? result : JSON.stringify(result));
    const type: SDKErrorType | undefined =
      (result && typeof result.type === "number") ? result.type : undefined;

    const record: EventsPanelRecord = {
      timestamp: Date.now(),
      source,
      level,
      type,
      message,
    };
    this._records.push(record);
    this._appendEntry(record);
    this._updateSectionMeta(source);
    this._updateCounter();

    // Auto-show on the very first error we see this session, so
    // the user can't miss it. Subsequent errors only bump the
    // counter — once the user has dismissed the panel, we don't
    // keep yanking it back open.
    if (level === "error" && !this._autoShownThisSession && !this.visible) {
      this._autoShownThisSession = true;
      this.show();
    }
  }


  // ── DOM / rendering ───────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-events-pill", {
      type: "button",
      title: "Reopen the Events panel",
      hidden: true,
    }) as HTMLButtonElement;
    const pillIcon = el("span", "xkt-events-pill-icon");
    pillIcon.innerHTML = EventsPanel.iconSvg();
    pillIcon.style.width = "14px";
    pillIcon.style.height = "14px";
    pillIcon.style.display = "inline-flex";
    const pillLabel = document.createElement("span");
    pillLabel.textContent = "Events";
    this._pillCountEl = el("span", "xkt-events-pill-count");
    this._pillCountEl.textContent = "0";
    this._pill.append(pillIcon, pillLabel, this._pillCountEl);
    this._pill.dataset.count = "0";

    this._panel = el("div", "xkt-events-panel");

    this._header = el("div", "xkt-events-header");
    const title = el("h2", "xkt-events-title");
    title.innerHTML =
      `<span class="xkt-events-title-icon">${EventsPanel.iconSvg()}</span>` +
      `<span class="xkt-events-title-text">Events</span>`;

    this._counterEl = el("span", "xkt-events-counter");
    this._counterEl.textContent = "0";
    this._counterEl.dataset.count = "0";
    this._counterEl.title = "Total events in log";

    this._copyLogBtn = el("button", "xkt-events-copy-log", {
      type: "button",
      "aria-label": "Copy full event log to clipboard",
      title: "Copy the full event log to the clipboard — paste into a chat with Claude when reporting a bug.",
      textContent: "Copy log",
    }) as HTMLButtonElement;

    this._openLogBtn = el("button", "xkt-events-open-log", {
      type: "button",
      "aria-label": "Open full event log in a new tab",
      title: "Open the full event log as JSON in a new browser tab.",
      textContent: "Open log",
    }) as HTMLButtonElement;

    this._clearBtn = el("button", "xkt-events-clear", {
      type: "button",
      "aria-label": "Clear events",
      title: "Clear events",
      textContent: "Clear",
    }) as HTMLButtonElement;

    this._closeBtn = el("button", "xkt-events-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;

    this._header.append(title, this._counterEl, this._copyLogBtn, this._openLogBtn, this._clearBtn, this._closeBtn);
    this._panel.appendChild(this._header);

    this._bodyEl = el("div", "xkt-events-body");
    this._sections = {} as Record<EventsPanelSource, SectionView>;
    for (const source of SECTION_ORDER) {
      this._sections[source] = this._buildSection(source);
      this._bodyEl.appendChild(this._sections[source].details);
    }
    this._panel.appendChild(this._bodyEl);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }

  /**
   * Builds one collapsible section per source — `<details>` +
   * `<summary>` is the simplest accessible disclosure pattern,
   * and the browser handles toggling for free. Sections start
   * collapsed; they auto-open once the first event lands in
   * them (see `_appendEntry`), and the user can toggle freely
   * after that.
   */
  private _buildSection(source: EventsPanelSource): SectionView {
    const details = document.createElement("details");
    details.className = "xkt-events-section";
    details.dataset.source = source;
    details.classList.add("xkt-events-section-empty");

    const summary = document.createElement("summary");

    const twisty = el("span", "xkt-events-twisty");
    twisty.textContent = "▶";

    const name = el("span", "xkt-events-section-name");
    name.textContent = SECTION_LABEL[source];

    const summaryEl = el("span", "xkt-events-section-summary");

    const countEl = el("span", "xkt-events-section-count");

    summary.append(twisty, name, summaryEl, countEl);
    details.appendChild(summary);

    const list = el("ul", "xkt-events-list");
    details.appendChild(list);

    return {
      details,
      summary: summaryEl,
      list,
      count: 0,
      lastTimestamp: 0,
      autoOpened: false,
      countEl,
    };
  }

  /**
   * Refresh the count badge + summary text on a single section
   * after a record was appended (or when initialising).
   */
  private _updateSectionMeta(source: EventsPanelSource): void {
    const sec = this._sections[source];
    if (!sec) return;
    const n = sec.count;
    sec.countEl.textContent = String(n);
    sec.countEl.dataset.count = String(n);
    if (n === 0) {
      sec.details.classList.add("xkt-events-section-empty");
      sec.summary.textContent = "no events";
    } else {
      sec.details.classList.remove("xkt-events-section-empty");
      const word = n === 1 ? "event" : "events";
      const last = sec.lastTimestamp ? `, last ${formatTime(sec.lastTimestamp)}` : "";
      sec.summary.textContent = `${n} ${word}${last}`;
    }
  }

  private _updateAllSectionMeta(): void {
    for (const source of SECTION_ORDER) {
      this._updateSectionMeta(source);
    }
  }

  private _appendEntry(rec: EventsPanelRecord): void {
    const sec = this._sections[rec.source];
    if (!sec) return;

    const row = el("li", "xkt-events-row");
    row.dataset.source = rec.source;
    row.dataset.level  = rec.level;

    const timeEl = el("span", "xkt-events-time");
    timeEl.textContent = formatTime(rec.timestamp);
    timeEl.title = new Date(rec.timestamp).toISOString();

    const msgWrap = el("div", "xkt-events-msg");
    const msgText = document.createElement("span");
    msgText.textContent = rec.message;
    msgWrap.appendChild(msgText);
    if (rec.type !== undefined) {
      const typeEl = el("span", "xkt-events-type");
      typeEl.textContent = SDKErrorType[rec.type] ?? `type ${rec.type}`;
      msgWrap.appendChild(document.createElement("br"));
      msgWrap.appendChild(typeEl);
    }

    const copyBtn = el("button", "xkt-events-copy", {
      type: "button",
      "aria-label": "Copy message to clipboard",
      title: "Copy message",
    }) as HTMLButtonElement;
    copyBtn.innerHTML = COPY_ICON_SVG;
    copyBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._copyToClipboard(rec.message, copyBtn);
    });

    row.append(timeEl, msgWrap, copyBtn);
    // Newest at the top.
    sec.list.prepend(row);
    sec.count++;
    sec.lastTimestamp = rec.timestamp;

    // Auto-open the section the first time something lands in
    // it, so the user doesn't have to click to discover the new
    // event. Subsequent events leave the open/closed state
    // alone — respect the user's collapse choice.
    if (!sec.autoOpened) {
      sec.autoOpened = true;
      sec.details.open = true;
    }
  }

  /**
   * Build the structured payload that the Copy log button writes
   * to the clipboard. Public so callers can hand the same blob
   * to a logging endpoint or a file download without going
   * through the clipboard. Format is a single JSON object
   * containing a `meta` block (session start / duration / counts
   * / skipped event names / userAgent) and an `events` array of
   * `{t, source, event, args}` records, where `t` is seconds
   * since panel construction with millisecond precision.
   */
  public getLogPayload(): EventsPanelLogPayload {
    const nowPerf = (typeof performance !== "undefined" && typeof performance.now === "function")
      ? performance.now()
      : Date.now();
    const durationMs = nowPerf - this._logStartPerf;
    return {
      meta: {
        sessionStart:    this._logStartIso,
        capturedAt:      new Date().toISOString(),
        durationSeconds: Math.round(durationMs) / 1000,
        entryCount:      this._log.length,
        truncatedCount:  this._logTruncatedCount,
        capacity:        EventsPanel._LOG_CAPACITY,
        skippedEvents:   Array.from(EventsPanel._LOG_SKIP_EVENTS),
        sources:         Array.from(SECTION_ORDER),
        errorCount:      this._records.length,
        userAgent:       (typeof navigator !== "undefined") ? navigator.userAgent : "",
        url:             (typeof location !== "undefined") ? location.href : "",
      },
      events: this._log.slice(),
    };
  }

  /** Convenience: pretty-printed JSON of {@link getLogPayload}. */
  public getLogJson(): string {
    return JSON.stringify(this.getLogPayload(), null, 2);
  }

  /**
   * Open the same JSON payload that {@link _copyLogToClipboard}
   * writes — but in a new browser tab, served from a Blob URL.
   * `text/plain` MIME so the browser renders the (already
   * indent-2 pretty-printed) JSON inline rather than offering
   * to download it. The Blob URL is revoked a minute later;
   * the spawned tab keeps a reference past that, so a delayed
   * revoke is safe.
   */
  private _openLogInNewTab(): void {
    const json = this.getLogJson();
    let url: string;
    try {
      const blob = new Blob([json], {type: "text/plain;charset=utf-8"});
      url = URL.createObjectURL(blob);
    } catch (e: any) {
      console.warn("[EventsPanel] open log failed (Blob):", e?.message ?? e);
      return;
    }
    const win = window.open(url, "_blank");
    if (!win) {
      // Pop-up blocker said no — surface a hint and leak the
      // URL back to the user via prompt so the click wasn't
      // wasted.
      console.warn("[EventsPanel] window.open returned null — likely blocked by the pop-up policy. URL:", url);
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      return;
    }
    window.setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    }, 60_000);
  }

  private _copyLogToClipboard(): void {
    const text = this.getLogJson();
    const ok = (): void => {
      const restoreLabel = this._copyLogBtn.textContent;
      this._copyLogBtn.classList.add("xkt-events-copy-log-done");
      const n = this._log.length;
      const k = this._logTruncatedCount;
      this._copyLogBtn.textContent = k > 0
        ? `Copied ${n.toLocaleString()} (+${k.toLocaleString()} dropped)`
        : `Copied ${n.toLocaleString()} events`;
      window.setTimeout(() => {
        this._copyLogBtn.classList.remove("xkt-events-copy-log-done");
        this._copyLogBtn.textContent = restoreLabel || "Copy log";
      }, 1600);
    };
    const fail = (err: any): void => {
      console.warn("[EventsPanel] copy log failed:", err?.message ?? err);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok).catch((err) => {
        if (this._copyViaTextarea(text)) ok();
        else fail(err);
      });
      return;
    }
    if (this._copyViaTextarea(text)) ok();
    else fail(new Error("clipboard API unavailable"));
  }

  /**
   * Write `text` to the system clipboard and briefly flip the
   * trigger button's icon to a check-mark so the user has
   * visual confirmation. Falls back to a temporary
   * `<textarea>` + `document.execCommand("copy")` on browsers
   * without async-clipboard support (mostly old Safari) so the
   * feature works there too.
   */
  private _copyToClipboard(text: string, button: HTMLButtonElement): void {
    const ok = (): void => {
      button.classList.add("xkt-events-copy-done");
      button.innerHTML = COPY_DONE_ICON_SVG;
      const restoreAt = window.setTimeout(() => {
        button.classList.remove("xkt-events-copy-done");
        button.innerHTML = COPY_ICON_SVG;
      }, 1100);
      // If the row gets cleared / re-rendered before the timeout
      // fires, clearing the timeout would leak less — but the
      // button is GC'd along with its row, so the DOM-detached
      // setTimeout is harmless.
      void restoreAt;
    };
    const fail = (err: any): void => {
      console.warn("[EventsPanel] copy failed:", err?.message ?? err);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok).catch((err) => {
        // Some browsers reject when the document isn't focused
        // or the page isn't HTTPS — fall back to the legacy path
        // before giving up.
        if (this._copyViaTextarea(text)) ok();
        else fail(err);
      });
      return;
    }
    if (this._copyViaTextarea(text)) ok();
    else fail(new Error("clipboard API unavailable"));
  }

  private _copyViaTextarea(text: string): boolean {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      ta.style.pointerEvents = "none";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  private _updateCounter(): void {
    const n = this._records.length;
    const text = String(n);
    this._counterEl.textContent = text;
    this._counterEl.dataset.count = text;
    this._pillCountEl.textContent = text;
    this._pill.dataset.count = text;

    // Copy log / Open log are only meaningful once an error has
    // actually fired — keep them disabled until the log has
    // something worth handing off.
    const hasErrors = this._records.some((r) => r.level === "error");
    this._copyLogBtn.disabled = !hasErrors;
    this._openLogBtn.disabled = !hasErrors;
  }

  private _wireDomEvents(): void {
    this._clearBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this.clear();
    });
    this._copyLogBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._copyLogToClipboard();
    });
    this._openLogBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._openLogInNewTab();
    });
  }


  // ── Layout persistence ────────────────────────────────────────

}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────

/**
 * One entry in the comprehensive event log. `args` is a small
 * structured summary of the event payload — see
 * {@link summarizeArgs} for the field-extraction rules.
 */
export interface LogEntry {
  /** Seconds since panel construction, ms precision. */
  t: number;
  source: EventsPanelSource;
  /** Event emitter name (e.g. `"onDataModelCreated"`). */
  event: string;
  /** Compact summary of the event's `args` payload. */
  args: any;
}

/** Top-level shape of the JSON written to the clipboard by
 * the Copy log button. The `meta` block carries enough context
 * for an offline reader to interpret the timestamps and account
 * for any truncation that happened during the session. */
export interface EventsPanelLogPayload {
  meta: {
    sessionStart:    string;
    capturedAt:      string;
    durationSeconds: number;
    entryCount:      number;
    truncatedCount:  number;
    capacity:        number;
    skippedEvents:   string[];
    sources:         EventsPanelSource[];
    errorCount:      number;
    userAgent:       string;
    url:             string;
  };
  events: LogEntry[];
}

/** Display order + labels for the per-source sections. */
const SECTION_ORDER: readonly EventsPanelSource[] = [
  "scene",
  "data",
  "viewer",
  "renderer",
] as const;

const SECTION_LABEL: Record<EventsPanelSource, string> = {
  scene:    "Scene",
  data:     "Data",
  viewer:   "Viewer",
  renderer: "WebGLRenderer",
};

interface SectionView {
  /** The `<details>` wrapper, dataset-tagged with the source. */
  details: HTMLDetailsElement;
  /** The "n events, last hh:mm:ss" summary span. */
  summary: HTMLElement;
  /** `<ul>` that holds the rendered rows. */
  list: HTMLElement;
  /** Number of records currently rendered in this section. */
  count: number;
  /** Timestamp of the most-recent record in this section. */
  lastTimestamp: number;
  /** Has this section been auto-opened on its first event? */
  autoOpened: boolean;
  /** The count-badge span on the section's summary. */
  countEl: HTMLElement;
}

/** Minimal "two stacked rectangles" clipboard glyph. Strokes
 * use `currentColor` so the button can recolour the icon on
 * hover / done states without re-rendering the SVG. */
const COPY_ICON_SVG =
  `<svg viewBox="0 0 24 24" aria-hidden="true">` +
    `<rect x="9" y="9" width="11" height="12" rx="2" ry="2" ` +
          `fill="none" stroke="currentColor" stroke-width="1.7"/>` +
    `<path d="M6 16 H5 A1 1 0 0 1 4 15 V5 A1 1 0 0 1 5 4 H15 A1 1 0 0 1 16 5 V6" ` +
          `fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>` +
  `</svg>`;

/** Check-mark glyph swapped in for ~1s after a successful copy. */
const COPY_DONE_ICON_SVG =
  `<svg viewBox="0 0 24 24" aria-hidden="true">` +
    `<path d="M5 12 L10 17 L19 7" ` +
          `fill="none" stroke="currentColor" stroke-width="2.4" ` +
          `stroke-linecap="round" stroke-linejoin="round"/>` +
  `</svg>`;

/**
 * Reduce an event-payload value to a compact, JSON-safe summary
 * for the log. The full payload often holds back-references to
 * the entire SDK graph (a SceneObject points to its SceneModel
 * which points to its Scene which points to every other object…),
 * so naive `JSON.stringify` either explodes or hits a circular-
 * reference error. We pull a small, predictable set of
 * identifying fields instead — enough for an offline reader to
 * follow the action without dragging the whole object graph
 * along for the ride.
 *
 * Fields extracted (when present): `id`, `type`, `name`,
 * `error`, `ok` (the SDKResult flag), plus `length` for arrays.
 * Nested values are flattened to their `id` when they're
 * objects. Strings/numbers/bools/null/undefined pass through
 * verbatim.
 */
function summarizeArgs(v: any): any {
  if (v == null) return v;
  const t = typeof v;
  if (t === "string" || t === "number" || t === "boolean") return v;
  if (Array.isArray(v)) return {array: true, length: v.length};
  if (t !== "object") return String(v);

  const out: Record<string, any> = {};
  // Common identifying fields.
  for (const k of ["id", "type", "name", "schema"]) {
    if (k in v && v[k] != null && (typeof v[k] === "string" || typeof v[k] === "number")) {
      out[k] = v[k];
    }
  }
  // SDKResult shape — the most diagnostically valuable case.
  if ("ok" in v) {
    out.ok = !!v.ok;
    if (v.ok === false) {
      if (typeof v.error === "string") out.error = v.error;
      if (typeof v.type  === "number") out.errorType = v.type;
    }
  }
  // Nested model reference (e.g. SceneObject.model).
  if (v.model && typeof v.model === "object" && typeof v.model.id === "string") {
    out["model.id"] = v.model.id;
  }
  // If we got nothing useful, fall back to the prototype name
  // so the entry isn't an empty `{}`.
  if (Object.keys(out).length === 0) {
    const ctor = v.constructor && v.constructor.name;
    if (ctor && ctor !== "Object") out["@class"] = ctor;
  }
  return out;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

