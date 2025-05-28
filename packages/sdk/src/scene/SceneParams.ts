import type {CoordinateSystemParams} from "./CoordinateSystemParams";

/**
 * Parameters for creating a {@link Scene | Scene}.
 */
export interface SceneParams {

  /**
   * Configures the Scene's global coordinate system.
   */
  coordinateSystem: CoordinateSystemParams;
}
