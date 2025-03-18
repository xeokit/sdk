import type { FloatArrayParam } from "../math";
import type { KdTree3 } from "./KdTree3";
import type { KdItem3D } from "./KdItem3";
/**
 * Queries a {@link KdTree3} for {@link KdItem3D | KDItems} that intersect
 * a 3D axis-aligned bounding box (AABB).
 *
 * See {@link kdtree3 | @xeokit/sdk/kdtree3} for usage.
 */
export declare function searchKdTree3WithAABB(params: {
    kdTree: KdTree3;
    aabb: FloatArrayParam;
}): KdItem3D[];
//# sourceMappingURL=searchKdTree3WithAABB.d.ts.map