import {createMat4Float64, mulMat4} from "../../base/math/matrix";
import type {CoordinateSystem} from "./CoordinateSystem";
import {createCoordinateSystemTransform} from "./createCoordinateSystemTransform";

/**
 * Returns the baked transformation matrix for a given SceneMesh, which is the result of multiplying
 * the mesh's own matrix with the matrices of all its parent SceneTransforms, if any.
 *
 * If a target coordinate system is provided, the resulting matrix is also transformed to
 * that coordinate system. If no target coordinate system is provided, the resulting matrix is
 * in the same coordinate system as the SceneMesh's SceneModel.
 *
 * @param sceneMesh
 * @param targetCoordinateSystem
 */
export function getMeshWorldMatrix(sceneMesh: any, targetCoordinateSystem?: CoordinateSystem): any {
  const matrices: any[] = [];
  matrices.push(sceneMesh.matrix);

  let parentTransform = sceneMesh.parentTransform || null;
  while (parentTransform) {
    matrices.push(parentTransform.matrix);
    parentTransform = parentTransform.parentTransform || null;
  }

  let result: any;
  if (matrices.length === 1) {
    result = sceneMesh.matrix;
  } else {
    result = createMat4Float64(matrices[matrices.length - 1]);
    for (let i = matrices.length - 2; i >= 0; i--) {
      result = mulMat4(result, matrices[i], createMat4Float64());
    }
  }

  if (!targetCoordinateSystem) {
    return result;
  }

  const sourceCoordinateSystem = sceneMesh.model.coordinateSystem;

  const coordTransform = createCoordinateSystemTransform(
    sourceCoordinateSystem,
    targetCoordinateSystem,
    createMat4Float64()
  );

  return mulMat4(coordTransform, result, createMat4Float64());
}
