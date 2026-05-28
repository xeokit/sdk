import type {ViewpointGraphNode} from "./ViewpointGraphNode";


/**
 * Collection of candidate viewpoints across every space in the
 * source {@link SpaceGraph}. Produced by a {@link ViewpointSampler}
 * and consumed by a {@link TourPlanner}.
 *
 * `nodesBySpaceId` lets the tour planner pull the candidate set
 * for each space without rescanning the flat list — most planners
 * pick one viewpoint per visited space, so the per-space bucket is
 * the natural access pattern.
 */
export interface ViewpointGraph {

  /** All viewpoints across all spaces. */
  nodes: ReadonlyArray<ViewpointGraphNode>;

  /**
   * Viewpoints grouped by their owning {@link SpaceGraphNode.id}.
   * Empty arrays are valid — some spaces may have no usable
   * viewpoints (e.g. tiny utility closets the sampler couldn't
   * place a clearance-respecting camera in).
   */
  nodesBySpaceId: ReadonlyMap<string, ReadonlyArray<ViewpointGraphNode>>;
}
