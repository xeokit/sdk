import {Texture} from "./Texture";

export class Sampler {

    private readonly location: WebGLUniformLocation;
    private readonly gl: WebGL2RenderingContext;

    constructor(gl: WebGL2RenderingContext, location: WebGLUniformLocation) {
        this.gl = gl;
        this.location = location;
    }

    bindTexture(texture: Texture, unit: number) {
        if (texture.bind(unit)) {
            this.gl.uniform1i(this.location, unit);
            return true;
        }
        return false;
    }
}
