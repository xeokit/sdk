import {DrawOp} from "./DrawOp";

/**
 * Collection of draw operations for all render passes, for a specific primitive type.
 *
 * Each property represents a {@link DrawOp} used to render the given primitive type within a particular pass,
 * such as opaque, transparent, highlighted, selected, x-rayed, edge rendering, and picking.
 *
 * @internal
 */
export interface RenderPassDrawOps {

  /**
   * Draw operation for rendering opaque objects.
   */
  opaque?: DrawOp;

  /**
   * Draw operation for rendering opaque objects with SAO (Scalable Ambient Obscurance).
   */
  opaqueSAO?: DrawOp;

  /**
   * Draw operation for rendering opaque edges.
   */
  opaqueEdges?: DrawOp;

  /**
   * Draw operation for rendering transparent objects.
   */
  transparent?: DrawOp;

  /**
   * Draw operation for rendering transparent edges.
   */
  transparentEdges?: DrawOp;

  /**
   * Draw operation for rendering highlighted silhouettes.
   */
  highlighted?: DrawOp;

  /**
   * Draw operation for rendering selected silhouettes.
   */
  selected?: DrawOp;

  /**
   * Draw operation for rendering x-rayed silhouettes.
   */
  xrayed?: DrawOp;

  /**
   * Draw operation for rendering highlighted silhouette edges.
   */
  highlightedEdges?: DrawOp;

  /**
   * Draw operation for rendering selected silhouette edges.
   */
  selectedEdges?: DrawOp;

  /**
   * Draw operation for rendering x-rayed silhouette edges.
   */
  xrayedEdges?: DrawOp;

  /**
   * Draw operation for mesh picking (renders mesh IDs to pick buffer).
   */
  pick?: DrawOp;

  /**
   * Draw operation for depth picking (renders screen-space depths).
   */
  pickDepth?: DrawOp;
}
