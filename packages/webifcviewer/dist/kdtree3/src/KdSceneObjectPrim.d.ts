import type { GeometryBucket, SceneObject } from "@xeokit/scene";
import type { KdTrianglePrim } from "./KdTrianglePrim";
import type { KdPointPrim } from "./KdPointPrim";
import type { KdLinePrim } from "./KdLinePrim";
/**
 *
 * See {@link "@xeokit/collision/kdtree3"} for usage.
 */
export interface KdSceneObjectPrim {
    sceneObject: SceneObject;
    geometryBucket: GeometryBucket;
    prim: KdTrianglePrim | KdPointPrim | KdLinePrim;
}
