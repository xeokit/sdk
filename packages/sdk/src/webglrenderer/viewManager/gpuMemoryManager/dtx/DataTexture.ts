import {EventEmitter} from "../../../../core";
import {EventDispatcher} from "strongly-typed-events";

/**
 * DataTexture
 */
export abstract class DataTexture {

  /**
   * Description of the data stored in the texture.
   */
  public description: string = "";

  /**
   * The WebGL texture.
   */
  public texture: WebGLTexture;

  /**
   * The width of the texture.
   */
  public width: number;

  /**
   * The height of the texture.
   */
  public height: number;

  /**
   * The backing buffer.
   */
  public buffer: any;

  /**
   * Maximum number of items stored in the texture.
   */
  public maxItems: number;

  /**
   * Set true to enable debugging events.
   */
  public debugging: boolean = false;

  /**
   * Event fired when the buffer is updated.
   */
  public onBufferUpdated = new EventEmitter(new EventDispatcher<DataTexture, undefined>());

  /**
   * @private
   */
  constructor() {
  }

  /**
   * Called by subclasses when the buffer is updated.
   */
  protected bufferUpdated() {
    if (this.debugging) {
      this.onBufferUpdated.dispatch(this, undefined);
    }
  }
  //
  // abstract getAllocatedBytes() : number;
  //
  // abstract getUsedBytes(): number;
  //
  /**
   * Reads the data record at the given texel coordinates.
   * The record may span multiple texels depending on the data layout. In this case,
   * the implementation should return the full record.
   */
  public abstract readAtTexel(x: number, y: number): any;

  /**
   * Gets the data record at the given index.
   */
  public abstract getItem(index: number): any;
}
