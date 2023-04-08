import {SceneObject} from "@xeokit/scene";
import {FloatArrayParam, IntArrayParam} from "@xeokit/math/math";
import {
    Frustum,
    testFrustumIntersectsLines,
    testFrustumIntersectsPoints,
    testFrustumIntersectsTriangles
} from "@xeokit/math/boundaries";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "@xeokit/core/constants";

/**
 * Tests if the given World-space {@link @math/boundaries!Frustum | Frustum} intersects the World-space geometry of the
 * given {@link @xeokit/scene!SceneObject | SceneObject}.
 *
 * Returns ```` true```` if intersection else ````false````.
 *
 * @param frustum
 * @param sceneObject
 */
export function frustumIntersectsSceneObject(frustum: Frustum, sceneObject: SceneObject): boolean {
    return sceneObject.getGeometry((primitiveType: number, positions: FloatArrayParam, indices: IntArrayParam): boolean | undefined => {
        switch (primitiveType) {
            case TrianglesPrimitive:
                return testFrustumIntersectsTriangles(frustum, positions, indices);
            case LinesPrimitive:
                return testFrustumIntersectsLines(frustum, positions, indices);
            case PointsPrimitive:
                return testFrustumIntersectsPoints(frustum, positions);
            default:
                return false;
        }
    });
}
