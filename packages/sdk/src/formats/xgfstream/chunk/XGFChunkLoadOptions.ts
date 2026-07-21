import type {ModelLoadOptions} from "../../ModelLoadOptions";
import type {XGFChunkLoadStats} from "./XGFChunkLoadStats";
import type {XGFChunkManifest} from "./XGFChunkManifest";
import type {XGFStreamingIndexLookup} from "../index/XGFStreamingIndexLookup";

/**
 * Options used when loading one XGF stream chunk.
 */
export interface XGFChunkLoadOptions extends ModelLoadOptions {
  /** Manifest lookup used to resolve dependency chunks. */
  manifests?: XGFChunkManifest[] | Record<string, XGFChunkManifest> | XGFStreamingIndexLookup;
  /** Preloaded chunk bytes keyed by chunk ID. */
  fileDataByChunkId?: Record<string, ArrayBuffer>;
  /** Preloaded chunk bytes keyed by chunk URI. */
  fileDataByUri?: Record<string, ArrayBuffer>;
  /** Callback used to fetch chunk bytes when they are not supplied directly. */
  getFileData?: (manifest: XGFChunkManifest) => Promise<ArrayBuffer> | ArrayBuffer | undefined;
  /** Called after a chunk has been committed to the SceneModel. */
  onChunkLoaded?: (manifest: XGFChunkManifest) => void;
  /** Called with per-chunk fetch, dependency and commit timings. */
  onChunkLoadStats?: (stats: XGFChunkLoadStats) => void;
}
