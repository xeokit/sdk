import {RenderState} from "../../../webgl/RenderState.js";
import {Configs} from "../../../../Configs.js";

import {RENDER_PASSES} from '../../RENDER_PASSES.js';
import {getRenderers} from "./renderers/DTXTrianglesRenderers.js";
import {DTXTrianglesState} from "./lib/DTXTrianglesState.js"

import {RenderContext} from "../RenderContext";
import {TrianglesColorsAndFlagsDataTexture} from "./TrianglesColorsAndFlagsDataTexture";
import {InstanceMatricesDataTexture} from "../InstanceMatricesDataTexture";
import {DecodeMatricesDataTexture} from "../DecodeMatricesDataTexture";
import {positionsCompressedDataTexture} from "../positionsCompressedDataTexture";

import {Triangles8BitEdgeIndicesDataTexture} from "./Triangles8BitEdgeIndicesDataTexture";
import {Triangles16BitEdgeIndicesDataTexture} from "./Triangles16BitEdgeIndicesDataTexture";
import {Triangles32BitEdgeIndicesDataTexture} from "./Triangles32BitEdgeIndicesDataTexture";

import {Triangles8BitIndicesDataTexture} from "./Triangles8BitIndicesDataTexture";
import {Triangles16BitIndicesDataTexture} from "./Triangles16BitIndicesDataTexture";
import {Triangles32BitIndicesDataTexture} from "./Triangles32BitIndicesDataTexture";

import {TrianglesEdgePortionIdDataTexture} from "./TrianglesEdgePortionIdDataTexture";
import {RenderFlags} from "../RenderFlags";
import {TrianglesBuffer} from "./TrianglesBuffer";
import {collapseAABB3, expandAABB3} from "@xeokit/boundaries";
import {createVec3, identityMat4} from "@xeokit/matrix";
import {FloatArrayParam} from "@xeokit/math";
import {SCENE_OBJECT_FLAGS} from "../SCENE_OBJECT_FLAGS";

const configs = new Configs();

/**
 * 12-bits allowed for object ids.
 * Limits the per-object texture height in the layer.
 */
const MAX_NUMBER_OF_OBJECTS_IN_LAYER = (1 << 16);

/**
 * 4096 is max data texture height.
 * Limits the aggregated geometry texture height in the layer.
 */
const MAX_DATA_TEXTURE_HEIGHT = configs.maxDataTextureHeight;

/**
 * Align `indices` and `edgeIndices` memory layout to 8 elements.
 *
 * Used as an optimization for the `...portionIds...` texture, so it
 * can just be stored 1 out of 8 `portionIds` corresponding to a given
 * `triangle-index` or `edge-index`.
 */
const INDICES_EDGE_INDICES_ALIGNEMENT_SIZE = 8;

/**
 * Number of maximum allowed per-object flags update per render frame
 * before switching to batch update mode.
 */
const MAX_OBJECT_UPDATES_IN_FRAME_WITHOUT_BATCHED_UPDATE = 10;

const tempMat4a = new Float32Array(16);
const tempUint8Array4 = new Uint8Array(4);
const tempFloat32Array3 = new Float32Array(3);

let numLayers = 0;

const DEFAULT_MATRIX = identityMat4();

class TrianglesColorsAndFlagsTextures {
    constructor(param: { objectVertexBases: any; objectIndexBaseOffsets: any; solid: any; pickColors: any; gl: any; objectEdgeIndexBaseOffsets: any; colors: any }) {

    }

}

/**
 * @
 */
export class TrianglesLayer {

    #layerNumber: number;
    sortId: string;
    layerIndex: number;
    #renderers: any;
    model: any;
    #buffer: TrianglesBuffer;
    #dtxState: any;
    #state: any;
    #numPortions: number;
    #numVisibleLayerPortions: number;
    #numTransparentLayerPortions: number;
    #numXRayedLayerPortions: number;
    #numSelectedLayerPortions: number;
    #numHighlightedLayerPortions: number;
    #numClippableLayerPortions: number;
    #numEdgesLayerPortions: number;
    #numPickableLayerPortions: number;
    #numCulledLayerPortions: number;
    #subPortions: any[];
    #portionToSubPortionsMap: any[];
    #bucketGeometries: {};
    #meshes: any[];
    aabbDirty: boolean;
    #numUpdatesInFrame: number;
    #finalized: boolean;
    #deferredSetFlagsActive: boolean;
    #deferredSetFlagsDirty: boolean;
    #destroyed: boolean;
    #aabb: FloatArrayParam;

    constructor(model, cfg) {

        console.info("Creating TrianglesRendererLayer");

        this.#layerNumber = numLayers++;
        this.sortId = `TriDTX-${this.#layerNumber}`; // State sorting key.
        this.layerIndex = cfg.layerIndex; // Index of this TrianglesDataTextureLayer in {@link SceneModel#_layerList}.

        this.#renderers = getRenderers(model.scene);
        this.model = model;
        this.#buffer = new TrianglesBuffer();
        this.#dtxState = new DTXTrianglesState();

        this.#state = new RenderState({
            origin: createVec3(cfg.origin),
            metallicRoughnessBuf: null,
            textureState: this.#dtxState,
            numIndices8Bits: 0,
            numIndices16Bits: 0,
            numIndices32Bits: 0,
            numEdgeIndices8Bits: 0,
            numEdgeIndices16Bits: 0,
            numEdgeIndices32Bits: 0,
            numVertices: 0,
        });

        this.#numPortions = 0;        // These counts are used to avoid unnecessary render passes
        this.#numVisibleLayerPortions = 0;
        this.#numTransparentLayerPortions = 0;
        this.#numXRayedLayerPortions = 0;
        this.#numSelectedLayerPortions = 0;
        this.#numHighlightedLayerPortions = 0;
        this.#numClippableLayerPortions = 0;
        this.#numEdgesLayerPortions = 0;
        this.#numPickableLayerPortions = 0;
        this.#numCulledLayerPortions = 0;

        this.#subPortions = [];

        /**
         * Due to `index rebucketting` process in ```prepareMeshGeometry``` function, it's possible that a single
         * portion is expanded to more than 1 real sub-portion.
         *
         * This Array tracks the mapping between:
         *
         * - external `portionIds` as seen by consumers of this class.
         * - internal `sub-portionIds` actually managed by this class.
         *
         * The outer index of this array is the externally seen `portionId`.
         * The inner value of the array, are `sub-portionIds` corresponding to the `portionId`.
         */
        this.#portionToSubPortionsMap = [];

        this.#bucketGeometries = {};

        this.#meshes = [];

        /**
         * The axis-aligned World-space boundary of this TrianglesDataTextureLayer's positions.
         */
        this.#aabb = collapseAABB3();
        this.aabbDirty = true;

        /**
         * The number of updates in the current frame;
         */
        this.#numUpdatesInFrame = 0;

        this.#finalized = false;
    }

    get aabb(): FloatArrayParam {
        if (this.aabbDirty) {
            collapseAABB3(this.#aabb);
            for (let i = 0, len = this.#meshes.length; i < len; i++) {
                expandAABB3(this.#aabb, this.#meshes[i].aabb);
            }
            this.aabbDirty = false;
        }
        return this.#aabb;
    }

    /**
     * Returns whether the ```TrianglesDataTextureLayer``` has room for more portions.
     *
     * @param {object} portionCfg An object containing the geometrical data (`positions`, `indices`, `edgeIndices`) for the portion.
     * @returns {Boolean} Wheter the requested portion can be created
     */
    canCreatePortion(portionCfg: any) : boolean{
        if (this.#finalized) {
            throw "Already finalized";
        }
        const numNewPortions = portionCfg.buckets.length;
        let retVal = (this.#numPortions + numNewPortions) <= MAX_NUMBER_OF_OBJECTS_IN_LAYER;
        const bucketIndex = 0; // TODO: Is this a bug?
        const bucketGeometryId = portionCfg.geometryId !== undefined && portionCfg.geometryId !== null
            ? `${portionCfg.geometryId}#${bucketIndex}`
            : `${portionCfg.id}#${bucketIndex}`;
        const alreadyHasPortionGeometry = this.#bucketGeometries[bucketGeometryId];
        if (!alreadyHasPortionGeometry) {
            const maxIndicesOfAnyBits = Math.max(this.#state.numIndices8Bits, this.#state.numIndices16Bits, this.#state.numIndices32Bits,);
            let numVertices = 0;
            let numIndices = 0;
            portionCfg.buckets.forEach(bucket => {
                numVertices += bucket.positionsCompressed.length / 3;
                numIndices += bucket.indices.length / 3;
            });
            if ((this.#state.numVertices + numVertices) > MAX_DATA_TEXTURE_HEIGHT * 4096 ||
                (maxIndicesOfAnyBits + numIndices) > MAX_DATA_TEXTURE_HEIGHT * 4096) {
            }
            retVal &&=
                (this.#state.numVertices + numVertices) <= MAX_DATA_TEXTURE_HEIGHT * 4096 &&
                (maxIndicesOfAnyBits + numIndices) <= MAX_DATA_TEXTURE_HEIGHT * 4096;
        }
        return retVal;
    }

    /**
     * Creates a new portion within this TrianglesDataTextureLayer, returns the new portion ID.
     *
     */
    createPortion(mesh: any, portionCfg: any): number {
        if (this.#finalized) {
            throw "Already finalized";
        }
        const subPortionIds = [];
        //   const portionAABB = portionCfg.worldAABB;
        portionCfg.buckets.forEach((bucket, bucketIndex) => {
            const bucketGeometryId = portionCfg.geometryId !== undefined && portionCfg.geometryId !== null
                ? `${portionCfg.geometryId}#${bucketIndex}`
                : `${portionCfg.id}#${bucketIndex}`;
            let bucketGeometry = this.#bucketGeometries[bucketGeometryId];
            if (!bucketGeometry) {
                bucketGeometry = this.#createBucketGeometry(portionCfg, bucket);
                this.#bucketGeometries[bucketGeometryId] = bucketGeometry;
            }
            //  const subPortionAABB = collapseAABB3(tempAABB3b);
            const subPortionId = this.#createSubPortion(portionCfg, bucketGeometry, bucket);
            //expandAABB3(portionAABB, subPortionAABB);
            subPortionIds.push(subPortionId);
        });
        const portionId = this.#portionToSubPortionsMap.length;
        this.#portionToSubPortionsMap.push(subPortionIds);
        this.model.numPortions++;
        this.#meshes.push(mesh);
        return portionId;
    }

    #createBucketGeometry(portionCfg: any, bucket: any): any {

        // Indices alignement
        // This will make every mesh consume a multiple of INDICES_EDGE_INDICES_ALIGNEMENT_SIZE
        // array items for storing the triangles of the mesh, and it supports:
        // - a memory optimization of factor INDICES_EDGE_INDICES_ALIGNEMENT_SIZE
        // - in exchange for a small RAM overhead
        //   (by adding some padding until a size that is multiple of INDICES_EDGE_INDICES_ALIGNEMENT_SIZE)

        if (bucket.indices) {
            const alignedIndicesLen = Math.ceil((bucket.indices.length / 3) / INDICES_EDGE_INDICES_ALIGNEMENT_SIZE) * INDICES_EDGE_INDICES_ALIGNEMENT_SIZE * 3;
            const alignedIndices = new Uint32Array(alignedIndicesLen);
            alignedIndices.fill(0);
            alignedIndices.set(bucket.indices);
            bucket.indices = alignedIndices;
        }

        // EdgeIndices alignement
        // This will make every mesh consume a multiple of INDICES_EDGE_INDICES_ALIGNEMENT_SIZE
        // array items for storing the edges of the mesh, and it supports:
        // - a memory optimization of factor INDICES_EDGE_INDICES_ALIGNEMENT_SIZE
        // - in exchange for a small RAM overhead
        //   (by adding some padding until a size that is multiple of INDICES_EDGE_INDICES_ALIGNEMENT_SIZE)

        if (bucket.edgeIndices) {
            const alignedEdgeIndicesLen = Math.ceil((bucket.edgeIndices.length / 2) / INDICES_EDGE_INDICES_ALIGNEMENT_SIZE) * INDICES_EDGE_INDICES_ALIGNEMENT_SIZE * 2;
            const alignedEdgeIndices = new Uint32Array(alignedEdgeIndicesLen);
            alignedEdgeIndices.fill(0);
            alignedEdgeIndices.set(bucket.edgeIndices);
            bucket.edgeIndices = alignedEdgeIndices;
        }

        const positionsCompressed = bucket.positionsCompressed;
        const indices = bucket.indices;
        const edgeIndices = bucket.edgeIndices;
        const buffer = this.#buffer;

        buffer.positionsCompressed.push(positionsCompressed)
        const vertexBase = buffer.lenPositionsCompressed / 3;
        const numVertices = positionsCompressed.length / 3;
        buffer.lenPositionsCompressed += positionsCompressed.length;

        let indicesBase;
        let numTriangles = 0;
        if (indices) {
            numTriangles = indices.length / 3;
            let indicesBuffer;
            if (numVertices <= (1 << 8)) {
                indicesBuffer = buffer.indices8Bits;
                indicesBase = buffer.lenIndices8Bits / 3;
                buffer.lenIndices8Bits += indices.length;
            } else if (numVertices <= (1 << 16)) {
                indicesBuffer = buffer.indices16Bits;
                indicesBase = buffer.lenIndices16Bits / 3;
                buffer.lenIndices16Bits += indices.length;
            } else {
                indicesBuffer = buffer.indices32Bits;
                indicesBase = buffer.lenIndices32Bits / 3;
                buffer.lenIndices32Bits += indices.length;
            }
            indicesBuffer.push(indices);
        }

        let edgeIndicesBase;
        let numEdges = 0;
        if (edgeIndices) {
            numEdges = edgeIndices.length / 2;
            let edgeIndicesBuffer;
            if (numVertices <= (1 << 8)) {
                edgeIndicesBuffer = buffer.edgeIndices8Bits;
                edgeIndicesBase = buffer.lenEdgeIndices8Bits / 2;
                buffer.lenEdgeIndices8Bits += edgeIndices.length;
            } else if (numVertices <= (1 << 16)) {
                edgeIndicesBuffer = buffer.edgeIndices16Bits;
                edgeIndicesBase = buffer.lenEdgeIndices16Bits / 2;
                buffer.lenEdgeIndices16Bits += edgeIndices.length;
            } else {
                edgeIndicesBuffer = buffer.edgeIndices32Bits;
                edgeIndicesBase = buffer.lenEdgeIndices32Bits / 2;
                buffer.lenEdgeIndices32Bits += edgeIndices.length;
            }
            edgeIndicesBuffer.push(edgeIndices);
        }

        this.#state.numVertices += numVertices;

        const bucketGeometry = {
            vertexBase,
            numVertices,
            numTriangles,
            numEdges,
            indicesBase,
            edgeIndicesBase
        };

        return bucketGeometry;
    }

    #createSubPortion(portionCfg: any, bucketGeometry: any, bucket): number {

        const color = portionCfg.color;
        const metallic = portionCfg.metallic;
        const roughness = portionCfg.roughness;
        const colors = portionCfg.colors;
        const opacity = portionCfg.opacity;
        const meshMatrix = portionCfg.meshMatrix;
        const pickColor = portionCfg.pickColor;
        const buffer = this.#buffer;
        const state = this.#state;

        buffer.perSubMeshDecodeMatrices.push(portionCfg.positionsDecodeMatrix);
        buffer.perSubMeshInstancingMatrices.push(meshMatrix || DEFAULT_MATRIX);

        buffer.perSubMeshSolidFlag.push(!!portionCfg.solid);

        if (colors) {
            buffer.perSubMeshColors.push([colors[0] * 255, colors[1] * 255, colors[2] * 255, 255]);
        } else if (color) { // Color is pre-quantized by SceneModel
            buffer.perSubMeshColors.push([color[0], color[1], color[2], opacity]);
        }

        buffer.perSubMeshPickColors.push(pickColor);
        buffer.perSubMeshVertexBases.push(bucketGeometry.vertexBase);

        {
            let currentNumIndices;
            if (bucketGeometry.numVertices <= (1 << 8)) {
                currentNumIndices = state.numIndices8Bits;
            } else if (bucketGeometry.numVertices <= (1 << 16)) {
                currentNumIndices = state.numIndices16Bits;
            } else {
                currentNumIndices = state.numIndices32Bits;
            }
            buffer.perSubMeshIndicesBases.push(currentNumIndices / 3 - bucketGeometry.indicesBase);
        }

        {
            let currentNumEdgeIndices;
            if (bucketGeometry.numVertices <= (1 << 8)) {
                currentNumEdgeIndices = state.numEdgeIndices8Bits;
            } else if (bucketGeometry.numVertices <= (1 << 16)) {
                currentNumEdgeIndices = state.numEdgeIndices16Bits;
            } else {
                currentNumEdgeIndices = state.numEdgeIndices32Bits;
            }
            buffer.perSubMeshEdgeIndicesBases.push(currentNumEdgeIndices / 2 - bucketGeometry.edgeIndicesBase);
        }

        const subPortionId = this.#subPortions.length;
        if (bucketGeometry.numTriangles > 0) {
            let numIndices = bucketGeometry.numTriangles * 3;
            let indicesPortionIdBuffer;
            if (bucketGeometry.numVertices <= (1 << 8)) {
                indicesPortionIdBuffer = buffer.perTriangleSubMesh8Bits;
                state.numIndices8Bits += numIndices;
            } else if (bucketGeometry.numVertices <= (1 << 16)) {
                indicesPortionIdBuffer = buffer.perTriangleSubMesh16Bits;
                state.numIndices16Bits += numIndices;
            } else {
                indicesPortionIdBuffer = buffer.perTriangleSubMesh32Bits;
                state.numIndices32Bits += numIndices;
            }
            for (let i = 0; i < bucketGeometry.numTriangles; i += INDICES_EDGE_INDICES_ALIGNEMENT_SIZE) {
                indicesPortionIdBuffer.push(subPortionId);
            }
        }

        if (bucketGeometry.numEdges > 0) {
            let numEdgeIndices = bucketGeometry.numEdges * 2;
            let edgeIndicesPortionIdBuffer;
            if (bucketGeometry.numVertices <= (1 << 8)) {
                edgeIndicesPortionIdBuffer = buffer.perEdgeSubMesh8Bits;
                state.numEdgeIndices8Bits += numEdgeIndices;
            } else if (bucketGeometry.numVertices <= (1 << 16)) {
                edgeIndicesPortionIdBuffer = buffer.perEdgeSubMesh16Bits;
                state.numEdgeIndices16Bits += numEdgeIndices;
            } else {
                edgeIndicesPortionIdBuffer = buffer.perEdgeSubMesh32Bits;
                state.numEdgeIndices32Bits += numEdgeIndices;
            }
            for (let i = 0; i < bucketGeometry.numEdges; i += INDICES_EDGE_INDICES_ALIGNEMENT_SIZE) {
                edgeIndicesPortionIdBuffer.push(subPortionId);
            }
        }

        //   buffer.perObjectOffsets.push([0, 0, 0]);

        this.#subPortions.push({
            // vertsBase: vertsIndex,
            numVertices: bucketGeometry.numTriangles
        });

        this.#numPortions++;

        return subPortionId;
    }

    /**
     * Builds data textures from the appended geometries and loads them into the GPU.
     *
     * No more portions can then be created.
     */
    finalize() {

        if (this.#finalized) {
            return;
        }

        const state = this.#state;
        const textureState = this.#dtxState;
        const gl = this.model.scene.canvas.gl;
        const buffer = this.#buffer;

        state.gl = gl;

        textureState.perSubMeshAttributesDataTexture = new TrianglesColorsAndFlagsDataTexture({
            gl,
            colors: buffer.perSubMeshColors,
            pickColors: buffer.perSubMeshPickColors,
            vertexBases: buffer.perSubMeshVertexBases,
            indexBaseOffsets: buffer.perSubMeshIndicesBases,
            edgeIndexBaseOffsets: buffer.perSubMeshEdgeIndicesBases,
            solid: buffer.perSubMeshSolidFlag
        });

        textureState.perSubMeshInstancingMatricesDataTexture = new InstanceMatricesDataTexture({
            gl,
            matrices: buffer.perSubMeshInstancingMatrices
        });

        textureState.perSubMeshDecodeMatricesDataTexture = new DecodeMatricesDataTexture({
            gl,
            matrices: buffer.perSubMeshDecodeMatrices
        });

        textureState.positionsCompressedDataTexture = new positionsCompressedDataTexture({
            gl,
            positionsArrays: buffer.positionsCompressed,
            lenPositions: buffer.lenPositionsCompressed
        });

        textureState.perTriangleSubMesh8BitsDataTexture = new TrianglesEdgePortionIdDataTexture({
            gl,
            portionIdsArray: buffer.perTriangleSubMesh8Bits
        });

        textureState.perTriangleSubMesh16BitsDataTexture = new TrianglesEdgePortionIdDataTexture({
            gl,
            portionIdsArray: buffer.perTriangleSubMesh16Bits
        });

        textureState.perTriangleSubMesh32BitsDataTexture = new TrianglesEdgePortionIdDataTexture({
            gl,
            portionIdsArray: buffer.perTriangleSubMesh32Bits
        });

        if (buffer.perEdgeSubMesh8Bits.length > 0) {
            textureState.perEdgeSubMesh8BitsDataTexture = new TrianglesEdgePortionIdDataTexture({
                gl,
                portionIdsArray: buffer.perEdgeSubMesh8Bits
            });
        }

        if (buffer.perEdgeSubMesh16Bits.length > 0) {
            textureState.perEdgeSubMesh16BitsDataTexture = new TrianglesEdgePortionIdDataTexture({
                gl,
                portionIdsArray: buffer.perEdgeSubMesh16Bits
            });
        }

        if (buffer.perEdgeSubMesh32Bits.length > 0) {
            textureState.perEdgeSubMesh32BitsDataTexture = new TrianglesEdgePortionIdDataTexture({
                gl,
                portionIdsArray: buffer.perEdgeSubMesh32Bits
            });
        }

        if (buffer.lenIndices8Bits > 0) {
            textureState.indices8BitsDataTexture = new Triangles8BitIndicesDataTexture({
                gl,
                indicesArrays: buffer.indices8Bits,
                lenIndices: buffer.lenIndices8Bits
            });
        }

        if (buffer.lenIndices16Bits > 0) {
            textureState.indices16BitsDataTexture = new Triangles16BitIndicesDataTexture({
                gl,
                indicesArrays: buffer.indices16Bits,
                lenIndices: buffer.lenIndices16Bits
            });
        }

        if (buffer.lenIndices32Bits > 0) {
            textureState.indices32BitsDataTexture = new Triangles32BitIndicesDataTexture({
                gl,
                indicesArrays: buffer.indices32Bits,
                lenIndices: buffer.lenIndices32Bits
            });
        }

        if (buffer.lenEdgeIndices8Bits > 0) {
            textureState.edgeIndices8BitsDataTexture = new Triangles8BitEdgeIndicesDataTexture({
                gl,
                indicesArrays: buffer.edgeIndices8Bits,
                lenIndices: buffer.lenEdgeIndices8Bits
            });
        }

        if (buffer.lenEdgeIndices16Bits > 0) {
            textureState.edgeIndices16BitsDataTexture = new Triangles16BitEdgeIndicesDataTexture({
                gl,
                indicesArrays: buffer.edgeIndices16Bits,
                lenIndices: buffer.lenEdgeIndices16Bits
            });
        }

        if (buffer.lenEdgeIndices32Bits > 0) {
            textureState.edgeIndices32BitsDataTexture = new Triangles32BitEdgeIndicesDataTexture({
                gl,
                indicesArrays: buffer.edgeIndices32Bits,
                lenIndices: buffer.lenEdgeIndices32Bits
            });
        }

        textureState.finalize();

        // Free up memory
        this.#buffer = null;
        this.#bucketGeometries = {};
        this.#finalized = true;
        this.#deferredSetFlagsDirty = false; //

        this.#onSceneRendering = this.model.scene.on("rendering", () => {
            if (this.#deferredSetFlagsDirty) {
                this.#uploadDeferredFlags();
            }
            this.#numUpdatesInFrame = 0;
        });
    }

    isEmpty() {
        return this.#numPortions === 0;
    }

    initFlags(portionId: number, flags: number, meshTransparent) {
        if (flags & SCENE_OBJECT_FLAGS.VISIBLE) {
            this.#numVisibleLayerPortions++;
            this.model.numVisibleLayerPortions++;
        }
        if (flags & SCENE_OBJECT_FLAGS.HIGHLIGHTED) {
            this.#numHighlightedLayerPortions++;
            this.model.numHighlightedLayerPortions++;
        }
        if (flags & SCENE_OBJECT_FLAGS.XRAYED) {
            this.#numXRayedLayerPortions++;
            this.model.numXRayedLayerPortions++;
        }
        if (flags & SCENE_OBJECT_FLAGS.SELECTED) {
            this.#numSelectedLayerPortions++;
            this.model.numSelectedLayerPortions++;
        }
        if (flags & SCENE_OBJECT_FLAGS.CLIPPABLE) {
            this.#numClippableLayerPortions++;
            this.model.numClippableLayerPortions++;
        }
        if (flags & SCENE_OBJECT_FLAGS.EDGES) {
            this.#numEdgesLayerPortions++;
            this.model.numEdgesLayerPortions++;
        }
        if (flags & SCENE_OBJECT_FLAGS.PICKABLE) {
            this.#numPickableLayerPortions++;
            this.model.numPickableLayerPortions++;
        }
        if (flags & SCENE_OBJECT_FLAGS.CULLED) {
            this.#numCulledLayerPortions++;
            this.model.numCulledLayerPortions++;
        }
        if (meshTransparent) {
            this.#numTransparentLayerPortions++;
            this.model.numTransparentLayerPortions++;
        }
        const deferred = true;
        this.#setFlags(portionId, flags, meshTransparent, deferred);
        this.#setFlags2(portionId, flags, deferred);
    }

    flushInitFlags() {
        this.#setDeferredFlags();
        this.#setDeferredFlags2();
    }

    setVisible(portionId: number, flags: number, transparent) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SCENE_OBJECT_FLAGS.VISIBLE) {
            this.#numVisibleLayerPortions++;
            this.model.numVisibleLayerPortions++;
        } else {
            this.#numVisibleLayerPortions--;
            this.model.numVisibleLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setHighlighted(portionId: number, flags: number, transparent) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SCENE_OBJECT_FLAGS.HIGHLIGHTED) {
            this.#numHighlightedLayerPortions++;
            this.model.numHighlightedLayerPortions++;
        } else {
            this.#numHighlightedLayerPortions--;
            this.model.numHighlightedLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setXRayed(portionId: number, flags: number, transparent) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SCENE_OBJECT_FLAGS.XRAYED) {
            this.#numXRayedLayerPortions++;
            this.model.numXRayedLayerPortions++;
        } else {
            this.#numXRayedLayerPortions--;
            this.model.numXRayedLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setSelected(portionId: number, flags: number, transparent) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SCENE_OBJECT_FLAGS.SELECTED) {
            this.#numSelectedLayerPortions++;
            this.model.numSelectedLayerPortions++;
        } else {
            this.#numSelectedLayerPortions--;
            this.model.numSelectedLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setEdges(portionId: number, flags: number, transparent) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SCENE_OBJECT_FLAGS.EDGES) {
            this.#numEdgesLayerPortions++;
            this.model.numEdgesLayerPortions++;
        } else {
            this.#numEdgesLayerPortions--;
            this.model.numEdgesLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setClippable(portionId: number, flags: number) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SCENE_OBJECT_FLAGS.CLIPPABLE) {
            this.#numClippableLayerPortions++;
            this.model.numClippableLayerPortions++;
        } else {
            this.#numClippableLayerPortions--;
            this.model.numClippableLayerPortions--;
        }
        this.#setFlags2(portionId, flags);
    }

    /**
     * This will _start_ a "set-flags transaction".
     *
     * After invoking this method, calling setFlags/setFlags2 will not update
     * the colors+flags texture but only store the new flags/flag2 in the
     * colors+flags texture data array.
     *
     * After invoking this method, and when all desired setFlags/setFlags2 have
     * been called on needed portions of the layer, invoke `_uploadDeferredFlags`
     * to actually upload the data array into the texture.
     *
     * In massive "set-flags" scenarios like VFC or LOD mechanisms, the combination of
     * `_beginDeferredFlags` + `_uploadDeferredFlags`brings a speed-up of
     * up to 80x when e.g. objects are massively (un)culled 🚀.
     */
    #beginDeferredFlags() {
        this.#deferredSetFlagsActive = true;
    }

    /**
     * This will _commit_ a "set-flags transaction".
     *
     * Invoking this method will update the colors+flags texture data with new
     * flags/flags2 set since the previous invocation of `_beginDeferredFlags`.
     */
    #uploadDeferredFlags() {
        this.#deferredSetFlagsActive = false;
        if (!this.#deferredSetFlagsDirty) {
            return;
        }
        this.#deferredSetFlagsDirty = false;
        const gl = this.model.scene.canvas.gl;
        const textureState = this.#dtxState;
        gl.bindTexture(gl.TEXTURE_2D, textureState.perSubMeshAttributesDataTexture._texture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            0, // xoffset
            0, // yoffset
            textureState.perSubMeshAttributesDataTexture._textureWidth, // width
            textureState.perSubMeshAttributesDataTexture._textureHeight, // width
            gl.RGBA_INTEGER,
            gl.UNSIGNED_BYTE,
            textureState.perSubMeshAttributesDataTexture._textureData
        );
        // gl.bindTexture(gl.TEXTURE_2D, textureState.perSubMeshInstancingMatricesDataTexture._texture);
        // gl.texSubImage2D(
        //     gl.TEXTURE_2D,
        //     0, // level
        //     0, // xoffset
        //     0, // yoffset
        //     textureState.perSubMeshInstancingMatricesDataTexture._textureWidth, // width
        //     textureState.perSubMeshInstancingMatricesDataTexture._textureHeight, // width
        //     gl.RGB,
        //     gl.FLOAT,
        //     textureState.perSubMeshInstancingMatricesDataTexture._textureData
        // );
    }

    setCulled(portionId: number, flags: number, transparent) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SCENE_OBJECT_FLAGS.CULLED) {
            this.#numCulledLayerPortions += this.#portionToSubPortionsMap[portionId].length;
            this.model.numCulledLayerPortions++;
        } else {
            this.#numCulledLayerPortions -= this.#portionToSubPortionsMap[portionId].length;
            this.model.numCulledLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setCollidable(portionId: number, flags: number) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
    }

    setPickable(portionId: number, flags: number, transparent) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SCENE_OBJECT_FLAGS.PICKABLE) {
            this.#numPickableLayerPortions++;
            this.model.numPickableLayerPortions++;
        } else {
            this.#numPickableLayerPortions--;
            this.model.numPickableLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setColor(portionId: number, color) {
        const subPortionIds = this.#portionToSubPortionsMap[portionId];
        for (let i = 0, len = subPortionIds.length; i < len; i++) {
            this.#subPortionSetColor(subPortionIds[i], color);
        }
    }

    #subPortionSetColor(subPortionId: number, color) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        // Color
        const textureState = this.#dtxState;
        const gl = this.model.scene.canvas.gl;
        tempUint8Array4 [0] = color[0];
        tempUint8Array4 [1] = color[1];
        tempUint8Array4 [2] = color[2];
        tempUint8Array4 [3] = color[3];
        // object colors
        textureState.perSubMeshAttributesDataTexture._textureData.set(tempUint8Array4, subPortionId * 32);
        if (this.#deferredSetFlagsActive) {
            console.info("_subPortionSetColor defer");
            this.#deferredSetFlagsDirty = true;
            return;
        }
        if (++this.#numUpdatesInFrame >= MAX_OBJECT_UPDATES_IN_FRAME_WITHOUT_BATCHED_UPDATE) {
            this.#beginDeferredFlags(); // Subsequent flags updates now deferred
        }
        console.info("_subPortionSetColor write through");
        gl.bindTexture(gl.TEXTURE_2D, textureState.perSubMeshAttributesDataTexture._texture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            (subPortionId % 512) * 8, // xoffset
            Math.floor(subPortionId / 512), // yoffset
            1, // width
            1, //height
            gl.RGBA_INTEGER,
            gl.UNSIGNED_BYTE,
            tempUint8Array4
        );
        // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    setTransparent(portionId: number, flags: number, transparent) {
        if (transparent) {
            this.#numTransparentLayerPortions++;
            this.model.numTransparentLayerPortions++;
        } else {
            this.#numTransparentLayerPortions--;
            this.model.numTransparentLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    #setFlags(portionId: number, flags: number, transparent, deferred = false) {
        const subPortionIds = this.#portionToSubPortionsMap[portionId];
        for (let i = 0, len = subPortionIds.length; i < len; i++) {
            this.#subPortionSetFlags(subPortionIds[i], flags, transparent, deferred);
        }
    }

    #subPortionSetFlags(subPortionId, flags: number, transparent, deferred = false) {
        if (!this.#finalized) {
            throw "Not finalized";
        }

        const visible = !!(flags & SCENE_OBJECT_FLAGS.VISIBLE);
        const xrayed = !!(flags & SCENE_OBJECT_FLAGS.XRAYED);
        const highlighted = !!(flags & SCENE_OBJECT_FLAGS.HIGHLIGHTED);
        const selected = !!(flags & SCENE_OBJECT_FLAGS.SELECTED);
        const edges = !!(flags & SCENE_OBJECT_FLAGS.EDGES);
        const pickable = !!(flags & SCENE_OBJECT_FLAGS.PICKABLE);
        const culled = !!(flags & SCENE_OBJECT_FLAGS.CULLED);

        // Color

        let f0;
        if (!visible || culled || xrayed) { // Highlight & select are layered on top of color - not mutually exclusive
            f0 = RENDER_PASSES.NOT_RENDERED;
        } else {
            if (transparent) {
                f0 = RENDER_PASSES.COLOR_TRANSPARENT;
            } else {
                f0 = RENDER_PASSES.COLOR_OPAQUE;
            }
        }

        // Silhouette

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
            if (transparent) {
                f2 = RENDER_PASSES.EDGES_COLOR_TRANSPARENT;
            } else {
                f2 = RENDER_PASSES.EDGES_COLOR_OPAQUE;
            }
        } else {
            f2 = RENDER_PASSES.NOT_RENDERED;
        }

        // Pick

        let f3 = (visible && (!culled) && pickable) ? RENDER_PASSES.PICK : RENDER_PASSES.NOT_RENDERED;
        const textureState = this.#dtxState;
        const gl = this.model.scene.canvas.gl;
        tempUint8Array4 [0] = f0;
        tempUint8Array4 [1] = f1;
        tempUint8Array4 [2] = f2;
        tempUint8Array4 [3] = f3;
        // object flags
        textureState.perSubMeshAttributesDataTexture._textureData.set(tempUint8Array4, subPortionId * 32 + 8);
        if (this.#deferredSetFlagsActive || deferred) {
            this.#deferredSetFlagsDirty = true;
            return;
        }
        if (++this.#numUpdatesInFrame >= MAX_OBJECT_UPDATES_IN_FRAME_WITHOUT_BATCHED_UPDATE) {
            this.#beginDeferredFlags(); // Subsequent flags updates now deferred
        }
        gl.bindTexture(gl.TEXTURE_2D, textureState.perSubMeshAttributesDataTexture._texture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            (subPortionId % 512) * 8 + 2, // xoffset
            Math.floor(subPortionId / 512), // yoffset
            1, // width
            1, //height
            gl.RGBA_INTEGER,
            gl.UNSIGNED_BYTE,
            tempUint8Array4
        );
        // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    #setDeferredFlags() {
    }

    #setFlags2(portionId: number, flags: number, deferred = false) {
        const subPortionIds = this.#portionToSubPortionsMap[portionId];
        for (let i = 0, len = subPortionIds.length; i < len; i++) {
            this.#subPortionSetFlags2(subPortionIds[i], flags, deferred);
        }
    }

    #subPortionSetFlags2(subPortionId: number, flags: number, deferred = false) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        const clippable = !!(flags & SCENE_OBJECT_FLAGS.CLIPPABLE) ? 255 : 0;
        const textureState = this.#dtxState;
        const gl = this.model.scene.canvas.gl;
        tempUint8Array4 [0] = clippable;
        tempUint8Array4 [1] = 0;
        tempUint8Array4 [2] = 1;
        tempUint8Array4 [3] = 2;
        // object flags2
        textureState.perSubMeshAttributesDataTexture._textureData.set(tempUint8Array4, subPortionId * 32 + 12);
        if (this.#deferredSetFlagsActive || deferred) {
            // console.log("_subPortionSetFlags2 set flags defer");
            this.#deferredSetFlagsDirty = true;
            return;
        }
        if (++this.#numUpdatesInFrame >= MAX_OBJECT_UPDATES_IN_FRAME_WITHOUT_BATCHED_UPDATE) {
            this.#beginDeferredFlags(); // Subsequent flags updates now deferred
        }
        gl.bindTexture(gl.TEXTURE_2D, textureState.perSubMeshAttributesDataTexture._texture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            (subPortionId % 512) * 8 + 3, // xoffset
            Math.floor(subPortionId / 512), // yoffset
            1, // width
            1, //height
            gl.RGBA_INTEGER,
            gl.UNSIGNED_BYTE,
            tempUint8Array4
        );
        // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    #setDeferredFlags2() {
    }

    setOffset(portionId: number, offset) {
        const subPortionIds = this.#portionToSubPortionsMap[portionId];
        for (let i = 0, len = subPortionIds.length; i < len; i++) {
            this.#subPortionSetOffset(subPortionIds[i], offset);
        }
    }

    #subPortionSetOffset(subPortionId: number, offset) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        // if (!this.model.scene.entityOffsetsEnabled) {
        //     this.model.error("Entity#offset not enabled for this Viewer"); // See Viewer entityOffsetsEnabled
        //     return;
        // }
        const textureState = this.#dtxState;
        const gl = this.model.scene.canvas.gl;
        tempFloat32Array3 [0] = offset[0];
        tempFloat32Array3 [1] = offset[1];
        tempFloat32Array3 [2] = offset[2];
        // object offset
        textureState.texturePerObjectOffsets._textureData.set(tempFloat32Array3, subPortionId * 3);
        if (this.#deferredSetFlagsActive) {
            this.#deferredSetFlagsDirty = true;
            return;
        }
        if (++this.#numUpdatesInFrame >= MAX_OBJECT_UPDATES_IN_FRAME_WITHOUT_BATCHED_UPDATE) {
            this.#beginDeferredFlags(); // Subsequent flags updates now deferred
        }
        gl.bindTexture(gl.TEXTURE_2D, textureState.texturePerObjectOffsets._texture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            0, // x offset
            subPortionId, // yoffset
            1, // width
            1, // height
            gl.RGB,
            gl.FLOAT,
            tempFloat32Array3
        );
        // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    setMatrix(portionId: number, matrix) {
        const subPortionIds = this.#portionToSubPortionsMap[portionId];
        for (let i = 0, len = subPortionIds.length; i < len; i++) {
            this.#subPortionSetMatrix(subPortionIds[i], matrix);
        }
    }

    #subPortionSetMatrix(subPortionId: number, matrix) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        // if (!this.model.scene.entityMatrixsEnabled) {
        //     this.model.error("Entity#matrix not enabled for this Viewer"); // See Viewer entityMatrixsEnabled
        //     return;
        // }
        const textureState = this.#dtxState;
        const gl = this.model.scene.canvas.gl;
        tempMat4a.set(matrix);
        textureState.perSubMeshInstancingMatricesDataTexture._textureData.set(tempMat4a, subPortionId * 16);
        if (this.#deferredSetFlagsActive) {
            this.#deferredSetFlagsDirty = true;
            return;
        }
        if (++this.#numUpdatesInFrame >= MAX_OBJECT_UPDATES_IN_FRAME_WITHOUT_BATCHED_UPDATE) {
            this.#beginDeferredFlags(); // Subsequent flags updates now deferred
        }
        gl.bindTexture(gl.TEXTURE_2D, textureState.perSubMeshInstancingMatricesDataTexture._texture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            (subPortionId % 512) * 4, // xoffset
            Math.floor(subPortionId / 512), // yoffset
            // 1,
            4, // width
            1, // height
            gl.RGBA,
            gl.FLOAT,
            tempMat4a
        );
        // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    // ---------------------- COLOR RENDERING -----------------------------------

    drawColorOpaque(renderFlags: RenderFlags, frameCtx: RenderContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numTransparentLayerPortions === this.#numPortions || this.#numXRayedLayerPortions === this.#numPortions) {
            return;
        }
        this.#updateBackfaceCull(renderFlags, frameCtx);
        if (frameCtx.withSAO && this.model.saoEnabled) {
            if (this.#renderers.colorRendererWithSAO) {
                this.#renderers.colorRendererWithSAO.drawLayer(frameCtx, this, RENDER_PASSES.COLOR_OPAQUE);
            }
        } else {
            if (this.#renderers.colorRenderer) {
                this.#renderers.colorRenderer.drawLayer(frameCtx, this, RENDER_PASSES.COLOR_OPAQUE);
            }
        }
    }

    #updateBackfaceCull(renderFlags: RenderFlags, frameCtx: RenderContext): void {
        const backfaces = this.model.backfaces || renderFlags.sectioned;
        if (frameCtx.backfaces !== backfaces) {
            const gl = frameCtx.gl;
            if (backfaces) {
                gl.disable(gl.CULL_FACE);
            } else {
                gl.enable(gl.CULL_FACE);
            }
            frameCtx.backfaces = backfaces;
        }
    }

    drawColorTransparent(renderFlags: RenderFlags, frameCtx: RenderContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numTransparentLayerPortions === 0 || this.#numXRayedLayerPortions === this.#numPortions) {
            return;
        }
        this.#updateBackfaceCull(renderFlags, frameCtx);
        if (this.#renderers.colorRenderer) {
            this.#renderers.colorRenderer.drawLayer(frameCtx, this, RENDER_PASSES.COLOR_TRANSPARENT);
        }
    }

    // ---------------------- RENDERING SAO POST EFFECT TARGETS --------------

    drawDepth(renderFlags: RenderFlags, frameCtx: RenderContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numTransparentLayerPortions === this.#numPortions || this.#numXRayedLayerPortions === this.#numPortions) {
            return;
        }
        this.#updateBackfaceCull(renderFlags, frameCtx);
        if (this.#renderers.depthRenderer) {
            this.#renderers.depthRenderer.drawLayer(frameCtx, this, RENDER_PASSES.COLOR_OPAQUE); // Assume whatever post-effect uses depth (eg SAO) does not apply to transparent objects
        }
    }

    drawNormals(renderFlags: RenderFlags, frameCtx: RenderContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numTransparentLayerPortions === this.#numPortions || this.#numXRayedLayerPortions === this.#numPortions) {
            return;
        }
        this.#updateBackfaceCull(renderFlags, frameCtx);
        if (this.#renderers.normalsRenderer) {
            this.#renderers.normalsRenderer.drawLayer(frameCtx, this, RENDER_PASSES.COLOR_OPAQUE);  // Assume whatever post-effect uses normals (eg SAO) does not apply to transparent objects
        }
    }

    // ---------------------- SILHOUETTE RENDERING -----------------------------------

    drawSilhouetteXRayed(renderFlags: RenderFlags, frameCtx: RenderContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numXRayedLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(renderFlags, frameCtx);
        if (this.#renderers.silhouetteRenderer) {
            this.#renderers.silhouetteRenderer.drawLayer(frameCtx, this, RENDER_PASSES.SILHOUETTE_XRAYED);
        }
    }

    drawSilhouetteHighlighted(renderFlags: RenderFlags, frameCtx: RenderContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numHighlightedLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(renderFlags, frameCtx);
        if (this.#renderers.silhouetteRenderer) {
            this.#renderers.silhouetteRenderer.drawLayer(frameCtx, this, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED);
        }
    }

    drawSilhouetteSelected(renderFlags: RenderFlags, frameCtx: RenderContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numSelectedLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(renderFlags, frameCtx);
        if (this.#renderers.silhouetteRenderer) {
            this.#renderers.silhouetteRenderer.drawLayer(frameCtx, this, RENDER_PASSES.SILHOUETTE_SELECTED);
        }
    }

    // ---------------------- EDGES RENDERING -----------------------------------

    drawEdgesColorOpaque(renderFlags: RenderFlags, frameCtx: RenderContext): void {
        if (this.model.scene.logarithmicDepthBufferEnabled) {
            if (!this.model.scene._loggedWarning) {
                console.log("Edge enhancement for SceneModel data texture layers currently disabled with logarithmic depth buffer");
                this.model.scene._loggedWarning = true;
            }
            return;
        }
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numEdgesLayerPortions === 0) {
            return;
        }
        if (this.#renderers.edgesColorRenderer) {
            this.#renderers.edgesColorRenderer.drawLayer(frameCtx, this, RENDER_PASSES.EDGES_COLOR_OPAQUE);
        }
    }

    drawEdgesColorTransparent(renderFlags: RenderFlags, frameCtx: RenderContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numEdgesLayerPortions === 0 || this.#numTransparentLayerPortions === 0) {
            return;
        }
        if (this.#renderers.edgesColorRenderer) {
            this.#renderers.edgesColorRenderer.drawLayer(frameCtx, this, RENDER_PASSES.EDGES_COLOR_TRANSPARENT);
        }
    }

    drawEdgesHighlighted(renderFlags: RenderFlags, frameCtx: RenderContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numHighlightedLayerPortions === 0) {
            return;
        }
        if (this.#renderers.edgesRenderer) {
            this.#renderers.edgesRenderer.drawLayer(frameCtx, this, RENDER_PASSES.EDGES_HIGHLIGHTED);
        }
    }

    drawEdgesSelected(renderFlags: RenderFlags, frameCtx: RenderContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numSelectedLayerPortions === 0) {
            return;
        }
        if (this.#renderers.edgesRenderer) {
            this.#renderers.edgesRenderer.drawLayer(frameCtx, this, RENDER_PASSES.EDGES_SELECTED);
        }
    }

    drawEdgesXRayed(renderFlags: RenderFlags, frameCtx: RenderContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numXRayedLayerPortions === 0) {
            return;
        }
        if (this.#renderers.edgesRenderer) {
            this.#renderers.edgesRenderer.drawLayer(frameCtx, this, RENDER_PASSES.EDGES_XRAYED);
        }
    }

    // ---------------------- OCCLUSION CULL RENDERING -----------------------------------

    drawOcclusion(renderFlags: RenderFlags, frameCtx: RenderContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(renderFlags, frameCtx);
        if (this.#renderers.occlusionRenderer) {
            this.#renderers.occlusionRenderer.drawLayer(frameCtx, this, RENDER_PASSES.COLOR_OPAQUE);
        }
    }

    // ---------------------- SHADOW BUFFER RENDERING -----------------------------------

    drawShadow(renderFlags: RenderFlags, frameCtx: RenderContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(renderFlags, frameCtx);
        if (this.#renderers.shadowRenderer) {
            this.#renderers.shadowRenderer.drawLayer(frameCtx, this, RENDER_PASSES.COLOR_OPAQUE);
        }
    }

    //---- PICKING ----------------------------------------------------------------------------------------------------

    setPickMatrices(pickViewMatrix, pickProjMatrix) {
        // if (this.#numVisibleLayerPortions === 0) {
        //     return;
        // }
        // this.#dtxState.texturePickCameraMatrices.updateViewMatrix(pickViewMatrix, pickProjMatrix);
    }

    drawPickMesh(renderFlags: RenderFlags, frameCtx: RenderContext): void {
        if (this.#numVisibleLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(renderFlags, frameCtx);
        if (this.#renderers.pickMeshRenderer) {
            this.#renderers.pickMeshRenderer.drawLayer(frameCtx, this, RENDER_PASSES.PICK);
        }
    }

    drawPickDepths(renderFlags: RenderFlags, frameCtx: RenderContext): void {
        if (this.#numVisibleLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(renderFlags, frameCtx);
        if (this.#renderers.pickDepthRenderer) {
            this.#renderers.pickDepthRenderer.drawLayer(frameCtx, this, RENDER_PASSES.PICK);
        }
    }

    drawSnapInit(renderFlags: RenderFlags, frameCtx: RenderContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(renderFlags, frameCtx);
        if (this.#renderers.snapInitRenderer) {
            this.#renderers.snapInitRenderer.drawLayer(frameCtx, this, RENDER_PASSES.PICK);
        }
    }

    drawSnap(renderFlags: RenderFlags, frameCtx: RenderContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(renderFlags, frameCtx);
        if (this.#renderers.snapRenderer) {
            this.#renderers.snapRenderer.drawLayer(frameCtx, this, RENDER_PASSES.PICK);
        }
    }

    drawPickNormals(renderFlags: RenderFlags, frameCtx) {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(renderFlags, frameCtx);
        if (this.#renderers.pickNormalsRenderer) {
            this.#renderers.pickNormalsRenderer.drawLayer(frameCtx, this, RENDER_PASSES.PICK);
        }
    }

    destroy() {
        if (this.#destroyed) {
            return;
        }
        const state = this.#state;
        if (state.metallicRoughnessBuf) {
            state.metallicRoughnessBuf.destroy();
            state.metallicRoughnessBuf = null;
        }
        this.model.scene.off(this.#onSceneRendering);
        state.destroy();
        this.#destroyed = true;
    }
}
