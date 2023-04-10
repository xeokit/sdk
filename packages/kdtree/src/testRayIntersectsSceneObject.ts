import {GeometryView, getSceneObjectGeometry, SceneObject} from "@xeokit/scene";
import {FloatArrayParam} from "@xeokit/math/math";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "@xeokit/core/constants";
import {
    testAABB3IntersectsLines,
    testAABB3IntersectsPoints,
    testAABB3IntersectsTriangles
} from "@xeokit/math/boundaries";


/**
 * Tests if the given 3D axis-aligned World-space boundary intersects the World-space geometry of the
 * given {@link @xeokit/scene!SceneObject | SceneObject}.
 *
 * Returns ```` true```` if intersection else ````false````.
 *
 * @param aabb
 * @param sceneObject
 */
export function testRayIntersectsSceneObject(origin: FloatArrayParam, dir: FloatArrayParam, sceneObject: SceneObject): boolean {
    return getSceneObjectGeometry(sceneObject, (geometryView: GeometryView): boolean | undefined => {
        // switch (geometryView.geometry.primitive) {
        //     case TrianglesPrimitive:
        //         return testRayIntersectsTriangles(origin, dir, geometryView.positionsWorld, geometryView.geometryBucket.indices);
        //     case LinesPrimitive:
        //         return testAABB3IntersectsLines(aabb, geometryView.positionsWorld, geometryView.geometryBucket.indices);
        //     case PointsPrimitive:
        //         return testAABB3IntersectsPoints(aabb, geometryView.positionsWorld);
        //     default:
        //         return false;
        // }
        return false;
    });
}

