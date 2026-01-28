import {EventEmitter, SDKErrorType, SDKInternalException, type SDKResult} from "../core";
import type {Viewer} from "../viewer";
import {ViewManager} from "./viewManager/ViewManager";
import {EventDispatcher} from "strongly-typed-events";
import {getWebGLExtension} from "../webglutils";
import {type Capabilities} from "./Capabilities";
import {type WebGLRendererEvents} from "./WebGLRendererEvents";
import {type MemoryConfigs} from "./MemoryConfigs";
import {createMemoryConfigs} from "./createMemoryConfigs";
import {type MemoryUsage} from "./MemoryUsage";
import {type MemoryView} from "./internal/MemoryView";
import {type DataTextures} from "./viewManager/gpuMemoryManager/DataTextures";
import {SceneGeometry, SceneMesh} from "../scene";
import { View} from "../viewer";
import {ShaderView} from "./internal";
import {type PickParams} from "./PickParams";
import {type PickResult} from "./PickResult";

/**
 * WebGL renderer backing a {@link Viewer}.
 *
 * {@link WebGLRenderer} owns and manages the WebGL rendering pipeline for a Viewer.
 * It is responsible for:
 * - Attaching to and detaching from a Viewer
 * - Initializing and tearing down internal rendering state when a Scene is present
 * - Responding to Viewer and Scene events by updating GPU-resident data
 * - Exposing capabilities and GPU memory inspection APIs for diagnostics and tooling
 *
 * See {@link "webglrenderer" | @xeokit/webglrenderer} for usage.
 */
export class WebGLRenderer {

  private _viewer: Viewer | null = null; // The currently attached Viewer

  /**
   * Manages views and their rendering lifecycle - only exists when a
   * Viewer with a Scene is attached to the renderer.
   *
   * The ViewManager core is a central part of the renderer’s internal state,
   * managing views, batches, and GPU resources. It only exists while
   * a Viewer with an attached Scene is present.
   *
   * This API is exposed on the renderer for internal developer docs and debugging/telemetry only
   * and is **not** covered by semantic versioning. It may change or be removed
   * at any time.
   *
   * @internal
   */
   _viewManager: ViewManager;

  private _viewerSubs: (() => void)[];
  private _viewManagerSubs: (() => void)[];
  private _destroyed = false; // Indicates if the renderer has been destroyed

  /**
   * Enables or disables logging of errors to the console.
   */
  public logging: boolean = true;

  /**
   * Events emitted by this renderer.
   *
   * These events describe lifecycle transitions (Viewer attachment, rendering start/stop),
   * WebGL context issues, and error reporting.
   */
  public events: WebGLRendererEvents = {

    /**
     * Emitted after a {@link Viewer} has been attached via {@link attachViewer}.
     */
    onViewerAttached: new EventEmitter(new EventDispatcher<WebGLRenderer, Viewer>()),

    /**
     * Emitted after the currently attached {@link Viewer} has been detached.
     */
    onViewerDetached: new EventEmitter(new EventDispatcher<WebGLRenderer, Viewer>()),

    /**
     * Emitted when the renderer begins rendering.
     *
     * Rendering starts when a Viewer is attached and has an active Scene,
     * and the renderer’s internal rendering state has been successfully initialized.
     */
    onRendererStarted: new EventEmitter(new EventDispatcher<WebGLRenderer, void>()),

    /**
     * Emitted when the renderer stops rendering.
     *
     * Rendering stops when the Scene is detached or when the renderer’s internal
     * rendering state is torn down.
     */
    onRendererStopped: new EventEmitter(new EventDispatcher<WebGLRenderer, void>()),

    /**
     * Emitted when {@link destroy} is called and the renderer transitions to
     * the destroyed state.
     */
    onRendererDestroyed: new EventEmitter(new EventDispatcher<WebGLRenderer, boolean>()),

    /**
     * Emitted when the underlying WebGL context is lost.
     *
     * At this point, the renderer’s internal state is not valid.
     */
    webglContextLost: new EventEmitter(new EventDispatcher<WebGLRenderer, WebGLContextEvent>()),

    /**
     * Emitted when the underlying WebGL context is restored.
     *
     * At this point, the renderer will have automatically reinitialized its internal state and
     * resumed rendering.
     */
    webglContextRestored: new EventEmitter(new EventDispatcher<WebGLRenderer, void>()),

    /**
     * Emitted when an error occurs within the renderer.
     *
     * Errors are also logged to the console when {@link logging} is enabled.
     */
    onError: new EventEmitter(
      new EventDispatcher<
        WebGLRenderer,
        {
          ok: false;
          type: SDKErrorType;
          error: string;
        }
        >()
    ),
  };

  private readonly _memoryConfigs: MemoryConfigs;
  private readonly _memoryView: MemoryView;
  private _shaderView: ShaderView;

  /**
   * Constructs a new {@link WebGLRenderer}.
   *
   * If a {@link Viewer} is provided, the renderer immediately attempts to attach to it.
   * Any errors encountered during attachment are emitted via {@link events.onError}.
   *
   * @param params.viewer Optional Viewer to attach during construction.
   * @param params.memoryConfigs Optional overrides for GPU memory budgeting and allocation behavior.
   */
  constructor(params: {
    viewer?: Viewer,
    memoryConfigs?: Partial<MemoryConfigs>,
    debugging?: boolean
  } = {}) {
    this._memoryView = {
      dataTextures: null, // Populated when rendering starts
      getViewAtIndex: (viewIndex: number): View|null => {
        return this._viewManager ? this._viewManager.getViewAtIndex(viewIndex) : null;
      },
      getGeometryAtIndex: (batchIndex: number, geometryIndex: number): SceneGeometry|null => {
        return this._viewManager ? this._viewManager.getGeometryAtIndex(batchIndex, geometryIndex) : null;
      },
      getMeshAtIndex: (batchIndex: number, meshIndex: number): SceneMesh|null => {
        return this._viewManager ? this._viewManager.getMeshAtIndex(batchIndex, meshIndex) : null;
      }
    };
    this._shaderView = null;
    if (params.memoryConfigs) {
      this._memoryConfigs=<MemoryConfigs>{};
      Object.assign(this._memoryConfigs, params.memoryConfigs);
    } else {
      this._memoryConfigs = createMemoryConfigs({
        grossMemoryMB: 2024, // 2GB
        device: "medium", // Assume mid-range device
        utilization: 0.7, // Use 70% of available memory
        user: { // No overrides
        }
      });
    }
    this._debugging = !!params.debugging;
    if (params.viewer) {
      const result = this.attachViewer(params.viewer);
      if (result.ok === false) {
        this.events.onError.dispatch(this, result);
      }
    }
  }

  private _debugging: boolean;

  /**
   * Indicates whether debugging features are enabled.
   *
   * When `true`, the renderer and its components may emit additional events
   * and perform extra checks to facilitate debugging and diagnostics.
   * This may incur performance overhead, so it should be disabled in production.
   */
  public get debugging(): boolean {
    return this._debugging;
  }

  /**
   * Enables or disables debugging features.
   *
   * When `true`, the renderer and its components may emit additional events
   * and perform extra checks to facilitate debugging and diagnostics.
   */
  public set debugging(value: boolean) {
    this._debugging = value;
    if (this._viewManager) {
 //     this._viewManager.debugging = value;
    }
  }

  /**
   * Retrieves the capabilities of the WebGLRenderer.
   * Populates the provided `Capabilities` object with information about supported
   * WebGL features, such as texture compression formats and WebGL2 support.
   *
   * @param capabilities The object to populate with capability information.
   */
  public getCapabilities(capabilities: Capabilities): void {
    capabilities.maxViews = 4; // Maximum number of views supported
    const testCanvas = document.createElement("canvas");
    const gl = testCanvas.getContext("webgl2") as WebGL2RenderingContext | null;
    if (!gl) {
      capabilities.webgl2Supported = false;
      return;
    }
    capabilities.webgl2Supported = true;
    capabilities.astcSupported = !!getWebGLExtension(gl, "WEBGL_compressed_texture_astc");
    capabilities.etc1Supported = true; // WebGL
    capabilities.etc2Supported = !!getWebGLExtension(gl, "WEBGL_compressed_texture_etc");
    capabilities.dxtSupported = !!getWebGLExtension(gl, "WEBGL_compressed_texture_s3tc");
    capabilities.bptcSupported = !!getWebGLExtension(gl, "EXT_texture_compression_bptc");
    capabilities.pvrtcSupported =
      !!getWebGLExtension(gl, "WEBGL_compressed_texture_pvrtc") ||
      !!getWebGLExtension(gl, "WEBKIT_WEBGL_compressed_texture_pvrtc");
  }

  /**
   * Retrieves the GPU memory configuration used by this WebGLRenderer.
   */
  public getMemoryConfigs(): MemoryConfigs {
    return this._memoryConfigs;
  }

  /**
   * Returns the renderer’s current GPU memory usage summary.
   *
   * When the renderer is not actively rendering (no attached Viewer with a Scene),
   * this returns zero usage.
   */
  public getMemoryUsage(): MemoryUsage {
    if (!this._viewManager) {
      return {
        allocatedMB: 0,
        usedMB: 0
      };
    }
    return this._viewManager.getMemoryUsage();
  }

  /**
   * Returns a read-only view of GPU-resident data used by the renderer.
   *
   * This API is intended for diagnostics, debugging tools, and monitoring UIs.
   * The returned object exposes structured access to {@link DataTextures} while
   * rendering is active.
   *
   * @internal
   * @returns `{ ok: true, value }` when a Viewer with an attached Scene is present;
   * otherwise `{ ok: false }` with {@link SDKErrorType.InvalidOperation}.
   */
  public getMemoryView(): SDKResult<MemoryView>  {
    if (!this._viewManager) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[WebGLRenderer.getMemoryView] Failed to get MemoryView - no Viewer with Scene is currently attached."
      });
    }
    return {
      ok: true,
      value: this._memoryView
    };
  }

  /**
   * Returns a debug view of program shaders used by the renderer.
   *
   * This API is intended for diagnostics, debugging tools, and monitoring UIs.
   *
   * @internal
   * @returns `{ ok: true, value }` when a Viewer with an attached Scene is present;
   * otherwise `{ ok: false }` with {@link SDKErrorType.InvalidOperation}.
   */
  public getShaderView(): SDKResult<ShaderView>  {
    if (!this._viewManager) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[WebGLRenderer.getShaderView] Failed to get ShaderView - no Viewer with Scene is currently attached."
      });
    }
    return {
      ok: true,
      value: this._shaderView
    };
  }

  /**
   * Logs an error result to the console and dispatches an `onError` event.
   *
   * @internal
   * @param result The error result to log and dispatch.
   * @returns The same error result for chaining or further handling.
   */
  private logError(result: SDKResult<any>): SDKResult<any> {
    if (result && result.ok === false) {
      if (this.logging) {
        console.error(`[WebGLRenderer] ${result.error}`);
      }
      this.events.onError.dispatch(this, {
        ok: false,
        type: result.type,
        error: `[WebGLRenderer] ${result.error}`
      });
    }
    return result;
  }

  /**
   * Attaches a {@link Viewer} to this renderer.
   *
   * If the Viewer already has an active Scene, the renderer immediately initializes
   * its internal rendering state and begins rendering. Otherwise, rendering begins
   * once a Scene is attached to the Viewer.
   *
   * @param viewer Viewer to attach.
   * @returns Success or failure. Attaching while another Viewer is already attached is an error.
   */
  public attachViewer(viewer: Viewer): SDKResult<void> {

    if (this._viewer) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[WebGLRenderer.attachViewer] Failed to attach Viewer - a Viewer is already attached."
      });
    }

    this._viewer = viewer;

    const viewerEvents = viewer.events;

    this._viewerSubs = [
      viewerEvents.onSceneAttached.subscribe((viewer, scene) => {
        const result = this._createViewManager();
        if (result.ok === false) {
          return this.logError({
            ok: false,
            type: result.type,
            error: `[WebGLRenderer] Failed to attach Viewer - ${result.error}`
          });
        }
        this.events.onRendererStarted.dispatch(this);
      }),
      viewerEvents.onSceneDetached.subscribe((viewer, scene) => {
        this._destroyViewManager();
      }),
      viewerEvents.onViewerDestroyed.subscribe((_viewer, _args) => {
        this.detachViewer();
      })
    ];

    if (viewer.scene) {
      const result = this._createViewManager();
      if (result.ok === false) {
        return this.logError({
          ok: false,
          type: result.type,
          error: `[WebGLRenderer.attachViewer] Failed to attach Viewer - ${result.error}`
        });
      }
      this.events.onViewerAttached.dispatch(this, this._viewer);
      this.events.onRendererStarted.dispatch(this);
    } else {
      this.events.onViewerAttached.dispatch(this, this._viewer);
    }

    return {
      ok: true,
      value: undefined
    };
  }

  private _createViewManager(): SDKResult<void> {

    if (this._viewManager) {
      throw new SDKInternalException("[WebGLRenderer._createViewManager] ViewManager already exists.");
    }

    if (!this._viewer) {
      throw new SDKInternalException("[WebGLRenderer._createViewManager] No Viewer attached.");
    }

    this._viewManager = new ViewManager();

    const result = this._viewManager.init({
      viewer: this._viewer,
      memoryConfigs: this._memoryConfigs,
      debugging: this._debugging
    });

    if (result.ok === false) {
      this._viewManager.destroy();
      this._viewManager = undefined as unknown as ViewManager;
      this._memoryView.dataTextures= null;
      return result;
    }

    // Subscribing to critical and non-critical events for rendering lifecycle management

    const viewManager = this._viewManager;
    const sceneEvents = this._viewer.scene.events;
    const viewerEvents = this._viewer.events;

    this._viewManagerSubs = [

      // Scene components creation/destruction
      // Log errors from these calls

      sceneEvents.onSceneModelCreated.subscribe((_, sceneModel) => this.logError(viewManager.sceneModelCreated(sceneModel))),
      sceneEvents.onSceneModelDestroyed.subscribe((_, sceneModel) => this.logError(viewManager.sceneModelDestroyed(sceneModel))),

      sceneEvents.onSceneGeometryCreated.subscribe((_, sceneGeometry) => this.logError(viewManager.sceneGeometryCreated(sceneGeometry))),
      sceneEvents.onSceneGeometryDestroyed.subscribe((_, sceneGeometry) => this.logError(viewManager.sceneGeometryDestroyed(sceneGeometry))),

      sceneEvents.onSceneMeshCreated.subscribe((_, sceneMesh) => this.logError(viewManager.sceneMeshCreated(sceneMesh))),
      sceneEvents.onSceneMeshDestroyed.subscribe((_, sceneMesh) => this.logError(viewManager.sceneMeshDestroyed(sceneMesh))),

      sceneEvents.onSceneObjectCreated.subscribe((_, sceneObject) => this.logError(viewManager.sceneObjectCreated(sceneObject))),
      sceneEvents.onSceneObjectDestroyed.subscribe((_, sceneObject) => this.logError(viewManager.sceneObjectDestroyed(sceneObject))),

      // View and ViewObject creation/destruction
      // Log errors from these calls

      viewerEvents.onViewCreated.subscribe((_, view) => this.logError(viewManager.viewCreated(view))),
      viewerEvents.onViewUpdated.subscribe((_, view) => this.logError(viewManager.viewUpdated(view))), // View ready to re-render
      viewerEvents.onViewDestroyed.subscribe((_, view) => this.logError(viewManager.viewDestroyed(view))),

      // SceneMesh and SceneTransform state changes

      sceneEvents.onSceneMeshGeometryChanged.subscribe((_, sceneMesh) => viewManager.sceneMeshGeometryChanged(sceneMesh)),
    //  sceneEvents.onSceneMeshVisibilityChanged.subscribe((_, sceneMesh) => viewManager.sceneMeshVisibilityChanged(sceneMesh)),
      sceneEvents.onSceneMeshMatrixChanged.subscribe((_, sceneMesh) => viewManager.sceneMeshMatrixChanged(sceneMesh)),
      sceneEvents.onSceneMeshColorChanged.subscribe((_, sceneMesh) => viewManager.sceneMeshColorChanged(sceneMesh)),
      sceneEvents.onSceneMeshOpacityChanged.subscribe((_, sceneMesh) => viewManager.sceneMeshOpacityChanged(sceneMesh)),
      sceneEvents.onSceneTransformMatrixChanged.subscribe((_, sceneMesh) => viewManager.sceneTransformMatrixChanged(sceneMesh)),

      sceneEvents.onSceneObjectMeshAdded.subscribe((sceneObject, sceneMesh) => this.logError(viewManager.sceneObjectMeshAdded(sceneObject, sceneMesh))),
      sceneEvents.onSceneObjectMeshRemoved.subscribe((sceneObject, sceneMesh) => this.logError(viewManager.sceneObjectMeshRemoved(sceneObject, sceneMesh))),

      // ViewObject visual state changes

      viewerEvents.onViewObjectVisibleChanged.subscribe((view, viewObject) => viewManager.viewObjectVisibilityChanged(viewObject)),
      viewerEvents.onViewObjectXRayedChanged.subscribe((view, viewObject) => viewManager.viewObjectXRayedChanged(viewObject)),
      viewerEvents.onViewObjectHighlightedChanged.subscribe((view, viewObject) => viewManager.viewObjectHighlightedChanged(viewObject)),
      viewerEvents.onViewObjectSelectedChanged.subscribe((view, viewObject) => viewManager.viewObjectSelectedChanged(viewObject)),
      viewerEvents.onViewObjectColorizeChanged.subscribe((view, viewObject) => viewManager.viewObjectColorizeChanged(viewObject)),
      viewerEvents.onViewObjectOpacityChanged.subscribe((view, viewObject) => viewManager.viewObjectOpacityChanged(viewObject)),

      // Camera updates

      viewerEvents.onCameraViewMatrixUpdated.subscribe((_, camera) => viewManager.cameraViewMatrixUpdated(camera))
    ];

    this._memoryView.dataTextures= this._viewManager.dataTextures;

    this._shaderView = this._viewManager.shaderView;

    this._viewManager.getWebGLCanvasElement().addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.events.webglContextLost.dispatch(this, event);
    });

    this._viewManager.getWebGLCanvasElement().addEventListener("webglcontextrestored", (event) => {
      const result = this._viewManager.webglContextRestored();
      if (result.ok === false) {
        this.logError({
          ok: false,
          type: result.type,
          error: `[WebGLRenderer] WebGL context restoration failed - ${result.error}`
        });
        return;
      }
      this.events.webglContextRestored.dispatch(this);
    });

    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Retrieves the Viewer currently attached to this WebGLRenderer, if any.
   */
  public get viewer(): Viewer | null {
    return this._viewer;
  }

  /**
   * Indicates whether the renderer is actively rendering.
   *
   * Rendering is considered active when a Viewer with an attached Scene is present
   * and the renderer’s internal rendering state has been initialized.
   */
  public get rendering(): boolean {
    return !!this._viewManager;
  }

  /**
   * Performs a GPU-accelerated pick operation in the specified {@link View}.
   *
   * This method queries the renderer to identify the {@link ViewObject} (and optionally the 3D surface position)
   * at a given canvas coordinate or along a specified world-space ray. Picking is performed using the renderer's
   * internal GPU resources and shaders.
   *
   * @param view The {@link View} in which to perform the pick. Must belong to the currently attached {@link Viewer}.
   * @param pickParams Parameters specifying the pick mode and target (canvas coordinates or world-space ray).
   * @returns An {@link SDKResult} containing the {@link PickResult} on success, or an error result on failure.
   *
   * @remarks
   * - Returns an error if no Viewer with an attached Scene is present, or if the View does not belong to the attached Viewer.
   * - The returned {@link PickResult} is a transient, renderer-owned instance. Its contents are valid only until the next pick operation.
   *   Do not modify or retain the result.
   */
  public pick(view: View, pickParams: PickParams): SDKResult<PickResult> {

    // TODO: Define abstract picking interface, ie. new MyControlThatNeedsPicking(view, renderer as <PickProvider>)
    // Or just configure te likes of MyControlThatNeedsPicking with the renderer.pick.bind(renderer) method, as callback?

    if (!this._viewManager) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[WebGLRenderer.pick] Viewer with Scene is currently attached."
      });
    }
    if (view.viewer !== this._viewer) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[WebGLRenderer.pick] The specified View does not belong to the currently attached Viewer."
      });
    }
    return this._viewManager.pick(view, pickParams);
  }

  /**
   * Detaches the currently attached {@link Viewer}, if any.
   *
   * If rendering is active, this also tears down the renderer’s internal rendering state
   * before emitting lifecycle events.
   */
  public detachViewer(): void {
    if (!this._viewer) {
      return;
    }
    if (this._viewManager) {
      this._destroyViewManager();
    }
    for (const sub of this._viewerSubs) {
      sub();
    }
    this._viewerSubs = [];
    const viewer = this._viewer;
    this._viewer = undefined as unknown as Viewer;
    this.events.onViewerDetached.dispatch(this, viewer);
  }

  private _destroyViewManager(): void {
    if (!this._viewManager) {
      return;
    }
    for (const sub of this._viewManagerSubs) {
      sub();
    }
    this._viewManagerSubs = [];
    this._viewManager.destroy();
    this._viewManager = undefined as unknown as ViewManager;
    this.events.onRendererStopped.dispatch(this);
  }

  /**
   * Destroys this renderer instance.
   *
   * Detaches any attached Viewer, releases internal resources and subscriptions,
   * and emits {@link events.onRendererDestroyed}. After this call, the instance
   * should be considered unusable.
   */
  public destroy(): void {
    if (this._destroyed) {
      return;
    }
    if (this._viewer) {
      this.detachViewer();
    }
    this._destroyed = true;
    this.events.onRendererDestroyed.dispatch(this, true);
  }
}
