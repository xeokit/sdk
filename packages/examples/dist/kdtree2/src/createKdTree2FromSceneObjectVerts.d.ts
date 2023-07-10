import { SceneObject } from "@xeokit/scene";
import type { FloatArrayParam } from "@xeokit/math";
import { KdTree2 } from "./KdTree2";
/**
 * A k-d tree to accelerate intersection and nearest-neighbour tests on the projected
 * 2D canvas positions of {@link @xeokit/scene!SceneObject} geometry vertices.
 *
 * See {@link "@xeokit/kd-canvas-verts"} for usage.
 */
export declare function createKdTree2FromSceneObjectVerts(params: {
    viewMatrix: FloatArrayParam;
    projMatrix: FloatArrayParam;
    canvasBoundary: FloatArrayParam;
    sceneObjects: SceneObject[];
}): KdTree2;
