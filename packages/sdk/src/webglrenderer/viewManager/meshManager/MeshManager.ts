import {RenderContext} from "../../RenderContext";
import {SDKError} from "../../../core";
import type {
  SceneGeometryRendererProxy,
  SceneMeshRendererProxy,
  SceneObjectRendererProxy,
  SceneGeometry,
  SceneMesh,
  SceneModel,
  SceneObject,
} from "../../../scene";
import {RendererObject} from "./RendererObject";
import {RendererMesh} from "./RendererMesh";
import {RendererGeometry} from "./RendererGeometry";
import {MeshBatchImpl} from "./MeshBatchImpl";
import {type GPUMemoryEditor} from "../gpuMemoryManager/GPUMemoryEditor";
import {MeshBatch} from "./MeshBatch";
import {RendererTexture} from "./RendererTexture";
import {RendererTextureSet} from "./RendererTextureSet";

/**
 * The MeshManager manages the relationship between scene objects, their geometries, meshes, and rendering sortedBatches.
 *
 * It listens to the Viewer's Scene for additions and removals of models, objects, meshes and geometries, creating
 * or destroying the corresponding renderer entities as needed.
 *
 * For each existing SceneMesh in the Scene, the MeshManager creates and attaches a SceneMeshRendererProxy, which is an
 * interface through which the SceneMesh can upload updates to its color, opacity and transformation into the renderer.
 *
 * The MeshManager also attaches a SceneObjectRendererProxy to each SceneObject, which is a similar interface through which
 * a ViewObject can control the visual state (visibility, highlighting, color, x-ray etc.) of the object in the renderer.
 *
 * The MeshManager organizes RendererMeshes into DrawLayers based on their primitive type (triangles, lines, points).
 * Each DrawLayer manages GPU resources for rendering its meshes efficiently. The MeshManager creates new DrawLayers as
 * needed when meshes with different primitive types are added.
 */
export class MeshManager {

  private _rendererObjects: Record<string, RendererObject> = {}; // A SceneObject can belong to many SceneModels
  private _renderContext: RenderContext;
  private _gpuMemoryEditor: GPUMemoryEditor;

  private _rendererModels: Record<string, {
      rendererGeometries: Record<string, RendererGeometry>;
      rendererTextures: Record<string, RendererTexture>;
      rendererTextureSets: Record<string, RendererTextureSet>;
      rendererMeshes: Record<string, RendererMesh>;
    }> = {};

  private _sortedBatches: Record<string, MeshBatchImpl> = {};
  private _batchList: MeshBatch[] = [];
  private _batchListDirty = true;

  private _onModelCreated: () => void;
  private _onObjectCreated: () => void;
  private _onObjectDestroyed: () => void;
  private _onModelDestroyed: () => void;

  /**
   * Initializes the MeshManager with the given rendering context and GPU data gpuMemoryManager editor.
   * @param renderContext
   * @param gpuMemoryEditor
   */
  constructor( renderContext: RenderContext, gpuMemoryEditor: GPUMemoryEditor ) {

    this._renderContext = renderContext;
    this._gpuMemoryEditor = gpuMemoryEditor;

    const {viewer} = renderContext;
    const {models, objects, onModelCreated, onObjectCreated, onObjectDestroyed, onModelDestroyed} = viewer.scene;

    // @ts-ignore
    Object.values(models).forEach(( sceneModel ) => this._addModel(sceneModel));
    // @ts-ignore
    Object.values(objects).forEach(( sceneObject ) => this._addObject(sceneObject));

    this._onModelCreated = onModelCreated.subscribe(( _, sceneModel ) => this._addModel(sceneModel));
    this._onObjectCreated = onObjectCreated.subscribe(( _, sceneObject ) => this._addObject(sceneObject));
    this._onObjectDestroyed = onObjectDestroyed.subscribe(( _, sceneObject ) => this._removeObject(sceneObject));
    this._onModelDestroyed = onModelDestroyed.subscribe(( _, sceneModel ) => this._removeModel(sceneModel));
  }

  /**
   * Returns the list of MeshBatches sorted by their primitive type.
   */
  public get sortedBatches(): MeshBatch[] {
    if (this._batchListDirty) {
      // @ts-ignore
      this._batchList = Object.values(this._sortedBatches).sort((a, b ) => a.primitive - b.primitive);
      this._batchListDirty = false;
    }
    return this._batchList;
  }

  /**
   * Retrieves a MeshBatch at the specified index, if it exists.
   * @param batchIndex
   */
  public getBatch( batchIndex: number ): MeshBatch | null {
    return this._sortedBatches[batchIndex];
  }

  /**
   * Retrieves a SceneMesh within a specific batch at the given index.
   * @param batchIndex
   * @param meshIndex
   */
  public getMeshAtIndex( batchIndex: number, meshIndex: number ): SceneMesh | null {
    return this._gpuMemoryEditor.getMeshAtIndex(batchIndex, meshIndex);
  }

  /**
   * Gets the parameters needed for a drawArrays call for a specific mesh in a specific batch.
   * @param batchIndex
   * @param meshIndex
   */
  getDrawArraysParamsForMesh( batchIndex: number, meshIndex: number ): { first: number; count: number } | null{
        return this._gpuMemoryEditor.getDrawArraysParamsForMesh(batchIndex, meshIndex);
    }

  private _addModel( sceneModel: SceneModel ): void {
    this._rendererModels[sceneModel.id] ||= {
      rendererGeometries: {},
      rendererTextures: {},
      rendererTextureSets: {},
      rendererMeshes: {},
    };
    console.log(`MeshBatches: Added RendererModel for SceneModel ID: ${sceneModel.id}`);
  }

  private _removeModel( sceneModel: SceneModel ): void {
    delete this._rendererModels[sceneModel.id];
    console.log(`MeshBatches: Removed RendererModel for SceneModel ID: ${sceneModel.id}`);
  }

  private _addObject( sceneObject: SceneObject ): void {
    const objectId = sceneObject.id;
    if (this._rendererObjects[objectId]) {
      throw new SDKError(`Already has a SceneObject attached with this ID: ${objectId}`);
    }
    const rendererModel = this._rendererModels[sceneObject.model.id];
    if (!rendererModel) {
      throw new SDKError(`SceneModel not found with this ID: ${sceneObject.model.id}`);
    }
    const rendererMeshes = sceneObject.meshes?.map(( mesh ) => this._addMesh(rendererModel, mesh)).filter(Boolean) || [];
    if (rendererMeshes.length === 0) {
      return;
    }
    const rendererObject = new RendererObject({
      renderContext: this._renderContext,
      id: objectId,
      rendererMeshes,
    });
    for (let i = 0, len = rendererMeshes.length; i < len; i++) {
      rendererMeshes[i].rendererObject = rendererObject;
    }
    this._rendererObjects[objectId] = rendererObject;
    sceneObject.sceneObjectRendererProxy = rendererObject as SceneObjectRendererProxy;
    this._batchListDirty = true;
    this._renderContext.setAllViewsDirty();
    console.log(`MeshBatches: Added RendererObject for SceneObject ID: ${objectId}`);
  }

  private _addMesh( rendererModel: any, sceneMesh: SceneMesh ): RendererMesh|undefined {
    const meshId = sceneMesh.id;
    if (rendererModel.rendererMeshes[meshId]) {
      throw new SDKError(`SceneMesh already attached with this ID: ${meshId}`);
    }
    const meshBatch = this._getMeshBatch(sceneMesh);
    if (!meshBatch) {
      throw new SDKError(`Failed to create or find a MeshBatch for SceneMesh ID: ${meshId}`);     // TODO: handle this more gracefully
    }
    this._addGeometry(rendererModel, sceneMesh.geometry);
    const rendererMesh = new RendererMesh({
      renderContext: this._renderContext,
      sceneMesh,
      meshBatch,
      gpuMemoryEditor: this._gpuMemoryEditor
    });
    rendererModel.rendererMeshes[meshId] = rendererMesh;
    sceneMesh.sceneMeshRendererProxy = rendererMesh as SceneMeshRendererProxy;
    console.log(`MeshBatches: Added RendererMesh for SceneMesh ID: ${meshId} to MeshBatch with primitive type: ${meshBatch.primitive}`);
    return rendererMesh;
  }

  private _addGeometry( rendererModel: any, geometry: SceneGeometry ):void {
    const geometryId = geometry.id;
    const rendererGeometry = rendererModel.rendererGeometries[geometryId] ||= new RendererGeometry();
    geometry.sceneGeometryRendererProxy = rendererGeometry as SceneGeometryRendererProxy;
    rendererGeometry.useCount++;
    console.log(`MeshBatches: Added RendererGeometry for SceneGeometry ID: ${geometryId}. Use count: ${rendererGeometry.useCount}`);
  }

  /**
   * Finds or creates a batch that can accommodate the given SceneMesh based
   * on its primitive type and memory requirements.
   */
  private _getMeshBatch( sceneMesh: SceneMesh ): MeshBatchImpl {
    const primitive = sceneMesh.geometry.primitive;
    for (const meshBatch of Object.values(this._sortedBatches)) {
      if (meshBatch.primitive === primitive && meshBatch.canAddMesh(sceneMesh)) {
        return meshBatch;
      }
    }
    const meshBatchId = `meshBatch-${primitive}-${Object.keys(this._sortedBatches).length}`;
  //  const meshBatchId = `meshBatch-${primitive}`; // TODO: allow multiple batches of same primitive
    const newLayer = new MeshBatchImpl({
      primitive,
      renderContext: this._renderContext,
      gpuMemoryEditor: this._gpuMemoryEditor,
      gpuMemoryBatchIndex: this._gpuMemoryEditor.createBatch(),
    });

    this._sortedBatches[meshBatchId] = newLayer;
    this._batchListDirty = true;
    console.log(`MeshBatches: Created new MeshBatch: ${meshBatchId} for primitive type: ${primitive}`);
    return newLayer;
  }

  private _removeObject( sceneObject: SceneObject ): void {
    const rendererModel = this._rendererModels[sceneObject.model.id];
    if (!rendererModel) {
      return;
    }
    sceneObject.meshes?.forEach(( mesh ) => this._removeMesh(rendererModel, mesh));
    delete this._rendererObjects[sceneObject.id];
    sceneObject.sceneObjectRendererProxy = null;
    this._batchListDirty = true;
    this._renderContext.setAllViewsDirty();
    console.log(`MeshBatches: Removed RendererObject for SceneObject ID: ${sceneObject.id}`);
  }

  private _removeMesh( rendererModel: any, sceneMesh: SceneMesh ): void {
    const rendererMesh = sceneMesh.sceneMeshRendererProxy as RendererMesh;
    if (!rendererMesh) {
      return;
    }
    this._removeGeometry(rendererModel, sceneMesh.geometry);
    rendererMesh.destroy();
    delete rendererModel.rendererMeshes[sceneMesh.id];
    sceneMesh.sceneMeshRendererProxy = null;
    this._batchListDirty = true;
    console.log(`MeshBatches: Removed RendererMesh for SceneMesh ID: ${sceneMesh.id}`);
  }

  private _removeGeometry( rendererModel: any, sceneGeometry: SceneGeometry ): void {
    const rendererGeometry = sceneGeometry.sceneGeometryRendererProxy as RendererGeometry;
    if (rendererGeometry && --rendererGeometry.useCount <= 0) {
      delete rendererModel.rendererGeometries[sceneGeometry.id];
      sceneGeometry.sceneGeometryRendererProxy = null;
    }
  }

  destroy(): void {
    const {viewer} = this._renderContext;
    const {models, objects} = viewer.scene;

    // @ts-ignore
    Object.values(objects).forEach(( object ) => this._removeObject(object));
    // @ts-ignore
    Object.values(models).forEach(( model ) => this._removeModel(model));

    this._onModelCreated?.();
    this._onModelDestroyed?.();
    this._onObjectCreated?.();
    this._onObjectDestroyed?.();

    // @ts-ignore
    Object.values(this._sortedBatches).forEach((meshBatch ) => meshBatch.destroy());

    this._sortedBatches = {};
    this._batchList = [];
    this._rendererObjects = {};
    this._rendererModels = {};
  }
}
