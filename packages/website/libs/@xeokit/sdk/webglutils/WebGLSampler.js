/**
 * Represents a WebGL2 sampler.
 */
export class WebGLSampler {
    location;
    gl;
    /**
     * Creates a new sampler.
     * @param gl
     * @param location
     */
    constructor(gl, location) {
        this.gl = gl;
        this.location = location;
    }
    /**
     * Binds a texture to this sampler.
     * @param texture
     * @param unit
     */
    bindTexture(texture, unit) {
        if (texture.bind(unit)) {
            this.gl.uniform1i(this.location, unit);
            return true;
        }
        return false;
    }
}
//# sourceMappingURL=WebGLSampler.js.map