import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {SceneGeometry, SceneMesh} from "../../../model/scene";
import type {View, Viewer, ViewObject} from "../../viewer";
import type {WebGPUCanvasAlphaMode, WebGPUDeviceLike} from "../core";
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
    this._renderManager = new WebGPURenderManager({
      renderContext: this._renderContext,
      pipelineManager: this._pipelineManager,
      meshManager: this._meshManager,
      frameUniformManager: this._frameUniformManager,
      instanceBufferManager: this._instanceBufferManager
    });

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
    const result = meshManager.registerSceneMesh(sceneMesh);
    if (result.ok) {
      this._requestRenderAllViews();
    }
    return result;
  }

  /**
   * Releases state for a removed SceneMesh and requests a redraw.
   */
  public sceneMeshDestroyed(sceneMesh: SceneMesh): void {
    this._meshManager?.destroyMeshState(sceneMesh);
    this._requestRenderAllViews();
  }

  /**
   * Releases state for a removed SceneGeometry and requests a redraw.
   */
  public sceneGeometryDestroyed(sceneGeometry: SceneGeometry): void {
    this._meshManager?.destroyGeometryState(sceneGeometry);
    this._requestRenderAllViews();
  }

  /**
   * Requests redraws after scene mesh state changes.
   */
  public sceneMeshChanged(): void {
    this._requestRenderAllViews();
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
    viewObject.view.needsRender();
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

  private _notInitialized<T>(method: string): SDKResult<T> {
    return {
      ok: false,
      type: SDKErrorType.InvalidOperation,
      error: `[WebGPUViewManager.${method}] WebGPU view manager is not initialized.`
    };
  }
}
