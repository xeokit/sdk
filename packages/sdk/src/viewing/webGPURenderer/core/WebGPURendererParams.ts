import type {Viewer} from "../../viewer";
import type {
  WebGPUAdapterLike,
  WebGPUCanvasAlphaMode,
  WebGPUDeviceDescriptor,
  WebGPUDeviceLike,
  WebGPURequestAdapterOptions
} from "./types";

export * from "./types";

/**
 * Configuration for {@link WebGPURenderer}.
 */
export interface WebGPURendererParams {
  /**
   * Viewer to attach during construction.
   *
   * When no `device` is supplied, attachment still returns
   * {@link base!core.SDKErrorType.NotSupported}; use
   * {@link WebGPURenderer.create} to request a device first.
   */
  viewer?: Viewer;

  /**
   * Enables renderer error logging.
   *
   * Default value is `true`.
   */
  logging?: boolean;

  /**
   * Adapter used by {@link WebGPURenderer.create}. Ignored by the synchronous
   * constructor because `GPUAdapter.requestDevice` is asynchronous.
   */
  adapter?: WebGPUAdapterLike;

  /**
   * Pre-created WebGPU device.
   *
   * Supplying this allows the synchronous {@link WebGPURenderer.attachViewer}
   * method to satisfy the backend-neutral `Renderer` contract.
   */
  device?: WebGPUDeviceLike;

  /**
   * Descriptor used by {@link WebGPURenderer.create} when requesting a device.
   */
  deviceDescriptor?: WebGPUDeviceDescriptor;

  /**
   * Options used by {@link WebGPURenderer.create} when requesting an adapter.
   */
  requestAdapterOptions?: WebGPURequestAdapterOptions;

  /**
   * Canvas texture format. Defaults to `navigator.gpu.getPreferredCanvasFormat()`
   * when available, otherwise `bgra8unorm`.
   */
  contextFormat?: string;

  /**
   * Optional alpha mode override for configured view canvases.
   *
   * By default transparent views use `premultiplied`; opaque views use `opaque`.
   */
  alphaMode?: WebGPUCanvasAlphaMode;

  /**
   * Whether {@link WebGPURenderer.destroy} should call `device.destroy()`.
   *
   * Defaults to `false` for injected devices and `true` for devices acquired by
   * {@link WebGPURenderer.create}.
   */
  destroyDeviceOnDestroy?: boolean;
}
