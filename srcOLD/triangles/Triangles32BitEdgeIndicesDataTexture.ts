import {WebGLDataTexture} from "@xeokit/webglutils";
import {IntArrayParam} from "@xeokit/math";

/**
 * @private
 */
export class Triangles32BitEdgeIndicesDataTexture extends WebGLDataTexture {

    constructor(params: {
        onDestroyed?: Function;
        gl: WebGL2RenderingContext,
        indicesArrays: IntArrayParam[],
        lenIndices: number
    }) {
        const gl = params.gl;
        const textureWidth = 4096;
        const lenIndices = params.lenIndices;
        const textureHeight = Math.ceil(lenIndices / 2 / textureWidth);
        if (textureHeight === 0) {
            throw "texture height===0";
        }
        const indicesArrays = params.indicesArrays;
        const textureDataSize = textureWidth * textureHeight * 2;
        const textureData = new Uint32Array(textureDataSize);
         for (let i = 0, j = 0, len = indicesArrays.length; i < len; i++) {
            const pc = indicesArrays[i];
            textureData.set(pc, j);
            j += pc.length;
        }
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB32UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB_INTEGER, gl.UNSIGNED_INT, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        super({gl, texture, textureWidth, textureHeight, textureData});
    }
}