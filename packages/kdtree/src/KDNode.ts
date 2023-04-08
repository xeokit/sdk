import {FloatArrayParam} from "@xeokit/math/math";
import {KDObject} from "./KDObject";

/**
 * A node in a {@link KDTree}.
 */
export class KDNode {

    /**
     * A unique, sequential numeric ID for this KDNode within its KDTree.
     */
    index: number;

    /**
     * The axis-aligned World-space 3D boundary of this kd-tree node.
     */
    aabb: FloatArrayParam;

    /**
     * The left KDNode.
     */
    left?: KDNode;

    /**
     * The right KDNode.
     */
    right?: KDNode;

    /**
     * The {@link @xeokit/scene!Sceneobject | SceneObjects} stored in this KDNode.
     */
    objects?: KDObject[];
}