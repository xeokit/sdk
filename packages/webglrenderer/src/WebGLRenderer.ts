import {Map} from "@xeokit/utils";
import {createVec3} from "@xeokit/matrix";
import type {FloatArrayParam} from "@xeokit/math";
import type {Renderer, View, Viewer, ViewObject} from "@xeokit/viewer";
import {KTX2TextureTranscoder} from "@xeokit/ktx2";
import {RenderContext} from "./RenderContext";
import {getWebGLExtension, WEBGL_INFO} from "@xeokit/webglutils";
import {RENDER_PASSES} from "./RENDER_PASSES";
import type {Pickable} from "./Pickable";
import {WebGLRendererModel} from "./WebGLRendererModel";
import type {Capabilities, TextureTranscoder} from "@xeokit/core";
import {SDKError} from "@xeokit/core";
import type {RendererObject, SceneModel} from "@xeokit/scene";
import {WebGLTileManager} from "./WebGLTileManager";
import {Layer} from "./Layer";
import {RendererSet} from "./RendererSet";
import {RenderStats} from "./RenderStats";

const ua = navigator.userAgent.match(/(opera|chrome|safari|firefox|msie|mobile)\/?\s*(\.?\d+(\.\d+)*)/i);
const isSafari = (ua && ua[1].toLowerCase() === "safari");

/**
 * A WebGL-based rendering strategy for a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * See {@link "@xeokit/webglrenderer" | @xeokit/webglrenderer} for usage.
 */
export class WebGLRenderer implements Renderer {

    rendererObjects: { [key: string]: RendererObject };

    renderStats: RenderStats;

    tileManager: WebGLTileManager | null;

    #viewer: Viewer;
    #view: View;
    #renderContext: RenderContext;
    #canvasTransparent: boolean;
    #transparentEnabled: boolean;
    #edgesEnabled: boolean;
    #imageDirty: boolean;
    #saoEnabled: boolean;
    #pbrEnabled: boolean;
    #backgroundColor: FloatArrayParam;
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
    //  #rendererSet: RendererSet;
    #viewMatrixDirty: boolean;
    #rendererSet: RendererSet;
    #destroyed: boolean;

    #onViewCameraMatrix: () => void | null;

    /**
     Creates a WebGLRenderer.

     @param params Configs
     @param params.textureTranscoder Injects an optional transcoder that will be used internally by {@link rendererModel.createTexture}
     to convert transcoded texture data. The transcoder is only required when we'll be providing transcoded data
     to {@link rendererModel.createTexture}. We assume that all transcoded texture data added to a  ````rendererModel````
     will then be in a format supported by this transcoder.
     */
    constructor(params: {
        textureTranscoder?: TextureTranscoder
    }) {
        this.renderStats = new RenderStats();
        this.rendererObjects = {};
        this.tileManager = null;
        this.#renderContext = null;
        this.#textureTranscoder = params.textureTranscoder || new KTX2TextureTranscoder({});
        this.#canvasTransparent = false;
        this.#alphaDepthMask = false;
        this.#extensionHandles = {};
        this.#pickIDs = new Map({});
        this.#layerList = [];
        this.#layerListDirty = true;
        this.#stateSortDirty = true;
        this.#imageDirty = true;
        this.#transparentEnabled = true;
        this.#edgesEnabled = true;
        this.#saoEnabled = true;
        this.#pbrEnabled = true;
        this.#backgroundColor = createVec3();
        this.#occlusionTester = null; // Lazy-created in #addMarker()

        // this.#saoDepthRenderBuffer = null;
        // this.#renderBufferManager = null;
        this.#logarithmicDepthBufferEnabled = false;
        this.#rendererModels = {};
        this.#viewMatrixDirty = true;
        this.#destroyed = false;
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
     *
     * @internal
     */
    getCapabilities(capabilities: Capabilities): void {
        capabilities.maxViews = 1;
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
        this.#view = null;
        this.#rendererSet.destroy();
        this.#rendererSet = null;
        this.#renderContext = null;
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
     * {@link @xeokit/viewer!Renderer.getCapabilities | Renderer.getCapabilities}.
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
        if (this.#view) {
            return new SDKError("Can't attach additional View to WebGLRenderer - only one View may be attached to a WebViewerCapabilities (see WebViewerCapabilities.maxViews)");
        }
        this.#view = view;
        const WEBGL_CONTEXT_NAMES = ["webgl2"];
        const canvasElement = view.canvasElement;
        const contextAttr = {};
        let gl: WebGL2RenderingContext | null = null;
        for (let i = 0; !gl && i < WEBGL_CONTEXT_NAMES.length; i++) {
            try {  // @ts-ignore
                gl = canvasElement.getContext(WEBGL_CONTEXT_NAMES[i], contextAttr);
            } catch (e) { // Try with next context name
            }
        }
        if (!gl) {
            return new SDKError(`Failed to get a WebGL2 context on the View's canvas (HTMLCanvasElement with ID "${view.canvasElement.id}")`);
        }
        gl.hint(gl.FRAGMENT_SHADER_DERIVATIVE_HINT, gl.NICEST);
        this.#renderContext = new RenderContext(this.#viewer, this.#view, gl);
        this.tileManager = new WebGLTileManager({camera: view.camera, gl});
        this.#rendererSet = new RendererSet(this.#renderContext, this.renderStats);
        view.camera.onViewMatrix.subscribe(this.#onViewCameraMatrix = () => {
            this.#viewMatrixDirty = true;
        });
        view.viewIndex = 0;
    }

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
        if (!this.#view) {
            return new SDKError("Can't detach View from WebGLRenderer - no View is attached");
        }
        if (this.#view !== view) {
            return new SDKError("Can't detach View from WebGLRenderer - given View is not attached to this WebGLRenderer");
        }
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
        this.#view = null;
        this.#rendererSet.destroy();
        this.#rendererSet = null;
        this.#renderContext = null;
        this.#layerList = [];
        this.rendererObjects = {};
        this.tileManager = null;
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
     * You must first attach a View with {@link @xeokit/viewer!Renderer.attachView | Renderer.attachView} before you can attach a SceneModel.
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
            throw new SDKError("Can't detach SceneModel to WebGLRenderer - no Viewer and View is attached");
        }
        if (!this.#view) {
            throw new SDKError("Can't detach SceneModel to WebGLRenderer - no View is attached");
        }
        const rendererModel = new WebGLRendererModel({
            id: sceneModel.id,
            sceneModel,
            view: this.#view,
            textureTranscoder: this.#textureTranscoder,
            webglRenderer: this,
            renderContext: this.#renderContext
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
     * @internal
     * @returns *void*
     * * SceneModel successfully detached.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this WebGLRenderer.
     * * SceneModel is not attached to this WebGLRenderer.
     */
    detachSceneModel(sceneModel: SceneModel): SDKError | void {
        if (!this.#viewer) {
            throw new SDKError("Can't detach SceneModel from WebGLRenderer - no Viewer and View is attached");
        }
        if (!this.#view) {
            throw new SDKError("Can't detach SceneModel from WebGLRenderer - no View is attached");
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
     * TODO
     * @internal
     */
    setImageDirty(viewIndex?: number) {
        this.#imageDirty = true;
    }

    /**
     * TODO
     * @internal
     */
    setBackgroundColor(viewIndex: number, color: FloatArrayParam): void { // @ts-ignore
        this.#backgroundColor.set(color);
        this.#imageDirty = true;
    }

    /**
     * TODO
     * @internal
     */
    setEdgesEnabled(viewIndex: number, enabled: boolean): void {
        this.#edgesEnabled = enabled;
        this.#imageDirty = true;
    }

    /**
     * TODO
     * @internal
     */
    setPBREnabled(viewIndex: number, enabled: boolean): void {
        this.#pbrEnabled = enabled;
        this.#imageDirty = true;
    }

    /**
     * TODO
     * @internal
     */
    getSAOSupported(): boolean {
        return isSafari && WEBGL_INFO.SUPPORTED_EXTENSIONS["OES_standard_derivatives"];
    }

    /**
     * TODO
     * @internal
     */
    setSAOEnabled(viewIndex: number, enabled: boolean): void {
        this.#saoEnabled = enabled;
        this.#imageDirty = true;
    }

    /**
     * TODO
     * @internal
     */
    setTransparentEnabled(viewIndex: number, enabled: boolean): void {
        this.#transparentEnabled = enabled;
        this.#imageDirty = true;
    }

    /**
     * TODO
     * @internal
     */
    clear(viewIndex: number) {
        if (!this.#viewer) {
            throw new SDKError("Can't clear canvas with WebGLRenderer - no Viewer and View is attached");
        }
        if (!this.#view) {
            throw new SDKError("Can't clear canvas with WebGLRenderer - no View is attached");
        }
        const gl = this.#renderContext.gl;
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        if (this.#canvasTransparent) {
            gl.clearColor(1, 1, 1, 1);
        } else {
            gl.clearColor(this.#backgroundColor[0], this.#backgroundColor[1], this.#backgroundColor[2], 1.0);
        }
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    };

    /**
     * TODO
     * @internal
     */
    needsRebuild(viewIndex?: number): void {
        this.#rendererSet.needRebuild();
    }

    /**
     * TODO
     * @internal
     */
    needsRender(viewIndex?: number): boolean {
        return (this.#imageDirty || this.#layerListDirty || this.#stateSortDirty);
    }

    /**
     * TODO
     * @internal
     */
    render(viewIndex: number, params: {
        force?: boolean;
    }) {
        if (!this.#viewer) {
            throw new SDKError("Can't render with WebGLRenderer - no Viewer and View is attached");
        }
        if (!this.#view) {
            throw new SDKError("Can't render with WebGLRenderer - no View is attached");
        }
        this.renderStats.reset();
        params = params || {};
        if (params.force) {
            this.#imageDirty = true;
        }
        if (this.#viewMatrixDirty) {
            (<WebGLTileManager>this.tileManager).refreshMatrices();
            this.#viewMatrixDirty = false;
        }
        this.#updateLayerList();
        if (this.#imageDirty) {
            this.#draw({clear: true});
            this.#imageDirty = false;
        }
    }

    /**
     * TODO
     * @internal
     */
    pickViewObject(viewIndex: number, params: {}): ViewObject | null {
        if (!this.#viewer) {
            throw new SDKError("Can't pick object with WebGLRenderer - no Viewer and View is attached");
        }
        if (!this.#view) {
            throw new SDKError("Can't pick object with WebGLRenderer - no View is attached");
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
            this.#imageDirty = true;
        }
    }

    #buildLayerList(): void {
        let lenDrawableList = 0;
        for (let id in this.#rendererModels) {
            const rendererModel = this.#rendererModels[id];
            for (let i = 0, len = rendererModel.layerList.length; i < len; i++) {
                this.#layerList[lenDrawableList++] = rendererModel.layerList[i];
            }
        }
        this.#layerList.length = lenDrawableList;
    }

    #sortLayerList(): void {
        this.#layerList.sort((a, b) => {
            if (a.sortId < b.sortId) {
                return -1;
            }
            if (a.sortId > b.sortId) {
                return 1;
            }
            return 0;
        });
    }

    #draw(params: {
        clear: boolean;
    }) {
        this.#activateExtensions();
        if (this.#saoEnabled && this.#view.sao.possible) {
            this.#drawSAOBuffers(params);
        }
        this.#drawColor(params);
    }

    #activateExtensions() {
        if (WEBGL_INFO.SUPPORTED_EXTENSIONS["OES_element_index_uint"]) {
            this.#extensionHandles.OES_element_index_uint = this.#renderContext.gl.getExtension("OES_element_index_uint");
        }
        if (this.#logarithmicDepthBufferEnabled && WEBGL_INFO.SUPPORTED_EXTENSIONS["EXT_frag_depth"]) {
            this.#extensionHandles.EXT_frag_depth = this.#renderContext.gl.getExtension('EXT_frag_depth');
        }
        if (WEBGL_INFO.SUPPORTED_EXTENSIONS["WEBGL_depth_texture"]) {
            this.#extensionHandles.WEBGL_depth_texture = this.#renderContext.gl.getExtension('WEBGL_depth_texture');
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
        clear: boolean
    }) {
        this.#renderContext.reset();
        const gl = this.#renderContext.gl;
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
        //     //     //    layer.drawDepth(this.#renderContext);
        //     // }
        // }
        // const numVertexAttribs = WEBGL_INFO.MAX_VERTEX_ATTRIBS; // Fixes https://github.com/xeokit/xeokit-sdk/issues/174
        // for (let ii = 0; ii < numVertexAttribs; ii++) {
        //     gl.disableVertexAttribArray(ii);
        // }
    }

    #drawColor(params: {
        clear: boolean;
    }) {

        const view = this.#view;
        const renderContext = this.#renderContext;
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
        renderContext.withSAO = false;
        renderContext.pbrEnabled = this.#pbrEnabled && !!view.qualityRender;

        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

        if (this.#canvasTransparent) {
            gl.clearColor(0, 0, 0, 0);
        } else {
            gl.clearColor(this.#backgroundColor[0], this.#backgroundColor[1], this.#backgroundColor[2], 1.0);
        }

        gl.enable(gl.DEPTH_TEST);
        gl.frontFace(gl.CCW);
        gl.enable(gl.CULL_FACE);
        gl.depthMask(true);
        gl.lineWidth(1);

        renderContext.lineWidth = 1;

        const saoPossible = view.sao.possible;

        if (this.#saoEnabled && saoPossible) {
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
            const meshCounts = layer.meshCounts;

            if (meshCounts.numCulled === meshCounts.numMeshes || meshCounts.numVisible === 0) {
                continue;
            }

            if (meshCounts.numTransparent < meshCounts.numMeshes) {
                this.#drawLayer(layer, RENDER_PASSES.COLOR_OPAQUE);
            }

            if (this.#transparentEnabled) {
                if (meshCounts.numTransparent) {
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

            if (this.#edgesEnabled && this.#view.edges.enabled) {
                if (meshCounts.numEdges > 0) {
                    if (meshCounts.numTransparent < meshCounts.numMeshes) {
                        edgesColorOpaqueBin.push(layer);
                    }
                    if (meshCounts.numTransparent > 0) {
                        edgesColorTransparentBin.push(layer);
                    }
                    if (view.selectedMaterial.edgeAlpha < 1.0) {
                        selectedEdgesTransparentBin.push(layer);
                    } else {
                        selectedEdgesOpaqueBin.push(layer);
                    }
                    if (view.xrayMaterial.edgeAlpha < 1.0) {
                        xrayEdgesTransparentBin.push(layer);
                    } else {
                        xrayEdgesOpaqueBin.push(layer);
                    }
                    if (view.highlightMaterial.edgeAlpha < 1.0) {
                        highlightedEdgesTransparentBin.push(layer);
                    } else {
                        highlightedEdgesOpaqueBin.push(layer);
                    }
                }
            }
        }

        // Render deferred bins

        if (normalDrawSAOBin.length > 0) {
            renderContext.withSAO = true;
            for (let i = 0; i < normalDrawSAOBin.length; i++) {
                //    this.#drawLayer(normalDrawSAOBin[i], RENDER_PASSES.COLOR_OPAQUE, layer.rendererModel.qualityRender);
                //    normalDrawSAOBin[i].drawColorOpaque(renderContext);
            }
        }

        for (let i = 0; i < edgesColorOpaqueBin.length; i++) {
            this.#drawLayer(edgesColorOpaqueBin[i], RENDER_PASSES.EDGES_COLOR_OPAQUE);
        }

        for (let i = 0; i < xrayedSilhouetteOpaqueBin.length; i++) {
            this.#drawLayer(xrayedSilhouetteOpaqueBin[i], RENDER_PASSES.SILHOUETTE_XRAYED);
        }

        for (let i = 0; i < xrayEdgesOpaqueBin.length; i++) {
            this.#drawLayer(xrayEdgesOpaqueBin[i], RENDER_PASSES.EDGES_XRAYED);
        }

        if (xrayedSilhouetteTransparentBin.length > 0 || xrayEdgesTransparentBin.length > 0 || normalFillTransparentBin.length > 0 || edgesColorTransparentBin.length > 0) {
            gl.enable(gl.CULL_FACE);
            gl.enable(gl.BLEND);
            if (this.#canvasTransparent) {
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
                this.#drawLayer(xrayEdgesTransparentBin[i], RENDER_PASSES.EDGES_XRAYED);
            }
            for (let i = 0; i < xrayedSilhouetteTransparentBin.length; i++) {
                this.#drawLayer(xrayedSilhouetteTransparentBin[i], RENDER_PASSES.SILHOUETTE_XRAYED);
            }
            if (normalFillTransparentBin.length > 0 || edgesColorTransparentBin.length > 0) {
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            }
            for (let i = 0; i < edgesColorTransparentBin.length; i++) {
                this.#drawLayer(edgesColorTransparentBin[i], RENDER_PASSES.EDGES_COLOR_TRANSPARENT);
            }
            for (let i = 0; i < normalFillTransparentBin.length; i++) {
                this.#drawLayer(normalFillTransparentBin[i], RENDER_PASSES.COLOR_TRANSPARENT);
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
                this.#drawLayer(highlightedEdgesOpaqueBin[i], RENDER_PASSES.EDGES_HIGHLIGHTED);
            }
            for (let i = 0; i < highlightedSilhouetteOpaqueBin.length; i++) {
                this.#drawLayer(highlightedSilhouetteOpaqueBin[i], RENDER_PASSES.SILHOUETTE_HIGHLIGHTED);
            }
        }

        if (highlightedSilhouetteTransparentBin.length > 0 || highlightedEdgesTransparentBin.length > 0 || highlightedSilhouetteOpaqueBin.length > 0) {
            renderContext.lastProgramId = -1;
            gl.clear(gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.CULL_FACE);
            gl.enable(gl.BLEND);
            if (this.#canvasTransparent) {
                gl.blendEquation(gl.FUNC_ADD);
                gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            } else {
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            }
            for (let i = 0; i < highlightedEdgesTransparentBin.length; i++) {
                this.#drawLayer(highlightedEdgesTransparentBin[i], RENDER_PASSES.EDGES_HIGHLIGHTED);
            }
            for (let i = 0; i < highlightedSilhouetteTransparentBin.length; i++) {
                this.#drawLayer(highlightedSilhouetteTransparentBin[i], RENDER_PASSES.SILHOUETTE_HIGHLIGHTED);
            }
            gl.disable(gl.BLEND);
        }

        if (selectedSilhouetteOpaqueBin.length > 0 || selectedEdgesOpaqueBin.length > 0) {
            renderContext.lastProgramId = -1;
            gl.clear(gl.DEPTH_BUFFER_BIT);
            for (let i = 0; i < selectedEdgesOpaqueBin.length; i++) {
                this.#drawLayer(selectedEdgesOpaqueBin[i], RENDER_PASSES.EDGES_SELECTED);
            }
            for (let i = 0; i < selectedSilhouetteOpaqueBin.length; i++) {
                this.#drawLayer(selectedSilhouetteOpaqueBin[i], RENDER_PASSES.SILHOUETTE_SELECTED);
            }
        }

        if (selectedSilhouetteTransparentBin.length > 0 || selectedEdgesTransparentBin.length > 0) {
            renderContext.lastProgramId = -1;
            gl.clear(gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.CULL_FACE);
            gl.enable(gl.BLEND);
            if (this.#canvasTransparent) {
                gl.blendEquation(gl.FUNC_ADD);
                gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            } else {
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            }
            for (let i = 0; i < selectedEdgesTransparentBin.length; i++) {
                this.#drawLayer(selectedEdgesTransparentBin[i], RENDER_PASSES.EDGES_SELECTED);
            }
            for (let i = 0; i < selectedSilhouetteTransparentBin.length; i++) {
                this.#drawLayer(selectedSilhouetteTransparentBin[i], RENDER_PASSES.SILHOUETTE_SELECTED);
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

    #drawLayer(layer: Layer, renderPass: number): void {
        this.#renderContext.renderPass = renderPass;
        layer.draw(this.#rendererSet);
    }

    destroy() {
        if (this.#destroyed) {
            return;
        }
        if (this.#viewer) {
            this.detachViewer();
        }
        this.#destroyed = true;
    }
}
