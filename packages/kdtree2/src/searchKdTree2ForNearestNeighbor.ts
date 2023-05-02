import type {FloatArrayParam} from "@xeokit/math";
import type {SceneObject} from "@xeokit/scene";
import type {KdTree2} from "./KdTree2";

/**
 *
 */
export function searchKdTree2ForNearestNeighbor(params: {
    kdTree: KdTree2,
    canvasPos: FloatArrayParam
}): SceneObject[] {
    const kdTree = params.kdTree;
    const canvasPos = params.canvasPos;
    // @ts-ignore
    const sceneObjects = [];

//...

    // @ts-ignore
    return sceneObjects;
}
