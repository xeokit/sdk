import {Frustum, frustumIntersectsAABB3, INTERSECT, OUTSIDE} from "@xeokit/math/boundaries";
import {SceneObject} from "@xeokit/scene";
import {KDTree} from "./KDTree";
import {KDNode} from "./KDNode";
import {SDKError} from "@xeokit/core/components";
import {frustumIntersectsSceneObject} from "./frustumIntersectsSceneObject";

/**
 * Queries a {@link KDTree} for {@link @xeokit/scene!SceneObject | SceneObjects} that intersect a
 * 3D World-space {@link @xeokit/math/boundaries!Frustum | Frustum}.
 *
 * See {@link "@xeokit/kdtree"} for usage.
 */
export class KDTreeFrustumQuery {

    /**
     * The {@link KDTree} that this KDTreeFrustumQuery will query.
     */
    public readonly kdTree: KDTree;

    /**
     * The World-space 3D {@link @xeokit/math/boundaries!FrustumProjection | FrustumProjection} that this KDTreeFrustumQuery
     * tests for intersection with its {@link KDTree}.
     */
    public readonly frustum: Frustum;

    /**
     * Contains intersecting {@link @xeokit/scene!SceneObject | SceneObjects} found with the last call to {@link @doQuery}.
     */
    public readonly objects: SceneObject[];

    #destroyed: boolean;

    /**
     * Creates a new KDTreeFrustumQuery.
     */
    constructor(params: {
        kdTree: KDTree,
        frustum?: Frustum
    }) {
        this.kdTree = params.kdTree;
        this.frustum = params.frustum || new Frustum();
        this.objects = [];
        this.#destroyed = false;
    }

    /**
     * Executes this KDTreeFrustumQuery.
     */
    doQuery(): SDKError | void {
        if (this.#destroyed) {
            return new SDKError("KDTreeAABBQuery already destroyed");
        }
        this.objects.length = 0;
        this.#queryNode(this.kdTree.root, INTERSECT);
    }

    /**
     * Destroys this KDTreeAABBQuery.
     */
    destroy(): SDKError | void {
        if (this.#destroyed) {
            return new SDKError("KDTreeAABBQuery already destroyed");
        }
        this.#destroyed = true;
    }

    #queryNode(node: KDNode, intersectionState: number): void {
        if (intersectionState === OUTSIDE) {
            return;
        }
        intersectionState = frustumIntersectsAABB3(this.frustum, node.aabb);
        if (intersectionState === OUTSIDE) {
            return;
        }
        const objects = node.objects;
        if (objects && objects.length > 0) {
            for (let i = 0, len = objects.length; i < len; i++) {
                const kdObject = objects[i];
                const sceneObject = kdObject.object;
                const aabbIntersection = frustumIntersectsAABB3(this.frustum, sceneObject.aabb);
                if (aabbIntersection !== OUTSIDE) {
                    if (frustumIntersectsSceneObject(this.frustum, sceneObject)) {
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
