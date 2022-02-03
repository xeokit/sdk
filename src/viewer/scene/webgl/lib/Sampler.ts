import {Texture2D} from "./Texture2D";

export class Sampler {

    private readonly location:  WebGLUniformLocation;
    private readonly gl: WebGLRenderingContext;

    constructor(gl: WebGLRenderingContext, location: WebGLUniformLocation) {
        this.gl = gl;
        this.location = location;
    }

    bindTexture(texture: Texture2D, unit: number) {
        if (texture.bind(unit)) {
            this.gl.uniform1i(this.location, unit);
            return true;
        }
        return false;
    }
}
