import {WebGLSceneModel} from "./WebGLSceneModel";
import {DataTextureSet} from "./DataTextureSet";
import {DataTextureFactory} from "./DataTextureFactory";
import {FrameContext} from "../FrameContext";
import {DrawFlags} from "../DrawFlags";
import {MeshCounts} from "./MeshCounts";

import {GeometryCompressedParams, GeometryBucketParams, math, constants, MeshParams} from "../../viewer/index";


import {SceneObjectFlags} from './SceneObjectFlags';
import {RENDER_PASSES} from './RENDER_PASSES';

import {TextureSet} from "./TextureSet";

const MAX_MESH_PARTS = (1 << 12); // 12 bits 
const MAX_DATATEXTURE_HEIGHT = (1 << 11); // 2048
const INDICES_EDGE_INDICES_ALIGNMENT_SIZE = 8;

const identityMatrix = math.identityMat4();
const tempMat4 = math.mat4();
const tempMat4b = math.mat4();
const tempVec4a = math.vec4([0, 0, 0, 1]);
const tempVec4b = math.vec4([0, 0, 0, 1]);
const tempVec4c = math.vec4([0, 0, 0, 1]);
const tempOBB3 = math.boundaries.OBB3();
const tempUint8Array4 = new Uint8Array(4);
const tempFloat32Array3 = new Float32Array(3);

export interface LayerParams {
    gl: WebGL2RenderingContext;
    sceneModel: WebGLSceneModel;
    modelMeshCounts: MeshCounts;
    primitive: number;
    origin: math.FloatArrayType;
    layerIndex: number;
    textureSet?: TextureSet;
}

interface GeometryBucketHandle {
    vertexBase: number;
    numVertices: number;
    numTriangles: number;
    numEdges: number;
    indicesBase: number;
    edgeIndicesBase: number
}

interface GeometryHandle {
    aabb: math.FloatArrayType;
    positionsDecompressMatrix: math.FloatArrayType;
    geometryBucketHandles: GeometryBucketHandle[]
}

interface MeshPartParams {
    aabb: math.FloatArrayType;
}

interface MeshPartHandle {
    vertsBase: number;
    numVerts: number;
}

export interface LayerRenderState {
    dataTextureSet: DataTextureSet;
    primitive: number;
    origin: math.FloatArrayType;
    numIndices8Bits: number;
    numIndices16Bits: number;
    numIndices32Bits: number;
    numEdgeIndices8Bits: number;
    numEdgeIndices16Bits: number;
    numEdgeIndices32Bits: number;
    numVertices: number;
}

class DataTextureBuffer {

    positions: number[];
    indices_8Bits: number[];
    indices_16Bits: number[];
    indices_32Bits: number[];
    edgeIndices_8Bits: number[];
    edgeIndices_16Bits: number[];
    edgeIndices_32Bits: number[];
    eachMeshVertexPortionBase: number[];
    eachMeshVertexPortionOffset: number[];
    eachMeshEdgeIndicesOffset: number[];
    eachMeshColor: any[];
    eachMeshPickColor: any[];
    eachMeshMatrices: any[];
    eachMeshNormalMatrix: any[];
    eachMeshPositionsDecompressMatrix: any[];
    eachTriangleMesh_32Bits: number[];
    eachTriangleMesh_16Bits: number[];
    eachTriangleMesh_8Bits: number[];
    eachEdgeMesh_32Bits: number[];
    eachEdgeMesh_16Bits: number[];
    eachEdgeMesh_8Bits: number[];
    eachEdgeOffset: any[];
    eachMeshParts: number[];

    constructor() {
        this.positions = [];
        this.indices_8Bits = [];
        this.indices_16Bits = [];
        this.indices_32Bits = [];
        this.edgeIndices_8Bits = [];
        this.edgeIndices_16Bits = [];
        this.edgeIndices_32Bits = [];
        this.eachMeshVertexPortionBase = [];
        this.eachMeshVertexPortionOffset = [];
        this.eachMeshEdgeIndicesOffset = [];
        this.eachMeshColor = [];
        this.eachMeshPickColor = [];
        this.eachMeshMatrices = [];
        this.eachMeshNormalMatrix = [];
        this.eachMeshPositionsDecompressMatrix = [];
        this.eachTriangleMesh_32Bits = [];
        this.eachTriangleMesh_16Bits = [];
        this.eachTriangleMesh_8Bits = [];
        this.eachEdgeMesh_32Bits = [];
        this.eachEdgeMesh_16Bits = [];
        this.eachEdgeMesh_8Bits = [];
        this.eachEdgeOffset = [];
        this.eachMeshParts = [];
    }
}

export class Layer {

    sceneModel: WebGLSceneModel;
    primitive: number;
    layerIndex: number;
    aabb: math.FloatArrayType;
    state: LayerRenderState;

    #gl: WebGL2RenderingContext;
    #modelMeshCounts: MeshCounts;
    #layerMeshCounts: MeshCounts;
    #dataTextureBuffer: DataTextureBuffer;
    #renderers: any;
    #geometryHandles: { [key: number | string]: any };
    #meshPartHandles: MeshPartHandle[];
    #numMeshParts: number;
    #eachMeshParts: number[][];
    #numMeshes: number;
    #numVisibleMeshes: number;
    #numTransparentMeshes: number;
    #numEdgesMeshes: number;
    #numXRayedMeshes: number;
    #numSelectedMeshes: number;
    #numHighlightedMeshes: number;
    #numClippableMeshes: number;
    #numPickableMeshes: number;
    #numCulledMeshes: number;
    #modelAABB: math.FloatArrayType;
    sortId: string;
    #deferredSetFlagsActive: boolean;
    #deferredSetFlagsDirty: boolean;
    #finalized: boolean;

    constructor(layerParams: LayerParams, renderers?: any) {

        this.#modelMeshCounts = layerParams.modelMeshCounts;
        this.#layerMeshCounts = new MeshCounts();

        this.primitive = layerParams.primitive;
        this.layerIndex = layerParams.layerIndex;
        this.sceneModel = layerParams.sceneModel;

        this.state = <LayerRenderState>{
            primitive: layerParams.primitive,
            dataTextureSet: new DataTextureSet(),
            origin: math.vec3(),
            numIndices8Bits: 0,
            numIndices16Bits: 0,
            numIndices32Bits: 0,
            numEdgeIndices8Bits: 0,
            numEdgeIndices16Bits: 0,
            numEdgeIndices32Bits: 0,
            numVertices: 0
        };

        this.#gl = layerParams.gl;
        this.#dataTextureBuffer = new DataTextureBuffer();
        this.#renderers = renderers;
        this.#numMeshes = 0;
        this.#numMeshParts = 0;
        this.#numVisibleMeshes = 0;
        this.#numTransparentMeshes = 0;
        this.#numXRayedMeshes = 0;
        this.#numSelectedMeshes = 0;
        this.#numHighlightedMeshes = 0;
        this.#numClippableMeshes = 0;
        this.#numPickableMeshes = 0;
        this.#numCulledMeshes = 0;
        this.#modelAABB = math.boundaries.collapseAABB3();
        this.#geometryHandles = {};
        this.#meshPartHandles = [];
        this.#eachMeshParts = [];
        this.aabb = math.boundaries.collapseAABB3();
        if (layerParams.origin) {
            // @ts-ignore
            this.state.origin.set(layerParams.origin);
        }
        this.#finalized = false;
    }

    get hash() {
        return `layer-${this.state.primitive}-${this.state.origin[0]}-${this.state.origin[1]}-${this.state.origin[2]}`;
    }

    canCreateMesh(geometryCompressedParams: GeometryCompressedParams): boolean {
        if (this.#finalized) {
            throw "Already finalized";
        }
        const state = this.state;
        const numGeometryBuckets = geometryCompressedParams.geometryBuckets.length;
        if ((this.#numMeshParts + numGeometryBuckets) > MAX_MESH_PARTS) {
            return false;
        }
        let numPositions = 0;
        let numIndices = 0;
        for (let i = 0; i < numGeometryBuckets; i++) {
            const geometryBucket = geometryCompressedParams.geometryBuckets[i];
            numPositions += geometryBucket.positionsCompressed.length;
            numIndices += geometryBucket.indices.length;
        }
        const primVerts = (geometryCompressedParams.primitive === constants.PointsPrimitive) ? 1 : (geometryCompressedParams.primitive == constants.LinesPrimitive ? 2 : 3);
        const maxIndicesOfAnyBits = Math.max(state.numIndices8Bits, state.numIndices16Bits, state.numIndices32Bits);
        const numVerts = numPositions / primVerts;
        let numTriangleIndices = numIndices / 3;
        return (state.numVertices + numVerts) <= MAX_DATATEXTURE_HEIGHT * 1024 && (numTriangleIndices + numIndices) <= MAX_DATATEXTURE_HEIGHT * 1024;
    }

    hasGeometry(geometryId: string): boolean {
        return this.#geometryHandles[geometryId];
    }

    createGeometry(geometryCompressedParams: GeometryCompressedParams) {
        if (this.#finalized) {
            throw "Already finalized";
        }
        const geometryBucketHandles = [];
        for (let i = 0, len = geometryCompressedParams.geometryBuckets.length; i < len; i++) {
            geometryBucketHandles.push(this.#createGeometryBucket(geometryCompressedParams.geometryBuckets[i]));
        }
        this.#geometryHandles[geometryCompressedParams.id] = <GeometryHandle>{
            id: geometryCompressedParams.id,
            aabb: geometryCompressedParams.aabb,
            positionsDecompressMatrix: geometryCompressedParams.positionsDecompressMatrix,
            geometryBucketHandles
        };
    }

    #createGeometryBucket(geometryBucket: GeometryBucketParams): GeometryBucketHandle {
        const state = this.state;
        if (geometryBucket.indices) {  // Align indices to INDICES_EDGE_INDICES_ALIGNMENT_SIZE
            const alignedIndicesLen = Math.ceil((geometryBucket.indices.length / 3) / INDICES_EDGE_INDICES_ALIGNMENT_SIZE) * INDICES_EDGE_INDICES_ALIGNMENT_SIZE * 3;
            const alignedIndices = new Uint32Array(alignedIndicesLen);
            alignedIndices.fill(0);
            alignedIndices.set(geometryBucket.indices);
            geometryBucket.indices = alignedIndices;
        }
        if (geometryBucket.edgeIndices) {  // Align edge indices to INDICES_EDGE_INDICES_ALIGNMENT_SIZE
            const alignedEdgeIndicesLen = Math.ceil((geometryBucket.edgeIndices.length / 2) / INDICES_EDGE_INDICES_ALIGNMENT_SIZE) * INDICES_EDGE_INDICES_ALIGNMENT_SIZE * 2;
            const alignedEdgeIndices = new Uint32Array(alignedEdgeIndicesLen);
            alignedEdgeIndices.fill(0);
            alignedEdgeIndices.set(geometryBucket.edgeIndices);
            geometryBucket.edgeIndices = alignedEdgeIndices;
        }
        const dataTextureBuffer = this.#dataTextureBuffer;
        const positionsCompressed = geometryBucket.positionsCompressed;
        const indices = geometryBucket.indices;
        const edgeIndices = geometryBucket.edgeIndices;
        const vertexBase = dataTextureBuffer.positions.length / 3;
        const numVertices = positionsCompressed.length / 3;
        for (let i = 0, len = positionsCompressed.length; i < len; i++) {
            dataTextureBuffer.positions.push(positionsCompressed[i]);
        }
        let indicesBase;
        let numTriangles = 0;
        if (indices) {
            numTriangles = indices.length / 3;
            let indicesBuffer;
            if (numVertices <= (1 << 8)) {
                indicesBuffer = dataTextureBuffer.indices_8Bits;
            } else if (numVertices <= (1 << 16)) {
                indicesBuffer = dataTextureBuffer.indices_16Bits;
            } else {
                indicesBuffer = dataTextureBuffer.indices_32Bits;
            }
            indicesBase = indicesBuffer.length / 3;
            for (let i = 0, len = indices.length; i < len; i++) {
                indicesBuffer.push(indices[i]);
            }
        }
        let edgeIndicesBase;
        let numEdges = 0;
        if (edgeIndices) {
            numEdges = edgeIndices.length / 2;
            let edgeIndicesBuffer;
            if (numVertices <= (1 << 8)) {
                edgeIndicesBuffer = dataTextureBuffer.edgeIndices_8Bits;
            } else if (numVertices <= (1 << 16)) {
                edgeIndicesBuffer = dataTextureBuffer.edgeIndices_16Bits;
            } else {
                edgeIndicesBuffer = dataTextureBuffer.edgeIndices_32Bits;
            }
            edgeIndicesBase = edgeIndicesBuffer.length / 2;
            for (let i = 0, len = edgeIndices.length; i < len; i++) {
                edgeIndicesBuffer.push(edgeIndices[i]);
            }
        }
        state.numVertices += numVertices;
        return <GeometryBucketHandle>{
            vertexBase,
            numVertices,
            numTriangles,
            numEdges,
            indicesBase,
            edgeIndicesBase
        };
    }

    createMesh(meshParams: MeshParams): number {
        if (this.#finalized) {
            throw "Already finalized";
        }
        // if (origin) {
        //     this.state.origin = origin;
        //     worldAABB[0] += origin[0];
        //     worldAABB[1] += origin[1];
        //     worldAABB[2] += origin[2];
        //     worldAABB[3] += origin[0];
        //     worldAABB[4] += origin[1];
        //     worldAABB[5] += origin[2];
        // }
        // math.boundaries.expandAABB3(this.aabb, worldAABB);
        const meshId = this.#numMeshes;
        const meshPartIds: number[] = [];
        this.#eachMeshParts.push(meshPartIds);
        if (!meshParams.geometryId) {
            throw "geometryId expected";
        }
        const geometryHandle = this.#geometryHandles[meshParams.geometryId];
        if (!geometryHandle) {
            throw "Geometry not found";
        }
        geometryHandle.geometryBucketHandles.forEach((geometryBucketHandle: GeometryBucketHandle) => {
            const meshPartParams = <MeshPartParams>{
                aabb: geometryHandle.aabb
            };
            const meshPartId = this.#createMeshPart(meshParams, geometryHandle, geometryBucketHandle, meshPartParams);
            meshPartIds.push(meshPartId);
        });
        const worldAABB = math.boundaries.collapseAABB3();
        const geometryOBB = math.boundaries.AABB3ToOBB3(geometryHandle.aabb);
        for (let i = 0, len = geometryOBB.length; i < len; i += 4) {
            tempVec4a[0] = geometryOBB[i + 0];
            tempVec4a[1] = geometryOBB[i + 1];
            tempVec4a[2] = geometryOBB[i + 2];
            math.transformPoint4(meshParams.matrix, tempVec4a, tempVec4b);
            // if (worldMatrix) {
            //     math.transformPoint4(worldMatrix, tempVec4b, tempVec4c);
            //     math.boundaries.expandAABB3Point3(worldAABB, tempVec4c);
            // } else {
            math.boundaries.expandAABB3Point3(worldAABB, tempVec4b);
            //}
        }
        this.#modelMeshCounts.numMeshes++;
        this.#numMeshes++;
        return meshId;
    }

    #createMeshPart(meshParams: MeshParams, geometryHandle: GeometryHandle, geometryBucketHandle: GeometryBucketHandle, meshPartParams: MeshPartParams): number {

        const dataTextureBuffer = this.#dataTextureBuffer;

        const scene = this.sceneModel.scene;
        const state = this.state;

        const matrix = meshParams.matrix || identityMatrix;
        const color = meshParams.color || [255, 255, 255];
        const opacity = meshParams.opacity;
        const metallic = meshParams.metallic;
        const roughness = meshParams.roughness;

        const positionsIndex = dataTextureBuffer.positions.length;
        const vertsIndex = positionsIndex / 3;

        // Positions decompression matrix

        dataTextureBuffer.eachMeshPositionsDecompressMatrix.push(geometryHandle.positionsDecompressMatrix);

        // Modeling matrix

        dataTextureBuffer.eachMeshMatrices.push(matrix);

        // Color

        dataTextureBuffer.eachMeshColor.push([color[0], color[1], color[2], 255]);

        // Pick color

        dataTextureBuffer.eachMeshPickColor.push(meshParams.pickColor);

        // Vertex portion

        let currentNumIndices;
        if (geometryBucketHandle.numVertices <= (1 << 8)) {
            currentNumIndices = state.numIndices8Bits;
        } else if (geometryBucketHandle.numVertices <= (1 << 16)) {
            currentNumIndices = state.numIndices16Bits;
        } else {
            currentNumIndices = state.numIndices32Bits;
        }
        dataTextureBuffer.eachMeshVertexPortionBase.push(geometryBucketHandle.vertexBase);
        dataTextureBuffer.eachMeshVertexPortionOffset.push(currentNumIndices / 3 - geometryBucketHandle.indicesBase);

        // Edge indices

        let currentNumEdgeIndices;
        if (geometryBucketHandle.numVertices <= (1 << 8)) {
            currentNumEdgeIndices = state.numEdgeIndices8Bits;
        } else if (geometryBucketHandle.numVertices <= (1 << 16)) {
            currentNumEdgeIndices = state.numEdgeIndices16Bits;
        } else {
            currentNumEdgeIndices = state.numEdgeIndices32Bits;
        }
        dataTextureBuffer.eachMeshEdgeIndicesOffset.push(currentNumEdgeIndices / 2 - geometryBucketHandle.edgeIndicesBase);

        // Index -> mesh lookup

        const meshPartId = this.#meshPartHandles.length;

        if (geometryBucketHandle.numTriangles > 0) {
            const numIndices = geometryBucketHandle.numTriangles * 3;
            let indicesMeshIdBuffer;
            if (geometryBucketHandle.numVertices <= (1 << 8)) {
                indicesMeshIdBuffer = dataTextureBuffer.eachTriangleMesh_8Bits;
                state.numIndices8Bits += numIndices;
            } else if (geometryBucketHandle.numVertices <= (1 << 16)) {
                indicesMeshIdBuffer = dataTextureBuffer.eachTriangleMesh_16Bits;
                state.numIndices16Bits += numIndices;
            } else {
                indicesMeshIdBuffer = dataTextureBuffer.eachTriangleMesh_32Bits;
                state.numIndices32Bits += numIndices;
            }
            for (let i = 0; i < geometryBucketHandle.numTriangles; i += INDICES_EDGE_INDICES_ALIGNMENT_SIZE) {
                indicesMeshIdBuffer.push(meshPartId);
            }
        }

        // Edge index -> mesh lookup

        if (geometryBucketHandle.numEdges > 0) {
            let numEdgeIndices = geometryBucketHandle.numEdges * 2;
            let edgeIndicesMeshIdBuffer;
            if (geometryBucketHandle.numVertices <= (1 << 8)) {
                edgeIndicesMeshIdBuffer = dataTextureBuffer.eachEdgeMesh_8Bits;
                state.numEdgeIndices8Bits += numEdgeIndices;
            } else if (geometryBucketHandle.numVertices <= (1 << 16)) {
                edgeIndicesMeshIdBuffer = dataTextureBuffer.eachEdgeMesh_16Bits;
                state.numEdgeIndices16Bits += numEdgeIndices;
            } else {
                edgeIndicesMeshIdBuffer = dataTextureBuffer.eachEdgeMesh_32Bits;
                state.numEdgeIndices32Bits += numEdgeIndices;
            }
            for (let i = 0; i < geometryBucketHandle.numEdges; i += INDICES_EDGE_INDICES_ALIGNMENT_SIZE) {
                edgeIndicesMeshIdBuffer.push(meshPartId);
            }
        }
        dataTextureBuffer.eachEdgeOffset.push([0, 0, 0]);

        this.#meshPartHandles.push(<MeshPartHandle>{
            vertsBase: vertsIndex,
            numVerts: geometryBucketHandle.numTriangles
        });
        this.#numMeshParts++;
        return meshPartId;
    }

    finalize() {
        if (this.#finalized) {
            throw "Already finalized";
        }
        const gl = this.#gl;
        const dataTextureFactory = new DataTextureFactory();
        const dataTextureBuffer = this.#dataTextureBuffer;
        const dataTextureSet = this.state.dataTextureSet;
        dataTextureSet.cameraMatrices = dataTextureFactory.createCameraMatricesDataTexture(gl, this.sceneModel.scene.viewer.viewList[0].camera, /* HACK */this.state.origin.slice());
        dataTextureSet.sceneModelMatrices = dataTextureFactory.createSceneModelMatricesDataTexture(gl, this.sceneModel);
        dataTextureSet.positions = dataTextureFactory.createPositionsDataTexture(gl, dataTextureBuffer.positions);
        dataTextureSet.indices_8Bits = dataTextureFactory.createIndices8BitDataTexture(gl, dataTextureBuffer.indices_8Bits);
        dataTextureSet.indices_16Bits = dataTextureFactory.createIndices16BitDataTexture(gl, dataTextureBuffer.indices_16Bits);
        dataTextureSet.indices_32Bits = dataTextureFactory.createIndices32BitDataTexture(gl, dataTextureBuffer.indices_32Bits);
        dataTextureSet.edgeIndices_8Bits = dataTextureFactory.createEdgeIndices8BitDataTexture(gl, dataTextureBuffer.edgeIndices_8Bits);
        dataTextureSet.edgeIndices_16Bits = dataTextureFactory.createEdgeIndices16BitDataTexture(gl, dataTextureBuffer.edgeIndices_16Bits);
        dataTextureSet.edgeIndices_32Bits = dataTextureFactory.createEdgeIndices32BitDataTexture(gl, dataTextureBuffer.edgeIndices_32Bits);
        dataTextureSet.eachMeshAttributes = dataTextureFactory.createEachMeshAttributesDataTexture(gl,
            dataTextureBuffer.eachMeshColor,
            dataTextureBuffer.eachMeshPickColor,
            dataTextureBuffer.eachMeshVertexPortionBase,
            dataTextureBuffer.eachMeshVertexPortionOffset,
            dataTextureBuffer.eachMeshEdgeIndicesOffset);
        dataTextureSet.eachMeshMatrices = dataTextureFactory.createEachMeshMatricesDataTexture(gl, dataTextureBuffer.eachMeshPositionsDecompressMatrix, dataTextureBuffer.eachMeshMatrices);
        // dataTextureSet.eachTriangleMesh8BitsDataTexture = dataTextureFactory.createPointerTableDataTexture(gl, dataTextureBuffer.eachTriangleMesh_8Bits);
        // dataTextureSet.eachTriangleMesh16BitsDataTexture = dataTextureFactory.createPointerTableDataTexture(gl, dataTextureBuffer.eachTriangleMesh_16Bits);
        // dataTextureSet.eachTriangleMesh32BitsDataTexture = dataTextureFactory.createPointerTableDataTexture(gl, dataTextureBuffer.eachTriangleMesh_32Bits);
        // dataTextureSet.eachEdgeMesh8BitsDataTexture = dataTextureFactory.createPointerTableDataTexture(gl, dataTextureBuffer.eachEdgeMesh_8Bits);
        // dataTextureSet.eachEdgeMesh16BitsDataTexture = dataTextureFactory.createPointerTableDataTexture(gl, dataTextureBuffer.eachEdgeMesh_16Bits);
        // dataTextureSet.eachEdgeMesh32BitsDataTexture = dataTextureFactory.createPointerTableDataTexture(gl, dataTextureBuffer.eachEdgeMesh_32Bits);
        dataTextureSet.eachEdgeOffset = dataTextureFactory.createEachEdgeOffsetDataTexture(gl, dataTextureBuffer.eachEdgeOffset);
        dataTextureSet.finalize();
        this.#dataTextureBuffer = null;
        this.#geometryHandles = {};
        this.#meshPartHandles = [];
        this.#eachMeshParts = [];
        this.#finalized = true;
    }

    isEmpty() {
        return this.#numMeshes == 0;
    }

    initFlags(meshId: number, flags: number, meshTransparent: boolean) {
        if (flags & SceneObjectFlags.VISIBLE) {
            this.#numVisibleMeshes++;
            this.#modelMeshCounts.numVisibleMeshes++;
        }
        if (flags & SceneObjectFlags.HIGHLIGHTED) {
            this.#numHighlightedMeshes++;
            this.#modelMeshCounts.numHighlightedMeshes++;
        }
        if (flags & SceneObjectFlags.XRAYED) {
            this.#numXRayedMeshes++;
            this.#modelMeshCounts.numXRayedMeshes++;
        }
        if (flags & SceneObjectFlags.SELECTED) {
            this.#numSelectedMeshes++;
            this.#modelMeshCounts.numSelectedMeshes++;
        }
        if (flags & SceneObjectFlags.CLIPPABLE) {
            this.#numClippableMeshes++;
            this.#modelMeshCounts.numClippableMeshes++;
        }
        if (flags & SceneObjectFlags.EDGES) {
            this.#numEdgesMeshes++;
            this.#modelMeshCounts.numEdgesMeshes++;
        }
        if (flags & SceneObjectFlags.PICKABLE) {
            this.#numPickableMeshes++;
            this.#modelMeshCounts.numPickableMeshes++;
        }
        if (flags & SceneObjectFlags.CULLED) {
            this.#numCulledMeshes++;
            this.#modelMeshCounts.numCulledMeshes++;
        }
        if (meshTransparent) {
            this.#numTransparentMeshes++;
            this.#modelMeshCounts.numTransparentMeshes++;
        }
        this.#setMeshFlags(meshId, flags, meshTransparent);
        this.#setMeshFlags2(meshId, flags);
    }

    beginDeferredFlags() {
        this.#deferredSetFlagsActive = true;
    }

    commitDeferredFlags() {
        this.#deferredSetFlagsActive = false;
        if (!this.#deferredSetFlagsDirty) {
            return;
        }
        this.#deferredSetFlagsDirty = false;
        const gl = this.#gl;
        const dataTextureSet = this.state.dataTextureSet;
        gl.bindTexture(gl.TEXTURE_2D, dataTextureSet.eachMeshAttributes.texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, dataTextureSet.eachMeshAttributes.textureWidth, dataTextureSet.eachMeshAttributes.textureHeight, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, dataTextureSet.eachMeshAttributes.textureData);
        gl.bindTexture(gl.TEXTURE_2D, dataTextureSet.eachEdgeOffset.texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, dataTextureSet.eachEdgeOffset.textureWidth, dataTextureSet.eachEdgeOffset.textureHeight, gl.RGB, gl.FLOAT, dataTextureSet.eachEdgeOffset.textureData);
    }

    flushInitFlags() {
        this.commitDeferredFlags();
    }

    setMeshVisible(meshId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.VISIBLE) {
            this.#numVisibleMeshes++;
            this.#modelMeshCounts.numVisibleMeshes++;
        } else {
            this.#numVisibleMeshes--;
            this.#modelMeshCounts.numVisibleMeshes--;
        }
        this.#setMeshFlags(meshId, flags, transparent);
    }

    setMeshHighlighted(meshId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.HIGHLIGHTED) {
            this.#numHighlightedMeshes++;
            this.#modelMeshCounts.numHighlightedMeshes++;
        } else {
            this.#numHighlightedMeshes--;
            this.#modelMeshCounts.numHighlightedMeshes--;
        }
        this.#setMeshFlags(meshId, flags, transparent);
    }

    setMeshXRayed(meshId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.XRAYED) {
            this.#numXRayedMeshes++;
            this.#modelMeshCounts.numXRayedMeshes++;
        } else {
            this.#numXRayedMeshes--;
            this.#modelMeshCounts.numXRayedMeshes--;
        }
        this.#setMeshFlags(meshId, flags, transparent);
    }

    setMeshSelected(meshId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.SELECTED) {
            this.#numSelectedMeshes++;
            this.#modelMeshCounts.numSelectedMeshes++;
        } else {
            this.#numSelectedMeshes--;
            this.#modelMeshCounts.numSelectedMeshes--;
        }
        this.#setMeshFlags(meshId, flags, transparent);
    }

    setMeshEdges(meshId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.EDGES) {
            this.#numEdgesMeshes++;
            this.#modelMeshCounts.numEdgesMeshes++;
        } else {
            this.#numEdgesMeshes--;
            this.#modelMeshCounts.numEdgesMeshes--;
        }
        this.#setMeshFlags(meshId, flags, transparent);
    }

    setMeshClippable(meshId: number, flags: number) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.CLIPPABLE) {
            this.#numClippableMeshes++;
            this.#modelMeshCounts.numClippableMeshes++;
        } else {
            this.#numClippableMeshes--;
            this.#modelMeshCounts.numClippableMeshes--;
        }
        this.#setMeshFlags2(meshId, flags);
    }

    setMeshCulled(meshId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.CULLED) {
            this.#numCulledMeshes += this.#eachMeshParts[meshId].length;
            this.#modelMeshCounts.numCulledMeshes++;
        } else {
            this.#numCulledMeshes -= this.#eachMeshParts[meshId].length;
            this.#modelMeshCounts.numCulledMeshes--;
        }
        this.#setMeshFlags(meshId, flags, transparent);
    }

    setMeshCollidable(meshId: number, flags: number) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
    }

    setMeshPickable(meshId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.PICKABLE) {
            this.#numPickableMeshes++;
            this.#modelMeshCounts.numPickableMeshes++;
        } else {
            this.#numPickableMeshes--;
            this.#modelMeshCounts.numPickableMeshes--;
        }
        this.#setMeshFlags(meshId, flags, transparent);
    }

    setMeshColor(meshId: number, color: math.FloatArrayType, transparent?: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        const dataTextureSet = this.state.dataTextureSet;
        const gl = this.#gl;
        tempUint8Array4 [0] = color[0];
        tempUint8Array4 [1] = color[1];
        tempUint8Array4 [2] = color[2];
        tempUint8Array4 [3] = color[3];
        dataTextureSet.eachMeshAttributes.textureData.set(tempUint8Array4, meshId * 28);
        if (this.#deferredSetFlagsActive) {
            this.#deferredSetFlagsDirty = true;
            return;
        }
        gl.bindTexture(gl.TEXTURE_2D, dataTextureSet.eachMeshAttributes.texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, meshId, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, tempUint8Array4);
        // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    setMeshTransparent(meshId: number, flags: number, transparent: boolean) {
        if (transparent) {
            this.#numTransparentMeshes++;
            this.#modelMeshCounts.numTransparentMeshes++;
        } else {
            this.#numTransparentMeshes--;
            this.#modelMeshCounts.numTransparentMeshes--;
        }
        this.#setMeshFlags(meshId, flags, transparent);
    }

    #setMeshFlags(meshId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        const visible = !!(flags & SceneObjectFlags.VISIBLE);
        const xrayed = !!(flags & SceneObjectFlags.XRAYED);
        const highlighted = !!(flags & SceneObjectFlags.HIGHLIGHTED);
        const selected = !!(flags & SceneObjectFlags.SELECTED);
        const edges = !!(flags & SceneObjectFlags.EDGES);
        const pickable = !!(flags & SceneObjectFlags.PICKABLE);
        const culled = !!(flags & SceneObjectFlags.CULLED);
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
        let f3 = (visible && !culled && pickable) ? RENDER_PASSES.PICK : RENDER_PASSES.NOT_RENDERED;
        const dataTextureSet = this.state.dataTextureSet;
        const gl = this.#gl;
        tempUint8Array4 [0] = f0;
        tempUint8Array4 [1] = f1;
        tempUint8Array4 [2] = f2;
        tempUint8Array4 [3] = f3;
        dataTextureSet.eachMeshAttributes.textureData.set(tempUint8Array4, meshId * 28 + 8);
        if (this.#deferredSetFlagsActive) {
            this.#deferredSetFlagsDirty = true;
            return;
        }
        gl.bindTexture(gl.TEXTURE_2D, dataTextureSet.eachMeshAttributes.texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 2, meshId, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, tempUint8Array4);
        // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    #setMeshFlags2(meshId: number, flags: number) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        const clippable = !!(flags & SceneObjectFlags.CLIPPABLE) ? 255 : 0;
        const dataTextureSet = this.state.dataTextureSet;
        const gl = this.#gl;
        tempUint8Array4 [0] = clippable;
        tempUint8Array4 [1] = 0;
        tempUint8Array4 [2] = 1;
        tempUint8Array4 [3] = 2;
        dataTextureSet.eachMeshAttributes.textureData.set(tempUint8Array4, meshId * 28 + 12); // Flags
        if (this.#deferredSetFlagsActive) {
            this.#deferredSetFlagsDirty = true;
            return;
        }
        gl.bindTexture(gl.TEXTURE_2D, dataTextureSet.eachMeshAttributes.texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 3, meshId, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, tempUint8Array4);
        // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    setMeshOffset(meshId: number, offset: math.FloatArrayType) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        const dataTextureSet = this.state.dataTextureSet;
        const gl = this.#gl;
        tempFloat32Array3 [0] = offset[0];
        tempFloat32Array3 [1] = offset[1];
        tempFloat32Array3 [2] = offset[2];
       // dataTextureSet.eachMeshOffset.textureData.set(tempFloat32Array3, meshId * 3);
        if (this.#deferredSetFlagsActive) {
            this.#deferredSetFlagsDirty = true;
            return;
        }
        //gl.bindTexture(gl.TEXTURE_2D, dataTextureSet.eachMeshOffset.texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, meshId, 1, 1, gl.RGB, gl.FLOAT, tempFloat32Array3);
        // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    // ---------------------- COLOR RENDERING -----------------------------------

    drawColorOpaque(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledMeshes === this.#numMeshes || this.#numVisibleMeshes === 0 || this.#numTransparentMeshes === this.#numMeshes || this.#numXRayedMeshes === this.#numMeshes) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (frameContext.withSAO && this.sceneModel.qualityRender) {
            if (frameContext.pbrEnabled && this.sceneModel.qualityRender) {
                if (this.#renderers.colorQualityRendererWithSAO) {
                    this.#renderers.colorQualityRendererWithSAO.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
                }
            } else {
                if (this.#renderers.colorRendererWithSAO) {
                    this.#renderers.colorRendererWithSAO.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
                }
            }
        } else {
            if (frameContext.pbrEnabled && this.sceneModel.qualityRender) {
                if (this.#renderers.qualityColorRenderer) {
                    this.#renderers.qualityColorRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
                }
            } else {
                if (this.#renderers.fastColorRenderer) {
                    this.#renderers.fastColorRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
                }
            }
        }
    }

    #updateBackfaceCull(drawFlags: DrawFlags, frameContext: FrameContext) {
        // const backfaces = this.sceneModel.backfaces || (!this.solid) || drawFlags.sectioned;
        // if (frameContext.backfaces !== backfaces) {
        //     const gl = frameContext.gl;
        //     if (backfaces) {
        //         gl.disable(gl.CULL_FACE);
        //     } else {
        //         gl.enable(gl.CULL_FACE);
        //     }
        //     frameContext.backfaces = backfaces;
        // }
    }

    drawColorTransparent(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledMeshes === this.#numMeshes || this.#numVisibleMeshes === 0 || this.#numTransparentMeshes === 0 || this.#numXRayedMeshes === this.#numMeshes) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (frameContext.pbrEnabled && this.sceneModel.qualityRender) {
            if (this.#renderers.qualityColorRenderer) {
                this.#renderers.qualityColorRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_TRANSPARENT);
            }
        } else {
            if (this.#renderers.fastColorRenderer) {
                this.#renderers.fastColorRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_TRANSPARENT);
            }
        }
    }

    // ---------------------- RENDERING SAO POST EFFECT TARGETS --------------

    drawDepth(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledMeshes === this.#numMeshes || this.#numVisibleMeshes === 0 || this.#numTransparentMeshes === this.#numMeshes || this.#numXRayedMeshes === this.#numMeshes) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (this.#renderers.depthRenderer) {
            this.#renderers.depthRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE); // Assume whatever post-effect uses depth (eg SAO) does not apply to transparent objects
        }
    }

    drawNormals(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledMeshes === this.#numMeshes || this.#numVisibleMeshes === 0 || this.#numTransparentMeshes === this.#numMeshes || this.#numXRayedMeshes === this.#numMeshes) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (this.#renderers.normalsRenderer) {
            this.#renderers.normalsRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);  // Assume whatever post-effect uses normals (eg SAO) does not apply to transparent objects
        }
    }

    // ---------------------- SILHOUETTE RENDERING -----------------------------------

    drawSilhouetteXRayed(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledMeshes === this.#numMeshes || this.#numVisibleMeshes === 0 || this.#numXRayedMeshes === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (this.#renderers.silhouetteRenderer) {
            this.#renderers.silhouetteRenderer.drawLayer(frameContext, this, RENDER_PASSES.SILHOUETTE_XRAYED);
        }
    }

    drawSilhouetteHighlighted(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledMeshes === this.#numMeshes || this.#numVisibleMeshes === 0 || this.#numHighlightedMeshes === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (this.#renderers.silhouetteRenderer) {
            this.#renderers.silhouetteRenderer.drawLayer(frameContext, this, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED);
        }
    }

    drawSilhouetteSelected(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledMeshes === this.#numMeshes || this.#numVisibleMeshes === 0 || this.#numSelectedMeshes === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (this.#renderers.silhouetteRenderer) {
            this.#renderers.silhouetteRenderer.drawLayer(frameContext, this, RENDER_PASSES.SILHOUETTE_SELECTED);
        }
    }

    // ---------------------- EDGES RENDERING -----------------------------------

    drawEdgesColorOpaque(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledMeshes === this.#numMeshes || this.#numVisibleMeshes === 0 || this.#numEdgesMeshes === 0) {
            return;
        }
        if (this.#renderers.edgesColorRenderer) {
            this.#renderers.edgesColorRenderer.drawLayer(frameContext, this, RENDER_PASSES.EDGES_COLOR_OPAQUE);
        }
    }

    drawEdgesColorTransparent(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledMeshes === this.#numMeshes || this.#numVisibleMeshes === 0 || this.#numEdgesMeshes === 0 || this.#numTransparentMeshes === 0) {
            return;
        }
        if (this.#renderers.edgesColorRenderer) {
            this.#renderers.edgesColorRenderer.drawLayer(frameContext, this, RENDER_PASSES.EDGES_COLOR_TRANSPARENT);
        }
    }

    drawEdgesHighlighted(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledMeshes === this.#numMeshes || this.#numVisibleMeshes === 0 || this.#numHighlightedMeshes === 0) {
            return;
        }
        if (this.#renderers.edgesRenderer) {
            this.#renderers.edgesRenderer.drawLayer(frameContext, this, RENDER_PASSES.EDGES_HIGHLIGHTED);
        }
    }

    drawEdgesSelected(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledMeshes === this.#numMeshes || this.#numVisibleMeshes === 0 || this.#numSelectedMeshes === 0) {
            return;
        }
        if (this.#renderers.edgesRenderer) {
            this.#renderers.edgesRenderer.drawLayer(frameContext, this, RENDER_PASSES.EDGES_SELECTED);
        }
    }

    drawEdgesXRayed(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledMeshes === this.#numMeshes || this.#numVisibleMeshes === 0 || this.#numXRayedMeshes === 0) {
            return;
        }
        if (this.#renderers.edgesRenderer) {
            this.#renderers.edgesRenderer.drawLayer(frameContext, this, RENDER_PASSES.EDGES_XRAYED);
        }
    }

    // ---------------------- OCCLUSION CULL RENDERING -----------------------------------

    drawOcclusion(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledMeshes === this.#numMeshes || this.#numVisibleMeshes === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (this.#renderers.occlusionRenderer) {
            this.#renderers.occlusionRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
        }
    }

    // ---------------------- SHADOW BUFFER RENDERING -----------------------------------

    drawShadow(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledMeshes === this.#numMeshes || this.#numVisibleMeshes === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        // if (this.#renderers.shadowRenderer) {
        //     this.#renderers.shadowRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
        // }
    }

    //---- PICKING ----------------------------------------------------------------------------------------------------

    drawPickMesh(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledMeshes === this.#numMeshes || this.#numVisibleMeshes === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (this.#renderers.pickMeshRenderer) {
            this.#renderers.pickMeshRenderer.drawLayer(frameContext, this, RENDER_PASSES.PICK);
        }
    }

    drawPickDepths(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledMeshes === this.#numMeshes || this.#numVisibleMeshes === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (this.#renderers.pickDepthRenderer) {
            this.#renderers.pickDepthRenderer.drawLayer(frameContext, this, RENDER_PASSES.PICK);
        }
    }

    drawPickNormals(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledMeshes === this.#numMeshes || this.#numVisibleMeshes === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (this.#renderers.pickNormalsRenderer) {
            this.#renderers.pickNormalsRenderer.drawLayer(frameContext, this, RENDER_PASSES.PICK);
        }
    }

    //------------------------------------------------------------------------------------------------

    precisionRayPickSurface(meshId: string, worldRayOrigin: math.FloatArrayType, worldRayDir: any, worldSurfacePos: { set: (arg0: math.FloatArrayType) => void; }, worldNormal: math.FloatArrayType) {
    }

    // ---------

    destroy() {
        this.state.dataTextureSet.destroy();
    }
}

