import {Layer} from "../../Layer";
import {WebGLRendererModel} from "../../WebGLRendererModel";
import {MeshCounts} from "../../MeshCounts";
import {FloatArrayParam} from "@xeokit/math";
import {createMat3, createVec3, createVec4, identityMat4, transformPoint4} from "@xeokit/matrix";
import {collapseAABB3, expandAABB3, positions3ToAABB3} from "@xeokit/boundaries";
import {SDKError} from "@xeokit/core";
import {LayerMeshParams} from "../../LayerMeshParams";
import {SceneGeometry, SceneMesh} from "@xeokit/scene";
import {VBOBatchingBuffer} from "./VBOBatchingBuffer";
import {VBOBatchingRenderState} from "./VBOBatchingRenderState";

import {SCENE_OBJECT_FLAGS} from "../../SCENE_OBJECT_FLAGS";
import {RENDER_PASSES} from "../../RENDER_PASSES";
import {WebGLArrayBuf} from "@xeokit/webglutils";
import {RenderContext} from "../../RenderContext";
import {getScratchMemory, putScratchMemory} from "../ScratchMemory";
import {VBOBatchingLayerParams} from "./VBOBatchingLayerParams";

import {compressUVs, decompressPoint3WithAABB3, getUVBounds, quantizePositions3} from "@xeokit/compression";
import {VBORendererSet} from "../VBORendererSet";
import {SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "@xeokit/constants";

let numLayers = 0;

const tempVec3a = createVec3();
const tempVec4a = createVec4();
const tempVec4b = createVec4();

/**
 * @private
 */
export class VBOBatchingLayer implements Layer {

    primitive: number;
    rendererModel: WebGLRendererModel;
    layerIndex: number;
    meshCounts: MeshCounts[];
    renderState: VBOBatchingRenderState;
    sortId: string;
    saoSupported: boolean;

    #built: boolean;
    #aabb: FloatArrayParam;
    aabbDirty: boolean;
    #meshes: any[];                 // A Mesh has multiple SubMeshes
    #layerNumber: number;

    #deferredAttributesUpdateEnabled: boolean;
    #deferredMatricesUpdateEnabled: boolean;

    #deferredAttributesUpdateDirty: boolean;
    #deferredMatricesUpdateDirty: boolean;

    #countAttributesUpdateInFrame: number;
    #countMatricesUpdateInFrame: number;

    #onViewerTick: () => void;
    #scratchMemory: any;
    #buffer: VBOBatchingBuffer;
    renderContext: RenderContext;
    #portions: number[];
    #rendererSet: VBORendererSet;

    constructor(vBOBatchingLayerParams: VBOBatchingLayerParams, rendererSet: VBORendererSet) {

        this.renderContext = vBOBatchingLayerParams.renderContext;
        this.primitive = vBOBatchingLayerParams.primitive;
        this.rendererModel = vBOBatchingLayerParams.rendererModel;
        this.layerIndex = vBOBatchingLayerParams.layerIndex;
        this.sortId = `VBOBatchingLayer-${vBOBatchingLayerParams.primitive}`;

        this.meshCounts = [];
        for (let i = 0, len = this.renderContext.viewer.viewList.length; i < len; i++) {
            this.meshCounts.push(new MeshCounts());
        }

        this.#layerNumber = numLayers++;
        this.#portions = [];
        this.#buffer = new VBOBatchingBuffer();
        this.#scratchMemory = getScratchMemory();
        this.#rendererSet = rendererSet;
        this.#built = false;
        this.#aabb = collapseAABB3(); // Model-space AABB
        this.aabbDirty = true;

        this.renderState = <VBOBatchingRenderState>{
            numVertices: 0,
            positionsBuf: null,
            indicesBuf: null,
            offsetsBuf: null,
            colorsBuf: [],
            flagsBufs: [],
            positionsDecompressScale: createVec3(),
            positionsDecompressOffset: createVec3(),
            origin: createVec3(vBOBatchingLayerParams.origin),
            pbrSupported: false
        };
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
        const numVertices = sceneGeometry.positionsCompressed.length;
        const numIndices = sceneGeometry.indices ? sceneGeometry.indices.length : 0;
        return ((this.#buffer.positions.length + numVertices) < (this.#buffer.maxVerts)
            && (this.#buffer.indices.length + numIndices) < (this.#buffer.maxIndices));
    }

    createLayerMesh(layerMeshParams: LayerMeshParams, sceneMesh: SceneMesh): number {
        if (this.#built) {
            throw new SDKError("Already built");
        }
        const geometry = sceneMesh.geometry;
        const color = sceneMesh.color;
        const pickColor = layerMeshParams.pickColor;
        const buffer = this.#buffer;
        const positionsIndex = buffer.positions.length;
        const vertsIndex = positionsIndex / 3;
        const indices = geometry.indices;
        const edgeIndices = geometry.edgeIndices;
        const positionsCompressed = geometry.positionsCompressed;
        const uvCompressed = geometry.uvsCompressed;
        const geometryAABB = geometry.aabb;
        const colorsCompressed = geometry.colorsCompressed;
        const numGeometryVerts = positionsCompressed.length / 3;
        let numLayerVerts = buffer.positions.length / 3;
        let numLayerMeshVerts = 0;
        if (!positionsCompressed) {
            throw "positionsCompressed expected";
        }
        if (indices) {
            for (let i = 0, len = indices.length; i < len; i++) {
                buffer.indices.push(numLayerVerts + indices[i]);
            }
        }
        if (edgeIndices) {
            for (let i = 0, len = edgeIndices.length; i < len; i++) {
                buffer.edgeIndices.push(numLayerVerts + edgeIndices[i]);
            }
        }
        for (let k = 0, lenk = positionsCompressed.length; k < lenk; k += 3) {
            tempVec3a[0] = positionsCompressed[k];
            tempVec3a[1] = positionsCompressed[k + 1];
            tempVec3a[2] = positionsCompressed[k + 2];
            decompressPoint3WithAABB3(tempVec3a, geometryAABB, tempVec4a);
            if (sceneMesh.rtcMatrix) {
                tempVec4a[3] = 1.0;
                transformPoint4(sceneMesh.rtcMatrix, tempVec4a, tempVec4b);
                buffer.positions.push(tempVec4b[0]);
                buffer.positions.push(tempVec4b[1]);
                buffer.positions.push(tempVec4b[2]);
            } else {
                buffer.positions.push(tempVec4a[0]);
                buffer.positions.push(tempVec4a[1]);
                buffer.positions.push(tempVec4a[2]);
            }
        }
        if (colorsCompressed) {
            for (let i = 0, len = colorsCompressed.length; i < len; i++) {
                buffer.colors.push(colorsCompressed[i]);
            }
        }
        if (uvCompressed && uvCompressed.length > 0) {
            for (let i = 0, len = uvCompressed.length; i < len; i++) {
                buffer.uv.push(uvCompressed[i]);
            }
        }
        numLayerVerts += numGeometryVerts;
        numLayerMeshVerts += numGeometryVerts;
        if (color) {
            const r = color[0] * 255;
            const g = color[1] * 255;
            const b = color[2] * 255;
            const a = 255;
            for (let i = 0; i < numLayerMeshVerts; i++) {
                buffer.colors.push(r);
                buffer.colors.push(g);
                buffer.colors.push(b);
                buffer.colors.push(a);
            }
        }
        for (let i = 0, len = numLayerMeshVerts; i < len; i += 4) {
            buffer.pickColors.push(...pickColor);
        }
        const layerMeshIndex = this.#portions.length / 2;
        this.#portions.push(vertsIndex);
        this.#portions.push(numLayerVerts);
        for (let viewIndex = 0, len = this.meshCounts.length; viewIndex < len; viewIndex++) {
            this.meshCounts[viewIndex].numMeshes++;
            this.rendererModel.meshCounts[viewIndex].numMeshes++;
        }
        return layerMeshIndex;
    }

    /**
     * Builds batch VBOs from appended geometries.
     * No more portions can then be created.
     */
    build() {
        if (this.#built) {
            throw new SDKError("Already built");
        }
        const renderState = this.renderState;
        const gl = this.renderContext.gl;
        const buffer = this.#buffer;
        const numViews = this.meshCounts.length;
        if (buffer.positions.length > 0) {
            const positions = new Float32Array(buffer.positions);
            positions3ToAABB3(positions, this.#aabb, null);
            const quantizedPositions = quantizePositions3(positions, this.#aabb);
            renderState.positionsBuf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, quantizedPositions, buffer.positions.length, 3, gl.STATIC_DRAW);
            // @ts-ignore
            renderState.positionsDecompressOffset.set([this.#aabb[0], this.#aabb[1], this.#aabb[2]]);
            // @ts-ignore
            renderState.positionsDecompressScale.set([
                (this.#aabb[3] - this.#aabb[0]) / 65535,
                (this.#aabb[4] - this.#aabb[1]) / 65535,
                (this.#aabb[5] - this.#aabb[2]) / 65535]);
        }
        if (buffer.colors.length > 0) {
            const colors = new Uint8Array(buffer.colors);
            let normalized = false;
            for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
                renderState.colorsBuf[viewIndex] = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, colors, buffer.colors.length, 4, gl.STATIC_DRAW, normalized);
            }
        }
        if (buffer.positions.length > 0) { // Because we build flags arrays here, get their length from the positions array
            const flagsLength = buffer.positions.length / 3;
            const flags = new Float32Array(flagsLength);
            let notNormalized = false;
            for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
                renderState.flagsBufs[viewIndex] = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, flags, flags.length, 1, gl.DYNAMIC_DRAW, notNormalized);
            }
        }
        if (buffer.pickColors.length > 0) {
            const pickColors = new Uint8Array(buffer.pickColors);
            let normalized = false;
            renderState.pickColorsBuf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, pickColors, buffer.pickColors.length, 4, gl.STATIC_DRAW, normalized);
        }
        if (buffer.indices.length > 0) {
            const indices = new Uint32Array(buffer.indices);
            renderState.indicesBuf = new WebGLArrayBuf(gl, gl.ELEMENT_ARRAY_BUFFER, indices, buffer.indices.length, 1, gl.STATIC_DRAW);
        }
        if (buffer.edgeIndices.length > 0) {
            const edgeIndices = new Uint32Array(buffer.edgeIndices);
            renderState.edgeIndicesBuf = new WebGLArrayBuf(gl, gl.ELEMENT_ARRAY_BUFFER, edgeIndices, buffer.edgeIndices.length, 1, gl.STATIC_DRAW);
        }
        if (buffer.uv.length > 0) {
            if (!renderState.uvDecodeMatrix) {
                const bounds = getUVBounds(buffer.uv);
                const result = compressUVs(buffer.uv, bounds.min, bounds.max);
                const uv = result.quantized;
                let notNormalized = false;
                renderState.uvDecodeMatrix = createMat3(result.decompressMatrix);
                renderState.uvBuf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, uv, uv.length, 2, gl.STATIC_DRAW, notNormalized);
            } else {
                let notNormalized = false;
                renderState.uvBuf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, buffer.uv, buffer.uv.length, 2, gl.STATIC_DRAW, notNormalized);
            }
        }

        this.saoSupported
            = (this.primitive === SolidPrimitive
            || this.primitive === SurfacePrimitive
            || this.primitive === TrianglesPrimitive);

        renderState.pbrSupported
            = !!renderState.metallicRoughnessBuf
            && !!renderState.uvBuf
            && !!renderState.normalsBuf
            && !!renderState.textureSet
            && !!renderState.textureSet.colorTexture
            && !!renderState.textureSet.metallicRoughnessTexture;

        renderState.colorTextureSupported
            = !!renderState.uvBuf
            && !!renderState.textureSet
            && !!renderState.textureSet.colorTexture;

        this.#buffer = null;
        this.#built = true;
    }

    initFlags(viewIndex: number, layerMeshIndex: number, flags: number, meshTransparent: boolean) {
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
            throw new SDKError("Not built");
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
            throw new SDKError("Not built");
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
            throw new SDKError("Not built");
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
            throw new SDKError("Not built");
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
            throw new SDKError("Not built");
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

    setLayerMeshCulled(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw new SDKError("Not built");
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

    setLayerMeshCollidable(viewIndex: number, layerMeshIndex: number, flags: number): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
    }

    setLayerMeshPickable(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw new SDKError("Not built");
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

    setLayerMeshColor(viewIndex: number, layerMeshIndex: number, color: FloatArrayParam): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
        const portionsIdx = layerMeshIndex * 2;
        const vertexBase = this.#portions[portionsIdx];
        const numVerts = this.#portions[portionsIdx + 1];
        const firstColor = vertexBase * 4;
        const lenColor = numVerts * 4;
        const tempArray = this.#scratchMemory.getUInt8Array(lenColor);
        const r = color[0];
        const g = color[1];
        const b = color[2];
        for (let i = 0; i < lenColor; i += 4) {
            tempArray[i + 0] = r;
            tempArray[i + 1] = g;
            tempArray[i + 2] = b;
        }
        this.renderState.colorsBuf[viewIndex].setData(tempArray, firstColor);
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
            throw new SDKError("Not built");
        }

        const view = this.renderContext.viewer.viewList[viewIndex];

        const portionsIdx = layerMeshIndex * 2;
        const vertexBase = this.#portions[portionsIdx];
        const numVerts = this.#portions[portionsIdx + 1];
        const firstFlag = vertexBase;
        const lenFlags = numVerts - vertexBase;
        const tempArray = this.#scratchMemory.getFloat32Array(lenFlags);

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

        let pickFlag = (visible && !culled && pickable) ? RENDER_PASSES.PICK : RENDER_PASSES.NOT_RENDERED;

        const clippableFlag = !!(flags & SCENE_OBJECT_FLAGS.CLIPPABLE) ? 1 : 0;

        for (let i = 0; i < lenFlags; i++) {
            let vertFlag = 0;
            vertFlag |= colorFlag;
            vertFlag |= silhouetteFlag << 4;
            vertFlag |= pickFlag << 8;
            vertFlag |= clippableFlag << 12;
            tempArray[i] = vertFlag;
        }

        this.renderState.flagsBufs[viewIndex].setData(tempArray, firstFlag);
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

    drawColorOpaque() {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numTransparent === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numXRayed === this.meshCounts[viewIndex].numMeshes) {
            return;
        }
        if (this.#rendererSet.colorRenderer) {
            this.#rendererSet.colorRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.DRAW_OPAQUE);
        }
    }

    drawColorSAOOpaque() {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numTransparent === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numXRayed === this.meshCounts[viewIndex].numMeshes) {
            return;
        }
        if (this.#rendererSet.colorSAORenderer) {
            this.#rendererSet.colorSAORenderer.renderVBOBatchingLayer(this, RENDER_PASSES.DRAW_OPAQUE);
        }
    }

    drawColorTranslucent() {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numTransparent === 0 ||
            this.meshCounts[viewIndex].numXRayed === this.meshCounts[viewIndex].numMeshes) {
            return;
        }
        if (this.#rendererSet.colorRenderer) {
            this.#rendererSet.colorRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.DRAW_TRANSPARENT);
        }
    }

    drawDepth() {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numTransparent === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numXRayed === this.meshCounts[viewIndex].numMeshes) {
            return;
        }
        if (this.#rendererSet.drawDepthRenderer) {
            this.#rendererSet.drawDepthRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.DRAW_OPAQUE); // Assume whatever post-effect uses depth (eg SAO) does not apply to transparent objects
        }
    }

    drawNormals() {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numTransparent === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numXRayed === this.meshCounts[viewIndex].numMeshes) {
            return;
        }
        // if (this.#rendererSet.normalsRenderer) {
        //     this.#rendererSet.normalsRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.DRAW_OPAQUE);  // Assume whatever post-effect uses normals (eg SAO) does not apply to transparent objects
        // }
    }

    drawSilhouetteXRayed() {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numXRayed === 0) {
            return;
        }
        if (this.#rendererSet.silhouetteRenderer) {
            this.#rendererSet.silhouetteRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.SILHOUETTE_XRAYED);
        }
    }

    drawSilhouetteHighlighted() {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numHighlighted === 0) {
            return;
        }
        if (this.#rendererSet.silhouetteRenderer) {
            this.#rendererSet.silhouetteRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED);
        }
    }

    drawSilhouetteSelected() {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numSelected === 0) {
            return;
        }
        if (this.#rendererSet.silhouetteRenderer) {
            this.#rendererSet.silhouetteRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.SILHOUETTE_SELECTED);
        }
    }

    drawEdgesColorOpaque() {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0) {
            return;
        }
        if (this.#rendererSet.edgesColorRenderer) {
            this.#rendererSet.edgesColorRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.DRAW_OPAQUE);
        }
    }

    drawEdgesColorTranslucent() {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numTransparent === 0) {
            return;
        }
        if (this.#rendererSet.edgesColorRenderer) {
            this.#rendererSet.edgesColorRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.DRAW_TRANSPARENT);
        }
    }

    drawEdgesHighlighted() {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numHighlighted === 0) {
            return;
        }
        if (this.#rendererSet.edgesSilhouetteRenderer) {
            this.#rendererSet.edgesSilhouetteRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED);
        }
    }

    drawEdgesSelected() {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numSelected === 0) {
            return;
        }
        if (this.#rendererSet.edgesSilhouetteRenderer) {
            this.#rendererSet.edgesSilhouetteRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.SILHOUETTE_SELECTED);
        }
    }

    drawEdgesXRayed() {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0 ||
            this.meshCounts[viewIndex].numXRayed === 0) {
            return;
        }
        if (this.#rendererSet.edgesSilhouetteRenderer) {
            this.#rendererSet.edgesSilhouetteRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.SILHOUETTE_XRAYED);
        }
    }

    drawOcclusion() {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
            this.meshCounts[viewIndex].numVisible === 0) {
            return;
        }
        if (this.#rendererSet.occlusionRenderer) {
            this.#rendererSet.occlusionRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.DRAW_OPAQUE);
        }
    }

    drawShadow() {
        const viewIndex = this.renderContext.view.viewIndex;
        // if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes ||
        //     this.meshCounts[viewIndex].numVisible === 0) {
        //     return;
        // }
        // if (this.#rendererSet.shadowRenderer) {
        //     this.#rendererSet.shadowRenderer.render( this, RENDER_PASSES.DRAW_OPAQUE);
        // }
    }

    drawPickMesh() {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numVisible === 0) {
            return;
        }
        if (this.#rendererSet.pickMeshRenderer) {
            this.#rendererSet.pickMeshRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.PICK);
        }
    }

    drawPickDepths() {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numVisible === 0) {
            return;
        }
        if (this.#rendererSet.pickDepthRenderer) {
            this.#rendererSet.pickDepthRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.PICK);
        }
    }

    drawSnapInit() {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes || this.meshCounts[viewIndex].numVisible === 0) {
            return;
        }
        if (this.#rendererSet.snapInitRenderer) {
            this.#rendererSet.snapInitRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.PICK);
        }
    }

    drawSnap() {
        const viewIndex = this.renderContext.view.viewIndex;
        if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes || this.meshCounts[viewIndex].numVisible === 0) {
            return;
        }
        if (this.#rendererSet.snapRenderer) {
            this.#rendererSet.snapRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.PICK);
        }
    }

    drawPickNormals() {
        // if (this.meshCounts[viewIndex].numCulled === this.meshCounts[viewIndex].numMeshes || this.meshCounts[viewIndex].numVisible === 0) {
        //     return;
        // }
        // if (this.#rendererSet.pickNormalsRenderer) {
        //     this.#rendererSet.pickNormalsRenderer.render( this, RENDER_PASSES.PICK);
        // }
    }

    destroy() {
        const renderState = this.renderState;
        if (renderState.positionsBuf) {
            renderState.positionsBuf.destroy();
            renderState.positionsBuf = null;
        }
        if (renderState.offsetsBuf) {
            renderState.offsetsBuf.destroy();
            renderState.offsetsBuf = null;
        }
        for (let viewIndex = 0, len = renderState.colorsBuf.length; viewIndex < len; viewIndex++) {
            if (renderState.colorsBuf[viewIndex]) {
                renderState.colorsBuf[viewIndex].destroy();
                renderState.colorsBuf[viewIndex] = null;
            }
        }
        for (let viewIndex = 0, len = renderState.flagsBufs.length; viewIndex < len; viewIndex++) {
            if (renderState.flagsBufs[viewIndex]) {
                renderState.flagsBufs[viewIndex].destroy();
                renderState.flagsBufs[viewIndex] = null;
            }
        }
        if (renderState.pickColorsBuf) {
            renderState.pickColorsBuf.destroy();
            renderState.pickColorsBuf = null;
        }
        if (renderState.uvBuf) {
            renderState.uvBuf.destroy();
            renderState.uvBuf = null;
        }
        if (renderState.indicesBuf) {
            renderState.indicesBuf.destroy();
            renderState.indicesBuf = null;
        }
        if (renderState.edgeIndicesBuf) {
            renderState.edgeIndicesBuf.destroy();
            renderState.edgeIndicesBuf = null;
        }
        //renderState.destroy();
        putScratchMemory();
    }

    commitRendererState(viewIndex: number): void {
    }

    isEmpty(): boolean {
        return false;
    }


}
