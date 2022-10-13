import {Program} from "../../../../lib/Program";

export class DataTexture {

    gl: WebGL2RenderingContext;
    texture: WebGLTexture;
    textureWidth: number;
    textureHeight: number;
    textureData: any;

    constructor(gl: WebGL2RenderingContext, texture: WebGLTexture, textureWidth: number, textureHeight: number, textureData: any = null) {
        this.gl = gl;
        this.texture = texture;
        this.textureWidth = textureWidth;
        this.textureHeight = textureHeight;
        this.textureData = textureData;
    }

    bindTexture(glProgram: Program, shaderName: string, glTextureUnit: number) {
        if (!this.gl) {
            return;
        }
        return glProgram.bindTexture(shaderName, this, glTextureUnit);
    }

    bind(unit: number) {
        if (!this.gl) {
            return;
        }
        // @ts-ignore
        this.gl.activeTexture(this.gl["TEXTURE" + unit]);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        return true;
    }

    unbind(unit: number) {
        if (!this.gl) {
            return;
        }
        // This `unbind` method is ignored at the moment to allow avoiding to rebind same texture already bound to a texture unit.

        // this.gl.activeTexture(this.state.gl["TEXTURE" + unit]);
        // this.gl.bindTexture(this.state.gl.TEXTURE_2D, null);
    }
}