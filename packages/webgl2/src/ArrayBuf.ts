/**
 * Represents a WebGL ArrayBuffer.
 */
export class ArrayBuf {

    gl: WebGL2RenderingContext;
    itemType: GLenum;
    itemByteSize: number;
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

    /**
     * Creates a WebGL ArrayBuffer.
     * @param gl
     * @param type
     * @param data
     * @param numItems
     * @param itemSize
     * @param usage
     * @param normalized
     * @param stride
     * @param offset
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
