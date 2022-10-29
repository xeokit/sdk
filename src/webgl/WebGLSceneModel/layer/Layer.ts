import {DataTextureBuffer} from "./DataTextureBuffer";
import {DataTextureSet} from "./DataTextureSet";
import {DataTextureFactory} from "./DataTextureFactory";
import {FrameContext} from "../../WebGLRenderer/FrameContext";
import {DrawFlags} from "../../WebGLRenderer/DrawFlags";

import {LayerParams} from "./LayerParams";
import {MeshParams} from "./MeshParams";
import {GeometryParams} from "./GeometryParams";

import {Geometry} from "./Geometry";

import {MeshPart} from "./MeshPart";

// @ts-ignore
import {uniquifyPositions} from "./calculateUniquePositions.js";
// @ts-ignore
import {rebucketPositions} from "./rebucketPositions.js";

import {SceneObjectFlags} from './SceneObjectFlags';
import {RENDER_PASSES} from '../lib/RENDER_PASSES';

import {
    Component,
    Scene,
    View,
    SceneModel,
    Events,
    utils,
    math,
    Renderer,
    SceneObjectParams,
    TextureParams,
    TextureSetParams,
    constants
} from "../../../viewer/index";

import {MeshCounts} from "./MeshCounts";
import {WebGLSceneModel} from "../WebGLSceneModel";

/**
 * 12-bits allowed for object ids.
 *
 * Limits the per-object texture height in the layer.
 */
const MAX_MESH_PARTS = (1 << 12);

/**
 * 2048 is max data texture height
 *
 * Limits the aggregated geometry texture height in the layer.
 */
const MAX_DATATEXTURE_HEIGHT = (1 << 11);

/**
 * Align `indices` and `edgeIndices` memory layout to 8 elements.
 *
 * Used as an optimization for the `...meshIds...` texture, so it
 * can just be stored 1 out of 8 `meshIds` corresponding to a given
 * `triangle-index` or `edge-index`.
 */
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

export class Layer {

    #meshCounts: MeshCounts;

    primitive: number;
    layerIndex: number;
    sceneModel: WebGLSceneModel;
    state: any;
    aabb: math.FloatArrayType;

    #gl: WebGL2RenderingContext;
    #dataTextureBuffer: DataTextureBuffer;
    #renderers: any;
    #instancedGeometries: { [key: number | string]: any };
    #meshParts: MeshPart[];
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

    constructor(layerParams: LayerParams, renderers: any) {

        this.#meshCounts = layerParams.meshCounts;

        this.primitive = layerParams.primitive;
        this.layerIndex = layerParams.layerIndex;
        this.sceneModel = layerParams.sceneModel;

        this.#gl = layerParams.gl;
        this.#dataTextureBuffer = new DataTextureBuffer();
        this.#renderers = renderers;

        this.state = {
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
        this.#instancedGeometries = {};
        this.#meshParts = [];
        this.#eachMeshParts = [];

        if (layerParams.origin) {
            this.state.origin = math.vec3(layerParams.origin);
        }

        this.aabb = math.boundaries.collapseAABB3();

        this.#finalized = false;
    }

    canCreateMesh(params: {
        geometryId?: any;
        geometries?: GeometryParams[];
        indices?: math.IntArrayType[];
    }): boolean {
        if (this.#finalized) {
            throw "Already finalized";
        }
        const state = this.state;
        const numNewMeshParts = params.geometries.length;
        if ((this.#numMeshParts + numNewMeshParts) > MAX_MESH_PARTS) {
            //  dataTextureRamStats.cannotCreateMesh.because10BitsObjectId++;
        }
        let canCreate = (this.#numMeshParts + numNewMeshParts) <= MAX_MESH_PARTS;
        const geometryFound = params.geometryId !== null && (params.geometryId + "#0") in this.#instancedGeometries;
        if (!geometryFound) {
            const primVerts = (this.primitive === constants.PointsPrimitive) ? 1 : (this.primitive == constants.LinesPrimitive ? 2 : 3);
            const maxIndicesOfAnyBits = Math.max(state.numIndices8Bits, state.numIndices16Bits, state.numIndices32Bits);
            let numVertices = 0;
            let numIndices = params.indices.length / 3;
            params.geometries.forEach((geometryParams: GeometryParams) => {
                numVertices += geometryParams.positions.length / primVerts;
            });
            canCreate &&= (state.numVertices + numVertices) <= MAX_DATATEXTURE_HEIGHT * 1024 && (maxIndicesOfAnyBits + numIndices) <= MAX_DATATEXTURE_HEIGHT * 1024;
        }
        return canCreate;
    }

    createMesh(meshParams: MeshParams, objectCfg: any = null): number {
        if (this.#finalized) {
            throw "Already finalized";
        }
        const instancing = objectCfg !== null;
        const meshId = this.#numMeshes;
        const meshAABB = instancing ? objectCfg.aabb : meshParams.aabb;
        const meshPartIds: number[] = [];
        this.#eachMeshParts.push(meshPartIds);
        meshParams.geometries.forEach(
            (geometryParams: GeometryParams, geometryIndex: number) => {
                let geometry;
                if (instancing) {
                    const geometryId = `${meshParams.id}#${geometryIndex}`;
                    if (!(geometryId in this.#instancedGeometries)) {
                        this.#instancedGeometries[geometryId] = this.#createGeometry(geometryParams);
                    }
                    geometry = this.#instancedGeometries[geometryId];
                } else {
                    geometry = this.#createGeometry(geometryParams);
                }
                const aabb = math.boundaries.collapseAABB3();
                math.boundaries.expandAABB3(meshAABB, aabb);
                const meshPartId = this.#createMeshPart(
                    instancing ? objectCfg : meshParams, // TODO: Tidy up
                    geometry,
                    geometry.positions,
                    meshParams.positionsDecodeMatrix,
                    meshParams.origin,
                    aabb,
                    instancing
                );
                meshPartIds.push(meshPartId);
            });
        this.#meshCounts.numMeshes++;
        this.#numMeshes++;
        return meshId;
    }

    #createGeometry(geometryParams: GeometryParams): Geometry {

        const state = this.state;

        // Indices alignment;
        // This will make every mesh consume a multiple of INDICES_EDGE_INDICES_ALIGNMENT_SIZE
        // array items for storing the triangles of the mesh, and it supports:
        // - a memory optimization of factor INDICES_EDGE_INDICES_ALIGNMENT_SIZE
        // - in exchange for a small RAM overhead
        //   (by adding some padding until a size that is multiple of INDICES_EDGE_INDICES_ALIGNMENT_SIZE)

        if (geometryParams.indices) {
            const alignedIndicesLen = Math.ceil((geometryParams.indices.length / 3) / INDICES_EDGE_INDICES_ALIGNMENT_SIZE) * INDICES_EDGE_INDICES_ALIGNMENT_SIZE * 3;
            const alignedIndices = new Uint32Array(alignedIndicesLen);
            alignedIndices.fill(0);
            alignedIndices.set(geometryParams.indices);
            geometryParams.indices = alignedIndices;
        }

        // EdgeIndices alignment;
        // This will make every mesh consume a multiple of INDICES_EDGE_INDICES_ALIGNMENT_SIZE
        // array items for storing the edges of the mesh, and it supports:
        // - a memory optimization of factor INDICES_EDGE_INDICES_ALIGNMENT_SIZE
        // - in exchange for a small RAM overhead
        //   (by adding some padding until a size that is multiple of INDICES_EDGE_INDICES_ALIGNMENT_SIZE)

        if (geometryParams.edgeIndices) {
            const alignedEdgeIndicesLen = Math.ceil((geometryParams.edgeIndices.length / 2) / INDICES_EDGE_INDICES_ALIGNMENT_SIZE) * INDICES_EDGE_INDICES_ALIGNMENT_SIZE * 2;
            const alignedEdgeIndices = new Uint32Array(alignedEdgeIndicesLen);
            alignedEdgeIndices.fill(0);
            alignedEdgeIndices.set(geometryParams.edgeIndices);
            geometryParams.edgeIndices = alignedEdgeIndices;
        }

        const positions = geometryParams.positions;
        const indices = geometryParams.indices;
        const edgeIndices = geometryParams.edgeIndices;

        const dataTextureBuffer = this.#dataTextureBuffer;
        const vertexBase = dataTextureBuffer.positions.length / 3;
        const numVertices = positions.length / 3;

        for (let i = 0, len = positions.length; i < len; i++) {
            dataTextureBuffer.positions.push(positions[i]);
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

        return { // Geometry
            vertexBase,
            numVertices: numVertices,
            numTriangles,
            numEdges,
            indicesBase,
            edgeIndicesBase
        };
    }

    #createMeshPart(params: {
                        color: math.FloatArrayType;
                        metallic: number;
                        roughness: number;
                        colors: math.FloatArrayType;
                        opacity: number;
                        meshMatrix: math.FloatArrayType;
                        worldMatrix: math.FloatArrayType;
                        pickColor: math.FloatArrayType;
                    },
                    geometry: Geometry,
                    positionsCompressed: math.FloatArrayType,
                    positionsDecodeMatrix: math.FloatArrayType,
                    origin: math.FloatArrayType,
                    worldAABB: math.FloatArrayType,
                    instancing: boolean
    ) {

        const color = params.color;
        const metallic = params.metallic;
        const roughness = params.roughness;
        const colors = params.colors;
        const opacity = params.opacity;
        const meshMatrix = params.meshMatrix;
        const worldMatrix = params.worldMatrix;
        const pickColor = params.pickColor;
        const scene = this.sceneModel.scene;
        const dataTextureBuffer = this.#dataTextureBuffer;
        const state = this.state;

        dataTextureBuffer.eachMeshPositionsDecompressMatrix.push(positionsDecodeMatrix);

        if (instancing) {

            let transposedMat = math.transposeMat4(meshMatrix, math.mat4()); // TODO: Use cached matrix
            let normalMatrix = math.inverseMat4(transposedMat);

            dataTextureBuffer.eachMeshMatrices.push(meshMatrix);
            dataTextureBuffer.eachMeshNormalMatrix.push(normalMatrix);

        } else {

            dataTextureBuffer.eachMeshMatrices.push(identityMatrix);
            dataTextureBuffer.eachMeshNormalMatrix.push(identityMatrix);
        }

        //const positionsCompressed = params.positions;
        const positionsIndex = dataTextureBuffer.positions.length;
        const vertsIndex = positionsIndex / 3;

        // Expand the world AABB with the concrete location of the object
        if (instancing) {
            const localAABB = math.boundaries.collapseAABB3();
            math.boundaries.expandAABB3Points3(localAABB, positionsCompressed);
            math.compression.decompressAABB(localAABB, positionsDecodeMatrix);
            const geometryOBB = math.boundaries.AABB3ToOBB3(localAABB);

            for (let i = 0, len = geometryOBB.length; i < len; i += 4) {
                tempVec4a[0] = geometryOBB[i + 0];
                tempVec4a[1] = geometryOBB[i + 1];
                tempVec4a[2] = geometryOBB[i + 2];

                math.transformPoint4(meshMatrix, tempVec4a, tempVec4b);

                if (worldMatrix) {
                    math.transformPoint4(worldMatrix, tempVec4b, tempVec4c);
                    math.boundaries.expandAABB3Point3(worldAABB, tempVec4c);
                } else {
                    math.boundaries.expandAABB3Point3(worldAABB, tempVec4b);
                }
            }
        } else if (positionsDecodeMatrix) {

            const bounds = math.compression.getPositionsBounds(positionsCompressed);

            const min = math.compression.decompressPosition(bounds.min, positionsDecodeMatrix, []);
            const max = math.compression.decompressPosition(bounds.max, positionsDecodeMatrix, []);

            worldAABB[0] = min[0];
            worldAABB[1] = min[1];
            worldAABB[2] = min[2];
            worldAABB[3] = max[0];
            worldAABB[4] = max[1];
            worldAABB[5] = max[2];

            if (worldMatrix) {
                math.boundaries.AABB3ToOBB3(worldAABB, tempOBB3);
                math.boundaries.transformOBB3(worldMatrix, tempOBB3);
                math.boundaries.OBB3ToAABB3(tempOBB3, worldAABB);
            }

        } else {
            if (meshMatrix) {
                for (let i = 0, len = positionsCompressed.length; i < len; i += 3) {

                    tempVec4a[0] = positionsCompressed[i + 0];
                    tempVec4a[1] = positionsCompressed[i + 1];
                    tempVec4a[2] = positionsCompressed[i + 2];

                    math.transformPoint4(meshMatrix, tempVec4a, tempVec4b);

                    positionsCompressed[i + 0] = tempVec4b[0];
                    positionsCompressed[i + 1] = tempVec4b[1];
                    positionsCompressed[i + 2] = tempVec4b[2];

                    math.boundaries.expandAABB3Point3(this.#modelAABB, tempVec4b);

                    if (worldMatrix) {
                        math.transformPoint4(worldMatrix, tempVec4b, tempVec4c);
                        math.boundaries.expandAABB3Point3(worldAABB, tempVec4c);
                    } else {
                        math.boundaries.expandAABB3Point3(worldAABB, tempVec4b);
                    }
                }
            } else {
                for (let i = 0, len = positionsCompressed.length; i < len; i += 3) {

                    tempVec4a[0] = positionsCompressed[i + 0];
                    tempVec4a[1] = positionsCompressed[i + 1];
                    tempVec4a[2] = positionsCompressed[i + 2];

                    math.boundaries.expandAABB3Point3(this.#modelAABB, tempVec4a);

                    if (worldMatrix) {
                        math.transformPoint4(worldMatrix, tempVec4a, tempVec4b);
                        math.boundaries.expandAABB3Point3(worldAABB, tempVec4b);
                    } else {
                        math.boundaries.expandAABB3Point3(worldAABB, tempVec4a);
                    }
                }
            }
        }

        if (origin) {
            this.state.origin = origin;
            worldAABB[0] += origin[0];
            worldAABB[1] += origin[1];
            worldAABB[2] += origin[2];
            worldAABB[3] += origin[0];
            worldAABB[4] += origin[1];
            worldAABB[5] += origin[2];
        }

        math.boundaries.expandAABB3(this.aabb, worldAABB);

        // Colors

        if (colors) {
            dataTextureBuffer.eachMeshColor.push([colors[0] * 255, colors[1] * 255, colors[2] * 255, 255]);
        } else if (color) {
            dataTextureBuffer.eachMeshColor.push([color[0], color[1], color[2], opacity]);
        }

        // Pick color

        dataTextureBuffer.eachMeshPickColor.push(pickColor);
        dataTextureBuffer.eachMeshVertexPortionBase.push(geometry.vertexBase);

        // Indices

        let currentNumIndices;
        if (geometry.numVertices <= (1 << 8)) {
            currentNumIndices = state.numIndices8Bits;
        } else if (geometry.numVertices <= (1 << 16)) {
            currentNumIndices = state.numIndices16Bits;
        } else {
            currentNumIndices = state.numIndices32Bits;
        }
        dataTextureBuffer.eachMeshVertexPortionOffset.push(currentNumIndices / 3 - geometry.indicesBase);

        // Edge indices

        let currentNumEdgeIndices;
        if (geometry.numVertices <= (1 << 8)) {
            currentNumEdgeIndices = state.numEdgeIndices8Bits;
        } else if (geometry.numVertices <= (1 << 16)) {
            currentNumEdgeIndices = state.numEdgeIndices16Bits;
        } else {
            currentNumEdgeIndices = state.numEdgeIndices32Bits;
        }
        dataTextureBuffer.eachMeshEdgeIndicesOffset.push(currentNumEdgeIndices / 2 - geometry.edgeIndicesBase);

        const meshPartId = this.#meshParts.length;

        if (geometry.numTriangles > 0) {
            let numIndices = geometry.numTriangles * 3;
            let indicesMeshIdBuffer;
            if (geometry.numVertices <= (1 << 8)) {
                indicesMeshIdBuffer = dataTextureBuffer.eachTriangleMesh_8Bits;
                state.numIndices8Bits += numIndices;
            } else if (geometry.numVertices <= (1 << 16)) {
                indicesMeshIdBuffer = dataTextureBuffer.eachTriangleMesh_16Bits;
                state.numIndices16Bits += numIndices;
            } else {
                indicesMeshIdBuffer = dataTextureBuffer.eachTriangleMesh_32Bits;
                state.numIndices32Bits += numIndices;
            }
            for (let i = 0; i < geometry.numTriangles; i += INDICES_EDGE_INDICES_ALIGNMENT_SIZE) {
                indicesMeshIdBuffer.push(meshPartId);
            }
        }

        if (geometry.numEdges > 0) {
            let numEdgeIndices = geometry.numEdges * 2;
            let edgeIndicesMeshIdBuffer;
            if (geometry.numVertices <= (1 << 8)) {
                edgeIndicesMeshIdBuffer = dataTextureBuffer.eachEdgeMesh_8Bits;
                state.numEdgeIndices8Bits += numEdgeIndices;
            } else if (geometry.numVertices <= (1 << 16)) {
                edgeIndicesMeshIdBuffer = dataTextureBuffer.eachEdgeMesh_16Bits;
                state.numEdgeIndices16Bits += numEdgeIndices;
            } else {
                edgeIndicesMeshIdBuffer = dataTextureBuffer.eachEdgeMesh_32Bits;
                state.numEdgeIndices32Bits += numEdgeIndices;
            }
            for (let i = 0; i < geometry.numEdges; i += INDICES_EDGE_INDICES_ALIGNMENT_SIZE) {
                edgeIndicesMeshIdBuffer.push(meshPartId);
            }
        }

        dataTextureBuffer.eachEdgeOffset.push([0, 0, 0]);

        this.#meshParts.push({ // MeshPart
            vertsBase: vertsIndex,
            numVerts: geometry.numTriangles
        });

        this.#numMeshParts++;

        return meshPartId;
    }

    finalize() {

        if (this.#finalized) {
            throw "Already finalized";
            return;
        }

        const gl = this.#gl;

        const dataTextureBuffer = this.#dataTextureBuffer;
        const dataTextureFactory = new DataTextureFactory();
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
        dataTextureSet.eachMeshMatrices = dataTextureFactory.createEachMeshMatricesDataTexture(gl,
            dataTextureBuffer.eachMeshPositionsDecompressMatrix,
            dataTextureBuffer.eachMeshMatrices,
            dataTextureBuffer.eachMeshNormalMatrix);
        dataTextureSet.eachTriangleMesh8BitsDataTexture = dataTextureFactory.createPointerTableDataTexture(gl, dataTextureBuffer.eachTriangleMesh_8Bits);
        dataTextureSet.eachTriangleMesh16BitsDataTexture = dataTextureFactory.createPointerTableDataTexture(gl, dataTextureBuffer.eachTriangleMesh_16Bits);
        dataTextureSet.eachTriangleMesh32BitsDataTexture = dataTextureFactory.createPointerTableDataTexture(gl, dataTextureBuffer.eachTriangleMesh_32Bits);
        dataTextureSet.eachEdgeMesh8BitsDataTexture = dataTextureFactory.createPointerTableDataTexture(gl, dataTextureBuffer.eachEdgeMesh_8Bits);
        dataTextureSet.eachEdgeMesh16BitsDataTexture = dataTextureFactory.createPointerTableDataTexture(gl, dataTextureBuffer.eachEdgeMesh_16Bits);
        dataTextureSet.eachEdgeMesh32BitsDataTexture = dataTextureFactory.createPointerTableDataTexture(gl, dataTextureBuffer.eachEdgeMesh_32Bits);
        dataTextureSet.eachEdgeOffset = dataTextureFactory.createEachEdgeOffsetDataTexture(gl, dataTextureBuffer.eachEdgeOffset);

        dataTextureSet.finalize();

        this.#dataTextureBuffer = null;
        this.#instancedGeometries = null;
        this.#finalized = true;
    }

    isEmpty() {
        return this.#numMeshes == 0;
    }

    initFlags(meshId: number, flags: number, meshTransparent: boolean) {
        if (flags & SceneObjectFlags.VISIBLE) {
            this.#numVisibleMeshes++;
            this.#meshCounts.numVisibleMeshes++;
        }
        if (flags & SceneObjectFlags.HIGHLIGHTED) {
            this.#numHighlightedMeshes++;
            this.#meshCounts.numHighlightedMeshes++;
        }
        if (flags & SceneObjectFlags.XRAYED) {
            this.#numXRayedMeshes++;
            this.#meshCounts.numXRayedMeshes++;
        }
        if (flags & SceneObjectFlags.SELECTED) {
            this.#numSelectedMeshes++;
            this.#meshCounts.numSelectedMeshes++;
        }
        if (flags & SceneObjectFlags.CLIPPABLE) {
            this.#numClippableMeshes++;
            this.#meshCounts.numClippableMeshes++;
        }
        if (flags & SceneObjectFlags.EDGES) {
            this.#numEdgesMeshes++;
            this.#meshCounts.numEdgesMeshes++;
        }
        if (flags & SceneObjectFlags.PICKABLE) {
            this.#numPickableMeshes++;
            this.#meshCounts.numPickableMeshes++;
        }
        if (flags & SceneObjectFlags.CULLED) {
            this.#numCulledMeshes++;
            this.#meshCounts.numCulledMeshes++;
        }
        if (meshTransparent) {
            this.#numTransparentMeshes++;
            this.#meshCounts.numTransparentMeshes++;
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
            this.#meshCounts.numVisibleMeshes++;
        } else {
            this.#numVisibleMeshes--;
            this.#meshCounts.numVisibleMeshes--;
        }
        this.#setMeshFlags(meshId, flags, transparent);
    }

    setMeshHighlighted(meshId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.HIGHLIGHTED) {
            this.#numHighlightedMeshes++;
            this.#meshCounts.numHighlightedMeshes++;
        } else {
            this.#numHighlightedMeshes--;
            this.#meshCounts.numHighlightedMeshes--;
        }
        this.#setMeshFlags(meshId, flags, transparent);
    }

    setMeshXRayed(meshId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.XRAYED) {
            this.#numXRayedMeshes++;
            this.#meshCounts.numXRayedMeshes++;
        } else {
            this.#numXRayedMeshes--;
            this.#meshCounts.numXRayedMeshes--;
        }
        this.#setMeshFlags(meshId, flags, transparent);
    }

    setMeshSelected(meshId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.SELECTED) {
            this.#numSelectedMeshes++;
            this.#meshCounts.numSelectedMeshes++;
        } else {
            this.#numSelectedMeshes--;
            this.#meshCounts.numSelectedMeshes--;
        }
        this.#setMeshFlags(meshId, flags, transparent);
    }

    setMeshEdges(meshId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.EDGES) {
            this.#numEdgesMeshes++;
            this.#meshCounts.numEdgesMeshes++;
        } else {
            this.#numEdgesMeshes--;
            this.#meshCounts.numEdgesMeshes--;
        }
        this.#setMeshFlags(meshId, flags, transparent);
    }

    setMeshClippable(meshId: number, flags: number) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.CLIPPABLE) {
            this.#numClippableMeshes++;
            this.#meshCounts.numClippableMeshes++;
        } else {
            this.#numClippableMeshes--;
            this.#meshCounts.numClippableMeshes--;
        }
        this.#setMeshFlags2(meshId, flags);
    }

    setMeshCulled(meshId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.CULLED) {
            this.#numCulledMeshes += this.#eachMeshParts[meshId].length;
            this.#meshCounts.numCulledMeshes++;
        } else {
            this.#numCulledMeshes -= this.#eachMeshParts[meshId].length;
            this.#meshCounts.numCulledMeshes--;
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
            this.#meshCounts.numPickableMeshes++;
        } else {
            this.#numPickableMeshes--;
            this.#meshCounts.numPickableMeshes--;
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
            this.#meshCounts.numTransparentMeshes++;
        } else {
            this.#numTransparentMeshes--;
            this.#meshCounts.numTransparentMeshes--;
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
        dataTextureSet.eachMeshOffset.textureData.set(tempFloat32Array3, meshId * 3);
        if (this.#deferredSetFlagsActive) {
            this.#deferredSetFlagsDirty = true;
            return;
        }
        gl.bindTexture(gl.TEXTURE_2D, dataTextureSet.eachMeshOffset.texture);
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

