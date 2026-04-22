import {EventEmitter, SDKErrorType, type SDKResult} from "../../../../core";
import {EventDispatcher} from "strongly-typed-events";

/**
 * Base class for GPU-backed structured buffers owned by the WebGL renderer.
 *
 * A {@link DataBuffer} wraps a WebGL buffer object that stores structured, non-image data
 * along with its CPU-side backing buffer. Subclasses define the logical record layout and
 * provide helpers to read decoded records for debugging and tooling.
 *
 * Notes:
 * - The {@link buffer} is the authoritative CPU-side representation used to upload
 *   data to the GPU {@link gpuBuffer}.
 * - The meaning of an “item” depends on the subclass’ layout.
 * - This class allocates a flat WebGL buffer sized to hold {@link maxItems} logical items.
 * - By default the GPU buffer target is `gl.ARRAY_BUFFER`, but subclasses/owners may choose
 *   a different target when appropriate.
 *
 * @internal
 */
export abstract class DataBuffer {

  /**
   * The WebGL2 rendering context.
   */
  public gl: WebGL2RenderingContext;

  /**
   * The underlying WebGL buffer object.
   *
   * This is the GPU resource that is bound and read by shaders or used as attribute storage.
   *
   * @internal
   */
  public gpuBuffer: WebGLBuffer | null = null;

  /**
   * Human-readable description of the data stored in this buffer.
   *
   * Intended for debugging UIs and diagnostics.
   */
  public description: string = "";

  /**
   * Whether to use a CPU-side buffer for staging data before uploading to the GPU.
   */
  public useBuffer: boolean;

  /**
   * CPU-side backing buffer used to populate this GPU buffer.
   *
   * The concrete type depends on the implementation (eg. `Uint32Array`, `Float32Array`).
   */
  public buffer: ArrayBufferView | null = null;

  /**
   * The ArrayBufferView class used for the CPU-side buffer.
   */
  public bufferClass: any;

  /**
   * Maximum number of logical items that can be stored in this buffer.
   *
   * The value of `numItems` never exceeds this limit.
   */
  public maxItems: number;

  /**
   * Size in bytes of a single logical item stored in the data buffer.
   */
  public itemSizeInBytes: number;

  /**
   * Number of typed-array elements per logical item.
   *
   * Example:
   * - float32 vec4 => 4
   * - uint32 mat4x4 packed as 16 uints => 16
   */
  public elementsPerItem: number;

  /**
   * Size in bytes of each typed-array element.
   */
  public bytesPerElement: number;

  /**
   * WebGL buffer target (eg. `gl.ARRAY_BUFFER`).
   */
  public target: number;

  /**
   * WebGL usage hint (eg. `gl.DYNAMIC_DRAW`).
   */
  public usage: number;

  /**
   * Backend function to get the number of logical items currently stored in this buffer.
   * @private
   */
  private _getNumItems: () => number;

  /**
   * Gets the number of logical items currently stored in this buffer.
   */
  public get numItems(): number {
    return this._getNumItems();
  }

  /**
   * Gets the used capacity in bytes of the data buffer.
   */
  public getUsedBytes(): number {
    return this.numItems * this.itemSizeInBytes;
  }

  /**
   * Gets the total capacity in bytes of the data buffer.
   */
  public getAllocatedBytes(): number {
    return this.maxItems * this.itemSizeInBytes;
  }

  /**
   * Duration (in milliseconds) of the last upload to GPU.
   *
   * This value is `0` until the first upload occurs.
   */
  public lastUploadTimeMS: number = 0;

  /**
   * Enables internal event emission for this data buffer.
   */
  public debugging: boolean = true;

  /**
   * Emitted when the CPU-side buffer for this GPU buffer has changed and been uploaded.
   *
   * This event is intended for debugging tools and monitoring UIs; it is only
   * emitted when {@link debugging} is enabled.
   */
  public onUpdated = new EventEmitter(new EventDispatcher<DataBuffer, undefined>());

  /**
   * @private
   */
  constructor(params: {
    gl: WebGL2RenderingContext;
    description: string;
    itemSizeInBytes: number;
    elementsPerItem: number;
    maxItems: number;
    getNumItems: () => number;
    target?: number;
    usage?: number;
    useBuffer?: boolean;
    bufferClass?: any;
  }) {
    this.gl = params.gl;
    this.description = params.description;
    this.itemSizeInBytes = params.itemSizeInBytes;
    this.elementsPerItem = params.elementsPerItem;
    this.maxItems = params.maxItems;
    this._getNumItems = params.getNumItems;
    this.useBuffer = params.useBuffer ?? true;
    this.target = params.target ?? params.gl.ARRAY_BUFFER;
    this.usage = params.usage ?? params.gl.DYNAMIC_DRAW;

    if (params.bufferClass) {
      this.bufferClass = params.bufferClass;
    } else {
      // Default to Float32Array if caller does not specify.
      this.bufferClass = Float32Array;
    }

    this.bytesPerElement = this.itemSizeInBytes / this.elementsPerItem;
  }

  /**
   * Allocates the CPU-side buffer and the GPU buffer.
   * @internal
   */
  public allocate(): SDKResult<void> {
    if (this.useBuffer) {
      try {
        const totalElements = this.maxItems * this.elementsPerItem;
        this.buffer = new this.bufferClass(totalElements);
      } catch (e) {
        return {
          ok: false,
          type: SDKErrorType.InitializationFailed,
          error: `[${this.constructor.name}.allocate]: Buffer allocation failed: ${e}`,
        };
      }
    }
    return this._allocateGPUBuffer(false);
  }

  private _allocateGPUBuffer(uploadBuffer: boolean): SDKResult<void> {
    const gl = this.gl;
    const gpuBuffer = gl.createBuffer();
    if (!gpuBuffer) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[${this.constructor.name}._allocateGPUBuffer]: Buffer creation failed`,
      };
    }

    this.gpuBuffer = gpuBuffer;

    try {
      gl.bindBuffer(this.target, gpuBuffer);
      gl.bufferData(this.target, this.maxItems * this.itemSizeInBytes, this.usage);

      if (this.useBuffer && uploadBuffer && this.buffer) {
        gl.bufferSubData(this.target, 0, this.buffer);
        this.cancelUploads();
      }

      gl.bindBuffer(this.target, null);

      return {ok: true, value: undefined};

    } catch (e) {
      gl.deleteBuffer(gpuBuffer);
      this.cancelUploads();
      this.gpuBuffer = null;
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[${this.constructor.name}._allocateGPUBuffer]: Exception during buffer allocation: ${e}`,
      };
    }
  }

  /**
   * Retrieves the logical item at the specified index.
   * @param itemIndex - Index of the item to retrieve.
   * @returns The decoded item.
   */
  public abstract getItem(itemIndex: number): any;

  /**
   * Retrieves all logical items currently stored in this buffer.
   * @returns An array of decoded items.
   */
  public getItems(): any[] {
    const items = [];
    for (let i = 0; i < this.numItems; i++) {
      items.push(this.getItem(i));
    }
    return items;
  }

  /**
   * Returns the byte offset of an item within the GPU buffer.
   *
   * @param itemIndex - Logical item index.
   */
  public getItemByteOffset(itemIndex: number): number {
    return itemIndex * this.itemSizeInBytes;
  }

  /**
   * Returns the element offset of an item within the CPU-side typed array.
   *
   * @param itemIndex - Logical item index.
   */
  public getItemElementOffset(itemIndex: number): number {
    return itemIndex * this.elementsPerItem;
  }

  /**
   * Cancels any pending uploads to the GPU.
   * @internal
   */
  protected abstract cancelUploads(): void;

  /**
   * Handles WebGL context restoration by reallocating the GPU buffer.
   * @internal
   */
  public webglContextRestored(): SDKResult<void> {
    return this._allocateGPUBuffer(true);
  }

  /**
   * Uploads any changes in the CPU-side buffer to the GPU buffer.
   * @return `true` if any data was uploaded; `false` if there were no changes to upload.
   * @internal
   */
  public abstract uploadChanges(): boolean;

  /**
   * Uploads the entire CPU-side buffer to the GPU buffer.
   *
   * Useful for subclasses that do not track dirty ranges.
   *
   * @returns `true` if upload occurred, otherwise `false`.
   * @internal
   */
  protected uploadFullBuffer(): boolean {
    if (!this.useBuffer || !this.buffer || !this.gpuBuffer) {
      return false;
    }

    const gl = this.gl;
    const startTime = performance.now();

    gl.bindBuffer(this.target, this.gpuBuffer);
    gl.bufferSubData(this.target, 0, this.buffer);
    gl.bindBuffer(this.target, null);

    this.lastUploadTimeMS = performance.now() - startTime;
    this.notifyUpdated();

    return true;
  }

  /**
   * Uploads a subrange of the CPU-side buffer to the GPU buffer.
   *
   * @param byteOffset - Offset into the GPU buffer in bytes.
   * @param data - Typed-array view containing the subrange to upload.
   * @returns `true` if upload occurred, otherwise `false`.
   * @internal
   */
  protected uploadBufferRange(byteOffset: number, data: ArrayBufferView): boolean {
    if (!this.gpuBuffer) {
      return false;
    }

    const gl = this.gl;
    const startTime = performance.now();

    gl.bindBuffer(this.target, this.gpuBuffer);
    gl.bufferSubData(this.target, byteOffset, data);
    gl.bindBuffer(this.target, null);

    this.lastUploadTimeMS = performance.now() - startTime;
    this.notifyUpdated();

    return true;
  }

  /**
   * Notifies listeners that the data buffer has been updated.
   * @internal
   */
  protected notifyUpdated(): void {
    if (this.debugging) {
      this.onUpdated.dispatch(this, undefined);
    }
  }

  /**
   * Frees GPU resources associated with this data buffer.
   * @internal
   */
  public destroy(): void {
    if (this.gpuBuffer) {
      this.buffer = null;
      this.gl?.deleteBuffer(this.gpuBuffer);
      this.gpuBuffer = null;
      this.gl = null as any;
    }
  }
}
