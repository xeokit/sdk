import {RenderContext} from "../RenderContext";
import {PickParams, PickResult, View} from "../../viewer";
import {SDKError} from "../../core";
import {RendererViewImpl} from "./RendererViewImpl";
import {RenderManager} from "../render/RenderManager";
import {RendererView} from "../../viewer/RendererView";
import {PickManager} from "../pick/PickManager";

/**
 * Manages the views in the WebGLRenderer.
 */
export class ViewManager {

  private _onViewCreated: any;
  private _onViewDestroyed: any;
  private _renderContext: RenderContext;
  private _rendererViews: Record<string, RendererViewImpl> = {};
  private _rendererViewsList: RendererViewImpl[] = [];
  private _activeView: RendererViewImpl;
  private _renderManager: RenderManager;
  private _pickManager: PickManager;

  /**
   * Initializes the ViewManager with the given rendering context.
   */
  constructor(renderContext: RenderContext, renderManager: RenderManager, pickManager: PickManager ) {
    this._renderContext = renderContext;
    this._renderManager = renderManager;
    this._pickManager = pickManager;
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
  private _addView( view: View ): RendererViewImpl {
    if (this._rendererViews[view.id]) {
      throw new SDKError("Can't add additional View to WebGLRenderer - View already added");
    }
    const rendererView = new RendererViewImpl(this, this._renderContext, view);
    this._rendererViews[view.id] = rendererView;
    view.viewIndex = this._rendererViewsList.length;
    view.rendererView = <RendererView>rendererView;
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
   * Returns the list of RendererView instances.
   */
  get rendererViews(): RendererViewImpl[] {
    return this._rendererViewsList;
  }

  /**
   * Called by RendererViewImpl.activate();
   * @internal
   */
  activateView( rendererView: RendererViewImpl ) {
    const activeRendererView = this._activeView;
    if (activeRendererView) {
      const activeCanvasBoundingRect = activeRendererView.view.htmlElement.getBoundingClientRect();
      const primarySnapshotBuffer = activeRendererView.renderBufferManager.getRenderBuffer("snapshot", {
        depthTexture: false,
        size: [activeCanvasBoundingRect.width, activeCanvasBoundingRect.height]
      });
      primarySnapshotBuffer.bind();
      primarySnapshotBuffer.clear();
      this._renderManager.render({rendererView, clear: true});
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
  get activeView(): RendererViewImpl {
    return this._activeView;
  }

  /**
   * Called by RendererViewImpl.render().
   * @internal
   */
  renderView( rendererView: RendererViewImpl, params?: {force?: boolean; opaqueOnly?: boolean} ): void {
    this._renderManager.render({rendererView, clear: true});
  }

  /**
   * Called by RendererViewImpl.pick().
   * @internal
   */
  pickView( rendererView: RendererViewImpl, pickParams: PickParams, pickResult: PickResult ): void {
    this._pickManager.pick(rendererView,pickParams, pickResult);
  }

  /**
   * Called by RendererViewImpl.clear() to clear itself.
   * @internal
   */
  clearView( rendererView: RendererViewImpl ): void {
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
  }
}
