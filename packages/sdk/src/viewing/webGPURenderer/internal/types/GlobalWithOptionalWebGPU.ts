import type {WebGPUNavigatorLike} from "./WebGPUNavigatorLike";

export type GlobalWithOptionalWebGPU = typeof globalThis & {
  navigator?: {
    gpu?: WebGPUNavigatorLike;
  };
};
