import {WebGLDataTexture} from "@xeokit/webglutils";
import {FloatArrayParam, IntArrayParam} from "@xeokit/math";

/**
 * @private
 */
export class TrianglesColorsAndFlagsDataTexture extends WebGLDataTexture {

    numPortions: number;

    constructor(params: {
        onDestroyed?: Function;
        gl: WebGL2RenderingContext,
        colors: IntArrayParam[],
        pickColors: IntArrayParam[],
        vertexBases: IntArrayParam,
        indexBaseOffsets: IntArrayParam,
        edgeIndexBaseOffsets: IntArrayParam,
        solid: boolean[]
    }) {

        // 8 columns per texture row:
        // - col0: (RGBA) object color RGBA
        // - col1: (packed Uint32 as RGBA) object pick color
        // - col2: (packed 4 bytes as RGBA) object flags
        // - col3: (packed 4 bytes as RGBA) object flags2
        // - col4: (packed Uint32 bytes as RGBA) vertex base
        // - col5: (packed Uint32 bytes as RGBA) index base offset
        // - col6: (packed Uint32 bytes as RGBA) edge index base offset
        // - col7: (packed 4 bytes as RGBA) is-solid flag for objects

        const numPortions = params.colors.length;
        const textureWidth = 512 * 8;
        const textureHeight = Math.ceil(numPortions / (textureWidth / 8));

        if (textureHeight === 0) {
            throw "texture height===0";
        }

        const gl = params.gl;
        const colors = params.colors;
        const pickColors = params.pickColors;
        const textureData = new Uint8Array(4 * textureWidth * textureHeight);
        const vertexBases = params.vertexBases;
        const indexBaseOffsets = params.indexBaseOffsets;
        const edgeIndexBaseOffsets = params.edgeIndexBaseOffsets;
        const solid = params.solid;

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
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);

        super({
            gl, texture, textureWidth, textureHeight, textureData, onDestroyed: params.onDestroyed
        });

        // The number of rows in the texture is the number of objects in the layer.

        this.numPortions = numPortions;
    }

}