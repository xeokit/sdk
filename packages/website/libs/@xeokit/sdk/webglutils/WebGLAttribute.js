/**
 * Represents a WebGL vertex attribute.
 */
export class WebGLAttribute {
    gl;
    location;
    /**
     * Creates a new vertex attribute.
     * @param gl
     * @param location
     */
    constructor(gl, location) {
        this.gl = gl;
        this.location = location;
    }
    /**
     * Binds an array _buffer to this vertex attribute.
     * @param arrayBuf
     */
    bindArrayBuffer(arrayBuf) {
        if (!arrayBuf) {
            return;
        }
        arrayBuf.bind();
        this.gl.enableVertexAttribArray(this.location);
        this.gl.vertexAttribPointer(this.location, arrayBuf.itemSize, arrayBuf.itemType, arrayBuf.normalized, arrayBuf.stride, arrayBuf.offset);
    }
}
//# sourceMappingURL=WebGLAttribute.js.map
