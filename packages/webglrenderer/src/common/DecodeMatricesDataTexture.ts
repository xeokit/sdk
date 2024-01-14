import {WebGLDataTexture} from "@xeokit/webglutils";
import {FloatArrayParam} from "@xeokit/math";

/**
 * @private
 */
export class DecodeMatricesDataTexture extends WebGLDataTexture {

    numPortions: number;

    constructor(gl: WebGL2RenderingContext, matrices: FloatArrayParam[]) {
        const numMatrices = matrices.length;
        if (numMatrices === 0) {
            throw "num instance matrices===0";
        }
        // in one row we can fit 512 matrices
        const textureWidth = 512 * 4;
        const textureHeight = Math.ceil(numMatrices / (textureWidth / 4));
        const textureData = new Float32Array(4 * textureWidth * textureHeight);
        // dataTextureRamStats.sizeDataPositionDecodeMatrices += textureData.byteLength;
        for (let i = 0; i < matrices.length; i++) {            // 4x4 values
            textureData.set(matrices[i], i * 16);
        }
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGBA, gl.FLOAT, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        super({gl, texture, textureWidth, textureHeight, textureData});
    }
}