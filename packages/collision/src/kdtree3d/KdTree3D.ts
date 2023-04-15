import {containsAABB3, expandAABB3, containsAABB2Point2} from "@xeokit/math/src/boundaries";
import {FloatArrayParam, IntArrayParam} from "@xeokit/math/math";


const MAX_KD_TREE_DEPTH = 10; // Increase if greater precision needed
const kdTreeDimLength = new Float32Array(3);

/**
 * Binds an item to a {@link KdNode3D}.
 */
export interface KdItem3D {

    /**
     * A unique, sequential numeric ID for this KDItem within its KdTree3D.
     */
    index: number;

    /**
     * The item stored in this KDItem.
     */
    item: any;
}

/**
 * A node in a {@link KdTree3D}.
 */
export interface KdNode3D {

    /**
     * A unique, sequential numeric ID for this KDNode within its KdTree3D.
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
    left?: KdNode3D;

    /**
     * The right KDNode.
     */
    right?: KdNode3D;

    /**
     * The {@link KdItem3D | KDItems} stored in this KDNode.
     */
    items?: KdItem3D[];
}

/**
 * Parameters for creating a {@link KdTree3D}.
 */
export interface KdTree3DParams {

    /**
     * The boundary of all the {@link KdNode3D | KDNodes} we'll add to this KdTree3D.
     */
    aabb: FloatArrayParam;

    /**
     * Maximum depth of the kd-tree. This is `10` by default.
     */
    maxDepth?: number;
}

/**
 * A static k-d tree that organizes anything that has a boundary for
 * efficient 3D World-space boundary and frustm searches.
 *
 * See {@link "@xeokit/collision/kdtree3d"} for usage.
 */
export class KdTree3D {

    #root: KdNode3D;
    #maxDepth: any;
    #numNodes: number;
    #numObjects: number;

    /**
     * Creates a new KdTree3D.
     *
     * @param params
     */
    constructor(params?: KdTree3DParams) {
        this.#maxDepth = params?.maxDepth || MAX_KD_TREE_DEPTH;
        this.#root = {
            index: 0,
            aabb: params.aabb.slice()
        };
        this.#numNodes = 0;
    }

    get root(): KdNode3D {
        return this.#root;
    }

    insertItem(item: any, aabb: FloatArrayParam) {
        this.#insertItem(this.#root, <KdItem3D>{index: this.#numObjects++, item}, aabb, 1)
    }

    #insertItem(node: KdNode3D, item: KdItem3D, aabb: FloatArrayParam, depth: number) {
        if (depth >= this.#maxDepth) {
            node.items = node.items || [];
            node.items.push(item);
            expandAABB3(node.aabb, aabb);
            return;
        }
        if (node.left) {
            if (containsAABB3(node.left.aabb, aabb)) {
                this.#insertItem(node.left, item, aabb, depth + 1);
                return;
            }
        }
        if (node.right) {
            if (containsAABB3(node.right.aabb, aabb)) {
                this.#insertItem(node.right, item, aabb, depth + 1);
                return;
            }
        }
        const nodeAABB = node.aabb;
        kdTreeDimLength[0] = nodeAABB[3] - nodeAABB[0];
        kdTreeDimLength[1] = nodeAABB[4] - nodeAABB[1];
        kdTreeDimLength[2] = nodeAABB[5] - nodeAABB[2];
        let dim = 0;
        if (kdTreeDimLength[1] > kdTreeDimLength[dim]) {
            dim = 1;
        }
        if (kdTreeDimLength[2] > kdTreeDimLength[dim]) {
            dim = 2;
        }
        if (!node.left) {
            const aabbLeft = nodeAABB.slice();
            aabbLeft[dim + 3] = ((nodeAABB[dim] + nodeAABB[dim + 3]) / 2.0);
            node.left = {
                index: this.#numNodes++,
                aabb: aabbLeft
            };
            if (containsAABB3(aabbLeft, aabb)) {
                this.#insertItem(node.left, item, aabb, depth + 1);
                return;
            }
        }
        if (!node.right) {
            const aabbRight = nodeAABB.slice();
            aabbRight[dim] = ((nodeAABB[dim] + nodeAABB[dim + 3]) / 2.0);
            node.right = {
                index: this.#numNodes++,
                aabb: aabbRight
            };
            if (containsAABB3(aabbRight, aabb)) {
                this.#insertItem(node.right, item, aabb, depth + 1);
                return;
            }
        }
        node.items = node.items || [];
        node.items.push(item);
        expandAABB3(node.aabb, aabb);
    }
}
