import type { WebGLAbstractTexture } from "./WebGLAbstractTexture";
/**
 * Represents a WebGL2 sampler.
 */
export declare class WebGLSampler {
    private readonly location;
    private readonly gl;
    /**
     * Creates a new sampler.
     * @param gl
     * @param location
     */
    constructor(gl: WebGL2RenderingContext, location: WebGLUniformLocation);
    /**
     * Binds a texture to this sampler.
     * @param texture
     * @param unit
     */
    bindTexture(texture: WebGLAbstractTexture, unit: number): boolean;
}
//# sourceMappingURL=WebGLSampler.d.ts.map