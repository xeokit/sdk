import { KdLinePrim, KdPointPrim, KdTrianglePrim } from "../kdtree3";
import { FloatArrayParam } from "@xeokit/math";
/**
 * Represents an intersecting primitive within a {@link RayPickResult}.
 *
 * See {@link "@xeokit/collision/pick"} for usage.
 */
export interface PrimHit {
    /**
     * Represents the primitive.
     */
    prim: (KdTrianglePrim | KdLinePrim | KdPointPrim);
    /**
     * The 3D World-space coordinates of the ray's intersection with the primitive.
     */
    worldPos: FloatArrayParam;
}