import {RenderContext} from "../RenderContext";
import {SDKErrorType, type SDKResult} from "../../../../base/core";
import type {SceneMaterial, SceneMesh, SceneModel, SceneObject} from "../../../../model/scene";
import {RendererObject} from "./RendererObject";
import {RendererMesh} from "./RendererMesh";
import {MeshBatchImpl} from "./MeshBatchImpl";
import {type MeshBatch} from "./MeshBatch";
import type {Camera, ViewObject} from "../../../viewer";
import type {SceneTransform} from "../../../../model/scene/SceneTransform";
import {GPUMemoryCheckResult, GPUMemoryManager, type GPUTile} from "../gpuMemoryManager";
import {SceneGeometry} from "../../../../model/scene";
import {GaussianSplatsPrimitive} from "../../../../base/constants";
import {SplatBatch} from "../gpuMemoryManager/SplatBatch";
import {RendererSplatMesh} from "./RendererSplatMesh";

/**
 * Per-batch splat capacity for the (single) {@link SplatBatch}. Sizes the splat
 * data texture's GPU budget — ~1.5M splats × 64 B ≈ 96 MB. P1 uses one fixed
 * batch; multiple / dynamically-sized splat batches are a later optimization.
 */
const MAX_SPLATS_PER_BATCH = 1_500_000;

type MeshBatchKey = string;

/**
 * Bridges scene/view state changes into GPU-ready render state for the renderer.
 *
 * @remarks
 * - `MeshManager` is owned by a {@link ViewManager}, which manages all {@link viewing!viewer.View | View}s for a single {@link viewing!viewer.Viewer | Viewer} (not one ViewManager per View).
 * - It acts as the central bridge between the scene graph (models, objects, meshes) and the renderer's GPU memory and batching subsystems.
 * - Owns the renderer-side representation of:
 *   - {@link model!scene.SceneObject | SceneObject}s (as {@link RendererObject}s, which can span multiple meshes)
 *   - {@link model!scene.SceneMesh | SceneMesh} instances (as {@link RendererMesh}s)
 *   - {@link MeshBatch} groupings (as {@link MeshBatchImpl}s), used to batch meshes by primitive type and compatibility constraints, backed by {@link GPUMemoryManager} allocations.
 * - Coordinates with {@link GPUMemoryManager} to allocate, update, and release GPU memory for mesh, geometry, and attribute data.
 * - Maintains mesh batches for efficient rendering, minimizing draw calls and optimizing memory usage.
 * - Handles registration and lifecycle of models, objects, and meshes in response to scene/view events.
 * - Forwards per-frame and per-event updates (matrix, color, opacity, visibility, etc.) to the relevant renderer objects/meshes and/or {@link GPUMemoryManager}.
 * - Used internally by the renderer; not accessed directly by application code.
 *
 * ## Architectural Role
 * - The {@link WebGLRenderer} owns a single {@link ViewManager} for each renderer instance.
 * - The {@link ViewManager} manages all {@link viewing!viewer.View | View}s for the {@link viewing!viewer.Viewer | Viewer}.
 * - The `MeshManager` is owned by the {@link ViewManager} and manages all renderer objects and meshes for all views.
 * - `MeshManager` ensures that changes in the scene or any view are efficiently reflected in GPU state, supporting high-performance, multi-view rendering.
 *
 * @internal
 */
export class MeshManager {

  /**
   * Renderer objects keyed by {@link SceneObject.id}.
   *
   * Note: a {@link model!scene.SceneObject | SceneObject} can belong to many models in some scene graphs; this manager
   * treats object IDs as globally unique and maps them to a single {@link RendererObject}.
   */
  private _rendererObjects: Record<string, RendererObject> = {};

  /**
   * Renderer meshes keyed by {@link SceneMesh.uniqueId}.
   */
  private _rendererMeshes: Record<string, RendererMesh> = {};

  /** Renderer-side handles for gaussian-splat meshes (kept out of {@link _rendererMeshes}). */
  private _rendererSplatMeshes: Record<string, RendererSplatMesh> = {};
  /** Splat meshes keyed by their pick id (written into the pick buffer). */
  private _splatPickMeshes: Map<number, RendererSplatMesh> = new Map();
  private _nextSplatPickId = 0;

  /** Lazily-created shared GPU storage for all gaussian splats. */
  private _splatBatch: SplatBatch | null = null;

  /** Shared render context used for device resources and viewer access. */
  private _renderContext: RenderContext;

  /** Allocates/updates GPU memory for batches, meshes, and per-frame state. */
  private _gpuMemoryManager: GPUMemoryManager;

  /**
   * Mesh batches.
   *
   * Batches are grouped primarily by primitive type (and additional compatibility checks).
   */
  private _batches: MeshBatchImpl[] = [];

  /** Compatible mesh batches keyed by primitive/material-layout/bin axes. */
  private _batchesByKey: Map<MeshBatchKey, MeshBatchImpl[]> = new Map();

  /** Whether {@link _batches} needs to be re-sorted by primitive. */
  private _batchesDirty = true;

  /**
   * Opt-in step-level timing for {@link _addMesh}. Off by default so
   * the hot path takes no `performance.now()` hit in normal use.
   * Toggle via {@link enableStepStats}.
   *
   * @internal
   */
  private _stepStatsEnabled = false;

  /**
   * Per-step counters/timings populated when {@link _stepStatsEnabled}
   * is on. Read via {@link getStepStats}, cleared via
   * {@link resetStepStats}. Used by the load-pipeline benchmark to
   * attribute time inside `SceneModel.createMesh`'s synchronous
   * renderer cascade.
   *
   * @internal
   */
  private _stepStats: MeshManagerStepStats = {
    getMeshBatchMs: 0,
    getMeshBatchCalls: 0,
    batchScanIters: 0,
    newBatches: 0,
    batchAddMeshMs: 0,
    batchAddMeshCalls: 0,
    rendererMeshCtorMs: 0,
    rendererMeshCtorCalls: 0,
  };

  /**
   * Creates a {@link MeshManager}.
   *
   * @param renderContext - Shared renderer context (provides access to viewer + WebGL resources).
   * @param gpuMemoryManager - GPU memory allocator/uploader used by batches and meshes.
   */
  constructor(renderContext: RenderContext, gpuMemoryManager: GPUMemoryManager) {
    this._renderContext = renderContext;
    this._gpuMemoryManager = gpuMemoryManager;
  }

  /**
   * Initializes the manager by registering any existing {@link model!scene.SceneModel | SceneModel}s and {@link model!scene.SceneObject | SceneObject}s
   * already present in the viewer's scene.
   *
   * @returns {@link base!core.SDKResult | SDKResult} that is `ok:true` when initialization succeeds, or `ok:false` if
   * any object registration fails.
   *
   * @remarks
   * This method assumes that the scene is the source of truth, but still performs defensive checks
   * (eg. rejecting duplicate IDs) because scene event streams may not be perfectly reliable.
   */
  public init(): SDKResult<void> {
    const {
      models: sceneModels,
      objects: sceneObjects
    } = this._renderContext.viewer.scene;

    for (const sceneModelId in sceneModels) {
      this.sceneModelCreated(sceneModels[sceneModelId]);
    }

    for (const sceneObjectId in sceneObjects) {
      const result = this.sceneObjectCreated(sceneObjects[sceneObjectId]);
      if (result.ok === false) {
        return result;
      }
    }

    return {ok: true, value: undefined};
  }

  /**
   * Registers a newly created {@link model!scene.SceneModel | SceneModel}.
   *
   * @param sceneModel - The model to register.
   * @returns {@link base!core.SDKResult | SDKResult} indicating success, or `ok:false` if a model with the same id
   * was already registered.
   */
  public sceneModelCreated(sceneModel: SceneModel): SDKResult<any> {
    return {ok: true, value: undefined};
  }

  /**
   * Unregisters a {@link model!scene.SceneModel | SceneModel}.
   *
   * @param sceneModel - The model to unregister.
   * @returns {@link base!core.SDKResult | SDKResult} indicating success, or `ok:false` if the model was not registered.
   */
  public sceneModelDestroyed(sceneModel: SceneModel): SDKResult<any> {
    for (const sceneObject of Object.values(sceneModel.objects)) {
      if (this._rendererObjects[sceneObject.id]) {
        delete this._rendererObjects[sceneObject.id];
      }
    }
    for (const sceneMesh of Object.values(sceneModel.meshes)) {
      this._removeMesh(sceneMesh);
    }
    this._batchesDirty = true;
    return {ok: true, value: undefined};
  }

  /**
   * Registers a newly created {@link model!scene.SceneGeometry | SceneGeometry}.
   *
   * @param sceneGeometry - The geometry to register.
   * @returns {@link base!core.SDKResult | SDKResult} indicating success, or `ok:false` if registration fails.
   */
  public sceneGeometryCreated(sceneGeometry: SceneGeometry): SDKResult<any> {
    return {ok: true, value: undefined};
  }

  /**
   * Unregisters a {@link model!scene.SceneGeometry | SceneGeometry}.
   * @param sceneGeometry - The geometry to unregister.
   * @returns {@link base!core.SDKResult | SDKResult} indicating success, or `ok:false` if unregistration fails.
   */
  sceneGeometryDestroyed(sceneGeometry: SceneGeometry): SDKResult<any> {
    return {ok: true, value: undefined};
  }

  /**
   * Registers a newly created {@link model!scene.SceneMesh | SceneMesh}.
   * @param sceneMesh - The mesh to register.
   * @returns {@link base!core.SDKResult | SDKResult} indicating success, or `ok:false` if registration fails.
   */
  sceneMeshCreated(sceneMesh: SceneMesh): SDKResult<any> {
    if (sceneMesh.geometry.primitive === GaussianSplatsPrimitive) {
      return this._addSplatMesh(sceneMesh);
    }
    return this._addMesh(sceneMesh);
  }

  /**
   * Unregisters a {@link model!scene.SceneMesh | SceneMesh}.
   * @param sceneMesh - The mesh to unregister.
   * @returns {@link base!core.SDKResult | SDKResult} indicating success, or `ok:false` if unregistration fails.
   */
  sceneMeshDestroyed(sceneMesh: SceneMesh): SDKResult<any> {
    if (sceneMesh.geometry.primitive === GaussianSplatsPrimitive) {
      this._removeSplatMesh(sceneMesh);
      return {ok: true, value: undefined};
    }
    this._removeMesh(sceneMesh);
    return {ok: true, value: undefined};
  }

  /** The shared gaussian-splat batch, or null if no splats have been added. */
  public getSplatBatch(): SplatBatch | null {
    return this._splatBatch;
  }

  /**
   * Recreates GPU resources after a WebGL context restore. The mesh batches are
   * owned by the GPUMemoryManager (restored there); only the splat batch is
   * owned here, so re-upload its texture from the CPU mirror.
   */
  public webglContextRestored(): SDKResult<void> {
    if (this._splatBatch) {
      return this._splatBatch.webglContextRestored();
    }
    return {ok: true, value: undefined};
  }

  /**
   * Registers a newly created {@link model!scene.SceneObject | SceneObject}.
   *
   * Creates a {@link RendererObject}, expects that all its meshes are pre-registered
   * and have corresponding {@link RendererMesh} instances.
   *
   * @param sceneObject - The object to register.
   * @returns {@link base!core.SDKResult | SDKResult} indicating success, or `ok:false` if:
   * - an object with the same id already exists,
   * - or any mesh/batch allocation fails.
   */
  public sceneObjectCreated(sceneObject: SceneObject): SDKResult<any> {
    const objectId = sceneObject.id;

    if (this._rendererObjects[objectId]) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[MeshManager.sceneObjectCreated] SceneObject already added with this ID: ${objectId}`
      };
    }

    const rendererMeshes: RendererMesh[] = [];
    for (const sceneMesh of sceneObject.meshes) {
      // Splat meshes live in the SplatBatch, not as RendererMeshes — skip them
      // here; the RendererObject only tracks regular (mesh-batch) meshes.
      if (sceneMesh.geometry.primitive === GaussianSplatsPrimitive) {
        continue;
      }
      const rendererMesh = this._rendererMeshes[sceneMesh.uniqueId];

      if (!rendererMesh) {
        return {
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `[MeshManager.sceneObjectCreated] SceneMesh not attached with this globalId: ${sceneMesh.uniqueId}`
        };
      }

      rendererMeshes.push(rendererMesh);
    }

    this._rendererObjects[objectId] = new RendererObject({
      id: objectId,
      rendererMeshes
    });

    this._synchronizeCreatedRendererObject(sceneObject, rendererMeshes);

    this._batchesDirty = true;

    return {ok: true, value: undefined};
  }

  private _synchronizeCreatedRendererObject(sceneObject: SceneObject, rendererMeshes: RendererMesh[]): void {
    const viewer = this._renderContext.viewer;
    const numViews = Math.min(viewer.numViews, this._renderContext.memoryConfigs.maxViews);
    for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
      const viewObject = viewer.viewList[viewIndex]?.objects[sceneObject.id];
      const hasDetachedRendererMesh = this._rendererMeshesNeedObjectStateSync(rendererMeshes, viewIndex);
      if (viewObject) {
        if (!hasDetachedRendererMesh && !this._viewObjectStateNeedsInitialSync(viewObject)) {
          continue;
        }
        for (let i = 0, n = rendererMeshes.length; i < n; i++) {
          this._synchronizeRendererMeshWithViewObject(rendererMeshes[i], viewObject);
        }
        continue;
      }
      if (!hasDetachedRendererMesh && sceneObject.clippable !== false) {
        continue;
      }
      for (let i = 0, n = rendererMeshes.length; i < n; i++) {
        this._synchronizeRendererMeshWithDefaultObjectState(rendererMeshes[i], viewIndex, sceneObject);
      }
    }
  }

  private _rendererMeshesNeedObjectStateSync(rendererMeshes: RendererMesh[], viewIndex: number): boolean {
    for (let i = 0, len = rendererMeshes.length; i < len; i++) {
      if (!rendererMeshes[i].isObjectVisible(viewIndex)) {
        return true;
      }
    }
    return false;
  }

  private _viewObjectStateNeedsInitialSync(viewObject: ViewObject): boolean {
    return !viewObject.visible
      || viewObject.xrayed
      || viewObject.highlighted
      || viewObject.selected
      || viewObject.culled
      || !viewObject.pickable
      || !viewObject.clippable
      || viewObject.colorize !== null
      || viewObject.opacityUpdated;
  }

  /**
   * Creates (or reuses) a compatible {@link MeshBatchImpl} and registers the given {@link model!scene.SceneMesh | SceneMesh}
   * as a {@link RendererMesh}.
   *
   * @param sceneMesh - The mesh to register.
   */
  private _addMesh(sceneMesh: SceneMesh): SDKResult<RendererMesh> {
    const meshGlobalId = sceneMesh.uniqueId;

    if (this._rendererMeshes[meshGlobalId]) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[MeshManager._addMesh] SceneMesh already added with this globalId: ${meshGlobalId}`
      };
    }

    const stats = this._stepStatsEnabled ? this._stepStats : null;

    const t0 = stats ? performance.now() : 0;
    const meshBatchResult = this._getMeshBatch(sceneMesh);
    if (stats) {
      stats.getMeshBatchMs += performance.now() - t0;
      stats.getMeshBatchCalls++;
    }
    if (meshBatchResult.ok === false) {
      return meshBatchResult;
    }

    const meshBatch = meshBatchResult.value;

    const t1 = stats ? performance.now() : 0;
    const meshResult = meshBatch.addMesh(sceneMesh);
    if (stats) {
      stats.batchAddMeshMs += performance.now() - t1;
      stats.batchAddMeshCalls++;
    }
    if (meshResult.ok === false) {
      return meshResult;
    }

    const meshHandle = meshResult.value;

    const t2 = stats ? performance.now() : 0;
    const rendererMesh = new RendererMesh({
      renderContext: this._renderContext,
      sceneMesh,
      meshBatch,
      gpuMemoryManager: this._gpuMemoryManager,
      meshHandle
    });
    this._rendererMeshes[meshGlobalId] = rendererMesh;
    if (stats) {
      stats.rendererMeshCtorMs += performance.now() - t2;
      stats.rendererMeshCtorCalls++;
    }

    return {ok: true, value: rendererMesh};
  }

  /**
   * Registers a gaussian-splat {@link SceneMesh} into the dedicated
   * {@link SplatBatch} (lazily created). Splats stream in/out as freeable
   * texture portions; they never touch the mesh {@link GPUMemoryBatch} path.
   */
  private _addSplatMesh(sceneMesh: SceneMesh): SDKResult<RendererSplatMesh> {
    const meshGlobalId = sceneMesh.uniqueId;
    if (this._rendererSplatMeshes[meshGlobalId]) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[MeshManager._addSplatMesh] Splat mesh already added with this globalId: ${meshGlobalId}`
      };
    }
    const geom = sceneMesh.geometry;
    if (!geom.scales || !geom.rotations || !geom.aabb) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[MeshManager._addSplatMesh] GaussianSplats geometry '${geom.id}' is missing scales/rotations/aabb.`
      };
    }
    const batchResult = this._ensureSplatBatch();
    if (batchResult.ok === false) {
      return batchResult;
    }
    const splatBatch = batchResult.value;
    const pickId = this._nextSplatPickId++;
    const addResult = splatBatch.addSplats({
      positionsCompressed: geom.positionsCompressed,
      aabb: geom.aabb,
      scales: geom.scales,
      rotations: geom.rotations,
      colorsCompressed: geom.colorsCompressed,
    }, sceneMesh.worldMatrix, pickId);  // bake the mesh world matrix (incl. model coordinate system) + pick id
    if (addResult.ok === false) {
      return addResult;
    }
    const rendererSplatMesh = new RendererSplatMesh(sceneMesh, splatBatch, addResult.value, pickId);
    this._rendererSplatMeshes[meshGlobalId] = rendererSplatMesh;
    this._splatPickMeshes.set(pickId, rendererSplatMesh);
    return {ok: true, value: rendererSplatMesh};
  }

  /** Lazily creates + allocates the shared {@link SplatBatch}. */
  private _ensureSplatBatch(): SDKResult<SplatBatch> {
    if (this._splatBatch) {
      return {ok: true, value: this._splatBatch};
    }
    const batch = new SplatBatch(this._renderContext.gl, MAX_SPLATS_PER_BATCH);
    const allocResult = batch.allocate();
    if (allocResult.ok === false) {
      return allocResult;
    }
    this._splatBatch = batch;
    return {ok: true, value: batch};
  }

  /** Streams a gaussian-splat mesh out of the {@link SplatBatch}. */
  private _removeSplatMesh(sceneMesh: SceneMesh): void {
    const rendererSplatMesh = this._rendererSplatMeshes[sceneMesh.uniqueId];
    if (rendererSplatMesh) {
      this._splatPickMeshes.delete(rendererSplatMesh.pickId);
      rendererSplatMesh.destroy();
      delete this._rendererSplatMeshes[sceneMesh.uniqueId];
    }
  }

  /** Resolves a splat-pick `pickId` (read from the pick buffer) to its SceneMesh. */
  public getSplatMeshAtPickIndex(pickId: number): SceneMesh | null {
    return this._splatPickMeshes.get(pickId)?.sceneMesh ?? null;
  }

  /**
   * Returns an existing compatible {@link MeshBatchImpl} for the mesh or creates a new one.
   *
   * Compatibility is determined by:
   * - matching geometry primitive type,
   * - matching `hasNormals` flag (so geometry-with-normals lands in the
   *   smooth-shaded batch and geometry-without lands in the flat-shaded one),
   * - matching `hasUVs` flag (so the UV-bearing technique variant only sees
   *   geometries that actually populate the UV data texture),
   * - matching `triplanar` flag (so the triplanar shader variant only sees
   *   meshes whose textures it must derive from world-space coordinates),
   * - matching `mipmap` flag (so an opted-in {@link SceneTexture}'s meshes
   *   land in a mipmap-bearing atlas while the standard non-mipped path
   *   stays cheap), and
   * - {@link MeshBatchImpl.canAddMesh} constraints.
   *
   * @param sceneMesh - The mesh requiring a batch.
   * @returns {@link base!core.SDKResult | SDKResult} containing a compatible batch.
   */
  private _getMeshBatch(sceneMesh: SceneMesh): SDKResult<MeshBatchImpl> {
    const primitive = sceneMesh.geometry.primitive;
    const hasNormals = !!sceneMesh.geometry.normalsCompressed;
    const hasUVs     = !!sceneMesh.geometry.uvsCompressed;
    // Triplanar engages when the material binds at least one texture
    // and the geometry has no UVs to drive the standard sampling path.
    // Mutually exclusive with `hasUVs` by construction — UV-bearing
    // geometry routes through the existing atlas path.
    const triplanar = !hasUVs && _materialHasAnyTexture(sceneMesh);
    // Mipmap engages when any of the material's bound textures opted
    // in via `SceneTextureParams.mipmap`. Untextured batches keep
    // `mipmap: false` — there's nothing to filter trilinearly. A
    // material with mixed-mode textures (some mipped, some not) lands
    // in a mipped batch, so the non-mipped textures end up in a
    // mipped atlas too — predictable, documented on the param.
    const mipmap = (hasUVs || triplanar) && _materialHasMippedTexture(sceneMesh);
    // Bin is part of the batch identity so each batch is bin-homogeneous —
    // the renderer's overlay pass needs to be able to skip / include whole
    // batches by bin without subdividing draw calls per-mesh.
    const bin = sceneMesh.bin;

    const stats = this._stepStatsEnabled ? this._stepStats : null;
    const key = this._getMeshBatchKey(primitive, hasNormals, hasUVs, triplanar, mipmap, bin);
    const compatibleBatches = this._batchesByKey.get(key);
    const len = compatibleBatches?.length ?? 0;
    let iters = 0;
    for (let i = 0; i < len; i++) {
      iters++;
      const meshBatch = compatibleBatches![i];
      const canAddResult = meshBatch.canAddMesh(sceneMesh);
      if (canAddResult !== GPUMemoryCheckResult.OK) {
        continue;
      }
      if (stats) stats.batchScanIters += iters;
      return {ok: true, value: meshBatch};
    }
    if (stats) {
      stats.batchScanIters += iters;
      stats.newBatches++;
    }

    const result = this._gpuMemoryManager.createBatch({hasNormals, hasUVs, triplanar, mipmap});
    if (result.ok === false) {
      return result;
    }

    const gpuMemoryBatchIndex = result.value;

    const newMeshBatch = new MeshBatchImpl({
      primitive,
      hasNormals,
      hasUVs,
      triplanar,
      mipmap,
      bin,
      renderContext: this._renderContext,
      gpuMemoryManager: this._gpuMemoryManager,
      gpuMemoryBatchIndex,
    });

    this._batches.push(newMeshBatch);
    if (compatibleBatches) {
      compatibleBatches.push(newMeshBatch);
    } else {
      this._batchesByKey.set(key, [newMeshBatch]);
    }
    this._batchesDirty = true;

    return {ok: true, value: newMeshBatch};
  }

  private _getMeshBatchKey(
    primitive: number,
    hasNormals: boolean,
    hasUVs: boolean,
    triplanar: boolean,
    mipmap: boolean,
    bin?: string
  ): MeshBatchKey {
    const binKey = bin === undefined ? "u" : `s${bin}`;
    return `${primitive}|${hasNormals ? 1 : 0}|${hasUVs ? 1 : 0}|${triplanar ? 1 : 0}|${mipmap ? 1 : 0}|${binKey}`;
  }

  /**
   * Unregisters a {@link model!scene.SceneObject | SceneObject}.
   *
   * Detaches and removes the {@link RendererObject}. The underlying
   * {@link RendererMesh} instances stay registered until their SceneMeshes are
   * destroyed.
   *
   * @param sceneObject - The object to unregister.
   * @returns {@link base!core.SDKResult | SDKResult} indicating success, or `ok:false` if the object is not registered.
   */
  public sceneObjectDestroyed(sceneObject: SceneObject): SDKResult<any> {
    const rendererObject = this._rendererObjects[sceneObject.id];
    if (!rendererObject) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[MeshManager.sceneObjectDestroyed] SceneObject not attached with this ID: ${sceneObject.id}`
      };
    }

    for (const sceneMesh of sceneObject.meshes ?? []) {
      const rendererMesh = this._rendererMeshes[sceneMesh.uniqueId];
      if (rendererMesh) {
        this._detachRendererMeshFromObject(rendererObject, rendererMesh);
      }
    }

    delete this._rendererObjects[sceneObject.id];
    this._batchesDirty = true;

    return {ok: true, value: undefined};
  }

  /**
   * Removes a {@link RendererMesh} (if present) and destroys it.
   *
   * @param sceneMesh - The mesh to remove.
   */
  private _removeMesh(sceneMesh: SceneMesh): void {
    const rendererMesh = this._rendererMeshes[sceneMesh.uniqueId];
    if (!rendererMesh) {
      return;
    }

    rendererMesh.destroy();
    delete this._rendererMeshes[sceneMesh.uniqueId];
    this._batchesDirty = true;
  }

  /**
   * Connects an existing {@link model!scene.SceneMesh | SceneMesh} to an existing {@link model!scene.SceneObject | SceneObject}.
   * @param sceneObject
   * @param sceneMesh
   */
  public sceneObjectMeshAdded(sceneObject: SceneObject, sceneMesh: SceneMesh): SDKResult<any> {
    const rendererObject = this._rendererObjects[sceneObject.id];
    if (!rendererObject) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[MeshManager.sceneObjectMeshAdded] SceneObject not attached with this ID: ${sceneObject.id}`
      };
    }
    const rendererMesh = this._rendererMeshes[sceneMesh.uniqueId];
    if (!rendererMesh) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[MeshManager.sceneObjectMeshAdded] SceneMesh not attached with this globalId: ${sceneMesh.uniqueId}`
      };
    }

    rendererObject.addRendererMesh(rendererMesh);

    const objectId = sceneObject.id;
    const viewer = this._renderContext.viewer;
    const numViews = Math.min(viewer.numViews, this._renderContext.memoryConfigs.maxViews);
    for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
      const view = viewer.viewList[viewIndex];
      const viewObject = view.objects[objectId];
      if (!viewObject) {
        continue;
      }
      this._synchronizeMeshWithViewObject(sceneMesh, viewObject);
    }

    return {ok: true, value: undefined};
  }

  /**
   * Synchronizes the per-view state of a {@link model!scene.SceneMesh | SceneMesh} according to a given {@link viewing!viewer.ViewObject | ViewObject}.
   * This is used when adding a SceneMesh to a SceneObject to ensure the mesh reflects the current object view state.
   * @param sceneMesh
   * @param viewObject
   */
  private _synchronizeMeshWithViewObject(sceneMesh: SceneMesh, viewObject: ViewObject): void {
    const rendererMesh = this._rendererMeshes[sceneMesh.uniqueId];
    if (!rendererMesh) {
      return;
    }
    this._synchronizeRendererMeshWithViewObject(rendererMesh, viewObject);
  }

  private _synchronizeRendererMeshWithViewObject(rendererMesh: RendererMesh, viewObject: ViewObject): void {
    const viewIndex = viewObject.layer.view.viewIndex;
    rendererMesh.setObjectVisible(viewIndex, viewObject.visible);
    rendererMesh.setXRayed(viewIndex, viewObject.xrayed);
    rendererMesh.setHighlighted(viewIndex, viewObject.highlighted);
    rendererMesh.setSelected(viewIndex, viewObject.selected);
    rendererMesh.setCulled(viewIndex, viewObject.culled);
    rendererMesh.setPickable(viewIndex, viewObject.pickable);
    rendererMesh.setClippable(viewIndex, viewObject.clippable);
    rendererMesh.setColorInView(viewIndex, viewObject.colorize);
    rendererMesh.setOpacityInView(viewIndex, viewObject.opacityUpdated ? viewObject.opacity : null);
  }

  private _synchronizeRendererMeshWithDefaultObjectState(rendererMesh: RendererMesh, viewIndex: number, sceneObject: SceneObject): void {
    rendererMesh.setObjectVisible(viewIndex, true);
    rendererMesh.setXRayed(viewIndex, false);
    rendererMesh.setHighlighted(viewIndex, false);
    rendererMesh.setSelected(viewIndex, false);
    rendererMesh.setCulled(viewIndex, false);
    rendererMesh.setPickable(viewIndex, true);
    rendererMesh.setClippable(viewIndex, sceneObject.clippable !== false);
    rendererMesh.setColorInView(viewIndex, null);
    rendererMesh.setOpacityInView(viewIndex, null);
  }

  private _detachRendererMeshFromObject(rendererObject: RendererObject, rendererMesh: RendererMesh): void {
    rendererObject.removeRendererMesh(rendererMesh);
    const numViews = Math.min(this._renderContext.viewer.viewList.length, this._renderContext.memoryConfigs.maxViews);
    for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
      rendererMesh.setObjectVisible(viewIndex, false);
    }
  }

  /**
   * Disconnects an existing {@link model!scene.SceneMesh | SceneMesh} from an existing {@link model!scene.SceneObject | SceneObject}.
   * The mesh remains cached, but is no longer rendered as part of the object.
   * To do that, we set the mesh as having an object visibility of false for all views.
   * @param sceneObject
   * @param sceneMesh
   */
  public sceneObjectMeshRemoved(sceneObject: SceneObject, sceneMesh: SceneMesh): SDKResult<any> {
    const rendererObject = this._rendererObjects[sceneObject.id];
    if (!rendererObject) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[MeshManager.sceneObjectMeshAdded] SceneObject not attached with this ID: ${sceneObject.id}`
      };
    }
    const rendererMesh = this._rendererMeshes[sceneMesh.uniqueId];
    if (!rendererMesh) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[MeshManager.sceneObjectMeshRemoved] SceneMesh not attached with this globalId: ${sceneMesh.uniqueId}`
      };
    }
    this._detachRendererMeshFromObject(rendererObject, rendererMesh);
    return {ok: true, value: undefined};
  }

  /**
   * Handles changes to a {@link SceneTransform}'s matrix.
   */
  public sceneTransformMatrixChanged(sceneTransform: SceneTransform): void {
    // TODO: implement transform graph propagation (if applicable)
  }

  /**
   * Handles changes to a {@link model!scene.SceneMesh | SceneMesh}'s world matrix.
   *
   * Forwards to the corresponding {@link RendererMesh} (if registered).
   */
  public sceneMeshMatrixChanged(sceneMesh: SceneMesh): void {
    if (sceneMesh.geometry.primitive === GaussianSplatsPrimitive) {
      this._rendererSplatMeshes[sceneMesh.uniqueId]?.setMatrix(sceneMesh.worldMatrix);
      return;
    }
    this._rendererMeshes[sceneMesh.uniqueId]?.setMatrix(sceneMesh.worldMatrix);
  }

  /**
   * Handles changes to a {@link model!scene.SceneMesh | SceneMesh}'s color.
   *
   * Forwards to the corresponding {@link RendererMesh} (if registered).
   */
  public sceneMeshColorChanged(sceneMesh: SceneMesh): void {
    this._rendererMeshes[sceneMesh.uniqueId]?.setColor(sceneMesh.effectiveColor);
  }

  /**
   * Handles a runtime change to a {@link model!scene.SceneMaterial | SceneMaterial}'s
   * base color. Re-uploads every mesh that uses the material — its rendered
   * colour is `mesh.effectiveColor`, which resolves to the material's color.
   */
  public sceneMaterialColorChanged(sceneMaterial: SceneMaterial): void {
    const meshes = sceneMaterial.model.meshes;
    for (const id in meshes) {
      const mesh = meshes[id];
      if (mesh.material === sceneMaterial) {
        this._rendererMeshes[mesh.uniqueId]?.setColor(mesh.effectiveColor);
      }
    }
  }

  /**
   * Handles a runtime change to a {@link model!scene.SceneMaterial | SceneMaterial}'s
   * emissive color. Re-packs the emissive factor for every mesh that uses it.
   */
  public sceneMaterialEmissiveColorChanged(sceneMaterial: SceneMaterial): void {
    const meshes = sceneMaterial.model.meshes;
    for (const id in meshes) {
      const mesh = meshes[id];
      if (mesh.material === sceneMaterial) {
        this._rendererMeshes[mesh.uniqueId]?.setEmissiveColor(sceneMaterial.emissiveColor);
      }
    }
  }

  /**
   * Handles changes to a {@link model!scene.SceneMesh | SceneMesh}'s opacity.
   *
   * Forwards to the corresponding {@link RendererMesh} (if registered).
   */
  public sceneMeshOpacityChanged(sceneMesh: SceneMesh): void {
    this._rendererMeshes[sceneMesh.uniqueId]?.setOpacity(sceneMesh.effectiveOpacity);
  }

  /**
   * Handles changes to a {@link viewing!viewer.ViewObject | ViewObject}'s visibility.
   *
   * Updates the per-view visibility flag on the owning {@link RendererObject}.
   */
  public viewObjectVisibilityChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setVisible(viewObject.layer.view.viewIndex, viewObject.visible);
  }

  /**
   * Handles changes to a {@link viewing!viewer.ViewObject | ViewObject}'s x-ray state.
   *
   * Updates the per-view x-ray flag on the owning {@link RendererObject}.
   */
  public viewObjectXRayedChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setXRayed(viewObject.layer.view.viewIndex, viewObject.xrayed);
  }

  /**
   * Handles changes to a {@link viewing!viewer.ViewObject | ViewObject}'s clippable state.
   *
   * Updates the per-view clippable flag on the owning
   * {@link RendererObject} → re-encodes the
   * `meshViewAttributes.renderFlags.g` bit on every
   * underlying mesh.
   */
  public viewObjectClippableChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setClippable(viewObject.layer.view.viewIndex, viewObject.clippable);
  }

  /**
   * Handles changes to a {@link viewing!viewer.ViewObject | ViewObject}'s culled state.
   *
   * Updates the per-view culled flag on the owning {@link RendererObject},
   * which drops/restores the object's meshes in that view's GPU draw index.
   */
  public viewObjectCulledChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setCulled(viewObject.layer.view.viewIndex, viewObject.culled);
  }

  /**
   * Handles changes to a {@link viewing!viewer.ViewObject | ViewObject}'s highlighted state.
   *
   * Updates the per-view highlighted flag on the owning {@link RendererObject}.
   */
  public viewObjectHighlightedChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setHighlighted(viewObject.layer.view.viewIndex, viewObject.highlighted);
  }

  /**
   * Handles changes to a {@link viewing!viewer.ViewObject | ViewObject}'s selected state.
   *
   * Updates the per-view selected flag on the owning {@link RendererObject}.
   */
  public viewObjectSelectedChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setSelected(viewObject.layer.view.viewIndex, viewObject.selected);
  }

  /**
   * Handles changes to a {@link viewing!viewer.ViewObject | ViewObject}'s colorize state.
   *
   * Updates the per-view colorize flag on the owning {@link RendererObject}.
   */
  public viewObjectColorizeChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setColorize(viewObject.layer.view.viewIndex, viewObject.colorize);
  }

  /**
   * Handles changes to a {@link viewing!viewer.ViewObject | ViewObject}'s opacity override.
   *
   * Updates the per-view opacity value on the owning {@link RendererObject}.
   *
   * Mirrors the colorize bridge's null-or-value contract: when the
   * ViewObject's `OPACITY_UPDATED` flag is **off** (the caller passed
   * `null`/`undefined` to clear the override), forward `undefined` so
   * the renderer-side `RendererMesh.setOpacityInView` falls back to
   * the SceneMesh's `effectiveOpacity` and clears the per-mesh
   * `ColoringOpacity` flag — without this, a cleared override leaks
   * to the renderer as an explicit `opacity = 1` write, forces glass
   * and curtain-wall meshes into the opaque bin, and produces
   * uniform-dark rendering for affected models.
   *
   * The `ViewObject.opacity` getter itself can't return null because
   * the field has type `number` for backwards compatibility — so the
   * gating happens here, at the bridge, not in the getter.
   */
  public viewObjectOpacityChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setOpacity(
      viewObject.layer.view.viewIndex,
      viewObject.opacityUpdated ? viewObject.opacity : undefined,
    );
  }

  /**
   * Handles changes to a {@link viewing!viewer.ViewObject | ViewObject}'s pickable state.
   *
   * Updates the per-view pickable value on the owning {@link RendererObject}.
   */
  public viewObjectPickableChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setPickable(viewObject.layer.view.viewIndex, viewObject.pickable);
  }

  /**
   * Handles updates to the camera's view matrix.
   *
   * Forwards the update to {@link GPUMemoryManager} so camera-dependent GPU state can be updated.
   */
  public cameraViewMatrixUpdated(camera: Camera) {
    this._gpuMemoryManager.cameraViewMatrixUpdated(camera);
  }

  /**
   * Returns the mesh batches sorted by primitive type.
   *
   * @remarks The array is sorted lazily in place when dirty.
   */
  public get sortedBatches(): MeshBatch[] {
    if (this._batchesDirty) {
      this._batches.sort((a, b) => a.primitive - b.primitive);
      this._batchesDirty = false;
    }
    return this._batches;
  }

  /**
   * Retrieves a mesh batch by index in the sorted batch array.
   *
   * @param batchIndex - Batch array index.
   * @returns The batch if found, otherwise `null`.
   */
  public getBatch(batchIndex: number): MeshBatch | null {
    return this.sortedBatches[batchIndex] ?? null;
  }

  /**
   * Retrieves a {@link model!scene.SceneMesh | SceneMesh} within a specific GPU batch.
   *
   * @param batchIndex - GPU memory batch index.
   * @param meshIndex - Mesh index within the batch.
   */
  public getMeshAtIndex(batchIndex: number, meshIndex: number): SceneMesh | null {
    return this._gpuMemoryManager.getMeshAtIndex(batchIndex, meshIndex);
  }

  /**
   * Retrieves the {@link GPUTile} associated with a given {@link model!scene.SceneMesh | SceneMesh}.
   * @param sceneMesh
   */
  public getMeshTile(sceneMesh: SceneMesh): GPUTile | null {
    return this._rendererMeshes[sceneMesh.uniqueId]?.gpuTile ?? null;
  }

  /**
   * Returns the parameters required for a WebGL `drawArrays` call for a mesh within a batch.
   *
   * @param batchIndex - GPU memory batch index.
   * @param meshIndex - Mesh index within the batch.
   * @returns `{first, count}` if available, otherwise `null`.
   */
  public getDrawArraysParamsForMesh(
    batchIndex: number,
    meshIndex: number
  ): { first: number; count: number } | null {
    return this._gpuMemoryManager.getDrawArraysParamsForMesh(batchIndex, meshIndex);
  }

  /**
   * Destroys the manager and releases renderer-side resources.
   *
   * @remarks
   * - Attempts to unregister all objects/models currently present in the viewer scene.
   * - Destroys all mesh batches.
   * - Clears internal maps and batch storage.
   */
  public destroy(): void {
    const {viewer} = this._renderContext;

    if (viewer && viewer.scene) {
      const {models, objects} = viewer.scene;

      // @ts-ignore
      Object.values(objects).forEach((sceneObject) => this.sceneObjectDestroyed(sceneObject));
      // @ts-ignore
      Object.values(models).forEach((sceneModel) => this.sceneModelDestroyed(sceneModel));

      for (let i = 0, len = this._batches.length; i < len; i++) {
        this._batches[i].destroy();
      }
    }

    this._splatBatch?.destroy();
    this._splatBatch = null;
    this._rendererSplatMeshes = {};
    this._splatPickMeshes.clear();
    this._batches = [];
    this._batchesByKey.clear();
    this._rendererObjects = {};
    this._rendererMeshes = {};
    this._batchesDirty = true;
  }

  /**
   * Enables (or disables) opt-in step-level timing inside
   * {@link _addMesh}. Off by default; turn on around a workload
   * (eg. a model load) to attribute time across the substeps
   * (`getMeshBatch`, `batchAddMesh`, `rendererMeshCtor`), then
   * read via {@link getStepStats}.
   *
   * @internal
   */
  public enableStepStats(enabled: boolean): void {
    this._stepStatsEnabled = enabled;
  }

  /**
   * Zeroes the step-stats counters without changing the enabled
   * flag. Call before the workload you want to attribute.
   *
   * @internal
   */
  public resetStepStats(): void {
    this._stepStats = {
      getMeshBatchMs: 0,
      getMeshBatchCalls: 0,
      batchScanIters: 0,
      newBatches: 0,
      batchAddMeshMs: 0,
      batchAddMeshCalls: 0,
      rendererMeshCtorMs: 0,
      rendererMeshCtorCalls: 0,
    };
  }

  /**
   * Returns a snapshot of the current step-stats counters. Safe to
   * call whether or not {@link enableStepStats} is on; values stay
   * at the last-recorded numbers when disabled.
   *
   * @internal
   */
  public getStepStats(): MeshManagerStepStats {
    return {...this._stepStats};
  }
}

/**
 * Step-level timings + counters populated inside
 * {@link MeshManager._addMesh} when {@link MeshManager.enableStepStats}
 * is on. Read via {@link MeshManager.getStepStats}.
 *
 * @internal
 */
export interface MeshManagerStepStats {
  /** Cumulative wall time spent inside `_getMeshBatch`. */
  getMeshBatchMs: number;
  /** Number of `_getMeshBatch` invocations. */
  getMeshBatchCalls: number;
  /** Cumulative scan iterations over compatible batch buckets. */
  batchScanIters: number;
  /** Number of times `_getMeshBatch` had to allocate a new batch. */
  newBatches: number;
  /** Cumulative wall time inside `meshBatch.addMesh` (GPU writes). */
  batchAddMeshMs: number;
  /** Number of `meshBatch.addMesh` invocations. */
  batchAddMeshCalls: number;
  /** Cumulative wall time constructing the `RendererMesh`. */
  rendererMeshCtorMs: number;
  /** Number of `RendererMesh` constructions. */
  rendererMeshCtorCalls: number;
}

/**
 * `true` when the mesh's material binds at least one of the
 * texture slots the renderer can sample at draw time. The
 * triplanar batch routing predicates on this — a UV-less mesh
 * whose material binds no texture has nothing for the triplanar
 * shader variant to do, so it stays on the standard flat-colour
 * path.
 */
function _materialHasAnyTexture(sceneMesh: SceneMesh): boolean {
  const m: any = sceneMesh.material;
  if (!m) return false;
  return !!(
    m.colorTexture ||
    m.metallicRoughnessTexture ||
    m.normalsTexture ||
    m.occlusionTexture ||
    m.emissiveTexture
  );
}

/**
 * `true` when any texture bound to the mesh's material opted into
 * mipmapped sampling via `SceneTextureParams.mipmap`. The batch
 * routing reads this once at registration time to pick a
 * mipmap-bearing atlas variant.
 */
function _materialHasMippedTexture(sceneMesh: SceneMesh): boolean {
  const m: any = sceneMesh.material;
  if (!m) return false;
  return !!(
    (m.colorTexture              && m.colorTexture.mipmap === true) ||
    (m.metallicRoughnessTexture  && m.metallicRoughnessTexture.mipmap === true) ||
    (m.normalsTexture            && m.normalsTexture.mipmap === true) ||
    (m.occlusionTexture          && m.occlusionTexture.mipmap === true) ||
    (m.emissiveTexture           && m.emissiveTexture.mipmap === true)
  );
}
