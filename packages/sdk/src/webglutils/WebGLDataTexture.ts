import type {WebGLAbstractTexture} from "./WebGLAbstractTexture";
import type {WebGLProgram} from "./WebGLProgram";
import type {WebGLSampler} from "./WebGLSampler";

/**
 * Represents a WebGL2 data texture for efficient GPU data storage and access.
 *
 * The `WebGLDataTexture` class provides a wrapper around a WebGL texture object,
 * enabling storage and management of data in a 2D texture format. It supports
 * binding, unbinding, and configuration of texture parameters for use in WebGL
 * rendering pipelines.
 *
 * ### Features:
 * - **Data Storage**: Stores arbitrary data in a 2D texture for GPU access.
 * - **Binding**: Supports binding to texture units and samplers.
 * - **Filtering**: Configures texture filtering and wrapping modes.
 * - **Lifecycle Management**: Handles texture creation, binding, and destruction.
 *
 * ### Usage:
 * - Create an instance with texture parameters and optional data.
 * - Bind the texture to a WebGL unit or sampler for rendering.
 * - Destroy the texture when no longer needed to free GPU resources.
 *
 * ### Methods:
 * - `bind(unit)`: Binds the texture to a specified texture unit.
 * - `unbind(unit)`: Unbinds the texture from the specified unit.
 * - `disableFiltering()`: Configures the texture for nearest-neighbor filtering.
 * - `destroy()`: Deletes the texture and releases GPU resources.
 *
 * ### Example:
 * ```typescript
 * const texture = new WebGLDataTexture({
 *   gl: webglContext,
 *   textureWidth: 512,
 *   textureHeight: 512,
 *   textureData: new Float32Array(512 * 512 * 4),
 *   format: gl.RGBA,
 *   type: gl.FLOAT
 * });
 *
 * texture.bind(0); // Bind to texture unit 0
 * texture.disableFiltering(); // Set nearest-neighbor filtering
 * texture.unbind(0); // Unbind from texture unit 0
 * texture.destroy(); // Clean up resources
 */
export class WebGLDataTexture implements WebGLAbstractTexture {

  gl?: WebGL2RenderingContext;
  texture?: WebGLTexture | null;
  textureWidth?: number;
  textureHeight?: number;
  format?: GLenum;
  type?: GLenum;
  textureData?: any;
  #onDestroyed?: Function;


  /**
   * Constructs a new WebGLDataTexture.
   * @param params
   */
  constructor(params: {
    gl?: WebGL2RenderingContext,
    texture?: WebGLTexture,
    textureWidth?: number,
    textureHeight?: number,
    textureData?: any,
    format?: GLenum,
    type?: GLenum,
    onDestroyed?: Function
  } = {}) {
    this.gl = params.gl;
    this.texture = params.texture;
    this.textureWidth = params.textureWidth;
    this.textureHeight = params.textureHeight;
    this.textureData = params.textureData;
    this.format = params.format;
    this.type = params.type;
    this.#onDestroyed = params.onDestroyed;
  }

  /**
   * Binds this WebGLDataTexture to the given {@link WebGLSampler}.
   * @param glProgram
   * @param sampler
   * @param unit
   */
  bindTexture(glProgram: WebGLProgram, sampler: WebGLSampler, unit: number) {
    if (!this.gl) {
      return;
    }
    sampler.bindTexture(this, unit);
  }

  /**
   * Unbinds this WebGLDataTexture from whichever {@link WebGLSampler} it's currently bound to, if any.
   * @param unit
   */
  bind(unit: number): boolean {
    if (!this.gl || !this.texture) {
      return false;
    }
    // @ts-ignore
    this.gl.activeTexture(this.gl["TEXTURE" + unit]);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    return true;
  }

  disableFiltering(): void {
    if (!this.gl) {
      return;
    }
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
  }

  unbind(unit: number) {
    if (!this.gl) {
      return;
    }
    // This `unbind` method is ignored at the moment to allow avoiding to rebind same texture already bound to a texture unit.

    // this.gl.activeTexture(this.state.gl["TEXTURE" + unit]);
    // this.gl.bindTexture(this.state.gl.TEXTURE_2D, null);
  }

  destroy() {
    if (!this.gl || !this.texture) {
      return;
    }
    this.gl.deleteTexture(this.texture);
    this.texture = null;
    if (this.#onDestroyed) {
      this.#onDestroyed();
    }
  }
}
