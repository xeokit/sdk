import type {FloatArrayParam} from "@xeokit/math";
import type {KdItem3D} from "./KdItem3";

/**
 * A node in a {@link KdTree3}.
 *
 * See {@link "@xeokit/kdtree3"} for usage.
 */
export interface KdNode3 {

    /**
     * A unique, sequential numeric ID for this KDNode within its KdTree3.
     *
     * This is used by queries that cache intersection results for KDNodes.
     */
    index: number;

    /**
     * The axis-aligned World-space 3D boundary of this kd-tree node.
     */
    aabb: FloatArrayParam;

    /**
     * The left KDNode.
     */
    left?: KdNode3;

    /**
     * The right KDNode.
     */
    right?: KdNode3;

    /**
     * The {@link KdItem3D | KDItems} stored in this KDNode.
     */
    items?: KdItem3D[];
}