import type {FloatArrayParam} from "@xeokit/math";
import {MeshCounts} from "./../MeshCounts";
import {SceneGeometry, SceneGeometryBucket, SceneMesh} from "@xeokit/scene";
import type {LayerParams} from "./../LayerParams";
import {LayerMeshParams} from "../LayerMeshParams";
import {WebGLRendererModel} from "./../WebGLRendererModel";
import {DTXRenderState} from "./DTXRenderState";
import {TickParams, View, Viewer} from "@xeokit/viewer";
import {DTXBuffer} from "./DTXBuffer";
import {collapseAABB3, expandAABB3} from "@xeokit/boundaries";
import {createVec3, identityMat4} from "@xeokit/matrix";
import {DTXLayerGeometryBucket} from "./DTXLayerGeometryBucket";
import {LinesPrimitive, SolidPrimitive, TrianglesPrimitive} from "@xeokit/constants";
import {DTXTextureSet} from "./DTXTextureSet";
import {SCENE_OBJECT_FLAGS} from "./../SCENE_OBJECT_FLAGS";
import {RENDER_PASSES} from "./../RENDER_PASSES";
import {SDKError} from "@xeokit/core";
import {Layer} from "../Layer";

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
 * can just be stored 1 out of 8  submesh IDs corresponding to a given
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
export abstract class DTXLayer implements Layer {

    gl: WebGL2RenderingContext;
    primitive: number;
    view: View;
    rendererModel: WebGLRendererModel;
    layerIndex: number;
    meshCounts: MeshCounts;
    renderState: DTXRenderState;
    sortId: string;
    dataTextureBuffer: DTXBuffer;

    #dataTextureBuffer: DTXBuffer;
    #geometryHandles: { [key: string]: any };

    #built: boolean;
    #aabb: FloatArrayParam;
    aabbDirty: boolean;
    #meshes: any[];                 // A Mesh has multiple SubMeshes
    layerGeometryBuckets: {};
    #meshToSubMeshLookup: any[];
    #subMeshs: any[];               // A SubMesh has a single GeometryBucket
    #numSubMeshes: number;
    #layerNumber: number;

    #deferredAttributesUpdateEnabled: boolean;
    #deferredMatricesUpdateEnabled: boolean;

    #deferredAttributesUpdateDirty: boolean;
    #deferredMatricesUpdateDirty: boolean;

    #countAttributesUpdateInFrame: number;
    #countMatricesUpdateInFrame: number;

    #onViewerTick: () => void;

    constructor(layerParams: LayerParams) {

        this.gl = layerParams.gl;
        this.primitive = layerParams.primitive;
        this.view = layerParams.view;
        this.rendererModel = layerParams.rendererModel;
        this.layerIndex = layerParams.layerIndex;
        this.sortId = `tris-dtx-${this.#layerNumber}-${layerParams.primitive}`;
        this.meshCounts = new MeshCounts();

        this.#layerNumber = numLayers++;
        this.#dataTextureBuffer = new DTXBuffer();
        this.#built = false;

        this.#countAttributesUpdateInFrame = 0;
        this.#countMatricesUpdateInFrame = 0;

        this.#meshes = [];
        this.#subMeshs = [];
        this.#numSubMeshes = 0;
        this.#meshToSubMeshLookup = [];
        this.#geometryHandles = {};
        this.layerGeometryBuckets = {};
        this.#aabb = collapseAABB3();
        this.aabbDirty = true;

        this.renderState = <DTXRenderState>{
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

        this.#enableDeferredAttributesCommit(); // For faster initialization; commit happens in build()
        this.#enableDeferredMatricesCommit(); // For faster initialization; commit happens in build()
    }

    abstract drawColorOpaque(): void ;

    abstract drawColorTranslucent(): void ;

    abstract drawDepth(): void;

    abstract drawNormals(): void ;

    abstract drawSilhouetteXRayed(): void ;

    abstract drawSilhouetteHighlighted(): void ;

    abstract drawSilhouetteSelected(): void ;

    abstract drawEdgesColorOpaque(): void ;

    abstract drawEdgesColorTranslucent(): void ;

    abstract drawEdgesHighlighted(): void ;

    abstract drawEdgesSelected(): void ;

    abstract drawEdgesXRayed(): void ;

    abstract drawOcclusion(): void;

    abstract drawShadow(): void ;

    abstract drawPickMesh(): void;

    abstract drawPickDepths(): void;

    abstract drawSnapInit(): void;

    abstract drawSnap(): void;

    abstract drawPickNormals(): void;

    get hash() {
        return `${this.renderState.primitive}`;
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
        const indicesPerPrimitive = this.primitive === TrianglesPrimitive ? 3 : (LinesPrimitive ? 2 : 1);
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
                numVertices += bucket.positionsCompressed.length / indicesPerPrimitive;
                numIndices += bucket.indices.length / indicesPerPrimitive;
            });
            canCreate &&=
                (this.renderState.numVertices + numVertices) <= MAX_DATA_TEXTURE_HEIGHT * 4096 &&
                (maxIndicesOfAnyBits + numIndices) <= MAX_DATA_TEXTURE_HEIGHT * 4096;
        }
        return canCreate;
    }

    createLayerMesh(layerMeshParams: LayerMeshParams, sceneMesh: SceneMesh): number {
        if (this.#built) {
            throw new SDKError("Already built");
        }
        console.log(`Layer.createLayerMesh( ${JSON.stringify(layerMeshParams)}, ${JSON.stringify(sceneMesh.getJSON())} )`);
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
            const sublayerMeshIndex = this.#createLayerSubMesh(layerMeshParams, sceneMesh, sceneGeometry, layerGeometryBucket);
            subMeshIndices.push(sublayerMeshIndex);
        });
        const layerMeshIndex = this.#meshToSubMeshLookup.length;
        this.#meshToSubMeshLookup.push(subMeshIndices);
        this.#meshes.push(sceneMesh);
        this.meshCounts.numMeshes++;
        return layerMeshIndex;
    }

    #createLayerGeometryBucket(sceneGeometryBucket: SceneGeometryBucket): DTXLayerGeometryBucket {

        const indicesPerPrimitive = this.primitive === TrianglesPrimitive ? 3 : (LinesPrimitive ? 2 : 1);

        if (sceneGeometryBucket.indices) {
            const alignedIndicesLen = Math.ceil((sceneGeometryBucket.indices.length / indicesPerPrimitive)
                / INDICES_EDGE_INDICES_ALIGNEMENT_SIZE) * INDICES_EDGE_INDICES_ALIGNEMENT_SIZE * indicesPerPrimitive;
            const alignedIndices = new Uint32Array(alignedIndicesLen);
            alignedIndices.fill(0);
            alignedIndices.set(sceneGeometryBucket.indices);
            sceneGeometryBucket.indices = alignedIndices;
        }

        if (sceneGeometryBucket.edgeIndices) {
            const alignedEdgeIndicesLen = Math.ceil((sceneGeometryBucket.edgeIndices.length / 2)
                / INDICES_EDGE_INDICES_ALIGNEMENT_SIZE) * INDICES_EDGE_INDICES_ALIGNEMENT_SIZE * 2;
            const alignedEdgeIndices = new Uint32Array(alignedEdgeIndicesLen);
            alignedEdgeIndices.fill(0);
            alignedEdgeIndices.set(sceneGeometryBucket.edgeIndices);
            sceneGeometryBucket.edgeIndices = alignedEdgeIndices;
        }

        const positionsCompressed = sceneGeometryBucket.positionsCompressed;
        const indices = sceneGeometryBucket.indices;
        const edgeIndices = sceneGeometryBucket.edgeIndices;
        const dataTextureBuffer = this.#dataTextureBuffer;

        dataTextureBuffer.positionsCompressed.push(positionsCompressed)
        const vertexBase = dataTextureBuffer.lenPositionsCompressed / indicesPerPrimitive;
        const numVertices = positionsCompressed.length / indicesPerPrimitive;
        dataTextureBuffer.lenPositionsCompressed += positionsCompressed.length;

        let indicesBase;
        let numPrimitives = 0;
        if (indices) {
            numPrimitives = indices.length / indicesPerPrimitive;
            let indicesBuffer;
            if (numVertices <= (1 << 8)) {
                indicesBuffer = dataTextureBuffer.indices8Bits;
                indicesBase = dataTextureBuffer.lenIndices8Bits / indicesPerPrimitive;
                dataTextureBuffer.lenIndices8Bits += indices.length;
            } else if (numVertices <= (1 << 16)) {
                indicesBuffer = dataTextureBuffer.indices16Bits;
                indicesBase = dataTextureBuffer.lenIndices16Bits / indicesPerPrimitive;
                dataTextureBuffer.lenIndices16Bits += indices.length;
            } else {
                indicesBuffer = dataTextureBuffer.indices32Bits;
                indicesBase = dataTextureBuffer.lenIndices32Bits / indicesPerPrimitive;
                dataTextureBuffer.lenIndices32Bits += indices.length;
            }
            indicesBuffer.push(indices);
        }

        let edgeIndicesBase;
        let numEdges = 0;
        if (edgeIndices) {
            numEdges = edgeIndices.length / 2;
            let edgeIndicesBuffer;
            if (numVertices <= (1 << 8)) {
                edgeIndicesBuffer = dataTextureBuffer.edgeIndices8Bits;
                edgeIndicesBase = dataTextureBuffer.lenEdgeIndices8Bits / 2;
                dataTextureBuffer.lenEdgeIndices8Bits += edgeIndices.length;
            } else if (numVertices <= (1 << 16)) {
                edgeIndicesBuffer = dataTextureBuffer.edgeIndices16Bits;
                edgeIndicesBase = dataTextureBuffer.lenEdgeIndices16Bits / 2;
                dataTextureBuffer.lenEdgeIndices16Bits += edgeIndices.length;
            } else {
                edgeIndicesBuffer = dataTextureBuffer.edgeIndices32Bits;
                edgeIndicesBase = dataTextureBuffer.lenEdgeIndices32Bits / 2;
                dataTextureBuffer.lenEdgeIndices32Bits += edgeIndices.length;
            }
            edgeIndicesBuffer.push(edgeIndices);
        }

        this.renderState.numVertices += numVertices;

        return <DTXLayerGeometryBucket>{
            vertexBase,
            numVertices,
            numPrimitives,
            numEdges,
            indicesBase,
            edgeIndicesBase
        };
    }

    #createLayerSubMesh(
        layerMeshParams: LayerMeshParams,
        sceneMesh: SceneMesh,
        sceneGeometry: SceneGeometry,
        geometryBucketHandle: DTXLayerGeometryBucket): number {

        const indicesPerPrimitive = this.primitive === TrianglesPrimitive ? 3 : (LinesPrimitive ? 2 : 1);
        const color = sceneMesh.color;
        const metallic = sceneMesh.metallic;
        const roughness = sceneMesh.roughness;
        //const colors = sceneGeometry.colors;
        const colors = null;
        const opacity = sceneMesh.opacity;
        const meshMatrix = sceneMesh.matrix;
        const pickColor = layerMeshParams.pickColor;
        const dataTextureBuffer = this.#dataTextureBuffer;
        const renderState = this.renderState;

        dataTextureBuffer.subMeshDecompressMatrices.push(sceneGeometry.positionsDecompressMatrix);
        dataTextureBuffer.subMeshInstanceMatrices.push(meshMatrix || DEFAULT_MATRIX);
        dataTextureBuffer.subMeshSolidFlags.push(sceneGeometry.primitive === SolidPrimitive);

        if (colors) {
            dataTextureBuffer.subMeshColors.push([colors[0] * 255, colors[1] * 255, colors[2] * 255, 255]);
        } else if (color) { // Color is pre-quantized by SceneModel
            dataTextureBuffer.subMeshColors.push([color[0], color[1], color[2], opacity]);
        }

        dataTextureBuffer.subMeshPickColors.push([pickColor[0] * 255, pickColor[1] * 255, pickColor[2] * 255, pickColor[3] * 255]);
        dataTextureBuffer.subMeshVertexBases.push(geometryBucketHandle.vertexBase);

        {
            let currentNumIndices;
            if (geometryBucketHandle.numVertices <= (1 << 8)) {
                currentNumIndices = renderState.numIndices8Bits;
            } else if (geometryBucketHandle.numVertices <= (1 << 16)) {
                currentNumIndices = renderState.numIndices16Bits;
            } else {
                currentNumIndices = renderState.numIndices32Bits;
            }
            dataTextureBuffer.subMeshIndicesBases.push(currentNumIndices / indicesPerPrimitive - geometryBucketHandle.indicesBase);
        }

        {
            let currentNumEdgeIndices;
            if (geometryBucketHandle.numVertices <= (1 << 8)) {
                currentNumEdgeIndices = renderState.numEdgeIndices8Bits;
            } else if (geometryBucketHandle.numVertices <= (1 << 16)) {
                currentNumEdgeIndices = renderState.numEdgeIndices16Bits;
            } else {
                currentNumEdgeIndices = renderState.numEdgeIndices32Bits;
            }
            dataTextureBuffer.subMeshEdgeIndicesBases.push(currentNumEdgeIndices / 2 - geometryBucketHandle.edgeIndicesBase);
        }

        const sublayerMeshIndex = this.#subMeshs.length;
        if (geometryBucketHandle.numPrimitives > 0) {
            let numIndices = geometryBucketHandle.numPrimitives * indicesPerPrimitive;
            let indicesPortionIdBuffer;
            if (geometryBucketHandle.numVertices <= (1 << 8)) {
                indicesPortionIdBuffer = dataTextureBuffer.primitiveToSubMeshLookup8Bits;
                renderState.numIndices8Bits += numIndices;
            } else if (geometryBucketHandle.numVertices <= (1 << 16)) {
                indicesPortionIdBuffer = dataTextureBuffer.primitiveToSubMeshLookup16Bits;
                renderState.numIndices16Bits += numIndices;
            } else {
                indicesPortionIdBuffer = dataTextureBuffer.primitiveToSubMeshLookup32Bits;
                renderState.numIndices32Bits += numIndices;
            }
            for (let i = 0; i < geometryBucketHandle.numPrimitives; i += INDICES_EDGE_INDICES_ALIGNEMENT_SIZE) {
                indicesPortionIdBuffer.push(sublayerMeshIndex);
            }
        }

        if (geometryBucketHandle.numEdges > 0) {
            let numEdgeIndices = geometryBucketHandle.numEdges * 2;
            let edgeIndicesPortionIdBuffer;
            if (geometryBucketHandle.numVertices <= (1 << 8)) {
                edgeIndicesPortionIdBuffer = dataTextureBuffer.edgeToSubMeshLookup8Bits;
                renderState.numEdgeIndices8Bits += numEdgeIndices;
            } else if (geometryBucketHandle.numVertices <= (1 << 16)) {
                edgeIndicesPortionIdBuffer = dataTextureBuffer.edgeToSubMeshLookup16Bits;
                renderState.numEdgeIndices16Bits += numEdgeIndices;
            } else {
                edgeIndicesPortionIdBuffer = dataTextureBuffer.edgeToSubMeshLookup32Bits;
                renderState.numEdgeIndices32Bits += numEdgeIndices;
            }
            for (let i = 0; i < geometryBucketHandle.numEdges; i += INDICES_EDGE_INDICES_ALIGNEMENT_SIZE) {
                edgeIndicesPortionIdBuffer.push(sublayerMeshIndex);
            }
        }

        //   dataTextureBuffer.perObjectOffsets.push([0, 0, 0]);

        this.#subMeshs.push({
            // vertsBase: vertsIndex,
            numVertices: geometryBucketHandle.numPrimitives
        });

        this.#numSubMeshes++;
        this.rendererModel.numSubMeshes++;

        return sublayerMeshIndex;
    }

    build() {
        if (this.#built) {
            throw new SDKError("Already built");
        }
        this.renderState.dataTextureSet = new DTXTextureSet(this.gl, this.#dataTextureBuffer);
        this.#deferredAttributesUpdateDirty = false;
        this.#deferredMatricesUpdateDirty = false;
        this.#onViewerTick = this.rendererModel.viewer.onTick.subscribe((viewer: Viewer, tickParams: TickParams) => {
            if (this.#deferredAttributesUpdateDirty) {
                this.#commitDeferredAttributes();
            }
            if (this.#deferredMatricesUpdateDirty) {
                this.#commitDeferredMatrices();
            }
            this.#countAttributesUpdateInFrame = 0;
            this.#countMatricesUpdateInFrame = 0;
        });
        console.log(this.#dataTextureBuffer);
        this.#dataTextureBuffer = null;
        this.#geometryHandles = {};
        this.layerGeometryBuckets = {};
        this.#built = true;
    }

    isEmpty() {
        return this.meshCounts.numMeshes === 0;
    }

    #enableDeferredAttributesCommit() {
        this.#deferredAttributesUpdateEnabled = true;
    }

    setLayerMeshFlags(layerMeshIndex: number, flags: number, meshTransparent: boolean) {
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
        this.#setMeshFlags(layerMeshIndex, flags, meshTransparent, deferred);
        this.#setMeshFlags2(layerMeshIndex, flags, deferred);
    }

    commitRendererState() {
        this.#commitDeferredAttributes();
        this.#commitDeferredMatrices();
    }

    setLayerMeshVisible(layerMeshIndex: number, flags: number, transparent: boolean) {
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
        this.#setMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshHighlighted(layerMeshIndex: number, flags: number, transparent: boolean) {
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
        this.#setMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshXRayed(layerMeshIndex: number, flags: number, transparent: boolean) {
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
        this.#setMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshSelected(layerMeshIndex: number, flags: number, transparent: boolean) {
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
        this.#setMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshEdges(layerMeshIndex: number, flags: number, transparent: boolean) {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
        if (flags & SCENE_OBJECT_FLAGS.EDGES) {
            this.meshCounts.numEdges++;
            this.rendererModel.meshCounts.numEdges++;
        } else {
            this.meshCounts.numEdges--;
            this.rendererModel.meshCounts.numEdges--;
        }
        this.#setMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshClippable(layerMeshIndex: number, flags: number) {
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
        this.#setMeshFlags2(layerMeshIndex, flags);
    }

    setLayerMeshCulled(layerMeshIndex: number, flags: number, transparent: boolean) {
        if (!this.#built) {
            throw new SDKError("Not finalized");
        }
        if (flags & SCENE_OBJECT_FLAGS.CULLED) {
            this.meshCounts.numCulled++;
            this.rendererModel.meshCounts.numCulled++;
        } else {
            this.meshCounts.numCulled--;
            this.rendererModel.meshCounts.numCulled--;
        }
        this.#setMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshCollidable(layerMeshIndex, flags) {
        if (!this.#built) {
            throw new SDKError("Not finalized");
        }
    }

    setLayerMeshPickable(layerMeshIndex: number, flags: number, transparent: boolean) {
        if (!this.#built) {
            throw new SDKError("Not finalized");
        }
        if (flags & SCENE_OBJECT_FLAGS.PICKABLE) {
            this.meshCounts.numPickable++;
            this.rendererModel.meshCounts.numPickable++;
        } else {
            this.meshCounts.numPickable--;
            this.rendererModel.meshCounts.numPickable--;
        }
        this.#setMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshColor(layerMeshIndex: number, color: FloatArrayParam, setOpacity: boolean) {
        if (!this.#built) {
            throw new SDKError("Not finalized");
        }
        const subMeshIndices = this.#meshToSubMeshLookup[layerMeshIndex];
        for (let i = 0, len = subMeshIndices.length; i < len; i++) {
            this.#setSubMeshColor(subMeshIndices[i], color);
        }
    }

    #setSubMeshColor(sublayerMeshIndex: number, color: FloatArrayParam) {
        const textureState = this.renderState.dataTextureSet;
        const gl = this.gl;
        tempUint8Array4 [0] = color[0];
        tempUint8Array4 [1] = color[1];
        tempUint8Array4 [2] = color[2];
        tempUint8Array4 [3] = color[3];
        textureState.subMeshAttributesDataTexture.textureData.set(tempUint8Array4, sublayerMeshIndex * 32);
        if (this.#deferredAttributesUpdateEnabled) {
            this.#deferredAttributesUpdateDirty = true;
            return;
        }
        if (++this.#countAttributesUpdateInFrame >= MAX_MESH_UPDATES_PER_FRAME_WITHOUT_BATCHED_UPDATE) {
            this.#enableDeferredAttributesCommit(); // Subsequent flags updates now deferred
        }
        // console.info("_setSubMeshColor write through");
        gl.bindTexture(gl.TEXTURE_2D, textureState.subMeshAttributesDataTexture.texture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            (sublayerMeshIndex % 512) * 8, // xoffset
            Math.floor(sublayerMeshIndex / 512), // yoffset
            1, // width
            1, //height
            gl.RGBA_INTEGER,
            gl.UNSIGNED_BYTE,
            tempUint8Array4
        );
        // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    setLayerMeshTransparent(layerMeshIndex: number, flags: number, transparent: boolean) {
        if (!this.#built) {
            throw new SDKError("Not finalized");
        }
        if (transparent) {
            this.meshCounts.numTransparent++;
            this.rendererModel.meshCounts.numTransparent++;
        } else {
            this.meshCounts.numTransparent--;
            this.rendererModel.meshCounts.numTransparent--;
        }
        this.#setMeshFlags(layerMeshIndex, flags, transparent);
    }

    #setMeshFlags(layerMeshIndex: number, flags: number, transparent: boolean, deferred: boolean = false) {
        const subMeshIndices = this.#meshToSubMeshLookup[layerMeshIndex];
        for (let i = 0, len = subMeshIndices.length; i < len; i++) {
            this.#setSubMeshFlags(subMeshIndices[i], flags, transparent, deferred);
        }
    }

    #setSubMeshFlags(sublayerMeshIndex: number, flags: number, transparent: boolean, deferred: boolean = false) {

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
        const gl = this.gl;
        tempUint8Array4 [0] = f0;
        tempUint8Array4 [1] = f1;
        tempUint8Array4 [2] = f2;
        tempUint8Array4 [3] = f3;
        // sceneMesh flags
        dataTextureSet.subMeshAttributesDataTexture.textureData.set(tempUint8Array4, sublayerMeshIndex * 32 + 8);
        if (this.#deferredAttributesUpdateEnabled || deferred) {
            this.#deferredAttributesUpdateDirty = true;
            return;
        }
        if (++this.#countAttributesUpdateInFrame >= MAX_MESH_UPDATES_PER_FRAME_WITHOUT_BATCHED_UPDATE) {
            this.#enableDeferredAttributesCommit(); // Subsequent flags updates now deferred
        }
        gl.bindTexture(gl.TEXTURE_2D, dataTextureSet.subMeshAttributesDataTexture.texture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            (sublayerMeshIndex % 512) * 8 + 2, // xoffset
            Math.floor(sublayerMeshIndex / 512), // yoffset
            1, // width
            1, //height
            gl.RGBA_INTEGER,
            gl.UNSIGNED_BYTE,
            tempUint8Array4
        );
        // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    #setMeshFlags2(layerMeshIndex: number, flags: number, deferred = false) {
        const subMeshIndices = this.#meshToSubMeshLookup[layerMeshIndex];
        for (let i = 0, len = subMeshIndices.length; i < len; i++) {
            this.#setSubMeshFlags2(subMeshIndices[i], flags, deferred);
        }
    }

    #setSubMeshFlags2(sublayerMeshIndex: number, flags: number, deferred = false) {
        if (!this.#built) {
            throw new SDKError("Not finalized");
        }
        const clippable = !!(flags & SCENE_OBJECT_FLAGS.CLIPPABLE) ? 255 : 0;
        const textureState = this.renderState.dataTextureSet;
        const gl = this.gl;
        tempUint8Array4 [0] = clippable;
        tempUint8Array4 [1] = 0;
        tempUint8Array4 [2] = 1;
        tempUint8Array4 [3] = 2;
        // sceneMesh flags2
        textureState.subMeshAttributesDataTexture.textureData.set(tempUint8Array4, sublayerMeshIndex * 32 + 12);
        if (this.#deferredAttributesUpdateEnabled || deferred) {
            this.#deferredAttributesUpdateDirty = true;
            return;
        }
        if (++this.#countAttributesUpdateInFrame >= MAX_MESH_UPDATES_PER_FRAME_WITHOUT_BATCHED_UPDATE) {
            this.#enableDeferredAttributesCommit();
        }
        gl.bindTexture(gl.TEXTURE_2D, textureState.subMeshAttributesDataTexture.texture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            (sublayerMeshIndex % 512) * 8 + 3, // xoffset
            Math.floor(sublayerMeshIndex / 512), // yoffset
            1, // width
            1, //height
            gl.RGBA_INTEGER,
            gl.UNSIGNED_BYTE,
            tempUint8Array4
        );
        // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    #commitDeferredAttributes() {
        console.log("@xeokit/webglrenderer!Layer.commitDeferredAttributes()");
        this.#deferredAttributesUpdateEnabled = false;
        if (this.#deferredAttributesUpdateDirty) {
            this.#deferredAttributesUpdateDirty = false;
            const gl = this.gl;
            const subMeshAttributesDataTexture = this.renderState.dataTextureSet.subMeshAttributesDataTexture;
            gl.bindTexture(gl.TEXTURE_2D, subMeshAttributesDataTexture.texture);
            gl.texSubImage2D(
                gl.TEXTURE_2D,
                0, // level
                0, // xoffset
                0, // yoffset
                subMeshAttributesDataTexture.textureWidth, // width
                subMeshAttributesDataTexture.textureHeight, // width
                gl.RGBA_INTEGER,
                gl.UNSIGNED_BYTE,
                subMeshAttributesDataTexture.textureData
            );
        }
    }

    setLayerMeshOffset(layerMeshIndex: number, offset: FloatArrayParam) {
        if (!this.#built) {
            throw new SDKError("Not finalized");
        }
        const subMeshIndices = this.#meshToSubMeshLookup[layerMeshIndex];
        for (let i = 0, len = subMeshIndices.length; i < len; i++) {
            this.#setSubMeshOffset(subMeshIndices[i], offset);
        }
    }

    #setSubMeshOffset(sublayerMeshIndex: number, offset: FloatArrayParam) {
        // if (!this.#built) {
        //     throw new SDKError("Not finalized");
        // }
        // // if (!this.model.scene.entityOffsetsEnabled) {
        // //     this.model.error("Entity#offset not enabled for this Viewer"); // See Viewer entityOffsetsEnabled
        // //     return;
        // // }
        // const textureState = this.renderState.dataTextureSet;
        // const gl = this.gl;
        // tempFloat32Array3 [0] = offset[0];
        // tempFloat32Array3 [1] = offset[1];
        // tempFloat32Array3 [2] = offset[2];
        // // sceneMesh offset
        // textureState.texturePerObjectOffsets._textureData.set(tempFloat32Array3, sublayerMeshIndex * 3);
        // if (this.#deferredAttributesUpdateEnabled) {
        //     this.#deferredAttributesUpdateDirty = true;
        //     return;
        // }
        // if (++this.#countAttributesUpdateInFrame >= MAX_MESH_UPDATES_PER_FRAME_WITHOUT_BATCHED_UPDATE) {
        //     this.#enableDeferredAttributesCommit(); // Subsequent flags updates now deferred
        // }
        // gl.bindTexture(gl.TEXTURE_2D, textureState.texturePerObjectOffsets._texture);
        // gl.texSubImage2D(
        //     gl.TEXTURE_2D,
        //     0, // level
        //     0, // x offset
        //     sublayerMeshIndex, // yoffset
        //     1, // width
        //     1, // height
        //     gl.RGB,
        //     gl.FLOAT,
        //     tempFloat32Array3
        // );
        // // gl.bindTexture (gl.TEXTURE_2D, null);
    }


    //----------------------------------------------------------------------------------
    // Mesh Matrices
    //----------------------------------------------------------------------------------

    #enableDeferredMatricesCommit() {
        this.#deferredMatricesUpdateEnabled = true;
    }

    setLayerMeshMatrix(layerMeshIndex: number, matrix: FloatArrayParam) {
        if (!this.#built) {
            throw new SDKError("Not finalized");
        }
        const subMeshIndices = this.#meshToSubMeshLookup[layerMeshIndex];
        for (let i = 0, len = subMeshIndices.length; i < len; i++) {
            this.#setSubMeshMatrix(subMeshIndices[i], matrix);
        }
    }

    #setSubMeshMatrix(sublayerMeshIndex: number, matrix: FloatArrayParam) {
        // if (!this.model.scene.entityMatrixsEnabled) {
        //     this.model.error("Entity#matrix not enabled for this Viewer"); // See Viewer entityMatrixsEnabled
        //     return;
        // }
        const textureState = this.renderState.dataTextureSet;
        const gl = this.gl;
        tempMat4a.set(matrix);
        textureState.subMeshInstanceMatricesDataTexture.textureData.set(tempMat4a, sublayerMeshIndex * 16);
        if (this.#deferredMatricesUpdateEnabled) {
            this.#deferredMatricesUpdateDirty = true;
            return;
        }
        if (++this.#countMatricesUpdateInFrame >= MAX_MESH_UPDATES_PER_FRAME_WITHOUT_BATCHED_UPDATE) {
            this.#enableDeferredMatricesCommit(); // Subsequent flags updates now deferred
        }
        gl.bindTexture(gl.TEXTURE_2D, textureState.subMeshInstanceMatricesDataTexture.texture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            (sublayerMeshIndex % 512) * 4, // xoffset
            Math.floor(sublayerMeshIndex / 512), // yoffset
            // 1,
            4, // width
            1, // height
            gl.RGBA,
            gl.FLOAT,
            tempMat4a
        );
        // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    #commitDeferredMatrices() {
        if (this.#deferredMatricesUpdateDirty) {
            console.log("@xeokit/webglrenderer!Layer.commitDeferredMatrices()");
            const subMeshInstanceMatricesDataTexture = this.renderState.dataTextureSet.subMeshInstanceMatricesDataTexture;
            const gl = this.gl;
            gl.bindTexture(gl.TEXTURE_2D, subMeshInstanceMatricesDataTexture.texture);
            gl.texSubImage2D(
                gl.TEXTURE_2D,
                0, // level
                0, // xoffset
                0, // yoffset
                subMeshInstanceMatricesDataTexture.textureWidth, // width
                subMeshInstanceMatricesDataTexture.textureHeight, // width
                gl.RGBA,
                gl.FLOAT,
                subMeshInstanceMatricesDataTexture.textureData
            );
            this.#deferredMatricesUpdateDirty = false;
        }
    }

    // draw() {
    //     const rendererSet = this._renderers;
    //     switch (rendererSet.renderContext.renderPass) {
    //         case RENDER_PASSES.COLOR_OPAQUE:
    //         case RENDER_PASSES.COLOR_TRANSPARENT:
    //             // DTXTrianglesRendererSet.trianglesTestRenderer.draw(this);
    //             rendererSet.colorRenderer.draw(this);
    //             break;
    //         case RENDER_PASSES.SILHOUETTE_SELECTED:
    //             rendererSet.silhouetteRenderer.draw(this);
    //             break;
    //         case RENDER_PASSES.EDGES_COLOR_OPAQUE:
    //         case RENDER_PASSES.EDGES_COLOR_TRANSPARENT:
    //             rendererSet.edgesColorRenderer.draw(this);
    //             break;
    //
    //         // TODO: other modes
    //     }
    // }
    //
    //


    destroy() {
        this.rendererModel.viewer.onTick.unsubscribe(this.#onViewerTick);
        this.renderState.dataTextureSet.destroy();
        this.#dataTextureBuffer = null;
    }

    updateBackfaceCull() {

    }
}
