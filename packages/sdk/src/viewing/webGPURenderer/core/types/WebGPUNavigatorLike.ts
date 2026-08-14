import type {WebGPUAdapterLike} from "./WebGPUAdapterLike";

export interface WebGPUNavigatorLike {
  requestAdapter(options?: object): Promise<WebGPUAdapterLike | null>;
  getPreferredCanvasFormat?(): string;
}
