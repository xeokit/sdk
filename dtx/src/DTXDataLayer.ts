import {AABB3ToOBB3, collapseAABB3, expandAABB3, expandAABB3Points3} from "@xeokit/boundaries";
import {FloatArrayParam} from "@xeokit/math";
import {identityMat4, transformPoint4} from "@xeokit/matrix";


/**
 * 12-bits allowed for object ids.
 * Limits the per-object texture height in the layer.
 */
const MAX_NUMBER_OF_OBJECTS_IN_LAYER = (1 << 16);

/**
 * 4096 is max data texture height.
 * Limits the aggregated geometry texture height in the layer.
 */
const MAX_DATA_TEXTURE_HEIGHT = (1 << 12);

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

const tempVec4a = vec4([0, 0, 0, 1]);
const tempVec4b = vec4([0, 0, 0, 1]);
const tempVec4c = vec4([0, 0, 0, 1]);
const tempUint8Array4 = new Uint8Array(4);
const tempFloat32Array3 = new Float32Array(3);

const tempAABB3b = AABB3();

let numLayers = 0;

const DEFAULT_MATRIX = identityMat4();

/**
 *  DTX layer file data.
 *
 *  The elements of an [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#DTX) file, unpacked into a set of arrays for parsing.
 *
 *  This interface represents the structure of a layer within a [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#DTX) file.
 */
export class DTXDataLayer {
    private _numPortions: number;
    private _subPortions: any[];
    private _portionToSubPortionsMap: any[];
    private _bucketGeometries: {};
    private aabb: FloatArrayParam;
    private _numIndices8Bits: number;
    private _numIndices16Bits: number;
    private _numIndices32Bits: number;
    private _numVertices: number;
    private _finalized: boolean;


    private _numEdgeIndices8Bits: number;

    /**
     * Arbitrary metadata JSON for the [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#DTX) file.
     */
    metadata: {};
    positionsCompressed: Uint16Array;
    metallicRoughness: Uint8Array;
    indices8Bits: Uint8Array;
    indices16Bits: Uint16Array;
    indices32Bits: Uint32Array;
    edgeIndices8Bits: Uint8Array;
    edgeIndices16Bits: Uint16Array;
    edgeIndices32Bits: Uint32Array;
    perSubMeshColors: Uint8Array;
    perSubMeshPickColors: Uint8Array;
    perSubMeshSolidFlag: Uint8Array;
    perObjectOffsets: Uint32Array;
    perSubMeshDecodeMatrices: Uint32Array;
    perSubMeshInstancingMatrices: Uint32Array;
    perSubMeshVertexBases: Uint32Array;
    perSubMeshIndicesBases: Uint32Array;
    perSubMeshEdgeIndicesBases: Uint32Array;
    perTriangleSubMesh8Bits: Uint32Array;
    perTriangleSubMesh16Bits: Uint32Array;
    perTriangleSubMesh32Bits: Uint32Array;
    perEdgeSubMesh8Bits: Uint8Array;
    perEdgeSubMesh16Bits: Uint16Array;
    perEdgeSubMesh32Bits: Uint32Array;
    private _numEdgeIndices16Bits: number;
    private _numEdgeIndices32Bits: number;

    constructor(model, cfg) {
        this._numPortions = 0;
        this._subPortions = [];
        this._portionToSubPortionsMap = [];
        this._bucketGeometries = {};
        this.aabb = collapseAABB3();
    }

    /**
     * Returns whether the ```TrianglesDataTextureLayer``` has room for more portions.
     *
     * @param {object} portionCfg An object containing the geometrical data (`positions`, `indices`, `edgeIndices`) for the portion.
     * @returns {Boolean} Wheter the requested portion can be created
     */
    canCreatePortion(portionCfg) {
        const numNewPortions = portionCfg.buckets.length;
        let retVal = (this._numPortions + numNewPortions) <= MAX_NUMBER_OF_OBJECTS_IN_LAYER;
        const bucketIndex = 0; // TODO: Is this a bug?
        const bucketGeometryId = portionCfg.geometryId !== undefined && portionCfg.geometryId !== null
            ? `${portionCfg.geometryId}#${bucketIndex}`
            : `${portionCfg.id}#${bucketIndex}`;
        const alreadyHasPortionGeometry = this._bucketGeometries[bucketGeometryId];
        if (!alreadyHasPortionGeometry) {
            const maxIndicesOfAnyBits = Math.max(this._numIndices8Bits, this._numIndices16Bits, this._numIndices32Bits,);
            let numVertices = 0;
            let numIndices = 0;
            portionCfg.buckets.forEach(bucket => {
                numVertices += bucket.positionsCompressed.length / 3;
                numIndices += bucket.indices.length / 3;
            });

            retVal &&=
                (this._numVertices + numVertices) <= MAX_DATA_TEXTURE_HEIGHT * 4096 &&
                (maxIndicesOfAnyBits + numIndices) <= MAX_DATA_TEXTURE_HEIGHT * 4096;
        }
        return retVal;
    }

    /**
     * Creates a new portion within this TrianglesDataTextureLayer, returns the new portion ID.
     *
     * Gives the portion the specified geometry, color and matrix.
     *
     * @param portionCfg.positionsCompressed Flat float Local-space positionsCompressed array.
     * @param [portionCfg.normals] Flat float normals array.
     * @param [portionCfg.colors] Flat float colors array.
     * @param portionCfg.indices  Flat int indices array.
     * @param [portionCfg.edgeIndices] Flat int edges indices array.
     * @param portionCfg.color Quantized RGB color [0..255,0..255,0..255,0..255]
     * @param portionCfg.metallic Metalness factor [0..255]
     * @param portionCfg.roughness Roughness factor [0..255]
     * @param portionCfg.opacity Opacity [0..255]
     * @param [portionCfg.meshMatrix] Flat float 4x4 matrix - transforms the portion within the coordinate system that's local to the SceneModel
     * @param portionCfg.worldAABB Flat float AABB World-space AABB
     * @param portionCfg.pickColor Quantized pick color
     * @returns {number} Portion ID
     */
    createPortion(portionCfg) {
        if (this._finalized) {
            throw "Already finalized";
        }
        const subPortionIds = [];
        const portionAABB = portionCfg.worldAABB;
        portionCfg.buckets.forEach((bucket, bucketIndex) => {
            const bucketGeometryId = portionCfg.geometryId !== undefined && portionCfg.geometryId !== null
                ? `${portionCfg.geometryId}#${bucketIndex}`
                : `${portionCfg.id}#${bucketIndex}`;
            let bucketGeometry = this._bucketGeometries[bucketGeometryId];
            if (!bucketGeometry) {
                bucketGeometry = this._createBucketGeometry(portionCfg, bucket);
                this._bucketGeometries[bucketGeometryId] = bucketGeometry;
            }
            const subPortionAABB = collapseAABB3(tempAABB3b);
            const subPortionId = this._createSubPortion(portionCfg, bucketGeometry, bucket, subPortionAABB);
            expandAABB3(portionAABB, subPortionAABB);
            subPortionIds.push(subPortionId);
        });
        const origin = this._origin;
        if (origin[0] !== 0 || origin[1] !== 0 || origin[2] !== 0) {
            portionAABB[0] += origin[0];
            portionAABB[1] += origin[1];
            portionAABB[2] += origin[2];
            portionAABB[3] += origin[0];
            portionAABB[4] += origin[1];
            portionAABB[5] += origin[2];
        }
        expandAABB3(this.aabb, portionAABB);
        const portionId = this._portionToSubPortionsMap.length;
        this._portionToSubPortionsMap.push(subPortionIds);
        this.model.numPortions++;
        return portionId;
    }

    _createBucketGeometry(portionCfg, bucket) {

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
        const buffer = this._buffer;


        buffer.positionsBufs = buffer.positionsBufs || [];
        buffer.positionsBufs.push(positionsCompressed)
        if (!buffer.lenPositionsCompressed) {
            buffer.lenPositionsCompressed = 0;
        }


        // for (let i = 0, len = positionsCompressed.length; i < len; i++) {
        //     buffer.positionsCompressed.push(positionsCompressed[i]);
        // }

        const vertexBase = buffer.lenPositionsCompressed / 3;
        const numVertices = positionsCompressed.length / 3;

        buffer.lenPositionsCompressed+=positionsCompressed.length;

        let indicesBase;
        let numTriangles = 0;
        if (indices) {
            numTriangles = indices.length / 3;
            let indicesBuffer;
            if (numVertices <= (1 << 8)) {
                indicesBuffer = buffer.indices8Bits;
            } else if (numVertices <= (1 << 16)) {
                indicesBuffer = buffer.indices16Bits;
            } else {
                indicesBuffer = buffer.indices32Bits;
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
                edgeIndicesBuffer = buffer.edgeIndices8Bits;
            } else if (numVertices <= (1 << 16)) {
                edgeIndicesBuffer = buffer.edgeIndices16Bits;
            } else {
                edgeIndicesBuffer = buffer.edgeIndices32Bits;
            }
            edgeIndicesBase = edgeIndicesBuffer.length / 2;
            for (let i = 0, len = edgeIndices.length; i < len; i++) {
                edgeIndicesBuffer.push(edgeIndices[i]);
            }
        }

        this._numVertices += numVertices;

        const aabb = collapseAABB3();
        expandAABB3Points3(aabb, bucket.positionsCompressed);
        decompressAABB(aabb, portionCfg.positionsDecodeMatrix);

        const bucketGeometry = {
            vertexBase,
            numVertices,
            numTriangles,
            numEdges,
            indicesBase,
            edgeIndicesBase,
            aabb,
            obb: null // Lazy-created in _createSubPortion if needed
        };

        return bucketGeometry;
    }

    _createSubPortion(portionCfg, bucketGeometry, bucket, subPortionAABB) {

        const color = portionCfg.color;
        const metallic = portionCfg.metallic;
        const roughness = portionCfg.roughness;
        const colors = portionCfg.colors;
        const opacity = portionCfg.opacity;
        const meshMatrix = portionCfg.meshMatrix;
        const pickColor = portionCfg.pickColor;
        const buffer = this._buffer;
        const state = this._state;

        buffer.perSubMeshDecodeMatrices.push(portionCfg.positionsDecodeMatrix);
        buffer.perSubMeshInstancingMatrices.push(meshMatrix || DEFAULT_MATRIX);

        if (meshMatrix) { // NB: SceneModel world matrix is used in shaders and SceneModelMesh.aabb

            if (!bucketGeometry.obb) {
                bucketGeometry.obb =AABB3ToOBB3(bucketGeometry.aabb);
            }
            const geometryOBB = bucketGeometry.obb;
            for (let i = 0, len = geometryOBB.length; i < len; i += 4) {
                tempVec4a[0] = geometryOBB[i + 0];
                tempVec4a[1] = geometryOBB[i + 1];
                tempVec4a[2] = geometryOBB[i + 2];
                tempVec4a[3] = 1.0;
                if (meshMatrix) {
                    transformPoint4(meshMatrix, tempVec4a, tempVec4b);
                }
                expandAABB3Point3(subPortionAABB, tempVec4b);
            }
        } else {
            expandAABB3(subPortionAABB, bucketGeometry.aabb);
        }

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
                currentNumIndices = this._numIndices8Bits;
            } else if (bucketGeometry.numVertices <= (1 << 16)) {
                currentNumIndices = this._numIndices16Bits;
            } else {
                currentNumIndices = this._numIndices32Bits;
            }
            buffer.perSubMeshIndicesBases.push(currentNumIndices / 3 - bucketGeometry.indicesBase);
        }

        {
            let currentNumEdgeIndices;
            if (bucketGeometry.numVertices <= (1 << 8)) {
                currentNumEdgeIndices = this._numEdgeIndices8Bits;
            } else if (bucketGeometry.numVertices <= (1 << 16)) {
                currentNumEdgeIndices = this._numEdgeIndices16Bits;
            } else {
                currentNumEdgeIndices = this._numEdgeIndices32Bits;
            }
            buffer.perSubMeshEdgeIndicesBases.push(currentNumEdgeIndices / 2 - bucketGeometry.edgeIndicesBase);
        }

        const subPortionId = this._subPortions.length;
        if (bucketGeometry.numTriangles > 0) {
            let numIndices = bucketGeometry.numTriangles * 3;
            let indicesPortionIdBuffer;
            if (bucketGeometry.numVertices <= (1 << 8)) {
                indicesPortionIdBuffer = buffer.perTriangleSubMesh8Bits;
                this._numIndices8Bits += numIndices;
            } else if (bucketGeometry.numVertices <= (1 << 16)) {
                indicesPortionIdBuffer = buffer.perTriangleSubMesh16Bits;
                this._numIndices16Bits += numIndices;
            } else {
                indicesPortionIdBuffer = buffer.perTriangleSubMesh32Bits;
                this._numIndices32Bits += numIndices;
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
                this._numEdgeIndices8Bits += numEdgeIndices;
            } else if (bucketGeometry.numVertices <= (1 << 16)) {
                edgeIndicesPortionIdBuffer = buffer.perEdgeSubMesh16Bits;
                this._numEdgeIndices16Bits += numEdgeIndices;
            } else {
                edgeIndicesPortionIdBuffer = buffer.perEdgeSubMesh32Bits;
                this._numEdgeIndices32Bits += numEdgeIndices;
            }
            for (let i = 0; i < bucketGeometry.numEdges; i += INDICES_EDGE_INDICES_ALIGNEMENT_SIZE) {
                edgeIndicesPortionIdBuffer.push(subPortionId);
            }
        }

        //   buffer.perObjectOffsets.push([0, 0, 0]);

        this._subPortions.push({
            // vertsBase: vertsIndex,
            numVertices: bucketGeometry.numTriangles
        });

        this._numPortions++;

        return subPortionId;
    }

    /**
     * Builds data textures from the appended geometries and loads them into the GPU.
     *
     * No more portions can then be created.
     */
    finalize() {

        if (this._finalized) {
            return;
        }

        const state = this._state;
        const textureState = this._dataTextureState;
        const gl = this.model.scene.canvas.gl;
        const buffer = this._buffer;

        state.gl = gl;
        const start = performance.now();
        textureState.texturePerObjectIdColorsAndFlags = this._dataTextureGenerator.generateTextureForColorsAndFlags(
            gl,
            buffer.perSubMeshColors,
            buffer.perSubMeshPickColors,
            buffer.perSubMeshVertexBases,
            buffer.perSubMeshIndicesBases,
            buffer.perSubMeshEdgeIndicesBases,
            buffer.perSubMeshSolidFlag);

        textureState.texturePerObjectIdOffsets
            = this._dataTextureGenerator.generateTextureForObjectOffsets(gl, this._numPortions);

        textureState.texturePerObjectIdPositionsDecodeMatrix = this._dataTextureGenerator.generateTextureForPositionsDecodeMatrices(
            gl,
            buffer.perSubMeshDecodeMatrices,
            buffer.perSubMeshInstancingMatrices);

        const positionsCompressed = new Uint16Array(buffer.lenPositionsCompressed);

        let k=0;
        for (let i = 0, len = buffer.positionsBufs.length; i < len; i++) {
            const pc = buffer.positionsBufs[i];

            positionsCompressed.set(pc, k);

            k+=pc.length;
        }

        textureState.positionsCompressedDataTexture = this._dataTextureGenerator.generateTextureForPositions(
            gl,
            positionsCompressed);

        textureState.perTriangleSubMesh8BitsDataTexture = this._dataTextureGenerator.generateTextureForPackedPortionIds(
            gl,
            buffer.perTriangleSubMesh8Bits);

        textureState.perTriangleSubMesh16BitsDataTexture = this._dataTextureGenerator.generateTextureForPackedPortionIds(
            gl,
            buffer.perTriangleSubMesh16Bits);

        textureState.perTriangleSubMesh32BitsDataTexture = this._dataTextureGenerator.generateTextureForPackedPortionIds(
            gl,
            buffer.perTriangleSubMesh32Bits);

        if (buffer.perEdgeSubMesh8Bits.length > 0) {
            textureState.perEdgeSubMesh8BitsDataTexture = this._dataTextureGenerator.generateTextureForPackedPortionIds(
                gl,
                buffer.perEdgeSubMesh8Bits);
        }

        if (buffer.perEdgeSubMesh16Bits.length > 0) {
            textureState.perEdgeSubMesh16BitsDataTexture = this._dataTextureGenerator.generateTextureForPackedPortionIds(
                gl,
                buffer.perEdgeSubMesh16Bits);
        }


        if (buffer.perEdgeSubMesh32Bits.length > 0) {
            textureState.perEdgeSubMesh32BitsDataTexture = this._dataTextureGenerator.generateTextureForPackedPortionIds(
                gl,
                buffer.perEdgeSubMesh32Bits);
        }

        if (buffer.indices8Bits.length > 0) {
            textureState.indices8BitsDataTexture = this._dataTextureGenerator.generateTextureFor8BitIndices(
                gl,
                buffer.indices8Bits);
        }

        if (buffer.indices16Bits.length > 0) {
            textureState.indices16BitsDataTexture = this._dataTextureGenerator.generateTextureFor16BitIndices(
                gl,
                buffer.indices16Bits);
        }

        if (buffer.indices32Bits.length > 0) {
            textureState.indices32BitsDataTexture = this._dataTextureGenerator.generateTextureFor32BitIndices(
                gl,
                buffer.indices32Bits);
        }

        if (buffer.edgeIndices8Bits.length > 0) {
            textureState.edgeIndices8BitsDataTexture = this._dataTextureGenerator.generateTextureFor8BitsEdgeIndices(
                gl,
                buffer.edgeIndices8Bits);
        }

        if (buffer.edgeIndices16Bits.length > 0) {
            textureState.edgeIndices16BitsDataTexture = this._dataTextureGenerator.generateTextureFor16BitsEdgeIndices(
                gl,
                buffer.edgeIndices16Bits);
        }

        if (buffer.edgeIndices32Bits.length > 0) {
            textureState.edgeIndices32BitsDataTexture = this._dataTextureGenerator.generateTextureFor32BitsEdgeIndices(
                gl,
                buffer.edgeIndices32Bits);
        }

        this._bucketGeometries = {};
        this._finalized = true;

    }

}