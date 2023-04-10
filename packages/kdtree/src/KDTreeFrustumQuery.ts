import {Frustum, frustumIntersectsAABB3, INTERSECT, OUTSIDE} from "@xeokit/math/boundaries";
import {SceneObject} from "@xeokit/scene";
import {KDObjectTree} from "./KDObjectTree";
import {KDObjectNode} from "./KDObjectNode";
import {SDKError} from "@xeokit/core/components";
import {testFrustumIntersectsSceneObject} from "./testFrustumIntersectsSceneObject";

/**
 * Queries a {@link KDObjectTree} for {@link @xeokit/scene!SceneObject | SceneObjects} that intersect a
 * 3D World-space {@link @xeokit/math/boundaries!Frustum | Frustum}.
 *
 * See {@link "@xeokit/kdtree"} for usage.
 */
export class KDTreeFrustumQuery {

    /**
     * The {@link KDObjectTree} that this KDTreeFrustumQuery will query.
     */
    public readonly kdTree: KDObjectTree;

    /**
     * The World-space 3D {@link @xeokit/math/boundaries!FrustumProjection | FrustumProjection} that this KDTreeFrustumQuery
     * tests for intersection with its {@link KDObjectTree}.
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
        kdTree: KDObjectTree,
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

    #queryNode(node: KDObjectNode, intersectionState: number): void {
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
                    if (testFrustumIntersectsSceneObject(this.frustum, sceneObject)) {
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
