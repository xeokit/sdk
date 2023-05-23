import {type GeometryView, getSceneObjectGeometry, SceneObject} from "@xeokit/scene";
import {
    INSIDE,
    INTERSECT,
    OUTSIDE,
    setFrustum3,
    intersectFrustum3AABB3,
    intersectFrustum3Point3
} from "@xeokit/boundaries";
import type {FloatArrayParam} from "@xeokit/math";
import {createMat4, createVec4, transformPoint4} from "@xeokit/matrix";
import {KdTree2} from "./KdTree2";
import type {KdVertex2} from "./KdVertex2";

/**
 * A k-d tree to accelerate intersection and nearest-neighbour tests on the projected
 * 2D canvas positions of {@link @xeokit/scene!SceneObject} geometry vertices.
 *
 * See {@link "@xeokit/kd-canvas-verts"} for usage.
 */
export function createKdTree2FromSceneObjectVerts(params: {
    viewMatrix: FloatArrayParam,
    projMatrix: FloatArrayParam,
    canvasBoundary: FloatArrayParam,
    sceneObjects: SceneObject[]
}): KdTree2 {

    const kdTree2D = new KdTree2({
        aabb: params.canvasBoundary
    });

    const viewMatrix = createMat4(params.viewMatrix);
    const projMatrix = createMat4(params.projMatrix);
    const frustum = setFrustum3(viewMatrix, projMatrix);
    const canvasBoundary = params.canvasBoundary;
    const sceneObjects = params.sceneObjects;

    if (sceneObjects) {
        for (let i = 0, len = sceneObjects.length; i < len; i++) {
            insertSceneObject(sceneObjects[i]);
        }
    }

    function insertSceneObject(sceneObject: SceneObject, intersects: number = INTERSECT) {
        if (intersects !== INSIDE) {
            intersects = intersectFrustum3AABB3(frustum, sceneObject.aabb);
        }
        if (intersects === OUTSIDE) {
            return;
        }
        // @ts-ignore
        getSceneObjectGeometry(sceneObject, (geometryView: GeometryView): boolean | undefined => {
                const positionsWorld = geometryView.positionsWorld;
                for (let i = 0, len = positionsWorld.length; i < len; i += 3) {
                    const worldPos = createVec4();
                    worldPos[0] = positionsWorld[i];
                    worldPos[1] = positionsWorld[i + 1];
                    worldPos[2] = positionsWorld[i + 2];
                    worldPos[3] = 1.0;
                    if (intersects === INSIDE || intersectFrustum3Point3(frustum, worldPos)) {
                        insertVertex(sceneObject, worldPos);
                    }
                }
                return false;
            });
    }

    function insertVertex(sceneObject: SceneObject, worldPos: FloatArrayParam) {
        const viewPos = createVec4();
        const projPos = createVec4();
        const canvasPos = new Uint16Array(2);
        transformPoint4(viewMatrix, worldPos, viewPos);
        transformPoint4(projMatrix, viewPos, projPos);
        canvasPos[0] = Math.floor((1 + projPos[0] / projPos[3]) * canvasBoundary[2] / 2);
        canvasPos[1] = Math.floor((1 - projPos[1] / projPos[3]) * canvasBoundary[3] / 2);
        kdTree2D.insertItem(<KdVertex2>{sceneObject, worldPos, canvasPos}, [canvasPos[0], canvasPos[1], canvasPos[0], canvasPos[1]]);
    }

    return kdTree2D;
}
