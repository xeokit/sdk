import { EventEmitter } from "../../../../core";
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
 */
export abstract class DataTexture {
  /**
   * Human-readable description of the data stored in this texture.
   *
   * Intended for debugging UIs and diagnostics (e.g., displayed above inspectors).
   * Subclasses or owners should populate this with a concise explanation of the layout
   * and semantic meaning (e.g., “mesh matrices (Mat4, row-major), indexed by meshId”).
   */
  public description: string = "";

  /**
   * The underlying WebGL texture object.
   *
   * This is the GPU resource that is bound and sampled/loaded by shaders.
   */
  public texture: WebGLTexture;

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
   * Maximum number of logical items that can be stored in this texture.
   *
   * The value of `numItems` never exceeds this limit.
   */
  public maxItems: number;

  /**
   * Number of logical items currently stored in this texture.
   *
   * This number never exceeds {@link maxItems}.
   */
  public abstract get numItems(): number;

  /**
   * Gets the total capacity in bytes of the data texture.
   */
  public abstract getAllocatedBytes(): number;

  /**
   * Gets the number of currently used bytes in this data texture.
   */
  public abstract getUsedBytes(): number;

  /**
   * Timestamp (in milliseconds since epoch) of the last upload to GPU.
   *
   * This value is `0` until the first upload occurs.
   */
  public lastUploadTimeMS: number = 0;

  /**
   * Enables debug event emission for this texture.
   *
   * When `true`, calls to {@link notifyUpdated} will emit {@link onUpdated}.
   * Keep disabled in production paths if you want to avoid observer overhead.
   */
  public debugging: boolean = false;

  /**
   * Emitted when the CPU-side buffer for this texture has changed and (typically)
   * has been or will be uploaded to the GPU.
   *
   * This event is intended for debugging tools and monitoring UIs; it is only
   * emitted when {@link debugging} is enabled.
   */
  public onUpdated = new EventEmitter(new EventDispatcher<DataTexture, undefined>());

  /** @internal */
  constructor() {}

  /**
   * Notifies observers that the backing buffer has been updated.
   *
   * Subclasses should call this after mutating {@link buffer} (and/or after uploading
   * to {@link texture}). The event is only dispatched when {@link debugging} is enabled.
   */
  protected notifyUpdated(): void {
    if (this.debugging) {
      this.onUpdated.dispatch(this, undefined);
    }
  }

  /**
   * Decodes and returns the logical record at the given texel coordinates.
   *
   * The returned value is a decoded “record” suitable for debugging (often an object
   * or structured data). Depending on layout, a record may span multiple texels; in
   * that case implementations should return the complete record, not a partial view.
   *
   * @param x Texel X coordinate (0-based).
   * @param y Texel Y coordinate (0-based).
   */
  public abstract readAtTexel(x: number, y: number): any;

  /**
   * Decodes and returns the logical item at the given item index.
   *
   * This is the preferred API for debugging and tooling when the data layout is
   * item-oriented. Implementations define how indices map onto the underlying texel
   * storage.
   *
   * Implementations may throw if `index` is out of range.
   *
   * @param index Item index (0-based).
   */
  public abstract getItem(index: number): any;
}
