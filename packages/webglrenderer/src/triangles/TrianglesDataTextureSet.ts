import {WebGLDataTexture} from "@xeokit/webglutils";
import {TrianglesDataTextureBuffer} from "./TrianglesDataTextureBuffer";
import {FloatArrayParam, IntArrayParam} from "@xeokit/math";

/**
 * @private
 */
export class TrianglesDataTextureSet {

    numPortions: number;

    gl: WebGL2RenderingContext;

    positionsCompressedDataTexture: WebGLDataTexture;
    perSubMeshAttributesDataTexture: WebGLDataTexture;
    perSubMeshInstancingMatricesDataTexture: WebGLDataTexture;
    perSubMeshDecodeMatricesDataTexture: WebGLDataTexture;
    perTriangleSubMesh8BitsDataTexture: WebGLDataTexture;
    perTriangleSubMesh16BitsDataTexture: WebGLDataTexture;
    perTriangleSubMesh32BitsDataTexture: WebGLDataTexture;
    perEdgeSubMesh8BitsDataTexture: WebGLDataTexture;
    perEdgeSubMesh16BitsDataTexture: WebGLDataTexture;
    perEdgeSubMesh32BitsDataTexture: WebGLDataTexture;
    indices8BitsDataTexture: WebGLDataTexture;
    indices16BitsDataTexture: WebGLDataTexture;
    indices32BitsDataTexture: WebGLDataTexture;
    edgeIndices8BitsDataTexture: WebGLDataTexture;
    edgeIndices16BitsDataTexture: WebGLDataTexture;
    edgeIndices32BitsDataTexture: WebGLDataTexture;

    constructor(gl: WebGL2RenderingContext, trianglesDataTextureBuffer: TrianglesDataTextureBuffer) {

        this.numPortions = 0;
        this.gl = gl;

        // Triangle -> SceneMesh lookup

        this.perTriangleSubMesh8BitsDataTexture = this.#createTextureForPackedPortionIds(trianglesDataTextureBuffer.perTriangleSubMesh8Bits);
        this.perTriangleSubMesh16BitsDataTexture = this.#createTextureForPackedPortionIds(trianglesDataTextureBuffer.perTriangleSubMesh16Bits);
        this.perTriangleSubMesh32BitsDataTexture = this.#createTextureForPackedPortionIds(trianglesDataTextureBuffer.perTriangleSubMesh32Bits);

        // SceneMesh -> attributes lookup

        this.perSubMeshAttributesDataTexture = this.#createPerSubMeshAttributesDataTexture( // Flags (except for solid) are inserted later
            trianglesDataTextureBuffer.perSubMeshColors,
            trianglesDataTextureBuffer.perSubMeshPickColors,
            trianglesDataTextureBuffer.perSubMeshVertexBases,
            trianglesDataTextureBuffer.perSubMeshIndicesBases,
            trianglesDataTextureBuffer.perSubMeshEdgeIndicesBases,
            trianglesDataTextureBuffer.perSubMeshSolidFlag);

        // SceneMesh -> instancing matrix

        this.perSubMeshInstancingMatricesDataTexture = this.#createPerSubMeshInstancingMatricesDataTexture(trianglesDataTextureBuffer.perSubMeshInstancingMatrices);

        // SceneMesh -> positions decompress matrix

        this.perSubMeshDecodeMatricesDataTexture = this.#createPerSubMeshDecodeMatricesDataTexture(trianglesDataTextureBuffer.perSubMeshDecodeMatrices);

        // Vertex -> position

        this.positionsCompressedDataTexture = this.#createTextureForPositions(trianglesDataTextureBuffer.positionsCompressed, trianglesDataTextureBuffer.lenPositionsCompressed);

        if (trianglesDataTextureBuffer.perEdgeSubMesh8Bits.length > 0) {
            this.perEdgeSubMesh8BitsDataTexture = this.#createTextureForPackedPortionIds(trianglesDataTextureBuffer.perEdgeSubMesh8Bits);
        }
        if (trianglesDataTextureBuffer.perEdgeSubMesh16Bits.length > 0) {
            this.perEdgeSubMesh16BitsDataTexture = this.#createTextureForPackedPortionIds(trianglesDataTextureBuffer.perEdgeSubMesh16Bits);
        }
        if (trianglesDataTextureBuffer.perEdgeSubMesh32Bits.length > 0) {
            this.perEdgeSubMesh32BitsDataTexture = this.#createTextureForPackedPortionIds(trianglesDataTextureBuffer.perEdgeSubMesh32Bits);
        }

        if (trianglesDataTextureBuffer.lenIndices8Bits > 0) {
            this.indices8BitsDataTexture = this.#createIndices8BitDataTexture(trianglesDataTextureBuffer.indices8Bits, trianglesDataTextureBuffer.lenIndices8Bits);
        }
        if (trianglesDataTextureBuffer.lenIndices16Bits > 0) {
            this.indices16BitsDataTexture = this.#createIndices16BitDataTexture(trianglesDataTextureBuffer.indices16Bits, trianglesDataTextureBuffer.lenIndices16Bits);
        }
        if (trianglesDataTextureBuffer.lenIndices32Bits > 0) {
            this.indices32BitsDataTexture = this.#createIndices32BitDataTexture(trianglesDataTextureBuffer.indices32Bits, trianglesDataTextureBuffer.lenIndices32Bits);
        }
        if (trianglesDataTextureBuffer.lenEdgeIndices8Bits > 0) {
            this.edgeIndices8BitsDataTexture = this.#createEdgeIndices8BitDataTexture(trianglesDataTextureBuffer.edgeIndices8Bits, trianglesDataTextureBuffer.lenEdgeIndices8Bits);
        }
        if (trianglesDataTextureBuffer.lenEdgeIndices16Bits > 0) {
            this.edgeIndices16BitsDataTexture = this.#createEdgeIndices16BitDataTexture(trianglesDataTextureBuffer.edgeIndices16Bits, trianglesDataTextureBuffer.lenEdgeIndices16Bits);
        }
        if (trianglesDataTextureBuffer.lenEdgeIndices32Bits > 0) {
            this.edgeIndices32BitsDataTexture = this.#createEdgeIndices32BitDataTexture(trianglesDataTextureBuffer.edgeIndices32Bits, trianglesDataTextureBuffer.lenEdgeIndices32Bits);
        }
    }

    // build() {
    //     this.indices = {
    //         8: this.indices_8Bits,
    //         16: this.indices_16Bits,
    //         32: this.indices_32Bits,
    //     };
    //     this.eachPrimitiveMesh = {
    //         8: this.eachPrimitiveMesh_8Bits,
    //         16: this.eachPrimitiveMesh_16Bits,
    //         32: this.eachPrimitiveMesh_32Bits,
    //     };
    //     this.edgeIndices = {
    //         8: this.edgeIndices_8Bits,
    //         16: this.edgeIndices_16Bits,
    //         32: this.edgeIndices_32Bits,
    //     };
    //     this.eachEdgeMesh = {
    //         8: this.eachEdgeMesh_8Bits,
    //         16: this.eachEdgeMesh_16Bits,
    //         32: this.eachEdgeMesh_32Bits,
    //     };
    //
    //
    // }

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
            throw "num portions === 0";
        }
        const lenArray = portionIdsArray.length;
        const textureWidth = 4096;
        const textureHeight = Math.ceil(lenArray / textureWidth);
        if (textureHeight === 0) {
            throw "texture height===0";
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
        this.perSubMeshAttributesDataTexture.destroy();
        this.perSubMeshInstancingMatricesDataTexture.destroy();
        this.perSubMeshDecodeMatricesDataTexture.destroy();
        this.positionsCompressedDataTexture.destroy();
        this.perTriangleSubMesh8BitsDataTexture.destroy();
        this.perTriangleSubMesh16BitsDataTexture.destroy();
        this.perTriangleSubMesh32BitsDataTexture.destroy();
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
