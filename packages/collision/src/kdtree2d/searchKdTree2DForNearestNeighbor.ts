import {FloatArrayParam} from "@xeokit/math/math";
import {SceneObject} from "@xeokit/scene";
import {KdTree2D} from "./KdTree2D";

/**
 *
 */
export function searchKdTree2DForNearestNeighbor(params: {
    kdTree: KdTree2D,
    canvasPos: FloatArrayParam
}): SceneObject[] {
    const kdTree = params.kdTree;
    const canvasPos = params.canvasPos;
    const sceneObjects = [];

//...

    return sceneObjects;
}
