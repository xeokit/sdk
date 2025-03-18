/**
 * Represents a WebGL2 data texture.
 */
export class WebGLDataTexture {
    gl;
    texture;
    textureWidth;
    textureHeight;
    textureData;
    #onDestroyed;
    /**
     * Constructs a new WebGLDataTexture.
     * @param params
     */
    constructor(params = {}) {
        this.gl = params.gl;
        this.texture = params.texture;
        this.textureWidth = params.textureWidth;
        this.textureHeight = params.textureHeight;
        this.textureData = params.textureData;
        this.#onDestroyed = params.onDestroyed;
    }
    /**
     * Binds this WebGLDataTexture to the given {@link WebGLSampler}.
     * @param glProgram
     * @param sampler
     * @param unit
     */
    bindTexture(glProgram, sampler, unit) {
        if (!this.gl) {
            return;
        }
        sampler.bindTexture(this, unit);
    }
    /**
     * Unbinds this WebGLDataTexture from whichever {@link WebGLSampler} it's currently bound to, if any.
     * @param unit
     */
    bind(unit) {
        if (!this.gl || !this.texture) {
            return false;
        }
        // @ts-ignore
        this.gl.activeTexture(this.gl["TEXTURE" + unit]);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        return true;
    }
    disableFiltering() {
        if (!this.gl) {
            return;
        }
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    }
    unbind(unit) {
        if (!this.gl) {
            return;
        }
        // This `unbind` method is ignored at the moment to allow avoiding to rebind same texture already bound to a texture unit.
        // this.gl.activeTexture(this.state.gl["TEXTURE" + unit]);
        // this.gl.bindTexture(this.state.gl.TEXTURE_2D, null);
    }
    destroy() {
        if (!this.gl || !this.texture) {
            return;
        }
        this.gl.deleteTexture(this.texture);
        this.texture = null;
        if (this.#onDestroyed) {
            this.#onDestroyed();
        }
    }
}
//# sourceMappingURL=WebGLDataTexture.js.map