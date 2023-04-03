
import {Scene, SceneModel, SceneObject} from "@xeokit/scene";

import {containsAABB3, expandAABB3, Frustum, frustumIntersectsAABB3} from "@xeokit/math/src/boundaries";
import {FloatArrayParam} from "@xeokit/math/src/math";
import {EventEmitter} from "@xeokit/core/dist/EventEmitter";
import {EventDispatcher} from "strongly-typed-events";
import {SDKError} from "@xeokit/core/components";
import {KDQuery} from "./KDQuery";


const MAX_KD_TREE_DEPTH = 8; // Increase if greater precision needed

const kdTreeDimLength = new Float32Array(3);

/**
 * TODO
 */
export interface KDTreeParams {
    scene: Scene;
    maxDepth: number;

}

/**
 * TODO
 */


/**
 * TODO
 */
export class KDNode {
    index: number;
    aabb: FloatArrayParam;
    left?: KDNode;
    right?: KDNode;
    objects?: SceneObject[];
}

/**
 * A KD tree
 */
export class KDTree {

    public scene: Scene;
    public root: KDNode;
    public readonly onBuilt: EventEmitter<KDTree, KDTree>;
    queries: {};
    #onSceneModelCreated: () => void;
    #onSceneModelDestroyed: () => void;
    #onSceneDestroyed: () => void;
    #maxDepth: any;
    #dirty: boolean;
    #destroyed: boolean;
    #numNodes: number;

    /**
     *
     * @param params
     */
    constructor(params: KDTreeParams) {
        this.#maxDepth = params.maxDepth || MAX_KD_TREE_DEPTH;
        this.#dirty = true;
        this.scene = params.scene;
        this.root = null;
        this.#onSceneModelCreated = this.scene.onModelCreated.subscribe((scene: Scene, sceneModel: SceneModel) => {
            this.#dirty = true;
        });
        this.#onSceneModelDestroyed = this.scene.onModelDestroyed.subscribe((scene: Scene, sceneModel: SceneModel) => {
            this.#dirty = true;
        });
        this.#onSceneDestroyed = this.scene.onDestroyed.one((s) => {
            this.#dirty = true;
            this.scene = null;
            this.root = null;
        });
        this.onBuilt = new EventEmitter(new EventDispatcher<KDTree, KDTree>());
        this.#destroyed = false;
        this.#numNodes = 0;
    }

    /**
     * TODO
     */
    destroy() {
        if (this.#destroyed) {
            return new SDKError("KDTree already destroyed");
        }
        this.scene.onModelCreated.unsubscribe(this.#onSceneModelCreated);
        this.scene.onModelDestroyed.unsubscribe(this.#onSceneModelDestroyed);
        this.scene.onDestroyed.unsubscribe(this.#onSceneDestroyed);
        this.scene = null;
        this.root = null;
        this.#destroyed = true;
    }

    #build() {
        const depth = 0;
        this.root = {
            aabb: this.scene.aabb,
            index: this.#numNodes++
        };
        for (let objectId in this.scene.objects) {
            const sceneObject = this.scene.objects[objectId];
            this.#insertObject(this.root, sceneObject, depth + 1);
        }
        this.#dirty = false;
    }

    #insertObject(node: KDNode, sceneObject: SceneObject, depth: number) {
        const objectAABB = sceneObject.aabb;
        if (depth >= this.#maxDepth) {
            node.objects = node.objects || [];
            node.objects.push(sceneObject);
            expandAABB3(node.aabb, objectAABB);
            return;
        }
        if (node.left) {
            if (containsAABB3(node.left.aabb, objectAABB)) {
                this.#insertObject(node.left, sceneObject, depth + 1);
                return;
            }
        }
        if (node.right) {
            if (containsAABB3(node.right.aabb, objectAABB)) {
                this.#insertObject(node.right, sceneObject, depth + 1);
                return;
            }
        }
        const nodeAABB = node.aabb;
        kdTreeDimLength[0] = nodeAABB[3] - nodeAABB[0];
        kdTreeDimLength[1] = nodeAABB[4] - nodeAABB[1];
        kdTreeDimLength[2] = nodeAABB[5] - nodeAABB[2];
        let dim = 0;
        if (kdTreeDimLength[1] > kdTreeDimLength[dim]) {
            dim = 1;
        }
        if (kdTreeDimLength[2] > kdTreeDimLength[dim]) {
            dim = 2;
        }
        if (!node.left) {
            const aabbLeft = nodeAABB.slice();
            aabbLeft[dim + 3] = ((nodeAABB[dim] + nodeAABB[dim + 3]) / 2.0);
            node.left = {
                index: this.#numNodes++,
                aabb: aabbLeft
            };
            if (containsAABB3(aabbLeft, objectAABB)) {
                this.#insertObject(node.left, sceneObject, depth + 1);
                return;
            }
        }
        if (!node.right) {
            const aabbRight = nodeAABB.slice();
            aabbRight[dim] = ((nodeAABB[dim] + nodeAABB[dim + 3]) / 2.0);
            node.right = {
                index: this.#numNodes++,
                aabb: aabbRight
            };
            if (containsAABB3(aabbRight, objectAABB)) {
                this.#insertObject(node.right, sceneObject, depth + 1);
                return;
            }
        }
        node.objects = node.objects || [];
        node.objects.push(sceneObject);
        expandAABB3(node.aabb, objectAABB);
    }
}
