import type {SpaceGraphEdge} from "./SpaceGraphEdge";
import type {SpaceGraphNode} from "./SpaceGraphNode";


/**
 * Building-scale connectivity graph: rooms as nodes, doors /
 * openings as edges. The output of every {@link SpaceExtractor}
 * and the input to every {@link ViewpointSampler} /
 * {@link TourPlanner}.
 *
 * Implementations should ensure each node's
 * {@link SpaceGraphNode.edges} array references the same instances
 * that appear in {@link edges}, so adjacency walks stay O(degree)
 * without scanning the full edge list.
 */
export interface SpaceGraph {

  /** All spaces in the graph. */
  nodes: ReadonlyArray<SpaceGraphNode>;

  /** All portals in the graph. */
  edges: ReadonlyArray<SpaceGraphEdge>;

  /** O(1) node lookup by {@link SpaceGraphNode.id}. */
  nodesById: ReadonlyMap<string, SpaceGraphNode>;
}
