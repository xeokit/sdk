import type {SceneModel} from "../../../model/scene";
import type {View} from "../../../viewing/viewer";
import {XGFStreamingLoader} from "../XGFStreamingLoader";
import {createXGFStreamingIndexLookup} from "../index/createXGFStreamingIndexLookup";
import type {XGFChunkLoadOptions} from "../chunk/XGFChunkLoadOptions";
import type {XGFChunkManifest} from "../chunk/XGFChunkManifest";
import type {XGFViewStreamControllerParams, XGFViewStreamProgress} from "./XGFViewStreamControllerParams";

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
  intersectsFrustum: boolean;
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
  private readonly _cameraDebounceMs: number;
  private readonly _enableLRUEviction: boolean;
  private readonly _maxResidentChunks: number;
  private readonly _onStatus?: (status: string) => void;
  private readonly _onProgress?: (progress: XGFViewStreamProgress) => void;
  private readonly _onChunksLoading?: (manifests: XGFChunkManifest[]) => void;
  private readonly _onError?: (error: unknown) => void;

  private _generation = 0;
  private _pendingGeneration = 0;
  private _running = false;
  private _lruSequence = 0;
  private readonly _chunkLastUsed = new Map<string, number>();
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
    this._assetChunksById = new Map(
      params.index.chunks
        .filter((manifest) => manifest.role === "assetLibrary")
        .map((manifest) => [manifest.id, manifest])
    );
    this._batchSize = params.batchSize || DEFAULT_BATCH_SIZE;
    this._commitFrameBudgetMs = params.commitFrameBudgetMs ?? DEFAULT_COMMIT_FRAME_BUDGET_MS;
    this._frustumOnly = params.frustumOnly !== false;
    this._cameraDebounceMs = params.cameraDebounceMs ?? DEFAULT_CAMERA_DEBOUNCE_MS;
    this._enableLRUEviction = params.enableLRUEviction === true;
    this._maxResidentChunks = this._enableLRUEviction
      ? Math.max(0, Math.floor(params.maxResidentChunks ?? DISABLED_MAX_RESIDENT_CHUNKS))
      : DISABLED_MAX_RESIDENT_CHUNKS;
    this._onStatus = params.onStatus;
    this._onProgress = params.onProgress;
    this._onChunksLoading = params.onChunksLoading;
    this._onError = params.onError;
    this.chunkManifests = params.index.chunks
      .filter((manifest) => manifest.role === "referencesOnly")
      .filter((manifest) => params.chunkFilter ? params.chunkFilter(manifest) : true);
    const onChunkLoaded = params.loadOptions?.onChunkLoaded;
    const onChunkLoadStats = params.loadOptions?.onChunkLoadStats;
    this._loadOptions = {
      ...params.loadOptions,
      manifests: params.loadOptions?.manifests || createXGFStreamingIndexLookup(params.index),
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
      !this.intersectsCameraFrustum(manifest)
    ));
    this._fileDataCache.prefetch(
      chunkManifests.filter((manifest) => !this.isLoadedManifest(manifest)),
      (manifest) => this.chunkPriority(manifest) + 1000,
      generation
    );
  }

  private async runGeneration(generation: number, label: string): Promise<void> {
    if (this._running) {
      this._pendingGeneration = generation;
      return;
    }
    this._running = true;
    let activeGeneration = generation;
    try {
      while (activeGeneration || this.hasPendingQueuedChunks()) {
        const batchGeneration = activeGeneration || this._generation;
        this._pendingGeneration = 0;
        this.ensureCandidateQueue(batchGeneration);
        const candidates = this.nextAutoCandidates(this._batchSize);
        if (candidates.length === 0) {
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
        if (generation !== undefined && generation !== this._generation && frustumOnly && !this.intersectsCameraFrustum(manifest)) {
          continue;
        }
        if (frustumOnly && !this.intersectsCameraFrustum(manifest)) {
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
      if (this._frustumOnly && !this.intersectsCameraFrustum(manifest)) {
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
        (!this._frustumOnly || this.intersectsCameraFrustum(manifest))
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
    if (this._candidateQueue.generation !== generation) {
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
      const intersectsFrustum = this.intersectsCameraFrustum(manifest);
      if (this._frustumOnly && !intersectsFrustum) {
        continue;
      }
      records.push({
        manifest,
        intersectsFrustum,
        priority: this.chunkPriorityFromFrustumState(manifest, intersectsFrustum)
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
      const manifest = this.manifestById(chunkId);
      const result = this._loader.unloadChunk({
        sceneModel: this._sceneModel,
        chunkId
      });
      if (result.ok === false) {
        this._onError?.(result.error);
        continue;
      }
      this.loadedChunkIds.delete(chunkId);
      this._chunkLastUsed.delete(chunkId);
      if (manifest) {
        this.loadedTotals.objects = Math.max(0, this.loadedTotals.objects - (manifest.counts?.objects || 0));
        this.loadedTotals.meshes = Math.max(0, this.loadedTotals.meshes - (manifest.counts?.meshes || 0));
      }
      evicted++;
    }
    if (evicted > 0) {
      this.emitStatus(`Evicted ${evicted} LRU chunk(s); ${this.loadedChunkIds.size}/${this.chunkManifests.length} chunks resident`);
      this.emitProgress();
    }
  }

  private protectedChunkIds(): Set<string> {
    const protectedChunkIds = new Set<string>(this.loadingChunkIds);
    for (const manifest of this._candidateQueue.chunks) {
      if (this.intersectsCameraFrustum(manifest)) {
        protectedChunkIds.add(manifest.id);
      }
    }
    for (const manifest of this.chunkManifests) {
      if (this.intersectsCameraFrustum(manifest)) {
        protectedChunkIds.add(manifest.id);
      }
    }
    return protectedChunkIds;
  }

  private manifestById(chunkId: string): XGFChunkManifest | undefined {
    return this.chunkManifests.find((manifest) => manifest.id === chunkId);
  }

  private chunkPriority(manifest: XGFChunkManifest): number {
    return this.chunkPriorityFromFrustumState(manifest, this.intersectsCameraFrustum(manifest));
  }

  private prioritizeManifestRecords(chunkManifests: XGFChunkManifest[]): PrioritizedManifest[] {
    const records = chunkManifests.map((manifest) => {
      const intersectsFrustum = this.intersectsCameraFrustum(manifest);
      return {
        manifest,
        intersectsFrustum,
        priority: this.chunkPriorityFromFrustumState(manifest, intersectsFrustum)
      };
    });
    records.sort(comparePriorityRecords);
    return records;
  }

  private chunkPriorityFromFrustumState(manifest: XGFChunkManifest, intersectsFrustum: boolean): number {
    return (intersectsFrustum ? 0 : NON_FRUSTUM_PRIORITY_OFFSET) + this.squaredDistanceToLookPoint(manifest);
  }

  private intersectsCameraFrustum(manifest: XGFChunkManifest): boolean {
    const frustum = this._view.camera.frustum;
    const aabb = manifest.aabb;
    if (!frustum || !aabb) {
      return true;
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

  private squaredDistanceToLookPoint(manifest: XGFChunkManifest): number {
    const look = this._view.camera.look;
    const aabb = manifest.aabb || [0, 0, 0, 0, 0, 0];
    const dx = Math.max(aabb[0] - look[0], 0, look[0] - aabb[3]);
    const dy = Math.max(aabb[1] - look[1], 0, look[1] - aabb[4]);
    const dz = Math.max(aabb[2] - look[2], 0, look[2] - aabb[5]);
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
  if (a.intersectsFrustum !== b.intersectsFrustum) {
    return a.intersectsFrustum ? -1 : 1;
  }
  return a.priority - b.priority;
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
