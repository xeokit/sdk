export declare class ArrayBuf {
    itemType: GLenum;
    itemByteSize: number;
    gl: WebGL2RenderingContext;
    type: any;
    allocated: boolean;
    usage: GLenum;
    length: number;
    dataLength: number;
    numItems: number;
    itemSize: number;
    normalized: boolean;
    stride: number;
    offset: number;
    handle: WebGLBuffer;
    constructor(gl: WebGL2RenderingContext, type: any, data: any, numItems: number, itemSize: number, usage: GLenum, normalized?: boolean, stride?: number, offset?: number);
    _allocate(data: any): void;
    setData(data: any, offset: number): void;
    bind(): void;
    unbind(): void;
    destroy(): void;
}
