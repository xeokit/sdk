import {WEBGL_INFO, WebGLProgram} from "../../../webglutils";
import {LinesPrimitive, OrthoProjectionType, PointsPrimitive, TrianglesPrimitive} from "../../../constants";
import {RENDER_PASSES, type RenderPassValue} from "../RENDER_PASSES";
import type {RenderContext} from "../RenderContext";
import {type GPUMemoryReader} from "../gpuMemoryManager/GPUMemoryReader";
import {type MeshBatch} from "../meshManager/MeshBatch";
import {SDKErrorType, type SDKResult} from "../../../core";
import {type WebGLContextProvider} from "../../../webglutils/WebGLContextProvider";

const defaultColor = new Float32Array([1, 1, 1, 1]);

/**
 * Debug toggle: when true, the smooth + UV fragment shader writes the
 * raw RGB of the normal-map atlas sample directly to the output, instead
 * of running the BRDF. Lets us visually answer "is the normal-map
 * texture actually reaching the shader?".
 *
 * What you should see when this is on:
 *   - Light-blue fragments (≈ #8080FF) → atlas is sampling the SENTINEL
 *     texel: no normal map is reaching this mesh (atlas upload failed,
 *     UV transform is sentinel-only, or the material has no
 *     normalsTextureId).
 *   - Black fragments → atlas isn't bound; the cubemap-sampler binding
 *     never resolved.
 *   - Colourful patterns (reds, greens, cyans, varying with surface) →
 *     the atlas is working; the normal map's content is what you see
 *     directly. Bumpy patterns mean the texture has bumps; flat areas
 *     of one colour mean the texture is mostly flat there.
 *
 * Flip back to `false` and rebuild the bundle once we've identified the
 * issue. This is a strict short-term debug aid, not a feature.
 */
const DEBUG_VISUALIZE_NORMAL_MAP = false;

/**
 * Base class for GPU draw techniques.
 *
 * Used by {@link DrawOp}s to perform actual draw calls.
 *
 * A {@link DrawTechnique} encapsulates:
 * - GLSL source generation (vertex + fragment)
 * - WebGL program compilation/linking ({@link WebGLProgram})
 * - Uniform / sampler discovery and per-pass binding
 * - Issuing draw calls for a {@link MeshBatch}
 *
 * Techniques are *render-pass aware* but do not own render-pass routing:
 * callers pass a {@link RenderPassValue} to {@link drawMesh},
 * and the technique binds uniforms accordingly.
 *
 * ## Responsibilities
 * - Build shader sources via {@link buildVertexShader} and {@link buildFragmentShader}.
 * - Compile/link the program and cache uniform/sampler locations in {@link init}.
 * - Bind the program and set pass/view-dependent uniforms in {@link _bind}.
 * - Bind batch data textures from {@link GPUMemoryReader} and draw primitives in {@link _draw}.
 *
 * ## Lifecycle
 * - Call {@link init} once after construction to allocate GPU resources.
 * - Call {@link destroy} to release GPU resources.
 * - On WebGL context loss/restoration, call {@link webglContextRestored} to recreate state.
 *
 * Subclasses must implement:
 * - {@link buildVertexShader}
 * - {@link buildFragmentShader}
 *
 * These methods are called during {@link init} to generate the GLSL source code,
 * and would typically use inspectors methods like {@link vsCode}, {@link vsHeader},
 * and {@link vsCommonDeclarations}, provided by the base class, to construct the shader source
 * (i.e. Template Method / Template Base Class pattern).
 *
 * Note: Lambert shading now computes the face normal in the fragment shader from
 * `dFdx/dFdy(vViewPos)` instead of reconstructing the full triangle in the vertex shader.
 * This preserves the template-method API used by concrete techniques such as
 * `TrianglesDrawColorTechnique` while removing the expensive per-vertex triangle refetch.
 *
 * @internal
 */

export abstract class DrawTechnique {

  /**
   * Number of vertices per primitive: 3 for triangles, 2 for lines, 1 for points.
   * Emitted as a compile-time constant into the vertex shader.
   */
  protected abstract readonly vertsPerPrim: number;

  /**
   * When false, vertex positions are addressed directly (no index-buffer lookup).
   * Override to false in point-cloud techniques.
   */
  protected readonly useIndexBuffer: boolean = true;

  private _renderContext: RenderContext;
  private _gpuMemoryReader: GPUMemoryReader;
  private _program: WebGLProgram | null;

  /**
   * Compilation errors encountered during program initialization.
   * Available after `init()` is called.
   */
  public errors: string[];

  /**
   * When true, the technique binds silhouette-related uniforms using "edge" material
   * settings (edgeColor/edgeAlpha) instead of fill settings (fillColor/fillAlpha).
   *
   * Used by silhouette-like techniques that can render both filled silhouettes
   * and edge silhouettes.
   */
  public edges: boolean;

  /**
   * When true, the technique binds uniforms for picking rendering (e.g., pickZNear/pickZFar)
   * and uses picking-specific draw ranges from the batch's view data textures.
   *
   * Used by the pick rendering pass to render meshes with unique pick colors and output depth for picking.
   */
  public picking: boolean;

  /**
   * Snap-pass mode flag.
   *
   *   - `0` (default) — not a snap pass.
   *   - `3`           — snap-init pass: triangles render to populate the
   *                     snap FBO's depth + view-position outputs (uses
   *                     `gl.TRIANGLES`, same index buffer as colour pass).
   *   - `2`           — edge snap: edge-index buffer drawn as `gl.LINES`.
   *   - `1`           — vertex snap: every unique vertex drawn as a
   *                     1-pixel `gl.POINTS` (no index buffer).
   *
   * Snap techniques bind the shared snap uniforms (drawing-buffer size,
   * snap clip-pos centre, snap z-range — same shape as the picking
   * uniforms) and write view-space position into an RGBA32F MRT target
   * the renderer scans on read-back.
   */
  public snap: 0 | 1 | 2 | 3;

  /**
   * When true, the technique compiles a vertex normal sampler into its shaders
   * and reads smooth view-space normals from the batch's
   * {@link BatchDataTextures.vertexNormalTexture}. When false, the fragment
   * shader derives a flat face normal from `dFdx/dFdy(vViewPos)`.
   *
   * This is the per-batch axis the renderer dispatches on — only the Lambert
   * colour techniques are paired into `{false, true}` variants; edge,
   * silhouette, pick and snap techniques keep the single flat-shaded path.
   */
  public hasNormals: boolean;

  /**
   * When true, the technique compiles a vertex UV sampler into its shaders
   * and emits a `vUV` varying for downstream texture sampling. Independent
   * axis from {@link hasNormals}; combined into a 4-way variant lookup on
   * the Lambert colour techniques.
   */
  public hasUVs: boolean;

  /**
   * Vertex shader source code. Available after `init()` is called.
   */
  public vertexShaderSrc: string;

  /**
   * Vertex shader source code with comments included.
   *
   * Note that comments are not supported in WebGL shader compilation,
   * so this is for debugging/inspection purposes only.
   *
   * Available after `init()` is called.
   */
  public vertexShaderCommentedSrc: string;

  /**
   * Fragment shader source code. Available after `init()` is called.
   */
  public fragmentShaderSrc: string;

  /**
   * Fragment shader source code with comments included.
   *
   * Note that comments are not supported in WebGL shader compilation,
   * so this is for debugging/inspection purposes only.
   *
   * Available after `init()` is called.
   */
  public fragmentShaderCommentedSrc: string;

  /**
   * Uniforms and attributes for the shader program.
   * Populated during the `build()` method based on what's included in the shader source.
   */
  private _uniforms: {
    renderPass: WebGLUniformLocation; // Current draw pass (e.g., color, pick, silhouette)
    primBaseIndex: WebGLUniformLocation; // Base tileIndex for the current draw call
    pointCloudIntensityRange: WebGLUniformLocation; // Intensity range for point cloud rendering
    nearPlaneHeight: WebGLUniformLocation; // Near plane height for perspective point size calculation
    silhouetteColor: WebGLUniformLocation; // Color used for silhouette rendering
    gammaFactor: WebGLUniformLocation; // Gamma correction factor
    pickZNear: WebGLUniformLocation; // Near plane for pick rendering
    batchIndex: WebGLUniformLocation; // Batch index for pick rendering
    snapCameraEyeRTC: WebGLUniformLocation; // Snapped camera eye position in RTC space
    perspectivePoints: WebGLUniformLocation; // Whether to use perspective point size
    perspectivePointsMinMax: WebGLUniformLocation; // Min/max point size for perspective points
    roundPoints: WebGLUniformLocation; // Whether to render round points (vs. square)
    pointSize: WebGLUniformLocation; // Size of points for point rendering
    intensityRange: WebGLUniformLocation; // Intensity range for point rendering
    pickZFar: WebGLUniformLocation; // Far plane for rendering pick depth
    pickClipPos: WebGLUniformLocation; // Clip-space position for pick rendering (used to reconstruct view ray)
    snapClipPos: WebGLUniformLocation; // Cursor's clip-space position for the snap pass viewport remap
    snapBufferSize: WebGLUniformLocation; // Snap FBO size (px) — used to scale the remapSnapClipPos transform
    drawingBufferSize: WebGLUniformLocation; // Size of the drawing buffer (canvas) in pixels, used for pick ray calculations
    sectionPlanes: any[];
    projMatrix: WebGLUniformLocation;
    lightPos: WebGLUniformLocation[];
    lightDir: WebGLUniformLocation[];
    lightColor: WebGLUniformLocation[];
    lightAttenuation: WebGLUniformLocation[];
    lightAmbient: WebGLUniformLocation;
    primaryLightDirView: WebGLUniformLocation;
    iblMaxSpecularMipLevel: WebGLUniformLocation;
    iblViewToWorldRot: WebGLUniformLocation;
    saoParams: WebGLUniformLocation;
    shadowLightVP: WebGLUniformLocation;       // singular — depth pass uses one cascade at a time
    shadowLightVPs: WebGLUniformLocation;      // mat4[MAX_SHADOW_CASCADES] — color pass picks per fragment
    shadowCascadeSplits: WebGLUniformLocation; // vec4 — view-space |z| boundaries between cascades
    shadowCascadeCount: WebGLUniformLocation;  // int — how many entries of the arrays carry data
    shadowParams: WebGLUniformLocation;
    shadowPcfRadius: WebGLUniformLocation;
    shadowSlope: WebGLUniformLocation;
    edgeFadeRange: WebGLUniformLocation; // vec2(start, end) view-space distances; only edge techniques declare this
    iblIntensity:        WebGLUniformLocation;  // float — gates the cubemap diffuse + specular contribution
    hemisphereIntensity: WebGLUniformLocation;  // float — gates the analytical hemisphere ambient term
    hemisphereSky:       WebGLUniformLocation;  // vec3 linear-RGB sky colour
    hemisphereGround:    WebGLUniformLocation;  // vec3 linear-RGB ground colour
    hemisphereUpView:    WebGLUniformLocation;  // vec3 world-up direction expressed in view space
  };

  /**
   * Attributes for the shader program.
   */
  private _attributes: {};

  /**
   * Samplers for the shader program.
   */
  private _samplers: {
    primitiveMeshIndex: WebGLUniformLocation; // Prim tileIndex -> mesh lookup
    meshAttributeTexture: WebGLUniformLocation; // Mesh attributes
    meshViewAttributeTexture: WebGLUniformLocation; // Mesh view attributes
    meshMatrixTexture: WebGLUniformLocation; // RTC modeling matrices
    geometryAttributes: WebGLUniformLocation; // Geometry attributes
    geometryQuantRangeTexture: WebGLUniformLocation; // Quantization ranges
    vertexPositionTexture: WebGLUniformLocation; // Quantized vertex positions
    vertexColorTexture: WebGLUniformLocation; // Vertex RGB colors
    vertexNormalTexture: WebGLUniformLocation | null; // Octahedral RG16UI vertex normals (only when hasNormals)
    vertexUVTexture: WebGLUniformLocation | null; // RG32F vertex UVs (only when hasUVs)
    albedoAtlas: WebGLUniformLocation | null; // sRGB 2D albedo atlas (only when hasUVs)
    metallicRoughnessAtlas: WebGLUniformLocation | null; // Linear 2D metallic-roughness atlas (only when hasUVs)
    normalMapAtlas: WebGLUniformLocation | null; // Linear 2D tangent-space normal-map atlas (only when hasUVs)
    iblIrradianceCubemap: WebGLUniformLocation | null; // Diffuse-convolved cubemap (only when hasNormals)
    iblPrefilteredCubemap: WebGLUniformLocation | null; // GGX-prefiltered cubemap (only when hasNormals)
    iblBRDFLUT: WebGLUniformLocation | null; // 2D split-sum BRDF LUT (only when hasNormals)
    indexTexture: WebGLUniformLocation; // Primitive connectivity indices
    edgeIndexTexture: WebGLUniformLocation; // Edge connectivity indices
    viewTileCameraMatrixTexture: WebGLUniformLocation; // GPUTile view matrices
    saoOcclusionTexture: WebGLUniformLocation; // SAO occlusion texture
    shadowMapTexture: WebGLUniformLocation;         // singular — depth pass (not used today, kept for symmetry)
    shadowMap0: WebGLUniformLocation;               // per-cascade shadow-map samplers (color pass)
    shadowMap1: WebGLUniformLocation;
    shadowMap2: WebGLUniformLocation;
    shadowMap3: WebGLUniformLocation;
    shadowMap4: WebGLUniformLocation;
    shadowMap5: WebGLUniformLocation;
  };

  /**
   * Temp vertex shader source _buffer.
   */
  private _vertSrcBuf: string[];

  /**
   * Temp fragment shader source _buffer.
   */
  private _fragSrcBuf: string[];


  /**
   * Creates a new DrawTechnique.
   *
   * @param renderContext
   * @param gpuMemoryReader
   * @param cfg
   */
  constructor(renderContext: RenderContext, gpuMemoryReader: GPUMemoryReader, cfg: {
    edges?: boolean,
    picking?: boolean,
    snap?: 0 | 1 | 2 | 3,
    hasNormals?: boolean,
    hasUVs?: boolean,
  } = {
    edges: false,
    picking: false,
    snap: 0,
    hasNormals: false,
    hasUVs: false
  }) {
    if (cfg.picking && cfg.edges) { // Edges are an un-pickable visual effect
      throw new Error("Invalid DrawTechnique configuration: cannot have both picking and edges enabled.");
    }
    if (cfg.snap && cfg.picking) {
      throw new Error("Invalid DrawTechnique configuration: cannot have both picking and snap enabled.");
    }
    this._renderContext = renderContext;
    this._gpuMemoryReader = gpuMemoryReader;
    this.edges = cfg.edges === true;
    this.picking = cfg.picking === true;
    this.snap = (cfg.snap ?? 0) as (0 | 1 | 2 | 3);
    this.hasNormals = cfg.hasNormals === true;
    this.hasUVs = cfg.hasUVs === true;
    this._program = null;
  }

  /**
   * Initializes this draw technique by building and compiling the shader program.
   *
   * Calls the abstract methods {@link buildVertexShader} and {@link buildFragmentShader} to generate the shader sources,
   * then compiles the program and retrieves uniform/sampler locations.
   */
  public init(): SDKResult<any> {

    this._vertSrcBuf = [];
    this._fragSrcBuf = [];

    this.buildVertexShader();
    this.buildFragmentShader();

    const vertSrc = [];
    const vertCommentedSrc = [];

    const fragSrc = [];
    const fragCommentedSrc = [];

    joinSrc(this._vertSrcBuf, vertSrc, vertCommentedSrc);
    joinSrc(this._fragSrcBuf, fragSrc, fragCommentedSrc);

    this.vertexShaderSrc = vertSrc.join("\n");
    this.fragmentShaderSrc = fragSrc.join("\n");

    this.vertexShaderCommentedSrc = vertCommentedSrc.join("\n");
    this.fragmentShaderCommentedSrc = fragCommentedSrc.join("\n");

    this._program = new WebGLProgram(this._renderContext as WebGLContextProvider, {
      vertex: this.vertexShaderSrc,
      fragment: this.fragmentShaderSrc,
    });

    this._vertSrcBuf = [];
    this._fragSrcBuf = [];

    return this._initProgram();
  }

  /**
   * Notifies draw technique that the WebGL context has been restored.
   *
   * This allows the technique to recreate its shaders after context loss.
   *
   * @returns Result indicating success or failure.
   */
  webglContextRestored(): SDKResult<void> {
    if (!this._program) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[DrawTechnique.webglContextRestored] Shader program is not initialized."
      };
    }
    return this._initProgram();
  }

  /**
   * Initializes the shader program by compiling/linking and retrieving uniform/sampler locations.
   * @private
   */
  private _initProgram(): SDKResult<any> {

    const result = this._program.init();

    if (result.ok === false) {
      return result;
    }

    const program = this._program;

    this._uniforms = {
      primBaseIndex: program.getLocation("uPrimBaseIndex"),
      renderPass: program.getLocation("uRenderPass"),
      gammaFactor: program.getLocation("uGammaFactor"),
      projMatrix: program.getLocation("uProjMatrix"),
      snapCameraEyeRTC: program.getLocation("snapCameraEyeRTC"),
      perspectivePoints: program.getLocation("uPerspectivePoints"),
      perspectivePointsMinMax: program.getLocation("uPerspectivePointsMinMax"),
      roundPoints: program.getLocation("uRoundPoints"),
      pointSize: program.getLocation("pointSize"),
      intensityRange: program.getLocation("intensityRange"),
      nearPlaneHeight: program.getLocation("uNearPlaneHeight"),
      pointCloudIntensityRange: program.getLocation("pointCloudIntensityRange"),
      pickZNear: program.getLocation("pickZNear"),
      pickZFar: program.getLocation("pickZFar"),
      pickClipPos: program.getLocation("pickClipPos"),
      snapClipPos: program.getLocation("snapClipPos"),
      snapBufferSize: program.getLocation("snapBufferSize"),
      batchIndex: program.getLocation("batchIndex"),
      drawingBufferSize: program.getLocation("drawingBufferSize"),
      silhouetteColor: program.getLocation("uSilhouetteColor"),
      sectionPlanes: [],
      lightColor: [
        program.getLocation("uLightColor1"),
        program.getLocation("uLightColor2"),
        program.getLocation("uLightColor3")
      ],
      lightDir: [
        program.getLocation("uLightDir1"),
        program.getLocation("uLightDir2"),
        program.getLocation("uLightDir3")
      ],
      lightPos: [],
      lightAttenuation: [],
      lightAmbient: program.getLocation("uLightAmbient"),
      primaryLightDirView: program.getLocation("uPrimaryLightDirView"),
      saoParams: program.getLocation("saoParams"),
      shadowLightVP: program.getLocation("uShadowLightVP"),
      shadowLightVPs: program.getLocation("uShadowLightVPs[0]"),
      shadowCascadeSplits: program.getLocation("uShadowCascadeSplits[0]"),
      shadowCascadeCount: program.getLocation("uShadowCascadeCount"),
      shadowParams: program.getLocation("uShadowParams"),
      shadowPcfRadius: program.getLocation("uShadowPcfRadius"),
      shadowSlope: program.getLocation("uShadowSlope"),
      edgeFadeRange: program.getLocation("uEdgeFadeRange"),
      iblIntensity:        program.getLocation("uIBLIntensity"),
      hemisphereIntensity: program.getLocation("uHemisphereIntensity"),
      hemisphereSky:       program.getLocation("uHemisphereSky"),
      hemisphereGround:    program.getLocation("uHemisphereGround"),
      hemisphereUpView:    program.getLocation("uHemisphereUpView"),
      iblMaxSpecularMipLevel: program.getLocation("uIBLMaxSpecularMipLevel"),
      iblViewToWorldRot:      program.getLocation("uIBLViewToWorldRot")
    };

    // const lights = view.lightsList;
    // for (let i = 0, len = lights.length; i < len; i++) {
    //   const light = lights[i];
    //   if (light instanceof DirLight) {
    //     this._uniforms.lightColor[i] = program.getLocation("lightColor" + i);
    //     this._uniforms.lightPos[i] = null;
    //     this._uniforms.lightDir[i] = program.getLocation("lightDir" + i);
    //     break;
    //   } else {
    //     this._uniforms.lightColor[i] = program.getLocation("lightColor" + i);
    //     this._uniforms.lightPos[i] = program.getLocation("lightPos" + i);
    //     this._uniforms.lightDir[i] = null;
    //     this._uniforms.lightAttenuation[i] = program.getLocation("lightAttenuation" + i);
    //   }
    // }
    //
    // const uniforms = this._uniforms;
    //
    // for (let i = 0, len = view.sectionPlanesList.length; i < len; i++) {
    //   uniforms.sectionPlanes.push({
    //     active: program.getLocation("sectionPlaneActive" + i),
    //     pos: program.getLocation("sectionPlanePos" + i),
    //     dir: program.getLocation("sectionPlaneDir" + i)
    //   });
    // }

    this._attributes = {};

    this._samplers = {
      primitiveMeshIndex: program.getSampler("uPrimitiveMeshIndexTexture"),
      meshAttributeTexture: program.getSampler("uMeshAttributeTexture"),
      meshViewAttributeTexture: program.getSampler("uMeshViewAttributeTexture"),
      meshMatrixTexture: program.getSampler("uMeshMatrixTexture"),
      geometryAttributes: program.getSampler("uGeometryAttributeTexture"),
      geometryQuantRangeTexture: program.getSampler("uGeometryQuantRangeTexture"),
      viewTileCameraMatrixTexture: program.getSampler("uViewTileCameraMatrixTexture"),
      vertexPositionTexture: program.getSampler("uVertexPositionTexture"),
      vertexColorTexture: program.getSampler("uVertexColorTexture"),
      vertexNormalTexture: this.hasNormals ? program.getSampler("uVertexNormalTexture") : null,
      vertexUVTexture: this.hasUVs ? program.getSampler("uVertexUVTexture") : null,
      albedoAtlas: this.hasUVs ? program.getSampler("uAlbedoAtlas") : null,
      metallicRoughnessAtlas: this.hasUVs ? program.getSampler("uMetallicRoughnessAtlas") : null,
      normalMapAtlas: this.hasUVs ? program.getSampler("uNormalMapAtlas") : null,
      iblIrradianceCubemap: this.hasNormals ? program.getSampler("uIBLIrradianceCubemap") : null,
      iblPrefilteredCubemap: this.hasNormals ? program.getSampler("uIBLPrefilteredCubemap") : null,
      iblBRDFLUT: this.hasNormals ? program.getSampler("uIBLBRDFLUT") : null,
      indexTexture: program.getSampler("uIndexTexture"),
      edgeIndexTexture: program.getSampler("uEdgeIndexTexture"), // TODO: Maybe redundant
      saoOcclusionTexture: program.getSampler("saoOcclusionTexture"),
      shadowMapTexture: program.getSampler("uShadowMapTexture"),
      shadowMap0: program.getSampler("uShadowMap0"),
      shadowMap1: program.getSampler("uShadowMap1"),
      shadowMap2: program.getSampler("uShadowMap2"),
      shadowMap3: program.getSampler("uShadowMap3"),
      shadowMap4: program.getSampler("uShadowMap4"),
      shadowMap5: program.getSampler("uShadowMap5")
    };

    return {
      ok: true,
      value: null
    };
  }

  /**
   * Notifies draw technique that the WebGL context has been lost.
   */
  webglContextLost() {
  }

  /**
   * Draws a batch of meshes for the specified render pass.
   */
  public drawBatch(meshBatch: MeshBatch, renderPass: RenderPassValue): SDKResult<any> {
    return this._draw(meshBatch, renderPass);
  }

  /**
   * Draws a specific mesh within a batch, for the specified render pass.
   */
  public drawMesh(meshBatch: MeshBatch, meshIndex: number, renderPass: RenderPassValue): SDKResult<any> {
    return this._draw(meshBatch, renderPass, meshIndex);
  }

  private _draw(meshBatch: MeshBatch, renderPass: RenderPassValue, meshIndex?: number): SDKResult<any> {

    if (!this._program) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[DrawTechnique._draw] Shader program is not initialized."
      };
    }

    const renderContext = this._renderContext;
    const view = renderContext.activeView;
    const gl = this._renderContext.gl;
    const samplers = this._samplers;
    const dataTextures = this._gpuMemoryReader.dataTextures;
    const batchDataTextures = dataTextures.batches[meshBatch.gpuMemoryBatchIndex];
    const viewIndex = view.viewIndex;
    const batchViewDataTextures = batchDataTextures.views[viewIndex];

    const drawRange =
      this.snap
        // Snap-init draws triangle surfaces (pickPrimitiveRange);
        // snap-vertex and snap-edge both ride the edge index buffer
        // (pickEdgePrimitiveRange) so neither lands on interior
        // diagonals or coplanar triangulation seams.
        ? (this.edges
            ? batchViewDataTextures.pickEdgePrimitiveRange
            : batchViewDataTextures.pickPrimitiveRange)
        : (this.edges
            ? batchViewDataTextures.renderPassEdgePrimitiveRanges.get(renderPass)
            : (this.picking
                ? batchViewDataTextures.pickPrimitiveRange
                : batchViewDataTextures.renderPassPrimitiveRanges.get(renderPass)));

    if (!drawRange || drawRange.numPrims === 0) {
      return {
        ok: true,
        value: null // Nothing to draw for this pass
      };
    }

    const drawInspector
      = (renderContext.renderInspector && renderContext.renderInspector.enabled)
      ? renderContext.renderInspector
      : null;

    if (!this._bind(renderPass)) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[DrawTechnique._draw] Failed to bind the shader program."
      };
    }

    const primitiveMeshIndexTexture
      = this.edges
      ? batchViewDataTextures.edgeMeshIndexTexture
      : batchViewDataTextures.primitiveMeshIndexTexture;

    renderContext.textureUnit = 0;

    // TODO: Avoid re-binding this set of textures if already bound for this batch.

    this._bindTexture(samplers.viewTileCameraMatrixTexture,
      (this._renderContext.rayPicking
        ? dataTextures.viewTilePickMatrixTexture
        : dataTextures.viewTileCameraMatrixTexture)
        [view.viewIndex]);

    this._bindTexture(samplers.primitiveMeshIndex, primitiveMeshIndexTexture);
    this._bindTexture(samplers.vertexPositionTexture, batchDataTextures.vertexPositionTexture);
    this._bindTexture(samplers.vertexColorTexture, batchDataTextures.vertexColorTexture);
    if (this.hasNormals && batchDataTextures.vertexNormalTexture) {
      this._bindTexture(samplers.vertexNormalTexture, batchDataTextures.vertexNormalTexture);
    }
    if (this.hasUVs && batchDataTextures.vertexUVTexture) {
      this._bindTexture(samplers.vertexUVTexture, batchDataTextures.vertexUVTexture);
    }
    if (this.hasUVs && batchDataTextures.albedoAtlasTexture && batchDataTextures.albedoAtlasTexture.texture) {
      // The atlas isn't a DataTexture (no CPU buffer, no texelFetch — it's
      // a real sampler2D), but its `.texture` field is shape-compatible
      // with `_bindTexture`'s expectations.
      this._bindTexture(samplers.albedoAtlas, batchDataTextures.albedoAtlasTexture);
    }
    if (this.hasUVs && batchDataTextures.metallicRoughnessAtlasTexture && batchDataTextures.metallicRoughnessAtlasTexture.texture) {
      this._bindTexture(samplers.metallicRoughnessAtlas, batchDataTextures.metallicRoughnessAtlasTexture);
    }
    if (this.hasUVs && batchDataTextures.normalMapAtlasTexture && batchDataTextures.normalMapAtlasTexture.texture) {
      this._bindTexture(samplers.normalMapAtlas, batchDataTextures.normalMapAtlasTexture);
    }
    // IBL Layer-2 cubemaps + BRDF LUT — populated on RenderContext by
    // RenderManager._prepareIBL once per view. Only the smooth-shaded
    // technique variant declares the matching uniforms; the bind is a
    // no-op when sampler locations are null (flat-shaded variant).
    if (this.hasNormals) {
      this._bindCubemap(samplers.iblIrradianceCubemap, renderContext.iblIrradianceCubemap);
      this._bindCubemap(samplers.iblPrefilteredCubemap, renderContext.iblPrefilteredCubemap);
      if (samplers.iblBRDFLUT && renderContext.iblBRDFLUT) {
        this._bindTexture(samplers.iblBRDFLUT, { texture: renderContext.iblBRDFLUT });
      }
    }
    this._bindTexture(samplers.meshMatrixTexture, batchDataTextures.meshMatrixTexture);
    this._bindTexture(samplers.meshAttributeTexture, batchDataTextures.meshAttributeTexture);
    this._bindTexture(samplers.meshViewAttributeTexture, batchViewDataTextures.meshViewAttributeTexture);
    this._bindTexture(samplers.geometryAttributes, batchDataTextures.geometryAttributeTexture);
    this._bindTexture(samplers.geometryQuantRangeTexture, batchDataTextures.geometryQuantRangeTexture);
    //   this._bindTexture(samplers.edgeIndexTexture, batchDataTextures.edgeIndexTexture); // TODO: Redundant?
    this._bindTexture(samplers.indexTexture,
      this.edges
        ? batchDataTextures.edgeIndexTexture
        : batchDataTextures.indexTexture);

    // Bind SAO occlusion texture after all per-batch data textures so its texture
    // unit isn't clobbered by the data-texture bindings above.
    this._bindSAOTexture();
    this._bindShadowMapTexture();

    if (this._uniforms.batchIndex) {
      gl.uniform1ui(this._uniforms.batchIndex, meshBatch.gpuMemoryBatchIndex);
    }

    gl.uniform1i(this._uniforms.primBaseIndex, 0);

    switch (meshBatch.primitive) {
      case TrianglesPrimitive:
        if (this.snap === 1) {
          // Vertex-snap rides the edge index buffer (2 indices per
          // edge, each index being a vertex) — every drawArrays
          // POINT lands on a real geometric corner. Drawing
          // `numEdges * 2` POINTS produces duplicate hits on shared
          // endpoints, but each duplicate lands on the same FBO
          // texel, so it's harmless.
          gl.drawArrays(gl.POINTS, drawRange.firstPrim * 2, drawRange.numPrims * 2);
        } else if (this.snap === 2 || this.edges) {
          gl.drawArrays(gl.LINES, drawRange.firstPrim * 2, drawRange.numPrims * 2); // Edges / edge-snap draw range
        } else {
          gl.drawArrays(gl.TRIANGLES, drawRange.firstPrim * 3, drawRange.numPrims * 3); // Triangles draw range
        }
        break;
      case LinesPrimitive:
        gl.drawArrays(gl.LINES, drawRange.firstPrim * 2, drawRange.numPrims * 2);
        break;
      case PointsPrimitive:
        gl.drawArrays(gl.POINTS, drawRange.firstPrim, drawRange.numPrims);
        break;
      default:
        return {
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `[DrawTechnique._draw] Unsupported Batch primitive type: ${meshBatch.primitive}`
        };
    }

    drawInspector?.drawMeshBatch(meshBatch, renderPass, {
      firstPrim: drawRange.firstPrim,
      numPrims: drawRange.numPrims
    });

    return {
      ok: true,
      value: null
    };
  }

  /**
   * Abstract method to build the vertex shader source code.
   * Subclasses must implement this method to define the fragment shader logic
   * based on their specific rendering requirements.
   * Called during `init()`.
   */
  protected abstract buildVertexShader();

  /**
   * Abstract method to build the fragment shader source code.
   * Subclasses must implement this method to define the fragment shader logic
   * based on their specific rendering requirements.
   * Called during `init()`.
   */
  protected abstract buildFragmentShader();

  /**
   * Appends a raw GLSL snippet to the vertex shader source being built.
   */
  protected vsCode(src) {
    this._vertSrcBuf.push(src);
  }

  /**
   * Appends a raw GLSL snippet to the fragment shader source being built.
   */
  protected fsCode(src) {
    this._fragSrcBuf.push(src);
  }

  /**
   * Emits the vertex shader version directive and identifying comment.
   */
  protected vsHeader() {
    this._vertSrcBuf
      .push(`#version 300 es

// ${this.constructor.name} vertex shader

// This shader renders primitives by fetching all geometry,
// transform, and attribute data from GPU data textures.
// The pipeline is:
//   gl_VertexID → primitive → mesh → geometry → vertex → model → world → view → clip`);
  }

  /**
   * Emits uniforms, samplers, structs, and GPU data-texture helper functions shared by all
   * techniques.  Every vertex shader calls this once, right after {@link vsHeader}.
   */
  protected vsCommonDeclarations() {
    this._vertSrcBuf.push(`

// ─────────────────────────────────────────────────────────────
// Global draw configuration
// ─────────────────────────────────────────────────────────────

uniform int uRenderPass;
uniform int uPrimBaseIndex;

uniform mat4 uProjMatrix;

// ─────────────────────────────────────────────────────────────
// GPU data textures (structured storage via texelFetch)
// ─────────────────────────────────────────────────────────────

uniform highp usampler2D uPrimitiveMeshIndexTexture;
uniform highp usampler2D uVertexPositionTexture;
uniform highp usampler2D uVertexColorTexture;${this.hasNormals ? `
uniform highp usampler2D uVertexNormalTexture;` : ``}${this.hasUVs ? `
uniform highp sampler2D  uVertexUVTexture;` : ``}
uniform highp usampler2D uIndexTexture;
// uniform highp usampler2D uEdgeIndexTexture;
uniform highp sampler2D  uViewTileCameraMatrixTexture;
uniform highp sampler2D  uMeshMatrixTexture;
uniform highp usampler2D uMeshAttributeTexture;
uniform highp usampler2D uMeshViewAttributeTexture;
uniform highp usampler2D uGeometryAttributeTexture;
uniform highp sampler2D  uGeometryQuantRangeTexture;

// ─────────────────────────────────────────────────────────────
// Data structures stored inside textures
// ─────────────────────────────────────────────────────────────

struct QuantRange {
  vec3 offset;
  vec3 scale;
};

struct MeshAttribTable {
  uint tileIndex;
  uint geometryIndex;
  // Packed Cook-Torrance material: byte 0 = roughness, byte 1 = metallic
  // (each in 0..255, mapped from [0, 1]). Bytes 2-3 are reserved for
  // future per-mesh material flags. Only consumed by the smooth-shaded
  // technique variant; flat-shaded shaders ignore it.
  uint material;
  // Packed alpha attributes: byte 0 = alphaMode (0=OPAQUE, 1=MASK,
  // 2=BLEND), byte 1 = alphaCutoff (0..255, mapped from [0, 1]).
  // Drives the per-fragment discard for cutout materials.
  uint alpha;
  // Packed atlas UV transforms — one (offset, scale) pair per PBR map
  // type. Each value is a u16 in normalised [0, 1] form, R = lo. Only
  // consumed by the UV-bearing technique variant.
  uint albedoUVOffsetPacked;
  uint albedoUVScalePacked;
  uint mrUVOffsetPacked;
  uint mrUVScalePacked;
  uint normalUVOffsetPacked;
  uint normalUVScalePacked;
};

struct MeshViewAttributes {
  uvec4 color;
  uvec4 renderFlags;
};

struct GeometryAttributes {
  uint verticesBase;
  uint indicesBase;
  uint edgeIndicesBase;
  uint normalsBase;
  uint uvsBase;
};

// ─────────────────────────────────────────────────────────────
// Utility: Convert linear index → 2D texture coordinate
// ─────────────────────────────────────────────────────────────

ivec2 texCoord(uint index, uint texWidth) {
  return ivec2(int(index % texWidth), int(index / texWidth));
}

// ─────────────────────────────────────────────────────────────
// Primitive lookups
// ─────────────────────────────────────────────────────────────

// Each texel stores (meshIndex, primOffsetWithinGeometry) in .r/.g.
// RG32UI format: 1 texel per primitive, replacing the old 2-texel R32UI layout.
uvec2 getPrimData(uint primIndex) {
  const uint texWidth = 4096u;
  return texelFetch(uPrimitiveMeshIndexTexture, texCoord(primIndex, texWidth), 0).rg;
}

// ─────────────────────────────────────────────────────────────
// Vertex + index fetch
// ─────────────────────────────────────────────────────────────

uint getVertexIndex(uint vertexIndexNum) {
  const uint texWidth = 4096u;
  return texelFetch(uIndexTexture, texCoord(vertexIndexNum, texWidth), 0).r;
}

uvec3 getVertexPosition(uint vertexIndexWithinGeometry) {
  const uint texWidth = 4096u;
  return texelFetch(uVertexPositionTexture, texCoord(vertexIndexWithinGeometry, texWidth), 0).rgb;
}

uvec4 getVertexColor(uint vertexIndexWithinGeometry) {
  const uint texWidth = 4096u;
  return texelFetch(uVertexColorTexture, texCoord(vertexIndexWithinGeometry, texWidth), 0).rgba;
}${this.hasNormals ? `

// Octahedral RG16UI normal fetch + decode. The encoder maps unit-vector
// octahedral coords from [-1, 1] to [0, 65535]; we undo that, then run the
// standard signed-zero unwrap before normalising. Decoding in the vertex
// stage so the varying is a vec3 — interpolating octahedral coords across
// the triangle would produce incorrect normals.
uvec2 getVertexNormalPacked(uint vertexIndexWithinGeometry) {
  const uint texWidth = 4096u;
  return texelFetch(uVertexNormalTexture, texCoord(vertexIndexWithinGeometry, texWidth), 0).rg;
}

vec3 octDecodeNormalU16(uvec2 packed) {
  vec2 e = vec2(packed) / 65535.0 * 2.0 - 1.0;
  vec3 n = vec3(e.xy, 1.0 - abs(e.x) - abs(e.y));
  if (n.z < 0.0) {
    vec2 sgn = vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
    n.xy = (1.0 - abs(n.yx)) * sgn;
  }
  return normalize(n);
}` : ``}${this.hasUVs ? `

// Per-vertex UV fetch. UVs are stored as raw RG32F floats so tiling
// values (UVs outside [0, 1]) round-trip through the GPU intact — the
// fragment stage applies fract() before transforming into the per-mesh
// atlas sub-rect, which is what makes tiled materials sample correctly.
vec2 getVertexUV(uint vertexIndexWithinGeometry) {
  const uint texWidth = 4096u;
  return texelFetch(uVertexUVTexture, texCoord(vertexIndexWithinGeometry, texWidth), 0).rg;
}` : ``}

// ─────────────────────────────────────────────────────────────
// Geometry + mesh metadata fetch
// ─────────────────────────────────────────────────────────────

QuantRange getGeometryQuantRange(uint geometryIndex) {
  const uint texWidth = 2048u;
  const uint texelsPerItem = 2u;
  uint base = geometryIndex * texelsPerItem;
  vec4 texel0 = texelFetch(uGeometryQuantRangeTexture, texCoord(base + 0u, texWidth), 0);
  vec4 texel1 = texelFetch(uGeometryQuantRangeTexture, texCoord(base + 1u, texWidth), 0);
  QuantRange r;
  r.offset = texel0.rgb;
  r.scale  = texel1.rgb;
  return r;
}

GeometryAttributes getGeometryAttributeTexture(uint geometryIndex) {
  // Two texels per geometry — the texture holds 8 u32 slots of metadata
  // per item to leave room for future per-attribute base addresses.
  const uint texWidth = 4096u;
  const uint texelsPerItem = 2u;
  uint base = geometryIndex * texelsPerItem;
  uvec4 t0 = texelFetch(uGeometryAttributeTexture, texCoord(base + 0u, texWidth), 0);
  uvec4 t1 = texelFetch(uGeometryAttributeTexture, texCoord(base + 1u, texWidth), 0);
  GeometryAttributes s;
  s.verticesBase    = t0.r;
  s.indicesBase     = t0.g;
  s.edgeIndicesBase = t0.b;
  s.normalsBase     = t0.a;
  s.uvsBase         = t1.r;
  return s;
}

MeshAttribTable getMeshAttribTable(uint meshIndex) {
  // Three texels per mesh — texel 0 holds tile/geometry/material/flags;
  // texel 1 holds the albedo + MR UV transforms; texel 2 holds the
  // normal-map UV transform plus reserved slots for occlusion/emissive.
  // Layout matches MeshAttributeTexture's setItem.
  const uint texWidth = 4096u;
  const uint texelsPerItem = 3u;
  uint base = meshIndex * texelsPerItem;
  uvec4 t0 = texelFetch(uMeshAttributeTexture, texCoord(base + 0u, texWidth), 0);
  uvec4 t1 = texelFetch(uMeshAttributeTexture, texCoord(base + 1u, texWidth), 0);
  uvec4 t2 = texelFetch(uMeshAttributeTexture, texCoord(base + 2u, texWidth), 0);
  MeshAttribTable s;
  s.tileIndex            = t0.r;
  s.geometryIndex        = t0.g;
  s.material             = t0.b;
  s.alpha                = t0.a;
  s.albedoUVOffsetPacked = t1.r;
  s.albedoUVScalePacked  = t1.g;
  s.mrUVOffsetPacked     = t1.b;
  s.mrUVScalePacked      = t1.a;
  s.normalUVOffsetPacked = t2.r;
  s.normalUVScalePacked  = t2.g;
  return s;
}

// Unpacks the packed Cook-Torrance material into (roughness, metallic).
// Cheap: two bit ops + one divide.
vec2 unpackRoughnessMetallic(uint packed) {
  return vec2(
    float(packed & 0xFFu),
    float((packed >> 8u) & 0xFFu)
  ) / 255.0;
}

// Unpacks two u16s in [0, 65535] (R = lo, G = hi) to a vec2 in [0, 1].
// WebGL2's GLSL ES 3.00 doesn't have unpackUnorm2x16, so do it manually.
vec2 unpackUnorm2x16FromU32(uint packed) {
  return vec2(
    float(packed & 0xFFFFu),
    float((packed >> 16u) & 0xFFFFu)
  ) / 65535.0;
}

MeshViewAttributes getMeshViewAttributes(uint meshIndex) {
  const uint texWidth = 4096u;
  uint base = meshIndex * 2u;
  MeshViewAttributes s;
  s.color       = texelFetch(uMeshViewAttributeTexture, texCoord(base + 0u, texWidth), 0);
  s.renderFlags = texelFetch(uMeshViewAttributeTexture, texCoord(base + 1u, texWidth), 0);
  return s;
}

// ─────────────────────────────────────────────────────────────
// Matrix fetch (stored as 4 consecutive texels per matrix)
// ─────────────────────────────────────────────────────────────

mat4 getTileViewMatrix(uint tileIndex) {
  const uint texWidth = 4096u;
  uint base = tileIndex * 4u;
  vec4 m0 = texelFetch(uViewTileCameraMatrixTexture, texCoord(base + 0u, texWidth), 0);
  vec4 m1 = texelFetch(uViewTileCameraMatrixTexture, texCoord(base + 1u, texWidth), 0);
  vec4 m2 = texelFetch(uViewTileCameraMatrixTexture, texCoord(base + 2u, texWidth), 0);
  vec4 m3 = texelFetch(uViewTileCameraMatrixTexture, texCoord(base + 3u, texWidth), 0);
  return mat4(m0, m1, m2, m3);
}

mat4 getMeshMatrix(uint meshIndex) {
  const uint texWidth = 4096u;
  uint base = meshIndex * 4u;
  vec4 m0 = texelFetch(uMeshMatrixTexture, texCoord(base + 0u, texWidth), 0);
  vec4 m1 = texelFetch(uMeshMatrixTexture, texCoord(base + 1u, texWidth), 0);
  vec4 m2 = texelFetch(uMeshMatrixTexture, texCoord(base + 2u, texWidth), 0);
  vec4 m3 = texelFetch(uMeshMatrixTexture, texCoord(base + 3u, texWidth), 0);
  return mat4(m0, m1, m2, m3);
}

// ─────────────────────────────────────────────────────────────
// Packs a uint into an RGBA color (each channel stores one byte).
// Little-endian byte order: R = least significant byte
// ─────────────────────────────────────────────────────────────

vec4 packUintToRGBA8(uint v) {
   return vec4(
     float( ( v        & 0xFFu)),
     float( ((v >> 8u) & 0xFFu)),
     float(((v >> 16u) & 0xFFu)),
     float(((v >> 24u) & 0xFFu))
   ) / 255.0;
}

`);
  }

  /**
   * Declares the uniforms and varyings required by Lambert shading:
   * three directional lights, ambient, the flat color varying, and the
   * view-space position varying (used by the fragment shader for face-normal
   * reconstruction via dFdx/dFdy).
   */
  protected vsLambertShadingDeclarations() {
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Lambertian directional lighting
// ─────────────────────────────────────────────────────────────
`,
      "uniform vec4 uLightAmbient;",
      "uniform vec3 uLightDir1;",
      "uniform vec4 uLightColor1;",
      "uniform vec3 uLightDir2;",
      "uniform vec4 uLightColor2;",
      "uniform vec3 uLightDir3;",
      "uniform vec4 uLightColor3;",
      "flat out vec4 vColor;",
      "out vec3 vViewPos;",
      // Smooth view-space normal varying. Only emitted on the hasNormals
      // technique variant; the flat-shaded variant keeps deriving the
      // normal in the fragment stage from `vViewPos` derivatives.
      ...(this.hasNormals ? [
        "out vec3 vViewNormal;",
        // Pre-decoded Cook-Torrance material (roughness, metallic), passed
        // flat so every fragment in a triangle sees the source mesh's
        // values verbatim. Decoding here keeps the fragment shader free of
        // bit-shifts on hot paths.
        "flat out vec2 vMaterial;"
      ] : []),
      // UV varying — only emitted on the hasUVs variant. The fragment
      // stage uses it together with the per-mesh atlas transforms to
      // sample each PBR-map atlas.
      ...(this.hasUVs ? [
        "out vec2 vUV;",
        // Per-mesh atlas UV transforms: `atlasUV = vUV * scale + offset`,
        // one pair per PBR-map type. Passed flat — the source values are
        // constant for every fragment of a given mesh, so interpolation
        // is wrong (and wasteful) here.
        "flat out vec2 vAlbedoUVOffset;",
        "flat out vec2 vAlbedoUVScale;",
        "flat out vec2 vMRUVOffset;",
        "flat out vec2 vMRUVScale;",
        "flat out vec2 vNormalUVOffset;",
        "flat out vec2 vNormalUVScale;",
        // Per-mesh alpha mode (0=OPAQUE, 1=MASK, 2=BLEND) and the MASK
        // cutoff threshold. Both flat — uniform across the mesh.
        "flat out uint  vAlphaMode;",
        "flat out float vAlphaCutoff;"
      ] : []));
  }

  /**
   * Declares the silhouette color uniform and flat color varying.
   */
  protected vsSilhouetteDeclarations() {
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Silhouette rendering
// ─────────────────────────────────────────────────────────────

uniform vec4 uSilhouetteColor;
flat out vec4 vColor;`);
  }

  /**
   * Declares the flat color varying used when each primitive carries a single solid color.
   */
  protected vsDrawFlatColorDeclarations() {
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Flat (per-mesh) color
// ─────────────────────────────────────────────────────────────

flat out vec4 vColor;`);
  }

  /**
   * Declares the flat color varying used when each vertex carries its own color.
   */
  protected vsDrawVertexColorDeclarations() {
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Per-vertex color
// ─────────────────────────────────────────────────────────────

flat out vec4 vColor;`);
  }

  /**
   * Declares the high-precision depth varying used for linearized depth rendering.
   */
  protected vsDrawDepthDeclarations() {
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// High-precision depth output
// ─────────────────────────────────────────────────────────────

out highp vec2 vHighPrecisionZW;`);
  }

  /**
   * Declares uniforms that control point size and perspective attenuation.
   */
  protected vsPointsDeclarations(): void {
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Point cloud sizing
// ─────────────────────────────────────────────────────────────

uniform float uNearPlaneHeight;
uniform vec2 intensityRange;
uniform int uPerspectivePoints;
uniform vec2 uPerspectivePointsMinMax;
uniform float pointSize;`);
  }

  /**
   * Declares the pick-pass uniforms, varyings, and the clip-space remapping helper
   * used to render into the pick framebuffer.
   */
  protected vsPickDeclarations() {
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Pick common rendering configuration
// ─────────────────────────────────────────────────────────────

uniform vec2 drawingBufferSize;
uniform vec2 pickClipPos;
uniform vec2 pickZRange;
uniform uint batchIndex;

flat out uint vBatchIndex;
flat out uint vMeshIndex;
     out vec4 vViewPosition;

// In pick rendering, we render meshes in their pick-space positions, which are derived from the clip-space
// positions but with XY remapped to [0,1] based on the viewport and with Z remapped to [0,1] based on the view's
// near/far planes. This allows us to encode the pick ID in the RGB channels of the rendered color,
// and reconstruct the view-space position from the depth (Z) channel. The function below performs the inverse
// of this remapping to get back to clip space for rendering.

vec4 remapPickClipPos(vec4 clipPos) {
    clipPos.xy /= clipPos.w;
    clipPos.xy = (clipPos.xy - pickClipPos) * drawingBufferSize;
    clipPos.xy *= clipPos.w;
    return clipPos;
}`);
  }

  /**
   * Declares the snap-pass uniforms, varyings, and the clip-space remapping
   * helper used to render into the snap framebuffer.
   *
   * Mirrors {@link vsPickDeclarations} (snap reuses the same "render into
   * a small viewport centred on the cursor" trick) but only emits the
   * varying the snap fragment shader actually consumes — high-precision
   * view-space position. The helper `remapSnapClipPos` is byte-identical
   * to `remapPickClipPos`; declared separately so a snap technique can be
   * built without dragging in the pick-only varyings (`vBatchIndex`,
   * `vMeshIndex`) that would compile-error if both helpers shared the
   * same uniform names.
   */
  protected vsSnapDeclarations() {
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Snap common rendering configuration
// ─────────────────────────────────────────────────────────────

uniform vec2 drawingBufferSize;   // Canvas drawing-buffer size (px)
uniform vec2 snapClipPos;         // Cursor in NDC (range [-1, 1])
uniform vec2 snapBufferSize;      // Snap FBO size (px)

out highp vec3 vSnapViewPosition;

// Remap the clip-space position so the rendered fragment lands in a
// small NDC region centred on the cursor. Scaling by
// (drawingBufferSize / snapBufferSize) maps a one-pixel offset on
// the canvas to a one-pixel offset on the snap FBO, so a
// snapRadius-pixel screen window lands flush against the FBO edges.
vec4 remapSnapClipPos(vec4 clipPos) {
    clipPos.xy /= clipPos.w;
    clipPos.xy = (clipPos.xy - snapClipPos) * (drawingBufferSize / snapBufferSize);
    clipPos.xy *= clipPos.w;
    return clipPos;
}`);
  }

  /**
   * Declares section-plane varyings (currently a stub pending section-plane support).
   */
  protected vsSlicingDeclarations() {
    // if (this._renderContext.view.getNumAllocatedSectionPlanes() > 0) {
    //   const src = this._vertSrcBuf;
    //   src.push("out vec4 vWorldPosition;");
    //   src.push("out boolean vClippable;");
    // }
  }

  /**
   * Opens the vertex shader main() and emits the full mesh/geometry/transform pipeline
   * (gl_VertexID → primitive → mesh → geometry → vertex → clip space).
   * Technique-specific logic is appended after this call, before {@link vsMainEnd}.
   */
  protected vsMainBegin() {
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Vertex shader main function
// ─────────────────────────────────────────────────────────────

void main(void) {`);
    this._vsMeshLogic();
    this._vsMeshLogic2();
  }

  /**
   * Opens the vertex shader main() for pick rendering.  Identical to {@link vsMainBegin}
   * but additionally reads and checks the per-mesh "pickable" render flag.
   */
  protected vsPickMainBegin() {
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Vertex shader main function (pick pass)
// ─────────────────────────────────────────────────────────────

void main(void) {`);
    this._vsMeshLogic();
    this._vertSrcBuf.push(
      `    uint pickable = meshViewAttributes.renderFlags.g;`,
      `    if (pickable == 255u) {`,
      "    }");
    this._vsMeshLogic2();
  }

  /**
   * Closes the vertex shader main() function.
   */
  protected vsMainEnd() {
    this._vertSrcBuf.push("}");
  }

  /**
   * Pulls the vertex a tiny fraction toward the camera in clip space so that
   * coplanar line/edge geometry wins depth-test ties against the triangle
   * surface it sits on. Subtracting `eps * gl_Position.w` from `gl_Position.z`
   * shifts NDC z by exactly `eps` regardless of vertex distance.
   *
   * Kept small on purpose: the depth buffer is non-linear with perspective,
   * so a constant NDC offset covers proportionally more *world* distance at
   * the far plane than at the near plane. Too large an offset and distant
   * edges start poking through the front of foreground geometry. `2e-5` is
   * still hundreds of times the 24-bit depth-buffer quantum — plenty to
   * win ties from rasterisation noise — while leaving the world-space
   * leakage at the far plane negligible.
   *
   * Emit AFTER {@link vsMainBegin} (which sets `gl_Position`) and before
   * {@link vsMainEnd}. Intended for edge/line techniques.
   */
  protected vsEdgeDepthBiasLogic() {
    this._vertSrcBuf.push("    gl_Position.z -= 2.0e-5 * gl_Position.w;");
  }

  /**
   * Declares the view-space depth varying consumed by {@link fsEdgeFadeLogic}.
   *
   * Used only by edge techniques. Kept separate from `vViewPos` (the full
   * view-space position used by Lambert shading) because edge techniques
   * don't need the xy components — uploading just the linear distance halves
   * the varying interpolation cost.
   */
  protected vsEdgeFadeDeclarations() {
    this._vertSrcBuf.push("out float vEdgeViewDist;");
  }

  /**
   * Writes positive view-space distance from the camera into the fade varying.
   * Camera looks down -Z, so the distance is `-viewPos.z`.
   *
   * Emit AFTER {@link vsMainBegin} so `viewPos` is in scope, and before
   * {@link vsMainEnd}.
   */
  protected vsEdgeFadeLogic() {
    this._vertSrcBuf.push("    vEdgeViewDist = -viewPos.z;");
  }

  /**
   * Declares the fragment-side fade uniform and matching varying.
   *
   * `uEdgeFadeRange` is `vec2(startDist, endDist)` in view-space units. The
   * CPU side derives both values from the active camera's far plane and the
   * view's `Edges.edgeFadeStart` / `edgeFadeEnd` knobs.
   */
  protected fsEdgeFadeDeclarations() {
    this._fragSrcBuf.push(
      "in float vEdgeViewDist;",
      "uniform vec2 uEdgeFadeRange;");
  }

  /**
   * Multiplies the working `color.a` by the fade factor.
   *
   * `smoothstep(start, end, dist)` is `0` at `dist <= start`, `1` at
   * `dist >= end`. We invert it so near edges keep full alpha and far edges
   * fade to zero. Branch-free: when `start >= end`, smoothstep collapses to a
   * step at `start`, which means edges past `start` simply disappear — that's
   * the documented "set start >= end to disable" path. To keep edges
   * fully opaque always, ship `start >= 1.0` AND `end >= 1.0`.
   *
   * Must run AFTER `fsSilhouetteLogic` (which writes `color = vColor`) and
   * BEFORE `fsOutputColor` (which premultiplies and emits the final RGBA).
   */
  protected fsEdgeFadeLogic() {
    this._fragSrcBuf.push(
      "    color.a *= 1.0 - smoothstep(uEdgeFadeRange.x, uEdgeFadeRange.y, vEdgeViewDist);");
  }

  /**
   * Emits section-plane clipping logic (currently a stub pending section-plane support).
   */
  protected vsSlicingLogic() {
    // if (this._renderContext.view.getNumAllocatedSectionPlanes() > 0) {
    //   const src = this._vertSrcBuf;
    //   src.push("      vWorldPosition = worldPos;");
    //   src.push("      vClippable = (int(uMeshViewAttributeTexture.renderFlags) >> 12 & 0xF) == 1;");
    // }
  }

  /**
   * Generates vertex shader logic for mesh processing.
   * @private
   */
  private _vsMeshLogic() { // before renderPass check
    this._vertSrcBuf.push(`
     // Identify which "draw vertex" we are processing
    uint drawVertexIndex  = uint(gl_VertexID);

    // Compile-time topology constant: 3 = triangles, 2 = lines, 1 = points.
    const uint numVertsPerPrim = ${this.vertsPerPrim}u;

    // Map draw vertex → draw primitive
    // Example (triangles): vertices 0,1,2 -> prim 0; 3,4,5 -> prim 1; etc.
    uint drawPrimIndex = drawVertexIndex / numVertsPerPrim;

    // Convert draw primitive → global primitive index
    // uPrimBaseIndex allows batching multiple draws into a big primitive table.
    uint primIndex = uint(uPrimBaseIndex) + drawPrimIndex;

    // Single texelFetch returns both meshIndex (.r) and primOffset (.g).
    uvec2 primData  = getPrimData( primIndex );
    uint meshIndex  = primData.r;
    uint primOffset = primData.g;

    // Fetch mesh view properties (color + flags)
    MeshViewAttributes meshViewAttributes = getMeshViewAttributes( meshIndex );

    // Cull fully-transparent meshes
    if (meshViewAttributes.color.a == 3u) {
      // gl_Position = vec4(3.0, 3.0, 3.0, 1.0); // Cull vertex
     //  return;
    }
    `);
  }

  /**
   * Generates vertex shader logic for mesh processing (part 2).
   * @private
   */
  private _vsMeshLogic2() { // after renderPass check
    this._vertSrcBuf.push(`
    // Mesh → tile + geometry resolution
    // tileIndex selects the view matrix; geometryIndex selects vertex/index ranges.
    MeshAttribTable meshAttributeTexture = getMeshAttribTable( meshIndex );
    uint tileIndex = meshAttributeTexture.tileIndex;
    uint geometryIndex = meshAttributeTexture.geometryIndex;

    // Geometry → base offsets resolution
    // These bases are added to local offsets to index into the big packed buffers.
    GeometryAttributes  geometryAttributes = getGeometryAttributeTexture( geometryIndex );

    // Determine local vertex number within this primitive
    // Triangles: localVert ∈ {0,1,2}
    // Lines:     localVert ∈ {0,1}
    // Points:    localVert = 0
    uint localVert = drawVertexIndex % numVertsPerPrim; // 0, 1, 2 for triangle; 0, 1 for line; 0 for point

    // Convert (primitive offset, localVert) → vertex offset within geometry
    // For triangles: vertexOffsetWithinGeometry = primOffset*3 + localVert
    uint vertexOffsetWithinGeometry = (primOffset * numVertsPerPrim) + localVert;

    // Resolve final vertex index within geometry.
    // Indexed primitives (triangles, lines) fetch from the index buffer.
    // Non-indexed primitives (points) use vertexOffsetWithinGeometry directly.
    uint vertexIndexWithinGeometry = ${this.useIndexBuffer
      ? `getVertexIndex(geometryAttributes.${this.edges ? "edgeIndicesBase" : "indicesBase"} + vertexOffsetWithinGeometry)`
      : `vertexOffsetWithinGeometry`};

    // Dequantization parameters for this geometry
    // Vertex positions are stored quantized; quantRange turns uvec3 into float vec3.
    QuantRange quantRange = getGeometryQuantRange(geometryIndex);

    // Fetch quantized vertex position, then dequantize into model space
    // quantPos: integer-like packed value
    // modelPos.xyz = offset + scale * quantPos
    uvec3 quantPos = getVertexPosition(geometryAttributes.verticesBase + vertexIndexWithinGeometry);
    vec4 modelPos  = vec4(quantRange.offset + (quantRange.scale * vec3(quantPos)), 1.0);

    // Fetch transforms
    // modelMatrix: mesh-local → world
    // viewMatrix:  world → view (tile camera)
    mat4 modelMatrix = getMeshMatrix(meshIndex);
    mat4 viewMatrix  = getTileViewMatrix(tileIndex);

    // Apply transforms through the standard pipeline
    vec4 worldPos = modelMatrix * modelPos;      // model → world
    vec4 viewPos  = viewMatrix  * worldPos;      // world → view
    vec4 clipPos  = uProjMatrix * viewPos;       // view  → clip

    // Write final clip-space position for rasterization
    gl_Position = clipPos;`
    );
  }

  /**
   * Writes the mesh's RGBA8 color into vColor and the view-space position into vViewPos,
   * which the fragment shader uses for face-normal reconstruction (dFdx/dFdy).
   */
  protected vsLambertShadingLogic() {
    this._vertSrcBuf.push(`
    // ─────────────────────────────────────────────────────────
    // Lambert shading vertex pass-through
    // ─────────────────────────────────────────────────────────
    ${this.hasNormals
      ? `// Decode the per-vertex normal and rotate it from model space into the
    // tile's view space. Skipping the normal-matrix inverse-transpose: the
    // pipeline assumes near-rigid model and view matrices (uniform scale
    // and rotation only), so the upper-left 3×3 is sufficient — anything
    // else would also break the existing vertex-position pipeline.`
      : `// Actual lighting is computed per-fragment from dFdx/dFdy(vViewPos),
    // giving a flat face normal without a per-vertex triangle refetch.`}

    vec4 color = vec4(meshViewAttributes.color) / 255.0; // RGBA8 → float [0,1]
    vColor   = color;
    vViewPos = viewPos.xyz;${this.hasNormals ? `

    uvec2 packedNormal = getVertexNormalPacked(geometryAttributes.normalsBase + vertexIndexWithinGeometry);
    vec3  modelNormal  = octDecodeNormalU16(packedNormal);
    mat3  normalMatrix = mat3(viewMatrix) * mat3(modelMatrix);
    vViewNormal        = normalize(normalMatrix * modelNormal);
    vMaterial          = unpackRoughnessMetallic(meshAttributeTexture.material);` : ``}${this.hasUVs ? `

    vUV              = getVertexUV(geometryAttributes.uvsBase + vertexIndexWithinGeometry);
    vAlbedoUVOffset  = unpackUnorm2x16FromU32(meshAttributeTexture.albedoUVOffsetPacked);
    vAlbedoUVScale   = unpackUnorm2x16FromU32(meshAttributeTexture.albedoUVScalePacked);
    vMRUVOffset      = unpackUnorm2x16FromU32(meshAttributeTexture.mrUVOffsetPacked);
    vMRUVScale       = unpackUnorm2x16FromU32(meshAttributeTexture.mrUVScalePacked);
    vNormalUVOffset  = unpackUnorm2x16FromU32(meshAttributeTexture.normalUVOffsetPacked);
    vNormalUVScale   = unpackUnorm2x16FromU32(meshAttributeTexture.normalUVScalePacked);
    // Alpha-mode unpack: byte 0 = mode (0=OPAQUE/1=MASK/2=BLEND),
    // byte 1 = cutoff in 0..255 mapped from [0, 1].
    vAlphaMode       = meshAttributeTexture.alpha & 0xFFu;
    vAlphaCutoff     = float((meshAttributeTexture.alpha >> 8u) & 0xFFu) / 255.0;` : ``}`
    );
  }

  /**
   * Generates vertex shader logic for silhouette rendering.
   * @protected
   */
  protected vsSilhouetteLogic() {
    this._vertSrcBuf.push(`
    // Output constant silhouette color
    vColor = vec4(uSilhouetteColor.r, uSilhouetteColor.g, uSilhouetteColor.b, uSilhouetteColor.a);`);
  }

  /**
   * Generates vertex shader logic for flat color rendering.
   * @protected
   */

  protected vsDrawFlatColorLogic() {
    this._vertSrcBuf.push(`
    // Output flat color from mesh view attributes
    vec4 color = vec4(meshViewAttributes.color) / 255.0;
    vColor = color;`);
  }

  /**
   * Generates vertex shader logic for vertex color rendering.
   * @protected
   */
  protected vsDrawVertexColorLogic() {
    this._vertSrcBuf.push(`
    // Output vertex color
    uvec4 color = getVertexColor(vertexIndexWithinGeometry);
    vColor = vec4( float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0, 1.0);`);
  }

  /**
   * Generates vertex shader logic for depth rendering.
   * @protected
   */
  protected vsDrawDepthLogic() {
    this._vertSrcBuf.push(
      "    vHighPrecisionZW = gl_Position.zw;"
    );
  }

  /**
   * Declares the light view-projection matrix uniform used by both the
   * shadow-map depth pass and the shadow-sampling color pass.
   *
   * `uShadowLightVP` is expressed in CAMERA-VIEW space, not world space: it
   * maps camera-space positions to the light's clip space. This is so the
   * shader can apply it to `viewPos` (which is small, single-precision safe
   * and correct for every RTC tile) instead of `worldPos` (which is only
   * tile-local and has no true-world meaning for double-precision models).
   */
  protected vsShadowSharedDeclarations() {
    this._vertSrcBuf.push("uniform mat4 uShadowLightVP;");
  }

  /**
   * Shadow-map depth pass: overrides gl_Position to use the light VP matrix.
   *
   * Emitted AFTER vsMainBegin, which leaves `viewPos` in scope.
   */
  protected vsShadowDepthLogic() {
    this._vertSrcBuf.push(
      "    gl_Position = uShadowLightVP * viewPos;"
    );
  }

  /**
   * Shadow-aware color pass: no-op under CSM. With N cascades the fragment
   * shader has to pick the right cascade per-fragment and transform
   * `vViewPos` on the fly — precomputing a single `vShadowCoord` in the
   * vertex stage would force a choice we can't make there. The required
   * varying (`vViewPos`) is already declared by Lambert shading.
   *
   * Kept as a hook so technique subclasses that already call it don't
   * break, and so future shadow techniques (e.g. non-Lambert receivers)
   * can add their own vertex-side setup without changing callers.
   */
  protected vsDrawShadowDeclarations() {
    // intentionally empty
  }

  /** @see vsDrawShadowDeclarations */
  protected vsDrawShadowLogic() {
    // intentionally empty
  }

  /**
   * Generates vertex shader logic for pick rendering.
   * @protected
   */
  protected vsPickMeshLogic() {
    this._vertSrcBuf.push(
      "    vBatchIndex = batchIndex;",
      "    vMeshIndex = meshIndex;",
      "    vViewPosition = viewPos;",
      "    gl_Position = remapPickClipPos(gl_Position);");
  }

  /**
   * Snap-pass vertex logic — exports view-space position and remaps
   * `gl_Position` into the small snap viewport. For vertex snap
   * (`this.snap === 1`) every vertex is rasterised as a 1-pixel point,
   * so `gl_PointSize = 1.0` is set explicitly.
   *
   * Emit AFTER {@link vsMainBegin} so `viewPos` and `gl_Position` are
   * in scope, and after {@link vsSnapDeclarations} so `vSnapViewPosition`
   * has been declared.
   */
  protected vsSnapLogic() {
    this._vertSrcBuf.push(
      "    vSnapViewPosition = viewPos.xyz;",
      "    gl_Position = remapSnapClipPos(gl_Position);",
    );
    if (this.snap === 1) {
      this._vertSrcBuf.push("    gl_PointSize = 1.0;");
    }
  }

  /**
   * Generates vertex shader logic for depth pick rendering.
   * @protected
   */
  protected vsPickDepthLogic() {
    this._vertSrcBuf.push(
      "    vHighPrecisionZW = remapPickClipPos(gl_Position).zw;"
    );
  }


  /**
   * Generates vertex shader logic for point size and intensity filtering.
   * @protected
   */
  protected vsPointsFilterLogicOpenBlock() {
    // const src = this._vertSrcBuf;
    // const pointsMaterial = this._renderContext.view.pointsMaterial;
    // if (pointsMaterial.filterIntensity) {
    //   src.push("float intensity = float(color.a) / 255.0;")
    //   src.push("if (intensity < intensityRange[0] || intensity > intensityRange[1]) {");
    //   src.push("   gl_Position = vec4(2.0, 0.0, 0.0, 0.0);");
    //   src.push("} else {");
    // }
  }

  /**
   * Generates vertex shader logic for point size and intensity filtering.
   * @protected
   */
  protected vsPointsFilterLogicCloseBlock() {
    // const pointsMaterial = this._renderContext.view.pointsMaterial;
    // if (pointsMaterial.filterIntensity) {
    //   this._vertSrcBuf.push("}");
    // }
  }

  /**
   * Generates vertex shader logic for point size calculation.
   * @protected
   */
  protected vsPointsGeometryLogic() {
    this._vertSrcBuf.push(
      `  if (uPerspectivePoints == 1) {
     gl_PointSize = (uNearPlaneHeight * pointSize) / clipPos.w;
     gl_PointSize = max(gl_PointSize, uPerspectivePointsMinMax[0]);
     gl_PointSize = min(gl_PointSize, uPerspectivePointsMinMax[1]);
   } else {
      gl_PointSize = pointSize;
   }`);
  }

  /**
   * Emits the fragment shader version directive and identifying comment.
   */
  protected fsHeader() {
    this._fragSrcBuf.push(
      '#version 300 es',
      `// ${this.constructor.name} fragment shader`);
  }

  /**
   * Emits precision qualifier declarations required by all fragment shaders.
   */
  protected fsPrecisionDeclarations() {
    this._fragSrcBuf.push(
      "#ifdef GL_FRAGMENT_PRECISION_HIGH",
      "precision highp float;",
      "precision highp int;",
      "precision highp usampler2D;",
      "precision highp isampler2D;",
      "precision highp sampler2D;",
      "precision highp sampler2DShadow;",
      "#else",
      "precision mediump float;",
      "precision mediump int;",
      "precision mediump usampler2D;",
      "precision mediump isampler2D;",
      "precision mediump sampler2D;",
      "precision mediump sampler2DShadow;",
      "#endif");
  }

  /**
   * Declares the working color variable and the standard color output.
   * Pick techniques declare their own MRT outputs and do NOT call this.
   */
  protected fsColorDeclarations() {
    this._fragSrcBuf.push(
      "vec4 color;",
      "out vec4 outColor;");
  }

  /**
   * Declares the flat color varying read by silhouette logic.
   */
  protected fsSilhouetteDeclarations() {
    this._fragSrcBuf.push("flat in vec4 vColor;");
  }

  /**
   * Assigns the interpolated vertex color to the working color variable.
   */
  protected fsSilhouetteLogic() {
    this._fragSrcBuf.push("color = vColor;");
  }

  /**
   * Declares the flat color varying read by flat-shaded color logic.
   */
  protected fsDrawFlatColorDeclarations() {
    this._fragSrcBuf.push("flat in vec4 vColor;");
  }

  /**
   * Assigns the flat color varying to the working color variable.
   */
  protected fsDrawFlatColorLogic() {
    this._fragSrcBuf.push("color = vColor;");
  }

  /**
   * Declares the varyings and light uniforms required by Lambert shading in the fragment shader.
   */
  protected fsLambertShadingDeclarations() {
    const src = this._fragSrcBuf;
    src.push(
      "flat in vec4 vColor;",
      "in vec3 vViewPos;",
      ...(this.hasNormals ? [
        "in vec3 vViewNormal;",
        "flat in vec2 vMaterial;"
      ] : []),
      ...(this.hasUVs ? [
        "in vec2 vUV;",
        "flat in vec2 vAlbedoUVOffset;",
        "flat in vec2 vAlbedoUVScale;",
        "flat in vec2 vMRUVOffset;",
        "flat in vec2 vMRUVScale;",
        "flat in vec2 vNormalUVOffset;",
        "flat in vec2 vNormalUVScale;",
        // Per-mesh alpha mode + cutoff. Used by the discard test for
        // MASK-mode materials below.
        "flat in uint  vAlphaMode;",
        "flat in float vAlphaCutoff;",
        // Albedo atlas (sRGB-decoded automatically by the GPU because the
        // texture's internalFormat is SRGB8_ALPHA8). One sampler per
        // batch; `texture()` returns linear RGBA in `[0, 1]`.
        "uniform sampler2D uAlbedoAtlas;",
        // Metallic-roughness atlas — linear RGBA8. glTF 2.0 channel
        // layout: G = roughness, B = metallic. The shader multiplies the
        // sampled values against `material.roughness`/`material.metallic`,
        // so a material with both set to `1.0` lets the texture drive
        // each parameter directly.
        "uniform sampler2D uMetallicRoughnessAtlas;",
        // Tangent-space normal-map atlas — linear RGBA8. RGB encodes the
        // tangent-space normal as (x*0.5+0.5, y*0.5+0.5, z*0.5+0.5).
        // Sentinel sample is (0.5, 0.5, 1.0) → decodes to (0, 0, 1) so
        // untextured meshes use the smooth normal unchanged.
        "uniform sampler2D uNormalMapAtlas;"
      ] : []),
      "uniform vec4 uLightAmbient;",
      "uniform vec3 uLightDir1;",
      "uniform vec4 uLightColor1;",
      "uniform vec3 uLightDir2;",
      "uniform vec4 uLightColor2;",
      "uniform vec3 uLightDir3;",
      "uniform vec4 uLightColor3;",
      // Primary directional light direction in view space, sourced from
      // `view.effects.shadows.direction` and pre-rotated by the view matrix in
      // the renderer. Used by both the Lambert and Cook-Torrance paths so
      // direct lighting and cast shadows agree on which way the sun points.
      "uniform vec3 uPrimaryLightDirView;",
      // Analytical hemisphere ambient — sky/ground gradient driven by
      // the dot of the surface normal with world up. Cheap (one dot,
      // one mix) and active in every render mode listed in
      // View.lights.hemispheric.renderModes. uHemisphereUpView is
      // world-up pre-rotated into view space so the dot stays a
      // single fma.
      "uniform float uHemisphereIntensity;",
      "uniform vec3  uHemisphereSky;",
      "uniform vec3  uHemisphereGround;",
      "uniform vec3  uHemisphereUpView;",
      // Cubemap IBL — proper split-sum specular IBL with prefiltered
      // cubemap + diffuse irradiance cubemap + BRDF LUT. uIBLIntensity
      // gates this contribution independently of the hemisphere term
      // above so the two stack additively when both apply. Bound by
      // the smooth-shaded variant; the flat-shaded path stays on the
      // cheap analytical hemisphere only.
      "uniform float uIBLIntensity;",
      ...(this.hasNormals ? [
        "uniform samplerCube uIBLIrradianceCubemap;",
        "uniform samplerCube uIBLPrefilteredCubemap;",
        "uniform sampler2D   uIBLBRDFLUT;",
        "uniform float       uIBLMaxSpecularMipLevel;",
        "uniform mat3        uIBLViewToWorldRot;"
      ] : []),
      // `g_ambient` is the resolved per-fragment ambient (flat or IBL)
      // declared at main-scope so the shadow stage can clamp shadowed
      // fragments to the same floor without recomputing.
      "vec3 g_ambient;");
    if (this.hasNormals) {
      // Cook-Torrance microfacet BRDF helpers. Standard real-time PBR set:
      // GGX normal distribution, Smith-GGX geometry term, Schlick Fresnel.
      // Inlined as a string so the technique pair shares one source.
      src.push(`
const float PBR_MIN_ROUGHNESS = 0.045;

float D_GGX(float NdotH, float a2) {
  float f = (NdotH * a2 - NdotH) * NdotH + 1.0;
  return a2 / max(3.14159265 * f * f, 1e-6);
}

float G_SchlickGGX(float NdotV, float k) {
  return NdotV / (NdotV * (1.0 - k) + k);
}

float G_Smith(float NdotL, float NdotV, float roughness) {
  // Schlick-GGX approximation of Smith's geometric attenuation, with the
  // (r+1)/2 remapping that's standard for direct lighting (Disney/Karis).
  float r = roughness + 1.0;
  float k = (r * r) / 8.0;
  return G_SchlickGGX(NdotL, k) * G_SchlickGGX(NdotV, k);
}

vec3 F_Schlick(vec3 F0, float cosTheta) {
  float f = pow(1.0 - cosTheta, 5.0);
  return F0 + (1.0 - F0) * f;
}`);
    }
  }

  /**
   * Generates fragment shader logic for Lambert shading.
   * @protected
   */
  protected fsLambertShadingLogic() {
    if (this.hasNormals) {
      // ── Debug visualization shortcut ─────────────────────────────────
      // When DEBUG_VISUALIZE_NORMAL_MAP is on and this is the smooth+UV
      // variant (the only one that binds the normal-map atlas), output
      // the raw RGB of the sampled normal map directly. Bypasses the
      // BRDF entirely — the goal is to confirm the texture is reaching
      // the shader, NOT to render correctly.
      if (DEBUG_VISUALIZE_NORMAL_MAP && this.hasUVs) {
        // The shadow stage (fsDrawShadowLogic) appended later in shadow-
        // aware techniques references `albedo` and `g_ambient` to clamp
        // shadowed fragments. We declare both so the shader still
        // compiles, and set them so shadows DON'T darken the debug
        // colour — `ambientFloor = g_ambient * albedo = nm_raw`, so the
        // shadow stage's `max(color * shadowFactor, ambientFloor)`
        // clamps back up to the raw normal-map sample. Net effect: the
        // debug viz comes through the BRDF and shadow stages unaffected.
        this._fragSrcBuf.push(`
    vec2 wrappedUV = fract(vUV);
    vec2 normalAtlasUV = wrappedUV * vNormalUVScale + vNormalUVOffset;
    vec3 nm_raw = texture(uNormalMapAtlas, normalAtlasUV).rgb;
    vec3 albedo = nm_raw;
    g_ambient = vec3(1.0);
    color = vec4(nm_raw, 1.0);`);
        return;
      }
      // The smooth-shaded variant has two flavours that differ only in
      // how the albedo (base colour) is resolved:
      //   - hasUVs: sample the atlas, then tint by vColor
      //   - !hasUVs: vColor IS the albedo
      // Either way the BRDF below is the same.
      const albedoSrc = this.hasUVs
        ? `// Per-fragment fract() wraps tiling UVs (Sponza-style values
    // outside [0, 1]) into a single tile before the atlas transform —
    // without it, the linear sub-rect map would push UVs off the atlas
    // and CLAMP_TO_EDGE would pin every fragment to a single edge column.
    // Visible cost is a 1-pixel seam at integer UV boundaries; for the
    // tiled materials this fixes, that's almost imperceptible.
    vec2 wrappedUV = fract(vUV);
    // Atlas sub-rect: wrappedUV maps from [0, 1) into the mesh's sub-rect
    // of the per-batch atlas via the flat-varying transform written in
    // the vertex stage. Untextured meshes get scale = 0 + offset =
    // white-sentinel, so this collapses to a constant white and \`albedo\`
    // is just \`vColor.rgb\`.
    vec2 albedoAtlasUV = wrappedUV * vAlbedoUVScale + vAlbedoUVOffset;
    vec4 albedoSample = texture(uAlbedoAtlas, albedoAtlasUV);
    vec3 albedo = albedoSample.rgb * vColor.rgb;
    float albedoAlpha = albedoSample.a * vColor.a;

    // Alpha-mask cutout (glTF alphaMode == MASK). Done before the BRDF
    // so cutout fragments cost no shading work. OPAQUE and BLEND skip
    // the discard — for OPAQUE the alpha is implicitly 1.0; for BLEND
    // it feeds color.a at the end.
    //
    // Anti-aliased alpha test (Ben Golus 2019, "Anti-aliased Alpha Test:
    // The Esoteric Alpha To Coverage"). The naive (albedoAlpha < cutoff)
    // form leaves a soft band of passing fragments at the boundary where the
    // bilinear sample has bled RGB in from alpha=0 neighbour texels
    // (those neighbours are usually white in the source PNG, which is
    // why the halo reads white). Mapping the threshold zone through the
    // alpha's screen-space gradient with fwidth() narrows the surviving
    // band to ~1 pixel, kicking the bleed band out and leaving a clean
    // edge — same look you'd get from real alpha-to-coverage MSAA.
    if (vAlphaMode == 1u) {
      float aaAlpha = (albedoAlpha - vAlphaCutoff) / max(fwidth(albedoAlpha), 1e-4) + 0.5;
      if (aaAlpha < 0.5) discard;
    }

    // Metallic-roughness sample — glTF 2.0 channel layout (G = roughness,
    // B = metallic). The atlas's white sentinel makes the sample (1, 1)
    // for untextured meshes, so the multiply leaves the material values
    // unchanged. With a real texture and a material set to 1.0/1.0, the
    // texture drives the values directly.
    vec2 mrAtlasUV = wrappedUV * vMRUVScale + vMRUVOffset;
    vec4 mrSample = texture(uMetallicRoughnessAtlas, mrAtlasUV);
    float mrRoughnessFactor = mrSample.g;
    float mrMetallicFactor  = mrSample.b;`
        : `// No UVs on this batch — vColor is the only source of albedo,
    // and the material's roughness/metallic pass through unchanged.
    vec3 albedo = vColor.rgb;
    float albedoAlpha = vColor.a;
    float mrRoughnessFactor = 1.0;
    float mrMetallicFactor  = 1.0;`;
      this._fragSrcBuf.push(`
    // ─────────────────────────────────────────────────────────
    // Cook-Torrance shading (GGX + Smith-GGX + Schlick Fresnel)
    // ─────────────────────────────────────────────────────────
    // Diffuse stays as energy-conserving Lambert; specular is the standard
    // real-time microfacet BRDF. F0 is 0.04 grey for dielectrics, tinted
    // by the surface albedo for metals (mix(0.04, albedo, metallic)).

    ${albedoSrc}

    // Re-normalize after rasterizer interpolation; linear blends of unit
    // vectors generally come out sub-unit length.
    vec3 N_smooth = normalize(vViewNormal);
    // Force the normal to face the viewer. Handles three cases at
    // once: double-sided rendering (opaque pass: no culling;
    // transparent thin shells), source assets with reversed face
    // winding, and assets with inverted per-vertex normals. Testing
    // the normal directly via dot(N, vViewPos) is more robust than a
    // gl_FrontFacing branch — gl_FrontFacing reflects face winding,
    // which can disagree with the per-vertex normal direction (some
    // OBJ files). Any normal pointing away from the camera (positive
    // dot with the camera-to-fragment vector vViewPos) gets flipped
    // to point toward it.
    if (dot(N_smooth, vViewPos) > 0.0) N_smooth = -N_smooth;
    ${this.hasUVs ? `// Tangent-space normal map sample. Sentinel-fallback for untextured
    // meshes is (0.5, 0.5, 1.0) → tangent-space (0, 0, 1) → no
    // perturbation, so the BRDF below sees the unmodified N_smooth.
    //
    // TBN reconstruction: Schueler 2013, "Normal Mapping Without
    // Precomputed Tangents". We build the basis from the screen-space
    // derivatives of view-space position and the geometry UV, then
    // orthogonalize with respect to N_smooth. Cheaper than the
    // matched-tangent approach, robust against arbitrary UV mappings,
    // and identical to per-vertex tangents on smooth meshes (the only
    // disagreement is at hard normals/UV seams, where neither approach
    // is "right" anyway).
    // Reuses wrappedUV from the albedo block above — the same fract() applied
    // there is what makes tiled normal maps line up with their albedo siblings.
    vec2 normalAtlasUV = wrappedUV * vNormalUVScale + vNormalUVOffset;
    vec3 nm_tangent = texture(uNormalMapAtlas, normalAtlasUV).xyz * 2.0 - 1.0;

    vec3 dp1 = dFdx(vViewPos);
    vec3 dp2 = dFdy(vViewPos);
    vec2 duv1 = dFdx(vUV);
    vec2 duv2 = dFdy(vUV);
    // Robust frame: project dp1/dp2 onto the plane perpendicular to
    // N_smooth, then build T/B from those + the UV gradient.
    vec3 dp2perp = cross(dp2, N_smooth);
    vec3 dp1perp = cross(N_smooth, dp1);
    vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
    vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
    float tbnInvMax = inversesqrt(max(dot(T, T), dot(B, B)));
    mat3 TBN = mat3(T * tbnInvMax, B * tbnInvMax, N_smooth);
    vec3 N = normalize(TBN * nm_tangent);` : `vec3 N = N_smooth;`}
    // View direction in view space (camera at origin → fragment).
    vec3 V = normalize(-vViewPos);
    // Light direction the light travels along; surface-to-light is its
    // negation.
    vec3 L = normalize(-uPrimaryLightDirView);
    vec3 H = normalize(L + V);

    float NdotL = max(dot(N, L), 0.0);
    float NdotV = max(dot(N, V), 0.0);
    float NdotH = max(dot(N, H), 0.0);
    float VdotH = max(dot(V, H), 0.0);

    // Material roughness/metallic times the texture multiplier (1.0 when
    // no texture is bound — see the albedo block above for the sentinel
    // path). Roughness is clamped to PBR_MIN_ROUGHNESS to keep the GGX
    // denominator from collapsing at mirror-smooth.
    float roughness = max(vMaterial.x * mrRoughnessFactor, PBR_MIN_ROUGHNESS);
    float metallic  = clamp(vMaterial.y * mrMetallicFactor, 0.0, 1.0);
    float a         = roughness * roughness;
    float a2        = a * a;

    vec3 F0 = mix(vec3(0.04), albedo, metallic);

    // Specular term — D * G * F / (4 N·V N·L). The 4 N·V N·L denominator
    // can underflow near grazing angles; clamp via max.
    float D = D_GGX(NdotH, a2);
    float G = G_Smith(NdotL, NdotV, roughness);
    vec3  F = F_Schlick(F0, VdotH);
    vec3  specular = (D * G) * F / max(4.0 * NdotL * NdotV, 1e-4);

    // Diffuse term — energy conservation: any light reflected as specular
    // can't also be diffuse, and metals have no diffuse term at all.
    vec3 kd = (1.0 - F) * (1.0 - metallic);
    vec3 diffuse = kd * albedo / 3.14159265;

    // Direct lighting contribution from the primary directional light.
    // Light colour (uLightColor2.rgb * .a = colour * intensity) plus N·L.
    vec3 directLight = uLightColor2.rgb * uLightColor2.a * NdotL;
    vec3 directContrib = (diffuse + specular) * directLight;

    // ── Indirect (IBL Layer 2 — split-sum) ────────────────────────────
    // Sample the prefiltered cubemap pair generated once per view by
    // IBLPrefilter:
    //   - irradiance cubemap is cosine-convolved → diffuse term
    //   - prefiltered cubemap is GGX-convolved per mip → specular term
    //   - BRDF LUT folds the rest of the integral into a 2D lookup
    //
    // Sampling cubemaps requires a world-space normal/reflection —
    // we have view-space ones, so transform via the inverse view
    // rotation (uIBLViewToWorldRot, supplied by the renderer).
    vec3 worldN = normalize(uIBLViewToWorldRot * N);
    vec3 worldR = reflect(-(uIBLViewToWorldRot * V), worldN);
    vec3 iblDiffuseEnv = texture(uIBLIrradianceCubemap, worldN).rgb;

    // Mip selection: roughness in [0, 1] maps to mip [0, MAX]. textureLod
    // is required because the gradient-derived mip from a plain texture()
    // would over-blur on curved surfaces.
    float specMip = roughness * uIBLMaxSpecularMipLevel;
    vec3 iblSpecEnv = textureLod(uIBLPrefilteredCubemap, worldR, specMip).rgb;

    // Standard split-sum form: prefilteredColor * (F0 * lut.x + lut.y)
    // where lut.x is the F0 scale factor and lut.y is the F0-independent
    // bias. Encodes both the Fresnel and geometry terms exactly.
    vec3  F_NV    = F_Schlick(F0, NdotV);
    vec2  brdfLUT = texture(uIBLBRDFLUT, vec2(NdotV, roughness)).rg;
    vec3  iblSpec = iblSpecEnv * (F0 * brdfLUT.x + brdfLUT.y);
    vec3  iblDiff = (1.0 - F_NV) * (1.0 - metallic) * iblDiffuseEnv * albedo;
    vec3  iblContrib = (iblDiff + iblSpec);

    // Analytical hemisphere term — gated independently of the cubemap
    // so non-IBL render modes still get a directional sky/ground fill.
    // Same maths as the flat-shaded path: dot the view-space normal
    // with view-space world-up, lerp ground→sky.
    float hemiFacing = dot(N, uHemisphereUpView) * 0.5 + 0.5;
    vec3 hemiAmbient = mix(uHemisphereGround, uHemisphereSky, hemiFacing);
    float hemiScale = max(uHemisphereIntensity, 0.0);

    // Resolve the per-fragment ambient term so the shadow stage can use
    // it as a floor. Multiplicative scale rather than lerp so
    // intermediate intensity values mean "contribution at N× strength"
    // rather than "N× toward this term away from flat ambient" — the
    // lerp form muted character too quickly at low values.
    //
    // flatAmbient stays as an unconditional baseline so the surface
    // never goes black when both terms are disabled. The hemisphere
    // and cubemap diffuse stack additively on top, each scaled by its
    // own intensity uniform.
    vec3 flatAmbient = uLightAmbient.rgb * uLightAmbient.a;
    float iblScale = max(uIBLIntensity, 0.0);
    g_ambient = flatAmbient + hemiAmbient * hemiScale + iblDiffuseEnv * iblScale;

    vec3 lit = directContrib
             + (flatAmbient + hemiAmbient * hemiScale) * albedo
             + iblContrib * iblScale;
    color = vec4(lit, albedoAlpha);`);
      return;
    }
    this._fragSrcBuf.push(`
    // Flat-shaded path. ${this.hasUVs
      ? "UV-bearing variant: sample the albedo atlas just like the\n    // smooth-shaded path so geometries that ship without per-vertex\n    // normals (typical IFC) still pick up textured materials. The\n    // alias keeps shared shadow logic able to reference `albedo`."
      : "No UVs, no texture — vColor IS the albedo. The alias\n    // keeps shared shadow logic able to reference `albedo`."}
    ${this.hasUVs
      ? `vec2 wrappedUV = fract(vUV);
    vec2 albedoAtlasUV = wrappedUV * vAlbedoUVScale + vAlbedoUVOffset;
    vec4 albedoSample = texture(uAlbedoAtlas, albedoAtlasUV);
    vec3 albedo = albedoSample.rgb * vColor.rgb;
    float albedoAlpha = albedoSample.a * vColor.a;`
      : `vec3 albedo = vColor.rgb;
    float albedoAlpha = vColor.a;`}

    // Reconstruct a face normal in view space from position derivatives.
    // This gives a flat-shaded normal per fragment without refetching the
    // whole triangle in the vertex shader.
    vec3 dX = dFdx(vViewPos);
    vec3 dY = dFdy(vViewPos);
    vec3 normal = normalize(cross(dX, dY));

    // Lambert diffuse term (N·L), clamped to [0,1]. Light direction is
    // the direction the light travels, so we negate to get surface-to-light.
    float lambertian = max(dot(normal, normalize(-uPrimaryLightDirView)), 0.0);

    // Accumulate reflected/diffuse light contribution.
    // uLightColor2.rgb * uLightColor2.a acts like (color * intensity).
    vec3 reflectedColor = vec3(0.0);
    reflectedColor += lambertian * (uLightColor2.rgb * uLightColor2.a);

    // Analytical hemisphere ambient: pick a colour between the sky and
    // ground based on how much the surface normal faces world up.
    // uHemisphereUpView is the world-up axis pre-transformed into view
    // space by the renderer, so we don't need a view→world matrix in
    // the shader — just one dot. dot · 0.5 + 0.5 maps [-1, 1] → [0, 1]
    // for the mix factor.
    float hemiFacing = dot(normal, uHemisphereUpView) * 0.5 + 0.5;
    vec3 hemiAmbient = mix(uHemisphereGround, uHemisphereSky, hemiFacing);

    // Resolve the ambient term: flat ambient as unconditional baseline,
    // hemisphere contribution scaled by uHemisphereIntensity on top.
    // The flat-shaded path has no cubemap path — hemisphere is the
    // only non-flat ambient available here. The shadow stage clamps
    // shadowed fragments to this floor.
    vec3 flatAmbient = uLightAmbient.rgb * uLightAmbient.a;
    float hemiScale = max(uHemisphereIntensity, 0.0);
    g_ambient = flatAmbient + hemiAmbient * hemiScale;

    // Combine ambient + diffuse lighting.
    // Ambient is applied to base color, diffuse multiplies base color as well.
    vec3 lit = (g_ambient * albedo) + (albedo * reflectedColor);

    color = vec4(lit, albedoAlpha);`);
  }

  /**
   * Declares the high-precision depth varying used for linearized depth rendering.
   */
  protected fsDrawDepthDeclarations() {
    this._fragSrcBuf.push("in vec2 vHighPrecisionZW;");
  }

  /**
   * Generates fragment shader logic for depth rendering.
   * @protected
   */
  protected fsDrawDepthLogic() {
    this._fragSrcBuf.push(
      "    float depthFragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;",
      "    color = vec4(vec3(1.0 - depthFragCoordZ), 1.0); ");
  }

  /**
   * Declares the SAO occlusion sampler and unpacking helpers.
   */
  protected fsDrawSAODeclarations() {
    this._fragSrcBuf.push(
      "uniform sampler2D saoOcclusionTexture;",
      "uniform vec4      saoParams;",
      "const float       saoUnpackDownScale = 255. / 256.;",
      "const vec3        saoPackFactors = vec3( 256. * 256. * 256., 256. * 256.,  256. );",
      "const vec4        saoUnpackFactors = saoUnpackDownScale / vec4( saoPackFactors, 1. );",
      "float saoUnpackRGBToFloat( const in vec4 v ) {",
      "    return dot( v, saoUnpackFactors );",
      "}");
  }

  /**
   * Generates fragment shader logic for screen-space ambient occlusion (SAO).
   * @protected
   */
  protected fsDrawSAOLogic() {
    this._fragSrcBuf.push(
      "   float saoViewportWidth = saoParams[0];",
      "   float saoViewportHeight = saoParams[1];",
      "   float saoBlendCutoff = saoParams[2];",
      "   float saoBlendFactor = saoParams[3];",
      "   vec2  saoUV = vec2(gl_FragCoord.x / saoViewportWidth, gl_FragCoord.y / saoViewportHeight);",
      "   float saoOcclusion = saoUnpackRGBToFloat(texture(saoOcclusionTexture, saoUV));",
      "   float saoAOFactor = (smoothstep(saoBlendCutoff, 1.0, saoOcclusion) - 1.0) * saoBlendFactor + 1.0;",
      "   color = vec4(color.rgb * clamp(saoAOFactor, 0.0, 1.0), color.a);");
  }

  /**
   * Declares the shadow-map samplers (one per cascade), the per-cascade
   * light-VP array, the cascade split distances, the scalar shadow params,
   * and the PCF / slope-bias data.
   *
   * Uniform layout:
   *   - `uShadowMap0..3`: `sampler2DShadow` per cascade. `TEXTURE_COMPARE_MODE`
   *     is set on each depth texture so `texture(sampler, vec3(uv, refDepth))`
   *     returns the hardware-bilinear PCF comparison (0 = shadow, 1 = lit).
   *   - `uShadowLightVPs[4]`: mat4 per cascade, camera-view → cascade light-clip.
   *   - `uShadowCascadeSplits`: view-space `|z|` boundaries between cascades;
   *     entry `i` is the far edge of cascade `i`. Only entries
   *     `0 .. uShadowCascadeCount - 2` are meaningful.
   *   - `uShadowCascadeCount`: number of populated cascades in `[1, 4]`.
   *   - `uShadowParams`: `(intensity, depthBias, texelSize, normalOffsetBias)`.
   *   - `uShadowSlope`: `(dirViewX, dirViewY, dirViewZ, slopeBias)`.
   *   - `uShadowPcfRadius`: half-width of the PCF kernel (0 = 1×1, 1 = 3×3…).
   *
   * Per-fragment cascade selection happens in {@link fsDrawShadowLogic}, so
   * there's no `vShadowCoord` varying — we transform `vViewPos` through the
   * chosen cascade's matrix at fragment time instead.
   */
  protected fsDrawShadowDeclarations() {
    this._fragSrcBuf.push(
      "uniform sampler2DShadow uShadowMap0;",
      "uniform sampler2DShadow uShadowMap1;",
      "uniform sampler2DShadow uShadowMap2;",
      "uniform sampler2DShadow uShadowMap3;",
      "uniform sampler2DShadow uShadowMap4;",
      "uniform sampler2DShadow uShadowMap5;",
      "uniform mat4            uShadowLightVPs[6];",
      "uniform float           uShadowCascadeSplits[6];",
      "uniform int             uShadowCascadeCount;",
      "uniform vec4            uShadowParams;",
      "uniform vec4            uShadowSlope;",
      "uniform int             uShadowPcfRadius;"
    );
  }

  /**
   * Selects the best-fitting cascade for the current fragment (based on its
   * camera-view-space `|z|`), samples that cascade's shadow map with hardware
   * PCF, and darkens `color`.
   *
   * Per-fragment steps:
   *   1. Cascade selection from view-space `-vViewPos.z` against
   *      `uShadowCascadeSplits`.
   *   2. Compute the light-clip position by applying the chosen cascade's
   *      matrix to `vViewPos` (plus the normal-offset push).
   *   3. Slope-scaled bias, then the PCF loop (1..7² taps via `uShadowPcfRadius`).
   *
   * `vViewPos` must be in scope — the shadow-aware techniques always run with
   * Lambert shading which declares it.
   */
  protected fsDrawShadowLogic() {
    this._fragSrcBuf.push(`
    {
        // ---- Cascade selection (view-space |z|). ----------------------------
        // Start at cascade 0 and walk up while this fragment is past each split.
        // Splits beyond \`uShadowCascadeCount - 1\` are MAX_VALUE so they never
        // trigger an upgrade.
        float shadowViewZ = -vViewPos.z;
        int   shadowCascade = 0;
        if (uShadowCascadeCount > 1 && shadowViewZ > uShadowCascadeSplits[0]) shadowCascade = 1;
        if (uShadowCascadeCount > 2 && shadowViewZ > uShadowCascadeSplits[1]) shadowCascade = 2;
        if (uShadowCascadeCount > 3 && shadowViewZ > uShadowCascadeSplits[2]) shadowCascade = 3;
        if (uShadowCascadeCount > 4 && shadowViewZ > uShadowCascadeSplits[3]) shadowCascade = 4;
        if (uShadowCascadeCount > 5 && shadowViewZ > uShadowCascadeSplits[4]) shadowCascade = 5;

        // Per-fragment view-space normal — smooth when the technique was
        // compiled with hasNormals, flat otherwise. Either way it matches
        // the Lambert pass so the shadow bias and the lit term agree.
        ${this.hasNormals
      ? `vec3 shadowNormalView = normalize(vViewNormal);`
      : `vec3 shadowNormalView = normalize(cross(dFdx(vViewPos), dFdy(vViewPos)));`}

        // Normal-offset push: receivers move toward the light, killing acne at
        // glancing angles. lightVP is linear with w = 0 on direction vectors.
        // Array indexing with a non-constant is allowed in GLSL ES 300.
        mat4 shadowVP       = uShadowLightVPs[shadowCascade];
        vec4 shadowBasePos  = shadowVP * vec4(vViewPos, 1.0);
        vec4 shadowOffset   = shadowVP * vec4(shadowNormalView * uShadowParams.w, 0.0);
        vec4 biasedCoord    = shadowBasePos + shadowOffset;

        vec3 shadowNdc = biasedCoord.xyz / biasedCoord.w;
        vec3 shadowUv  = shadowNdc * 0.5 + 0.5;

        bool inside =
            shadowUv.x > 0.0 && shadowUv.x < 1.0 &&
            shadowUv.y > 0.0 && shadowUv.y < 1.0 &&
            shadowUv.z > 0.0 && shadowUv.z < 1.0;

        if (inside) {
            // Slope-scaled bias: tan(angle(normal, light)), clamped.
            float cosTheta = clamp(dot(shadowNormalView, -uShadowSlope.xyz), 0.001, 1.0);
            float slopeFactor = min(sqrt(max(0.0, 1.0 - cosTheta * cosTheta)) / cosTheta, 10.0);
            float totalBias = uShadowParams.y + uShadowSlope.w * slopeFactor;

            float refDepth  = shadowUv.z - totalBias;
            float texel     = uShadowParams.z;
            int   r         = uShadowPcfRadius;
            int   diameter  = 2 * r + 1;
            float tapCount  = float(diameter * diameter);
            float litSum    = 0.0;

            // Hardware PCF: each tap is a bilinear 2×2 compare, so a 3×3 tap
            // grid effectively samples a 6×6 neighbourhood. sampler2DShadow
            // can't be indexed with a non-constant, so branch on cascade.
            for (int dy = -r; dy <= r; dy++) {
                for (int dx = -r; dx <= r; dx++) {
                    vec2 off = vec2(float(dx), float(dy)) * texel;
                    vec3 uvd = vec3(shadowUv.xy + off, refDepth);
                    float lit;
                    if      (shadowCascade == 0) lit = texture(uShadowMap0, uvd);
                    else if (shadowCascade == 1) lit = texture(uShadowMap1, uvd);
                    else if (shadowCascade == 2) lit = texture(uShadowMap2, uvd);
                    else if (shadowCascade == 3) lit = texture(uShadowMap3, uvd);
                    else if (shadowCascade == 4) lit = texture(uShadowMap4, uvd);
                    else                         lit = texture(uShadowMap5, uvd);
                    litSum += lit;
                }
            }

            float shadowFraction = 1.0 - (litSum / tapCount);
            float shadowFactor   = 1.0 - shadowFraction * uShadowParams.x;

            // Shadows attenuate the direct light contribution but must not
            // dim the surface below what ambient fill alone would produce —
            // ambient is a stand-in for indirect/bounce light that isn't
            // occluded by the cast shadow. Without this clamp, fully-
            // shadowed fragments end up darker than their ambient floor and
            // read as "ink" rather than "shade", which is what the user
            // reported on the Cityscape model. Per-channel max preserves
            // colour tint when the ambient or surface colour is non-grey.
            // Read the ambient term Lambert already resolved (flat or
            // IBL hemisphere) so the shadowed floor matches the
            // unshadowed-from-the-light side, without recomputing.
            vec3 ambientFloor = g_ambient * albedo;
            color = vec4(max(color.rgb * shadowFactor, ambientFloor), color.a);
        }
    }`);
  }

  /**
   * Declares the pick-pass MRT outputs, pick depth uniforms, and bit-packing helpers.
   * Pick techniques call this instead of {@link fsColorDeclarations}.
   */
  protected fsPickMeshDeclarations() {
    this._fragSrcBuf.push(
      `flat in uint vMeshIndex;
       flat in uint vBatchIndex;

       in vec4 vViewPosition; // view-space position, used for reconstructing depth in fragment shader

       uniform float pickZNear;
       uniform float pickZFar;

       layout(location = 0) out vec4 outBatchIndex;
       layout(location = 1) out vec4 outMeshIndex;
       layout(location = 2) out vec4 outDepth;

       // Packs a 32-bit uint into 4 normalized 8-bit color channels.
       // R = least-significant byte, A = most-significant byte.
       vec4 packUintToRGBA8(uint v) {
         return vec4(
           float( v         & 0xFFu),
           float((v >> 8u)  & 0xFFu),
           float((v >> 16u) & 0xFFu),
           float((v >> 24u) & 0xFFu)
         ) / 255.0;
      }

      // Packs a normalized float in [0,1] into RGBA8.
      vec4 packDepth(const in float depth) {
        const vec4 bitShift = vec4(256.0*256.0*256.0, 256.0*256.0, 256.0, 1.0);
        const vec4 bitMask  = vec4(0.0, 1.0/256.0, 1.0/256.0, 1.0/256.0);
        vec4 res = fract(depth * bitShift);
        res -= res.xxyz * bitMask;
        return res;
      }`);
  }

  /**
   * Generates fragment shader logic for pick rendering.
   * @protected
   */
  protected fsPickMeshLogic() {
    this._fragSrcBuf.push(`
    outBatchIndex = packUintToRGBA8(vBatchIndex);
    outMeshIndex  = packUintToRGBA8(vMeshIndex);
    float zNormalizedDepth = abs((pickZNear + vViewPosition.z) / (pickZFar - pickZNear));
    outDepth      = packDepth(zNormalizedDepth);
    `);
  }

  /**
   * Declares the snap-pass MRT outputs.
   *
   * Snap techniques target a single RGBA32F render target carrying
   * view-space position. The init pass (`snap === 3`) fills the target
   * across triangle surfaces so the subsequent vertex/edge passes z-test
   * against real geometry; the snap pass itself (`snap === 1` or `2`)
   * only writes where points/lines pass that depth test, so JS can
   * read back and search outward from the cursor for the nearest
   * non-empty texel.
   *
   * `fsColorDeclarations()` is intentionally NOT called by snap
   * techniques — they declare their MRT slot here.
   */
  protected fsSnapDeclarations() {
    this._fragSrcBuf.push(
      "in highp vec3 vSnapViewPosition;",
      "layout(location = 0) out vec4 outSnapViewPosition;",
    );
  }

  /**
   * Generates fragment-shader logic for the snap pass — emit the
   * high-precision view-space position. The alpha channel is a kind
   * tag so the JS read-back can tell apart:
   *
   *   - init pass (`snap === 3`):    alpha = 2.0  (surface depth-only)
   *   - vertex snap (`snap === 1`):  alpha = 1.0
   *   - edge snap   (`snap === 2`):  alpha = 1.0
   *
   * Read-back accepts `alpha === 1.0` only, so init's surface texels
   * never get mistaken for vertex/edge hits — and crucially we don't
   * have to disable colour writes during init (some GL drivers
   * short-circuit fragment writes when the colour mask is fully off,
   * which also drops the depth-write side-effect).
   *
   * Init pass also nudges the surface depth deeper by one pixel of
   * depth gradient (V2's `length(vec2(dFdx, dFdy))` trick) so that
   * coplanar vertex/edge fragments in the snap pass reliably pass
   * LEQUAL against the rasterised surface depth. Without this bump,
   * interpolation noise occasionally pushes a visible vertex's
   * depth a hair past the surface's stored depth — the visible
   * vertex fails LEQUAL, doesn't write, and the read-back falls
   * back to whatever back-of-mesh vertices/edges managed to slip
   * through at the rasteriser's edge cases.
   */
  protected fsSnapLogic() {
    if (this.snap === 3) {
      this._fragSrcBuf.push(
        "    float snapDepth = gl_FragCoord.z;",
        "    gl_FragDepth = snapDepth + length(vec2(dFdx(snapDepth), dFdy(snapDepth)));",
        "    outSnapViewPosition = vec4(vSnapViewPosition, 2.0);",
      );
    } else {
      this._fragSrcBuf.push(
        "    outSnapViewPosition = vec4(vSnapViewPosition, 1.0);",
      );
    }
  }


  /**
   * Declares section-plane varyings in the fragment shader (currently a stub pending section-plane support).
   */
  protected fsSlicingDeclarations() {
    // const numSectionPlanes = this._renderContext.view.getNumAllocatedSectionPlanes();
    // if (numSectionPlanes === 0) {
    //   return;
    // }
    // const src = this._fragSrcBuf;
    // src.push("in vec4 vWorldPosition;");
    // src.push("in boolean vClippable;");
    // for (let i = 0; i < numSectionPlanes; i++) {
    //   src.push("uniform bool sectionPlaneActive" + i + ";");
    //   src.push("uniform vec3 sectionPlanePos" + i + ";");
    //   src.push("uniform vec3 sectionPlaneDir" + i + ";");
    // }
  }

  /**
   * Emits section-plane discarding logic (currently a stub pending section-plane support).
   */
  protected fsSlicingLogic() {
    // const numSectionPlanes = this._renderContext.view.getNumAllocatedSectionPlanes();
    // if (numSectionPlanes === 0) {
    //   return;
    // }
    // const src = this._fragSrcBuf;
    // src.push("  if (vClippable) {");
    // src.push("    float dist = 0.0;");
    // for (let i = 0; i < numSectionPlanes; i++) {
    //   src.push("    if (sectionPlaneActive" + i + ") {");
    //   src.push("      dist += clamp(dot(-sectionPlaneDir" + i + ".xyz, vWorldPosition.xyz - sectionPlanePos" + i + ".xyz), 0.0, 1000.0);");
    //   src.push("    }");
    // }
    // src.push("    if (dist > 0.0) { discard; }");
    // src.push("  }");
  }

  /**
   * Declares the round-points uniform used to discard fragments outside the point circle.
   */
  protected fsPointsDeclarations(): void {
    this._fragSrcBuf.push(`uniform int uRoundPoints;`);
  }

  /**
   * Opens the fragment shader main() function.
   */
  protected fsMainBegin() {
    this._fragSrcBuf.push("void main(void) {");
  }

  /**
   * Appends raw lines to the fragment shader source buffer. For subclasses that
   * need to emit shader code not covered by the base-class helpers.
   */
  protected fsEmit(...lines: string[]) {
    this._fragSrcBuf.push(...lines);
  }

  /**
   * Appends raw lines to the vertex shader source buffer.
   */
  protected vsEmit(...lines: string[]) {
    this._vertSrcBuf.push(...lines);
  }

  /**
   * Closes the fragment shader main() function.
   */
  protected fsMainEnd() {
    this._fragSrcBuf.push("}");
  }

  /**
   * Generates fragment shader logic for point rendering.
   * @protected
   */
  protected fsPointsGeometryLogic(): void {
    this._fragSrcBuf.push(`
  // For points, we have the option of rendering them as circles instead of squares.
  // If roundPoints is enabled, we discard fragments outside a unit circle inscribed within the square point sprite.
  if (uRoundPoints == 1) {
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    float r = dot(cxy, cxy);
    if (r > 1.0) {
      discard;
    }
  }`);
  }

  /**
   * Writes the accumulated color variable to the standard fragment output
   * using the premultiplied-alpha convention: `(rgb * a, a)`.
   *
   * Paired with the blend func `(ONE, ONE_MINUS_SRC_ALPHA)` during the
   * transparent pass, this gives correct blending at partial-coverage edges
   * and after any bilinear filtering. For fully-opaque fragments (a = 1),
   * `rgb * 1 = rgb` — so opaque output is unchanged.
   *
   * Pick techniques write directly to MRT outputs and do NOT call this.
   */
  protected fsOutputColor() {
    this._fragSrcBuf.push("outColor = vec4(color.rgb * color.a, color.a);");
  }

  private _bindTexture(sampler: WebGLUniformLocation | null, dataTexture: { texture: WebGLTexture | null } | null): void {
    if (!sampler || !dataTexture) return;
    const rc = this._renderContext;
    const gl = rc.gl;
    gl.activeTexture(gl.TEXTURE0 + rc.textureUnit);
    gl.bindTexture(gl.TEXTURE_2D, dataTexture.texture);
    gl.uniform1i(sampler, rc.textureUnit);
    rc.textureUnit = (rc.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;
  }

  /**
   * Cubemap counterpart to {@link _bindTexture} — same texture-unit
   * round-robin, but binds to `TEXTURE_CUBE_MAP` instead of
   * `TEXTURE_2D`. Used for the IBL irradiance + prefiltered specular
   * cubemaps (the `samplerCube` path).
   */
  private _bindCubemap(sampler: WebGLUniformLocation | null, texture: WebGLTexture | null): void {
    if (!sampler || !texture) return;
    const rc = this._renderContext;
    const gl = rc.gl;
    gl.activeTexture(gl.TEXTURE0 + rc.textureUnit);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
    gl.uniform1i(sampler, rc.textureUnit);
    rc.textureUnit = (rc.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;
  }

  /**
   * Binds the shader program and sets up the necessary uniforms and textures for rendering.
   * @param renderPass The draw pass identifier, which determines the rendering context (e.g., solid fill, silhouette, picking).
   * @private
   */
  private _bind(renderPass: RenderPassValue): boolean {

    const view = this._renderContext.activeView;
    const gl = this._renderContext.gl;
    const uniforms = this._uniforms;
    const renderContext = this._renderContext;
    const program = this._program;

    if (!program) {
      renderContext.lastProgramId = -1;
      return false;
    }

    if (renderContext.lastProgramId === program.id && renderContext.lastRenderPass === renderPass) {
      return true;
    }

    if (renderContext.lastProgramId !== program.id) {
      program.bind();
      renderContext.lastProgramId = program.id;
      renderContext.textureUnit = 0;
    }

    renderContext.lastRenderPass = renderPass;

    if (uniforms.renderPass) {
      gl.uniform1i(uniforms.renderPass, renderPass);
    }

    if (uniforms.projMatrix) {
      gl.uniformMatrix4fv(uniforms.projMatrix, false, <any>(renderPass === RENDER_PASSES.PICK
        ? renderContext.pickProjMatrix
        : view.camera.projMatrix));
    }

    if (uniforms.perspectivePoints) {
      gl.uniform1i(uniforms.perspectivePoints, view.pointsMaterial.perspectivePoints ? 1 : 0);
    }

    if (uniforms.perspectivePointsMinMax) {
      gl.uniform2f(uniforms.perspectivePointsMinMax, view.pointsMaterial.minPerspectivePointSize, view.pointsMaterial.maxPerspectivePointSize);
    }

    if (uniforms.pointSize) {
      gl.uniform1f(uniforms.pointSize, view.pointsMaterial.pointSize);
    }

    if (uniforms.roundPoints) {
      gl.uniform1i(uniforms.roundPoints, view.pointsMaterial.roundPoints ? 1 : 0);
    }

    if (uniforms.nearPlaneHeight) {
      gl.uniform1f(uniforms.nearPlaneHeight,
        (view.camera.projectionType === OrthoProjectionType)
          ? 1.0
          : gl.drawingBufferHeight / (2 * Math.tan(0.5 * view.camera.perspectiveProjection.fov * Math.PI / 180.0)));
    }

    if (uniforms.pickZNear) {
      gl.uniform1f(uniforms.pickZNear, renderContext.pickZNear);
      gl.uniform1f(uniforms.pickZFar, renderContext.pickZFar);
    }

    if (uniforms.drawingBufferSize) {
      gl.uniform2f(uniforms.drawingBufferSize, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }

    if (uniforms.pickClipPos) {
      gl.uniform2fv(uniforms.pickClipPos, <any>renderContext.pickClipPos);
    }

    if (uniforms.snapClipPos) {
      gl.uniform2fv(uniforms.snapClipPos, <any>renderContext.snapClipPos);
    }

    if (uniforms.snapBufferSize) {
      gl.uniform2fv(uniforms.snapBufferSize, <any>renderContext.snapBufferSize);
    }

    if (uniforms.lightAmbient) {
      gl.uniform4fv(uniforms.lightAmbient, <any>view.getAmbientColorAndIntensity());
    }

    // IBL Layer-2 scalars + matrix. The cubemap samplers themselves
    // are bound by `_draw` after this method returns; here we just push
    // the parameters the shader needs alongside them. Uploaded for
    // every program that has the smooth-shaded uniforms — flat-shaded
    // shaders strip the unused locations and these become no-ops.
    if (uniforms.iblMaxSpecularMipLevel) {
      gl.uniform1f(uniforms.iblMaxSpecularMipLevel, renderContext.iblMaxSpecularMipLevel);
    }
    if (uniforms.iblViewToWorldRot) {
      gl.uniformMatrix3fv(uniforms.iblViewToWorldRot, false, renderContext.iblViewToWorldRot);
    }

    // Primary directional light direction, in view space. Both the Lambert
    // and Cook-Torrance shading branches read this; sourcing it from
    // `view.effects.shadows.direction` keeps the shaded surface and the cast
    // shadow agreeing on which way the sun points. If shadows are disabled
    // we still upload a sane default — the historical hardcoded value lit
    // surfaces from the upper-front-right.
    if (uniforms.primaryLightDirView) {
      const sd: any = (view.effects.shadows && view.effects.shadows.direction) ? view.effects.shadows.direction : [0.0, -1.0, -1.0];
      const sdLen = Math.hypot(sd[0], sd[1], sd[2]) || 1.0;
      const sx = sd[0] / sdLen, sy = sd[1] / sdLen, sz = sd[2] / sdLen;
      const vm = view.camera.viewMatrix;
      const lvx = vm[0] * sx + vm[4] * sy + vm[8]  * sz;
      const lvy = vm[1] * sx + vm[5] * sy + vm[9]  * sz;
      const lvz = vm[2] * sx + vm[6] * sy + vm[10] * sz;
      const llen = Math.sqrt(lvx * lvx + lvy * lvy + lvz * lvz) || 1.0;
      gl.uniform3f(uniforms.primaryLightDirView, lvx / llen, lvy / llen, lvz / llen);
    }

    // Cubemap IBL multiplier — gates the prefiltered-cubemap diffuse +
    // specular contribution. Zero when the active View.renderMode
    // isn't in View.lights.ibl.renderModes; the shader's iblScale=0 path
    // collapses the cubemap term to nothing without recompiling.
    if (uniforms.iblIntensity) {
      const ibl = (view as any).lights?.ibl;
      const iblActive = !!(ibl && ibl.applied && ibl.possible);
      const intensity = iblActive ? ibl.intensity : 0.0;
      gl.uniform1f(uniforms.iblIntensity, intensity);
    }

    // Analytical hemisphere ambient — sky/ground/up plus an intensity,
    // independent of the cubemap path so non-IBL render modes still
    // get directional fill. Zero when the active View.renderMode
    // isn't in View.lights.hemispheric.renderModes.
    const hemi = (view as any).lights?.hemispheric;
    const hemiActive = !!(hemi && hemi.applied && hemi.possible);
    if (uniforms.hemisphereIntensity) {
      const intensity = hemiActive ? hemi.intensity : 0.0;
      gl.uniform1f(uniforms.hemisphereIntensity, intensity);
    }
    if (uniforms.hemisphereSky)    gl.uniform3fv(uniforms.hemisphereSky,    <any>(hemi ? hemi.skyColor    : [0, 0, 0]));
    if (uniforms.hemisphereGround) gl.uniform3fv(uniforms.hemisphereGround, <any>(hemi ? hemi.groundColor : [0, 0, 0]));
    if (uniforms.hemisphereUpView) {
      // Project world-up into view space so the shader's dot-with-normal
      // stays a single fma. The view matrix's upper 3×3 is a pure
      // rotation, so applying it to a direction is enough — no
      // translation column needed, no inverse, no normal matrix.
      const wu: any = hemi ? hemi.worldUp : [0, 0, 1];
      const vm = view.camera.viewMatrix;
      const ux = vm[0] * wu[0] + vm[4] * wu[1] + vm[8]  * wu[2];
      const uy = vm[1] * wu[0] + vm[5] * wu[1] + vm[9]  * wu[2];
      const uz = vm[2] * wu[0] + vm[6] * wu[1] + vm[10] * wu[2];
      // Re-normalise — defensive, the camera's matrix should already
      // be orthonormal but a non-uniform-scale custom view matrix
      // could break the assumption.
      const len = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1.0;
      gl.uniform3f(uniforms.hemisphereUpView, ux / len, uy / len, uz / len);
    }

    // Bind up to three directional lights for Lambert shading.
    // Keep the binding generic here so we do not need concrete light class imports.
    const lights = <any[]>(((view as any).lightsList) || []);
    for (let i = 0; i < 3; i++) {
      const light = lights[i];
      const dirLoc = uniforms.lightDir[i];
      const colorLoc = uniforms.lightColor[i];

      if (dirLoc) {
        // if (light && light.dir) {
        //   gl.uniform3f(dirLoc, light.dir[0], light.dir[1], light.dir[2]);
        // } else {
          gl.uniform3f(dirLoc, 0.0, 1.0, 1.0);
        //}
      }

      if (colorLoc) {
        if (light && light.color) {
          const intensity = (light.intensity !== undefined && light.intensity !== null) ? light.intensity : 1.0;
          gl.uniform4f(colorLoc, light.color[0], light.color[1], light.color[2], intensity);
        } else {
          gl.uniform4f(colorLoc, 0.0, 0.0, 0.0, 0.0);
        }
      }
    }

    if (uniforms.edgeFadeRange) {
      // Convert the view's [0..1] far-plane fractions into absolute view-space
      // distances at bind time. Camera 'far' lives on the active concrete
      // projection (PerspectiveProjection / OrthoProjection / FrustumProjection
      // all expose it; CustomProjection doesn't, so we fall back to a value
      // that makes the smoothstep collapse beyond any plausible scene).
      const projection = view.camera.projection as { far?: number };
      const far = projection.far ?? 1.0e9;
      const edges = view.effects.edges;
      gl.uniform2f(uniforms.edgeFadeRange, far * edges.edgeFadeStart, far * edges.edgeFadeEnd);
    }

    if (uniforms.silhouetteColor) {
      if (this.edges) {
        if (renderPass === RENDER_PASSES.XRAYED) {
          const material = view.xrayMaterial;
          const color = material.edgeColor;
          gl.uniform4f(uniforms.silhouetteColor, color[0], color[1], color[2], material.edgeAlpha);
        } else if (renderPass === RENDER_PASSES.HIGHLIGHTED) {
          const material = view.highlightMaterial;
          const color = material.edgeColor;
          gl.uniform4f(uniforms.silhouetteColor, color[0], color[1], color[2], material.edgeAlpha);
        } else if (renderPass === RENDER_PASSES.SELECTED) {
          const material = view.selectedMaterial;
          const color = material.edgeColor;
          gl.uniform4f(uniforms.silhouetteColor, color[0], color[1], color[2], material.edgeAlpha);
        } else {
          const material = view.effects.edges;
          const color = material.edgeColor;
          gl.uniform4f(uniforms.silhouetteColor, color[0], color[1], color[2], material.edgeAlpha);
        }
      } else {
        if (renderPass === RENDER_PASSES.XRAYED) {
          const material = view.xrayMaterial;
          const color = material.fillColor;
          gl.uniform4f(uniforms.silhouetteColor, color[0], color[1], color[2], material.fillAlpha);
        } else if (renderPass === RENDER_PASSES.HIGHLIGHTED) {
          const material = view.highlightMaterial;
          const color = material.fillColor;
          gl.uniform4f(uniforms.silhouetteColor, color[0], color[1], color[2], material.fillAlpha);
        } else if (renderPass === RENDER_PASSES.SELECTED) {
          const material = view.selectedMaterial;
          const color = material.fillColor;
          gl.uniform4f(uniforms.silhouetteColor, color[0], color[1], color[2], material.fillAlpha);
        } else {
          gl.uniform4fv(uniforms.silhouetteColor, defaultColor);
        }
      }
    }

    // Note: the SAO occlusion texture is intentionally bound inside _draw,
    // AFTER the per-batch data textures — _draw resets textureUnit to 0 after _bind
    // returns, and the data-texture bindings would clobber the unit this binding used.
    if (uniforms.saoParams) {
      const sao = view.effects.sao;
      // Use the scene render size (accounts for Tonemap.renderScale supersampling)
      // so the fragment shader's UV math matches the SAO texture's resolution.
      const saoVW = renderContext.sceneRenderWidth || gl.drawingBufferWidth;
      const saoVH = renderContext.sceneRenderHeight || gl.drawingBufferHeight;
      gl.uniform4f(uniforms.saoParams, saoVW, saoVH, sao.blendCutoff, sao.blendFactor);
    }

    // Shadow uniforms: the light VP matrix is always uploaded when the shader
    // declares it — the shadow-DEPTH pass needs it even though the shadow-map
    // texture isn't populated yet at that point. The shadowMap sampler itself is
    // bound in _draw (like the SAO sampler), for the same clobber-avoidance reason.
    if (uniforms.shadowLightVP) {
      // Used only by the shadow-depth technique — always the matrix of the
      // cascade being rendered right now (ShadowPipeline writes it per-slice).
      gl.uniformMatrix4fv(uniforms.shadowLightVP, false, renderContext.shadowLightViewProjMatrix);
    }
    if (uniforms.shadowLightVPs) {
      // Used by shadow-aware color techniques — all MAX_SHADOW_CASCADES matrices
      // as one mat4 array. The fragment shader picks the right one per pixel.
      gl.uniformMatrix4fv(uniforms.shadowLightVPs, false, renderContext.shadowLightViewProjMatrices);
    }
    if (uniforms.shadowCascadeSplits) {
      // `shadowCascadeSplits` is a `float[MAX_SHADOW_CASCADES]`. Only entries
      // `0 .. cascadeCount - 2` are meaningful boundaries; everything beyond
      // is set to MAX_VALUE by ShadowPipeline so the cascade-select comparison
      // never upgrades past the last active cascade.
      gl.uniform1fv(uniforms.shadowCascadeSplits, renderContext.shadowCascadeSplits);
    }
    if (uniforms.shadowCascadeCount) {
      gl.uniform1i(uniforms.shadowCascadeCount, renderContext.shadowCascadeCount);
    }
    if (uniforms.shadowParams) {
      const shadows = view.effects.shadows;
      const texelSize = shadows ? 1.0 / Math.max(1, shadows.resolution) : 0.0;
      // shadowParams = (intensity, depthBias, texelSize, normalOffsetBias)
      gl.uniform4f(uniforms.shadowParams,
        shadows ? shadows.intensity : 0.0,
        shadows ? shadows.bias : 0.003,
        texelSize,
        shadows ? shadows.normalOffsetBias : 0.0);
    }
    if (uniforms.shadowPcfRadius) {
      // Kernel size is an odd number in [1, 7]; radius = (size - 1) / 2, so 0..3.
      const size = view.effects.shadows ? view.effects.shadows.pcfKernelSize : 1;
      gl.uniform1i(uniforms.shadowPcfRadius, (size - 1) >> 1);
    }
    if (uniforms.shadowSlope) {
      // (dirViewX, dirViewY, dirViewZ, slopeBias)
      const d = renderContext.shadowLightDirView;
      gl.uniform4f(uniforms.shadowSlope,
        d[0], d[1], d[2],
        view.effects.shadows ? view.effects.shadows.slopeBias : 0.0);
    }
    return true;
  }

  /**
   * Binds the SAO occlusion texture and sets its sampler. Called from _draw after
   * the per-batch data textures are bound, so that this binding is not clobbered.
   */
  private _bindSAOTexture(): void {
    const renderContext = this._renderContext;
    if (!this._samplers.saoOcclusionTexture || !renderContext.saoOcclusionTexture) {
      return;
    }
    const unit = renderContext.textureUnit;
    renderContext.saoOcclusionTexture.bind(unit);
    renderContext.gl.uniform1i(this._samplers.saoOcclusionTexture, unit);
    renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;
  }

  /**
   * Binds one shadow-map depth texture per cascade sampler declared in the
   * current shader, each to its own texture unit. Called from _draw after
   * the per-batch data textures so the units aren't clobbered.
   *
   * Every sampler the shader declares gets a bound texture — unused cascades
   * (beyond `renderContext.shadowCascadeCount`) alias to cascade 0's texture
   * via the same aliasing {@link ShadowPipeline} set up on the array.
   */
  private _bindShadowMapTexture(): void {
    const renderContext = this._renderContext;
    const samplers = this._samplers;
    const gl = renderContext.gl;
    const mapSamplers = [
      samplers.shadowMap0, samplers.shadowMap1, samplers.shadowMap2,
      samplers.shadowMap3, samplers.shadowMap4, samplers.shadowMap5
    ];

    for (let c = 0; c < mapSamplers.length; c++) {
      const sampler = mapSamplers[c];
      if (!sampler) continue;
      const tex = renderContext.shadowMapTextures[c];
      if (!tex) continue;
      const unit = renderContext.textureUnit;
      tex.bind(unit);
      gl.uniform1i(sampler, unit);
      renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;
    }
  }

  /**
   * Destroys the shader program and cleans up resources.
   */
  destroy() {
    if (this._program) {
      this._program.destroy();
    }
    this._program = null;
  }


}


function joinSrc(srcLines: string[], srcLinesWithoutComments: string[], srcLinesWithComments: string[]) {
  for (let i = 0, len = srcLines.length; i < len; i++) {
    // Split each element into lines if it contains newlines
    const lines = srcLines[i].split(/\r\n|\r|\n/);
    for (let n = 0; n < lines.length; n++) {
      let line = lines[n];
      srcLinesWithComments.push(line);
      // Remove line comments (//)
      const idx = line.indexOf("//");
      if (idx >= 0) line = line.slice(0, idx);
      // Remove inline block comments (/* ... */) -- only if on a single line
      line = line.replace(/\/\*.*?\*\//g, "");
      // Preserve leading spaces (do not trim)
      // Only skip lines that are completely empty or whitespace
      if (line.match(/\S/)) srcLinesWithoutComments.push(line);
    }
  }
}
