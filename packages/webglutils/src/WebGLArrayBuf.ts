/**
 * Represents a WebGL ArrayBuffer.
 */
export class WebGLArrayBuf {

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
    constructor(
        gl: WebGL2RenderingContext,
        type: any,
        data: any,
        numItems: number,
        itemSize: number,
        usage: GLenum,
        normalized?: boolean,
        stride?: number,
        offset?: number) {

        this.gl = gl;
        this.type = type;
        this.allocated = false;

        switch (data.constructor) {

            case Uint8Array:
                this.itemType = gl.UNSIGNED_BYTE;
                this.itemByteSize = 1;
                break;

            case Int8Array:
                this.itemType = gl.BYTE;
                this.itemByteSize = 1;
                break;

            case  Uint16Array:
                this.itemType = gl.UNSIGNED_SHORT;
                this.itemByteSize = 2;
                break;

            case  Int16Array:
                this.itemType = gl.SHORT;
                this.itemByteSize = 2;
                break;

            case Uint32Array:
                this.itemType = gl.UNSIGNED_INT;
                this.itemByteSize = 4;
                break;

            case Int32Array:
                this.itemType = gl.INT;
                this.itemByteSize = 4;
                break;

            default:
                this.itemType = gl.FLOAT;
                this.itemByteSize = 4;
        }

        this.usage = usage;
        this.length = 0;
        this.dataLength = numItems;
        this.numItems = 0;
        this.itemSize = itemSize;
        this.normalized = !!normalized;
        this.stride = stride || 0;
        this.offset = offset || 0;

        this._allocate(data);
    }

    _allocate(data: any) {
        this.allocated = false;
        // @ts-ignore
        this.handle = this.gl.createBuffer();
        if (!this.handle) {
            throw new Error("Failed to allocate WebGL ArrayBuffer");
        }
        if (this.handle) {
            this.gl.bindBuffer(this.type, this.handle);
            this.gl.bufferData(this.type, data.length > this.dataLength ? data.slice(0, this.dataLength) : data, this.usage);
            this.gl.bindBuffer(this.type, null);
            this.length = data.length;
            this.numItems = this.length / this.itemSize;
            this.allocated = true;
        }
    }

    /**
     * Updates the contents of this ArrayBuffer.
     * @param data
     * @param offset
     */
    setData(data: any, offset: number) {
        if (!this.allocated) {
            return;
        }
        if (data.length + (offset || 0) > this.length) {            // Needs reallocation
            this.destroy();
            this._allocate(data);
        } else {            // No reallocation needed
            this.gl.bindBuffer(this.type, this.handle);
            if (offset || offset === 0) {
                this.gl.bufferSubData(this.type, offset * this.itemByteSize, data);
            } else {
                this.gl.bufferData(this.type, data, this.usage);
            }
            this.gl.bindBuffer(this.type, null);
        }
    }

    /**
     * Binds this ArrayBuffer to the WebGL rendering context.
     */
    bind() {
        if (!this.allocated) {
            return;
        }
        this.gl.bindBuffer(this.type, this.handle);
    }

    /**
     * Unbinds this ArrayBuffer from the WebGL rendering context.
     */
    unbind() {
        if (!this.allocated) {
            return;
        }
        this.gl.bindBuffer(this.type, null);
    }

    /**
     * Destroys this ArrayBuffer.
     */
    destroy() {
        if (!this.allocated) {
            return;
        }
        this.gl.deleteBuffer(this.handle);
        this.allocated = false;
    }
}
