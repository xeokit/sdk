import {FloatArrayParam} from "@xeokit/math/math";
import {
    testAABB3IntersectsAABB3,
    createAABB3,
    INTERSECT,
    OUTSIDE,
    testAABB3ContainsPoint3
} from "@xeokit/math/boundaries";
import {KDVerticesTree, KDVerticesNode} from "./KDVerticesTree";
import {SDKError} from "@xeokit/core/components";
/**
 * Queries a {@link KDVerticesTree} for {@link @xeokit/scene!SceneObject | SceneObjects} that intersect
 * a 3D World-space axis-aligned bounding box (AABB).
 *
 * See {@link "@xeokit/kdtree"} for usage.
 */
export class KDVerticesTreeAABBSearch {

    /**
     * The {@link KDVerticesTree} to query.
     */
    public readonly kdVerticesTree: KDVerticesTree;
    
    /**
     * Vertex positions that intersect the 3D World-space axis-aligned bounding box in {@link aabb}.
     *
     * This is updated after each call to {@link doQuery}.
     */
    public readonly vertices: FloatArrayParam[];
    
    /**
     * The 3D World-space axis-aligned bounding box (AABB).
     */
    #aabb: FloatArrayParam;
    
    #destroyed: boolean;

    /**
     * Creates a new KDVerticesTreeAABBSearch.
     */
    constructor(params: {
        kdVerticesTree: KDVerticesTree,
        aabb?: FloatArrayParam
    }) {
        this.kdVerticesTree = params.kdVerticesTree;
        this.#aabb = createAABB3(params.aabb);
        this.vertices = [];
        this.#destroyed = false;
    }

    /**
     * Gets the 3D World-space axis-aligned bounding box.
     */
    get aabb(): FloatArrayParam {
        return this.#aabb;
    }

    /**
     * Sets the 3D World-space axis-aligned bounding box.
     */
    set aabb(aabb: FloatArrayParam) {
        (<Float64Array>this.#aabb).set(aabb);
    }

    /**
     * Executes this KDVerticesTreeAABBSearch.
     */
    doQuery(): SDKError | void {
        if (this.#destroyed) {
            return new SDKError("KDVerticesTreeAABBSearch already destroyed");
        }
        this.vertices.length = 0;
        this.#queryNode(this.kdVerticesTree.root, INTERSECT);
    }

    /**
     * Destroys this KDVerticesTreeAABBSearch.
     */
    destroy(): SDKError | void {
        if (this.#destroyed) {
            return new SDKError("KDVerticesTreeAABBSearch already destroyed");
        }
        this.#destroyed = true;
    }

    #queryNode(node: KDVerticesNode, intersectionState: number) {
        if (intersectionState === OUTSIDE) {
            return;
        }
        intersectionState = testAABB3IntersectsAABB3(this.#aabb, node.aabb);
        if (intersectionState === OUTSIDE) {
            return;
        }
        const items = node.items;
        if (items && items.length > 0) {
            for (let i = 0, len = items.length; i < len; i++) {
                const item = items[i];
                if (testAABB3ContainsPoint3(node.aabb, item.position)) {
                    this.vertices.push(item.position);
                }
            }
        }
        if (node.left) {
            this.#queryNode(node.left, intersectionState);
        }
        if (node.right) {
            this.#queryNode(node.right, intersectionState);
        }
    }
}