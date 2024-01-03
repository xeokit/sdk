import { Frustum3 } from "@xeokit/boundaries";
import type { KdTree3 } from "./KdTree3";
import type { KdItem3D } from "./KdItem3";
/**
 * Queries a {@link KdTree3} for {@link KdItem3D | KDItems} that intersect
 * a 3D {@link @xeokit/boundaries!Frustum3}.
 *
 * See {@link "@xeokit/collison/kdtree3"} for usage.
 */
export declare function searchKdTree3WithFrustum(params: {
    kdTree: KdTree3;
    frustum: Frustum3;
}): KdItem3D[];
