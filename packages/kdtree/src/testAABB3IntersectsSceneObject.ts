import {SceneObject} from "@xeokit/scene";
import {FloatArrayParam, IntArrayParam} from "@xeokit/math/math";
import {
    testAABB3IntersectsLines,
    testAABB3IntersectsPoints,
    testAABB3IntersectsTriangles,
    AABBIntersectsTriangles,
} from "@xeokit/math/boundaries";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "@xeokit/core/constants";

/**
 * Tests if the given 3D axis-aligned World-space boundary intersects the World-space geometry of the
 * given {@link @xeokit/scene!SceneObject | SceneObject}.
 *
 * Returns ```` true```` if intersection else ````false````.
 *
 * @param aabb
 * @param sceneObject
 */
export function testAABB3IntersectsSceneObject(aabb: FloatArrayParam, sceneObject: SceneObject): boolean {
    return sceneObject.getGeometry((primitiveType: number, positions: FloatArrayParam, indices: IntArrayParam): boolean | undefined => {
        if (AABBIntersectsTriangles(aabb, positions, indices)) {
            switch (primitiveType) {
                case TrianglesPrimitive:
                    return testAABB3IntersectsTriangles(aabb, positions, indices);
                case LinesPrimitive:
                    return testAABB3IntersectsLines(aabb, positions, indices);
                case PointsPrimitive:
                    return testAABB3IntersectsPoints(aabb, positions);
                default:
                    return false;
            }
        }
    });
}

