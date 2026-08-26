import type {View} from "../../../viewing/viewer";
import type {PickStrategy} from "../../../spatial/picking";

/**
 * Construction parameters for {@link AngleMeasurementsTool}.
 */
export interface AngleMeasurementsToolParams {

  /**
   * The {@link viewing!viewer.View | View} the tool paints into. The widget mounts an
   * absolutely-positioned overlay over the View's canvas.
   */
  view: View;

  /**
   * Optional override for the parent of the overlay DOM. Defaults
   * to the View canvas's parent element so the overlay shares its
   * stacking context.
   */
  container?: HTMLElement;

  /**
   * Picker used by {@link MouseAngleMeasurementsControl} to turn
   * canvas clicks into world-space anchors, including snap-to-vertex
   * / snap-to-edge when supported. If omitted the tool builds a
   * BVH-only picker from the View's Scene — supply a
   * {@link spatial!picking.RoutingPickStrategy | RoutingPickStrategy} to get snap.
   */
  picker?: PickStrategy;

  /**
   * Initial visibility. When `false`, all measurements stay loaded
   * but the entire overlay is hidden. Default `true`.
   */
  visible?: boolean;

  /**
   * Default {@link AngleMeasurementParams.color} for measurements
   * created without an explicit color.
   */
  defaultColor?: string;
}
