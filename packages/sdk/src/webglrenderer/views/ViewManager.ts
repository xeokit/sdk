import {RenderContext} from "../RenderContext";
import {View} from "../../viewer";
import {SDKError} from "../../core";
import {RendererView} from "./RendererView";
import {DrawManager} from "../draw/DrawManager";

/**
 * Manages the views in the WebGLRenderer.
 */
export class ViewManager {

  private _onViewCreated: any;
  private _onViewDestroyed: any;

  private _renderContext: RenderContext;
  private _rendererViews: Record<string, RendererView> = {};
  private _rendererViewsList: RendererView[] = [];
  private _activeRendererView: RendererView;
  private _drawManager: DrawManager;

  /**
   * Initializes the ViewManager with the given rendering context.
   */
  constructor(renderContext: RenderContext, drawManager: DrawManager) {
    this._renderContext = renderContext;
    this._drawManager = drawManager;
    const viewer = renderContext.viewer;
    for (let viewIndex = 0; viewIndex < viewer.numViews; viewIndex++) {
      this._attachView(viewer.viewList[viewIndex]);
    }
    this._onViewCreated = viewer.onViewCreated.subscribe((_, view) => {
      this._attachView(view);
    });
    this._onViewDestroyed = viewer.onViewDestroyed.subscribe((_, view) => {
      this._detachView(view);
    });
  }

  /**
   * Attaches a view to the renderer.
   * Throws an error if the view is already attached.
   */
  private _attachView(view: View): RendererView {
    if (this._rendererViews[view.id]) {
      throw new SDKError("Can't attach additional View to WebGLRenderer - View already attached");
    }
    const rendererView = new RendererView(this,
      this._renderContext.gl, this._renderContext.webglCanvasElement, view);
    this._rendererViews[view.id] = rendererView;
    view.viewIndex = this._rendererViewsList.length;
    this._rendererViewsList.push(rendererView);
    return rendererView;
  }

  /**
   * Detaches a view from the renderer.
   */
  private _detachView(view: View): void {
    const rendererView = this._rendererViews[view.id];
    if (!rendererView) {
      throw new SDKError("[WebGLRenderer] View is not attached");
    }
    rendererView.destroy();
    delete this._rendererViews[view.id];
  }

  /**
   * Returns the list of RendererView instances.
   */
  rendererViews(): RendererView[] {
    return this._rendererViewsList;
  }

  /**
   * @internal
   */
  activateRendererView(viewIndex: number) {
    const rendererView = this.rendererViews[viewIndex];
    if (!rendererView) {
      throw new SDKError(`Can't activate View - no such target View attached: ${viewIndex}`);
    }
    const activeRendererView = this._activeRendererView;
    if (activeRendererView) {
      const activeCanvasBoundingRect = activeRendererView.view.htmlElement.getBoundingClientRect();
      const primarySnapshotBuffer = activeRendererView.renderBufferManager.getRenderBuffer("snapshot", {
        depthTexture: false,
        size: [activeCanvasBoundingRect.width, activeCanvasBoundingRect.height]
      });
      primarySnapshotBuffer.bind();
      primarySnapshotBuffer.clear();
      this._drawManager.draw({
        rendererView,
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

    const webglCanvasElement = this._renderContext.webglCanvasElement;

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

    this._activeRendererView = rendererView;
  }

  get activeRendererView(): RendererView {
    return this._activeRendererView;
  }

  draw(viewIndex: number,
         params?: {
           force?: boolean;
           opaqueOnly?: boolean
         }): void | SDKError {
    const rendererView = this._rendererViews[viewIndex];
    if (!rendererView) {
      return new SDKError(`Can't render with WebGLRenderer - no View attached at given viewIndex: ${viewIndex}`);
    }
    // params = params || {};
    if (params.force) {
      rendererView.imageDirty = true;
    }
    if (rendererView.imageDirty) {
      this.activateRendererView(viewIndex);
      this._drawManager.draw({
        rendererView,
        clear: true
      });
      rendererView.imageDirty = false;
    }
  }

  clear(viewIndex: number): void | SDKError {
    const rendererView = this._rendererViews[viewIndex];
    if (!rendererView) {
      return new SDKError(`Can't clear with WebGLRenderer - no View attached at given viewIndex: ${viewIndex}`);
    }
    this.activateRendererView(viewIndex);
    const gl = this._renderContext.gl;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    if (rendererView.canvasTransparent) {
      gl.clearColor(0, 0, 0, 0);
    } else {
      gl.clearColor(rendererView.view.backgroundColor[0], rendererView.view.backgroundColor[1], rendererView.view.backgroundColor[2], 1.0);
    }
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }


  /**
   * Cleans up resources and destroys the ViewManager.
   */
  destroy(): void {
    const viewer = this._renderContext.viewer;
    for (let viewIndex = 0; viewIndex < viewer.numViews; viewIndex++) {
      this._detachView(viewer.viewList[viewIndex]);
    }
    this._onViewCreated();
    this._onViewDestroyed();
    this._rendererViews = {};
  }
}
