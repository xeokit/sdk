import { FloatArrayParam, IntArrayParam } from "@xeokit/math";
/**
 * An item stored in a 2D k-d tree.
 *
 * See {@link "@xeokit/collision/kdtree2"} for usage.
 */
export interface KdItem2D {
    /**
     * The item stored in this KdItem2D.
     */
    item: any;
}
/**
 * A 2D k-d tree node.
 *
 * See {@link "@xeokit/collision/kdtree2"} for usage.
 */
export interface KdNode2D {
    /**
     * The axis-aligned 2D boundary of this kd-tree node.
     */
    aabb: FloatArrayParam;
    /**
     * The left KD2Node.
     */
    left?: KdNode2D;
    /**
     * The right KD2Node.
     */
    right?: KdNode2D;
    /**
     * The {@link KdItem2D | KdItem2Ds} stored in this KD2Node.
     */
    items?: KdItem2D[];
}
/**
 * Parameters for creating a 2D k-d tree.
 *
 * See {@link "@xeokit/collision/kdtree2"} for usage.
 */
export interface KdTree2DParams {
    /**
     * The 2D boundary of all the nodes we'll add to this k-d tree.
     */
    aabb: FloatArrayParam;
    /**
     * Maximum depth of the 2D kd-tree.
     */
    maxDepth?: number;
}
/**
 * A static 2D k-d tree.
 *
 * See {@link "@xeokit/collision/kdtree2"} for usage.
 */
export declare class KdTree2 {
    #private;
    /**
     * The root node in this k-d tree.
     */
    readonly root: KdNode2D;
    /**
     * The maximum allowed depth of this 2D k-d tree.
     */
    readonly maxDepth: number;
    /**
     * Creates a new 2D k-d tree.
     *
     * @param params
     */
    constructor(params?: KdTree2DParams);
    /**
     * Inserts a bounded item into this 2D k-d tree.
     *
     * @param item
     * @param aabb
     */
    insertItem(item: any, aabb: IntArrayParam): void;
}
