/**
 * Represents a WebGL ArrayBuffer.
 */
export declare class GLArrayBuf {
    /**
     * WebGL2 rendering context.
     */
    gl: WebGL2RenderingContext;
    /**
     * The ArrayBuffer's item type.
     */
    itemType: GLenum;
    /**
     * Byte size of each item.
     */
    itemByteSize: number;
    /**
     * The ArrayBuffer type.
     */
    type: any;
    /**
     * Allocated yet?
     */
    allocated: boolean;
    /**
     * A GLenum specifying the intended usage pattern of the data store for optimization purposes. Possible values:
     *
     * * gl.STATIC_DRAW : The contents are intended to be specified once by the application, and used many times as the source for WebGL drawing and image specification commands.
     * * gl.DYNAMIC_DRAW : The contents are intended to be respecified repeatedly by the application, and used many times as the source for WebGL drawing and image specification commands.
     * * gl.STREAM_DRAW : The contents are intended to be specified once by the application, and used at most a few times as the source for WebGL drawing and image specification commands.
     * * gl.STATIC_READ : The contents are intended to be specified once by reading data from WebGL, and queried many times by the application.
     * * gl.DYNAMIC_READ : The contents are intended to be respecified repeatedly by reading data from WebGL, and queried many times by the application.
     * * gl.STREAM_READ : The contents are intended to be specified once by reading data from WebGL, and queried at most a few times by the application
     * * gl.STATIC_COPY : The contents are intended to be specified once by reading data from WebGL, and used many times as the source for WebGL drawing and image specification commands.
     * * gl.DYNAMIC_COPY : The contents are intended to be respecified repeatedly by reading data from WebGL, and used many times as the source for WebGL drawing and image specification commands.
     * * gl.STREAM_COPY : The contents are intended to be specified once by reading data from WebGL, and used at most a few times as the source for WebGL drawing and image specification commands.
     */
    usage: GLenum;
    /**
     * The ArrayBuffer type.
     */
    length: GLuint;
    /**
     *
     */
    dataLength: number;
    /**
     * Number of items in the ArrayBuffer.
     */
    numItems: number;
    /**
     * Size of each item.
     */
    itemSize: number;
    /**
     * True when ArrayBuffer values are normalized.
     */
    normalized: boolean;
    /**
     * The ArrayBuffer stride.
     */
    stride: number;
    /**
     *
     */
    offset: number;
    /**
     * Hand to a WebGLBuffer.
     */
    handle: WebGLBuffer;
    /**
     * Creates a WebGL ArrayBuffer.
     */
    constructor(gl: WebGL2RenderingContext, type: any, data: any, numItems: number, itemSize: number, usage: GLenum, normalized?: boolean, stride?: number, offset?: number);
    _allocate(data: any): void;
    /**
     * Updates the contents of this ArrayBuffer.
     * @param data
     * @param offset
     */
    setData(data: any, offset: number): void;
    /**
     * Binds this ArrayBuffer to the WebGL rendering context.
     */
    bind(): void;
    /**
     * Unbinds this ArrayBuffer from the WebGL rendering context.
     */
    unbind(): void;
    /**
     * Destroys this ArrayBuffer.
     */
    destroy(): void;
}
