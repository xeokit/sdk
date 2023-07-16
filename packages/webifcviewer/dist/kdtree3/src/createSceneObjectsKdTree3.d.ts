import type { SceneObject } from "@xeokit/scene";
import { SceneObjectsKdTree3 } from "./sceneObjectsKdTree3";
/**
 * Indexes the given SceneObjects in a k-d tree for efficient collision detection.
 *
 * See {@link "@xeokit/kdtree3"} for usage.
 */
export declare function createSceneObjectsKdTree3(sceneObjects: SceneObject[]): SceneObjectsKdTree3;
