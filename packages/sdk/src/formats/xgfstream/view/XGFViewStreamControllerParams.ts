import type {SceneModel} from "../../../model/scene";
import type {View} from "../../../viewing/viewer";
import type {XGFStreamingLoader} from "../XGFStreamingLoader";
import type {XGFChunkLoadOptions} from "../chunk/XGFChunkLoadOptions";
import type {XGFChunkLoadStats} from "../chunk/XGFChunkLoadStats";
import type {XGFChunkManifest} from "../chunk/XGFChunkManifest";
import type {XGFStreamingIndex} from "../index/XGFStreamingIndex";

/**
 * Progress for the active view-stream scheduling generation.
 */
export interface XGFViewStreamProgress {
  /** Scheduling generation that produced this progress update. */
  generation: number;
  /** Number of chunks queued for the generation. */
  queued: number;
  /** Number of queued chunks loaded so far. */
  loaded: number;
}

/**
 * Parameters for {@link XGFViewStreamController}.
 */
export interface XGFViewStreamControllerParams {
  /** Stream index containing asset-library and references-only chunks. */
  index: XGFStreamingIndex;
  /** Optional filter for references-only chunks controlled by this instance. */
  chunkFilter?: (manifest: XGFChunkManifest) => boolean;
  /** Optional loader instance. A default {@link XGFStreamingLoader} is created when omitted. */
  loader?: XGFStreamingLoader;
  /** SceneModel that receives streamed chunk content. */
  sceneModel: SceneModel;
  /** View whose camera/frustum drives stream prioritization. */
  view: View;
  /** Options forwarded to chunk loads. */
  loadOptions?: XGFChunkLoadOptions;
  /** Maximum number of chunks committed per scheduling batch. */
  batchSize?: number;
  /** Maximum number of chunk fetches allowed at the same time. */
  fetchConcurrency?: number;
  /** Approximate per-frame commit budget, in milliseconds. */
  commitFrameBudgetMs?: number;
  /** When true, only chunks intersecting the current frustum are committed. */
  frustumOnly?: boolean;
  /** Debounce delay after `schedule()` before a streaming pass begins. */
  cameraDebounceMs?: number;
  /** When true, unloads least-recently-used references-only chunks after loads exceed `maxResidentChunks`. */
  enableLRUEviction?: boolean;
  /** Maximum resident references-only chunks to keep when LRU eviction is enabled. */
  maxResidentChunks?: number;
  /** When true, keeps resolved XGF file bytes in memory for reuse after chunk unload/reload. */
  cacheFileData?: boolean;
  /** Maximum bytes of resolved XGF file data to retain when `cacheFileData` is enabled. */
  maxCachedFileBytes?: number;
  /** Called with coarse controller status messages. */
  onStatus?: (status: string) => void;
  /** Called when queue progress changes. */
  onProgress?: (progress: XGFViewStreamProgress) => void;
  /** Called before a batch of chunks begins loading. */
  onChunksLoading?: (manifests: XGFChunkManifest[]) => void;
  /** Called after one chunk has loaded. */
  onChunkLoaded?: (manifest: XGFChunkManifest) => void;
  /** Called with per-chunk timing and creation stats. */
  onChunkLoadStats?: (stats: XGFChunkLoadStats) => void;
  /** Called when an async controller operation fails unexpectedly. */
  onError?: (error: unknown) => void;
}
