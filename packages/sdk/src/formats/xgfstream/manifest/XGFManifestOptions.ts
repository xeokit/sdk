import type {XGFAssetMode} from "../export/XGFAssetMode";
import type {XGFChunkDependency} from "../chunk/XGFChunkDependency";

/**
 * Options used when creating an XGF chunk manifest from a SceneModel view.
 */
export interface XGFManifestOptions {
  /** Stable chunk ID. Defaults to the SceneModel ID. */
  id?: string;
  /** Stream-relative URI of the chunk's XGF payload. */
  uri?: string;
  /** Chunk role to record in the manifest. Defaults to `"full"`. */
  assetMode?: XGFAssetMode;
  /** Other chunks required before this chunk can load. */
  dependencies?: XGFChunkDependency[];
  /** Optional scheduler priority. Lower values load first. */
  priority?: number;
  /** Optional level-of-detail label or number. */
  lod?: number | string;
  /** Target coordinate system for manifest bounds. */
  coordinateSystem?: any;
}
