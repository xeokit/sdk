import {RenderContext} from "../RenderContext";
import {SDKErrorType, type SDKResult} from "../../../core";
import type {SceneMesh, SceneModel, SceneObject,} from "../../../scene";
import {RendererObject} from "./RendererObject";
import {RendererMesh} from "./RendererMesh";
import {MeshBatchImpl} from "./MeshBatchImpl";
import {type MeshBatch} from "./MeshBatch";
import type {Camera, ViewObject} from "../../../viewer";
import type {SceneTransform} from "../../../scene/SceneTransform";
import {GPUMemoryManager} from "../gpuMemoryManager/GPUMemoryManager";

/**
 * The MeshManager manages the relationship between scene objects, their geometries, meshes, and rendering sortedBatches.
 *
 * It listens to the Viewer's Scene for additions and removals of models, objects, meshes and geometries, creating
 * or destroying the corresponding renderer entities as needed.
 *
 * The MeshManager organizes RendererMeshes into MeshBatches based on their primitive type (triangles, lines, points).
 * Each DrawLayer manages GPU resources for rendering its meshes efficiently. The MeshManager creates new MeshBatches as
 * needed when meshes with different primitive types are added.
 *
 * Assuming the Scene operates correctly, it should consistently emit the appropriate events, ensuring a valid state.
 * However, to maintain robustness, we defensively validate and log errors instead of fully relying on this behavior.
 * SDKInternalExceptions would be used if we had greater confidence in the Scene's reliability.
 */
export class MeshManager {

  private _rendererObjects: Record<string, RendererObject> = {}; // A SceneObject can belong to many SceneModels
  private _renderContext: RenderContext;
  private _gpuMemoryManager: GPUMemoryManager;

  private _rendererModels: Record<string, {
    rendererMeshes: Record<string, RendererMesh>;
  }> = {};

  private _sortedBatches: Record<string, MeshBatchImpl> = {};
  private _batchList: MeshBatch[] = [];
  private _batchListDirty = true;

  /**
   * Initializes the MeshManager with the given rendering context and GPU data gpuMemoryManager editor.
   * @param renderContext
   * @param gpuMemoryManager
   */
  constructor(renderContext: RenderContext, gpuMemoryManager: GPUMemoryManager) {
    this._renderContext = renderContext;
    this._gpuMemoryManager = gpuMemoryManager;
  }

  /**
   * Initializes the MeshManager by registering existing SceneModels and SceneObjects in the Viewer's Scene.
   * @return SDKResult<void> indicating success or failure.
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
    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Handles the creation of a SceneModel.
   */
  public sceneModelCreated(sceneModel: SceneModel): SDKResult<any> {
    if (this._rendererModels[sceneModel.id]) { //  Don't trust Scene's events
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[MeshManager.sceneModelCreated] SceneModel already added with this ID: ${sceneModel.id}`
      };
    }
    this._rendererModels[sceneModel.id] ||= {
      rendererMeshes: {}
    };
    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Handles the destruction of a SceneModel.
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
    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Handles the creation of a SceneObject.
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
    const modelId = sceneObject.model.id
    const rendererModel = this._rendererModels[modelId];
    if (!rendererModel) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[MeshManager.sceneObjectCreated] No SceneModel added with this ID: ${modelId}`
      };
    }
    const rendererMeshes = [];
    for (const sceneMesh of sceneObject.meshes) {
      const result = this._addMesh(rendererModel, sceneMesh);
      if (result.ok === false) {
        return result;
      }
      const rendererMesh = result.value;
      rendererMeshes.push(rendererMesh);
    }
    this._rendererObjects[objectId] = new RendererObject({
      renderContext: this._renderContext,
      id: objectId,
      rendererMeshes // Zero meshes are OK
    });
    this._batchListDirty = true;
    return {
      ok: true,
      value: undefined
    };
  }

  private _addMesh(rendererModel: any, sceneMesh: SceneMesh): SDKResult<RendererMesh> {
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
    return {
      ok: true,
      value: rendererMesh
    };
  }

  private _getMeshBatch(sceneMesh: SceneMesh): SDKResult<MeshBatchImpl> {
    const primitive = sceneMesh.geometry.primitive;
    for (const meshBatch of Object.values(this._sortedBatches)) {
      if (meshBatch.primitive === primitive && meshBatch.canAddMesh(sceneMesh)) {
        return {
          ok: true,
          value: meshBatch
        };
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
    return {
      ok: true,
      value: newMeshBatch
    };
  }

  /**
   * Handles the destruction of a SceneObject.
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
    return {
      ok: true,
      value: undefined
    };
  }

  private _removeMesh(rendererModel: any, sceneMesh: SceneMesh): void {
    const rendererMesh = rendererModel.rendererMeshes[sceneMesh.id];
    if (!rendererMesh) {
      return;
    }
    // this._removeGeometry(rendererModel, sceneMesh.geometry);
    rendererMesh.destroy();
    delete rendererModel.rendererMeshes[sceneMesh.id];
    this._batchListDirty = true;
  }

  /**
   * Handles changes to a SceneTransform's matrix.
   */
  public sceneTransformMatrixChanged(sceneTransform: SceneTransform): void {
  }

  /**
   * Handles changes to a SceneMesh's matrix.
   */
  public sceneMeshMatrixChanged(sceneMesh: SceneMesh): void {
    this._rendererModels[sceneMesh.model.id]?.rendererMeshes[sceneMesh.id]?.setMatrix(sceneMesh.matrix);
  }

  /**
   * Handles changes to a SceneMesh's color.
   */
  public sceneMeshColorChanged(sceneMesh: SceneMesh): void {
    this._rendererModels[sceneMesh.model.id]?.rendererMeshes[sceneMesh.id]?.setColor(sceneMesh.color);
  }

  /**
   * Handles changes to a SceneMesh's opacity.
   */
  public sceneMeshOpacityChanged(sceneMesh: SceneMesh): void {
    this._rendererModels[sceneMesh.model.id]?.rendererMeshes[sceneMesh.id]?.setOpacity(sceneMesh.opacity);
  }

  /**
   * Handles changes to a ViewObject's visibility.
   */
  public viewObjectVisibilityChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setVisible(viewObject.layer.view.viewIndex, viewObject.visible);
  }

  /**
   * Handles changes to a ViewObject's xrayed state.
   */
  public viewObjectXRayedChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setXRayed(viewObject.layer.view.viewIndex, viewObject.xrayed);
  }

  /**
   * Handles changes to a ViewObject's highlighted state.
   */
  public viewObjectHighlightedChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setHighlighted(viewObject.layer.view.viewIndex, viewObject.highlighted);
  }

  /**
   * Handles changes to a ViewObject's selected state.
   */
  public viewObjectSelectedChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setSelected(viewObject.layer.view.viewIndex, viewObject.selected);
  }

  /**
   * Handles changes to a ViewObject's colorize state.
   */
  public viewObjectColorizeChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setColorize(viewObject.layer.view.viewIndex, viewObject.colorize);
  }

  /**
   * Handles changes to a ViewObject's opacity.
   */
  public viewObjectOpacityChanged(viewObject: ViewObject): void {
    this._rendererObjects[viewObject.id]?.setOpacity(viewObject.layer.view.viewIndex, viewObject.opacity);
  }

  /**
   * Handles updates to the camera's view matrix.
   */
  public cameraViewMatrixUpdated(camera: Camera) {
    this._gpuMemoryManager.cameraViewMatrixUpdated(camera);
  }

  /**
   * Returns the list of MeshBatches sorted by their primitive type.
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
   * Retrieves a MeshBatch at the specified index, if it exists.
   */
  public getBatch(batchIndex: number): MeshBatch | null {
    return this._sortedBatches[batchIndex];
  }

  /**
   * Retrieves a SceneMesh within a specific batch at the given index.
   */
  public getMeshAtIndex(batchIndex: number, meshIndex: number): SceneMesh | null {
    return this._gpuMemoryManager.getMeshAtIndex(batchIndex, meshIndex);
  }

  /**
   * Gets the parameters needed for a drawArrays call for a specific mesh in a specific batch.
   */
  public getDrawArraysParamsForMesh(batchIndex: number, meshIndex: number): { first: number; count: number } | null {
    return this._gpuMemoryManager.getDrawArraysParamsForMesh(batchIndex, meshIndex);
  }

  /**
   * Destroys the MeshManager, cleaning up all resources.
   */
  public destroy(): void {

    const {viewer} = this._renderContext;
    const {models, objects} = viewer.scene;

    // @ts-ignore
    Object.values(objects).forEach((sceneObject) => this.sceneObjectDestroyed(sceneObject));

    // @ts-ignore
    Object.values(models).forEach((sceneModel) => this.sceneModelDestroyed(sceneModel));

    // @ts-ignore
    Object.values(this._sortedBatches).forEach((meshBatch) => meshBatch.destroy());

    this._sortedBatches = {};
    this._batchList = [];
    this._rendererObjects = {};
    this._rendererModels = {};
  }

}
