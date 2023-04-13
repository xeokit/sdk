import {KdTree3D} from "./KdTree3D";
import {SceneObject} from "@xeokit/scene";
import {collapseAABB3, expandAABB3} from "@xeokit/math/boundaries";

/**
 * Indexes the given SceneObjects in a k-d tree for efficient collision detection.
 */
export function createKdTree3DFromSceneObjects(sceneObjects: SceneObject[]): KdTree3D {
    const aabb = collapseAABB3();
    for (let i = 0, len = sceneObjects.length; i < len; i++) {
        expandAABB3(aabb, sceneObjects[i].aabb);
    }
    const kdTree = new KdTree3D({aabb});
    for (let i = 0, len = sceneObjects.length; i < len; i++) {
        const sceneObject = sceneObjects[i];
        kdTree.insertItem(sceneObject, sceneObject.aabb);
    }
    return kdTree;
}


