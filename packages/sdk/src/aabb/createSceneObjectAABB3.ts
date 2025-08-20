import {type SceneObject} from "../scene";
import {collapseAABB3, createAABB3, expandAABB3, expandAABB3Point3} from "../boundaries";
import {createVec4, transformPoint4} from "../matrix";
import {type FloatArrayParam} from "../math";

const tempVec4a = createVec4();
const tempVec4b = createVec4();
const tempAABB3a = createAABB3();

/**
 * Creates an Axis-Aligned Bounding Box (AABB) for a given scene object.
 *
 * @param {SceneObject} sceneObject - The scene object for which the AABB is created.
 * @param {FloatArrayParam} [aabb=createAABB3()] - The initial AABB to be modified. Defaults to a collapsed AABB.
 * @returns {FloatArrayParam} - The resulting AABB for the scene object.
 */
export function createSceneObjectAABB3(sceneObject: SceneObject, aabb: FloatArrayParam = createAABB3()): FloatArrayParam {
  collapseAABB3(aabb);
  let found = false;
  for (const mesh of sceneObject.meshes) {
    expandAABB3(aabb, getPositionsWorldAABB3(
      mesh.geometry.positionsCompressed,
      mesh.geometry.aabb,
      mesh.matrix,
      tempAABB3a
    ));
    found = true;
  }
  if (!found) {
    (<Float64Array<any>>aabb).set([0, 0, 0, 0, 0, 0]);
  }
  return aabb;
}

function getPositionsWorldAABB3(
  positionsCompressed: FloatArrayParam,
  aabb: FloatArrayParam,
  matrix: FloatArrayParam,
  worldAABB: FloatArrayParam
): FloatArrayParam {

  const xScale = (aabb[3] - aabb[0]) / 65535;
  const xOffset = aabb[0];
  const yScale = (aabb[4] - aabb[1]) / 65535;
  const yOffset = aabb[1];
  const zScale = (aabb[5] - aabb[2]) / 65535;
  const zOffset = aabb[2];

  for (let i = 0, len = positionsCompressed.length; i < len; i += 3) {
    tempVec4a[0] = positionsCompressed[i] * xScale + xOffset;
    tempVec4a[1] = positionsCompressed[i + 1] * yScale + yOffset;
    tempVec4a[2] = positionsCompressed[i + 2] * zScale + zOffset;
    tempVec4a[3] = 1.0;
    transformPoint4(matrix, tempVec4a, tempVec4b);
    expandAABB3Point3(worldAABB, tempVec4b);
  }

  return aabb;
}
