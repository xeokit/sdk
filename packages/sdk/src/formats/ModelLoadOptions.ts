import type {CoordinateSystemParams, SceneObject} from "../scene";

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

  /**
   * Optional layer ID to assign to all {@link SceneObject | SceneObjects} created by the loader.
   *
   * See {@link SceneObject.layerId | SceneObject.layerId} for details on how this layer ID
   * is used when the Scene is attached to a {@link viewer!Viewer | Viewer}.
   */
  layerId?: string;
}
