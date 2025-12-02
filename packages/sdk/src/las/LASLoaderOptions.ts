import type {FloatArrayParam} from "../math";
import type {ModelLoadOptions} from "../io/ModelLoadOptions";

/**
 * Options for {@link las!LASLoader.load | LASLoader.load}.
 *
 * For detailed usage, refer to {@link las | @xeokit/sdk/las}.
 */
export interface LASLoaderOptions extends ModelLoadOptions  {

  /**
   * Whether to center the loaded point cloud at the origin.
   */
  center?: boolean;

  /**
   * A 4x4 transformation matrix to apply to the loaded point cloud.
   */
  transform?: FloatArrayParam;

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
}
