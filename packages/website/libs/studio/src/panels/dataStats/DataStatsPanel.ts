/**
 * Floating, draggable, closeable panel that surfaces live
 * {@link Data} statistics — total counts at the Data level plus
 * a per-{@link model!data.DataModel | DataModel} breakdown, kept in sync via
 * {@link DataEvents}.
 *
 * Sister widget to {@link studio/sceneStats!SceneStatsPanel | SceneStatsPanel} and
 * {@link studio/sceneModelInspector/ui!SceneHealthPanel | SceneHealthPanel} — same
 * floating chrome, same colour palette, same drag / close /
 * reopen-pill mechanics. Three panels are designed to coexist on
 * one page; their reopen pills park in different spots along the
 * bottom edge so closing one doesn't hide its neighbour.
 *
 * ## Lazy event setup
 *
 * Listeners attach **only while the panel is visible**. A
 * constructor-time `onDataDestroyed` watcher is the one
 * exception — it stays subscribed even when hidden so the panel
 * can clean itself up if the underlying `Data` is torn down
 * behind its back. Showing reattaches all the
 * stat-affecting watchers and re-renders from scratch; hiding
 * detaches them again.
 *
 * ```ts
 * import {DataStatsPanel} from "@xeokit/website-studio";
 *
 * const stats = new DataStatsPanel({data});
 * stats.show();        // attaches listeners + paints
 * stats.hide();        // detaches; pill takes over
 * stats.destroy();     // tears down
 * ```
 *
 */
import type {Data, DataModel, DataModelStats} from "@xeokit/sdk/model/data";
import {FloatingPanelBase} from "../floatingPanelBase";
import {el} from "../../utils/el";
// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface DataStatsPanelParams {

  /** The Data graph to surface statistics for. */
  data: Data;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed
   * state. Defaults to `"xkt-dts-panel"`. Provide a unique key
   * per Data instance if you want per-data layout memory.
   */
  storageKey?: string;

  /** Show on construction (default `true`). */
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────
// Module state
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-dts-styles";
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
// CSS — every selector rooted at `.xkt-dts-panel` / `.xkt-dts-pill`,
// every class prefixed `xkt-dts-`. Visually matches
// SceneHealthPanel + SceneStatsPanel — same palette, same
// chrome. Pill parks at right:308px so all three panels' pills
// can coexist along the bottom edge without overlapping.
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-dts-panel {
  position: fixed;
  top: 115px;
  right: 17px;
  width: 480px;
  /* Auto height so the panel hugs its content — the totals
     row + each per-model section adds rows and the panel grows
     / shrinks as the user expands or collapses sections. The
     max-height bound caps it at the viewport so a Data graph
     with many models still scrolls inside the panel rather
     than overflowing the screen. */
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
.xkt-dts-panel *, .xkt-dts-panel *::before, .xkt-dts-panel *::after {
  box-sizing: border-box;
}
.xkt-dts-panel[hidden] { display: none; }

.xkt-dts-panel .xkt-dts-header {
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
.xkt-dts-panel .xkt-dts-header.xkt-dts-dragging { cursor: grabbing; }
.xkt-dts-panel .xkt-dts-title {
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
.xkt-dts-panel .xkt-dts-title-icon {
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
.xkt-dts-panel .xkt-dts-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-dts-panel .xkt-dts-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-dts-panel .xkt-dts-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-dts-panel .xkt-dts-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
.xkt-dts-panel .xkt-dts-title-id {
  flex-shrink: 0;
  padding: 2px 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 500;
  color: #555;
  background: #f0f0f0;
  border-radius: 4px;
  letter-spacing: 0.1px;
}
/* Header status badge — at-a-glance "is anything loaded?" pill.
   Green when one or more DataModels are present, muted when the
   Data graph is empty. Tooltip carries the object/relationship
   count for when the user wants the next level of detail. */
.xkt-dts-panel .xkt-dts-status-badge {
  flex-shrink: 0;
  padding: 3px 10px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: #fff;
  background: #2c7e6f;
  border-radius: 999px;
  white-space: nowrap;
}
.xkt-dts-panel .xkt-dts-status-badge.xkt-dts-status-empty {
  background: #e2e8f0;
  color: #64748b;
}
.xkt-dts-panel .xkt-dts-close {
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
.xkt-dts-panel .xkt-dts-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-dts-pill {
  position: fixed;
  bottom: 17px;
  right: 308px;
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
.xkt-dts-pill:hover { background: #1f4669; }
.xkt-dts-pill[hidden] { display: none; }

.xkt-dts-panel .xkt-dts-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px 12px 14px;
}
.xkt-dts-panel .xkt-dts-empty {
  padding: 24px 12px;
  text-align: center;
  color: #777;
  font-size: 12px;
}

.xkt-dts-panel .xkt-dts-section {
  margin: 6px 0;
  background: #fff;
  border: 1px solid #ececec;
  border-left: 3px solid #2d5e8c;
  border-radius: 6px;
  overflow: hidden;
}
.xkt-dts-panel .xkt-dts-section[data-kind="totals"]  { border-left-color: #2d5e8c; }
.xkt-dts-panel .xkt-dts-section[data-kind="model"]   { border-left-color: #2c7e6f; }
.xkt-dts-panel .xkt-dts-section > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  user-select: none;
}
.xkt-dts-panel .xkt-dts-section > summary::-webkit-details-marker { display: none; }
.xkt-dts-panel .xkt-dts-section > summary::marker                  { display: none; }
.xkt-dts-panel .xkt-dts-section > summary::before {
  content: "›";
  display: inline-block;
  transform: rotate(0deg);
  transition: transform 120ms ease-out;
  color: #888;
  font-size: 12px;
}
.xkt-dts-panel .xkt-dts-section[open] > summary::before { transform: rotate(90deg); }
.xkt-dts-panel .xkt-dts-section > summary:hover { background: #fafafa; }
.xkt-dts-panel .xkt-dts-section-label {
  flex: 1;
  font-size: 12px;
  font-weight: 650;
  color: #222;
  letter-spacing: -0.1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-dts-panel .xkt-dts-section[data-kind="totals"]  .xkt-dts-section-label { color: #2d5e8c; }
.xkt-dts-panel .xkt-dts-section[data-kind="model"]   .xkt-dts-section-label { color: #2c7e6f; }
.xkt-dts-panel .xkt-dts-section-id {
  flex-shrink: 0;
  padding: 1px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.2px;
  color: #666;
  background: #f0f0f0;
  border-radius: 3px;
  white-space: nowrap;
}
.xkt-dts-panel .xkt-dts-section-count {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  font-variant-numeric: tabular-nums;
}
.xkt-dts-panel .xkt-dts-json-btn {
  flex-shrink: 0;
  padding: 2px 8px;
  font: inherit;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: #2d5e8c;
  background: transparent;
  border: 1px solid #b6cadb;
  border-radius: 999px;
  cursor: pointer;
}
.xkt-dts-panel .xkt-dts-json-btn:hover {
  background: #e7eef5;
  border-color: #2d5e8c;
}
.xkt-dts-panel .xkt-dts-section > .xkt-dts-section-body {
  padding: 6px 12px 10px;
  border-top: 1px solid #f4f4f4;
  background: #fcfcfc;
}

/* Stats grid — single column. The three DataModelStats fields
   stack vertically so each label / value pair gets the full
   panel width and reads as a clean tabular list. */
.xkt-dts-panel .xkt-dts-stats {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
}
.xkt-dts-panel .xkt-dts-stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 11px;
  min-width: 0;
}
.xkt-dts-panel .xkt-dts-stat-label {
  flex: 1;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  font-size: 9.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.xkt-dts-panel .xkt-dts-stat-value {
  flex-shrink: 0;
  color: #111;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.xkt-dts-panel .xkt-dts-stat-value.xkt-dts-zero { color: #aaa; font-weight: 400; }
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

export class DataStatsPanel extends FloatingPanelBase {

  /**
   * Per-Data instance registry. Lets {@link openFor} hand back
   * the existing live panel for a Data graph instead of stacking
   * duplicates, and lets {@link getFor} probe for one without
   * disturbing it. WeakMap so a Data that gets dropped doesn't
   * keep the panel alive for GC.
   */
  private static readonly _instances = new WeakMap<Data, DataStatsPanel>();

  /**
   * SVG markup for the panel's title-bar glyph (ER-diagram —
   * three entity boxes joined by relationship lines). Strokes
   * use `currentColor`. Single source of truth — shared by
   * `_buildDom` and external callers like
   * `ViewObjectContextMenu`.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="2.5" y="3.5"  width="7" height="5" rx="1" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<rect x="14.5" y="3.5" width="7" height="5" rx="1" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<rect x="8.5"  y="15.5" width="7" height="5" rx="1" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<line x1="6"  y1="8.5"  x2="11" y2="15.5" stroke="currentColor" stroke-width="1.4"/>` +
      `<line x1="18" y1="8.5"  x2="13" y2="15.5" stroke="currentColor" stroke-width="1.4"/>` +
    `</svg>`;
  }

  /**
   * Returns the existing live panel bound to `data`, or
   * `undefined` if none has been constructed (or the prior
   * instance was destroyed). Lets callers ask "is there already
   * a panel here?" without triggering the show side effect that
   * {@link openFor} performs.
   */
  static getFor(data: Data): DataStatsPanel | undefined {
    const inst = DataStatsPanel._instances.get(data);
    return inst && !inst._destroyed ? inst : undefined;
  }

  /**
   * Reveal (or lazily mount) a panel for `params.data`.
   * Idempotent — if a panel already exists for this Data graph
   * and is still alive, it's brought back to the foreground;
   * otherwise a fresh one is constructed.
   *
   * Built for the {@link demo!ViewObjectContextMenu | ViewObjectContextMenu} "Data
   * Stats" entry, so the menu works in every host regardless
   * of whether the example wired a panel up itself.
   */
  static openFor(params: DataStatsPanelParams): DataStatsPanel {
    let inst = DataStatsPanel._instances.get(params.data);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new DataStatsPanel(params);
    return inst;
  }

  readonly data: Data;

  // Panel-content DOM refs (chrome refs live on FloatingPanelBase).
  private _titleIdEl!: HTMLElement;
  private _statusBadgeEl!: HTMLElement;
  private _bodyEl!: HTMLElement;
  private _totalsBody: HTMLElement | null = null;
  private _modelsListEl!: HTMLElement;
  private _modelsCountEl: HTMLElement | null = null;
  private readonly _modelSections = new Map<string, {
    section: HTMLDetailsElement;
    statsBody: HTMLElement;
  }>();

  // Listener state.
  private _listenersAttached = false;
  private _refreshScheduled = false;
  private readonly _unsubs: Array<() => void> = [];
  private _onDataDestroyedUnsub: (() => void) | null = null;

  constructor(params: DataStatsPanelParams) {
    if (!params || !params.data) {
      throw new Error("DataStatsPanel: data is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-dts-panel",
      classPrefix: "xkt-dts",
    });
    this.data = params.data;

    // Replace any prior panel bound to the same Data graph —
    // keeps openFor's idempotence honest and avoids stale DOM
    // left over from a hot-reload / re-import.
    const prior = DataStatsPanel._instances.get(params.data);
    if (prior && !prior._destroyed) prior.destroy();
    DataStatsPanel._instances.set(params.data, this);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();
    this._wireDomEvents();

    this._onDataDestroyedUnsub = this.data.events.onDataDestroyed.subscribe(() => {
      this.destroy();
    });

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
    this._renderAll();
  }

  hide(): void {
    if (this._destroyed) return;
    super.hide();
    this._detachListeners();
  }

  destroy(): void {
    if (this._destroyed) return;
    this._detachListeners();
    if (this._onDataDestroyedUnsub) {
      try { this._onDataDestroyedUnsub(); } catch { /* ignore */ }
      this._onDataDestroyedUnsub = null;
    }
    if (DataStatsPanel._instances.get(this.data) === this) {
      DataStatsPanel._instances.delete(this.data);
    }
    super.destroy();
  }


  // ── Listener attach / detach ──────────────────────────────────

  private _attachListeners(): void {
    if (this._listenersAttached || this._destroyed) return;
    this._listenersAttached = true;

    const ev = this.data.events;
    const sub = (unsub: () => void) => this._unsubs.push(unsub);
    const onChange = () => this._scheduleRefresh();

    sub(ev.onDataModelCreated.subscribe((_d, model) => {
      this._addModelSection(model);
      this._scheduleRefresh();
    }));
    sub(ev.onDataModelDestroyed.subscribe((_d, model) => {
      this._removeModelSection(model);
      this._scheduleRefresh();
    }));

    // Stats-affecting create/destroy events. Debounced so a bulk
    // load doesn't trigger a render per resource — at most one
    // paint per animation frame.
    sub(ev.onDataObjectCreated.subscribe(onChange));
    sub(ev.onDataObjectDestroyed.subscribe(onChange));
    sub(ev.onRelationshipCreated.subscribe(onChange));
    sub(ev.onRelationshipDestroyed.subscribe(onChange));
    sub(ev.onPropertySetCreated.subscribe(onChange));
    sub(ev.onPropertySetDestroyed.subscribe(onChange));
  }

  private _detachListeners(): void {
    if (!this._listenersAttached) return;
    for (const u of this._unsubs) {
      try { u(); } catch { /* ignore */ }
    }
    this._unsubs.length = 0;
    this._listenersAttached = false;
    this._refreshScheduled = false;
  }

  private _scheduleRefresh(): void {
    if (this._destroyed || !this._listenersAttached) return;
    if (this._refreshScheduled) return;
    this._refreshScheduled = true;
    requestAnimationFrame(() => {
      this._refreshScheduled = false;
      if (this._destroyed || !this._listenersAttached) return;
      this._renderTotals();
      this._renderAllModelStats();
      this._refreshModelsCount();
      this._refreshStatusBadge();
    });
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-dts-pill", {
      type: "button",
      title: "Reopen the Data Statistics panel",
      hidden: true,
      textContent: "Data Statistics",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-dts-panel");

    // Header — drag handle, title row, close.
    this._header = el("div", "xkt-dts-header");
    const title = el("h2", "xkt-dts-title");
    title.innerHTML =
      `<span class="xkt-dts-title-icon">${DataStatsPanel.iconSvg()}</span>` +
      `<span class="xkt-dts-title-stack">` +
        `<span class="xkt-dts-title-text">Data Statistics</span>` +
        `<span class="xkt-dts-subtitle">Live Data graph counts.</span>` +
      `</span>` +
      `<span class="xkt-dts-title-id" title="Data id"></span>`;
    this._titleIdEl = title.querySelector(".xkt-dts-title-id") as HTMLElement;
    this._titleIdEl.textContent = String((this.data as any).id ?? "Data");

    this._statusBadgeEl = el("span", "xkt-dts-status-badge");
    this._statusBadgeEl.classList.add("xkt-dts-status-empty");
    this._statusBadgeEl.textContent = "Empty";
    this._statusBadgeEl.title = "No DataModels loaded";

    this._closeBtn = el("button", "xkt-dts-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;

    this._header.append(title, this._statusBadgeEl, this._closeBtn);
    this._panel.appendChild(this._header);

    // Body.
    this._bodyEl = el("div", "xkt-dts-body");
    this._modelsListEl = el("div");
    this._panel.appendChild(this._bodyEl);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }

  private _wireDomEvents(): void {
    // Bring-to-front on any pointer-down inside the panel —
    // bubbles up so clicks on buttons / scroll thumbs / drag
  }


  // ── Layout persistence ────────────────────────────────────────



  // ── Rendering ─────────────────────────────────────────────────

  private _renderAll(): void {
    this._bodyEl.innerHTML = "";
    this._modelSections.clear();
    this._totalsBody = null;
    this._modelsCountEl = null;

    // 1) Totals (sum across all models).
    {
      const section = this._buildSection({
        kind: "totals",
        label: "Totals",
        defaultOpen: true,
      });
      this._totalsBody = section.bodyEl;
      this._bodyEl.appendChild(section.section);
    }

    // 2) Per-model section header.
    const modelsHeader = el("div", "xkt-dts-models-header");
    modelsHeader.style.cssText = "padding: 12px 4px 4px; font-size: 11px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.3px; display: flex; gap: 8px; align-items: baseline;";
    const modelsLabel = el("span", undefined, {textContent: "Models"});
    this._modelsCountEl = el("span", undefined);
    this._modelsCountEl.style.cssText = "color: #888; font-weight: 500;";
    modelsHeader.append(modelsLabel, this._modelsCountEl);
    this._bodyEl.appendChild(modelsHeader);

    this._modelsListEl = el("div");
    this._bodyEl.appendChild(this._modelsListEl);

    // 3) Populate per-model sections from current state.
    const models = this._listModels();
    if (models.length === 0) {
      const empty = el("div", "xkt-dts-empty", {textContent: "No models loaded."});
      this._modelsListEl.appendChild(empty);
    } else {
      for (const m of models) this._addModelSection(m);
    }

    // 4) Initial paints.
    this._renderTotals();
    this._renderAllModelStats();
    this._refreshModelsCount();
    this._refreshStatusBadge();
  }

  private _refreshModelsCount(): void {
    if (!this._modelsCountEl) return;
    const n = this._modelSections.size;
    this._modelsCountEl.textContent = `(${n})`;
  }

  /**
   * Refresh the header status badge — the at-a-glance signal of
   * whether the Data graph currently holds any DataModels. Cheap;
   * runs alongside every stat refresh.
   */
  private _refreshStatusBadge(): void {
    if (!this._statusBadgeEl) return;
    const n = this._modelSections.size;
    if (n === 0) {
      this._statusBadgeEl.classList.add("xkt-dts-status-empty");
      this._statusBadgeEl.textContent = "Empty";
      this._statusBadgeEl.title = "No DataModels loaded";
      return;
    }
    this._statusBadgeEl.classList.remove("xkt-dts-status-empty");
    const word = n === 1 ? "Model" : "Models";
    this._statusBadgeEl.textContent = `${n} ${word}`;
    const totals = this._aggregateStats();
    this._statusBadgeEl.title =
      `${n} ${word.toLowerCase()} loaded · ` +
      `${totals.numObjects.toLocaleString()} data objects · ` +
      `${totals.numRelationships.toLocaleString()} relationships`;
  }

  private _renderTotals(): void {
    if (!this._totalsBody) return;
    const totals = this._aggregateStats();
    this._totalsBody.innerHTML = renderStatsGrid(totals);
  }

  private _renderAllModelStats(): void {
    for (const model of this._listModels()) {
      this._renderModelStats(model);
    }
  }

  private _renderModelStats(model: DataModel): void {
    const id = String((model as any).id);
    const entry = this._modelSections.get(id);
    if (!entry) return;
    const stats = (model as any).stats as DataModelStats | null | undefined;
    if (!stats) {
      entry.statsBody.innerHTML = `<div class="xkt-dts-empty">No stats available.</div>`;
      return;
    }
    entry.statsBody.innerHTML = renderStatsGrid(stats);
  }


  // ── Per-model section management ──────────────────────────────

  private _addModelSection(model: DataModel): void {
    const id = String((model as any).id);
    if (this._modelSections.has(id)) return;
    if (!this._modelsListEl.parentElement) return;     // not yet rendered

    const empty = this._modelsListEl.querySelector(".xkt-dts-empty");
    if (empty) empty.remove();

    const section = el("details", "xkt-dts-section") as HTMLDetailsElement;
    section.setAttribute("data-kind", "model");

    const summary = el("summary");
    const label = el("span", "xkt-dts-section-label", {textContent: "DataModel"});
    const idBadge = el("span", "xkt-dts-section-id", {textContent: id, title: "DataModel id"});
    const jsonBtn = el("button", "xkt-dts-json-btn", {
      type: "button",
      textContent: "JSON",
      title: "Open serialized DataModel in a new tab",
    }) as HTMLButtonElement;
    jsonBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      const result: any = (model as any).toParams?.();
      if (result && result.ok !== false) {
        openJsonInNewTab(result.value, `DataModel ${id}`);
      }
    });
    summary.append(label, idBadge, jsonBtn);
    section.appendChild(summary);

    const body = el("div", "xkt-dts-section-body");
    const statsBody = el("div");
    body.appendChild(statsBody);

    section.appendChild(body);
    this._modelsListEl.appendChild(section);

    this._modelSections.set(id, {section, statsBody});

    this._renderModelStats(model);
  }

  private _removeModelSection(model: DataModel): void {
    const id = String((model as any).id);
    const entry = this._modelSections.get(id);
    if (!entry) return;
    entry.section.remove();
    this._modelSections.delete(id);
    if (this._modelSections.size === 0 && this._modelsListEl.parentElement) {
      const empty = el("div", "xkt-dts-empty", {textContent: "No models loaded."});
      this._modelsListEl.appendChild(empty);
    }
  }


  // ── Helpers ───────────────────────────────────────────────────

  private _listModels(): DataModel[] {
    const map = (this.data as any).models || {};
    return Object.values(map) as DataModel[];
  }

  /**
   * Sum every per-model {@link DataModelStats} into one Data-wide
   * total. Cheap — runs only on paint.
   */
  private _aggregateStats(): DataModelStats {
    const acc: DataModelStats = {
      numObjects: 0, numRelationships: 0, numPropertySets: 0,
    };
    for (const m of this._listModels()) {
      const s = (m as any).stats as DataModelStats | null | undefined;
      if (!s) continue;
      acc.numObjects        += s.numObjects        || 0;
      acc.numRelationships  += s.numRelationships  || 0;
      acc.numPropertySets   += s.numPropertySets   || 0;
    }
    return acc;
  }

  private _buildSection(opts: {
    kind: "totals" | "model";
    label: string;
    defaultOpen?: boolean;
  }): {section: HTMLDetailsElement; bodyEl: HTMLElement} {
    const section = el("details", "xkt-dts-section") as HTMLDetailsElement;
    section.setAttribute("data-kind", opts.kind);
    if (opts.defaultOpen !== false) section.open = true;
    const summary = el("summary");
    const label = el("span", "xkt-dts-section-label", {textContent: opts.label});
    summary.append(label);
    section.appendChild(summary);
    const bodyEl = el("div", "xkt-dts-section-body");
    section.appendChild(bodyEl);
    return {section, bodyEl};
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────


function renderStatsGrid(stats: DataModelStats): string {
  const rows: Array<[string, number]> = [
    ["DataObjects",   stats.numObjects],
    ["Relationships", stats.numRelationships],
    ["PropertySets",  stats.numPropertySets],
  ];
  let html = `<div class="xkt-dts-stats">`;
  for (const [label, n] of rows) {
    html += `<div class="xkt-dts-stat">` +
      `<span class="xkt-dts-stat-label">${escapeHtml(label)}</span>` +
      `<span class="xkt-dts-stat-value${n === 0 ? " xkt-dts-zero" : ""}">${escapeHtml(formatNumber(n))}</span>` +
      `</div>`;
  }
  html += `</div>`;
  return html;
}

function formatNumber(v: any): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v ?? "—");
}

function escapeHtml(s: string | number): string {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[c] as string));
}

function openJsonInNewTab(obj: unknown, title = "JSON"): void {
  const json = JSON.stringify(obj, null, 2);
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  <meta charset="utf-8"/>
  <style>
    body { background: #0f1116; color: #e7e7e7; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 0; padding: 0; }
    .json-pre { background: #0f1116; border-radius: 10px; margin: 24px 0 24px 24px; padding: 24px 32px; max-width: 900px; font-size: 15px; box-shadow: 0 4px 24px #0001; color: #e7e7e7; }
    h1 { color: #fff; font-size: 20px; font-weight: 650; margin: 24px 24px 12px 24px; }
    .meta { color: #aaa; font-size: 13px; margin: 0 24px 18px 24px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Serialized to JSON</div>
  <pre class="json-pre">${escapeHtml(json)}</pre>
</body>
</html>
  `.trim();
  const win = window.open();
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
