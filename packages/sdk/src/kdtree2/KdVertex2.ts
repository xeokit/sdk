import type { SceneObject } from "../scene";
import type { FloatArrayParam, IntArrayParam } from "../math";

/**
 * A vertex in a KdTree2.
 *
 * See {@link kdtree2 | @xeokit/sdk/kdtree2} for usage.
 */
export class KdVertex2 {
  sceneObject: SceneObject;
  worldPos: FloatArrayParam;
  canvasPos: IntArrayParam;
}
