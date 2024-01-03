import type { GLAbstractTexture } from "./GLAbstractTexture";
/**
 * Represents a WebGL2 sampler.
 */
export declare class GLSampler {
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
    bindTexture(texture: GLAbstractTexture, unit: number): boolean;
}
