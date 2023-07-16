import { SceneObject } from "@xeokit/scene";
import { KdTree3 } from "./KdTree3";
/**
 * k-d tree built by {@link createSceneObjectPrimsKdTree3}.
 */
export declare class SceneObjectsPrimsKdTree3 extends KdTree3 {
}
/**
 * Creates a KdTree3 that indexes the primitives belonging to the given SceneObjects in 3D World-space.
 *
 * See {@link "@xeokit/kdtree3"} for usage.
 *
 * @param sceneObjects
 */
export declare function createSceneObjectPrimsKdTree3(sceneObjects: SceneObject[]): SceneObjectsPrimsKdTree3;
