import type {FloatArrayParam} from "../math";
import {createMat4Float64, createVec3Float64, type Mat4} from "../matrix";
import {CoordinateSystem} from "./CoordinateSystem";

const tempMat3a = createMat4Float64(); // e.g., transposed viewer basis
const tempMat3b = createMat4Float64();// result of matrix multiplication
const tempVec3a = createVec3Float64(); // delta origin
const tempVec3b = createVec3Float64(); // transformed delta origin

/**
 * Computes a 4x4 transformation matrix to convert coordinates from one CoordinateSystem to another.
 * Uses provided result buffers to avoid unnecessary allocations.
 */
export function createCoordinateSystemTransform(
  model: CoordinateSystem,
  viewer: CoordinateSystem,
  outMat4: Mat4,
): Mat4 {

  const modelBasis = model.basis;
  const viewerBasis = viewer.basis;

  transpose3(viewerBasis, tempMat3a);
  multiply3x3(tempMat3a, modelBasis, tempMat3b);

  const scale = (model.scaleToMeters ?? unitScale(model.units)) /
    (viewer.scaleToMeters ?? unitScale(viewer.units));

  tempVec3a[0] = (model.origin[0] - viewer.origin[0]) * scale;
  tempVec3a[1] = (model.origin[1] - viewer.origin[1]) * scale;
  tempVec3a[2] = (model.origin[2] - viewer.origin[2]) * scale;

  apply3x3(tempMat3a, tempVec3a, tempVec3b);

  outMat4[0] = tempMat3b[0] * scale;
  outMat4[1] = tempMat3b[1] * scale;
  outMat4[2] = tempMat3b[2] * scale;
  outMat4[3] = 0;

  outMat4[4] = tempMat3b[3] * scale;
  outMat4[5] = tempMat3b[4] * scale;
  outMat4[6] = tempMat3b[5] * scale;
  outMat4[7] = 0;

  outMat4[8] = tempMat3b[6] * scale;
  outMat4[9] = tempMat3b[7] * scale;
  outMat4[10] = tempMat3b[8] * scale;
  outMat4[11] = 0;

  outMat4[12] = tempVec3b[0];
  outMat4[13] = tempVec3b[1];
  outMat4[14] = tempVec3b[2];
  outMat4[15] = 1;

  return outMat4;
}

function transpose3(m: FloatArrayParam, out: FloatArrayParam): void {
  out[0] = m[0];
  out[1] = m[3];
  out[2] = m[6];
  out[3] = m[1];
  out[4] = m[4];
  out[5] = m[7];
  out[6] = m[2];
  out[7] = m[5];
  out[8] = m[8];
}

function multiply3x3(a: FloatArrayParam, b: FloatArrayParam, out: FloatArrayParam): void {
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      out[col * 3 + row] =
        a[0 * 3 + row] * b[col * 3 + 0] +
        a[1 * 3 + row] * b[col * 3 + 1] +
        a[2 * 3 + row] * b[col * 3 + 2];
    }
  }
}

function apply3x3(m: FloatArrayParam, v: FloatArrayParam, out: FloatArrayParam): void {
  out[0] = m[0] * v[0] + m[3] * v[1] + m[6] * v[2];
  out[1] = m[1] * v[0] + m[4] * v[1] + m[7] * v[2];
  out[2] = m[2] * v[0] + m[5] * v[1] + m[8] * v[2];
}

function unitScale(unit: CoordinateSystem['units']): number {
  switch (unit) {
    case 'meters':
      return 1;
    case 'millimeters':
      return 0.001;
    case 'inches':
      return 0.0254;
    case 'feet':
      return 0.3048;
  }
}
