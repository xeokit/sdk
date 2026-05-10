/**
 * DistanceMeasurement — overlay widget that paints one-or-more 3D
 * distance measurements on a {@link View}'s canvas.
 *
 * Each measurement renders the diagonal length wire (orange) plus
 * the X/Y/Z axis decomposition (red/green/blue) and a label per
 * wire. Mirrors V2's `DistanceMeasurementsPlugin` shape, rendered
 * with SVG + DOM (no second renderer or off-screen canvas).
 *
 * - {@link DistanceMeasurementTool} owns the overlay and the
 *   collection of measurements for one View.
 * - {@link DistanceMeasurement} is one measurement.
 * - {@link MouseDistanceMeasurementsControl} adds mouse-driven
 *   creation (two clicks → one measurement).
 */

export * from "./DistanceMeasurement";
export * from "./DistanceMeasurementParams";
export * from "./DistanceMeasurementTool";
export * from "./DistanceMeasurementToolParams";
export * from "./MouseDistanceMeasurementsControl";
