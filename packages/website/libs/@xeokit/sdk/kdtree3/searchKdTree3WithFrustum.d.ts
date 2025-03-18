import { Frustum3 } from "../boundaries";
import type { KdTree3 } from "./KdTree3";
import type { KdItem3D } from "./KdItem3";
/**
 * Queries a {@link KdTree3} for {@link KdItem3D | KDItems} that intersect
 * a 3D {@link boundaries!Frustum3}.
 *
 * See {@link kdtree3 | @xeokit/sdk/kdtree3} for usage.
 */
export declare function searchKdTree3WithFrustum(params: {
    kdTree: KdTree3;
    frustum: Frustum3;
}): KdItem3D[];
//# sourceMappingURL=searchKdTree3WithFrustum.d.ts.map