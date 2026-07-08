import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {
  SceneGeometry,
  SceneMaterial,
  SceneMesh,
  SceneModel,
  SceneObject,
  SceneTexture,
  SceneTransform
} from "../../../model/scene";
import type {Camera, Effect, PickParams, PickResult, View, Viewer, ViewObject} from "../../viewer";
import type {WebGPUCanvasAlphaMode, WebGPUDeviceLike} from "../core";
import {WebGPUPickManager} from "./pickManager";
import {WebGPUSnapManager} from "./snapManager";
import {WebGPUFrameUniformManager} from "./WebGPUFrameUniformManager";
import {WebGPUGeometryManager} from "./WebGPUGeometryManager";
import {WebGPUInstanceBufferManager} from "./WebGPUInstanceBufferManager";
import {WebGPULightingManager} from "./WebGPULightingManager";
import {WebGPUMeshManager} from "./WebGPUMeshManager";
import {WebGPUPipelineManager} from "./WebGPUPipelineManager";
import {WebGPURenderContext} from "./WebGPURenderContext";
import {WebGPURenderManager} from "./WebGPURenderManager";
import {WebGPUView} from "./WebGPUView";

/**
 * Top-level internal rendering coordinator owned by {@link WebGPURenderer}.
 *
 * The public renderer handles attachment, events, and device lifecycle. This
 * manager mirrors the WebGL renderer composition: it owns lifecycle routing and
 * delegates concrete GPU responsibilities to view, geometry, mesh, pipeline,
 * and render managers.
 *
 * @internal
 */
export class WebGPUViewManager {

  private _viewer: Viewer | null = null;
  private _alphaMode?: WebGPUCanvasAlphaMode;
  private _views: {[viewId: string]: WebGPUView} = {};
  private _renderContext: WebGPURenderContext | null = null;
  private _geometryManager: WebGPUGeometryManager | null = null;
  private _lightingManager: WebGPULightingManager | null = null;
  private _pipelineManager: WebGPUPipelineManager | null = null;
  private _frameUniformManager: WebGPUFrameUniformManager | null = null;
  private _instanceBufferManager: WebGPUInstanceBufferManager | null = null;
  private _meshManager: WebGPUMeshManager | null = null;
  private _renderManager: WebGPURenderManager | null = null;
  private _pickManager: WebGPUPickManager | null = null;
  private _snapManager: WebGPUSnapManager | null = null;

  /**
   * Initializes manager state and uploads existing supported scene meshes.
   */
  public init(params: {
    viewer: Viewer;
    device: WebGPUDeviceLike;
    contextFormat: string;
    alphaMode?: WebGPUCanvasAlphaMode;
  }): SDKResult<void> {
    this._viewer = params.viewer;
    this._alphaMode = params.alphaMode;
    this._renderContext = new WebGPURenderContext({
      device: params.device,
      contextFormat: params.contextFormat
    });
    this._geometryManager = new WebGPUGeometryManager(this._renderContext);
    this._lightingManager = new WebGPULightingManager();
    this._pipelineManager = new WebGPUPipelineManager(this._renderContext);
    this._frameUniformManager = new WebGPUFrameUniformManager({
      renderContext: this._renderContext,
      pipelineManager: this._pipelineManager,
      lightingManager: this._lightingManager
    });
    this._instanceBufferManager = new WebGPUInstanceBufferManager(this._renderContext);
    this._meshManager = new WebGPUMeshManager({
      geometryManager: this._geometryManager
    });
    this._snapManager = new WebGPUSnapManager();
    this._pickManager = new WebGPUPickManager({
      snapManager: this._snapManager
    });
    this._renderManager = new WebGPURenderManager({
      renderContext: this._renderContext,
      pipelineManager: this._pipelineManager,
      meshManager: this._meshManager,
      frameUniformManager: this._frameUniformManager,
      instanceBufferManager: this._instanceBufferManager
    });
    const renderManagerResult = this._renderManager.init();
    if (renderManagerResult.ok === false) {
      return this._failInit(renderManagerResult);
    }

    const views = this._viewer.viewList;
    for (let i = 0, len = views.length; i < len; i++) {
      const view = views[i];
      if (!view) {
        continue;
      }
      const result = this._createView(view);
      if (result.ok === false) {
        return this._failInit(result);
      }
    }

    const sceneResult = this._registerExistingSceneMeshes();
    if (sceneResult.ok === false) {
      return this._failInit(sceneResult);
    }

    for (const viewId in this._views) {
      const result = this._renderView(this._views[viewId].view);
      if (result.ok === false) {
        return this._failInit(result);
      }
    }

    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Releases all WebGPU resources owned by this manager.
   */
  public destroy(): void {
    this._pickManager?.destroy();
    this._snapManager?.destroy();
    this._renderManager?.destroy();
    this._meshManager?.destroyAll();
    this._geometryManager?.destroyAll();
    this._pipelineManager?.destroy();

    for (const viewId of Object.keys(this._views)) {
      this._views[viewId].destroy();
    }

    this._views = {};
    this._renderManager = null;
    this._meshManager = null;
    this._instanceBufferManager = null;
    this._frameUniformManager = null;
    this._pickManager = null;
    this._snapManager = null;
    this._pipelineManager = null;
    this._lightingManager = null;
    this._geometryManager = null;
    this._renderContext = null;
    this._viewer = null;
  }

  /**
   * Registers and immediately renders a newly created View.
   */
  public viewCreated(view: View): SDKResult<void> {
    const result = this._createView(view);
    if (result.ok === false) {
      return result;
    }
    return this._renderView(view);
  }

  /**
   * Renders a View that the Viewer marked dirty.
   */
  public viewUpdated(view: View): SDKResult<void> {
    if (!this._views[view.id]) {
      return this._ok();
    }
    return this._renderView(view);
  }

  /**
   * Releases state for a removed View.
   */
  public viewDestroyed(view: View): void {
    const webgpuView = this._views[view.id];
    if (!webgpuView) {
      return;
    }
    this._renderManager?.viewDestroyed(view.id);
    this._meshManager?.viewDestroyed(view);
    webgpuView.destroy();
    delete this._views[view.id];
  }

  /**
   * Registers a newly created SceneMesh if it is supported by the current path.
   */
  public sceneMeshCreated(sceneMesh: SceneMesh): SDKResult<void> {
    const meshManager = this._meshManager;
    if (!meshManager) {
      return this._notInitialized("sceneMeshCreated");
    }
    const result = meshManager.sceneMeshCreated(sceneMesh);
    if (result.ok) {
      this._requestRenderAllViews();
    }
    return result;
  }

  /**
   * Registers meshes from a newly created SceneModel.
   */
  public sceneModelCreated(sceneModel: SceneModel): SDKResult<void> {
    const meshManager = this._meshManager;
    if (!meshManager) {
      return this._notInitialized("sceneModelCreated");
    }
    const result = meshManager.sceneModelCreated(sceneModel);
    if (result.ok) {
      this._requestRenderAllViews();
    }
    return result;
  }

  /**
   * Releases state for meshes from a destroyed SceneModel.
   */
  public sceneModelDestroyed(sceneModel: SceneModel): SDKResult<void> {
    const meshManager = this._meshManager;
    if (!meshManager) {
      return this._notInitialized("sceneModelDestroyed");
    }
    const result = meshManager.sceneModelDestroyed(sceneModel);
    if (result.ok) {
      this._requestRenderAllViews();
    }
    return result;
  }

  /**
   * A newly created SceneGeometry is uploaded when its first renderable mesh is
   * registered.
   */
  public sceneGeometryCreated(sceneGeometry: SceneGeometry): SDKResult<void> {
    const meshManager = this._meshManager;
    if (!meshManager) {
      return this._notInitialized("sceneGeometryCreated");
    }
    return meshManager.sceneGeometryCreated(sceneGeometry);
  }

  /**
   * Releases state for a removed SceneMesh and requests a redraw.
   */
  public sceneMeshDestroyed(sceneMesh: SceneMesh): SDKResult<void> {
    const meshManager = this._meshManager;
    if (!meshManager) {
      return this._notInitialized("sceneMeshDestroyed");
    }
    const result = meshManager.sceneMeshDestroyed(sceneMesh);
    if (result.ok) {
      this._requestRenderAllViews();
    }
    return result;
  }

  /**
   * Releases state for a removed SceneGeometry and requests a redraw.
   */
  public sceneGeometryDestroyed(sceneGeometry: SceneGeometry): SDKResult<void> {
    const meshManager = this._meshManager;
    if (!meshManager) {
      return this._notInitialized("sceneGeometryDestroyed");
    }
    const result = meshManager.sceneGeometryDestroyed(sceneGeometry);
    if (result.ok) {
      this._requestRenderAllViews();
    }
    return result;
  }

  /**
   * Rebuilds WebGPU buffers for meshes that reference an updated geometry.
   */
  public sceneGeometryUpdated(sceneGeometry: SceneGeometry): SDKResult<void> {
    const meshManager = this._meshManager;
    if (!meshManager) {
      return this._notInitialized("sceneGeometryUpdated");
    }
    const result = meshManager.sceneGeometryUpdated(sceneGeometry);
    if (result.ok) {
      this._requestRenderAllViews();
    }
    return result;
  }

  /**
   * Registers meshes from a newly created SceneObject.
   */
  public sceneObjectCreated(sceneObject: SceneObject): SDKResult<void> {
    const meshManager = this._meshManager;
    if (!meshManager) {
      return this._notInitialized("sceneObjectCreated");
    }
    const result = meshManager.sceneObjectCreated(sceneObject);
    if (result.ok) {
      this._requestRenderAllViews();
    }
    return result;
  }

  /**
   * Requests redraws after a SceneObject is destroyed.
   */
  public sceneObjectDestroyed(sceneObject: SceneObject): SDKResult<void> {
    const meshManager = this._meshManager;
    if (!meshManager) {
      return this._notInitialized("sceneObjectDestroyed");
    }
    const result = meshManager.sceneObjectDestroyed(sceneObject);
    if (result.ok) {
      this._requestRenderAllViews();
    }
    return result;
  }

  /**
   * Registers a mesh newly attached to an object and requests a redraw.
   */
  public sceneObjectMeshAdded(sceneObject: SceneObject, sceneMesh: SceneMesh): SDKResult<void> {
    const meshManager = this._meshManager;
    if (!meshManager) {
      return this._notInitialized("sceneObjectMeshAdded");
    }
    const result = meshManager.sceneObjectMeshAdded(sceneObject, sceneMesh);
    if (result.ok) {
      this._requestRenderAllViews();
    }
    return result;
  }

  /**
   * Requests redraws after a mesh is removed from an object.
   */
  public sceneObjectMeshRemoved(sceneObject: SceneObject, sceneMesh: SceneMesh): SDKResult<void> {
    const meshManager = this._meshManager;
    if (!meshManager) {
      return this._notInitialized("sceneObjectMeshRemoved");
    }
    const result = meshManager.sceneObjectMeshRemoved(sceneObject, sceneMesh);
    if (result.ok) {
      this._requestRenderAllViews();
    }
    return result;
  }

  /**
   * Requests redraws after scene mesh state changes.
   */
  public sceneMeshChanged(): void {
    this._requestRenderAllViews();
  }

  public sceneMeshMatrixChanged(sceneMesh: SceneMesh): void {
    this._meshManager?.sceneMeshMatrixChanged(sceneMesh);
    this._requestRenderAllViews();
  }

  public sceneMeshMoved(sceneMesh: SceneMesh): void {
    this._meshManager?.sceneMeshMoved(sceneMesh);
    this._requestRenderAllViews();
  }

  public sceneMeshColorChanged(sceneMesh: SceneMesh): void {
    this._meshManager?.sceneMeshColorChanged(sceneMesh);
    this._requestRenderAllViews();
  }

  public sceneMeshOpacityChanged(sceneMesh: SceneMesh): void {
    this._meshManager?.sceneMeshOpacityChanged(sceneMesh);
    this._requestRenderAllViews();
  }

  public sceneMaterialPatternChanged(sceneMaterial: SceneMaterial): void {
    this._meshManager?.sceneMaterialPatternChanged(sceneMaterial);
    this._requestRenderAllViews();
  }

  public sceneMaterialColorChanged(sceneMaterial: SceneMaterial): void {
    this._meshManager?.sceneMaterialColorChanged(sceneMaterial);
    this._requestRenderAllViews();
  }

  public sceneMaterialEmissiveColorChanged(sceneMaterial: SceneMaterial): void {
    this._meshManager?.sceneMaterialEmissiveColorChanged(sceneMaterial);
    this._requestRenderAllViews();
  }

  public sceneMaterialOpacityChanged(sceneMaterial: SceneMaterial): void {
    this._meshManager?.sceneMaterialOpacityChanged(sceneMaterial);
    this._requestRenderAllViews();
  }

  public sceneTextureImageDataChanged(sceneTexture: SceneTexture): void {
    void sceneTexture;
    this._requestRenderAllViews();
  }

  public sceneTransformMatrixChanged(sceneTransform: SceneTransform): void {
    this._meshManager?.sceneTransformMatrixChanged(sceneTransform);
    this._requestRenderAllViews();
  }

  public effectCreated(effect: Effect): SDKResult<void> {
    void effect;
    return this._ok();
  }

  public effectDestroyed(effect: Effect): SDKResult<void> {
    void effect;
    return this._ok();
  }

  /**
   * Requests a redraw after a ViewObject state change affects rendering.
   */
  public viewObjectChanged(viewObject: ViewObject): void {
    if (viewObject.view.viewer !== this._viewer) {
      return;
    }
    if (!this._views[viewObject.view.id]) {
      return;
    }
    this._meshManager?.viewObjectChanged(viewObject);
    viewObject.view.needsRender();
  }

  public viewObjectVisibilityChanged(viewObject: ViewObject): void {
    this.viewObjectChanged(viewObject);
  }

  public viewObjectClippableChanged(viewObject: ViewObject): void {
    this.viewObjectChanged(viewObject);
  }

  public viewObjectCulledChanged(viewObject: ViewObject): void {
    this.viewObjectChanged(viewObject);
  }

  public viewObjectXRayedChanged(viewObject: ViewObject): void {
    this.viewObjectChanged(viewObject);
  }

  public viewObjectHighlightedChanged(viewObject: ViewObject): void {
    this.viewObjectChanged(viewObject);
  }

  public viewObjectSelectedChanged(viewObject: ViewObject): void {
    this.viewObjectChanged(viewObject);
  }

  public viewObjectColorizeChanged(viewObject: ViewObject): void {
    this.viewObjectChanged(viewObject);
  }

  public viewObjectOpacityChanged(viewObject: ViewObject): void {
    this.viewObjectChanged(viewObject);
  }

  public viewObjectPickableChanged(viewObject: ViewObject): void {
    this.viewObjectChanged(viewObject);
  }

  public cameraViewMatrixUpdated(camera: Camera): void {
    this._meshManager?.cameraViewMatrixUpdated(camera);
    camera.view.needsRender();
  }

  /**
   * Performs renderer-backed picking for a View.
   */
  public pick(view: View, pickParams: PickParams): SDKResult<PickResult> {
    if (view.viewer !== this._viewer) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[WebGPUViewManager.pick] The specified View does not belong to the currently attached Viewer."
      };
    }

    const pickManager = this._pickManager;
    if (!pickManager) {
      return this._notInitialized("pick");
    }

    return pickManager.pick(view, pickParams);
  }

  private _failInit<T>(result: SDKResult<T>): SDKResult<T> {
    this.destroy();
    return result;
  }

  private _createView(view: View): SDKResult<void> {
    if (this._views[view.id]) {
      return {
        ok: true,
        value: undefined
      };
    }

    const result = WebGPUView.create(view, this._alphaMode);
    if (result.ok === false) {
      return result;
    }
    this._views[view.id] = result.value;

    return {
      ok: true,
      value: undefined
    };
  }

  private _registerExistingSceneMeshes(): SDKResult<void> {
    const scene = this._viewer?.scene;
    const models = scene?.models;
    if (!models) {
      return {
        ok: true,
        value: undefined
      };
    }
    const meshManager = this._meshManager;
    if (!meshManager) {
      return this._notInitialized("_registerExistingSceneMeshes");
    }
    for (const modelId in models) {
      const meshes = models[modelId]?.meshes;
      if (!meshes) {
        continue;
      }
      for (const meshId in meshes) {
        const result = meshManager.registerSceneMesh(meshes[meshId]);
        if (result.ok === false) {
          return result;
        }
      }
    }
    return {
      ok: true,
      value: undefined
    };
  }

  private _renderView(view: View): SDKResult<void> {
    if (!this._viewer?.scene) {
      return {
        ok: true,
        value: undefined
      };
    }

    if (view.viewer !== this._viewer) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[WebGPUViewManager._renderView] The specified View does not belong to the currently attached Viewer."
      };
    }

    const webgpuView = this._views[view.id];
    if (!webgpuView) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[WebGPUViewManager._renderView] View '${view.id}' is not registered with the renderer.`
      };
    }

    const renderManager = this._renderManager;
    if (!renderManager) {
      return this._notInitialized("_renderView");
    }

    return renderManager.renderView(webgpuView);
  }

  private _requestRenderAllViews(): void {
    if (!this._viewer) {
      return;
    }
    const views = this._viewer.viewList;
    for (let i = 0, len = views.length; i < len; i++) {
      views[i]?.needsRender?.();
    }
  }

  private _ok(): SDKResult<void> {
    return {
      ok: true,
      value: undefined
    };
  }

  private _notInitialized<T>(method: string): SDKResult<T> {
    return {
      ok: false,
      type: SDKErrorType.InvalidOperation,
      error: `[WebGPUViewManager.${method}] WebGPU view manager is not initialized.`
    };
  }
}
