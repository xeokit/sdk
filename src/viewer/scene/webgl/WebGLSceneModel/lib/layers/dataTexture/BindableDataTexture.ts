import {Program} from "../../../../lib/Program";

export class BindableDataTexture {

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
        return glProgram.bindTexture(shaderName, this, glTextureUnit);
    }

    bind(unit: number) {
        // @ts-ignore
        this.gl.activeTexture(this.gl["TEXTURE" + unit]);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        return true;
    }

    unbind(unit: number) {
        // This `unbind` method is ignored at the moment to allow avoiding to rebind same texture already bound to a texture unit.

        // this.gl.activeTexture(this.state.gl["TEXTURE" + unit]);
        // this.gl.bindTexture(this.state.gl.TEXTURE_2D, null);
    }
}