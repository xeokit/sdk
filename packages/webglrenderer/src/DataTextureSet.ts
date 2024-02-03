import {WebGLDataTexture} from "@xeokit/webglutils";
import {DataTextureBuffer} from "./DataTextureBuffer";
import {FloatArrayParam, IntArrayParam} from "@xeokit/math";

/**
 * @private
 */
export class DataTextureSet {

     numPortions: number;

    readonly gl: WebGL2RenderingContext;

    readonly positionsCompressedDataTexture: WebGLDataTexture;
    readonly perSubMeshAttributesDataTexture: WebGLDataTexture;
    readonly perSubMeshInstancingMatricesDataTexture: WebGLDataTexture;
    readonly perSubMeshDecodeMatricesDataTexture: WebGLDataTexture;

    readonly perPrimitiveSubMesh8BitsDataTexture: WebGLDataTexture;
    readonly perPrimitiveSubMesh16BitsDataTexture: WebGLDataTexture;
    readonly perPrimitiveSubMesh32BitsDataTexture: WebGLDataTexture;

    readonly perEdgeSubMesh8BitsDataTexture: WebGLDataTexture;
    readonly perEdgeSubMesh16BitsDataTexture: WebGLDataTexture;
    readonly perEdgeSubMesh32BitsDataTexture: WebGLDataTexture;

    readonly indices8BitsDataTexture: WebGLDataTexture;
    readonly  indices16BitsDataTexture: WebGLDataTexture;
    readonly  indices32BitsDataTexture: WebGLDataTexture;

    readonly edgeIndices8BitsDataTexture: WebGLDataTexture;
    readonly edgeIndices16BitsDataTexture: WebGLDataTexture;
    readonly edgeIndices32BitsDataTexture: WebGLDataTexture;

    readonly indices: { 16: WebGLDataTexture; 8: WebGLDataTexture; 32: WebGLDataTexture; };
    readonly eachPrimitiveMesh: { 16: WebGLDataTexture; 8: WebGLDataTexture; 32: WebGLDataTexture };
    readonly edgeIndices: { 16: WebGLDataTexture; 8: WebGLDataTexture; 32: WebGLDataTexture };
    readonly eachEdgeMesh: { 16: WebGLDataTexture; 8: WebGLDataTexture; 32: WebGLDataTexture };

    constructor(gl: WebGL2RenderingContext, dataTextureBuffer: DataTextureBuffer) {

        this.numPortions = 0;
        this.gl = gl;

        // Primitive -> SceneMesh lookup
        this.perPrimitiveSubMesh8BitsDataTexture = this.#createTextureForPackedPortionIds(dataTextureBuffer.perPrimitiveSubMesh8Bits);
        this.perPrimitiveSubMesh16BitsDataTexture = this.#createTextureForPackedPortionIds(dataTextureBuffer.perPrimitiveSubMesh16Bits);
        this.perPrimitiveSubMesh32BitsDataTexture = this.#createTextureForPackedPortionIds(dataTextureBuffer.perPrimitiveSubMesh32Bits);

        // SceneMesh -> attributes lookup
        this.perSubMeshAttributesDataTexture = this.#createPerSubMeshAttributesDataTexture( // Flags (except for solid) are inserted later
            dataTextureBuffer.perSubMeshColors,
            dataTextureBuffer.perSubMeshPickColors,
            dataTextureBuffer.perSubMeshVertexBases,
            dataTextureBuffer.perSubMeshIndicesBases,
            dataTextureBuffer.perSubMeshEdgeIndicesBases,
            dataTextureBuffer.perSubMeshSolidFlag);

        // SceneMesh -> instancing matrix
        this.perSubMeshInstancingMatricesDataTexture = this.#createPerSubMeshInstancingMatricesDataTexture(dataTextureBuffer.perSubMeshInstancingMatrices);

        // SceneMesh -> positions decompress matrix
        this.perSubMeshDecodeMatricesDataTexture = this.#createPerSubMeshDecodeMatricesDataTexture(dataTextureBuffer.perSubMeshDecodeMatrices);

        // Vertex -> position
        this.positionsCompressedDataTexture = this.#createTextureForPositions(dataTextureBuffer.positionsCompressed, dataTextureBuffer.lenPositionsCompressed);

        if (dataTextureBuffer.perEdgeSubMesh8Bits.length > 0) {
            this.perEdgeSubMesh8BitsDataTexture = this.#createTextureForPackedPortionIds(dataTextureBuffer.perEdgeSubMesh8Bits);
        }
        if (dataTextureBuffer.perEdgeSubMesh16Bits.length > 0) {
            this.perEdgeSubMesh16BitsDataTexture = this.#createTextureForPackedPortionIds(dataTextureBuffer.perEdgeSubMesh16Bits);
        }
        if (dataTextureBuffer.perEdgeSubMesh32Bits.length > 0) {
            this.perEdgeSubMesh32BitsDataTexture = this.#createTextureForPackedPortionIds(dataTextureBuffer.perEdgeSubMesh32Bits);
        }

        if (dataTextureBuffer.lenIndices8Bits > 0) {
            this.indices8BitsDataTexture = this.#createIndices8BitDataTexture(dataTextureBuffer.indices8Bits, dataTextureBuffer.lenIndices8Bits);
        }
        if (dataTextureBuffer.lenIndices16Bits > 0) {
            this.indices16BitsDataTexture = this.#createIndices16BitDataTexture(dataTextureBuffer.indices16Bits, dataTextureBuffer.lenIndices16Bits);
        }
        if (dataTextureBuffer.lenIndices32Bits > 0) {
            this.indices32BitsDataTexture = this.#createIndices32BitDataTexture(dataTextureBuffer.indices32Bits, dataTextureBuffer.lenIndices32Bits);
        }
        if (dataTextureBuffer.lenEdgeIndices8Bits > 0) {
            this.edgeIndices8BitsDataTexture = this.#createEdgeIndices8BitDataTexture(dataTextureBuffer.edgeIndices8Bits, dataTextureBuffer.lenEdgeIndices8Bits);
        }
        if (dataTextureBuffer.lenEdgeIndices16Bits > 0) {
            this.edgeIndices16BitsDataTexture = this.#createEdgeIndices16BitDataTexture(dataTextureBuffer.edgeIndices16Bits, dataTextureBuffer.lenEdgeIndices16Bits);
        }
        if (dataTextureBuffer.lenEdgeIndices32Bits > 0) {
            this.edgeIndices32BitsDataTexture = this.#createEdgeIndices32BitDataTexture(dataTextureBuffer.edgeIndices32Bits, dataTextureBuffer.lenEdgeIndices32Bits);
        }

        this.indices = {
            8: this.indices8BitsDataTexture,
            16: this.indices16BitsDataTexture,
            32: this.indices32BitsDataTexture,
        };
        this.eachPrimitiveMesh = {
            8: this.perPrimitiveSubMesh8BitsDataTexture,
            16: this.perPrimitiveSubMesh8BitsDataTexture,
            32: this.perPrimitiveSubMesh8BitsDataTexture,
        };
        this.edgeIndices = {
            8: this.edgeIndices8BitsDataTexture,
            16: this.edgeIndices16BitsDataTexture,
            32: this.edgeIndices32BitsDataTexture,
        };
        this.eachEdgeMesh = {
            8: this.perEdgeSubMesh8BitsDataTexture,
            16: this.perEdgeSubMesh16BitsDataTexture,
            32: this.perEdgeSubMesh32BitsDataTexture,
        };
    }

    #createPerSubMeshAttributesDataTexture(
        colors: IntArrayParam[],
        pickColors: IntArrayParam[],
        vertexBases: IntArrayParam,
        indexBaseOffsets: IntArrayParam,
        edgeIndexBaseOffsets: IntArrayParam,
        solid: boolean[]): WebGLDataTexture {

        const numPortions = colors.length;

        // The number of rows in the texture is the number of
        // objects in the layer.

        this.numPortions = numPortions;

        const textureWidth = 512 * 8;
        const textureHeight = Math.ceil(numPortions / (textureWidth / 8));

        if (textureHeight === 0) {
            throw "texture height===0";
        }
        const textureData = new Uint8Array(4 * textureWidth * textureHeight);
        for (let i = 0; i < numPortions; i++) {
            // object color
            textureData.set(colors [i], i * 32 + 0);
            textureData.set(pickColors [i], i * 32 + 4); // object pick color
            textureData.set([0, 0, 0, 0], i * 32 + 8);     // object flags
            textureData.set([0, 0, 0, 0], i * 32 + 12);        // object flags2

            // vertex base
            textureData.set([
                    (vertexBases[i] >> 24) & 255,
                    (vertexBases[i] >> 16) & 255,
                    (vertexBases[i] >> 8) & 255,
                    (vertexBases[i]) & 255,
                ],
                i * 32 + 16
            );

            // triangles index base offset
            textureData.set(
                [
                    (indexBaseOffsets[i] >> 24) & 255,
                    (indexBaseOffsets[i] >> 16) & 255,
                    (indexBaseOffsets[i] >> 8) & 255,
                    (indexBaseOffsets[i]) & 255,
                ],
                i * 32 + 20
            );

            // edge index base offset
            textureData.set(
                [
                    (edgeIndexBaseOffsets[i] >> 24) & 255,
                    (edgeIndexBaseOffsets[i] >> 16) & 255,
                    (edgeIndexBaseOffsets[i] >> 8) & 255,
                    (edgeIndexBaseOffsets[i]) & 255,
                ],
                i * 32 + 24
            );

            // is-solid flag
            textureData.set([solid[i] ? 1 : 0, 0, 0, 0], i * 32 + 28);
        }
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new WebGLDataTexture({gl, texture, textureWidth, textureHeight, textureData});
    }

    #createTextureForObjectOffsets(numOffsets: number): WebGLDataTexture {
        const textureWidth = 512;
        const textureHeight = Math.ceil(numOffsets / textureWidth);
        if (textureHeight === 0) {
            throw "texture height===0";
        }
        const textureData = new Float32Array(3 * textureWidth * textureHeight).fill(0);

        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB32F, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB, gl.FLOAT, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new WebGLDataTexture({gl, texture, textureWidth, textureHeight, textureData});
    }

    #createPerSubMeshInstancingMatricesDataTexture(instanceMatrices: FloatArrayParam[]): WebGLDataTexture {
        const numMatrices = instanceMatrices.length;
        if (numMatrices === 0) {
            throw "num instance matrices===0";
        }
        // in one row we can fit 512 matrices
        const textureWidth = 512 * 4;
        const textureHeight = Math.ceil(numMatrices / (textureWidth / 4));
        const textureData = new Float32Array(4 * textureWidth * textureHeight);
        // dataTextureRamStats.sizeDataPositionDecodeMatrices += textureData.byteLength;
        for (let i = 0; i < instanceMatrices.length; i++) {            // 4x4 values
            textureData.set(instanceMatrices[i], i * 16);
        }
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGBA, gl.FLOAT, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new WebGLDataTexture({gl, texture, textureWidth, textureHeight, textureData});
    }

    #createPerSubMeshDecodeMatricesDataTexture(positionDecodeMatrices: FloatArrayParam[]): WebGLDataTexture {
        const numMatrices = positionDecodeMatrices.length;
        if (numMatrices === 0) {
            throw "num decode+entity matrices===0";
        }
        // in one row we can fit 512 matrices
        const textureWidth = 512 * 4;
        const textureHeight = Math.ceil(numMatrices / (textureWidth / 4));
        const textureData = new Float32Array(4 * textureWidth * textureHeight);
        for (let i = 0; i < positionDecodeMatrices.length; i++) {            // 4x4 values
            textureData.set(positionDecodeMatrices[i], i * 16);
        }
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGBA, gl.FLOAT, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new WebGLDataTexture({gl, texture, textureWidth, textureHeight});
    }

    #createIndices8BitDataTexture(indicesArrays: IntArrayParam[], lenIndices: number): WebGLDataTexture {
        if (lenIndices === 0) {
            throw "lenIndices === 0";
        }
        const textureWidth = 4096;
        const textureHeight = Math.ceil(lenIndices / 3 / textureWidth);
        if (textureHeight === 0) {
            throw "texture height===0";
        }
        const texArraySize = textureWidth * textureHeight * 3;
        const textureData = new Uint8Array(texArraySize);
        for (let i = 0, j = 0, len = indicesArrays.length; i < len; i++) {
            const pc = indicesArrays[i];
            textureData.set(pc, j);
            j += pc.length;
        }
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB8UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB_INTEGER, gl.UNSIGNED_BYTE, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new WebGLDataTexture({gl, texture, textureWidth, textureHeight});
    }

    #createIndices16BitDataTexture(indicesArrays: IntArrayParam[], lenIndices: number): WebGLDataTexture {
        if (lenIndices === 0) {
            throw "lenIndices === 0";
        }
        const textureWidth = 4096;
        const textureHeight = Math.ceil(lenIndices / 3 / textureWidth);
        if (textureHeight === 0) {
            throw "texture height===0";
        }
        const texArraySize = textureWidth * textureHeight * 3;
        const textureData = new Uint16Array(texArraySize);
        for (let i = 0, j = 0, len = indicesArrays.length; i < len; i++) {
            const pc = indicesArrays[i];
            textureData.set(pc, j);
            j += pc.length;
        }
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB16UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB_INTEGER, gl.UNSIGNED_SHORT, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new WebGLDataTexture({gl, texture, textureWidth, textureHeight});
    }

    #createIndices32BitDataTexture(indicesArrays: IntArrayParam[], lenIndices: number): WebGLDataTexture {
        if (lenIndices === 0) {
            throw "lenIndices === 0";
        }
        const textureWidth = 4096;
        const textureHeight = Math.ceil(lenIndices / 3 / textureWidth);
        if (textureHeight === 0) {
            throw "texture height===0";
        }
        const texArraySize = textureWidth * textureHeight * 3;
        const textureData = new Uint32Array(texArraySize);
        for (let i = 0, j = 0, len = indicesArrays.length; i < len; i++) {
            const pc = indicesArrays[i];
            textureData.set(pc, j);
            j += pc.length;
        }
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB32UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB_INTEGER, gl.UNSIGNED_INT, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new WebGLDataTexture({gl, texture, textureWidth, textureHeight});
    }

    #createEdgeIndices8BitDataTexture(indicesArrays: IntArrayParam[], lenIndices: number): WebGLDataTexture {
        if (lenIndices === 0) {
            throw "lenIndices === 0";
        }
        const textureWidth = 4096;
        const textureHeight = Math.ceil(lenIndices / 2 / textureWidth);
        if (textureHeight === 0) {
            throw "texture height===0";
        }
        const texArraySize = textureWidth * textureHeight * 2;
        const textureData = new Uint8Array(texArraySize);
        for (let i = 0, j = 0, len = indicesArrays.length; i < len; i++) {
            const pc = indicesArrays[i];
            textureData.set(pc, j);
            j += pc.length;
        }
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG8UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RG_INTEGER, gl.UNSIGNED_BYTE, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new WebGLDataTexture({gl, texture, textureWidth, textureHeight});
    }

    #createEdgeIndices16BitDataTexture(indicesArrays: IntArrayParam[], lenIndices: number): WebGLDataTexture {
        if (lenIndices === 0) {
            throw "lenIndices === 0";
        }
        const textureWidth = 4096;
        const textureHeight = Math.ceil(lenIndices / 2 / textureWidth);
        if (textureHeight === 0) {
            throw "texture height===0";
        }
        const texArraySize = textureWidth * textureHeight * 2;
        const textureData = new Uint16Array(texArraySize);
        for (let i = 0, j = 0, len = indicesArrays.length; i < len; i++) {
            const pc = indicesArrays[i];
            textureData.set(pc, j);
            j += pc.length;
        }
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG16UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RG_INTEGER, gl.UNSIGNED_SHORT, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new WebGLDataTexture({gl, texture, textureWidth, textureHeight});
    }

    #createEdgeIndices32BitDataTexture(indicesArrays: IntArrayParam[], lenIndices: number): WebGLDataTexture {
        if (lenIndices === 0) {
            throw "lenIndices === 0";
        }
        const textureWidth = 4096;
        const textureHeight = Math.ceil(lenIndices / 2 / textureWidth);
        if (textureHeight === 0) {
            throw "texture height===0";
        }
        const texArraySize = textureWidth * textureHeight * 2;
        const textureData = new Uint32Array(texArraySize);
        for (let i = 0, j = 0, len = indicesArrays.length; i < len; i++) {
            const pc = indicesArrays[i];
            textureData.set(pc, j);
            j += pc.length;
        }
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG32UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RG_INTEGER, gl.UNSIGNED_INT, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new WebGLDataTexture({gl, texture, textureWidth, textureHeight});
    }

    #createTextureForPositions(positionsArrays: IntArrayParam[], lenPositions: number): WebGLDataTexture {
        const numVertices = lenPositions / 3;
        const textureWidth = 4096;
        const textureHeight = Math.ceil(numVertices / textureWidth);
        if (textureHeight === 0) {
            throw "texture height===0";
        }
        const texArraySize = textureWidth * textureHeight * 3;
        const textureData = new Uint16Array(texArraySize);
        for (let i = 0, j = 0, len = positionsArrays.length; i < len; i++) {
            const pc = positionsArrays[i];
            textureData.set(pc, j);
            j += pc.length;
        }
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB16UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB_INTEGER, gl.UNSIGNED_SHORT, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new WebGLDataTexture({gl, texture, textureWidth, textureHeight});
    }

    #createTextureForPackedPortionIds(portionIdsArray: IntArrayParam): WebGLDataTexture {
        if (portionIdsArray.length === 0) {
            return null;
        }
        const lenArray = portionIdsArray.length;
        const textureWidth = 4096;
        const textureHeight = Math.ceil(lenArray / textureWidth);
        if (textureHeight === 0) {
            throw null;
        }
        const texArraySize = textureWidth * textureHeight;
        const textureData = new Uint16Array(texArraySize);
        textureData.set(portionIdsArray, 0);
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R16UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RED_INTEGER, gl.UNSIGNED_SHORT, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new WebGLDataTexture({gl, texture, textureWidth, textureHeight});
    }

    destroy() {
        if (this.perSubMeshAttributesDataTexture) {
            this.perSubMeshAttributesDataTexture.destroy();
        }
        if (this.perSubMeshInstancingMatricesDataTexture) {
            this.perSubMeshInstancingMatricesDataTexture.destroy();
        }
        if (this.perSubMeshDecodeMatricesDataTexture) {
            this.perSubMeshDecodeMatricesDataTexture.destroy();
        }
        if (this.positionsCompressedDataTexture) {
            this.positionsCompressedDataTexture.destroy();
        }
        if (this.perPrimitiveSubMesh8BitsDataTexture) {
            this.perPrimitiveSubMesh8BitsDataTexture.destroy();
        }
        if (this.perPrimitiveSubMesh16BitsDataTexture) {
            this.perPrimitiveSubMesh16BitsDataTexture.destroy();
        }
        if (this.perPrimitiveSubMesh32BitsDataTexture) {
            this.perPrimitiveSubMesh32BitsDataTexture.destroy();
        }
        if (this.perEdgeSubMesh8BitsDataTexture) {
            this.perEdgeSubMesh8BitsDataTexture.destroy();
        }
        if (this.perEdgeSubMesh16BitsDataTexture) {
            this.perEdgeSubMesh16BitsDataTexture.destroy();
        }
        if (this.perEdgeSubMesh32BitsDataTexture) {
            this.perEdgeSubMesh32BitsDataTexture.destroy();
        }
        if (this.indices8BitsDataTexture) {
            this.indices8BitsDataTexture.destroy();
        }
        if (this.indices16BitsDataTexture) {
            this.indices16BitsDataTexture.destroy();
        }
        if (this.indices32BitsDataTexture) {
            this.indices32BitsDataTexture.destroy()
        }
        if (this.edgeIndices8BitsDataTexture) {
            this.edgeIndices8BitsDataTexture.destroy()
        }
        if (this.edgeIndices16BitsDataTexture) {
            this.edgeIndices16BitsDataTexture.destroy();
        }
        if (this.edgeIndices32BitsDataTexture) {
            this.edgeIndices32BitsDataTexture.destroy();
        }
    }
}
