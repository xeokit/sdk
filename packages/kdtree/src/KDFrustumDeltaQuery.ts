import {KDQuery} from "./KDQuery";
import {Frustum, frustumIntersectsAABB3} from "@xeokit/math/boundaries";
import {FloatArrayParam} from "@xeokit/math/math";
import {SceneObject} from "@xeokit/scene";
import {KDNode, KDTree} from "./KDTree";

/**
 * TODO
 */
export class KDFrustumDeltaQuery extends KDQuery {

    public frustum?: Frustum;
    public aabb?: FloatArrayParam;
    public objectsUpdated: SceneObject[];
    public objectsUpdatedIntersections: number[];
    #nodeIntersectionsCache: Uint8Array;

    /**
     * TODO
     */
    constructor(params: {
        kdTree: KDTree,
        includeLayers?: string[],
        excludeLayers?: string[],
    }) {
        super(params);
        this.reset();
    }

    reset() {
        this.#nodeIntersectionsCache = null;
    }

    update() {
        this.objectsUpdated.length = 0;
        this.objectsUpdatedIntersections.length = 0;
        if (this.kdTree.root) {
            this.#queryNode(this.kdTree.root, Frustum.INTERSECT);
        }
    }

    #queryNode(node: KDNode, intersects: number) {
        if (this.#nodeIntersectionsCache[node.index] === intersects && intersects === Frustum.OUTSIDE) {
            return;
        }
        if (intersects === Frustum.INTERSECT) {
            intersects = frustumIntersectsAABB3(this.frustum, node.aabb);
        }
        this.#nodeIntersectionsCache[node.index] = intersects;
        const objects = node.objects;
        if (objects && objects.length > 0) {
            for (let i = 0, len = objects.length; i < len; i++) {
                this.objectsUpdated.push(objects[i]);
                this.objectsUpdatedIntersections.push(intersects);
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