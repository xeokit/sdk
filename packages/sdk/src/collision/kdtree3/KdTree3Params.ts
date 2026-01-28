
import type {AABB3} from "../../math/boundaries";

/**
 * Parameters for creating a {@link KdTree3}.
 *
 * See {@link kdtree3 | @xeokit/sdk/kdtree3} for usage.
 */
export interface KdTree3Params {

  /**
   * The boundary of all the {@link KdNode3 | KDNodes} we'll add to this KdTree3.
   */
  aabb: AABB3;

  /**
   * Maximum depth of the kd-tree. This is `10` by default.
   */
  maxDepth?: number;
}
