import {FloatArrayParam, IntArrayParam} from "@xeokit/math/math";
import {GLDataTexture} from "@xeokit/webglutils";
import {Float16Array} from "./float16";

const emptyDataTexture = new GLDataTexture({textureWidth: 0, textureHeight: 0});

/**
 * Enables the currently bound ````WebGLTexture```` to be used as a data texture.
 */
export function disableFilteringForBoundTexture(gl: WebGL2RenderingContext) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

/**
 * Creates a GLDataTexture containing the given vertex positions.
 */
export function createPositionsDataTexture(gl: WebGL2RenderingContext, positions: FloatArrayParam): GLDataTexture {
    const numVertices = positions.length / 3;
    const textureWidth = 1024;
    const textureHeight = Math.ceil(numVertices / textureWidth);
    if (textureHeight == 0) {
        throw "texture height == 0";
    }
    const textureDataSize = textureWidth * textureHeight * 3;
    const textureData = new Uint16Array(textureDataSize);
    //   dataTextureRamStats.sizeDataTexturePositions += textureData.byteLength;
    textureData.fill(0);
    // @ts-ignore
    textureData.set(positions, 0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB16UI, textureWidth, textureHeight);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB_INTEGER, gl.UNSIGNED_SHORT, textureData, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    // @ts-ignore
    return new GLDataTexture({gl, texture, textureWidth, textureHeight});
}

/**
 * Creates a GLDataTexture containing the given 8-bit indices.
 */
export function createIndices8BitDataTexture(gl: WebGL2RenderingContext, indices_8Bits: IntArrayParam): GLDataTexture {
    if (indices_8Bits.length == 0) {
        return emptyDataTexture;
    }
    const textureWidth = 1024;
    const textureHeight = Math.ceil(indices_8Bits.length / 3 / textureWidth);
    if (textureHeight == 0) {
        throw "texture height == 0";
    }
    const textureDataSize = textureWidth * textureHeight * 3;
    const textureData = new Uint8Array(textureDataSize);
    //dataTextureRamStats.sizeDataTextureIndices += textureData.byteLength;
    textureData.fill(0);
    textureData.set(indices_8Bits, 0)
    const texture = gl.createTexture();
    if (!texture) {
        return emptyDataTexture;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB8UI, textureWidth, textureHeight);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB_INTEGER, gl.UNSIGNED_BYTE, textureData, 0);
    disableFilteringForBoundTexture(gl);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return new GLDataTexture({gl, texture, textureWidth, textureHeight});
}

/**
 * Creates a GLDataTexture containing the given 16-bit indices.
 */
export function createIndices16BitDataTexture(gl: WebGL2RenderingContext, indices_16Bits: IntArrayParam): GLDataTexture {
    if (indices_16Bits.length == 0) {
        return emptyDataTexture;
    }
    const textureWidth = 1024;
    const textureHeight = Math.ceil(indices_16Bits.length / 3 / textureWidth);
    if (textureHeight == 0) {
        throw "texture height == 0";
    }
    const textureDataSize = textureWidth * textureHeight * 3;
    const textureData = new Uint16Array(textureDataSize);
    // dataTextureRamStats.sizeDataTextureIndices += textureData.byteLength;
    textureData.fill(0);
    // @ts-ignore
    textureData.set(indices_16Bits, 0)
    const texture = gl.createTexture();
    if (!texture) {
        return emptyDataTexture;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB16UI, textureWidth, textureHeight);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB_INTEGER, gl.UNSIGNED_SHORT, textureData, 0);
    disableFilteringForBoundTexture(gl);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return new GLDataTexture({gl, texture, textureWidth, textureHeight});
}

/**
 * Creates a GLDataTexture containing the given 32-bit indices.
 */
export function createIndices32BitDataTexture(gl: WebGL2RenderingContext, indices_32Bits: IntArrayParam): GLDataTexture {
    if (indices_32Bits.length == 0) {
        return emptyDataTexture;
    }
    const textureWidth = 1024;
    const textureHeight = Math.ceil(indices_32Bits.length / 3 / textureWidth);
    if (textureHeight == 0) {
        throw "texture height == 0";
    }
    const textureDataSize = textureWidth * textureHeight * 3;
    const textureData = new Uint32Array(textureDataSize);
    // dataTextureRamStats.sizeDataTextureIndices += textureData.byteLength;
    textureData.fill(0);
    // @ts-ignore
    textureData.set(indices_32Bits, 0)
    const texture = gl.createTexture();
    if (!texture) {
        return emptyDataTexture;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB32UI, textureWidth, textureHeight);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB_INTEGER, gl.UNSIGNED_INT, textureData, 0);
    disableFilteringForBoundTexture(gl);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return new GLDataTexture({gl, texture, textureWidth, textureHeight});
}

/**
 * Creates a GLDataTexture containing the given 8-bit edge indices.
 */
export function createEdgeIndices8BitDataTexture(gl: WebGL2RenderingContext, edgeIndices_8Bits: IntArrayParam): GLDataTexture {
    if (edgeIndices_8Bits.length == 0) {
        return emptyDataTexture;
    }
    const textureWidth = 1024;
    const textureHeight = Math.ceil(edgeIndices_8Bits.length / 2 / textureWidth);
    if (textureHeight == 0) {
        throw "texture height == 0";
    }
    const textureDataSize = textureWidth * textureHeight * 2;
    const textureData = new Uint8Array(textureDataSize);
    // dataTextureRamStats.sizeDataTextureEdgeIndices += textureData.byteLength;
    textureData.fill(0);
    // @ts-ignore
    textureData.set(edgeIndices_8Bits, 0)
    const texture = gl.createTexture();
    if (!texture) {
        return emptyDataTexture;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG8UI, textureWidth, textureHeight);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RG_INTEGER, gl.UNSIGNED_BYTE, textureData, 0);
    disableFilteringForBoundTexture(gl);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return new GLDataTexture({gl, texture, textureWidth, textureHeight});
}

/**
 * Creates a GLDataTexture containing the given 16-bit edge indices.
 */
export function createEdgeIndices16BitDataTexture(gl: WebGL2RenderingContext, edgeIndices_16Bits: IntArrayParam): GLDataTexture {
    if (edgeIndices_16Bits.length == 0) {
        return emptyDataTexture;
    }
    const textureWidth = 1024;
    const textureHeight = Math.ceil(edgeIndices_16Bits.length / 2 / textureWidth);
    if (textureHeight == 0) {
        throw "texture height == 0";
    }
    const textureDataSize = textureWidth * textureHeight * 2;
    const textureData = new Uint16Array(textureDataSize);
    //     dataTextureRamStats.sizeDataTextureEdgeIndices += textureData.byteLength;
    textureData.fill(0);
    // @ts-ignore
    textureData.set(edgeIndices_16Bits, 0)
    const texture = gl.createTexture();
    if (!texture) {
        return emptyDataTexture;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG16UI, textureWidth, textureHeight);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RG_INTEGER, gl.UNSIGNED_SHORT, textureData, 0);
    disableFilteringForBoundTexture(gl);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return new GLDataTexture({gl, texture, textureWidth, textureHeight});
}

/**
 * Creates a GLDataTexture containing the given 32-bit edge indices.
 */
export function createEdgeIndices32BitDataTexture(gl: WebGL2RenderingContext, edgeIndices_32Bits: IntArrayParam): GLDataTexture {
    if (edgeIndices_32Bits.length == 0) {
        return emptyDataTexture;
    }
    const textureWidth = 1024;
    const textureHeight = Math.ceil(edgeIndices_32Bits.length / 2 / textureWidth);
    if (textureHeight == 0) {
        throw "texture height == 0";
    }
    const textureDataSize = textureWidth * textureHeight * 2;
    const textureData = new Uint32Array(textureDataSize);
    //   dataTextureRamStats.sizeDataTextureEdgeIndices += textureData.byteLength;
    textureData.fill(0);
    // @ts-ignore
    textureData.set(edgeIndices_32Bits, 0)
    const texture = gl.createTexture();
    if (!texture) {
        return emptyDataTexture;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG32UI, textureWidth, textureHeight);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RG_INTEGER, gl.UNSIGNED_INT, textureData, 0);
    disableFilteringForBoundTexture(gl);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return new GLDataTexture({gl, texture, textureWidth, textureHeight});
}

/**
 * Creates a GLDataTexture containing per-mesh colors, pick colors, flags, vertex portion bases, indices portion bases, edge indices portion bases
 *
 * The texture will have:
 * - 4 RGBA columns per row: for each mesh (pick) color and flags(2)
 * - N rows where N is the number of meshes
 *
 * @param gl
 * @param colors Color per mesh
 * @param pickColors Pick color per mesh
 * @param vertexBases Vertex index base for each mesh
 * @param indexBaseOffsets For triangles: array of offsets between the (gl_VertexID / 3) and the position where the indices start in the texture layer
 * @param edgeIndexBaseOffsets For edges: Array of offsets between the (gl_VertexID / 2) and the position where the edge indices start in the texture layer
 */
export function createEachMeshAttributesDataTexture(gl: WebGL2RenderingContext, colors: FloatArrayParam[], pickColors: FloatArrayParam[], vertexBases: IntArrayParam, indexBaseOffsets: IntArrayParam, edgeIndexBaseOffsets: IntArrayParam): GLDataTexture {

    // Texture has one row per mesh:
    //
    //    - col0: (RGBA) mesh color RGBA
    //    - col1: (packed Uint32 as RGBA) mesh pick color
    //    - col2: (packed 4 bytes as RGBA) mesh flags
    //    - col3: (packed 4 bytes as RGBA) mesh flags2
    //    - col4: (packed Uint32 bytes as RGBA) vertex base
    //    - col5: (packed Uint32 bytes as RGBA) index base offset
    //    - col6: (packed Uint32 bytes as RGBA) edge index base offset
    //    - col7: (packed Uint32 bytes as RGBA) RTC view matrix index base offset

    const textureHeight = colors.length;
    if (textureHeight == 0) {
        throw "texture height == 0";
    }
    const textureWidth = 8;
    const textureData = new Uint8Array(4 * textureWidth * textureHeight);
    for (let i = 0; i < textureHeight; i++) {
        textureData.set(colors [i], i * 28 + 0); // mesh color
        textureData.set(pickColors [i], i * 28 + 4); // mesh pick color
        textureData.set([0, 0, 0, 0], i * 28 + 8);  // mesh flags
        textureData.set([0, 0, 0, 0], i * 28 + 12); // mesh flags2
        textureData.set([(vertexBases[i] >> 24) & 255, (vertexBases[i] >> 16) & 255, (vertexBases[i] >> 8) & 255, (vertexBases[i]) & 255], i * 28 + 16);   // vertex base
        textureData.set([(indexBaseOffsets[i] >> 24) & 255, (indexBaseOffsets[i] >> 16) & 255, (indexBaseOffsets[i] >> 8) & 255, (indexBaseOffsets[i]) & 255], i * 28 + 20);    // triangles index base offset
        textureData.set([(edgeIndexBaseOffsets[i] >> 24) & 255, (edgeIndexBaseOffsets[i] >> 16) & 255, (edgeIndexBaseOffsets[i] >> 8) & 255, (edgeIndexBaseOffsets[i]) & 255], i * 28 + 24);    // edge index base offset
    //    textureData.set([(rtcViewMatIndices[i] >> 24) & 255, (rtcViewMatIndices[i] >> 16) & 255, (rtcViewMatIndices[i] >> 8) & 255, (rtcViewMatIndices[i]) & 255], i * 28 + 28);    // RTC view matrix
    }
    const texture = gl.createTexture();
    if (!texture) {
        return emptyDataTexture;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, textureWidth, textureHeight);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, textureData, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return new GLDataTexture({gl, texture, textureWidth, textureHeight, textureData}); // Re-writeable texture data
}

/**
 * Creates GLDataTexture containing a 3D offset for each mesh
 *
 * @param gl
 * @param offsets An offset for each mesh
 */
export function createEachEdgeOffsetDataTexture(gl: WebGL2RenderingContext, offsets: FloatArrayParam[]) :GLDataTexture{
    const textureHeight = offsets.length;
    if (textureHeight == 0) {
        throw "texture height == 0";
    }
    const textureWidth = 1;
    const textureData = new Float32Array(3 * textureWidth * textureHeight);
    for (let i = 0; i < offsets.length; i++) {
        textureData.set(offsets [i], i * 3); // mesh offset
    }
    const texture = gl.createTexture();
    if (!texture) {
        return emptyDataTexture;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB32F, textureWidth, textureHeight);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB, gl.FLOAT, textureData, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return new GLDataTexture({gl, texture, textureWidth, textureHeight, textureData}); // Re-writeable texture data
}

/**
 * Creates a GLDataTexture that holds per-mesh matrices for positions decode, position modeling, and normals modeling.
 *
 * The texture will have:
 * - 4 RGBA columns per row (each column will contain 4 packed half-float (16 bits) components).
 *   Thus, each row will contain 16 packed half-floats corresponding to a complete positions decode matrix)
 * - N rows where N is the number of meshes
 *
 * @param gl
 * @param positionDecodeMatrices Positions decode matrix for each mesh in the layer
 * @param matrices Positions instancing matrix for each mesh in the layer. Null if the meshes are not instanced.
 */
export function createEachMeshMatricesDataTexture(gl: WebGL2RenderingContext, positionDecodeMatrices: FloatArrayParam, matrices: FloatArrayParam): GLDataTexture {

    // Texture has one row per mesh:
    //
    //    - col0: Positions decode matrix
    //    - col1: Positions modeling matrix
    //    - col2: Normals modeling matrix

    const textureHeight = positionDecodeMatrices.length;
    if (textureHeight == 0) {
        throw "texture height == 0";
    }
    const textureWidth = 4 * 3;
    // @ts-ignore
    const textureData = new Float16Array(4 * textureWidth * textureHeight);
    for (let i = 0; i < positionDecodeMatrices.length; i++) {
        textureData.set(positionDecodeMatrices [i], i * 48);   // 4x4 values
        textureData.set(matrices [i], i * 48 + 16);   // 4x4 values
    }
    const texture = gl.createTexture();
    if (!texture) {
        return emptyDataTexture;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, textureWidth, textureHeight);
    // @ts-ignore
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGBA, gl.HALF_FLOAT, new Uint16Array(textureData.buffer), 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return new GLDataTexture({gl, texture, textureWidth, textureHeight});
}

/**
 * Creates a GLDataTexture containing the given mesh IDs.
 * This type of texture is used for a lookup table, of mesh IDs for given keys.
 *
 * @param gl
 * @param meshIds
 */
export function createPointerTableDataTexture(gl: WebGL2RenderingContext, meshIds: IntArrayParam): GLDataTexture {
    if (meshIds.length == 0) {
        return emptyDataTexture;
    }
    const texture = gl.createTexture();
    if (!texture) {
        return emptyDataTexture;
    }
    const lenArray = meshIds.length;
    const textureWidth = 1024;
    const textureHeight = Math.ceil(lenArray / textureWidth);
    if (textureHeight == 0) {
        throw "texture height == 0";
    }
    const textureDataSize = textureWidth * textureHeight;
    const textureData = new Uint16Array(textureDataSize);
    textureData.set(meshIds, 0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R16UI, textureWidth, textureHeight);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RED_INTEGER, gl.UNSIGNED_SHORT, textureData, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return new GLDataTexture({gl, texture, textureWidth, textureHeight});
}

/**
 * Creates a GLDataTexture that holds matrices.
 *
 * The texture will have:
 * - 4 RGBA columns per row (each column will contain 4 packed half-float (16 bits) components).
 *   Thus, each row will contain 16 packed half-floats corresponding to a complete positions decode matrix)
 * - N rows where N is the number of matrices
 *
 * @param gl
 * @param numMatrices
 */
export function createMatricesDataTexture(gl: WebGL2RenderingContext, numMatrices: number): GLDataTexture {
    const textureHeight = numMatrices;
    if (textureHeight == 0) {
        throw "texture height == 0";
    }
    const textureWidth = 4 * 3;
    // @ts-ignore
    const textureData = new Float16Array(4 * textureWidth * textureHeight);
    const texture = gl.createTexture();
    if (!texture) {
        return emptyDataTexture;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, textureWidth, textureHeight);
    // @ts-ignore
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGBA, gl.HALF_FLOAT, new Uint16Array(textureData.buffer), 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return new GLDataTexture({gl, texture, textureWidth, textureHeight});
}
