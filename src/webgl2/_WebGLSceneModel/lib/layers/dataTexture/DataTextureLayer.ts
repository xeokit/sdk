import {SceneObjectFlags} from '../../SceneObjectFlags';
import {RENDER_PASSES} from '../../RENDER_PASSES';
import {math, View} from "../../../../../viewer"
import {DataTextureBuffer} from "./DataTextureBuffer";
import {DataTextureLayerParams} from "./DataTextureLayerParams";
import {DataTextureSet} from "./DataTextureSet";
import {DataTextureFactory} from "./DataTextureFactory";
import {dataTextureRamStats} from "./DataTextureRAMStats";
import {WebGLSceneModel} from "../../../WebGLSceneModel";
import {FrameContext} from "../../../../../webgl/WebGLRenderer/FrameContext";
import {DrawFlags} from "../../../../../webgl/WebGLRenderer/DrawFlags";
import {LayerMeshParams} from "./MeshParams";
import {LayerGeometryParams} from "./GeometryParams";
import {SubPortionGeometry} from "./SubPortionGeometry";

/**
 * 12-bits allowed for object ids.
 *
 * Limits the per-object texture height in the layer.
 */
const MAX_PORTIONS = (1 << 12);

/**
 * 2048 is max data texture height
 *
 * Limits the aggregated geometry texture height in the layer.
 */
const MAX_DATA_TEXTURE_HEIGHT = (1 << 11);

/**
 * Align `indices` and `edgeIndices` memory layout to 8 elements.
 *
 * Used as an optimization for the `...portionIds...` texture, so it
 * can just be stored 1 out of 8 `portionIds` corresponding to a given
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

const tempVec3a = math.vec3();
const tempVec3b = math.vec3();
const tempVec3c = math.vec3();
const tempVec3d = math.vec3();
const tempVec3e = math.vec3();
const tempVec3f = math.vec3();
const tempVec3g = math.vec3();

let _numberOfLayers = 0;

/**
 * WebGLSceneModel layer that uses data textures to store and render geometry and materials.
 */
export class DataTextureLayer {
    layerIndex: number;
    sceneModel: WebGLSceneModel;
    state: any;
    aabb: math.FloatArrayType;
    #gl: WebGL2RenderingContext;
    #dataTextureBuffer: DataTextureBuffer;
    #renderers: any;
    #preCompressedPositionsExpected: boolean;
    #preCompressedNormalsExpected: boolean;

    #portions: number[];
    // Due to `index rebucketting` process in ```prepareMeshGeometry``` function, it's possible that a
    // single portion is expanded to more than 1 real sub-portion.
    //
    // This Array tracks the mapping between:
    //
    // - external `portionIds` as seen by consumers of this class.
    //- internal `sub-portionIds` actually managed by this class.
    //
    // The outer index of this array is the externally seen `portionId`.
    //
    // The inner value of the array, are `sub-portionIds` corresponding to the `portionId`.
    //
    #subPortionIdMapping: number[][];
    #instancedGeometrySubPortionData: { [key: number | string]: any };

    #numPortions: number;
    #numVisibleLayerPortions: number;
    #numTransparentLayerPortions: number;
    #numEdgesLayerPortions: number;
    #numXRayedLayerPortions: number;
    #numSelectedLayerPortions: number;
    #numHighlightedLayerPortions: number;
    #numClippableLayerPortions: number;
    #numPickableLayerPortions: number;
    #numCulledLayerPortions: number;

    #modelAABB: math.FloatArrayType;

    #finalized: boolean;

    private sortId: string;

    #deferredSetFlagsActive: boolean;
    #deferredSetFlagsDirty: Boolean;
    #dataTextureRenderers: Boolean;

    constructor(params: DataTextureLayerParams, renderers: any) {

        this.layerIndex = params.layerIndex;
        this.sceneModel = params.sceneModel;

        this.#gl = params.gl;
        this.#dataTextureBuffer = new DataTextureBuffer(params.maxGeometryBatchSize);
        this.#renderers = renderers;

        this.state = {
            origin: math.vec3(),
            positionsDecompressMatrix: math.mat4(),
            dataTextureSet: new DataTextureSet(),
            numIndices8Bits: 0,
            numIndices16Bits: 0,
            numIndices32Bits: 0,
            numEdgeIndices8Bits: 0,
            numEdgeIndices16Bits: 0,
            numEdgeIndices32Bits: 0,
            numVertices: 0
        };

        this.#numPortions = 0;
        this.#numVisibleLayerPortions = 0;
        this.#numTransparentLayerPortions = 0;
        this.#numXRayedLayerPortions = 0;
        this.#numSelectedLayerPortions = 0;
        this.#numHighlightedLayerPortions = 0;
        this.#numClippableLayerPortions = 0;
        this.#numPickableLayerPortions = 0;
        this.#numCulledLayerPortions = 0;
        this.#modelAABB = math.boundaries.collapseAABB3(); // Model-space AABB
        this.#portions = [];
        this.#subPortionIdMapping = [];
        this.#instancedGeometrySubPortionData = {};

        if (params.positionsDecompressMatrix) {
            this.state.positionsDecompressMatrix.set(params.positionsDecompressMatrix);
            this.#preCompressedPositionsExpected = true;
        } else {
            this.#preCompressedPositionsExpected = false;
        }

        if (params.uvsDecompressMatrix) {
            this.state.uvsDecompressMatrix = math.mat3(params.uvsDecompressMatrix);
            this.#preCompressedNormalsExpected = true;
        } else {
            this.#preCompressedNormalsExpected = false;
        }

        if (params.origin) {
            this.state.origin = math.vec3(params.origin);
        }

        this.aabb = math.boundaries.collapseAABB3();

        this.#finalized = false;
    }

    /**
     * Checks if the DatTextureLayer has room for more portions.
     *
     * @param {object} geometryCfg Geometry data (positions, indices, edgeIndices) for the portion.
     * @param {object} geometryId In case an instanced portion is to be checked, this must be the `geometryId`
     *
     * @returns {Boolean} Whether the requested portion can be created
     */

    /**
     * Checks if the DatTextureLayer has room for more portions.
     * @param geometryCfg
     */
    canCreatePortion(geometryCfg: {
        geometryId?: any;
        geometries: LayerGeometryParams[];
        indices: math.IntArrayType[];
    }): boolean {
        if (this.#finalized) {
            throw "Already finalized";
        }
        const state = this.state;
        const numNewPortions = geometryCfg.geometries.length;
        if ((this.#numPortions + numNewPortions) > MAX_PORTIONS) {
            //  dataTextureRamStats.cannotCreatePortion.because10BitsObjectId++;
        }
        let canCreate = (this.#numPortions + numNewPortions) <= MAX_PORTIONS;
        const alreadyHasPortionGeometry = geometryId !== null && (geometryId + "#0") in this.#instancedGeometrySubPortionData;
        if (!alreadyHasPortionGeometry) {
            const maxIndicesOfAnyBits = Math.max(state.numIndices8Bits, state.numIndices16Bits, state.numIndices32Bits);
            let numVertices = 0;
            let numIndices = geometryCfg.indices.length / 3;
            geometryCfg.geometries.forEach((bucket: any) => {
                numVertices += bucket.positions.length / 3;
            });
            if ((state.numVertices + numVertices) > MAX_DATA_TEXTURE_HEIGHT * 1024 || (maxIndicesOfAnyBits + numIndices) > MAX_DATA_TEXTURE_HEIGHT * 1024) {
                // dataTextureRamStats.cannotCreatePortion.becauseTextureSize++;
            }
            canCreate &&= (state.numVertices + numVertices) <= MAX_DATA_TEXTURE_HEIGHT * 1024 && (maxIndicesOfAnyBits + numIndices) <= MAX_DATA_TEXTURE_HEIGHT * 1024;
        }
        return canCreate;
    }

    /**
     * Creates a new portion within this Layer, returns the new portion ID.
     *
     * @returns {number} Portion ID
     */
    createPortion(layerMeshParams: LayerMeshParams, objectCfg: any = null): number {
        if (this.#finalized) {
            throw "Already finalized";
        }

        const instancing = objectCfg !== null;
        const portionId = this.#subPortionIdMapping.length;
        const eachMeshParts: number[] = [];
        this.#subPortionIdMapping.push(eachMeshParts);
        const objectAABB = instancing ? objectCfg.aabb : layerMeshParams.aabb;

        layerMeshParams.geometries.forEach((geometryBucket, bucketIndex) => {
            let subPortionGeometry;
            if (instancing) {
                const key = `${layerMeshParams.id}#${bucketIndex}`;
                if (!(key in this.#instancedGeometrySubPortionData)) {
                    this.#instancedGeometrySubPortionData[key] = this.#createSubPortionGeometry(geometryBucket);
                }
                subPortionGeometry = this.#instancedGeometrySubPortionData[key];
            } else {
                subPortionGeometry = this.#createSubPortionGeometry(geometryBucket);
            }

            const aabb = math.boundaries.collapseAABB3();

            const subPortionId = this.#createSubPortionObject(
                instancing ? objectCfg : layerMeshParams,
                subPortionGeometry,
                geometryBucket.positions,
                layerMeshParams.positionsDecodeMatrix,
                layerMeshParams.origin,
                aabb,
                instancing
            );

            math.boundaries.expandAABB3(objectAABB, aabb);

            eachMeshParts.push(subPortionId);
        });

        this.sceneModel.numPortions++;

        return portionId;
    }

    #createSubPortionGeometry(params: LayerGeometryParams): SubPortionGeometry {
        const state = this.state;
        // Indices alignment;
        // This will make every mesh consume a multiple of INDICES_EDGE_INDICES_ALIGNMENT_SIZE
        // array items for storing the triangles of the mesh, and it supports:
        // - a memory optimization of factor INDICES_EDGE_INDICES_ALIGNMENT_SIZE
        // - in exchange for a small RAM overhead
        //   (by adding some padding until a size that is multiple of INDICES_EDGE_INDICES_ALIGNMENT_SIZE)
        if (params.indices) {
            const alignedIndicesLen = Math.ceil((params.indices.length / 3) / INDICES_EDGE_INDICES_ALIGNMENT_SIZE) * INDICES_EDGE_INDICES_ALIGNMENT_SIZE * 3;
            dataTextureRamStats.overheadSizeAlignementIndices += 2 * (alignedIndicesLen - params.indices.length);
            const alignedIndices = new Uint32Array(alignedIndicesLen);
            alignedIndices.fill(0);
            alignedIndices.set(params.indices);
            params.indices = alignedIndices;
        }
        // EdgeIndices alignment;
        // This will make every mesh consume a multiple of INDICES_EDGE_INDICES_ALIGNMENT_SIZE
        // array items for storing the edges of the mesh, and it supports:
        // - a memory optimization of factor INDICES_EDGE_INDICES_ALIGNMENT_SIZE
        // - in exchange for a small RAM overhead
        //   (by adding some padding until a size that is multiple of INDICES_EDGE_INDICES_ALIGNMENT_SIZE)
        if (params.edgeIndices) {
            const alignedEdgeIndicesLen = Math.ceil((params.edgeIndices.length / 2) / INDICES_EDGE_INDICES_ALIGNMENT_SIZE) * INDICES_EDGE_INDICES_ALIGNMENT_SIZE * 2;
            dataTextureRamStats.overheadSizeAlignementEdgeIndices += 2 * (alignedEdgeIndicesLen - params.edgeIndices.length);
            const alignedEdgeIndices = new Uint32Array(alignedEdgeIndicesLen);
            alignedEdgeIndices.fill(0);
            alignedEdgeIndices.set(params.edgeIndices);
            params.edgeIndices = alignedEdgeIndices;
        }
        const positions = params.positions;
        const indices = params.indices;
        const edgeIndices = params.edgeIndices;
        const buffer = this.#dataTextureBuffer;
        const positionsVertexBase = buffer.positions.length / 3;
        const numVerts = positions.length / 3;
        // Load positions data into buffer
        for (let i = 0, len = positions.length; i < len; i++) {
            buffer.positions.push(positions[i]);
        }
        // Load indices data into buffer
        let indicesBase;
        let numTriangles = 0;
        if (indices) {
            numTriangles = indices.length / 3;
            let indicesBuffer;
            if (numVerts <= (1 << 8)) {
                indicesBuffer = buffer.indices_8Bits;
            } else if (numVerts <= (1 << 16)) {
                indicesBuffer = buffer.indices_16Bits;
            } else {
                indicesBuffer = buffer.indices_32Bits;
            }
            indicesBase = indicesBuffer.length / 3;
            for (let i = 0, len = indices.length; i < len; i++) {
                indicesBuffer.push(indices[i]);
            }
        }
        // Load edge indices data into buffer
        let edgeIndicesBase;
        let numEdges = 0;
        if (edgeIndices) {
            numEdges = edgeIndices.length / 2;
            let edgeIndicesBuffer;
            if (numVerts <= (1 << 8)) {
                edgeIndicesBuffer = buffer.edgeIndices_8Bits;
            } else if (numVerts <= (1 << 16)) {
                edgeIndicesBuffer = buffer.edgeIndices_16Bits;
            } else {
                edgeIndicesBuffer = buffer.edgeIndices_32Bits;
            }
            edgeIndicesBase = edgeIndicesBuffer.length / 2;
            for (let i = 0, len = edgeIndices.length; i < len; i++) {
                edgeIndicesBuffer.push(edgeIndices[i]);
            }
        }
        state.numVertices += numVerts;
        dataTextureRamStats.numberOfGeometries++;
        return { // SubPortionGeometry
            vertexBase: positionsVertexBase,
            numVertices: numVerts,
            numTriangles,
            numEdges,
            indicesBase,
            edgeIndicesBase
        };
    }

    #createSubPortionObject(params: {
                                color: math.FloatArrayType;
                                metallic: number;
                                roughness: number;
                                colors: math.FloatArrayType;
                                opacity: number;
                                meshMatrix: math.FloatArrayType;
                                worldMatrix: math.FloatArrayType;
                                pickColor: math.FloatArrayType;
                            },
                            subPortionGeometry: SubPortionGeometry,
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
            // Mesh instance matrix
            dataTextureBuffer.eachMeshMatrices.push(meshMatrix);

            // Mesh instance normal matrix
            {
                // Note: order of inverse and transpose doesn't matter
                let transposedMat = math.transposeMat4(meshMatrix, math.mat4()); // TODO: Use cached matrix
                let normalMatrix = math.inverseMat4(transposedMat);
                dataTextureBuffer.eachMeshNormalMatrix.push(normalMatrix);
            }
        } else {
            dataTextureBuffer.eachMeshMatrices.push(identityMatrix);
            dataTextureBuffer.eachMeshNormalMatrix.push(identityMatrix);
        }

        // const positionsCompressed = params.positions;
        // const positionsIndex = dataTextureBuffer.positions.length;
        // const vertsIndex = positionsIndex / 3;

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

        // Adjust the world AABB with the object `origin`
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

        if (colors) {
            dataTextureBuffer.eachMeshColor.push([colors[0] * 255, colors[1] * 255, colors[2] * 255, 255]);
        } else if (color) {
            dataTextureBuffer.eachMeshColor.push([
                color[0], // Color is pre-quantized by VBOSceneModel
                color[1],
                color[2],
                opacity
            ]);
        }

        dataTextureBuffer.eachMeshPickColor.push(pickColor);

        dataTextureBuffer.eachMeshVertexPortionBase.push(subPortionGeometry.vertexBase);

        // Indices

        let currentNumIndices;
        if (subPortionGeometry.numVertices <= (1 << 8)) {
            currentNumIndices = state.numIndices8Bits;
        } else if (subPortionGeometry.numVertices <= (1 << 16)) {
            currentNumIndices = state.numIndices16Bits;
        } else {
            currentNumIndices = state.numIndices32Bits;
        }
        dataTextureBuffer.eachMeshVertexPortionOffset.push(currentNumIndices / 3 - subPortionGeometry.indicesBase);

        // Edge indices

        let currentNumEdgeIndices;
        if (subPortionGeometry.numVertices <= (1 << 8)) {
            currentNumEdgeIndices = state.numEdgeIndices8Bits;
        } else if (subPortionGeometry.numVertices <= (1 << 16)) {
            currentNumEdgeIndices = state.numEdgeIndices16Bits;
        } else {
            currentNumEdgeIndices = state.numEdgeIndices32Bits;
        }
        dataTextureBuffer.eachMeshEdgeIndicesOffset.push(currentNumEdgeIndices / 2 - subPortionGeometry.edgeIndicesBase);

        const subPortionId = this.#portions.length;

        if (subPortionGeometry.numTriangles > 0) {
            let numIndices = subPortionGeometry.numTriangles * 3;
            let indicesPortionIdBuffer;
            if (subPortionGeometry.numVertices <= (1 << 8)) {
                indicesPortionIdBuffer = dataTextureBuffer.eachTriangleMesh8Bits;
                state.numIndices8Bits += numIndices;
                dataTextureRamStats.totalPolygons8Bits += subPortionGeometry.numTriangles;
            } else if (subPortionGeometry.numVertices <= (1 << 16)) {
                indicesPortionIdBuffer = dataTextureBuffer.eachTriangleMesh16Bits;
                state.numIndices16Bits += numIndices;
                dataTextureRamStats.totalPolygons16Bits += subPortionGeometry.numTriangles;
            } else {
                indicesPortionIdBuffer = dataTextureBuffer.eachTriangleMesh32Bits;
                state.numIndices32Bits += numIndices;
                dataTextureRamStats.totalPolygons32Bits += subPortionGeometry.numTriangles;
            }

            dataTextureRamStats.totalPolygons += subPortionGeometry.numTriangles;

            for (let i = 0; i < subPortionGeometry.numTriangles; i += INDICES_EDGE_INDICES_ALIGNMENT_SIZE) {
                indicesPortionIdBuffer.push(subPortionId);
            }
        }

        if (subPortionGeometry.numEdges > 0) {
            let numEdgeIndices = subPortionGeometry.numEdges * 2;
            let edgeIndicesPortionIdBuffer;

            if (subPortionGeometry.numVertices <= (1 << 8)) {
                edgeIndicesPortionIdBuffer = dataTextureBuffer.eachEdgeMesh8Bits;
                state.numEdgeIndices8Bits += numEdgeIndices;
                dataTextureRamStats.totalEdges8Bits += subPortionGeometry.numEdges;
            } else if (subPortionGeometry.numVertices <= (1 << 16)) {
                edgeIndicesPortionIdBuffer = dataTextureBuffer.eachEdgeMesh16Bits;
                state.numEdgeIndices16Bits += numEdgeIndices;
                dataTextureRamStats.totalEdges16Bits += subPortionGeometry.numEdges;
            } else {
                edgeIndicesPortionIdBuffer = dataTextureBuffer.eachEdgeMesh32Bits;
                state.numEdgeIndices32Bits += numEdgeIndices;
                dataTextureRamStats.totalEdges32Bits += subPortionGeometry.numEdges;
            }

            dataTextureRamStats.totalEdges += subPortionGeometry.numEdges;

            for (let i = 0; i < subPortionGeometry.numEdges; i += INDICES_EDGE_INDICES_ALIGNMENT_SIZE) {
                edgeIndicesPortionIdBuffer.push(subPortionId);
            }
        }

        dataTextureBuffer.eachEdgeOffset.push([0, 0, 0]);
        this.#portions.push({
            // vertsBase: vertsIndex,
            numVerts: subPortionGeometry.numTriangles
        });
        this.#numPortions++;
        dataTextureRamStats.numberOfPortions++;
        return subPortionId;
    }

    finalize() {

        if (this.#finalized) {
            this.sceneModel.error("Already finalized");
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
            dataTextureBuffer.eachMeshEdgeIndicesOffset
        );
        dataTextureSet.eachEdgeOffset = dataTextureFactory.createEachEdgeOffsetDataTexture(gl, dataTextureBuffer.eachEdgeOffset,);
        dataTextureSet.eachMeshMatrices = dataTextureFactory.createEachMeshMatricesDataTexture(gl, dataTextureBuffer.eachMeshPositionsDecompressMatrix, dataTextureBuffer.eachMeshMatrices, dataTextureBuffer.eachMeshNormalMatrix);

        dataTextureSet.eachTriangleMesh_8Bits = dataTextureFactory.createPointerTableDataTexture(gl, dataTextureBuffer.eachTriangleMesh8Bits);
        dataTextureSet.eachTriangleMesh_16Bits = dataTextureFactory.createPointerTableDataTexture(gl, dataTextureBuffer.eachTriangleMesh16Bits);
        dataTextureSet.eachTriangleMesh_32Bits = dataTextureFactory.createPointerTableDataTexture(gl, dataTextureBuffer.eachTriangleMesh32Bits);

        dataTextureSet.eachEdgeMesh_8Bits = dataTextureFactory.createPointerTableDataTexture(gl, dataTextureBuffer.eachEdgeMesh8Bits);
        dataTextureSet.eachEdgeMesh_16Bits = dataTextureFactory.createPointerTableDataTexture(gl, dataTextureBuffer.eachEdgeMesh16Bits);
        dataTextureSet.eachEdgeMesh_32Bits = dataTextureFactory.createPointerTableDataTexture(gl, dataTextureBuffer.eachEdgeMesh32Bits);

        dataTextureSet.finalize();

        this.#dataTextureBuffer = null;
        this.#instancedGeometrySubPortionData = null;
        this.#finalized = true;
    }

    isEmpty() {
        return this.#numPortions == 0;
    }

    initFlags(portionId: number, flags: number, meshTransparent: boolean) {
        if (flags & SceneObjectFlags.VISIBLE) {
            this.#numVisibleLayerPortions++;
            this.sceneModel.numVisibleLayerPortions++;
        }
        if (flags & SceneObjectFlags.HIGHLIGHTED) {
            this.#numHighlightedLayerPortions++;
            this.sceneModel.numHighlightedLayerPortions++;
        }
        if (flags & SceneObjectFlags.XRAYED) {
            this.#numXRayedLayerPortions++;
            this.sceneModel.numXRayedLayerPortions++;
        }
        if (flags & SceneObjectFlags.SELECTED) {
            this.#numSelectedLayerPortions++;
            this.sceneModel.numSelectedLayerPortions++;
        }
        if (flags & SceneObjectFlags.CLIPPABLE) {
            this.#numClippableLayerPortions++;
            this.sceneModel.numClippableLayerPortions++;
        }
        if (flags & SceneObjectFlags.EDGES) {
            this.#numEdgesLayerPortions++;
            this.sceneModel.numEdgesLayerPortions++;
        }
        if (flags & SceneObjectFlags.PICKABLE) {
            this.#numPickableLayerPortions++;
            this.sceneModel.numPickableLayerPortions++;
        }
        if (flags & SceneObjectFlags.CULLED) {
            this.#numCulledLayerPortions++;
            this.sceneModel.numCulledLayerPortions++;
        }
        if (meshTransparent) {
            this.#numTransparentLayerPortions++;
            this.sceneModel.numTransparentLayerPortions++;
        }
        const deferred = true;
        this.#setFlags(portionId, flags, meshTransparent, deferred);
        this.#setFlags2(portionId, flags, deferred);
    }

    flushInitFlags() {
        this.#setDeferredFlags();
        this.#setDeferredFlags2();
    }

    setVisible(portionId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.VISIBLE) {
            this.#numVisibleLayerPortions++;
            this.sceneModel.numVisibleLayerPortions++;
        } else {
            this.#numVisibleLayerPortions--;
            this.sceneModel.numVisibleLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setHighlighted(portionId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.HIGHLIGHTED) {
            this.#numHighlightedLayerPortions++;
            this.sceneModel.numHighlightedLayerPortions++;
        } else {
            this.#numHighlightedLayerPortions--;
            this.sceneModel.numHighlightedLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setXRayed(portionId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.XRAYED) {
            this.#numXRayedLayerPortions++;
            this.sceneModel.numXRayedLayerPortions++;
        } else {
            this.#numXRayedLayerPortions--;
            this.sceneModel.numXRayedLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setSelected(portionId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.SELECTED) {
            this.#numSelectedLayerPortions++;
            this.sceneModel.numSelectedLayerPortions++;
        } else {
            this.#numSelectedLayerPortions--;
            this.sceneModel.numSelectedLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setEdges(portionId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.EDGES) {
            this.#numEdgesLayerPortions++;
            this.sceneModel.numEdgesLayerPortions++;
        } else {
            this.#numEdgesLayerPortions--;
            this.sceneModel.numEdgesLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setClippable(portionId: number, flags: number) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.CLIPPABLE) {
            this.#numClippableLayerPortions++;
            this.sceneModel.numClippableLayerPortions++;
        } else {
            this.#numClippableLayerPortions--;
            this.sceneModel.numClippableLayerPortions--;
        }
        this.#setFlags2(portionId, flags);
    }

    /**
     * This will _start_ a "set-flags transaction".
     *
     * After invoking this method, calling setFlags/setFlags2 will not update
     * the colors+flags texture but only store the new flags/flag2 in the
     * colors+flags texture.
     *
     * After invoking this method, and when all desired setFlags/setFlags2 have
     * been called on needed portions of the layer, invoke `commitDeferredFlags`
     * to actually update the texture data.
     *
     * In massive "set-flags" scenarios like VFC or LOD mechanisms, the combina-
     * tion of `beginDeferredFlags` + `commitDeferredFlags`brings a speed-up of
     * up to 80x when e.g. objects are massively (un)culled 🚀.
     */
    beginDeferredFlags() {
        this.#deferredSetFlagsActive = true;
    }

    /**
     * This will _commit_ a "set-flags transaction".
     *
     * Invoking this method will update the colors+flags texture data with new
     * flags/flags2 set since the previous invocation of `beginDeferredFlags`.
     */
    commitDeferredFlags() {
        this.#deferredSetFlagsActive = false;

        if (!this.#deferredSetFlagsDirty) {
            return;
        }

        this.#deferredSetFlagsDirty = false;

        const gl = this.sceneModel.scene.canvas.gl;
        const textureSet = this.state.dataTextureSet;

        gl.bindTexture(gl.TEXTURE_2D, textureSet.eachMeshAttributes._texture);

        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            0, // xoffset
            0, // yoffset
            textureSet.eachMeshAttributes._textureWidth, // width
            textureSet.eachMeshAttributes._textureHeight, // width
            gl.RGBA_INTEGER,
            gl.UNSIGNED_BYTE,
            textureSet.eachMeshAttributes._textureData
        );

        gl.bindTexture(gl.TEXTURE_2D, textureSet.eachEdgeOffset._texture);

        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            0, // xoffset
            0, // yoffset
            textureSet.eachEdgeOffset._textureWidth, // width
            textureSet.eachEdgeOffset._textureHeight, // width
            gl.RGB,
            gl.FLOAT,
            textureSet.eachEdgeOffset._textureData
        );
    }

    setCulled(portionId, flags, transparent) {
        if (!this.#finalized) {
            throw "Not finalized";
        }

        if (flags & SceneObjectFlags.CULLED) {
            this.#numCulledLayerPortions += this.#subPortionIdMapping[portionId].length;
            this.sceneModel.numCulledLayerPortions++;
        } else {
            this.#numCulledLayerPortions -= this.#subPortionIdMapping[portionId].length;
            this.sceneModel.numCulledLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setCollidable(portionId, flags) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
    }

    setPickable(portionId, flags, transparent) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & SceneObjectFlags.PICKABLE) {
            this.#numPickableLayerPortions++;
            this.sceneModel.numPickableLayerPortions++;
        } else {
            this.#numPickableLayerPortions--;
            this.sceneModel.numPickableLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setColor(portionId, color) {
        const subPortionMapping = this.#subPortionIdMapping[portionId];

        for (let i = 0, len = subPortionMapping.length; i < len; i++) {
            this.#subPortionSetColor(subPortionMapping[i], color);
        }
    }

    /**
     * @private
     */
    #subPortionSetColor(portionId: number, color: number[]) {
        if (!this.#finalized) {
            throw "Not finalized";
        }

        // Color
        const textureSet = this.state.dataTextureSet;
        const gl = this.sceneModel.scene.canvas.gl;

        tempUint8Array4 [0] = color[0];
        tempUint8Array4 [1] = color[1];
        tempUint8Array4 [2] = color[2];
        tempUint8Array4 [3] = color[3];

        // object colors
        textureSet.eachMeshAttributes._textureData.set(
            tempUint8Array4,
            portionId * 28
        );

        if (this.#deferredSetFlagsActive) {
            this.#deferredSetFlagsDirty = true;
            return;
        }

        gl.bindTexture(gl.TEXTURE_2D, textureSet.eachMeshAttributes._texture);

        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            0, // xoffset
            portionId, // yoffset
            1, // width
            1, //height
            gl.RGBA_INTEGER,
            gl.UNSIGNED_BYTE,
            tempUint8Array4
        );

        // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    setTransparent(portionId: any, flags: any, transparent: any) {
        if (transparent) {
            this.#numTransparentLayerPortions++;
            this.sceneModel.numTransparentLayerPortions++;
        } else {
            this.#numTransparentLayerPortions--;
            this.sceneModel.numTransparentLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    _setFlags(portionId: string | number, flags: any, transparent: any, deferred = false) {
        const subPortionMapping = this.#subPortionIdMapping[portionId];

        for (let i = 0, len = subPortionMapping.length; i < len; i++) {
            this.#subPortionSetFlags(subPortionMapping[i], flags, transparent);
        }
    }

    /**
     * @private
     */
    #subPortionSetFlags(portionId: number, flags: number, transparent: any, deferred = false) {
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

        const textureSet = this.state.dataTextureSet;
        const gl = this.sceneModel.scene.canvas.gl;

        tempUint8Array4 [0] = f0;
        tempUint8Array4 [1] = f1;
        tempUint8Array4 [2] = f2;
        tempUint8Array4 [3] = f3;

        // object flags
        textureSet.eachMeshAttributes._textureData.set(
            tempUint8Array4,
            portionId * 28 + 8
        );

        if (this.#deferredSetFlagsActive) {
            this.#deferredSetFlagsDirty = true;
            return;
        }

        gl.bindTexture(gl.TEXTURE_2D, textureSet.eachMeshAttributes._texture);

        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            2, // xoffset
            portionId, // yoffset
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
        const subPortionMapping = this.#subPortionIdMapping[portionId];
        for (let i = 0, len = subPortionMapping.length; i < len; i++) {
            this.#subPortionSetFlags2(subPortionMapping[i], flags);
        }
    }

    #subPortionSetFlags2(portionId: number, flags: number, deferred = false) {
        if (!this.#finalized) {
            throw "Not finalized";
        }

        const clippable = !!(flags & SceneObjectFlags.CLIPPABLE) ? 255 : 0;

        const textureSet = this.state.dataTextureSet;
        const gl = this.sceneModel.scene.canvas.gl;

        tempUint8Array4 [0] = clippable;
        tempUint8Array4 [1] = 0;
        tempUint8Array4 [2] = 1;
        tempUint8Array4 [3] = 2;

        // object flags2
        textureSet.eachMeshAttributes._textureData.set(tempUint8Array4, portionId * 28 + 12);

        if (this.#deferredSetFlagsActive) {
            this.#deferredSetFlagsDirty = true;
            return;
        }

        gl.bindTexture(gl.TEXTURE_2D, textureSet.eachMeshAttributes._texture);

        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            3, // xoffset
            portionId, // yoffset
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

    setOffset(portionId: number, offset: number[]) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        const subPortionMapping = this.#subPortionIdMapping[portionId];
        for (let i = 0, len = subPortionMapping.length; i < len; i++) {
            this.#subPortionSetOffset(subPortionMapping[i], offset);
        }
    }

    #subPortionSetOffset(portionId: number, offset: number[]) {
        const textureSet = this.state.dataTextureSet;
        const gl = this.sceneModel.scene.canvas.gl;

        tempFloat32Array3 [0] = offset[0];
        tempFloat32Array3 [1] = offset[1];
        tempFloat32Array3 [2] = offset[2];

        // object offset
        textureSet.eachEdgeOffset._textureData.set(
            tempFloat32Array3,
            portionId * 3
        );

        if (this.#deferredSetFlagsActive) {
            this.#deferredSetFlagsDirty = true;
            return;
        }

        gl.bindTexture(gl.TEXTURE_2D, textureSet.eachEdgeOffset._texture);

        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // level
            0, // x offset
            portionId, // yoffset
            1, // width
            1, // height
            gl.RGB,
            gl.FLOAT,
            tempFloat32Array3
        );

        // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    // ---------------------- COLOR RENDERING -----------------------------------

    drawColorOpaque(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numTransparentLayerPortions === this.#numPortions || this.#numXRayedLayerPortions === this.#numPortions) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        // if (frameContext.withSAO && this.sceneModel.qualityRender) {
        //     if (frameContext.pbrEnabled && this.sceneModel.qualityRender) {
        //         if (this.#dataTextureRenderers.colorQualityRendererWithSAO) {
        //             this.#dataTextureRenderers.colorQualityRendererWithSAO.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
        //         }
        //     } else {
        //         if (this.#dataTextureRenderers.colorRendererWithSAO) {
        //             this.#dataTextureRenderers.colorRendererWithSAO.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
        //         }
        //     }
        // } else {
        //     if (frameContext.pbrEnabled && this.sceneModel.qualityRender) {
        //         if (this.#dataTextureRenderers.qualityColorRenderer) {
        //             this.#dataTextureRenderers.qualityColorRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
        //         }
        //     } else {
        //         if (this.#dataTextureRenderers.fastColorRenderer) {
        //             this.#dataTextureRenderers.fastColorRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
        //         }
        //     }
        // }
    }

    #updateBackfaceCull(drawFlags: DrawFlags, frameContext: FrameContext) {
        const backfaces = this.sceneModel.backfaces || (!this.solid) || drawFlags.sectioned;
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

    drawColorTransparent(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numTransparentLayerPortions === 0 || this.#numXRayedLayerPortions === this.#numPortions) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        // if (frameContext.pbrEnabled && this.sceneModel.qualityRender) {
        //     if (this.#dataTextureRenderers.qualityColorRenderer) {
        //         this.#dataTextureRenderers.qualityColorRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_TRANSPARENT);
        //     }
        // } else {
        //     if (this.#dataTextureRenderers.fastColorRenderer) {
        //         this.#dataTextureRenderers.fastColorRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_TRANSPARENT);
        //     }
        // }
    }

    // ---------------------- RENDERING SAO POST EFFECT TARGETS --------------

    drawDepth(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numTransparentLayerPortions === this.#numPortions || this.#numXRayedLayerPortions === this.#numPortions) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        // if (this.#dataTextureRenderers.depthRenderer) {
        //     this.#dataTextureRenderers.depthRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE); // Assume whatever post-effect uses depth (eg SAO) does not apply to transparent objects
        // }
    }

    drawNormals(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numTransparentLayerPortions === this.#numPortions || this.#numXRayedLayerPortions === this.#numPortions) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        // if (this.#dataTextureRenderers.normalsRenderer) {
        //     this.#dataTextureRenderers.normalsRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);  // Assume whatever post-effect uses normals (eg SAO) does not apply to transparent objects
        // }
    }

    // ---------------------- SILHOUETTE RENDERING -----------------------------------

    drawSilhouetteXRayed(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numXRayedLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        // if (this.#dataTextureRenderers.silhouetteRenderer) {
        //     this.#dataTextureRenderers.silhouetteRenderer.drawLayer(frameContext, this, RENDER_PASSES.SILHOUETTE_XRAYED);
        // }
    }

    drawSilhouetteHighlighted(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numHighlightedLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        // if (this.#dataTextureRenderers.silhouetteRenderer) {
        //     this.#dataTextureRenderers.silhouetteRenderer.drawLayer(frameContext, this, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED);
        // }
    }

    drawSilhouetteSelected(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numSelectedLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        // if (this.#dataTextureRenderers.silhouetteRenderer) {
        //     this.#dataTextureRenderers.silhouetteRenderer.drawLayer(frameContext, this, RENDER_PASSES.SILHOUETTE_SELECTED);
        // }
    }

    // ---------------------- EDGES RENDERING -----------------------------------

    drawEdgesColorOpaque(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numEdgesLayerPortions === 0) {
            return;
        }
        // if (this.#dataTextureRenderers.edgesColorRenderer) {
        //     this.#dataTextureRenderers.edgesColorRenderer.drawLayer(frameContext, this, RENDER_PASSES.EDGES_COLOR_OPAQUE);
        // }
    }

    drawEdgesColorTransparent(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numEdgesLayerPortions === 0 || this.#numTransparentLayerPortions === 0) {
            return;
        }
        // if (this.#dataTextureRenderers.edgesColorRenderer) {
        //     this.#dataTextureRenderers.edgesColorRenderer.drawLayer(frameContext, this, RENDER_PASSES.EDGES_COLOR_TRANSPARENT);
        // }
    }

    drawEdgesHighlighted(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numHighlightedLayerPortions === 0) {
            return;
        }
        // if (this.#dataTextureRenderers.edgesRenderer) {
        //     this.#dataTextureRenderers.edgesRenderer.drawLayer(frameContext, this, RENDER_PASSES.EDGES_HIGHLIGHTED);
        // }
    }

    drawEdgesSelected(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numSelectedLayerPortions === 0) {
            return;
        }
        // if (this.#dataTextureRenderers.edgesRenderer) {
        //     this.#dataTextureRenderers.edgesRenderer.drawLayer(frameContext, this, RENDER_PASSES.EDGES_SELECTED);
        // }
    }

    drawEdgesXRayed(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numXRayedLayerPortions === 0) {
            return;
        }
        // if (this.#dataTextureRenderers.edgesRenderer) {
        //     this.#dataTextureRenderers.edgesRenderer.drawLayer(frameContext, this, RENDER_PASSES.EDGES_XRAYED);
        // }
    }

    // ---------------------- OCCLUSION CULL RENDERING -----------------------------------

    drawOcclusion(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        // if (this.#dataTextureRenderers.occlusionRenderer) {
        //     this.#dataTextureRenderers.occlusionRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
        // }
    }

    // ---------------------- SHADOW BUFFER RENDERING -----------------------------------

    drawShadow(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        // if (this.#dataTextureRenderers.shadowRenderer) {
        //     this.#dataTextureRenderers.shadowRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
        // }
    }

    //---- PICKING ----------------------------------------------------------------------------------------------------

    drawPickMesh(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        // if (this.#dataTextureRenderers.pickMeshRenderer) {
        //     this.#dataTextureRenderers.pickMeshRenderer.drawLayer(frameContext, this, RENDER_PASSES.PICK);
        // }
    }

    drawPickDepths(drawFlags: DrawFlags, frameContext: FrameContext) {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        // if (this.#dataTextureRenderers.pickDepthRenderer) {
        //     this.#dataTextureRenderers.pickDepthRenderer.drawLayer(frameContext, this, RENDER_PASSES.PICK);
        // }
    }

    drawPickNormals(drawFlags: any, frameContext: FrameContext) {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        // if (this.#dataTextureRenderers.pickNormalsRenderer) {
        //     this.#dataTextureRenderers.pickNormalsRenderer.drawLayer(frameContext, this, RENDER_PASSES.PICK);
        // }
    }

    //------------------------------------------------------------------------------------------------

    precisionRayPickSurface(portionId: string, worldRayOrigin: math.FloatArrayType, worldRayDir: any, worldSurfacePos: { set: (arg0: math.FloatArrayType) => void; }, worldNormal: math.FloatArrayType) {
    }

    // ---------

    destroy() {
        this.state.dataTextureSet.destroy();
    }
}

