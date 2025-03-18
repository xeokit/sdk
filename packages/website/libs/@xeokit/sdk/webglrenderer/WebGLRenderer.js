import { Map } from "../utils";
import { addVec3, createMat4, createVec2, createVec3, cross3Vec3, lookAtMat4v, normalizeVec3 } from "../matrix";
import { KTX2TextureTranscoder } from "../ktx2";
import { RenderContext } from "./RenderContext";
import { getWebGLExtension, WEBGL_INFO } from "../webglutils";
import { WebGLRendererModel } from "./WebGLRendererModel";
import { EventEmitter, SDKError } from "../core";
import { RenderStats } from "./RenderStats";
import { EventDispatcher } from "strongly-typed-events";
import { WebGLRenderBufferManager } from "./WebGLRenderBufferManager";
import { PickResult } from "../viewer";
import { SAOOcclusionRenderer } from "./SAOOcclusionRenderer";
import { SAODepthLimitedBlurRenderer } from "./SAODepthLimitedBlurRenderer";
const ua = navigator.userAgent.match(/(opera|chrome|safari|firefox|msie|mobile)\/?\s*(\.?\d+(\.\d+)*)/i);
const isSafari = (ua && ua[1].toLowerCase() === "safari");
/** @private */
class WebGLRendererView {
    view;
    transparencyEnabled;
    imageDirty;
    viewMatrixDirty;
    canvasTransparent;
    saoEnabled;
    edgesEnabled;
    transparentEnabled;
    pbrEnabled;
    saveCanvasBoundary;
    gl;
    renderBufferManager;
    pickIDs;
    constructor(gl, webglCanvasElement, view) {
        this.gl = gl;
        this.view = view;
        this.transparencyEnabled = true;
        this.imageDirty = true;
        this.viewMatrixDirty = true;
        this.canvasTransparent = false;
        this.pbrEnabled = false;
        this.saoEnabled = false;
        this.edgesEnabled = true;
        this.transparentEnabled = true;
        this.saveCanvasBoundary = view.htmlElement.getBoundingClientRect();
        this.renderBufferManager = new WebGLRenderBufferManager(gl, webglCanvasElement);
        this.pickIDs = new Map({});
    }
    destroy() {
        this.renderBufferManager.destroy();
    }
}
const tempVec3a = createVec3();
const tempVec3b = createVec3();
const tempVec3c = createVec3();
const tempMat4b = createMat4();
const pickTemps = {
    pickCanvasPos: createVec2(),
    pickWorldRayDir: createVec3(),
    pickWorldRayOrigin: createVec3(),
    pickViewMatrix: createMat4(),
    pickProjMatrix: createMat4()
};
/**
 * A WebGL-based rendering strategy for a {@link viewer!Viewer | Viewer}.
 *
 * See {@link "@xeokit/webglrenderer" | @xeokit/webglrenderer} for usage.
 */
export class WebGLRenderer {
    /**
     * Interfaces through which each {@link viewer!ViewObject | ViewObject} shows/hides/highlights/selects/xrays/colorizes
     * its {@link scene!SceneObject | SceneObject} within the WebGLRenderer that's
     * configured on its {@link viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererObjects;
    /**
     * @internal
     */
    renderStats;
    /**
     * @internal
     */
    tileManager;
    #saoOcclusionRenderer;
    #saoDepthLimitedBlurRenderer;
    #pickBufferManager;
    #rendererViews;
    #rendererViewsList;
    #activeRendererView;
    #viewer;
    renderContext;
    #shadersDirty;
    #rendererModels;
    #layerList;
    #layerListDirty;
    #stateSortDirty;
    #pickIDs = new Map({});
    #extensionHandles;
    #logarithmicDepthBufferEnabled;
    #alphaDepthMask;
    #occlusionTester;
    // #saoOcclusionRenderer: null | SAOOcclusionRenderer;
    // #saoDepthLimitedBlurRenderer: SAODepthLimitedBlurRenderer;
    #textureTranscoder;
    #viewMatrixDirty;
    #snapshotBound;
    #destroyed;
    #onViewCameraMatrix;
    /**
     * @internal
     * @event
     */
    onCompiled;
    /**
     * @internal
     * @event
     */
    onDestroyed;
    #webglCanvasElement;
    #gl;
    #pickResult;
    /**
     * Creates a WebGLRenderer.
     *
     * @param params Configs
     * @param params.textureTranscoder Injects an optional transcoder that will be used internally by {@link rendererModel.createTexture}
     * to convert transcoded texture data. The transcoder is only required when we'll be providing transcoded data
     * to {@link rendererModel.createTexture}. We assume that all transcoded texture data added to a  ````rendererModel````
     * will then be in a format supported by this transcoder.
     */
    constructor(params) {
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
        this.#activeRendererView = null;
        this.#pickResult = new PickResult();
        this.onCompiled = new EventEmitter(new EventDispatcher());
        this.onDestroyed = new EventEmitter(new EventDispatcher());
        this.#webglCanvasElement = document.createElement('canvas');
        const webglCanvasElement = this.#webglCanvasElement;
        webglCanvasElement.width = 400;
        webglCanvasElement.height = 400;
        webglCanvasElement.style.position = 'absolute';
        webglCanvasElement.style.top = '50px';
        webglCanvasElement.style.left = '50px';
        webglCanvasElement.style.border = '1px solid black';
        webglCanvasElement.style["pointer-events"] = "none";
        webglCanvasElement.style["z-index"] = 100000; // HACK
        document.body.appendChild(webglCanvasElement);
        const contextAttr = {
            alpha: true,
            preserveDrawingBuffer: true,
            stencil: false,
            premultipliedAlpha: false,
            antialias: true
        };
        this.#gl = webglCanvasElement.getContext("webgl2", contextAttr);
        if (!this.#gl) {
            throw new SDKError(`Failed to get a WebGL2 context`);
        }
        this.#gl.hint(this.#gl.FRAGMENT_SHADER_DERIVATIVE_HINT, this.#gl.NICEST);
        this.#pickBufferManager = new WebGLRenderBufferManager(this.#gl, webglCanvasElement);
        // this.tileManager = new WebGLTileManager({camera: view.camera, gl});
    }
    /**
     * The Viewer this WebGLRenderer is currently attached to, if any.
     */
    get viewer() {
        return this.#viewer;
    }
    /**
     * Gets the TextureTranscoder this WebGLRenderer was configured with, if any.
     *
     * @internal
     */
    get textureTranscoder() {
        return this.#textureTranscoder;
    }
    /**
     * Gets the capabilities of this WebGLRenderer.
     *
     * @param capabilities Returns the capabilities of this WebGLRenderer.
     * @internal
     */
    getCapabilities(capabilities) {
        capabilities.maxViews = 4;
        const htmlElement = document.createElement('canvas');
        let gl;
        try {
            gl = htmlElement.getContext("webgl2");
        }
        catch (e) {
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
     * Initializes this WebGLRenderer by attaching a {@link viewer!Viewer | Viewer}.
     *
     * @internal
     * @param viewer Viewer to attach.
     * @returns *void*
     * * Viewer successfully attached.
     * @returns *{@link core!SDKError | SDKError}*
     * * A Viewer is already attached to this Renderer.
     * * The given Viewer is already attached to another Renderer.
     */
    attachViewer(viewer) {
        if (this.#viewer) {
            throw new SDKError("Can't attach Viewer to WebGLRenderer - a Viewer is already attached");
        }
        if (viewer.renderer) {
            throw new SDKError("Can't attach Viewer to WebGLRenderer - given Viewer is already attached to another Renderer");
        }
        this.#viewer = viewer;
        this.#textureTranscoder.init(this.#viewer.capabilities);
        this.renderContext = new RenderContext(this.#viewer, this.#gl, this);
        this.#saoOcclusionRenderer = new SAOOcclusionRenderer({
            renderContext: this.renderContext
        });
        this.#saoDepthLimitedBlurRenderer = new SAODepthLimitedBlurRenderer({
            renderContext: this.renderContext
        });
    }
    /**
     * Detaches the {@link viewer!Viewer | Viewer} that is currently attached, if any.
     *
     * @internal
     * @returns *void*
     * * Viewer successfully detached.
     * @returns *{@link core!SDKError | SDKError}*
     * * No Viewer is currently attached to this WebGLRenderer.
     */
    detachViewer() {
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
     * Attaches a {@link viewer!View} to this WebGLRenderer.
     *
     * The WebGLRenderer will then begin rendering each {@link scene!SceneModel | SceneModel} previously or subsequently
     * created with {@link scene!Scene.createModel | Scene.createModel}, for the new View.
     *
     * You can only attach as many Views as indicated in {@link  @xeokit/core!Capabilities.maxViews | Capabilities.maxViews}, as returned by
     * {@link webglrenderer!WebGLRenderer.getCapabilities | Renderer.getCapabilities}.
     *
     * You must attach a View before you can attach a SceneModel.
     *
     * @internal
     * @param view The View to attach.
     * @returns *void*
     * * View successfully attached.
     * @returns *{@link core!SDKError | SDKError}*
     * * No Viewer is attached to this WebGLRenderer.
     * * Caller attempted to attach too many Views.
     * * The WebGLRenderer failed to get a WebGL2 context on the View's canvas.
     */
    attachView(view) {
        if (!this.#viewer) {
            throw new SDKError("Can't attach View to WebGLRenderer - no Viewer is attached");
        }
        if (this.#rendererViews[view.id]) {
            return new SDKError("Can't attach additional View to WebGLRenderer - View already attached (see WebViewerCapabilities.maxViews)");
        }
        view.camera.onViewMatrix.subscribe(this.#onViewCameraMatrix = () => {
            this.#viewMatrixDirty = true;
        });
        const rendererView = new WebGLRendererView(this.renderContext.gl, this.#webglCanvasElement, view);
        this.#rendererViews[view.id] = rendererView;
        view.viewIndex = this.#rendererViewsList.length;
        this.#rendererViewsList.push(rendererView);
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
     * Detaches the given {@link viewer!View} from this Renderer.
     *
     * The Renderer will then cease rendering for that View.
     *
     * @internal
     * @param view The View to detach.
     * @returns *void*
     * * View successfully detached.
     * @returns *{@link core!SDKError | SDKError}*
     * * No Viewer is attached to this WebGLRenderer.
     * * View is not currently attached to this WebGLRenderer.
     */
    detachView(view) {
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
     * Attaches a {@link scene!SceneModel | SceneModel} to this WebGLRenderer.
     *
     * This method attaches various hooks to the elements within the SceneModel, through which they can
     * upload state updates to the Renderer.
     *
     * * Sets a {@link scene!RendererModel} on {@link scene!SceneModel.rendererModel | SceneModel.rendererModel}
     * * Sets a {@link scene!RendererObject} on each {@link scene!SceneObject.rendererObject | SceneObject.rendererObject}
     * * Sets a {@link scene!RendererMesh} on each {@link scene!SceneMesh.rendererMesh | SceneMesh.rendererMesh}
     * * Sets a {@link scene!RendererTextureSet} on each {@link scene!SceneTextureSet.rendererTextureSet | SceneTextureSet.rendererTextureSet}
     * * Sets a {@link scene!RendererTexture} on each {@link scene!SceneTexture.rendererTexture | SceneTexture.rendererTexture}
     *
     * Then, when we make any state updates to those components, they will upload the updates into the Renderer.
     *
     * You must first attach a View with {@link webglrenderer!WebGLRenderer.attachView | Renderer.attachView} before you can attach a SceneModel.
     *
     * @param sceneModel
     * @internal
     * @returns *void*
     * * SceneModel successfully attached.
     * @returns *{@link core!SDKError | SDKError}*
     * * No View is currently attached to this WebGLRenderer.
     * * SceneModel already attached to this WebGLRenderer, or to another Renderer.
     */
    attachSceneModel(sceneModel) {
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
    #attachRendererObjects(rendererModel) {
        const rendererObjects = rendererModel.rendererObjects;
        for (let id in rendererObjects) {
            this.rendererObjects[id] = rendererObjects[id];
        }
    }
    /**
     * Detaches a {@link scene!SceneModel | SceneModel} from this WebGLRenderer.
     *
     * Detaches and destroys the {@link scene!RendererModel}, {@link scene!RendererObject} and
     * {@link scene!RendererMesh},
     * {@link scene!RendererTexture} instances that were attached in {@link webglrenderer!WebGLRenderer.attachSceneModel}.
     *
     * @internal
     * @returns *void*
     * * SceneModel successfully detached.
     * @returns *{@link core!SDKError | SDKError}*
     * * No View is currently attached to this WebGLRenderer.
     * * SceneModel is not attached to this WebGLRenderer.
     */
    detachSceneModel(sceneModel) {
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
    #detachSceneModel(sceneModel) {
        if (this.#rendererModels[sceneModel.id]) {
            const rendererModel = this.#rendererModels[sceneModel.id];
            this.#detachRendererObjects(rendererModel);
            // Detaches WebGLRendererObjects, WebGLRendererMeshes,  WebGLRendererTexturesSets,
            // WebGLRendererTextures etc. and destroys Layers
            rendererModel.destroy();
            delete this.#rendererModels[sceneModel.id];
            this.#layerListDirty = true;
            sceneModel.rendererModel = null;
        }
    }
    #detachRendererObjects(rendererModel) {
        const rendererObjects = rendererModel.rendererObjects;
        for (let id in rendererObjects) {
            delete this.rendererObjects[id];
        }
    }
    /**
     * @private
     */
    attachPickable(pickable) {
        return this.#pickIDs.addItem(pickable);
    }
    /**
     * @private
     */
    detachPickable(pickId) {
        this.#pickIDs.removeItem(pickId);
    }
    /**
     * Indicates that the WebGLRenderer needs to draw a new frame.
     * @internal
     */
    setImageDirty(viewIndex) {
        const rendererView = this.#rendererViewsList[viewIndex];
        if (rendererView) {
            rendererView.imageDirty = true;
        }
    }
    /**
     * Sets whether the WebGLRenderer draws edges.
     * Triggers a new frame render.
     * @internal
     */
    setEdgesEnabled(viewIndex, enabled) {
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
    setPBREnabled(viewIndex, enabled) {
        const rendererView = this.#rendererViewsList[viewIndex];
        if (rendererView) {
            rendererView.pbrEnabled = enabled;
            rendererView.imageDirty = true;
        }
    }
    getSAOSupported() {
        return true;
        //return isSafari && WEBGL_INFO.SUPPORTED_EXTENSIONS["OES_standard_derivatives"];
    }
    /**
     * Sets whether the WebGLRenderer draws with SAO.
     * Triggers a new frame render.
     * @internal
     */
    setSAOEnabled(viewIndex, enabled) {
        const rendererView = this.#rendererViewsList[viewIndex];
        if (rendererView) {
            rendererView.saoEnabled = enabled;
            rendererView.imageDirty = true;
        }
    }
    /**
     * Enable/disable rendering of transparent objects for the given View.
     *
     * @param viewIndex Handle to the View, returned earlier by {@link webglrenderer!WebGLRenderer.attachView | Renderer.attachView}.
     * @param enabled Whether to enable or disable transparent objects for the View.
     * @internal
     * @returns *void*
     * * Success.
     * @returns *{@link core!SDKError | SDKError}*
     * * No View is currently attached to this Renderer.
     * * Can't find a View attached to this Renderer with the given handle.
     */
    setTransparentEnabled(viewIndex, enabled) {
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
     * @param viewIndex Handle to the View, returned earlier by {@link webglrenderer!WebGLRenderer.attachView | Renderer.attachView}.
     * @returns *void*
     * * Success.
     * @returns *{@link core!SDKError | SDKError}*
     * * No View is currently attached to this WebGLRenderer.
     * * Can't find a View attached to this WebGLRenderer with the given handle.
     */
    clear(viewIndex) {
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
        }
        else {
            gl.clearColor(rendererView.view.backgroundColor[0], rendererView.view.backgroundColor[1], rendererView.view.backgroundColor[2], 1.0);
        }
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
    ;
    /**
     * Triggers a rebuild of the shaders within this WebGLRenderer for the given View.
     * @internal
     * @param viewIndex Handle to the View, returned earlier by {@link webglrenderer!WebGLRenderer.attachView | Renderer.attachView}.
     * @returns *void*
     * * Success.
     * @returns *{@link core!SDKError | SDKError}*
     * * No View is currently attached to this WebGLRenderer.
     * * Can't find a View attached to this WebGLRenderer with the given handle.
     */
    setNeedsRebuild(viewIndex) {
        this.#shadersDirty = true;
    }
    /**
     * Gets if a new frame needs to be rendered for the given View.
     * @internal
     * @param viewIndex Handle to the View, returned earlier by {@link webglrenderer!WebGLRenderer.attachView | Renderer.attachView}.
     * @returns *boolean*
     * * True if a new frame needs to be rendered for the View.
     * @returns *{@link core!SDKError | SDKError}*
     * * No View is currently attached to this WebGLRenderer.
     * * Can't find a View attached to this WebGLRenderer with the given handle.
     */
    getNeedsRender(viewIndex) {
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
     * @param [params.force=false] True to force a render, else only render if needed.
     * @link webglrenderer!WebGLRenderer.attachView | Renderer.attachView}.
     * @returns *{@link core!SDKError | SDKError}*
     * * No View is currently attached to this Renderer.
     * * Can't find a View attached to this Renderer with the given handle.
     */
    render(viewIndex, params) {
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
            this.#activateView(viewIndex);
            this.#draw({
                viewIndex,
                clear: true
            });
            rendererView.imageDirty = false;
        }
    }
    #activateView(viewIndex) {
        const targetRendererView = this.#rendererViewsList[viewIndex];
        if (!targetRendererView) {
            throw new SDKError(`Can't activate View - no such target View attached: ${viewIndex}`);
        }
        const activeRendererView = this.#activeRendererView;
        if (activeRendererView) {
            const activeCanvasBoundingRect = activeRendererView.view.htmlElement.getBoundingClientRect();
            const primarySnapshotBuffer = activeRendererView.renderBufferManager.getRenderBuffer("snapshot", {
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
            activeRendererView.view.htmlElement.src = image;
        }
        const webglCanvasElement = this.#webglCanvasElement;
        const targetView = targetRendererView.view;
        const targetCanvasElement = targetView.htmlElement;
        const targetCanvasBoundingRect = targetCanvasElement.getBoundingClientRect();
        webglCanvasElement.style["left"] = `${targetCanvasBoundingRect.left}px`;
        webglCanvasElement.style["top"] = `${targetCanvasBoundingRect.top}px`;
        webglCanvasElement.style["width"] = `${targetCanvasBoundingRect.width}px`;
        webglCanvasElement.style["height"] = `${targetCanvasBoundingRect.height}px`;
        webglCanvasElement.width = targetCanvasBoundingRect.width;
        webglCanvasElement.height = targetCanvasBoundingRect.height;
        webglCanvasElement.style["z-index"] = 100000;
        this.#activeRendererView = targetRendererView;
    }
    #updateLayerList() {
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
    #buildLayerList() {
        let lenLayerList = 0;
        for (let id in this.#rendererModels) {
            const rendererModel = this.#rendererModels[id];
            for (let i = 0, len = rendererModel.layerList.length; i < len; i++) {
                this.#layerList[lenLayerList++] = rendererModel.layerList[i];
            }
        }
        this.#layerList.length = lenLayerList;
    }
    #sortLayerList() {
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
    #draw(params) {
        const rendererView = this.#rendererViewsList[params.viewIndex];
        if (!rendererView) {
            return;
        }
        this.#activateExtensions();
        if (rendererView.view.sao.enabled && rendererView.view.sao.possible) {
            //      this.#drawSAOBuffers(params);
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
    #drawSAOBuffers(params) {
        const viewIndex = params.viewIndex;
        const rendererView = this.#rendererViewsList[viewIndex];
        const view = rendererView.view;
        const sao = view.sao;
        // Render depth buffer
        const depthRenderBuffer = rendererView.renderBufferManager.getRenderBuffer("saoDepth", {
            depthTexture: WEBGL_INFO.SUPPORTED_EXTENSIONS["WEBGL_depth_texture"]
        });
        depthRenderBuffer.bind();
        depthRenderBuffer.clear();
        this.#drawDepth(params);
        depthRenderBuffer.unbind();
        // Render occlusion buffer
        const occlusionRenderBuffer1 = rendererView.renderBufferManager.getRenderBuffer("saoOcclusion");
        occlusionRenderBuffer1.bind();
        occlusionRenderBuffer1.clear();
        this.#saoOcclusionRenderer.render({
            view,
            depthRenderBuffer
        });
        occlusionRenderBuffer1.unbind();
        if (sao.blur) {
            // Horizontally blur occlusion buffer 1 into occlusion buffer 2
            const occlusionRenderBuffer2 = rendererView.renderBufferManager.getRenderBuffer("saoOcclusion2");
            occlusionRenderBuffer2.bind();
            occlusionRenderBuffer2.clear();
            this.#saoDepthLimitedBlurRenderer.render({
                view,
                depthRenderBuffer,
                occlusionRenderBuffer: occlusionRenderBuffer1,
                direction: 0
            });
            occlusionRenderBuffer2.unbind();
            // Vertically blur occlusion buffer 2 back into occlusion buffer 1
            occlusionRenderBuffer1.bind();
            occlusionRenderBuffer1.clear();
            this.#saoDepthLimitedBlurRenderer.render({
                view,
                depthRenderBuffer,
                occlusionRenderBuffer: occlusionRenderBuffer2,
                direction: 1
            });
            occlusionRenderBuffer1.unbind();
        }
    }
    #drawDepth(params) {
        const viewIndex = params.viewIndex;
        const rendererView = this.#rendererViewsList[viewIndex];
        const view = rendererView.view;
        const renderContext = this.renderContext;
        const gl = renderContext.gl;
        renderContext.reset();
        renderContext.view = view;
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.clearColor(0, 0, 0, 0);
        gl.enable(gl.DEPTH_TEST);
        gl.frontFace(gl.CCW);
        gl.enable(gl.CULL_FACE);
        gl.depthMask(true);
        if (params.clear !== false) {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        }
        for (let i = 0, len = this.#layerList.length; i < len; i++) {
            const layer = this.#layerList[i];
            const meshCounts = layer.meshCounts[viewIndex];
            if (meshCounts.numTransparent < meshCounts.numMeshes) { // Only draw opaque objects in depth pass
                layer.drawDepth();
            }
        }
        // const numVertexAttribs = WEBGL_INFO.MAX_VERTEX_ATTRIBS; // Fixes https://github.com/xeokit/xeokit-sdk/issues/174
        // for (let ii = 0; ii < numVertexAttribs; ii++) {
        //     gl.disableVertexAttribArray(ii);
        // }
    }
    #drawColor(params) {
        const viewIndex = params.viewIndex;
        const rendererView = this.#rendererViewsList[viewIndex];
        const view = rendererView.view;
        const renderContext = this.renderContext;
        const gl = renderContext.gl;
        const normalDrawSAOBin = [];
        const edgesColorOpaqueBin = [];
        const normalFillTransparentBin = [];
        const edgesColorTransparentBin = [];
        const xrayedSilhouetteOpaqueBin = [];
        const xrayEdgesOpaqueBin = [];
        const xrayedSilhouetteTransparentBin = [];
        const xrayEdgesTransparentBin = [];
        const highlightedSilhouetteOpaqueBin = [];
        const highlightedEdgesOpaqueBin = [];
        const highlightedSilhouetteTransparentBin = [];
        const highlightedEdgesTransparentBin = [];
        const selectedSilhouetteOpaqueBin = [];
        const selectedEdgesOpaqueBin = [];
        const selectedSilhouetteTransparentBin = [];
        const selectedEdgesTransparentBin = [];
        renderContext.reset();
        renderContext.view = view;
        renderContext.pbrEnabled = rendererView.pbrEnabled && !!view.qualityRender;
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        if (rendererView.canvasTransparent) {
            gl.clearColor(0, 0, 0, 0);
        }
        else {
            gl.clearColor(rendererView.view.backgroundColor[0], rendererView.view.backgroundColor[1], rendererView.view.backgroundColor[2], 1.0);
        }
        gl.enable(gl.DEPTH_TEST);
        gl.frontFace(gl.CCW);
        gl.enable(gl.CULL_FACE);
        gl.depthMask(true);
        gl.lineWidth(1);
        renderContext.lineWidth = 1;
        const drawWithSAO = rendererView.saoEnabled && view.sao.possible;
        if (drawWithSAO) {
            const saoOcclusionRenderBuffer = rendererView.renderBufferManager.getRenderBuffer("saoOcclusion");
            renderContext.saoOcclusionTexture = saoOcclusionRenderBuffer ? saoOcclusionRenderBuffer.getTexture() : null;
        }
        else {
            renderContext.saoOcclusionTexture = null;
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
                if (drawWithSAO && layer.saoSupported) {
                    normalDrawSAOBin.push(layer);
                }
                else {
                    layer.drawColorOpaque();
                }
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
                    }
                    else {
                        xrayedSilhouetteOpaqueBin.push(layer);
                    }
                }
            }
            if (meshCounts.numHighlighted > 0) {
                if (view.highlightMaterial.fill) {
                    if (view.highlightMaterial.fillAlpha < 1.0) {
                        highlightedSilhouetteTransparentBin.push(layer);
                    }
                    else {
                        highlightedSilhouetteOpaqueBin.push(layer);
                    }
                }
            }
            if (meshCounts.numSelected > 0) {
                if (view.selectedMaterial.fill) {
                    if (view.selectedMaterial.fillAlpha < 1.0) {
                        selectedSilhouetteTransparentBin.push(layer);
                    }
                    else {
                        selectedSilhouetteOpaqueBin.push(layer);
                    }
                }
            }
            if (rendererView.edgesEnabled && view.edges.enabled) {
                if (meshCounts.numTransparent < meshCounts.numMeshes) {
                    edgesColorOpaqueBin.push(layer);
                }
                if (meshCounts.numTransparent > 0) {
                    edgesColorTransparentBin.push(layer);
                }
                if (view.selectedMaterial.edgeAlpha < 1.0) {
                    selectedEdgesTransparentBin.push(layer);
                }
                else {
                    selectedEdgesOpaqueBin.push(layer);
                }
                if (meshCounts.numXRayed > 0) {
                    if (view.xrayMaterial.edgeAlpha < 1.0) {
                        xrayEdgesTransparentBin.push(layer);
                    }
                    else {
                        xrayEdgesOpaqueBin.push(layer);
                    }
                }
                if (view.highlightMaterial.edgeAlpha < 1.0) {
                    highlightedEdgesTransparentBin.push(layer);
                }
                else {
                    highlightedEdgesOpaqueBin.push(layer);
                }
            }
        }
        // Render deferred bins
        if (normalDrawSAOBin.length > 0) {
            for (let i = 0; i < normalDrawSAOBin.length; i++) {
                normalDrawSAOBin[i].drawColorSAOOpaque();
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
            }
            else {
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
            }
            else {
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
            }
            else {
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
    /**
     * TODO
     * @internal
     */
    pick(viewIndex, pickParams, pickResult = this.#pickResult) {
        if (!this.#viewer) {
            throw new SDKError("Can't pick object with WebGLRenderer - no Viewer and View is attached");
        }
        const targetRendererView = this.#rendererViewsList[viewIndex];
        if (!targetRendererView) {
            throw new SDKError(`Can't pick object with WebGLRenderer - no View attached at given viewInded: ${viewIndex}`);
        }
        const view = targetRendererView.view;
        if (this.#shadersDirty) {
            this.onCompiled.dispatch(this, true);
            this.#shadersDirty = false;
        }
        this.#updateLayerList();
        pickResult.reset();
        const { pickCanvasPos, pickViewMatrix, pickProjMatrix, pickWorldRayOrigin, pickWorldRayDir } = pickTemps;
        if (pickParams.canvasPos) {
            // @ts-ignore
            pickCanvasPos.set(pickParams.canvasPos);
            // @ts-ignore
            pickViewMatrix.set(view.camera.viewMatrix);
            // @ts-ignore
            pickProjMatrix.set(view.camera.projMatrix);
            pickResult.canvasPos = pickParams.canvasPos;
        }
        else {
            // Picking with arbitrary World-space ray
            // Align camera along ray and fire ray through center of canvas
            if (pickParams.rayMatrix) {
                // Ray defined using matrix
                // @ts-ignore
                pickViewMatrix.set(params.rayMatrix);
                // @ts-ignore
                pickProjMatrix.set(view.camera.projMatrix);
            }
            else {
                // Ray defined as origin and direction
                pickWorldRayOrigin.set(pickParams.rayOrigin || [0, 0, 0]);
                pickWorldRayDir.set(pickParams.rayDirection || [0, 0, 1]);
                const look = addVec3(pickWorldRayOrigin, pickWorldRayDir, tempVec3a);
                tempVec3b[0] = Math.random();
                tempVec3b[1] = Math.random();
                tempVec3b[2] = Math.random();
                normalizeVec3(tempVec3b);
                cross3Vec3(pickWorldRayDir, tempVec3b, tempVec3c);
                // @ts-ignore
                pickViewMatrix.set(lookAtMat4v(pickWorldRayOrigin, look, tempVec3c, tempMat4b));
                // @ts-ignore
                pickProjMatrix.set(view.camera.orthoProjection.projMatrix);
                pickResult.origin = pickWorldRayOrigin;
                pickResult.direction = pickWorldRayDir;
            }
            pickCanvasPos[0] = targetRendererView.view.htmlElement.clientWidth * 0.5;
            pickCanvasPos[1] = targetRendererView.view.htmlElement.clientHeight * 0.5;
        }
        if (pickParams.pickViewObject) {
            const rendererMesh = this.#pickMesh(viewIndex, targetRendererView, {
                pickCanvasPos,
                pickViewMatrix,
                pickProjMatrix,
                pickInvisible: !!pickParams.pickInvisible
            });
            if (rendererMesh) {
                const rendererObject = rendererMesh.rendererObject;
                const view = targetRendererView.view;
                const viewObject = view.objects[rendererObject.id];
                pickResult.viewObject = viewObject;
            }
        }
        // if (params.pickSurface) {
        //     const worldPos = this.#pickSurface(viewIndex, targetRendererView, {
        //         pickCanvasPos,
        //         pickViewMatrix,
        //         pickProjMatrix,
        //         pickInvisible: params.pickInvisible
        //     });
        //     if (worldPos) {
        //         pickResult.worldPos = worldPos;
        //     }
        // }
        return pickResult;
    }
    ;
    #pickMesh(viewIndex, targetRendererView, params) {
        const gl = this.#gl;
        const view = targetRendererView.view;
        const targetCanvasBoundingRect = targetRendererView.view.htmlElement.getBoundingClientRect();
        const pickProjMatrix = params.pickProjMatrix;
        const pickViewMatrix = params.pickViewMatrix;
        const resolutionScale = view.resolutionScale;
        const renderContext = this.renderContext;
        const pickBuffer = this.#pickBufferManager.getRenderBuffer("pickMesh", {
            depthTexture: false,
            size: [1, 1]
        });
        pickBuffer.bind();
        pickBuffer.clear();
        renderContext.reset();
        renderContext.backfaces = true;
        renderContext.frontface = true; // "ccw"
        renderContext.pickViewMatrix = pickViewMatrix;
        renderContext.pickProjMatrix = pickProjMatrix;
        renderContext.pickInvisible = !!params.pickInvisible;
        renderContext.pickClipPos = [
            this.#getClipPosX(params.pickCanvasPos[0] * resolutionScale.resolutionScale, gl.drawingBufferWidth),
            this.#getClipPosY(params.pickCanvasPos[1] * resolutionScale.resolutionScale, gl.drawingBufferHeight)
        ];
        gl.viewport(0, 0, 1, 1);
        gl.depthMask(true);
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.BLEND);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        for (let i = 0, len = this.#layerList.length; i < len; i++) {
            const layer = this.#layerList[i];
            const meshCounts = layer.meshCounts[viewIndex];
            if (meshCounts.numPickable < meshCounts.numMeshes ||
                meshCounts.numCulled === meshCounts.numMeshes ||
                meshCounts.numVisible === 0) {
                continue;
            }
            layer.drawPickMesh();
        }
        const pix = pickBuffer.read(0, 0);
        const pickID = pix[0] + (pix[1] << 8) + (pix[2] << 16) + (pix[3] << 24);
        console.log("pickID = " + pickID);
        pickBuffer.unbind();
        if (pickID < 0) {
            return null;
        }
        return this.#pickIDs.items[pickID];
    }
    #pickWorldPos(viewIndex, params) {
        const targetRendererView = this.#rendererViewsList[viewIndex];
        if (!targetRendererView) {
            throw new SDKError(`Can't activate View - no such target View attached: ${viewIndex}`);
        }
        const gl = this.#gl;
        const view = targetRendererView.view;
        const pickProjMatrix = params.pickProjMatrix;
        const pickViewMatrix = params.pickViewMatrix;
        const resolutionScale = view.resolutionScale;
        const renderContext = this.renderContext;
        const targetCanvasBoundingRect = targetRendererView.view.htmlElement.getBoundingClientRect();
        const pickBuffer = targetRendererView.renderBufferManager.getRenderBuffer("pickDepth", {
            depthTexture: true,
            size: [targetCanvasBoundingRect.width, targetCanvasBoundingRect.height]
        });
        pickBuffer.setSize([targetCanvasBoundingRect.width, targetCanvasBoundingRect.height]);
        pickBuffer.bind();
        pickBuffer.clear();
        renderContext.reset();
        renderContext.backfaces = true;
        renderContext.frontface = true; // "ccw"
        renderContext.pickViewMatrix = pickViewMatrix;
        renderContext.pickProjMatrix = pickProjMatrix;
        renderContext.pickInvisible = !!params.pickInvisible;
        renderContext.pickClipPos[0] = this.#getClipPosX(params.canvasPos[0] * resolutionScale.resolutionScale, gl.drawingBufferWidth);
        renderContext.pickClipPos[0] = this.#getClipPosY(params.canvasPos[1] * resolutionScale.resolutionScale, gl.drawingBufferHeight);
        gl.viewport(0, 0, 1, 1);
        gl.depthMask(true);
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.BLEND);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        if (params.layer) {
            params.layer.drawPickDepths();
        }
        else {
            for (let i = 0, len = this.#layerList.length; i < len; i++) {
                const layer = this.#layerList[i];
                const meshCounts = layer.meshCounts[viewIndex];
                if (meshCounts.numPickable < meshCounts.numMeshes ||
                    meshCounts.numCulled === meshCounts.numMeshes ||
                    meshCounts.numVisible === 0) {
                    continue;
                }
                layer.drawPickDepths();
            }
        }
        const pix = pickBuffer.read(0, 0);
        pickBuffer.unbind();
        const pickID = pix[0] + (pix[1] << 8) + (pix[2] << 16) + (pix[3] << 24);
        if (pickID < 0) {
            return null;
        }
        return this.#pickIDs.items[pickID];
    }
    #getClipPosX(pos, size) {
        return 2 * (pos / size) - 1;
    }
    #getClipPosY(pos, size) {
        return 1 - 2 * (pos / size);
    }
    beginSnapshot(viewIndex, params) {
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
    readSnapshot() {
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
    readSnapshotAsCanvas() {
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
        this.#saoOcclusionRenderer.destroy();
        this.#saoDepthLimitedBlurRenderer.destroy();
        this.#pickBufferManager.destroy();
        this.#destroyed = true;
        this.onDestroyed.dispatch(this, true);
    }
}
//# sourceMappingURL=WebGLRenderer.js.map