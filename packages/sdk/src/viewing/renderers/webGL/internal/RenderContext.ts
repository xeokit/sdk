import type {View, Viewer} from "../../../viewer";
import { WEBGL_INFO, type WebGLAbstractTexture} from "./webGL";
import type {FloatArrayParam} from "../../../../base/math";
import {SDKInternalException, SDKErrorType, type SDKResult} from "../../../../base/core";
import type {WebGLContextProvider} from "./webGL/WebGLContextProvider";
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
   * True while the WebGL context is lost (between `webglcontextlost` and the
   * completion of `webglcontextrestored`). GL resources are invalid in this
   * window, so all rendering, GPU uploads and resource deletion must be skipped.
   */
  get contextLost(): boolean {
    return this._contextLost || !this.gl || this.gl.isContextLost();
  }

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
   * Which 2D texture is currently bound to each texture unit, indexed by unit.
   *
   * Lets the draw path skip a redundant `gl.bindTexture` when the unit already
   * holds the texture about to be bound - saving the repeated binds of
   * frame-wide textures (camera matrix, IBL maps) across a bin's batches.
   *
   * Only valid within one uninterrupted batch-draw sequence. Cleared by
   * {@link resetTextureBindings} at the start of every such sequence (each draw
   * bin, pick, snap, and the SAO/shadow/cap prep passes), because sub-pipelines
   * and atlas mipmap refreshes bind textures outside this tracking.
   */
  public boundTexture2DUnits: (WebGLTexture | null)[];

  /**
   * Which cubemap texture is currently bound to each texture unit.
   */
  public boundCubemapTextureUnits: (WebGLTexture | null)[];

  /**
   * Texture unit last selected through this render context.
   */
  public activeTextureUnit: number;

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
   * Increments on every render-context reset. Draw techniques use this to
   * upload view-stable uniforms once per scene/pick/snap pass instead of on
   * every program rebind.
   */
  public uniformFrameId: number = 0;

  /**
   * Width of the FBO the scene is currently being rendered into. Equal to
   * `drawingBufferWidth` when {@link Tonemap.renderScale} is 1; larger when
   * supersampling is on. Post-process passes (tonemap, final AA) use
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
   * Scene-depth texture used by depth-aware post-processes. Populated only
   * when the active View applies a post-process that needs scene depth;
   * otherwise null.
   */
  public sceneDepthTexture: WebGLAbstractTexture|null;

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
   * 1×1 black placeholder cubemap. Bound to the IBL `samplerCube`
   * uniforms whenever no real IBL cubemap is published — keeps every
   * sampler in the active program pointing at a valid texture of the
   * matching type, which WebGL2 validates regardless of whether the
   * shader actually dereferences the sampler at runtime. Without this,
   * disabling IBL can leave cubemap samplers pointing at units that have
   * `sampler2D` data textures bound, triggering `GL_INVALID_OPERATION:
   * Two textures of different types use the same sampler location.`.
   */
  private _placeholderCubemap: WebGLTexture | null = null;

  /** 1×1 black placeholder 2D texture. Same role as
   *  {@link _placeholderCubemap} but for `sampler2D` slots. */
  private _placeholderTexture2D: WebGLTexture | null = null;
  /**
   * View-to-world rotation (3×3, transposed view matrix's upper-left)
   * uploaded as a `mat3` so the BRDF shader can transform view-space
   * normals/reflection vectors into world space for cubemap sampling.
   * Populated alongside the cubemaps. Float32 column-major.
   */
  public iblViewToWorldRot: Float32Array<any> = new Float32Array(9);

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

  /**
   * Cursor position in clip space (range `[-1, 1]` on each axis), set
   * by the {@link SnapManager} before binding a snap technique. The
   * snap pass uses this to centre its viewport-remap helper on the
   * cursor — same shape as {@link pickClipPos} but kept separate so
   * pick and snap can run side by side without clobbering each other.
   */
  public snapClipPos: FloatArrayParam;

  /**
   * Snap framebuffer size in pixels — the snap shaders use the
   * ratio (drawingBufferSize / snapBufferSize) to convert a
   * canvas-pixel offset into the matching offset on the small snap
   * FBO, so the cursor's surroundings land flush against its edges.
   */
  public snapBufferSize: FloatArrayParam;

  private initialized: boolean = false;
  private _contextLost: boolean = false;


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
    this._contextLost = false;
    const result = this._createCanvasAndGL();
    if (result.ok===false) {
      return result;
    }
    const {canvas: webglCanvasElement, gl} = result.value;
    this.gl = gl;
    this.webglCanvasElement = webglCanvasElement;
    this.renderInspector = new RenderInspector();
    this.renderInspector.attachGL(gl);
    this.debugging = false;
    this.boundTexture2DUnits = new Array(WEBGL_INFO.MAX_TEXTURE_UNITS).fill(null);
    this.boundCubemapTextureUnits = new Array(WEBGL_INFO.MAX_TEXTURE_UNITS).fill(null);
    this.activeTextureUnit = -1;
    const placeholderResult = this._allocatePlaceholderTextures();
    if (placeholderResult.ok === false) {
      this.destroy();
      return placeholderResult;
    }
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
    document.body.appendChild(canvas);
    return {
      ok: true,
      value:{
        canvas,
        gl
      }
    };
  }

  /**
   * Allocates the 1×1 placeholder cubemap and 2D texture used to
   * keep IBL sampler uniforms pointing at valid textures of the
   * matching type when IBL isn't applied. Called once during
   * {@link init}; the textures live for the lifetime of the
   * `RenderContext`.
   */
  private _allocatePlaceholderTextures(): SDKResult<void> {
    const gl = this.gl;
    const black = new Uint8Array([0, 0, 0, 255]);

    const cube = gl.createTexture();
    if (!cube) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[RenderContext._allocatePlaceholderTextures] Failed to create placeholder cubemap"
      };
    }
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cube);
    const faces = [
      gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
      gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
    ];
    for (const face of faces) {
      gl.texImage2D(face, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, black);
    }
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    this._placeholderCubemap = cube;

    const tex = gl.createTexture();
    if (!tex) {
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
      gl.deleteTexture(cube);
      this._placeholderCubemap = null;
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[RenderContext._allocatePlaceholderTextures] Failed to create placeholder texture"
      };
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, black);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this._placeholderTexture2D = tex;
    return {ok: true, value: undefined};
  }

  private _releasePlaceholderTextures(): void {
    const gl = this.gl;
    if (gl) {
      if (this._placeholderCubemap) {
        gl.deleteTexture(this._placeholderCubemap);
      }
      if (this._placeholderTexture2D) {
        gl.deleteTexture(this._placeholderTexture2D);
      }
    }
    this._placeholderCubemap = null;
    this._placeholderTexture2D = null;
    this.iblIrradianceCubemap = null;
    this.iblPrefilteredCubemap = null;
    this.iblBRDFLUT = null;
  }

  /**
   * Drops GL handles owned directly by this context when WebGL reports context
   * loss. The browser invalidates those handles, so restoration must recreate
   * them before any draw technique binds the fallback IBL samplers again.
   */
  webglContextLost(): void {
    this._contextLost = true;
    this._releasePlaceholderTextures();
    this.resetTextureBindings();
  }

  /**
   * Recreates context-owned GL resources after WebGL restores the existing
   * context object.
   */
  webglContextRestored(gl?: WebGL2RenderingContext): SDKResult<void> {
    if (!this.initialized || !this.gl) {
      throw new SDKInternalException("[RenderContext.webglContextRestored] RenderContext is not initialized");
    }
    if (gl && gl !== this.gl) {
      this.gl = gl;
      this.renderInspector?.attachGL(gl);
    }
    if (this.gl.isContextLost()) {
      return {
        ok: false,
        type: SDKErrorType.WebGLContextLost,
        error: "[RenderContext.webglContextRestored] WebGL context is still lost"
      };
    }

    this._releasePlaceholderTextures();
    const result = this._allocatePlaceholderTextures();
    if (result.ok === false) {
      return result;
    }
    this._contextLost = false;
    this.reset();
    return {ok: true, value: undefined};
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
    this.uniformFrameId++;
    this.pbrEnabled = false;
    this.backfaces = false;
    this.frontface = true;
    this.textureUnit = 0;
    this.bindTexture = 0;
    this.pickViewMatrix = null;
    this.pickProjMatrix = null;
    this.pickZNear = 0.01;
    this.pickZFar = 5000;
    this.pickInvisible = false;
    this.lineWidth = 1;
    this.saoOcclusionTexture = null;
    this.sceneDepthTexture = null;
    this.sceneRenderWidth = 0;
    this.sceneRenderHeight = 0;
    this.shadowMapTextures = new Array(MAX_SHADOW_CASCADES).fill(null);
    this.shadowLightViewProjMatrix = new Float32Array(16);
    this.shadowLightViewProjMatrices = new Float32Array(16 * MAX_SHADOW_CASCADES);
    this.shadowCascadeSplits = new Float32Array(MAX_SHADOW_CASCADES);
    this.shadowCascadeCount = 0;
    this.shadowLightDirView = new Float32Array(3);
    this.iblIrradianceCubemap = this._placeholderCubemap;
    this.iblPrefilteredCubemap = this._placeholderCubemap;
    this.iblBRDFLUT = this._placeholderTexture2D;
    this.iblMaxSpecularMipLevel = 0;
    this.rayPicking = false;
    this.resetTextureBindings();
  }

  /**
   * Clears the per-unit bound-texture tracking.
   *
   * Call at the start of every uninterrupted batch-draw sequence so the draw
   * path's redundant-bind skip can't act on stale state left by a sub-pipeline,
   * a splat pass, or a previous frame.
   */
  resetTextureBindings(): void {
    const bound2D = this.boundTexture2DUnits;
    const boundCubemap = this.boundCubemapTextureUnits;
    for (let i = 0, len = bound2D.length; i < len; i++) {
      bound2D[i] = null;
      boundCubemap[i] = null;
    }
    this.activeTextureUnit = -1;
  }

  bindTexture2D(unit: number, texture: WebGLTexture | null): boolean {
    return this._bindTexture(this.gl.TEXTURE_2D, unit, texture, this.boundTexture2DUnits);
  }

  bindCubemapTexture(unit: number, texture: WebGLTexture | null): boolean {
    return this._bindTexture(this.gl.TEXTURE_CUBE_MAP, unit, texture, this.boundCubemapTextureUnits);
  }

  invalidateTextureBinding(unit: number): void {
    this.boundTexture2DUnits[unit] = null;
    this.boundCubemapTextureUnits[unit] = null;
    this.activeTextureUnit = -1;
  }

  private _bindTexture(target: number, unit: number, texture: WebGLTexture | null, boundTextures: (WebGLTexture | null)[]): boolean {
    if (boundTextures[unit] === texture) {
      return false;
    }
    const gl = this.gl;
    if (this.activeTextureUnit !== unit) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      this.activeTextureUnit = unit;
    }
    gl.bindTexture(target, texture);
    this.bindTexture++;
    boundTextures[unit] = texture;
    return true;
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
    this._releasePlaceholderTextures();
    if (this.gl && !this.gl.isContextLost()) {
      this.gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    if (this.webglCanvasElement?.parentNode) {
      (this.webglCanvasElement.parentNode as Node).removeChild(this.webglCanvasElement);
    }
    this.webglCanvasElement = null;
    this.gl = null;
    this.initialized = false;
  }
}
