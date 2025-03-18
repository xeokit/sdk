import type { FloatArrayParam } from "../math";
import type { KdTree3 } from "./KdTree3";
import type { KdItem3D } from "./KdItem3";
/**
 * Queries a {@link KdTree3} for {@link KdItem3D | KDItems} that intersect
 * a 3D ray.
 *
 * See {@link kdtree3 | @xeokit/sdk/kdtree3} for usage.
 */
export declare function searchKdTree3WithRay(params: {
    kdTree: KdTree3;
    origin: FloatArrayParam;
    dir: FloatArrayParam;
}): KdItem3D[];
//# sourceMappingURL=searchKdTree3WithRay.d.ts.map