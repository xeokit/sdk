import type { FloatArrayParam } from "../math";
import type { SceneObject } from "../scene";
import type { KdTree2 } from "./KdTree2";
/**
 * Performs a Nearest-Neighbour search of the given KdTree2 from the given 2D canvas coordinates.
 *
 *  See {@link kdtree2 | @xeokit/sdk/kdtree2} for usage.
 */
export declare function searchKdTree2ForNearestNeighbor(params: {
    kdTree: KdTree2;
    canvasPos: FloatArrayParam;
}): SceneObject[];
//# sourceMappingURL=searchKdTree2ForNearestNeighbor.d.ts.map