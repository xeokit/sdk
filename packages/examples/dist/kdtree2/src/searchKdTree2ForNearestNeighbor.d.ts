import type { FloatArrayParam } from "@xeokit/math";
import type { SceneObject } from "@xeokit/scene";
import type { KdTree2 } from "./KdTree2";
/**
 *
 */
export declare function searchKdTree2ForNearestNeighbor(params: {
    kdTree: KdTree2;
    canvasPos: FloatArrayParam;
}): SceneObject[];
