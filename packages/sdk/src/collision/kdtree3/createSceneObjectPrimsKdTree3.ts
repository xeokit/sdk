import {collapseAABB3, createAABB3Float64, expandAABB3} from "../../math/boundaries";
import type {SceneGeometry, SceneObject} from "../../scene";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../constants";
import type {FloatArrayParam} from "../../math";
import type {KdSceneObjectPrim} from "./KdSceneObjectPrim";
import {KdTree3} from "./KdTree3";
import {createSceneObjectAABB3} from "../aabb/createSceneObjectAABB3";

const tempAABB3a = createAABB3Float64();
const tempAABB3b = createAABB3Float64();

/**
 * k-d tree built by {@link createSceneObjectPrimsKdTree3}.
 */
export class SceneObjectsPrimsKdTree3 extends KdTree3 {
}

/**
 * Creates a KdTree3 that indexes the primitives belonging to the given SceneObjects in 3D World-space.
 *
 * See {@link kdtree3 | @xeokit/sdk/kdtree3} for usage.
 */
export function createSceneObjectPrimsKdTree3(sceneObjects: SceneObject[]): SceneObjectsPrimsKdTree3 {

  const tempAABBInt16 = new Int16Array(6);

  function insertPoint(sceneObject: SceneObject, sceneGeometry: SceneGeometry, positions: FloatArrayParam, a: number, kdTree: KdTree3) {
    const ax = positions[(a * 3)];
    const ay = positions[(a * 3) + 1];
    const az = positions[(a * 3) + 2];
    const aabb = tempAABBInt16;
    aabb[0] = aabb[3] = ax;
    aabb[1] = aabb[4] = ay;
    aabb[2] = aabb[5] = az;
    kdTree.insertItem(<KdSceneObjectPrim>{sceneObject, sceneGeometry, prim: {a}}, aabb);
  }

  function insertLine(sceneObject: SceneObject, sceneGeometry: SceneGeometry, positions: FloatArrayParam, a: number, b: number, kdTree: KdTree3) {
    const ax = positions[(a * 3)];
    const ay = positions[(a * 3) + 1];
    const az = positions[(a * 3) + 2];
    const bx = positions[(b * 3)];
    const by = positions[(b * 3) + 1];
    const bz = positions[(b * 3) + 2];
    const aabb = tempAABBInt16;
    aabb[0] = Math.min(ax, bx);
    aabb[1] = Math.min(ay, by);
    aabb[2] = Math.min(az, bz);
    aabb[3] = Math.max(ax, bx);
    aabb[4] = Math.max(ay, by);
    aabb[5] = Math.max(az, bz);
    kdTree.insertItem(<KdSceneObjectPrim>{sceneObject, sceneGeometry, prim: {a, b}}, aabb);
  }

  function insertTriangle(sceneObject: SceneObject, sceneGeometry: SceneGeometry, positions: FloatArrayParam, a: number, b: number, c: number, kdTree: KdTree3) {
    const ax = positions[(a * 3)];
    const ay = positions[(a * 3) + 1];
    const az = positions[(a * 3) + 2];
    const bx = positions[(b * 3)];
    const by = positions[(b * 3) + 1];
    const bz = positions[(b * 3) + 2];
    const cx = positions[(c * 3)];
    const cy = positions[(c * 3) + 1];
    const cz = positions[(c * 3) + 2];
    const aabb = tempAABBInt16;
    aabb[0] = Math.min(ax, bx, cx);
    aabb[1] = Math.min(ay, by, cy);
    aabb[2] = Math.min(az, bz, cz);
    aabb[3] = Math.max(ax, bx, cx);
    aabb[4] = Math.max(ay, by, cy);
    aabb[5] = Math.max(az, bz, cz);
    kdTree.insertItem(<KdSceneObjectPrim>{sceneObject, sceneGeometry, prim: {a, b, c}}, aabb);
  }

  collapseAABB3(tempAABB3a);

  for (let i = 0, len = sceneObjects.length; i < len; i++) {
    const sceneObject = sceneObjects[i];
    expandAABB3(tempAABB3a, createSceneObjectAABB3(sceneObject,tempAABB3b));
  }
  const kdTree = new SceneObjectsPrimsKdTree3({
    aabb: tempAABB3a
  });
  // for (let i = 0, len = sceneObjects.length; i < len; i++) {
  //   const sceneObject = sceneObjects[i];
  //   getSceneObjectGeometry(sceneObject, (geometryView: GeometryView) => {
  //     const sceneGeometry = geometryView.geometry;
  //     const positionsWorld = geometryView.positionsWorld; // <-- Can be expensive
  //     const indices = sceneGeometry.indices;
  //     switch (sceneGeometry.primitive) {
  //       case PointsPrimitive:
  //         for (let j = 0, lenj = positionsWorld.length / 3; j < lenj; j++) {
  //           insertPoint(sceneObject, sceneGeometry, positionsWorld, j, kdTree);
  //         }
  //         break;
  //       case TrianglesPrimitive:
  //         if (indices) {
  //           for (let j = 0, lenj = indices.length; j < lenj; j += 3) {
  //             insertTriangle(sceneObject, sceneGeometry, positionsWorld, indices[j], indices[j + 1], indices[j + 2], kdTree);
  //           }
  //         }
  //         break;
  //       case LinesPrimitive:
  //         if (indices) {
  //           for (let j = 0, lenj = indices.length; j < lenj; j += 2) {
  //             insertLine(sceneObject, sceneGeometry, positionsWorld, indices[j], indices[j + 1], kdTree);
  //           }
  //         }
  //         break;
  //     }
  //     return true;
  //
  //   });
  // }
  return kdTree;
}
