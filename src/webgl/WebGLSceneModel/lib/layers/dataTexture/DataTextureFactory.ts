import {Scene} from "../../../../../viewer/scene/Scene";
import {Camera} from "../../../../../viewer/view/camera/Camera";
import {SceneModel} from "../../../../../viewer/scene/SceneModel";
import {DataTexture} from "./DataTexture";
import * as math from "../../../../../viewer/math";
// @ts-ignore
import {Float16Array} from "./float16.js";

const emptyDataTexture = new DataTexture(null, null, 0, 0);

export class DataTextureFactory {

    /**
     * Enables the currently bound ````WebGLTexture```` to be used as a data texture.
     *
     * @param {WebGL2RenderingContext} gl
     */
    disableFilteringForBoundTexture(gl: WebGL2RenderingContext) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    /**
     * Generate and return a `camera data texture`.
     *
     * The texture will automatically update its contents before each render when the camera matrix is dirty,
     * and to do so will use the following events:
     *
     * - `scene.rendering` event will be used to know that the camera texture should be updated
     * - `camera.matrix` event will be used to know that the camera matices changed
     */
    createCameraDataTexture(gl: WebGL2RenderingContext, camera: Camera, scene: Scene, origin: any): DataTexture {
        const textureWidth = 4;
        const textureHeight = 3; // space for 3 matrices
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, textureWidth, textureHeight);
        this.disableFilteringForBoundTexture(gl);
        gl.bindTexture(gl.TEXTURE_2D, null);
        const cameraTexture = new DataTexture(gl, texture, textureWidth, textureHeight);
        let cameraDirty = true;
        const onCameraMatrix = () => {
            if (!cameraDirty) {
                return;
            }
            cameraDirty = false;
            gl.bindTexture(gl.TEXTURE_2D, cameraTexture.texture);
            // Camera's "view matrix"
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0,  /* 1st matrix: camera view matrix */ 4, 1, gl.RGBA, gl.FLOAT, new Float32Array((origin) ? math.rtc.createRTCViewMat(camera.viewMatrix, origin) : camera.viewMatrix));
            // Camera's "view normal matrix"
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 1, /* 2nd matrix: camera view normal matrix */4, 1, gl.RGBA, gl.FLOAT, new Float32Array(camera.viewNormalMatrix));
            // Camera's "project matrix"
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 2, /* 3rd matrix: camera project matrix */4, 1, gl.RGBA, gl.FLOAT, new Float32Array(camera.project.matrix));
        };
        camera.events.on("matrix", () => cameraDirty = true);
        scene.events.on("rendering", onCameraMatrix);
        onCameraMatrix();
        return cameraTexture;
    }

    /**
     * Generate and return a `sceneModel data texture`.
     */
    createSceneModelDataTexture(gl: WebGL2RenderingContext, sceneModel: SceneModel): DataTexture {
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
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0, // x-offset
            1, // y-offset (sceneModel normal matrix)
            4, // data width (4x4 values)
            1, // data height (1 matrix)
            gl.RGBA,
            gl.FLOAT,
            new Float32Array(sceneModel.worldNormalMatrix)
        );
        this.disableFilteringForBoundTexture(gl);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture(gl, texture, textureWidth, textureHeight);
    }

    /**
     * This will create an RGBA texture for:
     * - colors
     * - pickColors
     * - flags
     * - flags2
     * - vertex bases
     * - vertex base offsets
     *
     * The texture will have:
     * - 4 RGBA columns per row: for each object (pick) color and flags(2)
     * - N rows where N is the number of objects
     *
     * @param gl
     * @param colors Array of colors for all objects in the layer
     * @param pickColors Array of pickColors for all objects in the layer
     * @param vertexBases Array of position-index-bases foteh all objects in the layer
     * @param indexBaseOffsets For triangles: array of offsets between the (gl_VertexID / 3) and the position where the indices start in the texture layer
     * @param edgeIndexBaseOffsets For edges: Array of offsets between the (gl_VertexID / 2) and the position where the edge indices start in the texture layer
     */
    createTextureForColorsAndFlags(gl: WebGL2RenderingContext, colors: math.FloatArrayType[], pickColors: math.FloatArrayType[], vertexBases: any[], indexBaseOffsets: any[], edgeIndexBaseOffsets: any[]): DataTexture {
        // The number of rows in the texture is the number of objects in the layer
        const textureHeight = colors.length;
        if (textureHeight == 0) {
            throw "texture height == 0";
        }
        // 4 columns per texture row:
        // - col0: (RGBA) object color RGBA
        // - col1: (packed Uint32 as RGBA) object pick color
        // - col2: (packed 4 bytes as RGBA) object flags
        // - col3: (packed 4 bytes as RGBA) object flags2
        // - col4: (packed Uint32 bytes as RGBA) vertex base
        // - col5: (packed Uint32 bytes as RGBA) index base offset
        // - col6: (packed Uint32 bytes as RGBA) edge index base offset
        const textureWidth = 7;
        const texArray = new Uint8Array(4 * textureWidth * textureHeight);
        // dataTextureRamStats.sizeDataColorsAndFlags += texArray.byteLength;
        for (let i = 0; i < textureHeight; i++) {
            texArray.set(colors [i], i * 28 + 0); // object color
            texArray.set(pickColors [i], i * 28 + 4); // object pick color
            texArray.set([0, 0, 0, 0], i * 28 + 8);  // object flags
            texArray.set([0, 0, 0, 0], i * 28 + 12); // object flags2
            texArray.set([(vertexBases[i] >> 24) & 255, (vertexBases[i] >> 16) & 255, (vertexBases[i] >> 8) & 255, (vertexBases[i]) & 255,], i * 28 + 16);   // vertex base
            texArray.set([(indexBaseOffsets[i] >> 24) & 255, (indexBaseOffsets[i] >> 16) & 255, (indexBaseOffsets[i] >> 8) & 255, (indexBaseOffsets[i]) & 255,], i * 28 + 20);    // triangles index base offset
            texArray.set([(edgeIndexBaseOffsets[i] >> 24) & 255, (edgeIndexBaseOffsets[i] >> 16) & 255, (edgeIndexBaseOffsets[i] >> 8) & 255, (edgeIndexBaseOffsets[i]) & 255,], i * 28 + 24);    // edge index base offset
        }
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, texArray, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture(gl, texture, textureWidth, textureHeight, texArray);
    }

    createTextureForObjectOffsets(gl: WebGL2RenderingContext, offsets: string | any[]) {
        const textureHeight = offsets.length;
        if (textureHeight == 0) {
            throw "texture height == 0";
        }
        const textureWidth = 1;
        const texArray = new Float32Array(3 * textureWidth * textureHeight);
        // dataTextureRamStats.sizeDataTextureOffsets += texArray.byteLength;
        for (var i = 0; i < offsets.length; i++) {
            texArray.set(offsets [i], i * 3); // object offset
        }
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB32F, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB, gl.FLOAT, texArray, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture(gl, texture, textureWidth, textureHeight, texArray);
    }

    /**
     * This will create a texture for all positions decode matrices in the layer.
     *
     * The texture will have:
     * - 4 RGBA columns per row (each column will contain 4 packed half-float (16 bits) components).
     *   Thus, each row will contain 16 packed half-floats corresponding to a complete positions decode matrix)
     * - N rows where N is the number of objects
     *
     * @param gl
     * @param positionDecodeMatrices Array of positions decode matrices for all objects in the layer
     * @param instanceMatrices Array of geometry instancing matrices for all objects in the layer. Null if the objects are not instanced.
     * @param instancesNormalMatrices Array of normals instancing matrices for all objects in the layer. Null if the objects are not instanced.
     */
    createTextureForPositionsDecodeMatrices(gl: WebGL2RenderingContext, positionDecodeMatrices: string | any[], instanceMatrices: any[], instancesNormalMatrices: any[]): DataTexture {
        const textureHeight = positionDecodeMatrices.length;
        if (textureHeight == 0) {
            throw "texture height == 0";
        }
        // 3 matrices per row
        const textureWidth = 4 * 3;
        const texArray = new Float16Array(4 * textureWidth * textureHeight);
        //    dataTextureRamStats.sizeDataPositionDecodeMatrices += texArray.byteLength;
        for (let i = 0; i < positionDecodeMatrices.length; i++) {
            texArray.set(positionDecodeMatrices [i], i * 48);   // 4x4 values
            texArray.set(instanceMatrices [i], i * 48 + 16);   // 4x4 values
            texArray.set(instancesNormalMatrices [i], i * 48 + 32);   // 4x4 values
        }
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGBA, gl.HALF_FLOAT, new Uint16Array(texArray.buffer), 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture(gl, texture, textureWidth, textureHeight);
    }

    createTextureFor8BitIndices(gl: WebGL2RenderingContext, indices: math.IntArrayType): DataTexture {
        if (indices.length == 0) {
            return emptyDataTexture;
        }
        const textureWidth = 1024;
        const textureHeight = Math.ceil(indices.length / 3 / textureWidth);
        if (textureHeight == 0) {
            throw "texture height == 0";
        }
        const texArraySize = textureWidth * textureHeight * 3;
        const texArray = new Uint8Array(texArraySize);
        //dataTextureRamStats.sizeDataTextureIndices += texArray.byteLength;
        texArray.fill(0);
        texArray.set(indices, 0)
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB8UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB_INTEGER, gl.UNSIGNED_BYTE, texArray, 0);
        this.disableFilteringForBoundTexture(gl);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture(gl, texture, textureWidth, textureHeight);
    }

    createTextureFor16BitIndices(gl: WebGL2RenderingContext, indices: math.IntArrayType[]): DataTexture {
        if (indices.length == 0) {
            return emptyDataTexture;
        }
        const textureWidth = 1024;
        const textureHeight = Math.ceil(indices.length / 3 / textureWidth);
        if (textureHeight == 0) {
            throw "texture height == 0";
        }
        const texArraySize = textureWidth * textureHeight * 3;
        const texArray = new Uint16Array(texArraySize);
        // dataTextureRamStats.sizeDataTextureIndices += texArray.byteLength;
        texArray.fill(0);
        // @ts-ignore
        texArray.set(indices, 0)
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB16UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB_INTEGER, gl.UNSIGNED_SHORT, texArray, 0);
        this.disableFilteringForBoundTexture(gl);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture(gl, texture, textureWidth, textureHeight);
    }

    createTextureFor32BitIndices(gl: WebGL2RenderingContext, indices: math.IntArrayType[]): DataTexture {
        if (indices.length == 0) {
            return emptyDataTexture;
        }
        const textureWidth = 1024;
        const textureHeight = Math.ceil(indices.length / 3 / textureWidth);
        if (textureHeight == 0) {
            throw "texture height == 0";
        }
        const texArraySize = textureWidth * textureHeight * 3;
        const texArray = new Uint32Array(texArraySize);
        // dataTextureRamStats.sizeDataTextureIndices += texArray.byteLength;
        texArray.fill(0);
        // @ts-ignore
        texArray.set(indices, 0)
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB32UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB_INTEGER, gl.UNSIGNED_INT, texArray, 0);
        this.disableFilteringForBoundTexture(gl);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture(gl, texture, textureWidth, textureHeight);
    }

    createTextureFor8BitsEdgeIndices(gl: WebGL2RenderingContext, edgeIndices: math.IntArrayType[]): DataTexture {
        if (edgeIndices.length == 0) {
            return emptyDataTexture;
        }
        const textureWidth = 1024;
        const textureHeight = Math.ceil(edgeIndices.length / 2 / textureWidth);
        if (textureHeight == 0) {
            throw "texture height == 0";
        }
        const texArraySize = textureWidth * textureHeight * 2;
        const texArray = new Uint8Array(texArraySize);
        // dataTextureRamStats.sizeDataTextureEdgeIndices += texArray.byteLength;
        texArray.fill(0);
        // @ts-ignore
        texArray.set(edgeIndices, 0)
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG8UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RG_INTEGER, gl.UNSIGNED_BYTE, texArray, 0);
        this.disableFilteringForBoundTexture(gl);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture(gl, texture, textureWidth, textureHeight);
    }

    createTextureFor16BitsEdgeIndices(gl: WebGL2RenderingContext, edgeIndices: math.IntArrayType[]): DataTexture {
        if (edgeIndices.length == 0) {
            return emptyDataTexture;
        }
        const textureWidth = 1024;
        const textureHeight = Math.ceil(edgeIndices.length / 2 / textureWidth);
        if (textureHeight == 0) {
            throw "texture height == 0";
        }
        const texArraySize = textureWidth * textureHeight * 2;
        const texArray = new Uint16Array(texArraySize);
        //     dataTextureRamStats.sizeDataTextureEdgeIndices += texArray.byteLength;
        texArray.fill(0);
        // @ts-ignore
        texArray.set(edgeIndices, 0)
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG16UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RG_INTEGER, gl.UNSIGNED_SHORT, texArray, 0);
        this.disableFilteringForBoundTexture(gl);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture(gl, texture, textureWidth, textureHeight);
    }

    createTextureFor32BitsEdgeIndices(gl: WebGL2RenderingContext, edgeIndices: math.IntArrayType[]): DataTexture {
        if (edgeIndices.length == 0) {
            return emptyDataTexture;
        }
        const textureWidth = 1024;
        const textureHeight = Math.ceil(edgeIndices.length / 2 / textureWidth);
        if (textureHeight == 0) {
            throw "texture height == 0";
        }
        const texArraySize = textureWidth * textureHeight * 2;
        const texArray = new Uint32Array(texArraySize);
        //   dataTextureRamStats.sizeDataTextureEdgeIndices += texArray.byteLength;
        texArray.fill(0);
        // @ts-ignore
        texArray.set(edgeIndices, 0)
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG32UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RG_INTEGER, gl.UNSIGNED_INT, texArray, 0);
        this.disableFilteringForBoundTexture(gl);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture(gl, texture, textureWidth, textureHeight);
    }

    createTextureForPositions(gl: WebGL2RenderingContext, positions: math.FloatArrayType[]): DataTexture {
        const numVertices = positions.length / 3;
        const textureWidth = 1024;
        const textureHeight = Math.ceil(numVertices / textureWidth);
        if (textureHeight == 0) {
            throw "texture height == 0";
        }
        const texArraySize = textureWidth * textureHeight * 3;
        const texArray = new Uint16Array(texArraySize);
        //   dataTextureRamStats.sizeDataTexturePositions += texArray.byteLength;
        texArray.fill(0);
        // @ts-ignore
        texArray.set(positions, 0);
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB16UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB_INTEGER, gl.UNSIGNED_SHORT, texArray, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture(gl, texture, textureWidth, textureHeight);
    }

    createTextureForPackedPortionIds(gl: WebGL2RenderingContext, portionIdsArray: number[]): DataTexture {
        if (portionIdsArray.length == 0) {
            return emptyDataTexture;
        }
        const lenArray = portionIdsArray.length;
        const textureWidth = 1024;
        const textureHeight = Math.ceil(lenArray / textureWidth);
        if (textureHeight == 0) {
            throw "texture height == 0";
        }
        const texArraySize = textureWidth * textureHeight;
        const texArray = new Uint16Array(texArraySize);
        texArray.set(portionIdsArray, 0);
        // dataTextureRamStats.sizeDataTexturePortionIds += texArray.byteLength;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R16UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RED_INTEGER, gl.UNSIGNED_SHORT, texArray, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new DataTexture(gl, texture, textureWidth, textureHeight);
    }
}