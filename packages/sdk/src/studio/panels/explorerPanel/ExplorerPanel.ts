/**
 * Floating, draggable Explorer panel — hosts a unified
 * {@link ui!treeview.TreeView | TreeView} of every
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
import type {Data} from "../../../model/data";
import type {View, ViewObject} from "../../../viewing/viewer";
import type {CameraFlightAnimation} from "../../../viewing/cameraFlight";
import type {TreeViewNode} from "../../../ui/treeview/TreeViewNode";
import {TreeView} from "../../../ui/treeview/TreeView";
import {getSceneCollisionIndex} from "../../../spatial/collision";


import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";
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
   * Optional camera-flight animator. Wired to the per-row
   * **Frame** button — clicking it jumps the camera to the
   * union AABB of the matching `ViewObject`s. When omitted, the
   * Frame button still fires its event (hosts can subscribe
   * directly via {@link TreeViewEvents.onNodeFrameClicked}) but
   * the panel no-ops on its own.
   */
  cameraFlight?: CameraFlightAnimation;

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
  align-self: flex-start;
  margin-top: 2px;
  width: 24px;
  height: 24px;
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
.xkt-explorer-panel .xkt-explorer-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-explorer-panel .xkt-explorer-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
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

export class ExplorerPanel extends FloatingPanelBase {

  private static readonly _instances = new WeakMap<Data, ExplorerPanel>();

  /**
   * SVG markup for the panel's title-bar glyph — a hierarchy /
   * node-tree (root box on top, three children below joined by
   * a T-junction). Same idiom as the toolbar's Explorer button so
   * the two stay visually paired. Strokes use `currentColor`.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="9"  y="3"  width="6" height="4" rx="1" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<rect x="3"  y="16" width="6" height="4" rx="1" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<rect x="9"  y="16" width="6" height="4" rx="1" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<rect x="15" y="16" width="6" height="4" rx="1" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<path d="M12 7 L12 12 M6 16 L6 12 L18 12 L18 16" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
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
  readonly cameraFlight: CameraFlightAnimation | undefined;
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

  // Drag state.

  constructor(params: ExplorerPanelParams) {
    if (!params || !params.data) {
      throw new Error("ExplorerPanel: data is required");
    }
    if (!params.view) {
      throw new Error("ExplorerPanel: view is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-explorer-panel",
      classPrefix: "xkt-explorer",
    });
    this.data       = params.data;
    this.view       = params.view;
    this.cameraFlight = params.cameraFlight;
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
    this._bindChrome();
    this._wireDomEvents();
    this._attachDataListeners();


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
    this._ensureTree();
  }

  hide(): void {
    if (this._destroyed) return;
    super.hide();
  }

  toggle(): void {
    if (this.visible) this.hide(); else this.show();
  }

  destroy(): void {
    if (this._destroyed) return;
    this._detachDataListeners();
    if (this._tree) {
      try { (this._tree as any).destroy?.(); } catch { /* ignore */ }
      this._tree = null;
    }
    if (ExplorerPanel._instances.get(this.data) === this) {
      ExplorerPanel._instances.delete(this.data);
    }
    super.destroy();
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
   * `Studio.loadDataset` creates the DataModel first
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

      // Per-row Select / Frame buttons — wire the events
      // dispatched by the TreeView to local handlers that walk
      // the node's subtree and act on the matching ViewObjects.
      this._tree.events.onNodeSelectClicked.subscribe((_t, ev) => {
        this._toggleSelectionForNode(ev.treeViewNode);
      });
      this._tree.events.onNodeFrameClicked.subscribe((_t, ev) => {
        this._frameNode(ev.treeViewNode);
      });
    } catch (e: any) {
      console.warn("[ExplorerPanel] Failed to mount TreeView:", e?.message ?? e);
      this._treeHostEl.innerHTML = "";
      const empty = document.createElement("div");
      empty.className = "xkt-explorer-empty";
      empty.textContent = `Couldn't build tree: ${e?.message ?? e}`;
      this._treeHostEl.appendChild(empty);
    }
  }


  // ── Per-row actions (Select / Frame) ─────────────────────────

  /**
   * Toggle selection for every {@link viewing!viewer.ViewObject | ViewObject} under
   * `node`. If *any* matching view-object is currently
   * unselected, the action selects them all; otherwise it
   * deselects. Walks `node.childNodes` recursively so a
   * non-leaf row acts on its whole subtree.
   */
  private _toggleSelectionForNode(node: TreeViewNode): void {
    const objs = this._collectViewObjectsUnderNode(node);
    if (objs.length === 0) return;
    const allSelected = objs.every((o) => o.selected);
    const next = !allSelected;
    for (const o of objs) o.selected = next;
  }

  /**
   * Jump the camera to the union AABB of every
   * {@link viewing!viewer.ViewObject | ViewObject} under `node`. No-op if the panel has
   * no `cameraFlight` reference, or if no matching view-object
   * is registered with the SceneCollisionIndex.
   *
   * Resolves the AABB via the scene's
   * {@link "../../../collision".SceneCollisionIndex.getCombinedObjectAABB | SceneCollisionIndex},
   * the same source the picker / measurement / model-frame
   * actions read from, so the camera lands where every other
   * "frame to X" affordance lands. The legacy
   * `ViewObject.aabb`-based path is kept as a fallback for
   * cases where the index hasn't been built yet.
   */
  private _frameNode(node: TreeViewNode): void {
    if (!this.cameraFlight) return;
    const objs = this._collectViewObjectsUnderNode(node);
    if (objs.length === 0) return;

    let aabb: ArrayLike<number> | null = null;
    const scene: any = (this.view as any)?.viewer?.scene;
    if (scene) {
      try {
        const idx: any = getSceneCollisionIndex(scene);
        if (idx?.getCombinedObjectAABB) {
          const ids = objs
            .map((o) => (o as any).sceneObject?.id)
            .filter((id): id is string => typeof id === "string");
          if (ids.length > 0) {
            aabb = idx.getCombinedObjectAABB(ids);
          }
        }
      } catch (e) {
        console.warn("[ExplorerPanel] SceneCollisionIndex lookup failed; falling back to ViewObject AABBs:", e);
      }
    }
    if (!aabb) aabb = unionAABB(objs);
    if (!aabb) return;

    // Cinematic AABB-fit flight — matches the canvas / view-object
    // context-menu "Frame …" actions: parabolic arc along the camera's
    // look→eye axis, slow → fast → slow speed profile.
    this.cameraFlight.flyTo({
      aabb,
      fitFOV:   45,
      duration: 0.7,
      arc:      true,
      easing:   "inThenOut",
    } as any);
  }

  /**
   * Walk `node` (and every descendant via `childNodes`) and
   * collect each `ViewObject` whose id matches a node's
   * `objectId`. Nodes without a matching ViewObject — typical
   * of "type" rollup nodes that have no scene representation —
   * are skipped.
   */
  private _collectViewObjectsUnderNode(node: TreeViewNode): ViewObject[] {
    const out: ViewObject[] = [];
    const walk = (n: TreeViewNode): void => {
      const obj = (this.view as any).objects[n.objectId];
      if (obj) out.push(obj as ViewObject);
      for (const child of n.childNodes) walk(child);
    };
    walk(node);
    return out;
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
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
      `<span class="xkt-explorer-title-stack">` +
        `<span class="xkt-explorer-title-text">Explorer</span>` +
        `<span class="xkt-explorer-subtitle">Tree view of data objects.</span>` +
      `</span>`;

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

  private _wireDomEvents(): void {  }


  // ── Layout persistence ────────────────────────────────────────

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

/**
 * Return the union of every `ViewObject.aabb` whose first
 * component is finite (the SDK convention for "no AABB
 * computed yet"). `null` when no object contributes.
 */
function unionAABB(objs: ReadonlyArray<ViewObject>): Float64Array | null {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let hit = false;
  for (const o of objs) {
    const a = (o as any).aabb as ArrayLike<number> | undefined;
    if (!a || a.length < 6 || !Number.isFinite(a[0])) continue;
    if (a[0] < minX) minX = a[0];
    if (a[1] < minY) minY = a[1];
    if (a[2] < minZ) minZ = a[2];
    if (a[3] > maxX) maxX = a[3];
    if (a[4] > maxY) maxY = a[4];
    if (a[5] > maxZ) maxZ = a[5];
    hit = true;
  }
  if (!hit) return null;
  return new Float64Array([minX, minY, minZ, maxX, maxY, maxZ]);
}

