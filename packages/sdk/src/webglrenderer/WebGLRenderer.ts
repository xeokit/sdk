
import type {Capabilities} from "../core";
import {EventEmitter, SDKError} from "../core";
import {getWebGLExtension, WEBGL_INFO} from "../webglutils";
import type {Renderer, View, Viewer} from "../viewer";
import { PickResult} from "../viewer";
import {EventDispatcher} from "strongly-typed-events";
import {Map} from "../utils";
import {RenderContext} from "./RenderContext";
import {RenderBufferManager} from "./views/RenderBufferManager";


import {GPUDataMemory} from "./gpuMemory/GPUDataMemory";
import {LayerRendererSet} from "./layerRenderers/LayerRendererSet";
import {ViewManager} from "./views/ViewManager";
import {DrawManager} from "./draw/DrawManager";
import {LayerManager} from "./layers/LayerManager";
import {GPUDataMemoryView} from "./gpuMemory/GPUDataMemoryView";
import {GPUDataMemoryEditor} from "./gpuMemory/GPUDataMemoryEditor";


/**
 * WebGL rendering strategy for a Viewer.
 *
 * See {@link "webglrenderer" | @xeokit/webglrenderer} for usage.
 */
export class WebGLRenderer implements Renderer {


  private _layerRendererSet: LayerRendererSet;
  private _viewManager: ViewManager;
  private _drawManager: DrawManager;
  private _layerManager: LayerManager;
  private _gpuDataMemory: GPUDataMemory;


  _gl: WebGL2RenderingContext;
  _renderContext: RenderContext;
  _webglCanvasElement: HTMLCanvasElement;
  _pickBufferManager: RenderBufferManager;
  _pickIDs = new Map({});
  _alphaDepthMask: boolean;
  _pickResult: PickResult;
  _snapshotBound: boolean;
  _destroyed: boolean;

  /**
   * @internal
   * @event onCompiled
   */
  readonly onCompiled: EventEmitter<WebGLRenderer, boolean>;

  /**
   * @internal
   * @event onDestroyed
   */
  readonly onDestroyed: EventEmitter<WebGLRenderer, boolean>;


  _onViewerDestroyed: () => void;


  /**
   * Creates a WebGLRenderer.
   */
  constructor() {

    this._renderContext = null;
    this._alphaDepthMask = false;

    this._pickIDs = new Map({});

    this._snapshotBound = false;
    this._destroyed = false;
    this._pickResult = new PickResult();

    this.onDestroyed = new EventEmitter(new EventDispatcher<WebGLRenderer, boolean>());

    this._webglCanvasElement = document.createElement('canvas');
    const webglCanvasElement = this._webglCanvasElement;
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
    this._gl = <WebGL2RenderingContext>webglCanvasElement.getContext("webgl2", contextAttr);
    if (!this._gl) {
      throw new SDKError(`Failed to get a WebGL2 context`);
    }
    this._gl.hint(this._gl.FRAGMENT_SHADER_DERIVATIVE_HINT, this._gl.NICEST);

    this._pickBufferManager = new RenderBufferManager(this._gl, webglCanvasElement);
  }

  /**
   * The Viewer this WebGLRenderer is currently attached to, if any.
   */
  get viewer(): Viewer {
    return this._renderContext.viewer;
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
    if (this._renderContext) {
      throw new SDKError("Can't attach Viewer to WebGLRenderer - a Viewer is already attached");
    }
    if (viewer.renderer) {
      throw new SDKError("Can't attach Viewer to WebGLRenderer - given Viewer is already attached to another Renderer");
    }
    this._onViewerDestroyed = viewer.onDestroyed.subscribe((viewer, _) => {
      this.detachViewer();
    });
    this._renderContext = new RenderContext(viewer, this._gl, this._webglCanvasElement);
    this._gpuDataMemory = new GPUDataMemory({gl: this._gl, viewer})
    this._layerManager = new LayerManager(this._renderContext,  <GPUDataMemoryEditor>this._gpuDataMemory);
    this._layerRendererSet = new LayerRendererSet(this._renderContext, <GPUDataMemoryView>this._gpuDataMemory);
    this._drawManager = new DrawManager({
      renderContext: this._renderContext,
      layerManager: this._layerManager,
      layerRendererSet: this._layerRendererSet
    });
    this._viewManager = new ViewManager(this._renderContext, this._drawManager);

    // this._pickManager = new PickManager({
    //   renderContext: this._renderContext,
    //   layerManager: this._layerManager,
    //   viewManager: this._viewManager,
    //   layerRendererSet: this._layerRendererSet
    // });
  }

  /**
   * Detaches the {@link viewer!Viewer | Viewer} that is currently attached, if any.
   * @internal
   */
  detachViewer(): void {

    if (!this._renderContext) {
      return;
    }

    this._onViewerDestroyed();

    this._viewManager.destroy();
    this._layerManager.destroy();
    this._drawManager.destroy();
    //this._pickManager.destroy();
    this._gpuDataMemory.destroy();
    this._layerRendererSet.destroy();

    this._renderContext = null;

    this._layerRendererSet.destroy();
    this._layerRendererSet = null;
  }

  /**
   * @private
   */
  attachPickable(pickable: any): number { // @ts-ignore
    return this._pickIDs.addItem(pickable);
  }

  /**
   * @private
   */
  detachPickable(pickId: number) {
    this._pickIDs.removeItem(pickId);
  }

  /**
   * Indicates that the WebGLRenderer needs to draw a new frame.
   * @internal
   */
  setImageDirty(viewIndex?: number): void {
    const rendererView = this._viewManager.rendererViews[viewIndex];
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
    const rendererView = this._viewManager.rendererViews[viewIndex];
    if (rendererView) {
      rendererView.edgesEnabled = enabled;
    }
  }

  /**
   * Sets whether the WebGLRenderer draws with physically-based rendering.
   * Triggers a new frame render.
   * @internal
   */
  setPBREnabled(viewIndex: number, enabled: boolean): void {
    const rendererView = this._viewManager.rendererViews[viewIndex];
    if (rendererView) {
      rendererView.pbrEnabled = enabled;
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
    const rendererView = this._viewManager.rendererViews[viewIndex];
    if (rendererView) {
      rendererView.saoEnabled = enabled;
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
    const rendererView = this._viewManager.rendererViews[viewIndex];
    if (rendererView) {
      rendererView.transparentEnabled = enabled;
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
    if (!this._renderContext) {
      return new SDKError("Can't clear canvas with WebGLRenderer - no Viewer and View is attached");
    }
    const rendererView = this._viewManager.rendererViews[viewIndex];
    if (!rendererView) {
      return new SDKError(`Can't clear canvas with WebGLRenderer - no View attached at given viewIndex: ${viewIndex}`);
    }
    rendererView.clear();
  };

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
    const rendererView = this._viewManager.rendererViews[viewIndex];
    if (!rendererView) {
      return false;
    }
    return (rendererView.imageDirty );
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
    if (!this._renderContext) {
      return new SDKError("Can't render with WebGLRenderer - no Viewer attached");
    }
    const rendererView = this._viewManager.rendererViews[viewIndex];
    if (!rendererView) {
      return new SDKError(`Can't render with WebGLRenderer - no View attached at given viewIndex: ${viewIndex}`);
    }
    rendererView.draw(params);
  }

  beginSnapshot(viewIndex: number, params?: {
    width: number,
    height: number
  }) {
    // const rendererView = this._viewManager.rendererViews[viewIndex];
    // if (!rendererView) {
    //     throw new SDKError(`Can't begin snapshot with WebGLRenderer.beginSnapshot() - no View attached at given viewIndex: ${viewIndex}`);
    // }
    // const snapshotBuffer = rendererView.renderBufferManager.getRenderBuffer("snapshot");
    // if (params && params.width && params.height) {
    //     snapshotBuffer.setSize([params.width, params.height]);
    // }
    // snapshotBuffer.bind();
    // snapshotBuffer.clear();
    // this._snapshotBound = true;
  }

  renderSnapshot() {
    // const rendererView = this._viewManager.rendererViews[viewIndex];
    // if (!rendererView) {
    //     throw new SDKError(`Can't render snapshot with WebGLRenderer.renderSnapshot() - no View attached at given viewIndex: ${viewIndex}`);
    // }
    // if (!this._snapshotBound) {
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
    // const rendererView = this._viewManager.rendererViews[viewIndex];
    // if (!rendererView) {
    //     throw new SDKError(`Can't read snapshot with WebGLRenderer.readSnapshot() - no View attached at given viewIndex: ${viewIndex}`);
    // }
    // if (!this._snapshotBound) {
    //     return;
    // }
    // const snapshotBuffer = rendererView.renderBufferManager.getRenderBuffer("snapshot");
    // return snapshotBuffer.readImage(params);
    return "";
  }

  readSnapshotAsCanvas(): HTMLCanvasElement {
    // const rendererView = this._viewManager.rendererViews[viewIndex];
    // if (!rendererView) {
    //     throw new SDKError(`Can't read snapshot with WebGLRenderer.readSnapshotAsCanvas() - no View attached at given viewIndex: ${viewIndex}`);
    // }
    // if (!this._snapshotBound) {
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
    // const rendererView = this._viewManager.rendererViews[viewIndex];
    // if (!rendererView) {
    //     throw new SDKError(`Can't end snapshot with WebGLRenderer.endSnapshot() - no View attached at given viewIndex: ${viewIndex}`);
    // }
    // if (!this._snapshotBound) {
    //     return;
    // }
    // const snapshotBuffer = rendererView.renderBufferManager.getRenderBuffer("snapshot");
    // snapshotBuffer.unbind();
    this._snapshotBound = false;
  }

  destroy() {
    if (this._destroyed) {
      return;
    }
    this.detachViewer();
  this._pickBufferManager.destroy();
    this._destroyed = true;
    this.onDestroyed.dispatch(this, true);
  }

}
