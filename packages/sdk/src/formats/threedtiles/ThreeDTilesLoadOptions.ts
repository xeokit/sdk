import type {ModelLoadOptions} from "../ModelLoadOptions";

/**
 * Options for {@link ThreeDTilesLoader.load | ThreeDTilesLoader.load}, extending
 * the shared {@link ModelLoadOptions} with 3D Tiles-specific concerns.
 */
export interface ThreeDTilesLoadOptions extends ModelLoadOptions {

  /**
   * Optional fetcher for the content files a `tileset.json` references
   * (`.b3dm` / `.glb` / nested `.json`), resolved against `baseUri`. Defaults
   * to a browser fetch; inject a custom function for tests or Node.
   */
  fetchArrayBuffer?: (url: string) => Promise<ArrayBuffer>;

  /**
   * Optional Draco decoder module (`draco3d`), passed through to the glTF
   * content decoder to decode `KHR_draco_mesh_compression`. When omitted,
   * Draco-compressed content cannot be decoded.
   */
  dracoModule?: any;

  /**
   * Optional cap on tile-tree descent depth. Descent stops at this depth and
   * the coarser tiles at that level are loaded instead of their descendants.
   */
  maxDepth?: number;

  /**
   * Optional geometric-error cutoff. Descent stops once a tile's geometric
   * error is at or below this value — larger values load coarser detail.
   */
  maxGeometricError?: number;
}
