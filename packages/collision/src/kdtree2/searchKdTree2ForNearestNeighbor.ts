import {FloatArrayParam} from "@xeokit/math/math";
import {SceneObject} from "@xeokit/scene";
import {KdTree2} from "./KdTree2";

/**
 *
 */
export function searchKdTree2ForNearestNeighbor(params: {
    kdTree: KdTree2,
    canvasPos: FloatArrayParam
}): SceneObject[] {
    const kdTree = params.kdTree;
    const canvasPos = params.canvasPos;
    const sceneObjects = [];

//...

    return sceneObjects;
}
