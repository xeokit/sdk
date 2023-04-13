import {GeometryBucket, Mesh, SceneObject} from "@xeokit/scene";
import {KdLinePrim, KdPointPrim, KdTrianglePrim} from "../kdtree3d";
import {FloatArrayParam} from "@xeokit/math/math";

/**
 * Results returned by {@link rayPick}.
 */
export interface RayPickResult {
    sceneObjects: {
        sceneObject: SceneObject,
        meshes: {
            mesh: Mesh,
            geometryBuckets: {
                geometryBucket: GeometryBucket,
                primitiveHits: {
                    primitive: (KdTrianglePrim | KdLinePrim | KdPointPrim),
                    worldPos: FloatArrayParam
                }[]
            }[]
        }[]
    }[]
}