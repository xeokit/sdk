import {FloatArrayParam} from "@xeokit/math/math";
import {SceneObject} from "@xeokit/scene";
import {testAABB3IntersectsAABB3, collapseAABB3, createAABB3, INTERSECT, OUTSIDE} from "@xeokit/math/boundaries";
import {KDTree} from "./KDTree";
import {KDNode} from "./KDNode";
import {SDKError} from "@xeokit/core/components";

/**
 * Tracks changes in intersection status of {@link @xeokit/scene!SceneObject | SceneObjects} in a {@link KDTree} with respect to
 * a 3D World-space axis-aligned bounding box (AABB).
 *
 * See {@link "@xeokit/kdtree"} for usage.
 */
export class KDTreeAABBDeltasQuery {

    /**
     * The {@link KDTree} to query.
     */
    public readonly kdTree: KDTree;

    /**
     * The 3D World-space axis-aligned bounding box (AABB).
     */
    #aabb: FloatArrayParam;

    /**
     * {@link @xeokit/scene!SceneObject | SceneObjects} that intersect the 3D World-space axis-aligned bounding box in {@link aabb}.
     *
     * This is updated after each call to {@link doQuery}.
     */
    public readonly objects: SceneObject[];

    /**
     * Intersection state of each {@link SceneObject} in {@link objects}.
     *
     * This is updated after each call to {@link doQuery}.
     *
     * Each values can be one of:
     *
     * * {@link @xeokit/math/boundaries!INTERSECT | INTERSECT}
     * * {@link @xeokit/math/boundaries!OUTSIDE | OUTSIDE}
     * * {@link @xeokit/math/boundaries!INSIDE | INSIDE}
     */
    public objectIntersectionStates: number[];

    #lastNodeIntersectionStates: number[];
    #lastObjectIntersectionStates: number[];
    #onBuilt: () => void;
    #destroyed: boolean;

    /**
     * Creates a new KDTreeAABBDeltasQuery
     */
    constructor(params: {
        kdTree: KDTree,
        aabb?: FloatArrayParam
    }) {

        this.kdTree = params.kdTree;
        this.#aabb = createAABB3(params.aabb);
        this.objects = [];
        this.objectIntersectionStates = null;

        this.#lastNodeIntersectionStates = [];
        this.#lastObjectIntersectionStates = [];
        this.#onBuilt = this.kdTree.onBuilt.sub(() => {
            this.#lastNodeIntersectionStates = [];
            this.#lastObjectIntersectionStates = [];
        });
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
     * Executes this KDTreeAABBDeltasQuery.
     */
    doQuery(): SDKError | void {
        if (this.#destroyed) {
            return new SDKError("KDTreeAABBDeltasQuery already destroyed");
        }
        this.objects.length = 0;
        this.objectIntersectionStates.length = 0;
        this.#queryNode(this.kdTree.root, INTERSECT);
    }

    /**
     * Destroys this KDTreeAABBDeltasQuery.
     */
    destroy(): SDKError | void {
        if (this.#destroyed) {
            return new SDKError("KDTreeAABBDeltasQuery already destroyed");
        }
        this.kdTree.onBuilt.unsub(this.#onBuilt);
        this.#destroyed = true;
    }

    #queryNode(node: KDNode, intersectionState: number) {
        if (intersectionState === OUTSIDE && this.#lastNodeIntersectionStates[node.index] === intersectionState) {
            return;
        }
        if (intersectionState !== OUTSIDE) {
            intersectionState = testAABB3IntersectsAABB3(this.#aabb, node.aabb);
        }
        this.#lastNodeIntersectionStates[node.index] = intersectionState;
        const objects = node.objects;
        if (objects && objects.length > 0) {
            for (let i = 0, len = objects.length; i < len; i++) {
                const kdObject = objects[i];
                const sceneObject = kdObject.object;
                const objectIntersectionState = testAABB3IntersectsAABB3(this.#aabb, sceneObject.aabb);

                if (this.#lastObjectIntersectionStates[kdObject.index] !== objectIntersectionState) {
                    this.#lastObjectIntersectionStates[kdObject.index] = objectIntersectionState;
                    this.objects.push(sceneObject);
                    this.objectIntersectionStates.push(objectIntersectionState);
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

