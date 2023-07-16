import type {SceneObject} from "@xeokit/scene";
import {collapseAABB3, expandAABB3} from "@xeokit/boundaries";
import {SceneObjectsKdTree3} from "./sceneObjectsKdTree3";

/**
 * Indexes the given SceneObjects in a k-d tree for efficient collision detection.
 *
 * See {@link "@xeokit/kdtree3"} for usage.
 */
export function createSceneObjectsKdTree3(sceneObjects: SceneObject[]): SceneObjectsKdTree3 {
    const aabb = collapseAABB3();
    for (let i = 0, len = sceneObjects.length; i < len; i++) {
        expandAABB3(aabb, sceneObjects[i].aabb);
    }
    const kdTree = new SceneObjectsKdTree3({aabb});
    for (let i = 0, len = sceneObjects.length; i < len; i++) {
        const sceneObject = sceneObjects[i];
        kdTree.insertItem(sceneObject, sceneObject.aabb);
    }
    return kdTree;
}


