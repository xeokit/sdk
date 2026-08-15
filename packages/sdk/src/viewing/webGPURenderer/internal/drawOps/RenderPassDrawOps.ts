import type {DrawOp} from "./DrawOp";

/**
 * Collection of WebGPU draw operations for a primitive type, indexed by render
 * pass.
 *
 * @internal
 */
export interface RenderPassDrawOps {
  depthPrepass?: DrawOp;
  shadowDepth?: DrawOp;
  opaque?: DrawOp;
  transparent?: DrawOp;
  flatOpaque?: DrawOp;
  flatTransparent?: DrawOp;
  overlayOpaque?: DrawOp;
  overlayTransparent?: DrawOp;
  edges?: DrawOp;
  sectionPlaneCaps?: DrawOp;
  stencilMaskFront?: DrawOp;
  stencilMaskBack?: DrawOp;
  pick?: DrawOp;
  snapVertex?: DrawOp;
  snapEdge?: DrawOp;
}
