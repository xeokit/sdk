import { FloatArrayParam } from "@xeokit/math";
import { SceneObject } from "@xeokit/scene";
import { KdTree2 } from "./KdTree2";
/**
 *
 */
export declare function searchKdTree2ForNearestNeighbor(params: {
    kdTree: KdTree2;
    canvasPos: FloatArrayParam;
}): SceneObject[];
