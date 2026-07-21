import type {XGFChunkManifest} from "./XGFChunkManifest";

/**
 * Per-chunk timing and creation statistics emitted by XGF stream loading.
 */
export interface XGFChunkLoadStats {
  /** Manifest for the loaded or failed chunk. */
  manifest: XGFChunkManifest;
  /** Stable chunk ID. */
  chunkId: string;
  /** Chunk role from the manifest. */
  role: XGFChunkManifest["role"];
  /** Whether the chunk loaded successfully. */
  ok: boolean;
  /** Number of XGF payload bytes loaded for this chunk. */
  bytes: number;
  /** Time spent resolving/loading dependencies, in milliseconds. */
  dependencyMs: number;
  /** Time spent fetching chunk bytes, in milliseconds. */
  fetchMs: number;
  /** Time spent committing chunk content to the SceneModel, in milliseconds. */
  commitMs: number;
  /** Total elapsed load time for the chunk, in milliseconds. */
  totalMs: number;
  /** Counts of SceneModel components created by the chunk. */
  created: {
    objects: number;
    meshes: number;
    transforms: number;
    geometries: number;
    materials: number;
    textures: number;
  };
  error?: string;
}
