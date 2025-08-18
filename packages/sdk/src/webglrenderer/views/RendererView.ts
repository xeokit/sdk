import {View} from "../../viewer";
import {RenderBufferManager} from "./RenderBufferManager";
import {Map} from "../../utils";
import {ViewManager} from "./ViewManager";
import {SDKError} from "../../core";


/** @private */
export class RendererView {
  view: View;
  gl: WebGL2RenderingContext;
  renderBufferManager: RenderBufferManager;
  pickIDs: Map;

  private _active: boolean;
  private _transparencyEnabled: boolean;
  private _imageDirty: boolean;
  private _canvasTransparent: boolean;
  private _saoEnabled: boolean;
  private _edgesEnabled: boolean;
  private _transparentEnabled: boolean;
  private _pbrEnabled: boolean;

  saveCanvasBoundary: DOMRect;
  private viewManager: ViewManager;


  constructor(viewManager: ViewManager, gl: WebGL2RenderingContext, webglCanvasElement: HTMLCanvasElement, view: View) {
    this.viewManager = viewManager;
    this.gl = gl;
    this.view = view;
    this._active = false;
    this._transparencyEnabled = true;
    this._imageDirty = true;
    this._canvasTransparent = false;
    this._pbrEnabled = false;
    this._saoEnabled = false;
    this._edgesEnabled = true;
    this._transparentEnabled = true;
    this.saveCanvasBoundary = view.htmlElement.getBoundingClientRect();
    this.renderBufferManager = new RenderBufferManager(gl, webglCanvasElement);
    this.pickIDs = new Map({});
  }

  activate() {
    if (this._active) {
      return;
    }
    this._active = true;
    this.viewManager.activateView(this.view.viewIndex);
  }

  get imageDirty(): boolean {
    return this._imageDirty;
  }

  set imageDirty(value: boolean) {
    this._imageDirty = value;
  }

  get transparencyEnabled(): boolean {
    return this._transparencyEnabled;
  }

  set transparencyEnabled(value: boolean) {
    this._transparencyEnabled = value;
    this._imageDirty = true;
  }

  get canvasTransparent(): boolean {
    return this._canvasTransparent;
  }

  set canvasTransparent(value: boolean) {
    this._canvasTransparent = value;
    this._imageDirty = true;
  }

  get saoEnabled(): boolean {
    return this._saoEnabled;
  }

  set saoEnabled(value: boolean) {
    this._saoEnabled = value;
    this._imageDirty = true;
  }

  get edgesEnabled(): boolean {
    return this._edgesEnabled;
  }

  set edgesEnabled(value: boolean) {
    this._edgesEnabled = value;
    this._imageDirty = true;
  }

  get transparentEnabled(): boolean {
    return this._transparentEnabled;
  }

  set transparentEnabled(value: boolean) {
    this._transparentEnabled = value;
    this._imageDirty = true;
  }

  get pbrEnabled(): boolean {
    return this._pbrEnabled;
  }

  set pbrEnabled(value: boolean) {
    this._pbrEnabled = value;
    this._imageDirty = true;
  }

  render(params?: {
    force?: boolean;
    opaqueOnly?: boolean;
  }) {
    if (this._imageDirty || (params && params.force)) {
      this.activate();
      this.viewManager.renderView(this.view.viewIndex, params);
      this._imageDirty = false;
    }
  }

  clear() {
    this.activate();
    this.viewManager.clearView(this.view.viewIndex);
  }

  destroy() {
    this.renderBufferManager.destroy();
  }
}
