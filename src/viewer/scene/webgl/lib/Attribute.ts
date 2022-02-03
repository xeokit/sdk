import {ArrayBuf} from "./ArrayBuf";

export class Attribute {
    gl: WebGLRenderingContext;
    location: number;

    constructor(gl: WebGLRenderingContext, location: number) {
        this.gl = gl;
        this.location = location;
    }

    bindArrayBuffer(arrayBuf: ArrayBuf) {
        if (!arrayBuf) {
            return;
        }
        arrayBuf.bind();
        this.gl.enableVertexAttribArray(this.location);
        this.gl.vertexAttribPointer(this.location,
            arrayBuf.itemSize, arrayBuf.itemType, arrayBuf.normalized, arrayBuf.stride, arrayBuf.offset);
    }
}
