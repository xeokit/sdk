import {FloatArrayParam} from "@xeokit/math/math";
import {SceneObject} from "@xeokit/scene";
import {testAABB3IntersectsAABB3, createAABB3, INTERSECT, OUTSIDE} from "@xeokit/math/boundaries";
import {KDObjectTree, KDObjectNode} from "./KDObjectTree";
import {SDKError} from "@xeokit/core/components";
import {testAABB3IntersectsSceneObject} from "./testAABB3IntersectsSceneObject";

/**
 * Queries a {@link KDObjectTree} for {@link @xeokit/scene!SceneObject | SceneObjects} that intersect
 * a 3D World-space axis-aligned bounding box (AABB).
 *
 * See {@link "@xeokit/kdtree"} for usage.
 */
export class KDObjectTreeAABBSearch {

    /**
     * The {@link KDObjectTree} to query.
     */
    public readonly kdTree: KDObjectTree;
    /**
     * {@link @xeokit/scene!SceneObject | SceneObjects} that intersect the 3D World-space axis-aligned bounding box in {@link aabb}.
     *
     * This is updated after each call to {@link doQuery}.
     */
    public readonly objects: SceneObject[];
    /**
     * The 3D World-space axis-aligned bounding box (AABB).
     */
    #aabb: FloatArrayParam;
    #destroyed: boolean;

    /**
     * Creates a new KDObjectTreeAABBSearch.
     */
    constructor(params: {
        kdTree: KDObjectTree,
        aabb?: FloatArrayParam
    }) {
        this.kdTree = params.kdTree;
        this.#aabb = createAABB3(params.aabb);
        this.objects = [];
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
     * Executes this KDObjectTreeAABBSearch.
     */
    doQuery(): SDKError | void {
        if (this.#destroyed) {
            return new SDKError("KDObjectTreeAABBSearch already destroyed");
        }
        this.objects.length = 0;
        this.#queryNode(this.kdTree.root, INTERSECT);
    }

    /**
     * Destroys this KDObjectTreeAABBSearch.
     */
    destroy(): SDKError | void {
        if (this.#destroyed) {
            return new SDKError("KDObjectTreeAABBSearch already destroyed");
        }
        this.#destroyed = true;
    }

    #queryNode(node: KDObjectNode, intersectionState: number) {
        if (intersectionState === OUTSIDE) {
            return;
        }
        intersectionState = testAABB3IntersectsAABB3(this.#aabb, node.aabb);
        if (intersectionState === OUTSIDE) {
            return;
        }
        const objects = node.objects;
        if (objects && objects.length > 0) {
            for (let i = 0, len = objects.length; i < len; i++) {
                const kdObject = objects[i];
                const sceneObject = kdObject.object;
                const aabbIntersection = testAABB3IntersectsAABB3(this.#aabb, sceneObject.aabb);
                if (aabbIntersection !== OUTSIDE) {
                    if (testAABB3IntersectsSceneObject(this.#aabb, sceneObject)) {
                        this.objects.push(sceneObject);
                    }
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