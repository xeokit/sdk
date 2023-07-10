/**
 * Represents a WebGL2 shader.
 */
export declare class GLShader {
    /**
     * Compilation errors, if any.
     */
    errors: string[];
    /**
     * True when this shader was successfully allocated.
     */
    allocated: boolean;
    /**
     * True when this shader was successfully compiled.
     */
    compiled: boolean;
    /**
     * Handle to GPU-resident WebGL2 shader.
     */
    handle: WebGLShader;
    /**
     * Creates a new shader.
     * @param gl
     * @param type
     * @param source
     */
    constructor(gl: WebGL2RenderingContext, type: number, source: string);
    /**
     * Destroys this shader.
     */
    destroy(): void;
}
