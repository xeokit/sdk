import {RenderContext} from "../RenderContext";
import {SDKErrorType, type SDKResult} from "../../../core";
import type {SceneMesh, SceneModel, SceneObject} from "../../../scene";
import {RendererObject} from "./RendererObject";
import {RendererMesh} from "./RendererMesh";
import {MeshBatchImpl} from "./MeshBatchImpl";
import {type MeshBatch} from "./MeshBatch";
import type {Camera, ViewObject} from "../../../viewer";
import type {SceneTransform} from "../../../scene/SceneTransform";
import {GPUMemoryCheckResult, GPUMemoryManager, type GPUTile} from "../gpuMemoryManager";
import {SceneGeometry} from "../../../scene";

/**
 * Bridges scene/view state changes into GPU-ready render state for the renderer.
 *
 * @remarks
 * - `MeshManager` is owned by a {@link ViewManager}, which manages all {@link View}s for a single {@link Viewer} (not one ViewManager per View).
 * - It acts as the central bridge between the scene graph (models, objects, meshes) and the renderer's GPU memory and batching subsystems.
 * - Owns the renderer-side representation of:
 *   - {@link SceneModel}s (as containers of renderer meshes)
 *   - {@link SceneObject}s (as {@link RendererObject}s, which can span multiple meshes)
 *   - {@link SceneMesh} instances (as {@link RendererMesh}s)
 *   - {@link MeshBatch} groupings (as {@link MeshBatchImpl}s), used to batch meshes by primitive type and compatibility constraints, backed by {@link GPUMemoryManager} allocations.
 * - Coordinates with {@link GPUMemoryManager} to allocate, update, and release GPU memory for mesh, geometry, and attribute data.
 * - Maintains mesh batches for efficient rendering, minimizing draw calls and optimizing memory usage.
 * - Handles registration and lifecycle of models, objects, and meshes in response to scene/view events.
 * - Forwards per-frame and per-event updates (matrix, color, opacity, visibility, etc.) to the relevant renderer objects/meshes and/or {@link GPUMemoryManager}.
 * - Used internally by the renderer; not accessed directly by application code.
 *
 * ## Architectural Role
 * - The {@link WebGLRenderer} owns a single {@link ViewManager} for each renderer instance.
 * - The {@link ViewManager} manages all {@link View}s for the {@link Viewer}.
 * - The `MeshManager` is owned by the {@link ViewManager} and manages all renderer objects and meshes for all views.
 * - `MeshManager` ensures that changes in the scene or any view are efficiently reflected in GPU state, supporting high-performance, multi-view rendering.
 *
 * @internal
 */
export class MeshManager {

  /**
   * Renderer objects keyed by {@link SceneObject.id}.
   *
   * Note: a {@link SceneObject} can belong to many models in some scene graphs; this manager
   * treats object IDs as globally unique and maps them to a single {@link RendererObject}.
   */
  private _rendererObjects: Record<string, RendererObject> = {};

  /** Shared render context used for device resources and viewer access. */
  private _renderContext: RenderContext;

  /** Allocates/updates GPU memory for batches, meshes, and per-frame state. */
  private _gpuMemoryManager: GPUMemoryManager;

  /**
   * Renderer models keyed by {@link SceneModel.id}.
   * Each model contains its {@link RendererMesh} instances keyed by {@link SceneMesh.id}.
   */
  private _rendererModels: Record<string, {
    rendererMeshes: Record<string, RendererMesh>;
  }> = {};

  /**
   * Mesh batches keyed by an internal batch id (not the batch index).
   *
   * Batches are grouped primarily by primitive type (and additional compatibility checks).
   */
  private _sortedBatches: Record<string, MeshBatchImpl> = {};

  /** Cached list view of {@link _sortedBatches}, sorted by primitive. */
  private _batchList: MeshBatch[] = [];

  /** Whether {@link _batchList} needs to be rebuilt from {@link _sortedBatches}. */
  private _batchListDirty = true;

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
   * Initializes the manager by registering any existing {@link SceneModel}s and {@link SceneObject}s
   * already present in the viewer's scene.
   *
   * @returns {@link SDKResult} that is `ok:true` when initialization succeeds, or `ok:false` if
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

    return { ok: true, value: undefined };
  }

  /**
   * Registers a newly created {@link SceneModel}.
   *
   * @param sceneModel - The model to register.
   * @returns {@link SDKResult} indicating success, or `ok:false` if a model with the same id
   * was already registered.
   */
  public sceneModelCreated(sceneModel: SceneModel): SDKResult<any> {
    if (this._rendererModels[sceneModel.id]) { // Don't trust Scene's events
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[MeshManager.sceneModelCreated] SceneModel already added with this ID: ${sceneModel.id}`
      };
    }

    this._rendererModels[sceneModel.id] = { rendererMeshes: {} };

    return { ok: true, value: undefined };
  }

  /**
   * Unregisters a {@link SceneModel}.
   *
   * @param sceneModel - The model to unregister.
   * @returns {@link SDKResult} indicating success, or `ok:false` if the model was not registered.
   *
   * @remarks
   * This method currently does not iterate and destroy meshes belonging to the model. Mesh lifetime
   * is managed via {@link sceneObjectDestroyed} and mesh removal paths.
   */
  public sceneModelDestroyed(sceneModel: SceneModel): SDKResult<any> {
    if (!this._rendererModels[sceneModel.id]) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[MeshManager.sceneModelDestroyed] SceneModel not attached with this ID: ${sceneModel.id}`
      };
    }

    delete this._rendererModels[sceneModel.id];
    return { ok: true, value: undefined };
  }

  /**
   * Registers a newly created {@link SceneGeometry}.
   *
   * @param sceneGeometry - The geometry to register.
   * @returns {@link SDKResult} indicating success, or `ok:false` if registration fails.
   */
  public sceneGeometryCreated(sceneGeometry: SceneGeometry) : SDKResult<any> {
    return { ok: true, value: undefined};
  }

  /**
   * Unregisters a {@link SceneGeometry}.
   * @param sceneGeometry - The geometry to unregister.
   * @returns {@link SDKResult} indicating success, or `ok:false` if unregistration fails.
   */
  sceneGeometryDestroyed(sceneGeometry: SceneGeometry) : SDKResult<any> {
    return { ok: true, value: undefined};
  }

  /**
   * Registers a newly created {@link SceneMesh}.
   * @param sceneMesh - The mesh to register.
   * @returns {@link SDKResult} indicating success, or `ok:false` if registration fails.
   */
  sceneMeshCreated(sceneMesh: SceneMesh) : SDKResult<any> {
    const modelId = sceneMesh.model.id;
    const rendererModel = this._rendererModels[modelId];
    if (!rendererModel) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[MeshManager.sceneMeshCreated] No SceneModel added with this ID: ${modelId}`
      };
    }
    return this._addMesh(rendererModel, sceneMesh);
  }

  /**
   * Unregisters a {@link SceneMesh}.
   * @param sceneMesh - The mesh to unregister.
   * @returns {@link SDKResult} indicating success, or `ok:false` if unregistration fails.
   */
  sceneMeshDestroyed(sceneMesh: SceneMesh) : SDKResult<any> {
    const modelId = sceneMesh.model.id;
    const rendererModel = this._rendererModels[modelId];
    if (!rendererModel) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[MeshManager.sceneMeshDestroyed] No SceneModel added with this ID: ${modelId}`
      };
    }
    this._removeMesh(rendererModel, sceneMesh);
    return { ok: true, value: undefined };
  }

  /**
   * Registers a newly created {@link SceneObject}.
   *
   * Creates a {@link RendererObject}, expects that all its meshes are pre-registered
   * and have {@link RendererMesh} instances registered on the owning {@link SceneModel}.
   *
   * @param sceneObject - The object to register.
   * @returns {@link SDKResult} indicating success, or `ok:false` if:
   * - an object with the same id already exists,
   * - the owning model is not registered,
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

    const modelId = sceneObject.model.id;
    const rendererModel = this._rendererModels[modelId];
    if (!rendererModel) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[MeshManager.sceneObjectCreated] No SceneModel added with this ID: ${modelId}`
      };
    }

    const rendererMeshes: RendererMesh[] = [];
    for (const sceneMesh of sceneObject.meshes) {

      const meshId = sceneMesh.id;
      const rendererMesh = rendererModel.rendererMeshes[meshId];

      if (!rendererMesh) {
        return {
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `[MeshManager.sceneObjectCreated] SceneMesh not attached with this ID: ${meshId}`
        };
      }

      // TODO: test if mesh already owned by another object?

      rendererMeshes.push(rendererMesh);
    }

    this._rendererObjects[objectId] = new RendererObject({
      renderContext: this._renderContext,
      id: objectId,
      rendererMeshes // Zero meshes are OK
    });

    this._batchListDirty = true;

    return { ok: true, value: undefined };
  }

  /**
   * Creates (or reuses) a compatible {@link MeshBatchImpl} and registers the given {@link SceneMesh}
   * as a {@link RendererMesh} on the provided renderer model.
   *
   * @param rendererModel - Renderer model container that will own the created {@link RendererMesh}.
   * @param sceneMesh - The mesh to register.
   */
  private _addMesh(
    rendererModel: { rendererMeshes: Record<string, RendererMesh> },
    sceneMesh: SceneMesh
  ): SDKResult<RendererMesh> {
    const meshId = sceneMesh.id;

    if (rendererModel.rendererMeshes[meshId]) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[MeshManager._addMesh] SceneMesh already added with this ID: ${meshId}`
      };
    }

    const meshBatchResult = this._getMeshBatch(sceneMesh);
    if (meshBatchResult.ok === false) {
      return meshBatchResult;
    }

    const meshBatch = meshBatchResult.value;

    const meshResult = meshBatch.addMesh(sceneMesh);
    if (meshResult.ok === false) {
      return meshResult;
    }

    const meshHandle = meshResult.value;

    const rendererMesh = new RendererMesh({
      renderContext: this._renderContext,
      sceneMesh,
      meshBatch,
      gpuMemoryManager: this._gpuMemoryManager,
      meshHandle
    });

    rendererModel.rendererMeshes[meshId] = rendererMesh;

    return { ok: true, value: rendererMesh };
  }

  /**
   * Returns an existing compatible {@link MeshBatchImpl} for the mesh or creates a new one.
   *
   * Compatibility is currently determined by:
   * - matching geometry primitive type, and
   * - {@link MeshBatchImpl.canAddMesh} constraints.
   *
   * @param sceneMesh - The mesh requiring a batch.
   * @returns {@link SDKResult} containing a compatible batch.
   */
  private _getMeshBatch(sceneMesh: SceneMesh): SDKResult<MeshBatchImpl> {
    const primitive = sceneMesh.geometry.primitive;
    for (const meshBatch of Object.values(this._sortedBatches)) {
      if (meshBatch.primitive === primitive) {
        const canAddResult = meshBatch.canAddMesh(sceneMesh);
        if (canAddResult !== GPUMemoryCheckResult.OK) {
          continue;
        }
        return { ok: true, value: meshBatch };
      }
    }

    const meshBatchId = `meshBatch-${primitive}-${Object.keys(this._sortedBatches).length}`; // TODO: optimize ID generation

    const result = this._gpuMemoryManager.createBatch();
    if (result.ok === false) {
      return result;
    }

    const gpuMemoryBatchIndex = result.value;

    const newMeshBatch = new MeshBatchImpl({
      primitive,
      renderContext: this._renderContext,
      gpuMemoryManager: this._gpuMemoryManager,
      gpuMemoryBatchIndex,
    });

    this._sortedBatches[meshBatchId] = newMeshBatch;
    this._batchListDirty = true;

    return { ok: true, value: newMeshBatch };
  }

  /**
   * Unregisters a {@link SceneObject}.
   *
   * Destroys the {@link RendererObject} and its associated {@link RendererMesh} instances on the
   * owning model (if any).
   *
   * @param sceneObject - The object to unregister.
   * @returns {@link SDKResult} indicating success, or `ok:false` if the model or object is not registered.
   */
  public sceneObjectDestroyed(sceneObject: SceneObject): SDKResult<any> {
    const rendererModel = this._rendererModels[sceneObject.model.id];
    if (!rendererModel) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[MeshManager.sceneObjectDestroyed] SceneModel not attached with this ID: ${sceneObject.model.id}`
      };
    }

    if (!this._rendererObjects[sceneObject.id]) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[MeshManager.sceneObjectDestroyed] SceneObject not attached with this ID: ${sceneObject.id}`
      };
    }

    delete this._rendererObjects[sceneObject.id];

    sceneObject.meshes?.forEach((mesh) => this._removeMesh(rendererModel, mesh));

    this._batchListDirty = true;

    return { ok: true, value: undefined };
  }

  /**
   * Removes a {@link RendererMesh} from a renderer model (if present) and destroys it.
   *
   * @param rendererModel - Renderer model container holding the mesh.
   * @param sceneMesh - The mesh to remove.
   */
  private _removeMesh(
    rendererModel: { rendererMeshes: Record<string, RendererMesh> },
    sceneMesh: SceneMesh
  ): void {
    const rendererMesh = rendererModel.rendererMeshes[sceneMesh.id];
    if (!rendererMesh) {
      return;
    }

    rendererMesh.destroy();
    delete rendererModel.rendererMeshes[sceneMesh.id];
    this._batchListDirty = true;
  }

  /**
   * Connects an existing {@link SceneMesh} to an existing {@link SceneObject}.
   * @param sceneObject
   * @param sceneMesh
   */
  public sceneObjectMeshAdded(sceneObject: SceneObject, sceneMesh: SceneMesh): SDKResult<any> {
    const rendererModel = this._rendererModels[sceneObject.model.id];
    if (!rendererModel) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[MeshManager.sceneObjectMeshAdded] SceneModel not attached with this ID: ${sceneObject.model.id}`
      };
    }
    const rendererObject = this._rendererObjects[sceneObject.id];
    if (!rendererObject) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[MeshManager.sceneObjectMeshAdded] SceneObject not attached with this ID: ${sceneObject.id}`
      };
    }
    const rendererMesh = rendererModel.rendererMeshes[sceneMesh.id];
    if (!rendererMesh) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[MeshManager.sceneObjectMeshAdded] SceneMesh not attached with this ID: ${sceneMesh.id}`
      };
    }
    // TODO test if maesh is already added to object

    rendererObject.addRendererMesh(rendererMesh);

    const objectId = sceneObject.id;
    const viewer = this._renderContext.viewer;
    for (let viewIndex = 0, numViews = viewer.numViews; viewIndex < numViews; viewIndex++) {
      const view = viewer.viewList[viewIndex];
      const viewObject = view.objects[objectId];
      if (!viewObject) {
        continue;
      }
      this._synchronizeMeshWithViewObject(sceneMesh, viewObject);
    }

    return { ok: true, value: undefined };
  }

  /**
   * Synchronizes the per-view state of a {@link SceneMesh} according to a given {@link ViewObject}.
   * This is used when adding a SceneMesh to a SceneObject to ensure the mesh reflects the current object view state.
   * @param sceneMesh
   * @param viewObject
   */
 private _synchronizeMeshWithViewObject(sceneMesh: SceneMesh, viewObject: ViewObject): void {
    const rendererModel = this._rendererModels[sceneMesh.model.id];
    if (!rendererModel) {
      return;
    }
    const rendererMesh = rendererModel.rendererMeshes[sceneMesh.id];
    if (!rendererMesh) {
      return;
    }
    const viewIndex = viewObject.layer.view.viewIndex;
    rendererMesh.setObjectVisible(viewIndex, viewObject.visible);
    rendererMesh.setXRayed(viewIndex, viewObject.xrayed);
    rendererMesh.setHighlighted(viewIndex, viewObject.highlighted);
    rendererMesh.setSelected(viewIndex, viewObject.selected);
    rendererMesh.setPickable(viewIndex, viewObject.pickable);
    // rendererMesh.setColorize(viewIndex, viewObject.colorize);
    // rendererMesh.setOpacity(viewIndex, viewObject.opacity);
  }

  /**
   * Disconnects an existing {@link SceneMesh} from an existing {@link SceneObject}.
   * The mesh remains cached, but is no longer rendered as part of the object.
   * To do that, we set the mesh as having an object visibility of false for all views.
   * @param sceneObject
   * @param sceneMesh
   */
  public sceneObjectMeshRemoved(sceneObject: SceneObject, sceneMesh: SceneMesh): SDKResult<any> {
    const rendererModel = this._rendererModels[sceneObject.model.id];
    if (!rendererModel) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[MeshManager.sceneObjectMeshRemoved] SceneModel not attached with this ID: ${sceneObject.model.id}`
      };
    }
    const rendererObject = this._rendererObjects[sceneObject.id];
    if (!rendererObject) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[MeshManager.sceneObjectMeshAdded] SceneObject not attached with this ID: ${sceneObject.id}`
      };
    }
    const existingMesh = rendererModel.rendererMeshes[sceneMesh.id];
    if (!existingMesh) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[MeshManager.sceneObjectMeshRemoved] SceneMesh not attached with this ID: ${sceneMesh.id}`
      };
    }
    rendererObject.removeRendererMesh(existingMesh);
    for (let viewIndex = 0, numViews = this._renderContext.viewer.viewList.length; viewIndex < numViews; viewIndex++) {
      existingMesh.setObjectVisible(viewIndex, false); // Hide the mesh when removed from object
    }
    return { ok: true, value: undefined };
  }

  /**
   * Handles changes to a {@link SceneTransform}'s matrix.
   */
  public sceneTransformMatrixChanged(sceneTransform: SceneTransform): void {
    // TODO: implement transform graph propagation (if applicable)
  }

  /**
   * Handles changes to a {@link SceneMesh}'s world matrix.
   *
   * Forwards to the corresponding {@link RendererMesh} (if registered).
   */
  public sceneMeshMatrixChanged(sceneMesh: SceneMesh): void {
    this._rendererModels[sceneMesh.model.id]?.rendererMeshes[sceneMesh.id]?.setMatrix(sceneMesh.globalMatrix);
  }

  /**
   * Handles changes to a {@link SceneMesh}'s color.
   *
   * Forwards to the corresponding {@link RendererMesh} (if registered).
   */
  public sceneMeshColorChanged(sceneMesh: SceneMesh): void {
    this._rendererModels[sceneMesh.model.id]?.rendererMeshes[sceneMesh.id]?.setColor(sceneMesh.color);
  }

  /**
   * Handles changes to a {@link SceneMesh}'s opacity.
   *
   * Forwards to the corresponding {@link RendererMesh} (if registered).
   */
  public sceneMeshOpacityChanged(sceneMesh: SceneMesh): void {
    this._rendererModels[sceneMesh.model.id]?.rendererMeshes[sceneMesh.id]?.setOpacity(sceneMesh.opacity);
  }

  /**
   * Handles changes to a {@link ViewObject}'s visibility.
   *
   * Updates the per-view visibility flag on the owning {@link RendererObject}.
   */
  public viewObjectVisibilityChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setVisible(viewObject.layer.view.viewIndex, viewObject.visible);
  }

  /**
   * Handles changes to a {@link ViewObject}'s x-ray state.
   *
   * Updates the per-view x-ray flag on the owning {@link RendererObject}.
   */
  public viewObjectXRayedChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setXRayed(viewObject.layer.view.viewIndex, viewObject.xrayed);
  }

  /**
   * Handles changes to a {@link ViewObject}'s highlighted state.
   *
   * Updates the per-view highlighted flag on the owning {@link RendererObject}.
   */
  public viewObjectHighlightedChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setHighlighted(viewObject.layer.view.viewIndex, viewObject.highlighted);
  }

  /**
   * Handles changes to a {@link ViewObject}'s selected state.
   *
   * Updates the per-view selected flag on the owning {@link RendererObject}.
   */
  public viewObjectSelectedChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setSelected(viewObject.layer.view.viewIndex, viewObject.selected);
  }

  /**
   * Handles changes to a {@link ViewObject}'s colorize state.
   *
   * Updates the per-view colorize flag on the owning {@link RendererObject}.
   */
  public viewObjectColorizeChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setColorize(viewObject.layer.view.viewIndex, viewObject.colorize);
  }

  /**
   * Handles changes to a {@link ViewObject}'s opacity override.
   *
   * Updates the per-view opacity value on the owning {@link RendererObject}.
   */
  public viewObjectOpacityChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setOpacity(viewObject.layer.view.viewIndex, viewObject.opacity);
  }

  /**
   * Handles changes to a {@link ViewObject}'s pickable state.
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
   * Returns a cached list of mesh batches sorted by primitive type.
   *
   * @remarks The list is rebuilt lazily when {@link _batchListDirty} is true.
   */
  public get sortedBatches(): MeshBatch[] {
    if (this._batchListDirty) {
      // @ts-ignore
      this._batchList = Object.values(this._sortedBatches).sort((a, b) => a.primitive - b.primitive);
      this._batchListDirty = false;
    }
    return this._batchList;
  }

  /**
   * Retrieves a mesh batch by index.
   *
   * @param batchIndex - Batch index.
   * @returns The batch if found, otherwise `null`.
   */
  public getBatch(batchIndex: number): MeshBatch | null {
    // NOTE: this looks suspicious because _sortedBatches is keyed by string ids, not indices.
    // Keeping behavior as-is; docs call out the caveat.
    // @ts-ignore
    return this._sortedBatches[batchIndex] ?? null;
  }

  /**
   * Retrieves a {@link SceneMesh} within a specific GPU batch.
   *
   * @param batchIndex - GPU memory batch index.
   * @param meshIndex - Mesh index within the batch.
   */
  public getMeshAtIndex(batchIndex: number, meshIndex: number): SceneMesh | null {
    return this._gpuMemoryManager.getMeshAtIndex(batchIndex, meshIndex);
  }

  /**
   * Retrieves the {@link GPUTile} associated with a given {@link SceneMesh}.
   * @param sceneMesh
   */
  public getMeshTile(sceneMesh: SceneMesh) : GPUTile | null {
    const rendererModel = this._rendererModels[sceneMesh.model.id];
    if (!rendererModel) {
      return null;
    }
    const rendererMesh = rendererModel.rendererMeshes[sceneMesh.id];
    if (!rendererMesh) {
      return null;
    }
    return rendererMesh.gpuTile;
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
   * - Clears internal maps and cached batch list.
   */
  public destroy(): void {
    const {viewer} = this._renderContext;

    if (viewer && viewer.scene) {
      const {models, objects} = viewer.scene;

      // @ts-ignore
      Object.values(objects).forEach((sceneObject) => this.sceneObjectDestroyed(sceneObject));
      // @ts-ignore
      Object.values(models).forEach((sceneModel) => this.sceneModelDestroyed(sceneModel));
      // @ts-ignore
      Object.values(this._sortedBatches).forEach((meshBatch) => meshBatch.destroy());
    }

    this._sortedBatches = {};
    this._batchList = [];
    this._rendererObjects = {};
    this._rendererModels = {};
    this._batchListDirty = true;
  }


}
