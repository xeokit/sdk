import {Frustum, frustumIntersectsAABB3} from "@xeokit/math/boundaries";
import {SceneObject} from "@xeokit/scene";
import {KDNode, KDTree} from "./KDTree";


/**
 * Queries a {@link KDTree} for objects that intersect a {@link Frustum}.
 */
export class KDFrustumQuery {

    public kdTree: KDTree;
    public frustum?: Frustum;
    public objectsUpdated: SceneObject[];
    #includeLayers?: { [key: string]: boolean };
    #excludeLayers?: { [key: string]: boolean };

    /**
     * Creates a new KDFrustumQuery
     */
    constructor(params: {
        kdTree: KDTree,
        frustum?: Frustum,
        includeLayers?: string[],
        excludeLayers?: string[],
    }) {
        this.kdTree = params.kdTree;
        this.frustum = params.frustum;
        this.#includeLayers = params.includeLayers
            ? params.includeLayers.reduce(function (acc, cur, i) {
                acc[i] = true;
                return acc;
            }, {})
            : null;
        this.#excludeLayers = params.excludeLayers
            ? params.excludeLayers.reduce(function (acc, cur, i) {
                acc[i] = true;
                return acc;
            }, {}) : null;

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
        this.objectsUpdated.length = 0;
        if (this.kdTree.root) {
            this.#queryNode(this.kdTree.root, Frustum.INTERSECT);
        }
    }

    #queryNode(node: KDNode, intersects: number): void {
        if (intersects === Frustum.OUTSIDE) {
            return;
        }
        if (intersects === Frustum.INTERSECT) {
            intersects = frustumIntersectsAABB3(this.frustum, node.aabb);
        }
        const objects: SceneObject[] = node.objects;
        if (objects && objects.length > 0) {
            for (let i = 0, len = objects.length; i < len; i++) {
                this.objectsUpdated.push(objects[i]);
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
