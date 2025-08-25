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
import {LayerImpl} from "./LayerImpl";
import {type Layer} from "./Layer";
import {type GPUDataMemoryEditorIF} from "../gpuDataMemory/GPUDataMemoryEditorIF";

/**
 * Manages the layers and renderer objects in the WebGLRenderer.
 */
export class LayerManager {

  /**
   * A map of renderer objects, keyed by their IDs.
   */
  public rendererObjects: Record<string, RendererObject> = {};

  private _renderContext: RenderContext;
  private _gpuDataMemoryEditor: GPUDataMemoryEditorIF;

  private _rendererModels: Record<string,
    {
      rendererGeometries: Record<string, RendererGeometry>;
      rendererTextures: Record<string, RendererTexture>;
      rendererTextureSets: Record<string, RendererTextureSet>;
      rendererMeshes: Record<string, RendererMesh>;
    }> = {};

  private _layers: Record<string, LayerImpl> = {};
  private _layerList: Layer[] = [];
  private _layerListDirty = true;

  private _onModelCreated: () => void;
  private _onObjectCreated: () => void;
  private _onObjectDestroyed: () => void;
  private _onModelDestroyed: () => void;

  /**
   * Initializes the LayerManager with the given rendering context and GPU data memory editor.
   * @param renderContext
   * @param gpuDataMemoryEditor
   */
  constructor(renderContext: RenderContext, gpuDataMemoryEditor: GPUDataMemoryEditorIF) {

    this._renderContext = renderContext;
    this._gpuDataMemoryEditor = gpuDataMemoryEditor;

    const {viewer} = renderContext;
    const {models, objects, onModelCreated, onObjectCreated, onObjectDestroyed, onModelDestroyed} = viewer.scene;

    // @ts-ignore
    Object.values(models).forEach((sceneModel) => this._attachModel(sceneModel));
    // @ts-ignore
    Object.values(objects).forEach((sceneObject) => this._attachObject(sceneObject));

    this._onModelCreated = onModelCreated.subscribe((_, sceneModel) => this._attachModel(sceneModel));
    this._onObjectCreated = onObjectCreated.subscribe((_, sceneObject) => this._attachObject(sceneObject));
    this._onObjectDestroyed = onObjectDestroyed.subscribe((_, sceneObject) => this._detachObject(sceneObject));
    this._onModelDestroyed = onModelDestroyed.subscribe((_, sceneModel) => this._detachModel(sceneModel));
  }

  /**
   * Returns the list of layers, sorted by their primitive type.
   */
  get layers(): Layer[] {
    if (this._layerListDirty) {
      // @ts-ignore
      this._layerList = Object.values(this._layers).sort((a, b) => a.primitive - b.primitive);
      this._layerListDirty = false;
    }
    return this._layerList;
  }

  private _attachModel(sceneModel: SceneModel): void {
    this._rendererModels[sceneModel.id] ||= {
      rendererGeometries: {},
      rendererTextures: {},
      rendererTextureSets: {},
      rendererMeshes: {},
    };
  }

  private _detachModel(sceneModel: SceneModel): void {
    delete this._rendererModels[sceneModel.id];
  }

  private _attachObject(sceneObject: SceneObject): void {
    const objectId = sceneObject.id;
    if (this.rendererObjects[objectId]) {
      throw new SDKError(`Already has a SceneObject attached with this ID: ${objectId}`);
    }
    const rendererModel = this._rendererModels[sceneObject.model.id];
    if (!rendererModel) {
      throw new SDKError(`SceneModel not found with this ID: ${sceneObject.model.id}`);
    }
    const rendererMeshes = sceneObject.meshes?.map((mesh) => this._attachMesh(rendererModel, mesh)).filter(Boolean) || [];
    if (rendererMeshes.length === 0) {
      return;
    }
    const rendererObject = new RendererObjectImpl({
      renderContext: this._renderContext,
      id: objectId,
      rendererMeshes,
    });
    this.rendererObjects[objectId] = rendererObject;
    sceneObject.rendererObject = rendererObject;
    this._layerListDirty = true;
  }

  private _attachMesh(rendererModel: any, sceneMesh: SceneMesh): RendererMeshImpl | undefined {
    const meshId = sceneMesh.id;
    if (rendererModel.rendererMeshes[meshId]) {
      throw new SDKError(`SceneMesh already attached with this ID: ${meshId}`);
    }
    const rendererGeometry = this._attachGeometry(rendererModel, sceneMesh.geometry);
    const layer = this._getLayer(sceneMesh);
    if (!layer) {
      return;
    }
    const rendererMesh = new RendererMeshImpl({
      renderContext: this._renderContext,
      id: meshId,
      sceneMesh,
      layer,
      meshIndex: layer.addMesh(sceneMesh),
      rendererGeometry,
      gpuDataMemoryEditor: this._gpuDataMemoryEditor
    });
    rendererModel.rendererMeshes[meshId] = rendererMesh;
    sceneMesh.rendererMesh = rendererMesh;
    return rendererMesh;
  }

  private _attachGeometry(rendererModel: any, geometry: SceneGeometry): RendererGeometryImpl {
    const geometryId = geometry.id;
    const rendererGeometry = rendererModel.rendererGeometries[geometryId] ||= new RendererGeometryImpl();
    geometry.rendererGeometry = rendererGeometry;
    rendererGeometry.useCount++;
    return rendererGeometry;
  }

  private _getLayer(sceneMesh: SceneMesh): LayerImpl | undefined {
    const layerId = `layer-${sceneMesh.geometry.primitive}`;
    const layer = this._layers[layerId] ||= new LayerImpl({
      primitive: sceneMesh.geometry.primitive,
      renderContext: this._renderContext,
      gpuDataMemoryEditor: this._gpuDataMemoryEditor
    });
    this._layerListDirty = true;
    return layer;
  }

  private _detachObject(sceneObject: SceneObject): void {
    const rendererModel = this._rendererModels[sceneObject.model.id];
    if (!rendererModel) {
      return;
    }
    sceneObject.meshes?.forEach((mesh) => this._detachMesh(rendererModel, mesh));
    delete this.rendererObjects[sceneObject.id];
    sceneObject.rendererObject = null;
    this._layerListDirty = true;
  }

  private _detachMesh(rendererModel: any, sceneMesh: SceneMesh): void {
    const rendererMesh = sceneMesh.rendererMesh as RendererMeshImpl;
    if (!rendererMesh) {
      return;
    }
    this._detachGeometry(rendererModel, sceneMesh.geometry);
    rendererMesh.layer.removeMesh(sceneMesh, rendererMesh.rendererObject.flags);
    rendererMesh.destroy();
    delete rendererModel.rendererMeshes[sceneMesh.id];
    sceneMesh.rendererMesh = null;
    this._layerListDirty = true;
  }

  private _detachGeometry(rendererModel: any, sceneGeometry: SceneGeometry): void {
    const rendererGeometry = sceneGeometry.rendererGeometry as RendererGeometryImpl;
    if (rendererGeometry && --rendererGeometry.useCount <= 0) {
      delete rendererModel.rendererGeometries[sceneGeometry.id];
      sceneGeometry.rendererGeometry = null;
    }
  }

  /**
   * Cleans up resources and destroys the LayerManager.
   */
  destroy(): void {
    const {viewer} = this._renderContext;
    const {models, objects} = viewer.scene;

    // @ts-ignore
    Object.values(objects).forEach((object) => this._detachObject(object));
    // @ts-ignore
    Object.values(models).forEach((model) => this._detachModel(model));

    this._onModelCreated?.();
    this._onModelDestroyed?.();
    this._onObjectCreated?.();
    this._onObjectDestroyed?.();

    // @ts-ignore
    Object.values(this._layers).forEach((layer) => layer.destroy());

    this._layers = {};
    this._layerList = [];
    this.rendererObjects = {};
    this._rendererModels = {};
  }
}
