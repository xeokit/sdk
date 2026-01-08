import {View} from "../../viewer";
import {RenderBuffers} from "./RenderBuffers";
import {RenderContext} from "./RenderContext";
import {PickManager} from "./pickManager/PickManager";
import {RenderManager} from "./renderManager/RenderManager";

/**
 * Represents a view within the WebGL renderer.
 * @internal
 */
export class RendererView {

  view: View;
  renderBuffers: RenderBuffers;
  saveCanvasBoundary: DOMRect;

  private _active: boolean;
  private _renderContext: RenderContext;
  private _pickManager: PickManager;
  private _renderManager: RenderManager;

  constructor(
      renderContext: RenderContext,
      pickManager: PickManager,
      renderManager: RenderManager,
      view: View ) {
    this._renderContext = renderContext;
    this._pickManager = pickManager;
    this._renderManager = renderManager;
    this.view = view;
    this._active = false;
    this.saveCanvasBoundary = view.htmlElement.getBoundingClientRect();
    this.renderBuffers = new RenderBuffers(renderContext, view);
  }

  /**
   * Begins a snapshot operation for the view.
   *
   * @param params Optional snapshot parameters.
   * @param params.width The width of the snapshot.
   * @param params.height The height of the snapshot.
   */
  beginSnapshot( params?: {width: number; height: number} ) {
  }

  destroy() {
    this.renderBuffers?.destroy();
    this.renderBuffers = null;
    this._renderManager=null;
    this._pickManager=null;
  }
}
