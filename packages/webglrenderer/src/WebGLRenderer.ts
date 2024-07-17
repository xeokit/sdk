import {Map} from "@xeokit/utils";
import {createVec3} from "@xeokit/matrix";
import type {FloatArrayParam} from "@xeokit/math";
import type {Renderer, View, Viewer, ViewObject} from "@xeokit/viewer";
import {KTX2TextureTranscoder} from "@xeokit/ktx2";
import {RenderContext} from "./RenderContext";
import {getWebGLExtension, WEBGL_INFO} from "@xeokit/webglutils";
import type {Pickable} from "./Pickable";
import {WebGLRendererModel} from "./WebGLRendererModel";
import type {Capabilities, TextureTranscoder} from "@xeokit/core";
import {EventEmitter, SDKError} from "@xeokit/core";
import type {RendererObject, SceneModel} from "@xeokit/scene";
import {WebGLTileManager} from "./WebGLTileManager";
import {RenderStats} from "./RenderStats";
import {EventDispatcher} from "strongly-typed-events";
import {Layer} from "./Layer";
import {WebGLRenderBufferManager} from "./WebGLRenderBufferManager";

const ua = navigator.userAgent.match(/(opera|chrome|safari|firefox|msie|mobile)\/?\s*(\.?\d+(\.\d+)*)/i);
const isSafari = (ua && ua[1].toLowerCase() === "safari");

/** @private */
class WebGLRendererView {

    view: View;
    transparencyEnabled: boolean;
    imageDirty: boolean;
    viewMatrixDirty: boolean;
    canvasTransparent: boolean;
    saoEnabled: boolean;
    edgesEnabled: boolean;
    backgroundColor: FloatArrayParam;
    transparentEnabled: boolean;
    pbrEnabled: boolean;
    saveCanvasBoundary: DOMRect;

    isPrimaryView: boolean;
    gl: WebGL2RenderingContext;
    webglCanvasElement: HTMLCanvasElement;

    constructor( gl: WebGL2RenderingContext, view: View, webglCanvasElement: HTMLCanvasElement) {
        this.gl = gl;
        this.view = view;
        this.transparencyEnabled = true;
        this.imageDirty = true;
        this.viewMatrixDirty = true;
        this.canvasTransparent = false;
        this.pbrEnabled = false;
        this.saoEnabled = false;
        this.edgesEnabled = false;
        this.transparentEnabled = true;
        this.backgroundColor = createVec3();
        this.saveCanvasBoundary = view.canvasElement.getBoundingClientRect();
        this.webglCanvasElement = webglCanvasElement;
        this.isPrimaryView = (!!webglCanvasElement);
    }

    destroy() {

    }
}

/**
 * A WebGL-based rendering strategy for a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * See {@link "@xeokit/webglrenderer" | @xeokit/webglrenderer} for usage.
 */
export class WebGLRenderer implements Renderer {

    /**
     * Interfaces through which each {@link @xeokit/viewer!ViewObject | ViewObject} shows/hides/highlights/selects/xrays/colorizes
     * its {@link @xeokit/scene!SceneObject | SceneObject} within the WebGLRenderer that's
     * configured on its {@link @xeokit/viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererObjects: { [key: string]: RendererObject };

    /**
     * @internal
     */
    renderStats: RenderStats;

    /**
     * @internal
     */
    tileManager: WebGLTileManager | null;

    #rendererViews: { [key: string]: WebGLRendererView };
    #rendererViewsList: WebGLRendererView[];
    #primaryRendererView: WebGLRendererView;
    #activeRendererView: WebGLRendererView;

    #viewer: Viewer;
    renderContext: RenderContext;

    #shadersDirty: boolean;

    #rendererModels: { [key: string]: WebGLRendererModel };
    #layerList: Layer[];
    #layerListDirty: boolean;
    #stateSortDirty: boolean;
    #pickIDs = new Map({});
    // #renderBufferManager: GLRenderBufferManager;
    #extensionHandles: any;
    #logarithmicDepthBufferEnabled: boolean;
    #alphaDepthMask: boolean;
    #occlusionTester: any;
    // #saoOcclusionRenderer: null | SAOOcclusionRenderer;
    // #saoDepthLimitedBlurRenderer: SAODepthLimitedBlurRenderer;
    #textureTranscoder: TextureTranscoder;
    #viewMatrixDirty: boolean;
    #snapshotBound: boolean;
    #destroyed: boolean;

    #renderBufferManager: WebGLRenderBufferManager;

    #onViewCameraMatrix: () => void | null;

    /**
     * @internal
     * @event
     */
    readonly onCompiled: EventEmitter<WebGLRenderer, boolean>;

    /**
     * @internal
     * @event
     */
    readonly onDestroyed: EventEmitter<WebGLRenderer, boolean>;


    /**
     * Creates a WebGLRenderer.
     *
     * @param params Configs
     * @param params.textureTranscoder Injects an optional transcoder that will be used internally by {@link rendererModel.createTexture}
     * to convert transcoded texture data. The transcoder is only required when we'll be providing transcoded data
     * to {@link rendererModel.createTexture}. We assume that all transcoded texture data added to a  ````rendererModel````
     * will then be in a format supported by this transcoder.
     */
    constructor(params: {
        textureTranscoder?: TextureTranscoder
    }) {
        this.renderStats = new RenderStats();
        this.rendererObjects = {};
        this.tileManager = null;
        this.renderContext = null;
        this.#textureTranscoder = params.textureTranscoder || new KTX2TextureTranscoder({});
        this.#alphaDepthMask = false;
        this.#extensionHandles = {};
        this.#pickIDs = new Map({});
        this.#layerList = [];
        this.#layerListDirty = true;
        this.#stateSortDirty = true;
        this.#shadersDirty = true;
        this.#occlusionTester = null; // Lazy-created in #addMarker()

        // this.#saoDepthRenderBuffer = null;
        // this.#renderBufferManager = null;
        this.#logarithmicDepthBufferEnabled = false;
        this.#rendererModels = {};
        this.#viewMatrixDirty = true;
        this.#snapshotBound = false;
        this.#destroyed = false;

        this.#rendererViews = {};
        this.#rendererViewsList = [];
        this.#primaryRendererView = null;
        this.#activeRendererView = null;

        this.onCompiled = new EventEmitter(new EventDispatcher<WebGLRenderer, boolean>());
        this.onDestroyed = new EventEmitter(new EventDispatcher<WebGLRenderer, boolean>());
    }

    /**
     * The Viewer this WebGLRenderer is currently attached to, if any.
     */
    get viewer(): Viewer {
        return this.#viewer;
    }

    /**
     * Gets the TextureTranscoder this WebGLRenderer was configured with, if any.
     *
     * @internal
     */
    get textureTranscoder(): void | TextureTranscoder {
        return this.#textureTranscoder;
    }

    /**
     * Gets the capabilities of this WebGLRenderer.
     *
     * @param capabilities Returns the capabilities of this WebGLRenderer.
     * @internal
     */
    getCapabilities(capabilities: Capabilities): void {
        capabilities.maxViews = 4;
        const canvasElement = document.createElement('canvas');
        let gl;
        try {
            gl = canvasElement.getContext("webgl2");
        } catch (e) {
            console.error('Failed to get a WebGL context');
        }
        if (gl) {
            capabilities.astcSupported = !!getWebGLExtension(gl, 'WEBGL_compressed_texture_astc');
            capabilities.etc1Supported = true; // WebGL
            capabilities.etc2Supported = !!getWebGLExtension(gl, 'WEBGL_compressed_texture_etc');
            capabilities.dxtSupported = !!getWebGLExtension(gl, 'WEBGL_compressed_texture_s3tc');
            capabilities.bptcSupported = !!getWebGLExtension(gl, 'EXT_texture_compression_bptc');
            capabilities.pvrtcSupported = !!(getWebGLExtension(gl, 'WEBGL_compressed_texture_pvrtc') || getWebGLExtension(gl, 'WEBKIT_WEBGL_compressed_texture_pvrtc'));
        }
    }

    /**
     * Initializes this WebGLRenderer by attaching a {@link @xeokit/viewer!Viewer}.
     *
     * @internal
     * @param viewer Viewer to attach.
     * @returns *void*
     * * Viewer successfully attached.
     * @returns *{@link @xeokit/core!SDKError}*
     * * A Viewer is already attached to this Renderer.
     * * The given Viewer is already attached to another Renderer.
     */
    attachViewer(viewer: Viewer): void {
        if (this.#viewer) {
            throw new SDKError("Can't attach Viewer to WebGLRenderer - a Viewer is already attached");
        }
        if (viewer.renderer) {
            throw new SDKError("Can't attach Viewer to WebGLRenderer - given Viewer is already attached to another Renderer");
        }
        this.#viewer = viewer;
        this.#textureTranscoder.init(this.#viewer.capabilities);
    }

    /**
     * Detaches the {@link @xeokit/viewer!Viewer} that is currently attached, if any.
     *
     * @internal
     * @returns *void*
     * * Viewer successfully detached.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No Viewer is currently attached to this WebGLRenderer.
     */
    detachViewer(): SDKError | void {
        if (this.#viewer) {
            return new SDKError("Can't detach Viewer from WebGLRenderer - no Viewer is currently attached");
        }
        for (let id in this.#rendererModels) {
            const rendererModel = this.#rendererModels[id];
            this.#detachRendererObjects(rendererModel);
            // Detaches WebGLRendererObjects, WebGLRendererMeshes,  WebGLRendererTexturesSets,
            // WebGLRendererTextures etc. and destroys Layers
            rendererModel.destroy();
            delete this.#rendererModels[id];
        }
        this.#viewer = null;
        this.#rendererViews = {};
        this.renderContext = null;
        this.#layerList = [];
        this.rendererObjects = {};
        this.tileManager = null;
    }

    /**
     * Attaches a {@link @xeokit/viewer!View} to this WebGLRenderer.
     *
     * The WebGLRenderer will then begin rendering each {@link @xeokit/scene!SceneModel | SceneModel} previously or subsequently
     * created with {@link @xeokit/scene!Scene.createModel | Scene.createModel}, for the new View.
     *
     * You can only attach as many Views as indicated in {@link  @xeokit/core!Capabilities.maxViews | Capabilities.maxViews}, as returned by
     * {@link @xeokit/webglrenderer!WebGLRenderer.getCapabilities | Renderer.getCapabilities}.
     *
     * You must attach a View before you can attach a SceneModel.
     *
     * @internal
     * @param view The View to attach.
     * @returns *void*
     * * View successfully attached.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No Viewer is attached to this WebGLRenderer.
     * * Caller attempted to attach too many Views.
     * * The WebGLRenderer failed to get a WebGL2 context on the View's canvas.
     */
    attachView(view: View): void | SDKError {
        if (!this.#viewer) {
            throw new SDKError("Can't attach View to WebGLRenderer - no Viewer is attached");
        }
        if (this.#rendererViews[view.id]) {
            return new SDKError("Can't attach additional View to WebGLRenderer - View already attached (see WebViewerCapabilities.maxViews)");
        }
        let webglCanvasElement;
        if (this.#rendererViewsList.length === 0) {
            webglCanvasElement = document.createElement('canvas');
            webglCanvasElement.width = 400;
            webglCanvasElement.height = 400;
            webglCanvasElement.style.position = 'absolute';
            webglCanvasElement.style.top = '50px';
            webglCanvasElement.style.left = '50px';
            webglCanvasElement.style.border = '1px solid black';
            webglCanvasElement.style["pointer-events"] = "none";
            webglCanvasElement.style["z-index"] = 100000; // HACK

            document.body.appendChild(webglCanvasElement);
            const WEBGL_CONTEXT_NAMES = ["webgl2"];
            const contextAttr = {};
            let gl: WebGL2RenderingContext | null = null;
            for (let i = 0; !gl && i < WEBGL_CONTEXT_NAMES.length; i++) {
                try {  // @ts-ignore
                    gl = webglCanvasElement.getContext(WEBGL_CONTEXT_NAMES[i], contextAttr);
                } catch (e) { // Try with next context name
                }
            }
            if (!gl) {
                return new SDKError(`Failed to get a WebGL2 context on the View's canvas (HTMLCanvasElement with ID "${view.canvasElement.id}")`);
            }
            gl.hint(gl.FRAGMENT_SHADER_DERIVATIVE_HINT, gl.NICEST);

            this.renderContext = new RenderContext(this.#viewer, gl, this);
           // this.tileManager = new WebGLTileManager({camera: view.camera, gl});
            this.#renderBufferManager = new WebGLRenderBufferManager(gl, webglCanvasElement, view);
        }
        view.camera.onViewMatrix.subscribe(this.#onViewCameraMatrix = () => {
            this.#viewMatrixDirty = true;
        });
        const isPrimaryView = (this.#rendererViewsList.length === 0);

            // const context2d = view.canvasElement.getContext('2d');
            //
            // //////////////////
            // context2d.fillStyle = 'blue'; // Set the fill color
            // context2d.fillRect(50, 50, 200, 100); // x, y, width, height
            // context2d.strokeStyle = 'red'; // Set the stroke color
            // context2d.lineWidth = 5; // Set the line width
            // context2d.strokeRect(100, 200, 150, 75); // x, y, width, height
////

        const rendererView = new WebGLRendererView( this.renderContext.gl, view, webglCanvasElement);
        this.#rendererViews[view.id] = rendererView;
        view.viewIndex = this.#rendererViewsList.length;
        this.#rendererViewsList.push(rendererView);
        if (isPrimaryView) {
            this.#primaryRendererView = rendererView;
            this.#activeRendererView = rendererView;
        }
    }

    // #updateViewIndices() {
    //     this.#rendererViewsList = [];
    //     for (let viewIndex = 0, len = this.#viewer.viewList.length; viewIndex < len; viewIndex++) {
    //         const view = this.#viewer.viewList[viewIndex];
    //         view.viewIndex = viewIndex;
    //         this.#rendererViewsList[viewIndex] = this.#rendererViews[view.id];
    //     }
    // }

    /**
     * Detaches the given {@link @xeokit/viewer!View} from this Renderer.
     *
     * The Renderer will then cease rendering for that View.
     *
     * @internal
     * @param view The View to detach.
     * @returns *void*
     * * View successfully detached.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No Viewer is attached to this WebGLRenderer.
     * * View is not currently attached to this WebGLRenderer.
     */
    detachView(view: View): SDKError | void {
        if (!this.#viewer) {
            throw new SDKError("Can't detach View from WebGLRenderer - no Viewer is attached");
        }
        const rendererView = this.#rendererViews[view.id];
        if (!rendererView) {
            return new SDKError("Can't detach View to WebGLRenderer - given View is not attached");
        }
        rendererView.destroy();
        delete this.#rendererViews[view.id];
        view.camera.onViewMatrix.unsubscribe(this.#onViewCameraMatrix);
        view.viewIndex = 0;
        this.#onViewCameraMatrix = null;
        for (let id in this.#rendererModels) {
            const rendererModel = this.#rendererModels[id];
            this.#detachRendererObjects(rendererModel);
            // Detaches WebGLRendererObjects, WebGLRendererMeshes,  WebGLRendererTexturesSets,
            // WebGLRendererTextures etc. and destroys Layers
            rendererModel.destroy();
            delete this.#rendererModels[id];
        }
        this.renderContext = null;
        this.#layerList = [];
        this.rendererObjects = {};
        this.tileManager = null;
        // TODO: Remove rendererView etc
    }

    /**
     * Attaches a {@link @xeokit/scene!SceneModel | SceneModel} to this WebGLRenderer.
     *
     * This method attaches various hooks to the elements within the SceneModel, through which they can
     * upload state updates to the Renderer.
     *
     * * Sets a {@link @xeokit/scene!RendererModel} on {@link @xeokit/scene!SceneModel.rendererModel | SceneModel.rendererModel}
     * * Sets a {@link @xeokit/scene!RendererObject} on each {@link @xeokit/scene!SceneObject.rendererObject | SceneObject.rendererObject}
     * * Sets a {@link @xeokit/scene!RendererMesh} on each {@link @xeokit/scene!SceneMesh.rendererMesh | SceneMesh.rendererMesh}
     * * Sets a {@link @xeokit/scene!RendererTextureSet} on each {@link @xeokit/scene!SceneTextureSet.rendererTextureSet | SceneTextureSet.rendererTextureSet}
     * * Sets a {@link @xeokit/scene!RendererTexture} on each {@link @xeokit/scene!SceneTexture.rendererTexture | SceneTexture.rendererTexture}
     *
     * Then, when we make any state updates to those components, they will upload the updates into the Renderer.
     *
     * You must first attach a View with {@link @xeokit/webglrenderer!WebGLRenderer.attachView | Renderer.attachView} before you can attach a SceneModel.
     *
     * @param sceneModel
     * @internal
     * @returns *void*
     * * SceneModel successfully attached.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this WebGLRenderer.
     * * SceneModel already attached to this WebGLRenderer, or to another Renderer.
     */
    attachSceneModel(sceneModel: SceneModel): SDKError | void {
        if (!this.#viewer) {
            throw new SDKError("Can't attach SceneModel to WebGLRenderer - no Viewer is attached");
        }
        if (this.#rendererViewsList.length === 0) {
            throw new SDKError("Can't attach SceneModel to WebGLRenderer - no View is attached");
        }
        const rendererModel = new WebGLRendererModel({
            id: sceneModel.id,
            sceneModel,
            viewer: this.viewer,
            textureTranscoder: this.#textureTranscoder,
            webglRenderer: this,
            renderContext: this.renderContext
        });
        this.#rendererModels[rendererModel.id] = rendererModel;
        this.#attachRendererObjects(rendererModel);
        this.#layerListDirty = true;
        sceneModel.rendererModel = rendererModel;
    }

    #attachRendererObjects(rendererModel: WebGLRendererModel) {
        const rendererObjects = rendererModel.rendererObjects;
        for (let id in rendererObjects) {
            this.rendererObjects[id] = rendererObjects[id];
        }
    }

    /**
     * Detaches a {@link @xeokit/scene!SceneModel | SceneModel} from this WebGLRenderer.
     *
     * Detaches and destroys the {@link @xeokit/scene!RendererModel}, {@link @xeokit/scene!RendererObject} and
     * {@link @xeokit/scene!RendererMesh},
     * {@link @xeokit/scene!RendererTexture} instances that were attached in {@link @xeokit/webglrenderer!WebGLRenderer.attachSceneModel}.
     *
     * @internal
     * @returns *void*
     * * SceneModel successfully detached.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this WebGLRenderer.
     * * SceneModel is not attached to this WebGLRenderer.
     */
    detachSceneModel(sceneModel: SceneModel): SDKError | void {
        if (!this.#viewer) {
            throw new SDKError("Can't detach SceneModel from WebGLRenderer - no Viewer is attached");
        }
        if (this.#rendererViewsList.length === 0) {
            throw new SDKError("Can't detach SceneModel to WebGLRenderer - no View is attached");
        }
        if (this.#rendererModels[sceneModel.id] == undefined) {
            return new SDKError(`Can't detach SceneModel from WebGLRenderer - no SceneModel with this ID ("${sceneModel.id}") has been attached to this WebGLRenderer`);
        }
        this.#detachSceneModel(sceneModel);
    }

    #detachSceneModel(sceneModel: SceneModel) {
        if (this.#rendererModels[sceneModel.id]) {
            const rendererModel = this.#rendererModels[sceneModel.id];
            this.#detachRendererObjects(rendererModel);
            // Detaches WebGLRendererObjects, WebGLRendererMeshes,  WebGLRendererTexturesSets,
            // WebGLRendererTextures etc. and destroys Layers
            rendererModel.destroy();
            delete this.#rendererModels[sceneModel.id];
            this.#layerListDirty = true;
        }
    }

    #detachRendererObjects(rendererModel: WebGLRendererModel) {
        const rendererObjects = rendererModel.rendererObjects;
        for (let id in rendererObjects) {
            delete this.rendererObjects[id];
        }
    }

    /**
     * @private
     */
    attachPickable(pickable: Pickable): number { // @ts-ignore
        return this.#pickIDs.addItem(pickable);
    }

    /**
     * @private
     */
    detachPickable(pickId: number) {
        this.#pickIDs.removeItem(pickId);
    }

    /**
     * Indicates that the WebGLRenderer needs to draw a new frame.
     * @internal
     */
    setImageDirty(viewIndex?: number): void {
        const rendererView = this.#rendererViewsList[viewIndex];
        if (rendererView) {
            rendererView.imageDirty = true;
        }
    }

    /**
     * Sets the WebGLRenderer's background color.
     * @internal
     */
    setBackgroundColor(viewIndex: number, color: FloatArrayParam): void { // @ts-ignore
        const rendererView = this.#rendererViewsList[viewIndex];
        if (rendererView) {
            // @ts-ignore
            rendererView.backgroundColor.set(color);
            rendererView.imageDirty = true;
        }
    }

    /**
     * Sets whether the WebGLRenderer draws edges.
     * Triggers a new frame render.
     * @internal
     */
    setEdgesEnabled(viewIndex: number, enabled: boolean): void {
        const rendererView = this.#rendererViewsList[viewIndex];
        if (rendererView) {
            rendererView.edgesEnabled = enabled;
            rendererView.imageDirty = true;
        }
    }

    /**
     * Sets whether the WebGLRenderer draws with physically-based rendering.
     * Triggers a new frame render.
     * @internal
     */
    setPBREnabled(viewIndex: number, enabled: boolean): void {
        const rendererView = this.#rendererViewsList[viewIndex];
        if (rendererView) {
            rendererView.pbrEnabled = enabled;
            rendererView.imageDirty = true;
        }
    }


    getSAOSupported(): boolean {
        return isSafari && WEBGL_INFO.SUPPORTED_EXTENSIONS["OES_standard_derivatives"];
    }

    /**
     * Sets whether the WebGLRenderer draws with SAO.
     * Triggers a new frame render.
     * @internal
     */
    setSAOEnabled(viewIndex: number, enabled: boolean): void {
        const rendererView = this.#rendererViewsList[viewIndex];
        if (rendererView) {
            rendererView.saoEnabled = enabled;
            rendererView.imageDirty = true;
        }
    }

    /**
     * Enable/disable rendering of transparent objects for the given View.
     *
     * @param viewIndex Handle to the View, returned earlier by {@link @xeokit/webglrenderer!WebGLRenderer.attachView | Renderer.attachView}.
     * @param enabled Whether to enable or disable transparent objects for the View.
     * @internal
     * @returns *void*
     * * Success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this Renderer.
     * * Can't find a View attached to this Renderer with the given handle.
     */
    setTransparentEnabled(viewIndex: number, enabled: boolean): void {
        const rendererView = this.#rendererViewsList[viewIndex];
        if (rendererView) {
            rendererView.transparentEnabled = enabled;
            rendererView.imageDirty = true;
        }
    }

    /**
     * Clears this WebGLRenderer for the given view.
     *
     * @internal
     * @param viewIndex Handle to the View, returned earlier by {@link @xeokit/webglrenderer!WebGLRenderer.attachView | Renderer.attachView}.
     * @returns *void*
     * * Success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this WebGLRenderer.
     * * Can't find a View attached to this WebGLRenderer with the given handle.
     */
    clear(viewIndex: number): void | SDKError {
        if (!this.#viewer) {
            throw new SDKError("Can't clear canvas with WebGLRenderer - no Viewer and View is attached");
        }
        const rendererView = this.#rendererViewsList[viewIndex];
        if (!rendererView) {
            throw new SDKError(`Can't clear canvas with WebGLRenderer - no View attached at given viewIndex: ${viewIndex}`);
        }
        const gl = this.renderContext.gl;
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        if (rendererView.canvasTransparent) {
            gl.clearColor(1, 1, 1, 1);
        } else {
            gl.clearColor(rendererView.backgroundColor[0], rendererView.backgroundColor[1], rendererView.backgroundColor[2], 1.0);
        }
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    };

    /**
     * Triggers a rebuild of the shaders within this WebGLRenderer for the given View.
     * @internal
     * @param viewIndex Handle to the View, returned earlier by {@link @xeokit/webglrenderer!WebGLRenderer.attachView | Renderer.attachView}.
     * @returns *void*
     * * Success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this WebGLRenderer.
     * * Can't find a View attached to this WebGLRenderer with the given handle.
     */
    setNeedsRebuild(viewIndex?: number): void {
        this.#shadersDirty = true;
    }

    /**
     * Gets if a new frame needs to be rendered for the given View.
     * @internal
     * @param viewIndex Handle to the View, returned earlier by {@link @xeokit/webglrenderer!WebGLRenderer.attachView | Renderer.attachView}.
     * @returns *boolean*
     * * True if a new frame needs to be rendered for the View.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this WebGLRenderer.
     * * Can't find a View attached to this WebGLRenderer with the given handle.
     */
    getNeedsRender(viewIndex?: number): boolean {
        const rendererView = this.#rendererViewsList[viewIndex];
        if (!rendererView) {
            return false;
        }
        return (rendererView.imageDirty || this.#layerListDirty || this.#stateSortDirty);
    }

    /**
     * Renders a frame for a View.
     *
     * @internal
     * @param viewIndex Handle to the View, returned earlier by {@param params Rendering params.
@param [params.force=false] True to force a render, else only render if needed.
@link @xeokit/webglrenderer!WebGLRenderer.attachView | Renderer.attachView}.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this Renderer.
     * * Can't find a View attached to this Renderer with the given handle.
     */
    render(viewIndex: number, params?: { force: boolean; opaqueOnly: boolean }): void | SDKError {
        if (!this.#viewer) {
            throw new SDKError("Can't render with WebGLRenderer - no Viewer and View is attached");
        }
        const rendererView = this.#rendererViewsList[viewIndex];
        if (!rendererView) {
            throw new SDKError(`Can't render with WebGLRenderer - no View attached at given viewIndex: ${viewIndex}`);
        }
        this.renderStats.reset();
        if (this.#shadersDirty) {
            this.onCompiled.dispatch(this, true);
            this.#shadersDirty = false;
        }
       // params = params || {};
        if (params.force) {
            rendererView.imageDirty = true;
        }
        this.#updateLayerList();
        if (rendererView.imageDirty) {
            this.activateView(viewIndex);
            this.#draw({
                viewIndex,
                clear: true
            });

            rendererView.imageDirty = false;
        }
    }

    activateView(viewIndex: number) {
        const primaryRendererView = this.#primaryRendererView;
        if (!primaryRendererView) {
            throw new SDKError(`Can't activate View - no primary View attached`);
        }
        const targetRendererView = this.#rendererViewsList[viewIndex];
        if (!targetRendererView) {
            throw new SDKError(`Can't activate View - no such target View attached: ${viewIndex}`);
        }
        const activeRendererView = this.#activeRendererView;
        if (activeRendererView) {
            const activeCanvasBoundingRect = activeRendererView.view.canvasElement.getBoundingClientRect();
            const primarySnapshotBuffer = this.#renderBufferManager.getRenderBuffer("snapshot", {
                depthTexture: false,
                size: [activeCanvasBoundingRect.width, activeCanvasBoundingRect.height]
            });
            primarySnapshotBuffer.bind();
            primarySnapshotBuffer.clear();
            this.#draw({
                viewIndex: activeRendererView.view.viewIndex,
                clear: true
            });
            const image = primarySnapshotBuffer.readImage({
                format: "png",
                height: activeCanvasBoundingRect.height,
                width: activeCanvasBoundingRect.width
            });
            primarySnapshotBuffer.unbind();
            (<HTMLImageElement>activeRendererView.view.canvasElement).src = image.src;
        }

        const primaryWebGLCanvasElement = primaryRendererView.webglCanvasElement;

        const targetView = targetRendererView.view;
        const targetCanvasElement = targetView.canvasElement;
        const targetCanvasBoundingRect = targetCanvasElement.getBoundingClientRect();

        primaryWebGLCanvasElement.style["left"] = `${targetCanvasBoundingRect.left}px`;
        primaryWebGLCanvasElement.style["top"] = `${targetCanvasBoundingRect.top}px`;
        primaryWebGLCanvasElement.style["width"] = `${targetCanvasBoundingRect.width}px`;
        primaryWebGLCanvasElement.style["height"] = `${targetCanvasBoundingRect.height}px`;

        primaryWebGLCanvasElement.width = targetCanvasBoundingRect.width;
        primaryWebGLCanvasElement.height = targetCanvasBoundingRect.height;

        primaryWebGLCanvasElement.style["z-index"] = 100000;

        this.#activeRendererView = targetRendererView;
    }

    /**
     * TODO
     * @internal
     */
    pickViewObject(viewIndex: number, params: {}): ViewObject | null {
        if (!this.#viewer) {
            throw new SDKError("Can't pick object with WebGLRenderer - no Viewer and View is attached");
        }
        const rendererView = this.#rendererViewsList[viewIndex];
        if (!rendererView) {
            throw new SDKError(`Can't pick object with WebGLRenderer - no View attached at given viewInded: ${viewIndex}`);
        }
        return null;
    };

    #updateLayerList(): void {
        if (this.#layerListDirty) {
            this.#buildLayerList();
            this.#layerListDirty = false;
            this.#stateSortDirty = true;
        }
        if (this.#stateSortDirty) {
            this.#sortLayerList();
            this.#stateSortDirty = false;
            for (let viewIndex = 0, len = this.#rendererViewsList.length; viewIndex < len; viewIndex++) {
                const rendererView = this.#rendererViewsList[viewIndex];
                rendererView.imageDirty = true;
            }
        }
    }

    #buildLayerList(): void {
        let lenLayerList = 0;
        for (let id in this.#rendererModels) {
            const rendererModel = this.#rendererModels[id];
            for (let i = 0, len = rendererModel.layerList.length; i < len; i++) {
                this.#layerList[lenLayerList++] = rendererModel.layerList[i];
            }
        }
        this.#layerList.length = lenLayerList;
    }

    #sortLayerList(): void {
        this.#layerList.sort((layer1, layer2) => {
            if (layer1.sortId < layer2.sortId) {
                return -1;
            }
            if (layer1.sortId > layer2.sortId) {
                return 1;
            }
            return 0;
        });
    }

    #draw(params: {
        viewIndex: number,
        clear: boolean;
    }) {
        const rendererView = this.#rendererViewsList[params.viewIndex];
        if (!rendererView) {
            return;
        }
        this.#activateExtensions();
        if (rendererView.saoEnabled && rendererView.view.sao.possible) {
            this.#drawSAOBuffers(params);
        }
        this.#drawColor(params);
    }

    #activateExtensions() {
        if (WEBGL_INFO.SUPPORTED_EXTENSIONS["OES_element_index_uint"]) {
            this.#extensionHandles.OES_element_index_uint = this.renderContext.gl.getExtension("OES_element_index_uint");
        }
        if (this.#logarithmicDepthBufferEnabled && WEBGL_INFO.SUPPORTED_EXTENSIONS["EXT_frag_depth"]) {
            this.#extensionHandles.EXT_frag_depth = this.renderContext.gl.getExtension('EXT_frag_depth');
        }
        if (WEBGL_INFO.SUPPORTED_EXTENSIONS["WEBGL_depth_texture"]) {
            this.#extensionHandles.WEBGL_depth_texture = this.renderContext.gl.getExtension('WEBGL_depth_texture');
        }
    }

    #drawSAOBuffers(params: {
        clear: boolean;
    }) {
        // const sao = this.#view.sao;
        // const saoDepthRenderBuffer = this.#renderBufferManager.getRenderBuffer("saoDepth", {
        //     depthTexture: WEBGL_INFO.SUPPORTED_EXTENSIONS["WEBGL_depth_texture"]
        // });
        // this.#saoDepthRenderBuffer.bind();
        // this.#saoDepthRenderBuffer.clear();
        // this.#drawDepth(params);
        // this.#saoDepthRenderBuffer.unbind();
        // // Render occlusion buffer
        // const occlusionRenderBuffer1 = this.#renderBufferManager.getRenderBuffer("saoOcclusion");
        // occlusionRenderBuffer1.bind();
        // occlusionRenderBuffer1.clear();
        // this.#saoOcclusionRenderer.render(saoDepthRenderBuffer);
        // occlusionRenderBuffer1.unbind();
        // if (sao.blur) {
        //     // Horizontally blur occlusion buffer 1 into occlusion buffer 2
        //     const occlusionRenderBuffer2 = this.#renderBufferManager.getRenderBuffer("saoOcclusion2");
        //     occlusionRenderBuffer2.bind();
        //     occlusionRenderBuffer2.clear();
        //     this.#saoDepthLimitedBlurRenderer.render(saoDepthRenderBuffer, occlusionRenderBuffer1, 0);
        //     occlusionRenderBuffer2.unbind();
        //     // Vertically blur occlusion buffer 2 back into occlusion buffer 1
        //     occlusionRenderBuffer1.bind();
        //     occlusionRenderBuffer1.clear();
        //     this.#saoDepthLimitedBlurRenderer.render(saoDepthRenderBuffer, occlusionRenderBuffer2, 1);
        //     occlusionRenderBuffer1.unbind();
        // }
    }

    #drawDepth(params: {
        viewIndex: number,
        clear: boolean
    }) {
        this.renderContext.reset();
        const gl = this.renderContext.gl;
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.clearColor(0, 0, 0, 0);
        gl.enable(gl.DEPTH_TEST);
        gl.frontFace(gl.CCW);
        gl.enable(gl.CULL_FACE);
        gl.depthMask(true);
        if (params.clear !== false) {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        }

        // for (let i = 0, len = this.#layerListPostCull.length; i < len; i++) {
        //     const layer = this.#layerListPostCull[i];
        //     // if (layer.culled === true || layer.visible === false || !layer.drawDepth) {
        //     //     continue;
        //     // }
        //     // if (layer.drawFlags.colorOpaque) {
        //     //     //    layer.drawDepth(this.renderContext);
        //     // }
        // }
        // const numVertexAttribs = WEBGL_INFO.MAX_VERTEX_ATTRIBS; // Fixes https://github.com/xeokit/xeokit-sdk/issues/174
        // for (let ii = 0; ii < numVertexAttribs; ii++) {
        //     gl.disableVertexAttribArray(ii);
        // }
    }

    #drawColor(params: {
        viewIndex: number,
        clear: boolean;
    }) {

        const viewIndex = params.viewIndex;
        const rendererView = this.#rendererViewsList[viewIndex];
        const view = rendererView.view;
        const renderContext = this.renderContext;
        const gl = renderContext.gl;

        const normalDrawSAOBin: Layer[] = [];
        const edgesColorOpaqueBin: Layer[] = [];
        const normalFillTransparentBin: Layer[] = [];
        const edgesColorTransparentBin: Layer[] = [];
        const xrayedSilhouetteOpaqueBin: Layer[] = [];
        const xrayEdgesOpaqueBin: Layer[] = [];
        const xrayedSilhouetteTransparentBin: Layer[] = [];
        const xrayEdgesTransparentBin: Layer[] = [];
        const highlightedSilhouetteOpaqueBin: Layer[] = [];
        const highlightedEdgesOpaqueBin: Layer[] = [];
        const highlightedSilhouetteTransparentBin: Layer[] = [];
        const highlightedEdgesTransparentBin: Layer[] = [];
        const selectedSilhouetteOpaqueBin: Layer[] = [];
        const selectedEdgesOpaqueBin: Layer[] = [];
        const selectedSilhouetteTransparentBin: Layer[] = [];
        const selectedEdgesTransparentBin: Layer[] = [];

        renderContext.reset();
        renderContext.view = view;
        renderContext.withSAO = false;
        renderContext.pbrEnabled = rendererView.pbrEnabled && !!view.qualityRender;

        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

        if (rendererView.canvasTransparent) {
            gl.clearColor(0, 0, 0, 0);
        } else {
            gl.clearColor(rendererView.backgroundColor[0], rendererView.backgroundColor[1], rendererView.backgroundColor[2], 1.0);
        }

        gl.enable(gl.DEPTH_TEST);
        gl.frontFace(gl.CCW);
        gl.enable(gl.CULL_FACE);
        gl.depthMask(true);
        gl.lineWidth(1);

        renderContext.lineWidth = 1;

        const saoPossible = view.sao.possible;

        if (rendererView.saoEnabled && saoPossible) {
            // const occlusionRenderBuffer1 = this.#renderBufferManager.getRenderBuffer("saoOcclusion", {
            //     depthTexture: false,
            //     size: [gl.drawingBufferWidth, gl.drawingBufferHeight]
            // });
            // renderContext.occlusionTexture = occlusionRenderBuffer1 ? occlusionRenderBuffer1.getTexture() : null;
        } else {
            renderContext.occlusionTexture = null;

        }

        if (params.clear !== false) {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        }

        // Render normal opaque solids, defer others to subsequent bins, to render after

        for (let i = 0, len = this.#layerList.length; i < len; i++) {

            const layer = this.#layerList[i];
            const meshCounts = layer.meshCounts[viewIndex];

            if (meshCounts.numCulled === meshCounts.numMeshes || meshCounts.numVisible === 0) {
                continue;
            }

            if (meshCounts.numTransparent < meshCounts.numMeshes) {
                layer.drawColorOpaque();
            }

            if (rendererView.transparentEnabled) {
                if (meshCounts.numTransparent > 0) {
                    normalFillTransparentBin.push(layer);
                }
            }

            if (meshCounts.numXRayed > 0) {
                if (view.xrayMaterial.fill) {
                    if (view.xrayMaterial.fillAlpha < 1.0) {
                        xrayedSilhouetteTransparentBin.push(layer);
                    } else {
                        xrayedSilhouetteOpaqueBin.push(layer);
                    }
                }
            }

            if (meshCounts.numHighlighted > 0) {
                if (view.highlightMaterial.fill) {
                    if (view.highlightMaterial.fillAlpha < 1.0) {
                        highlightedSilhouetteTransparentBin.push(layer);
                    } else {
                        highlightedSilhouetteOpaqueBin.push(layer);
                    }
                }
            }

            if (meshCounts.numSelected > 0) {
                if (view.selectedMaterial.fill) {
                    if (view.selectedMaterial.fillAlpha < 1.0) {
                        selectedSilhouetteTransparentBin.push(layer);
                    } else {
                        selectedSilhouetteOpaqueBin.push(layer);
                    }
                }
            }

            if (rendererView.edgesEnabled && view.edges.enabled) {
                if (meshCounts.numEdges > 0) {
                    if (meshCounts.numTransparent < meshCounts.numMeshes) {
                        edgesColorOpaqueBin.push(layer);
                    }
                    if (meshCounts.numTransparent > 0) {
                        edgesColorTransparentBin.push(layer);
                    }
                    // if (view.selectedMaterial.edgeAlpha < 1.0) {
                    //     selectedEdgesTransparentBin.push(layer);
                    // } else {
                    //     selectedEdgesOpaqueBin.push(layer);
                    // }
                    // if (meshCounts.numXRayed > 0) {
                    //     if (view.xrayMaterial.edgeAlpha < 1.0) {
                    //         xrayEdgesTransparentBin.push(layer);
                    //     } else {
                    //         xrayEdgesOpaqueBin.push(layer);
                    //     }
                    // }
                    //
                    // if (view.highlightMaterial.edgeAlpha < 1.0) {
                    //     highlightedEdgesTransparentBin.push(layer);
                    // } else {
                    //     highlightedEdgesOpaqueBin.push(layer);
                    // }
                }
            }
        }

        // Render deferred bins

        if (normalDrawSAOBin.length > 0) {
            renderContext.withSAO = true;
            for (let i = 0; i < normalDrawSAOBin.length; i++) {
                normalDrawSAOBin[i].drawColorOpaque();
            }
        }

        for (let i = 0; i < edgesColorOpaqueBin.length; i++) {
            edgesColorOpaqueBin[i].drawEdgesColorOpaque();
        }

        for (let i = 0; i < xrayedSilhouetteOpaqueBin.length; i++) {
            xrayedSilhouetteOpaqueBin[i].drawSilhouetteXRayed();
        }

        for (let i = 0; i < xrayEdgesOpaqueBin.length; i++) {
            xrayEdgesOpaqueBin[i].drawEdgesXRayed();
        }

        if (xrayedSilhouetteTransparentBin.length > 0 ||
            xrayEdgesTransparentBin.length > 0 ||
            normalFillTransparentBin.length > 0 ||
            edgesColorTransparentBin.length > 0) {
            gl.enable(gl.CULL_FACE);
            gl.enable(gl.BLEND);
            if (rendererView.canvasTransparent) {
                gl.blendEquation(gl.FUNC_ADD);
                gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            } else {
                gl.blendEquation(gl.FUNC_ADD);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            }
            renderContext.backfaces = false;
            if (!this.#alphaDepthMask) {
                gl.depthMask(false);
            }
            for (let i = 0; i < xrayEdgesTransparentBin.length; i++) {
                xrayEdgesTransparentBin[i].drawEdgesXRayed();
            }
            for (let i = 0; i < xrayedSilhouetteTransparentBin.length; i++) {
                xrayedSilhouetteTransparentBin[i].drawSilhouetteXRayed();
            }
            if (normalFillTransparentBin.length > 0 || edgesColorTransparentBin.length > 0) {
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            }
            for (let i = 0; i < edgesColorTransparentBin.length; i++) {
                edgesColorTransparentBin[i].drawEdgesColorTranslucent();
            }
            for (let i = 0; i < normalFillTransparentBin.length; i++) {
                normalFillTransparentBin[i].drawColorTranslucent();
            }
            gl.disable(gl.BLEND);
            if (!this.#alphaDepthMask) {
                gl.depthMask(true);
            }
        }

        if (highlightedSilhouetteOpaqueBin.length > 0 || highlightedEdgesOpaqueBin.length > 0) {
            renderContext.lastProgramId = -1; // HACK
            gl.clear(gl.DEPTH_BUFFER_BIT);
            for (let i = 0; i < highlightedEdgesOpaqueBin.length; i++) {
                highlightedEdgesOpaqueBin[i].drawEdgesHighlighted();
            }
            for (let i = 0; i < highlightedSilhouetteOpaqueBin.length; i++) {
                highlightedSilhouetteOpaqueBin[i].drawSilhouetteHighlighted();
            }
        }

        if (highlightedSilhouetteTransparentBin.length > 0 ||
            highlightedEdgesTransparentBin.length > 0 ||
            highlightedSilhouetteOpaqueBin.length > 0) {
            renderContext.lastProgramId = -1;
            gl.clear(gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.CULL_FACE);
            gl.enable(gl.BLEND);
            if (rendererView.canvasTransparent) {
                gl.blendEquation(gl.FUNC_ADD);
                gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            } else {
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            }
            for (let i = 0; i < highlightedEdgesTransparentBin.length; i++) {
                highlightedEdgesTransparentBin[i].drawEdgesHighlighted();
            }
            for (let i = 0; i < highlightedSilhouetteTransparentBin.length; i++) {
                highlightedSilhouetteTransparentBin[i].drawSilhouetteHighlighted();
            }
            gl.disable(gl.BLEND);
        }

        if (selectedSilhouetteOpaqueBin.length > 0 || selectedEdgesOpaqueBin.length > 0) {
            renderContext.lastProgramId = -1;
            gl.clear(gl.DEPTH_BUFFER_BIT);
            for (let i = 0; i < selectedEdgesOpaqueBin.length; i++) {
                selectedEdgesOpaqueBin[i].drawEdgesSelected();
            }
            for (let i = 0; i < selectedSilhouetteOpaqueBin.length; i++) {
                selectedSilhouetteOpaqueBin[i].drawSilhouetteSelected();
            }
        }

        if (selectedSilhouetteTransparentBin.length > 0 || selectedEdgesTransparentBin.length > 0) {
            renderContext.lastProgramId = -1;
            gl.clear(gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.CULL_FACE);
            gl.enable(gl.BLEND);
            if (rendererView.canvasTransparent) {
                gl.blendEquation(gl.FUNC_ADD);
                gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            } else {
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            }
            for (let i = 0; i < selectedEdgesTransparentBin.length; i++) {
                selectedEdgesTransparentBin[i].drawEdgesSelected();
            }
            for (let i = 0; i < selectedSilhouetteTransparentBin.length; i++) {
                selectedSilhouetteTransparentBin[i].drawSilhouetteSelected();
            }
            gl.disable(gl.BLEND);
        }

        const numTextureUnits = WEBGL_INFO.MAX_TEXTURE_UNITS;
        for (let ii = 0; ii < numTextureUnits; ii++) {
            gl.activeTexture(gl.TEXTURE0 + ii);
        }
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
        gl.bindTexture(gl.TEXTURE_2D, null);

        const numVertexAttribs = WEBGL_INFO.MAX_VERTEX_ATTRIBS; // Fixes https://github.com/xeokit/xeokit-sdk/issues/174
        for (let ii = 0; ii < numVertexAttribs; ii++) {
            gl.disableVertexAttribArray(ii);
        }
    }

    beginSnapshot(viewIndex: number, params?: {
        width: number,
        height: number
    }) {
        // const rendererView = this.#rendererViewsList[viewIndex];
        // if (!rendererView) {
        //     throw new SDKError(`Can't begin snapshot with WebGLRenderer.beginSnapshot() - no View attached at given viewIndex: ${viewIndex}`);
        // }
        // const snapshotBuffer = rendererView.renderBufferManager.getRenderBuffer("snapshot");
        // if (params && params.width && params.height) {
        //     snapshotBuffer.setSize([params.width, params.height]);
        // }
        // snapshotBuffer.bind();
        // snapshotBuffer.clear();
        // this.#snapshotBound = true;
    }

    renderSnapshot() {
        // const rendererView = this.#rendererViewsList[viewIndex];
        // if (!rendererView) {
        //     throw new SDKError(`Can't render snapshot with WebGLRenderer.renderSnapshot() - no View attached at given viewIndex: ${viewIndex}`);
        // }
        // if (!this.#snapshotBound) {
        //     return;
        // }
        // const snapshotBuffer = rendererView.renderBufferManager.getRenderBuffer("snapshot");
        // snapshotBuffer.clear();
        // this.render(viewIndex, {
        //     force: true,
        //     opaqueOnly: false
        // });
        // rendererView.imageDirty = true;
    }

    readSnapshot(): string {
        // const rendererView = this.#rendererViewsList[viewIndex];
        // if (!rendererView) {
        //     throw new SDKError(`Can't read snapshot with WebGLRenderer.readSnapshot() - no View attached at given viewIndex: ${viewIndex}`);
        // }
        // if (!this.#snapshotBound) {
        //     return;
        // }
        // const snapshotBuffer = rendererView.renderBufferManager.getRenderBuffer("snapshot");
        // return snapshotBuffer.readImage(params);
        return "";
    }

    readSnapshotAsCanvas() : HTMLCanvasElement{
        // const rendererView = this.#rendererViewsList[viewIndex];
        // if (!rendererView) {
        //     throw new SDKError(`Can't read snapshot with WebGLRenderer.readSnapshotAsCanvas() - no View attached at given viewIndex: ${viewIndex}`);
        // }
        // if (!this.#snapshotBound) {
        //     return;
        // }
        // const snapshotBuffer = rendererView.renderBufferManager.getRenderBuffer("snapshot");
        // return snapshotBuffer.readImageAsCanvas();
        return null;
    }

    /**
     * Exits snapshot mode.
     *
     * Switches rendering back to the main canvas.
     */
    endSnapshot() {
        // const rendererView = this.#rendererViewsList[viewIndex];
        // if (!rendererView) {
        //     throw new SDKError(`Can't end snapshot with WebGLRenderer.endSnapshot() - no View attached at given viewIndex: ${viewIndex}`);
        // }
        // if (!this.#snapshotBound) {
        //     return;
        // }
        // const snapshotBuffer = rendererView.renderBufferManager.getRenderBuffer("snapshot");
        // snapshotBuffer.unbind();
        this.#snapshotBound = false;
    }

    destroy() {
        if (this.#destroyed) {
            return;
        }
        if (this.#viewer) {
            this.detachViewer();
        }
        this.#renderBufferManager.destroy();
        this.#destroyed = true;
        this.onDestroyed.dispatch(this, true);
    }
}
