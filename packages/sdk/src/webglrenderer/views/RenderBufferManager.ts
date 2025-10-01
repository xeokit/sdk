import {WebGLRenderBuffer} from "../../webglutils";

/**
 * Manages WebGL draw buffers .
 *
 * @private
 */
export class RenderBufferManager {

  /**
   * The WebGL2 rendering context.
   * @type {WebGL2RenderingContext}
   */
  private _gl: WebGL2RenderingContext;

  /**
   * A collection of basic draw buffers, keyed by their unique IDs.
   * @type {{ [key: string]: WebGLRenderBuffer }}
   */
  private _renderBuffersBasic: { [key: string]: WebGLRenderBuffer };

  /**
   * A collection of scaled draw buffers, keyed by their unique IDs.
   */
  private _renderBuffersScaled: { [key: string]: WebGLRenderBuffer };

  /**
   * The HTML canvas element associated with the WebGL context.
   */
  private _webglCanvas: HTMLCanvasElement;

  /**
   * Creates an instance of `RenderBufferManager`.
   *
   * @param {WebGL2RenderingContext} gl - The WebGL2 rendering context.
   * @param {HTMLCanvasElement} webglCanvas - The HTML canvas element associated with the WebGL context.
   */
  constructor(gl: WebGL2RenderingContext, webglCanvas: HTMLCanvasElement) {
    this._gl = gl;
    this._webglCanvas = webglCanvas;
    this._renderBuffersBasic = {};
    this._renderBuffersScaled = {};
  }

  /**
   * Retrieves a draw _buffer by its ID, creating it if it does not exist.
   *
   * @param {string} id - The unique identifier for the draw _buffer.
   * @param {Object} [options] - Optional configuration for the draw _buffer.
   * @param {boolean} options.depthTexture - Whether the draw _buffer includes a depth texture.
   * @param {number[]} [options.size] - The size of the draw _buffer, specified as `[width, height]`.
   * @returns {WebGLRenderBuffer} The requested or newly created draw _buffer.
   */
  getRenderBuffer(id: string, options?: { depthTexture: boolean; size?: number[] }) {
    const renderBuffers = this._renderBuffersBasic; // Currently only basic buffers are used
    let renderBuffer = renderBuffers[id];
    if (!renderBuffer) {
      renderBuffer = new WebGLRenderBuffer(this._webglCanvas, this._gl, options);
      renderBuffers[id] = renderBuffer;
    } else {
      if (options && options.size) {
        renderBuffer.setSize(options.size);
      }
    }
    return renderBuffer;
  }

  /**
   * Destroys all managed draw buffers, releasing their associated WebGL resources.
   */
  destroy() {
    for (const id in this._renderBuffersBasic) {
      this._renderBuffersBasic[id].destroy();
    }
    for (const id in this._renderBuffersScaled) {
      this._renderBuffersScaled[id].destroy();
    }
  }
}
