/**
 * Floating, draggable, closeable panel that surfaces live
 * {@link model!scene.Scene | Scene} statistics — total resource counts at the Scene
 * level plus a per-{@link model!scene.SceneModel | SceneModel} breakdown, kept in sync via
 * {@link SceneEvents}.
 *
 * ## Lazy event setup
 *
 * Listeners attach **only while the panel is visible**, so a
 * page that constructs the panel hidden, or where the user has
 * dismissed it via the close button, doesn't pay any per-event
 * cost as the Scene mutates. Showing re-attaches and re-renders
 * from scratch; hiding detaches everything except a single
 * lightweight `onSceneDestroyed` watcher so the panel can clean
 * itself up if the underlying Scene is torn down behind its back.
 *
 * ## Visual alignment with SceneHealthPanel
 *
 * Same chrome (floating drag-handle header, close button + pill,
 * width / shadow / radius), same colour palette, same font stack,
 * same id-badge styling — just with its own `xkt-scs-` prefix and
 * its own injected stylesheet so the two widgets can sit side by
 * side without colliding.
 *
 * ```ts
 * import {SceneStatsPanel} from "@xeokit/website-studio";
 *
 * const stats = new SceneStatsPanel({scene});
 * stats.show();        // attaches listeners + paints
 * stats.hide();        // detaches listeners; pill takes over
 * stats.destroy();     // tears down the DOM and any listeners
 * ```
 *
 */
import type {Scene, SceneModel, SceneModelStats} from "@xeokit/sdk/model/scene";
import {isDefaultLayerModel} from "@xeokit/sdk/model/scene";
import {FloatingPanelBase} from "../floatingPanelBase";
import {el} from "../../utils/el";
// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface SceneStatsPanelParams {

  /** The Scene to surface statistics for. */
  scene: Scene;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed
   * state. Defaults to `"xkt-scs-panel"`. Provide a unique key
   * per Scene if you want per-scene layout memory.
   */
  storageKey?: string;

  /** Show on construction (default `true`). */
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard for the whole page.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-scs-styles";
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
// CSS — every selector is rooted at `.xkt-scs-panel` or
// `.xkt-scs-pill`; class names prefixed `xkt-scs-`. Visually
// matches SceneHealthPanel (same palette + chrome) so the two
// panels read as a coherent set.
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-scs-panel {
  position: fixed;
  top: 115px;
  right: 17px;
  width: 480px;
  /* Auto height so the panel hugs its content — totals + each
     per-model section adds rows and the panel grows/shrinks
     as the user expands or collapses sections. The max-height
     bound caps it at the viewport so a model with hundreds of
     SceneModels still scrolls inside the panel rather than
     overflowing the screen. */
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
.xkt-scs-panel *, .xkt-scs-panel *::before, .xkt-scs-panel *::after {
  box-sizing: border-box;
}
.xkt-scs-panel[hidden] { display: none; }

.xkt-scs-panel .xkt-scs-header {
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
.xkt-scs-panel .xkt-scs-header.xkt-scs-dragging { cursor: grabbing; }
.xkt-scs-panel .xkt-scs-title {
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
.xkt-scs-panel .xkt-scs-title-icon {
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
.xkt-scs-panel .xkt-scs-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-scs-panel .xkt-scs-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-scs-panel .xkt-scs-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-scs-panel .xkt-scs-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
/* Header status badge — at-a-glance "is anything loaded?" pill.
   Green when one or more SceneModels are present, muted when the
   Scene is empty. Tooltip carries the object/triangle count for
   when the user wants the next level of detail. */
.xkt-scs-panel .xkt-scs-status-badge {
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
.xkt-scs-panel .xkt-scs-status-badge.xkt-scs-status-empty {
  background: #e2e8f0;
  color: #64748b;
}
.xkt-scs-panel .xkt-scs-close {
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
.xkt-scs-panel .xkt-scs-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-scs-pill {
  position: fixed;
  bottom: 17px;
  right: 178px;
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
.xkt-scs-pill:hover { background: #1f4669; }
.xkt-scs-pill[hidden] { display: none; }

/* Body — scrollable region housing the totals + per-model blocks. */
.xkt-scs-panel .xkt-scs-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px 12px 14px;
}
.xkt-scs-panel .xkt-scs-empty {
  padding: 24px 12px;
  text-align: center;
  color: #777;
  font-size: 12px;
}

/* Section block — coord-system / totals / per-model. Same shape
   and stripe vocabulary as the SceneHealthPanel impact-group. */
.xkt-scs-panel .xkt-scs-section {
  margin: 6px 0;
  background: #fff;
  border: 1px solid #ececec;
  border-left: 3px solid #2d5e8c;
  border-radius: 6px;
  overflow: hidden;
}
.xkt-scs-panel .xkt-scs-section[data-kind="coords"]  { border-left-color: #9c4666; }
.xkt-scs-panel .xkt-scs-section[data-kind="totals"]  { border-left-color: #2d5e8c; }
.xkt-scs-panel .xkt-scs-section[data-kind="model"]   { border-left-color: #2c7e6f; }
.xkt-scs-panel .xkt-scs-section > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  user-select: none;
}
.xkt-scs-panel .xkt-scs-section > summary::-webkit-details-marker { display: none; }
.xkt-scs-panel .xkt-scs-section > summary::marker                  { display: none; }
.xkt-scs-panel .xkt-scs-section > summary::before {
  content: "›";
  display: inline-block;
  transform: rotate(0deg);
  transition: transform 120ms ease-out;
  color: #888;
  font-size: 12px;
}
.xkt-scs-panel .xkt-scs-section[open] > summary::before { transform: rotate(90deg); }
.xkt-scs-panel .xkt-scs-section > summary:hover { background: #fafafa; }
.xkt-scs-panel .xkt-scs-section-label {
  flex: 1;
  font-size: 12px;
  font-weight: 650;
  color: #222;
  letter-spacing: -0.1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-scs-panel .xkt-scs-section[data-kind="coords"]  .xkt-scs-section-label { color: #9c4666; }
.xkt-scs-panel .xkt-scs-section[data-kind="totals"]  .xkt-scs-section-label { color: #2d5e8c; }
.xkt-scs-panel .xkt-scs-section[data-kind="model"]   .xkt-scs-section-label { color: #2c7e6f; }
.xkt-scs-panel .xkt-scs-section-id {
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
.xkt-scs-panel .xkt-scs-section-count {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  font-variant-numeric: tabular-nums;
}
.xkt-scs-panel .xkt-scs-json-btn {
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
.xkt-scs-panel .xkt-scs-json-btn:hover {
  background: #e7eef5;
  border-color: #2d5e8c;
}
.xkt-scs-panel .xkt-scs-section > .xkt-scs-section-body {
  padding: 6px 12px 10px;
  border-top: 1px solid #f4f4f4;
  background: #fcfcfc;
}

/* Stats grid — same look as SceneHealthPanel's stats. */
.xkt-scs-panel .xkt-scs-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px 14px;
}
.xkt-scs-panel .xkt-scs-stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 11px;
  min-width: 0;
}
.xkt-scs-panel .xkt-scs-stat-label {
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
.xkt-scs-panel .xkt-scs-stat-value {
  flex-shrink: 0;
  color: #111;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.xkt-scs-panel .xkt-scs-stat-value.xkt-scs-zero { color: #aaa; font-weight: 400; }

/* Coord-system table — leaner than SceneHealthPanel's stats
   grid because each row's label is longer and the values can be
   long arrays. */
.xkt-scs-panel .xkt-scs-coords {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 12px;
  font-size: 11px;
}
.xkt-scs-panel .xkt-scs-coords-label {
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  font-size: 9.5px;
  font-weight: 600;
}
.xkt-scs-panel .xkt-scs-coords-value {
  color: #222;
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10.5px;
  word-break: break-word;
}
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

export class SceneStatsPanel extends FloatingPanelBase {

  /**
   * Per-Scene instance registry. Lets {@link openFor} hand back
   * the existing live panel for a Scene instead of stacking
   * duplicates, and lets {@link getFor} probe for one without
   * disturbing it. WeakMap so a Scene that gets dropped doesn't
   * keep the panel alive for GC.
   */
  private static readonly _instances = new WeakMap<Scene, SceneStatsPanel>();

  /**
   * SVG markup for the panel's title-bar glyph (three-bar
   * chart). Strokes use `currentColor`. Single source of truth —
   * shared by `_buildDom` and any external caller (e.g.
   * `ViewObjectContextMenu`).
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="4"  y="13" width="3.6" height="7"  rx="0.8" ` +
            `fill="none" stroke="currentColor" stroke-width="1.8"/>` +
      `<rect x="10" y="9"  width="3.6" height="11" rx="0.8" ` +
            `fill="none" stroke="currentColor" stroke-width="1.8"/>` +
      `<rect x="16" y="5"  width="3.6" height="15" rx="0.8" ` +
            `fill="none" stroke="currentColor" stroke-width="1.8"/>` +
    `</svg>`;
  }

  /**
   * Returns the existing live panel bound to `scene`, or
   * `undefined` if none has been constructed (or the prior
   * instance was destroyed). Lets callers ask "is there already
   * a panel here?" without triggering the show side effect that
   * {@link openFor} performs.
   */
  static getFor(scene: Scene): SceneStatsPanel | undefined {
    const inst = SceneStatsPanel._instances.get(scene);
    return inst && !inst._destroyed ? inst : undefined;
  }

  /**
   * Reveal (or lazily mount) a panel for `params.scene`.
   * Idempotent — if a panel already exists for this Scene and
   * is still alive, it's brought back to the foreground;
   * otherwise a fresh one is constructed.
   *
   * Built for the {@link demo!ViewObjectContextMenu | ViewObjectContextMenu} "Scene
   * Stats" entry, so the menu works in every host regardless
   * of whether the example wired a panel up itself.
   */
  static openFor(params: SceneStatsPanelParams): SceneStatsPanel {
    let inst = SceneStatsPanel._instances.get(params.scene);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new SceneStatsPanel(params);
    return inst;
  }

  readonly scene: Scene;

  // Panel-content DOM refs (chrome refs live on FloatingPanelBase).
  private _statusBadgeEl!: HTMLElement;
  private _bodyEl!: HTMLElement;
  private _coordsBody: HTMLElement | null = null;
  private _totalsBody: HTMLElement | null = null;
  private _modelsListEl!: HTMLElement;
  private _modelsCountEl: HTMLElement | null = null;
  private readonly _modelSections = new Map<string, {
    section: HTMLDetailsElement;
    coordsBody: HTMLElement | null;
    statsBody: HTMLElement;
  }>();

  // Listener state.
  private _listenersAttached = false;
  private _refreshScheduled = false;
  private readonly _unsubs: Array<() => void> = [];
  private _onSceneDestroyedUnsub: (() => void) | null = null;

  constructor(params: SceneStatsPanelParams) {
    if (!params || !params.scene) {
      throw new Error("SceneStatsPanel: scene is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-scs-panel",
      classPrefix: "xkt-scs",
    });
    this.scene = params.scene;

    // Replace any prior panel bound to the same Scene — keeps
    // openFor's idempotence honest and avoids stale DOM left
    // over from a hot-reload / re-import.
    const prior = SceneStatsPanel._instances.get(params.scene);
    if (prior && !prior._destroyed) prior.destroy();
    SceneStatsPanel._instances.set(params.scene, this);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();

    // Always-on minimal watcher — if the Scene is destroyed while
    // the panel is hidden, we still need to clean up.
    this._onSceneDestroyedUnsub = this.scene.events.onSceneDestroyed.subscribe(() => {
      this.destroy();
    });

    if (params.visible === false) {
      this.hide();
    } else {
      this.show();
    }
  }


  // ── Public lifecycle ──────────────────────────────────────────

  /**
   * Reveal the panel. Attaches Scene event listeners and paints
   * fresh content on top of the base's panel/pill swap.
   */
  show(): void {
    if (this._destroyed) return;
    super.show();
    this._attachListeners();
    this._renderAll();
  }

  /**
   * Hide the panel and detach Scene listeners. The pill takes the
   * panel's place so the user can pull it back without paying
   * per-event cost in the meantime.
   */
  hide(): void {
    if (this._destroyed) return;
    super.hide();
    this._detachListeners();
  }

  /** Tear down DOM + every listener. Idempotent. */
  destroy(): void {
    if (this._destroyed) return;
    this._detachListeners();
    if (this._onSceneDestroyedUnsub) {
      try { this._onSceneDestroyedUnsub(); } catch { /* ignore */ }
      this._onSceneDestroyedUnsub = null;
    }
    if (SceneStatsPanel._instances.get(this.scene) === this) {
      SceneStatsPanel._instances.delete(this.scene);
    }
    super.destroy();
  }


  // ── Listener attach / detach ──────────────────────────────────

  /**
   * Subscribe to every event that could move the numbers we
   * display. Most stat-affecting events route through a debounced
   * `_scheduleRefresh` so a bulk load doesn't trigger a render
   * per resource — at most one paint per animation frame.
   */
  private _attachListeners(): void {
    if (this._listenersAttached || this._destroyed) return;
    this._listenersAttached = true;

    const ev = this.scene.events;
    const sub = (unsub: () => void) => this._unsubs.push(unsub);
    const onChange = () => this._scheduleRefresh();

    // Per-model lifecycle.
    sub(ev.onSceneModelCreated.subscribe((_s, model) => {
      this._addModelSection(model);
      this._scheduleRefresh();
    }));
    sub(ev.onSceneModelDestroyed.subscribe((_s, model) => {
      this._removeModelSection(model);
      this._scheduleRefresh();
    }));

    // Coord-system updates.
    sub(ev.onSceneCoordSystemUpdated.subscribe(() => this._renderSceneCoordSys()));
    sub(ev.onSceneModelCoordSystemUpdated.subscribe((model) => {
      this._renderModelCoordSys(model);
    }));

    // Stats-affecting create/destroy events. Debounced into a
    // single refresh so 10 000 mesh-creates → 1 paint.
    sub(ev.onSceneObjectCreated.subscribe(onChange));
    sub(ev.onSceneObjectDestroyed.subscribe(onChange));
    sub(ev.onSceneMeshCreated.subscribe(onChange));
    sub(ev.onSceneMeshDestroyed.subscribe(onChange));
    sub(ev.onSceneGeometryCreated.subscribe(onChange));
    sub(ev.onSceneGeometryDestroyed.subscribe(onChange));
    sub(ev.onSceneGeometryUpdated.subscribe(onChange));
    sub(ev.onSceneTransformCreated.subscribe(onChange));
    sub(ev.onSceneTransformDestroyed.subscribe(onChange));
    sub(ev.onSceneTextureCreated.subscribe(onChange));
    sub(ev.onSceneTextureDestroyed.subscribe(onChange));
    sub(ev.onSceneMaterialCreated.subscribe(onChange));
    sub(ev.onSceneMaterialDestroyed.subscribe(onChange));
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

  /**
   * Coalesce stats-changing events into a single re-paint per
   * animation frame. With listeners attached, an `applyFixes` run
   * that destroys 600 geometries fires 600 events — without the
   * coalesce we'd repaint 600 times.
   */
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
    this._pill = el("button", "xkt-scs-pill", {
      type: "button",
      title: "Reopen the Scene Statistics panel",
      hidden: true,
      textContent: "Scene Statistics",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-scs-panel");

    // Header — drag handle, title row, close.
    this._header = el("div", "xkt-scs-header");
    const title = el("h2", "xkt-scs-title");
    title.innerHTML =
      `<span class="xkt-scs-title-icon">${SceneStatsPanel.iconSvg()}</span>` +
      `<span class="xkt-scs-title-stack">` +
        `<span class="xkt-scs-title-text">Scene Statistics</span>` +
        `<span class="xkt-scs-subtitle">Live Scene resource counts.</span>` +
      `</span>`;

    this._statusBadgeEl = el("span", "xkt-scs-status-badge");
    this._statusBadgeEl.classList.add("xkt-scs-status-empty");
    this._statusBadgeEl.textContent = "Empty";
    this._statusBadgeEl.title = "No SceneModels loaded";

    this._closeBtn = el("button", "xkt-scs-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;

    this._header.append(title, this._statusBadgeEl, this._closeBtn);
    this._panel.appendChild(this._header);

    // Body — scrollable section list.
    this._bodyEl = el("div", "xkt-scs-body");
    this._modelsListEl = el("div");
    this._panel.appendChild(this._bodyEl);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }

  // ── Rendering ─────────────────────────────────────────────────

  /**
   * Wipe and rebuild the body from scratch — used on `show()` and
   * after major topology changes (model add / remove). Per-event
   * stat refreshes go through the lighter
   * {@link _scheduleRefresh}.
   */
  private _renderAll(): void {
    this._bodyEl.innerHTML = "";
    this._modelSections.clear();
    this._coordsBody = null;
    this._totalsBody = null;
    this._modelsCountEl = null;

    // 1) Scene coordinate system.
    if ((this.scene as any).coordinateSystem) {
      const section = this._buildSection({
        kind: "coords",
        label: "Scene Coordinate System",
      });
      this._coordsBody = section.bodyEl;
      this._bodyEl.appendChild(section.section);
    }

    // 2) Totals (sum across all models).
    {
      const section = this._buildSection({
        kind: "totals",
        label: "Totals",
        defaultOpen: true,
      });
      this._totalsBody = section.bodyEl;
      this._bodyEl.appendChild(section.section);
    }

    // 3) Per-model section header — counter chip + container.
    const modelsHeader = el("div", "xkt-scs-models-header");
    modelsHeader.style.cssText = "padding: 12px 4px 4px; font-size: 11px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.3px; display: flex; gap: 8px; align-items: baseline;";
    const modelsLabel = el("span", undefined, {textContent: "Models"});
    this._modelsCountEl = el("span", undefined);
    this._modelsCountEl.style.cssText = "color: #888; font-weight: 500;";
    modelsHeader.append(modelsLabel, this._modelsCountEl);
    this._bodyEl.appendChild(modelsHeader);

    this._modelsListEl = el("div");
    this._bodyEl.appendChild(this._modelsListEl);

    // 4) Populate per-model sections from the current scene state.
    const models = this._listModels();
    if (models.length === 0) {
      const empty = el("div", "xkt-scs-empty", {
        textContent: "No models loaded.",
      });
      this._modelsListEl.appendChild(empty);
    } else {
      for (const m of models) this._addModelSection(m);
    }

    // 5) Initial renders.
    this._renderSceneCoordSys();
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
   * whether the Scene currently holds any SceneModels. Cheap; runs
   * alongside every stat refresh.
   */
  private _refreshStatusBadge(): void {
    if (!this._statusBadgeEl) return;
    const n = this._modelSections.size;
    if (n === 0) {
      this._statusBadgeEl.classList.add("xkt-scs-status-empty");
      this._statusBadgeEl.textContent = "Empty";
      this._statusBadgeEl.title = "No SceneModels loaded";
      return;
    }
    this._statusBadgeEl.classList.remove("xkt-scs-status-empty");
    const word = n === 1 ? "Model" : "Models";
    this._statusBadgeEl.textContent = `${n} ${word}`;
    const totals = this._aggregateStats();
    this._statusBadgeEl.title =
      `${n} ${word.toLowerCase()} loaded · ` +
      `${totals.numObjects.toLocaleString()} objects · ` +
      `${totals.numTriangles.toLocaleString()} triangles`;
  }

  private _renderSceneCoordSys(): void {
    if (!this._coordsBody) return;
    const cs = (this.scene as any).coordinateSystem;
    if (!cs) {
      this._coordsBody.innerHTML = `<div class="xkt-scs-empty">No coordinate system.</div>`;
      return;
    }
    this._coordsBody.innerHTML = renderCoordSysGrid(cs);
  }

  private _renderModelCoordSys(model: SceneModel): void {
    const id = String((model as any).id);
    const entry = this._modelSections.get(id);
    if (!entry || !entry.coordsBody) return;
    const cs = (model as any).coordinateSystem;
    if (!cs) {
      entry.coordsBody.innerHTML = `<div class="xkt-scs-empty">No coordinate system.</div>`;
      return;
    }
    entry.coordsBody.innerHTML = renderCoordSysGrid(cs);
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

  private _renderModelStats(model: SceneModel): void {
    const id = String((model as any).id);
    const entry = this._modelSections.get(id);
    if (!entry) return;
    const stats = (model as any).stats as SceneModelStats | null | undefined;
    if (!stats) {
      entry.statsBody.innerHTML = `<div class="xkt-scs-empty">No stats available.</div>`;
      return;
    }
    entry.statsBody.innerHTML = renderStatsGrid(stats);
  }


  // ── Per-model section management ──────────────────────────────

  private _addModelSection(model: SceneModel): void {
    const id = String((model as any).id);
    if (this._modelSections.has(id)) return;
    if (!this._modelsListEl.parentElement) return;     // not yet rendered

    // Drop the "No models loaded" placeholder if it's there.
    const empty = this._modelsListEl.querySelector(".xkt-scs-empty");
    if (empty) empty.remove();

    const section = el("details", "xkt-scs-section") as HTMLDetailsElement;
    section.setAttribute("data-kind", "model");

    const summary = el("summary");
    const label = el("span", "xkt-scs-section-label", {textContent: "SceneModel"});
    const idBadge = el("span", "xkt-scs-section-id", {textContent: id, title: "SceneModel id"});
    const jsonBtn = el("button", "xkt-scs-json-btn", {
      type: "button",
      textContent: "JSON",
      title: "Open serialized SceneModel in a new tab",
    }) as HTMLButtonElement;
    jsonBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      const result: any = (model as any).toParams?.();
      if (result && result.ok !== false) {
        openJsonInNewTab(result.value, `SceneModel ${id}`);
      }
    });
    summary.append(label, idBadge, jsonBtn);
    section.appendChild(summary);

    const body = el("div", "xkt-scs-section-body");

    // Per-model coord system (collapsed by default for the body —
    // the section itself is collapsed; users open it to dig in).
    let coordsBody: HTMLElement | null = null;
    if ((model as any).coordinateSystem) {
      const csRow = el("div", undefined);
      csRow.style.cssText = "margin-bottom: 10px;";
      const csLabel = el("div", undefined, {textContent: "Coordinate System"});
      csLabel.style.cssText = "font-size: 9.5px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px;";
      coordsBody = el("div");
      coordsBody.innerHTML = renderCoordSysGrid((model as any).coordinateSystem);
      csRow.append(csLabel, coordsBody);
      body.appendChild(csRow);
    }

    // Stats.
    const statsBody = el("div");
    body.appendChild(statsBody);

    section.appendChild(body);
    this._modelsListEl.appendChild(section);

    this._modelSections.set(id, {section, coordsBody, statsBody});

    // Paint immediately so the new section isn't blank until the
    // next debounced refresh.
    this._renderModelStats(model);
  }

  private _removeModelSection(model: SceneModel): void {
    const id = String((model as any).id);
    const entry = this._modelSections.get(id);
    if (!entry) return;
    entry.section.remove();
    this._modelSections.delete(id);
    if (this._modelSections.size === 0 && this._modelsListEl.parentElement) {
      const empty = el("div", "xkt-scs-empty", {textContent: "No models loaded."});
      this._modelsListEl.appendChild(empty);
    }
  }


  // ── Helpers ───────────────────────────────────────────────────

  private _listModels(): SceneModel[] {
    const map = (this.scene as any).models || {};
    return (Object.values(map) as SceneModel[])
      .filter(m => isDefaultLayerModel(m));
  }

  /**
   * Sum every per-model {@link SceneModelStats} into a single
   * Scene-wide {@link SceneModelStats}. Cheap — runs only on
   * paint, so frequency matches the debounced refresh.
   */
  private _aggregateStats(): SceneModelStats {
    const acc: SceneModelStats = {
      numTransforms: 0, numObjects: 0, numMeshes: 0, numGeometries: 0,
      numTextures: 0,   numMaterials: 0, numTriangles: 0, numLines: 0,
      numPoints: 0,     numVertices: 0,  textureBytes: 0,
    };
    for (const m of this._listModels()) {
      const s = (m as any).stats as SceneModelStats | null | undefined;
      if (!s) continue;
      acc.numTransforms += s.numTransforms || 0;
      acc.numObjects    += s.numObjects    || 0;
      acc.numMeshes     += s.numMeshes     || 0;
      acc.numGeometries += s.numGeometries || 0;
      acc.numTextures   += s.numTextures   || 0;
      acc.numMaterials  += s.numMaterials  || 0;
      acc.numTriangles  += s.numTriangles  || 0;
      acc.numLines      += s.numLines      || 0;
      acc.numPoints     += s.numPoints     || 0;
      acc.numVertices   += s.numVertices   || 0;
      acc.textureBytes  += s.textureBytes  || 0;
    }
    return acc;
  }

  private _buildSection(opts: {
    kind: "coords" | "totals" | "model";
    label: string;
    defaultOpen?: boolean;
  }): {section: HTMLDetailsElement; bodyEl: HTMLElement} {
    const section = el("details", "xkt-scs-section") as HTMLDetailsElement;
    section.setAttribute("data-kind", opts.kind);
    if (opts.defaultOpen !== false) section.open = true;
    const summary = el("summary");
    const label = el("span", "xkt-scs-section-label", {textContent: opts.label});
    summary.append(label);
    section.appendChild(summary);
    const bodyEl = el("div", "xkt-scs-section-body");
    section.appendChild(bodyEl);
    return {section, bodyEl};
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────


function renderStatsGrid(stats: SceneModelStats): string {
  const rows: Array<[string, number]> = [
    ["Objects",     stats.numObjects],
    ["Meshes",      stats.numMeshes],
    ["Geometries",  stats.numGeometries],
    ["Transforms",  stats.numTransforms],
    ["Materials",   stats.numMaterials],
    ["Textures",    stats.numTextures],
    ["Vertices",    stats.numVertices],
    ["Triangles",   stats.numTriangles],
    ["Lines",       stats.numLines],
    ["Points",      stats.numPoints],
  ];
  let html = `<div class="xkt-scs-stats">`;
  for (const [label, n] of rows) {
    html += `<div class="xkt-scs-stat">` +
      `<span class="xkt-scs-stat-label">${escapeHtml(label)}</span>` +
      `<span class="xkt-scs-stat-value${n === 0 ? " xkt-scs-zero" : ""}">${escapeHtml(formatNumber(n))}</span>` +
      `</div>`;
  }
  // Texture bytes — full row, formatted as bytes/KB/MB.
  html += `<div class="xkt-scs-stat" style="grid-column: 1 / -1;">` +
    `<span class="xkt-scs-stat-label">Texture Bytes</span>` +
    `<span class="xkt-scs-stat-value${stats.textureBytes === 0 ? " xkt-scs-zero" : ""}">${escapeHtml(formatBytes(stats.textureBytes))}</span>` +
    `</div>`;
  html += `</div>`;
  return html;
}

function renderCoordSysGrid(cs: any): string {
  const fmt = (v: any): string => {
    if (Array.isArray(v)) return v.map((n: number) => Number(n).toFixed(3)).join(", ");
    if (v === undefined || v === null) return "—";
    return String(v);
  };
  const rows: Array<[string, string]> = [
    ["Origin",        fmt(cs.origin)],
    ["Units",         fmt(cs.units)],
    ["Scale to m",    fmt(cs.scaleToMeters)],
    ["Basis",         fmt(cs.basis)],
    ["World Up",      fmt(cs.worldUp)],
    ["World Right",   fmt(cs.worldRight)],
    ["World Forward", fmt(cs.worldForward)],
  ];
  let html = `<div class="xkt-scs-coords">`;
  for (const [label, value] of rows) {
    html += `<span class="xkt-scs-coords-label">${escapeHtml(label)}</span>` +
            `<span class="xkt-scs-coords-value">${escapeHtml(value)}</span>`;
  }
  html += `</div>`;
  return html;
}

function formatNumber(v: any): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v ?? "—");
}

function formatBytes(bytes: any): string {
  const n = Number(bytes) || 0;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const dp = i === 0 ? 0 : i === 1 ? 1 : 2;
  return `${v.toFixed(dp)} ${units[i]}`;
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

/**
 * Open a JSON object in a new tab, syntax-highlighted. Mirrors the
 * helper used by ViewObjectContextMenu for SceneModel / DataObject
 * JSON downloads — kept inline here to avoid a fragile cross-module
 * dependency on a private helper.
 */
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
