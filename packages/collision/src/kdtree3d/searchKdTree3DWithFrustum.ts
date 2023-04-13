
import {Frustum, INTERSECT, OUTSIDE, testFrustumIntersectsAABB3} from "@xeokit/math/boundaries";
import {KdItem3D, KdNode3D, KdTree3D} from "./KdTree3D";

/**
 * Queries a {@link KdTree3D} for {@link KdItem3D | KDItems} that intersect
 * a 3D {@link @xeokit/math/boundaries!Frustum}.
 *
 * See {@link "@xeokit/collison/kdtree3d"} for usage.
 */
export function searchKdTree3DWithFrustum(params: {
    kdTree: KdTree3D,
    frustum: Frustum
}): KdItem3D[] {
    const kdTree = params.kdTree;
    const frustum = params.frustum;
    const foundItems = [];

    function visit(node: KdNode3D, isect: number) {
        if (isect === OUTSIDE) {
            return;
        }
        isect = testFrustumIntersectsAABB3(frustum, node.aabb);
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
