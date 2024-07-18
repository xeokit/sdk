import {WebGLDataTexture} from "@xeokit/webglutils";
import {DTXBuffer} from "./DTXBuffer";
import {FloatArrayParam, IntArrayParam} from "@xeokit/math";

/**
 * @private
 */
export class DTXTextureSet {

    numPortions: number;

    readonly gl: WebGL2RenderingContext;

    // Prim -> SubMesh Lookup

    readonly primitiveToSubMeshLookup8BitsDataTexture: WebGLDataTexture;
    readonly primitiveToSubMeshLookup16BitsDataTexture: WebGLDataTexture;
    readonly primitiveToSubMeshLookup32BitsDataTexture: WebGLDataTexture;

    // Edge -> SubMesh Lookup

    readonly edgeToSubMeshLookup8BitsDataTexture: WebGLDataTexture;
    readonly edgeToSubMeshLookup16BitsDataTexture: WebGLDataTexture;
    readonly edgeToSubMeshLookup32BitsDataTexture: WebGLDataTexture;

    // SubMesh -> Attributes, Matrices, Decode Matrices Lookup

    readonly subMeshAttributesDataTexture: WebGLDataTexture;
    readonly subMeshInstanceMatricesDataTexture: WebGLDataTexture;
    readonly subMeshDecompressMatricesDataTexture: WebGLDataTexture;

    // Indices

    readonly indices8BitsDataTexture: WebGLDataTexture;
    readonly indices16BitsDataTexture: WebGLDataTexture;
    readonly indices32BitsDataTexture: WebGLDataTexture;

    readonly edgeIndices8BitsDataTexture: WebGLDataTexture;
    readonly edgeIndices16BitsDataTexture: WebGLDataTexture;
    readonly edgeIndices32BitsDataTexture: WebGLDataTexture;

    // Vertex positions

    readonly positionsCompressedDataTexture: WebGLDataTexture;

    // Bitness selectors

    readonly indices: { 16: WebGLDataTexture; 8: WebGLDataTexture; 32: WebGLDataTexture; };
    readonly eachPrimitiveMesh: { 16: WebGLDataTexture; 8: WebGLDataTexture; 32: WebGLDataTexture };
    readonly edgeIndices: { 16: WebGLDataTexture; 8: WebGLDataTexture; 32: WebGLDataTexture };
    readonly eachEdgeMesh: { 16: WebGLDataTexture; 8: WebGLDataTexture; 32: WebGLDataTexture };

    /**
     * @private
     */
    constructor(gl: WebGL2RenderingContext, dtxBuffer: DTXBuffer) {

        this.numPortions = 0;
        this.gl = gl;

        this.primitiveToSubMeshLookup8BitsDataTexture = this.#createPrimitiveToSubMeshLookupDataTexture(dtxBuffer.primitiveToSubMeshLookup8Bits);
        this.primitiveToSubMeshLookup16BitsDataTexture = this.#createPrimitiveToSubMeshLookupDataTexture(dtxBuffer.primitiveToSubMeshLookup16Bits);
        this.primitiveToSubMeshLookup32BitsDataTexture = this.#createPrimitiveToSubMeshLookupDataTexture(dtxBuffer.primitiveToSubMeshLookup32Bits);

        this.subMeshAttributesDataTexture = this.#createSubMeshToAttributesLookupDataTexture( // Flags (except for solid) are inserted later
            dtxBuffer.subMeshColors,
            dtxBuffer.subMeshPickColors,
            dtxBuffer.subMeshVertexBases,
            dtxBuffer.subMeshIndicesBases,
            dtxBuffer.subMeshEdgeIndicesBases,
            dtxBuffer.subMeshSolidFlags);

        this.subMeshInstanceMatricesDataTexture = this.#createSubMeshToInstancingMatricesLookupDataTexture(dtxBuffer.subMeshInstanceMatrices);
        this.subMeshDecompressMatricesDataTexture = this.#createSubMeshToDecompressMatricesLookupDataTexture(dtxBuffer.subMeshDecompressMatrices);

        this.positionsCompressedDataTexture = this.#createTextureForPositions(dtxBuffer.positionsCompressed, dtxBuffer.lenPositionsCompressed);

        if (dtxBuffer.edgeToSubMeshLookup8Bits.length > 0) {
            this.edgeToSubMeshLookup8BitsDataTexture = this.#createPrimitiveToSubMeshLookupDataTexture(dtxBuffer.edgeToSubMeshLookup8Bits);
        }
        if (dtxBuffer.edgeToSubMeshLookup16Bits.length > 0) {
            this.edgeToSubMeshLookup16BitsDataTexture = this.#createPrimitiveToSubMeshLookupDataTexture(dtxBuffer.edgeToSubMeshLookup16Bits);
        }
        if (dtxBuffer.edgeToSubMeshLookup32Bits.length > 0) {
            this.edgeToSubMeshLookup32BitsDataTexture = this.#createPrimitiveToSubMeshLookupDataTexture(dtxBuffer.edgeToSubMeshLookup32Bits);
        }

        if (dtxBuffer.lenIndices8Bits > 0) {
            this.indices8BitsDataTexture = this.#createIndices8BitDataTexture(dtxBuffer.indices8Bits, dtxBuffer.lenIndices8Bits);
        }
        if (dtxBuffer.lenIndices16Bits > 0) {
            this.indices16BitsDataTexture = this.#createIndices16BitDataTexture(dtxBuffer.indices16Bits, dtxBuffer.lenIndices16Bits);
        }
        if (dtxBuffer.lenIndices32Bits > 0) {
            this.indices32BitsDataTexture = this.#createIndices32BitDataTexture(dtxBuffer.indices32Bits, dtxBuffer.lenIndices32Bits);
        }
        if (dtxBuffer.lenEdgeIndices8Bits > 0) {
            this.edgeIndices8BitsDataTexture = this.#createEdgeIndices8BitDataTexture(dtxBuffer.edgeIndices8Bits, dtxBuffer.lenEdgeIndices8Bits);
        }
        if (dtxBuffer.lenEdgeIndices16Bits > 0) {
            this.edgeIndices16BitsDataTexture = this.#createEdgeIndices16BitDataTexture(dtxBuffer.edgeIndices16Bits, dtxBuffer.lenEdgeIndices16Bits);
        }
        if (dtxBuffer.lenEdgeIndices32Bits > 0) {
            this.edgeIndices32BitsDataTexture = this.#createEdgeIndices32BitDataTexture(dtxBuffer.edgeIndices32Bits, dtxBuffer.lenEdgeIndices32Bits);
        }

        this.indices = {
            8: this.indices8BitsDataTexture,
            16: this.indices16BitsDataTexture,
            32: this.indices32BitsDataTexture,
        };
        this.eachPrimitiveMesh = {
            8: this.primitiveToSubMeshLookup8BitsDataTexture,
            16: this.primitiveToSubMeshLookup8BitsDataTexture,
            32: this.primitiveToSubMeshLookup8BitsDataTexture,
        };
        this.edgeIndices = {
            8: this.edgeIndices8BitsDataTexture,
            16: this.edgeIndices16BitsDataTexture,
            32: this.edgeIndices32BitsDataTexture,
        };
        this.eachEdgeMesh = {
            8: this.edgeToSubMeshLookup8BitsDataTexture,
            16: this.edgeToSubMeshLookup16BitsDataTexture,
            32: this.edgeToSubMeshLookup32BitsDataTexture,
        };
    }

    #createSubMeshToAttributesLookupDataTexture(
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

    #createSubMeshToInstancingMatricesLookupDataTexture(instanceMatrices: FloatArrayParam[]): WebGLDataTexture {
        const numMatrices = instanceMatrices.length;
        if (numMatrices === 0) {
            throw "num instance matrices===0";
        }
        // in one row we can fit 512 matrices
        const textureWidth = 512 * 4;
        const textureHeight = Math.ceil(numMatrices / (textureWidth / 4));
        const textureData = new Float32Array(4 * textureWidth * textureHeight);
        // dataTextureRamStats.sizeDataPositionDecompressMatrices += textureData.byteLength;
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

    #createSubMeshToDecompressMatricesLookupDataTexture(positionDecompressMatrices: FloatArrayParam[]): WebGLDataTexture {
        const numMatrices = positionDecompressMatrices.length;
        if (numMatrices === 0) {
            throw "num decode+entity matrices===0";
        }
        // in one row we can fit 512 matrices
        const textureWidth = 512 * 4;
        const textureHeight = Math.ceil(numMatrices / (textureWidth / 4));
        const textureData = new Float32Array(4 * textureWidth * textureHeight);
        for (let i = 0; i < positionDecompressMatrices.length; i++) {            // 4x4 values
            textureData.set(positionDecompressMatrices[i], i * 16);
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

    #createPrimitiveToSubMeshLookupDataTexture(portionIdsArray: IntArrayParam): WebGLDataTexture {
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
        if (this.subMeshAttributesDataTexture) {
            this.subMeshAttributesDataTexture.destroy();
        }
        if (this.subMeshInstanceMatricesDataTexture) {
            this.subMeshInstanceMatricesDataTexture.destroy();
        }
        if (this.subMeshDecompressMatricesDataTexture) {
            this.subMeshDecompressMatricesDataTexture.destroy();
        }
        if (this.positionsCompressedDataTexture) {
            this.positionsCompressedDataTexture.destroy();
        }
        if (this.primitiveToSubMeshLookup8BitsDataTexture) {
            this.primitiveToSubMeshLookup8BitsDataTexture.destroy();
        }
        if (this.primitiveToSubMeshLookup16BitsDataTexture) {
            this.primitiveToSubMeshLookup16BitsDataTexture.destroy();
        }
        if (this.primitiveToSubMeshLookup32BitsDataTexture) {
            this.primitiveToSubMeshLookup32BitsDataTexture.destroy();
        }
        if (this.edgeToSubMeshLookup8BitsDataTexture) {
            this.edgeToSubMeshLookup8BitsDataTexture.destroy();
        }
        if (this.edgeToSubMeshLookup16BitsDataTexture) {
            this.edgeToSubMeshLookup16BitsDataTexture.destroy();
        }
        if (this.edgeToSubMeshLookup32BitsDataTexture) {
            this.edgeToSubMeshLookup32BitsDataTexture.destroy();
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
