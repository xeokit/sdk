import {createAABB2, Frustum, frustumIntersectsAABB3, INTERSECT, OUTSIDE} from "@xeokit/math/boundaries";
import {SceneObject} from "@xeokit/scene";
import {FloatArrayParam} from "@xeokit/math/math";
import {createMat4} from "@xeokit/math/matrix";
import {KDTree} from "./KDTree";
import {KDNode} from "./KDNode";
import {SDKError} from "@xeokit/core/components";

/**
 * Queries a {@link KDTree} for {@link @xeokit/scene!SceneObject | SceneObjects} that intersect a 2D canvas boundary.
 *
 * See {@link "@xeokit/kdtree"} for usage.
 */
export class KDTreeMarqueeQuery {

    /**
     * The {@link KDTree} that this KDTreeMarqueeQuery will query.
     */
    public readonly kdTree: KDTree;

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
        kdTree: KDTree;
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

    #queryNode(node: KDNode, intersectionState: number): void {
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
                    this.objects.push(sceneObject);
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
