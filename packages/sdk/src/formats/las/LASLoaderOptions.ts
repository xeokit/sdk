import type {ModelLoadOptions} from "../ModelLoadOptions";
import type {Mat4} from "../../base/math/matrix";

/**
 * Options for {@link formats!las.LASLoader.load | LASLoader.load}.
 *
 * For detailed usage, refer to {@link formats!las | @xeokit/sdk/formats/las}.
 */
export interface LASLoaderOptions extends ModelLoadOptions  {

  /**
   * Whether to center the loaded point cloud at the origin.
   */
  center?: boolean;

  /**
   * A 4x4 transformation matrix to apply to the loaded point cloud.
   */
  transform?: Mat4;

  /**
   * Number of points to skip when loading the point cloud (for downsampling).
   */
  skip?: number;

  /**
   * Whether to load 64-bit floating point positions (if available).
   */
  fp64?: boolean;

  /**
   * Color depth for the loaded point cloud (e.g., 8, 16 or "auto").
   */
  colorDepth?: string | number;

    /**
    * Optional layer ID to assign to all {@link model!scene.SceneObject | SceneObjects} created by the loader.
    *
    * See {@link model!scene.SceneObject.layerId | SceneObject.layerId} for details on how this layer ID
    * is used when the Scene is attached to a {@link viewing!viewer.Viewer | Viewer}.
    */
  layerId?: string;
}
