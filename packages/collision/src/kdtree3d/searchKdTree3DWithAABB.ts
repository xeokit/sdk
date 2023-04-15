import {FloatArrayParam} from "@xeokit/math/math";
import {INTERSECT, OUTSIDE, intersectAABB3s} from "@xeokit/math/boundaries";
import {KdItem3D, KdNode3D, KdTree3D} from "./KdTree3D";


/**
 * Queries a {@link KdTree3D} for {@link KdItem3D | KDItems} that intersect
 * a 3D axis-aligned bounding box (AABB).
 *
 * See {@link "@xeokit/collison/kdtree3d"} for usage.
 */
export function searchKdTree3DWithAABB(params: {
    kdTree: KdTree3D,
    aabb: FloatArrayParam
}): KdItem3D[] {

    const kdTree = params.kdTree;
    const aabb = params.aabb;
    const foundItems = [];

    function visit(node: KdNode3D, isect: number) {
        if (isect === OUTSIDE) {
            return;
        }
        isect = intersectAABB3s(aabb, node.aabb);
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
