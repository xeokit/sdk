import type {DrawOp} from "./DrawOp";

/**
 * Collection of WebGPU draw operations for a primitive type, indexed by render
 * pass.
 *
 * @internal
 */
export interface RenderPassDrawOps {
  depthPrepass?: DrawOp;
  opaque?: DrawOp;
  transparent?: DrawOp;
  edges?: DrawOp;
  sectionPlaneCaps?: DrawOp;
  stencilMaskFront?: DrawOp;
  stencilMaskBack?: DrawOp;
  pick?: DrawOp;
  snapVertex?: DrawOp;
  snapEdge?: DrawOp;
}
