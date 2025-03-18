import { SceneObject } from "../scene";
import { KdTree3 } from "./KdTree3";
/**
 * k-d tree built by {@link createSceneObjectPrimsKdTree3}.
 */
export declare class SceneObjectsPrimsKdTree3 extends KdTree3 {
}
/**
 * Creates a KdTree3 that indexes the primitives belonging to the given SceneObjects in 3D World-space.
 *
 * See {@link kdtree3 | @xeokit/sdk/kdtree3} for usage.
 */
export declare function createSceneObjectPrimsKdTree3(sceneObjects: SceneObject[]): SceneObjectsPrimsKdTree3;
//# sourceMappingURL=createSceneObjectPrimsKdTree3.d.ts.map