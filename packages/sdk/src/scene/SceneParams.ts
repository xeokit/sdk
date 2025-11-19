import type {CoordinateSystemParams} from "./CoordinateSystemParams";

/**
 * Parameters for creating a {@link Scene | Scene}.
 */
export interface SceneParams {

  /**
   * Configures the Scene's global coordinate system.
   */
  coordinateSystem: CoordinateSystemParams;

    /**
     * Indicates whether to log errors to the console.
     *
     * Default value is ````false````.
     */
    logging?: boolean;
}
