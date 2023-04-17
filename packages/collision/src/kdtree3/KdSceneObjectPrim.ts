import {GeometryBucket, SceneObject} from "@xeokit/scene";
import {KdTrianglePrim} from "./KdTrianglePrim";
import {KdPointPrim} from "./KdPointPrim";
import {KdLinePrim} from "./KdLinePrim";

/**
 *
 * See {@link "@xeokit/collision/kdtree3"} for usage.
 */
export interface KdSceneObjectPrim {
    sceneObject: SceneObject;
    geometryBucket: GeometryBucket;
    prim: KdTrianglePrim | KdPointPrim | KdLinePrim;
}