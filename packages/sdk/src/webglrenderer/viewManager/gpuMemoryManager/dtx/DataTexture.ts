import {EventEmitter, SDKErrorType, type SDKResult} from "../../../../core";
import { EventDispatcher } from "strongly-typed-events";


/**
 * Base class for GPU-backed “data textures” owned by the WebGL renderer.
 *
 * A {@link DataTexture} wraps a WebGL texture that stores structured, non-image data
 * (often packed into RGBA texels) along with its CPU-side backing buffer. Subclasses
 * define the logical record layout and provide helpers to read decoded records for
 * debugging and tooling.
 *
 * Notes:
 * - The {@link buffer} is the authoritative CPU-side representation used to upload
 *   data to the {@link texture}.
 * - The meaning of an “item” depends on the subclass’ layout; items may span multiple
 *   texels and may not map 1:1 to texels.
 *
 * @debugging
 */
export abstract class DataTexture {

  /**
   * The WebGL2 rendering context.
   */
  public gl: WebGL2RenderingContext;

  /**
   * The underlying WebGL texture object.
   *
   * This is the GPU resource that is bound and sampled/loaded by shaders.
   *
   * @internal
   */
  public texture: WebGLTexture;

  /**
   * Human-readable description of the data stored in this texture.
   *
   * Intended for debugging UIs and diagnostics (e.g., displayed above inspectors).
   * Subclasses or owners should populate this with a concise explanation of the layout
   * and semantic meaning (e.g., “mesh matrices (Mat4, row-major), indexed by meshId”).
   */
  public description: string = "";

  /**
   * Texture width in texels.
   */
  public width: number;

  /**
   * Texture height in texels.
   */
  public height: number;

  /**
   * CPU-side backing buffer used to populate this texture.
   *
   * The concrete type depends on the implementation (e.g., `Uint32Array`,
   * `Float32Array`, or a view over an `ArrayBuffer`). This buffer is
   * uploaded to the GPU when updated.
   */
  public buffer: any;

  /**
   * The ArrayBufferView class used for the CPU-side buffer.
   */
  public bufferClass: any;

  /**
   * Maximum number of logical items that can be stored in this texture.
   *
   * The value of `numItems` never exceeds this limit.
   */
  public maxItems: number;

  /**
   * Texture format (e.g., `gl.RGBA`, `gl.RGBA_INTEGER`).
   */
  public format: number;

 /**
   * Texture data type (e.g., `gl.UNSIGNED_BYTE`, `gl.UNSIGNED_INT`, `gl.FLOAT`).
   */
  public type: number;

  /**
   * Texture internal format (e.g., `gl.RGBA8`, `gl.RGBA32UI`, `gl.RGBA32F`).
   */
  public internalFormat: number;

  /**
   * Size in bytes of a single logical item stored in the data texture.
   */
  public itemSizeInBytes: number;

  /**
   * Number of texels occupied by a single logical item in the data texture.
   */
  public texelsPerItem: number;

  /**
   * Number of individual elements (e.g., floats, uint32s) stored per texel in the data texture.
   */
  public elementsPerTexel: number;

  /**
   * Number of individual elements (e.g., floats, uint32s) stored per logical item in this data texture.
   */
  public elementsPerItem: number;

  /**
   * Backend function to get the number of logical items currently stored in this texture.
   * @private
   */
  private _getNumItems: () => number;

  /**
   * Gets the number of logical items currently stored in this texture.
   */
  public get numItems(): number {
    return this._getNumItems();
  }

  /**
   * Gets the used capacity in bytes of the data texture.
   */
  public getUsedBytes(): number {
    return this.numItems * this.itemSizeInBytes;
  }

  /**
   * Gets the total capacity in bytes of the data texture.
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
   * Enables debug event emission for this data texture.
   */
  public debugging: boolean = true;

  /**
   * Emitted when the CPU-side buffer for this texture has changed and been uploaded to the GPU.
   *
   * This event is intended for debugging tools and monitoring UIs; it is only
   * emitted when {@link debugging} is enabled.
   */
  public onUpdated = new EventEmitter(new EventDispatcher<DataTexture, undefined>());

  /**
   * @internal
   */
  constructor(params: {
    gl: WebGL2RenderingContext;
    description: string;
    itemSizeInBytes: number;
    texelsPerItem: number,
    elementsPerTexel: number
    internalFormat: number;
    format: number;
    type: number;
    maxItems: number;
    width: number;
    getNumItems: () => number;
  }) {
    this.gl = params.gl;
    this.description = params.description;
    this.itemSizeInBytes = params.itemSizeInBytes;
    this.texelsPerItem = params.texelsPerItem;
    this.elementsPerTexel = params.elementsPerTexel;
    this.elementsPerItem = this.texelsPerItem * this.elementsPerTexel;
    this.maxItems = params.maxItems;
    this._getNumItems = params.getNumItems;
    this.format = params.format;
    this.type = params.type;
    this.internalFormat = params.internalFormat;
    this.width = params.width;
    this.height = Math.max(1, Math.ceil(this.maxItems / this.width));
    switch (this.type) {
      case this.gl.UNSIGNED_BYTE:
        this.bufferClass = Uint8Array;
        break;
      case this.gl.UNSIGNED_INT:
        this.bufferClass = Uint32Array;
        break;
      case this.gl.UNSIGNED_SHORT:
        this.bufferClass = Uint16Array;
        break;
      case this.gl.FLOAT:
      default:
        this.bufferClass = Float32Array;
        break;
    }
  }

  /**
   * Allocates the CPU-side buffer and the GPU texture.
   * @internal
   */
  public allocate(): SDKResult<void> {
    this.buffer = new this.bufferClass(this.width * this.height * this.elementsPerTexel);
    return this._allocateTexture(false);
  }

  private _allocateTexture(uploadBuffer: boolean):SDKResult<void>{
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) {
      return {
        ok: false,
        type:SDKErrorType.InitializationFailed,
        error: `[${this.constructor.name}._allocateTexture]: Texture creation failed`,
      };
    }
    this.texture = tex;
    try {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texStorage2D(gl.TEXTURE_2D, 1, this.internalFormat, this.width, this.height);
      if (uploadBuffer) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, this.format, this.type,this.buffer);
        this.cancelUploads();
      }
      gl.bindTexture(gl.TEXTURE_2D, null);
      return {ok: true, value: undefined};
    } catch (e) {
      gl.deleteTexture(tex);
      this.cancelUploads();
      this.texture = null;
      return {
        ok: false,
        type:SDKErrorType.InitializationFailed,
        error: `[${this.constructor.name}._allocateTexture]: Exception during texture allocation: ${e}`,
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
   * Cancels any pending uploads to the GPU.
   * @internal
   */
  protected abstract cancelUploads(): void;

  /**
   * Handles WebGL context restoration by reallocating the texture.
   * @internal
   */
  public webglContextRestored(): SDKResult<void> {
    return this._allocateTexture(true);
  }

  /**
   * Uploads any changes in the CPU-side buffer to the GPU texture.
   * @return `true` if any data was uploaded; `false` if there were no changes to upload.
   * @internal
   */
  public abstract uploadChanges(): boolean;

  /**
   * Notifies listeners that the data texture has been updated.
   * @internal
   */
  protected notifyUpdated(): void {
    if (this.debugging) {
      this.onUpdated.dispatch(this, undefined);
    }
  }

  /**
   * Frees GPU resources associated with this data texture.
   * @internal
   */
  public destroy(): void {
    if (this.texture) {
      this.buffer = null;
      this.gl?.deleteTexture(this.texture);
      this.gl = null;
    }
  }
}
