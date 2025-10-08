import type {Capabilities} from "../core";
import {EventEmitter, SDKError} from "../core";
import {getWebGLExtension} from "../webglutils";
import type {Renderer, Viewer} from "../viewer";
import {EventDispatcher} from "strongly-typed-events";
import {RenderContext} from "./RenderContext";
import {ViewManager} from "./views/ViewManager";
import {RenderManager} from "./render/RenderManager";
import {DrawBatches} from "./drawBatches/DrawBatches";
import type {DTXMemoryReader} from "./dtxMemory/DTXMemoryReader";
import type {DTXMemoryEditor} from "./dtxMemory/DTXMemoryEditor";
import {DTXMemory} from "./dtxMemory/DTXMemory";
import {PickManager} from "./pick/PickManager";

/**
 * WebGL rendering strategy for a Viewer.
 *
 * See {@link "webglrenderer" | @xeokit/webglrenderer} for usage.
 */
export class WebGLRenderer implements Renderer {

  private _viewManager!: ViewManager;
  private _renderManager!: RenderManager;
  private _pickManager!: PickManager;
  private _drawBatches!: DrawBatches;
  private _dtxMemory!: DTXMemory;

  private _gl: WebGL2RenderingContext;
  private _renderContext: RenderContext|null = null;
  private _webglCanvasElement: HTMLCanvasElement;
  private _destroyed = false;

  /** @internal */
  readonly onDestroyed: EventEmitter<WebGLRenderer, boolean>;

  private _unsubscribeViewerDestroyed: (() => void)|null = null;

  /**
   * Constructs a new WebGLRenderer.
   */
  constructor() {

    this.onDestroyed = new EventEmitter(new EventDispatcher<WebGLRenderer, boolean>());

    const {canvas, gl} = WebGLRenderer._createCanvasAndGL();
    this._webglCanvasElement = canvas;
    this._gl = gl;

    // Nicest derivatives hint (valid in WebGL2)
    this._gl.hint(this._gl.FRAGMENT_SHADER_DERIVATIVE_HINT, this._gl.NICEST);
  }

  private static _createCanvasAndGL(): {canvas: HTMLCanvasElement; gl: WebGL2RenderingContext} {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;

    const s = canvas.style;
    s.position = "absolute";
    s.top = "50px";
    s.left = "50px";
    s.border = "1px solid black";
    (s as any)["pointer-events"] = "none";
    s.zIndex = "100000"; // HACK

    document.body.appendChild(canvas);

    const contextAttr: WebGLContextAttributes = {
      alpha: true,
      preserveDrawingBuffer: true,
      stencil: false,
      premultipliedAlpha: false,
      antialias: true,
      // powerPreference?: "default" | "high-performance" | "low-power"
    };

    const gl = canvas.getContext("webgl2", contextAttr) as WebGL2RenderingContext|null;
    if (!gl) {
      throw new SDKError("Cannot get a WebGL2 context");
    }
    return {canvas, gl};
  }

  /**
   * Gets the capabilities of this WebGLRenderer.
   */
  getCapabilities( capabilities: Capabilities ): void {
    capabilities.maxViews = 4;

    const testCanvas = document.createElement("canvas");
    const gl = testCanvas.getContext("webgl2") as WebGL2RenderingContext|null;
    if (!gl) return;

    capabilities.astcSupported = !!getWebGLExtension(gl, "WEBGL_compressed_texture_astc");
    capabilities.etc1Supported = true; // WebGL
    capabilities.etc2Supported = !!getWebGLExtension(gl, "WEBGL_compressed_texture_etc");
    capabilities.dxtSupported = !!getWebGLExtension(gl, "WEBGL_compressed_texture_s3tc");
    capabilities.bptcSupported = !!getWebGLExtension(gl, "EXT_texture_compression_bptc");
    capabilities.pvrtcSupported =
      !!getWebGLExtension(gl, "WEBGL_compressed_texture_pvrtc") ||
      !!getWebGLExtension(gl, "WEBKIT_WEBGL_compressed_texture_pvrtc");
  }

  /**
   * Initializes this WebGLRenderer by attaching a Viewer.
   * @internal
   */
  attachViewer( viewer: Viewer ): void {
    if (this._renderContext) {
      throw new SDKError("Can't attach Viewer - a Viewer is already attached");
    }
    if ((viewer as any).renderer) {
      throw new SDKError("Can't attach Viewer - given Viewer is already attached to another Renderer");
    }

    this._unsubscribeViewerDestroyed = viewer.onDestroyed.subscribe(( _viewer, _args ) => {
      this.detachViewer();
    });

    this._renderContext = new RenderContext(viewer, this._gl, this._webglCanvasElement);
    this._dtxMemory = new DTXMemory(this._renderContext);
    this._drawBatches = new DrawBatches(this._renderContext, this._dtxMemory as DTXMemoryEditor);
    this._renderManager = new RenderManager(this._renderContext, this._dtxMemory as DTXMemoryReader, this._drawBatches);
    this._pickManager = new PickManager({
      renderContext: this._renderContext,
      viewManager: this._viewManager,
      drawBatches: this._drawBatches,
      dtxMemory: this._dtxMemory
    });

    // The ViewManager attaches RendererView instances to the Views, to which the Views can delegate drawing
    // and picking to the draw and pick managers. The Views and their RendererViews are what drives the
    // WebGLRenderer to perform drawing and picking.

    this._viewManager = new ViewManager(this._renderContext, this._renderManager, this._pickManager);
  }

  /** The Viewer this WebGLRenderer is currently attached to, if any. */
  get viewer(): Viewer|null {
    return this._renderContext ? this._renderContext.viewer : null;
  }

  /**
   * Detaches the Viewer that is currently attached, if any.
   * @internal
   */
  detachViewer(): void {
    if (!this._renderContext) {
      return;
    }

    // Unsubscribe
    this._unsubscribeViewerDestroyed?.();
    this._unsubscribeViewerDestroyed = null;

    // Destroy in reverse order of construction
    this._viewManager?.destroy();
    this._pickManager?.destroy();
    this._renderManager?.destroy();
    this._drawBatches?.destroy();
    this._dtxMemory?.destroy();

    this._pickManager = undefined as unknown as PickManager;
    this._viewManager = undefined as unknown as ViewManager;
    this._renderManager = undefined as unknown as RenderManager;
    this._drawBatches = undefined as unknown as DrawBatches;
    this._dtxMemory = undefined as unknown as DTXMemory;
    this._renderContext = null;
  }

  /**
   * Destroys this WebGLRenderer.
   */
  destroy(): void {
    if (this._destroyed) {
      return;
    }
    this.detachViewer();
    this._destroyed = true;
    this.onDestroyed.dispatch(this, true);
  }
}
