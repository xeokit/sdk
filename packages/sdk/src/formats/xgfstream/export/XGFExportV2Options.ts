import type {LoaderProgress} from "../../LoaderProgress";
import type {XGFAssetMode} from "./XGFAssetMode";

/** @internal */
export interface XGFExportV2Options {
  /**
   * Selects the XGF v2 chunk role. Unsupported runtime values are treated as
   * `full` to preserve the SDK no-throw policy for handled input errors.
   */
  assetMode?: XGFAssetMode;
  preserveTransforms?: boolean;
  coordinateSystem?: any;
  signal?: AbortSignal;
  onProgress?: (progress: LoaderProgress) => void;
}
