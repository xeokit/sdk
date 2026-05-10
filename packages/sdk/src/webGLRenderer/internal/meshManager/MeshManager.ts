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

  /**
   * Renderer meshes keyed by {@link SceneMesh.uniqueId}.
   */
  private _rendererMeshes: Record<string, RendererMesh> = {};

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

  /** Whether {@link _batches} needs to be re-sorted by primitive. */
  private _batchesDirty = true;

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

    return {ok: true, value: undefined};
  }

  /**
   * Registers a newly created {@link SceneModel}.
   *
   * @param sceneModel - The model to register.
   * @returns {@link SDKResult} indicating success, or `ok:false` if a model with the same id
   * was already registered.
   */
  public sceneModelCreated(sceneModel: SceneModel): SDKResult<any> {
    return {ok: true, value: undefined};
  }

  /**
   * Unregisters a {@link SceneModel}.
   *
   * @param sceneModel - The model to unregister.
   * @returns {@link SDKResult} indicating success, or `ok:false` if the model was not registered.
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
   * Registers a newly created {@link SceneGeometry}.
   *
   * @param sceneGeometry - The geometry to register.
   * @returns {@link SDKResult} indicating success, or `ok:false` if registration fails.
   */
  public sceneGeometryCreated(sceneGeometry: SceneGeometry): SDKResult<any> {
    return {ok: true, value: undefined};
  }

  /**
   * Unregisters a {@link SceneGeometry}.
   * @param sceneGeometry - The geometry to unregister.
   * @returns {@link SDKResult} indicating success, or `ok:false` if unregistration fails.
   */
  sceneGeometryDestroyed(sceneGeometry: SceneGeometry): SDKResult<any> {
    return {ok: true, value: undefined};
  }

  /**
   * Registers a newly created {@link SceneMesh}.
   * @param sceneMesh - The mesh to register.
   * @returns {@link SDKResult} indicating success, or `ok:false` if registration fails.
   */
  sceneMeshCreated(sceneMesh: SceneMesh): SDKResult<any> {
    return this._addMesh(sceneMesh);
  }

  /**
   * Unregisters a {@link SceneMesh}.
   * @param sceneMesh - The mesh to unregister.
   * @returns {@link SDKResult} indicating success, or `ok:false` if unregistration fails.
   */
  sceneMeshDestroyed(sceneMesh: SceneMesh): SDKResult<any> {
    this._removeMesh(sceneMesh);
    return {ok: true, value: undefined};
  }

  /**
   * Registers a newly created {@link SceneObject}.
   *
   * Creates a {@link RendererObject}, expects that all its meshes are pre-registered
   * and have corresponding {@link RendererMesh} instances.
   *
   * @param sceneObject - The object to register.
   * @returns {@link SDKResult} indicating success, or `ok:false` if:
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

    this._batchesDirty = true;

    return {ok: true, value: undefined};
  }

  /**
   * Creates (or reuses) a compatible {@link MeshBatchImpl} and registers the given {@link SceneMesh}
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

    this._rendererMeshes[meshGlobalId] = rendererMesh;

    return {ok: true, value: rendererMesh};
  }

  /**
   * Returns an existing compatible {@link MeshBatchImpl} for the mesh or creates a new one.
   *
   * Compatibility is determined by:
   * - matching geometry primitive type,
   * - matching `hasNormals` flag (so geometry-with-normals lands in the
   *   smooth-shaded batch and geometry-without lands in the flat-shaded one),
   * - matching `hasUVs` flag (so the UV-bearing technique variant only sees
   *   geometries that actually populate the UV data texture), and
   * - {@link MeshBatchImpl.canAddMesh} constraints.
   *
   * @param sceneMesh - The mesh requiring a batch.
   * @returns {@link SDKResult} containing a compatible batch.
   */
  private _getMeshBatch(sceneMesh: SceneMesh): SDKResult<MeshBatchImpl> {
    const primitive = sceneMesh.geometry.primitive;
    const hasNormals = !!sceneMesh.geometry.normalsCompressed;
    const hasUVs     = !!sceneMesh.geometry.uvsCompressed;

    for (let i = 0, len = this._batches.length; i < len; i++) {
      const meshBatch = this._batches[i];
      if (meshBatch.primitive === primitive
          && meshBatch.hasNormals === hasNormals
          && meshBatch.hasUVs === hasUVs) {
        const canAddResult = meshBatch.canAddMesh(sceneMesh);
        if (canAddResult !== GPUMemoryCheckResult.OK) {
          continue;
        }
        return {ok: true, value: meshBatch};
      }
    }

    const result = this._gpuMemoryManager.createBatch({hasNormals, hasUVs});
    if (result.ok === false) {
      return result;
    }

    const gpuMemoryBatchIndex = result.value;

    const newMeshBatch = new MeshBatchImpl({
      primitive,
      hasNormals,
      hasUVs,
      renderContext: this._renderContext,
      gpuMemoryManager: this._gpuMemoryManager,
      gpuMemoryBatchIndex,
    });

    this._batches.push(newMeshBatch);
    this._batchesDirty = true;

    return {ok: true, value: newMeshBatch};
  }

  /**
   * Unregisters a {@link SceneObject}.
   *
   * Destroys the {@link RendererObject}.
   *
   * @param sceneObject - The object to unregister.
   * @returns {@link SDKResult} indicating success, or `ok:false` if the object is not registered.
   */
  public sceneObjectDestroyed(sceneObject: SceneObject): SDKResult<any> {
    if (!this._rendererObjects[sceneObject.id]) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[MeshManager.sceneObjectDestroyed] SceneObject not attached with this ID: ${sceneObject.id}`
      };
    }

    delete this._rendererObjects[sceneObject.id];

    sceneObject.meshes?.forEach((mesh) => this._removeMesh(mesh));

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
   * Connects an existing {@link SceneMesh} to an existing {@link SceneObject}.
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
    for (let viewIndex = 0, numViews = viewer.numViews; viewIndex < numViews; viewIndex++) {
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
   * Synchronizes the per-view state of a {@link SceneMesh} according to a given {@link ViewObject}.
   * This is used when adding a SceneMesh to a SceneObject to ensure the mesh reflects the current object view state.
   * @param sceneMesh
   * @param viewObject
   */
  private _synchronizeMeshWithViewObject(sceneMesh: SceneMesh, viewObject: ViewObject): void {
    const rendererMesh = this._rendererMeshes[sceneMesh.uniqueId];
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
    rendererObject.removeRendererMesh(rendererMesh);
    for (let viewIndex = 0, numViews = this._renderContext.viewer.viewList.length; viewIndex < numViews; viewIndex++) {
      rendererMesh.setObjectVisible(viewIndex, false);
    }
    return {ok: true, value: undefined};
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
    this._rendererMeshes[sceneMesh.uniqueId]?.setMatrix(sceneMesh.worldMatrix);
  }

  /**
   * Handles changes to a {@link SceneMesh}'s color.
   *
   * Forwards to the corresponding {@link RendererMesh} (if registered).
   */
  public sceneMeshColorChanged(sceneMesh: SceneMesh): void {
    this._rendererMeshes[sceneMesh.uniqueId]?.setColor(sceneMesh.effectiveColor);
  }

  /**
   * Handles changes to a {@link SceneMesh}'s opacity.
   *
   * Forwards to the corresponding {@link RendererMesh} (if registered).
   */
  public sceneMeshOpacityChanged(sceneMesh: SceneMesh): void {
    this._rendererMeshes[sceneMesh.uniqueId]?.setOpacity(sceneMesh.effectiveOpacity);
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

    this._batches = [];
    this._rendererObjects = {};
    this._rendererMeshes = {};
    this._batchesDirty = true;
  }
}
