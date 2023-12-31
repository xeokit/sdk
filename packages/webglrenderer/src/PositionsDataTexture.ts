import {GLDataTexture} from "@xeokit/webglutils";
import {IntArrayParam} from "@xeokit/math";

/**
 * @private
 */
export class PositionsDataTexture extends GLDataTexture {

    constructor(params: {
        onDestroyed?: Function;
        gl: WebGL2RenderingContext,
        positionsArrays: IntArrayParam[],
        lenPositions: number
    }) {
        const gl = params.gl;
        const numVertices = params.lenPositions / 3;
        const textureWidth = 4096;
        const textureHeight = Math.ceil(numVertices / textureWidth);
        if (textureHeight === 0) {
            throw "texture height===0";
        }
        const positionsArrays = params.positionsArrays;
        const textureDataSize = textureWidth * textureHeight * 3;
        const textureData = new Uint16Array(textureDataSize);
         for (let i = 0, j = 0, len = positionsArrays.length; i < len; i++) {
            const pc = positionsArrays[i];
            textureData.set(pc, j);
            j += pc.length;
        }
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB16UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGB_INTEGER, gl.UNSIGNED_SHORT, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        super({gl, texture, textureWidth, textureHeight, textureData});
    }
}