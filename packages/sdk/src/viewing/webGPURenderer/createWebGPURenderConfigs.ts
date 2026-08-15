import {type WebGPURenderConfigs} from "./WebGPURenderConfigs";

/**
 * Generates WebGPU render pass orchestration configuration values.
 */
export function createWebGPURenderConfigs(user: Partial<WebGPURenderConfigs> = {}): WebGPURenderConfigs {
  return {
    depthPrepass: user.depthPrepass ?? true,
    logDepth: user.logDepth ?? false,
    edges: user.edges ?? true,
    triangleColorMode: user.triangleColorMode ?? "pbr",
    gpuTimestamps: user.gpuTimestamps ?? false,
    transparentSortStrategy: user.transparentSortStrategy ?? "segment"
  };
}
