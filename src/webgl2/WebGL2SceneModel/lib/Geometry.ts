
import {FloatArrayType, IntArrayType, mat4} from "../../../viewer/math/index";
import {ArrayBuf} from "../../lib/ArrayBuf";
import {WebGL2SceneModel} from "../WebGL2SceneModel";
import {
    compressUVs,
    decompressAABB,
    getUVBounds,
    octEncodeNormals,
    quantizePositions
} from "../../../viewer/math/compression/compression";
import {buildEdgeIndices} from "../../../viewer/math/geometry/buildEdgeIndices";
import {AABB3ToOBB3, collapseAABB3, expandAABB3Points3, OBB3} from "../../../viewer/math/boundaries";

import {SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "../../../viewer/constants";
import {GeometryParams} from "../../../viewer/index";


/**
 * @private
 */
export class Geometry {

    public readonly id: number | string;
    public readonly primitive: any;
    public readonly positionsDecompressMatrix: FloatArrayType;
    public readonly uvsDecompressMatrix: FloatArrayType;
    public readonly numIndices: number;
    public readonly obb: FloatArrayType;
    public readonly positionsBuf: ArrayBuf;
    public readonly normalsBuf: ArrayBuf;
    public readonly uvBuf: ArrayBuf;
    public readonly colorsBuf: ArrayBuf;
    public readonly indicesBuf: ArrayBuf;
    public readonly edgeIndicesBuf: ArrayBuf;

    constructor(gl: WebGL2RenderingContext, params: GeometryParams) {

        this.id = params.id;
        this.primitive = params.primitive;
        this.positionsDecompressMatrix = mat4();
        this.uvsDecompressMatrix = null;
        this.numIndices = 0;
        this.obb = OBB3();
        this.positionsBuf = null;
        this.normalsBuf = null;
        this.edgeIndicesBuf = null;
        this.uvBuf = null;
        this.colorsBuf = null;

        if (params.positionsCompressed && params.positionsCompressed.length > 0) {
            const normalized = false;
            this.positionsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, params.positionsCompressed, params.positionsCompressed.length, 3, gl.STATIC_DRAW, normalized);
            // @ts-ignore
            this.positionsDecompressMatrix.set(params.positionsDecompressMatrix);
            const localAABB = collapseAABB3();
            expandAABB3Points3(localAABB, params.positionsCompressed);
            decompressAABB(localAABB, this.positionsDecompressMatrix);
            AABB3ToOBB3(localAABB, this.obb);

        } else if (params.positions && params.positions.length > 0) {
            const lenPositions = params.positions.length;
            const localAABB = collapseAABB3();
            expandAABB3Points3(localAABB, params.positions);
            AABB3ToOBB3(localAABB, this.obb);
            const quantizedPositions = quantizePositions(params.positions, localAABB, this.positionsDecompressMatrix);
            let normalized = false;
            this.positionsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, quantizedPositions, lenPositions, 3, gl.STATIC_DRAW, normalized);
        }

        if (params.normalsCompressed && params.normalsCompressed.length > 0) {
            const normalized = true; // For oct-encoded UInt8
            this.normalsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, params.normalsCompressed, params.normalsCompressed.length, 3, gl.STATIC_DRAW, normalized);

        } else if (params.normals && params.normals.length > 0) {
            const compressedNormals = octEncodeNormals(params.normals);
            const normalized = true; // For oct-encoded UInt8
            this.normalsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, compressedNormals, compressedNormals.length, 3, gl.STATIC_DRAW, normalized);
        }

        if (params.colorsCompressed && params.colorsCompressed.length > 0) {
            const colorsCompressed = new Uint8Array(params.colorsCompressed);
            const notNormalized = false;
            this.colorsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, colorsCompressed, colorsCompressed.length, 4, gl.STATIC_DRAW, notNormalized);

        } else if (params.colors && params.colors.length > 0) {
            const colors = params.colors;
            const colorsCompressed = new Uint8Array(colors.length);
            for (let i = 0, len = colors.length; i < len; i++) {
                colorsCompressed[i] = colors[i] * 255;
            }
            const notNormalized = false;
            this.colorsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, colorsCompressed, colorsCompressed.length, 4, gl.STATIC_DRAW, notNormalized);
        }

        if (params.uvsCompressed && params.uvsCompressed.length > 0) {
            const uvsCompressed = new Uint16Array(params.uvsCompressed);
            this.uvsDecompressMatrix = mat4(params.uvsDecompressMatrix);
            this.uvBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, params.uvsCompressed, uvsCompressed.length, 2, gl.STATIC_DRAW, false);

        } else if (params.uvs && params.uvs.length > 0) {
            const bounds = getUVBounds(params.uvs);
            const result = compressUVs(params.uvs, bounds.min, bounds.max);
            const uvsCompressed = result.quantized;
            this.uvsDecompressMatrix = result.decompressMatrix;
            this.uvBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, uvsCompressed, uvsCompressed.length, 2, gl.STATIC_DRAW, false);
        }

        if (params.indices && params.indices.length > 0) {
            this.indicesBuf = new ArrayBuf(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(params.indices), params.indices.length, 1, gl.STATIC_DRAW);
            this.numIndices = params.indices.length;
        }

        if (params.primitive === TrianglesPrimitive || params.primitive === SolidPrimitive || params.primitive === SurfacePrimitive) {
            let edgeIndices = params.edgeIndices;
            if (!edgeIndices) {
                edgeIndices = buildEdgeIndices(params.positions, params.indices, null, params.edgeThreshold || 10);
            }
            this.edgeIndicesBuf = new ArrayBuf(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(edgeIndices), edgeIndices.length, 1, gl.STATIC_DRAW);
        }
    }

    destroy() {
        if (this.positionsBuf) {
            this.positionsBuf.destroy();
        }
        if (this.normalsBuf) {
            this.normalsBuf.destroy();
        }
        if (this.colorsBuf) {
            this.colorsBuf.destroy();
        }
        if (this.uvBuf) {
            this.uvBuf.destroy();
        }
        if (this.indicesBuf) {
            this.indicesBuf.destroy();
        }
        if (this.edgeIndicesBuf) {
            this.edgeIndicesBuf.destroy();
        }
    }
}


