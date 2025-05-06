import type {FloatArrayParam} from "../math";
import type {KdTree2} from "./KdTree2";
import type {SceneObject} from "../scene";

/**
 * Performs a Nearest-Neighbour search of the given KdTree2 from the given 2D canvas coordinates.
 *
 *  See {@link kdtree2 | @xeokit/sdk/kdtree2} for usage.
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
