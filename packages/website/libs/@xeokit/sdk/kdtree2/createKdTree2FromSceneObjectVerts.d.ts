import { SceneObject } from "../scene";
import type { FloatArrayParam } from "../math";
import { KdTree2 } from "./KdTree2";
/**
 * A k-d tree to accelerate intersection and nearest-neighbour tests on the projected
 * 2D canvas positions of {@link scene!SceneObject} geometry vertices.
 *
 * See {@link kdtree2 | @xeokit/sdk/kdtree2} for usage.
 */
export declare function createKdTree2FromSceneObjectVerts(params: {
    viewMatrix: FloatArrayParam;
    projMatrix: FloatArrayParam;
    canvasBoundary: FloatArrayParam;
    sceneObjects: SceneObject[];
}): KdTree2;
//# sourceMappingURL=createKdTree2FromSceneObjectVerts.d.ts.map