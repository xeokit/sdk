import type {FloatArrayParam, IntArrayParam} from "@xeokit/math";
import {containsAABB2} from "@xeokit/boundaries";

const MAX_KD_TREE_DEPTH = 10; // Increase if greater precision needed
const kdTreeDimLength = new Float32Array(2);

/**
 * An item stored in a 2D k-d tree.
 *
 * See {@link "@xeokit/kdtree2"} for usage.
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
 * See {@link "@xeokit/kdtree2"} for usage.
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
 * See {@link "@xeokit/kdtree2"} for usage.
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
 * See {@link "@xeokit/kdtree2"} for usage.
 */
export class KdTree2 {

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
    constructor(params?: KdTree2DParams) {
        this.maxDepth = params?.maxDepth || MAX_KD_TREE_DEPTH;

        this.root = {
            // @ts-ignore
            aabb: params.aabb.slice()
        };
    }

    /**
     * Inserts a bounded item into this 2D k-d tree.
     *
     * @param item
     * @param aabb
     */
    insertItem(item: any, aabb: IntArrayParam) {
        this.#insertItem(this.root, <KdItem2D>{item}, aabb, 1)
    }

    #insertItem(node: KdNode2D, item: KdItem2D, aabb: IntArrayParam, depth: number) {
        if (depth >= this.maxDepth) {
            node.items = node.items || [];
            node.items.push(item);
            return;
        }
        if (node.left) {
            if (containsAABB2(node.left.aabb, aabb)) {
                this.#insertItem(node.left, item, aabb, depth + 1);
                return;
            }
        }
        if (node.right) {
            if (containsAABB2(node.right.aabb, aabb)) {
                this.#insertItem(node.right, item, aabb, depth + 1);
                return;
            }
        }
        const nodeAABB = node.aabb;
        kdTreeDimLength[0] = nodeAABB[2] - nodeAABB[0];
        kdTreeDimLength[1] = nodeAABB[3] - nodeAABB[1];
        let dim = 0;
        if (kdTreeDimLength[1] > kdTreeDimLength[dim]) {
            dim = 1;
        }
        if (!node.left) {
            const aabbLeft = nodeAABB.slice();
            aabbLeft[dim + 2] = ((nodeAABB[dim] + nodeAABB[dim + 2]) / 2.0);
            node.left = {
                aabb: aabbLeft
            };
            if (containsAABB2(aabbLeft, aabb)) {
                this.#insertItem(node.left, item, aabb, depth + 1);
                return;
            }
        }
        if (!node.right) {
            const aabbRight = nodeAABB.slice();
            aabbRight[dim] = ((nodeAABB[dim] + nodeAABB[dim + 2]) / 2.0);
            node.right = {
                aabb: aabbRight
            };
            if (containsAABB2(aabbRight, aabb)) {
                this.#insertItem(node.right, item, aabb, depth + 1);
                return;
            }
        }
        node.items = node.items || [];
        node.items.push(item);
    }
}
