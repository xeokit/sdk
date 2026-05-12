import type {Vec3} from "../../../../math/vector";

/**
 * Construction parameters for a single {@link DistanceMeasurement}.
 *
 * Caller supplies the two world-space anchors; the plugin computes
 * the length and the X/Y/Z component decomposition each frame.
 */
export interface DistanceMeasurementParams {

  /**
   * Optional id. If omitted, the plugin assigns one (numeric, monotonic).
   */
  id?: string;

  /**
   * World-space anchor at the *origin* end of the measurement.
   */
  origin: Vec3;

  /**
   * World-space anchor at the *target* end of the measurement.
   */
  target: Vec3;

  /**
   * If `false`, the measurement is created hidden. Default `true`.
   */
  visible?: boolean;

  /**
   * If `false`, hide the diagonal length wire (the orange one between
   * the two anchors). The axis-decomposition wires keep their own
   * visibility flag. Default `true`.
   */
  wireVisible?: boolean;

  /**
   * If `false`, hide the X/Y/Z axis-decomposition wires (red/green/
   * blue) and their length labels. Default `true`.
   */
  axisVisible?: boolean;

  /**
   * If `false`, hide the numeric labels on the wires. Default `true`.
   */
  labelsVisible?: boolean;

  /**
   * CSS color for the diagonal length wire and its label background.
   * Default `"#FFA500"` (orange).
   */
  color?: string;
}
