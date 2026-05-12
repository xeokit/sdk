/**
 * AngleMeasurement — overlay widget that paints one-or-more 3D
 * angle measurements on a {@link View}'s canvas.
 *
 * Each measurement is a vertex (corner) and two arms running to
 * an origin and target anchor, with a label showing the interior
 * angle in degrees. Mirrors V2's `AngleMeasurementsPlugin` shape,
 * rendered with SVG + DOM (no second renderer or off-screen
 * canvas).
 *
 * - {@link AngleMeasurementsTool} owns the overlay and the
 *   collection of measurements for one View.
 * - {@link AngleMeasurement} is one measurement.
 * - {@link MouseAngleMeasurementsControl} adds mouse-driven
 *   creation (three clicks → one measurement).
 */

export * from "./AngleMeasurement";
export * from "./AngleMeasurementParams";
export * from "./AngleMeasurementsTool";
export * from "./AngleMeasurementsToolParams";
export * from "./MouseAngleMeasurementsControl";
