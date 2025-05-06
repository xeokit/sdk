import type {FloatArrayParam} from "../math";

/**
 * Options for {@link las!LASLoader.load | LASLoader.load}.
 *
 * For detailed usage, refer to {@link las | @xeokit/sdk/las}.
 */
export interface LASLoaderOptions {
  center?: boolean;
  transform?: FloatArrayParam;
  skip?: number;
  fp64?: boolean;
  colorDepth?: string | number;
}
