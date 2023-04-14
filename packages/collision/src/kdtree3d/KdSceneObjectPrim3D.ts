import {GeometryBucket, SceneObject} from "@xeokit/scene";
import {KdTriangle3D} from "./KdTriangle3D";
import {KdPoint3D} from "./KdPoint3D";
import {KdLine3D} from "./KdLine3D";

/**
 * TODO
 */
export interface KdSceneObjectPrim3D {
    sceneObject: SceneObject;
    geometryBucket: GeometryBucket;
    prim: KdTriangle3D | KdPoint3D | KdLine3D;
}