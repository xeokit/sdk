/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:20px;  height:270px" src="https://xeokit.github.io/sdk/docs/assets/3D-Cart.svg"/>
 *
 * # xeokit RTC Coordinate Utilities
 *
 * ---
 *
 * ***Mathematical functions for working with Relative-To-Center (RTC) Cartesian coordinates***
 *
 * ---
 *
 * These utilities provide a set of mathematical functions to work with the **Relative-to-Center (RTC) coordinate system**.
 * RTC is particularly useful for handling large-scale 3D data and transforming coordinates relative to a defined origin (RTC center).
 * These utilities are primarily used internally within the {@link viewer!Viewer | Viewer}.
 *
 * ## Installation
 *
 * To install the necessary package, run the following command:
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * ## Usage Example
 *
 * ```javascript
 * import { worldToRTCPos } from "@xeokit/sdk/rtc";
 *
 * const worldPos = [100000000000.0, 1000000000.0, 1000000000000.0];
 * const rtcCenter = [0, 0, 0];
 * const rtcPos = [0, 0, 0];
 *
 * rtc.worldToRTCPos(worldPos, rtcCenter, rtcPos);
 * // The rtcPos now contains the RTC offset from rtcCenter
 * ```
 *
 * ## Functions
 *
 * @module rtc
 */
import type { FloatArrayParam } from "../math";
import {
  createVec3,
  createVec4,
  dotVec3,
  mulVec3Scalar,
  normalizeVec3,
  setMat4Translation,
  transformVec4,
  translateMat4v
} from "../matrix";
import { getPositions3Center } from "../boundaries";

// Temporary vectors and matrices used internally
const tempVec3a = createVec3();
const tempMat = new Float32Array(16);
const rtcCenterWorld = new Float64Array(4);
const rtcCenterView = new Float64Array(4);

/**
 * The size of the coordinate cells in the Relative-To-Center (RTC) system.
 * This constant determines the scale of tiles in the RTC world coordinate system.
 */
export const RTC_CELL_SIZE = 200;

/**
 * Creates a view matrix that transforms coordinates from RTC to View-space.
 *
 * This matrix allows the transformation of RTC coordinates (relative to a defined origin) into view-space coordinates.
 *
 * @param {FloatArrayParam} viewMat - The View matrix to transform RTC coordinates into view-space.
 * @param {FloatArrayParam} rtcCenter - The RTC center coordinates, which define the origin of the RTC system.
 * @param {FloatArrayParam} [rtcViewMat=tempMat] - Optional parameter to store the resulting RTC view matrix. If not provided, a temporary matrix is used.
 * @returns {FloatArrayParam} The transformed RTC view matrix.
 */
export function createRTCViewMat(viewMat: FloatArrayParam, rtcCenter: FloatArrayParam, rtcViewMat: FloatArrayParam = tempMat): FloatArrayParam {
  rtcCenterWorld[0] = rtcCenter[0];
  rtcCenterWorld[1] = rtcCenter[1];
  rtcCenterWorld[2] = rtcCenter[2];
  rtcCenterWorld[3] = 1;
  transformVec4(viewMat, rtcCenterWorld, rtcCenterView);
  setMat4Translation(viewMat, rtcCenterView, rtcViewMat);
  return rtcViewMat;
}

/**
 * Creates an RTC model matrix from a full-precision modeling matrix and an RTC center.
 *
 * This function transforms a modeling matrix, which may include very large translations, into an RTC model matrix.
 * The RTC model matrix applies transformations relative to the RTC center, which helps with the efficient handling of large-scale data.
 *
 * @param {FloatArrayParam} matrix - The absolute modeling matrix, which may contain large translations.
 * @param {FloatArrayParam} rtcCenter - The RTC center coordinates, used to compute the RTC-relative transformation.
 * @returns {FloatArrayParam} The RTC model matrix.
 */
export const createRTCModelMat = (() => {

  const zeroVec4 = createVec4([0, 0, 0, 1]);
  const tempVec4a = createVec4();

  return (matrix: FloatArrayParam, rtcCenter: FloatArrayParam): FloatArrayParam => {
    const tempVec4 = transformVec4(matrix, zeroVec4, tempVec4a);
    rtcCenter[0] = Math.round(tempVec4[0] / RTC_CELL_SIZE) * RTC_CELL_SIZE;
    rtcCenter[1] = Math.round(tempVec4[1] / RTC_CELL_SIZE) * RTC_CELL_SIZE;
    rtcCenter[2] = Math.round(tempVec4[2] / RTC_CELL_SIZE) * RTC_CELL_SIZE;

    const rtcModelMatrix = matrix.slice();
    translateMat4v(mulVec3Scalar(rtcCenter, -1, tempVec3a), rtcModelMatrix);

    return rtcModelMatrix;
  };
})();

/**
 * Converts a 3D World-space position to RTC coordinates.
 *
 * This function takes a World-space position, which is a double-precision value, and transforms it into RTC coordinates.
 * The result is a double-precision RTC center position, and a single-precision offset from that center.
 *
 * @param {FloatArrayParam} worldPos - The World-space position as an array of `[x, y, z]` coordinates.
 * @param {FloatArrayParam} rtcCenter - The resulting RTC center coordinates.
 * @param {FloatArrayParam} rtcPos - The resulting RTC position (offset from the RTC center).
 */
export function worldToRTCPos(worldPos: FloatArrayParam, rtcCenter: FloatArrayParam, rtcPos: FloatArrayParam) {

  const xHigh = Float32Array.from([worldPos[0]])[0];
  const xLow = worldPos[0] - xHigh;

  const yHigh = Float32Array.from([worldPos[1]])[0];
  const yLow = worldPos[1] - yHigh;

  const zHigh = Float32Array.from([worldPos[2]])[0];
  const zLow = worldPos[2] - zHigh;

  rtcCenter[0] = xHigh;
  rtcCenter[1] = yHigh;
  rtcCenter[2] = zHigh;

  rtcPos[0] = xLow;
  rtcPos[1] = yLow;
  rtcPos[2] = zLow;
}

/**
 * Converts a World-space 3D position to its RTC center.
 *
 * Given a World-space position, this function calculates the nearest RTC center, ensuring that the position aligns with a grid defined by RTC_CELL_SIZE.
 *
 * @param {FloatArrayParam} worldCenter - The World-space position to convert.
 * @param {FloatArrayParam} rtcCenter - The resulting RTC center position.
 * @param {number} [cellSize=200] - The size of each coordinate cell within the RTC coordinate system (default is 200).
 * @returns {FloatArrayParam} The RTC center position.
 */
export function worldToRTCCenter(worldCenter: FloatArrayParam, rtcCenter: FloatArrayParam, cellSize = RTC_CELL_SIZE) {
  rtcCenter[0] = Math.round(worldCenter[0] / cellSize) * cellSize;
  rtcCenter[1] = Math.round(worldCenter[1] / cellSize) * cellSize;
  rtcCenter[2] = Math.round(worldCenter[2] / cellSize) * cellSize;
  return rtcCenter;
}

/**
 * Converts a flat array of World-space positions to RTC positions.
 *
 * This function computes the RTC positions for an entire array of World-space coordinates. It returns both the RTC positions
 * and the RTC center, ensuring the data is aligned with the RTC grid. If conversion is not needed, the function will return `false`.
 *
 * @param {FloatArrayParam} worldPositions - A flat array of World-space 3D positions.
 * @param {FloatArrayParam} rtcPositions - The resulting flat array of RTC positions.
 * @param {FloatArrayParam} rtcCenter - The computed RTC center position.
 * @param {number} [cellSize=200] - The size of each coordinate cell within the RTC system.
 * @returns {boolean} Returns `true` if conversion to RTC was needed, otherwise `false`.
 */
export function worldToRTCPositions(worldPositions: FloatArrayParam, rtcPositions: FloatArrayParam, rtcCenter: FloatArrayParam, cellSize = RTC_CELL_SIZE): boolean {

  const center = getPositions3Center(worldPositions, tempVec3a);

  const rtcCenterX = Math.round(center[0] / cellSize) * cellSize;
  const rtcCenterY = Math.round(center[1] / cellSize) * cellSize;
  const rtcCenterZ = Math.round(center[2] / cellSize) * cellSize;

  for (let i = 0, len = worldPositions.length; i < len; i += 3) {
    rtcPositions[i + 0] = worldPositions[i + 0] - rtcCenterX;
    rtcPositions[i + 1] = worldPositions[i + 1] - rtcCenterY;
    rtcPositions[i + 2] = worldPositions[i + 2] - rtcCenterZ;
  }

  rtcCenter[0] = rtcCenterX;
  rtcCenter[1] = rtcCenterY;
  rtcCenter[2] = rtcCenterZ;

  return rtcCenter[0] !== 0 || rtcCenter[1] !== 0 || rtcCenter[2] !== 0;
}

/**
 * Converts an RTC position back to World-space.
 *
 * Given an RTC position (relative to the RTC center), this function returns the corresponding World-space position.
 *
 * @param {FloatArrayParam} rtcCenter - The RTC center coordinates.
 * @param {FloatArrayParam} rtcPos - The RTC position (offset from the RTC center).
 * @param {FloatArrayParam} worldPos - The resulting World-space position.
 * @returns {FloatArrayParam} The World-space position.
 */
export function rtcToWorldPos(rtcCenter: FloatArrayParam, rtcPos: FloatArrayParam, worldPos: FloatArrayParam): FloatArrayParam {
  worldPos[0] = rtcCenter[0] + rtcPos[0];
  worldPos[1] = rtcCenter[1] + rtcPos[1];
  worldPos[2] = rtcCenter[2] + rtcPos[2];
  return worldPos;
}

/**
 * Calculates the position of a 3D plane relative to the RTC center.
 *
 * This function computes the position of a plane, defined by its distance from the origin and direction vector,
 * relative to the RTC center. It is useful for working with planes in the context of RTC coordinates.
 *
 * @param {number} dist - The distance from the origin to the plane along the plane's normal.
 * @param {FloatArrayParam} dir - The normalized direction vector of the plane.
 * @param {FloatArrayParam} rtcCenter - The RTC center coordinates.
 * @param {FloatArrayParam} rtcPlanePos - The resulting RTC position of the plane.
 * @returns {FloatArrayParam} The position of the plane relative to the RTC center.
 */
export function getPlaneRTCPos(dist: number, dir: FloatArrayParam, rtcCenter: FloatArrayParam, rtcPlanePos: FloatArrayParam): FloatArrayParam {
  const rtcCenterToPlaneDist = dotVec3(dir, rtcCenter) + dist;
  const dirNormalized = normalizeVec3(dir, tempVec3a);
  mulVec3Scalar(dirNormalized, -rtcCenterToPlaneDist, rtcPlanePos);
  return rtcPlanePos;
}
