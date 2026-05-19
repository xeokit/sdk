import type {PickParams, PickResult, View, Viewer, ViewParams} from "../../viewing/viewer";
import type {SDKResult} from "../../base/core";
import type {AABB3Float} from "../../base/math/boundaries";
import {CameraFlightAnimation} from "../../viewing/cameraFlight";
import {ViewController} from "../../viewing/viewController";
import {RealisticRender} from "../../base/constants";
import {createUUID} from "../../base/utils";

import {ViewPanel, type ViewPanelParams} from "../panels/viewPanel";
import type {StudioCreateViewParams} from "../StudioCreateViewParams";

/**
 * One record per live View. Mirrors what the old `studio.views[id]`
 * map carried — every consumer reads `cameraFlight` and/or
 * `viewController` off it.
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
 * Studio uses these to layer on the context-menu wiring and HDR-sky
 * setup that used to live inline in the old `createView`.
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

/**
 * Owns the lifecycle and DOM hosting of every View created through
 * Studio: the `views` registry, the auto-layout container for tiled
 * canvases, and the per-view {@link ViewPanel} hosting when callers
 * pass `floating: true`.
 *
 * The pre-extraction `createView` ran ~70 lines on Studio and pulled
 * in context-menu wiring, HDR setup, CameraFlight construction,
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
   * Cap on the number of Views the manager will create. Mirrors the
   * old `studio.maxViews` knob — drives the WebGL renderer's memory
   * configuration in Studio, and is enforced here as well.
   */
  public readonly maxViews: number;

  private _viewLayoutContainer: HTMLDivElement | null = null;
  private _autoCanvasByViewId: { [viewId: string]: HTMLImageElement } = {};
  private _floatingPanelByViewId: { [viewId: string]: ViewPanel } = {};

  constructor(
    private readonly ctx: ViewManagerContext,
    private readonly hooks: ViewManagerHooks = {},
    options: {maxViews?: number} = {},
  ) {
    this.maxViews = options.maxViews ?? 4;
  }

  /**
   * Create a new View on the underlying Viewer.
   *
   * When `viewParams.elementId` and `viewParams.htmlElement` are
   * omitted, the manager auto-creates a canvas element and either:
   *  - lays it out snugly with other auto-created canvases inside the
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

    // `floating` is the demo's own knob — strip it off before forwarding
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

    let autoCreatedCanvas: HTMLImageElement | null = null;
    let floatingPanel: ViewPanel | null = null;
    let viewId = resolvedViewParams.id;

    if (!hasExplicitElement) {
      autoCreatedCanvas = document.createElement("img");
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
        const panelParams: ViewPanelParams = {
          title:      `View — ${viewId}`,
          storageKey: `xkt-vp-panel-${viewId}`,
          ...(typeof floatingOpt === "object" && floatingOpt !== null ? floatingOpt : {}),
        };

        floatingPanel = new ViewPanel(panelParams);
        floatingPanel.body.appendChild(autoCreatedCanvas);
      } else {
        autoCreatedCanvas.style.border = "1px solid white";
        this._ensureViewLayoutContainer();
        this._viewLayoutContainer!.appendChild(autoCreatedCanvas);
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
      if (floatingPanel) {
        this._floatingPanelByViewId[view.id] = floatingPanel;
        floatingPanel.setTitle(`View — ${view.id}`);
        // Panel drag changes the panel's CSS left/top but no
        // descendant resizes, so the renderer's ResizeObserver
        // on the View's element never fires. Forward the panel's
        // own onLayoutChanged to view.needsRender() so the shared
        // WebGL canvas re-aligns on every drag pointermove and
        // viewport clamp.
        floatingPanel.onLayoutChanged.subscribe(() => view.needsRender());
      } else {
        this._autoCanvasByViewId[view.id] = autoCreatedCanvas;
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

  /** Destroy a View created via {@link createView}; removes its canvas if auto-created. */
  destroyView(view: View): void {
    const viewId = view.id;

    this.hooks.onViewDestroyed?.(viewId);

    if (this._floatingPanelByViewId[viewId]) {
      // The panel owns the canvas DOM — destroying the panel removes
      // both the canvas and the panel chrome.
      this._floatingPanelByViewId[viewId].destroy();
      delete this._floatingPanelByViewId[viewId];
    } else if (this._autoCanvasByViewId[viewId]) {
      const canvas = this._autoCanvasByViewId[viewId];
      if (canvas.parentElement) {
        canvas.parentElement.removeChild(canvas);
      }
      delete this._autoCanvasByViewId[viewId];
      this._updateAutoCanvasLayout();
    }
    view.destroy();
    delete this.views[viewId];
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

    const numCanvases = Object.keys(this._autoCanvasByViewId).length;

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

    for (const viewId in this._autoCanvasByViewId) {
      const canvas = this._autoCanvasByViewId[viewId];
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    }
  }
}
