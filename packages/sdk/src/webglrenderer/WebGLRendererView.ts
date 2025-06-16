import {View} from "../viewer";
import {WebGLRenderBufferManager} from "./WebGLRenderBufferManager";
import {Map} from "../utils";
import {WebGLTileManager} from "./WebGLTileManager";

/** @private */
export class WebGLRendererView {

  view: View;
  transparencyEnabled: boolean;
  imageDirty: boolean;
  viewMatrixDirty: boolean;
  canvasTransparent: boolean;
  saoEnabled: boolean;
  edgesEnabled: boolean;
  transparentEnabled: boolean;
  pbrEnabled: boolean;
  saveCanvasBoundary: DOMRect;
  gl: WebGL2RenderingContext;
  renderBufferManager: WebGLRenderBufferManager;
  pickIDs: Map;

  constructor(gl: WebGL2RenderingContext, webglCanvasElement: HTMLCanvasElement, view: View) {
    this.gl = gl;
    this.view = view;
    this.transparencyEnabled = true;
    this.imageDirty = true;
    this.viewMatrixDirty = true;
    this.canvasTransparent = false;
    this.pbrEnabled = false;
    this.saoEnabled = false;
    this.edgesEnabled = true;
    this.transparentEnabled = true;
    this.saveCanvasBoundary = view.htmlElement.getBoundingClientRect();
    this.renderBufferManager = new WebGLRenderBufferManager(gl, webglCanvasElement);
    this.pickIDs = new Map({});
  }

  destroy() {
    this.renderBufferManager.destroy();
  }
}
