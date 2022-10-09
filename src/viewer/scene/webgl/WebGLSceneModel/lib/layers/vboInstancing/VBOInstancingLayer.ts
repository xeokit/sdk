import {ENTITY_FLAGS} from '../../ENTITY_FLAGS';
import {RENDER_PASSES} from '../../RENDER_PASSES';
import * as math from "../../../../../../math"
import {WebGLSceneModel} from "../../../WebGLSceneModel";
import {RenderState} from "../../../../../../utils/RenderState";
import {ArrayBuf} from "../../../../lib/ArrayBuf";
import {RenderFlags} from "../../RenderFlags";
import {FrameContext} from "../../../../lib/FrameContext";
import {WebGLTextureSet} from "../../WebGLTextureSet";
import {WebGLGeometry} from "../../WebGLGeometry";


const tempUint8Vec4 = new Uint8Array(4);
const tempVec4a = math.vec4([0, 0, 0, 1]);
const tempVec4b = math.vec4([0, 0, 0, 1]);
const tempVec4c = math.vec4([0, 0, 0, 1]);
const tempVec3fa = new Float32Array(3);

export interface VBOInstancingLayerCfg {
    layerIndex: number;
    sceneModel: WebGLSceneModel;
    textureSet?: WebGLTextureSet;
    geometry: WebGLGeometry;
    origin?: any;
    material?: any;
    solid?: boolean;
    sortId?: string;
}

/**
 * @private
 */
export class VBOInstancingLayer {

    layerIndex: number;
    sceneModel: WebGLSceneModel;
    geometry: WebGLGeometry;
    material: any;
    sortId: string;
    state: any;
    aabb: math.FloatArrayType;
    #numPortions: number;
    #numVisibleLayerPortions: number;
    #numTransparentLayerPortions: number;
    #numXRayedLayerPortions: number;
    #numHighlightedLayerPortions: number;
    #numSelectedLayerPortions: number;
    #numClippableLayerPortions = 0;
    #numEdgesLayerPortions = 0;
    #numPickableLayerPortions = 0;
    #numCulledLayerPortions = 0;
    #finalized: boolean;
    #colors: number[];
    #offsets: number[];
    #modelMatrixCol0: number[];
    #modelMatrixCol1: number[];
    #modelMatrixCol2: number[];
    #portions: any;
    #modelAABB: math.FloatArrayType;
    #renderers: any;
    private solid: boolean;
    #pickColors: any[];
    private numIndices: number;
    #metallicRoughness: any;
    #modelNormalMatrixCol0: number[];
    #modelNormalMatrixCol1: number[];
    #modelNormalMatrixCol2: number[];

    constructor(cfg: VBOInstancingLayerCfg, renderers: any) {

        this.layerIndex = cfg.layerIndex;
        this.sceneModel = cfg.sceneModel;
        this.geometry = cfg.geometry;
        this.material = cfg.material;
        this.sortId = "PointsInstancingLayer";

        this.aabb = math.boundaries.collapseAABB3();

        this.state = new RenderState({
            obb: math.boundaries.OBB3(),
            numInstances: 0,
            origin: cfg.origin ? math.vec3(cfg.origin) : null
        });

        this.#renderers = renderers;

        this.#numPortions = 0;
        this.#numVisibleLayerPortions = 0;
        this.#numTransparentLayerPortions = 0;
        this.#numXRayedLayerPortions = 0;
        this.#numHighlightedLayerPortions = 0;
        this.#numSelectedLayerPortions = 0;
        this.#numClippableLayerPortions = 0;
        this.#numEdgesLayerPortions = 0;
        this.#numPickableLayerPortions = 0;
        this.#numCulledLayerPortions = 0;

        /** @private */
        this.numIndices = cfg.geometry.numIndices;

        // Per-instance arrays
        this.#pickColors = [];
        this.#offsets = [];

        this.#modelMatrixCol0 = [];
        this.#modelMatrixCol1 = [];
        this.#modelMatrixCol2 = [];
        this.#portions = [];
        this.#finalized = false;
        this.aabb = math.boundaries.collapseAABB3();
        this.solid = !!cfg.solid;
    }

    createPortion(cfg: {
        color: math.FloatArrayType;
        opacity: number;
        meshMatrix: any;
        worldMatrix: any;
        aabb: any;
        pickColor: any;
    }) {

        if (this.#finalized) {
            throw "Already finalized";
        }

        const meshMatrix = cfg.meshMatrix;
        const worldMatrix = cfg.worldMatrix;
        const worldAABB = cfg.aabb;

        if (cfg.color) {
            const color = cfg.color;
            const opacity = cfg.opacity;
            const r = color[0]; // Color is pre-quantized by VBOSceneModel
            const g = color[1];
            const b = color[2];
            const a = color[3];
            this.#colors.push(r);
            this.#colors.push(g);
            this.#colors.push(b);
            this.#colors.push(opacity);
        }

        this.#modelMatrixCol0.push(meshMatrix[0]);
        this.#modelMatrixCol0.push(meshMatrix[4]);
        this.#modelMatrixCol0.push(meshMatrix[8]);
        this.#modelMatrixCol0.push(meshMatrix[12]);

        this.#modelMatrixCol1.push(meshMatrix[1]);
        this.#modelMatrixCol1.push(meshMatrix[5]);
        this.#modelMatrixCol1.push(meshMatrix[9]);
        this.#modelMatrixCol1.push(meshMatrix[13]);

        this.#modelMatrixCol2.push(meshMatrix[2]);
        this.#modelMatrixCol2.push(meshMatrix[6]);
        this.#modelMatrixCol2.push(meshMatrix[10]);
        this.#modelMatrixCol2.push(meshMatrix[14]);

        if (cfg.pickColor) {
            const pickColor = cfg.pickColor;
            this.#pickColors.push(pickColor[0]);
            this.#pickColors.push(pickColor[1]);
            this.#pickColors.push(pickColor[2]);
            this.#pickColors.push(pickColor[3]);
        }

        math.boundaries.collapseAABB3(worldAABB);
        const obb = this.state.obb;
        const lenPositions = obb.length;
        for (let i = 0; i < lenPositions; i += 4) {
            tempVec4a[0] = obb[i + 0];
            tempVec4a[1] = obb[i + 1];
            tempVec4a[2] = obb[i + 2];
            math.transformPoint4(meshMatrix, tempVec4a, tempVec4b);
            if (worldMatrix) {
                math.transformPoint4(worldMatrix, tempVec4b, tempVec4c);
                math.boundaries.expandAABB3Point3(worldAABB, tempVec4c);
            } else {
                math.boundaries.expandAABB3Point3(worldAABB, tempVec4b);
            }
        }

        if (this.state.origin) {
            const origin = this.state.origin;
            worldAABB[0] += origin[0];
            worldAABB[1] += origin[1];
            worldAABB[2] += origin[2];
            worldAABB[3] += origin[0];
            worldAABB[4] += origin[1];
            worldAABB[5] += origin[2];
        }

        math.boundaries.expandAABB3(this.aabb, worldAABB);

        this.state.numInstances++;

        const portionId = this.#portions.length;

        this.#portions.push({});
        this.#numPortions++;
        this.sceneModel.numPortions++;

        return portionId;
    }

    finalize() {
        if (this.#finalized) {
            throw "Already finalized";
        }
        const state = this.state;
        const geometry = state.geometry;
        const textureSet = state.textureSet;
        // @ts-ignore
        const gl = this.sceneModel.viewer.renderer.gl;
        if (this.#pickColors.length > 0) {
            const flagsLength = this.#pickColors.length;
            this.state.flagsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, new Uint8Array(flagsLength), flagsLength, 4, gl.DYNAMIC_DRAW, false);
            this.state.flags2Buf = new ArrayBuf(gl, gl.ARRAY_BUFFER, new Uint8Array(flagsLength), flagsLength, 4, gl.DYNAMIC_DRAW, true);
        }
        if (this.#modelMatrixCol0.length > 0) {
            this.state.modelMatrixCol0Buf = new ArrayBuf(gl, gl.ARRAY_BUFFER, new Float32Array(this.#modelMatrixCol0), this.#modelMatrixCol0.length, 4, gl.STATIC_DRAW, false);
            this.state.modelMatrixCol1Buf = new ArrayBuf(gl, gl.ARRAY_BUFFER, new Float32Array(this.#modelMatrixCol1), this.#modelMatrixCol1.length, 4, gl.STATIC_DRAW, false);
            this.state.modelMatrixCol2Buf = new ArrayBuf(gl, gl.ARRAY_BUFFER, new Float32Array(this.#modelMatrixCol2), this.#modelMatrixCol2.length, 4, gl.STATIC_DRAW, false);
            this.#modelMatrixCol0 = [];
            this.#modelMatrixCol1 = [];
            this.#modelMatrixCol2 = [];
            if (this.state.geometry.normalsBuf) {
                this.state.modelNormalMatrixCol0Buf = new ArrayBuf(gl, gl.ARRAY_BUFFER, new Float32Array(this.#modelNormalMatrixCol0), this.#modelNormalMatrixCol0.length, 4, gl.STATIC_DRAW, false);
                this.state.modelNormalMatrixCol1Buf = new ArrayBuf(gl, gl.ARRAY_BUFFER, new Float32Array(this.#modelNormalMatrixCol1), this.#modelNormalMatrixCol1.length, 4, gl.STATIC_DRAW, false);
                this.state.modelNormalMatrixCol2Buf = new ArrayBuf(gl, gl.ARRAY_BUFFER, new Float32Array(this.#modelNormalMatrixCol2), this.#modelNormalMatrixCol2.length, 4, gl.STATIC_DRAW, false);
                this.#modelNormalMatrixCol0 = [];
                this.#modelNormalMatrixCol1 = [];
                this.#modelNormalMatrixCol2 = [];
            }
        }
        if (this.#pickColors.length > 0) {
            this.state.pickColorsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, new Uint8Array(this.#pickColors), this.#pickColors.length, 4, gl.STATIC_DRAW, false);
            this.#pickColors = []; // Release memory
        }
        if (this.#colors.length > 0) {
            let notNormalized = false;
            this.state.colorsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, new Uint8Array(this.#colors), this.#colors.length, 4, gl.DYNAMIC_DRAW, notNormalized);
            this.#colors = []; // Release memory
        }
        if (this.#metallicRoughness.length > 0) {
            const metallicRoughness = new Uint8Array(this.#metallicRoughness);
            let normalized = false;
            this.state.metallicRoughnessBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, metallicRoughness, this.#metallicRoughness.length, 2, gl.STATIC_DRAW, normalized);
        }
        this.state.pbrSupported
            = !!state.metallicRoughnessBuf
            && !!geometry.uvBuf
            && !!geometry.normalsBuf
            && !!textureSet
            && !!textureSet.colorTexture
            && !!textureSet.metallicRoughnessTexture;
        this.state.colorTextureSupported
            = !!geometry.uvBuf
            && !!textureSet
            && !!textureSet.colorTexture;
        this.#finalized = true;
    }

    // The following setters are called by VBOSceneModelMesh, in turn called by VBOSceneModelNode, only after the layer is finalized.
    // It's important that these are called after finalize() in order to maintain integrity of counts like #numVisibleLayerPortions etc.

    initFlags(portionId: number, flags: number, meshTransparent: boolean) {
        if (flags & ENTITY_FLAGS.VISIBLE) {
            this.#numVisibleLayerPortions++;
            this.sceneModel.numVisibleLayerPortions++;
        }
        if (flags & ENTITY_FLAGS.HIGHLIGHTED) {
            this.#numHighlightedLayerPortions++;
            this.sceneModel.numHighlightedLayerPortions++;
        }
        if (flags & ENTITY_FLAGS.XRAYED) {
            this.#numXRayedLayerPortions++;
            this.sceneModel.numXRayedLayerPortions++;
        }
        if (flags & ENTITY_FLAGS.SELECTED) {
            this.#numSelectedLayerPortions++;
            this.sceneModel.numSelectedLayerPortions++;
        }
        if (flags & ENTITY_FLAGS.CLIPPABLE) {
            this.#numClippableLayerPortions++;
            this.sceneModel.numClippableLayerPortions++;
        }
        if (flags & ENTITY_FLAGS.EDGES) {
            this.#numEdgesLayerPortions++;
            this.sceneModel.numEdgesLayerPortions++;
        }
        if (flags & ENTITY_FLAGS.PICKABLE) {
            this.#numPickableLayerPortions++;
            this.sceneModel.numPickableLayerPortions++;
        }
        if (flags & ENTITY_FLAGS.CULLED) {
            this.#numCulledLayerPortions++;
            this.sceneModel.numCulledLayerPortions++;
        }
        if (meshTransparent) {
            this.#numTransparentLayerPortions++;
            this.sceneModel.numTransparentLayerPortions++;
        }
        this.#setFlags(portionId, flags, meshTransparent);
        this.#setFlags2(portionId, flags);
    }

    setVisible(portionId: number, flags: number, meshTransparent: boolean) {
        this.#assertFinalized();
        if (flags & ENTITY_FLAGS.VISIBLE) {
            this.#numVisibleLayerPortions++;
            this.sceneModel.numVisibleLayerPortions++;
        } else {
            this.#numVisibleLayerPortions--;
            this.sceneModel.numVisibleLayerPortions--;
        }
        this.#setFlags(portionId, flags, meshTransparent);
    }

    setHighlighted(portionId: number, flags: number, meshTransparent: boolean) {
        this.#assertFinalized();
        if (flags & ENTITY_FLAGS.HIGHLIGHTED) {
            this.#numHighlightedLayerPortions++;
            this.sceneModel.numHighlightedLayerPortions++;
        } else {
            this.#numHighlightedLayerPortions--;
            this.sceneModel.numHighlightedLayerPortions--;
        }
        this.#setFlags(portionId, flags, meshTransparent);
    }

    setXRayed(portionId: number, flags: number, meshTransparent: boolean) {
        this.#assertFinalized();
        if (flags & ENTITY_FLAGS.XRAYED) {
            this.#numXRayedLayerPortions++;
            this.sceneModel.numXRayedLayerPortions++;
        } else {
            this.#numXRayedLayerPortions--;
            this.sceneModel.numXRayedLayerPortions--;
        }
        this.#setFlags(portionId, flags, meshTransparent);
    }

    setSelected(portionId: number, flags: number, meshTransparent: boolean) {
        this.#assertFinalized();
        if (flags & ENTITY_FLAGS.SELECTED) {
            this.#numSelectedLayerPortions++;
            this.sceneModel.numSelectedLayerPortions++;
        } else {
            this.#numSelectedLayerPortions--;
            this.sceneModel.numSelectedLayerPortions--;
        }
        this.#setFlags(portionId, flags, meshTransparent);
    }

    setEdges(portionId: number, flags: number, meshTransparent: boolean) {
        this.#assertFinalized();
        if (flags & ENTITY_FLAGS.EDGES) {
            this.#numEdgesLayerPortions++;
            this.sceneModel.numEdgesLayerPortions++;
        } else {
            this.#numEdgesLayerPortions--;
            this.sceneModel.numEdgesLayerPortions--;
        }
        this.#setFlags(portionId, flags, meshTransparent);
    }

    #assertFinalized() {
        if (!this.#finalized) {
            throw "Not finalized";
        }
    }

    setClippable(portionId: number, flags: number) {
        this.#assertFinalized();
        if (flags & ENTITY_FLAGS.CLIPPABLE) {
            this.#numClippableLayerPortions++;
            this.sceneModel.numClippableLayerPortions++;
        } else {
            this.#numClippableLayerPortions--;
            this.sceneModel.numClippableLayerPortions--;
        }
        this.#setFlags2(portionId, flags);
    }

    setCollidable(portionId: number, flags: number) {
        this.#assertFinalized();
    }

    setPickable(portionId: number, flags: number) {
        this.#assertFinalized();
        if (flags & ENTITY_FLAGS.PICKABLE) {
            this.#numPickableLayerPortions++;
            this.sceneModel.numPickableLayerPortions++;
        } else {
            this.#numPickableLayerPortions--;
            this.sceneModel.numPickableLayerPortions--;
        }
        this.#setFlags2(portionId, flags);
    }

    setCulled(portionId: number, flags: number, meshTransparent: boolean) {
        this.#assertFinalized();
        if (flags & ENTITY_FLAGS.CULLED) {
            this.#numCulledLayerPortions++;
            this.sceneModel.numCulledLayerPortions++;
        } else {
            this.#numCulledLayerPortions--;
            this.sceneModel.numCulledLayerPortions--;
        }
        this.#setFlags(portionId, flags, meshTransparent);
    }

    setColor(portionId: number, color: math.FloatArrayType) { // RGBA color is normalized as ints
        this.#assertFinalized();
        tempUint8Vec4[0] = color[0];
        tempUint8Vec4[1] = color[1];
        tempUint8Vec4[2] = color[2];
        this.state.colorsBuf.setData(tempUint8Vec4, portionId * 3, 3);
    }

    setTransparent(portionId: number, flags: number, transparent: boolean) {
        if (transparent) {
            this.#numTransparentLayerPortions++;
            this.sceneModel.numTransparentLayerPortions++;
        } else {
            this.#numTransparentLayerPortions--;
            this.sceneModel.numTransparentLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    #setFlags(portionId: number, flags: number, meshTransparent: boolean) {
        this.#assertFinalized();
        const visible = !!(flags & ENTITY_FLAGS.VISIBLE);
        const xrayed = !!(flags & ENTITY_FLAGS.XRAYED);
        const highlighted = !!(flags & ENTITY_FLAGS.HIGHLIGHTED);
        const selected = !!(flags & ENTITY_FLAGS.SELECTED);
        const edges = !!(flags & ENTITY_FLAGS.EDGES);
        const pickable = !!(flags & ENTITY_FLAGS.PICKABLE);
        const culled = !!(flags & ENTITY_FLAGS.CULLED);
        // Normal fill
        let f0;
        if (!visible || culled || xrayed || highlighted || selected) {
            f0 = RENDER_PASSES.NOT_RENDERED;
        } else {
            if (meshTransparent) {
                f0 = RENDER_PASSES.COLOR_TRANSPARENT;
            } else {
                f0 = RENDER_PASSES.COLOR_OPAQUE;
            }
        }
        // Emphasis fill
        let f1;
        if (!visible || culled) {
            f1 = RENDER_PASSES.NOT_RENDERED;
        } else if (selected) {
            f1 = RENDER_PASSES.SILHOUETTE_SELECTED;
        } else if (highlighted) {
            f1 = RENDER_PASSES.SILHOUETTE_HIGHLIGHTED;
        } else if (xrayed) {
            f1 = RENDER_PASSES.SILHOUETTE_XRAYED;
        } else {
            f1 = RENDER_PASSES.NOT_RENDERED;
        }
        // Edges
        let f2 = 0;
        if (!visible || culled) {
            f2 = RENDER_PASSES.NOT_RENDERED;
        } else if (selected) {
            f2 = RENDER_PASSES.EDGES_SELECTED;
        } else if (highlighted) {
            f2 = RENDER_PASSES.EDGES_HIGHLIGHTED;
        } else if (xrayed) {
            f2 = RENDER_PASSES.EDGES_XRAYED;
        } else if (edges) {
            if (meshTransparent) {
                f2 = RENDER_PASSES.EDGES_COLOR_TRANSPARENT;
            } else {
                f2 = RENDER_PASSES.EDGES_COLOR_OPAQUE;
            }
        } else {
            f2 = RENDER_PASSES.NOT_RENDERED;
        }
        // Pick
        let f3 = (visible && !culled && pickable) ? RENDER_PASSES.PICK : RENDER_PASSES.NOT_RENDERED;
        tempUint8Vec4[0] = f0; // x - normal fill
        tempUint8Vec4[1] = f1; // y - emphasis fill
        tempUint8Vec4[2] = f2; // z - edges
        tempUint8Vec4[3] = f3; // w - pick
        this.state.flagsBuf.setData(tempUint8Vec4, portionId * 4, 4);
    }

    #setFlags2(portionId: number, flags: number) {
        this.#assertFinalized();
        const clippable = !!(flags & ENTITY_FLAGS.CLIPPABLE) ? 255 : 0;
        tempUint8Vec4[0] = clippable;
        this.state.flags2Buf.setData(tempUint8Vec4, portionId * 4, 4);
    }

    setOffset(portionId: number, offset: math.FloatArrayType) {
        this.#assertFinalized();
        // if (!this.sceneModel.scene.entityOffsetsEnabled) {
        //     this.sceneModel.error("Entity#offset not enabled for this Viewer"); // See Viewer entityOffsetsEnabled
        //     return;
        // }
        tempVec3fa[0] = offset[0];
        tempVec3fa[1] = offset[1];
        tempVec3fa[2] = offset[2];
        this.state.offsetsBuf.setData(tempVec3fa, portionId * 3, 3);
    }

    // ---------------------- NORMAL RENDERING -----------------------------------

    drawColorOpaque(renderFlags: RenderFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numTransparentLayerPortions === this.#numPortions || this.#numXRayedLayerPortions === this.#numPortions) {
            return;
        }
        this.#updateBackfaceCull(renderFlags, frameContext);
        const geometry = this.state.geometry;
        if (frameContext.withSAO && this.sceneModel.saoEnabled && this.state.saoSupported) {
            if (frameContext.pbrEnabled && this.sceneModel.pbrEnabled && this.state.pbrSupported) {
                if (this.#renderers.pbrRendererWithSAO) {
                    this.#renderers.pbrRendererWithSAO.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
                }
            } else if (frameContext.colorTextureEnabled && this.sceneModel.colorTextureEnabled && this.state.colorTextureSupported) {
                if (this.#renderers.colorTextureRendererWithSAO) {
                    this.#renderers.colorTextureRendererWithSAO.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
                }
            } else if (geometry.normalsBuf) {
                if (this.#renderers.colorRendererWithSAO) {
                    this.#renderers.colorRendererWithSAO.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
                }
            } else {
                if (this.#renderers.flatColorRendererWithSAO) {
                    this.#renderers.flatColorRendererWithSAO.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
                }
            }
        } else if (frameContext.pbrEnabled && this.sceneModel.pbrEnabled && this.state.pbrSupported) {
            if (this.#renderers.pbrRenderer) {
                this.#renderers.pbrRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
            }
        } else if (frameContext.colorTextureEnabled && this.sceneModel.colorTextureEnabled && this.state.colorTextureSupported) {
            if (this.#renderers.colorTextureRenderer) {
                this.#renderers.colorTextureRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
            }
        } else if (geometry.normalsBuf) {
            if (this.#renderers.colorRenderer) {
                this.#renderers.colorRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
            }
        } else {
            if (this.#renderers.flatColorRenderer) {
                this.#renderers.flatColorRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
            }
        }
    }

    #updateBackfaceCull(renderFlags: RenderFlags, frameContext: FrameContext): void {
        const backfaces = this.sceneModel.backfaces || (!this.solid) || renderFlags.sectioned;
        if (frameContext.backfaces !== backfaces) {
            const gl = frameContext.gl;
            if (backfaces) {
                gl.disable(gl.CULL_FACE);
            } else {
                gl.enable(gl.CULL_FACE);
            }
            frameContext.backfaces = backfaces;
        }
    }

    drawColorTransparent(renderFlags: RenderFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numTransparentLayerPortions === 0 || this.#numXRayedLayerPortions === this.#numPortions) {
            return;
        }
        this.#updateBackfaceCull(renderFlags, frameContext);
        if (frameContext.pbrEnabled && this.sceneModel.pbrEnabled && this.state.pbrSupported) {
            if (this.#renderers.pbrRenderer) {
                this.#renderers.pbrRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_TRANSPARENT);
            }
        } else if (frameContext.colorTextureEnabled && this.sceneModel.colorTextureEnabled && this.state.colorTextureSupported) {
            if (this.#renderers.colorTextureRenderer) {
                this.#renderers.colorTextureRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_TRANSPARENT);
            }
        } else if (this.state.normalsBuf) {
            if (this.#renderers.colorRenderer) {
                this.#renderers.colorRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_TRANSPARENT);
            }
        } else {
            if (this.#renderers.flatColorRenderer) {
                this.#renderers.flatColorRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_TRANSPARENT);
            }
        }
    }

    // -- RENDERING SAO POST EFFECT TARGETS ----------------------------------------------------------------------------

    drawDepth(renderFlags: RenderFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numTransparentLayerPortions === this.#numPortions || this.#numXRayedLayerPortions === this.#numPortions) {
            return;
        }
        this.#updateBackfaceCull(renderFlags, frameContext);
        if (this.#renderers.depthRenderer) {
            this.#renderers.depthRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE); // Assume whatever post-effect uses depth (eg SAO) does not apply to transparent objects
        }
    }

    drawNormals(renderFlags: RenderFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numTransparentLayerPortions === this.#numPortions || this.#numXRayedLayerPortions === this.#numPortions) {
            return;
        }
        this.#updateBackfaceCull(renderFlags, frameContext);
        if (this.#renderers.normalsRenderer) {
            this.#renderers.normalsRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE); // Assume whatever post-effect uses normals (eg SAO) does not apply to transparent objects
        }
    }

    // ---------------------- EMPHASIS RENDERING -----------------------------------

    drawSilhouetteXRayed(renderFlags: RenderFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numXRayedLayerPortions === 0) {
            return;
        }
        if (this.#renderers.silhouetteRenderer) {
            this.#renderers.silhouetteRenderer.drawLayer(frameContext, this, RENDER_PASSES.SILHOUETTE_XRAYED);
        }
    }

    drawSilhouetteHighlighted(renderFlags: RenderFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numHighlightedLayerPortions === 0) {
            return;
        }
        if (this.#renderers.silhouetteRenderer) {
            this.#renderers.silhouetteRenderer.drawLayer(frameContext, this, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED);
        }
    }

    drawSilhouetteSelected(renderFlags: RenderFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numSelectedLayerPortions === 0) {
            return;
        }
        if (this.#renderers.silhouetteRenderer) {
            this.#renderers.silhouetteRenderer.drawLayer(frameContext, this, RENDER_PASSES.SILHOUETTE_SELECTED);
        }
    }

    //-- EDGES RENDERING -----------------------------------------------------------------------------------------------

    drawEdgesColorOpaque(renderFlags: RenderFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numEdgesLayerPortions === 0) {
            return;
        }
        if (this.#renderers.edgesColorRenderer) {
            this.#renderers.edgesColorRenderer.drawLayer(frameContext, this, RENDER_PASSES.EDGES_COLOR_OPAQUE);
        }
    }

    drawEdgesColorTransparent(renderFlags: RenderFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numEdgesLayerPortions === 0) {
            return;
        }
        if (this.#renderers.edgesColorRenderer) {
            this.#renderers.edgesColorRenderer.drawLayer(frameContext, this, RENDER_PASSES.EDGES_COLOR_TRANSPARENT);
        }
    }

    drawEdgesHighlighted(renderFlags: RenderFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numHighlightedLayerPortions === 0) {
            return;
        }
        if (this.#renderers.edgesRenderer) {
            this.#renderers.edgesRenderer.drawLayer(frameContext, this, RENDER_PASSES.EDGES_HIGHLIGHTED);
        }
    }

    drawEdgesSelected(renderFlags: RenderFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numSelectedLayerPortions === 0) {
            return;
        }
        if (this.#renderers.edgesRenderer) {
            this.#renderers.edgesRenderer.drawLayer(frameContext, this, RENDER_PASSES.EDGES_SELECTED);
        }
    }

    drawEdgesXRayed(renderFlags: RenderFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numXRayedLayerPortions === 0) {
            return;
        }
        if (this.#renderers.edgesRenderer) {
            this.#renderers.edgesRenderer.drawLayer(frameContext, this, RENDER_PASSES.EDGES_XRAYED);
        }
    }

    // ---------------------- OCCLUSION CULL RENDERING -----------------------------------

    drawOcclusion(renderFlags: RenderFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        if (this.#renderers.occlusionRenderer) {
            // Only opaque, filled objects can be occluders
            this.#renderers.occlusionRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
        }
    }

    //---- PICKING ----------------------------------------------------------------------------------------------------

    drawPickMesh(renderFlags: RenderFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        if (this.#renderers.pickMeshRenderer) {
            this.#renderers.pickMeshRenderer.drawLayer(frameContext, this, RENDER_PASSES.PICK);
        }
    }

    drawPickDepths(renderFlags: RenderFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        if (this.#renderers.pickDepthRenderer) {
            this.#renderers.pickDepthRenderer.drawLayer(frameContext, this, RENDER_PASSES.PICK);
        }
    }

    drawPickNormals(renderFlags: RenderFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(renderFlags, frameContext);
        if (this.#renderers.pickNormalsRenderer) {
            this.#renderers.pickNormalsRenderer.drawLayer(frameContext, this, RENDER_PASSES.PICK);
        }
    }

    destroy() {
        const state = this.state;
        if (state.colorsBuf) {
            state.colorsBuf.destroy();
            state.colorsBuf = null;
        }
        if (state.metallicRoughnessBuf) {
            state.metallicRoughnessBuf.destroy();
            state.metallicRoughnessBuf = null;
        }
        if (state.flagsBuf) {
            state.flagsBuf.destroy();
            state.flagsBuf = null;
        }
        if (state.flags2Buf) {
            state.flags2Buf.destroy();
            state.flags2Buf = null;
        }
        if (state.offsetsBuf) {
            state.offsetsBuf.destroy();
            state.offsetsBuf = null;
        }
        if (state.modelMatrixCol0Buf) {
            state.modelMatrixCol0Buf.destroy();
            state.modelMatrixCol0Buf = null;
        }
        if (state.modelMatrixCol1Buf) {
            state.modelMatrixCol1Buf.destroy();
            state.modelMatrixCol1Buf = null;
        }
        if (state.modelMatrixCol2Buf) {
            state.modelMatrixCol2Buf.destroy();
            state.modelMatrixCol2Buf = null;
        }
        if (state.modelNormalMatrixCol0Buf) {
            state.modelNormalMatrixCol0Buf.destroy();
            state.modelNormalMatrixCol0Buf = null;
        }
        if (state.modelNormalMatrixCol1Buf) {
            state.modelNormalMatrixCol1Buf.destroy();
            state.modelNormalMatrixCol1Buf = null;
        }
        if (state.modelNormalMatrixCol2Buf) {
            state.modelNormalMatrixCol2Buf.destroy();
            state.modelNormalMatrixCol2Buf = null;
        }
        if (state.pickColorsBuf) {
            state.pickColorsBuf.destroy();
            state.pickColorsBuf = null;
        }
        state.destroy();
    }
}