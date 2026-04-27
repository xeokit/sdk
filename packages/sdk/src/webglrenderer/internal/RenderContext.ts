import type {View, Viewer} from "../../viewer";
import { WEBGL_INFO, type WebGLAbstractTexture} from "../../webglutils";
import type {FloatArrayParam} from "../../math";
import {SDKInternalException, SDKErrorType, type SDKResult} from "../../core";
import type {WebGLContextProvider} from "../../webglutils/WebGLContextProvider";
import type {MemoryConfigs} from "../MemoryConfigs";
import {RenderInspector} from "./inspectors/RenderInspector";


/**
 * Maximum number of shadow cascades the renderer supports. Shadow-aware
 * shaders declare exactly this many samplers and matrix slots; runtime
 * cascadeCount just decides how many of them actually carry data.
 *
 * @internal
 */
export const MAX_SHADOW_CASCADES = 6;


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
   * The RenderInspector for logging draw calls.
   */
  public renderInspector: RenderInspector;

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
   * Render pass of the last _bind call. Used together with lastProgramId to detect when pass-dependent
   * uniforms (e.g. silhouetteColor) need re-uploading even though the same program is still bound.
   */
  public lastRenderPass: number;

  /**
   * Width of the FBO the scene is currently being rendered into. Equal to
   * `drawingBufferWidth` when {@link Tonemap.renderScale} is 1; larger when
   * supersampling is on. Post-process passes (tonemap, FXAA) use
   * `drawingBufferWidth` — they sample this bigger scene texture down to
   * canvas size on the way out.
   */
  public sceneRenderWidth: number;

  /** See {@link sceneRenderWidth}. */
  public sceneRenderHeight: number;

  /**
   * The occlusion rendering texture.
   */
  public saoOcclusionTexture: WebGLAbstractTexture|null;

  /**
   * One shadow-map depth texture per cascade (indices `0..shadowCascadeCount-1`
   * are populated). Unused slots alias to cascade 0's texture so every sampler
   * in shadow-aware shaders has a valid binding. Null array entries indicate
   * shadows aren't in effect this frame.
   */
  public shadowMapTextures: Array<WebGLAbstractTexture | null>;

  /**
   * Light view-projection matrix for the cascade currently being rendered,
   * used by the shadow-depth technique which only ever processes one cascade
   * per draw pass. Set by {@link ShadowPipeline} before each cascade's depth
   * dispatch; ignored by shadow-aware color techniques (they read the array
   * form, {@link shadowLightViewProjMatrices}).
   */
  public shadowLightViewProjMatrix: Float32Array<any>;

  /**
   * Concatenated array of up to {@link MAX_SHADOW_CASCADES} mat4s (16 floats
   * each) — `shadowLightViewProjMatrices.subarray(i*16, (i+1)*16)` is the
   * camera-view-space → cascade-`i` light-clip matrix.
   */
  public shadowLightViewProjMatrices: Float32Array<any>;

  /**
   * View-space `|z|` boundaries between cascades. Entry `i` is the far edge
   * of cascade `i` (equivalently the near edge of cascade `i+1`). Only the
   * first `shadowCascadeCount - 1` entries are meaningful.
   */
  public shadowCascadeSplits: Float32Array<any>;

  /** Number of shadow cascades active this frame, in `[1, MAX_SHADOW_CASCADES]`. */
  public shadowCascadeCount: number;

  /**
   * IBL Layer-2 prefiltered samplers — populated by the IBL prefilter
   * pipeline before the BRDF passes run. The smooth-shaded technique
   * variants bind these for the split-sum specular IBL approximation:
   *
   *   - `iblIrradianceCubemap`: cosine-convolved cubemap for diffuse IBL
   *   - `iblPrefilteredCubemap`: GGX-prefiltered cubemap with mip chain
   *   - `iblBRDFLUT`: shared 2D `(NdotV, roughness) → (scale, bias)` LUT
   *
   * `iblMaxSpecularMipLevel` is the highest valid mip on the prefiltered
   * cubemap, used to scale `roughness` into the lod range.
   *
   * All four are `null` outside the BRDF binding window — the renderer
   * sets them in {@link RenderManager._renderScene} and clears them in
   * {@link reset}.
   */
  public iblIrradianceCubemap: WebGLTexture | null = null;
  public iblPrefilteredCubemap: WebGLTexture | null = null;
  public iblBRDFLUT: WebGLTexture | null = null;
  public iblMaxSpecularMipLevel: number = 0;
  /**
   * View-to-world rotation (3×3, transposed view matrix's upper-left)
   * uploaded as a `mat3` so the BRDF shader can transform view-space
   * normals/reflection vectors into world space for cubemap sampling.
   * Populated alongside the cubemaps. Float32 column-major.
   */
  public iblViewToWorldRot: Float32Array = new Float32Array(9);

  /**
   * Light direction in camera-view space (xyz). Populated alongside
   * {@link shadowLightViewProjMatrices} and used by shadow-aware draw
   * techniques for slope-scaled bias computation.
   */
  public shadowLightDirView: Float32Array<any>;

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
    this.renderInspector = new RenderInspector();
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
    (s as any)["pointer-events"] = "none";
    s.zIndex = "100000"; // HACK
    document.body.appendChild(canvas);
    const contextAttr: WebGLContextAttributes = {
      alpha: false,
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
    this.lastRenderPass = -1;
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
    this.sceneRenderWidth = 0;
    this.sceneRenderHeight = 0;
    this.shadowMapTextures = new Array(MAX_SHADOW_CASCADES).fill(null);
    this.shadowLightViewProjMatrix = new Float32Array(16);
    this.shadowLightViewProjMatrices = new Float32Array(16 * MAX_SHADOW_CASCADES);
    this.shadowCascadeSplits = new Float32Array(MAX_SHADOW_CASCADES);
    this.shadowCascadeCount = 0;
    this.shadowLightDirView = new Float32Array(3);
    this.iblIrradianceCubemap = null;
    this.iblPrefilteredCubemap = null;
    this.iblBRDFLUT = null;
    this.iblMaxSpecularMipLevel = 0;
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
