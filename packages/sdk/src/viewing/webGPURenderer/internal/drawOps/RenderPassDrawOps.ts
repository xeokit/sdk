import type {WebGPUDrawOp} from "./WebGPUDrawOp";

/**
 * Collection of WebGPU draw operations for a primitive type, indexed by render
 * pass.
 *
 * @internal
 */
export interface RenderPassDrawOps {
  opaque?: WebGPUDrawOp;
  transparent?: WebGPUDrawOp;
  pick?: WebGPUDrawOp;
  snapVertex?: WebGPUDrawOp;
  snapEdge?: WebGPUDrawOp;
}
