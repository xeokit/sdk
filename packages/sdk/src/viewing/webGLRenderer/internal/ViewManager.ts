import {RenderContext} from "./RenderContext";
import {Camera, Effect, View, Viewer, ViewObject} from "../../viewer";
import {type PickParams, type PickResult} from "../../viewer";
import {SDKInternalException, SDKErrorType, type SDKResult} from "../../../base/core";
import {ViewRenderState} from "./ViewRenderState";
import {RenderManager} from "./renderManager";
import {PickManager} from "./pickManager";
import {SnapManager} from "./snapManager";
import {GPUMemoryManager} from "./gpuMemoryManager";
import {MeshManager} from "./meshManager";
import {type GPUMemoryReader} from "./gpuMemoryManager";
import {SceneGeometry, SceneMaterial, SceneMesh, SceneModel, SceneObject, SceneTexture} from "../../../model/scene";
import {SceneTransform} from "../../../model/scene/SceneTransform";
import {type MemoryConfigs} from "../MemoryConfigs";
import type {DataTextures} from "./gpuMemoryManager/DataTextures";
import {RenderInspector, ShaderInspector} from "./inspectors";
import {getEffectiveResolutionScale} from "./resolutionScale";

/**
 * Top-level, internal rendering and pipeline manager within a {@link WebGLRenderer}.
 *
 * @remarks
 * - `ViewManager` is owned by a single {@link WebGLRenderer} instance.
 * - It manages all {@link viewing!viewer.View | View}s for a given {@link viewing!viewer.Viewer | Viewer}.
 * - Acts as the central coordinator for per-View state, rendering, and GPU resource management.
 * - Owns and initializes the shared WebGL {@link RenderContext} and its underlying canvas element.
 * - Instantiates and wires together the core pipeline managers:
 *   - {@link GPUMemoryManager}: Manages GPU-side storage, data textures, and memory uploads for all views.
 *   - {@link MeshManager}: Bridges scene/view state changes (transforms, colors, visibility, etc.) into GPU-ready render state for all views.
 *   - {@link RenderManager}: Executes draw passes for the currently active view, managing the render pipeline.
 *   - {@link PickManager}: Handles GPU-backed picking resources and queries for all views.
 * - Tracks and manages {@link ViewRenderState} instances for each {@link viewing!viewer.View | View}, synchronizing per-view state and resources.
 * - Handles view activation, moving/resizing the shared WebGL canvas to match the active view element, and snapshotting the previous view as needed.
 * - Exposes the set of GPU-backed data textures (via {@link dataTextures}) for diagnostics.
 *
 * ## Architectural Role
 * - The {@link WebGLRenderer} owns a single `ViewManager`.
 * - The `ViewManager` manages all {@link viewing!viewer.View | View}s for the associated {@link viewing!viewer.Viewer | Viewer}, supporting multi-view rendering.
 * - It owns and coordinates all pipeline managers, ensuring that scene and view changes are efficiently reflected in GPU state and draw calls.
 * - All per-view rendering, picking, and GPU resource management flows through the `ViewManager` and its managers.
 *
 * ## Lifecycle
 * 1. Constructed by {@link WebGLRenderer}.
 * 2. Initialized via {@link init} with a {@link viewing!viewer.Viewer | Viewer} and memory configs.
 * 3. For each view added/removed: {@link viewCreated} / {@link viewDestroyed}.
 * 4. For each view update: {@link viewUpdated}.
 * 5. On shutdown: {@link destroy}.
 *
 * @internal
 */
export class ViewManager {

  /**
   * GPU-backed textures created/owned by {@link GPUMemoryManager}.
   * Exposed for diagnostics.
   * Available after {@link init} succeeds; `undefined` after {@link destroy}.
   */
  public dataTextures: DataTextures | undefined = undefined;

  /**
   * Exposes shader source code for all techniques used by the renderer.
   * Exposed for diagnostics.
   * Available after {@link init} succeeds; `undefined` after {@link destroy}.
   */
  public shaderInspector: ShaderInspector;

  /** The owning {@link viewing!viewer.Viewer | Viewer} instance. Set during {@link init}. */
  private _viewer: Viewer;

  /** Shared WebGL context wrapper and resources. */
  private _renderContext: RenderContext;

  /** Map of view id -> renderer view wrapper.
   * @internal
   */
  private _rendererViews: Record<string, ViewRenderState> = {};

  /** Ordered list of renderer views, aligned with {@link View.viewIndex}. */
  private _rendererViewsList: ViewRenderState[] = [];

  /**
   * Currently active renderer view.
   *
   * The WebGL canvas is positioned/sized to this view’s HTML element.
   *
   * @internal
   */
  private _activeView: ViewRenderState;

  /** Executes draw passes for the active view.
   * @internal
   */
  private _renderManager: RenderManager;

  /** Manages GPU picking resources and queries.
   * @internal
   */
  private _pickManager: PickManager;

  /** Manages GPU snap-to-vertex / snap-to-edge picking.
   * @internal
   */
  private _snapManager: SnapManager;

  /** Owns GPU-side geometry/mesh buffers and data-texture uploads.
   * @internal
   */
  private _gpuMemoryManager: GPUMemoryManager;

  /**
   * Translates scene/view changes into GPU uploads (transforms, colors, flags, etc.).
   * @internal
   */
  private _meshManager: MeshManager;

  /** Schedules at most one alignment pass per animation frame. */
  private _alignCanvasRAF: number | null = null;

  /** Observes size changes on the active view's HTML element. */
  private _activeViewResizeObserver: ResizeObserver | null = null;

  /** True when canvas backing size changed outside the normal render loop. */
  private _activeViewNeedsRenderAfterAlignment = false;

  /**
   * z-index applied to the shared WebGL canvas. Tracks the host
   * floating panel (if any) of the current active view so the
   * canvas sits just below the host panel — host chrome stays on
   * top, OTHER floating panels overlapping the host body are
   * covered by the canvas (otherwise their `<img>` snapshots
   * would bleed through the host's transparent body). Default
   * baseline keeps tiled-layout views working the same as before.
   */
  private _canvasZIndex: string = "100000";

  /** Last canvas layout applied to the DOM, used to avoid redundant writes. */
  private _lastCanvasLayout: {
    left: number;
    top: number;
    cssWidth: number;
    cssHeight: number;
    pixelWidth: number;
    pixelHeight: number;
    resolutionScale: number;
  } | null = null;

  /** Stable listener reference for resize / scroll callbacks. */
  private readonly _boundScheduleCanvasAlignment = () => {
    this._scheduleActiveViewCanvasAlignment();
  };

  /**
   * Constructs a {@link ViewManager}.
   *
   * This constructor does not allocate GPU resources. Call {@link init} before use.
   */
  constructor() {
  }

  /**
   * Initializes the manager and all underlying pipeline components for a given {@link viewing!viewer.Viewer | Viewer}.
   *
   * A separate init method is used so initialization can fail gracefully via {@link base!core.SDKResult | SDKResult}
   * rather than throwing.
   *
   * @param params.viewer - The viewer whose {@link Viewer.viewList} will be managed.
   * @param params.memoryConfigs - Memory configuration used to create {@link RenderContext}.
   * @param params.debugging - Enables additional debugging behavior in the render context.
   *
   * @returns {@link base!core.SDKResult | SDKResult} that is `ok: true` when initialization succeeds, or `ok: false`
   * with an {@link SDKErrorType} and message when initialization fails.
   *
   * @remarks
   * - Enforces a current maximum of 4 views.
   * - Creates {@link ViewRenderState} wrappers for any views already present on the viewer.
   */
  public init(params: {
    viewer: Viewer,
    memoryConfigs: MemoryConfigs,
    debugging?: boolean
  }): SDKResult<void> {

    const viewer = params.viewer;
    this._viewer = viewer;

    if (viewer.viewList.length >= 4) { // TODO: Capabilities.maxViews
      return this._failInit({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[ViewManager.init] Maximum number of Views exceeded - max allowed is 4`
      });
    }

    this._renderContext = new RenderContext(params.memoryConfigs);

    const resultCtx = this._renderContext.init(viewer);
    if (resultCtx.ok === false) {
      return this._failInit(resultCtx);
    }

    // After init() — it resets `debugging` while setting up the GL context, so
    // the caller's value must be applied afterwards (and before DrawOps compiles).
    this._renderContext.debugging = !!params.debugging;

    const webglCanvasElement = this._renderContext.webglCanvasElement;
    webglCanvasElement.style.position = "fixed";
    webglCanvasElement.style.left = "0px";
    webglCanvasElement.style.top = "0px";
    webglCanvasElement.style.width = "0px";
    webglCanvasElement.style.height = "0px";
    webglCanvasElement.style.zIndex = "100000";

    this._gpuMemoryManager = new GPUMemoryManager(this._renderContext);

    const resultGPU = this._gpuMemoryManager.init();
    if (resultGPU.ok === false) {
      return this._failInit(resultGPU);
    }

    this.dataTextures = this._gpuMemoryManager.dataTextures;

    this._meshManager = new MeshManager(this._renderContext, this._gpuMemoryManager);

    const resultMesh = this._meshManager.init();
    if (resultMesh.ok === false) {
      return this._failInit(resultMesh);
    }

    this._renderManager = new RenderManager({
      renderContext: this._renderContext,
      meshManager: this._meshManager,
      gpuMemoryReader: this._gpuMemoryManager as GPUMemoryReader
    });

    const resultRender = this._renderManager.init();
    if (resultRender.ok === false) {
      return this._failInit(resultRender);
    }

    this.shaderInspector = new ShaderInspector(this._renderManager.drawOps);

    this._pickManager = new PickManager({
      renderContext: this._renderContext,
      meshManager: this._meshManager,
      gpuMemoryManager: this._gpuMemoryManager
    });

    const resultPick = this._pickManager.init();
    if (resultPick.ok === false) {
      return this._failInit(resultPick);
    }

    this._snapManager = new SnapManager({
      renderContext: this._renderContext,
      meshManager: this._meshManager,
      gpuMemoryManager: this._gpuMemoryManager,
    });
    const resultSnap = this._snapManager.init();
    if (resultSnap.ok === false) {
      // Snap is opt-in; a missing EXT_color_buffer_float shouldn't
      // fail-init the whole renderer. Log + drop the snap manager,
      // and a subsequent snapPick() returns "not snapped" gracefully.
      console.warn("[ViewManager.init] SnapManager unavailable:", resultSnap.error);
      this._snapManager.destroy();
      this._snapManager = undefined as unknown as SnapManager;
    }

    for (const view of viewer.viewList) {
      const result = this.viewCreated(view);
      if (!result.ok) {
        return this._failInit(result);
      }
    }

    this._installCanvasAlignmentListeners();

    if (this._rendererViewsList.length > 0) {
      this._activeView = this._rendererViewsList[0];
      this._observeActiveViewElement(this._activeView);
      this._alignCanvasToView(this._activeView);
    }

    return {
      ok: true,
      value: undefined
    };
  }

  private _failInit<T>(result: SDKResult<T>): SDKResult<T> {
    this.destroy();
    return result;
  }

  /**
   * Returns the shared WebGL canvas element used to render the active view.
   *
   * @throws {@link base!core.SDKInternalException | SDKInternalException} If the manager has not been initialized.
   */
  getWebGLCanvasElement(): HTMLCanvasElement {
    if (!this._renderContext) {
      throw new SDKInternalException("[ViewManager.getWebGLCanvasElement] ViewManager is not initialized");
    }
    return this._renderContext.webglCanvasElement;
  }

  /**
   * Reinitializes GPU and render state after a WebGL context restoration event.
   *
   * Call this after the underlying WebGL context has been restored to recreate GPU resources
   * for memory, rendering, and picking.
   *
   * @throws {@link base!core.SDKInternalException | SDKInternalException} If the manager has not been initialized.
   */
  webglContextRestored(gl?: WebGL2RenderingContext): SDKResult<void> {
    if (!this._gpuMemoryManager || !this._renderManager || !this._pickManager) {
      throw new SDKInternalException("[ViewManager.webglContextRestored] ViewManager is not initialized");
    }
    const resultContext = this._renderContext.webglContextRestored(gl);
    if (resultContext.ok === false) {
      return resultContext;
    }
    for (const rendererView of this._rendererViewsList) {
      rendererView.renderBuffers?.webglContextRestored(this._renderContext.gl);
    }
    const resultGPU = this._gpuMemoryManager.webglContextRestored();
    if (resultGPU.ok === false) {
      return resultGPU;
    }
    const resultMesh = this._meshManager.webglContextRestored();
    if (resultMesh.ok === false) {
      return resultMesh;
    }
    const resultRender = this._renderManager.webglContextRestored();
    if (resultRender.ok === false) {
      return resultRender;
    }
    const resultPick = this._pickManager.webglContextRestored();
    if (resultPick.ok === false) {
      return resultPick;
    }
    if (this._snapManager) {
      const resultSnap = this._snapManager.webglContextRestored();
      if (resultSnap.ok === false) {
        console.warn("[ViewManager.webglContextRestored] SnapManager restore failed:", resultSnap.error);
        this._snapManager.destroy();
        this._snapManager = undefined as unknown as SnapManager;
      }
    }

    if (this._activeView) {
      this._lastCanvasLayout = null;
      this._alignCanvasToView(this._activeView);
    }

    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Releases GL-backed resources when the WebGL context is lost.
   *
   * Called synchronously from the `webglcontextlost` handler, while the context
   * is still flagged lost, so each subsystem's `gl.delete*` calls are no-ops
   * rather than errors against the later-restored context.
   */
  webglContextLost(): void {
    this._renderContext?.webglContextLost();
    this._renderManager?.webglContextLost();
    this._pickManager?.webglContextLost();
    for (const rendererView of this._rendererViewsList) {
      rendererView.renderBuffers?.webglContextLost();
    }
  }

  /**
   * Returns current GPU memory usage statistics for the renderer.
   *
   * @throws {@link base!core.SDKInternalException | SDKInternalException} If the manager has not been initialized.
   */
  getMemoryUsage() {
    if (!this._gpuMemoryManager) {
      throw new SDKInternalException("[ViewManager.getMemoryUsage] ViewManager is not initialized");
    }
    return this._gpuMemoryManager.getMemoryUsage();
  }

  /**
   * Returns the {@link RenderInspector} used to inspect draw calls.
   */
  public getRenderInspector(): RenderInspector {
    if (!this._renderContext) {
      throw new SDKInternalException("[ViewManager.getRenderInspector] ViewManager is not initialized");
    }
    return this._renderContext.renderInspector;
  }

  /**
   * Passthrough to {@link MeshManager.enableStepStats} — toggles
   * opt-in step-level timing inside `MeshManager._addMesh`. See
   * {@link MeshManager.enableStepStats}.
   *
   * @internal
   */
  public enableMeshManagerStepStats(enabled: boolean): void {
    this._meshManager.enableStepStats(enabled);
  }

  /**
   * Passthrough to {@link MeshManager.resetStepStats}.
   *
   * @internal
   */
  public resetMeshManagerStepStats(): void {
    this._meshManager.resetStepStats();
  }

  /**
   * Passthrough to {@link MeshManager.getStepStats}.
   *
   * @internal
   */
  public getMeshManagerStepStats(): import("./meshManager").MeshManagerStepStats {
    return this._meshManager.getStepStats();
  }

  /**
   * Returns the {@link viewing!viewer.View | View} at a given index in the internal view list.
   *
   * @param viewIndex - Index into the internal view list (aligned with {@link View.viewIndex}).
   * @returns The view, or `null` if the index is out of range.
   */
  public getViewAtIndex(viewIndex: number): View | null {
    return this._rendererViewsList[viewIndex]?.view || null;
  }

  /**
   * Returns scene geometry by (batchIndex, geometryIndex) as stored in GPU memory.
   *
   * @param batchIndex - Geometry batch index managed by {@link GPUMemoryManager}.
   * @param geometryIndex - Geometry index within the batch.
   * @returns The {@link model!scene.SceneGeometry | SceneGeometry} if present, otherwise `null`.
   */
  public getGeometryAtIndex(batchIndex: number, geometryIndex: number): SceneGeometry | null {
    return this._gpuMemoryManager.getGeometryAtIndex(batchIndex, geometryIndex);
  }

  /**
   * Returns a scene mesh by (batchIndex, meshIndex) as stored in GPU memory.
   *
   * @param batchIndex - Mesh batch index managed by {@link GPUMemoryManager}.
   * @param meshIndex - Mesh index within the batch.
   * @returns The {@link model!scene.SceneMesh | SceneMesh} if present, otherwise `null`.
   */
  public getMeshAtIndex(batchIndex: number, meshIndex: number): SceneMesh | null {
    return this._gpuMemoryManager.getMeshAtIndex(batchIndex, meshIndex);
  }

  /**
   * The {@link viewing!viewer.Viewer | Viewer} currently managed by this instance.
   *
   * @remarks Only valid after {@link init} succeeds.
   */
  public get viewer(): Viewer {
    return this._viewer;
  }

  /**
   * Registers a newly created {@link Effect} with the renderer.
   * @param effect
   */
  effectCreated(effect: Effect) : SDKResult<any>{
    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Unregisters a destroyed {@link Effect} with the renderer.
   * @param effect
   */
  effectDestroyed(effect: Effect) : SDKResult<any>{
    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Registers a newly created {@link viewing!viewer.View | View} with the renderer.
   *
   * Creates a {@link ViewRenderState} wrapper and assigns {@link View.viewIndex}.
   *
   * If there are already the maximum allowed number of views, returns an error result without
   * adding the view. Any other operations on ViewManager for a view that was not successfully
   * added will be quietly ignored, to reduce logging noise.
   *
   * @param view - The view to add.
   * @returns {@link base!core.SDKResult | SDKResult} indicating success or failure.
   *
   * @throws {@link base!core.SDKInternalException | SDKInternalException} If the given view id is already registered.
   */
  public viewCreated(view: View): SDKResult<any> {
    if (this._rendererViews[view.id]) {
      throw new SDKInternalException("[ViewManager.viewCreated] Can't add additional View to WebGLRenderer - View already added");
    }
    const maxViews = this._renderContext.memoryConfigs.maxViews;
    if (this._rendererViewsList.length >= maxViews) { // TODO: Capabilities.maxViews
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[ViewManager.viewCreated] Maximum view count reached (MemoryConfigs.maxViews = ${maxViews}). Additional operations for View '${view.id}' will be ignored and canvas will not be rendered.`
      };
    }
    const rendererView = new ViewRenderState(
      this._renderContext,
      this._pickManager,
      this._renderManager,
      view);
    this._rendererViews[view.id] = rendererView;
    view.viewIndex = this._rendererViewsList.length;
    this._rendererViewsList.push(rendererView);

    if (!this._activeView) {
      this._activeView = rendererView;
      this._observeActiveViewElement(rendererView);
      this._lastCanvasLayout = null;
      this._alignCanvasToView(rendererView);
    }

    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Returns the current list of renderer view wrappers.
   *
   * @remarks
   * - The list order is stable (insertion order).
   * - Each element’s {@link ViewRenderState.view} has a {@link View.viewIndex} matching its position.
   */
  public get rendererViews(): ViewRenderState[] {
    return this._rendererViewsList;
  }

  /**
   * Applies updates for a {@link viewing!viewer.View | View} and renders it.
   *
   * This will activate the view if it is not currently active, upload any queued GPU changes,
   * and issue a render.
   *
   * If the View is not registered with the manager, this method will return `ok:true` with no value,
   * and will not throw an error, since it's possible for the viewer to update views that have not been added
   * to the renderer (eg. if they were filtered out due to max view limits).
   *
   * @param view - The view to update and render.
   * @returns {@link base!core.SDKResult | SDKResult} from the render call, or `ok:true` if the view is not registered, which is OK.
   */
  public viewUpdated(view: View): SDKResult<any> {

    const rendererView = this._rendererViews[view.id];
    if (!rendererView) {
      return { ok: true, value: undefined };
    }

    // No GPU work while the context is lost; resumes after restoration.
    if (this._renderContext.contextLost) {
      return { ok: true, value: undefined };
    }

    this._gpuMemoryManager.uploadChanges();

    this._activateView(rendererView);

    const changed = this._alignCanvasToView(rendererView);
    if (changed.sizeChanged || changed.resolutionScaleChanged) {
      this._activeViewNeedsRenderAfterAlignment = false;
    }

    return this._renderManager.render(rendererView, {clear: true});
  }

  /**
   * Renders a snapshot of the given view and returns it as a data URL string.
   * @param view
   */
  public getSnapshot(view: View): SDKResult<string> {
    const rendererView = this._rendererViews[view.id];
    if (!rendererView) {
      throw new SDKInternalException(`[ViewManager.getSnapshot] View with id '${view.id}' is not registered with the renderer`);
    }
    // RenderManager binds its own scene target (HDR FBO or default canvas) on
    // _beginFrame, so any pre-bound snapshot FBO would be overwritten before
    // any pixels are drawn. The shared WebGL context is created with
    // preserveDrawingBuffer:true, so reading straight off the canvas after
    // the synchronous render returns the pixels we just drew.
    this._renderManager.render(rendererView, {clear: true});
    const image = this._renderContext.webglCanvasElement.toDataURL("image/png");
    return {
      ok: true,
      value: image
    };
  }

  /**
   * Makes the given renderer view the active view.
   *
   * Implementation detail:
   * - If there is a previously active view, it is rendered to the shared canvas
   *   and the resulting data URL is written into the previous view's HTML element
   *   (assumed to be an {@link HTMLImageElement}).
   * - The shared WebGL canvas is then positioned and resized to match the target view element.
   *
   * @param rendererView - The renderer view to activate.
   */
  private _activateView(rendererView: ViewRenderState): void {

    const activeRendererView = this._activeView;

    if (activeRendererView && activeRendererView !== rendererView) {
      this._snapshotInactiveView(activeRendererView);
    }

    this._activeView = rendererView;
    // Hide the new active view's img so the live shared canvas
    // behind it is visible. The canvas overlays the img's
    // bounding rect (see _alignCanvasToView) at a lower
    // z-index than any floating panel that wraps the img, so
    // without this the panel's img — which still shows the
    // last snapshot — covers the live render. `opacity: 0`
    // keeps the element in layout and hit-testable so
    // ViewController's pointer listeners on `view.htmlElement`
    // continue to fire; `visibility: hidden` would lose those.
    rendererView.view.htmlElement.style.opacity = "0";

    // Position the canvas in the z-stack so the host floating
    // panel's transparent body reveals the live render while
    // every OTHER overlapping floating panel is covered by the
    // canvas (otherwise its snapshot bleeds through the host
    // body). Walk up the new active view's element to find a
    // ViewPanel ancestor; the canvas z-index becomes (panelZ -
    // 1), keeping the host's header / resize handle on top.
    // For tiled views the baseline 100000 still wins over the
    // shared layout container (z-index 0 / auto).
    const hostPanel = rendererView.view.htmlElement.closest?.(".xkt-vp-panel") as HTMLElement | null ?? null;
    if (hostPanel) {
      const z = parseInt(window.getComputedStyle(hostPanel).zIndex, 10);
      if (Number.isFinite(z)) {
        this._canvasZIndex = String(z - 1);
      }
    } else {
      this._canvasZIndex = "100000";
    }
    this._renderContext.webglCanvasElement.style.zIndex = this._canvasZIndex;

    this._observeActiveViewElement(rendererView);
    this._lastCanvasLayout = null;
    this._scheduleActiveViewCanvasAlignment();
  }

  private _snapshotInactiveView(rendererView: ViewRenderState): void {
    const htmlElement = rendererView.view.htmlElement;

    if (this._canDisplayInactiveSnapshot(htmlElement)) {
      // RenderManager rebinds its own scene target on _beginFrame, so a
      // pre-bound snapshot FBO would be overwritten. The shared WebGL
      // context is created with preserveDrawingBuffer:true — reading the
      // canvas straight after the synchronous render returns the pixels
      // we just drew.
      this._renderManager.render(rendererView, {clear: true});
      htmlElement.src = this._renderContext.webglCanvasElement.toDataURL("image/png");
    }

    // Becoming inactive: restore visibility so either the snapshot (for image
    // hosts) or the host element itself can receive pointer events again.
    htmlElement.style.opacity = "";
  }

  private _canDisplayInactiveSnapshot(htmlElement: HTMLElement): htmlElement is HTMLImageElement {
    if (typeof HTMLImageElement === "undefined" || !(htmlElement instanceof HTMLImageElement)) {
      return false;
    }
    if (!htmlElement.isConnected) {
      return false;
    }
    const style = window.getComputedStyle(htmlElement);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    const rect = htmlElement.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  private _installCanvasAlignmentListeners(): void {
    window.addEventListener("resize", this._boundScheduleCanvasAlignment, {passive: true});
    window.addEventListener("scroll", this._boundScheduleCanvasAlignment, {
      passive: true,
      capture: true
    });
  }

  private _removeCanvasAlignmentListeners(): void {
    window.removeEventListener("resize", this._boundScheduleCanvasAlignment);
    window.removeEventListener("scroll", this._boundScheduleCanvasAlignment, true);

    if (this._alignCanvasRAF !== null) {
      cancelAnimationFrame(this._alignCanvasRAF);
      this._alignCanvasRAF = null;
    }

    this._disconnectActiveViewResizeObserver();
  }

  private _observeActiveViewElement(rendererView: ViewRenderState): void {
    this._disconnectActiveViewResizeObserver();

    const htmlElement = rendererView.view.htmlElement;
    if (!htmlElement || typeof ResizeObserver === "undefined") {
      return;
    }

    this._activeViewResizeObserver = new ResizeObserver(() => {
      this._scheduleActiveViewCanvasAlignment();
    });

    this._activeViewResizeObserver.observe(htmlElement);
  }

  private _disconnectActiveViewResizeObserver(): void {
    if (this._activeViewResizeObserver) {
      this._activeViewResizeObserver.disconnect();
      this._activeViewResizeObserver = null;
    }
  }

  private _scheduleActiveViewCanvasAlignment(): void {
    if (!this._activeView || !this._renderContext) {
      return;
    }
    if (this._alignCanvasRAF !== null) {
      return;
    }

    this._alignCanvasRAF = requestAnimationFrame(() => {
      this._alignCanvasRAF = null;

      const activeView = this._activeView;
      if (!activeView) {
        return;
      }

      const changed = this._alignCanvasToView(activeView);

      if (changed.sizeChanged || changed.resolutionScaleChanged) {
        this._activeViewNeedsRenderAfterAlignment = true;
        this._renderActiveViewIfNeeded();
      }
    });
  }

  private _renderActiveViewIfNeeded(): void {
    const activeView = this._activeView;
    if (!activeView || !this._activeViewNeedsRenderAfterAlignment) {
      return;
    }

    this._activeViewNeedsRenderAfterAlignment = false;
    this._gpuMemoryManager.uploadChanges();
    this._renderManager.render(activeView, {clear: true});
  }

  private _getCanvasMetricsForView(rendererView: ViewRenderState): {
    left: number;
    top: number;
    cssWidth: number;
    cssHeight: number;
    pixelWidth: number;
    pixelHeight: number;
    resolutionScale: number;
  } {
    const view = rendererView.view;
    const htmlElement = view.htmlElement;
    const rect = htmlElement.getBoundingClientRect();

    // Layout size must always come directly from the view HTMLElement.
    const cssWidth = Math.max(1, Math.round(rect.width));
    const cssHeight = Math.max(1, Math.round(rect.height));
    const left = Math.round(rect.left);
    const top = Math.round(rect.top);

    // Resolution scaling affects only the backing buffer size.
    const resolutionScale = getEffectiveResolutionScale(view);

    const pixelWidth = Math.max(1, Math.round(cssWidth * resolutionScale));
    const pixelHeight = Math.max(1, Math.round(cssHeight * resolutionScale));

    return {
      left,
      top,
      cssWidth,
      cssHeight,
      pixelWidth,
      pixelHeight,
      resolutionScale
    };
  }

  private _alignCanvasToView(rendererView: ViewRenderState): {
    moved: boolean;
    sizeChanged: boolean;
    resolutionScaleChanged: boolean;
  } {
    const webglCanvasElement = this._renderContext.webglCanvasElement;
    const metrics = this._getCanvasMetricsForView(rendererView);
    const prev = this._lastCanvasLayout;

    const moved = !prev ||
      prev.left !== metrics.left ||
      prev.top !== metrics.top ||
      prev.cssWidth !== metrics.cssWidth ||
      prev.cssHeight !== metrics.cssHeight;

    const sizeChanged = !prev ||
      prev.pixelWidth !== metrics.pixelWidth ||
      prev.pixelHeight !== metrics.pixelHeight;

    const resolutionScaleChanged = !prev ||
      prev.resolutionScale !== metrics.resolutionScale;

    // CSS position and size always match the underlying view element exactly.
    if (moved) {
      webglCanvasElement.style.left = `${metrics.left}px`;
      webglCanvasElement.style.top = `${metrics.top}px`;
      webglCanvasElement.style.width = `${metrics.cssWidth}px`;
      webglCanvasElement.style.height = `${metrics.cssHeight}px`;
      // _canvasZIndex is set by _activateView based on whether the
      // active view is hosted in a floating ViewPanel — see the
      // field's doc for the rationale.
      webglCanvasElement.style.zIndex = this._canvasZIndex;
    }

    // Backing buffer size is independently resolution-scaled. Only reassign
    // when the pixel size actually changes: assigning canvas.width/height
    // clears the drawing buffer, so an unchanged align (e.g. a redundant rAF
    // alignment as resolution scaling settles on deactivation) would blank the
    // canvas for a frame with no accompanying redraw.
    if (sizeChanged) {
      webglCanvasElement.width = metrics.pixelWidth;
      webglCanvasElement.height = metrics.pixelHeight;
    }

    this._lastCanvasLayout = metrics;

    return {
      moved,
      sizeChanged,
      resolutionScaleChanged
    };
  }

  /**
   * Unregisters a {@link viewing!viewer.View | View} and releases its associated rendering resources.
   *
   * If the View is not registered with the manager, this method will return `ok:true` with no value,
   * and will not throw an error, since it's possible for the viewer to update views that have not been added
   * to the renderer (eg. if they were filtered out due to max view limits).
   *
   * @param view - The view to remove.
   * @returns {@link base!core.SDKResult | SDKResult} indicating success.
   */
  public viewDestroyed(view: View): SDKResult<any> {
    const rendererView = this._rendererViews[view.id];
    if (!rendererView) { // Ignore
      return { ok: true, value: undefined };
    }

    const wasActive = this._activeView === rendererView;

    rendererView.destroy();
    delete this._rendererViews[view.id];
    this._rendererViewsList = this._rendererViewsList.filter(rv => rv !== rendererView);

    for (let i = 0; i < this._rendererViewsList.length; i++) {
      this._rendererViewsList[i].view.viewIndex = i;
    }

    if (wasActive) {
      this._disconnectActiveViewResizeObserver();
      this._lastCanvasLayout = null;
      this._activeView = undefined as unknown as ViewRenderState;

      const nextActiveView = this._rendererViewsList[0];
      if (nextActiveView) {
        this._activeView = nextActiveView;
        this._observeActiveViewElement(nextActiveView);
        this._scheduleActiveViewCanvasAlignment();
      } else if (this._renderContext) {
        const webglCanvasElement = this._renderContext.webglCanvasElement;
        webglCanvasElement.style.width = "0px";
        webglCanvasElement.style.height = "0px";
        webglCanvasElement.width = 1;
        webglCanvasElement.height = 1;
      }
    }

    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Notifies the renderer that a {@link model!scene.SceneModel | SceneModel} was created.
   *
   * Forwards to {@link MeshManager} to allocate and upload required GPU structures.
   */
  public sceneModelCreated(sceneModel: SceneModel): SDKResult<any> {
    return this._meshManager.sceneModelCreated(sceneModel);
  }

  /**
   * Notifies the renderer that a {@link model!scene.SceneModel | SceneModel} was destroyed.
   *
   * Forwards to {@link MeshManager} to release associated GPU structures.
   */
  public sceneModelDestroyed(sceneModel: SceneModel): SDKResult<any> {
    return this._meshManager.sceneModelDestroyed(sceneModel);
  }

  /**
   * Notifies the renderer that a {@link model!scene.SceneGeometry | SceneGeometry} was created.
   * @param sceneGeometry
   */
  sceneGeometryCreated(sceneGeometry: SceneGeometry): SDKResult<any> {
    return this._meshManager.sceneGeometryCreated(sceneGeometry);
  }

  /**
   * Notifies the renderer that a {@link model!scene.SceneGeometry | SceneGeometry} was destroyed.
   * @param sceneGeometry
   */
  sceneGeometryDestroyed(sceneGeometry: SceneGeometry): SDKResult<any> {
    return this._meshManager.sceneGeometryDestroyed(sceneGeometry);
  }

  /**
   * Notifies the renderer that a {@link model!scene.SceneMesh | SceneMesh} was created.
   *
   * Forwards to {@link MeshManager} to allocate and upload required GPU structures.
   */
  sceneMeshCreated(sceneMesh: SceneMesh): SDKResult<any> {
    return this._meshManager.sceneMeshCreated(sceneMesh);
  }

  /**
   * Notifies the renderer that a {@link model!scene.SceneMesh | SceneMesh} was destroyed.
   *
   * Forwards to {@link MeshManager} to release associated GPU structures.
   */
  sceneMeshDestroyed(sceneMesh: SceneMesh): SDKResult<any> {
    return this._meshManager.sceneMeshDestroyed(sceneMesh);
  }

  /**
   * Notifies the renderer that a {@link model!scene.SceneObject | SceneObject} was created.
   *
   * Forwards to {@link MeshManager} to create/track renderable state.
   */
  public sceneObjectCreated(sceneObject: SceneObject): SDKResult<any> {
    return this._meshManager.sceneObjectCreated(sceneObject);
  }

  /**
   * Notifies the renderer that a {@link model!scene.SceneObject | SceneObject} was destroyed.
   *
   * Forwards to {@link MeshManager} to release renderable state.
   */
  public sceneObjectDestroyed(sceneObject: SceneObject): SDKResult<any> {
    return this._meshManager.sceneObjectDestroyed(sceneObject);
  }

  /**
   * Notifies that a {@link model!scene.SceneObject | SceneObject} had a {@link model!scene.SceneMesh | SceneMesh} added.
   * @param sceneObject
   * @param sceneMesh
   */
  sceneObjectMeshAdded(sceneObject: SceneObject, sceneMesh: SceneMesh): SDKResult<any> {
    return this._meshManager.sceneObjectMeshAdded(sceneObject, sceneMesh);
  }

  /**
   * Notifies that a {@link model!scene.SceneObject | SceneObject} had a {@link model!scene.SceneMesh | SceneMesh} removed.
   * @param sceneObject
   * @param sceneMesh
   */
  sceneObjectMeshRemoved(sceneObject: SceneObject, sceneMesh: SceneMesh): SDKResult<any> {
    return this._meshManager.sceneObjectMeshRemoved(sceneObject, sceneMesh);
  }

  // Mesh and Transform state uploads, not requiring error handling

  /**
   * Notifies that a {@link model!scene.SceneMesh | SceneMesh}'s world matrix changed (eg. moved/rotated/scaled).
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public sceneMeshMatrixChanged(sceneMesh: SceneMesh): void {
    this._meshManager.sceneMeshMatrixChanged(sceneMesh);
  }

  /**
   * Notifies that a {@link model!scene.SceneMesh | SceneMesh}'s base color changed.
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public sceneMeshColorChanged(sceneMesh: SceneMesh): void {
    this._meshManager.sceneMeshColorChanged(sceneMesh);
  }

  /**
   * Notifies that a {@link model!scene.SceneMesh | SceneMesh}'s opacity changed.
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public sceneMeshOpacityChanged(sceneMesh: SceneMesh): void {
    this._meshManager.sceneMeshOpacityChanged(sceneMesh);
  }

  /**
   * Notifies that a {@link model!scene.SceneMaterial | SceneMaterial}'s `linePattern` or
   * `hatchPattern` was updated. Forwards to
   * {@link GPUMemoryManager} so the per-batch pattern tables
   * can re-encode the affected slot. The per-mesh attribute
   * texture is left untouched — the slot index there is keyed
   * on `material.uniqueId`, which doesn't change.
   */
  public sceneMaterialPatternChanged(sceneMaterial: SceneMaterial): void {
    this._gpuMemoryManager.sceneMaterialPatternChanged(sceneMaterial);
  }

  /**
   * Notifies that a {@link model!scene.SceneMaterial | SceneMaterial}'s base
   * `color` was updated at runtime. Re-uploads every mesh that uses it so the
   * change shows live.
   */
  public sceneMaterialColorChanged(sceneMaterial: SceneMaterial): void {
    this._meshManager.sceneMaterialColorChanged(sceneMaterial);
  }

  /**
   * Notifies that a {@link model!scene.SceneMaterial | SceneMaterial}'s
   * `emissiveColor` was updated at runtime. Re-packs the emissive factor for
   * every mesh that uses it so the change shows live.
   */
  public sceneMaterialEmissiveColorChanged(sceneMaterial: SceneMaterial): void {
    this._meshManager.sceneMaterialEmissiveColorChanged(sceneMaterial);
  }

  /**
   * Notifies that a {@link SceneTexture}'s `imageData` was mutated in
   * place (e.g. heat-map brush painting). Routes to
   * {@link GPUMemoryManager} which re-uploads the pixels into every
   * atlas that holds the texture, then schedules a redraw on every
   * registered view so the change becomes visible without the caller
   * having to nudge the render loop themselves.
   */
  public sceneTextureImageDataChanged(sceneTexture: SceneTexture): void {
    if (!this._gpuMemoryManager.updateSceneTexture(sceneTexture)) return;
    for (const rv of this._rendererViewsList) {
      rv.view.needsRender();
    }
  }

  /**
   * Notifies that a {@link SceneTransform}'s matrix changed.
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public sceneTransformMatrixChanged(sceneMesh: SceneTransform): void {
    this._meshManager.sceneTransformMatrixChanged(sceneMesh);
  }

  /**
   * Notifies that a {@link viewing!viewer.ViewObject | ViewObject}'s visibility flag changed.
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public viewObjectVisibilityChanged(viewObject: ViewObject): void {
    if (!this._rendererViewsList[viewObject.layer.view.viewIndex]) {
      return;
    }
    this._meshManager.viewObjectVisibilityChanged(viewObject);
  }

  /**
   * Notifies that a {@link viewing!viewer.ViewObject | ViewObject}'s x-ray flag changed.
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public viewObjectClippableChanged(viewObject: ViewObject): void {
    this._meshManager.viewObjectClippableChanged(viewObject);
  }

  /**
   * Notifies that a {@link viewing!viewer.ViewObject | ViewObject}'s culled flag changed.
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public viewObjectCulledChanged(viewObject: ViewObject): void {
    if (!this._rendererViewsList[viewObject.layer.view.viewIndex]) {
      return;
    }
    this._meshManager.viewObjectCulledChanged(viewObject);
  }

  public viewObjectXRayedChanged(viewObject: ViewObject): void {
    if (!this._rendererViewsList[viewObject.layer.view.viewIndex]) {
      return;
    }
    this._meshManager.viewObjectXRayedChanged(viewObject);
  }

  /**
   * Notifies that a {@link viewing!viewer.ViewObject | ViewObject}'s highlight flag changed.
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public viewObjectHighlightedChanged(viewObject: ViewObject): void {
    if (!this._rendererViewsList[viewObject.layer.view.viewIndex]) {
      return;
    }
    this._meshManager.viewObjectHighlightedChanged(viewObject);
  }

  /**
   * Notifies that a {@link viewing!viewer.ViewObject | ViewObject}'s selection flag changed.
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public viewObjectSelectedChanged(viewObject: ViewObject): void {
    if (!this._rendererViewsList[viewObject.layer.view.viewIndex]) {
      return;
    }
    this._meshManager.viewObjectSelectedChanged(viewObject);
  }

  /**
   * Notifies that a {@link viewing!viewer.ViewObject | ViewObject}'s colorize state changed.
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public viewObjectColorizeChanged(viewObject: ViewObject): void {
    if (!this._rendererViewsList[viewObject.layer.view.viewIndex]) {
      return;
    }
    this._meshManager.viewObjectColorizeChanged(viewObject);
  }

  /**
   * Notifies that a {@link viewing!viewer.ViewObject | ViewObject}'s opacity override changed.
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public viewObjectOpacityChanged(viewObject: ViewObject): void {
    if (viewObject.layer.view.viewIndex >= this._rendererViewsList.length) {
      return;
    }
    this._meshManager.viewObjectOpacityChanged(viewObject);
  }

  /**
   * Notifies that a {@link viewing!viewer.ViewObject | ViewObject}'s pickable flag changed.
   * Forwards to {@link MeshManager} to queue GPU updates.
   * @param viewObject
   */
  public viewObjectPickableChanged(viewObject: ViewObject): void {
    if (viewObject.layer.view.viewIndex >= this._rendererViewsList.length) {
      return;
    }
    this._meshManager.viewObjectPickableChanged(viewObject);
  }

  /**
   * Notifies that the camera view matrix was updated.
   * Forwards to {@link MeshManager} to update camera-dependent GPU state.
   */
  public cameraViewMatrixUpdated(camera: Camera): void {
    if (!this._rendererViewsList[camera.view.viewIndex]) {
      return;
    }
    this._meshManager.cameraViewMatrixUpdated(camera);
  }

  /**
   * Performs a pick operation in the given view with the specified parameters.
   * Forwards to {@link PickManager}.
   * @param view
   * @param pickParams
   */
  pick(view: View, pickParams: PickParams): SDKResult<PickResult> {

    const rendererView = this._rendererViews[view.id];
    if (!rendererView) { // This is handled at a higher level, but just in case
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[ViewManager.pick] View not found with id ${view.id}`
      };
    }

    const changingActiveView = this._activeView !== rendererView;

    this._gpuMemoryManager.uploadChanges();

    this._activateView(rendererView);

    const changed = this._alignCanvasToView(rendererView);
    if (changed.sizeChanged || changed.resolutionScaleChanged) {
      this._activeViewNeedsRenderAfterAlignment = false;
    }

    if (changingActiveView) {
      this._renderManager.render(rendererView, {clear: true});
    }

    const pickResult = this._pickManager.pick(rendererView, pickParams);
    if (pickResult.ok === false) return pickResult;

    // Snap is an enrichment of the pick — runs only when the caller
    // asked for it AND we have a renderable RGBA32F snap target.
    const wantSnap =
      (pickParams.snapToVertex !== false || pickParams.snapToEdge !== false) &&
      (pickParams.snapToVertex || pickParams.snapToEdge) &&
      !!pickParams.canvasPos;
    if (wantSnap && this._snapManager) {
      let snapResult;
      try {
        snapResult = this._snapManager.snapPick(rendererView, pickParams);
      } catch (e) {
        console.warn("[WebGLRenderer] snapPick threw — falling back to surface pick:", e);
        return pickResult;
      }
      if (snapResult.ok && snapResult.value) {
        // Fold snap fields onto the surface pick when one exists,
        // so the caller gets a single PickResult with both the
        // ViewObject pick and the snapped world position; otherwise
        // return the snap-only result.
        //
        // Assign `viewObject` on the snap result before reading its
        // public getters — `snappedToVertex` / `snappedToEdge` /
        // `worldPos` are all gated on `viewObject !== null`, and
        // SnapManager doesn't know which ViewObject owns the snapped
        // texel. The surface pick under the cursor is the best
        // available proxy: a vertex within `snapRadius` pixels of
        // the cursor almost always belongs to the same object.
        const snap = snapResult.value;
        const surfaceObj = pickResult.value ? pickResult.value.viewObject ?? null : null;
        if (surfaceObj) {
          snap.viewObject = surfaceObj;
        }
        if (pickResult.value) {
          const out = pickResult.value;
          out.worldPos = snap.worldPos;
          out.snappedToVertex = snap.snappedToVertex;
          out.snappedToEdge = snap.snappedToEdge;
          out.snappedCanvasPos = snap.snappedCanvasPos;
          return {ok: true, value: out};
        }
        return {ok: true, value: snap};
      }
    }
    return pickResult;
  }

  /**
   * Destroys all renderer-managed resources and detaches from the {@link viewing!viewer.Viewer | Viewer}.
   *
   * After calling this, the instance must not be used unless {@link init} is called again.
   *
   * @remarks
   * - Destroys all {@link ViewRenderState}s, then tears down managers in reverse dependency order.
   * - Sets internal references to `undefined` to help catch use-after-destroy in development.
   */
  public destroy(): void {
    this._removeCanvasAlignmentListeners();
    this._lastCanvasLayout = null;

    const rendererViews = this._rendererViewsList.slice();
    for (const rendererView of rendererViews) {
      this.viewDestroyed(rendererView.view);
    }

    this._rendererViews = {};
    this._rendererViewsList = [];
    this._activeView = undefined as unknown as ViewRenderState;

    this._snapManager?.destroy();
    this._pickManager?.destroy();
    this._renderManager?.destroy();
    this._meshManager?.destroy();
    this._gpuMemoryManager?.destroy();

    this._snapManager = undefined as unknown as SnapManager;
    this._pickManager = undefined as unknown as PickManager;
    this._renderManager = undefined as unknown as RenderManager;
    this._meshManager = undefined as unknown as MeshManager;
    this._gpuMemoryManager = undefined as unknown as GPUMemoryManager;

    this._renderContext?.destroy();
    this._renderContext = undefined as unknown as RenderContext;
    this._viewer = undefined as unknown as Viewer;
    this.dataTextures = undefined as unknown as DataTextures;
    this.shaderInspector = undefined as unknown as ShaderInspector;
  }

}
