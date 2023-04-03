import {FloatArrayParam} from "@xeokit/math/math";
import {SceneObject} from "@xeokit/scene";
import {Frustum} from "@xeokit/math/boundaries";
import {KDNode, KDTree} from "./KDTree";

/**
 * Queries a {@link KDTree} for objects that intersect a {@link Frustum}.
 */
export class KDAABBQuery {

    public kdTree: KDTree;
    public aabb?: FloatArrayParam;
    public includeLayers?: string[];
    public excludeLayers?: string[];
    public objects: SceneObject[];
    #dirty: boolean;

    /**
     * Creates a new KDAABBQuery
     */
    constructor(params: {
        kdTree: KDTree,
        aabb?: FloatArrayParam,
        includeLayers?: string[],
        excludeLayers?: string[],
    }) {
        this.kdTree = params.kdTree;
        this.aabb = params.aabb;
        this.reset();
    }

    /**
     * Resets this query.
     */
    reset() {
    }

    /**
     * Refreshes this query.
     */
    update() {
        this.objects.length = 0;
        if (this.kdTree.root) {
            this.#queryNode(this.kdTree.root, Frustum.INTERSECT);
        }
    }

    #queryNode(node: KDNode, intersects: number) {
        if (intersects === Frustum.OUTSIDE) {
            return;
        }
        if (intersects === Frustum.INTERSECT) {
            // intersects = frustumIntersectsAABB3(this.aabb, node.aabb);
        }
        const objects = node.objects;
        if (objects && objects.length > 0) {
            for (let i = 0, len = objects.length; i < len; i++) {
                this.objects.push(objects[i]);
            }
        }
        if (node.left) {
            this.#queryNode(node.left, intersects);
        }
        if (node.right) {
            this.#queryNode(node.right, intersects);
        }
    }
}