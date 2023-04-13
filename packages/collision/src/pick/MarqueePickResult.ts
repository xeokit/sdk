import {GeometryBucket, Mesh, SceneObject} from "@xeokit/scene";
import {KdLinePrim, KdPointPrim, KdTrianglePrim} from "../kdtree3d";

/**
 * Results returned by {@link marqueePick}.
 */
export interface MarqueePickResult {

    /**
     * TODO
     */
    sceneObjects: {

        /**
         * TODO
         */
        sceneObject: SceneObject,

        /**
         * TODO
         */
        meshes: {

            /**
             * TODO
             */
            mesh: Mesh,

            /**
             * TODO
             */
            geometryBuckets: {

                /**
                 * TODO
                 */
                geometryBucket: GeometryBucket,

                /**
                 * TODO
                 */
                primitiveHits: {

                    /**
                     * TODO
                     */
                    primitive: (KdTrianglePrim | KdLinePrim | KdPointPrim)
                }[]
            }[]
        }[]
    }[]
}