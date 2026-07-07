import type {WebGPUAdapterLike} from "../../core";

export interface WebGPUNavigatorLike {
  requestAdapter(options?: object): Promise<WebGPUAdapterLike | null>;
  getPreferredCanvasFormat?(): string;
}
