import {FloatArrayParam} from "@xeokit/math/math";
import {INTERSECT, OUTSIDE} from "@xeokit/math/boundaries";
import {KdItem3D, KdNode3D, KdTree3D} from "./KdTree3D";


/**
 * Queries a {@link KdTree3D} for {@link KdItem3D | KDItems} that intersect
 * a 3D ray.
 *
 * See {@link "@xeokit/collison/kdtree3d"} for usage.
 */
export function searchKdTree3DWithRay(params: {
    kdTree: KdTree3D,
    origin: FloatArrayParam,
    dir: FloatArrayParam
}): any[] {

    const kdTree = params.kdTree;
    const origin = params.origin;
    const dir = params.dir;
    const foundItems = [];

    function testRayIntersectsAABB3(origin: FloatArrayParam, dir: FloatArrayParam, aabb: FloatArrayParam) {
        return 0;
    }

    function visit(node: KdNode3D, isect: number) {
        if (isect === OUTSIDE) {
            return;
        }
        isect = testRayIntersectsAABB3(origin, dir, node.aabb);
        if (isect === OUTSIDE) {
            return;
        }
        const items = node.items;
        if (items && items.length > 0) {
            for (let i = 0, len = items.length; i < len; i++) {
                foundItems.push(items[i].item);
            }
        }
        if (node.left) {
            visit(node.left, isect);
        }
        if (node.right) {
            visit(node.right, isect);
        }
    }

    visit(kdTree.root, INTERSECT);
    return foundItems;
}
