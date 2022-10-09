import {WEBGL_INFO} from "./lib/webglInfo";
import {FrameContext} from "./lib/FrameContext";
import {RenderBufferManager} from "./lib/RenderBufferManager";
import {RenderBuffer} from "./lib/RenderBuffer";
import {SAOOcclusionRenderer} from "./lib/sao/SAOOcclusionRenderer";
import {SAODepthLimitedBlurRenderer} from "./lib/sao/SAODepthLimitedBlurRenderer";
import {WebGLSceneModel} from "./WebGLSceneModel";
import {getExtension} from "./lib/getExtension";

import {WebGLSceneRendererPickableMesh} from "./WebGLSceneRendererPickableMesh";
import {SceneRenderer} from "../SceneRenderer";
import {Viewer} from "../../Viewer";
import {View} from "../../view/View";
import {FloatArrayType} from "../../math/math";
import {SceneModel} from "../SceneModel";
import {SceneObject} from "../SceneObject";
import {ViewerCapabilities} from "../../ViewerCapabilities";
import {vec3} from "../../math/vector";
import {apply} from "../../utils/utils";
import {Map} from "../../utils/Map";
import {WebGLSceneRendererDrawableModel} from "./WebGLSceneRendererDrawableModel";
import {SceneModelParams} from "../SceneModelParams";
import {RENDER_PASSES} from "./WebGLSceneModel/lib/RENDER_PASSES";

const ua = navigator.userAgent.match(/(opera|chrome|safari|firefox|msie|mobile)\/?\s*(\.?\d+(\.\d+)*)/i);
const isSafari = (ua && ua[1].toLowerCase() === "safari");


/**
 * @private
 */
export class WebGLSceneRenderer implements SceneRenderer {
    gl: WebGL2RenderingContext;
    #stateSortDirty: boolean;
    readonly capabilities: ViewerCapabilities;
    #viewer: Viewer;
    #view: View;
    #frameContext: FrameContext;
    #canvasTransparent: boolean;
    #transparentEnabled: boolean;
    #edgesEnabled: boolean;
    #imageDirty: boolean;
    #saoEnabled: boolean;
    #shadowsDirty: boolean;
    #pbrEnabled: boolean;
    #backgroundColor: FloatArrayType;
    #drawables: { [key: string]: WebGLSceneRendererDrawableModel };
    #drawableTypeInfo: { [key: string]: { [key: string]: any } };
    #drawListDirty: boolean;
    #bindOutputFrameBuffer: any;
    #pickIDs = new Map({});
    #saoDepthRenderBuffer: RenderBuffer;
    #renderBufferManager: RenderBufferManager;
    #extensionHandles: any;
    #logarithmicDepthBufferEnabled: boolean;
    #alphaDepthMask: boolean;
    #snapshotBound: boolean;
    #occlusionTester: any;
    #saoOcclusionRenderer: SAOOcclusionRenderer;
    #saoDepthLimitedBlurRenderer: SAODepthLimitedBlurRenderer;

    constructor(options: {
        view: View,
        canvasElement: HTMLCanvasElement;
        alphaDepthMask: boolean;
        transparent: boolean;
    }) {

        this.#view = options.view;

        const WEBGL_CONTEXT_NAMES = ["webgl2"];
        const canvasElement = options.canvasElement;
        for (let i = 0; !this.gl && i < WEBGL_CONTEXT_NAMES.length; i++) {
            try {
                // @ts-ignore
                this.gl = canvasElement.getContext(WEBGL_CONTEXT_NAMES[i], this.contextAttr);
            } catch (e) { // Try with next context name
            }
        }

        if (!this.gl) {
            console.error('Failed to get a WebGL context');
            //this.events.fire("webglContextFailed", true, true);
        }

        if (this.gl) {
            this.gl.hint(this.gl.FRAGMENT_SHADER_DERIVATIVE_HINT, this.gl.NICEST);
        }

        this.#canvasTransparent = (!!options.transparent);
        this.#alphaDepthMask = options.alphaDepthMask;
        this.#extensionHandles = {};
        this.#pickIDs = new Map({});
        this.#drawableTypeInfo = {};
        this.#drawables = {};

        this.#drawListDirty = true;
        this.#stateSortDirty = true;
        this.#imageDirty = true;
        this.#shadowsDirty = true;

        this.#transparentEnabled = true;
        this.#edgesEnabled = true;
        this.#saoEnabled = true;
        this.#pbrEnabled = true;

        this.#backgroundColor = vec3();
        this.#renderBufferManager = new RenderBufferManager(this.#view, this.gl);
        this.#snapshotBound = false;
        this.#saoOcclusionRenderer = new SAOOcclusionRenderer(this.#view, this.gl);
        this.#saoDepthLimitedBlurRenderer = new SAODepthLimitedBlurRenderer(this.#view, this.gl);
        this.#occlusionTester = null; // Lazy-created in #addMarker()

        this.capabilities = {
            astcSupported: !!getExtension(this.gl, 'WEBGL_compressed_texture_astc'),
            etc1Supported: true, // WebGL2
            etc2Supported: !!getExtension(this.gl, 'WEBGL_compressed_texture_etc'),
            dxtSupported: !!getExtension(this.gl, 'WEBGL_compressed_texture_s3tc'),
            bptcSupported: !!getExtension(this.gl, 'EXT_texture_compression_bptc'),
            pvrtcSupported: !!(getExtension(this.gl, 'WEBGL_compressed_texture_pvrtc') || getExtension(this.gl, 'WEBKIT_WEBGL_compressed_texture_pvrtc'))
        };

        this.#frameContext = new FrameContext(this.#view, this.gl);
    }

    getCapabilities(): ViewerCapabilities {
        return this.capabilities;
    }

    registerView(view: View): number {      // NOP
        return 0;
    }

    deregisterView(viewIndex: number): void {         // NOP
    }

    createSceneModel(cfg: SceneModelParams): SceneModel {
        const sceneModel = new WebGLSceneModel(apply({
            view: this.#view,
            scene: this.#viewer.scene,
            webglSceneRenderer: this,
        }, cfg));
        sceneModel.events.on("finalized", () => {
            this.#registerSceneModel(cfg.id, sceneModel);
        });
        sceneModel.events.on("destroyed", () => {
            this.#deregisterSceneModel(cfg.id);
        });
        return sceneModel;
    }

    needStateSort() {
        this.#stateSortDirty = true;
    }

    getPickID(pickable: WebGLSceneRendererPickableMesh): number {
        // @ts-ignore
        return this.#pickIDs.addItem(pickable);
    }

    setImageDirty(viewIndex?: number) {
        this.#imageDirty = true;
    }

    putPickID(pickId: number) {
        this.#pickIDs.removeItem(pickId);
    }

    setBackgroundColor(viewIndex: number, color: FloatArrayType): void {
        // @ts-ignore
        this.#backgroundColor.set(color);
        this.#imageDirty = true;
    }

    setEdgesEnabled(viewIndex: number, enabled: boolean): void {
        this.#edgesEnabled = enabled;
        this.#imageDirty = true;
    }

    setPBREnabled(viewIndex: number, enabled: boolean): void {
        this.#pbrEnabled = enabled;
        this.#imageDirty = true;
    }

    getSAOSupported(): boolean {
        return isSafari && WEBGL_INFO.SUPPORTED_EXTENSIONS["OES_standard_derivatives"];
    }

    setSAOEnabled(viewIndex: number, enabled: boolean): void {
        this.#saoEnabled = enabled;
        this.#imageDirty = true;
    }

    setTransparentEnabled(viewIndex: number, enabled: boolean): void {
        this.#transparentEnabled = enabled;
        this.#imageDirty = true;
    }

    #registerSceneModel(id: string | number, drawable: WebGLSceneRendererDrawableModel) {
        const type = drawable.constructor.name;
        if (!type) {
            console.error("WebGLRenderer#registerSceneModel() : Drawable with ID " + id + " has no 'type' - ignoring");
            return;
        }
        let drawableInfo = this.#drawableTypeInfo[type];
        if (!drawableInfo) {
            drawableInfo = {
                type: type,
                count: 0,
                // isStateSortable: drawable.isStateSortable,
                // stateSortCompare: drawable.stateSortCompare,

                isStateSortable: true,
                stateSortCompare: true,

                drawableMap: {},
                drawableListPreCull: [],
                drawableList: []
            };
            this.#drawableTypeInfo[type] = drawableInfo;
        }
        drawableInfo.count++;
        drawableInfo.drawableMap[id] = drawable;
        this.#drawables[id] = drawable;
        this.#drawListDirty = true;
    }

    #deregisterSceneModel(id: string | number) {
        const drawable = this.#drawables[id];
        if (!drawable) {
            console.error("Renderer#deregisterSceneModel() : drawable not found with ID " + id + " - ignoring");
            return;
        }
        const type = drawable.constructor.name;
        const drawableInfo = this.#drawableTypeInfo[type];
        if (--drawableInfo.count <= 0) {
            delete this.#drawableTypeInfo[type];
        } else {
            delete drawableInfo.drawableMap[id];
        }
        delete this.#drawables[id];
        this.#drawListDirty = true;
    }

    /**
     * Clears this renderer,
     * @param viewIndex
     * @param params
     */
    clear(viewIndex: number, params: {
        renderPass?: number;
    }) {
        params = params || {};
        this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
        if (this.#canvasTransparent) {
            this.gl.clearColor(1, 1, 1, 1);
        } else {
            this.gl.clearColor(this.#backgroundColor[0], this.#backgroundColor[1], this.#backgroundColor[2], 1.0);
        }
        if (this.#bindOutputFrameBuffer) {
            this.#bindOutputFrameBuffer(params.renderPass);
        }
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    };

    /**
     * Gets if a frame needs to be rendered.
     * @param viewIndex Ignored
     */
    needsRender(viewIndex?: number): boolean {
        return (this.#imageDirty || this.#drawListDirty || this.#stateSortDirty);
    }

    /**
     * Renders a frame.
     * @param viewIndex Ignored
     * @param params
     */
    render(viewIndex: number, params: {
        force?: boolean;
    }) {
        params = params || {};
        if (params.force) {
            this.#imageDirty = true;
        }
        this.#updateDrawList();
        if (this.#imageDirty) {
            this.#draw({clear: true});
            this.#imageDirty = false;
        }
    }

    /**
     * Perform a pick.
     * @param viewIndex Ignored
     * @param params
     */
    pickSceneObject(viewIndex: number, params: {}): SceneObject {
        return null;
    };

    #updateDrawList() {
        if (this.#drawListDirty) {
            this.#buildDrawList();
            this.#drawListDirty = false;
            this.#stateSortDirty = true;
        }
        if (this.#stateSortDirty) {
            this.#sortDrawList();
            this.#stateSortDirty = false;
            this.#imageDirty = true;
        }
        if (this.#imageDirty) {
            this.#cullDrawList();
        }
    }

    #buildDrawList() {
        for (let type in this.#drawableTypeInfo) {
            if (this.#drawableTypeInfo.hasOwnProperty(type)) {
                const drawableInfo = this.#drawableTypeInfo[type];
                const drawableMap = drawableInfo.drawableMap;
                const drawableListPreCull = drawableInfo.drawableListPreCull;
                let lenDrawableList = 0;
                for (let id in drawableMap) {
                    if (drawableMap.hasOwnProperty(id)) {
                        drawableListPreCull[lenDrawableList++] = drawableMap[id];
                    }
                }
                drawableListPreCull.length = lenDrawableList;
            }
        }
    }

    #sortDrawList() {
        for (let type in this.#drawableTypeInfo) {
            if (this.#drawableTypeInfo.hasOwnProperty(type)) {
                const drawableInfo = this.#drawableTypeInfo[type];
                if (drawableInfo.isStateSortable) {
                    drawableInfo.drawableListPreCull.sort(drawableInfo.stateSortCompare);
                }
            }
        }
    }

    #cullDrawList() {
        for (let type in this.#drawableTypeInfo) {
            if (this.#drawableTypeInfo.hasOwnProperty(type)) {
                const drawableInfo = this.#drawableTypeInfo[type];
                const drawableListPreCull = drawableInfo.drawableListPreCull;
                const drawableList = drawableInfo.drawableList;
                let lenDrawableList = 0;
                for (let i = 0, len = drawableListPreCull.length; i < len; i++) {
                    const drawable = drawableListPreCull[i];
                    drawable.rebuildRenderFlags();
                    if (!drawable.renderFlags.culled) {
                        drawableList[lenDrawableList++] = drawable;
                    }
                }
                drawableList.length = lenDrawableList;
            }
        }
    }

    #draw(params: {
        clear: boolean;
    }) {
        if (WEBGL_INFO.SUPPORTED_EXTENSIONS["OES_element_index_uint"]) {
            this.#extensionHandles.OES_element_index_uint = this.gl.getExtension("OES_element_index_uint");
        }
        if (this.#logarithmicDepthBufferEnabled && WEBGL_INFO.SUPPORTED_EXTENSIONS["EXT_frag_depth"]) {
            this.#extensionHandles.EXT_frag_depth = this.gl.getExtension('EXT_frag_depth');
        }
        if (WEBGL_INFO.SUPPORTED_EXTENSIONS["WEBGL_depth_texture"]) {
            this.#extensionHandles.WEBGL_depth_texture = this.gl.getExtension('WEBGL_depth_texture');
        }
        if (this.#saoEnabled && this.#view.sao.possible) {
            this.#drawSAOBuffers(params);
        }
        this.#drawColor(params);
    }

    #drawSAOBuffers(params: {
        clear: boolean;
    }) {
        const sao = this.#view.sao;
        // Render depth buffer
        const saoDepthRenderBuffer = this.#renderBufferManager.getRenderBuffer("saoDepth", {
            depthTexture: WEBGL_INFO.SUPPORTED_EXTENSIONS["WEBGL_depth_texture"]
        });
        this.#saoDepthRenderBuffer.bind();
        this.#saoDepthRenderBuffer.clear();
        this.#drawDepth(params);
        this.#saoDepthRenderBuffer.unbind();
        // Render occlusion buffer
        const occlusionRenderBuffer1 = this.#renderBufferManager.getRenderBuffer("saoOcclusion");
        occlusionRenderBuffer1.bind();
        occlusionRenderBuffer1.clear();
        this.#saoOcclusionRenderer.render(saoDepthRenderBuffer);
        occlusionRenderBuffer1.unbind();
        if (sao.blur) {
            // Horizontally blur occlusion buffer 1 into occlusion buffer 2
            const occlusionRenderBuffer2 = this.#renderBufferManager.getRenderBuffer("saoOcclusion2");
            occlusionRenderBuffer2.bind();
            occlusionRenderBuffer2.clear();
            this.#saoDepthLimitedBlurRenderer.render(saoDepthRenderBuffer, occlusionRenderBuffer1, 0);
            occlusionRenderBuffer2.unbind();
            // Vertically blur occlusion buffer 2 back into occlusion buffer 1
            occlusionRenderBuffer1.bind();
            occlusionRenderBuffer1.clear();
            this.#saoDepthLimitedBlurRenderer.render(saoDepthRenderBuffer, occlusionRenderBuffer2, 1);
            occlusionRenderBuffer1.unbind();
        }
    }

    #drawDepth(params: {
        clear: boolean
    }) {
        this.#frameContext.reset();
        const gl = this.gl;
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.clearColor(0, 0, 0, 0);
        gl.enable(gl.DEPTH_TEST);
        gl.frontFace(gl.CCW);
        gl.enable(gl.CULL_FACE);
        gl.depthMask(true);
        if (params.clear !== false) {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        }
        for (let type in this.#drawableTypeInfo) {
            if (this.#drawableTypeInfo.hasOwnProperty(type)) {
                const drawableInfo = this.#drawableTypeInfo[type];
                const drawableList = drawableInfo.drawableList;
                for (let i = 0, len = drawableList.length; i < len; i++) {
                    const drawable = drawableList[i];
                    if (drawable.culled === true || drawable.visible === false || !drawable.drawDepth) {
                        continue;
                    }
                    if (drawable.renderFlags.colorOpaque) {
                        drawable.drawDepth(this.#frameContext);
                    }
                }
            }
        }
        // const numVertexAttribs = WEBGL_INFO.MAX_VERTEX_ATTRIBS; // Fixes https://github.com/xeokit/xeokit-sdk/issues/174
        // for (let ii = 0; ii < numVertexAttribs; ii++) {
        //     gl.disableVertexAttribArray(ii);
        // }
    }

    #drawColor(params: {
        clear: boolean;
    }) {

        const view = this.#view;
        const frameContext = this.#frameContext;
        const gl = this.gl;

        const normalDrawSAOBin: WebGLSceneRendererDrawableModel[] = [];
        const normalEdgesOpaqueBin: WebGLSceneRendererDrawableModel[] = [];
        const normalFillTransparentBin: WebGLSceneRendererDrawableModel[] = [];
        const normalEdgesTransparentBin: WebGLSceneRendererDrawableModel[] = [];
        const xrayedFillOpaqueBin: WebGLSceneRendererDrawableModel[] = [];
        const xrayEdgesOpaqueBin: WebGLSceneRendererDrawableModel[] = [];
        const xrayedFillTransparentBin: WebGLSceneRendererDrawableModel[] = [];
        const xrayEdgesTransparentBin: WebGLSceneRendererDrawableModel[] = [];
        const highlightedFillOpaqueBin: WebGLSceneRendererDrawableModel[] = [];
        const highlightedEdgesOpaqueBin: WebGLSceneRendererDrawableModel[] = [];
        const highlightedFillTransparentBin: WebGLSceneRendererDrawableModel[] = [];
        const highlightedEdgesTransparentBin: WebGLSceneRendererDrawableModel[] = [];
        const selectedFillOpaqueBin: WebGLSceneRendererDrawableModel[] = [];
        const selectedEdgesOpaqueBin: WebGLSceneRendererDrawableModel[] = [];
        const selectedFillTransparentBin: WebGLSceneRendererDrawableModel[] = [];
        const selectedEdgesTransparentBin: WebGLSceneRendererDrawableModel[] = [];

        frameContext.reset();
        frameContext.withSAO = false;
        frameContext.pbrEnabled = this.#pbrEnabled && !!view.pbrEnabled;

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

        frameContext.lineWidth = 1;

        const saoPossible = view.sao.possible;

        if (this.#saoEnabled && saoPossible) {
            const occlusionRenderBuffer1 = this.#renderBufferManager.getRenderBuffer("saoOcclusion");
            frameContext.occlusionTexture = occlusionRenderBuffer1 ? occlusionRenderBuffer1.getTexture() : null;
        } else {
            frameContext.occlusionTexture = null;

        }

        if (params.clear !== false) {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        }

        // Render normal opaque solids, defer others to subsequent bins, to render after

        let normalDrawSAOBinLen = 0;
        let normalEdgesOpaqueBinLen = 0;
        let normalFillTransparentBinLen = 0;
        let normalEdgesTransparentBinLen = 0;
        let xrayedFillOpaqueBinLen = 0;
        let xrayEdgesOpaqueBinLen = 0;
        let xrayedFillTransparentBinLen = 0;
        let xrayEdgesTransparentBinLen = 0;
        let highlightedFillOpaqueBinLen = 0;
        let highlightedEdgesOpaqueBinLen = 0;
        let highlightedFillTransparentBinLen = 0;
        let highlightedEdgesTransparentBinLen = 0;
        let selectedFillOpaqueBinLen = 0;
        let selectedEdgesOpaqueBinLen = 0;
        let selectedFillTransparentBinLen = 0;
        let selectedEdgesTransparentBinLen = 0;

        for (let type in this.#drawableTypeInfo) {
            if (this.#drawableTypeInfo.hasOwnProperty(type)) {
                const drawableInfo = this.#drawableTypeInfo[type];
                const drawableList = drawableInfo.drawableList;
                for (let i = 0, len = drawableList.length; i < len; i++) {
                    const drawable = drawableList[i];
                    if (drawable.culled === true || drawable.visible === false) {
                        continue;
                    }
                    const renderFlags = drawable.renderFlags;
                    if (renderFlags.colorOpaque) {
                        if (this.#saoEnabled && saoPossible && drawable.saoEnabled) {
                            normalDrawSAOBin[normalDrawSAOBinLen++] = drawable;
                        } else {
                            drawable.drawColorOpaque(frameContext);
                        }
                    }
                    if (this.#transparentEnabled) {
                        if (renderFlags.colorTransparent) {
                            normalFillTransparentBin[normalFillTransparentBinLen++] = drawable;
                        }
                    }
                    if (renderFlags.xrayedSilhouetteTransparent) {
                        xrayedFillTransparentBin[xrayedFillTransparentBinLen++] = drawable;
                    }
                    if (renderFlags.xrayedSilhouetteOpaque) {
                        xrayedFillOpaqueBin[xrayedFillOpaqueBinLen++] = drawable;
                    }
                    if (renderFlags.highlightedSilhouetteTransparent) {
                        highlightedFillTransparentBin[highlightedFillTransparentBinLen++] = drawable;
                    }
                    if (renderFlags.highlightedSilhouetteOpaque) {
                        highlightedFillOpaqueBin[highlightedFillOpaqueBinLen++] = drawable;
                    }
                    if (renderFlags.selectedSilhouetteTransparent) {
                        selectedFillTransparentBin[selectedFillTransparentBinLen++] = drawable;
                    }
                    if (renderFlags.selectedSilhouetteOpaque) {
                        selectedFillOpaqueBin[selectedFillOpaqueBinLen++] = drawable;
                    }
                    if (this.#edgesEnabled) {
                        if (renderFlags.edgesOpaque) {
                            normalEdgesOpaqueBin[normalEdgesOpaqueBinLen++] = drawable;
                        }
                        if (renderFlags.edgesTransparent) {
                            normalEdgesTransparentBin[normalEdgesTransparentBinLen++] = drawable;
                        }
                    }
                    if (renderFlags.selectedEdgesTransparent) {
                        selectedEdgesTransparentBin[selectedEdgesTransparentBinLen++] = drawable;
                    }
                    if (renderFlags.selectedEdgesOpaque) {
                        selectedEdgesOpaqueBin[selectedEdgesOpaqueBinLen++] = drawable;
                    }
                    if (renderFlags.xrayedEdgesTransparent) {
                        xrayEdgesTransparentBin[xrayEdgesTransparentBinLen++] = drawable;
                    }
                    if (renderFlags.xrayedEdgesOpaque) {
                        xrayEdgesOpaqueBin[xrayEdgesOpaqueBinLen++] = drawable;
                    }
                    if (renderFlags.highlightedEdgesTransparent) {
                        highlightedEdgesTransparentBin[highlightedEdgesTransparentBinLen++] = drawable;
                    }
                    if (renderFlags.highlightedEdgesOpaque) {
                        highlightedEdgesOpaqueBin[highlightedEdgesOpaqueBinLen++] = drawable;
                    }
                }
            }
        }

        // Render deferred bins

        if (normalDrawSAOBinLen > 0) {
            frameContext.withSAO = true;
            for (let i = 0; i < normalDrawSAOBinLen; i++) {
                normalDrawSAOBin[i].drawColorOpaque(frameContext);
            }
        }
        for (let i = 0; i < normalEdgesOpaqueBinLen; i++) {
            normalEdgesOpaqueBin[i].drawEdgesColorOpaque(frameContext);
        }
        for (let i = 0; i < xrayedFillOpaqueBinLen; i++) {
            xrayedFillOpaqueBin[i].drawSilhouetteXRayed(frameContext);
        }
        for (let i = 0; i < xrayEdgesOpaqueBinLen; i++) {
            xrayEdgesOpaqueBin[i].drawEdgesXRayed(frameContext);
        }
        if (xrayedFillTransparentBinLen > 0 || xrayEdgesTransparentBinLen > 0 || normalFillTransparentBinLen > 0 || normalEdgesTransparentBinLen > 0) {
            gl.enable(gl.CULL_FACE);
            gl.enable(gl.BLEND);
            if (this.#canvasTransparent) {
                gl.blendEquation(gl.FUNC_ADD);
                gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            } else {
                gl.blendEquation(gl.FUNC_ADD);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            }
            frameContext.backfaces = false;
            if (!this.#alphaDepthMask) {
                gl.depthMask(false);
            }
            for (let i = 0; i < xrayEdgesTransparentBinLen; i++) {
                xrayEdgesTransparentBin[i].drawEdgesXRayed(frameContext);
            }
            for (let i = 0; i < xrayedFillTransparentBinLen; i++) {
                xrayedFillTransparentBin[i].drawSilhouetteXRayed(frameContext);
            }
            if (normalFillTransparentBinLen > 0 || normalEdgesTransparentBinLen > 0) {
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            }
            for (let i = 0; i < normalEdgesTransparentBinLen; i++) {
                normalEdgesTransparentBin[i].drawEdgesColorTransparent(frameContext);
            }
            for (let i = 0; i < normalFillTransparentBinLen; i++) {
                const drawable = normalFillTransparentBin[i];
                drawable.drawColorTransparent(frameContext);
            }
            gl.disable(gl.BLEND);
            if (!this.#alphaDepthMask) {
                gl.depthMask(true);
            }
        }
        if (highlightedFillOpaqueBinLen > 0 || highlightedEdgesOpaqueBinLen > 0) {
            frameContext.lastProgramId = null;
            gl.clear(gl.DEPTH_BUFFER_BIT);
            for (let i = 0; i < highlightedEdgesOpaqueBinLen; i++) {
                highlightedEdgesOpaqueBin[i].drawEdgesHighlighted(frameContext);
            }
            for (let i = 0; i < highlightedFillOpaqueBinLen; i++) {
                highlightedFillOpaqueBin[i].drawSilhouetteHighlighted(frameContext);
            }
        }
        if (highlightedFillTransparentBinLen > 0 || highlightedEdgesTransparentBinLen > 0 || highlightedFillOpaqueBinLen > 0) {
            frameContext.lastProgramId = null;
            gl.clear(gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.CULL_FACE);
            gl.enable(gl.BLEND);
            if (this.#canvasTransparent) {
                gl.blendEquation(gl.FUNC_ADD);
                gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            } else {
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            }
            for (let i = 0; i < highlightedEdgesTransparentBinLen; i++) {
                highlightedEdgesTransparentBin[i].drawEdgesHighlighted(frameContext);
            }
            for (let i = 0; i < highlightedFillTransparentBinLen; i++) {
                highlightedFillTransparentBin[i].drawSilhouetteHighlighted(frameContext);
            }
            gl.disable(gl.BLEND);
        }
        if (selectedFillOpaqueBinLen > 0 || selectedEdgesOpaqueBinLen > 0) {
            frameContext.lastProgramId = null;
            gl.clear(gl.DEPTH_BUFFER_BIT);
            for (let i = 0; i < selectedEdgesOpaqueBinLen; i++) {
                selectedEdgesOpaqueBin[i].drawEdgesSelected(frameContext);
            }
            for (let i = 0; i < selectedFillOpaqueBinLen; i++) {
                selectedFillOpaqueBin[i].drawSilhouetteSelected(frameContext);
            }
        }
        if (selectedFillTransparentBinLen > 0 || selectedEdgesTransparentBinLen > 0) {
            frameContext.lastProgramId = null;
            gl.clear(gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.CULL_FACE);
            gl.enable(gl.BLEND);
            if (this.#canvasTransparent) {
                gl.blendEquation(gl.FUNC_ADD);
                gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            } else {
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            }
            for (let i = 0; i < selectedEdgesTransparentBinLen; i++) {
                selectedEdgesTransparentBin[i].drawEdgesSelected(frameContext);
            }
            for (let i = 0; i < selectedFillTransparentBinLen; i++) {
                selectedFillTransparentBin[i].drawSilhouetteSelected(frameContext);
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
}