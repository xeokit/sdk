import type { SceneGeometry, SceneObject } from "../scene";
import type { KdTrianglePrim } from "./KdTrianglePrim";
import type { KdPointPrim } from "./KdPointPrim";
import type { KdLinePrim } from "./KdLinePrim";
/**
 *
 * See {@link kdtree3 | @xeokit/sdk/kdtree3} for usage.
 */
export interface KdSceneObjectPrim {
    sceneObject: SceneObject;
    sceneGeometry: SceneGeometry;
    prim: KdTrianglePrim | KdPointPrim | KdLinePrim;
}
//# sourceMappingURL=KdSceneObjectPrim.d.ts.map