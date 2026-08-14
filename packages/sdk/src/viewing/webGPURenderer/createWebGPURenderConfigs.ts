import {type WebGPURenderConfigs} from "./WebGPURenderConfigs";

/**
 * Generates WebGPU render pass orchestration configuration values.
 */
export function createWebGPURenderConfigs(user: Partial<WebGPURenderConfigs> = {}): WebGPURenderConfigs {
  return {
    depthPrepass: user.depthPrepass ?? true,
    edges: user.edges ?? true,
    gpuTimestamps: user.gpuTimestamps ?? false,
    transparentSortStrategy: user.transparentSortStrategy ?? "segment"
  };
}
