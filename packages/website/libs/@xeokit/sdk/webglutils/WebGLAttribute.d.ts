import type { WebGLArrayBuf } from "./WebGLArrayBuf";
/**
 * Represents a WebGL vertex attribute.
 */
export declare class WebGLAttribute {
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
    bindArrayBuffer(arrayBuf: WebGLArrayBuf): void;
}
//# sourceMappingURL=WebGLAttribute.d.ts.map