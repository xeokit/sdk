import type {GLProgram} from "./GLProgram";
import type {GLSampler} from "./GLSampler";
import {GLAbstractTexture} from "./GLAbstractTexture";

/**
 * Represents a WebGL2 data texture.
 */
export class GLDataTexture implements GLAbstractTexture {

    gl?: WebGL2RenderingContext;
    texture?: WebGLTexture;
    textureWidth?: number;
    textureHeight?: number;
    textureData?: any;
    #onDestroyed?: Function;

    /**
     * Constructs a new GLDataTexture.
     * @param params
     */
    constructor(params: {
        gl?: WebGL2RenderingContext,
        texture?: WebGLTexture,
        textureWidth?: number,
        textureHeight?: number,
        textureData?: any,
        onDestroyed?: Function
    }={}) {
        this.gl = params.gl;
        this.texture = params.texture;
        this.textureWidth = params.textureWidth;
        this.textureHeight = params.textureHeight;
        this.textureData = params.textureData;
        this.#onDestroyed = params.onDestroyed;
    }

    /**
     * Binds this GLDataTexture to the given {@link GLSampler}.
     * @param glProgram
     * @param sampler
     * @param unit
     */
    bindTexture(glProgram: GLProgram, sampler: GLSampler, unit: number) {
        if (!this.gl) {
            return;
        }
        sampler.bindTexture(this, unit);
    }

    /**
     * Unbinds this GLDataTexture from whichever {@link GLSampler} it's currently bound to, if any.
     * @param unit
     */
    bind(unit: number) {
        if (!this.gl || !this.texture) {
            return;
        }
        // @ts-ignore
        this.gl.activeTexture(this.gl["TEXTURE" + unit]);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        return true;
    }

    disableFiltering(): void {
        if (!this.gl) {
            return;
        }
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    }

    unbind(unit: number) {
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