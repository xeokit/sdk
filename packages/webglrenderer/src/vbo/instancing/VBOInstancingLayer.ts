import {VBOInstancingLayerParams} from "./VBOInstancingLayerParams";
import {WebGLRendererModel} from "../../WebGLRendererModel";
import {SceneGeometry, SceneMesh} from "@xeokit/scene";
import {WebGLArrayBuf} from "@xeokit/webglutils";
import {FloatArrayParam} from "@xeokit/math";
import {VBOInstancingRenderState} from "./VBOInstancingRenderState";
import {collapseAABB3, createOBB3, expandAABB3} from "@xeokit/boundaries";
import {MeshCounts} from "../../MeshCounts";
import {VBOInstancingBuffer} from "./VBOInstancingBuffer";
import {RenderContext} from "../../RenderContext";
import {Layer} from "../../Layer";
import {SDKError} from "@xeokit/core";
import {createMat4, createVec3, createVec4} from "@xeokit/matrix";
import {SCENE_OBJECT_FLAGS} from "../../SCENE_OBJECT_FLAGS";
import {RENDER_PASSES} from "../../RENDER_PASSES";
import {LayerMeshParams} from "../../LayerMeshParams";
import {VBORendererSet} from "../VBORendererSet";
import {SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "@xeokit/constants";

const tempUint8Vec4 = new Uint8Array(4);
const tempFloat32 = new Float32Array(1);
const tempVec4a = createVec4([0, 0, 0, 1]);
const tempVec3fa = new Float32Array(3);

const tempVec3a = createVec3();
const tempVec3b = createVec3();
const tempVec3c = createVec3();
const tempVec3d = createVec3();
const tempVec3e = createVec3();
const tempVec3f = createVec3();
const tempVec3g = createVec3();

const tempFloat32Vec4 = new Float32Array(4);

/**
 * @private
 */
export class VBOInstancingLayer implements Layer {

    rendererModel: WebGLRendererModel;
    renderState: VBOInstancingRenderState;
    #rendererSet: VBORendererSet;

    #aabb: FloatArrayParam;
    #buffer: VBOInstancingBuffer;
    #meshes: any[];
    #portions: any[];
    #built: boolean;

    layerIndex: number;
    sortId: string;
    primitive: number;
    aabbDirty: boolean;
    meshCounts: MeshCounts[];
    renderContext: RenderContext;
    saoSupported: boolean;

    constructor(layerParams: VBOInstancingLayerParams, rendererSet: VBORendererSet) {

        console.info("Creating VBOInstancingLayer");

        this.renderContext = layerParams.renderContext;
        this.rendererModel = layerParams.rendererModel;
        this.sortId = `VBOInstancingLayer-${layerParams.sceneGeometry.primitive}`;
        this.layerIndex = layerParams.layerIndex;

        this.#buffer = new VBOInstancingBuffer();

        this.#rendererSet = rendererSet;

        this.#aabb = collapseAABB3();

        this.meshCounts = [];
        for (let i = 0, len = this.renderContext.viewer.viewList.length; i < len; i++) {
            this.meshCounts.push(new MeshCounts());
        }

        const geometry = layerParams.sceneGeometry;
        const aabb = geometry.aabb;
        const positionsDecompressOffset = createVec3([aabb[0], aabb[1], aabb[2]]);
        const positionsDecompressScale = createVec3([(aabb[3] - aabb[0]) / 65535, (aabb[4] - aabb[1]) / 65535, (aabb[5] - aabb[2]) / 65535]);

        this.renderState = <VBOInstancingRenderState>{
            numVertices: 0,
            numIndices: 0,
            numEdgeIndices: 0,
            numInstances: 0,
            obb: createOBB3(),
            origin: createVec3(layerParams.origin),
            sceneGeometry: layerParams.sceneGeometry,
            textureSet: layerParams.textureSet,
            pbrSupported: false,
            positionsDecompressScale,
            positionsDecompressOffset,
            colorsBuf: [],
            flagsBufs: [],
            modelMatrixBuf: null,
            modelMatrixCol0Buf: null,
            modelMatrixCol1Buf: null,
            modelMatrixCol2Buf: null,
            modelNormalMatrixCol0Buf: null,
            modelNormalMatrixCol1Buf: null,
            modelNormalMatrixCol2Buf: null,
            pickColorsBuf: null
        };

        this.#portions = [];
        this.#meshes = [];

        this.#aabb = collapseAABB3();
        this.aabbDirty = true;

        this.#built = false;
    }

    get hash() {
        return `${this.primitive}`;
    }

    get aabb() {
        if (this.aabbDirty) {
            collapseAABB3(this.#aabb);
            for (let i = 0, len = this.#meshes.length; i < len; i++) {
                expandAABB3(this.#aabb, this.#meshes[i].aabb);
            }
            this.aabbDirty = false;
        }
        return this.#aabb;
    }

    canCreateLayerMesh(sceneGeometry: SceneGeometry): boolean {
        if (this.#built) {
            throw new SDKError("Already built");
        }
        return true; // TODO
    }

    createLayerMesh(layerMeshParams: LayerMeshParams, sceneMesh: SceneMesh) {

        const color = sceneMesh.color;
        const opacity = sceneMesh.opacity !== null && sceneMesh.opacity !== undefined ? sceneMesh.opacity : 255;
        const rtcMatrix = sceneMesh.rtcMatrix;
        const pickColor = layerMeshParams.pickColor;

        if (this.#built) {
            throw "Already finalized";
        }

        const r = color[0] * 255;
        const g = color[1] * 255;
        const b = color[2] * 255;

        this.#buffer.colors.push(r);
        this.#buffer.colors.push(g);
        this.#buffer.colors.push(b);
        this.#buffer.colors.push(opacity);

        this.#buffer.modelMatrixCol0.push(rtcMatrix[0]);
        this.#buffer.modelMatrixCol0.push(rtcMatrix[4]);
        this.#buffer.modelMatrixCol0.push(rtcMatrix[8]);
        this.#buffer.modelMatrixCol0.push(rtcMatrix[12]);

        this.#buffer.modelMatrixCol1.push(rtcMatrix[1]);
        this.#buffer.modelMatrixCol1.push(rtcMatrix[5]);
        this.#buffer.modelMatrixCol1.push(rtcMatrix[9]);
        this.#buffer.modelMatrixCol1.push(rtcMatrix[13]);

        this.#buffer.modelMatrixCol2.push(rtcMatrix[2]);
        this.#buffer.modelMatrixCol2.push(rtcMatrix[6]);
        this.#buffer.modelMatrixCol2.push(rtcMatrix[10]);
        this.#buffer.modelMatrixCol2.push(rtcMatrix[14]);

        // Per-vertex pick colors

        this.#buffer.pickColors.push(...pickColor);

        this.renderState.numInstances++;

        const layerMeshIndex = this.#portions.length;

        const portion = {};
        this.#portions.push(portion);

        for (let viewIndex = 0, len = this.meshCounts.length; viewIndex < len; viewIndex++) {
            this.meshCounts[viewIndex].numMeshes++;
            this.rendererModel.meshCounts[viewIndex].numMeshes++;
        }

        this.#meshes.push(sceneMesh);
        return layerMeshIndex;
    }

    build() {
        if (this.#built) {
            return;
        }
        const renderState = this.renderState;
        const sceneGeometry = renderState.sceneGeometry;
        const numViews = this.meshCounts.length;
        const textureSet = renderState.textureSet;
        const gl = this.renderContext.gl;
        const colorsLength = this.#buffer.colors.length;
        const flagsLength = colorsLength / 4;
        if (colorsLength > 0) {
            let notNormalized = false;
            const colors = new Uint8Array(this.#buffer.colors);
            for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
                renderState.colorsBuf[viewIndex] = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, colors, this.#buffer.colors.length, 4, gl.DYNAMIC_DRAW, notNormalized);
            }
            this.#buffer.colors = []; // Release memory
        }
        if (flagsLength > 0) {
            // Because we only build flags arrays here,
            // get their length from the colors array
            let notNormalized = false;
            const flagsArray = new Float32Array(flagsLength);
            for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
                renderState.flagsBufs[viewIndex] = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, flagsArray, flagsLength, 1, gl.DYNAMIC_DRAW, notNormalized);
            }
        }
        const positionsCompressed = sceneGeometry.positionsCompressed;
        const indices = sceneGeometry.indices;
        const edgeIndices = sceneGeometry.edgeIndices;
        const uvsCompressed = sceneGeometry.uvsCompressed;
        const colorsCompressed = sceneGeometry.colorsCompressed;
        if (positionsCompressed && positionsCompressed.length > 0) {
            const normalized = false;
            renderState.positionsBuf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, new Uint16Array(positionsCompressed), positionsCompressed.length, 3, gl.STATIC_DRAW, normalized);
        }
        if (indices && indices.length > 0) {
            renderState.indicesBuf = new WebGLArrayBuf(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), indices.length, 1, gl.STATIC_DRAW);
            renderState.numIndices = indices.length;
        }
        if (edgeIndices && edgeIndices.length > 0) {
            renderState.edgeIndicesBuf = new WebGLArrayBuf(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(edgeIndices), edgeIndices.length, 1, gl.STATIC_DRAW);
            renderState.numEdgeIndices = edgeIndices.length;
        }
        // if (colorsCompressed && colorsCompressed.length > 0) {
        //     const notNormalized = false;
        //     renderState.colorsBuf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, new Uint8Array(colorsCompressed), colorsCompressed.length, 4, gl.STATIC_DRAW, notNormalized);
        // }
        if (uvsCompressed && uvsCompressed.length > 0) {
            renderState.uvDecodeMatrix = sceneGeometry.uvsDecompressMatrix;
            renderState.uvBuf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, new Uint8Array(uvsCompressed), uvsCompressed.length, 2, gl.STATIC_DRAW, false);
        }
        if (this.#buffer.modelMatrixCol0.length > 0) {
            const normalized = false;
            renderState.modelMatrixCol0Buf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, new Float32Array(this.#buffer.modelMatrixCol0), this.#buffer.modelMatrixCol0.length, 4, gl.STATIC_DRAW, normalized);
            renderState.modelMatrixCol1Buf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, new Float32Array(this.#buffer.modelMatrixCol1), this.#buffer.modelMatrixCol1.length, 4, gl.STATIC_DRAW, normalized);
            renderState.modelMatrixCol2Buf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, new Float32Array(this.#buffer.modelMatrixCol2), this.#buffer.modelMatrixCol2.length, 4, gl.STATIC_DRAW, normalized);
            this.#buffer.modelMatrixCol0 = [];
            this.#buffer.modelMatrixCol1 = [];
            this.#buffer.modelMatrixCol2 = [];
            if (renderState.normalsBuf) {
                renderState.modelNormalMatrixCol0Buf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, new Float32Array(this.#buffer.modelNormalMatrixCol0), this.#buffer.modelNormalMatrixCol0.length, 4, gl.STATIC_DRAW, normalized);
                renderState.modelNormalMatrixCol1Buf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, new Float32Array(this.#buffer.modelNormalMatrixCol1), this.#buffer.modelNormalMatrixCol1.length, 4, gl.STATIC_DRAW, normalized);
                renderState.modelNormalMatrixCol2Buf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, new Float32Array(this.#buffer.modelNormalMatrixCol2), this.#buffer.modelNormalMatrixCol2.length, 4, gl.STATIC_DRAW, normalized);
                this.#buffer.modelNormalMatrixCol0 = [];
                this.#buffer.modelNormalMatrixCol1 = [];
                this.#buffer.modelNormalMatrixCol2 = [];
            }
        }
        if (this.#buffer.pickColors.length > 0) {
            const normalized = false;
            renderState.pickColorsBuf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, new Uint8Array(this.#buffer.pickColors), this.#buffer.pickColors.length, 4, gl.STATIC_DRAW, normalized);
            this.#buffer.pickColors = []; // Release memory
        }

        renderState.pbrSupported
            = !!renderState.metallicRoughnessBuf
            && !!renderState.uvBuf
            && !!renderState.normalsBuf
            && !!textureSet
            && !!textureSet.colorTexture
            && !!textureSet.metallicRoughnessTexture;

        renderState.colorTextureSupported
            = !!renderState.uvBuf
            && !!textureSet
            && !!textureSet.colorTexture;

        this.saoSupported
            = (sceneGeometry.primitive === SolidPrimitive
            || sceneGeometry.primitive === SurfacePrimitive
            || sceneGeometry.primitive === TrianglesPrimitive);

        this.renderState.sceneGeometry = null;
        this.#built = true;
    }

    initFlags(viewIndex: number, layerMeshIndex, flags, meshTransparent) {
        const layerMeshCounts = this.meshCounts[viewIndex];
        const modelMeshCounts = this.rendererModel.meshCounts[viewIndex];
        if (flags & SCENE_OBJECT_FLAGS.VISIBLE) {
            layerMeshCounts.numVisible++;
            modelMeshCounts.numVisible++;
        }
        if (flags & SCENE_OBJECT_FLAGS.HIGHLIGHTED) {
            layerMeshCounts.numHighlighted++;
            modelMeshCounts.numHighlighted++;
        }
        if (flags & SCENE_OBJECT_FLAGS.XRAYED) {
            layerMeshCounts.numXRayed++;
            modelMeshCounts.numXRayed++;
        }
        if (flags & SCENE_OBJECT_FLAGS.SELECTED) {
            layerMeshCounts.numSelected++;
            modelMeshCounts.numSelected++;
        }
        if (flags & SCENE_OBJECT_FLAGS.CLIPPABLE) {
            layerMeshCounts.numClippable++;
            modelMeshCounts.numClippable++;
        }
        if (flags & SCENE_OBJECT_FLAGS.PICKABLE) {
            layerMeshCounts.numPickable++;
            modelMeshCounts.numPickable++;
        }
        if (flags & SCENE_OBJECT_FLAGS.CULLED) {
            layerMeshCounts.numCulled++;
            modelMeshCounts.numCulled++;
        }
        if (meshTransparent) {
            layerMeshCounts.numTransparent++;
            modelMeshCounts.numTransparent++;
        }
        this.setLayerMeshFlags(viewIndex, layerMeshIndex, flags, meshTransparent);
    }

    setLayerMeshVisible(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw "Not finalized";
        }
        if (flags & SCENE_OBJECT_FLAGS.VISIBLE) {
            this.meshCounts[viewIndex].numVisible++;
            this.rendererModel.meshCounts[viewIndex].numVisible++;
        } else {
            this.meshCounts[viewIndex].numVisible--;
            this.rendererModel.meshCounts[viewIndex].numVisible--;
        }
        this.setLayerMeshFlags(viewIndex, layerMeshIndex, flags, transparent);
    }

    setLayerMeshHighlighted(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw "Not finalized";
        }
        if (flags & SCENE_OBJECT_FLAGS.HIGHLIGHTED) {
            this.meshCounts[viewIndex].numHighlighted++;
            this.rendererModel.meshCounts[viewIndex].numHighlighted++;
        } else {
            this.meshCounts[viewIndex].numHighlighted--;
            this.rendererModel.meshCounts[viewIndex].numHighlighted--;
        }
        this.setLayerMeshFlags(viewIndex, layerMeshIndex, flags, transparent);
    }

    setLayerMeshXRayed(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw "Not finalized";
        }
        if (flags & SCENE_OBJECT_FLAGS.XRAYED) {
            this.meshCounts[viewIndex].numXRayed++;
            this.rendererModel.meshCounts[viewIndex].numXRayed++;
        } else {
            this.meshCounts[viewIndex].numXRayed--;
            this.rendererModel.meshCounts[viewIndex].numXRayed--;
        }
        this.setLayerMeshFlags(viewIndex, layerMeshIndex, flags, transparent);
    }

    setLayerMeshSelected(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw "Not finalized";
        }
        if (flags & SCENE_OBJECT_FLAGS.SELECTED) {
            this.meshCounts[viewIndex].numSelected++;
            this.rendererModel.meshCounts[viewIndex].numSelected++;
        } else {
            this.meshCounts[viewIndex].numSelected--;
            this.rendererModel.meshCounts[viewIndex].numSelected--;
        }
        this.setLayerMeshFlags(viewIndex, layerMeshIndex, flags, transparent);
    }

    setLayerMeshClippable(viewIndex: number, layerMeshIndex: number, flags: number): void {
        if (!this.#built) {
            throw "Not finalized";
        }
        if (flags & SCENE_OBJECT_FLAGS.CLIPPABLE) {
            this.meshCounts[viewIndex].numClippable++;
            this.rendererModel.meshCounts[viewIndex].numClippable++;
        } else {
            this.meshCounts[viewIndex].numClippable--;
            this.rendererModel.meshCounts[viewIndex].numClippable--;
        }
        this.setLayerMeshFlags(viewIndex, layerMeshIndex, flags);
    }

    setCollidable(viewIndex: number, layerMeshIndex: number, flags: number) {
        if (!this.#built) {
            throw "Not finalized";
        }
    }

    setLayerMeshPickable(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw "Not finalized";
        }
        if (flags & SCENE_OBJECT_FLAGS.PICKABLE) {
            this.meshCounts[viewIndex].numPickable++;
            this.rendererModel.meshCounts[viewIndex].numPickable++;
        } else {
            this.meshCounts[viewIndex].numPickable--;
            this.rendererModel.meshCounts[viewIndex].numPickable--;
        }
        this.setLayerMeshFlags(viewIndex, layerMeshIndex, flags, transparent);
    }

    setLayerMeshCulled(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw "Not finalized";
        }
        if (flags & SCENE_OBJECT_FLAGS.CULLED) {
            this.meshCounts[viewIndex].numCulled++;
            this.rendererModel.meshCounts[viewIndex].numCulled++;
        } else {
            this.meshCounts[viewIndex].numCulled--;
            this.rendererModel.meshCounts[viewIndex].numCulled--;
        }
        this.setLayerMeshFlags(viewIndex, layerMeshIndex, flags, transparent);
    }

    setLayerMeshColor(viewIndex: number, layerMeshIndex: number, color: FloatArrayParam): void {
        if (!this.#built) {
            throw "Not finalized";
        }
        tempUint8Vec4[0] = color[0];
        tempUint8Vec4[1] = color[1];
        tempUint8Vec4[2] = color[2];
        tempUint8Vec4[3] = color[3];
        if (this.renderState.colorsBuf[viewIndex]) {
            this.renderState.colorsBuf[viewIndex].setData(tempUint8Vec4, layerMeshIndex * 4);
        }
    }

    setLayerMeshTransparent(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (transparent) {
            this.meshCounts[viewIndex].numTransparent++;
            this.rendererModel.meshCounts[viewIndex].numTransparent++;
        } else {
            this.meshCounts[viewIndex].numTransparent--;
            this.rendererModel.meshCounts[viewIndex].numTransparent--;
        }
        this.setLayerMeshFlags(viewIndex, layerMeshIndex, flags, transparent);
    }

    setLayerMeshFlags(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean = false): void {
        if (!this.#built) {
            throw "Not finalized";
        }
        const view = this.renderContext.viewer.viewList[viewIndex];
        const visible = !!(flags & SCENE_OBJECT_FLAGS.VISIBLE);
        const xrayed = !!(flags & SCENE_OBJECT_FLAGS.XRAYED);
        const highlighted = !!(flags & SCENE_OBJECT_FLAGS.HIGHLIGHTED);
        const selected = !!(flags & SCENE_OBJECT_FLAGS.SELECTED);
        const pickable = !!(flags & SCENE_OBJECT_FLAGS.PICKABLE);
        const culled = !!(flags & SCENE_OBJECT_FLAGS.CULLED);
        let colorFlag;
        if (!visible || culled || xrayed
            || (highlighted && !view.highlightMaterial.glowThrough)
            || (selected && !view.selectedMaterial.glowThrough)) {
            colorFlag = RENDER_PASSES.NOT_RENDERED;
        } else {
            if (transparent) {
                colorFlag = RENDER_PASSES.DRAW_TRANSPARENT;
            } else {
                colorFlag = RENDER_PASSES.DRAW_OPAQUE;
            }
        }
        let silhouetteFlag;
        if (!visible || culled) {
            silhouetteFlag = RENDER_PASSES.NOT_RENDERED;
        } else if (selected) {
            silhouetteFlag = RENDER_PASSES.SILHOUETTE_SELECTED;
        } else if (highlighted) {
            silhouetteFlag = RENDER_PASSES.SILHOUETTE_HIGHLIGHTED;
        } else if (xrayed) {
            silhouetteFlag = RENDER_PASSES.SILHOUETTE_XRAYED;
        } else {
            silhouetteFlag = RENDER_PASSES.NOT_RENDERED;
        }
        const pickFlag = (visible && !culled && pickable) ? RENDER_PASSES.PICK : RENDER_PASSES.NOT_RENDERED;
        const clippableFlag = !!(flags & SCENE_OBJECT_FLAGS.CLIPPABLE) ? 1 : 0;
        let vertFlag = 0;
        vertFlag |= colorFlag;
        vertFlag |= silhouetteFlag << 4;
        vertFlag |= pickFlag << 8;
        vertFlag |= clippableFlag << 12;
        tempFloat32[0] = vertFlag;
        if (this.renderState.flagsBufs[viewIndex]) {
            this.renderState.flagsBufs[viewIndex].setData(tempFloat32, layerMeshIndex);
        }
    }

    setMatrix(viewIndex: number, layerMeshIndex: number, matrix: FloatArrayParam) {
        if (!this.#built) {
            throw "Not finalized";
        }
        ////////////////////////////////////////
        // TODO: Update portion matrix
        ////////////////////////////////////////
        const offset = layerMeshIndex * 4;
        tempFloat32Vec4[0] = matrix[0];
        tempFloat32Vec4[1] = matrix[4];
        tempFloat32Vec4[2] = matrix[8];
        tempFloat32Vec4[3] = matrix[12];
        this.renderState.modelMatrixCol0Buf.setData(tempFloat32Vec4, offset);
        tempFloat32Vec4[0] = matrix[1];
        tempFloat32Vec4[1] = matrix[5];
        tempFloat32Vec4[2] = matrix[9];
        tempFloat32Vec4[3] = matrix[13];
        this.renderState.modelMatrixCol1Buf.setData(tempFloat32Vec4, offset);
        tempFloat32Vec4[0] = matrix[2];
        tempFloat32Vec4[1] = matrix[6];
        tempFloat32Vec4[2] = matrix[10];
        tempFloat32Vec4[3] = matrix[14];
        this.renderState.modelMatrixCol2Buf.setData(tempFloat32Vec4, offset);
    }

    drawColorOpaque(): void {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numTransparent === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numXRayed === this.meshCounts[viewIndex].numMeshes) {
            return;
        }
        if (this.#rendererSet.colorRenderer) {
            this.#rendererSet.colorRenderer.renderVBOInstancingLayer(this, RENDER_PASSES.DRAW_OPAQUE);
        }
    }

    drawColorSAOOpaque(): void {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numTransparent === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numXRayed === this.meshCounts[viewIndex].numMeshes) {
            return;
        }
        if (this.#rendererSet.colorSAORenderer) {
            this.#rendererSet.colorSAORenderer.renderVBOInstancingLayer(this, RENDER_PASSES.DRAW_OPAQUE);
        }
    }

    drawColorTranslucent(): void {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numTransparent === 0 ||
            this.meshCounts[viewIndex].numXRayed === this.meshCounts[viewIndex].numMeshes) {
            return;
        }
        if (this.#rendererSet.colorRenderer) {
            this.#rendererSet.colorRenderer.renderVBOInstancingLayer(this, RENDER_PASSES.DRAW_TRANSPARENT);
        }
    }

    drawDepth(): void {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numTransparent === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numXRayed === this.meshCounts[viewIndex].numMeshes) {
            return;
        }
        if (this.#rendererSet.drawDepthRenderer) {
            this.#rendererSet.drawDepthRenderer.renderVBOInstancingLayer(this, RENDER_PASSES.DRAW_OPAQUE); // Assume whatever post-effect uses depth (eg SAO) does not apply to transparent objects
        }
    }

    drawNormals(): void {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numTransparent === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numXRayed === this.meshCounts[viewIndex].numMeshes) {
            return;
        }
        // if (this.#rendererSet.normalsRenderer) {
        //     this.#rendererSet.normalsRenderer.renderVBOInstancingLayer(this, RENDER_PASSES.DRAW_OPAQUE);  // Assume whatever post-effect uses normals (eg SAO) does not apply to transparent objects
        // }
    }

    drawSilhouetteXRayed(): void {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numXRayed === 0) {
            return;
        }
        if (this.#rendererSet.silhouetteRenderer) {
            this.#rendererSet.silhouetteRenderer.renderVBOInstancingLayer(this, RENDER_PASSES.SILHOUETTE_XRAYED);
        }
    }

    drawSilhouetteHighlighted(): void {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numHighlighted === 0) {
            return;
        }
        if (this.#rendererSet.silhouetteRenderer) {
            this.#rendererSet.silhouetteRenderer.renderVBOInstancingLayer(this, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED);
        }
    }

    drawSilhouetteSelected(): void {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numSelected === 0) {
            return;
        }
        if (this.#rendererSet.silhouetteRenderer) {
            this.#rendererSet.silhouetteRenderer.renderVBOInstancingLayer(this, RENDER_PASSES.SILHOUETTE_SELECTED);
        }
    }

    drawEdgesColorOpaque(): void {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0) {
            return;
        }
        if (this.#rendererSet.edgesColorRenderer) {
            this.#rendererSet.edgesColorRenderer.renderVBOInstancingLayer(this, RENDER_PASSES.DRAW_OPAQUE);
        }
    }

    drawEdgesColorTranslucent(): void {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numTransparent === 0) {
            return;
        }
        if (this.#rendererSet.edgesColorRenderer) {
            this.#rendererSet.edgesColorRenderer.renderVBOInstancingLayer(this, RENDER_PASSES.DRAW_TRANSPARENT);
        }
    }

    drawEdgesHighlighted(): void {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numHighlighted === 0) {
            return;
        }
        if (this.#rendererSet.edgesSilhouetteRenderer) {
            this.#rendererSet.edgesSilhouetteRenderer.renderVBOInstancingLayer(this, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED);
        }
    }

    drawEdgesSelected(): void {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numSelected === 0) {
            return;
        }
        if (this.#rendererSet.edgesSilhouetteRenderer) {
            this.#rendererSet.edgesSilhouetteRenderer.renderVBOInstancingLayer(this, RENDER_PASSES.SILHOUETTE_SELECTED);
        }
    }

    drawEdgesXRayed(): void {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numXRayed === 0) {
            return;
        }
        if (this.#rendererSet.edgesSilhouetteRenderer) {
            this.#rendererSet.edgesSilhouetteRenderer.renderVBOInstancingLayer(this, RENDER_PASSES.SILHOUETTE_XRAYED);
        }
    }

    drawOcclusion(): void {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0) {
            return;
        }
        if (this.#rendererSet.occlusionRenderer) {
            this.#rendererSet.occlusionRenderer.renderVBOInstancingLayer(this, RENDER_PASSES.DRAW_OPAQUE);
        }
    }

    drawShadow(): void {
        // if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
        //     this.meshCounts[viewIndex].numVisible === 0) {
        //     return;
        // }
        // if (this.#rendererSet.shadowRenderer) {
        //     this.#rendererSet.shadowRenderer.render( this, RENDER_PASSES.DRAW_OPAQUE);
        // }
    }

    drawPickMesh(): void {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numVisible === 0) {
            return;
        }
        if (this.#rendererSet.pickMeshRenderer) {
            this.#rendererSet.pickMeshRenderer.renderVBOInstancingLayer(this, RENDER_PASSES.PICK);
        }
    }

    drawPickDepths(): void {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numVisible === 0) {
            return;
        }
        if (this.#rendererSet.pickDepthRenderer) {
            this.#rendererSet.pickDepthRenderer.renderVBOInstancingLayer(this, RENDER_PASSES.PICK);
        }
    }

    drawSnapInit(): void {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes || this.meshCounts[viewIndex].numVisible === 0) {
            return;
        }
        if (this.#rendererSet.snapInitRenderer) {
            this.#rendererSet.snapInitRenderer.renderVBOInstancingLayer(this, RENDER_PASSES.PICK);
        }
    }

    drawSnap(): void {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes || this.meshCounts[viewIndex].numVisible === 0) {
            return;
        }
        if (this.#rendererSet.snapRenderer) {
            this.#rendererSet.snapRenderer.renderVBOInstancingLayer(this, RENDER_PASSES.PICK);
        }
    }

    drawPickNormals(): void {
        // if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes || this.meshCounts[viewIndex].numVisible === 0) {
        //     return;
        // }
        // if (this.#rendererSet.pickNormalsRenderer) {
        //     this.#rendererSet.pickNormalsRenderer.render( this, RENDER_PASSES.PICK);
        // }
    }

    destroy() {
        const renderState = this.renderState;
        for (let viewIndex = 0, len = renderState.flagsBufs.length; viewIndex < len; viewIndex++) {
            if (renderState.colorsBuf[viewIndex]) {
                renderState.colorsBuf[viewIndex].destroy();
                renderState.colorsBuf[viewIndex] = null;
            }
        }
        if (renderState.metallicRoughnessBuf) {
            renderState.metallicRoughnessBuf.destroy();
            renderState.metallicRoughnessBuf = null;
        }
        for (let viewIndex = 0, len = renderState.flagsBufs.length; viewIndex < len; viewIndex++) {
            if (renderState.flagsBufs[viewIndex]) {
                renderState.flagsBufs[viewIndex].destroy();
                renderState.flagsBufs[viewIndex] = null;
            }
        }
        if (renderState.modelMatrixCol0Buf) {
            renderState.modelMatrixCol0Buf.destroy();
            renderState.modelMatrixCol0Buf = null;
        }
        if (renderState.modelMatrixCol1Buf) {
            renderState.modelMatrixCol1Buf.destroy();
            renderState.modelMatrixCol1Buf = null;
        }
        if (renderState.modelMatrixCol2Buf) {
            renderState.modelMatrixCol2Buf.destroy();
            renderState.modelMatrixCol2Buf = null;
        }
        if (renderState.modelNormalMatrixCol0Buf) {
            renderState.modelNormalMatrixCol0Buf.destroy();
            renderState.modelNormalMatrixCol0Buf = null;
        }
        if (renderState.modelNormalMatrixCol1Buf) {
            renderState.modelNormalMatrixCol1Buf.destroy();
            renderState.modelNormalMatrixCol1Buf = null;
        }
        if (renderState.modelNormalMatrixCol2Buf) {
            renderState.modelNormalMatrixCol2Buf.destroy();
            renderState.modelNormalMatrixCol2Buf = null;
        }
        if (renderState.pickColorsBuf) {
            renderState.pickColorsBuf.destroy();
            renderState.pickColorsBuf = null;
        }
        if (renderState.indicesBuf) {
            renderState.indicesBuf.destroy();
            renderState.indicesBuf = null;
        }
        if (renderState.edgeIndicesBuf) {
            renderState.edgeIndicesBuf.destroy();
            renderState.indicesBuf = null;
        }
        this.renderState = null;
    }

    commitRendererState(viewIndex: number): void {
    }

    isEmpty(): boolean {
        return false;
    }

    setLayerMeshCollidable(layerMeshIndex, flags): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
    }

    setLayerMeshMatrix(layerMeshIndex: number, matrix: FloatArrayParam): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
    }

    setLayerMeshOffset(viewIndex: number, layerMeshIndex: number, offset: FloatArrayParam): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
    }
}
