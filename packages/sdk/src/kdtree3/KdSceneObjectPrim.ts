import type { SceneGeometry, SceneObject } from "../scene";
import type { KdLinePrim } from "./KdLinePrim";
import type { KdPointPrim } from "./KdPointPrim";
import type { KdTrianglePrim } from "./KdTrianglePrim";

/**
 *
 * See {@link kdtree3 | @xeokit/sdk/kdtree3} for usage.
 */
export interface KdSceneObjectPrim {
  sceneObject: SceneObject;
  sceneGeometry: SceneGeometry;
  prim: KdTrianglePrim | KdPointPrim | KdLinePrim;
}
