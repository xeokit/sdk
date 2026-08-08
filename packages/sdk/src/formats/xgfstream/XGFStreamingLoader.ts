import type {SceneModel} from "../../model/scene";
import {SDKErrorType, type SDKResult} from "../../base/core";
import {XGFLoader} from "../xgf/XGFLoader";
import type {XGFChunkLoadOptions} from "./chunk/XGFChunkLoadOptions";
import type {XGFChunkLoadParams} from "./chunk/XGFChunkLoadParams";
import type {XGFChunksLoadOptions} from "./chunk/XGFChunksLoadOptions";
import type {XGFChunksLoadParams} from "./chunk/XGFChunksLoadParams";
import type {XGFChunkUnloadParams} from "./chunk/XGFChunkUnloadParams";
import type {XGFChunkManifest} from "./chunk/XGFChunkManifest";
import type {XGFChunkLoadStats} from "./chunk/XGFChunkLoadStats";
import type {XGFMissingDependency} from "./chunk/XGFMissingDependency";
import {XGFStreamingIndexLookup} from "./index/XGFStreamingIndexLookup";

interface XGFChunkOwnership {
  id: string;
  role: string;
  objects: string[];
  meshes: string[];
  transforms: string[];
  geometries: string[];
  materials: string[];
  textures: string[];
  referencedGeometries: string[];
  referencedMaterials: string[];
  referencedTextures: string[];
}

interface XGFSceneStreamingState {
  loadedChunkIds: Set<string>;
  loadingChunks: Map<string, Promise<void>>;
  mutationTail: Promise<void>;
  chunks: Map<string, XGFChunkOwnership>;
  geometryRefs: Map<string, number>;
  materialRefs: Map<string, number>;
  textureRefs: Map<string, number>;
}

interface XGFCreatedIdsCollector {
  objects: string[];
  meshes: string[];
  transforms: string[];
  geometries: string[];
  materials: string[];
  textures: string[];
  error?: string;
}

/**
 * Manifest-aware loader for XGF v2 streaming chunks.
 *
 * This composes {@link XGFLoader}; it does not extend `ModelLoader` because it
 * is not a single-file parser. It resolves dependency manifests/file data,
 * loads missing asset-library chunks, then applies references-only chunks.
 */
export class XGFStreamingLoader {

  private readonly _xgfLoader: XGFLoader;
  private readonly _stateBySceneModel = new WeakMap<SceneModel, XGFSceneStreamingState>();

  constructor(params: {
    xgfLoader?: XGFLoader;
  } = {}) {
    this._xgfLoader = params.xgfLoader || new XGFLoader();
  }

  /**
   * Loads one manifest-backed XGF chunk into a SceneModel.
   *
   * Missing dependency chunks are resolved through `options.manifests` and
   * loaded before the requested chunk. Handled validation and dependency
   * failures are reported on the Scene's error channel instead of throwing.
   */
  async loadChunk(params: XGFChunkLoadParams, options: XGFChunkLoadOptions = {}): Promise<void> {
    const visiting = new Set<string>();
    await this._loadChunk(params, options, visiting);
  }

  /**
   * Loads multiple manifest-backed XGF chunks, prefetching their file data with
   * bounded concurrency before applying them in dependency-safe order.
   */
  async loadChunks(params: XGFChunksLoadParams, options: XGFChunksLoadOptions = {}): Promise<void> {
    const {sceneModel, dataModel} = params;
    const state = stateFor(sceneModel, this._stateBySceneModel);
    const planResult = createChunkLoadPlan(params.manifests, options.manifests, state);
    if (planResult.ok === false) {
      sceneModel.scene.logError(planResult);
      return;
    }

    const fileDataCache = await prefetchChunkFileData(
      planResult.value,
      options,
      normalizedConcurrency(options.fetchConcurrency)
    );
    const loadOptions = withFileDataCache(options, fileDataCache);

    for (const manifest of planResult.value) {
      await this._loadChunk({
        manifest,
        sceneModel,
        dataModel
      }, loadOptions, new Set<string>());
    }
  }

  /**
   * Unloads one previously-loaded chunk from a SceneModel.
   *
   * References-only chunks release their objects/meshes/transforms while shared
   * assets stay alive. Asset-library chunks are refused while loaded chunks
   * still reference their assets.
   */
  unloadChunk(params: XGFChunkUnloadParams): SDKResult<void> {
    const {sceneModel, chunkId} = params;
    const state = stateFor(sceneModel, this._stateBySceneModel);
    const ownership = state.chunks.get(chunkId);
    if (!ownership) {
      return sceneModel.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[XGFStreamingLoader.unloadChunk] Chunk '${chunkId}' is not loaded`
      });
    }

    const inUse = ownedAssetsInUse(ownership, state);
    if (inUse.length > 0) {
      return sceneModel.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[XGFStreamingLoader.unloadChunk] Cannot unload chunk '${chunkId}' while assets are referenced: ${inUse.join(", ")}`
      });
    }

    const destroyResult = destroyOwnedContent(sceneModel, ownership);
    if (destroyResult.ok === false) {
      return destroyResult;
    }

    decrementRefs(state.geometryRefs, ownership.referencedGeometries);
    decrementRefs(state.materialRefs, ownership.referencedMaterials);
    decrementRefs(state.textureRefs, ownership.referencedTextures);
    state.loadedChunkIds.delete(chunkId);
    state.chunks.delete(chunkId);
    return {ok: true, value: undefined};
  }

  private async _loadChunk(
    params: XGFChunkLoadParams,
    options: XGFChunkLoadOptions,
    visiting: Set<string>
  ): Promise<void> {
    const {manifest, sceneModel, dataModel} = params;
    const key = chunkKey(manifest);
    const state = stateFor(sceneModel, this._stateBySceneModel);

    if (key && visiting.has(key)) {
      sceneModel.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[XGFStreamingLoader.loadChunk] Cyclic XGF chunk dependency at '${key}'`
      });
      return;
    }
    if (key && state.loadedChunkIds.has(key)) {
      return;
    }
    if (!key) {
      await this._loadChunkNow(params, options, visiting, state);
      return;
    }

    const loadingChunk = state.loadingChunks.get(key);
    if (loadingChunk) {
      await loadingChunk;
      return;
    }

    const loadingPromise = new Promise<void>((resolve, reject) => {
      queueMicrotask(() => {
        this._loadChunkNow(params, options, visiting, state).then(resolve, reject);
      });
    });
    state.loadingChunks.set(key, loadingPromise);
    try {
      await loadingPromise;
    } finally {
      state.loadingChunks.delete(key);
    }
  }

  private async _loadChunkNow(
    params: XGFChunkLoadParams,
    options: XGFChunkLoadOptions,
    visiting: Set<string>,
    state: XGFSceneStreamingState
  ): Promise<void> {
    const {manifest, sceneModel, dataModel} = params;
    const key = chunkKey(manifest);
    const totalStart = now();
    let dependencyMs = 0;
    let fetchMs = 0;
    let commitMs = 0;
    let bytes = params.fileData?.byteLength || 0;
    let createdIds = emptyCreatedIds();
    let error: string | undefined;

    if (key && state.loadedChunkIds.has(key)) {
      return;
    }

    if (manifest.dependencies.chunks.length > 0) {
      const dependencyStart = now();
      if (key) {
        visiting.add(key);
      }
      const loaded = new Set<string>();
      for (const dependency of manifest.dependencies.chunks) {
        const dependencyManifest = findDependencyManifest(dependency, options.manifests);
        if (!dependencyManifest) {
          error = `[XGFStreamingLoader.loadChunk] Dependency chunk manifest not found for '${dependency.id || dependency.uri || ""}'`;
          sceneModel.scene.logError({
            ok: false,
            type: SDKErrorType.InvalidInput,
            error
          });
          if (key) {
            visiting.delete(key);
          }
          emitChunkLoadStats(options, manifest, false, bytes, dependencyMs, fetchMs, commitMs, totalStart, createdIds, error);
          return;
        }
        const dependencyKey = chunkKey(dependencyManifest);
        if (loaded.has(dependencyKey)) {
          continue;
        }
        loaded.add(dependencyKey);
        await this._loadChunk({
          manifest: dependencyManifest,
          sceneModel,
          dataModel
        }, options, visiting);
      }
      if (key) {
        visiting.delete(key);
      }
      dependencyMs = now() - dependencyStart;
    }

    const fetchStart = now();
    const fileData = params.fileData || await resolveChunkFileData(manifest, options);
    fetchMs = params.fileData ? 0 : now() - fetchStart;
    bytes = fileData?.byteLength || bytes;
    if (!fileData) {
      error = `[XGFStreamingLoader.loadChunk] XGF file data not found for chunk '${manifest.id}'`;
      sceneModel.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error
      });
      emitChunkLoadStats(options, manifest, false, bytes, dependencyMs, fetchMs, commitMs, totalStart, createdIds, error);
      return;
    }

    const commitStart = now();
    await runSceneModelMutation(state, async () => {
      if (key && state.loadedChunkIds.has(key)) {
        return;
      }

      const missingAfter = missingAssetDependencies(sceneModel, manifest);
      if (missingAfter.length > 0) {
        error = `[XGFStreamingLoader.loadChunk] Missing XGF chunk dependencies: ${formatMissingDependencies(missingAfter)}`;
        sceneModel.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error
        });
        return;
      }

      if (manifest.role === "assetLibrary" && hasManifestAssets(manifest) && allManifestAssetsExist(sceneModel, manifest)) {
        state.loadedChunkIds.add(key);
        state.chunks.set(key, ownershipFromExistingAssets(manifest));
        return;
      }

      const loadResult = await loadXGFIntoSceneModel(this._xgfLoader, fileData, sceneModel, dataModel, manifest, options, key);
      createdIds = loadResult.createdIds;
      if (loadResult.ok === false) {
        error = loadResult.error;
        sceneModel.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error
        });
        return;
      }
      const ownership = ownershipFromCreatedIds(key, manifest, createdIds);
      incrementRefs(state.geometryRefs, ownership.referencedGeometries);
      incrementRefs(state.materialRefs, ownership.referencedMaterials);
      incrementRefs(state.textureRefs, ownership.referencedTextures);
      state.loadedChunkIds.add(key);
      state.chunks.set(key, ownership);
      if (options.onChunkLoaded) {
        options.onChunkLoaded(manifest);
      }
    });
    commitMs = now() - commitStart;
    emitChunkLoadStats(options, manifest, !error && (!key || state.loadedChunkIds.has(key)), bytes, dependencyMs, fetchMs, commitMs, totalStart, createdIds, error);
  }
}

async function loadXGFIntoSceneModel(
  xgfLoader: XGFLoader,
  fileData: ArrayBuffer,
  sceneModel: SceneModel,
  dataModel: XGFChunkLoadParams["dataModel"],
  manifest: XGFChunkManifest,
  options: XGFChunkLoadOptions,
  key: string
): Promise<{ ok: true; createdIds: XGFCreatedIdsCollector } | { ok: false; createdIds: XGFCreatedIdsCollector; error: string }> {
  const createdIds = emptyCreatedIds();
  const parserOptions: any = {
    ...options,
    idPrefix: (manifest as any).idPrefix,
    origin: (manifest as any).origin,
    coordinateSystem: (manifest as any).coordinateSystem,
    meshIdPrefix: key ? `${key}/mesh/` : undefined,
    createdIds
  };

  try {
    await xgfLoader.load({fileData, sceneModel, dataModel}, parserOptions);
  } catch (loadError) {
    rollbackCreatedContent(sceneModel, key, manifest, createdIds);
    return {
      ok: false,
      createdIds,
      error: `[XGFStreamingLoader.loadChunk] Failed loading chunk '${manifest.id}': ${formatError(loadError)}`
    };
  }

  if (createdIds.error) {
    rollbackCreatedContent(sceneModel, key, manifest, createdIds);
    return {
      ok: false,
      createdIds,
      error: createdIds.error
    };
  }

  return {
    ok: true,
    createdIds
  };
}

function rollbackCreatedContent(
  sceneModel: SceneModel,
  key: string,
  manifest: XGFChunkManifest,
  createdIds: XGFCreatedIdsCollector
): void {
  const result = destroyOwnedContent(sceneModel, ownershipFromCreatedIds(key, manifest, createdIds));
  if (result.ok === false) {
    sceneModel.scene.logError(result);
  }
}

function stateFor(
  sceneModel: SceneModel,
  stateBySceneModel: WeakMap<SceneModel, XGFSceneStreamingState>
): XGFSceneStreamingState {
  let state = stateBySceneModel.get(sceneModel);
  if (!state) {
    state = {
      loadedChunkIds: new Set<string>(),
      loadingChunks: new Map<string, Promise<void>>(),
      mutationTail: Promise.resolve(),
      chunks: new Map<string, XGFChunkOwnership>(),
      geometryRefs: new Map<string, number>(),
      materialRefs: new Map<string, number>(),
      textureRefs: new Map<string, number>()
    };
    stateBySceneModel.set(sceneModel, state);
  }
  return state;
}

async function runSceneModelMutation<T>(
  state: XGFSceneStreamingState,
  mutation: () => Promise<T>
): Promise<T> {
  const previous = state.mutationTail;
  let release: () => void = () => {};
  state.mutationTail = new Promise<void>(resolve => {
    release = resolve;
  });
  await previous.catch(() => {});
  try {
    return await mutation();
  } finally {
    release();
  }
}

function chunkKey(manifest: XGFChunkManifest): string {
  return manifest.id || manifest.uri || "";
}

function createChunkLoadPlan(
  manifests: XGFChunkManifest[],
  lookup: XGFChunkLoadOptions["manifests"],
  state: XGFSceneStreamingState
): SDKResult<XGFChunkManifest[]> {
  const plan: XGFChunkManifest[] = [];
  const planned = new Set<string>();
  const visiting = new Set<string>();
  const available = lookup || manifests;

  for (const manifest of manifests) {
    const result = addChunkAndDependenciesToPlan(manifest, available, state, visiting, planned, plan);
    if (result.ok === false) {
      return result;
    }
  }
  return {ok: true, value: plan};
}

function addChunkAndDependenciesToPlan(
  manifest: XGFChunkManifest,
  available: XGFChunkLoadOptions["manifests"],
  state: XGFSceneStreamingState,
  visiting: Set<string>,
  planned: Set<string>,
  plan: XGFChunkManifest[]
): SDKResult<void> {
  const key = chunkKey(manifest);
  if (!key) {
    return invalid("[XGFStreamingLoader.loadChunks] Chunk manifest requires id or uri");
  }
  if (state.loadedChunkIds.has(key) || planned.has(key)) {
    return {ok: true, value: undefined};
  }
  if (visiting.has(key)) {
    return invalid(`[XGFStreamingLoader.loadChunks] Cyclic XGF chunk dependency at '${key}'`);
  }
  visiting.add(key);
  for (const dependency of manifest.dependencies.chunks) {
    const dependencyManifest = findDependencyManifest(dependency, available);
    if (!dependencyManifest) {
      return invalid(`[XGFStreamingLoader.loadChunks] Dependency chunk manifest not found for '${dependency.id || dependency.uri || ""}'`);
    }
    const result = addChunkAndDependenciesToPlan(dependencyManifest, available, state, visiting, planned, plan);
    if (result.ok === false) {
      return result;
    }
  }
  visiting.delete(key);
  planned.add(key);
  plan.push(manifest);
  return {ok: true, value: undefined};
}

async function prefetchChunkFileData(
  manifests: XGFChunkManifest[],
  options: XGFChunkLoadOptions,
  concurrency: number
): Promise<Record<string, ArrayBuffer>> {
  const cache: Record<string, ArrayBuffer> = {};
  const queue = manifests.slice();
  const workers: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push((async () => {
      for (;;) {
        const manifest = queue.shift();
        if (!manifest) {
          return;
        }
        const key = chunkKey(manifest);
        if (!key || cache[key]) {
          continue;
        }
        const fileData = await resolveChunkFileData(manifest, options);
        if (fileData) {
          cache[key] = fileData;
        }
      }
    })());
  }
  await Promise.all(workers);
  return cache;
}

function withFileDataCache(
  options: XGFChunksLoadOptions,
  fileDataCache: Record<string, ArrayBuffer>
): XGFChunkLoadOptions {
  return {
    ...options,
    fileDataByChunkId: {
      ...options.fileDataByChunkId,
      ...fileDataCache
    },
    fileDataByUri: {
      ...options.fileDataByUri,
      ...fileDataCache
    }
  };
}

function normalizedConcurrency(value: number | undefined): number {
  return Number.isFinite(value) && value! > 0 ? Math.max(1, Math.floor(value!)) : 8;
}

function emitChunkLoadStats(
  options: XGFChunkLoadOptions,
  manifest: XGFChunkManifest,
  ok: boolean,
  bytes: number,
  dependencyMs: number,
  fetchMs: number,
  commitMs: number,
  totalStart: number,
  createdIds: XGFCreatedIdsCollector,
  error?: string
): void {
  if (!options.onChunkLoadStats) {
    return;
  }
  const stats: XGFChunkLoadStats = {
    manifest,
    chunkId: chunkKey(manifest),
    role: manifest.role,
    ok,
    bytes,
    dependencyMs,
    fetchMs,
    commitMs,
    totalMs: now() - totalStart,
    created: {
      objects: createdIds.objects.length,
      meshes: createdIds.meshes.length,
      transforms: createdIds.transforms.length,
      geometries: createdIds.geometries.length,
      materials: createdIds.materials.length,
      textures: createdIds.textures.length
    },
    error
  };
  options.onChunkLoadStats(stats);
}

function now(): number {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

function missingAssetDependencies(sceneModel: SceneModel, manifest: XGFChunkManifest): XGFMissingDependency[] {
  const missing: XGFMissingDependency[] = [];
  for (const id of manifest.dependencies.geometries) {
    if (!sceneModel.geometries[id]) missing.push({kind: "geometry", id});
  }
  for (const id of manifest.dependencies.materials) {
    if (!sceneModel.materials[id]) missing.push({kind: "material", id});
  }
  for (const id of manifest.dependencies.textures) {
    if (!sceneModel.textures[id]) missing.push({kind: "texture", id});
  }
  return missing;
}

function allManifestAssetsExist(sceneModel: SceneModel, manifest: XGFChunkManifest): boolean {
  return manifest.assets.geometries.every(id => !!sceneModel.geometries[id])
    && manifest.assets.materials.every(id => !!sceneModel.materials[id])
    && manifest.assets.textures.every(id => !!sceneModel.textures[id]);
}

function hasManifestAssets(manifest: XGFChunkManifest): boolean {
  return manifest.assets.geometries.length > 0
    || manifest.assets.materials.length > 0
    || manifest.assets.textures.length > 0;
}

function ownershipFromExistingAssets(manifest: XGFChunkManifest): XGFChunkOwnership {
  return {
    id: manifest.id,
    role: manifest.role,
    objects: [],
    meshes: [],
    transforms: [],
    geometries: [],
    materials: [],
    textures: [],
    referencedGeometries: manifest.dependencies.geometries.slice(),
    referencedMaterials: manifest.dependencies.materials.slice(),
    referencedTextures: manifest.dependencies.textures.slice()
  };
}

function ownershipFromCreatedIds(
  id: string,
  manifest: XGFChunkManifest,
  createdIds: XGFCreatedIdsCollector
): XGFChunkOwnership {
  return {
    id,
    role: manifest.role,
    objects: createdIds.objects.slice(),
    meshes: createdIds.meshes.slice(),
    transforms: createdIds.transforms.slice(),
    geometries: createdIds.geometries.slice(),
    materials: createdIds.materials.slice(),
    textures: createdIds.textures.slice(),
    referencedGeometries: manifest.dependencies.geometries.slice(),
    referencedMaterials: manifest.dependencies.materials.slice(),
    referencedTextures: manifest.dependencies.textures.slice()
  };
}

function emptyCreatedIds(): XGFCreatedIdsCollector {
  return {
    objects: [],
    meshes: [],
    transforms: [],
    geometries: [],
    materials: [],
    textures: []
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function incrementRefs(refs: Map<string, number>, ids: string[]): void {
  for (const id of ids) {
    refs.set(id, (refs.get(id) || 0) + 1);
  }
}

function decrementRefs(refs: Map<string, number>, ids: string[]): void {
  for (const id of ids) {
    const next = (refs.get(id) || 0) - 1;
    if (next > 0) {
      refs.set(id, next);
    } else {
      refs.delete(id);
    }
  }
}

function ownedAssetsInUse(ownership: XGFChunkOwnership, state: XGFSceneStreamingState): string[] {
  const inUse: string[] = [];
  for (const id of ownership.geometries) {
    if ((state.geometryRefs.get(id) || 0) > 0) inUse.push(`geometry:${id}`);
  }
  for (const id of ownership.materials) {
    if ((state.materialRefs.get(id) || 0) > 0) inUse.push(`material:${id}`);
  }
  for (const id of ownership.textures) {
    if ((state.textureRefs.get(id) || 0) > 0) inUse.push(`texture:${id}`);
  }
  return inUse;
}

function destroyOwnedContent(sceneModel: SceneModel, ownership: XGFChunkOwnership): SDKResult<void> {
  let result = destroyFromRegistry(sceneModel.objects, ownership.objects);
  if (result.ok === false) return result;
  result = destroyFromRegistry(sceneModel.meshes, ownership.meshes);
  if (result.ok === false) return result;
  result = destroyFromRegistry((sceneModel as any).transforms || {}, ownership.transforms);
  if (result.ok === false) return result;
  result = destroyFromRegistry(sceneModel.materials, ownership.materials);
  if (result.ok === false) return result;
  result = destroyFromRegistry(sceneModel.geometries, ownership.geometries);
  if (result.ok === false) return result;
  result = destroyFromRegistry(sceneModel.textures, ownership.textures);
  if (result.ok === false) return result;
  return {ok: true, value: undefined};
}

function destroyFromRegistry(registry: Record<string, any>, ids: string[]): SDKResult<void> {
  for (const id of ids) {
    const component = registry[id];
    if (!component || component.destroyed) {
      continue;
    }
    const result = component.destroy();
    if (result && result.ok === false) {
      return result;
    }
  }
  return {ok: true, value: undefined};
}

function formatMissingDependencies(missing: XGFMissingDependency[]): string {
  return missing.map(dep => `${dep.kind}:${dep.id}`).join(", ");
}

function invalid<T>(error: string): SDKResult<T> {
  return {
    ok: false,
    type: SDKErrorType.InvalidInput,
    error
  };
}

function findDependencyManifest(
  dependency: { id?: string; uri?: string },
  manifests?: XGFChunkLoadOptions["manifests"]
): XGFChunkManifest | undefined {
  if (!manifests) {
    return undefined;
  }
  if (manifests instanceof XGFStreamingIndexLookup) {
    return manifests.get(dependency);
  }
  if (Array.isArray(manifests)) {
    return manifests.find(manifest =>
      (!!dependency.id && manifest.id === dependency.id)
      || (!!dependency.uri && manifest.uri === dependency.uri));
  }
  return (dependency.id && manifests[dependency.id])
    || (dependency.uri && manifests[dependency.uri])
    || undefined;
}

async function resolveChunkFileData(
  manifest: XGFChunkManifest,
  options: XGFChunkLoadOptions
): Promise<ArrayBuffer | undefined> {
  if (manifest.id && options.fileDataByChunkId?.[manifest.id]) {
    return options.fileDataByChunkId[manifest.id];
  }
  if (manifest.uri && options.fileDataByUri?.[manifest.uri]) {
    return options.fileDataByUri[manifest.uri];
  }
  if (options.getFileData) {
    try {
      return await options.getFileData(manifest);
    } catch {
      return undefined;
    }
  }
  if (manifest.uri && typeof fetch === "function") {
    try {
      const response = await fetch(manifest.uri);
      return response.ok ? await response.arrayBuffer() : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
