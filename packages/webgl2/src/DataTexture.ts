import type {Program} from "./Program";
import type {Sampler} from "./Sampler";

/**
 * Represents a WebGL2 texture that holds geometry data.
 */
export class DataTexture {

    gl?: WebGL2RenderingContext;
    texture?: WebGLTexture|null;
    textureWidth?: number;
    textureHeight?: number;
    textureData?: any;
    #onDestroyed?: Function;

    /**
     * Constructs a new DataTexture.
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
     * Binds this DataTexture to the given {@link Sampler}.
     * @param glProgram
     * @param sampler
     * @param unit
     */
    bindTexture(glProgram: Program, sampler: Sampler, unit: number) {
        if (!this.gl) {
            return;
        }
        sampler.bindTexture(this, unit);
    }

    /**
     * Unbinds this DataTexture from whichever {@link Sampler} it's currently bound to, if any.
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