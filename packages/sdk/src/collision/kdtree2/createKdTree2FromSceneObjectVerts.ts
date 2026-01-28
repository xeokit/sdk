import {createVec4Float64, type Vec4} from "../../math/vector";
import {createMat4Float64,  type Mat4, transformPoint4} from "../../math/matrix";
import type {SceneObject} from "../../scene";

import {
 type AABB2,
  collapseAABB3, createAABB3Float64,
  INSIDE,
  INTERSECT,
  intersectFrustum3AABB3,
  intersectFrustum3Point3,
  OUTSIDE,
  setFrustum3
} from "../../math/boundaries";
import {KdTree2} from "./KdTree2";
import type {KdVertex2} from "./KdVertex2";
import {createSceneObjectAABB3} from "../aabb/createSceneObjectAABB3";

const tempAABB3 = createAABB3Float64();

/**
 * A k-d tree to accelerate intersection and nearest-neighbour tests on the projected
 * 2D canvas positions of {@link scene!SceneObject} geometry vertices.
 *
 * See {@link kdtree2 | @xeokit/sdk/kdtree2} for usage.
 */
export function createKdTree2FromSceneObjectVerts(params: {
  viewMatrix: Mat4,
  projMatrix: Mat4,
  canvasBoundary: AABB2,
  sceneObjects: SceneObject[]
}): KdTree2 {

  const kdTree2D = new KdTree2({
    aabb: params.canvasBoundary
  });

  const viewMatrix = createMat4Float64(params.viewMatrix);
  const projMatrix = createMat4Float64(params.projMatrix);
  const frustum = setFrustum3(viewMatrix, projMatrix);
  const canvasBoundary = params.canvasBoundary;
  const sceneObjects = params.sceneObjects;

  if (sceneObjects) {
    for (let i = 0, len = sceneObjects.length; i < len; i++) {
      insertSceneObject(sceneObjects[i]);
    }
  }

  function insertSceneObject(sceneObject: SceneObject, intersects: number = INTERSECT) {
    // if (intersects !== INSIDE) {
    //   intersects = intersectFrustum3AABB3(frustum, createSceneObjectAABB3(sceneObject, collapseAABB3(tempAABB3)));
    // }
    // if (intersects === OUTSIDE) {
    //   return;
    // }
    // // @ts-ignore
    // getSceneObjectGeometry(sceneObject, (geometryView: GeometryView): boolean | undefined => {
    //   const positionsWorld = geometryView.positionsWorld;
    //   for (let i = 0, len = positionsWorld.length; i < len; i += 3) {
    //     const worldPos = createVec4Float64();
    //     worldPos[0] = positionsWorld[i];
    //     worldPos[1] = positionsWorld[i + 1];
    //     worldPos[2] = positionsWorld[i + 2];
    //     worldPos[3] = 1.0;
    //     if (intersects === INSIDE || intersectFrustum3Point3(frustum, worldPos)) {
    //       insertVertex(sceneObject, worldPos);
    //     }
    //   }
    //   return false;
    // });
  }

  function insertVertex(sceneObject: SceneObject, worldPos: Vec4) {
    const viewPos = createVec4Float64();
    const projPos = createVec4Float64();
    const canvasPos = new Uint16Array(2);
    transformPoint4(viewMatrix, worldPos, viewPos);
    transformPoint4(projMatrix, viewPos, projPos);
    canvasPos[0] = Math.floor((1 + projPos[0] / projPos[3]) * canvasBoundary[2] / 2);
    canvasPos[1] = Math.floor((1 - projPos[1] / projPos[3]) * canvasBoundary[3] / 2);
    kdTree2D.insertItem(<KdVertex2>{
      sceneObject,
      worldPos,
      canvasPos
    }, [canvasPos[0], canvasPos[1], canvasPos[0], canvasPos[1]]);
  }

  return kdTree2D;
}
