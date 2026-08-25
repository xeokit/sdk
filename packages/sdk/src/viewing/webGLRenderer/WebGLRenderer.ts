import {EventEmitter, SDKErrorType, SDKInternalException, type SDKResult} from "../../base/core";
import type {Viewer} from "../viewer";
import {View} from "../viewer";
import {ViewManager} from "./internal/ViewManager";
import {EventDispatcher} from "strongly-typed-events";
import {getWebGLExtension} from "./internal/webGL";
import {type Capabilities} from "./Capabilities";
import {type WebGLRendererEvents} from "./WebGLRendererEvents";
import {type MemoryConfigs} from "./MemoryConfigs";
import {type MemoryUsage} from "./MemoryUsage";
import {type RendererGPUResources} from "./internal/gpuMemoryManager";
import {SceneGeometry, SceneMesh, type SceneModel, type SceneModelBatch, type SceneObject} from "../../model/scene";
import {ShaderInspector, RenderInspector, type MemoryInspector} from "./internal/inspectors";
import {type PickParams, type PickResult} from "../viewer";
import {createDefaultMemoryConfigs} from "./defaultMemoryConfigs";
import {MarkerOcclusionTester} from "./MarkerOcclusionTester";
import type {MarkerOcclusionTesterParams} from "./MarkerOcclusionTesterParams";
import type {Renderer} from "../renderer";

interface DeferredSceneModelRegistrations {
  geometries: Set<SceneGeometry>;
  meshes: Set<SceneMesh>;
  objects: Set<SceneObject>;
}

/**
 * WebGL renderer backing a {@link viewing!viewer.Viewer | Viewer}.
 *
 * {@link WebGLRenderer} owns and manages the WebGL rendering pipeline for a Viewer.
 * It is responsible for:
 * - Attaching to and detaching from a Viewer
 * - Initializing and tearing down internal rendering state when a Scene is present
 * - Responding to Viewer and Scene events by updating GPU-resident data
 * - Exposing capabilities and GPU memory inspection APIs for diagnostics and tooling
 *
 * See {@link "webGLRenderer" | @xeokit/webGLRenderer} for usage.
 */
export class WebGLRenderer implements Renderer {

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
  private _viewManager: ViewManager;

  private _viewerSubs: (() => void)[];
  private _viewManagerSubs: (() => void)[];
  private _webglContextCanvas: HTMLCanvasElement | null = null;
  private _webglContextLostHandler: ((event: Event) => void) | null = null;
  private _webglContextRestoredHandler: ((event: Event) => void) | null = null;
  private _webglContextRestorePoll: ReturnType<typeof setTimeout> | null = null;
  private _webglContextRestoreAttempts = 0;
  private _webglContextLost = false;
  private _destroyed = false; // Indicates if the renderer has been destroyed

  // Number of SceneModels currently building (loading). While > 0, per-view
  // renders are suspended so a load doesn't repaint + re-upload the partial
  // model on every mid-load frame; one render runs when it returns to 0.
  private _renderSuspendCount = 0;

  /**
   * Scene component creation events deferred while a {@link SceneModel} is
   * building. Flushed in geometry -> mesh -> object order when that model
   * finishes so loaders do not pay renderer registration work on every
   * intermediate create call.
   */
  private _deferredSceneModelRegistrations: Map<SceneModel, DeferredSceneModelRegistrations> = new Map();

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
     * Emitted after a {@link viewing!viewer.Viewer | Viewer} has been attached via {@link attachViewer}.
     */
    onViewerAttached: new EventEmitter(new EventDispatcher<WebGLRenderer, Viewer>()),

    /**
     * Emitted after the currently attached {@link viewing!viewer.Viewer | Viewer} has been detached.
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
     * Emitted when the renderer has rendered a new frame for a {@link viewing!viewer.View | View} belonging to the attached {@link viewing!viewer.Viewer | Viewer}.
     */
    onViewRendered: new EventEmitter(new EventDispatcher<WebGLRenderer, View>()),

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
     * Backend-neutral alias for {@link webglContextLost}.
     */
    onContextLost: new EventEmitter(new EventDispatcher<WebGLRenderer, Event>()),

    /**
     * Emitted when the underlying WebGL context is restored.
     *
     * At this point, the renderer will have automatically reinitialized its internal state and
     * resumed rendering.
     */
    webglContextRestored: new EventEmitter(new EventDispatcher<WebGLRenderer, void>()),

    /**
     * Backend-neutral alias for {@link webglContextRestored}.
     */
    onContextRestored: new EventEmitter(new EventDispatcher<WebGLRenderer, void>()),

    /**
     * Emitted when an error occurs within the renderer.
     *
     * Errors are also logged to the console when {@link logging} is enabled.
     */
    onError: new EventEmitter(
      new EventDispatcher<WebGLRenderer,
        {
          ok: false;
          type: SDKErrorType;
          error: string;
        }>()
    ),
  };

  private readonly _memoryConfigs: MemoryConfigs;
  private readonly _memoryInspector: MemoryInspector;
  private _shaderInspector: ShaderInspector;
  private _drawInspector: RenderInspector | null;

  /**
   * Constructs a new {@link WebGLRenderer}.
   *
   * If a {@link viewing!viewer.Viewer | Viewer} is provided, the renderer immediately attempts to attach to it.
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
    this._memoryInspector = {
      gpuResources: null, // Populated when rendering starts
      dataTextures: null, // Backwards-compatible alias for gpuResources
      getViewAtIndex: (viewIndex: number): View | null => {
        return this._viewManager ? this._viewManager.getViewAtIndex(viewIndex) : null;
      },
      getGeometryAtIndex: (batchIndex: number, geometryIndex: number): SceneGeometry | null => {
        return this._viewManager ? this._viewManager.getGeometryAtIndex(batchIndex, geometryIndex) : null;
      },
      getMeshAtIndex: (batchIndex: number, meshIndex: number): SceneMesh | null => {
        return this._viewManager ? this._viewManager.getMeshAtIndex(batchIndex, meshIndex) : null;
      }
    };
    this._shaderInspector = null;
    this._drawInspector = null;
    this._memoryConfigs = createDefaultMemoryConfigs(params.memoryConfigs);
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
   * Forces a WebGL context loss and automatic restore, for testing the
   * renderer's context-restore path.
   *
   * Uses the `WEBGL_lose_context` debug extension to drop the context (firing
   * `webglcontextlost` → resource teardown) and, after `restoreDelayMs`,
   * restore it (firing `webglcontextrestored` → GPU resources rebuilt from the
   * scene). No-op when the extension is unavailable.
   *
   * @param restoreDelayMs Milliseconds to stay lost before restoring. Default 1000.
   * @returns `true` if the loss was triggered, `false` if unsupported.
   */
  public loseContext(restoreDelayMs = 1000): boolean {
    if (!this._viewManager) {
      return false;
    }
    const canvas = this._viewManager.getWebGLCanvasElement();
    const gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
    const ext = gl && gl.getExtension("WEBGL_lose_context");
    if (!ext) {
      this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[WebGLRenderer.loseContext] WEBGL_lose_context extension unavailable"
      });
      return false;
    }
    ext.loseContext();
    setTimeout(() => ext.restoreContext(), restoreDelayMs);
    return true;
  }


  /**
   * Returns a read-only view of GPU-resident data used by the renderer.
   *
   * This API is intended for diagnostics, debugging tools, and monitoring UIs.
   * The returned object exposes structured access to {@link RendererGPUResources} while
   * rendering is active.
   *
   * @internal
   * @returns `{ ok: true, value }` when a Viewer with an attached Scene is present;
   * otherwise `{ ok: false }` with {@link SDKErrorType.InvalidOperation}.
   */
  public getMemoryInspector(): SDKResult<MemoryInspector> {
    if (!this._viewManager) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[WebGLRenderer.getMemoryInspector] Failed to get MemoryInspector - no Viewer with Scene is currently attached."
      });
    }
    return {
      ok: true,
      value: this._memoryInspector
    };
  }

  /**
   * Returns a inspectors view of program shaders used by the renderer.
   *
   * This API is intended for diagnostics, debugging tools, and monitoring UIs.
   *
   * @internal
   * @returns `{ ok: true, value }` when a Viewer with an attached Scene is present;
   * otherwise `{ ok: false }` with {@link SDKErrorType.InvalidOperation}.
   */
  public getShaderInspector(): SDKResult<ShaderInspector> {
    if (!this._viewManager) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[WebGLRenderer.getShaderInspector] Failed to get ShaderInspector - no Viewer with Scene is currently attached."
      });
    }
    return {
      ok: true,
      value: this._shaderInspector
    };
  }

  /**
   * Sets a {@link RenderInspector} to inspect draw calls during rendering.
   * @internal
   */
  public getRenderInspector(): SDKResult<RenderInspector> {
    if (!this._viewManager) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[WebGLRenderer.setDrawLogger] Failed to set RenderInspector - no Viewer with Scene is currently attached."
      });
    }
    return {
      ok: true,
      value: this._viewManager.getRenderInspector()
    };
  }

  /**
   * Enables or disables the renderer-owned infinite ground grid.
   *
   * This is disabled by default for bare renderer use. Studio enables it during
   * initialization for its default scene reference plane.
   */
  public setInfiniteGridEnabled(enabled: boolean): SDKResult<void> {
    if (!this._viewManager) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[WebGLRenderer.setInfiniteGridEnabled] Failed to set infinite grid visibility - no Viewer with Scene is currently attached."
      });
    }
    this._viewManager.setInfiniteGridEnabled(enabled);
    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Returns submitted-geometry stats for a View's most recently
   * completed frame: the total number of draw calls and primitives
   * issued across all render passes (color, shadow cascades, SAO, …).
   *
   * `numPrimitives` is summed from the per-view packed draw ranges, so
   * it reflects visibility and culling — culled meshes drop out of the
   * count. It's the metric to watch to confirm culling is reducing GPU
   * work, since it moves even while the display caps the frame rate.
   * `numDrawCalls`, by contrast, barely changes with culling: this
   * renderer draws a whole batch per call, so culling trims primitives
   * within a draw rather than removing draws.
   *
   * Returns `null` when no Viewer is attached or the render inspector
   * has not recorded a frame for this view yet. The inspector is
   * enabled by {@link studio!Studio | Studio}; in a bare WebGLRenderer
   * setup, enable it first via {@link getRenderInspector}.
   *
   * @param viewIndex - {@link viewing!viewer.View.viewIndex | View.viewIndex}.
   */
  public getViewRenderStats(viewIndex: number): { numDrawCalls: number; numPrimitives: number } | null {
    if (!this._viewManager) {
      return null;
    }
    const frame = this._viewManager.getRenderInspector().renderStats.views?.[viewIndex];
    if (!frame) {
      return null;
    }
    return {numDrawCalls: frame.numDrawCalls, numPrimitives: frame.numPrims};
  }

  /**
   * Diagnostic: read back every mip × face of the GGX-prefiltered IBL
   * cubemap for the given view and tile them onto an HTMLCanvasElement
   * for visual inspection. Returns null when IBL hasn't been
   * initialised for the view, or when the prefilter pipeline isn't
   * allocated.
   *
   * Used to localise IBL artifacts to a specific mip without guessing.
   * Call from the browser console:
   *
   * ```js
   * const c = studio.renderer.debugDumpPrefilteredCubemap(0);
   * document.body.appendChild(c);
   * ```
   *
   * @internal
   */
  public debugDumpPrefilteredCubemap(viewIndex: number = 0): HTMLCanvasElement | null {
    if (!this._viewManager) return null;
    const rm: any = (this._viewManager as any)._renderManager;
    if (!rm) return null;
    const prefilters: Map<number, any> | undefined = rm._iblPrefilters;
    if (!prefilters) return null;
    const pipeline = prefilters.get(viewIndex);
    if (!pipeline || typeof pipeline.debugDumpPrefilteredCubemap !== "function") return null;
    return pipeline.debugDumpPrefilteredCubemap();
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

  private _getDeferredSceneModelRegistrations(sceneModel: SceneModel): DeferredSceneModelRegistrations {
    let registrations = this._deferredSceneModelRegistrations.get(sceneModel);
    if (!registrations) {
      registrations = {
        geometries: new Set(),
        meshes: new Set(),
        objects: new Set(),
      };
      this._deferredSceneModelRegistrations.set(sceneModel, registrations);
    }
    return registrations;
  }

  private _deferSceneGeometryCreated(sceneGeometry: SceneGeometry): boolean {
    const sceneModel = sceneGeometry.model;
    if (!sceneModel.building && !sceneModel.activeBatch?.includesGeometry(sceneGeometry)) {
      return false;
    }
    this._getDeferredSceneModelRegistrations(sceneModel).geometries.add(sceneGeometry);
    return true;
  }

  private _deferSceneMeshCreated(sceneMesh: SceneMesh): boolean {
    const sceneModel = sceneMesh.model;
    if (!sceneModel.building && !sceneModel.activeBatch?.includesMesh(sceneMesh)) {
      return false;
    }
    this._getDeferredSceneModelRegistrations(sceneModel).meshes.add(sceneMesh);
    return true;
  }

  private _deferSceneObjectCreated(sceneObject: SceneObject): boolean {
    const sceneModel = sceneObject.model;
    if (!sceneModel.building && !sceneModel.activeBatch?.includesObject(sceneObject)) {
      return false;
    }
    this._getDeferredSceneModelRegistrations(sceneModel).objects.add(sceneObject);
    return true;
  }

  private _discardDeferredSceneGeometry(sceneGeometry: SceneGeometry): boolean {
    return this._deferredSceneModelRegistrations.get(sceneGeometry.model)?.geometries.delete(sceneGeometry) === true;
  }

  private _discardDeferredSceneMesh(sceneMesh: SceneMesh): boolean {
    return this._deferredSceneModelRegistrations.get(sceneMesh.model)?.meshes.delete(sceneMesh) === true;
  }

  private _discardDeferredSceneObject(sceneObject: SceneObject): boolean {
    return this._deferredSceneModelRegistrations.get(sceneObject.model)?.objects.delete(sceneObject) === true;
  }

  private _flushDeferredSceneModelRegistrations(sceneModel: SceneModel, viewManager: ViewManager, batch?: SceneModelBatch): void {
    const registrations = this._deferredSceneModelRegistrations.get(sceneModel);
    if (!registrations && !batch) {
      return;
    }

    this._deferredSceneModelRegistrations.delete(sceneModel);

    const geometries = new Set<SceneGeometry>([
      ...(registrations?.geometries ?? []),
      ...(batch?.geometries ?? [])
    ]);
    for (const sceneGeometry of geometries) {
      if (!sceneGeometry.destroyed && sceneModel.geometries[sceneGeometry.id] === sceneGeometry) {
        this.logError(viewManager.sceneGeometryCreated(sceneGeometry));
      }
    }

    const sceneMeshes: SceneMesh[] = [];
    const meshes = new Set<SceneMesh>([
      ...(registrations?.meshes ?? []),
      ...(batch?.meshes ?? [])
    ]);
    for (const sceneMesh of meshes) {
      if (!sceneMesh.destroyed && sceneModel.meshes[sceneMesh.id] === sceneMesh) {
        sceneMeshes.push(sceneMesh);
      }
    }
    if (sceneMeshes.length > 0) {
      this.logError(viewManager.sceneMeshesCreated(sceneMeshes));
    }

    const objects = new Set<SceneObject>([
      ...(registrations?.objects ?? []),
      ...(batch?.objects ?? [])
    ]);
    for (const sceneObject of objects) {
      if (!sceneObject.destroyed && sceneModel.objects[sceneObject.id] === sceneObject) {
        this.logError(viewManager.sceneObjectCreated(sceneObject));
      }
    }
  }

  /**
   * Attaches a {@link viewing!viewer.Viewer | Viewer} to this renderer.
   *
   * If the Viewer already has an active Scene, the renderer immediately initializes
   * its internal rendering state and begins rendering. Otherwise, rendering begins
   * once a Scene is attached to the Viewer.
   *
   * @param viewer Viewer to attach.
   * @returns Success or failure. Attaching while another Viewer is already attached is an error.
   */
  attachViewer(viewer: Viewer): SDKResult<void> {

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
        this._rollbackViewerAttach();
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

  private _rollbackViewerAttach(): void {
    for (const sub of this._viewerSubs) {
      sub();
    }
    this._viewerSubs = [];
    this._viewer = null;
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
      this._memoryInspector.gpuResources = null;
      this._memoryInspector.dataTextures = null;
      return result;
    }

    // Subscribing to critical and non-critical events for rendering lifecycle management

    const viewManager = this._viewManager;
    const sceneEvents = this._viewer.scene.events;
    const viewerEvents = this._viewer.events;
    const rendererEvents = this.events;

    this._viewManagerSubs = [

      // Scene components creation/destruction
      // Log errors from these calls

      sceneEvents.onSceneModelCreated.subscribe((_, sceneModel) => this.logError(viewManager.sceneModelCreated(sceneModel))),
      sceneEvents.onSceneModelDestroyed.subscribe((_, sceneModel) => {
        this._deferredSceneModelRegistrations.delete(sceneModel);
        this.logError(viewManager.sceneModelDestroyed(sceneModel));
      }),

      // A SceneModel is being populated by a loader — suspend per-view renders
      // until every concurrently-building model finishes, then render once.
      sceneEvents.onSceneModelBuildStarted.subscribe((_, sceneModel) => {
        this._renderSuspendCount++;
        this._getDeferredSceneModelRegistrations(sceneModel);
      }),
      sceneEvents.onSceneModelBuildFinished.subscribe((_, sceneModel) => {
        this._flushDeferredSceneModelRegistrations(sceneModel, viewManager);
        if (this._renderSuspendCount > 0) {
          this._renderSuspendCount--;
        }
        if (this._renderSuspendCount === 0 && this._viewer) {
          // Re-enter the normal render path once per view (now unsuspended):
          // one uploadChanges + draw showing the fully-assembled model.
          const views = this._viewer.viewList;
          for (let i = 0, len = views.length; i < len; i++) {
            views[i]?.needsRender();
          }
        }
      }),

      sceneEvents.onSceneModelBatchStarted.subscribe((sceneModel) => {
        this._renderSuspendCount++;
        this._getDeferredSceneModelRegistrations(sceneModel);
      }),
      sceneEvents.onSceneModelBatchCommitted.subscribe((sceneModel, batch) => {
        this._flushDeferredSceneModelRegistrations(sceneModel, viewManager, batch);
        if (this._renderSuspendCount > 0) {
          this._renderSuspendCount--;
        }
        if (this._renderSuspendCount === 0 && this._viewer) {
          const views = this._viewer.viewList;
          for (let i = 0, len = views.length; i < len; i++) {
            views[i]?.needsRender();
          }
        }
      }),
      sceneEvents.onSceneModelBatchRolledBack.subscribe((sceneModel) => {
        this._deferredSceneModelRegistrations.delete(sceneModel);
        if (this._renderSuspendCount > 0) {
          this._renderSuspendCount--;
        }
      }),

      sceneEvents.onSceneGeometryCreated.subscribe((_, sceneGeometry) => {
        if (!this._deferSceneGeometryCreated(sceneGeometry)) {
          this.logError(viewManager.sceneGeometryCreated(sceneGeometry));
        }
      }),
      sceneEvents.onSceneGeometryDestroyed.subscribe((_, sceneGeometry) => {
        if (!this._discardDeferredSceneGeometry(sceneGeometry)) {
          this.logError(viewManager.sceneGeometryDestroyed(sceneGeometry));
        }
      }),

      sceneEvents.onSceneMeshCreated.subscribe((_, sceneMesh) => {
        if (!this._deferSceneMeshCreated(sceneMesh)) {
          this.logError(viewManager.sceneMeshCreated(sceneMesh));
        }
      }),
      sceneEvents.onSceneMeshDestroyed.subscribe((_, sceneMesh) => {
        if (!this._discardDeferredSceneMesh(sceneMesh)) {
          this.logError(viewManager.sceneMeshDestroyed(sceneMesh));
        }
      }),

      sceneEvents.onSceneObjectCreated.subscribe((_, sceneObject) => {
        if (!this._deferSceneObjectCreated(sceneObject)) {
          this.logError(viewManager.sceneObjectCreated(sceneObject));
        }
      }),
      sceneEvents.onSceneObjectDestroyed.subscribe((_, sceneObject) => {
        if (!this._discardDeferredSceneObject(sceneObject)) {
          this.logError(viewManager.sceneObjectDestroyed(sceneObject));
        }
      }),
      sceneEvents.onSceneRepSetCreated.subscribe((_, repSet) => this.logError(viewManager.sceneRepSetCreated(repSet))),
      sceneEvents.onSceneRepSetDestroyed.subscribe((_, repSet) => this.logError(viewManager.sceneRepSetDestroyed(repSet))),

      viewerEvents.onEffectCreated.subscribe((_, effect) => this.logError(viewManager.effectCreated(effect))),
      viewerEvents.onEffectDestroyed.subscribe((_, effect) => this.logError(viewManager.effectDestroyed(effect))),

      // View and ViewObject creation/destruction
      // Log errors from these calls

      viewerEvents.onViewCreated.subscribe((_, view) => this.logError(viewManager.viewCreated(view))),
      viewerEvents.onViewUpdated.subscribe((_, view) => {  // View ready to re-render
        if (this._renderSuspendCount > 0) {
          // A model is still building — skip the upload + draw. The View keeps
          // its dirty flag (we never called viewUpdated), so the render fires
          // when the build finishes and re-nudges it.
          return;
        }
        if (this.logError(viewManager.viewUpdated(view)).ok !== false) { // Re-render the View
          rendererEvents.onViewRendered.dispatch(this, view); // Emit event after successful render
        }
      }),
      viewerEvents.onViewDestroyed.subscribe((_, view) => this.logError(viewManager.viewDestroyed(view))),

      // SceneMesh and SceneTransform state changes

      sceneEvents.onSceneMeshMatrixChanged.subscribe((_, sceneMesh) => viewManager.sceneMeshMatrixChanged(sceneMesh)),
      sceneEvents.onSceneMaterialPatternChanged.subscribe((_, sceneMaterial) => viewManager.sceneMaterialPatternChanged(sceneMaterial)),
      sceneEvents.onSceneMaterialColorChanged.subscribe((_, sceneMaterial) => viewManager.sceneMaterialColorChanged(sceneMaterial)),
      sceneEvents.onSceneMaterialEmissiveColorChanged.subscribe((_, sceneMaterial) => viewManager.sceneMaterialEmissiveColorChanged(sceneMaterial)),
      sceneEvents.onSceneMeshColorChanged.subscribe((_, sceneMesh) => viewManager.sceneMeshColorChanged(sceneMesh)),
      sceneEvents.onSceneMeshOpacityChanged.subscribe((_, sceneMesh) => viewManager.sceneMeshOpacityChanged(sceneMesh)),
      sceneEvents.onSceneTextureImageDataChanged.subscribe((_, sceneTexture) => viewManager.sceneTextureImageDataChanged(sceneTexture)),
      sceneEvents.onSceneTransformMatrixChanged.subscribe((_, sceneMesh) => viewManager.sceneTransformMatrixChanged(sceneMesh)),

      sceneEvents.onSceneObjectMeshAdded.subscribe((sceneObject, sceneMesh) => this.logError(viewManager.sceneObjectMeshAdded(sceneObject, sceneMesh))),
      sceneEvents.onSceneObjectMeshRemoved.subscribe((sceneObject, sceneMesh) => this.logError(viewManager.sceneObjectMeshRemoved(sceneObject, sceneMesh))),

      // ViewObject visual state changes

      viewerEvents.onViewObjectVisibleChanged.subscribe((view, viewObject) => viewManager.viewObjectVisibilityChanged(viewObject)),
      viewerEvents.onViewObjectXRayedChanged.subscribe((view, viewObject) => viewManager.viewObjectXRayedChanged(viewObject)),
      viewerEvents.onViewObjectClippableChanged.subscribe((view, viewObject) => viewManager.viewObjectClippableChanged(viewObject)),
      viewerEvents.onViewObjectCulledChanged.subscribe((view, viewObject) => viewManager.viewObjectCulledChanged(viewObject)),
      viewerEvents.onViewObjectHighlightedChanged.subscribe((view, viewObject) => viewManager.viewObjectHighlightedChanged(viewObject)),
      viewerEvents.onViewObjectSelectedChanged.subscribe((view, viewObject) => viewManager.viewObjectSelectedChanged(viewObject)),
      viewerEvents.onViewObjectColorizeChanged.subscribe((view, viewObject) => viewManager.viewObjectColorizeChanged(viewObject)),
      viewerEvents.onViewObjectOpacityChanged.subscribe((view, viewObject) => viewManager.viewObjectOpacityChanged(viewObject)),
      viewerEvents.onViewObjectPickableChanged.subscribe((view, viewObject) => viewManager.viewObjectPickableChanged(viewObject)),

      // Camera updates

      viewerEvents.onCameraViewMatrixUpdated.subscribe((_, camera) => viewManager.cameraViewMatrixUpdated(camera))
    ];

    this._memoryInspector.gpuResources = this._viewManager.gpuResources;
    this._memoryInspector.dataTextures = this._viewManager.gpuResources;

    this._shaderInspector = this._viewManager.shaderInspector;

    this._installWebGLContextListeners(viewManager);

    return {
      ok: true,
      value: undefined
    };
  }

  private _installWebGLContextListeners(viewManager: ViewManager): void {
    this._removeWebGLContextListeners();

    const canvas = viewManager.getWebGLCanvasElement();
    const contextLostHandler = (event: Event) => {
      if (this._viewManager !== viewManager) return;
      // preventDefault is required for the browser to fire webglcontextrestored.
      event.preventDefault();
      if (this._webglContextLost) {
        this._startWebGLContextRestorePolling(viewManager);
        return;
      }
      this._webglContextLost = true;
      // Release GL-backed resources now, while the context is still flagged
      // lost, so their gl.delete* calls are no-ops instead of errors against
      // the restored context.
      viewManager.webglContextLost();
      this.events.onContextLost.dispatch(this, event);
      this.events.webglContextLost.dispatch(this, event as WebGLContextEvent);
      this._startWebGLContextRestorePolling(viewManager);
    };

    const contextRestoredHandler = (_event: Event) => {
      this._restoreWebGLContext(viewManager);
    };

    this._webglContextCanvas = canvas;
    this._webglContextLostHandler = contextLostHandler;
    this._webglContextRestoredHandler = contextRestoredHandler;
    canvas.addEventListener("webglcontextlost", contextLostHandler);
    canvas.addEventListener("webglcontextrestored", contextRestoredHandler);
  }

  private _removeWebGLContextListeners(): void {
    this._stopWebGLContextRestorePolling();
    if (this._webglContextCanvas && this._webglContextLostHandler) {
      this._webglContextCanvas.removeEventListener("webglcontextlost", this._webglContextLostHandler);
    }
    if (this._webglContextCanvas && this._webglContextRestoredHandler) {
      this._webglContextCanvas.removeEventListener("webglcontextrestored", this._webglContextRestoredHandler);
    }
    this._webglContextCanvas = null;
    this._webglContextLostHandler = null;
    this._webglContextRestoredHandler = null;
    this._webglContextLost = false;
  }

  private _restoreWebGLContext(viewManager: ViewManager): void {
    if (this._viewManager !== viewManager) return;
    if (!this._webglContextLost) return;
    this._stopWebGLContextRestorePolling();

    const gl = this._webglContextCanvas?.getContext("webgl2") as WebGL2RenderingContext | null;
    const result = viewManager.webglContextRestored(gl || undefined);
    if (result.ok === false) {
      this._webglContextLost = true;
      this.logError({
        ok: false,
        type: result.type,
        error: `[WebGLRenderer] WebGL context restoration failed - ${result.error}`
      });
      this._startWebGLContextRestorePolling(viewManager);
      return;
    }

    this._webglContextLost = false;
    this._redrawViewsAfterContextRestore(viewManager);
    this._scheduleContextRestoreRedraws(viewManager);
    this.events.onContextRestored.dispatch(this);
    this.events.webglContextRestored.dispatch(this);
  }

  private _redrawViewsAfterContextRestore(viewManager: ViewManager): void {
    if (!this._viewer) return;
    const views = this._viewer.viewList;
    for (let i = 0, len = views.length; i < len; i++) {
      const view = views[i];
      if (!view) continue;
      view.needsRender();
      this.logError(viewManager.viewUpdated(view));
    }
  }

  private _scheduleContextRestoreRedraws(viewManager: ViewManager): void {
    const redraw = () => {
      if (this._viewManager !== viewManager || this._webglContextLost || !this._viewer || this._destroyed) {
        return;
      }
      this._redrawViewsAfterContextRestore(viewManager);
    };

    requestAnimationFrame(() => {
      redraw();
      requestAnimationFrame(redraw);
    });
    setTimeout(redraw, 50);
    setTimeout(redraw, 250);
    setTimeout(redraw, 1000);
  }

  private _startWebGLContextRestorePolling(viewManager: ViewManager): void {
    if (this._webglContextRestorePoll || this._viewManager !== viewManager) {
      return;
    }
    this._webglContextRestoreAttempts = 0;
    this._pollWebGLContextRestore(viewManager);
  }

  private _stopWebGLContextRestorePolling(): void {
    if (this._webglContextRestorePoll) {
      clearTimeout(this._webglContextRestorePoll);
      this._webglContextRestorePoll = null;
    }
    this._webglContextRestoreAttempts = 0;
  }

  private _pollWebGLContextRestore(viewManager: ViewManager): void {
    if (this._viewManager !== viewManager || !this._webglContextLost || !this._webglContextCanvas) {
      this._stopWebGLContextRestorePolling();
      return;
    }

    const gl = this._webglContextCanvas.getContext("webgl2") as WebGL2RenderingContext | null;
    if (gl && !gl.isContextLost()) {
      this._restoreWebGLContext(viewManager);
      return;
    }

    this._webglContextRestoreAttempts++;
    if (gl && this._webglContextRestoreAttempts % 20 === 0) {
      gl.getExtension("WEBGL_lose_context")?.restoreContext();
    }

    this._webglContextRestorePoll = setTimeout(
      () => this._pollWebGLContextRestore(viewManager),
      Math.min(1000, 100 + this._webglContextRestoreAttempts * 25)
    );
  }

  /**
   * Retrieves the Viewer currently attached to this WebGLRenderer, if any.
   */
  get viewer(): Viewer | null {
    return this._viewer;
  }

  /**
   * Indicates whether the renderer is actively rendering.
   *
   * Rendering is considered active when a Viewer with an attached Scene is present
   * and the renderer’s internal rendering state has been initialized.
   */
  get rendering(): boolean {
    return !!this._viewManager;
  }

  /**
   * Performs a GPU-accelerated pick operation in the specified {@link viewing!viewer.View | View}.
   *
   * This method queries the renderer to identify the {@link viewing!viewer.ViewObject | ViewObject} and the 3D surface position
   * at a given canvas coordinate or along a specified world-space ray. Picking is performed using the renderer's
   * internal GPU resources and shaders.
   *
   * @param view The {@link viewing!viewer.View | View} in which to perform the pick. Must belong to the currently attached {@link viewing!viewer.Viewer | Viewer}.
   * @param pickParams Parameters specifying the pick mode and target (canvas coordinates or world-space ray).
   * @returns An {@link base!core.SDKResult | SDKResult} containing the {@link PickResult} on success, or an error result on failure.
   *
   * @remarks
   * - Returns an error if no Viewer with an attached Scene is present, or if the View does not belong to the attached Viewer.
   * - The returned {@link PickResult} is a transient, renderer-owned instance. Its contents are valid only until the next pick operation.
   *  - Do not modify or retain the result.
   */
  pick(view: View, pickParams: PickParams): SDKResult<PickResult> {
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
   * Creates a marker occlusion tester for a {@link viewing!viewer.View | View}.
   *
   * The tester batches world-space marker anchors and reports whether each
   * marker should be shown as a floating UI element. The current implementation
   * uses the scene BVH; `params.mode: "auto"` resolves to that backend.
   *
   * @param view View whose camera and visual object state drive occlusion.
   * @param params Optional filtering, bias, and hysteresis settings.
   */
  createMarkerOcclusionTester(
    view: View,
    params: MarkerOcclusionTesterParams = {}
  ): SDKResult<MarkerOcclusionTester> {
    if (!this._viewManager || !this._viewer?.scene) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[WebGLRenderer.createMarkerOcclusionTester] Viewer with Scene is not currently attached."
      });
    }
    if (view.viewer !== this._viewer) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[WebGLRenderer.createMarkerOcclusionTester] The specified View does not belong to the currently attached Viewer."
      });
    }
    return {
      ok: true,
      value: new MarkerOcclusionTester({view, params})
    };
  }

  /**
   * Gets a snapshot image of the current rendered output for a specified {@link viewing!viewer.View | View}.
   *
   * @param view The {@link viewing!viewer.View | View} for which to capture the snapshot. Must belong to the currently attached {@link viewing!viewer.Viewer | Viewer}.
   * @return An {@link base!core.SDKResult | SDKResult} containing a data URL string of the snapshot image on success, or an error result on failure.
   */
  getSnapshot(view: View): SDKResult<string> {
    if (!this._viewManager) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[WebGLRenderer.getSnapshot] Viewer with Scene is currently attached."
      });
    }
    if (view.viewer !== this._viewer) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[WebGLRenderer.getSnapshot] The specified View does not belong to the currently attached Viewer."
      });
    }
    return this._viewManager.getSnapshot(view);
  }

  /**
   * Detaches the currently attached {@link viewing!viewer.Viewer | Viewer}, if any.
   *
   * If rendering is active, this also tears down the renderer’s internal rendering state
   * before emitting lifecycle events.
   */
  detachViewer(): void {
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
    this._removeWebGLContextListeners();
    this._viewManager.destroy();
    this._viewManager = undefined as unknown as ViewManager;
    this._memoryInspector.gpuResources = null;
    this._memoryInspector.dataTextures = null;
    this._renderSuspendCount = 0;
    this._deferredSceneModelRegistrations.clear();
    this.events.onRendererStopped.dispatch(this);
  }

  /**
   * Destroys this renderer instance.
   *
   * Detaches any attached Viewer, releases internal resources and subscriptions,
   * and emits {@link events.onRendererDestroyed}. After this call, the instance
   * should be considered unusable.
   */
  destroy(): void {
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
