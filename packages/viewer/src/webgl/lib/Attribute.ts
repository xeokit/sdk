import type {ArrayBuf} from "./ArrayBuf";

export class Attribute {
    gl: WebGL2RenderingContext;
    location: number;

    constructor(gl: WebGL2RenderingContext, location: number) {
        this.gl = gl;
        this.location = location;
    }

    bindArrayBuffer(arrayBuf: ArrayBuf) {
        if (!arrayBuf) {
            return;
        }
        arrayBuf.bind();
        this.gl.enableVertexAttribArray(this.location);
        this.gl.vertexAttribPointer(this.location, arrayBuf.itemSize, arrayBuf.itemType, arrayBuf.normalized, arrayBuf.stride, arrayBuf.offset);
    }
}
