import type {FloatArrayParam} from "@xeokit/math";

/**
 * Parameters for creating a {@link KdTree3}.
 *
 * See {@link "@xeokit/kdtree3"} for usage.
 */
export interface KdTree3Params {

    /**
     * The boundary of all the {@link KdNode3 | KDNodes} we'll add to this KdTree3.
     */
    aabb: FloatArrayParam;

    /**
     * Maximum depth of the kd-tree. This is `10` by default.
     */
    maxDepth?: number;
}