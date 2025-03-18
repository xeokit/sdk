import { WebGLShader } from "./WebGLShader";
import { WebGLSampler } from "./WebGLSampler";
import { WebGLAttribute } from "./WebGLAttribute";
import type { WebGLAbstractTexture } from "./WebGLAbstractTexture";
/**
 * Represents a WebGL2 program.
 */
export declare class WebGLProgram {
    /**
     * Unique ID of this program.
     */
    id: number;
    /**
     * The vertex shader.
     */
    vertexShader: WebGLShader;
    /**
     * The fragment shader.
     */
    fragmentShader: WebGLShader;
    /**
     * Map of all attributes in this program.
     */
    attributes: {
        [key: string]: WebGLAttribute;
    };
    /**
     * Map of all samplers in this program.
     */
    samplers: {
        [key: string]: WebGLSampler;
    };
    /**
     * Map of all uniforms in this program.
     */
    uniforms: {
        [key: string]: WebGLUniformLocation;
    };
    /**
     * List of compilation errors for this program, if any.
     */
    errors: string[];
    /**
     * Flag set true when program has been validated.
     */
    validated: boolean;
    /**
     * Flag set true when this program has been successfully linked.
     */
    linked: boolean;
    /**
     * Flag set true when this program has been successfully conpiled.
     */
    compiled: boolean;
    /**
     * Flag set true when this program has been successfully allocated.
     */
    allocated: boolean;
    /**
     * The WebGL2 rendering context.
     */
    gl: WebGL2RenderingContext;
    /**
     * The source code from which the shaders are built.
     */
    source: any;
    /**
     * Handle to the WebGL program itself, which resides on the GPU.
     */
    handle: WebGLProgram;
    /**
     * Creates a new program.
     * @param gl
     * @param shaderSource
     */
    constructor(gl: WebGL2RenderingContext, shaderSource: {
        vertex: string;
        fragment: string;
    });
    /**
     * Binds this program.
     */
    bind(): void;
    /**
     * Gets the location of the given uniform within this program.
     * @param name
     */
    getLocation(name: string): WebGLUniformLocation;
    /**
     * Gets an attribute within this program.
     * @param name
     */
    getAttribute(name: string): WebGLAttribute;
    /**
     * Gets a sampler within this program.
     * @param name
     */
    getSampler(name: string): WebGLSampler;
    /**
     * Binds a texture to this program.
     * @param name
     * @param texture
     * @param unit
     */
    bindTexture(name: string, texture: WebGLAbstractTexture, unit: number): boolean;
    /**
     * Destroys this program.
     */
    destroy(): void;
}
//# sourceMappingURL=WebGLProgram.d.ts.map