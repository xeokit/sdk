import {
    math,
    Renderer,
    SceneModel,
    SceneModelParams,
    SceneObject,
    utils,
    View,
    Viewer,
    ViewerCapabilities
} from "../../viewer/index";

import {WEBGL_INFO} from "../lib/webglInfo";
import {FrameContext} from "./FrameContext";
import {RenderBufferManager} from "../lib/RenderBufferManager";
import {RenderBuffer} from "../lib/RenderBuffer";
import {SAOOcclusionRenderer} from "./lib/sao/SAOOcclusionRenderer";
import {SAODepthLimitedBlurRenderer} from "./lib/sao/SAODepthLimitedBlurRenderer";
import {getExtension} from "../lib/getExtension";
import {Pickable} from "./Pickable";
import {Drawable} from "./Drawable";
import {WebGLSceneModel} from "../WebGLSceneModel/WebGLSceneModel";

const ua = navigator.userAgent.match(/(opera|chrome|safari|firefox|msie|mobile)\/?\s*(\.?\d+(\.\d+)*)/i);
const isSafari = (ua && ua[1].toLowerCase() === "safari");

/**
 * Creates and renders geometry and materials for a {@link Viewer} using [WebGL](https://en.wikipedia.org/wiki/WebGL).
 *
 * You don't normally want to touch this, unless you're configuring a custom allocation/rendering strategy for your Viewer
 */
export class WebGLRenderer implements Renderer {

    gl: WebGL2RenderingContext;

    #stateSortDirty: boolean;
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
    #backgroundColor: math.FloatArrayType;
    #drawables: { [key: string]: Drawable };
    #drawListPreCull: Drawable[];
    #drawList: Drawable[];
    #drawListDirty: boolean;
    #pickIDs = new utils.Map({});
    #saoDepthRenderBuffer: RenderBuffer;
    #renderBufferManager: RenderBufferManager;
    #extensionHandles: any;
    #logarithmicDepthBufferEnabled: boolean;
    #alphaDepthMask: boolean;
    #snapshotBound: boolean;
    #occlusionTester: any;
    #saoOcclusionRenderer: SAOOcclusionRenderer;
    #saoDepthLimitedBlurRenderer: SAODepthLimitedBlurRenderer;

    constructor() {

        this.#canvasTransparent = false;
        this.#alphaDepthMask = false;
        this.#extensionHandles = {};
        this.#pickIDs = new utils.Map({});
        this.#drawables = {};
        this.#drawListPreCull = [];
        this.#drawList = [];
        this.#drawListDirty = true;
        this.#stateSortDirty = true;
        this.#imageDirty = true;
        this.#shadowsDirty = true;
        this.#transparentEnabled = true;
        this.#edgesEnabled = true;
        this.#saoEnabled = true;
        this.#pbrEnabled = true;
        this.#backgroundColor = math.vec3();
        this.#renderBufferManager = new RenderBufferManager(this.#view, this.gl);
        this.#snapshotBound = false;
        this.#saoOcclusionRenderer = new SAOOcclusionRenderer(this.#view, this.gl);
        this.#saoDepthLimitedBlurRenderer = new SAODepthLimitedBlurRenderer(this.#view, this.gl);
        this.#occlusionTester = null; // Lazy-created in #addMarker()
        this.#frameContext = null;
    }

    init(viewer: Viewer): void { // NOP
    }

    getCapabilities(capabilities: ViewerCapabilities): void {
        capabilities.maxViews = 1;
        const canvasElement = document.createElement('canvas');
        let gl;
        try {
            gl = canvasElement.getContext("webgl2");
        } catch (e) {
            console.error('Failed to get a WebGL context');
        }
        if (gl) {
            capabilities.astcSupported = !!getExtension(gl, 'WEBGL_compressed_texture_astc');
            capabilities.etc1Supported = true; // WebGL
            capabilities.etc2Supported = !!getExtension(gl, 'WEBGL_compressed_texture_etc');
            capabilities.dxtSupported = !!getExtension(gl, 'WEBGL_compressed_texture_s3tc');
            capabilities.bptcSupported = !!getExtension(gl, 'EXT_texture_compression_bptc');
            capabilities.pvrtcSupported = !!(getExtension(gl, 'WEBGL_compressed_texture_pvrtc') || getExtension(gl, 'WEBKIT_WEBGL_compressed_texture_pvrtc'));
        }
    }

    registerView(view: View): number {
        this.#view = view;
        const WEBGL_CONTEXT_NAMES = ["webgl"];
        const canvasElement = view.canvas.canvas;
        for (let i = 0; !this.gl && i < WEBGL_CONTEXT_NAMES.length; i++) {
            try {
                // @ts-ignore
                this.gl = canvasElement.getContext(WEBGL_CONTEXT_NAMES[i], this.contextAttr);
            } catch (e) { // Try with next context name
            }
        }
        if (!this.gl) {
            console.error('Failed to get a WebGL2 context');
            //this.events.fire("webglContextFailed", true, true);
        }
        if (this.gl) {
            this.gl.hint(this.gl.FRAGMENT_SHADER_DERIVATIVE_HINT, this.gl.NICEST);
        }
        this.#frameContext = new FrameContext(this.#view, this.gl);
        // this.#canvasTransparent = (!!view.transparent);
        // this.#alphaDepthMask = view.alphaDepthMask;
        return 0;
    }

    deregisterView(viewIndex: number): void {
    }

    createSceneModel(params: SceneModelParams): SceneModel {
        const webglSceneModel = new WebGLSceneModel(utils.apply({
            view: this.#view,
            scene: this.#viewer.scene,
            webglRenderer: this,
        }, params));
        webglSceneModel.events.on("finalized", () => {
            this.#drawables[webglSceneModel.id] = webglSceneModel;
            this.#drawListDirty = true;
        });
        webglSceneModel.events.on("destroyed", () => {
            delete this.#drawables[webglSceneModel.id];
            this.#drawListDirty = true;
        });
        return webglSceneModel;
    }

    /**
     * @private
     */
    registerPickable(pickable: Pickable): number {
        // @ts-ignore
        return this.#pickIDs.addItem(pickable);
    }

    /**
     * @private
     */
    deregisterPickable(pickId: number) {
        this.#pickIDs.removeItem(pickId);
    }

    setImageDirty(viewIndex?: number) {
        this.#imageDirty = true;
    }

    setBackgroundColor(viewIndex: number, color: math.FloatArrayType): void {
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

    clear(viewIndex: number) {
        this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
        if (this.#canvasTransparent) {
            this.gl.clearColor(1, 1, 1, 1);
        } else {
            this.gl.clearColor(this.#backgroundColor[0], this.#backgroundColor[1], this.#backgroundColor[2], 1.0);
        }
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    };

    needsRender(viewIndex?: number): boolean {
        return (this.#imageDirty || this.#drawListDirty || this.#stateSortDirty);
    }

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
        let lenDrawableList = 0;
        for (let id in this.#drawables) {
            this.#drawListPreCull[lenDrawableList++] = this.#drawables[id];
        }
        this.#drawListPreCull.length = lenDrawableList;
    }

    #sortDrawList() {
//        this.#drawListPreCull.sort(drawableInfo.stateSortCompare);
    }


    #cullDrawList() {
        let lenDrawableList = 0;
        for (let i = 0, len = this.#drawListPreCull.length; i < len; i++) {
            const drawable = this.#drawListPreCull[i];
            drawable.rebuildDrawFlags();
            if (!drawable.drawFlags.culled) {
                this.#drawList[lenDrawableList++] = drawable;
            }
        }
        this.#drawList.length = lenDrawableList;
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

        for (let i = 0, len = this.#drawList.length; i < len; i++) {
            const drawable = this.#drawList[i];
            // if (drawable.culled === true || drawable.visible === false || !drawable.drawDepth) {
            //     continue;
            // }
            if (drawable.drawFlags.colorOpaque) {
                drawable.drawDepth(this.#frameContext);
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

        const normalDrawSAOBin: Drawable[] = [];
        const normalEdgesOpaqueBin: Drawable[] = [];
        const normalFillTransparentBin: Drawable[] = [];
        const normalEdgesTransparentBin: Drawable[] = [];
        const xrayedFillOpaqueBin: Drawable[] = [];
        const xrayEdgesOpaqueBin: Drawable[] = [];
        const xrayedFillTransparentBin: Drawable[] = [];
        const xrayEdgesTransparentBin: Drawable[] = [];
        const highlightedFillOpaqueBin: Drawable[] = [];
        const highlightedEdgesOpaqueBin: Drawable[] = [];
        const highlightedFillTransparentBin: Drawable[] = [];
        const highlightedEdgesTransparentBin: Drawable[] = [];
        const selectedFillOpaqueBin: Drawable[] = [];
        const selectedEdgesOpaqueBin: Drawable[] = [];
        const selectedFillTransparentBin: Drawable[] = [];
        const selectedEdgesTransparentBin: Drawable[] = [];

        frameContext.reset();
        frameContext.withSAO = false;
        frameContext.pbrEnabled = this.#pbrEnabled && !!view.qualityRender;

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

        for (let i = 0, len = this.#drawList.length; i < len; i++) {
            const drawable = this.#drawList[i];
            // if (drawable.culled === true || drawable.visible === false) {
            //     continue;
            // }
            const drawFlags = drawable.drawFlags;
            if (drawFlags.colorOpaque) {
                if (this.#saoEnabled && saoPossible && drawable.qualityRender) {
                    normalDrawSAOBin[normalDrawSAOBinLen++] = drawable;
                } else {
                    drawable.drawColorOpaque(frameContext);
                }
            }
            if (this.#transparentEnabled) {
                if (drawFlags.colorTransparent) {
                    normalFillTransparentBin[normalFillTransparentBinLen++] = drawable;
                }
            }
            if (drawFlags.xrayedSilhouetteTransparent) {
                xrayedFillTransparentBin[xrayedFillTransparentBinLen++] = drawable;
            }
            if (drawFlags.xrayedSilhouetteOpaque) {
                xrayedFillOpaqueBin[xrayedFillOpaqueBinLen++] = drawable;
            }
            if (drawFlags.highlightedSilhouetteTransparent) {
                highlightedFillTransparentBin[highlightedFillTransparentBinLen++] = drawable;
            }
            if (drawFlags.highlightedSilhouetteOpaque) {
                highlightedFillOpaqueBin[highlightedFillOpaqueBinLen++] = drawable;
            }
            if (drawFlags.selectedSilhouetteTransparent) {
                selectedFillTransparentBin[selectedFillTransparentBinLen++] = drawable;
            }
            if (drawFlags.selectedSilhouetteOpaque) {
                selectedFillOpaqueBin[selectedFillOpaqueBinLen++] = drawable;
            }
            if (this.#edgesEnabled) {
                if (drawFlags.edgesOpaque) {
                    normalEdgesOpaqueBin[normalEdgesOpaqueBinLen++] = drawable;
                }
                if (drawFlags.edgesTransparent) {
                    normalEdgesTransparentBin[normalEdgesTransparentBinLen++] = drawable;
                }
            }
            if (drawFlags.selectedEdgesTransparent) {
                selectedEdgesTransparentBin[selectedEdgesTransparentBinLen++] = drawable;
            }
            if (drawFlags.selectedEdgesOpaque) {
                selectedEdgesOpaqueBin[selectedEdgesOpaqueBinLen++] = drawable;
            }
            if (drawFlags.xrayedEdgesTransparent) {
                xrayEdgesTransparentBin[xrayEdgesTransparentBinLen++] = drawable;
            }
            if (drawFlags.xrayedEdgesOpaque) {
                xrayEdgesOpaqueBin[xrayEdgesOpaqueBinLen++] = drawable;
            }
            if (drawFlags.highlightedEdgesTransparent) {
                highlightedEdgesTransparentBin[highlightedEdgesTransparentBinLen++] = drawable;
            }
            if (drawFlags.highlightedEdgesOpaque) {
                highlightedEdgesOpaqueBin[highlightedEdgesOpaqueBinLen++] = drawable;
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
            frameContext.lastProgramId = null; // HACK
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