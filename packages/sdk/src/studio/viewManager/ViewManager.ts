import type {PickParams, PickResult, View, Viewer, ViewParams} from "../../viewing/viewer";
import type {SDKResult} from "../../base/core";
import type {AABB3Float} from "../../base/math/boundaries";
import {CameraFlightAnimation} from "../../viewing/cameraFlight";
import {ViewController} from "../../viewing/viewController";
import {RealisticRender} from "../../base/constants";
import {createUUID} from "../../base/utils";

import {
  ViewPanel,
  UNPIN_ICON_SVG,
  MINIMIZE_ICON_SVG,
  CLOSE_ICON_SVG,
  ensureViewPanelStylesInjected,
  type ViewPanelParams,
} from "../panels/viewPanel";
import {confirmDialog} from "../dialogs/ConfirmDialog";
import type {StudioCreateViewParams} from "../StudioCreateViewParams";

/**
 * One record per live View. Every consumer reads `cameraFlight`
 * and/or `viewController` off it.
 */
export interface ViewRecord {
  view: View;
  cameraFlight: CameraFlightAnimation;
  viewController: ViewController;
}

/**
 * Inputs the {@link ViewManager} needs to construct Views and wire
 * their {@link ViewController}s.
 */
export interface ViewManagerContext {
  viewer: Viewer;

  /**
   * Picking function handed to every {@link ViewController}. Routed
   * through whichever pick strategy Studio owns — kept as a
   * caller-supplied callback so the manager doesn't have to depend
   * on `PickStrategy` directly.
   */
  pickFn: (view: View, pickParams: PickParams) => SDKResult<PickResult>;
}

/**
 * Per-event hooks the manager fires while it owns view lifecycle.
 * Studio uses these to layer on the context-menu setup and HDR-sky
 * setup for each View.
 */
export interface ViewManagerHooks {
  /**
   * Fired immediately after a View, its CameraFlight, and its
   * ViewController have all been constructed and recorded.
   * Studio attaches the context-menu listener and IBL here.
   */
  onViewCreated?(view: View, record: ViewRecord): void;

  /**
   * Fired just before a View is destroyed and removed from the
   * `views` map. The View is still usable at this point.
   */
  onViewDestroyed?(viewId: string): void;
}

export type AutoViewElementType = "image" | "canvas";

type AutoViewElement = HTMLImageElement | HTMLCanvasElement;

export interface ViewManagerOptions {
  maxViews?: number;
  autoElementType?: AutoViewElementType;
}

/**
 * Owns the lifecycle and DOM hosting of every View created through
 * Studio: the `views` registry, the auto-layout container for tiled
 * renderer surfaces, and the per-view {@link ViewPanel} hosting when
 * callers pass `floating: true`.
 *
 * The pre-extraction `createView` ran ~70 lines on Studio and pulled
 * in context-menu setup, HDR setup, CameraFlight construction,
 * ViewController construction, and DOM hosting all at once. Splitting
 * those concerns: the manager handles DOM + records + lifecycle,
 * Studio handles the rest via {@link ViewManagerHooks.onViewCreated}.
 */
export class ViewManager {

  /**
   * Live View records keyed by view id. Replaces `studio.views`.
   * Every existing consumer (Toolbar, panels) reads
   * `viewManager.views[id].cameraFlight` / `.viewController`.
   */
  public readonly views: { [viewId: string]: ViewRecord } = {};

  /**
   * Cap on the number of Views the manager will create. Drives the
   * WebGL renderer's memory configuration in Studio, and is enforced
   * here as well.
   */
  public readonly maxViews: number;

  private _viewLayoutContainer: HTMLDivElement | null = null;
  private _autoCanvasByViewId: { [viewId: string]: AutoViewElement } = {};
  private _floatingPanelByViewId: { [viewId: string]: ViewPanel } = {};
  private readonly _autoElementType: AutoViewElementType;

  /**
   * Whether each auto-created View is currently pinned into the
   * flow-layout grid (`true`) or floating in its own panel (`false`).
   * Used by {@link pinView} / {@link unpinView} to short-circuit
   * idempotent toggles.
   */
  private _isPinnedByViewId: { [viewId: string]: boolean } = {};

  /**
   * Caches the panel params used to first float a View, so a subsequent
   * unpin can restore the same title / storage key / dimensions.
   */
  private _panelParamsByViewId: { [viewId: string]: ViewPanelParams } = {};

  /**
   * Lazily-built fixed-position drop-zone strip shown across the
   * top of the viewport while the user is dragging a floating
   * ViewPanel into dock range. Contains a vertical marker
   * positioned at the pointer's horizontal position so the user
   * can see exactly which slot the dock will land in. Hidden by
   * default; revealed via {@link _showDockPreview}.
   */
  private _dockPreviewEl: HTMLDivElement | null = null;
  private _dockPreviewMarker: HTMLDivElement | null = null;

  /**
   * Distance in CSS pixels from the viewport top within which a
   * drag is considered "near the top edge" — entering this zone
   * arms the drag-to-dock gesture; leaving it disarms it.
   */
  private static readonly DOCK_ZONE_PX = 60;

  constructor(
    private readonly ctx: ViewManagerContext,
    private readonly hooks: ViewManagerHooks = {},
    options: ViewManagerOptions = {},
  ) {
    this.maxViews = options.maxViews ?? 4;
    this._autoElementType = options.autoElementType ?? "image";
  }

  /**
   * Create a new View on the underlying Viewer.
   *
   * When `viewParams.elementId` and `viewParams.htmlElement` are
   * omitted, the manager auto-creates a renderer surface element and either:
   *  - lays it out snugly with other auto-created surfaces inside the
   *    window (the default), or
   *  - wraps it in a floating {@link ViewPanel} when
   *    {@link StudioCreateViewParams.floating} is set.
   *
   * After the View is created, fires {@link ViewManagerHooks.onViewCreated}
   * so Studio can layer on context menus, IBL, etc.
   */
  createView(viewParams: StudioCreateViewParams = {}): View {

    const floatingOpt = viewParams.floating;
    const wantsFloating = floatingOpt === true || (typeof floatingOpt === "object" && floatingOpt !== null);

    // `floating` is the demo's own option — strip it off before forwarding
    // to viewer.createView so the SDK doesn't see an unknown field.
    const {floating: _drop, ...sdkViewParams} = viewParams;

    const resolvedViewParams: ViewParams = {
      id: sdkViewParams.id || createUUID(),
      backgroundColor: [0, 0, 0],
      transparent: false,
      // RealisticRender by default (HDR pipeline + ACES tonemap +
      // sRGB encode all live from the first frame). Overridden
      // when the caller passes their own `renderMode`.
      renderMode: RealisticRender,
      ...sdkViewParams,
    };

    const hasExplicitElement = !!(resolvedViewParams.elementId || resolvedViewParams.htmlElement);

    let autoCreatedCanvas: AutoViewElement | null = null;
    let floatingPanel: ViewPanel | null = null;
    let viewId = resolvedViewParams.id;

    if (!hasExplicitElement) {
      autoCreatedCanvas = this._autoElementType === "canvas"
        ? document.createElement("canvas")
        : document.createElement("img");
      autoCreatedCanvas.id = viewId ? `${viewId}-canvas` : `demohelper-canvas-${this.ctx.viewer.numViews}`;
      autoCreatedCanvas.style.display = "block";
      autoCreatedCanvas.style.width = "100%";
      autoCreatedCanvas.style.height = "100%";
      autoCreatedCanvas.style.minWidth = "0";
      autoCreatedCanvas.style.minHeight = "0";
      autoCreatedCanvas.style.margin = "0";
      autoCreatedCanvas.style.padding = "0";
      autoCreatedCanvas.style.outline = "none";
      autoCreatedCanvas.style.boxSizing = "border-box";
      autoCreatedCanvas.style.background = "black";
      autoCreatedCanvas.style.position = "relative";
      autoCreatedCanvas.style.pointerEvents = "auto";
      autoCreatedCanvas.style.userSelect = "none";
      autoCreatedCanvas.draggable = false;

      if (wantsFloating) {
        const baseParams: ViewPanelParams = {
          title:      `View — ${viewId}`,
          storageKey: `xkt-vp-panel-${viewId}`,
          ...(typeof floatingOpt === "object" && floatingOpt !== null ? floatingOpt : {}),
        };
        // Stash the caller's panel preferences so a later pin/unpin
        // round-trip can re-instantiate the panel with the same title,
        // storage key, and starting geometry. `onPin` / `onDestroy`
        // are wired in below once `view.id` is known.
        this._panelParamsByViewId[viewId!] = baseParams;

        const panelParams: ViewPanelParams = {
          ...baseParams,
          onPin:     () => this.pinView(viewId!),
          onDestroy: () => this._destroyViewById(viewId!),
        };

        floatingPanel = new ViewPanel(panelParams);
        floatingPanel.body.appendChild(autoCreatedCanvas);
      } else {
        this._ensureViewLayoutContainer();
        const wrapper = this._makePinnedCellWrapper(viewId!, autoCreatedCanvas);
        this._viewLayoutContainer!.appendChild(wrapper);
      }

      // @ts-ignore
      resolvedViewParams.htmlElement = autoCreatedCanvas;
      delete (resolvedViewParams as any).elementId;
    }

    const result = this.ctx.viewer.createView(resolvedViewParams);

    if (result.ok === false) {
      if (autoCreatedCanvas?.parentElement) {
        autoCreatedCanvas.parentElement.removeChild(autoCreatedCanvas);
      }
      if (floatingPanel) {
        floatingPanel.destroy();
      }
      throw new Error(result.error);
    }

    const view = result.value;

    if (autoCreatedCanvas) {
      autoCreatedCanvas.setAttribute("data-view-id", view.id);
      autoCreatedCanvas.id = `${view.id}-canvas`;
      this._autoCanvasByViewId[view.id] = autoCreatedCanvas;
      if (floatingPanel) {
        this._floatingPanelByViewId[view.id] = floatingPanel;
        this._isPinnedByViewId[view.id] = false;
        floatingPanel.setTitle(`View — ${view.id}`);
        // Panel drag changes the panel's CSS left/top but no
        // descendant resizes, so the renderer's ResizeObserver
        // on the View's element never fires. Forward the panel's
        // own onLayoutChanged to view.needsRender() so the shared
        // WebGL canvas re-aligns on every drag pointermove and
        // viewport clamp.
        floatingPanel.onLayoutChanged.subscribe(() => view.needsRender());
        // Drag-to-dock: watches header drags and pins the View
        // into the grid when the user releases near the top.
        this._wireDragToDock(view.id, floatingPanel);
      } else {
        this._isPinnedByViewId[view.id] = true;
        this._updateAutoCanvasLayout();
      }
    }

    const cameraFlight = new CameraFlightAnimation(view);
    const record: ViewRecord = {
      view,
      cameraFlight,
      viewController: new ViewController(view, {
        pick: (v, pickParams) => this.ctx.pickFn(v, pickParams),
      }),
    };
    this.views[view.id] = record;

    this.hooks.onViewCreated?.(view, record);

    return view;
  }

  /**
   * Fit the camera of `view` to the supplied AABB. The caller (Studio)
   * sources the AABB from its `SceneCollisionIndex`; the manager
   * doesn't depend on collision-index internals.
   */
  fitToAabb(view: View, aabb: AABB3Float): void {
    const record = this.views[view.id];
    if (!record) {
      throw new Error(`[ViewManager.fitToAabb] View with ID ${view.id} not found`);
    }
    record.cameraFlight.jumpTo({aabb, fitFOV: 45});
  }

  /**
   * Resolve a viewId back to its current View record and route to
   * {@link destroyView}. Wired into {@link ViewPanelParams.onDestroy}
   * so the panel's destroy button can tear the underlying View
   * down without the panel constructor needing a live View
   * reference at build time.
   *
   * Returns silently when the record has already been removed —
   * destroy is idempotent at this layer.
   */
  private _destroyViewById(viewId: string): void {
    const record = this.views[viewId];
    if (!record) return;
    this.destroyView(record.view);
  }

  /** Destroy a View created via {@link createView}; removes its renderer surface if auto-created. */
  destroyView(view: View): void {
    const viewId = view.id;

    this.hooks.onViewDestroyed?.(viewId);

    if (this._floatingPanelByViewId[viewId]) {
      // The panel owns the canvas DOM — destroying the panel removes
      // both the canvas and the panel chrome.
      this._floatingPanelByViewId[viewId].destroy();
      delete this._floatingPanelByViewId[viewId];
      delete this._autoCanvasByViewId[viewId];
    } else if (this._autoCanvasByViewId[viewId]) {
      const canvas = this._autoCanvasByViewId[viewId];
      // Pinned canvases live inside an `xkt-view-cell` wrapper that
      // also hosts the header strip — strip the whole cell, not
      // just the canvas, or the orphan wrapper keeps occupying a
      // grid track. The canvas is nested an extra div deep
      // (`canvasBox`) so we walk up via `closest`.
      const cell = canvas.closest(".xkt-view-cell");
      if (cell && cell.parentElement) {
        cell.parentElement.removeChild(cell);
      } else if (canvas.parentElement) {
        canvas.parentElement.removeChild(canvas);
      }
      delete this._autoCanvasByViewId[viewId];
      this._updateAutoCanvasLayout();
    }
    delete this._isPinnedByViewId[viewId];
    delete this._panelParamsByViewId[viewId];
    view.destroy();
    delete this.views[viewId];
  }

  /**
   * Move an auto-created View from its floating panel back into the
   * tiled flow-layout grid behind the other floating panels — the
   * shape a View takes when created with the default `floating: false`.
   *
   * No-op if the View was created with an explicit `elementId` /
   * `htmlElement` (the manager owns no DOM for it) or is already
   * pinned. Idempotent.
   *
   * Implementation notes: the canvas DOM node is reparented into a
   * fresh `xkt-view-cell` wrapper that also hosts the undock button.
   * The original floating panel is destroyed (its chrome is gone),
   * but its construction params live on in {@link _panelParamsByViewId}
   * so a follow-up {@link unpinView} can restore the same title /
   * storage key / starting geometry.
   */
  pinView(viewId: string, insertionIndex?: number): void {
    if (this._isPinnedByViewId[viewId]) return;
    const record = this.views[viewId];
    if (!record) {
      throw new Error(`[ViewManager.pinView] View with ID ${viewId} not found`);
    }
    const canvas = this._autoCanvasByViewId[viewId];
    const panel = this._floatingPanelByViewId[viewId];
    if (!canvas || !panel) {
      // Caller-supplied elements aren't manager-owned — nothing to pin.
      return;
    }

    if (canvas.parentElement) {
      canvas.parentElement.removeChild(canvas);
    }
    panel.destroy();
    delete this._floatingPanelByViewId[viewId];

    this._ensureViewLayoutContainer();
    const wrapper = this._makePinnedCellWrapper(viewId, canvas);
    const grid = this._viewLayoutContainer!;
    // Drag-to-dock passes an insertion index derived from the
    // pointer's horizontal position. Default (append) preserves
    // the original explicit-pin behaviour where docked cells
    // accumulate left-to-right in arrival order.
    if (insertionIndex !== undefined && insertionIndex >= 0
        && insertionIndex < grid.children.length) {
      grid.insertBefore(wrapper, grid.children[insertionIndex]);
    } else {
      grid.appendChild(wrapper);
    }

    this._isPinnedByViewId[viewId] = true;
    this._updateAutoCanvasLayout();
    record.view.needsRender();
  }

  /**
   * Move a pinned View out of the flow-layout grid and into a fresh
   * floating {@link ViewPanel}, restored to the title / storage key /
   * starting geometry the panel was originally created with. The new
   * panel is brought to the top of the floating-panel z-stack.
   *
   * No-op if the View has no manager-owned DOM, or is already
   * floating. Idempotent.
   */
  unpinView(viewId: string): void {
    if (this._isPinnedByViewId[viewId] === false) return;
    const record = this.views[viewId];
    if (!record) {
      throw new Error(`[ViewManager.unpinView] View with ID ${viewId} not found`);
    }
    const canvas = this._autoCanvasByViewId[viewId];
    if (!canvas) return;

    // Canvas is nested inside `canvasBox` inside the cell — walk
    // up to the cell so we tear out the header strip too rather
    // than leaving an orphan cell with no canvas.
    const cell = canvas.closest(".xkt-view-cell");
    if (cell && cell.parentElement) {
      cell.parentElement.removeChild(cell);
    } else if (canvas.parentElement) {
      canvas.parentElement.removeChild(canvas);
    }
    // Strip any sizing the grid wrapper imposed — the floating
    // panel's body sizes its child to 100% of the panel.
    canvas.style.width  = "100%";
    canvas.style.height = "100%";

    const savedParams = this._panelParamsByViewId[viewId] ?? {
      title:      `View — ${viewId}`,
      storageKey: `xkt-vp-panel-${viewId}`,
    };
    const panelParams: ViewPanelParams = {
      ...savedParams,
      onPin:     () => this.pinView(viewId),
      onDestroy: () => this._destroyViewById(viewId),
    };
    const panel = new ViewPanel(panelParams);
    panel.body.appendChild(canvas);
    this._floatingPanelByViewId[viewId] = panel;
    // Same panel-drag → no descendant-resize setup as createView.
    panel.onLayoutChanged.subscribe(() => record.view.needsRender());
    // Drag-to-dock works on re-floated panels too, so a panel
    // can round-trip docked → floating → docked freely.
    this._wireDragToDock(viewId, panel);
    // `show()` re-mounts the panel into the DOM and calls
    // `bringFloatingPanelToFront`, so the freshly undocked panel
    // lands above any other floating panels regardless of when they
    // were created.
    panel.show();

    this._isPinnedByViewId[viewId] = false;
    this._updateAutoCanvasLayout();
    record.view.needsRender();
  }

  /**
   * Build the `xkt-view-cell` grid wrapper that hosts a pinned
   * canvas plus a header strip with the same controls as a
   * floating {@link ViewPanel}: title, undock, minimize, and
   * close (destroy) buttons.
   *
   * The wrapper carries `xkt-vp-panel` purely so the header and
   * button rules from the ViewPanel stylesheet apply — the
   * floating-panel-only chrome (fixed positioning, shadow, large
   * z-index, etc.) is then cancelled by the `.xkt-vp-panel.xkt-view-cell`
   * overrides in that same stylesheet.
   */
  private _makePinnedCellWrapper(viewId: string, canvas: AutoViewElement): HTMLDivElement {
    // The cell relies on the shared `.xkt-vp-panel` chrome rules.
    // When no floating ViewPanel has been constructed yet, the
    // ViewPanel constructor hasn't had a chance to inject those
    // rules into the document — pull them in explicitly here
    // before any class names are read by the renderer.
    ensureViewPanelStylesInjected();

    const wrapper = document.createElement("div");
    wrapper.className = "xkt-vp-panel xkt-view-cell";
    wrapper.setAttribute("data-view-id", viewId);
    // The grid container is `display: grid; minmax(0, 1fr)`, so
    // the cell stretches to fill its track. Inside, we lay out
    // header on top + canvas filling the rest.
    wrapper.style.display       = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.overflow      = "hidden";

    const title = this._panelParamsByViewId[viewId]?.title || `View — ${viewId}`;

    // ── Header strip ──────────────────────────────────────────
    const header = document.createElement("div");
    header.className = "xkt-vp-header";

    const titleEl = document.createElement("span");
    titleEl.className = "xkt-vp-title";
    titleEl.textContent = title;
    header.appendChild(titleEl);

    const undockBtn = document.createElement("button");
    undockBtn.type = "button";
    undockBtn.className = "xkt-vp-undock";
    undockBtn.title = "Undock View";
    undockBtn.setAttribute("aria-label", "Undock View into a floating panel");
    undockBtn.innerHTML = UNPIN_ICON_SVG;
    undockBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this.unpinView(viewId);
    });
    header.appendChild(undockBtn);

    const minimizeBtn = document.createElement("button");
    minimizeBtn.type = "button";
    minimizeBtn.className = "xkt-vp-close";
    minimizeBtn.title = "Minimize View";
    minimizeBtn.setAttribute("aria-label", "Minimize View");
    minimizeBtn.innerHTML = MINIMIZE_ICON_SVG;
    minimizeBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      // Docked-cell minimize: lift the View into a floating panel,
      // then immediately hide that panel. The pill surfaces on
      // the side rail just like a floating-panel minimize would —
      // reuses FloatingPanelBase's pill machinery without us
      // having to grow a parallel pill system for grid cells.
      this.unpinView(viewId);
      this._floatingPanelByViewId[viewId]?.hide();
    });
    header.appendChild(minimizeBtn);

    const destroyBtn = document.createElement("button");
    destroyBtn.type = "button";
    destroyBtn.className = "xkt-vp-destroy";
    destroyBtn.title = "Close View";
    destroyBtn.setAttribute("aria-label", "Close View (destroy)");
    destroyBtn.innerHTML = CLOSE_ICON_SVG;
    destroyBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      confirmDialog({
        title:        "Close View?",
        message:      `Close "${title}"? This will destroy the View and discard its render state. This cannot be undone.`,
        confirmLabel: "Close",
        cancelLabel:  "Cancel",
        variant:      "danger",
      }).then((ok) => {
        if (!ok) return;
        this._destroyViewById(viewId);
      });
    });
    header.appendChild(destroyBtn);

    // Drag-to-undock: a pointerdown on the cell's header followed
    // by movement past a small threshold should peel the cell out
    // of the grid and hand the live pointer over to the resulting
    // floating panel. Below the threshold the gesture is treated
    // as a click (useful for picking up cells on touch without
    // accidentally undocking). Button targets short-circuit so
    // clicks on undock / minimize / close fire normally.
    header.style.cursor = "grab";
    header.addEventListener("pointerdown", (ev) => {
      if ((ev.target as Element).closest("button")) return;
      if (ev.button !== 0) return;
      const startX = ev.clientX;
      const startY = ev.clientY;
      const pointerId = ev.pointerId;
      let undocked = false;
      const THRESHOLD = 4;

      const cleanup = () => {
        document.removeEventListener("pointermove",   onMove);
        document.removeEventListener("pointerup",     onUp);
        document.removeEventListener("pointercancel", onUp);
      };

      const onMove = (mEv: PointerEvent) => {
        if (mEv.pointerId !== pointerId) return;
        if (undocked) return;
        const dx = mEv.clientX - startX;
        const dy = mEv.clientY - startY;
        if ((dx * dx + dy * dy) < THRESHOLD * THRESHOLD) return;
        undocked = true;
        // unpinView destroys this very cell + listener, so the
        // pointerdown handler we're inside is also being torn
        // down. cleanup() removes our doc-level move/up so the
        // panel's own listeners are the only ones tracking the
        // drag from here on.
        this.unpinView(viewId);
        cleanup();
        const panel = this._floatingPanelByViewId[viewId];
        if (panel) panel.beginHeaderDragFromPointer(mEv);
      };

      const onUp = (uEv: PointerEvent) => {
        if (uEv.pointerId !== pointerId) return;
        cleanup();
      };

      document.addEventListener("pointermove",   onMove);
      document.addEventListener("pointerup",     onUp);
      document.addEventListener("pointercancel", onUp);
    });

    wrapper.appendChild(header);

    // ── Canvas container ──────────────────────────────────────
    // Wrapping the canvas in its own flex-grow box keeps it sized
    // to the remaining cell space below the header without
    // interfering with the canvas's `width: 100%; height: 100%`
    // sizing rules.
    const canvasBox = document.createElement("div");
    canvasBox.style.position   = "relative";
    canvasBox.style.flex       = "1 1 auto";
    canvasBox.style.minHeight  = "0";
    canvasBox.style.overflow   = "hidden";
    canvasBox.style.background = "black";

    canvas.style.width  = "100%";
    canvas.style.height = "100%";
    canvas.style.border = "none";
    canvasBox.appendChild(canvas);

    wrapper.appendChild(canvasBox);

    return wrapper;
  }

  // ── Drag-to-dock helpers ────────────────────────────────────────

  /**
   * Compute the index inside {@link _viewLayoutContainer} at which
   * a freshly-dropped cell should be inserted, given the pointer's
   * current horizontal viewport coordinate. The new cell lands
   * before the first existing cell whose horizontal centre is to
   * the right of the pointer, falling back to "append" when the
   * pointer is past every existing cell.
   *
   * The grid lays out cells row-major, so this rule corresponds
   * to "left → right reading order". When more than one row of
   * cells exists, the index still uses horizontal centres — the
   * user sees this as "which slot is nearest under the pointer".
   */
  private _computeDockInsertionIndex(clientX: number): number {
    if (!this._viewLayoutContainer) return 0;
    const cells = this._viewLayoutContainer.querySelectorAll<HTMLDivElement>(".xkt-view-cell");
    for (let i = 0; i < cells.length; i++) {
      const rect = cells[i].getBoundingClientRect();
      if (clientX < rect.left + rect.width / 2) return i;
    }
    return cells.length;
  }

  /**
   * Build (once) the drop-zone overlay shown when a floating
   * ViewPanel is dragged into the top dock zone. A fixed strip
   * along the top of the viewport plus a vertical marker
   * positioned at the pointer-X to indicate the insertion slot.
   */
  private _ensureDockPreview(): HTMLDivElement {
    if (this._dockPreviewEl) return this._dockPreviewEl;
    const strip = document.createElement("div");
    strip.id = "xkt-dock-preview";
    strip.style.position       = "fixed";
    strip.style.top            = "0";
    strip.style.left           = "0";
    strip.style.width          = "100vw";
    strip.style.height         = `${ViewManager.DOCK_ZONE_PX}px`;
    strip.style.pointerEvents  = "none";
    strip.style.background     = "rgba(45, 94, 140, 0.18)";
    strip.style.borderBottom   = "2px solid #2d5e8c";
    strip.style.boxSizing      = "border-box";
    strip.style.display        = "none";
    // Above floating ViewPanels (view tier 100,100,000+) but
    // below default-tier panels and dialogs (200,000,000+) so
    // the preview never paints over an active modal.
    strip.style.zIndex         = "150000000";
    strip.style.transition     = "opacity 80ms ease-out";
    strip.style.opacity        = "0";

    const marker = document.createElement("div");
    marker.style.position        = "absolute";
    marker.style.top             = "0";
    marker.style.bottom          = "0";
    marker.style.width           = "3px";
    marker.style.background      = "#2d5e8c";
    marker.style.boxShadow       = "0 0 0 1px rgba(255,255,255,0.7)";
    marker.style.transform       = "translateX(-50%)";
    marker.style.pointerEvents   = "none";
    strip.appendChild(marker);

    document.body.appendChild(strip);
    this._dockPreviewEl = strip;
    this._dockPreviewMarker = marker;
    return strip;
  }

  /**
   * Reveal the drop-zone strip and position its insertion marker
   * at `clientX`. Idempotent — repeated calls just move the
   * marker.
   */
  private _showDockPreview(clientX: number): void {
    const strip = this._ensureDockPreview();
    strip.style.display = "block";
    // requestAnimationFrame to let the display:block tick land
    // before transitioning opacity in — without it the first
    // frame paints at opacity 0 with no transition.
    if (strip.style.opacity !== "1") {
      requestAnimationFrame(() => { strip.style.opacity = "1"; });
    }
    if (this._dockPreviewMarker) {
      this._dockPreviewMarker.style.left = `${clientX}px`;
    }
  }

  /** Hide the drop-zone strip. Safe to call when not visible. */
  private _hideDockPreview(): void {
    const strip = this._dockPreviewEl;
    if (!strip || strip.style.display === "none") return;
    strip.style.opacity = "0";
    strip.style.display = "none";
  }

  /**
   * Attach drag-to-dock listeners to a freshly-constructed
   * floating ViewPanel's header. During a header drag, watches
   * the panel's top edge — when it crosses into the top zone,
   * shows the dock-preview and remembers the insertion index;
   * on pointerup inside the zone, pins the View at that index.
   *
   * Runs alongside FloatingPanelBase's own drag listeners (which
   * write the panel's left/top inline styles); we just read
   * those positions and observe the gesture, never interfering
   * with the base's drag flow.
   */
  private _wireDragToDock(viewId: string, panel: ViewPanel): void {
    const header = panel.headerElement;
    const panelEl = panel.panelElement;
    let pendingIndex: number | null = null;

    const onMove = (ev: PointerEvent): void => {
      // Only act while a drag is actually in progress. The
      // base class adds `xkt-vp-dragging` to the header for
      // exactly the lifetime of the drag.
      if (!header.classList.contains("xkt-vp-dragging")) {
        if (pendingIndex !== null) {
          pendingIndex = null;
          this._hideDockPreview();
        }
        return;
      }
      const rect = panelEl.getBoundingClientRect();
      if (rect.top <= ViewManager.DOCK_ZONE_PX) {
        pendingIndex = this._computeDockInsertionIndex(ev.clientX);
        this._showDockPreview(ev.clientX);
      } else if (pendingIndex !== null) {
        pendingIndex = null;
        this._hideDockPreview();
      }
    };

    const onUp = (): void => {
      if (pendingIndex === null) return;
      const idx = pendingIndex;
      pendingIndex = null;
      this._hideDockPreview();
      // Deferred via microtask so the base class's own pointerup
      // handler (which saves the floating layout) runs first.
      // pinView destroys the panel, so we don't want the base's
      // _saveLayout reading from a freshly-removed DOM tree.
      queueMicrotask(() => this.pinView(viewId, idx));
    };

    header.addEventListener("pointermove",   onMove);
    header.addEventListener("pointerup",     onUp);
    header.addEventListener("pointercancel", () => {
      if (pendingIndex !== null) {
        pendingIndex = null;
        this._hideDockPreview();
      }
    });
  }

  private _ensureViewLayoutContainer(): HTMLDivElement {
    if (typeof document === "undefined") {
      throw new Error("Document is not available");
    }

    if (this._viewLayoutContainer) {
      return this._viewLayoutContainer;
    }

    const container = document.createElement("div");
    container.id = "xeokit-demohelper-view-layout";
    container.style.position = "absolute";
    container.style.left = "0";
    container.style.top = "0";
    container.style.width = "100vw";
    container.style.height = "100vh";
    container.style.display = "grid";
    container.style.gridAutoFlow = "row";
    container.style.margin = "0";
    container.style.padding = "0";
    container.style.gap = "0";
    container.style.boxSizing = "border-box";
    container.style.overflow = "hidden";
    container.style.pointerEvents = "auto";
    container.style.background = "transparent";

    document.body.appendChild(container);
    this._viewLayoutContainer = container;

    window.addEventListener("resize", () => this._updateAutoCanvasLayout());

    return container;
  }

  private _updateAutoCanvasLayout(): void {
    if (!this._viewLayoutContainer) {
      return;
    }

    // Only pinned canvases occupy grid tracks. Floating canvases
    // live inside their {@link ViewPanel} bodies and don't contribute
    // to the flow-layout count.
    const pinnedIds = Object.keys(this._autoCanvasByViewId).filter(
      id => this._isPinnedByViewId[id] === true,
    );
    const numCanvases = pinnedIds.length;

    if (numCanvases <= 0) {
      this._viewLayoutContainer.style.gridTemplateColumns = "";
      this._viewLayoutContainer.style.gridTemplateRows = "";
      return;
    }

    const cols = Math.ceil(Math.sqrt(numCanvases));
    const rows = Math.ceil(numCanvases / cols);

    this._viewLayoutContainer.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    this._viewLayoutContainer.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
    this._viewLayoutContainer.style.alignItems = "stretch";
    this._viewLayoutContainer.style.justifyItems = "stretch";

    for (const viewId of pinnedIds) {
      const canvas = this._autoCanvasByViewId[viewId];
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    }
  }
}
