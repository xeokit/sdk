import type {SceneModel} from "../../../model/scene";
import {createCoordinateSystemTransform} from "../../../model/scene";
import {createMat4Float64, mulMat4, transformPoint3, transformPoint4, type Mat4} from "../../../base/math/matrix";
import type {View} from "../../../viewing/viewer";
import {XGFStreamingLoader} from "../XGFStreamingLoader";
import {createXGFStreamingIndexLookup} from "../index/createXGFStreamingIndexLookup";
import {readXGFStreamingIndex} from "../index/readXGFStreamingIndex";
import {readXGFStreamingRuntimeIndex} from "../index/readXGFStreamingRuntimeIndex";
import type {XGFChunkLoadOptions} from "../chunk/XGFChunkLoadOptions";
import type {XGFChunkManifest} from "../chunk/XGFChunkManifest";
import type {XGFStreamingIndex, XGFSubstreamManifest} from "../index/XGFStreamingIndex";
import type {XGFChunkPriorityTarget, XGFViewStreamControllerParams, XGFViewStreamProgress} from "./XGFViewStreamControllerParams";

type StreamManifest = XGFChunkManifest;

interface FileDataCacheEntry {
  key: string;
  manifest: XGFChunkManifest;
  priority: number;
  token: number | undefined;
  controller: AbortController;
  active: boolean;
  aborted: boolean;
  releaseAfterActive: boolean;
  resolve: (value: ArrayBuffer | PromiseLike<ArrayBuffer>) => void;
  reject: (reason?: unknown) => void;
  promise: Promise<ArrayBuffer>;
  fileData?: ArrayBuffer;
  byteLength: number;
  lastUsed: number;
}

interface CandidateQueue {
  generation: number;
  chunks: StreamManifest[];
  cursor: number;
  initialCount: number;
}

interface PrioritizedManifest {
  manifest: StreamManifest;
  priority: number;
  visibleForStreaming: boolean;
}

interface StreamNode {
  manifest: XGFSubstreamManifest;
  namespace: string;
  origin: [number, number, number];
  loaded: boolean;
  chunkIds: string[];
  assetChunkIds: string[];
  loading?: Promise<void>;
  error?: unknown;
}

const DEFAULT_BATCH_SIZE = 8;
const DEFAULT_FETCH_CONCURRENCY = 8;
const DEFAULT_COMMIT_FRAME_BUDGET_MS = 10;
const DEFAULT_CAMERA_DEBOUNCE_MS = 140;
const NON_FRUSTUM_PRIORITY_OFFSET = Number.MAX_SAFE_INTEGER / 2;
const DISABLED_MAX_RESIDENT_CHUNKS = Number.POSITIVE_INFINITY;
const DEFAULT_MAX_CACHED_FILE_BYTES = 256 * 1024 * 1024;

/**
 * View-driven controller that prioritizes XGF stream chunk loading.
 *
 * The controller selects references-only chunks from an
 * {@link XGFStreamingIndex}, prioritizes chunks intersecting the current camera
 * frustum, and schedules fetch/commit work through {@link XGFStreamingLoader}.
 */
export class XGFViewStreamController {

  /** References-only chunk manifests controlled by this instance. */
  readonly chunkManifests: StreamManifest[];
  /** IDs of chunks currently being committed. */
  readonly loadingChunkIds = new Set<string>();
  /** IDs of references-only chunks already loaded. */
  readonly loadedChunkIds = new Set<string>();
  /** IDs of asset-library chunks already loaded. */
  readonly loadedAssetLibraryIds = new Set<string>();
  /** Aggregate object/mesh counts currently resident through this controller. */
  readonly loadedTotals = {
    objects: 0,
    meshes: 0
  };
  /** Queue progress for the latest scheduled generation. */
  readonly queueProgress: XGFViewStreamProgress = {
    generation: 0,
    queued: 0,
    loaded: 0
  };

  private readonly _loader: XGFStreamingLoader;
  private readonly _sceneModel: SceneModel;
  private readonly _view: View;
  private readonly _loadOptions: XGFChunkLoadOptions;
  private readonly _fileDataCache: ReturnType<typeof createPrioritizedFileDataCache>;
  private readonly _assetChunksById: Map<string, XGFChunkManifest>;
  private readonly _batchSize: number;
  private readonly _commitFrameBudgetMs: number;
  private readonly _frustumOnly: boolean;
  private readonly _frustumDepthMultiplier: number | undefined;
  private readonly _frustumMinDepth: number;
  private readonly _minProjectedChunkSizePixels: number;
  private readonly _chunkPriorityTarget: XGFChunkPriorityTarget;
  private readonly _cameraDebounceMs: number;
  private readonly _enableLRUEviction: boolean;
  private readonly _unloadInactiveStreams: boolean;
  private readonly _maxResidentChunks: number;
  private readonly _targetCoordinateSystem: any;
  private readonly _onStatus?: (status: string) => void;
  private readonly _onProgress?: (progress: XGFViewStreamProgress) => void;
  private readonly _onChunksLoading?: (manifests: XGFChunkManifest[]) => void;
  private readonly _onError?: (error: unknown) => void;
  private readonly _getStreamIndex: (stream: XGFSubstreamManifest, signal?: AbortSignal) => Promise<any> | any;
  private readonly _streamNodes: StreamNode[];
  private readonly _manifestLookup: ReturnType<typeof createXGFStreamingIndexLookup>;

  private _generation = 0;
  private _pendingGeneration = 0;
  private _resetGeneration = 0;
  private _running = false;
  private _paused = false;
  private _lruSequence = 0;
  private readonly _chunkLastUsed = new Map<string, number>();
  private readonly _projectedVisibilityViewProjectionMatrix = createMat4Float64();
  private readonly _projectedVisibilityClip = [0, 0, 0, 1] as [number, number, number, number];
  private readonly _projectedVisibilityPoint = [0, 0, 0, 1] as [number, number, number, number];
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private _candidateQueue: CandidateQueue = {
    generation: 0,
    chunks: [],
    cursor: 0,
    initialCount: 0
  };

  /**
   * Creates a controller for one view and target SceneModel.
   */
  constructor(params: XGFViewStreamControllerParams) {
    this._loader = params.loader || new XGFStreamingLoader();
    this._sceneModel = params.sceneModel;
    this._view = params.view;
    this._fileDataCache = createPrioritizedFileDataCache(
      params.fetchConcurrency || DEFAULT_FETCH_CONCURRENCY,
      params.loadOptions?.getFileData || fetchFileData,
      {
        cacheFileData: params.cacheFileData === true,
        maxCachedFileBytes: params.maxCachedFileBytes
      }
    );
    const index = {
      ...params.index,
      chunks: params.index.chunks || []
    };
    this._assetChunksById = new Map(
      index.chunks
        .filter((manifest) => manifest.role === "assetLibrary")
        .map((manifest) => [manifest.id, manifest])
    );
    this._batchSize = params.batchSize || DEFAULT_BATCH_SIZE;
    this._commitFrameBudgetMs = params.commitFrameBudgetMs ?? DEFAULT_COMMIT_FRAME_BUDGET_MS;
    this._frustumOnly = params.frustumOnly !== false;
    this._frustumDepthMultiplier = params.frustumDepthMultiplier !== undefined && Number.isFinite(params.frustumDepthMultiplier) && params.frustumDepthMultiplier > 0
      ? params.frustumDepthMultiplier
      : undefined;
    this._frustumMinDepth = params.frustumMinDepth !== undefined && Number.isFinite(params.frustumMinDepth) && params.frustumMinDepth > 0
      ? params.frustumMinDepth
      : 0;
    this._minProjectedChunkSizePixels = params.minProjectedChunkSizePixels !== undefined && Number.isFinite(params.minProjectedChunkSizePixels) && params.minProjectedChunkSizePixels > 0
      ? params.minProjectedChunkSizePixels
      : 0;
    this._chunkPriorityTarget = params.chunkPriorityTarget || "look";
    this._cameraDebounceMs = params.cameraDebounceMs ?? DEFAULT_CAMERA_DEBOUNCE_MS;
    this._enableLRUEviction = params.enableLRUEviction === true;
    this._unloadInactiveStreams = params.unloadInactiveStreams === true;
    this._maxResidentChunks = this._enableLRUEviction
      ? Math.max(0, Math.floor(params.maxResidentChunks ?? DISABLED_MAX_RESIDENT_CHUNKS))
      : DISABLED_MAX_RESIDENT_CHUNKS;
    this._targetCoordinateSystem = index.coordinateSystem ? this._sceneModel.coordinateSystem : undefined;
    this._onStatus = params.onStatus;
    this._onProgress = params.onProgress;
    this._onChunksLoading = params.onChunksLoading;
    this._onError = params.onError;
    this._getStreamIndex = params.getStreamIndex || fetchStreamIndexJSON;
    this._streamNodes = (index.streams || []).map((stream) => ({
      manifest: resolveSubstreamManifest(stream, params.streamIndexBaseURI),
      namespace: `${stream.id}::`,
      origin: stream.origin || [0, 0, 0],
      loaded: false,
      chunkIds: [],
      assetChunkIds: []
    }));
    this.chunkManifests = index.chunks
      .filter((manifest) => manifest.role === "referencesOnly")
      .filter((manifest) => params.chunkFilter ? params.chunkFilter(manifest) : true);
    this._manifestLookup = createXGFStreamingIndexLookup(index);
    const onChunkLoaded = params.loadOptions?.onChunkLoaded;
    const onChunkLoadStats = params.loadOptions?.onChunkLoadStats;
    this._loadOptions = {
      ...params.loadOptions,
      manifests: params.loadOptions?.manifests || this._manifestLookup,
      getFileData: (manifest) => this._fileDataCache.get(manifest, this.chunkPriority(manifest)),
      onChunkLoaded: (manifest) => {
        this.markManifestLoaded(manifest);
        this._fileDataCache.release(manifest);
        onChunkLoaded?.(manifest);
        params.onChunkLoaded?.(manifest);
      },
      onChunkLoadStats: (stats) => {
        onChunkLoadStats?.(stats);
        params.onChunkLoadStats?.(stats);
      }
    };
  }

  /**
   * Current scheduling generation. Incremented each time {@link schedule} is
   * called.
   */
  get generation(): number {
    return this._generation;
  }

  /**
   * True while streaming is paused. A paused controller ignores new schedule
   * requests and stops committing additional chunks between chunk loads.
   */
  get paused(): boolean {
    return this._paused;
  }

  /**
   * Returns chunk manifests sorted by the current view-priority heuristic.
   */
  prioritizeChunks(chunkManifests: XGFChunkManifest[] = this.chunkManifests): StreamManifest[] {
    return this.prioritizeManifestRecords(chunkManifests).map((record) => record.manifest);
  }

  /**
   * Starts prefetching high-priority chunks and their dependencies without
   * committing them to the SceneModel yet.
   */
  prefetchInitial(count: number): void {
    const chunks = this.prioritizeChunks().slice(0, Math.max(0, count));
    this.prefetchDependencies(chunks, 0);
    this.prefetchChunks(chunks, 0);
  }

  /**
   * Schedules a debounced streaming pass for the current camera/frustum state.
   */
  schedule(label = "Streaming"): void {
    if (this._paused) {
      this.emitStatus(`${label}: paused`);
      return;
    }
    this._generation++;
    this.rebuildCandidateQueue(this._generation);
    this.touchManifests(this._candidateQueue.chunks);
    this.resetQueueProgress(this._generation, this.countPendingFrustumChunks());
    if (this._timer !== undefined) {
      clearTimeout(this._timer);
    }
    this._timer = setTimeout(() => {
      this.runGeneration(this._generation, label);
    }, this._cameraDebounceMs);
  }

  /**
   * Pauses view-driven streaming and aborts queued, not-yet-active chunk
   * fetches. The currently committing chunk, if any, is allowed to finish.
   */
  pause(): void {
    if (this._paused) {
      return;
    }
    this._paused = true;
    this._generation++;
    this._pendingGeneration = 0;
    if (this._timer !== undefined) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
    this._fileDataCache.abortQueued(() => true);
    this.emitStatus("Streaming paused");
  }

  /**
   * Resumes view-driven streaming and schedules a pass for the current view.
   */
  resume(label = "Streaming"): void {
    if (!this._paused) {
      return;
    }
    this._paused = false;
    this.schedule(label);
  }

  /**
   * Unloads all resident streamed chunks from the SceneModel and resets
   * scheduling for the current view.
   *
   * This does not pause streaming. Chunks already in the middle of a commit are
   * allowed to finish, queued prefetches are dropped, and a fresh scheduling
   * pass is requested unless the controller was already paused.
   */
  unloadAllChunks(): number {
    const wasPaused = this._paused;
    this._generation++;
    this._resetGeneration = this._generation;
    this._pendingGeneration = this._generation;
    if (this._timer !== undefined) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
    this._fileDataCache.abortQueued(() => true);
    let unloaded = 0;
    const protectedChunkIds = new Set(this.loadingChunkIds);
    for (const chunkId of Array.from(this.loadedChunkIds)) {
      if (protectedChunkIds.has(chunkId)) {
        continue;
      }
      if (this.unloadResidentChunk(chunkId, true)) {
        unloaded++;
      }
    }
    for (const chunkId of Array.from(this.loadedAssetLibraryIds)) {
      if (protectedChunkIds.has(chunkId)) {
        continue;
      }
      if (this.unloadResidentChunk(chunkId, false)) {
        unloaded++;
      }
    }
    this.rebuildCandidateQueue(this._generation);
    this.touchManifests(this._candidateQueue.chunks);
    this.resetQueueProgress(this._generation, this.countPendingFrustumChunks());
    this.emitStatus(`Removed ${unloaded} streamed chunk(s)`);
    this.emitProgress();
    if (!wasPaused && !this._running) {
      this.schedule("Current frustum");
    }
    return unloaded;
  }

  /**
   * Aborts queued loads for chunks outside the current camera frustum and
   * unloads resident references-only chunks that are no longer visible.
   *
   * Asset-library chunks are retained because visible chunks may still share
   * them. Chunks already in the middle of a commit are skipped and can be
   * removed by calling this again after they finish.
   */
  unloadInvisibleChunks(): number {
    const wasPaused = this._paused;
    this._generation++;
    this._pendingGeneration = wasPaused ? 0 : this._generation;
    if (this._timer !== undefined) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
    this._fileDataCache.abortQueued((manifest) => !this.isVisibleForStreaming(manifest));
    let unloaded = 0;
    const protectedChunkIds = new Set(this.loadingChunkIds);
    for (const chunkId of Array.from(this.loadedChunkIds)) {
      if (protectedChunkIds.has(chunkId)) {
        continue;
      }
      const manifest = this.manifestById(chunkId);
      if (manifest && this.isVisibleForStreaming(manifest)) {
        continue;
      }
      if (this.unloadResidentChunk(chunkId, true)) {
        unloaded++;
      }
    }
    this.rebuildCandidateQueue(this._generation);
    this.touchManifests(this._candidateQueue.chunks);
    this.resetQueueProgress(this._generation, this.countPendingFrustumChunks());
    this.emitStatus(`Unloaded ${unloaded} invisible chunk(s)`);
    this.emitProgress();
    if (!wasPaused && !this._running) {
      this.schedule("Current frustum");
    }
    return unloaded;
  }

  /**
   * Prefetches asset-library dependencies for the supplied chunk manifests.
   */
  prefetchDependencies(chunkManifests: XGFChunkManifest[], generation = this._generation): void {
    this._fileDataCache.prefetch(
      this.dependencyAssetLibraries(chunkManifests).filter((manifest) => !this.loadedAssetLibraryIds.has(manifest.id)),
      (manifest) => this.chunkPriority(manifest),
      generation
    );
  }

  /**
   * Prefetches XGF bytes for the supplied references-only chunk manifests.
   */
  prefetchChunks(chunkManifests: XGFChunkManifest[], generation = this._generation): void {
    this._fileDataCache.abortQueued((manifest, token) => (
      token !== undefined &&
      token !== generation &&
      !this.isVisibleForStreaming(manifest)
    ));
    this._fileDataCache.prefetch(
      chunkManifests.filter((manifest) => !this.isLoadedManifest(manifest)),
      (manifest) => this.chunkPriority(manifest) + 1000,
      generation
    );
  }

  private async runGeneration(generation: number, label: string): Promise<void> {
    if (this._paused) {
      return;
    }
    if (this._running) {
      this._pendingGeneration = generation;
      return;
    }
    this._running = true;
    let activeGeneration = generation;
    try {
      while (activeGeneration || this.hasPendingQueuedChunks()) {
        if (this._paused) {
          break;
        }
        const batchGeneration = activeGeneration || this._generation;
        this._pendingGeneration = 0;
        if (this._unloadInactiveStreams) {
          this.deactivateInvisibleStreams();
        }
        await this.activateVisibleStreams();
        this.ensureCandidateQueue(batchGeneration);
        const candidates = this.nextAutoCandidates(this._batchSize);
        if (candidates.length === 0) {
          if (this._pendingGeneration) {
            activeGeneration = this._pendingGeneration;
            continue;
          }
          this.completeQueueProgress(batchGeneration);
          this.emitStatus(`${label}: current frustum loaded`);
          break;
        }
        await this.loadCandidates(candidates, label, {
          generation: batchGeneration,
          frustumOnly: this._frustumOnly
        });
        this.evictLRUChunks();
        this.emitStatus(`${label}: ${this.loadedChunkIds.size}/${this.chunkManifests.length} chunks resident`);
        activeGeneration = this._pendingGeneration || batchGeneration;
        if (activeGeneration === batchGeneration && !this.hasPendingQueuedChunks()) {
          activeGeneration = 0;
        }
      }
    } catch (error) {
      this._onError?.(error);
    } finally {
      this._running = false;
    }
  }

  private async loadCandidates(candidates: StreamManifest[], label: string, options: {
    generation?: number;
    frustumOnly?: boolean;
    loadDependencies?: boolean;
  } = {}): Promise<void> {
    if (candidates.length === 0) {
      this.emitStatus(`${label}: no pending chunks`);
      return;
    }
    const start = now();
    const generation = options.generation;
    const frustumOnly = options.frustumOnly === true;
    const loadDependencies = options.loadDependencies !== false;
    if (loadDependencies) {
      this.prefetchDependencies(candidates, generation);
    }
    this.prefetchChunks(candidates, generation);
    this.emitStatus(`${label}: loading ${candidates.length} chunk(s)...`);
    try {
      if (loadDependencies) {
        await this.preloadDependencies(candidates, generation);
      }
      for (const manifest of candidates) {
        if (this._paused) {
          break;
        }
        if (generation !== undefined && generation < this._resetGeneration) {
          break;
        }
        if (generation !== undefined && generation !== this._generation && frustumOnly && !this.isVisibleForStreaming(manifest)) {
          continue;
        }
        if (frustumOnly && !this.isVisibleForStreaming(manifest)) {
          continue;
        }
        if (this.isLoadedManifest(manifest) || this.loadingChunkIds.has(manifest.id)) {
          continue;
        }
        this.loadingChunkIds.add(manifest.id);
        this._onChunksLoading?.([manifest]);
        let fileData: ArrayBuffer | undefined;
        try {
          fileData = await this._fileDataCache.get(manifest, this.chunkPriority(manifest), generation);
        } catch (error) {
          if (isAbortError(error)) {
            continue;
          }
          throw error;
        }
        if (generation !== undefined && generation < this._resetGeneration) {
          this._fileDataCache.release(manifest);
          break;
        }
        if (this._paused) {
          this._fileDataCache.release(manifest);
          continue;
        }
        const wasLoaded = this.isLoadedManifest(manifest);
        await this._loader.loadChunk({manifest, fileData, sceneModel: this._sceneModel}, this._loadOptions);
        fileData = undefined;
        this.touchManifest(manifest);
        if (!wasLoaded && manifest.role === "referencesOnly" && this.loadedChunkIds.has(manifest.id)) {
          this.markQueueChunkLoaded(generation);
        }
        this.loadingChunkIds.delete(manifest.id);
        this.emitProgress();
        await waitForFrameBudget(this._commitFrameBudgetMs);
      }
      this.emitStatus(`${label}: ${candidates.length} chunk(s) in ${(now() - start).toFixed(1)} ms`);
    } finally {
      for (const manifest of candidates) {
        this.loadingChunkIds.delete(manifest.id);
      }
      this.emitProgress();
    }
  }

  private async preloadDependencies(chunkManifests: XGFChunkManifest[], generation?: number): Promise<void> {
    const assetManifests = this.prioritizeManifestRecords(
      this.dependencyAssetLibraries(chunkManifests)
        .filter((manifest) => !this.loadedAssetLibraryIds.has(manifest.id) && !this.loadingChunkIds.has(manifest.id))
    ).map((record) => record.manifest);
    if (assetManifests.length === 0) {
      return;
    }
    await this.loadCandidates(assetManifests as StreamManifest[], "Asset libraries", {
      generation,
      frustumOnly: false,
      loadDependencies: false
    });
  }

  private dependencyAssetLibraries(chunkManifests: XGFChunkManifest[]): XGFChunkManifest[] {
    const manifests: XGFChunkManifest[] = [];
    const seen = new Set<string>();
    for (const chunkManifest of chunkManifests) {
      for (const dependency of chunkManifest.dependencies?.chunks || []) {
        const assetManifest = dependency.id ? this._assetChunksById.get(dependency.id) : undefined;
        if (!assetManifest || seen.has(assetManifest.id)) {
          continue;
        }
        seen.add(assetManifest.id);
        manifests.push(assetManifest);
      }
    }
    return manifests;
  }

  private nextAutoCandidates(count: number): StreamManifest[] {
    const candidates: StreamManifest[] = [];
    while (this._candidateQueue.cursor < this._candidateQueue.chunks.length && candidates.length < count) {
      const manifest = this._candidateQueue.chunks[this._candidateQueue.cursor++];
      if (this.loadedChunkIds.has(manifest.id) || this.loadingChunkIds.has(manifest.id)) {
        continue;
      }
      if (this._frustumOnly && !this.isVisibleForStreaming(manifest)) {
        continue;
      }
      candidates.push(manifest);
    }
    return candidates;
  }

  private hasPendingQueuedChunks(): boolean {
    for (let i = this._candidateQueue.cursor; i < this._candidateQueue.chunks.length; i++) {
      const manifest = this._candidateQueue.chunks[i];
      if (
        !this.loadedChunkIds.has(manifest.id) &&
        !this.loadingChunkIds.has(manifest.id) &&
        (!this._frustumOnly || this.isVisibleForStreaming(manifest))
      ) {
        return true;
      }
    }
    return false;
  }

  private countPendingFrustumChunks(): number {
    if (this._candidateQueue.generation === this._generation) {
      return this._candidateQueue.initialCount;
    }
    return this.buildCandidateQueue().length;
  }

  private ensureCandidateQueue(generation: number): void {
    if (this._candidateQueue.generation < generation) {
      this.rebuildCandidateQueue(generation);
    }
  }

  private rebuildCandidateQueue(generation: number): void {
    const chunks = this.buildCandidateQueue();
    this._candidateQueue = {
      generation,
      chunks,
      cursor: 0,
      initialCount: chunks.length
    };
  }

  private buildCandidateQueue(): StreamManifest[] {
    const records: PrioritizedManifest[] = [];
    for (const manifest of this.chunkManifests) {
      if (this.loadedChunkIds.has(manifest.id) || this.loadingChunkIds.has(manifest.id)) {
        continue;
      }
      const visibleForStreaming = this.isVisibleForStreaming(manifest);
      if (this._frustumOnly && !visibleForStreaming) {
        continue;
      }
      records.push({
        manifest,
        visibleForStreaming,
        priority: this.chunkPriorityFromVisibility(manifest, visibleForStreaming)
      });
    }
    records.sort(comparePriorityRecords);
    return records.map((record) => record.manifest);
  }

  private resetQueueProgress(generation: number, queued: number): void {
    this.queueProgress.generation = generation;
    this.queueProgress.queued = queued;
    this.queueProgress.loaded = 0;
    this.emitProgress();
  }

  private markQueueChunkLoaded(generation?: number): void {
    if (generation !== this.queueProgress.generation) {
      return;
    }
    this.queueProgress.loaded = Math.min(this.queueProgress.loaded + 1, this.queueProgress.queued);
  }

  private completeQueueProgress(generation: number): void {
    if (generation !== this.queueProgress.generation) {
      return;
    }
    this.queueProgress.loaded = this.queueProgress.queued;
    this.emitProgress();
  }

  private markManifestLoaded(manifest: XGFChunkManifest): void {
    if (manifest.role === "referencesOnly" && !this.loadedChunkIds.has(manifest.id)) {
      this.loadedChunkIds.add(manifest.id);
      this.touchManifest(manifest);
      this.loadedTotals.objects += manifest.counts?.objects || 0;
      this.loadedTotals.meshes += manifest.counts?.meshes || 0;
    } else if (manifest.role === "assetLibrary") {
      this.loadedAssetLibraryIds.add(manifest.id);
    }
  }

  private isLoadedManifest(manifest: XGFChunkManifest): boolean {
    return manifest.role === "assetLibrary"
      ? this.loadedAssetLibraryIds.has(manifest.id)
      : this.loadedChunkIds.has(manifest.id);
  }

  private touchManifests(manifests: XGFChunkManifest[]): void {
    for (const manifest of manifests) {
      this.touchManifest(manifest);
    }
  }

  private touchManifest(manifest: XGFChunkManifest): void {
    if (manifest.role !== "referencesOnly") {
      return;
    }
    this._chunkLastUsed.set(manifest.id, ++this._lruSequence);
  }

  private evictLRUChunks(): void {
    if (!this._enableLRUEviction || this.loadedChunkIds.size <= this._maxResidentChunks) {
      return;
    }
    const protectedChunkIds = this.protectedChunkIds();
    const candidates = Array.from(this.loadedChunkIds)
      .filter((chunkId) => !protectedChunkIds.has(chunkId))
      .sort((a, b) => (this._chunkLastUsed.get(a) || 0) - (this._chunkLastUsed.get(b) || 0));
    let evicted = 0;
    for (const chunkId of candidates) {
      if (this.loadedChunkIds.size <= this._maxResidentChunks) {
        break;
      }
      if (this.unloadResidentChunk(chunkId, true)) {
        evicted++;
      }
    }
    if (evicted > 0) {
      this.emitStatus(`Evicted ${evicted} LRU chunk(s); ${this.loadedChunkIds.size}/${this.chunkManifests.length} chunks resident`);
      this.emitProgress();
    }
  }

  private protectedChunkIds(): Set<string> {
    const protectedChunkIds = new Set<string>(this.loadingChunkIds);
    for (const manifest of this._candidateQueue.chunks) {
      if (this.isVisibleForStreaming(manifest)) {
        protectedChunkIds.add(manifest.id);
      }
    }
    for (const manifest of this.chunkManifests) {
      if (this.isVisibleForStreaming(manifest)) {
        protectedChunkIds.add(manifest.id);
      }
    }
    return protectedChunkIds;
  }

  private unloadResidentChunk(chunkId: string, referencesOnly: boolean): boolean {
    const manifest = this.manifestById(chunkId);
    const result = this._loader.unloadChunk({
      sceneModel: this._sceneModel,
      chunkId
    });
    if (result.ok === false) {
      this._onError?.(result.error);
      return false;
    }
    if (referencesOnly) {
      this.loadedChunkIds.delete(chunkId);
      this._chunkLastUsed.delete(chunkId);
      if (manifest) {
        this.loadedTotals.objects = Math.max(0, this.loadedTotals.objects - (manifest.counts?.objects || 0));
        this.loadedTotals.meshes = Math.max(0, this.loadedTotals.meshes - (manifest.counts?.meshes || 0));
      }
    } else {
      this.loadedAssetLibraryIds.delete(chunkId);
    }
    return true;
  }

  private manifestById(chunkId: string): XGFChunkManifest | undefined {
    return this.chunkManifests.find((manifest) => manifest.id === chunkId);
  }

  private async activateVisibleStreams(): Promise<void> {
    const loads: Promise<void>[] = [];
    for (const streamNode of this._streamNodes) {
      if (streamNode.loaded || streamNode.error || !this.isAABBVisibleForStreaming(streamNode.manifest.aabb)) {
        continue;
      }
      loads.push(this.activateStream(streamNode));
    }
    if (loads.length > 0) {
      await Promise.all(loads);
      this.rebuildCandidateQueue(this._generation);
      this.resetQueueProgress(this._generation, this.countPendingFrustumChunks());
    }
  }

  private async activateStream(streamNode: StreamNode): Promise<void> {
    if (streamNode.loaded) {
      return;
    }
    if (streamNode.loading) {
      await streamNode.loading;
      return;
    }
    streamNode.loading = this.loadStreamNode(streamNode);
    try {
      await streamNode.loading;
    } finally {
      streamNode.loading = undefined;
    }
  }

  private async loadStreamNode(streamNode: StreamNode): Promise<void> {
    const json = await this._getStreamIndex(streamNode.manifest);
    const result = readStreamIndexJSON(json);
    if (result.ok === false) {
      throw new Error(result.error);
    }
    const childBaseURI = streamNode.manifest.uri;
    const childIndex = namespaceStreamIndex(result.value, streamNode.namespace, childBaseURI, streamNode.origin, this._targetCoordinateSystem);
    for (const assetManifest of childIndex.chunks.filter((manifest) => manifest.role === "assetLibrary")) {
      this._assetChunksById.set(assetManifest.id, assetManifest);
      this._manifestLookup.byId[assetManifest.id] = assetManifest;
      if (assetManifest.uri) {
        this._manifestLookup.byUri[assetManifest.uri] = assetManifest;
      }
    }
    for (const manifest of childIndex.chunks.filter((manifest) => manifest.role === "referencesOnly")) {
      this.chunkManifests.push(manifest);
      this._manifestLookup.byId[manifest.id] = manifest;
      if (manifest.uri) {
        this._manifestLookup.byUri[manifest.uri] = manifest;
      }
    }
    for (const childStream of childIndex.streams || []) {
      this._streamNodes.push({
        manifest: childStream,
        namespace: `${childStream.id}::`,
        origin: childStream.origin || [0, 0, 0],
        loaded: false,
        chunkIds: [],
        assetChunkIds: []
      });
    }
    streamNode.chunkIds = childIndex.chunks
      .filter((manifest) => manifest.role === "referencesOnly")
      .map((manifest) => manifest.id);
    streamNode.assetChunkIds = childIndex.chunks
      .filter((manifest) => manifest.role === "assetLibrary")
      .map((manifest) => manifest.id);
    streamNode.loaded = true;
  }

  private deactivateInvisibleStreams(): void {
    for (const streamNode of [...this._streamNodes]) {
      if (!streamNode.loaded || streamNode.loading || this.isAABBVisibleForStreaming(streamNode.manifest.aabb)) {
        continue;
      }
      this.deactivateStream(streamNode);
    }
  }

  private deactivateStream(streamNode: StreamNode): void {
    const protectedIds = new Set(this.loadingChunkIds);
    if (streamNode.chunkIds.some((chunkId) => protectedIds.has(chunkId))) {
      return;
    }
    const chunkManifests = streamNode.chunkIds
      .map((chunkId) => this.manifestById(chunkId))
      .filter((manifest): manifest is XGFChunkManifest => !!manifest);
    for (const manifest of chunkManifests) {
      if (this.loadedChunkIds.has(manifest.id)) {
        const result = this._loader.unloadChunk({
          sceneModel: this._sceneModel,
          chunkId: manifest.id
        });
        if (result.ok === false) {
          this._onError?.(result.error);
          continue;
        }
        this.loadedChunkIds.delete(manifest.id);
        this._chunkLastUsed.delete(manifest.id);
        this.loadedTotals.objects = Math.max(0, this.loadedTotals.objects - (manifest.counts?.objects || 0));
        this.loadedTotals.meshes = Math.max(0, this.loadedTotals.meshes - (manifest.counts?.meshes || 0));
      }
    }
    for (const chunkId of streamNode.assetChunkIds) {
      if (!this.loadedAssetLibraryIds.has(chunkId)) {
        continue;
      }
      const result = this._loader.unloadChunk({
        sceneModel: this._sceneModel,
        chunkId
      });
      if (result.ok === false) {
        this._onError?.(result.error);
        continue;
      }
      this.loadedAssetLibraryIds.delete(chunkId);
    }
    this.chunkManifests.splice(0, this.chunkManifests.length, ...this.chunkManifests.filter((manifest) => !streamNode.chunkIds.includes(manifest.id)));
    for (const chunkId of [...streamNode.chunkIds, ...streamNode.assetChunkIds]) {
      delete this._manifestLookup.byId[chunkId];
      this._assetChunksById.delete(chunkId);
    }
    for (const uri of Object.keys(this._manifestLookup.byUri)) {
      if ([...streamNode.chunkIds, ...streamNode.assetChunkIds].includes(this._manifestLookup.byUri[uri].id)) {
        delete this._manifestLookup.byUri[uri];
      }
    }
    for (let i = this._streamNodes.length - 1; i >= 0; i--) {
      const child = this._streamNodes[i];
      if (child !== streamNode && child.namespace.startsWith(streamNode.namespace)) {
        this._streamNodes.splice(i, 1);
      }
    }
    streamNode.loaded = false;
    streamNode.chunkIds = [];
    streamNode.assetChunkIds = [];
    this.rebuildCandidateQueue(this._generation);
    this.emitProgress();
  }

  private chunkPriority(manifest: XGFChunkManifest): number {
    return this.chunkPriorityFromVisibility(manifest, this.isVisibleForStreaming(manifest));
  }

  private prioritizeManifestRecords(chunkManifests: XGFChunkManifest[]): PrioritizedManifest[] {
    const records = chunkManifests.map((manifest) => {
      const visibleForStreaming = this.isVisibleForStreaming(manifest);
      return {
        manifest,
        visibleForStreaming,
        priority: this.chunkPriorityFromVisibility(manifest, visibleForStreaming)
      };
    });
    records.sort(comparePriorityRecords);
    return records;
  }

  private chunkPriorityFromVisibility(manifest: XGFChunkManifest, visibleForStreaming: boolean): number {
    return (visibleForStreaming ? 0 : NON_FRUSTUM_PRIORITY_OFFSET) + this.squaredDistanceToPriorityPoint(manifest);
  }

  private isVisibleForStreaming(manifest: XGFChunkManifest): boolean {
    return this.isAABBVisibleForStreaming(manifest.aabb);
  }

  private isAABBVisibleForStreaming(aabb: number[] | undefined): boolean {
    if (!this.intersectsAABB(aabb)) {
      return false;
    }
    if (!aabb || this._minProjectedChunkSizePixels <= 0) {
      return true;
    }
    const projectedSize = projectedAABBMaxCanvasSizePixels(
      aabb,
      this._view,
      this._projectedVisibilityViewProjectionMatrix,
      this._projectedVisibilityClip,
      this._projectedVisibilityPoint
    );
    return projectedSize === undefined || projectedSize >= this._minProjectedChunkSizePixels;
  }

  private intersectsAABB(aabb: number[] | undefined): boolean {
    const frustum = this._view.camera.frustum;
    if (!frustum || !aabb) {
      return true;
    }
    if (!this.intersectsStreamingDepth(aabb)) {
      return false;
    }
    for (const plane of frustum.planes) {
      const x = aabb[plane.testVertex[0] ? 3 : 0];
      const y = aabb[plane.testVertex[1] ? 4 : 1];
      const z = aabb[plane.testVertex[2] ? 5 : 2];
      if ((plane.normal[0] * x) + (plane.normal[1] * y) + (plane.normal[2] * z) + plane.offset < 0) {
        return false;
      }
    }
    return true;
  }

  private intersectsStreamingDepth(aabb: number[]): boolean {
    if (!this._frustumDepthMultiplier) {
      return true;
    }
    const eye = this._view.camera.eye;
    const look = this._view.camera.look;
    if (!eye || !look) {
      return true;
    }
    const dx = look[0] - eye[0];
    const dy = look[1] - eye[1];
    const dz = look[2] - eye[2];
    const lookDistance = Math.hypot(dx, dy, dz);
    if (!Number.isFinite(lookDistance) || lookDistance <= 0) {
      return true;
    }
    const invDistance = 1 / lookDistance;
    const dirX = dx * invDistance;
    const dirY = dy * invDistance;
    const dirZ = dz * invDistance;
    const centerX = (aabb[0] + aabb[3]) * 0.5;
    const centerY = (aabb[1] + aabb[4]) * 0.5;
    const centerZ = (aabb[2] + aabb[5]) * 0.5;
    const halfX = (aabb[3] - aabb[0]) * 0.5;
    const halfY = (aabb[4] - aabb[1]) * 0.5;
    const halfZ = (aabb[5] - aabb[2]) * 0.5;
    const centerDepth =
      (centerX - eye[0]) * dirX +
      (centerY - eye[1]) * dirY +
      (centerZ - eye[2]) * dirZ;
    const radius =
      Math.abs(dirX) * halfX +
      Math.abs(dirY) * halfY +
      Math.abs(dirZ) * halfZ;
    const nearestDepth = centerDepth - radius;
    return nearestDepth <= Math.max(lookDistance * this._frustumDepthMultiplier, this._frustumMinDepth);
  }

  private squaredDistanceToPriorityPoint(manifest: XGFChunkManifest): number {
    const camera = this._view.camera as any;
    const point = this._chunkPriorityTarget === "look" ? camera.look : (camera.eye || camera.look);
    const aabb = manifest.aabb || [0, 0, 0, 0, 0, 0];
    const dx = Math.max(aabb[0] - point[0], 0, point[0] - aabb[3]);
    const dy = Math.max(aabb[1] - point[1], 0, point[1] - aabb[4]);
    const dz = Math.max(aabb[2] - point[2], 0, point[2] - aabb[5]);
    return dx * dx + dy * dy + dz * dz;
  }

  private emitStatus(status: string): void {
    this._onStatus?.(status);
  }

  private emitProgress(): void {
    this._onProgress?.(this.queueProgress);
  }
}

function createPrioritizedFileDataCache(
  concurrency: number,
  resolveFileData: (manifest: XGFChunkManifest, signal?: AbortSignal) => Promise<ArrayBuffer> | ArrayBuffer | undefined,
  options: {
    cacheFileData?: boolean;
    maxCachedFileBytes?: number;
  } = {}
) {
  const cache = new Map<string, FileDataCacheEntry>();
  const queue: FileDataCacheEntry[] = [];
  let activeCount = 0;
  let cachedBytes = 0;
  let cacheSequence = 0;
  const cacheFileData = options.cacheFileData === true;
  const maxCachedFileBytes = cacheFileData
    ? Math.max(0, Math.floor(options.maxCachedFileBytes ?? DEFAULT_MAX_CACHED_FILE_BYTES))
    : 0;

  const getKey = (manifest: XGFChunkManifest) => manifest.id || manifest.uri;

  const touch = (entry: FileDataCacheEntry) => {
    entry.lastUsed = ++cacheSequence;
  };

  const deleteEntry = (entry: FileDataCacheEntry) => {
    if (entry.fileData) {
      cachedBytes = Math.max(0, cachedBytes - entry.byteLength);
      entry.fileData = undefined;
      entry.byteLength = 0;
    }
    cache.delete(entry.key);
  };

  const trimCachedBytes = () => {
    if (!cacheFileData || cachedBytes <= maxCachedFileBytes) {
      return;
    }
    const candidates = Array.from(cache.values())
      .filter((entry) => !entry.active && !entry.aborted && entry.fileData)
      .sort((a, b) => a.lastUsed - b.lastUsed);
    for (const entry of candidates) {
      if (cachedBytes <= maxCachedFileBytes) {
        break;
      }
      deleteEntry(entry);
    }
  };

  const pump = () => {
    while (activeCount < concurrency && queue.length > 0) {
      const entry = queue.shift()!;
      if (entry.aborted) {
        continue;
      }
      entry.active = true;
      activeCount++;
      loadFileData(entry.manifest, resolveFileData, entry.controller.signal)
        .then((fileData) => {
          touch(entry);
          if (cacheFileData && fileData.byteLength <= maxCachedFileBytes) {
            entry.fileData = fileData;
            entry.byteLength = fileData.byteLength;
            cachedBytes += entry.byteLength;
          }
          entry.resolve(fileData);
          trimCachedBytes();
        }, (error) => {
          deleteEntry(entry);
          entry.reject(error);
        })
        .finally(() => {
          entry.active = false;
          activeCount--;
          if (entry.releaseAfterActive && !entry.fileData) {
            deleteEntry(entry);
          }
          trimCachedBytes();
          pump();
        });
    }
  };

  const schedule = (manifest: XGFChunkManifest, priority = 0, token?: number): Promise<ArrayBuffer> => {
    const key = getKey(manifest);
    if (!key) {
      return loadFileData(manifest, resolveFileData);
    }
    const existing = cache.get(key);
    if (existing) {
      touch(existing);
      if (existing.fileData) {
        return Promise.resolve(existing.fileData);
      }
      existing.priority = Math.min(existing.priority, priority);
      existing.token = token;
      if (!existing.active) {
        repositionQueueEntry(queue, existing);
      }
      pump();
      return existing.promise;
    }
    const controller = new AbortController();
    let resolveEntry!: (value: ArrayBuffer | PromiseLike<ArrayBuffer>) => void;
    let rejectEntry!: (reason?: unknown) => void;
    const promise = new Promise<ArrayBuffer>((resolve, reject) => {
      resolveEntry = resolve;
      rejectEntry = reject;
    });
    const entry: FileDataCacheEntry = {
      key,
      manifest,
      priority,
      token,
      controller,
      active: false,
      aborted: false,
      releaseAfterActive: false,
      resolve: resolveEntry,
      reject: rejectEntry,
      promise,
      byteLength: 0,
      lastUsed: ++cacheSequence
    };
    cache.set(key, entry);
    insertQueueEntry(queue, entry);
    pump();
    return promise;
  };

  return {
    get: schedule,
    prefetch: (manifests: XGFChunkManifest[], priorityFn: (manifest: XGFChunkManifest) => number, token?: number): void => {
      for (const manifest of manifests) {
        schedule(manifest, priorityFn(manifest), token).catch((error) => {
          if (!isAbortError(error)) {
            console.warn(`XGF prefetch failed: ${formatError(error)}`);
          }
        });
      }
    },
    abortQueued: (predicate: (manifest: XGFChunkManifest, token: number | undefined) => boolean): void => {
      for (const entry of cache.values()) {
        if (entry.active || entry.aborted || entry.fileData || !predicate(entry.manifest, entry.token)) {
          continue;
        }
        entry.aborted = true;
        entry.controller.abort();
        deleteEntry(entry);
        entry.reject(createAbortError());
      }
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].aborted) {
          queue.splice(i, 1);
        }
      }
    },
    release: (manifest: XGFChunkManifest): void => {
      const key = getKey(manifest);
      if (!key) {
        return;
      }
      const entry = cache.get(key);
      if (!entry || entry.aborted) {
        return;
      }
      if (entry.fileData) {
        touch(entry);
        trimCachedBytes();
        return;
      }
      if (entry.active) {
        entry.releaseAfterActive = !cacheFileData;
        return;
      }
      deleteEntry(entry);
    }
  };
}

function comparePriorityRecords(a: PrioritizedManifest, b: PrioritizedManifest): number {
  if (a.visibleForStreaming !== b.visibleForStreaming) {
    return a.visibleForStreaming ? -1 : 1;
  }
  return a.priority - b.priority;
}

function projectedAABBMaxCanvasSizePixels(
  aabb: number[],
  view: View,
  viewProjectionMatrix: Mat4,
  clip: [number, number, number, number],
  projected: [number, number, number, number]
): number | undefined {
  const camera = view.camera;
  const canvasSize = viewCanvasCssSize(view);
  const viewMatrix = camera?.viewMatrix;
  const projMatrix = camera?.projMatrix;
  if (!canvasSize || !viewMatrix || !projMatrix) {
    return undefined;
  }
  mulMat4(projMatrix, viewMatrix, viewProjectionMatrix);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const x of [aabb[0], aabb[3]]) {
    for (const y of [aabb[1], aabb[4]]) {
      for (const z of [aabb[2], aabb[5]]) {
        clip[0] = x;
        clip[1] = y;
        clip[2] = z;
        clip[3] = 1;
        transformPoint4(viewProjectionMatrix, clip, projected);
        if (!isFiniteClipCoordinate(projected) || projected[3] <= 1e-8) {
          return undefined;
        }
        const ndcX = projected[0] / projected[3];
        const ndcY = projected[1] / projected[3];
        minX = Math.min(minX, ndcX);
        minY = Math.min(minY, ndcY);
        maxX = Math.max(maxX, ndcX);
        maxY = Math.max(maxY, ndcY);
      }
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return undefined;
  }
  const widthPixels = Math.max(0, maxX - minX) * canvasSize.width * 0.5;
  const heightPixels = Math.max(0, maxY - minY) * canvasSize.height * 0.5;
  if (!Number.isFinite(widthPixels) || !Number.isFinite(heightPixels)) {
    return undefined;
  }
  return Math.max(widthPixels, heightPixels);
}

function viewCanvasCssSize(view: View): { width: number; height: number } | undefined {
  const element = view.htmlElement as any;
  let width = 0;
  let height = 0;
  if (element && typeof element.getBoundingClientRect === "function") {
    const rect = element.getBoundingClientRect();
    width = rect?.width || 0;
    height = rect?.height || 0;
  }
  if ((!Number.isFinite(width) || width <= 0) && element) {
    width = element.clientWidth || element.offsetWidth || 0;
  }
  if ((!Number.isFinite(height) || height <= 0) && element) {
    height = element.clientHeight || element.offsetHeight || 0;
  }
  if ((!Number.isFinite(width) || width <= 0) && Array.isArray((view as any).boundary)) {
    width = (view as any).boundary[2] || 0;
  }
  if ((!Number.isFinite(height) || height <= 0) && Array.isArray((view as any).boundary)) {
    height = (view as any).boundary[3] || 0;
  }
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
    ? {width, height}
    : undefined;
}

function isFiniteClipCoordinate(v: ArrayLike<number>): boolean {
  return Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2]) && Number.isFinite(v[3]);
}

function insertQueueEntry(queue: FileDataCacheEntry[], entry: FileDataCacheEntry): void {
  const index = queue.findIndex((candidate) => entry.priority < candidate.priority);
  if (index === -1) {
    queue.push(entry);
    return;
  }
  queue.splice(index, 0, entry);
}

function repositionQueueEntry(queue: FileDataCacheEntry[], entry: FileDataCacheEntry): void {
  const index = queue.indexOf(entry);
  if (index === -1) {
    insertQueueEntry(queue, entry);
    return;
  }
  queue.splice(index, 1);
  insertQueueEntry(queue, entry);
}

async function fetchFileData(manifest: XGFChunkManifest, signal?: AbortSignal): Promise<ArrayBuffer> {
  if (!manifest.uri) {
    throw new Error(`[XGFViewStreamController] Chunk '${manifest.id}' has no URI`);
  }
  const response = await fetch(manifest.uri, {signal});
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${manifest.uri}`);
  }
  return response.arrayBuffer();
}

async function fetchStreamIndexJSON(stream: XGFSubstreamManifest, signal?: AbortSignal): Promise<any> {
  const response = await fetch(stream.uri, {signal});
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${stream.uri}`);
  }
  return response.json();
}

function readStreamIndexJSON(json: any): ReturnType<typeof readXGFStreamingIndex> {
  if (json?.format === "XGFStreamingRuntimeIndex") {
    return readXGFStreamingRuntimeIndex(json);
  }
  return readXGFStreamingIndex(json);
}

function resolveSubstreamManifest(stream: XGFSubstreamManifest, baseURI: string | undefined): XGFSubstreamManifest {
  const origin = stream.origin || [0, 0, 0];
  return {
    ...stream,
    uri: resolveURI(stream.uri, baseURI),
    aabb: translateAABB(stream.aabb, origin),
    origin: stream.origin ? [stream.origin[0], stream.origin[1], stream.origin[2]] : undefined,
    metadata: stream.metadata ? JSON.parse(JSON.stringify(stream.metadata)) : undefined
  };
}

function namespaceStreamIndex(
  index: XGFStreamingIndex,
  namespace: string,
  indexURI: string | undefined,
  origin: [number, number, number],
  targetCoordinateSystem: any
): XGFStreamingIndex {
  const assetPrefix = namespace;
  const coordinateSystemMatrix = createIndexCoordinateSystemMatrix(index.coordinateSystem, targetCoordinateSystem);
  const chunkCoordinateSystem = targetCoordinateSystem ? index.coordinateSystem : undefined;
  const chunks = (index.chunks || []).map((manifest) => namespaceChunkManifest(manifest, namespace, assetPrefix, indexURI, origin, chunkCoordinateSystem, coordinateSystemMatrix));
  const streams = (index.streams || []).map((stream) => ({
    ...stream,
    id: `${namespace}${stream.id}`,
    uri: resolveURI(stream.uri, indexURI),
    aabb: transformAndTranslateAABB(stream.aabb, coordinateSystemMatrix, addOrigins(origin, stream.origin)),
    origin: addOrigins(origin, stream.origin),
    metadata: stream.metadata ? JSON.parse(JSON.stringify(stream.metadata)) : undefined
  }));
  return {
    ...index,
    chunks,
    streams,
    rootChunkIds: index.rootChunkIds?.map((id) => `${namespace}${id}`)
  };
}

function namespaceChunkManifest(
  manifest: XGFChunkManifest,
  namespace: string,
  assetPrefix: string,
  indexURI: string | undefined,
  origin: [number, number, number],
  coordinateSystem: XGFStreamingIndex["coordinateSystem"] | undefined,
  coordinateSystemMatrix: Mat4 | undefined
): XGFChunkManifest {
  const copy: XGFChunkManifest = {
    ...manifest,
    id: `${namespace}${manifest.id}`,
    uri: manifest.uri ? resolveURI(manifest.uri, indexURI) : undefined,
    dependencies: {
      chunks: (manifest.dependencies?.chunks || []).map((dependency) => ({
        id: dependency.id ? `${namespace}${dependency.id}` : undefined,
        uri: dependency.uri ? resolveURI(dependency.uri, indexURI) : undefined
      })),
      geometries: (manifest.dependencies?.geometries || []).map((id) => `${assetPrefix}${id}`),
      materials: (manifest.dependencies?.materials || []).map((id) => `${assetPrefix}${id}`),
      textures: (manifest.dependencies?.textures || []).map((id) => `${assetPrefix}${id}`)
    },
    assets: {
      geometries: (manifest.assets?.geometries || []).map((id) => `${assetPrefix}${id}`),
      materials: (manifest.assets?.materials || []).map((id) => `${assetPrefix}${id}`),
      textures: (manifest.assets?.textures || []).map((id) => `${assetPrefix}${id}`)
    },
    counts: {...manifest.counts},
    aabb: transformAndTranslateAABB(manifest.aabb, coordinateSystemMatrix, origin)
  };
  (copy as any).idPrefix = assetPrefix;
  (copy as any).origin = origin;
  (copy as any).coordinateSystem = coordinateSystem;
  return copy;
}

function createIndexCoordinateSystemMatrix(coordinateSystem: XGFStreamingIndex["coordinateSystem"] | undefined, targetCoordinateSystem: any): Mat4 | undefined {
  if (!coordinateSystem || !targetCoordinateSystem) {
    return undefined;
  }
  return createCoordinateSystemTransform(coordinateSystem as any, targetCoordinateSystem, createMat4Float64());
}

function transformAndTranslateAABB(aabb: number[] | undefined, matrix: Mat4 | undefined, origin: number[] | undefined): number[] | undefined {
  const transformed = matrix ? transformAABB(aabb, matrix) : aabb?.slice();
  return translateAABB(transformed, origin);
}

function transformAABB(aabb: number[] | undefined, matrix: Mat4): number[] | undefined {
  if (!aabb) {
    return undefined;
  }
  const result = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const x of [aabb[0], aabb[3]]) {
    for (const y of [aabb[1], aabb[4]]) {
      for (const z of [aabb[2], aabb[5]]) {
        const point = transformPoint3(matrix, [x, y, z]);
        result[0] = Math.min(result[0], point[0]);
        result[1] = Math.min(result[1], point[1]);
        result[2] = Math.min(result[2], point[2]);
        result[3] = Math.max(result[3], point[0]);
        result[4] = Math.max(result[4], point[1]);
        result[5] = Math.max(result[5], point[2]);
      }
    }
  }
  return result;
}

function translateAABB(aabb: number[] | undefined, origin: number[] | undefined): number[] | undefined {
  if (!aabb) {
    return undefined;
  }
  const offset = origin || [0, 0, 0];
  return [
    aabb[0] + offset[0],
    aabb[1] + offset[1],
    aabb[2] + offset[2],
    aabb[3] + offset[0],
    aabb[4] + offset[1],
    aabb[5] + offset[2]
  ];
}

function addOrigins(a: number[] | undefined, b: number[] | undefined): [number, number, number] {
  return [
    (a?.[0] || 0) + (b?.[0] || 0),
    (a?.[1] || 0) + (b?.[1] || 0),
    (a?.[2] || 0) + (b?.[2] || 0)
  ];
}

function resolveURI(uri: string, baseURI: string | undefined): string {
  if (!baseURI || typeof URL === "undefined") {
    return uri;
  }
  return new URL(uri, baseURI).href;
}

async function loadFileData(
  manifest: XGFChunkManifest,
  resolveFileData: (manifest: XGFChunkManifest, signal?: AbortSignal) => Promise<ArrayBuffer> | ArrayBuffer | undefined,
  signal?: AbortSignal
): Promise<ArrayBuffer> {
  const fileData = await resolveFileData(manifest, signal);
  if (!fileData) {
    throw new Error(`[XGFViewStreamController] File data not found for chunk '${manifest.id}'`);
  }
  return fileData;
}

function waitForFrameBudget(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as {name?: string}).name === "AbortError";
}

function createAbortError(): Error {
  if (typeof DOMException === "function") {
    return new DOMException("Aborted", "AbortError");
  }
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
