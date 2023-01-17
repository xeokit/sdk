import type { FloatArrayParam } from "./math";
/**
 * Given a view matrix and a relative-to-center (RTC) coordinate origin, returns a view matrix
 * to transform RTC coordinates to View-space.
 */
export declare const createRTCViewMat: (viewMat: FloatArrayParam, rtcCenter: FloatArrayParam, rtcViewMat?: FloatArrayParam) => FloatArrayParam;
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
export declare function worldToRTCPos(worldPos: FloatArrayParam, rtcCenter: FloatArrayParam, rtcPos: FloatArrayParam): void;
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
export declare function worldToRTCPositions(worldPositions: FloatArrayParam, rtcPositions: FloatArrayParam, rtcCenter: FloatArrayParam, cellSize?: number): boolean;
/**
 * Converts an RTC 3D position to World-space.
 *
 * @param rtcCenter Double-precision relative-to-center (RTC) center pos.
 * @param rtcPos Single-precision offset fom that center.
 * @param worldPos The World-space position.
 */
export declare function rtcToWorldPos(rtcCenter: FloatArrayParam, rtcPos: FloatArrayParam, worldPos: FloatArrayParam): FloatArrayParam;
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
export declare function getPlaneRTCPos(dist: number, dir: FloatArrayParam, rtcCenter: FloatArrayParam, rtcPlanePos: FloatArrayParam): FloatArrayParam;
