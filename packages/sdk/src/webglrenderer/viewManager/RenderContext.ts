import type {View, Viewer} from "../../viewer";
import { WEBGL_INFO, type WebGLAbstractTexture} from "../../webglutils";
import type {FloatArrayParam} from "../../math";
import {SDKInternalException, SDKErrorType, type SDKResult} from "../../core";
import type {WebGLContextProvider} from "../../webglutils/WebGLContextProvider";
import type {MemoryConfigs} from "../MemoryConfigs";


/**
 * Represents the rendering context`.
 *
 * @internal
 */
export class RenderContext implements WebGLContextProvider {

  /**
   * The Viewer.
   */
  public viewer: Viewer;

  /**
   * The memory configuration for the WebGLRenderer.
   */
  public memoryConfigs: MemoryConfigs;

  /**
   * Whether debugging is enabled.
   */
  public debugging: boolean;

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
  public activeView: View;

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

  private initialized: boolean = false;


  /**
   * Creates a new RenderContext.
   */
  constructor(memoryConfigs: MemoryConfigs) {
    this.memoryConfigs = memoryConfigs;
    this.initialized = false;
  }

  /**
   * Initializes this RenderContext.
   * @param viewer
   * @returns {SDKResult<undefined>}
   */
  public init( viewer: Viewer ): SDKResult<undefined> {
    this.viewer = viewer;
    this.activeView = null;
    const result = this._createCanvasAndGL();
    if (result.ok===false) {
      return result;
    }
    const {canvas: webglCanvasElement, gl} = result.value;
    this.gl = gl;
    this.webglCanvasElement = webglCanvasElement;
    this.debugging = false;
    this.initialized = true;
    this.reset();
    return {
      ok: true,
      value: undefined
    };
  }

  private _createCanvasAndGL(): SDKResult<{canvas: HTMLCanvasElement; gl: WebGL2RenderingContext}> {
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
      return {
        ok: false,
        type: SDKErrorType.NotSupported,
        error: "[RenderContext.init] WebGL2 not supported by this browser"
      };
    }
    // Nicest derivatives hint (valid in WebGL2)
    gl.hint(gl.FRAGMENT_SHADER_DERIVATIVE_HINT, gl.NICEST);
    return {
      ok: true,
      value:{
        canvas,
        gl
      }
    };
  }

  /**
   * Called before each frame.
   */
  reset() {
    if (!this.initialized) {
        throw new SDKInternalException("RenderContext not initialized");
    }
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
   * Gets the next available texture unit for the current draw pass.
   */
  get nextTextureUnit() {
    if (!this.initialized) {
        throw new SDKInternalException("RenderContext not initialized");
    }
    const textureUnit = this.textureUnit;
    this.textureUnit = (this.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;
    return textureUnit;
  }

  /**
   * Destroys this RenderContext.
   */
  destroy() {
    if (this.initialized) {
      this.gl.getExtension("WEBGL_lose_context")?.loseContext();
      (this.webglCanvasElement.parentNode as Node).removeChild(this.webglCanvasElement);
      this.webglCanvasElement = null;
        this.gl = null;
    }
  }
}
