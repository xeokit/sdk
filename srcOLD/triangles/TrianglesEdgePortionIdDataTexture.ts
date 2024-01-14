import {WebGLDataTexture} from "@xeokit/webglutils";
import {IntArrayParam} from "@xeokit/math";

/**
 * @private
 */
export class TrianglesEdgePortionIdDataTexture extends WebGLDataTexture {

    constructor(params: {
        onDestroyed?: Function;
        gl: WebGL2RenderingContext,
        portionIdsArray: IntArrayParam
    }) {
        const gl = params.gl;
        if (params.portionIdsArray.length === 0) {
            throw "portionIdsArray===0";
        }
        const lenArray = params.portionIdsArray.length;
        const textureWidth = 4096;
        const textureHeight = Math.ceil(lenArray / textureWidth);
        if (textureHeight === 0) {
            throw "texture height===0";
        }
        const portionIdsArray = params.portionIdsArray;
        const textureDataSize = textureWidth * textureHeight;
        const textureData = new Uint16Array(textureDataSize);
        textureData.set(portionIdsArray, 0);
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R16UI, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RED_INTEGER, gl.UNSIGNED_SHORT, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        super({gl, texture, textureWidth, textureHeight, textureData});
    }
}