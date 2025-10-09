import {RenderContext} from "../RenderContext";
import { View} from "../../viewer";
import {SDKError} from "../../core";
import {RendererView} from "./RendererView";
import {RenderManager} from "./renderManager/RenderManager";
import {ViewRendererProxy} from "../../viewer/ViewRendererProxy";
import {PickManager} from "./pickManager/PickManager";
import {DTXMemory} from "./dtxMemory/DTXMemory";
import {MeshBatches} from "./meshBatches/MeshBatches";
import {DTXMemoryEditor} from "./dtxMemory/DTXMemoryEditor";
import {DTXMemoryReader} from "./dtxMemory/DTXMemoryReader";

interface RendererViewParent {
  activateView( rendererView: RendererView ) ;
    clearView( rendererView: RendererView ) ;
}

/**
 * Manages the viewManager in the WebGLRenderer.
 */
export class ViewManager implements RendererViewParent {

  private _onViewCreated: any;
  private _onViewDestroyed: any;
  private _renderContext: RenderContext;
  private _rendererViews: Record<string, RendererView> = {};
  private _rendererViewsList: RendererView[] = [];
  private _activeView: RendererView;
  private _renderManager: RenderManager;
  private _pickManager: PickManager;
  private _dtxMemory: DTXMemory;
  private _meshBatches: MeshBatches;

  /**
   * Initializes the ViewManager with the given rendering context.
   */
  constructor(renderContext: RenderContext) {

    this._renderContext = renderContext;

    // DTXMemory manages GPU memory for Mesh geometries, textures and texture sets. It exposes two interfaces:
    // DTXMemoryEditor for uploading updates to GPU memory, and DTXMemoryReader for reading from GPU memory.

    this._dtxMemory = new DTXMemory(this._renderContext);

    // MeshBatches attaches a SceneObjectRendererProxy instance to each SceneObject, through which the SceneObjects can
    // control their visual state (visibility, highlighting, color, x-ray etc.) in the renderer. Likewise,
    // it also attaches a SceneMeshRendererProxy instance to each SceneMesh, through which the SceneMeshes can upload
    // updates to their color, opacity and transformation into the renderer.

    this._meshBatches = new MeshBatches(this._renderContext, this._dtxMemory as DTXMemoryEditor);

    // The RenderManager performs drawing, using the data in MeshBatches and reading from GPU memory via DTXMemoryReader.

    this._renderManager = new RenderManager({
      renderContext: this._renderContext,
      meshBatches: this._meshBatches,
      dtxMemoryReader: this._dtxMemory as DTXMemoryReader
    });

    // The PickManager performs picking, using the data in MeshBatches and reading from GPU memory via DTXMemoryReader.

    this._pickManager = new PickManager({
      renderContext: this._renderContext,
      meshBatches: this._meshBatches,
      dtxMemory: this._dtxMemory
    });

    const viewer = renderContext.viewer;
    for (let viewIndex = 0; viewIndex < viewer.numViews; viewIndex++) {
      this._addView(viewer.viewList[viewIndex]);
    }

    this._onViewCreated = viewer.onViewCreated.subscribe(( _, view ) => {
      this._addView(view);
    });

    this._onViewDestroyed = viewer.onViewDestroyed.subscribe(( _, view ) => {
      this._removeView(view);
    });
  }

  /**
   * Attaches a view to the renderer.
   * Throws an error if the view is already added.
   */
  private _addView( view: View ): RendererView {
    if (this._rendererViews[view.id]) {
      throw new SDKError("Can't add additional View to WebGLRenderer - View already added");
    }
    const rendererView = new RendererView(
        this,
        this._renderContext,
        this._pickManager,
        this._renderManager,
        view);
    this._rendererViews[view.id] = rendererView;
    view.viewIndex = this._rendererViewsList.length;
    view.rendererView = <ViewRendererProxy>rendererView;
    this._rendererViewsList.push(rendererView);
    return rendererView;
  }

  /**
   * Detaches a view from the renderer.
   */
  private _removeView( view: View ): void {
    const rendererView = this._rendererViews[view.id];
    if (!rendererView) {
      throw new SDKError("[WebGLRenderer] View is not added");
    }
    rendererView.destroy();
    view.rendererView = null;
    delete this._rendererViews[view.id];

    //  TODO: Set rendererViewsList dirty
  }

  /**
   * Returns the list of ViewRendererProxy instances.
   */
  get rendererViews(): RendererView[] {
    return this._rendererViewsList;
  }

  /**
   * Called by RendererView.activate();
   *
   * TODO: Move into RendererView
   *
   * @internal
   */
  activateView( rendererView: RendererView ) {
    const activeRendererView = this._activeView;
    if (activeRendererView) {
      const activeCanvasBoundingRect = activeRendererView.view.htmlElement.getBoundingClientRect();
      const primarySnapshotBuffer = activeRendererView.renderBuffers.getRenderBuffer("snapshot", {
        depthTexture: false,
        size: [activeCanvasBoundingRect.width, activeCanvasBoundingRect.height]
      });
      primarySnapshotBuffer.bind();
      primarySnapshotBuffer.clear();
      this._renderManager.render(rendererView, {clear: true});
      const image = primarySnapshotBuffer.readImage({
        format: "png",
        height: activeCanvasBoundingRect.height,
        width: activeCanvasBoundingRect.width
      });
      primarySnapshotBuffer.unbind();
      (<HTMLImageElement>activeRendererView.view.htmlElement).src = image;
    }

    const view = rendererView.view;
    const htmlElement = view.htmlElement;
    const boundingRect = htmlElement.getBoundingClientRect();
    const webglCanvasElement = this._renderContext.webglCanvasElement;

    webglCanvasElement.style["left"] = `${boundingRect.left}px`;
    webglCanvasElement.style["top"] = `${boundingRect.top}px`;
    webglCanvasElement.style["width"] = `${boundingRect.width}px`;
    webglCanvasElement.style["height"] = `${boundingRect.height}px`;
    webglCanvasElement.width = boundingRect.width;
    webglCanvasElement.height = boundingRect.height;
    webglCanvasElement.style["z-tileIndex"] = 100000;

    this._activeView = rendererView;
  }

  /**
   *
   * @internal
   */
  get activeView(): RendererView {
    return this._activeView;
  }

  /**
   * Called by RendererView.clear() to clear itself.
   *
   * TODO: Move into RendererView
   *
   * @internal
   */
  clearView( rendererView: RendererView ): void {
    this.activateView(rendererView);
    const gl = this._renderContext.gl;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    if (rendererView.canvasTransparent) {
      gl.clearColor(0, 0, 0, 0);
    } else {
      gl.clearColor(rendererView.view.backgroundColor[0], rendererView.view.backgroundColor[1], rendererView.view.backgroundColor[2], 1.0);
    }
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }


  destroy(): void {
    const viewer = this._renderContext.viewer;
    for (let viewIndex = 0; viewIndex < viewer.numViews; viewIndex++) {
      this._removeView(viewer.viewList[viewIndex]);
    }
    this._onViewCreated();
    this._onViewDestroyed();
    this._rendererViews = {};

    // Destroy in reverse order of construction
    this._pickManager?.destroy();
    this._renderManager?.destroy();
    this._meshBatches?.destroy();
    this._dtxMemory?.destroy();

    this._pickManager = undefined as unknown as PickManager;
    this._renderManager = undefined as unknown as RenderManager;
    this._meshBatches = undefined as unknown as MeshBatches;
    this._dtxMemory = undefined as unknown as DTXMemory;
    this._renderContext = null;
  }
}
