import type {View, Viewer} from "../viewer";
import {getWebGLExtension, WEBGL_INFO, type WebGLAbstractTexture} from "../webglutils";
import type {FloatArrayParam} from "../math";
import {ViewFlags} from "./ViewFlags";
import {Capabilities, SDKError} from "../core";


/**
 * Represents the rendering context used by the `WebGLRenderer`.
 *
 * The `RenderContext` manages the state and resources required for rendering operations.
 * It handles the WebGL context, GPU dtxMemory, and rendering parameters for the current frame.
 * This context is shared across renderer components.
 *
 * Responsibilities:
 * - Tracks the current rendering state, including active textures, programs, and passes.
 * - Manages GPU dtxMemory for geometry and materials through the `DTXMemoryBatch` system.
 * - Provides methods for managing texture units and resetting state between frames.
 * - Stores matrices and parameters for specialized rendering operations like shadow mapping and picking.
 *
 * Workflow:
 * - Initialized by the `WebGLRenderer` and reset before each frame.
 * - Updated during rendering with the current view, matrices, and parameters.
 *
 * @internal
 */
export class RenderContext {

  /**
   * The Viewer.
   */
  public viewer: Viewer;

  /**
   * The WebGL rendering context.
   */
  public gl: WebGL2RenderingContext;

  /**
   * The HTML canvas element used for WebGL rendering.
   */
  public webglCanvasElement: HTMLCanvasElement;

  /**
   * The View we are currently rendering.
   */
  public view: View;

  /**
   * Whether to render a quality representation for triangle surfaces.
   *
   * When ````false````, we'll render them with a fast vertex-shaded Gouraud-shaded representation, which
   * is great for zillions of objects.
   *
   * When ````true````, we'll render them at a better visual quality, using smooth, per-fragment shading
   * and a more realistic lighting model.
   */
  public pbrEnabled: boolean;

  /**
   * Whether backfaces are currently enabled during the current frame.
   */
  public backfaces: boolean;

  /**
   * The vertex winding order for what we currently consider to be a backface during current
   * frame: true == "cw", false == "ccw".
   */
  public frontface: boolean;

  /**
   * The next available texture unit to bind a texture to.
   */
  public textureUnit: number;

  /**
   * Statistic that counts how many times ````gl.bindTexture()```` has been called so far within the current frame.
   */
  public bindTexture: number;

  /**
   * Whether we are currently picking with a ray.
   */
  public rayPicking: boolean;

  /**
   * The 4x4 viewing transform matrix the WebGLRenderer is currently using when rendering a ray-pick.
   *
   * This sets the viewpoint to look along the ray, when picking with a ray.
   */
  public pickViewMatrix: FloatArrayParam;

  /**
   * The 4x4 orthographic projection transform matrix the WebGLRenderer is currently using when rendering a ray-pick.
   */
  public pickProjMatrix: FloatArrayParam;

  /**
   * Distance to the near clipping plane when rendering depth fragments for GPU-accelerated 3D picking.
   */
  public pickZNear: number;

  /**
   * Distance to the far clipping plane when rendering depth fragments for GPU-accelerated 3D picking.
   */
  public pickZFar: number;

  /**
   * Whether the WebGLRenderer is currently picking invisible objects.
   */
  public pickInvisible: boolean;

  /** The current line width.
   */
  public lineWidth: number;

  /**
   * ID of the last WebGLProgram that was bound during the current frame. Used to avoid redundant program binds.
   */
  public lastProgramId: number;

  /**
   * The occlusion rendering texture.
   */
  public saoOcclusionTexture: WebGLAbstractTexture|null;

  /**
   * TODO
   */
  public pickClipPos: FloatArrayParam;

  /**
   * The view flags for each possible view index (0-3).
   */
  public readonly viewFlags: ViewFlags[];

  /**
   * Creates a new RenderContext.
   */
  constructor( viewer: Viewer ) {
    this.viewer = viewer;
    this.view = null;
    const {canvas: webglCanvasElement, gl} = RenderContext._createCanvasAndGL();
    this.gl = gl;
    this.webglCanvasElement = webglCanvasElement;
    this.viewFlags = [
      new ViewFlags(),
      new ViewFlags(),
      new ViewFlags(),
      new ViewFlags()
    ];
    this.reset();
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
    // Nicest derivatives hint (valid in WebGL2)
    gl.hint(gl.FRAGMENT_SHADER_DERIVATIVE_HINT, gl.NICEST);
    return {canvas, gl};
  }

  public static getCapabilities( capabilities: Capabilities ): void {
    capabilities.maxViews = 4;
    const testCanvas = document.createElement("canvas");
    const gl = testCanvas.getContext("webgl2") as WebGL2RenderingContext|null;
    if (!gl) {
      return;
    }
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
   * Marks the view with the given index as needing to be re-rendered.
   * @param viewIndex
   */
  setViewDirty( viewIndex: number ): void {
    if (viewIndex < 0 || viewIndex >= this.viewFlags.length) {
      throw new SDKError("Invalid view index");
    }
    this.viewFlags[viewIndex].needsRender = true;
  }

  /**
   * Marks all views as needing to be re-rendered.
   */
  setAllViewsDirty(): void {
    for (const vf of this.viewFlags) {
      vf.needsRender = true;
    }
  }

  /**
   * Called before each frame.
   */
  reset() {
    this.lastProgramId = -1;
    this.pbrEnabled = false;
    this.backfaces = false;
    this.frontface = true;
    this.textureUnit = 0;
    this.pickViewMatrix = null;
    this.pickProjMatrix = null;
    this.pickZNear = 0.01;
    this.pickZFar = 5000;
    this.pickInvisible = false;
    this.lineWidth = 1;
    this.saoOcclusionTexture = null;
    this.rayPicking = false;
  }

  /**
   * Gets the next available texture unit for the current drawBatch pass.
   */
  get nextTextureUnit() {
    const textureUnit = this.textureUnit;
    this.textureUnit = (this.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;
    return textureUnit;
  }

  destroy() {
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
    (this.webglCanvasElement.parentNode as Node).removeChild(this.webglCanvasElement);
  }
}
