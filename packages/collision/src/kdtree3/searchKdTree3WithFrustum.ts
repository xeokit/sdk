
import {Frustum3, INTERSECT, OUTSIDE, intersectFrustum3AABB3} from "@xeokit/math/boundaries";
import {KdTree3} from "./KdTree3";
import {KdNode3} from "./KdNode3";
import {KdItem3D} from "./KdItem3";

/**
 * Queries a {@link KdTree3} for {@link KdItem3D | KDItems} that intersect
 * a 3D {@link @xeokit/math/boundaries!Frustum3}.
 *
 * See {@link "@xeokit/collison/kdtree3"} for usage.
 */
export function searchKdTree3WithFrustum(params: {
    kdTree: KdTree3,
    frustum: Frustum3
}): KdItem3D[] {
    const kdTree = params.kdTree;
    const frustum = params.frustum;
    const foundItems = [];

    function visit(node: KdNode3, isect: number) {
        if (isect === OUTSIDE) {
            return;
        }
        isect = intersectFrustum3AABB3(frustum, node.aabb);
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
