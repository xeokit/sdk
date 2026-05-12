import type {View} from "../../../viewer";
import type {CameraFlightAnimation} from "../../../cameraFlight";

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
   * Element the floating NavCube panel + pill mount into.
   * Defaults to `document.body`, matching the other floating demo
   * panels. The panel's drag position is persisted to
   * `localStorage` so the layout survives reloads.
   */
  container?: HTMLElement;

  /**
   * Edge length of the cube in CSS pixels. Default `100`. The
   * surrounding panel chrome (header + padding) adds a small
   * margin around this on the screen.
   */
  size?: number;

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
