import type {WebGPUCanvasAlphaMode, WebGPUDeviceLike} from "../../core";
import type {WebGPUCanvasTextureLike} from "./CanvasTextureLike";

export interface WebGPUCanvasContextLike {
  configure(config: {
    device: WebGPUDeviceLike;
    format: string;
    alphaMode?: WebGPUCanvasAlphaMode;
  }): void;
  unconfigure?(): void;
  getCurrentTexture(): WebGPUCanvasTextureLike;
}
