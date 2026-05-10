import type {View} from "../../viewer";
import type {CameraFlightAnimation} from "../../cameraFlight";

/**
 * Construction parameters for {@link NavCube}.
 */
export type NavCubeParams = {
  /**
   * The {@link View} the NavCube reflects and drives. The cube
   * tracks the View's camera orientation and, on click, flies the
   * camera to the canonical axis / corner / edge view.
   */
  view: View;

  /**
   * Camera-flight animator used when the user clicks a region of
   * the cube. If omitted the NavCube hard-snaps the camera (no
   * animation).
   */
  cameraFlight?: CameraFlightAnimation;

  /**
   * Element the NavCube widget mounts into. Defaults to the
   * `View`'s canvas parent so the cube floats over the canvas in
   * the same stacking context.
   */
  container?: HTMLElement;

  /**
   * Edge length of the widget in CSS pixels. Default `80`.
   */
  size?: number;

  /**
   * Distance from the right edge of `container`, in CSS pixels.
   * Default `12`.
   */
  right?: number;

  /**
   * Distance from the top edge of `container`, in CSS pixels.
   * Mutually exclusive with {@link bottom} — when both are
   * supplied, {@link bottom} wins. Defaults to unset; the cube
   * uses {@link bottom} (bottom-right placement) by default.
   */
  top?: number;

  /**
   * Distance from the bottom edge of `container`, in CSS pixels.
   * Default `12`. Set {@link top} explicitly to use a top-anchored
   * layout instead.
   */
  bottom?: number;

  /**
   * Initial visibility. Default `true`.
   */
  visible?: boolean;

  /**
   * If `true`, fly the camera on click; if `false`, jump. Default
   * `true` (when {@link cameraFlight} is supplied).
   */
  cameraFly?: boolean;

  /**
   * How much of the field-of-view the scene fills after the
   * camera arrives at the chosen view, in degrees. Default `45`.
   */
  cameraFitFOV?: number;

  /**
   * Flight duration in seconds when {@link cameraFly} is `true`.
   * Default `0.5`.
   */
  cameraFlyDuration?: number;

  /**
   * Selects whether the world's "up" axis is `+Z` (default — CAD /
   * BIM convention) or `+Y` (graphics convention). Determines
   * which face of the cube is labelled "TOP" and which world
   * direction "FRONT" looks toward. If omitted, the NavCube reads
   * the View's `scene.coordinateSystem.worldUp`.
   */
  zUp?: boolean;
};
