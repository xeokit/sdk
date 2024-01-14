import type { GLProgram } from "./GLProgram";
import type { GLSampler } from "./GLSampler";
import type { GLAbstractTexture } from "./GLAbstractTexture";
/**
 * Represents a WebGL2 data texture.
 */
export declare class GLDataTexture implements GLAbstractTexture {
    #private;
    gl?: WebGL2RenderingContext;
    texture?: WebGLTexture | null;
    textureWidth?: number;
    textureHeight?: number;
    textureData?: any;
    /**
     * Constructs a new WebGLDataTexture.
     * @param params
     */
    constructor(params?: {
        gl?: WebGL2RenderingContext;
        texture?: WebGLTexture;
        textureWidth?: number;
        textureHeight?: number;
        textureData?: any;
        onDestroyed?: Function;
    });
    /**
     * Binds this WebGLDataTexture to the given {@link GLSampler}.
     * @param glProgram
     * @param sampler
     * @param unit
     */
    bindTexture(glProgram: GLProgram, sampler: GLSampler, unit: number): void;
    /**
     * Unbinds this WebGLDataTexture from whichever {@link GLSampler} it's currently bound to, if any.
     * @param unit
     */
    bind(unit: number): boolean;
    disableFiltering(): void;
    unbind(unit: number): void;
    destroy(): void;
}
