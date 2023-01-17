
import type {Texture2D} from "./Texture2D";
import type {DataTexture} from "./DataTexture";
import type {Texture} from "./Texture";

export class Sampler {

    private readonly location: WebGLUniformLocation;
    private readonly gl: WebGL2RenderingContext;

    constructor(gl: WebGL2RenderingContext, location: WebGLUniformLocation) {
        this.gl = gl;
        this.location = location;
    }

    bindTexture(texture: Texture2D|DataTexture|Texture, unit: number) {
        if (texture.bind(unit)) {
            this.gl.uniform1i(this.location, unit);
            return true;
        }
        return false;
    }
}
