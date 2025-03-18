import type { WebGLProgram } from "./WebGLProgram";
import type { WebGLSampler } from "./WebGLSampler";
import type { WebGLAbstractTexture } from "./WebGLAbstractTexture";
/**
 * Represents a WebGL2 data texture.
 */
export declare class WebGLDataTexture implements WebGLAbstractTexture {
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
     * Binds this WebGLDataTexture to the given {@link WebGLSampler}.
     * @param glProgram
     * @param sampler
     * @param unit
     */
    bindTexture(glProgram: WebGLProgram, sampler: WebGLSampler, unit: number): void;
    /**
     * Unbinds this WebGLDataTexture from whichever {@link WebGLSampler} it's currently bound to, if any.
     * @param unit
     */
    bind(unit: number): boolean;
    disableFiltering(): void;
    unbind(unit: number): void;
    destroy(): void;
}
//# sourceMappingURL=WebGLDataTexture.d.ts.map