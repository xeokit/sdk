import type {SceneModel} from "../../../model/scene";
import type {View} from "../../../viewing/viewer";
import type {XGFStreamingLoader} from "../XGFStreamingLoader";
import type {XGFChunkLoadOptions} from "../chunk/XGFChunkLoadOptions";
import type {XGFChunkLoadStats} from "../chunk/XGFChunkLoadStats";
import type {XGFChunkManifest} from "../chunk/XGFChunkManifest";
import type {XGFStreamingIndex, XGFSubstreamManifest} from "../index/XGFStreamingIndex";

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

/** Camera point used to distance-sort candidate chunks after frustum filtering. */
export type XGFChunkPriorityTarget = "look" | "eye";

/**
 * Parameters for {@link XGFViewStreamController}.
 */
export interface XGFViewStreamControllerParams {
  /** Stream index containing asset-library and references-only chunks. */
  index: XGFStreamingIndex;
  /** Base URI used to resolve child stream URIs in `index.streams`. */
  streamIndexBaseURI?: string;
  /** Optional child stream index resolver. Defaults to `fetch(stream.uri).json()`. */
  getStreamIndex?: (stream: XGFSubstreamManifest, signal?: AbortSignal) => Promise<any> | any;
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
  /**
   * Minimum time between non-final progress callbacks, in milliseconds.
   *
   * This lets streaming UIs batch redraws while chunks are being committed.
   * Omit or set to zero to emit progress after every chunk, matching the
   * default behavior.
   */
  progressCadenceMs?: number;
  /** When true, only chunks intersecting the current frustum are committed. */
  frustumOnly?: boolean;
  /**
   * Optional multiplier applied to the camera eye-to-look distance to cap the
   * streaming frustum depth. This only affects chunk scheduling; it does not
   * change the view's render far clip.
   */
  frustumDepthMultiplier?: number;
  /**
   * Optional minimum depth, in view units, for the streaming frustum cap. This
   * prevents close-focus viewpoints from capping streaming to only a few meters
   * while preserving the render camera's far clip.
   */
  frustumMinDepth?: number;
  /**
   * Optional CSS-pixel threshold for view-driven streaming. Chunks whose AABB
   * projects smaller than this size on both canvas axes are treated as not
   * visible for scheduling and unload decisions. Conservative cases such as
   * hidden canvases or near-plane intersections remain visible.
   */
  minProjectedChunkSizePixels?: number;
  /** Camera point used to prioritize nearer chunks. Defaults to "look". */
  chunkPriorityTarget?: XGFChunkPriorityTarget;
  /** Debounce delay after `schedule()` before a streaming pass begins. */
  cameraDebounceMs?: number;
  /** When true, unloads least-recently-used references-only chunks after loads exceed `maxResidentChunks`. */
  enableLRUEviction?: boolean;
  /** When true, unloads child stream chunks and unregisters their manifests after their stream AABB leaves the frustum. */
  unloadInactiveStreams?: boolean;
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
