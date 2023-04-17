/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fmath.svg)](https://badge.fury.io/js/%40xeokit%2Fmath)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/math/badge)](https://www.jsdelivr.com/package/npm/@xeokit/math)
 *
 * <img style="padding:0px; padding-top:20px; padding-bottom:20px;  height:270px" src="media://images/3D-Cart.svg"/>
 *
 * # xeokit RTC Coordinate Utilities
 *
 * ---
 *
 * ### *Math functions for working with RTC cartesian coordinates*
 *
 * ---
 *
 * * Math functions for working with relative-to-center (RTC) coordinate systems
 * * Used internally within {@link @xeokit/viewer!Viewer}
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/math/rtc
 * ````
 *
 * ## Usage
 *
 * ````javascript
 * import * as rtc from "@xeokit/math/rtc";
 *
 * const worldPos = [100000000000.0, 1000000000.0, 1000000000000.0];
 * const rtcCenter = [0,0,0];
 * const rtcPos = [0,0,0];
 *
 * rtc.worldToRTCPos(worldPos, rtcCenter, rtcPos);
 *
 * //..
 * ````
 *
 * @module @xeokit/math/rtc
 */

import * as matrix from "./matrix";
import * as math from "./math";
import * as boundaries from "./boundaries";

const tempVec3a = matrix.createVec3();


const tempMat = new Float32Array(16);
const rtcCenterWorld = new Float64Array(4);
const rtcCenterView = new Float64Array(4);

/**
 * Given a view matrix and a relative-to-center (RTC) coordinate origin, returns a view matrix
 * to transform RTC coordinates to View-space.
 */
export function createRTCViewMat(viewMat: math.FloatArrayParam, rtcCenter: math.FloatArrayParam, rtcViewMat: math.FloatArrayParam = tempMat): math.FloatArrayParam {
    rtcCenterWorld[0] = rtcCenter[0];
    rtcCenterWorld[1] = rtcCenter[1];
    rtcCenterWorld[2] = rtcCenter[2];
    rtcCenterWorld[3] = 1;
    matrix.transformVec4(viewMat, rtcCenterWorld, rtcCenterView);
    matrix.setMat4Translation(viewMat, rtcCenterView, rtcViewMat);
    return rtcViewMat;
}

/**
 * Converts a World-space 3D position to RTC.
 *
 * Given a double-precision World-space position, returns a double-precision relative-to-center (RTC) center pos
 * and a single-precision offset fom that center.
 *
 * @param worldPos The World-space position.
 * @param rtcCenter Double-precision relative-to-center (RTC) center pos.
 * @param rtcPos Single-precision offset fom that center.
 */
export function worldToRTCPos(worldPos: math.FloatArrayParam, rtcCenter: math.FloatArrayParam, rtcPos: math.FloatArrayParam) {

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
 * Converts a World-space 3D position to RTC.
 *
 * Given a double-precision World-space position, returns a double-precision relative-to-center (RTC) center.
 *
 * @param worldCenter The World-space position.
 * @param rtcCenter Double-precision relative-to-center (RTC) center pos.
 * @param [cellSize=200] The size of each coordinate cell within the RTC coordinate system.
 */
export function worldToRTCCenter(worldCenter: math.FloatArrayParam, rtcCenter: math.FloatArrayParam, cellSize = 200) {
    rtcCenter[0] = Math.round(worldCenter[0] / cellSize) * cellSize;
    rtcCenter[1] = Math.round(worldCenter[1] / cellSize) * cellSize;
    rtcCenter[2] = Math.round(worldCenter[2] / cellSize) * cellSize;
    return rtcCenter;
}

/**
 * Converts a flat array of double-precision positions to RTC positions.
 *
 * Returns the RTC positions, along with a computed RTC center for those positions.
 *
 * When computing the RTC position, this function uses a modulus operation to ensure that, whenever possible,
 * identical RTC positions are reused for different positions arrays.
 *
 * @param worldPositions Flat array of World-space 3D positions.
 * @param rtcPositions Outputs the computed flat array of 3D RTC positions.
 * @param rtcCenter Outputs the computed double-precision relative-to-center (RTC) center pos.
 * @param [cellSize=200] The size of each coordinate cell within the RTC coordinate system.
 * @returns ````True```` if the positions actually needed conversion to RTC, else ````false````. When
 * ````false````, we can safely ignore the data returned in ````rtcPositions```` and ````rtcCenter````,
 * since ````rtcCenter```` will equal ````[0,0,0]````, and ````rtcPositions```` will contain identical values to ````positions````.
 */
export function worldToRTCPositions(worldPositions: math.FloatArrayParam, rtcPositions: math.FloatArrayParam, rtcCenter: math.FloatArrayParam, cellSize = 200): boolean {

    const center = boundaries.getPositions3Center(worldPositions, tempVec3a);

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

    const rtcNeeded = (rtcCenter[0] !== 0 || rtcCenter[1] !== 0 || rtcCenter[2] !== 0);

    return rtcNeeded;
}

/**
 * Converts an RTC 3D position to World-space.
 *
 * @param rtcCenter Double-precision relative-to-center (RTC) center pos.
 * @param rtcPos Single-precision offset fom that center.
 * @param worldPos The World-space position.
 */
export function rtcToWorldPos(rtcCenter: math.FloatArrayParam, rtcPos: math.FloatArrayParam, worldPos: math.FloatArrayParam): math.FloatArrayParam {
    worldPos[0] = rtcCenter[0] + rtcPos[0];
    worldPos[1] = rtcCenter[1] + rtcPos[1];
    worldPos[2] = rtcCenter[2] + rtcPos[2];
    return worldPos;
}

/**
 * Given a 3D plane defined by distance from origin and direction, and an RTC center position,
 * return a plane position that is relative to the RTC center.
 *
 * @param dist
 * @param dir
 * @param rtcCenter
 * @param rtcPlanePos
 * @returns {*}
 */
export function getPlaneRTCPos(dist: number, dir: math.FloatArrayParam, rtcCenter: math.FloatArrayParam, rtcPlanePos: math.FloatArrayParam) {
    const rtcCenterToPlaneDist = matrix.dotVec3(dir, rtcCenter) + dist;
    const dirNormalized = matrix.normalizeVec3(dir, tempVec3a);
    matrix.mulVec3Scalar(dirNormalized, -rtcCenterToPlaneDist, rtcPlanePos);
    return rtcPlanePos;
}
