import type { FloatArrayParam } from "@xeokit/math";
import type { KdNode3 } from "./KdNode3";
import type { KdTree3Params } from "./KdTree3Params";
/**
 * A static k-d tree that organizes anything that has a boundary for
 * efficient 3D World-space boundary and frustm searches.
 *
 * See {@link "@xeokit/kdtree3"} for usage.
 */
export declare class KdTree3 {
    #private;
    /**
     * Creates a new KdTree3.
     *
     * @param params
     */
    constructor(params: KdTree3Params);
    get root(): KdNode3;
    insertItem(item: any, aabb: FloatArrayParam): void;
}
