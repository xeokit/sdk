import { INTERSECT, intersectAABB3s, OUTSIDE } from "../boundaries";
/**
 * Queries a {@link KdTree3} for {@link KdItem3D | KDItems} that intersect
 * a 3D axis-aligned bounding box (AABB).
 *
 * See {@link "@xeokit/kdtree3"} for usage.
 */
export function searchKdTree3WithAABB(params) {
    const kdTree = params.kdTree;
    const aabb = params.aabb;
    const foundItems = [];
    function visit(node, isect) {
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
//# sourceMappingURL=searchKdTree3WithAABB.js.map