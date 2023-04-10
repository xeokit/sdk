import {GeometryView, getSceneObjectGeometry, SceneObject} from "@xeokit/scene";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "@xeokit/core/constants";
import {
    Frustum,
    testFrustumIntersectsLines,
    testFrustumIntersectsPoints,
    testFrustumIntersectsTriangles
} from "@xeokit/math/boundaries";

/**
 * Tests if the given World-space {@link @math/boundaries!Frustum | Frustum} intersects the World-space geometry of the
 * given {@link @xeokit/scene!SceneObject | SceneObject}.
 *
 * Returns ```` true```` if intersection else ````false````.
 *
 * @param frustum
 * @param sceneObject
 */
export function testFrustumIntersectsSceneObject(frustum: Frustum, sceneObject: SceneObject): boolean {
    return getSceneObjectGeometry(sceneObject, (geometryView: GeometryView): boolean | undefined => {
        switch (geometryView.object.meshes[geometryView.meshIndex].geometry.primitive) {
            case TrianglesPrimitive:
                return testFrustumIntersectsTriangles(frustum, geometryView.positionsWorld, geometryView.geometryBucket.indices);
            case LinesPrimitive:
                return testFrustumIntersectsLines(frustum, geometryView.positionsWorld, geometryView.geometryBucket.indices);
            case PointsPrimitive:
                return testFrustumIntersectsPoints(frustum, geometryView.positionsWorld);
            default:
                return false;
        }
    });
}
