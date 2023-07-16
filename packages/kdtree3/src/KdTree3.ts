import {containsAABB3, expandAABB3} from "@xeokit/boundaries";
import type {FloatArrayParam} from "@xeokit/math";
import type {KdNode3} from "./KdNode3";
import type {KdItem3D} from "./KdItem3";
import type {KdTree3Params} from "./KdTree3Params";


const MAX_KD_TREE_DEPTH = 10; // Increase if greater precision needed
const kdTreeDimLength = new Float32Array(3);

/**
 * A static k-d tree that organizes anything that has a boundary for
 * efficient 3D World-space boundary and frustm searches.
 *
 * See {@link "@xeokit/kdtree3"} for usage.
 */
export class KdTree3 {

    #root: KdNode3;
    #maxDepth: any;
    #numNodes: number;
    #numObjects: number;

    /**
     * Creates a new KdTree3.
     *
     * @param params
     */
    constructor(params: KdTree3Params) {
        this.#maxDepth = params?.maxDepth || MAX_KD_TREE_DEPTH;
        this.#root = {
            index: 0,
            aabb: params.aabb.slice()
        };
        this.#numNodes = 0;
    }

    get root(): KdNode3 {
        return this.#root;
    }

    insertItem(item: any, aabb: FloatArrayParam) {
        this.#insertItem(this.#root, <KdItem3D>{index: this.#numObjects++, item}, aabb, 1)
    }

    #insertItem(node: KdNode3, item: KdItem3D, aabb: FloatArrayParam, depth: number) {
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
