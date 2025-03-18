import { INTERSECT, OUTSIDE } from "../boundaries";
/**
 * Queries a {@link KdTree3} for {@link KdItem3D | KDItems} that intersect
 * a 3D ray.
 *
 * See {@link "@xeokit/kdtree3"} for usage.
 */
export function searchKdTree3WithRay(params) {
    const kdTree = params.kdTree;
    const origin = params.origin;
    const dir = params.dir;
    const foundItems = [];
    function testRayIntersectsAABB3(origin, dir, aabb) {
        return 0;
    }
    function visit(node, isect) {
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
//# sourceMappingURL=searchKdTree3WithRay.js.map