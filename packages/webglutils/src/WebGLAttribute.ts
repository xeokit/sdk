import type {WebGLArrayBuf} from "./WebGLArrayBuf";

/**
 * Represents a WebGL vertex attribute.
 */
export class WebGLAttribute {
    gl: WebGL2RenderingContext;
    location: number;

    /**
     * Creates a new vertex attribute.
     * @param gl
     * @param location
     */
    constructor(gl: WebGL2RenderingContext, location: number) {
        this.gl = gl;
        this.location = location;
    }

    /**
     * Binds an array buffer to this vertex attribute.
     * @param arrayBuf
     */
    bindArrayBuffer(arrayBuf: WebGLArrayBuf) {
        if (!arrayBuf) {
            return;
        }
        arrayBuf.bind();
        this.gl.enableVertexAttribArray(this.location);
        this.gl.vertexAttribPointer(this.location, arrayBuf.itemSize, arrayBuf.itemType, arrayBuf.normalized, arrayBuf.stride, arrayBuf.offset);
    }
}
