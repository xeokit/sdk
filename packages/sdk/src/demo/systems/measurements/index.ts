/**
 * Measurement overlay widgets — UI tools that paint world-space
 * measurements on a {@link View}'s canvas.
 *
 * Each measurement type lives in its own subdirectory and is
 * re-exported here as a namespace so callers can do
 * `import {measurements} from "@xeokit/sdk/demo"` and reach
 * `measurements.distance.DistanceMeasurementTool` or
 * `measurements.angle.AngleMeasurementsTool`, etc.
 *
 * Currently shipped:
 *
 * - {@link distance | distance} — point-to-point 3D distance with
 *   X/Y/Z axis decomposition.
 * - {@link angle | angle} — three-anchor (origin, corner, target)
 *   angle at the corner, in degrees.
 */

export * as distance from "./distance";
export * as angle from "./angle";
