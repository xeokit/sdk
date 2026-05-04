/**
 * Floating, draggable Explorer panel — hosts a unified
 * {@link ui/treeview!TreeView | TreeView} of every
 * `DataModel` in the helper's `Data` graph. The TreeView's
 * `_autoAddModels` flag means new DataModels show up in the
 * tree the instant they're loaded, and disappear when
 * destroyed; one panel per `Data` graph is enough.
 *
 * Same chrome and lifecycle as the rest of the panel set
 * (`SceneHealthPanel`, `SchemaMaterialsPanel`,
 * `ViewerConfigPanel`, …): per-Data WeakMap registry,
 * idempotent `getFor` / `openFor`, drag header, close + pill,
 * layout persistence, bring-to-front on pointer-down, scoped
 * `xkt-explorer-` CSS prefix.
 *
 * @module demo/explorerPanel
 */
import type {Data} from "../../data";
import type {View} from "../../viewer";
import {bringFloatingPanelToFront} from "../floatingPanelZ";
import {TreeView} from "../../ui/treeview/TreeView";


// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface ExplorerPanelParams {

  /**
   * Semantic Data graph to navigate. Doubles as the WeakMap
   * key for {@link ExplorerPanel.openFor} idempotence — one
   * Explorer per Data.
   */
  data: Data;

  /**
   * View whose `ViewObject`s the tree's checkboxes drive
   * (visibility / x-ray). The TreeView walks `view.viewer`
   * for object lookups.
   */
  view: View;

  /**
   * Aggregation relationship type to traverse when building
   * the tree. Defaults to a single type detected from the
   * Data's existing relationships — we count how many
   * relationships of each type the loaded models hold and
   * pick the most common, with a preference for the
   * well-known aggregation types when present
   * (`IfcRelAggregates` for IFC, `BasicAggregation` for
   * dotBIM).
   *
   * The TreeView is given a single string rather than a
   * multi-type array on purpose: when a model carries *both*
   * an aggregation and a containment relationship between
   * the same pair (e.g. an IFC `IfcRelAggregates` plus an
   * `IfcRelContainedInSpatialStructure` to the same target),
   * a multi-type traversal accumulates the child once per
   * matched type, producing duplicate nodes. One type at a
   * time avoids that.
   *
   * Pass an explicit value to override the auto-pick.
   */
  linkType?: string | string[];

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed
   * state. Defaults to `"xkt-explorer-panel"`.
   */
  storageKey?: string;

  /**
   * Auto-expand the tree to this depth on first render.
   * Defaults to `2` — enough to show the model + its top-level
   * spatial structure without overwhelming for big datasets.
   */
  autoExpandDepth?: number;

  /** Show on construction (default `true`). */
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard for the whole page.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-explorer-styles";
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
.xkt-explorer-panel {
  position: fixed;
  top: 88px;
  left: 17px;
  /* Auto-size to the widest tree row currently rendered, with
     a sensible floor so a freshly-opened (empty) panel still
     looks reasonable, and a ceiling so a model with very long
     IFC names can't push the panel off-screen. \`width: max-content\`
     re-measures every layout, so expanding a deep node grows
     the panel while collapsing shrinks it back. */
  width: max-content;
  min-width: 320px;
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
.xkt-explorer-panel *, .xkt-explorer-panel *::before, .xkt-explorer-panel *::after {
  box-sizing: border-box;
}
.xkt-explorer-panel[hidden] { display: none; }

.xkt-explorer-panel .xkt-explorer-header {
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
.xkt-explorer-panel .xkt-explorer-header.xkt-explorer-dragging { cursor: grabbing; }
.xkt-explorer-panel .xkt-explorer-title {
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
.xkt-explorer-panel .xkt-explorer-title-icon {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  color: #2d5e8c;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.xkt-explorer-panel .xkt-explorer-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-explorer-panel .xkt-explorer-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-explorer-panel .xkt-explorer-close {
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
.xkt-explorer-panel .xkt-explorer-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-explorer-pill {
  position: fixed;
  bottom: 17px;
  left: 17px;
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
.xkt-explorer-pill:hover { background: #1f4669; }
.xkt-explorer-pill[hidden] { display: none; }

.xkt-explorer-panel .xkt-explorer-body {
  flex: 1 1 auto;
  overflow: auto;
  padding: 6px 8px 10px;
}
.xkt-explorer-panel .xkt-explorer-empty {
  padding: 24px 12px;
  text-align: center;
  color: #777;
  font-size: 12px;
}
/* TreeView host — let the tree's own .xeokit-tree-view styles
   (injected by TreeView itself) drive most of the look; we only
   tweak spacing so it sits flush with the panel chrome. */
.xkt-explorer-panel .xkt-explorer-tree {
  font-size: 12px;
}
.xkt-explorer-panel .xkt-explorer-tree .xeokit-tree-view {
  padding: 0;
  margin: 0;
}
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

export class ExplorerPanel {

  private static readonly _instances = new WeakMap<Data, ExplorerPanel>();

  /**
   * SVG markup for the panel's title-bar glyph (folder + tree
   * branches — generic "explorer" icon). Strokes use
   * `currentColor`.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      // Folder body
      `<path d="M3 7 V19 A1.5 1.5 0 0 0 4.5 20.5 H19.5 A1.5 1.5 0 0 0 21 19 V9 A1.5 1.5 0 0 0 19.5 7.5 H11 L9 5.5 H4.5 A1.5 1.5 0 0 0 3 7 Z" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` +
      // Tree branches inside
      `<circle cx="8.5"  cy="14"   r="1.2" fill="currentColor"/>` +
      `<circle cx="14.5" cy="11.5" r="1.2" fill="currentColor"/>` +
      `<circle cx="14.5" cy="16.5" r="1.2" fill="currentColor"/>` +
      `<path d="M9.5 14 L13.5 11.5 M9.5 14 L13.5 16.5" ` +
            `fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>` +
    `</svg>`;
  }

  static getFor(data: Data): ExplorerPanel | undefined {
    const inst = ExplorerPanel._instances.get(data);
    return inst && !inst._destroyed ? inst : undefined;
  }

  static openFor(params: ExplorerPanelParams): ExplorerPanel {
    let inst = ExplorerPanel._instances.get(params.data);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new ExplorerPanel(params);
    return inst;
  }

  readonly data: Data;
  readonly view: View;
  private readonly _container: HTMLElement;
  private readonly _storageKey: string;
  /**
   * `null` when the caller didn't pass `linkType` and we should
   * auto-detect from the current Data on each rebuild — needed
   * because different models can use different aggregation
   * types (IFC → `IfcRelAggregates`, dotBIM →
   * `BasicAggregation`), and the set of present types only
   * stabilises once every model finishes loading. A non-null
   * value means the caller pinned the linkType explicitly and
   * we honour it verbatim.
   */
  private readonly _userLinkType: string | string[] | null;
  private _linkType: string | string[];
  private readonly _autoExpandDepth: number;

  // DOM refs.
  private _panel!: HTMLElement;
  private _pill!: HTMLElement;
  private _header!: HTMLElement;
  private _closeBtn!: HTMLButtonElement;
  private _bodyEl!: HTMLElement;
  private _treeHostEl!: HTMLElement;

  /**
   * The underlying TreeView. Lazily mounted on the first
   * {@link show}, since the TreeView walks the Data graph
   * once on construction — deferring keeps the cost off the
   * panel's constructor for hosts that mount with
   * `visible: false`.
   */
  private _tree: TreeView | null = null;

  // Live-sync handles. Subscribed in the constructor, cleared in
  // destroy. The rebuild scheduler waits for a quiet frame
  // (no new events for `_REBUILD_QUIET_MS`) before tearing down
  // and re-mounting the tree, so a bulk load that fires
  // thousands of object/relationship events across many frames
  // ends up with one rebuild after the load settles.
  private readonly _dataUnsubs: Array<() => void> = [];
  private _rebuildScheduled = false;
  private _lastRebuildEventTs = 0;
  private static readonly _REBUILD_QUIET_MS = 120;

  // Lifecycle state.
  private _destroyed = false;

  // Drag state.
  private _dragging = false;
  private _dragOffsetX = 0;
  private _dragOffsetY = 0;

  private readonly _onResize = (): void => {
    this._clampToViewport();
    this._saveLayout();
  };

  constructor(params: ExplorerPanelParams) {
    if (!params || !params.data) {
      throw new Error("ExplorerPanel: data is required");
    }
    if (!params.view) {
      throw new Error("ExplorerPanel: view is required");
    }
    this.data       = params.data;
    this.view       = params.view;
    this._container = params.container || document.body;
    this._storageKey = params.storageKey || "xkt-explorer-panel";
    this._userLinkType = params.linkType ?? null;
    this._linkType  = params.linkType ?? pickAggregationLinkTypes(params.data);
    this._autoExpandDepth = params.autoExpandDepth ?? 2;

    // Replace any prior instance bound to the same Data — the
    // panel keeps DOM and a TreeView, both of which leak across
    // a hot-reload otherwise.
    const prior = ExplorerPanel._instances.get(params.data);
    if (prior && !prior._destroyed) prior.destroy();
    ExplorerPanel._instances.set(params.data, this);

    injectStylesOnce();
    this._buildDom();
    this._wireDomEvents();
    this._restoreLayout();
    this._attachDataListeners();

    window.addEventListener("resize", this._onResize);

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
    this._panel.style.display = "flex";
    this._pill.hidden = true;
    this._clampToViewport();
    this._saveLayout();
    bringFloatingPanelToFront(this._panel);
    this._ensureTree();
  }

  hide(): void {
    if (this._destroyed) return;
    this._panel.style.display = "none";
    this._pill.hidden = false;
    this._saveLayout();
  }

  toggle(): void {
    if (this.visible) this.hide(); else this.show();
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._detachDataListeners();
    if (this._tree) {
      try { (this._tree as any).destroy?.(); } catch { /* ignore */ }
      this._tree = null;
    }
    if (ExplorerPanel._instances.get(this.data) === this) {
      ExplorerPanel._instances.delete(this.data);
    }
    window.removeEventListener("resize", this._onResize);
    this._panel.remove();
    this._pill.remove();
  }


  // ── Live sync — Data lifecycle listeners ──────────────────────

  /**
   * Subscribe to every Data lifecycle event that can change
   * what the tree should render — model, object, *and*
   * relationship create/destroy. The rAF coalescing in
   * {@link _scheduleRebuild} folds a bulk load (one DataModel +
   * thousands of DataObjects + thousands of Relationships in
   * the same tick) into a single rebuild on the next frame.
   *
   * Why object- and relationship-level subscriptions matter:
   * `DemoHelper.loadDataset` creates the DataModel first
   * (empty), then loaders populate DataObjects and
   * Relationships across many ticks. Subscribing only to
   * `onDataModelCreated` would rebuild the tree against an
   * empty model and miss everything that follows.
   */
  private _attachDataListeners(): void {
    const ev: any = (this.data as any).events;
    if (!ev) return;
    const sub = (emitter: any): void => {
      if (emitter?.subscribe) {
        this._dataUnsubs.push(emitter.subscribe(() => this._scheduleRebuild()));
      }
    };
    sub(ev.onDataModelCreated);
    sub(ev.onDataModelDestroyed);
    sub(ev.onDataObjectCreated);
    sub(ev.onDataObjectDestroyed);
    sub(ev.onRelationshipCreated);
    sub(ev.onRelationshipDestroyed);
  }

  private _detachDataListeners(): void {
    for (const u of this._dataUnsubs) {
      try { u(); } catch { /* ignore */ }
    }
    this._dataUnsubs.length = 0;
    this._rebuildScheduled = false;
  }

  /**
   * Coalesce bursts of create/destroy events into a single tree
   * rebuild after the burst settles. Each event bumps the
   * "last event" timestamp; the scheduled rAF callback only
   * fires the rebuild when at least
   * {@link _REBUILD_QUIET_MS} have elapsed since the last
   * event, otherwise it reschedules itself. This means a
   * dataset load that fires events across many frames produces
   * one rebuild at the end, not one rebuild per frame — but
   * sparse edits (a single object added later) still show up
   * within ~120ms.
   */
  private _scheduleRebuild(): void {
    if (this._destroyed) return;
    this._lastRebuildEventTs = (typeof performance !== "undefined")
      ? performance.now()
      : Date.now();
    if (this._rebuildScheduled) return;
    this._rebuildScheduled = true;
    const tick = (): void => {
      if (this._destroyed) {
        this._rebuildScheduled = false;
        return;
      }
      const now = (typeof performance !== "undefined")
        ? performance.now()
        : Date.now();
      const elapsed = now - this._lastRebuildEventTs;
      if (elapsed < ExplorerPanel._REBUILD_QUIET_MS) {
        // More events still arriving — wait another frame.
        requestAnimationFrame(tick);
        return;
      }
      this._rebuildScheduled = false;
      this._rebuildTree();
    };
    requestAnimationFrame(tick);
  }

  /**
   * Tear down the current TreeView (if any) and re-mount a
   * fresh one. Cheaper than reasoning about the TreeView's
   * internal `_addModel` / `_removeModel` API plus our own
   * dedupe-on-each-load tracking — and a single source of
   * truth: the rebuilt tree always matches the current Data.
   */
  private _rebuildTree(): void {
    if (this._destroyed) return;
    if (this._tree) {
      try { (this._tree as any).destroy?.(); } catch { /* ignore */ }
      this._tree = null;
    }
    this._treeHostEl.innerHTML = "";
    if (!this.visible) return;        // defer until show()
    this._ensureTree();
  }


  // ── TreeView host ─────────────────────────────────────────────

  /**
   * Lazily mount the TreeView on first show. The TreeView's
   * `_autoAddModels` flag means we don't need to listen for
   * `Data.events.onDataModelCreated` ourselves — newly-loaded
   * DataModels appear in the tree automatically.
   */
  private _ensureTree(): void {
    if (this._tree || this._destroyed) return;
    try {
      // Recompute the linkType from the Data graph as it stands
      // *now*. Different models use different aggregation types
      // (IFC → `IfcRelAggregates`, dotBIM →
      // `BasicAggregation`), so a linkType picked at panel-open
      // time won't match a model loaded later. If the caller
      // passed an explicit `linkType`, we honour it verbatim
      // and skip the auto-pick.
      if (this._userLinkType === null) {
        const next = pickAggregationLinkTypes(this.data);
        const prev = Array.isArray(this._linkType)
          ? this._linkType.join(",")
          : String(this._linkType);
        const cur = next.join(",");
        if (prev !== cur) {
          console.info(`[ExplorerPanel] linkType -> [${cur}]`);
        }
        this._linkType = next;
      }
      // Some loaders (e.g. the IFC parser as of writing) emit
      // duplicate aggregation relationships for the same
      // parent→child pair, which the TreeView accumulates into
      // duplicate sibling nodes — every storey rendered twice
      // and so on. Defensively dedupe the relevant link-type's
      // `related[]` and `relating[]` arrays on every loaded
      // DataObject so the tree comes up clean even when the
      // upstream data is messy.
      const linkTypesArr = Array.isArray(this._linkType)
        ? this._linkType
        : [this._linkType];
      const dropped = dedupeAggregationRelationships(this.data, linkTypesArr);
      if (dropped > 0) {
        console.warn(`[ExplorerPanel] Dropped ${dropped} duplicate aggregation relationship${dropped === 1 ? "" : "s"} (linkType=${linkTypesArr.join(", ")}) before building the tree.`);
      }

      this._tree = new TreeView({
        data:             this.data,
        view:             this.view,
        containerElement: this._treeHostEl,
        linkType:         this._linkType,
        groupTypes:       [],
        hierarchy:        TreeView.AggregationHierarchy,
        autoExpandDepth:  this._autoExpandDepth,
      } as any);
    } catch (e: any) {
      console.warn("[ExplorerPanel] Failed to mount TreeView:", e?.message ?? e);
      this._treeHostEl.innerHTML = "";
      const empty = document.createElement("div");
      empty.className = "xkt-explorer-empty";
      empty.textContent = `Couldn't build tree: ${e?.message ?? e}`;
      this._treeHostEl.appendChild(empty);
    }
  }


  // ── DOM construction ──────────────────────────────────────────

  private _buildDom(): void {
    this._pill = el("button", "xkt-explorer-pill", {
      type: "button",
      title: "Reopen the Explorer panel",
      hidden: true,
      textContent: "Explorer",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-explorer-panel");

    // Header.
    this._header = el("div", "xkt-explorer-header");
    const title = el("h2", "xkt-explorer-title");
    title.innerHTML =
      `<span class="xkt-explorer-title-icon">${ExplorerPanel.iconSvg()}</span>` +
      `<span class="xkt-explorer-title-text">Explorer</span>`;

    this._closeBtn = el("button", "xkt-explorer-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;

    this._header.append(title, this._closeBtn);
    this._panel.appendChild(this._header);

    // Body — scrollable region hosting the TreeView's container.
    this._bodyEl = el("div", "xkt-explorer-body");
    this._treeHostEl = el("div", "xkt-explorer-tree");
    this._bodyEl.appendChild(this._treeHostEl);
    this._panel.appendChild(this._bodyEl);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }

  private _wireDomEvents(): void {
    this._panel.addEventListener("pointerdown", () => {
      bringFloatingPanelToFront(this._panel);
    });

    this._closeBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this.hide();
    });
    this._pill.addEventListener("click", () => this.show());

    // Drag on the header. Clicks on buttons inside the header
    // (only the close button today) are exempted via the
    // `closest("button")` check.
    this._header.addEventListener("pointerdown", (ev) => {
      if ((ev.target as Element).closest("button")) return;
      if (ev.button !== 0) return;
      const rect = this._panel.getBoundingClientRect();
      this._dragOffsetX = ev.clientX - rect.left;
      this._dragOffsetY = ev.clientY - rect.top;
      this._panel.style.right = "auto";
      this._panel.style.left  = rect.left + "px";
      this._panel.style.top   = rect.top  + "px";
      this._dragging = true;
      this._header.classList.add("xkt-explorer-dragging");
      this._header.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });
    this._header.addEventListener("pointermove", (ev) => {
      if (!this._dragging) return;
      const rect = this._panel.getBoundingClientRect();
      let l = ev.clientX - this._dragOffsetX;
      let t = ev.clientY - this._dragOffsetY;
      l = Math.max(0, Math.min(l, window.innerWidth  - rect.width));
      t = Math.max(0, Math.min(t, window.innerHeight - rect.height));
      this._panel.style.left = l + "px";
      this._panel.style.top  = t + "px";
    });
    const endDrag = (ev: PointerEvent): void => {
      if (!this._dragging) return;
      this._dragging = false;
      this._header.classList.remove("xkt-explorer-dragging");
      try { this._header.releasePointerCapture(ev.pointerId); } catch { /* ignore */ }
      this._saveLayout();
    };
    this._header.addEventListener("pointerup",     endDrag);
    this._header.addEventListener("pointercancel", endDrag);
  }


  // ── Layout persistence ────────────────────────────────────────

  private _restoreLayout(): void {
    let saved: {top?: number; left?: number; hidden?: boolean} | null = null;
    try {
      const raw = window.localStorage.getItem(this._storageKey);
      if (raw) saved = JSON.parse(raw);
    } catch { saved = null; }
    if (!saved) return;
    if (Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      this._panel.style.right = "auto";
      this._panel.style.left  = saved.left + "px";
      this._panel.style.top   = saved.top  + "px";
      this._clampToViewport();
    }
    if (saved.hidden) {
      this._panel.style.display = "none";
      this._pill.hidden = false;
    }
  }

  private _saveLayout(): void {
    const state: {top?: number; left?: number; hidden: boolean} = {
      hidden: this._panel.style.display === "none",
    };
    const l = parseFloat(this._panel.style.left);
    const t = parseFloat(this._panel.style.top);
    if (Number.isFinite(l)) state.left = l;
    if (Number.isFinite(t)) state.top  = t;
    try { window.localStorage.setItem(this._storageKey, JSON.stringify(state)); }
    catch { /* quota / disabled — drop silently */ }
  }

  private _clampToViewport(): void {
    const l = parseFloat(this._panel.style.left);
    const t = parseFloat(this._panel.style.top);
    if (!Number.isFinite(l) || !Number.isFinite(t)) return;
    const rect = this._panel.getBoundingClientRect();
    const maxL = Math.max(0, window.innerWidth  - rect.width);
    const maxT = Math.max(0, window.innerHeight - rect.height);
    this._panel.style.left = Math.max(0, Math.min(l, maxL)) + "px";
    this._panel.style.top  = Math.max(0, Math.min(t, maxT)) + "px";
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Walk every loaded DataObject and remove duplicate entries
 * from its `related[lt]` and `relating[lt]` arrays for the
 * given aggregation link type(s). A duplicate is two
 * relationships of the same type pointing at the same
 * counterpart object id — the TreeView treats each entry as
 * a separate child / parent and renders duplicate sibling
 * nodes when the upstream data carries them.
 *
 * Mutates the `related` / `relating` arrays in place. Does
 * not touch each `DataModel.relationships`, since the rest
 * of the SDK reads those arrays by index in places we don't
 * want to disturb. The TreeView only reads from
 * `DataObject.related` / `relating`, so deduping there is
 * sufficient for clean rendering.
 *
 * Returns the number of duplicate references dropped (used
 * for a one-line console warning so the user can spot bad
 * upstream data).
 */
function dedupeAggregationRelationships(data: Data, linkTypes: string[]): number {
  const objects: Record<string, any> = (data as any).objects || {};
  let dropped = 0;
  for (const objectId of Object.keys(objects)) {
    const obj = objects[objectId];
    if (!obj) continue;
    for (const lt of linkTypes) {
      dropped += dedupeRelationshipArray(obj.related,  lt, "relatedObject");
      dropped += dedupeRelationshipArray(obj.relating, lt, "relatingObject");
    }
  }
  return dropped;
}

function dedupeRelationshipArray(
  bag: Record<string, any[]> | undefined,
  linkType: string,
  counterpartKey: "relatedObject" | "relatingObject",
): number {
  if (!bag) return 0;
  const arr = bag[linkType];
  if (!Array.isArray(arr) || arr.length < 2) return 0;
  const seen = new Set<string>();
  const out: any[] = [];
  for (const rel of arr) {
    const counterpart = rel && rel[counterpartKey];
    if (!counterpart) continue;
    const key = String(counterpart.id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rel);
  }
  const dropped = arr.length - out.length;
  if (dropped > 0) bag[linkType] = out;
  return dropped;
}

/**
 * Pick the set of aggregation relationship types to feed into
 * the TreeView. Each loaded `DataModel` contributes its own
 * primary aggregation type — picked per-model so a mixed
 * scene (IFC + dotBIM + a custom demo model that uses a
 * numeric type) gets every model's hierarchy walked rather
 * than just whichever happens to win a global frequency tally.
 *
 * Per model:
 *   - if any of the well-known aggregation types
 *     (`IfcRelAggregates`, `BasicAggregation`) is present in
 *     the model's relationships, use the first matching one;
 *   - otherwise, use the model's most-frequent relationship
 *     type as a best-effort fallback (covers the demo's
 *     numeric `BasicAggregationType = 1001` and similar).
 *
 * The returned array is the de-duplicated union of all
 * per-model picks, in first-seen order. Returns
 * `["IfcRelAggregates"]` as a last-resort default when no
 * relationships exist yet.
 */
function pickAggregationLinkTypes(data: Data): string[] {
  const PREFERRED = ["IfcRelAggregates", "BasicAggregation"];
  const seen = new Set<string>();
  const result: string[] = [];
  const add = (t: string): void => {
    if (!t || seen.has(t)) return;
    seen.add(t);
    result.push(t);
  };

  const models: Record<string, any> = (data as any).models || {};
  for (const id of Object.keys(models)) {
    const m = models[id];
    const rels = m && m.relationships;
    if (!Array.isArray(rels) || rels.length === 0) continue;

    const counts: Record<string, number> = {};
    for (const rel of rels) {
      const t: any = rel?.type;
      if (t == null) continue;
      const k = String(t);
      counts[k] = (counts[k] || 0) + 1;
    }

    let pick: string | null = null;
    for (const p of PREFERRED) {
      if (counts[p]) { pick = p; break; }
    }
    if (!pick) {
      let best: string | null = null;
      let bestCount = 0;
      for (const k of Object.keys(counts)) {
        if (counts[k] > bestCount) { best = k; bestCount = counts[k]; }
      }
      pick = best;
    }
    if (pick) add(pick);
  }

  if (result.length === 0) return ["IfcRelAggregates"];
  return result;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  props?: Record<string, unknown>,
): HTMLElementTagNameMap[K];
function el(tag: string, className?: string, props?: Record<string, unknown>): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (props) {
    for (const k of Object.keys(props)) {
      const v = props[k];
      if (v === undefined) continue;
      if (k === "textContent" || k === "innerHTML") {
        (node as any)[k] = v;
      } else if (k === "hidden") {
        (node as HTMLElement).hidden = !!v;
      } else if (k in node) {
        (node as any)[k] = v;
      } else {
        node.setAttribute(k, String(v));
      }
    }
  }
  return node;
}
