import type {WebGPUDrawItem} from "./WebGPUDrawItem";

export interface WebGPURenderBins {
  normalDrawOpaque: WebGPUDrawItem[];
  normalFillTransparent: WebGPUDrawItem[];
}
