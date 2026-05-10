import type {Vec3} from "../../../math/vector";

/**
 * Construction parameters for a single {@link AngleMeasurement}.
 *
 * An angle measurement has three world-space anchors. The angle
 * is computed at {@link corner}, between the two arms running to
 * {@link origin} and {@link target}.
 */
export interface AngleMeasurementParams {

  /**
   * Optional id. If omitted, the tool assigns one (numeric, monotonic).
   */
  id?: string;

  /**
   * World-space anchor at one end of the first arm.
   */
  origin: Vec3;

  /**
   * World-space anchor at the *vertex* of the angle — both arms
   * radiate from this point.
   */
  corner: Vec3;

  /**
   * World-space anchor at the end of the second arm.
   */
  target: Vec3;

  /**
   * If `false`, the measurement is created hidden. Default `true`.
   */
  visible?: boolean;

  /**
   * If `false`, hide the two arm wires (origin→corner and
   * corner→target). The dots and angle label keep their own
   * visibility flags. Default `true`.
   */
  wireVisible?: boolean;

  /**
   * If `false`, hide the numeric angle label rendered next to
   * the corner. Default `true`.
   */
  labelsVisible?: boolean;

  /**
   * CSS color for the arm wires and the angle-label background.
   * Default `"#9C27B0"` (purple) to distinguish from
   * `DistanceMeasurement`'s default orange.
   */
  color?: string;
}
