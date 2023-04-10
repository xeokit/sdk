import {Scene, SceneModel, SceneObject} from "@xeokit/scene";

import {containsAABB3, expandAABB3} from "@xeokit/math/src/boundaries";
import {EventEmitter} from "@xeokit/core/dist/EventEmitter";
import {EventDispatcher} from "strongly-typed-events";
import {SDKError} from "@xeokit/core/components";
import {FloatArrayParam} from "@xeokit/math/math";

const MAX_KD_TREE_DEPTH = 10; // Increase if greater precision needed

const kdTreeDimLength = new Float32Array(3);

/**
 * Parameters for creating a {@link KDObjectTree}.
 */
export interface KDObjectTreeParams {

    /**
     * The {@link @xeokit/scene!Scene | Scene} whose {@link @xeokit/scene!SceneObject | SceneObjects} are tracked by the new KDTRee.
     */
    scene: Scene;

    /**
     * Maximum depth of the kd-tree. This is `10` by default.
     */
     maxDepth?: number;

    /**
     * Option to include only the SceneObjects that are associated with the specified {@link @xeokit/viewer!ViewLayer | ViewLayers}.
     */
    includeLayerIds?: string[];

    /**
     * Option to never include the SceneObjects that are associated with the specified {@link @xeokit/viewer!ViewLayer | ViewLayers}.
     */
    excludeLayerIds?: string[];
}

/**
 * Binds a {@link @xeokit/scene!SceneObject | SceneObject} to a {@link KDObjectNode}.
 */
export interface KDObject {

    /**
     * A unique, sequential numeric ID for this KDObject within its KDObjectTree.
     */
    index: number;

    /**
     * The {@link @xeokit/scene!Sceneobject | SceneObject} stored in this KDObject.
     */
    object: SceneObject;
}

/**
 * A node in a {@link KDObjectTree}.
 */
export class KDObjectNode {

    /**
     * A unique, sequential numeric ID for this KDObjectNode within its KDObjectTree.
     */
    index: number;

    /**
     * The axis-aligned World-space 3D boundary of this kd-tree node.
     */
    aabb: FloatArrayParam;

    /**
     * The left KDObjectNode.
     */
    left?: KDObjectNode;

    /**
     * The right KDObjectNode.
     */
    right?: KDObjectNode;

    /**
     * The {@link @xeokit/scene!Sceneobject | SceneObjects} stored in this KDObjectNode.
     */
    objects?: KDObject[];
}

/**
 * Automatically organizes a {@link @xeokit/scene!Scene | Scene}'s {@link @xeokit/scene!SceneObject | SceneObects}
 * into a spatial search index that supports fast intersection queries against boundaries and volumes.
 *
 * See {@link "@xeokit/kdtree"} for usage.
 */
export class KDObjectTree {

    /**
     * The {@link @xeokit/scene!Scene | Scene} whose {@link @xeokit/scene!SceneObject | SceneObjects} are tracked by this KDTRee.
     */
    public scene: Scene;

    /**
     * Option to include only the SceneObjects that are associated with the specified {@link @xeokit/viewer!ViewLayer | ViewLayers}.
     */
    public readonly includeLayerIds?: string[];

    /**
     * Option to never include the SceneObjects that are associated with the specified {@link @xeokit/viewer!ViewLayer | ViewLayers}.
     */
    public readonly excludeLayerIds?: string[];

    /**
     * Fires an event whenever this KDObjectTree has been rebuilt.
     */
    public readonly onBuilt: EventEmitter<KDObjectTree, KDObjectTree>;

    #root: KDObjectNode;
    #maxDepth: any;
    #dirty: boolean;
    #destroyed: boolean;
    #includeLayerIdsMap: { [key: string]: boolean };
    #excludeLayerIdsMap: { [key: string]: boolean };

    #onSceneModelCreated: () => void;
    #onSceneModelDestroyed: () => void;
    #onSceneDestroyed: () => void;

    #numNodes: number;
    #numObjects: number;

    /**
     * Creates a new KDObjectTree.
     *
     * @param params
     */
    constructor(params: KDObjectTreeParams) {
        this.#maxDepth = params.maxDepth || MAX_KD_TREE_DEPTH;
        this.#dirty = true;
        this.scene = params.scene;
        this.#root = null;
        this.#onSceneModelCreated = this.scene.onModelCreated.subscribe((scene: Scene, sceneModel: SceneModel) => {
            if (sceneModel.layerId) {
                if (this.#includeLayerIdsMap && !this.#includeLayerIdsMap[sceneModel.layerId]) {
                    return;
                }
                if (this.#excludeLayerIdsMap && this.#excludeLayerIdsMap[sceneModel.layerId]) {
                    return;
                }
            }
            this.#insertModel(sceneModel);
        });
        this.#onSceneModelDestroyed = this.scene.onModelDestroyed.subscribe((scene: Scene, sceneModel: SceneModel) => {
            // TODO: Handle case where model can be removed by simply pruning a kd-tree branch and rebuilding boundaries at parent nodes
            this.#dirty = true;
            this.#root = null;
        });
        this.#onSceneDestroyed = this.scene.onDestroyed.one(() => {
            this.#dirty = true;
            this.scene = null;
            this.#root = null;
        });
        this.onBuilt = new EventEmitter(new EventDispatcher<KDObjectTree, KDObjectTree>());
        this.#destroyed = false;
        this.#numNodes = 0;
        this.#numNodes = 0;
        this.includeLayerIds = params.includeLayerIds;
        this.excludeLayerIds = params.excludeLayerIds;
        this.#includeLayerIdsMap = params.includeLayerIds ? arrayToMap(params.includeLayerIds) : null;
        this.#excludeLayerIdsMap = params.excludeLayerIds ? arrayToMap(params.excludeLayerIds) : null;
    }

    /**
     * Gets the root {@link KDObjectNode} of this KDObjectTree.
     */
    get root(): KDObjectNode {
        if (this.#dirty) {
            this.#build();
        }
        return this.#root;
    }

    /**
     * Destroys this KDObjectTree.
     */
    destroy(): void | SDKError {
        if (this.#destroyed) {
            return new SDKError("KDObjectTree already destroyed");
        }
        this.scene.onModelCreated.unsubscribe(this.#onSceneModelCreated);
        this.scene.onModelDestroyed.unsubscribe(this.#onSceneModelDestroyed);
        this.scene.onDestroyed.unsubscribe(this.#onSceneDestroyed);
        this.scene = null;
        this.#root = null;
        this.#destroyed = true;
    }

    #build() {
        this.#numNodes = 0;
        this.#numObjects = 0;
        this.#root = {
            aabb: this.scene.aabb,
            index: this.#numNodes++
        };
        for (let modelId in this.scene.models) {
            const sceneModel = this.scene.models[modelId];
            const layerId = sceneModel.layerId || "default";
            if (sceneModel.layerId) {
                if (this.#includeLayerIdsMap && !this.#includeLayerIdsMap[layerId]) {
                    continue;
                }
                if (this.#excludeLayerIdsMap && this.#excludeLayerIdsMap[layerId]) {
                    continue;
                }
            }
            this.#insertModel(sceneModel);
        }
        this.#dirty = false;
    }

    #insertModel(sceneModel: SceneModel) {
        for (let objectId in sceneModel.objects) {
            this.#insertObject(this.#root, sceneModel.objects[objectId], 1);
        }
    }

    #insertObject(node: KDObjectNode, sceneObject: SceneObject, depth: number) {
        const objectAABB = sceneObject.aabb;
        if (depth >= this.#maxDepth) {
            node.objects = node.objects || [];
            node.objects.push(<KDObject>{
                index: this.#numObjects++,
                object: sceneObject
            });
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
        node.objects.push(<KDObject>{
            index: this.#numObjects++,
            object: sceneObject
        });
        expandAABB3(node.aabb, objectAABB);
    }
}

function arrayToMap(array: any[]): { [key: string]: any } {
    const map: { [key: string]: any } = {};
    for (let i = 0, len = array.length; i < len; i++) {
        map[array[i]] = true;
    }
    return map;
}