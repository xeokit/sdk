import type {SceneGeometryBucket, SceneObject} from "@xeokit/scene";
import type {KdTrianglePrim} from "./KdTrianglePrim";
import type {KdPointPrim} from "./KdPointPrim";
import type {KdLinePrim} from "./KdLinePrim";

/**
 *
 * See {@link "@xeokit/kdtree3"} for usage.
 */
export interface KdSceneObjectPrim {
    sceneObject: SceneObject;
    geometryBucket: SceneGeometryBucket;
    prim: KdTrianglePrim | KdPointPrim | KdLinePrim;
}