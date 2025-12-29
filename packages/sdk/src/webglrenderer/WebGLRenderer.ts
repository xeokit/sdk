import {EventEmitter, SDKErrorType, type SDKResult} from "../core";
import type {Viewer} from "../viewer";
import {ViewManager} from "./viewManager/ViewManager";
import {EventDispatcher} from "strongly-typed-events";
import {getWebGLExtension} from "../webglutils";
import {type Capabilities} from "./Capabilities";
import {type WebGLRendererEvents} from "./WebGLRendererEvents";
import {type GPUMemoryConfigs} from "./GPUMemoryConfigs";
import {createGPUMemoryConfigs} from "./createGPUMemoryConfigs";
import {type GPUMemoryUsage} from "./GPUMemoryUsage";

/**
 * WebGL renderer for a Viewer.
 *
 * This class manages the rendering pipeline for a Viewer using WebGL. It handles
 * the initialization, event subscriptions, and destruction of the rendering context.
 *
 * See {@link "webglrenderer" | @xeokit/webglrenderer} for usage.
 */
export class WebGLRenderer {

    private _viewManager: ViewManager; // Manages views and their rendering lifecycle
    private _destroyed = false; // Indicates if the renderer has been destroyed
    private _eventSubs = []; // Stores event subscriptions for cleanup

    /**
     * Enables or disables logging of errors to the console.
     * When true, errors encountered during rendering are logged.
     */
    public logging: boolean = true;

    /**
     * Events emitted by this WebGLRenderer.
     * Includes lifecycle events such as destruction, WebGL context loss, and error reporting.
     */
    public events: WebGLRendererEvents = {

            /**
            * Dispatched when the WebGLRenderer is attached to a Viewer.
            */
        onViewerAttached: new EventEmitter(new EventDispatcher<WebGLRenderer, Viewer>()),

        /**
         * Dispatched when the WebGLRenderer is detached from a Viewer.
         */
        onViewerDetached: new EventEmitter(new EventDispatcher<WebGLRenderer, Viewer>()),

        /**
         * Dispatched when the WebGLRenderer is destroyed.
         */
        onRendererDestroyed: new EventEmitter(new EventDispatcher<WebGLRenderer, boolean>()),

        /**
         * Dispatched when the WebGL context is lost.
         * This event is critical for handling WebGL context restoration.
         */
        webglContextLost: new EventEmitter(new EventDispatcher<WebGLRenderer, WebGLContextEvent>()),

        /**
         * Dispatched when an error occurs within the WebGLRenderer.
         * Provides detailed error information for debugging.
         */
        onError: new EventEmitter(new EventDispatcher<WebGLRenderer, {
            ok: false,
            type: SDKErrorType,
            error: string
        }>())
    }

    /**
     * Configurations for GPU memory usage.
     */
    private readonly _memConfigs: GPUMemoryConfigs;

    /**
     * Constructs a new WebGLRenderer instance.
     *
     * @param params.viewer Optional Viewer to attach to this WebGLRenderer upon construction.
     * If provided, the Viewer is immediately attached, and any errors during attachment
     * are dispatched via the `onError` event.
     * @param params.memConfigs Optional partial GPU memory configurations to override defaults.
     */
    constructor(params: {
        viewer?: Viewer,
        memConfigs?: Partial<GPUMemoryConfigs>
    } = {}) {
        if (params.memConfigs) {
            Object.assign(this._memConfigs, params.memConfigs);
        } else {
            this._memConfigs = createGPUMemoryConfigs({
                grossMemoryMB: 2024, // 2GB
                device: "medium", // Assume mid-range device
                utilization: 0.7, // Use 70% of available memory
                user: { // No overrides
                }
            });
        }
        if (params.viewer) {
            const result = this.attachViewer(params.viewer);
            if (result.ok === false) {
                this.events.onError.dispatch(this, result);
            }
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
     * Logs an error result to the console and dispatches an `onError` event.
     *
     * @param result The error result to log and dispatch.
     * @returns The same error result for chaining or further handling.
     */
    public logError(result: SDKResult<any>): SDKResult<any> {
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
     * Attaches a Viewer to this WebGLRenderer.
     * Initializes the rendering pipeline and subscribes to Viewer and Scene events.
     *
     * @param viewer The Viewer to attach.
     * @returns OK result upon success, or an Error result upon failure.
     */
    public attachViewer(viewer: Viewer): SDKResult<void> {

        if (this._viewManager) {
            return this.logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[WebGLRenderer.attachViewer] Failed to attach Viewer - a Viewer is already attached."
            });
        }

        this._viewManager = new ViewManager();

        const result = this._viewManager.init(viewer, this._memConfigs);

        if (result.ok === false) {
            this._viewManager.destroy();
            this._viewManager = undefined as unknown as ViewManager;
            return this.logError({
                ok: false,
                type: result.type,
                error: `[WebGLRenderer.attachViewer] Failed to attach Viewer - ${result.error}`
            });
        }

        const viewManager = this._viewManager;
        const sceneEvents = viewer.scene.events;
        const viewerEvents = viewer.events;

        // Subscribing to critical and non-critical events for rendering lifecycle management

        this._eventSubs = [

            // Scene components creation/destruction
            // Log errors from these calls

            sceneEvents.onSceneModelCreated.subscribe((_, sceneModel) => this.logError(viewManager.sceneModelCreated(sceneModel))),
            sceneEvents.onSceneModelDestroyed.subscribe((_, sceneModel) => this.logError(viewManager.sceneModelDestroyed(sceneModel))),
            sceneEvents.onSceneObjectCreated.subscribe((_, sceneObject) => this.logError(viewManager.sceneObjectCreated(sceneObject))),
            sceneEvents.onSceneObjectDestroyed.subscribe((_, sceneObject) => this.logError(viewManager.sceneObjectDestroyed(sceneObject))),

            // View and ViewObject creation/destruction
            // Log errors from these calls

            viewerEvents.onViewCreated.subscribe((_, view) => this.logError(viewManager.viewCreated(view))),
            viewerEvents.onViewUpdated.subscribe((_, view) => this.logError(viewManager.viewUpdated(view))),
            viewerEvents.onViewDestroyed.subscribe((_, view) => this.logError(viewManager.viewDestroyed(view))),

            // SceneMesh and SceneTransform state changes

            sceneEvents.onSceneMeshMatrixChanged.subscribe((_, sceneMesh) => viewManager.sceneMeshMatrixChanged(sceneMesh)),
            sceneEvents.onSceneMeshColorChanged.subscribe((_, sceneMesh) => viewManager.sceneMeshColorChanged(sceneMesh)),
            sceneEvents.onSceneMeshOpacityChanged.subscribe((_, sceneMesh) => viewManager.sceneMeshOpacityChanged(sceneMesh)),
            sceneEvents.onSceneTransformMatrixChanged.subscribe((_, sceneMesh) => viewManager.sceneTransformMatrixChanged(sceneMesh)),

            // ViewObject visual state changes

            viewerEvents.onViewObjectVisibleChanged.subscribe((view, viewObject) => viewManager.viewObjectVisibilityChanged(viewObject)),
            viewerEvents.onViewObjectXRayedChanged.subscribe((view, viewObject) => viewManager.viewObjectXRayedChanged(viewObject)),
            viewerEvents.onViewObjectHighlightedChanged.subscribe((view, viewObject) => viewManager.viewObjectHighlightedChanged(viewObject)),
            viewerEvents.onViewObjectSelectedChanged.subscribe((view, viewObject) => viewManager.viewObjectSelectedChanged(viewObject)),
            viewerEvents.onViewObjectColorizeChanged.subscribe((view, viewObject) => viewManager.viewObjectColorizeChanged(viewObject)),
            viewerEvents.onViewObjectOpacityChanged.subscribe((view, viewObject) => viewManager.viewObjectOpacityChanged(viewObject)),

            // Camera updates

            viewerEvents.onCameraViewMatrixUpdated.subscribe((_, camera) => viewManager.cameraViewMatrixUpdated(camera)),

            // Viewer destruction

            viewerEvents.onViewerDestroyed.subscribe((_viewer, _args) => this.detachViewer())
        ];

        this.events.onViewerAttached.dispatch(this, viewer);

        return {
            ok: true,
            value: undefined
        };
    }

    /**
     * Retrieves the Viewer currently attached to this WebGLRenderer, if any.
     *
     * @returns The attached Viewer, or null if no Viewer is attached.
     */
    public get viewer(): Viewer | null {
        return this._viewManager ? this._viewManager.viewer : null;
    }

  /**
   * Gets the current GPU memory usage by this WebGLRenderer.
   */
  public getGPUMemoryUsage(): GPUMemoryUsage {
        if (!this._viewManager) {
            return {
                allocatedMB: 0,
                usedMB: 0
            };
        }
        return this._viewManager.getGPUMemoryUsage();
    }

    /**
     * Detaches the currently attached Viewer, if any.
     * Cleans up event subscriptions and destroys the ViewManager.
     */
    public detachViewer(): void {
        if (!this._viewManager) {
            return;
        }
        const viewer = this._viewManager.viewer;
        for (const sub of this._eventSubs) {
            sub();
        }
        this._eventSubs = [];
        this._viewManager?.destroy();
        this._viewManager = undefined as unknown as ViewManager;
        this.events.onViewerDetached.dispatch(this, viewer);
    }

    /**
     * Destroys this WebGLRenderer.
     * Detaches the Viewer, cleans up resources, and dispatches the `onRendererDestroyed` event.
     */
    public destroy(): void {
        if (this._destroyed) {
            return;
        }
        this.detachViewer();
        this._destroyed = true;
        this.events.onRendererDestroyed.dispatch(this, true);
    }
}
