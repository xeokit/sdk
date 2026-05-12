import type {View} from "../../../../viewer";
import type {PickStrategy} from "../../../../picking";

/**
 * Construction parameters for {@link DistanceMeasurementTool}.
 */
export interface DistanceMeasurementToolParams {

  /**
   * The {@link View} the tool paints into. The widget mounts an
   * absolutely-positioned overlay over the View's canvas.
   */
  view: View;

  /**
   * Optional override for the parent of the overlay DOM. Defaults
   * to the View canvas's parent element so the overlay shares its
   * stacking context (and any letterboxing applied to the canvas
   * doesn't shift the wires off-axis).
   */
  container?: HTMLElement;

  /**
   * Picker used by {@link MouseDistanceMeasurementsControl} to turn
   * canvas clicks into world-space anchors, including snap-to-vertex
   * / snap-to-edge when supported. If omitted the tool builds a
   * BVH-only picker from the View's Scene — supply a
   * {@link "../../../picking".RoutingPickStrategy} to get snap.
   */
  picker?: PickStrategy;

  /**
   * Initial visibility. When `false`, all measurements stay loaded
   * but the entire overlay is hidden. Default `true`.
   */
  visible?: boolean;

  /**
   * Default {@link DistanceMeasurementParams.color} for measurements
   * created without an explicit color.
   */
  defaultColor?: string;
}
