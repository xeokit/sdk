/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:20px;  height:270px" src="../../assets/3D-Cart.svg"/>
 *
 * # xeokit RTC Coordinate Math Utilities
 *
 * ---
 *
 * ***Mathematical functions for working with Relative-To-Center (RTC) Cartesian coordinates***
 *
 * ---
 *
 * These utilities provide a set of mathematical functions to work with the **Relative-to-Center (RTC) coordinate system**.
 * RTC is particularly useful for handling large-scale 3D data and transforming coordinates relative to a defined origin (RTC center).
 * These utilities are primarily used internally within the {@link viewing!viewer.Viewer | Viewer}.
 *
 * ## Installation
 *
 * To install the necessary package, run the following command:
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * ## Usage
 *
 * ```javascript
 * import { worldToRTCPos } from "@xeokit/sdk/base/math/rtc";
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
import {
  createVec3Float64,
  createVec4Float64,
  dotVec3,
  mulVec3Scalar,
  normalizeVec3,
  subVec3,
  type Vec3
} from "./vector";
import {
  createMat4Float64,
  type Mat4,
  setMat4Translation,
  transformVec4
} from "./matrix";
import {getPositions3Center} from "./boundaries";
import type {FloatArrayParam} from "./index";

// Temporary vectors and matrices used internally
const tempVec3a = createVec3Float64();
const tempMat = createMat4Float64();
const rtcCenterWorld = createVec4Float64();
const rtcCenterView = createVec4Float64();

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
 * @param  viewMat - The View matrix to transform RTC coordinates into view-space.
 * @param  rtcCenter - The RTC center coordinates, which define the origin of the RTC system.
 * @param  [rtcViewMat=tempMat] - Optional parameter to store the resulting RTC view matrix. If not provided, a temporary matrix is used.
 * @returns  The transformed RTC view matrix.
 */
export function createRTCViewMat(
  viewMat: Mat4,
  rtcCenter: Vec3,
  rtcViewMat: Mat4 = tempMat
): Mat4 {
  const [x, y, z] = rtcCenter;
  if (x === 0 && y === 0 && z === 0) {
    // @ts-ignore
    rtcViewMat.set(viewMat);
    return rtcViewMat;
  }
  // @ts-ignore
  rtcCenterWorld.set([x, y, z, 1]);
  transformVec4(viewMat, rtcCenterWorld, rtcCenterView);
  tempVec3a[0] = rtcCenterView[0];
  tempVec3a[1] = rtcCenterView[1];
  tempVec3a[2] = rtcCenterView[2];
  setMat4Translation(viewMat, tempVec3a, rtcViewMat);

  return rtcViewMat;
}


/**
 * Creates an RTC model matrix from a full-precision modeling matrix and an RTC center.
 *
 * This function transforms a modeling matrix, which may include very large translations, into an RTC model matrix.
 * The RTC model matrix applies transformations relative to the RTC center, which helps with the efficient handling of large-scale data.
 *
 * @param  matrix - The absolute modeling matrix, which may contain large translations.
 * @param  rtcCenter - The RTC center coordinates, used to compute the RTC-relative transformation.
 * @param  rtcModelMatrix - Returns the RTC model matrix.
 * @returns  The RTC model matrix.
 */
// export const createRTCModelMatOLD = (() => {
//
//   const zeroVec4 = createVec4Float64([0, 0, 0, 1]);
//   const tempVec4a = createVec4Float64();
//
//   return (matrix: Mat4, rtcCenter: Vec3, rtcModelMatrix?: Mat4): Mat4 => {
//
//     const matCenter = transformVec4(matrix, zeroVec4, tempVec4a);
//
//     rtcCenter[0] = Math.round(matCenter[0] / RTC_CELL_SIZE) * RTC_CELL_SIZE;
//     rtcCenter[1] = Math.round(matCenter[1] / RTC_CELL_SIZE) * RTC_CELL_SIZE;
//     rtcCenter[2] = Math.round(matCenter[2] / RTC_CELL_SIZE) * RTC_CELL_SIZE;
//
//     rtcModelMatrix = rtcModelMatrix || matrix.slice();
//
//    // setMat4Translation(matrix, rtcCenter, rtcModelMatrix); // This seems OK
//
//  //  translateMat4v(mulVec3Scalar(rtcCenter, -1, tempVec3a), rtcModelMatrix); // This seems OK
//
//    translateMat4v(subVec3(matCenter, rtcCenter, tempVec3a), rtcModelMatrix);
//
//     return rtcModelMatrix;
//   };
// })();

export const createRTCModelMat =  (matrix: Mat4, rtcCenter: Vec3, rtcModelMatrix?: Mat4): Mat4 => {

    const matCenter = matrix.slice(12, 15);

    const tileSize = getRTCTileSize(matCenter as Vec3);

    rtcCenter[0] = Math.round(matCenter[0] / tileSize) * tileSize;
    rtcCenter[1] = Math.round(matCenter[1] / tileSize) * tileSize;
    rtcCenter[2] = Math.round(matCenter[2] / tileSize) * tileSize;

    rtcModelMatrix = rtcModelMatrix || createMat4Float64(matrix);

    // @ts-ignore
    rtcModelMatrix.set(subVec3(matCenter, rtcCenter, createVec3Float64()), 12);

    return rtcModelMatrix;
  };

/**
 * Converts a 3D World-space position to RTC coordinates.
 *
 * This function takes a World-space position, which is a double-precision value, and transforms it into RTC coordinates.
 * The result is a double-precision RTC center position, and a single-precision offset from that center.
 *
 * @param  worldPos - The World-space position as an array of `[x, y, z]` coordinates.
 * @param  rtcCenter - The resulting RTC center coordinates.
 * @param  rtcPos - The resulting RTC position (offset from the RTC center).
 */
export function worldToRTCPos(worldPos: Vec3, rtcCenter: Vec3, rtcPos: Vec3)  {

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
 * @param  worldCenter - The World-space position to convert.
 * @param  rtcCenter - The resulting RTC center position.
 * @param  tileSize - The size of the RTC tile, which determines the grid spacing for the RTC centers.
 * @returns  The RTC center position.
 */
export function worldToRTCCenter(worldCenter: Vec3, rtcCenter: Vec3, tileSize: number): Vec3 {
  rtcCenter[0] = Math.round(worldCenter[0] / tileSize) * tileSize;
  rtcCenter[1] = Math.round(worldCenter[1] / tileSize) * tileSize;
  rtcCenter[2] = Math.round(worldCenter[2] / tileSize) * tileSize;

  return rtcCenter;
}

/**
 * RTC tile size in meters:
 *  - decreases with world magnitude (inverse-ish)
 *  - snaps to a small set of values (1–2–5 per bucket)
 *  - changes only every `bucketDecades` decades (avoids fragmentation)
 *  - capped to maintain sub-millimeter jitter in float32 offsets
 */
export function getRTCTileSize(worldPos: Vec3): number {
  const mag = Math.max(
    Math.abs(worldPos[0]),
    Math.abs(worldPos[1]),
    Math.abs(worldPos[2])
  );

  // Your existing default near origin
  if (mag === 0) return 1000;

  // --- knobs (pick once, keep stable) ---
  const baseTile = 200;        // tile size around mag ~ 1m
  const bucketDecades = 4;     // 3 => size changes every 1000x magnitude
  const allowedError = 0.0005; // 0.5mm target worst-case at half tile (sub-mm)
  const maxTile = allowedError * 16777216; // allowedError * 2^24 ≈ 8388.608m

  // Bucket magnitude by decades (coarse)
  const exp10 = Math.floor(Math.log10(mag));
  const bucketedExp10 = exp10 - ((exp10 % bucketDecades) + bucketDecades) % bucketDecades;

  const decadeBase = Math.pow(10, bucketedExp10);
  const m = mag / decadeBase; // typically in [1, 10)

  // Snap to 1–2–5 steps (only 3 sizes per bucket)
  // (thresholds chosen to reduce twitch near boundaries)
  let step: 1 | 2 | 5;
  if (m < 2.5) step = 1;
  else if (m < 7.5) step = 2;
  else step = 5;

  // Slow inverse scaling: only shrink per *bucket*, not per decade
  let tileSize = baseTile / decadeBase / step;

  // Cap so offsets stay sub-mm-safe (and avoid absurdly huge tiles)
  if (tileSize > maxTile) tileSize = maxTile;

  // Optional: avoid absurdly tiny tiles (can help scene rep)
  const minTile = 20; // 0.05mm (tweak if needed)
  if (tileSize < minTile) tileSize = minTile;

  return tileSize;
}


/**
 * Converts a flat array of World-space positions to RTC positions.
 *
 * This function computes the RTC positions for an entire array of World-space coordinates. It returns both the RTC positions
 * and the RTC center, ensuring the data is aligned with the RTC grid. If conversion is not needed, the function will return `false`.
 *
 * @param  worldPositions - A flat array of World-space 3D positions.
 * @param  rtcPositions - The resulting flat array of RTC positions.
 * @param  rtcCenter - The computed RTC center position.
  * @returns {boolean} Returns `true` if conversion to RTC was needed, otherwise `false`.
 */
export function worldToRTCPositions(worldPositions: FloatArrayParam, rtcPositions: FloatArrayParam, rtcCenter: Vec3): boolean {

  const center = getPositions3Center(worldPositions, tempVec3a);

  const tileSize = getRTCTileSize(center);

  const rtcCenterX = Math.round(center[0] / tileSize) * tileSize;
  const rtcCenterY = Math.round(center[1] / tileSize) * tileSize;
  const rtcCenterZ = Math.round(center[2] / tileSize) * tileSize;

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
 * @param  rtcCenter - The RTC center coordinates.
 * @param  rtcPos - The RTC position (offset from the RTC center).
 * @param  worldPos - The resulting World-space position.
 * @returns  The World-space position.
 */
export function rtcToWorldPos(rtcCenter: Vec3, rtcPos: Vec3, worldPos: Vec3): Vec3 {
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
 * @param  dir - The normalized direction vector of the plane.
 * @param  rtcCenter - The RTC center coordinates.
 * @param  rtcPlanePos - The resulting RTC position of the plane.
 * @returns  The position of the plane relative to the RTC center.
 */
export function getPlaneRTCPos(dist: number, dir: Vec3, rtcCenter: Vec3, rtcPlanePos: Vec3): Vec3 {
  const rtcCenterToPlaneDist = dotVec3(dir, rtcCenter) + dist;
  const dirNormalized = normalizeVec3(dir, tempVec3a);
  mulVec3Scalar(dirNormalized, -rtcCenterToPlaneDist, rtcPlanePos);
  return rtcPlanePos;
}
