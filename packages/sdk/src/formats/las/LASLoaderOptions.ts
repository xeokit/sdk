import type {ModelLoadOptions} from "../ModelLoadOptions";
import type {Mat4} from "../../math/matrix";

/**
 * Options for {@link las!LASLoader.load | LASLoader.load}.
 *
 * For detailed usage, refer to {@link las | @xeokit/sdk/formats/las}.
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
}
