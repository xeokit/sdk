import {createVec3, createVec4, identityMat4} from "@xeokit/matrix";
import type {TickParams, View} from "@xeokit/viewer";
import {Viewer} from "@xeokit/viewer";
import type {FloatArrayParam} from "@xeokit/math";

import type {WebGLRendererModel} from "../WebGLRendererModel";
import {TrianglesDataTextureSet} from "./TrianglesDataTextureSet";
import {MeshCounts} from "../common/MeshCounts";
import {SCENE_OBJECT_FLAGS} from '../common/SCENE_OBJECT_FLAGS';
import {RENDER_PASSES} from '../common/RENDER_PASSES';
import {SolidPrimitive} from "@xeokit/constants";
import {collapseAABB3, expandAABB3} from "@xeokit/boundaries";
import type {SceneGeometry, SceneGeometryBucket, SceneMesh} from "@xeokit/scene";
import type {LayerParams} from "../common/LayerParams";
import type {TrianglesLayerGeometryBucket} from "./TrianglesLayerGeometryBucket";
import {TrianglesDataTextureBuffer} from "./TrianglesDataTextureBuffer";
import {TrianglesLayerRenderState} from "./TrianglesLayerRenderState";
import {LayerMeshParams} from "../common/LayerMeshParams";
import {RendererLayer} from "../common/RendererLayer";

const tempMat4a = <Float64Array>identityMat4();
const tempUint8Array4 = new Uint8Array(4);


/**
 * 12-bits allowed for object ids.
 * Limits the per-mesh texture height in the layer.
 */
const MAX_MESHES_IN_LAYER = (1 << 16);

/**
 * 4096 is max data texture height.
 * Limits the aggregated geometry texture height in the layer.
 */
const MAX_DATA_TEXTURE_HEIGHT = 1 << 16;

/**
 * Align `indices` and `edgeIndices` memory layout to 8 elements.
 *
 * Used as an optimization for the `...portionIds...` texture, so it
 * can just be stored 1 out of 8 `portionIds` corresponding to a given
 * `triangle-index` or `edge-index`.
 */
const INDICES_EDGE_INDICES_ALIGNEMENT_SIZE = 8;

/**
 * Number of maximum allowed per-mesh flags update per render frame
 * before switching to batch update mode.
 */
const MAX_MESH_UPDATES_PER_FRAME_WITHOUT_BATCHED_UPDATE = 10;

let numLayers = 0;

const DEFAULT_MATRIX = identityMat4();

/**
 * @private
 */
export class TrianglesRendererLayer implements RendererLayer {

    rendererModel: WebGLRendererModel;
    layerIndex: number;
    meshCounts: MeshCounts;
    renderState: TrianglesLayerRenderState;
    sortId: string;

    #gl: WebGL2RenderingContext;
    #view: View;
    #trianglesDataTextureBuffer: TrianglesDataTextureBuffer;
    #geometryHandles: { [key: string]: any };
    #deferredSetFlagsActive: boolean;
    #deferredSetFlagsDirty: boolean;
    #built: boolean;

    #aabb: FloatArrayParam;
    aabbDirty: boolean;
    #meshes: any[];
    layerGeometryBuckets: {};
    #meshToSubMeshLookup: any[];
    #subMeshs: any[];
    #numSubMeshes: number;
    #layerNumber: number;
    #numUpdatesInFrame: number;

    #onViewerTick: () => void;

    constructor(layerParams: LayerParams, renderers?: any) {

        this.rendererModel = layerParams.rendererModel;
        this.layerIndex = layerParams.layerIndex;
        this.sortId = `tris-dtx-${this.#layerNumber}-${layerParams.primitive}`;
        this.meshCounts = new MeshCounts();

        this.#layerNumber = numLayers++;
        this.#gl = layerParams.gl;
        this.#view = layerParams.view;
        this.#trianglesDataTextureBuffer = new TrianglesDataTextureBuffer();

        this.#built = false;
        this.#numUpdatesInFrame = 0;

        this.#meshes = [];
        this.#subMeshs = [];
        this.#numSubMeshes = 0;
        this.#meshToSubMeshLookup = [];
        this.#geometryHandles = {};
        this.layerGeometryBuckets = {};

        this.#aabb = collapseAABB3();
        this.aabbDirty = true;

        this.renderState = <TrianglesLayerRenderState>{
            origin: createVec3(layerParams.origin),
            primitive: layerParams.primitive,
            dataTextureSet: null, // Created in #build
            numIndices8Bits: 0, // These counts are used by GL draw calls
            numIndices16Bits: 0,
            numIndices32Bits: 0,
            numEdgeIndices8Bits: 0,
            numEdgeIndices16Bits: 0,
            numEdgeIndices32Bits: 0,
            numVertices: 0
        };

        this.#beginDeferredFlags(); // For faster initialization
    }

    get hash() {
        return `tris-dtx-layer-${this.renderState.primitive}`;
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
            throw "Already built";
        }
        const numNewSubMeshes = sceneGeometry.geometryBuckets.length;
        let canCreate = (this.#numSubMeshes + numNewSubMeshes) <= MAX_MESHES_IN_LAYER;
        const bucketIndex = 0; // TODO: Is this a bug?
        const bucketGeometryId = sceneGeometry.id !== undefined && sceneGeometry.id !== null
            ? `${sceneGeometry.id}#${bucketIndex}`
            : `${sceneGeometry.id}#${bucketIndex}`;
        const alreadyHasPortionGeometry = this.layerGeometryBuckets[bucketGeometryId];
        if (!alreadyHasPortionGeometry) {
            const maxIndicesOfAnyBits = Math.max(this.renderState.numIndices8Bits, this.renderState.numIndices16Bits, this.renderState.numIndices32Bits);
            let numVertices = 0;
            let numIndices = 0;
            sceneGeometry.geometryBuckets.forEach(bucket => {
                numVertices += bucket.positionsCompressed.length / 3;
                numIndices += bucket.indices.length / 3;
            });
            canCreate &&=
                (this.renderState.numVertices + numVertices) <= MAX_DATA_TEXTURE_HEIGHT * 4096 &&
                (maxIndicesOfAnyBits + numIndices) <= MAX_DATA_TEXTURE_HEIGHT * 4096;
        }
        return canCreate;
    }

    createLayerMesh(layerMeshParams: LayerMeshParams, sceneMesh: SceneMesh): number {
        if (this.#built) {
            throw "Already built";
        }
        const subMeshIndices = [];
        const sceneGeometry = sceneMesh.geometry;
        sceneGeometry.geometryBuckets.forEach((sceneGeometryBucket, bucketIndex) => {
            const bucketGeometryId = sceneGeometry.id !== undefined && sceneGeometry.id !== null
                ? `${sceneGeometry.id}#${bucketIndex}`
                : `${sceneGeometry.id}#${bucketIndex}`;
            let layerGeometryBucket = this.layerGeometryBuckets[bucketGeometryId];
            if (!layerGeometryBucket) {
                layerGeometryBucket = this.#createLayerGeometryBucket(sceneGeometryBucket);
                this.layerGeometryBuckets[bucketGeometryId] = layerGeometryBucket;
            }
            const subMeshIndex = this.#createLayerSubMesh(layerMeshParams, sceneMesh, sceneGeometry, layerGeometryBucket);
            subMeshIndices.push(subMeshIndex);
        });
        const meshIndex = this.#meshToSubMeshLookup.length;
        this.#meshToSubMeshLookup.push(subMeshIndices);
        this.#meshes.push(sceneMesh);
        return meshIndex;
    }

    #createLayerGeometryBucket(sceneGeometryBucket: SceneGeometryBucket): TrianglesLayerGeometryBucket {

        if (sceneGeometryBucket.indices) {
            const alignedIndicesLen = Math.ceil((sceneGeometryBucket.indices.length / 3) / INDICES_EDGE_INDICES_ALIGNEMENT_SIZE) * INDICES_EDGE_INDICES_ALIGNEMENT_SIZE * 3;
            const alignedIndices = new Uint32Array(alignedIndicesLen);
            alignedIndices.fill(0);
            alignedIndices.set(sceneGeometryBucket.indices);
            sceneGeometryBucket.indices = alignedIndices;
        }

        if (sceneGeometryBucket.edgeIndices) {
            const alignedEdgeIndicesLen = Math.ceil((sceneGeometryBucket.edgeIndices.length / 2) / INDICES_EDGE_INDICES_ALIGNEMENT_SIZE) * INDICES_EDGE_INDICES_ALIGNEMENT_SIZE * 2;
            const alignedEdgeIndices = new Uint32Array(alignedEdgeIndicesLen);
            alignedEdgeIndices.fill(0);
            alignedEdgeIndices.set(sceneGeometryBucket.edgeIndices);
            sceneGeometryBucket.edgeIndices = alignedEdgeIndices;
        }

        const positionsCompressed = sceneGeometryBucket.positionsCompressed;
        const indices = sceneGeometryBucket.indices;
        const edgeIndices = sceneGeometryBucket.edgeIndices;
        const trianglesDataTextureBuffer = this.#trianglesDataTextureBuffer;

        trianglesDataTextureBuffer.positionsCompressed.push(positionsCompressed)
        const vertexBase = trianglesDataTextureBuffer.lenPositionsCompressed / 3;
        const numVertices = positionsCompressed.length / 3;
        trianglesDataTextureBuffer.lenPositionsCompressed += positionsCompressed.length;

        let indicesBase;
        let numTriangles = 0;
        if (indices) {
            numTriangles = indices.length / 3;
            let indicesBuffer;
            if (numVertices <= (1 << 8)) {
                indicesBuffer = trianglesDataTextureBuffer.indices8Bits;
                indicesBase = trianglesDataTextureBuffer.lenIndices8Bits / 3;
                trianglesDataTextureBuffer.lenIndices8Bits += indices.length;
            } else if (numVertices <= (1 << 16)) {
                indicesBuffer = trianglesDataTextureBuffer.indices16Bits;
                indicesBase = trianglesDataTextureBuffer.lenIndices16Bits / 3;
                trianglesDataTextureBuffer.lenIndices16Bits += indices.length;
            } else {
                indicesBuffer = trianglesDataTextureBuffer.indices32Bits;
                indicesBase = trianglesDataTextureBuffer.lenIndices32Bits / 3;
                trianglesDataTextureBuffer.lenIndices32Bits += indices.length;
            }
            indicesBuffer.push(indices);
        }

        let edgeIndicesBase;
        let numEdges = 0;
        if (edgeIndices) {
            numEdges = edgeIndices.length / 2;
            let edgeIndicesBuffer;
            if (numVertices <= (1 << 8)) {
                edgeIndicesBuffer = trianglesDataTextureBuffer.edgeIndices8Bits;
                edgeIndicesBase = trianglesDataTextureBuffer.lenEdgeIndices8Bits / 2;
                trianglesDataTextureBuffer.lenEdgeIndices8Bits += edgeIndices.length;
            } else if (numVertices <= (1 << 16)) {
                edgeIndicesBuffer = trianglesDataTextureBuffer.edgeIndices16Bits;
                edgeIndicesBase = trianglesDataTextureBuffer.lenEdgeIndices16Bits / 2;
                trianglesDataTextureBuffer.lenEdgeIndices16Bits += edgeIndices.length;
            } else {
                edgeIndicesBuffer = trianglesDataTextureBuffer.edgeIndices32Bits;
                edgeIndicesBase = trianglesDataTextureBuffer.lenEdgeIndices32Bits / 2;
                trianglesDataTextureBuffer.lenEdgeIndices32Bits += edgeIndices.length;
            }
            edgeIndicesBuffer.push(edgeIndices);
        }

        this.renderState.numVertices += numVertices;

        return <TrianglesLayerGeometryBucket>{
            vertexBase,
            numVertices,
            numTriangles,
            numEdges,
            indicesBase,
            edgeIndicesBase
        };
    }

    #createLayerSubMesh(
        layerMeshParams: LayerMeshParams,
        sceneMesh: SceneMesh,
        sceneGeometry: SceneGeometry,
        trianglesGeometryBucketHandle: TrianglesLayerGeometryBucket): number {

        const color = sceneMesh.color;
        const metallic = sceneMesh.metallic;
        const roughness = sceneMesh.roughness;
        //const colors = sceneGeometry.colors;
        const colors = null;
        const opacity = sceneMesh.opacity;
        const meshMatrix = sceneMesh.matrix;
        const pickColor = layerMeshParams.pickColor;
        const trianglesDataTextureBuffer = this.#trianglesDataTextureBuffer;
        const renderState = this.renderState;

        trianglesDataTextureBuffer.perSubMeshDecodeMatrices.push(sceneGeometry.positionsDecompressMatrix);
        trianglesDataTextureBuffer.perSubMeshInstancingMatrices.push(meshMatrix || DEFAULT_MATRIX);
        trianglesDataTextureBuffer.perSubMeshSolidFlag.push(sceneGeometry.primitive === SolidPrimitive);

        if (colors) {
            trianglesDataTextureBuffer.perSubMeshColors.push([colors[0] * 255, colors[1] * 255, colors[2] * 255, 255]);
        } else if (color) { // Color is pre-quantized by SceneModel
            trianglesDataTextureBuffer.perSubMeshColors.push([color[0], color[1], color[2], opacity]);
        }

        trianglesDataTextureBuffer.perSubMeshPickColors.push(pickColor);
        trianglesDataTextureBuffer.perSubMeshVertexBases.push(trianglesGeometryBucketHandle.vertexBase);

        {
            let currentNumIndices;
            if (trianglesGeometryBucketHandle.numVertices <= (1 << 8)) {
                currentNumIndices = renderState.numIndices8Bits;
            } else if (trianglesGeometryBucketHandle.numVertices <= (1 << 16)) {
                currentNumIndices = renderState.numIndices16Bits;
            } else {
                currentNumIndices = renderState.numIndices32Bits;
            }
            trianglesDataTextureBuffer.perSubMeshIndicesBases.push(currentNumIndices / 3 - trianglesGeometryBucketHandle.indicesBase);
        }

        {
            let currentNumEdgeIndices;
            if (trianglesGeometryBucketHandle.numVertices <= (1 << 8)) {
                currentNumEdgeIndices = renderState.numEdgeIndices8Bits;
            } else if (trianglesGeometryBucketHandle.numVertices <= (1 << 16)) {
                currentNumEdgeIndices = renderState.numEdgeIndices16Bits;
            } else {
                currentNumEdgeIndices = renderState.numEdgeIndices32Bits;
            }
            trianglesDataTextureBuffer.perSubMeshEdgeIndicesBases.push(currentNumEdgeIndices / 2 - trianglesGeometryBucketHandle.edgeIndicesBase);
        }

        const subMeshIndex = this.#subMeshs.length;
        if (trianglesGeometryBucketHandle.numTriangles > 0) {
            let numIndices = trianglesGeometryBucketHandle.numTriangles * 3;
            let indicesPortionIdBuffer;
            if (trianglesGeometryBucketHandle.numVertices <= (1 << 8)) {
                indicesPortionIdBuffer = trianglesDataTextureBuffer.perTriangleSubMesh8Bits;
                renderState.numIndices8Bits += numIndices;
            } else if (trianglesGeometryBucketHandle.numVertices <= (1 << 16)) {
                indicesPortionIdBuffer = trianglesDataTextureBuffer.perTriangleSubMesh16Bits;
                renderState.numIndices16Bits += numIndices;
            } else {
                indicesPortionIdBuffer = trianglesDataTextureBuffer.perTriangleSubMesh32Bits;
                renderState.numIndices32Bits += numIndices;
            }
            for (let i = 0; i < trianglesGeometryBucketHandle.numTriangles; i += INDICES_EDGE_INDICES_ALIGNEMENT_SIZE) {
                indicesPortionIdBuffer.push(subMeshIndex);
            }
        }

        if (trianglesGeometryBucketHandle.numEdges > 0) {
            let numEdgeIndices = trianglesGeometryBucketHandle.numEdges * 2;
            let edgeIndicesPortionIdBuffer;
            if (trianglesGeometryBucketHandle.numVertices <= (1 << 8)) {
                edgeIndicesPortionIdBuffer = trianglesDataTextureBuffer.perEdgeSubMesh8Bits;
                renderState.numEdgeIndices8Bits += numEdgeIndices;
            } else if (trianglesGeometryBucketHandle.numVertices <= (1 << 16)) {
                edgeIndicesPortionIdBuffer = trianglesDataTextureBuffer.perEdgeSubMesh16Bits;
                renderState.numEdgeIndices16Bits += numEdgeIndices;
            } else {
                edgeIndicesPortionIdBuffer = trianglesDataTextureBuffer.perEdgeSubMesh32Bits;
                renderState.numEdgeIndices32Bits += numEdgeIndices;
            }
            for (let i = 0; i < trianglesGeometryBucketHandle.numEdges; i += INDICES_EDGE_INDICES_ALIGNEMENT_SIZE) {
                edgeIndicesPortionIdBuffer.push(subMeshIndex);
            }
        }

        //   trianglesDataTextureBuffer.perObjectOffsets.push([0, 0, 0]);

        this.#subMeshs.push({
            // vertsBase: vertsIndex,
            numVertices: trianglesGeometryBucketHandle.numTriangles
        });

        this.#numSubMeshes++;
        this.rendererModel.numSubMeshes++;

        return subMeshIndex;
    }

    build() {
        if (this.#built) {
            throw new Error("Already built");
        }
        this.renderState.dataTextureSet = new TrianglesDataTextureSet(this.#gl, this.#trianglesDataTextureBuffer);
        this.#deferredSetFlagsDirty = false; //
        this.#onViewerTick = this.rendererModel.viewer.onTick.subscribe((viewer: Viewer, tickParams: TickParams) => {
            if (this.#deferredSetFlagsDirty) {
                this.#uploadDeferredFlags();
            }
            this.#numUpdatesInFrame = 0;
        });
        this.#trianglesDataTextureBuffer = null;
        this.#geometryHandles = {};
        this.layerGeometryBuckets = {};
        this.#built = true;
    }

    isEmpty() {
        return this.meshCounts.numMeshes == 0;
    }

    initFlags(meshIndex: number, flags: number, meshTransparent: boolean) {
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
        if (flags & SCENE_OBJECT_FLAGS.EDGES) {
            this.meshCounts.numEdges++;
            this.rendererModel.meshCounts.numEdges++;
        }
        if (flags & SCENE_OBJECT_FLAGS.PICKABLE) {
            this.meshCounts.numPickable++;
            this.rendererModel.meshCounts.numPickable++;
        }
        if (flags & SCENE_OBJECT_FLAGS.CULLED) {
            this.meshCounts.numCulled++;
            this.rendererModel.meshCounts.numCulled++;
        }
        if (meshTransparent) {
            this.meshCounts.numTransparent++;
            this.rendererModel.meshCounts.numTransparent++;
        }
        const deferred = true;
        this.#setMeshFlags(meshIndex, flags, meshTransparent, deferred);
        this.#setMeshFlags2(meshIndex, flags, deferred);
    }

    flushInitFlags() {
        this.#setDeferredFlags();
        this.#setDeferredFlags2();
    }

    setLayerMeshVisible(meshIndex: number, flags: number, transparent: boolean) {
        if (this.#built) {
            throw new Error("Already built");
        }
        if (flags & SCENE_OBJECT_FLAGS.VISIBLE) {
            this.meshCounts.numVisible++;
            this.rendererModel.meshCounts.numVisible++;
        } else {
            this.meshCounts.numVisible--;
            this.rendererModel.meshCounts.numVisible--;
        }
        this.#setMeshFlags(meshIndex, flags, transparent);
    }

    setLayerMeshHighlighted(meshIndex: number, flags: number, transparent: boolean) {
        if (this.#built) {
            throw new Error("Already built");
        }
        if (flags & SCENE_OBJECT_FLAGS.HIGHLIGHTED) {
            this.meshCounts.numHighlighted++;
            this.rendererModel.meshCounts.numHighlighted++;
        } else {
            this.meshCounts.numHighlighted--;
            this.rendererModel.meshCounts.numHighlighted--;
        }
        this.#setMeshFlags(meshIndex, flags, transparent);
    }

    setLayerMeshXRayed(meshIndex: number, flags: number, transparent: boolean) {
        if (this.#built) {
            throw new Error("Already built");
        }
        if (flags & SCENE_OBJECT_FLAGS.XRAYED) {
            this.meshCounts.numXRayed++;
            this.rendererModel.meshCounts.numXRayed++;
        } else {
            this.meshCounts.numXRayed--;
            this.rendererModel.meshCounts.numXRayed--;
        }
        this.#setMeshFlags(meshIndex, flags, transparent);
    }

    setLayerMeshSelected(meshIndex: number, flags: number, transparent: boolean) {
        if (this.#built) {
            throw new Error("Already built");
        }
        if (flags & SCENE_OBJECT_FLAGS.SELECTED) {
            this.meshCounts.numSelected++;
            this.rendererModel.meshCounts.numSelected++;
        } else {
            this.meshCounts.numSelected--;
            this.rendererModel.meshCounts.numSelected--;
        }
        this.#setMeshFlags(meshIndex, flags, transparent);
    }

    setLayerMeshEdges(meshIndex: number, flags: number, transparent: boolean) {
        if (this.#built) {
            throw new Error("Already built");
        }
        if (flags & SCENE_OBJECT_FLAGS.EDGES) {
            this.meshCounts.numEdges++;
            this.rendererModel.meshCounts.numEdges++;
        } else {
            this.meshCounts.numEdges--;
            this.rendererModel.meshCounts.numEdges--;
        }
        this.#setMeshFlags(meshIndex, flags, transparent);
    }

    setLayerMeshClippable(meshIndex: number, flags: number) {
        if (this.#built) {
            throw new Error("Already built");
        }
        if (flags & SCENE_OBJECT_FLAGS.CLIPPABLE) {
            this.meshCounts.numClippable++;
            this.rendererModel.meshCounts.numClippable++;
        } else {
            this.meshCounts.numClippable--;
            this.rendererModel.meshCounts.numClippable--;
        }
        this.#setMeshFlags2(meshIndex, flags);
    }

    /**
     * This will _start_ a "set-flags transaction".
     *
     * After invoking this method, calling meshSetFlags/setMeshFlags2 will not update
     * the colors+flags texture but only store the new flags/flag2 in the
     * colors+flags texture data array.
     *
     * After invoking this method, and when all desired meshSetFlags/setMeshFlags2 have
     * been called on needed portions of the layer, invoke `#uploadDeferredFlags`
     * to actually upload the data array into the texture.
     *
     * In massive "set-flags" scenarios like VFC or LOD mechanisms, the combination of
     * `_beginDeferredFlags` + `#uploadDeferredFlags`brings a speed-up of
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
        const gl = this.#gl;
        const dataTextureSet = this.renderState.dataTextureSet;
        gl.bindTexture(gl.TEXTURE_2D, dataTextureSet.perSubMeshAttributesDataTexture.texture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            0, // xoffset
            0, // yoffset
            dataTextureSet.perSubMeshAttributesDataTexture.textureWidth, // width
            dataTextureSet.perSubMeshAttributesDataTexture.textureHeight, // width
            gl.RGBA_INTEGER,
            gl.UNSIGNED_BYTE,
            dataTextureSet.perSubMeshAttributesDataTexture.textureData
        );
        // gl.bindTexture(gl.TEXTURE_2D, dataTextureSet.perSubMeshInstancingMatricesDataTexture._texture);
        // gl.texSubImage2D(
        //     gl.TEXTURE_2D,
        //     0, // level
        //     0, // xoffset
        //     0, // yoffset
        //     dataTextureSet.perSubMeshInstancingMatricesDataTexture._textureWidth, // width
        //     dataTextureSet.perSubMeshInstancingMatricesDataTexture._textureHeight, // width
        //     gl.RGB,
        //     gl.FLOAT,
        //     dataTextureSet.perSubMeshInstancingMatricesDataTexture._textureData
        // );
    }

    setLayerMeshCulled(meshIndex: number, flags: number, transparent: boolean) {
        if (!this.#built) {
            throw "Not finalized";
        }
        if (flags & SCENE_OBJECT_FLAGS.CULLED) {
            this.meshCounts.numCulled++;
            this.rendererModel.meshCounts.numCulled++;
        } else {
            this.meshCounts.numCulled--;
            this.rendererModel.meshCounts.numCulled--;
        }
        this.#setMeshFlags(meshIndex, flags, transparent);
    }

    setLayerMeshCollidable(meshIndex, flags) {
        if (!this.#built) {
            throw "Not finalized";
        }
    }

    setLayerMeshPickable(meshIndex: number, flags: number, transparent: boolean) {
        if (!this.#built) {
            throw "Not finalized";
        }
        if (flags & SCENE_OBJECT_FLAGS.PICKABLE) {
            this.meshCounts.numPickable++;
            this.rendererModel.meshCounts.numPickable++;
        } else {
            this.meshCounts.numPickable--;
            this.rendererModel.meshCounts.numPickable--;
        }
        this.#setMeshFlags(meshIndex, flags, transparent);
    }

    setLayerMeshColor(meshIndex: number, color: FloatArrayParam) {
        if (!this.#built) {
            throw "Not finalized";
        }
        const subMeshIndices = this.#meshToSubMeshLookup[meshIndex];
        for (let i = 0, len = subMeshIndices.length; i < len; i++) {
            this.#setSubMeshColor(subMeshIndices[i], color);
        }
    }

    #setSubMeshColor(subMeshIndex: number, color: FloatArrayParam) {
        const textureState = this.renderState.dataTextureSet;
        const gl = this.#gl;
        tempUint8Array4 [0] = color[0];
        tempUint8Array4 [1] = color[1];
        tempUint8Array4 [2] = color[2];
        tempUint8Array4 [3] = color[3];
        textureState.perSubMeshAttributesDataTexture.textureData.set(tempUint8Array4, subMeshIndex * 32);
        if (this.#deferredSetFlagsActive) {
            console.info("_setSubMeshColor defer");
            this.#deferredSetFlagsDirty = true;
            return;
        }
        if (++this.#numUpdatesInFrame >= MAX_MESH_UPDATES_PER_FRAME_WITHOUT_BATCHED_UPDATE) {
            this.#beginDeferredFlags(); // Subsequent flags updates now deferred
        }
        console.info("_setSubMeshColor write through");
        gl.bindTexture(gl.TEXTURE_2D, textureState.perSubMeshAttributesDataTexture.texture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            (subMeshIndex % 512) * 8, // xoffset
            Math.floor(subMeshIndex / 512), // yoffset
            1, // width
            1, //height
            gl.RGBA_INTEGER,
            gl.UNSIGNED_BYTE,
            tempUint8Array4
        );
        // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    setLayerMeshTransparent(meshIndex: number, flags: number, transparent: boolean) {
        if (!this.#built) {
            throw "Not finalized";
        }
        if (transparent) {
            this.meshCounts.numTransparent++;
            this.rendererModel.meshCounts.numTransparent++;
        } else {
            this.meshCounts.numTransparent--;
            this.rendererModel.meshCounts.numTransparent--;
        }
        this.#setMeshFlags(meshIndex, flags, transparent);
    }

    #setMeshFlags(meshIndex: number, flags: number, transparent: boolean, deferred: boolean = false) {
        const subMeshIndices = this.#meshToSubMeshLookup[meshIndex];
        for (let i = 0, len = subMeshIndices.length; i < len; i++) {
            this.#setSubMeshFlags(subMeshIndices[i], flags, transparent, deferred);
        }
    }

    #setSubMeshFlags(subMeshIndex: number, flags: number, transparent: boolean, deferred: boolean = false) {

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
        const dataTextureSet = this.renderState.dataTextureSet;
        const gl = this.#gl;
        tempUint8Array4 [0] = f0;
        tempUint8Array4 [1] = f1;
        tempUint8Array4 [2] = f2;
        tempUint8Array4 [3] = f3;
        // sceneMesh flags
        dataTextureSet.perSubMeshAttributesDataTexture.textureData.set(tempUint8Array4, subMeshIndex * 32 + 8);
        if (this.#deferredSetFlagsActive || deferred) {
            this.#deferredSetFlagsDirty = true;
            return;
        }
        if (++this.#numUpdatesInFrame >= MAX_MESH_UPDATES_PER_FRAME_WITHOUT_BATCHED_UPDATE) {
            this.#beginDeferredFlags(); // Subsequent flags updates now deferred
        }
        gl.bindTexture(gl.TEXTURE_2D, dataTextureSet.perSubMeshAttributesDataTexture.texture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            (subMeshIndex % 512) * 8 + 2, // xoffset
            Math.floor(subMeshIndex / 512), // yoffset
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

    #setMeshFlags2(meshIndex: number, flags: number, deferred = false) {
        const subMeshIndices = this.#meshToSubMeshLookup[meshIndex];
        for (let i = 0, len = subMeshIndices.length; i < len; i++) {
            this.#setSubMeshFlags2(subMeshIndices[i], flags, deferred);
        }
    }

    #setSubMeshFlags2(subMeshIndex: number, flags: number, deferred = false) {
        if (!this.#built) {
            throw "Not finalized";
        }
        const clippable = !!(flags & SCENE_OBJECT_FLAGS.CLIPPABLE) ? 255 : 0;
        const textureState = this.renderState.dataTextureSet;
        const gl = this.#gl;
        tempUint8Array4 [0] = clippable;
        tempUint8Array4 [1] = 0;
        tempUint8Array4 [2] = 1;
        tempUint8Array4 [3] = 2;
        // sceneMesh flags2
        textureState.perSubMeshAttributesDataTexture.textureData.set(tempUint8Array4, subMeshIndex * 32 + 12);
        if (this.#deferredSetFlagsActive || deferred) {
            // console.log("_setSubMeshFlags2 set flags defer");
            this.#deferredSetFlagsDirty = true;
            return;
        }
        if (++this.#numUpdatesInFrame >= MAX_MESH_UPDATES_PER_FRAME_WITHOUT_BATCHED_UPDATE) {
            this.#beginDeferredFlags(); // Subsequent flags updates now deferred
        }
        gl.bindTexture(gl.TEXTURE_2D, textureState.perSubMeshAttributesDataTexture.texture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            (subMeshIndex % 512) * 8 + 3, // xoffset
            Math.floor(subMeshIndex / 512), // yoffset
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

    setLayerMeshOffset(meshIndex: number, offset: FloatArrayParam) {
        if (!this.#built) {
            throw "Not finalized";
        }
        const subMeshIndices = this.#meshToSubMeshLookup[meshIndex];
        for (let i = 0, len = subMeshIndices.length; i < len; i++) {
            this.#subMeshSetOffset(subMeshIndices[i], offset);
        }
    }

    #subMeshSetOffset(subMeshIndex: number, offset: FloatArrayParam) {
        // if (!this.#built) {
        //     throw "Not finalized";
        // }
        // // if (!this.model.scene.entityOffsetsEnabled) {
        // //     this.model.error("Entity#offset not enabled for this Viewer"); // See Viewer entityOffsetsEnabled
        // //     return;
        // // }
        // const textureState = this.renderState.dataTextureSet;
        // const gl = this.#gl;
        // tempFloat32Array3 [0] = offset[0];
        // tempFloat32Array3 [1] = offset[1];
        // tempFloat32Array3 [2] = offset[2];
        // // sceneMesh offset
        // textureState.texturePerObjectOffsets._textureData.set(tempFloat32Array3, subMeshIndex * 3);
        // if (this.#deferredSetFlagsActive) {
        //     this.#deferredSetFlagsDirty = true;
        //     return;
        // }
        // if (++this.#numUpdatesInFrame >= MAX_MESH_UPDATES_PER_FRAME_WITHOUT_BATCHED_UPDATE) {
        //     this.#beginDeferredFlags(); // Subsequent flags updates now deferred
        // }
        // gl.bindTexture(gl.TEXTURE_2D, textureState.texturePerObjectOffsets._texture);
        // gl.texSubImage2D(
        //     gl.TEXTURE_2D,
        //     0, // level
        //     0, // x offset
        //     subMeshIndex, // yoffset
        //     1, // width
        //     1, // height
        //     gl.RGB,
        //     gl.FLOAT,
        //     tempFloat32Array3
        // );
        // // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    setLayerMeshMatrix(meshIndex: number, matrix: FloatArrayParam) {
        if (!this.#built) {
            throw "Not finalized";
        }
        const subMeshIndices = this.#meshToSubMeshLookup[meshIndex];
        for (let i = 0, len = subMeshIndices.length; i < len; i++) {
            this.#subMeshSetMatrix(subMeshIndices[i], matrix);
        }
    }

    #subMeshSetMatrix(subMeshIndex: number, matrix: FloatArrayParam) {
        // if (!this.model.scene.entityMatrixsEnabled) {
        //     this.model.error("Entity#matrix not enabled for this Viewer"); // See Viewer entityMatrixsEnabled
        //     return;
        // }
        const textureState = this.renderState.dataTextureSet;
        const gl = this.#gl;
        tempMat4a.set(matrix);
        textureState.perSubMeshInstancingMatricesDataTexture.textureData.set(tempMat4a, subMeshIndex * 16);
        if (this.#deferredSetFlagsActive) {
            this.#deferredSetFlagsDirty = true;
            return;
        }
        if (++this.#numUpdatesInFrame >= MAX_MESH_UPDATES_PER_FRAME_WITHOUT_BATCHED_UPDATE) {
            this.#beginDeferredFlags(); // Subsequent flags updates now deferred
        }
        gl.bindTexture(gl.TEXTURE_2D, textureState.perSubMeshInstancingMatricesDataTexture.texture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            (subMeshIndex % 512) * 4, // xoffset
            Math.floor(subMeshIndex / 512), // yoffset
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

    drawColorOpaque(renderFlags, frameCtx) {
        // if (this._numCulledLayerPortions === this._numPortions || this._numVisibleLayerPortions === 0 || this._numTransparentLayerPortions === this._numPortions || this._numXRayedLayerPortions === this._numPortions) {
        //     return;
        // }
        // this._updateBackfaceCull(renderFlags, frameCtx);
        // if (frameCtx.withSAO && this.model.saoEnabled) {
        //     if (this._renderers.colorRendererWithSAO) {
        //         this._renderers.colorRendererWithSAO.drawLayer(frameCtx, this, RENDER_PASSES.COLOR_OPAQUE);
        //     }
        // } else {
        //     if (this._renderers.colorRenderer) {
        //         this._renderers.colorRenderer.drawLayer(frameCtx, this, RENDER_PASSES.COLOR_OPAQUE);
        //     }
        // }
    }

    _updateBackfaceCull(renderFlags, frameCtx) {
        // const backfaces = this.model.backfaces || renderFlags.sectioned;
        // if (frameCtx.backfaces !== backfaces) {
        //     const gl = frameCtx.gl;
        //     if (backfaces) {
        //         gl.disable(gl.CULL_FACE);
        //     } else {
        //         gl.enable(gl.CULL_FACE);
        //     }
        //     frameCtx.backfaces = backfaces;
        // }
    }

    drawColorTransparent(renderFlags, frameCtx) {
        // if (this._numCulledLayerPortions === this._numPortions || this._numVisibleLayerPortions === 0 || this._numTransparentLayerPortions === 0 || this._numXRayedLayerPortions === this._numPortions) {
        //     return;
        // }
        // this._updateBackfaceCull(renderFlags, frameCtx);
        // if (this._renderers.colorRenderer) {
        //     this._renderers.colorRenderer.drawLayer(frameCtx, this, RENDER_PASSES.COLOR_TRANSPARENT);
        // }
    }

    // ---------------------- RENDERING SAO POST EFFECT TARGETS --------------

    drawDepth(renderFlags, frameCtx) {
        // if (this._numCulledLayerPortions === this._numPortions || this._numVisibleLayerPortions === 0 || this._numTransparentLayerPortions === this._numPortions || this._numXRayedLayerPortions === this._numPortions) {
        //     return;
        // }
        // this._updateBackfaceCull(renderFlags, frameCtx);
        // if (this._renderers.depthRenderer) {
        //     this._renderers.depthRenderer.drawLayer(frameCtx, this, RENDER_PASSES.COLOR_OPAQUE); // Assume whatever post-effect uses depth (eg SAO) does not apply to transparent objects
        // }
    }

    drawNormals(renderFlags, frameCtx) {
        // if (this._numCulledLayerPortions === this._numPortions || this._numVisibleLayerPortions === 0 || this._numTransparentLayerPortions === this._numPortions || this._numXRayedLayerPortions === this._numPortions) {
        //     return;
        // }
        // this._updateBackfaceCull(renderFlags, frameCtx);
        // if (this._renderers.normalsRenderer) {
        //     this._renderers.normalsRenderer.drawLayer(frameCtx, this, RENDER_PASSES.COLOR_OPAQUE);  // Assume whatever post-effect uses normals (eg SAO) does not apply to transparent objects
        // }
    }

    // ---------------------- SILHOUETTE RENDERING -----------------------------------

    drawSilhouetteXRayed(renderFlags, frameCtx) {
        // if (this._numCulledLayerPortions === this._numPortions || this._numVisibleLayerPortions === 0 || this._numXRayedLayerPortions === 0) {
        //     return;
        // }
        // this._updateBackfaceCull(renderFlags, frameCtx);
        // if (this._renderers.silhouetteRenderer) {
        //     this._renderers.silhouetteRenderer.drawLayer(frameCtx, this, RENDER_PASSES.SILHOUETTE_XRAYED);
        // }
    }

    drawSilhouetteHighlighted(renderFlags, frameCtx) {
        // if (this._numCulledLayerPortions === this._numPortions || this._numVisibleLayerPortions === 0 || this._numHighlightedLayerPortions === 0) {
        //     return;
        // }
        // this._updateBackfaceCull(renderFlags, frameCtx);
        // if (this._renderers.silhouetteRenderer) {
        //     this._renderers.silhouetteRenderer.drawLayer(frameCtx, this, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED);
        // }
    }

    drawSilhouetteSelected(renderFlags, frameCtx) {
        // if (this._numCulledLayerPortions === this._numPortions || this._numVisibleLayerPortions === 0 || this._numSelectedLayerPortions === 0) {
        //     return;
        // }
        // this._updateBackfaceCull(renderFlags, frameCtx);
        // if (this._renderers.silhouetteRenderer) {
        //     this._renderers.silhouetteRenderer.drawLayer(frameCtx, this, RENDER_PASSES.SILHOUETTE_SELECTED);
        // }
    }

    // ---------------------- EDGES RENDERING -----------------------------------

    drawEdgesColorOpaque(renderFlags, frameCtx) {
        // if (this.model.scene.logarithmicDepthBufferEnabled) {
        //     if (!this.model.scene._loggedWarning) {
        //         console.log("Edge enhancement for SceneModel data texture layers currently disabled with logarithmic depth buffer");
        //         this.model.scene._loggedWarning = true;
        //     }
        //     return;
        // }
        // if (this._numCulledLayerPortions === this._numPortions || this._numVisibleLayerPortions === 0 || this._numEdgesLayerPortions === 0) {
        //     return;
        // }
        // if (this._renderers.edgesColorRenderer) {
        //     this._renderers.edgesColorRenderer.drawLayer(frameCtx, this, RENDER_PASSES.EDGES_COLOR_OPAQUE);
        // }
    }

    drawEdgesColorTransparent(renderFlags, frameCtx) {
        // if (this._numCulledLayerPortions === this._numPortions || this._numVisibleLayerPortions === 0 || this._numEdgesLayerPortions === 0 || this._numTransparentLayerPortions === 0) {
        //     return;
        // }
        // if (this._renderers.edgesColorRenderer) {
        //     this._renderers.edgesColorRenderer.drawLayer(frameCtx, this, RENDER_PASSES.EDGES_COLOR_TRANSPARENT);
        // }
    }

    drawEdgesHighlighted(renderFlags, frameCtx) {
        // if (this._numCulledLayerPortions === this._numPortions || this._numVisibleLayerPortions === 0 || this._numHighlightedLayerPortions === 0) {
        //     return;
        // }
        // if (this._renderers.edgesRenderer) {
        //     this._renderers.edgesRenderer.drawLayer(frameCtx, this, RENDER_PASSES.EDGES_HIGHLIGHTED);
        // }
    }

    drawEdgesSelected(renderFlags, frameCtx) {
        // if (this._numCulledLayerPortions === this._numPortions || this._numVisibleLayerPortions === 0 || this._numSelectedLayerPortions === 0) {
        //     return;
        // }
        // if (this._renderers.edgesRenderer) {
        //     this._renderers.edgesRenderer.drawLayer(frameCtx, this, RENDER_PASSES.EDGES_SELECTED);
        // }
    }

    drawEdgesXRayed(renderFlags, frameCtx) {
        // if (this._numCulledLayerPortions === this._numPortions || this._numVisibleLayerPortions === 0 || this._numXRayedLayerPortions === 0) {
        //     return;
        // }
        // if (this._renderers.edgesRenderer) {
        //     this._renderers.edgesRenderer.drawLayer(frameCtx, this, RENDER_PASSES.EDGES_XRAYED);
        // }
    }

    // ---------------------- OCCLUSION CULL RENDERING -----------------------------------

    drawOcclusion(renderFlags, frameCtx) {
        // if (this._numCulledLayerPortions === this._numPortions || this._numVisibleLayerPortions === 0) {
        //     return;
        // }
        // this._updateBackfaceCull(renderFlags, frameCtx);
        // if (this._renderers.occlusionRenderer) {
        //     this._renderers.occlusionRenderer.drawLayer(frameCtx, this, RENDER_PASSES.COLOR_OPAQUE);
        // }
    }

    // ---------------------- SHADOW BUFFER RENDERING -----------------------------------

    drawShadow(renderFlags, frameCtx) {
        // if (this._numCulledLayerPortions === this._numPortions || this._numVisibleLayerPortions === 0) {
        //     return;
        // }
        // this._updateBackfaceCull(renderFlags, frameCtx);
        // if (this._renderers.shadowRenderer) {
        //     this._renderers.shadowRenderer.drawLayer(frameCtx, this, RENDER_PASSES.COLOR_OPAQUE);
        // }
    }

    //---- PICKING ----------------------------------------------------------------------------------------------------

    setPickMatrices(pickViewMatrix, pickProjMatrix) {
        // if (this._numVisibleLayerPortions === 0) {
        //     return;
        // }
        // this._dtxState.texturePickCameraMatrices.updateViewMatrix(pickViewMatrix, pickProjMatrix);
    }

    drawPickMesh(renderFlags, frameCtx) {
        // if (this._numVisibleLayerPortions === 0) {
        //     return;
        // }
        // this._updateBackfaceCull(renderFlags, frameCtx);
        // if (this._renderers.pickMeshRenderer) {
        //     this._renderers.pickMeshRenderer.drawLayer(frameCtx, this, RENDER_PASSES.PICK);
        // }
    }

    drawPickDepths(renderFlags, frameCtx) {
        // if (this._numVisibleLayerPortions === 0) {
        //     return;
        // }
        // this._updateBackfaceCull(renderFlags, frameCtx);
        // if (this._renderers.pickDepthRenderer) {
        //     this._renderers.pickDepthRenderer.drawLayer(frameCtx, this, RENDER_PASSES.PICK);
        // }
    }

    drawSnapInit(renderFlags, frameCtx) {
        // if (this._numCulledLayerPortions === this._numPortions || this._numVisibleLayerPortions === 0) {
        //     return;
        // }
        // this._updateBackfaceCull(renderFlags, frameCtx);
        // if (this._renderers.snapInitRenderer) {
        //     this._renderers.snapInitRenderer.drawLayer(frameCtx, this, RENDER_PASSES.PICK);
        // }
    }

    drawSnap(renderFlags, frameCtx) {
        // if (this._numCulledLayerPortions === this._numPortions || this._numVisibleLayerPortions === 0) {
        //     return;
        // }
        // this._updateBackfaceCull(renderFlags, frameCtx);
        // if (this._renderers.snapRenderer) {
        //     this._renderers.snapRenderer.drawLayer(frameCtx, this, RENDER_PASSES.PICK);
        // }
    }

    drawPickNormals(renderFlags, frameCtx) {
        // if (this._numCulledLayerPortions === this._numPortions || this._numVisibleLayerPortions === 0) {
        //     return;
        // }
        // this._updateBackfaceCull(renderFlags, frameCtx);
        // if (this._renderers.pickNormalsRenderer) {
        //     this._renderers.pickNormalsRenderer.drawLayer(frameCtx, this, RENDER_PASSES.PICK);
        // }
    }


    destroy() {
        this.rendererModel.viewer.onTick.unsubscribe(this.#onViewerTick);
        this.renderState.dataTextureSet.destroy();
        this.#trianglesDataTextureBuffer = null;

    }
}

