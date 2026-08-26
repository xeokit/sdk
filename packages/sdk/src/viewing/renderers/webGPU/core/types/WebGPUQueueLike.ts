import type {WebGPUBufferLike} from "./WebGPUBufferLike";
import type {WebGPUTextureLike} from "./WebGPUTextureLike";

/**
 * Minimal WebGPU queue shape used by WebGPURenderer.
 */
export interface WebGPUQueueLike {
  submit(commandBuffers: unknown[]): void;
  writeBuffer(
    buffer: WebGPUBufferLike,
    bufferOffset: number,
    data: ArrayBuffer | ArrayBufferView,
    dataOffset?: number,
    size?: number
  ): void;
  writeTexture?(
    destination: {texture: WebGPUTextureLike; mipLevel?: number; origin?: object; aspect?: string},
    data: ArrayBuffer | ArrayBufferView,
    dataLayout: {offset?: number; bytesPerRow?: number; rowsPerImage?: number},
    size: {width: number; height: number; depthOrArrayLayers?: number}
  ): void;
  copyExternalImageToTexture?(
    source: {source: unknown; origin?: object; flipY?: boolean},
    destination: {texture: WebGPUTextureLike; mipLevel?: number; origin?: object; aspect?: string},
    copySize: {width: number; height: number; depthOrArrayLayers?: number}
  ): void;
}
