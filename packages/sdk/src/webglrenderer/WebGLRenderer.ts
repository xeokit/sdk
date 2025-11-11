import {EventEmitter, SDKErrorType, SDKResult} from "../core";
import type {Viewer} from "../viewer";
import {ViewManager} from "./viewManager/ViewManager";
import {EventDispatcher} from "strongly-typed-events";
import {getWebGLExtension} from "../webglutils";
import {Capabilities} from "./Capabilities";
import {WebGLRendererEvents} from "./WebGLRendererEvents";

/**
 * WebGL renderer for a Viewer.
 *
 * See {@link "webglrenderer" | @xeokit/webglrenderer} for usage.
 */
export class WebGLRenderer {

    private _viewManager: ViewManager;
    private _destroyed = false;
    private _eventSubs = [];

    /**
     * Events emitted by this WebGLRenderer.
     */
    public events: WebGLRendererEvents = {

        /**
         * Emits an event when the WebGLRenderer itself is destroyed.
         */
        onDestroyed: new EventEmitter(new EventDispatcher<WebGLRenderer, boolean>()),

        /**
         * Emits an event when the WebGL context is lost.
         */
        webglContextLost: new EventEmitter(new EventDispatcher<WebGLRenderer, WebGLContextEvent>()),

        /**
         * Emits an event when an error occurs within the WebGLRenderer.
         */
        onError: new EventEmitter(new EventDispatcher<WebGLRenderer, {
            ok: false,
            type: SDKErrorType,
            error: string
        }>())
    }

    /**
     * Constructs a new WebGLRenderer.
     *
     * @param params.viewer Optional Viewer to attach to this WebGLRenderer upon construction.
     */
    constructor(params: { viewer?: Viewer } = {}) {
        if (params.viewer) {
            const result = this.attachViewer(params.viewer);
            if (result.ok === false) {
                this.events.onError.dispatch(this, result);
            }
        }
    }

    /**
     * Gets the capabilities of this WebGLRenderer.
     */
    public getCapabilities(capabilities: Capabilities): void {
        capabilities.maxViews = 4;
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
     * Initializes this WebGLRenderer by attaching a Viewer.
     * @param viewer The Viewer to attach.
     * @returns OK result upon success, or an Error result upon failure.
     */
    public attachViewer(viewer: Viewer): SDKResult<void, string> {

        if (this._viewManager) {
            return {
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "WebGLRenderer.attachViewer: A Viewer is already attached"
            };
        }

        this._viewManager = new ViewManager();

        const result = this._viewManager.init(viewer);

        if (result.ok === false) {
            this._viewManager = undefined as unknown as ViewManager;
            return {
                ok: false,
                type: result.type,
                error: `WebGLRenderer.attachViewer: ${result.error}`
            };
        }

        const viewManager = this._viewManager;
        const sceneEvents = viewer.scene.events;
        const viewerEvents = viewer.events;

        // All rendering activities are driven by Viewer and Scene events, including rendering of new frames.
        // We simply delegate relevant events to the ViewManager.
        // We track the success of onSceneObjectCreated and onViewCreated in particular, as failures there
        // are likely to indicate critical WebGL resource allocation failures.

        const catchError = (result) => {
            if (result && result.ok === false) {
                this.events.onError.dispatch(this, {
                    ok: false,
                    type: result.type,
                    error: `WebGLRenderer: ${result.error}`
                });
            }
        }

        this._eventSubs = [

            // Delegate Scene events

            sceneEvents.onSceneModelCreated.subscribe((_, sceneModel) => viewManager.sceneModelCreated(sceneModel)),
            sceneEvents.onSceneModelDestroyed.subscribe((_, sceneModel) => viewManager.sceneModelDestroyed(sceneModel)),
            sceneEvents.onSceneObjectCreated.subscribe((_, sceneObject) => {
                catchError(viewManager.sceneObjectCreated(sceneObject));
            }),
            sceneEvents.onSceneObjectDestroyed.subscribe((_, sceneObject) => viewManager.sceneObjectDestroyed(sceneObject)),
            sceneEvents.onSceneMeshMatrixChanged.subscribe((_, sceneMesh) => viewManager.sceneMeshMatrixChanged(sceneMesh)),
            sceneEvents.onSceneMeshColorChanged.subscribe((_, sceneMesh) => viewManager.sceneMeshColorChanged(sceneMesh)),
            //sceneEvents.onMeshOpacityChanged.subscribe((_, sceneMesh) => meshManager.sceneMeshOpacityChanged(sceneMesh)),
            sceneEvents.onSceneTransformMatrixChanged.subscribe((_, sceneMesh) => viewManager.sceneTransformMatrixChanged(sceneMesh)),

            // Delegate Viewer events

            //viewerEvents.onDestroyed.subscribe((_viewer, _args) => this.detachViewer()),
            viewerEvents.onTick.subscribe((_, tickParams) => viewManager.onTick(tickParams)),
            viewerEvents.onViewCreated.subscribe((_, view) => {
                catchError(viewManager.viewCreated(view))
            }),
            viewerEvents.onViewUpdated.subscribe((_, view) => viewManager.viewUpdated(view)), // Triggers a render
            viewerEvents.onViewDestroyed.subscribe((_, view) => viewManager.viewDestroyed(view)),
            viewerEvents.onViewObjectCreated.subscribe((_, viewObject) => { /* nop */
            }),
            viewerEvents.onViewObjectDestroyed.subscribe((_, viewObject) => { /* nop */
            }),
            viewerEvents.onViewObjectVisibleChanged.subscribe((view, viewObject) => viewManager.viewObjectVisibilityChanged(viewObject)),
            viewerEvents.onViewObjectXRayedChanged.subscribe((view, viewObject) => viewManager.viewObjectXRayedChanged(viewObject)),
            viewerEvents.onViewObjectHighlightedChanged.subscribe((view, viewObject) => viewManager.viewObjectHighlightedChanged(viewObject)),
            viewerEvents.onViewObjectSelectedChanged.subscribe((view, viewObject) => viewManager.viewObjectSelectedChanged(viewObject)),
            viewerEvents.onViewObjectColorizeChanged.subscribe((view, viewObject) => viewManager.viewObjectColorizeChanged(viewObject)),
            viewerEvents.onViewObjectOpacityChanged.subscribe((view, viewObject) => viewManager.viewObjectOpacityChanged(viewObject)),
            viewerEvents.onCameraViewMatrixUpdated.subscribe((_, camera) => viewManager.cameraViewMatrixUpdated(camera))
        ];

        return {
            ok: true,
            value: undefined
        };
    }

    /**
     * The Viewer this WebGLRenderer is currently attached to, if any.
     */
    public get viewer(): Viewer | null {
        return this._viewManager ? this._viewManager.viewer : null;
    }

    /**
     * Detaches the Viewer that is currently attached, if any.
     */
    public detachViewer(): void {
        if (!this._viewManager) {
            return;
        }
        for (const sub of this._eventSubs) {
            sub();
        }
        this._eventSubs = [];
        this._viewManager?.destroy();
        this._viewManager = undefined as unknown as ViewManager;
    }

    /**
     * Destroys this WebGLRenderer.
     */
    public destroy(): void {
        if (this._destroyed) {
            return;
        }
        this.detachViewer();
        this._destroyed = true;
        this.events.onDestroyed.dispatch(this, true);
    }
}
