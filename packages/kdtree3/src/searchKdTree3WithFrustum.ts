import {Frustum3, INTERSECT, intersectFrustum3AABB3, OUTSIDE} from "@xeokit/boundaries";
import type {KdTree3} from "./KdTree3";
import type {KdNode3} from "./KdNode3";
import type {KdItem3D} from "./KdItem3";

/**
 * Queries a {@link KdTree3} for {@link KdItem3D | KDItems} that intersect
 * a 3D {@link @xeokit/boundaries!Frustum3}.
 *
 * See {@link "@xeokit/kdtree3"} for usage.
 */
export function searchKdTree3WithFrustum(params: {
    kdTree: KdTree3,
    frustum: Frustum3
}): KdItem3D[] {
    const kdTree = params.kdTree;
    const frustum = params.frustum;
    const foundItems: KdItem3D[] = [];

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
