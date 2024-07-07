import {Layer} from "../../Layer";
import {WebGLRendererModel} from "../../WebGLRendererModel";
import {MeshCounts} from "../../MeshCounts";
import {FloatArrayParam} from "@xeokit/math";
import {createMat3, createMat4, createVec3, createVec4, identityMat4, transformPoint4} from "@xeokit/matrix";
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

import {compressUVs, decompressPoint3, getUVBounds, quantizePositions3} from "@xeokit/compression";
import {VBORendererSet} from "../VBORendererSet";

const tempMat4a = <Float64Array>identityMat4();
const tempUint8Array4 = new Uint8Array(4);

let numLayers = 0;

const DEFAULT_MATRIX = identityMat4();

const tempVec3a = createVec3();
const tempVec3b = createVec3();
const tempVec4a = createVec4();
const tempVec4b = createVec4();

/**
 * @private
 */
export class VBOBatchingLayer implements Layer {

    primitive: number;
    rendererModel: WebGLRendererModel;
    layerIndex: number;
    meshCounts: MeshCounts;
    renderState: VBOBatchingRenderState;
    sortId: string;

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
        this.meshCounts = new MeshCounts();

        this.#layerNumber = numLayers++;
        this.#portions = [];
        this.#buffer = new VBOBatchingBuffer();
        this.#scratchMemory = getScratchMemory();
        this.#rendererSet = rendererSet;
        this.#built = false;
        this.#aabb = collapseAABB3(); // Model-space AABB
        this.aabbDirty = true;

        this.renderState =<VBOBatchingRenderState> {
            numVertices: 0,
            positionsBuf: null,
            indicesBuf: null,
            offsetsBuf: null,
            colorsBuf: null,
            flagsBuf: null,
            positionsDecodeMatrix: createMat4(),
            origin: createVec3(),
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
        let numVertices = 0;
        let numIndices = 0;
        sceneGeometry.geometryBuckets.forEach(bucket => {
            numVertices += bucket.positionsCompressed.length;
            numIndices += bucket.indices ? bucket.indices.length : 0;
        });
        return ((this.#buffer.positions.length + numVertices) < (this.#buffer.maxVerts)
            && (this.#buffer.indices.length + numIndices) < (this.#buffer.maxIndices));
    }

    createLayerMesh(layerMeshParams: LayerMeshParams, sceneMesh: SceneMesh): number {

        if (this.#built) {
            throw new SDKError("Already built");
        }

        const geometry = sceneMesh.geometry;
        const metallic = sceneMesh.metallic;
        const roughness = sceneMesh.roughness;
        const color = sceneMesh.color;
        const pickColor = layerMeshParams.pickColor;
        const buffer = this.#buffer;
        const positionsIndex = buffer.positions.length;
        const vertsIndex = positionsIndex / 3;

        let numLayerVerts = buffer.positions.length / 3;
        let numLayerMeshVerts =0;

        for (let bucketIndex = 0, lenBuckets = geometry.geometryBuckets.length; bucketIndex < lenBuckets; bucketIndex++) {

            const geometryBucket = geometry.geometryBuckets[bucketIndex];
            const indices = geometryBucket.indices;
            const edgeIndices = geometryBucket.edgeIndices;
            const positionsCompressed = geometryBucket.positionsCompressed;
            const uvCompressed = geometryBucket.uvsCompressed;
            const positionsDecompressMatrix = geometry.positionsDecompressMatrix;
            const colorsCompressed = geometryBucket.colorsCompressed;
            const numBucketVerts = positionsCompressed.length / 3;

            expandAABB3(this.#aabb, geometry.aabb);

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
                decompressPoint3(tempVec3a, positionsDecompressMatrix, tempVec4a);
                if (sceneMesh.matrix) {
                    tempVec4a[3] = 1.0;
                    transformPoint4(sceneMesh.matrix, tempVec4a, tempVec4b);
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

            numLayerVerts += numBucketVerts;
            numLayerMeshVerts += numBucketVerts;
        }

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
            buffer.pickColors.push(pickColor[0]);
            buffer.pickColors.push(pickColor[1]);
            buffer.pickColors.push(pickColor[2]);
            buffer.pickColors.push(pickColor[3]);
        }

        const metallicValue = (metallic !== null && metallic !== undefined) ? metallic : 0;
        const roughnessValue = (roughness !== null && roughness !== undefined) ? roughness : 255;

        for (let i = 0; i < numLayerMeshVerts; i++) {
            buffer.metallicRoughness.push(metallicValue);
            buffer.metallicRoughness.push(roughnessValue);
        }

        const layerMeshIndex = this.#portions.length / 2;

        this.#portions.push(vertsIndex);
        this.#portions.push(numLayerVerts);

        this.meshCounts.numMeshes++;
        this.rendererModel.meshCounts.numMeshes++;

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

        if (buffer.positions.length > 0) {
            // if (this.#preCompressedPositionsExpected) {
            // const positions = new Uint16Array(buffer.positions);
            // renderState.positionsBuf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, positions, buffer.positions.length, 3, gl.STATIC_DRAW);
            // } else {
            const positions = new Float32Array(buffer.positions);
            positions3ToAABB3(positions, this.#aabb, null);
            const quantizedPositions = quantizePositions3(positions, this.#aabb, renderState.positionsDecodeMatrix);
            renderState.positionsBuf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, quantizedPositions, buffer.positions.length, 3, gl.STATIC_DRAW);
            //}
        }

        if (buffer.colors.length > 0) {
            const colors = new Uint8Array(buffer.colors);
            let normalized = false;
            renderState.colorsBuf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, colors, buffer.colors.length, 4, gl.STATIC_DRAW, normalized);
        }

        if (buffer.positions.length > 0) { // Because we build flags arrays here, get their length from the positions array
            const flagsLength = buffer.positions.length / 3;
            const flags = new Float32Array(flagsLength);
            let notNormalized = false;
            renderState.flagsBuf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, flags, flags.length, 1, gl.DYNAMIC_DRAW, notNormalized);
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

        if (buffer.metallicRoughness.length > 0) {
            const metallicRoughness = new Uint8Array(buffer.metallicRoughness);
            let normalized = false;
            renderState.metallicRoughnessBuf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, metallicRoughness, buffer.metallicRoughness.length, 2, gl.STATIC_DRAW, normalized);
        }

        this.renderState.pbrSupported
            = !!renderState.metallicRoughnessBuf
            && !!renderState.uvBuf
            && !!renderState.normalsBuf
            && !!renderState.textureSet
            && !!renderState.textureSet.colorTexture
            && !!renderState.textureSet.metallicRoughnessTexture;

        this.renderState.colorTextureSupported
            = !!renderState.uvBuf
            && !!renderState.textureSet
            && !!renderState.textureSet.colorTexture;

        this.#buffer = null;
        this.#built = true;
    }

    initFlags(layerMeshIndex: number, flags: number, transparent: boolean) {
        if (flags & SCENE_OBJECT_FLAGS.VISIBLE) {
            this.meshCounts.numVisible++;
            this.rendererModel.meshCounts.numVisible++;
        }
        if (flags & SCENE_OBJECT_FLAGS.HIGHLIGHTED) {
            this.meshCounts.numHighlighted++;
            this.rendererModel.meshCounts.numHighlighted++;
        }
        if (flags & SCENE_OBJECT_FLAGS.XRAYED) {
            this.meshCounts.numXRayed++;
            this.rendererModel.meshCounts.numXRayed++;
        }
        if (flags & SCENE_OBJECT_FLAGS.SELECTED) {
            this.meshCounts.numSelected++;
            this.rendererModel.meshCounts.numSelected++;
        }
        if (flags & SCENE_OBJECT_FLAGS.CLIPPABLE) {
            this.meshCounts.numClippable++;
            this.rendererModel.meshCounts.numClippable++;
        }
        if (flags & SCENE_OBJECT_FLAGS.PICKABLE) {
            this.meshCounts.numPickable++;
            this.rendererModel.meshCounts.numPickable++;
        }
        if (flags & SCENE_OBJECT_FLAGS.CULLED) {
            this.meshCounts.numCulled++;
            this.rendererModel.meshCounts.numCulled++;
        }
        if (transparent) {
            this.meshCounts.numTransparent++;
            this.rendererModel.meshCounts.numTransparent++;
        }
        this.setLayerMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshVisible(layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
        if (flags & SCENE_OBJECT_FLAGS.VISIBLE) {
            this.meshCounts.numVisible++;
            this.rendererModel.meshCounts.numVisible++;
        } else {
            this.meshCounts.numVisible--;
            this.rendererModel.meshCounts.numVisible--;
        }
        this.setLayerMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshHighlighted(layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
        if (flags & SCENE_OBJECT_FLAGS.HIGHLIGHTED) {
            this.meshCounts.numHighlighted++;
            this.rendererModel.meshCounts.numHighlighted++;
        } else {
            this.meshCounts.numHighlighted--;
            this.rendererModel.meshCounts.numHighlighted--;
        }
        this.setLayerMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshXRayed(layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
        if (flags & SCENE_OBJECT_FLAGS.XRAYED) {
            this.meshCounts.numXRayed++;
            this.rendererModel.meshCounts.numXRayed++;
        } else {
            this.meshCounts.numXRayed--;
            this.rendererModel.meshCounts.numXRayed--;
        }
        this.setLayerMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshSelected(layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
        if (flags & SCENE_OBJECT_FLAGS.SELECTED) {
            this.meshCounts.numSelected++;
            this.rendererModel.meshCounts.numSelected++;
        } else {
            this.meshCounts.numSelected--;
            this.rendererModel.meshCounts.numSelected--;
        }
        this.setLayerMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshEdges(layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
        // Not applicable to point clouds
    }

    setLayerMeshClippable(layerMeshIndex: number, flags: number): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
        if (flags & SCENE_OBJECT_FLAGS.CLIPPABLE) {
            this.meshCounts.numClippable++;
            this.rendererModel.meshCounts.numClippable++;
        } else {
            this.meshCounts.numClippable--;
            this.rendererModel.meshCounts.numClippable--;
        }
        this.setLayerMeshFlags(layerMeshIndex, flags);
    }

    setLayerMeshCulled(layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
        if (flags & SCENE_OBJECT_FLAGS.CULLED) {
            this.meshCounts.numCulled++;
            this.rendererModel.meshCounts.numCulled++;
        } else {
            this.meshCounts.numCulled--;
            this.rendererModel.meshCounts.numCulled--;
        }
        this.setLayerMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshCollidable(layerMeshIndex: number, flags: number): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
    }

    setLayerMeshPickable(layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
        if (flags & SCENE_OBJECT_FLAGS.PICKABLE) {
            this.meshCounts.numPickable++;
            this.rendererModel.meshCounts.numPickable++;
        } else {
            this.meshCounts.numPickable--;
            this.rendererModel.meshCounts.numPickable--;
        }
        this.setLayerMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshColor(layerMeshIndex: number, color: FloatArrayParam): void {
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
        this.renderState.colorsBuf.setData(tempArray, firstColor);
    }

    setLayerMeshTransparent(layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (transparent) {
            this.meshCounts.numTransparent++;
            this.rendererModel.meshCounts.numTransparent++;
        } else {
            this.meshCounts.numTransparent--;
            this.rendererModel.meshCounts.numTransparent--;
        }
        this.setLayerMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshFlags(layerMeshIndex: number, flags: number, transparent: boolean = false): void {

        if (!this.#built) {
            throw new SDKError("Not built");
        }

        const portionsIdx = layerMeshIndex * 2;
        const vertexBase = this.#portions[portionsIdx];
        const numVerts = this.#portions[portionsIdx + 1];
        const firstFlag = vertexBase;
        const lenFlags = numVerts;
        const tempArray = this.#scratchMemory.getFloat32Array(lenFlags);

        const visible = !!(flags & SCENE_OBJECT_FLAGS.VISIBLE);
        const xrayed = !!(flags & SCENE_OBJECT_FLAGS.XRAYED);
        const highlighted = !!(flags & SCENE_OBJECT_FLAGS.HIGHLIGHTED);
        const selected = !!(flags & SCENE_OBJECT_FLAGS.SELECTED);
        const pickable = !!(flags & SCENE_OBJECT_FLAGS.PICKABLE);
        const culled = !!(flags & SCENE_OBJECT_FLAGS.CULLED);

        let colorFlag;
        if (!visible || culled || xrayed
            || (highlighted && !this.renderContext.view.highlightMaterial.glowThrough)
            || (selected && !this.renderContext.view.selectedMaterial.glowThrough)) {
            colorFlag = RENDER_PASSES.NOT_RENDERED;
        } else {
            if (transparent) {
                colorFlag = RENDER_PASSES.COLOR_TRANSPARENT;
            } else {
                colorFlag = RENDER_PASSES.COLOR_OPAQUE;
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
            // no edges
            vertFlag |= pickFlag << 12;
            vertFlag |= clippableFlag << 16;
            tempArray[i] = vertFlag;
        }

        this.renderState.flagsBuf.setData(tempArray, firstFlag);
    }

    setLayerMeshMatrix(layerMeshIndex: number, matrix: FloatArrayParam): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
    }

    setLayerMeshOffset(layerMeshIndex: number, offset: FloatArrayParam): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
    }

    drawColorOpaque() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numTransparent === this.meshCounts.numMeshes ||
            this.meshCounts.numXRayed === this.meshCounts.numMeshes) {
            return;
        }
        if (this.#rendererSet.colorRenderer) {
            this.#rendererSet.colorRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.COLOR_OPAQUE);
        }
    }

    drawColorTranslucent() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numTransparent === 0 ||
            this.meshCounts.numXRayed === this.meshCounts.numMeshes) {
            return;
        }
        if (this.#rendererSet.colorRenderer) {
            this.#rendererSet.colorRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.COLOR_TRANSPARENT);
        }
    }

    drawDepth() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numTransparent === this.meshCounts.numMeshes ||
            this.meshCounts.numXRayed === this.meshCounts.numMeshes) {
            return;
        }
        // if (this.#rendererSet.depthRenderer) {
        //     this.#rendererSet.depthRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.COLOR_OPAQUE); // Assume whatever post-effect uses depth (eg SAO) does not apply to transparent objects
        // }
    }

    drawNormals() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numTransparent === this.meshCounts.numMeshes ||
            this.meshCounts.numXRayed === this.meshCounts.numMeshes) {
            return;
        }
        // if (this.#rendererSet.normalsRenderer) {
        //     this.#rendererSet.normalsRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.COLOR_OPAQUE);  // Assume whatever post-effect uses normals (eg SAO) does not apply to transparent objects
        // }
    }

    drawSilhouetteXRayed() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numXRayed === 0) {
            return;
        }
        if (this.#rendererSet.silhouetteRenderer) {
            this.#rendererSet.silhouetteRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.SILHOUETTE_XRAYED);
        }
    }

    drawSilhouetteHighlighted() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numHighlighted === 0) {
            return;
        }
        if (this.#rendererSet.silhouetteRenderer) {
            this.#rendererSet.silhouetteRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED);
        }
    }

    drawSilhouetteSelected() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numSelected === 0) {
            return;
        }
        if (this.#rendererSet.silhouetteRenderer) {
            this.#rendererSet.silhouetteRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.SILHOUETTE_SELECTED);
        }
    }

    drawEdgesColorOpaque() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numEdges === 0) {
            return;
        }
        if (this.#rendererSet.edgesColorRenderer) {
            this.#rendererSet.edgesColorRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.EDGES_COLOR_OPAQUE);
        }
    }

    drawEdgesColorTranslucent() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numEdges === 0 ||
            this.meshCounts.numTransparent === 0) {
            return;
        }
        if (this.#rendererSet.edgesColorRenderer) {
            this.#rendererSet.edgesColorRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.EDGES_COLOR_TRANSPARENT);
        }
    }

    drawEdgesHighlighted() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numEdges === 0 ||
            this.meshCounts.numHighlighted === 0) {
            return;
        }
        if (this.#rendererSet.edgesSilhouetteRenderer) {
            this.#rendererSet.edgesSilhouetteRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.EDGES_HIGHLIGHTED);
        }
    }

    drawEdgesSelected() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numEdges === 0 ||
            this.meshCounts.numSelected === 0) {
            return;
        }
        if (this.#rendererSet.edgesSilhouetteRenderer) {
            this.#rendererSet.edgesSilhouetteRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.EDGES_SELECTED);
        }
    }

    drawEdgesXRayed() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numEdges === 0 ||
            this.meshCounts.numXRayed === 0) {
            return;
        }
        if (this.#rendererSet.edgesSilhouetteRenderer) {
            this.#rendererSet.edgesSilhouetteRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.EDGES_XRAYED);
        }
    }

    drawOcclusion() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0) {
            return;
        }
        if (this.#rendererSet.occlusionRenderer) {
            this.#rendererSet.occlusionRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.COLOR_OPAQUE);
        }
    }

    drawShadow() {
        // if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
        //     this.meshCounts.numVisible === 0) {
        //     return;
        // }
        // if (this.#rendererSet.shadowRenderer) {
        //     this.#rendererSet.shadowRenderer.render( this, RENDER_PASSES.COLOR_OPAQUE);
        // }
    }

    drawPickMesh() {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        if (this.#rendererSet.pickMeshRenderer) {
            this.#rendererSet.pickMeshRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.PICK);
        }
    }

    drawPickDepths() {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        if (this.#rendererSet.pickDepthRenderer) {
            this.#rendererSet.pickDepthRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.PICK);
        }
    }

    drawSnapInit() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes || this.meshCounts.numVisible === 0) {
            return;
        }
        if (this.#rendererSet.snapInitRenderer) {
            this.#rendererSet.snapInitRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.PICK);
        }
    }

    drawSnap() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes || this.meshCounts.numVisible === 0) {
            return;
        }
        if (this.#rendererSet.snapRenderer) {
            this.#rendererSet.snapRenderer.renderVBOBatchingLayer(this, RENDER_PASSES.PICK);
        }
    }

    drawPickNormals() {
        // if (this.meshCounts.numCulled === this.meshCounts.numMeshes || this.meshCounts.numVisible === 0) {
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
        if (renderState.colorsBuf) {
            renderState.colorsBuf.destroy();
            renderState.colorsBuf = null;
        }
        if (renderState.flagsBuf) {
            renderState.flagsBuf.destroy();
            renderState.flagsBuf = null;
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

    commitRendererState(): void {
    }

    isEmpty(): boolean {
        return false;
    }


}
