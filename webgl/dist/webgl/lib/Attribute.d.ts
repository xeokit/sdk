import type { ArrayBuf } from "./ArrayBuf";
export declare class Attribute {
    gl: WebGL2RenderingContext;
    location: number;
    constructor(gl: WebGL2RenderingContext, location: number);
    bindArrayBuffer(arrayBuf: ArrayBuf): void;
}
