import {createAABB2, Frustum, frustumIntersectsAABB3, INTERSECT, OUTSIDE} from "@xeokit/math/boundaries";
import {SceneObject} from "@xeokit/scene";
import {FloatArrayParam} from "@xeokit/math/math";
import {createMat4} from "@xeokit/math/matrix";
import {KDObjectTree} from "./KDObjectTree";
import {KDObjectNode} from "./KDObjectNode";
import {SDKError} from "@xeokit/core/components";
import {testFrustumIntersectsSceneObject} from "./testFrustumIntersectsSceneObject";

/**
 * Queries a {@link KDObjectTree} for {@link @xeokit/scene!SceneObject | SceneObjects} that intersect a 2D canvas boundary.
 *
 * See {@link "@xeokit/kdtree"} for usage.
 */
export class KDTreeMarqueeQuery {

    /**
     * The {@link KDObjectTree} that this KDTreeMarqueeQuery will query.
     */
    public readonly kdTree: KDObjectTree;

    /**
     * Contains the {@link @xeokit/scene!SceneObject | SceneObjects} found to intersect with the last call to {@link @doQuery}.
     */
    public readonly objects: SceneObject[];

    #viewMatrix: FloatArrayParam;
    #projMatrix: FloatArrayParam;
    #canvasBoundary: FloatArrayParam;
    #frustum: Frustum;

    #destroyed: boolean;

    /**
     * Creates a new KDTreeMarqueeQuery.
     */
    constructor(params: {
        kdTree: KDObjectTree;
        viewMatrix?: FloatArrayParam;
        projMatrix?: FloatArrayParam;
        canvasBoundary?: FloatArrayParam;
    }) {
        this.kdTree = params.kdTree;
        this.objects = [];
        this.#viewMatrix = createMat4(params.viewMatrix);
        this.#projMatrix = createMat4(params.projMatrix);
        this.#canvasBoundary = createAABB2(params.canvasBoundary);
        this.#frustum = new Frustum();
        this.#destroyed = false;
    }

    get viewMatrix(): FloatArrayParam {
        return this.#viewMatrix;
    }

    set viewMatrix(viewMatrix: FloatArrayParam) {
        (<Float64Array>this.#viewMatrix).set(viewMatrix);
    }

    get projMatrix(): FloatArrayParam {
        return this.#projMatrix;
    }

    set projMatrix(projMatrix: FloatArrayParam) {
        (<Float64Array>this.#projMatrix).set(projMatrix);
    }

    get canvasBoundary(): FloatArrayParam {
        return this.#canvasBoundary;
    }

    set canvasBoundary(canvasBoundary: FloatArrayParam) {
        (<Float64Array>this.#canvasBoundary).set(canvasBoundary);
    }

    /**
     * Resets this KDTreeMarqueeQuery.
     */
    reset() {

    }

    /**
     * Executes this KDTreeMarqueeQuery.
     */
    doQuery(): SDKError | void {
        if (this.#destroyed) {
            return new SDKError("KDTreeMarqueeQuery already destroyed");
        }

        // TODO create #frustum

        this.objects.length = 0;
        this.#queryNode(this.kdTree.root, INTERSECT);
    }

    /**
     * Destroys this KDTreeMarqueeQuery.
     */
    destroy(): SDKError | void {
        if (this.#destroyed) {
            return new SDKError("KDTreeMarqueeQuery already destroyed");
        }
        this.#destroyed = true;
    }

    #queryNode(node: KDObjectNode, intersectionState: number): void {
        if (intersectionState === OUTSIDE) {
            return;
        }
        intersectionState = frustumIntersectsAABB3(this.#frustum, node.aabb);
        if (intersectionState === OUTSIDE) {
            return;
        }
        const objects = node.objects;
        if (objects && objects.length > 0) {
            for (let i = 0, len = objects.length; i < len; i++) {
                const kdObject = objects[i];
                const sceneObject = kdObject.object;
                const objectIntersectionState = frustumIntersectsAABB3(this.#frustum, sceneObject.aabb);
                if (objectIntersectionState !== OUTSIDE) {
                    if (testFrustumIntersectsSceneObject(this.#frustum, sceneObject)) {
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
