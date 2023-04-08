import {SceneObject} from "@xeokit/scene";

/**
 * Binds a {@link @xeokit/scene!SceneObject | SceneObject} to a {@link KDNode}.
 */
export interface KDObject {

    /**
     * A unique, sequential numeric ID for this KDObject within its KDTree.
     */
    index: number;

    /**
     * The {@link @xeokit/scene!Sceneobject | SceneObject} stored in this KDObject.
     */
    object: SceneObject;
}