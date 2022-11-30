import {Camera, math, SceneModel} from "../../viewer/index";
import {DataTexture} from "../lib/DataTexture";
// @ts-ignore
import {Float16Array} from "./float16.js";

const emptyDataTexture = new DataTexture({textureWidth: 0, textureHeight: 0});

/**
 * Creates DataTextures to hold various types of viewer state.
 */
export class DataTextureFactory {

    /**
     * Enables the currently bound ````WebGLTexture```` to be used as a data texture.
     */
    disableFilteringForBoundTexture(gl: WebGL2RenderingContext) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    /**
     * Create a DataTexture containing the given Camera's viewMatrix, viewNormalMatrix and projectMatrix
     */
    createCameraMatricesDataTexture(gl: WebGL2RenderingContext, camera: Camera, origin: math.FloatArrayParam): DataTexture {
        const textureWidth = 4;
        const textureHeight = 3; // space for 3 matrices
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, textureWidth, textureHeight);
        this.disableFilteringForBoundTexture(gl);
        gl.bindTexture(gl.TEXTURE_2D, null);
        const cameraMatrices = new DataTexture({gl, texture, textureWidth, textureHeight});
        let cameraDirty = true;
        const onCameraMatrix = () => {
            if (!cameraDirty) {
                return;
            }
            cameraDirty = false;
            gl.bindTexture(gl.TEXTURE_2D, cameraMatrices.texture);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0,  /* 1st matrix: camera view matrix */ 4, 1, gl.RGBA, gl.FLOAT, new Float32Array((origin) ? math.rtc.createRTCViewMat(camera.viewMatrix, origin) : camera.viewMatrix));
         //   gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 1, /* 2nd matrix: camera view normal matrix */4, 1, gl.RGBA, gl.FLOAT, new Float32Array(camera.viewNormalMatrix));
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 2, /* 3rd matrix: camera project matrix */4, 1, gl.RGBA, gl.FLOAT, new Float32Array(camera.project.matrix));
        };
        camera.events.on("matrix", () => cameraDirty = true);
        camera.view.events.on("rendering", onCameraMatrix);
        onCameraMatrix();
        return cameraMatrices;
    }

    /**
     * Creates a DataTexture containing the given SceneModel's worldMatrix and worldNormalMatrix
     */
    createSceneModelMatricesDataTexture(gl: WebGL2RenderingContext, sceneModel: SceneModel): DataTexture {
        const textureWidth = 4;
        const textureHeight = 2; // space for 2 matrices
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0,
            0, // x-offset
            0, // y-offset (sceneModel world matrix)
            4, // data width (4x4 values)
            1, // data height (1 matrix)
            gl.RGBA,
            gl.FLOAT,
            new Float32Array(sceneModel.worldMatrix)
        );
        // gl.texSubImage2D(
        //     gl.TEXTURE_2D,
        //     0,
        //     0, // x-offset
        //     1, // y-offset (sceneModel normal matrix)
        //     4, // data width (4x4 values)
        //     1, // data height (1 matrix)
        //     gl.RGBA,
        //     gl.FLOAT,
        //     new Float32Array(sceneModel.worldNormalMatrix)
      //  );
        this.disableFilteringForBoundTexture(gl);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture({gl, texture, textureWidth, textureHeight});
    }

    /**
     * Creates a DataTexture containing the given vertex positions.
     */
    createPositionsDataTexture(gl: WebGL2RenderingContext, positions: math.FloatArrayParam): DataTexture {
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
        return new DataTexture({gl, texture, textureWidth, textureHeight});
    }

    /**
     * Creates a DataTexture containing the given 8-bit indices.
     */
    createIndices8BitDataTexture(gl: WebGL2RenderingContext, indices_8Bits: math.IntArrayParam): DataTexture {
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
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB8UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB_INTEGER, gl.UNSIGNED_BYTE, textureData, 0);
        this.disableFilteringForBoundTexture(gl);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture({gl, texture, textureWidth, textureHeight});
    }

    /**
     * Creates a DataTexture containing the given 16-bit indices.
     */
    createIndices16BitDataTexture(gl: WebGL2RenderingContext, indices_16Bits: math.IntArrayParam): DataTexture {
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
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB16UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB_INTEGER, gl.UNSIGNED_SHORT, textureData, 0);
        this.disableFilteringForBoundTexture(gl);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture({gl, texture, textureWidth, textureHeight});
    }

    /**
     * Creates a DataTexture containing the given 32-bit indices.
     */
    createIndices32BitDataTexture(gl: WebGL2RenderingContext, indices_32Bits: math.IntArrayParam): DataTexture {
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
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB32UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB_INTEGER, gl.UNSIGNED_INT, textureData, 0);
        this.disableFilteringForBoundTexture(gl);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture({gl, texture, textureWidth, textureHeight});
    }

    /**
     * Creates a DataTexture containing the given 8-bit edge indices.
     */
    createEdgeIndices8BitDataTexture(gl: WebGL2RenderingContext, edgeIndices_8Bits: math.IntArrayParam): DataTexture {
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
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG8UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RG_INTEGER, gl.UNSIGNED_BYTE, textureData, 0);
        this.disableFilteringForBoundTexture(gl);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture({gl, texture, textureWidth, textureHeight});
    }

    /**
     * Creates a DataTexture containing the given 16-bit edge indices.
     */
    createEdgeIndices16BitDataTexture(gl: WebGL2RenderingContext, edgeIndices_16Bits: math.IntArrayParam): DataTexture {
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
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG16UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RG_INTEGER, gl.UNSIGNED_SHORT, textureData, 0);
        this.disableFilteringForBoundTexture(gl);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture({gl, texture, textureWidth, textureHeight});
    }

    /**
     * Creates a DataTexture containing the given 32-bit edge indices.
     */
    createEdgeIndices32BitDataTexture(gl: WebGL2RenderingContext, edgeIndices_32Bits: math.IntArrayParam): DataTexture {
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
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG32UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RG_INTEGER, gl.UNSIGNED_INT, textureData, 0);
        this.disableFilteringForBoundTexture(gl);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture({gl, texture, textureWidth, textureHeight});
    }

    /**
     * Creates a DataTexture containing per-mesh colors, pick colors, flags, vertex portion bases, indices portion bases, edge indices portion bases
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
    createEachMeshAttributesDataTexture(gl: WebGL2RenderingContext, colors: math.FloatArrayParam[], pickColors: math.FloatArrayParam[], vertexBases: math.IntArrayParam, indexBaseOffsets: math.IntArrayParam, edgeIndexBaseOffsets: math.IntArrayParam): DataTexture {
        
        // Texture has one row per mesh:
        //
        //    - col0: (RGBA) mesh color RGBA
        //    - col1: (packed Uint32 as RGBA) mesh pick color
        //    - col2: (packed 4 bytes as RGBA) mesh flags
        //    - col3: (packed 4 bytes as RGBA) mesh flags2
        //    - col4: (packed Uint32 bytes as RGBA) vertex base
        //    - col5: (packed Uint32 bytes as RGBA) index base offset
        //    - col6: (packed Uint32 bytes as RGBA) edge index base offset

        const textureHeight = colors.length;
        if (textureHeight == 0) {
            throw "texture height == 0";
        }
        const textureWidth = 7;
        const textureData = new Uint8Array(4 * textureWidth * textureHeight);
        for (let i = 0; i < textureHeight; i++) {
            textureData.set(colors [i], i * 28 + 0); // mesh color
            textureData.set(pickColors [i], i * 28 + 4); // mesh pick color
            textureData.set([0, 0, 0, 0], i * 28 + 8);  // mesh flags
            textureData.set([0, 0, 0, 0], i * 28 + 12); // mesh flags2
            textureData.set([(vertexBases[i] >> 24) & 255, (vertexBases[i] >> 16) & 255, (vertexBases[i] >> 8) & 255, (vertexBases[i]) & 255,], i * 28 + 16);   // vertex base
            textureData.set([(indexBaseOffsets[i] >> 24) & 255, (indexBaseOffsets[i] >> 16) & 255, (indexBaseOffsets[i] >> 8) & 255, (indexBaseOffsets[i]) & 255,], i * 28 + 20);    // triangles index base offset
            textureData.set([(edgeIndexBaseOffsets[i] >> 24) & 255, (edgeIndexBaseOffsets[i] >> 16) & 255, (edgeIndexBaseOffsets[i] >> 8) & 255, (edgeIndexBaseOffsets[i]) & 255,], i * 28 + 24);    // edge index base offset
        }
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture({gl, texture, textureWidth, textureHeight, textureData});
    }

    /**
     * Creates DataTexture containing a 3D offset for each mesh
     *
     * @param gl
     * @param offsets An offset for each mesh
     */
    createEachEdgeOffsetDataTexture(gl: WebGL2RenderingContext, offsets: math.FloatArrayParam[]) {
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
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB32F, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB, gl.FLOAT, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture({gl, texture, textureWidth, textureHeight, textureData});
    }

    /**
     * Creates a DataTexture that holds per-mesh matrices for positions decode, position modeling, and normals modeling.
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
    createEachMeshMatricesDataTexture(gl: WebGL2RenderingContext, positionDecodeMatrices: math.FloatArrayParam, matrices: math.FloatArrayParam): DataTexture {

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
        const textureData = new Float16Array(4 * textureWidth * textureHeight);
        for (let i = 0; i < positionDecodeMatrices.length; i++) {
            textureData.set(positionDecodeMatrices [i], i * 48);   // 4x4 values
            textureData.set(matrices [i], i * 48 + 16);   // 4x4 values
        }
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGBA, gl.HALF_FLOAT, new Uint16Array(textureData.buffer), 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture({gl, texture, textureWidth, textureHeight});
    }

    /**
     * Creates a DataTexture containing the given mesh IDs.
     * This type of texture is used for a lookup table, of mesh IDs for given keys.
     *
     * @param gl
     * @param meshIds
     */
    createPointerTableDataTexture(gl: WebGL2RenderingContext, meshIds: math.IntArrayParam): DataTexture {
        if (meshIds.length == 0) {
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
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R16UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RED_INTEGER, gl.UNSIGNED_SHORT, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture({gl, texture, textureWidth, textureHeight});
    }
}