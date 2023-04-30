import type { GLArrayBuf } from "./GLArrayBuf";
/**
 * Represents a WebGL vertex attribute.
 */
export declare class GLAttribute {
    gl: WebGL2RenderingContext;
    location: number;
    /**
     * Creates a new vertex attribute.
     * @param gl
     * @param location
     */
    constructor(gl: WebGL2RenderingContext, location: number);
    /**
     * Binds an array buffer to this vertex attribute.
     * @param arrayBuf
     */
    bindArrayBuffer(arrayBuf: GLArrayBuf): void;
}
