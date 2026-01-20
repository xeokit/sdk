import {collapseAABB3, createAABB3Float64, expandAABB3} from "../../math/boundaries";
import type {SceneObject} from "../../scene";
import {SceneObjectsKdTree3} from "./sceneObjectsKdTree3";

/**
 * Indexes the given SceneObjects in a k-d tree for efficient collision detection.
 *
 * See {@link kdtree3 | @xeokit/sdk/kdtree3} for usage.
 */
export function createSceneObjectsKdTree3(sceneObjects: SceneObject[]): SceneObjectsKdTree3 {
  const aabb = collapseAABB3(createAABB3Float64());
  for (let i = 0, len = sceneObjects.length; i < len; i++) {
   // expandAABB3(aabb, sceneObjects[i].aabb);
  }
  const kdTree = new SceneObjectsKdTree3({
    aabb
  });
  for (let i = 0, len = sceneObjects.length; i < len; i++) {
    const sceneObject = sceneObjects[i];
  //  kdTree.insertItem(sceneObject, sceneObject.aabb);
  }
  return kdTree;
}


