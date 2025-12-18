import type {CoordinateSystemParams} from "./CoordinateSystemParams";

/**
 * Parameters for creating a {@link Scene | Scene}.
 */
export interface SceneParams {

  /**
   * Unique ID for the Scene.
   *
   * Default value is a generated UUID.
   */
  id?: string;

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
