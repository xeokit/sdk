import type {GLAbstractTexture} from "./GLAbstractTexture";

/**
 * Represents a WebGL2 sampler.
 */
export class GLSampler {

    private readonly location: WebGLUniformLocation;
    private readonly gl: WebGL2RenderingContext;

    /**
     * Creates a new sampler.
     * @param gl
     * @param location
     */
    constructor(gl: WebGL2RenderingContext, location: WebGLUniformLocation) {
        this.gl = gl;
        this.location = location;
    }

    /**
     * Binds a texture to this sampler.
     * @param texture
     * @param unit
     */
    bindTexture(texture: GLAbstractTexture, unit: number) {
        if (texture.bind(unit)) {
            this.gl.uniform1i(this.location, unit);
            return true;
        }
        return false;
    }
}
