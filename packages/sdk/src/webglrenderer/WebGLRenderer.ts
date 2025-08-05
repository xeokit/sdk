import {
  addVec3,
  createMat4,
  createVec2,
  createVec3, createVec4,
  cross3Vec3,
  dotVec4, inverseMat4,
  lookAtMat4v,
  mulMat4, mulVec4Scalar,
  normalizeVec3, subVec3, transformVec4
} from "../matrix";
import type {Capabilities, TextureTranscoder} from "../core";
import {EventEmitter, SDKError} from "../core";
import {getWebGLExtension, WEBGL_INFO} from "../webglutils";
import type {Renderer, View, Viewer} from "../viewer";
import {type PickParams, PickResult} from "../viewer";
import type {RendererMesh, RendererObject, SceneModel} from "../scene";
import {EventDispatcher} from "strongly-typed-events";
import type {FloatArrayParam} from "../math";
import {KTX2TextureTranscoder} from "../ktx2";
import {Layer} from "./layer/Layer";
import {Map} from "../utils";
import type {Pickable} from "./Pickable";
import {RenderContext} from "./RenderContext";
import {RenderStats} from "./RenderStats";
import {SAODepthLimitedBlurRenderer} from "./sao/SAODepthLimitedBlurRenderer";
import {SAOOcclusionRenderer} from "./sao/SAOOcclusionRenderer";
import {WebGLRenderBufferManager} from "./WebGLRenderBufferManager";
import {WebGLRendererMesh} from "./proxies/WebGLRendererMesh";

import {WebGLRendererView} from "./WebGLRendererView";
import {createRTCViewMat} from "../rtc";

import {DTXMemory} from "./dtx/DTXMemory";
import type {
  RendererGeometry,
  RendererTexture,
  RendererTextureSet,
  SceneGeometry,
  SceneMesh,
  SceneObject
} from "../scene";
import {WebGLRendererObject} from "./proxies/WebGLRendererObject";
import {WebGLRendererGeometry} from "./proxies/WebGLRendererGeometry";


const tempVec3a = createVec3();
const tempVec3b = createVec3();
const tempVec3c = createVec3();

const tempVec4a = createVec4();
const tempVec4b = createVec4();
const tempVec4c = createVec4();
const tempVec4d = createVec4();
const tempVec4e = createVec4();

const tempMat4a = createMat4();
const tempMat4b = createMat4();
const tempMat4c = createMat4();

const pickTemps = {
  pickCanvasPos: createVec2(),
  pickWorldRayDir: createVec3(),
  pickWorldRayOrigin: createVec3(),
  pickViewMatrix: createMat4(),
  pickProjMatrix: createMat4()
};

/**
 * WebGL rendering strategy for a Viewer.
 *
 * See {@link "webglrenderer" | @xeokit/webglrenderer} for usage.
 */
export class WebGLRenderer implements Renderer {

  /**
   * The RenderObjects in this Renderer.
   */
  public rendererObjects: { [key: string]: RendererObject };

  /**
   * @internal
   */
  readonly renderStats: RenderStats;

  #gl: WebGL2RenderingContext;
  #renderContext: RenderContext;
  #webglCanvasElement: HTMLCanvasElement;
  #saoOcclusionRenderer: SAOOcclusionRenderer;
  #saoDepthLimitedBlurRenderer: SAODepthLimitedBlurRenderer;
  #pickBufferManager: WebGLRenderBufferManager;
  #rendererViews: { [key: string]: WebGLRendererView };
  #rendererViewsList: WebGLRendererView[];
  #activeRendererView: WebGLRendererView;
  #needsRebuild: boolean;
  #rendererModels: {
    [key: string]: {
      rendererGeometries: { [key: string]: RendererGeometry };
      rendererTextures: { [key: string]: RendererTexture };
      rendererTextureSets: { [key: string]: RendererTextureSet; };
      rendererMeshes: { [key: string]: RendererMesh };
    }
  };
  #layers: { [key: string]: Layer };
  #layerList: Layer[];
  #layerListDirty: boolean;
  #stateSortDirty: boolean;
  #pickIDs = new Map({});
  #extensionHandles: any;
  #logarithmicDepthBufferEnabled: boolean;
  #alphaDepthMask: boolean;
  #occlusionTester: any;
  #textureTranscoder: TextureTranscoder;
  #viewMatrixDirty: boolean;
  #pickResult: PickResult;
  #snapshotBound: boolean;
  #destroyed: boolean;

  /**
   * @internal
   * @event
   */
  readonly onCompiled: EventEmitter<WebGLRenderer, boolean>;

  /**
   * @internal
   * @event
   */
  readonly onDestroyed: EventEmitter<WebGLRenderer, boolean>;

  #onViewCreated: () => void;
  #onViewDestroyed: () => void;
  #onViewerDestroyed: () => void;
  #onObjectCreated: () => void;
  #onObjectDestroyed: () => void;
  #onModelCreated: () => void;
  #onModelDestroyed: () => void;

  /**
   * Creates a WebGLRenderer.
   *
   * @param params Configs
   * @param params.textureTranscoder Injects an optional transcoder that will be used internally
   * to convert transcoded texture data. The transcoder is only required when we'll be providing transcoded texture
   * data. We assume that all transcoded texture data added to a  ````rendererModel````
   * will then be in a format supported by this transcoder.
   */
  constructor(params: {
    textureTranscoder?: TextureTranscoder
  }) {

    this.renderStats = new RenderStats();
    this.#renderContext = null;
    this.#textureTranscoder = params.textureTranscoder || new KTX2TextureTranscoder({});
    this.#alphaDepthMask = false;
    this.#extensionHandles = {};
    this.#pickIDs = new Map({});
    this.#layerList = [];
    this.#layerListDirty = true;
    this.#stateSortDirty = true;
    this.#needsRebuild = true;
    this.#occlusionTester = null; // Lazy-created in #addMarker()
    this.#logarithmicDepthBufferEnabled = false;
    this.#rendererModels = {};
    this.rendererObjects = {};
    this.#viewMatrixDirty = true;
    this.#snapshotBound = false;
    this.#destroyed = false;
    this.#rendererViews = {};
    this.#rendererViewsList = [];
    this.#activeRendererView = null;
    this.#pickResult = new PickResult();

    this.onCompiled = new EventEmitter(new EventDispatcher<WebGLRenderer, boolean>());
    this.onDestroyed = new EventEmitter(new EventDispatcher<WebGLRenderer, boolean>());

    this.#webglCanvasElement = document.createElement('canvas');
    const webglCanvasElement = this.#webglCanvasElement;
    webglCanvasElement.width = 400;
    webglCanvasElement.height = 400;
    webglCanvasElement.style.position = 'absolute';
    webglCanvasElement.style.top = '50px';
    webglCanvasElement.style.left = '50px';
    webglCanvasElement.style.border = '1px solid black';
    webglCanvasElement.style["pointer-events"] = "none";
    webglCanvasElement.style["z-index"] = 100000; // HACK
    document.body.appendChild(webglCanvasElement);
    const contextAttr = {
      alpha: true,
      preserveDrawingBuffer: true,
      stencil: false,
      premultipliedAlpha: false,
      antialias: true
    };
    this.#gl = <WebGL2RenderingContext>webglCanvasElement.getContext("webgl2", contextAttr);
    if (!this.#gl) {
      throw new SDKError(`Failed to get a WebGL2 context`);
    }
    this.#gl.hint(this.#gl.FRAGMENT_SHADER_DERIVATIVE_HINT, this.#gl.NICEST);

    this.#pickBufferManager = new WebGLRenderBufferManager(this.#gl, webglCanvasElement);
  }

  /**
   * The Viewer this WebGLRenderer is currently attached to, if any.
   */
  get viewer(): Viewer {
    return this.#renderContext.viewer;
  }

  /**
   * Gets the TextureTranscoder this WebGLRenderer was configured with, if any.
   *
   * @internal
   */
  get textureTranscoder(): void | TextureTranscoder {
    return this.#textureTranscoder;
  }

  /**
   * Gets the capabilities of this WebGLRenderer.
   *
   * @param capabilities Returns the capabilities of this WebGLRenderer.
   * @internal
   */
  getCapabilities(capabilities: Capabilities): void {
    capabilities.maxViews = 4;
    const htmlElement = document.createElement('canvas');
    let gl;
    try {
      gl = htmlElement.getContext("webgl2");
    } catch (e) {
      console.error('Failed to get a WebGL context');
    }
    if (gl) {
      capabilities.astcSupported = !!getWebGLExtension(gl, 'WEBGL_compressed_texture_astc');
      capabilities.etc1Supported = true; // WebGL
      capabilities.etc2Supported = !!getWebGLExtension(gl, 'WEBGL_compressed_texture_etc');
      capabilities.dxtSupported = !!getWebGLExtension(gl, 'WEBGL_compressed_texture_s3tc');
      capabilities.bptcSupported = !!getWebGLExtension(gl, 'EXT_texture_compression_bptc');
      capabilities.pvrtcSupported = !!(getWebGLExtension(gl, 'WEBGL_compressed_texture_pvrtc') || getWebGLExtension(gl, 'WEBKIT_WEBGL_compressed_texture_pvrtc'));
    }
  }

  /**
   * Initializes this WebGLRenderer by attaching a {@link viewer!Viewer | Viewer}.
   *
   * @internal
   * @param viewer Viewer to attach.
   * @returns *void*
   * * Viewer successfully attached.
   * @returns *{@link core!SDKError | SDKError}*
   * * A Viewer is already attached to this Renderer.
   * * The given Viewer is already attached to another Renderer.
   */
  attachViewer(viewer: Viewer): void {
    if (this.#renderContext) {
      throw new SDKError("Can't attach Viewer to WebGLRenderer - a Viewer is already attached");
    }
    if (viewer.renderer) {
      throw new SDKError("Can't attach Viewer to WebGLRenderer - given Viewer is already attached to another Renderer");
    }
    // Attach existing Views and Scene components
    for (let viewIndex = 0; viewIndex < viewer.numViews; viewIndex++) {
      this.#attachView(viewer.viewList[viewIndex]);
    }
    const scene = viewer.scene;
    for (let modelId in scene.models) {
      this.#attachModel(scene.models[modelId]);
    }
    for (let objectId in scene.objects) {
      this.#attachObject(scene.objects[objectId]);
    }
    // Synch with Viewer and Scene content updates
    this.#onViewCreated = viewer.onViewCreated.subscribe((_, view) => {
      this.#attachView(view);
    });
    this.#onViewDestroyed = viewer.onViewDestroyed.subscribe((_, view) => {
      this.#detachView(view);
    });
    this.#onViewerDestroyed = viewer.onDestroyed.subscribe((viewer, _) => {
      this.detachViewer();
    });
    this.#onModelCreated = scene.onModelCreated.subscribe((viewer, sceneModel) => {
      this.#attachModel(sceneModel);
    });
    this.#onObjectCreated = scene.onObjectCreated.subscribe((viewer, object) => {
      this.#attachObject(object);
    });
    this.#onObjectDestroyed = scene.onObjectDestroyed.subscribe((viewer, object) => {
      this.#detachObject(object);
    });
    this.#onModelDestroyed = scene.onModelDestroyed.subscribe((viewer, sceneModel) => {
      this.#detachModel(sceneModel);
    });
    this.#textureTranscoder.init(viewer.capabilities);
    this.#renderContext = new RenderContext(viewer, this.#gl, this, new DTXMemory({gl: this.#gl, viewer}));
    this.#saoOcclusionRenderer = new SAOOcclusionRenderer({
      renderContext: this.#renderContext
    });
    this.#saoDepthLimitedBlurRenderer = new SAODepthLimitedBlurRenderer({
      renderContext: this.#renderContext
    });
  }

  /**
   * Detaches the {@link viewer!Viewer | Viewer} that is currently attached, if any.
   *
   * @internal
   */
  detachViewer(): void {
    if (!this.#renderContext) {
      return;
    }
    const viewer = this.#renderContext.viewer;
    const scene = viewer.scene;
    const sceneObjects = scene.objects;
    const sceneModels = scene.models;
    for (let objectId in sceneObjects) {
      this.#detachObject(sceneObjects[objectId]);
    }
    for (let modelId in sceneModels) {
      this.#detachModel(sceneModels[modelId]);
    }
    for (let viewIndex = 0; viewIndex < viewer.numViews; viewIndex++) {
      this.#detachView(viewer.viewList[viewIndex]);
    }

    this.#onViewerDestroyed();
    this.#onViewCreated();
    this.#onViewDestroyed();
    this.#onModelCreated();
    this.#onModelDestroyed();
    this.#onObjectCreated();
    this.#onObjectDestroyed();

    this.#saoOcclusionRenderer.destroy();
    this.#saoDepthLimitedBlurRenderer.destroy();

    // TODO: Delete DTXMemory

    this.#renderContext = null;
    this.#saoOcclusionRenderer = null;
    this.#saoDepthLimitedBlurRenderer = null;
    this.#rendererViews = {};
    this.#layerList = [];
    this.rendererObjects = {};
    this.#rendererModels = {};
  }

  #attachView(view: View): WebGLRendererView {
    if (this.#rendererViews[view.id]) {
      throw "[WebGLRenderer] Can't attach additional View to WebGLRenderer - View already attached (see WebViewerCapabilities.maxViews)";
    }
    const rendererView = new WebGLRendererView(this.#renderContext.gl, this.#webglCanvasElement, view);
    this.#rendererViews[view.id] = rendererView;
    view.viewIndex = this.#rendererViewsList.length;
    this.#rendererViewsList.push(rendererView);
    return rendererView;
  }

  #detachView(view: View): void {
    const rendererView = this.#rendererViews[view.id];
    if (!rendererView) {
      throw "[WebGLRenderer] View is not attached";
    }
    rendererView.destroy();
    delete this.#rendererViews[view.id];
  }

  #attachModel(sceneModel: SceneModel): void {
    const modelId = sceneModel.id;
    let rendererModel = this.#rendererModels[modelId];
    if (!rendererModel) {
      rendererModel = {
        rendererGeometries: {},
        rendererTextures: {},
        rendererTextureSets: {},
        rendererMeshes: {}
      };
      this.#rendererModels[modelId] = rendererModel;
    }
  }

  #detachModel(sceneModel: SceneModel): void {
    delete this.#rendererModels[sceneModel.id];
  }

  #attachObject(sceneObject: SceneObject): void {
    let objectId = sceneObject.id;
    if (this.rendererObjects[objectId]) {
      throw "[WebGLRenderer] Already has a SceneObject attached with this ID: " + objectId;
    }
    const sceneModel = sceneObject.model;
    const modelId = sceneModel.id;
    const rendererModel = this.#rendererModels[modelId];
    if (!rendererModel) {
      throw "[WebGLRenderer] SceneModel not found with this ID: " + modelId;
    }
    const meshes = sceneObject.meshes;
    if (meshes === undefined) {
      throw "[WebGLRenderer] SceneObject property expected: meshes";
    }
    const rendererMeshes = [];
    for (let i = 0, len = meshes.length; i < len; i++) {
      const sceneMesh = meshes[i];
      try {
        const rendererMesh = this.#attachMesh(rendererModel, sceneMesh);
        if (rendererMesh instanceof SDKError) {
          console.log("[WebGLRenderer] " + rendererMesh);
        } else {
          rendererMeshes.push(rendererMesh);
        }
      } catch (sdkError) {
        console.log("[WebGLRenderer] " + sdkError);
      }
    }
    if (rendererMeshes.length === 0) {
      // TODO: Handle this case gracefully?
      return;
    }
    const rendererObject = new WebGLRendererObject({
      renderContext: this.#renderContext,
      id: objectId,
      rendererModel: this,
      rendererMeshes
    });
    this.rendererObjects[objectId] = rendererObject;
    sceneObject.rendererObject = rendererObject;
    this.#layerListDirty = true;
  }

  #attachMesh(rendererModel: any, sceneMesh: SceneMesh): SDKError | WebGLRendererMesh {
    const meshId = sceneMesh.id;
    if (rendererModel.rendererMeshes[meshId]) {
      throw "[WebGLRenderer] SceneMesh already attached with this ID: " + meshId;
    }
    const rendererGeometry = this.#attachGeometry(rendererModel, sceneMesh.geometry);
    const layer = this.#getLayer(sceneMesh);
    if (!layer) {
      return new SDKError("Failed to allocate memory for SceneMesh with this ID: " + meshId);
    }
    const rendererMesh = new WebGLRendererMesh({ // Calls ayer.addMesh
      renderContext: this.#renderContext,
      id: sceneMesh.id,
      sceneMesh,
      layer,
      meshIndex: layer.addMesh(sceneMesh),
      rendererGeometry
    });
    rendererModel.rendererMeshes[sceneMesh.id] = rendererMesh;
    sceneMesh.rendererMesh = rendererMesh;
    return rendererMesh;
  }

  #attachGeometry(rendererModel: any, geometry: SceneGeometry): WebGLRendererGeometry {
    const geometryId = geometry.id;
    let rendererGeometry = rendererModel.rendererGeometries[geometryId];
    if (!rendererGeometry) {
      rendererGeometry = new WebGLRendererGeometry();
      rendererModel.rendererGeometries[geometryId] = rendererGeometry;
      geometry.rendererGeometry = rendererGeometry;
    }
    rendererGeometry.useCount++;
    return rendererGeometry;
  }

  #getLayer(sceneMesh: SceneMesh): Layer | undefined {
    const sceneGeometry = sceneMesh.geometry;
    const primitive = sceneGeometry.primitive;
    const layerId = `layer-${primitive}`;
    let layer = this.#layers[layerId];
    if (layer) {
      // if (layer.canAddMesh(sceneMesh)) {
      return layer;
      // } else {
      //   delete this.#currentLayers[layerId];
      // }
    }
    layer = new Layer({primitive, renderContext: this.#renderContext});
    this.#layers[layerId] = layer;
    return layer;
  }

  #detachObject(sceneObject: SceneObject) {
    const rendererModel = this.#rendererModels[sceneObject.model.id];
    if (rendererModel) {
      const meshes = sceneObject.meshes;
      if (meshes) {
        for (let i = 0, len = meshes.length; i < len; i++) {
          const sceneMesh = meshes[i];
          this.#detachMesh(rendererModel, sceneMesh);
        }
      }
      delete this.rendererObjects[sceneObject.id];
      sceneObject.rendererObject = null;
      this.#layerListDirty = true;
    }
  }

  #detachMesh(rendererModel: any, sceneMesh: SceneMesh): void {
    const rendererMesh = <WebGLRendererMesh>sceneMesh.rendererMesh;
    if (rendererMesh) {
      const sceneGeometry = sceneMesh.geometry;
      if (sceneGeometry) {
        this.#detachGeometry(rendererModel, sceneGeometry);
      }
      const rendererObject = rendererMesh.rendererObject;
      rendererMesh.layer.removeMesh(sceneMesh, rendererObject.flags);
      this.#putLayer(rendererMesh.layer);
      delete rendererModel.rendererMeshes[sceneMesh.id];
      sceneMesh.rendererMesh = null;
    }
  }

  #detachGeometry(rendererModel: any, sceneGeometry: SceneGeometry): void {
    let rendererGeometry = <WebGLRendererGeometry>sceneGeometry.rendererGeometry;
    if (rendererGeometry) {
      if (--rendererGeometry.useCount <= 0) {
        delete rendererModel.rendererGeometries[sceneGeometry.id];
        sceneGeometry.rendererGeometry = null;
      }
    }
  }

  #putLayer(layer: Layer) {
    // TODO: Keep Layers or cleanup?
  }

  /**
   * @private
   */
  attachPickable(pickable: Pickable): number { // @ts-ignore
    return this.#pickIDs.addItem(pickable);
  }

  /**
   * @private
   */
  detachPickable(pickId: number) {
    this.#pickIDs.removeItem(pickId);
  }

  /**
   * Indicates that the WebGLRenderer needs to draw a new frame.
   * @internal
   */
  setImageDirty(viewIndex?: number): void {
    const rendererView = this.#rendererViewsList[viewIndex];
    if (rendererView) {
      rendererView.imageDirty = true;
    }
  }


  /**
   * Sets whether the WebGLRenderer draws edges.
   * Triggers a new frame render.
   * @internal
   */
  setEdgesEnabled(viewIndex: number, enabled: boolean): void {
    const rendererView = this.#rendererViewsList[viewIndex];
    if (rendererView) {
      rendererView.edgesEnabled = enabled;
      rendererView.imageDirty = true;
    }
  }

  /**
   * Sets whether the WebGLRenderer draws with physically-based rendering.
   * Triggers a new frame render.
   * @internal
   */
  setPBREnabled(viewIndex: number, enabled: boolean): void {
    const rendererView = this.#rendererViewsList[viewIndex];
    if (rendererView) {
      rendererView.pbrEnabled = enabled;
      rendererView.imageDirty = true;
    }
  }


  getSAOSupported(): boolean {
    return true;
    //return isSafari && WEBGL_INFO.SUPPORTED_EXTENSIONS["OES_standard_derivatives"];
  }

  /**
   * Sets whether the WebGLRenderer draws with SAO.
   * Triggers a new frame render.
   * @internal
   */
  setSAOEnabled(viewIndex: number, enabled: boolean): void {
    const rendererView = this.#rendererViewsList[viewIndex];
    if (rendererView) {
      rendererView.saoEnabled = enabled;
      rendererView.imageDirty = true;
    }
  }

  /**
   * Enable/disable rendering of transparent objects for the given View.
   *
   * @param viewIndex Handle to the View, returned earlier by {@link webglrenderer!WebGLRenderer.attachView | Renderer.attachView}.
   * @param enabled Whether to enable or disable transparent objects for the View.
   * @internal
   * @returns *void*
   * * Success.
   * @returns *{@link core!SDKError | SDKError}*
   * * No View is currently attached to this Renderer.
   * * Can't find a View attached to this Renderer with the given handle.
   */
  setTransparentEnabled(viewIndex: number, enabled: boolean): void {
    const rendererView = this.#rendererViewsList[viewIndex];
    if (rendererView) {
      rendererView.transparentEnabled = enabled;
      rendererView.imageDirty = true;
    }
  }

  /**
   * Clears this WebGLRenderer for the given view.
   *
   * @internal
   * @param viewIndex Handle to the View, returned earlier by {@link webglrenderer!WebGLRenderer.attachView | Renderer.attachView}.
   * @returns *void*
   * * Success.
   * @returns *{@link core!SDKError | SDKError}*
   * * No View is currently attached to this WebGLRenderer.
   * * Can't find a View attached to this WebGLRenderer with the given handle.
   */
  clear(viewIndex: number): void | SDKError {
    if (!this.#renderContext) {
      return new SDKError("Can't clear canvas with WebGLRenderer - no Viewer and View is attached");
    }
    const rendererView = this.#rendererViewsList[viewIndex];
    if (!rendererView) {
      return new SDKError(`Can't clear canvas with WebGLRenderer - no View attached at given viewIndex: ${viewIndex}`);
    }
    const gl = this.#renderContext.gl;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    if (rendererView.canvasTransparent) {
      gl.clearColor(0, 0, 0, 0);
    } else {
      gl.clearColor(rendererView.view.backgroundColor[0], rendererView.view.backgroundColor[1], rendererView.view.backgroundColor[2], 1.0);
    }
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  };

  /**
   * Triggers a rebuild of the shaders within this WebGLRenderer for the given View.
   * @internal
   * @param viewIndex Handle to the View, returned earlier by {@link webglrenderer!WebGLRenderer.attachView | Renderer.attachView}.
   * @returns *void*
   * * Success.
   * @returns *{@link core!SDKError | SDKError}*
   * * No View is currently attached to this WebGLRenderer.
   * * Can't find a View attached to this WebGLRenderer with the given handle.
   */
  setNeedsRebuild(viewIndex?: number): void {
    this.#needsRebuild = true;
  }

  /**
   * Gets if a new frame needs to be rendered for the given View.
   * @internal
   * @param viewIndex Handle to the View, returned earlier by {@link webglrenderer!WebGLRenderer.attachView | Renderer.attachView}.
   * @returns *boolean*
   * * True if a new frame needs to be rendered for the View.
   * @returns *{@link core!SDKError | SDKError}*
   * * No View is currently attached to this WebGLRenderer.
   * * Can't find a View attached to this WebGLRenderer with the given handle.
   */
  getNeedsRender(viewIndex?: number): boolean {
    const rendererView = this.#rendererViewsList[viewIndex];
    if (!rendererView) {
      return false;
    }
    return (rendererView.imageDirty || this.#layerListDirty || this.#stateSortDirty);
  }


  /**
   * Renders a frame for a View.
   *
   * @internal
   * @param viewIndex Handle to the View.
   * @param params
   * @param [params.force=false] True to force a render, else only render if needed.
   * @returns *{@link core!SDKError | SDKError}*
   * * No View is currently attached to this Renderer.
   * * Can't find a View attached to this Renderer with the given handle.
   */
  render(viewIndex: number,
         params?: {
           force?: boolean;
           opaqueOnly?: boolean
         }): void | SDKError {
    if (!this.#renderContext) {
      return new SDKError("Can't render with WebGLRenderer - no Viewer attached");
    }
    const rendererView = this.#rendererViewsList[viewIndex];
    if (!rendererView) {
      return new SDKError(`Can't render with WebGLRenderer - no View attached at given viewIndex: ${viewIndex}`);
    }
    this.renderStats.reset();
    if (this.#needsRebuild) {
      this.onCompiled.dispatch(this, true);
      this.#needsRebuild = false;
    }
    // params = params || {};
    if (params.force) {
      rendererView.imageDirty = true;
    }
    this.#updateLayerList();
    if (rendererView.imageDirty) {
      this.#activateView(viewIndex);
      this.#draw({
        viewIndex,
        clear: true
      });
      rendererView.imageDirty = false;
    }
  }

  #activateView(viewIndex: number) {
    const rendererView = this.#rendererViewsList[viewIndex];
    if (!rendererView) {
      throw new SDKError(`Can't activate View - no such target View attached: ${viewIndex}`);
    }
    const activeRendererView = this.#activeRendererView;
    if (activeRendererView) {
      const activeCanvasBoundingRect = activeRendererView.view.htmlElement.getBoundingClientRect();
      const primarySnapshotBuffer = activeRendererView.renderBufferManager.getRenderBuffer("snapshot", {
        depthTexture: false,
        size: [activeCanvasBoundingRect.width, activeCanvasBoundingRect.height]
      });
      primarySnapshotBuffer.bind();
      primarySnapshotBuffer.clear();
      this.#draw({
        viewIndex: activeRendererView.view.viewIndex,
        clear: true
      });
      const image = primarySnapshotBuffer.readImage({
        format: "png",
        height: activeCanvasBoundingRect.height,
        width: activeCanvasBoundingRect.width
      });
      primarySnapshotBuffer.unbind();
      (<HTMLImageElement>activeRendererView.view.htmlElement).src = image;
    }

    const webglCanvasElement = this.#webglCanvasElement;

    const view = rendererView.view;
    const htmlElement = view.htmlElement;
    const boundingRect = htmlElement.getBoundingClientRect();

    webglCanvasElement.style["left"] = `${boundingRect.left}px`;
    webglCanvasElement.style["top"] = `${boundingRect.top}px`;
    webglCanvasElement.style["width"] = `${boundingRect.width}px`;
    webglCanvasElement.style["height"] = `${boundingRect.height}px`;
    webglCanvasElement.width = boundingRect.width;
    webglCanvasElement.height = boundingRect.height;
    webglCanvasElement.style["z-index"] = 100000;

    this.#activeRendererView = rendererView;
  }

  #updateLayerList(): void {
    if (this.#layerListDirty) {
      this.#buildLayerList();
      this.#stateSortDirty = true;
    }
    if (this.#stateSortDirty) {
      this.#sortLayerList();
      this.#stateSortDirty = false;
      for (let viewIndex = 0, len = this.#rendererViewsList.length; viewIndex < len; viewIndex++) {
        const rendererView = this.#rendererViewsList[viewIndex];
        rendererView.imageDirty = true;
      }
    }
  }

  #buildLayerList(): void {
    this.#layerList = Object.values(this.#layers);
  }

  #sortLayerList(): void {
    this.#layerList.sort((layer1, layer2) => {
      if (layer1.sortId < layer2.sortId) {
        return -1;
      }
      if (layer1.sortId > layer2.sortId) {
        return 1;
      }
      return 0;
    });
  }

  #draw(params: {
    viewIndex: number,
    clear: boolean;
  }) {
    const rendererView = this.#rendererViewsList[params.viewIndex];
    if (!rendererView) {
      return;
    }
    this.#activateExtensions();
    if (rendererView.view.sao.applied) {
      //      this.#drawSAOBuffers(params);
    }
    this.#drawColor(params);
  }

  #activateExtensions() {
    if (WEBGL_INFO.SUPPORTED_EXTENSIONS["OES_element_index_uint"]) {
      this.#extensionHandles.OES_element_index_uint = this.#renderContext.gl.getExtension("OES_element_index_uint");
    }
    if (this.#logarithmicDepthBufferEnabled && WEBGL_INFO.SUPPORTED_EXTENSIONS["EXT_frag_depth"]) {
      this.#extensionHandles.EXT_frag_depth = this.#renderContext.gl.getExtension('EXT_frag_depth');
    }
    if (WEBGL_INFO.SUPPORTED_EXTENSIONS["WEBGL_depth_texture"]) {
      this.#extensionHandles.WEBGL_depth_texture = this.#renderContext.gl.getExtension('WEBGL_depth_texture');
    }
  }

  #drawSAOBuffers(params: {
    viewIndex: number,
    clear: boolean;
  }) {

    const viewIndex = params.viewIndex;
    const rendererView = this.#rendererViewsList[viewIndex];
    const view = rendererView.view;
    const sao = view.sao;

    // Render depth buffer

    const depthRenderBuffer = rendererView.renderBufferManager.getRenderBuffer("saoDepth", {
      depthTexture: WEBGL_INFO.SUPPORTED_EXTENSIONS["WEBGL_depth_texture"]
    });
    depthRenderBuffer.bind();
    depthRenderBuffer.clear();
    this.#drawDepth(params);
    depthRenderBuffer.unbind();

    // Render occlusion buffer

    const occlusionRenderBuffer1 = rendererView.renderBufferManager.getRenderBuffer("saoOcclusion");
    occlusionRenderBuffer1.bind();
    occlusionRenderBuffer1.clear();

    this.#saoOcclusionRenderer.render({
      view,
      depthRenderBuffer
    });
    occlusionRenderBuffer1.unbind();

    if (sao.blur) {

      // Horizontally blur occlusion buffer 1 into occlusion buffer 2

      const occlusionRenderBuffer2 = rendererView.renderBufferManager.getRenderBuffer("saoOcclusion2");
      occlusionRenderBuffer2.bind();
      occlusionRenderBuffer2.clear();

      this.#saoDepthLimitedBlurRenderer.render({
        view,
        depthRenderBuffer,
        occlusionRenderBuffer: occlusionRenderBuffer1,
        direction: 0
      });
      occlusionRenderBuffer2.unbind();

      // Vertically blur occlusion buffer 2 back into occlusion buffer 1

      occlusionRenderBuffer1.bind();
      occlusionRenderBuffer1.clear();

      this.#saoDepthLimitedBlurRenderer.render({
        view,
        depthRenderBuffer,
        occlusionRenderBuffer: occlusionRenderBuffer2,
        direction: 1
      });
      occlusionRenderBuffer1.unbind();
    }
  }

  #drawDepth(params: {
    viewIndex: number,
    clear: boolean;
  }) {
    const viewIndex = params.viewIndex;
    const rendererView = this.#rendererViewsList[viewIndex];
    const view = rendererView.view;
    const renderContext = this.#renderContext;
    const gl = renderContext.gl;

    renderContext.reset();
    renderContext.view = view;

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.frontFace(gl.CCW);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);

    if (params.clear !== false) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    for (let i = 0, len = this.#layerList.length; i < len; i++) {
      const layer = this.#layerList[i];
      const meshCounts = layer.meshCounts[viewIndex];
      if (meshCounts.numTransparent < meshCounts.numMeshes) { // Only draw opaque objects in depth pass
        layer.drawDepth();
      }
    }

    // const numVertexAttribs = WEBGL_INFO.MAX_VERTEX_ATTRIBS; // Fixes https://github.com/xeokit/xeokit-sdk/issues/174
    // for (let ii = 0; ii < numVertexAttribs; ii++) {
    //     gl.disableVertexAttribArray(ii);
    // }
  }

  /**
   * Renders color passes for the current frame view.
   * Batches opaque, translucent, x-ray, highlighted, and selected drawing into discrete bins
   * to minimize state changes and maintain performance.
   */
  #drawColor(params: { viewIndex: number; clear: boolean }): void {
    const {viewIndex, clear} = params;
    const rendererView = this.#rendererViewsList[viewIndex];
    const view = rendererView.view;
    const gl = this.#renderContext.gl;
    const ctx = this.#renderContext;

    const bins = {
      normalDrawSAO: [] as Layer[],
      edgesColorOpaque: [] as Layer[],
      normalFillTransparent: [] as Layer[],
      edgesColorTransparent: [] as Layer[],
      xrayedSilhouetteOpaque: [] as Layer[],
      xrayEdgesOpaque: [] as Layer[],
      xrayedSilhouetteTransparent: [] as Layer[],
      xrayEdgesTransparent: [] as Layer[],
      highlightedSilhouetteOpaque: [] as Layer[],
      highlightedEdgesOpaque: [] as Layer[],
      highlightedSilhouetteTransparent: [] as Layer[],
      highlightedEdgesTransparent: [] as Layer[],
      selectedSilhouetteOpaque: [] as Layer[],
      selectedEdgesOpaque: [] as Layer[],
      selectedSilhouetteTransparent: [] as Layer[],
      selectedEdgesTransparent: [] as Layer[]
    };

    ctx.reset();
    ctx.view = view;
    ctx.pbrEnabled = rendererView.pbrEnabled;

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    const bg = rendererView.canvasTransparent ? [0, 0, 0, 0] : [...view.backgroundColor, 1];
    gl.clearColor(bg[0], bg[1], bg[2], bg[3]);
    gl.enable(gl.DEPTH_TEST);
    gl.frontFace(gl.CCW);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.lineWidth(1);
    ctx.lineWidth = 1;

    const drawWithSAO = rendererView.saoEnabled && view.sao.possible;
    ctx.saoOcclusionTexture = drawWithSAO
      ? rendererView.renderBufferManager.getRenderBuffer("saoOcclusion")?.getTexture() ?? null
      : null;

    if (clear !== false) gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const edgeMat = view.edges;
    const hlMat = view.highlightMaterial;
    const slMat = view.selectedMaterial;
    const xrMat = view.xrayMaterial;

    for (let i = 0, len = this.#layerList.length; i < len; i++) {
      const layer = this.#layerList[i];
      const counts = layer.meshCounts[viewIndex];

      if (counts.numVisible === 0 || counts.numCulled === counts.numMeshes) continue;

      const opaque = counts.numTransparent < counts.numMeshes;
      const trans = counts.numTransparent > 0;
      const xr = counts.numXRayed > 0;
      const hl = counts.numHighlighted > 0;
      const sl = counts.numSelected > 0;

      if (opaque) {
        if (drawWithSAO && layer.saoSupported) bins.normalDrawSAO.push(layer);
        else layer.drawColorOpaque();
      }

      if (rendererView.transparentEnabled && trans) bins.normalFillTransparent.push(layer);

      if (xr && xrMat.fill) (xrMat.fillAlpha < 1.0 ? bins.xrayedSilhouetteTransparent : bins.xrayedSilhouetteOpaque).push(layer);
      if (hl && hlMat.fill) (hlMat.fillAlpha < 1.0 ? bins.highlightedSilhouetteTransparent : bins.highlightedSilhouetteOpaque).push(layer);
      if (sl && slMat.fill) (slMat.fillAlpha < 1.0 ? bins.selectedSilhouetteTransparent : bins.selectedSilhouetteOpaque).push(layer);

      if (rendererView.edgesEnabled && edgeMat.applied) {
        if (opaque) bins.edgesColorOpaque.push(layer);
        if (trans) bins.edgesColorTransparent.push(layer);
        (slMat.edgeAlpha < 1.0 ? bins.selectedEdgesTransparent : bins.selectedEdgesOpaque).push(layer);
        if (xr) (xrMat.edgeAlpha < 1.0 ? bins.xrayEdgesTransparent : bins.xrayEdgesOpaque).push(layer);
        (hlMat.edgeAlpha < 1.0 ? bins.highlightedEdgesTransparent : bins.highlightedEdgesOpaque).push(layer);
      }
    }

    // Draw Opaque
    for (let i = 0; i < bins.normalDrawSAO.length; i++) bins.normalDrawSAO[i].drawColorSAOOpaque();
    for (let i = 0; i < bins.edgesColorOpaque.length; i++) bins.edgesColorOpaque[i].drawEdgesColorOpaque();
    for (let i = 0; i < bins.xrayedSilhouetteOpaque.length; i++) bins.xrayedSilhouetteOpaque[i].drawSilhouetteXRayed();
    for (let i = 0; i < bins.xrayEdgesOpaque.length; i++) bins.xrayEdgesOpaque[i].drawEdgesXRayed();

    // Draw Translucent
    if (
      bins.normalFillTransparent.length ||
      bins.edgesColorTransparent.length ||
      bins.xrayedSilhouetteTransparent.length ||
      bins.xrayEdgesTransparent.length
    ) {
      gl.enable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      if (rendererView.canvasTransparent) {
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      } else {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }

      ctx.backfaces = false;
      if (!this.#alphaDepthMask) gl.depthMask(false);

      for (let i = 0; i < bins.xrayEdgesTransparent.length; i++) bins.xrayEdgesTransparent[i].drawEdgesXRayed();
      for (let i = 0; i < bins.xrayedSilhouetteTransparent.length; i++) bins.xrayedSilhouetteTransparent[i].drawSilhouetteXRayed();
      if (bins.edgesColorTransparent.length || bins.normalFillTransparent.length) {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }
      for (let i = 0; i < bins.edgesColorTransparent.length; i++) bins.edgesColorTransparent[i].drawEdgesColorTranslucent();
      for (let i = 0; i < bins.normalFillTransparent.length; i++) bins.normalFillTransparent[i].drawColorTranslucent();

      gl.disable(gl.BLEND);
      if (!this.#alphaDepthMask) gl.depthMask(true);
    }

    // Helper to clear depth and draw silhouette + edges
    const drawSilAndEdges = (
      silBin: Layer[],
      edgesBin: Layer[],
      drawSil: (l: Layer) => void,
      drawEdges: (l: Layer) => void
    ) => {
      if (silBin.length || edgesBin.length) {
        ctx.lastProgramId = -1;
        gl.clear(gl.DEPTH_BUFFER_BIT);
        for (let i = 0; i < edgesBin.length; i++) drawEdges(edgesBin[i]);
        for (let i = 0; i < silBin.length; i++) drawSil(silBin[i]);
      }
    };

    drawSilAndEdges(bins.highlightedSilhouetteOpaque, bins.highlightedEdgesOpaque,
      l => l.drawSilhouetteHighlighted(), l => l.drawEdgesHighlighted());
    drawSilAndEdges(bins.highlightedSilhouetteTransparent, bins.highlightedEdgesTransparent,
      l => l.drawSilhouetteHighlighted(), l => l.drawEdgesHighlighted());
    drawSilAndEdges(bins.selectedSilhouetteOpaque, bins.selectedEdgesOpaque,
      l => l.drawSilhouetteSelected(), l => l.drawEdgesSelected());
    drawSilAndEdges(bins.selectedSilhouetteTransparent, bins.selectedEdgesTransparent,
      l => l.drawSilhouetteSelected(), l => l.drawEdgesSelected());

    // Cleanup GPU state
    for (let i = 0, texUnits = WEBGL_INFO.MAX_TEXTURE_UNITS; i < texUnits; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
    }
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    for (let i = 0, attribs = WEBGL_INFO.MAX_VERTEX_ATTRIBS; i < attribs; i++) {
      gl.disableVertexAttribArray(i);
    }
  }


  /**
   * TODO
   * @internal
   */
  pick(viewIndex: number,
       pickParams: PickParams,
       pickResult = this.#pickResult): PickResult | null {

    if (!this.#renderContext) {
      throw new SDKError("Can't pick object with WebGLRenderer - no Viewer and View is attached");
    }

    const rendererView = this.#rendererViewsList[viewIndex];
    if (!rendererView) {
      throw new SDKError(`Can't pick object with WebGLRenderer - no View attached at given viewIndex: ${viewIndex}`);
    }

    const view = rendererView.view;
    const camera = view.camera;

    if (this.#needsRebuild) {
      this.onCompiled.dispatch(this, true);
      this.#needsRebuild = false;
    }

    this.#updateLayerList();

    pickResult.reset();

    const {
      pickCanvasPos,
      pickViewMatrix,
      pickProjMatrix,
      pickWorldRayOrigin,
      pickWorldRayDir
    } = pickTemps;

    if (pickParams.canvasPos) {

      // @ts-ignore
      pickCanvasPos.set(pickParams.canvasPos);
      // @ts-ignore
      pickViewMatrix.set(camera.viewMatrix);
      // @ts-ignore
      pickProjMatrix.set(camera.projMatrix);

      pickResult.canvasPos = pickParams.canvasPos;

    } else {

      // Picking with arbitrary World-space ray
      // Align camera along ray and fire ray through center of canvas

      pickCanvasPos[0] = view.htmlElement.clientWidth * 0.5;
      pickCanvasPos[1] = view.htmlElement.clientHeight * 0.5;

      if (pickParams.rayMatrix) {

        // Ray defined using matrix

        // @ts-ignore
        pickViewMatrix.set(params.rayMatrix);
        // @ts-ignore
        pickProjMatrix.set(camera.projMatrix);

      } else {

        // Ray defined as origin and direction

        // @ts-ignore
        pickWorldRayOrigin.set(pickParams.rayOrigin || [0, 0, 0]);
        // @ts-ignore
        pickWorldRayDir.set(pickParams.rayDirection || [0, 1, 0]);
        const look = addVec3(pickWorldRayOrigin, pickWorldRayDir, tempVec3a);
        tempVec3b[0] = Math.random();
        tempVec3b[1] = Math.random();
        tempVec3b[2] = Math.random();
        normalizeVec3(tempVec3b);
        cross3Vec3(pickWorldRayDir, tempVec3b, tempVec3c);
        // @ts-ignore
        pickViewMatrix.set(lookAtMat4v(pickWorldRayOrigin, look, tempVec3c, tempMat4b));
        // @ts-ignore
        pickProjMatrix.set(camera.orthoProjection.projMatrix);

        pickResult.origin = pickWorldRayOrigin;
        pickResult.direction = pickWorldRayDir;
      }
    }

    if (pickParams.pickViewObject || pickParams.pickSurface) {

      // Pick a ViewObject

      const rendererMesh = this.#pickMesh({
        rendererView,
        pickCanvasPos,
        pickViewMatrix,
        pickProjMatrix,
        pickInvisible: !!pickParams.pickInvisible
      });

      if (rendererMesh) {

        const rendererObject = rendererMesh.rendererObject;
        const view = rendererView.view;

        pickResult.viewObject = view.objects[rendererObject.id];

        if (pickParams.pickSurface) {

          // Pick 3D position on surface of ViewObject

          const worldPos = this.#pickWorldPos({
            rendererView,
            rendererMesh,
            pickCanvasPos,
            pickViewMatrix,
            pickProjMatrix,
            pickInvisible: pickParams.pickInvisible
          });

          if (worldPos) {
            pickResult.worldPos = worldPos;
          }
        }
      }
    }

    return pickResult;
  };

  #pickMesh(
    params: {
      rendererView: WebGLRendererView,
      pickCanvasPos: FloatArrayParam,
      pickViewMatrix: FloatArrayParam,
      pickProjMatrix: FloatArrayParam,
      pickInvisible: boolean
    }): WebGLRendererMesh {

    const {rendererView, pickCanvasPos, pickProjMatrix, pickViewMatrix, pickInvisible} = params;

    const view = rendererView.view;
    const viewIndex = view.viewIndex;
    const boundingRect = rendererView.view.htmlElement.getBoundingClientRect();
    const resolutionScale = view.resolutionScale;
    const renderContext = this.#renderContext;
    const gl = renderContext.gl;
    const pickBuffer = this.#pickBufferManager.getRenderBuffer("pickMesh", {
      depthTexture: false,
      size: [1, 1]
    });
    pickBuffer.bind();
    pickBuffer.clear();
    renderContext.reset();
    renderContext.backfaces = true;
    renderContext.frontface = true; // "ccw"
    renderContext.pickViewMatrix = pickViewMatrix;
    renderContext.pickProjMatrix = pickProjMatrix;
    renderContext.pickInvisible = !!pickInvisible;
    renderContext.pickClipPos = [
      this.#getClipPosX(pickCanvasPos[0] * resolutionScale.resolutionScale, gl.drawingBufferWidth),
      this.#getClipPosY(pickCanvasPos[1] * resolutionScale.resolutionScale, gl.drawingBufferHeight)
    ];
    gl.viewport(0, 0, 1, 1);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    for (let i = 0, len = this.#layerList.length; i < len; i++) {
      const layer = this.#layerList[i];
      const meshCounts = layer.meshCounts[viewIndex];
      if (meshCounts.numPickable < meshCounts.numMeshes ||
        meshCounts.numCulled === meshCounts.numMeshes ||
        meshCounts.numVisible === 0) {
        continue;
      }
      layer.drawPickMesh();
    }
    const pix = pickBuffer.read(0, 0);
    const pickID = pix[0] + (pix[1] << 8) + (pix[2] << 16) + (pix[3] << 24);
    pickBuffer.unbind();
    if (pickID < 0) {
      return null;
    }
    return <WebGLRendererMesh>this.#pickIDs.items[pickID];
  }

  #pickWorldPos(
    params: {
      rendererView: WebGLRendererView,
      pickCanvasPos: FloatArrayParam,
      pickViewMatrix: FloatArrayParam,
      pickProjMatrix: FloatArrayParam,
      pickInvisible: boolean,
      rendererMesh: WebGLRendererMesh
    }): FloatArrayParam | null {

    const {rendererView, rendererMesh, pickCanvasPos, pickProjMatrix, pickViewMatrix} = params;
    const view = rendererView.view;
    const resolutionScale = view.resolutionScale;
    const layer = rendererMesh.layer;
    const renderContext = this.#renderContext;
    const gl = renderContext.gl;
    const canvas = rendererView.view.htmlElement;
    const boundingRect = canvas.getBoundingClientRect();
    const pickBuffer = rendererView.renderBufferManager.getRenderBuffer("pickDepth", {
      depthTexture: true,
      size: [1, 1]
    });
    pickBuffer.bind();
    pickBuffer.clear();
    renderContext.reset();
    renderContext.backfaces = true;
    renderContext.frontface = true; // "ccw"
    renderContext.pickViewMatrix = pickViewMatrix;
    renderContext.pickProjMatrix = pickProjMatrix;
    renderContext.pickInvisible = !!params.pickInvisible;
    renderContext.pickClipPos = [
      this.#getClipPosX(params.pickCanvasPos[0] * resolutionScale.resolutionScale, gl.drawingBufferWidth),
      this.#getClipPosY(params.pickCanvasPos[1] * resolutionScale.resolutionScale, gl.drawingBufferHeight)
    ];

    gl.viewport(0, 0, 1, 1);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    layer.drawPickDepths();

    const pix = pickBuffer.read(0, 0);

    pickBuffer.unbind();

    const screenZ = this.#unpackDepth(pix); // Get screen-space Z at the given canvas coords

    // Calculate clip space coordinates, which will be in range of x=[-1..1] and y=[-1..1], with y=(+1) at top

    const x = (pickCanvasPos[0] - canvas.clientWidth / 2) / (canvas.clientWidth / 2);
    const y = -(pickCanvasPos[1] - canvas.clientHeight / 2) / (canvas.clientHeight / 2);

    // Ensure that unprojection matrix is in RTC space if needed

    const origin = rendererMesh.tile.center;
    const gotOrigin = (origin[0] !== 0 && origin[1] !== 0 && origin[2] !== 0);
    let pvMat = gotOrigin
      ? mulMat4(pickProjMatrix, createRTCViewMat(pickViewMatrix, origin, tempMat4a), tempMat4b)
      : mulMat4(pickProjMatrix, pickViewMatrix, tempMat4b);

    const pvMatInverse = inverseMat4(pvMat, tempMat4c);

    tempVec4a[0] = x;
    tempVec4a[1] = y;
    tempVec4a[2] = -1;
    tempVec4a[3] = 1;

    let world1 = transformVec4(pvMatInverse, tempVec4a);
    world1 = mulVec4Scalar(world1, 1 / world1[3]);

    tempVec4b[0] = x;
    tempVec4b[1] = y;
    tempVec4b[2] = 1;
    tempVec4b[3] = 1;

    let world2 = transformVec4(pvMatInverse, tempVec4b);
    world2 = mulVec4Scalar(world2, 1 / world2[3]);

    const dir = subVec3(world2, world1, tempVec4c);
    const worldPos = addVec3(world1, mulVec4Scalar(dir, screenZ, tempVec4d), tempVec4e);

    if (gotOrigin) {
      addVec3(worldPos, origin);
    }
    console.log(worldPos);
    return worldPos;
  }

  #unpackDepth(depthZ) {
    const vec = [depthZ[0] / 256.0, depthZ[1] / 256.0, depthZ[2] / 256.0, depthZ[3] / 256.0];
    const bitShift = [1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0];
    return 1.0 - dotVec4(vec, bitShift);
  }

  #getClipPosX(pos: number, size: number) {
    return 2 * (pos / size) - 1;
  }

  #getClipPosY(pos: number, size: number) {
    return 1 - 2 * (pos / size);
  }

  beginSnapshot(viewIndex: number, params?: {
    width: number,
    height: number
  }) {
    // const rendererView = this.#rendererViewsList[viewIndex];
    // if (!rendererView) {
    //     throw new SDKError(`Can't begin snapshot with WebGLRenderer.beginSnapshot() - no View attached at given viewIndex: ${viewIndex}`);
    // }
    // const snapshotBuffer = rendererView.renderBufferManager.getRenderBuffer("snapshot");
    // if (params && params.width && params.height) {
    //     snapshotBuffer.setSize([params.width, params.height]);
    // }
    // snapshotBuffer.bind();
    // snapshotBuffer.clear();
    // this.#snapshotBound = true;
  }

  renderSnapshot() {
    // const rendererView = this.#rendererViewsList[viewIndex];
    // if (!rendererView) {
    //     throw new SDKError(`Can't render snapshot with WebGLRenderer.renderSnapshot() - no View attached at given viewIndex: ${viewIndex}`);
    // }
    // if (!this.#snapshotBound) {
    //     return;
    // }
    // const snapshotBuffer = rendererView.renderBufferManager.getRenderBuffer("snapshot");
    // snapshotBuffer.clear();
    // this.render(viewIndex, {
    //     force: true,
    //     opaqueOnly: false
    // });
    // rendererView.imageDirty = true;
  }

  readSnapshot(): string {
    // const rendererView = this.#rendererViewsList[viewIndex];
    // if (!rendererView) {
    //     throw new SDKError(`Can't read snapshot with WebGLRenderer.readSnapshot() - no View attached at given viewIndex: ${viewIndex}`);
    // }
    // if (!this.#snapshotBound) {
    //     return;
    // }
    // const snapshotBuffer = rendererView.renderBufferManager.getRenderBuffer("snapshot");
    // return snapshotBuffer.readImage(params);
    return "";
  }

  readSnapshotAsCanvas(): HTMLCanvasElement {
    // const rendererView = this.#rendererViewsList[viewIndex];
    // if (!rendererView) {
    //     throw new SDKError(`Can't read snapshot with WebGLRenderer.readSnapshotAsCanvas() - no View attached at given viewIndex: ${viewIndex}`);
    // }
    // if (!this.#snapshotBound) {
    //     return;
    // }
    // const snapshotBuffer = rendererView.renderBufferManager.getRenderBuffer("snapshot");
    // return snapshotBuffer.readImageAsCanvas();
    return null;
  }

  /**
   * Exits snapshot mode.
   *
   * Switches rendering back to the main canvas.
   */
  endSnapshot() {
    // const rendererView = this.#rendererViewsList[viewIndex];
    // if (!rendererView) {
    //     throw new SDKError(`Can't end snapshot with WebGLRenderer.endSnapshot() - no View attached at given viewIndex: ${viewIndex}`);
    // }
    // if (!this.#snapshotBound) {
    //     return;
    // }
    // const snapshotBuffer = rendererView.renderBufferManager.getRenderBuffer("snapshot");
    // snapshotBuffer.unbind();
    this.#snapshotBound = false;
  }

  destroy() {
    if (this.#destroyed) {
      return;
    }
    this.detachViewer();
    for (let i = 0, len = this.#layerList.length; i < len; i++) {
      this.#layerList[i].destroy();
    }
    for (let layerId in this.#layers) {
      this.#layers[layerId].destroy();
    }
    this.#layers = {};
    this.#layerList = [];
    this.#saoOcclusionRenderer.destroy();
    this.#saoDepthLimitedBlurRenderer.destroy();
    this.#pickBufferManager.destroy();
    this.#destroyed = true;
    this.onDestroyed.dispatch(this, true);
  }

}
