import {View} from "../../viewer";
import {RenderBufferManager} from "./RenderBufferManager";
import {Map} from "../../utils";
import {ViewManager} from "./ViewManager";
import {RenderContext} from "../RenderContext";
import {RendererView} from "../../viewer/RendererView";


/** @private */
export class RendererViewImpl implements RendererView {

  view: View;
  gl: WebGL2RenderingContext;
  renderBufferManager: RenderBufferManager;
  pickIDs: Map;

  private _active: boolean;
  private _transparencyEnabled: boolean;
  private _canvasTransparent: boolean;
  private _saoEnabled: boolean;
  private _edgesEnabled: boolean;
  private _transparentEnabled: boolean;
  private _pbrEnabled: boolean;

  saveCanvasBoundary: DOMRect;
  private viewManager: ViewManager;
  private _renderContext: RenderContext;

  constructor( viewManager: ViewManager, renderContext: RenderContext, view: View ) {
    this.viewManager = viewManager;
    this.gl = renderContext.gl;
    this._renderContext = renderContext;
    this.view = view;
    this._active = false;
    this._transparencyEnabled = true;
    this.needsRender();
    this._canvasTransparent = false;
    this._pbrEnabled = false;
    this._saoEnabled = false;
    this._edgesEnabled = true;
    this._transparentEnabled = true;
    this.saveCanvasBoundary = view.htmlElement.getBoundingClientRect();
    this.renderBufferManager = new RenderBufferManager(renderContext.gl, renderContext.webglCanvasElement);
    this.pickIDs = new Map({});
  }

  activate() {
    if (this._active) {
      return;
    }
    this._active = true;
    this.viewManager.activateView(this);
  }

  needsRender(): void {
    this._renderContext.viewFlags[this.view.viewIndex].needsRender = true;
  }

  get transparencyEnabled(): boolean {
    return this._transparencyEnabled;
  }

  set transparencyEnabled( value: boolean ) {
    this._transparencyEnabled = value;
    this.needsRender();
  }

  get canvasTransparent(): boolean {
    return this._canvasTransparent;
  }

  set canvasTransparent( value: boolean ) {
    this._canvasTransparent = value;
    this.needsRender();
  }

  get saoEnabled(): boolean {
    return this._saoEnabled;
  }

  set saoEnabled( value: boolean ) {
    this._saoEnabled = value;
    this.needsRender();
  }

  get edgesEnabled(): boolean {
    return this._edgesEnabled;
  }

  set edgesEnabled( value: boolean ) {
    this._edgesEnabled = value;
    this.needsRender();
  }

  get transparentEnabled(): boolean {
    return this._transparentEnabled;
  }

  set transparentEnabled( value: boolean ) {
    this._transparentEnabled = value;
    this.needsRender();
  }

  get pbrEnabled(): boolean {
    return this._pbrEnabled;
  }

  set pbrEnabled( value: boolean ) {
    this._pbrEnabled = value;
    this.needsRender();
  }

  render( params?: {force?: boolean; opaqueOnly?: boolean} ): void {
    const viewFlags = this._renderContext.viewFlags[this.view.viewIndex];
    if (!viewFlags) {
      console.warn("View flags not found for the current view index.");
      return;
    }
    const shouldRender = params?.force || viewFlags.needsRender;
 //   if (shouldRender) {
      this.activate();
      this.viewManager.renderView(this, params);
      viewFlags.needsRender = false;
   // }
  }

  clear() {
    this.activate();
    this.viewManager.clearView(this);
  }

  destroy() {
    this.renderBufferManager.destroy();
  }

  // Add here?
  beginSnapshot( params?: {width: number; height: number} ) {
  }
}
