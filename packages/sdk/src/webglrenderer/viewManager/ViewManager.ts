import {RenderContext} from "./RenderContext";
import {Camera, type PickParams,  PickResult, View, Viewer, ViewObject} from "../../viewer";
import {SDKInternalException, SDKErrorType, type SDKResult} from "../../core";
import {ViewRenderState} from "./ViewRenderState";
import {RenderManager} from "./renderManager";
import {PickManager} from "./pickManager";
import {GPUMemoryManager} from "./gpuMemoryManager";
import {MeshManager} from "./meshManager";
import {type GPUMemoryReader} from "./gpuMemoryManager";
import {SceneGeometry, SceneMesh, SceneModel, SceneObject} from "../../scene";
import {SceneTransform} from "../../scene/SceneTransform";
import {type MemoryConfigs} from "../MemoryConfigs";
import type {DataTextures} from "./gpuMemoryManager/DataTextures";
import {ShaderView} from "../internal";

/**
 * Top-level, internal rendering and pipeline manager within a {@link WebGLRenderer}.
 *
 * @remarks
 * - `ViewManager` is owned by a single {@link WebGLRenderer} instance.
 * - It manages all {@link View}s for a given {@link Viewer}.
 * - Acts as the central coordinator for per-View state, rendering, and GPU resource management.
 * - Owns and initializes the shared WebGL {@link RenderContext} and its underlying canvas element.
 * - Instantiates and wires together the core pipeline managers:
 *   - {@link GPUMemoryManager}: Manages GPU-side storage, data textures, and memory uploads for all views.
 *   - {@link MeshManager}: Bridges scene/view state changes (transforms, colors, visibility, etc.) into GPU-ready render state for all views.
 *   - {@link RenderManager}: Executes draw passes for the currently active view, managing the render pipeline.
 *   - {@link PickManager}: Handles GPU-backed picking resources and queries for all views.
 * - Tracks and manages {@link ViewRenderState} instances for each {@link View}, synchronizing per-view state and resources.
 * - Handles view activation, moving/resizing the shared WebGL canvas to match the active view element, and snapshotting the previous view as needed.
 * - Exposes the set of GPU-backed data textures (via {@link dataTextures}) for diagnostics.
 *
 * ## Architectural Role
 * - The {@link WebGLRenderer} owns a single `ViewManager`.
 * - The `ViewManager` manages all {@link View}s for the associated {@link Viewer}, supporting multi-view rendering.
 * - It owns and coordinates all pipeline managers, ensuring that scene and view changes are efficiently reflected in GPU state and draw calls.
 * - All per-view rendering, picking, and GPU resource management flows through the `ViewManager` and its managers.
 *
 * ## Lifecycle
 * 1. Constructed by {@link WebGLRenderer}.
 * 2. Initialized via {@link init} with a {@link Viewer} and memory configs.
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
  public shaderView: ShaderView;

  /** The owning {@link Viewer} instance. Set during {@link init}. */
  private _viewer: Viewer;

  /** Shared WebGL context wrapper and resources. */
  private _renderContext: RenderContext;

  /** Map of view id -> renderer view wrapper.
   * @internal
   */
   _rendererViews: Record<string, ViewRenderState> = {};

  /** Ordered list of renderer views, aligned with {@link View.viewIndex}. */
  private _rendererViewsList: ViewRenderState[] = [];

  /**
   * Currently active renderer view.
   *
   * The WebGL canvas is positioned/sized to this view’s HTML element.
   *
   * @internal
   */
  public _activeView: ViewRenderState;

  /** Executes draw passes for the active view.
   * @internal
   */
  public _renderManager: RenderManager;

  /** Manages GPU picking resources and queries.
   * @internal
   */
  public _pickManager: PickManager;

  /** Owns GPU-side geometry/mesh buffers and data-texture uploads.
   * @internal
   */
  public _gpuMemoryManager: GPUMemoryManager;

  /**
   * Translates scene/view changes into GPU uploads (transforms, colors, flags, etc.).
   * @internal
   */
  public _meshManager: MeshManager;

  /**
   * Constructs a {@link ViewManager}.
   *
   * This constructor does not allocate GPU resources. Call {@link init} before use.
   */
  constructor() {
  }

  /**
   * Initializes the manager and all underlying pipeline components for a given {@link Viewer}.
   *
   * A separate init method is used so initialization can fail gracefully via {@link SDKResult}
   * rather than throwing.
   *
   * @param params.viewer - The viewer whose {@link Viewer.viewList} will be managed.
   * @param params.memoryConfigs - Memory configuration used to create {@link RenderContext}.
   * @param params.debugging - Enables additional debugging behavior in the render context.
   *
   * @returns {@link SDKResult} that is `ok: true` when initialization succeeds, or `ok: false`
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
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[ViewManager.init] Maximum number of Views exceeded - max allowed is 4`
      };
    }

    this._renderContext = new RenderContext(params.memoryConfigs);

    this._renderContext.debugging = !!params.debugging;

    const resultCtx = this._renderContext.init(viewer);
    if (resultCtx.ok === false) {
      return resultCtx;
    }

    this._gpuMemoryManager = new GPUMemoryManager(this._renderContext);

    const resultGPU = this._gpuMemoryManager.init();
    if (resultGPU.ok === false) {
      return resultGPU;
    }

    this.dataTextures = this._gpuMemoryManager.dataTextures;

    this._meshManager = new MeshManager(this._renderContext, this._gpuMemoryManager);

    const resultMesh = this._meshManager.init();
    if (resultMesh.ok === false) {
      return resultMesh;
    }

    this._renderManager = new RenderManager({
      renderContext: this._renderContext,
      meshManager: this._meshManager,
      gpuMemoryReader: this._gpuMemoryManager as GPUMemoryReader
    });

    const resultRender = this._renderManager.init();
    if (resultRender.ok === false) {
      return resultRender;
    }

    this.shaderView = new ShaderView(this._renderManager.drawOps);

    this._pickManager = new PickManager({
      renderContext: this._renderContext,
      meshManager: this._meshManager,
      gpuMemoryManager: this._gpuMemoryManager
    });

    const resultPick = this._pickManager.init();
    if (resultPick.ok === false) {
      return resultPick;
    }

    for (const view of viewer.viewList) {
      const result = this.viewCreated(view);
      if (!result.ok) {
        return result;
      }
    }

    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Returns the shared WebGL canvas element used to render the active view.
   *
   * @throws {@link SDKInternalException} If the manager has not been initialized.
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
   * @throws {@link SDKInternalException} If the manager has not been initialized.
   */
  webglContextRestored(): SDKResult<void> {
    if (!this._gpuMemoryManager || !this._renderManager || !this._pickManager) {
      throw new SDKInternalException("[ViewManager.webglContextRestored] ViewManager is not initialized");
    }
    const resultGPU = this._gpuMemoryManager.webglContextRestored();
    if (resultGPU.ok === false) {
      return resultGPU;
    }
    const resultRender = this._renderManager.webglContextRestored();
    if (resultRender.ok === false) {
      return resultRender;
    }
    const resultPick = this._pickManager.webglContextRestored();
    if (resultPick.ok === false) {
      return resultPick;
    }
    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Returns current GPU memory usage statistics for the renderer.
   *
   * @throws {@link SDKInternalException} If the manager has not been initialized.
   */
  getMemoryUsage() {
    if (!this._gpuMemoryManager) {
      throw new SDKInternalException("[ViewManager.getMemoryUsage] ViewManager is not initialized");
    }
    return this._gpuMemoryManager.getMemoryUsage();
  }

  /**
   * Returns the {@link View} at a given index in the internal view list.
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
   * @returns The {@link SceneGeometry} if present, otherwise `null`.
   */
  public getGeometryAtIndex(batchIndex: number, geometryIndex: number): SceneGeometry | null {
    return this._gpuMemoryManager.getGeometryAtIndex(batchIndex, geometryIndex);
  }

  /**
   * Returns a scene mesh by (batchIndex, meshIndex) as stored in GPU memory.
   *
   * @param batchIndex - Mesh batch index managed by {@link GPUMemoryManager}.
   * @param meshIndex - Mesh index within the batch.
   * @returns The {@link SceneMesh} if present, otherwise `null`.
   */
  public getMeshAtIndex(batchIndex: number, meshIndex: number): SceneMesh | null {
    return this._gpuMemoryManager.getMeshAtIndex(batchIndex, meshIndex);
  }

  /**
   * The {@link Viewer} currently managed by this instance.
   *
   * @remarks Only valid after {@link init} succeeds.
   */
  public get viewer(): Viewer {
    return this._viewer;
  }

  /**
   * Registers a newly created {@link View} with the renderer.
   *
   * Creates a {@link ViewRenderState} wrapper and assigns {@link View.viewIndex}.
   *
   * @param view - The view to add.
   * @returns {@link SDKResult} indicating success or failure.
   *
   * @throws {@link SDKInternalException} If the given view id is already registered.
   */
  public viewCreated(view: View): SDKResult<any> {
    if (this._rendererViews[view.id]) {
      throw new SDKInternalException("[ViewManager.viewCreated] Can't add additional View to WebGLRenderer - View already added");
    }
    if (this._rendererViewsList.length >= 4) { // TODO: Capabilities.maxViews
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[ViewManager.viewCreated] Maximum number of Views exceeded - max allowed is 4`
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
   * Applies updates for a {@link View} and renders it.
   *
   * This will activate the view if it is not currently active, upload any queued GPU changes,
   * and issue a render.
   *
   * @param view - The view to update and render.
   * @returns {@link SDKResult} from the render call, or `ok:false` if the view is not registered.
   */
  public viewUpdated(view: View): SDKResult<any> {
    const rendererView = this._rendererViews[view.id];
    if (!rendererView) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[ViewManager.viewUpdated] View not found with id ${view.id}`
      };
    }
    if (this._activeView !== rendererView) {
      this._activateView(rendererView);
    }
    this._gpuMemoryManager.uploadChanges();
    return this._renderManager.render(rendererView, {clear: true});
  }

  /**
   * Makes the given renderer view the active view.
   *
   * Implementation detail:
   * - If there is a previously active view, it is rendered into its "snapshot" render buffer and
   *   the resulting image is written into the previous view’s HTML element (assumed to be an
   *   {@link HTMLImageElement}).
   * - The shared WebGL canvas is then positioned and resized to match the target view element.
   *
   * @param rendererView - The renderer view to activate.
   */
  private _activateView(rendererView: ViewRenderState): void {
    const activeRendererView = this._activeView;
    if (activeRendererView) {
      const activeCanvasBoundingRect = activeRendererView.view.htmlElement.getBoundingClientRect();
      const primarySnapshotBuffer = activeRendererView.renderBuffers.getRenderBuffer("snapshot", {
        depthTexture: false,
        size: [activeCanvasBoundingRect.width, activeCanvasBoundingRect.height]
      });
      primarySnapshotBuffer.bind();
      primarySnapshotBuffer.clear();
      this._renderManager.render(rendererView, {clear: true});
      const image = primarySnapshotBuffer.readImage({
        format: "png",
        height: activeCanvasBoundingRect.height,
        width: activeCanvasBoundingRect.width
      });
      primarySnapshotBuffer.unbind();
      (<HTMLImageElement>activeRendererView.view.htmlElement).src = image;
    }
    const view = rendererView.view;
    const htmlElement = view.htmlElement;
    const boundingRect = htmlElement.getBoundingClientRect();
    const webglCanvasElement = this._renderContext.webglCanvasElement;
    webglCanvasElement.style["left"] = `${boundingRect.left}px`;
    webglCanvasElement.style["top"] = `${boundingRect.top}px`;
    webglCanvasElement.style["width"] = `${boundingRect.width}px`;
    webglCanvasElement.style["height"] = `${boundingRect.height}px`;
    webglCanvasElement.width = boundingRect.width;
    webglCanvasElement.height = boundingRect.height;
    webglCanvasElement.style["z-tileIndex"] = 100000;
    this._activeView = rendererView;
  }

  /**
   * Unregisters a {@link View} and releases its associated rendering resources.
   *
   * @param view - The view to remove.
   * @returns {@link SDKResult} indicating success, or `ok:false` if the view was not registered.
   */
  public viewDestroyed(view: View): SDKResult<any> {
    const rendererView = this._rendererViews[view.id];
    if (!rendererView) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[ViewManager.viewDestroyed] View not found with id ${view.id}`
      };
    }
    rendererView.destroy();
    delete this._rendererViews[view.id];
    this._rendererViewsList = this._rendererViewsList.filter(rv => rv !== rendererView);
    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Notifies the renderer that a {@link SceneModel} was created.
   *
   * Forwards to {@link MeshManager} to allocate and upload required GPU structures.
   */
  public sceneModelCreated(sceneModel: SceneModel): SDKResult<any> {
    return this._meshManager.sceneModelCreated(sceneModel);
  }

  /**
   * Notifies the renderer that a {@link SceneModel} was destroyed.
   *
   * Forwards to {@link MeshManager} to release associated GPU structures.
   */
  public sceneModelDestroyed(sceneModel: SceneModel): SDKResult<any> {
    return this._meshManager.sceneModelDestroyed(sceneModel);
  }

  /**
   * Notifies the renderer that a {@link SceneGeometry} was created.
   * @param sceneGeometry
   */
  sceneGeometryCreated(sceneGeometry: SceneGeometry) : SDKResult<any> {
    return this._meshManager.sceneGeometryCreated(sceneGeometry);
  }

  /**
   * Notifies the renderer that a {@link SceneGeometry} was destroyed.
   * @param sceneGeometry
   */
  sceneGeometryDestroyed(sceneGeometry: SceneGeometry) : SDKResult<any> {
    return this._meshManager.sceneGeometryDestroyed(sceneGeometry);
  }

  /**
   * Notifies the renderer that a {@link SceneMesh} was created.
   *
   * Forwards to {@link MeshManager} to allocate and upload required GPU structures.
   */
  sceneMeshCreated(sceneMesh: SceneMesh) : SDKResult<any> {
    return this._meshManager.sceneMeshCreated(sceneMesh);
  }

  /**
   * Notifies the renderer that a {@link SceneMesh} was destroyed.
   *
   * Forwards to {@link MeshManager} to release associated GPU structures.
   */
  sceneMeshDestroyed(sceneMesh: SceneMesh) : SDKResult<any> {
    return this._meshManager.sceneMeshDestroyed(sceneMesh);
  }

  /**
   * Notifies the renderer that a {@link SceneObject} was created.
   *
   * Forwards to {@link MeshManager} to create/track renderable state.
   */
  public sceneObjectCreated(sceneObject: SceneObject): SDKResult<any> {
    return this._meshManager.sceneObjectCreated(sceneObject);
  }

  /**
   * Notifies the renderer that a {@link SceneObject} was destroyed.
   *
   * Forwards to {@link MeshManager} to release renderable state.
   */
  public sceneObjectDestroyed(sceneObject: SceneObject): SDKResult<any> {
    return this._meshManager.sceneObjectDestroyed(sceneObject);
  }

  /**
   * Notifies that a {@link SceneObject} had a {@link SceneMesh} added.
   * @param sceneObject
   * @param sceneMesh
   */
  sceneObjectMeshAdded(sceneObject: SceneObject, sceneMesh: SceneMesh): SDKResult<any> {
    return this._meshManager.sceneObjectMeshAdded(sceneObject, sceneMesh);
  }

  /**
   * Notifies that a {@link SceneObject} had a {@link SceneMesh} removed.
   * @param sceneObject
   * @param sceneMesh
   */
  sceneObjectMeshRemoved(sceneObject: SceneObject, sceneMesh: SceneMesh): SDKResult<any> {
    return this._meshManager.sceneObjectMeshRemoved(sceneObject, sceneMesh);
  }

  // Mesh and Transform state uploads, not requiring error handling

  sceneMeshGeometryChanged(sceneMesh: SceneMesh) {
  }

  /**
   * Notifies that a {@link SceneMesh}'s world matrix changed (eg. moved/rotated/scaled).
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public sceneMeshMatrixChanged(sceneMesh: SceneMesh): void {
    this._meshManager.sceneMeshMatrixChanged(sceneMesh);
  }

  /**
   * Notifies that a {@link SceneMesh}'s base color changed.
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public sceneMeshColorChanged(sceneMesh: SceneMesh): void {
    this._meshManager.sceneMeshColorChanged(sceneMesh);
  }

  /**
   * Notifies that a {@link SceneMesh}'s opacity changed.
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public sceneMeshOpacityChanged(sceneMesh: SceneMesh): void {
    this._meshManager.sceneMeshOpacityChanged(sceneMesh);
  }

  /**
   * Notifies that a {@link SceneTransform}'s matrix changed.
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public sceneTransformMatrixChanged(sceneMesh: SceneTransform): void {
    this._meshManager.sceneTransformMatrixChanged(sceneMesh);
  }

  /**
   * Notifies that a {@link ViewObject}'s visibility flag changed.
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public viewObjectVisibilityChanged(viewObject: ViewObject): void {
    this._meshManager.viewObjectVisibilityChanged(viewObject);
  }

  /**
   * Notifies that a {@link ViewObject}'s x-ray flag changed.
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public viewObjectXRayedChanged(viewObject: ViewObject): void {
    this._meshManager.viewObjectXRayedChanged(viewObject);
  }

  /**
   * Notifies that a {@link ViewObject}'s highlight flag changed.
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public viewObjectHighlightedChanged(viewObject: ViewObject): void {
    this._meshManager.viewObjectHighlightedChanged(viewObject);
  }

  /**
   * Notifies that a {@link ViewObject}'s selection flag changed.
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public viewObjectSelectedChanged(viewObject: ViewObject): void {
    this._meshManager.viewObjectSelectedChanged(viewObject);
  }

  /**
   * Notifies that a {@link ViewObject}'s colorize state changed.
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public viewObjectColorizeChanged(viewObject: ViewObject): void {
    this._meshManager.viewObjectColorizeChanged(viewObject);
  }

  /**
   * Notifies that a {@link ViewObject}'s opacity override changed.
   * Forwards to {@link MeshManager} to queue GPU updates.
   */
  public viewObjectOpacityChanged(viewObject: ViewObject): void {
    this._meshManager.viewObjectOpacityChanged(viewObject);
  }

  /**
   * Notifies that the camera view matrix was updated.
   * Forwards to {@link MeshManager} to update camera-dependent GPU state.
   */
  public cameraViewMatrixUpdated(camera: Camera): void {
    this._meshManager.cameraViewMatrixUpdated(camera);
  }

  /**
   * Performs a pick operation in the given view with the specified parameters.
   * Forwards to {@link PickManager}.
   * @param view
   * @param pickParams
   */
  pick(view: View, pickParams: PickParams) : SDKResult<PickResult>{
    const rendererView = this._rendererViews[view.id];
    if (!rendererView) { // This is handled at a higher level, but just in case
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[ViewManager.pick] View not found with id ${view.id}`
      };
    }
    return this._pickManager.pick(rendererView, pickParams);
  }

  /**
   * Destroys all renderer-managed resources and detaches from the {@link Viewer}.
   *
   * After calling this, the instance must not be used unless {@link init} is called again.
   *
   * @remarks
   * - Destroys all {@link ViewRenderState}s, then tears down managers in reverse dependency order.
   * - Sets internal references to `undefined` to help catch use-after-destroy in development.
   */
  public destroy(): void {
    const viewer = this._renderContext.viewer;
    for (let viewIndex = 0; viewIndex < viewer.numViews; viewIndex++) {
      this.viewDestroyed(viewer.viewList[viewIndex]);
    }
    this._rendererViews = {};
    this._pickManager?.destroy();
    this._renderManager?.destroy();
    this._meshManager?.destroy();
    this._gpuMemoryManager?.destroy();
    this._pickManager = undefined as unknown as PickManager;
    this._renderManager = undefined as unknown as RenderManager;
    this._meshManager = undefined as unknown as MeshManager;
    this._gpuMemoryManager = undefined as unknown as GPUMemoryManager;
    this._renderContext.destroy();
    this._viewer = undefined as unknown as Viewer;
    this.dataTextures = undefined as unknown as DataTextures;
    this.shaderView = undefined as unknown as ShaderView;
  }


}
