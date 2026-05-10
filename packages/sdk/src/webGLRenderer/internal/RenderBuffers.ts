import { WebGLRenderBuffer } from "../../webGLUtils";
import { RenderContext } from "./RenderContext";
import {View} from "../../viewer";

/**
 * Manages WebGL render buffers for a view.
 *
 * @internal
 */
export class RenderBuffers {

  private _renderContext: RenderContext;
  private _renderBuffersBasic: Record<string, WebGLRenderBuffer>;
  private _renderBuffersScaled: Record<string, WebGLRenderBuffer>;
  private _view: View;

  /**
   * Initializes the RenderBuffers.
   * @param renderContext Rendering context
   * @param view The associated view
   */
  constructor(renderContext: RenderContext, view: View) {
    if (!renderContext) {
      throw new Error("RenderContext is required to initialize RenderBuffers.");
    }
    this._renderContext = renderContext;
    this._view = view;
    this._renderBuffersBasic = {};
    this._renderBuffersScaled = {};
  }

  /**
   * Retrieves a render buffer by its ID, creating it if necessary.
   *
   * @param id Unique identifier for the render buffer
   * @param options Optional configuration
   * @param options.depthTexture Whether the buffer includes a depth texture
   * @param options.size Buffer size `[width, height]`
   * @returns The requested or newly created render buffer
   */
  getRenderBuffer(
      id: string,
      options?: {
        depthTexture?: boolean;
        size?: [number, number];
        depthTextureCompare?: boolean;
        colorFilter?: "linear" | "nearest";
      }
  ): WebGLRenderBuffer {
    if (!id || typeof id !== "string") {
      throw new Error("A valid string ID is required to retrieve a render buffer.");
    }

    const existingBuffer = this._renderBuffersBasic[id];
    if (existingBuffer) {
      if (options?.size) {
        existingBuffer.setSize(options.size);
      }
      return existingBuffer;
    }

    const newBuffer = new WebGLRenderBuffer(
        this._view.htmlElement as HTMLCanvasElement,
        this._renderContext.gl,
        {
          depthTexture: options?.depthTexture ?? false,
          depthTextureCompare: options?.depthTextureCompare ?? false,
          colorFilter: options?.colorFilter,
          size: options?.size,
        }
    );

    this._renderBuffersBasic[id] = newBuffer;
    return newBuffer;
  }

  /**
   * Destroys all managed render buffers, releasing their WebGL resources.
   */
  destroy(): void {
    for (const buffer of Object.values(this._renderBuffersBasic)) {
      buffer.destroy();
    }
    for (const buffer of Object.values(this._renderBuffersScaled)) {
      buffer.destroy();
    }
    this._renderContext = null;
    this._renderBuffersBasic = {};
    this._renderBuffersScaled = {};
  }
}
