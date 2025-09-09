import {RenderContext} from "../RenderContext";
import {SDKError} from "../../core";
import type {
  RendererGeometry,
  RendererMesh,
  RendererObject,
  RendererTexture,
  RendererTextureSet,
  SceneGeometry,
  SceneMesh,
  SceneModel,
  SceneObject,
} from "../../scene";
import {RendererObjectImpl} from "./RendererObjectImpl";
import {RendererMeshImpl} from "./RendererMeshImpl";
import {RendererGeometryImpl} from "./RendererGeometryImpl";
import {RenderLayerImpl} from "./RenderLayerImpl";
import {type GPUMemoryWriteIF} from "../gpuMemory/GPUMemoryWriteIF";
import {RenderLayer} from "./RenderLayer";

/**
 * The RenderGraph manages the relationship between scene objects, their geometries, meshes, and rendering layers.
 */
export class RenderGraph {

  private _rendererObjects: Record<string, RendererObject> = {};
  private _renderContext: RenderContext;
  private _gpuMemoryWriteIF: GPUMemoryWriteIF;

  private _rendererModels: Record<string,
    {
      rendererGeometries: Record<string, RendererGeometry>;
      rendererTextures: Record<string, RendererTexture>;
      rendererTextureSets: Record<string, RendererTextureSet>;
      rendererMeshes: Record<string, RendererMesh>;
    }> = {};

  private _layers: Record<string, RenderLayerImpl> = {};
  private _layerList: RenderLayerImpl[] = [];
  private _layerListDirty = true;

  private _onModelCreated: () => void;
  private _onObjectCreated: () => void;
  private _onObjectDestroyed: () => void;
  private _onModelDestroyed: () => void;

  /**
   * Initializes the RenderGraph with the given rendering context and GPU data gpuMemory editor.
   * @param renderContext
   * @param gpuMemoryWriteIF
   */
  constructor( renderContext: RenderContext, gpuMemoryWriteIF: GPUMemoryWriteIF ) {

    this._renderContext = renderContext;
    this._gpuMemoryWriteIF = gpuMemoryWriteIF;

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
   * Returns the list of layers sorted by their primitive type.
   */
  get layers(): RenderLayer[] {
    if (this._layerListDirty) {
      // @ts-ignore
      this._layerList = Object.values(this._layers).sort(( a, b ) => a.primitive - b.primitive);
      this._layerListDirty = false;
    }
    return this._layerList;
  }

  private _addModel( sceneModel: SceneModel ): void {
    this._rendererModels[sceneModel.id] ||= {
      rendererGeometries: {},
      rendererTextures: {},
      rendererTextureSets: {},
      rendererMeshes: {},
    };
  }

  private _removeModel( sceneModel: SceneModel ): void {
    delete this._rendererModels[sceneModel.id];
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
    const rendererObject = new RendererObjectImpl({
      renderContext: this._renderContext,
      id: objectId,
      rendererMeshes,
    });
    for (let i = 0, len = rendererMeshes.length; i < len; i++) {
      rendererMeshes[i].rendererObject = rendererObject;
    }
    this._rendererObjects[objectId] = rendererObject;
    sceneObject.rendererObject = rendererObject;// SceneObject will use this to make view-global attribute updates
    this._layerListDirty = true;
  }

  private _addMesh( rendererModel: any, sceneMesh: SceneMesh ): RendererMeshImpl|undefined {
    const meshId = sceneMesh.id;
    if (rendererModel.rendererMeshes[meshId]) {
      throw new SDKError(`SceneMesh already attached with this ID: ${meshId}`);
    }
    const layer = this._getLayer(sceneMesh);
    if (!layer) {
      return;
    }
    this._addGeometry(rendererModel, sceneMesh.geometry);
    const rendererMesh = new RendererMeshImpl({
      renderContext: this._renderContext,
      sceneMesh,
      layer,
      gpuMemoryWriteIF: this._gpuMemoryWriteIF
    });
    rendererModel.rendererMeshes[meshId] = rendererMesh;
    sceneMesh.rendererMesh = rendererMesh; // SceneMesh will use this to make view-global attribute updates
    return rendererMesh;
  }

  private _addGeometry( rendererModel: any, geometry: SceneGeometry ): RendererGeometryImpl {
    const geometryId = geometry.id;
    const rendererGeometry = rendererModel.rendererGeometries[geometryId] ||= new RendererGeometryImpl();
    geometry.rendererGeometry = rendererGeometry;
    rendererGeometry.useCount++;
    return rendererGeometry;
  }

  private _getLayer( sceneMesh: SceneMesh ): RenderLayerImpl|undefined {
    const layerId = `layer-${sceneMesh.geometry.primitive}`;
    const layer = this._layers[layerId] ||= new RenderLayerImpl({
      primitive: sceneMesh.geometry.primitive,
      renderContext: this._renderContext,
      gpuMemoryWriteIF: this._gpuMemoryWriteIF
    });
    this._layerListDirty = true;
    return layer;
  }

  private _removeObject( sceneObject: SceneObject ): void {
    const rendererModel = this._rendererModels[sceneObject.model.id];
    if (!rendererModel) {
      return;
    }
    sceneObject.meshes?.forEach(( mesh ) => this._removeMesh(rendererModel, mesh));
    delete this._rendererObjects[sceneObject.id];
    sceneObject.rendererObject = null;
    this._layerListDirty = true;
  }

  private _removeMesh( rendererModel: any, sceneMesh: SceneMesh ): void {
    const rendererMesh = sceneMesh.rendererMesh as RendererMeshImpl;
    if (!rendererMesh) {
      return;
    }
    this._removeGeometry(rendererModel, sceneMesh.geometry);
    rendererMesh.destroy();
    delete rendererModel.rendererMeshes[sceneMesh.id];
    sceneMesh.rendererMesh = null;
    this._layerListDirty = true;
  }

  private _removeGeometry( rendererModel: any, sceneGeometry: SceneGeometry ): void {
    const rendererGeometry = sceneGeometry.rendererGeometry as RendererGeometryImpl;
    if (rendererGeometry && --rendererGeometry.useCount <= 0) {
      delete rendererModel.rendererGeometries[sceneGeometry.id];
      sceneGeometry.rendererGeometry = null;
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
    Object.values(this._layers).forEach(( layer ) => layer.destroy());

    this._layers = {};
    this._layerList = [];
    this._rendererObjects = {};
    this._rendererModels = {};
  }
}
