import type {CoordinateSystemParams} from "../scene/CoordinateSystemParams";

/**
 * Options for {@link ModelLoader.load | ModelLoader.load}.
 */
export interface ModelLoadOptions {

  /**
   * Describes the coordinate system of the model to load.
   *
   * When provided, this enables the loader to automatically transform the model
   * from its local oordinate system to the Scene's global coordinate system.
   */
  coordinateSystem?: CoordinateSystemParams;
}
