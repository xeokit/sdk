import {SceneObject} from "@xeokit/scene";
import {Frustum, frustumIntersectsAABB3, INTERSECT, OUTSIDE} from "@xeokit/math/boundaries";
import {KDTree} from "./KDTree";
import {KDNode} from "./KDNode";
import {SDKError} from "@xeokit/core/components";

/**
 * Tracks changes in intersection status of {@link @xeokit/scene!SceneObject | SceneObjects} in a {@link KDTree} with respect to
 * a 3D World-space {@link @xeokit/math/boundaries!Frustum | Frustum}.
 *
 * See {@link "@xeokit/kdtree"} for usage.
 */
export class KDTreeFrustumDeltasQuery {

    /**
     * The {@link KDTree} to query.
     */
    public readonly kdTree: KDTree;

    /**
     * The 3D World-space {@link @xeokit/math/boundaries!Frustum | Frustum}.
     */
    public frustum: Frustum;

    /**
     * {@link @xeokit/scene!SceneObject | SceneObjects} that intersect the 3D World-space {@link @xeokit/math/boundaries!Frustum | Frustum} in {@link frustum}.
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
     * Creates a new KDTreeFrustumDeltasQuery
     */
    constructor(params: { kdTree: KDTree, frustum?: Frustum }) {
        this.kdTree = params.kdTree;
        this.frustum = params.frustum || new Frustum();
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
     * Executes this KDTreeFrustumDeltasQuery.
     */
    doQuery(): SDKError | void {
        if (this.#destroyed) {
            return new SDKError("KDTreeFrustumDeltasQuery already destroyed");
        }
        this.objects.length = 0;
        this.objectIntersectionStates.length = 0;
        this.#queryNode(this.kdTree.root, INTERSECT);
    }

    /**
     * Destroys this KDTreeFrustumDeltasQuery.
     */
    destroy(): SDKError | void {
        if (this.#destroyed) {
            return new SDKError("KDTreeFrustumDeltasQuery already destroyed");
        }
        this.kdTree.onBuilt.unsub(this.#onBuilt);
        this.#destroyed = true;
    }

    #queryNode(node: KDNode, intersectionState: number) {
        if (intersectionState === OUTSIDE && this.#lastNodeIntersectionStates[node.index] === intersectionState) {
            return;
        }
        if (intersectionState !== OUTSIDE) {
            intersectionState = frustumIntersectsAABB3(this.frustum, node.aabb);
        }
        this.#lastNodeIntersectionStates[node.index] = intersectionState;
        const objects = node.objects;
        if (objects && objects.length > 0) {
            for (let i = 0, len = objects.length; i < len; i++) {
                const kdObject = objects[i];
                const sceneObject = kdObject.object;
                const objectIntersectionState = frustumIntersectsAABB3(this.frustum, sceneObject.aabb);
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

