import * as math from "../../../../math/index";
import {ArrayBuf} from "../../lib/ArrayBuf";
import {octEncodeNormals, quantizePositions} from "./compression/index";
import {WebGLVBOSceneModel} from "../WebGLVBOSceneModel";
import {
    buildEdgeIndices,
    compressUVs,
    decompressAABB,
    FloatArrayType,
    getUVBounds,
    IntArrayType
} from "../../../../math/index";

/**
 * @private
 */
export class WebGLVBOGeometry {

    public readonly id: number | string;
    public readonly sceneModel: WebGLVBOSceneModel;
    public readonly primitive: any;
    public readonly positionsDecompressMatrix: FloatArrayType;
    public readonly uvDecompressMatrix: FloatArrayType;
    public readonly numIndices: number;
    public readonly obb: FloatArrayType;
    public readonly positionsBuf: ArrayBuf;
    public readonly normalsBuf: ArrayBuf;
    public readonly uvBuf: ArrayBuf;
    public readonly colorsBuf: ArrayBuf;
    public readonly indicesBuf: ArrayBuf;
    public readonly edgeIndicesBuf: ArrayBuf;

    constructor(sceneModel: WebGLVBOSceneModel,
                gl: WebGL2RenderingContext,
                cfg: {
                    id: string | number;
                    primitive: string;
                    positions: math.FloatArrayType;
                    positionsCompressed: Uint16Array;
                    positionsDecompressMatrix: Float32Array;
                    normalsCompressed: Uint8Array;
                    normals: math.FloatArrayType;
                    colorsCompressed: Uint8Array;
                    colors: math.FloatArrayType;
                    uv: math.FloatArrayType;
                    uvCompressed: Uint16Array;
                    uvDecompressMatrix: Float32Array;
                    indices: IntArrayType;
                    edgeIndices: IntArrayType;
                    edgeThreshold: number;
                }) {

        this.id = cfg.id;
        this.sceneModel = sceneModel;
        this.primitive = cfg.primitive;
        this.positionsDecompressMatrix = math.mat4();
        this.uvDecompressMatrix = null;
        this.numIndices = 0;
        this.obb = math.OBB3();
        this.positionsBuf = null;
        this.normalsBuf = null;
        this.edgeIndicesBuf = null;
        this.uvBuf = null;
        this.colorsBuf = null;

        if (cfg.positionsCompressed && cfg.positionsCompressed.length > 0) {
            const normalized = false;
            this.positionsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, cfg.positionsCompressed, cfg.positionsCompressed.length, 3, gl.STATIC_DRAW, normalized);
            // @ts-ignore
            this.positionsDecompressMatrix.set(cfg.positionsDecompressMatrix);
            const localAABB = math.collapseAABB3();
            math.expandAABB3Points3(localAABB, cfg.positionsCompressed);
            decompressAABB(localAABB, this.positionsDecompressMatrix);
            math.AABB3ToOBB3(localAABB, this.obb);

        } else if (cfg.positions && cfg.positions.length > 0) {
            const lenPositions = cfg.positions.length;
            const localAABB = math.collapseAABB3();
            math.expandAABB3Points3(localAABB, cfg.positions);
            math.AABB3ToOBB3(localAABB, this.obb);
            const quantizedPositions = quantizePositions(cfg.positions, localAABB, this.positionsDecompressMatrix);
            let normalized = false;
            this.positionsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, quantizedPositions, lenPositions, 3, gl.STATIC_DRAW, normalized);
        }

        if (cfg.normalsCompressed && cfg.normalsCompressed.length > 0) {
            const normalized = true; // For oct-encoded UInt8
            this.normalsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, cfg.normalsCompressed, cfg.normalsCompressed.length, 3, gl.STATIC_DRAW, normalized);

        } else if (cfg.normals && cfg.normals.length > 0) {
            const compressedNormals = octEncodeNormals(cfg.normals);
            const normalized = true; // For oct-encoded UInt8
            this.normalsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, compressedNormals, compressedNormals.length, 3, gl.STATIC_DRAW, normalized);
        }

        if (cfg.colorsCompressed && cfg.colorsCompressed.length > 0) {
            const colorsCompressed = new Uint8Array(cfg.colorsCompressed);
            const notNormalized = false;
            this.colorsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, colorsCompressed, colorsCompressed.length, 4, gl.STATIC_DRAW, notNormalized);

        } else if (cfg.colors && cfg.colors.length > 0) {
            const colors = cfg.colors;
            const colorsCompressed = new Uint8Array(colors.length);
            for (let i = 0, len = colors.length; i < len; i++) {
                colorsCompressed[i] = colors[i] * 255;
            }
            const notNormalized = false;
            this.colorsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, colorsCompressed, colorsCompressed.length, 4, gl.STATIC_DRAW, notNormalized);
        }

        if (cfg.uvCompressed && cfg.uvCompressed.length > 0) {
            const uvCompressed = new Uint16Array(cfg.uvCompressed);
            this.uvDecompressMatrix = math.mat4(cfg.uvDecompressMatrix);
            this.uvBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, cfg.uvCompressed, uvCompressed.length, 2, gl.STATIC_DRAW, false);

        } else if (cfg.uv && cfg.uv.length > 0) {
            const bounds = getUVBounds(cfg.uv);
            const result = compressUVs(cfg.uv, bounds.min, bounds.max);
            const uvCompressed = result.quantized;
            this.uvDecompressMatrix = result.decompressMatrix;
            this.uvBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, uvCompressed, uvCompressed.length, 2, gl.STATIC_DRAW, false);
        }

        if (cfg.indices && cfg.indices.length > 0) {
            this.indicesBuf = new ArrayBuf(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(cfg.indices), cfg.indices.length, 1, gl.STATIC_DRAW);
            this.numIndices = cfg.indices.length;
        }

        if (cfg.primitive === "triangles" || cfg.primitive === "solid" || cfg.primitive === "surface") {
            let edgeIndices = cfg.edgeIndices;
            if (!edgeIndices) {
                edgeIndices = buildEdgeIndices(cfg.positions, cfg.indices, null, cfg.edgeThreshold || 10);
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


