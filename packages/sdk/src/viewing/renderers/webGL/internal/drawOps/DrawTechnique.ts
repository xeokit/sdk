import {WEBGL_INFO, WebGLProgram} from "../webGL";
import {OrthoProjectionType} from "../../../../../base/constants";
import {RENDER_PASSES, type RenderPassValue} from "../RENDER_PASSES";
import type {RenderContext} from "../RenderContext";
import {type GPUMemoryReader} from "../gpuMemoryManager/GPUMemoryReader";
import {type MeshBatch} from "../meshManager/MeshBatch";
import {SDKErrorType, type SDKResult} from "../../../../../base/core";
import {type WebGLContextProvider} from "../webGL/WebGLContextProvider";
import {DrawTechniqueGeometryBinding} from "./DrawTechniqueGeometryBinding";
import {getSAODebugModeId} from "../../../../viewer/SAOSampling";
import {getShadowPcfRadius} from "../../../../viewer/ShadowSampling";

const defaultColor = new Float32Array([1, 1, 1, 1]);
const defaultAmbientLight = new Float32Array([0.5, 0.5, 0.5, 1.0]);
const defaultPrimaryLightDir = [0.0, -1.0, -1.0];
const ambientLightScratch = new Float32Array(4);

function hasVec3(value: any): value is ArrayLike<number> {
  return value && value.length >= 3;
}

function isAmbientLight(light: any): boolean {
  return light && !hasVec3(light.dir) && !hasVec3(light.pos) && hasVec3(light.color);
}

function isDirectionalLight(light: any): boolean {
  return light && hasVec3(light.dir) && hasVec3(light.color);
}

function getLightIntensity(light: any): number {
  return (light && light.intensity !== undefined && light.intensity !== null) ? light.intensity : 1.0;
}

function getAmbientColorAndIntensity(view: any): Float32Array<any> | ArrayLike<number> {
  const lights = <any[]>((view.lightsList) || []);
  for (let i = 0, len = lights.length; i < len; i++) {
    const light = lights[i];
    if (isAmbientLight(light)) {
      ambientLightScratch[0] = light.color[0];
      ambientLightScratch[1] = light.color[1];
      ambientLightScratch[2] = light.color[2];
      ambientLightScratch[3] = getLightIntensity(light);
      return ambientLightScratch;
    }
  }
  return typeof view.getAmbientColorAndIntensity === "function"
    ? view.getAmbientColorAndIntensity()
    : defaultAmbientLight;
}

function getPrimaryDirectionalLight(view: any): any {
  const lights = <any[]>((view.lightsList) || []);
  for (let i = 0, len = lights.length; i < len; i++) {
    const light = lights[i];
    if (isDirectionalLight(light)) {
      return light;
    }
  }
  return null;
}

/**
 * Maximum number of section (clipping) planes that can be
 * active in a single View. Embedded into the fragment shader as
 * a compile-time `MAX_SECTION_PLANES` constant so the program
 * never recompiles when planes are created or destroyed at
 * runtime; the renderer just updates `uSectionPlaneCount` +
 * the `uSectionPlanes[]` array contents per frame.
 *
 * Pick a number that covers worst-case engineering review —
 * one cut-away plus two cross sections plus a few clipping
 * volumes ≈ 8 is generous. Bumping it later is a one-line
 * change here plus the GLSL constant.
 */
export const MAX_SECTION_PLANES = 8;

/**
 * The minimal shape {@link packSectionPlanes} needs from a section plane: its
 * enabled flag, world-space normal, and the precomputed plane constant
 * `dist = -dot(normal, pos)`. Matches {@link viewing!viewer.SectionPlane}.
 */
export interface SectionPlaneLike {
  readonly active: boolean;
  readonly dir: ArrayLike<number>;
  readonly dist: number;
}

/**
 * Packs a View's active section planes into a flat uniform buffer as
 * `(normal.xyz, dist)` per plane, ready for upload via `gl.uniform4fv`.
 *
 * Active planes densely fill `out[0 .. count*4 - 1]` so a clipping shader's loop
 * bound (`uSectionPlaneCount`) stays uniform and inactive planes cost nothing;
 * the shader evaluates each plane as a single `dot(normal, p) + dist > 0` test.
 * At most {@link MAX_SECTION_PLANES} planes are packed — extras are ignored.
 *
 * Shared by the mesh ({@link _bind}), splat and splat-pick passes so the clip
 * convention can't drift between them.
 *
 * @param planes - The View's section planes (e.g. `view.sectionPlanesList`), or `undefined`.
 * @param out - Scratch buffer of length `MAX_SECTION_PLANES * 4`, filled in place.
 * @returns The number of active planes packed (`0 .. MAX_SECTION_PLANES`).
 */
export function packSectionPlanes(
  planes: ReadonlyArray<SectionPlaneLike> | undefined,
  out: Float32Array<any>,
): number {
  let count = 0;
  if (planes) {
    for (let i = 0; i < planes.length && count < MAX_SECTION_PLANES; i++) {
      const plane = planes[i];
      if (!plane.active) {
        continue;
      }
      const dir = plane.dir;
      out[count * 4 + 0] = dir[0];
      out[count * 4 + 1] = dir[1];
      out[count * 4 + 2] = dir[2];
      out[count * 4 + 3] = plane.dist;
      count++;
    }
  }
  return count;
}

/**
 * Reusable scratch buffer for packing the active section
 * planes into the FS uniform array each frame. Sized to the
 * cap × 4 floats per plane; per draw we fill 0..count*4 and
 * upload `count * 4` floats via gl.uniform4fv.
 */
const SECTION_PLANE_SCRATCH = new Float32Array(MAX_SECTION_PLANES * 4);

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

function shouldLogUsedVertexShaders(): boolean {
  return (globalThis as any).XEOKIT_LOG_USED_VERTEX_SHADERS === true;
}

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
   * Number of vertices per primitive: 3 for triangles, 2 for
   * legacy GL_LINES, **6 for thick-line quad expansion**, 1 for
   * points. Emitted as a compile-time constant into the vertex
   * shader. Public so introspection tools (the shader inspector,
   * the shaders panel) can surface it alongside the source.
   */
  public abstract readonly vertsPerPrim: number;

  /**
   * When false, vertex positions are addressed directly (no index-buffer lookup).
   * Override to false in point-cloud techniques.
   */
  protected readonly useIndexBuffer: boolean = true;

  protected _renderContext: RenderContext;
  private _gpuMemoryReader: GPUMemoryReader;
  protected _program: WebGLProgram | null;
  private _viewUniformFrameId: number = -1;
  private _loggedVertexShaderOnUse: boolean = false;

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
   * {@link BatchGPUResources.vertexNormalTexture}. When false, the fragment
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
   * When true, the technique samples the per-batch albedo /
   * metallic-roughness / normal-map atlases via *triplanar*
   * world-space projection rather than the vertex `vUV`
   * attribute. Used for batches whose meshes have textured
   * materials but no UV coordinates — typical of BIM, sweeps and
   * lofted curve geometry.
   *
   * Mutually exclusive with {@link hasUVs}: triplanar variants
   * are constructed with `hasUVs: false`. Independent axis from
   * {@link hasNormals}; combined into a 6-way variant lookup on
   * the Lambert colour techniques (`(normals?, uvs?, triplanar?)`
   * with `uvs && triplanar` excluded by construction).
   */
  public triplanar: boolean;

  /**
   * When true, line draws are quad-expanded in the vertex shader
   * (six vertices per line, two triangles forming a screen-space
   * aligned rectangle of width `uLineWidth` pixels) so they
   * render at user-controlled thickness across every WebGL2
   * implementation — including ones that clamp `gl.LINES` to a
   * single pixel (notably ANGLE on Windows).
   *
   * Only consulted on the lines path of {@link _draw}: it
   * switches the `LinesPrimitive` draw call from
   * `gl.drawArrays(gl.LINES, …, n * 2)` to
   * `gl.drawArrays(gl.TRIANGLES, …, n * 6)`. Triangle / edge /
   * snap / point draws are unaffected.
   *
   * Mutually exclusive with `edges` / `picking` / `snap` for
   * now — the thick-line shader assumes a `LinesPrimitive`
   * index pair per primitive. Adding thick edges or thick pick
   * lines is mechanical but currently out of scope.
   */
  public thickLines: boolean;

  /**
   * When `true`, the technique's compiled vertex shader rewrites
   * `gl_Position.z` for a logarithmic depth-buffer mapping. See
   * the constructor's `logDepth` config field for the
   * permutation contract and which techniques opt in.
   */
  public logDepth: boolean;

  /**
   * When true, triangle techniques bind their expanded draw
   * vertices from {@link TriangleGeometryVBOBatch}: position+tile,
   * mesh index and geometry vertex index are vertex attributes instead of
   * primitive/index/position/matrix data-texture fetches.
   *
   * The mesh/material/view state still comes from DTX so visibility,
   * style-bin routing, colors, UVs, normals and material
   * atlas attributes stay in the existing update path.
   */
  public vboGeometry: boolean;

  /**
   * Supplies the RTC view matrix as a per-tile uniform for VBO triangle
   * surface draws, avoiding a per-vertex matrix data-texture fetch.
   */
  public vboTileUniform: boolean;

  /**
   * Reads per-view color and render flags from VBO attributes instead of
   * `uMeshViewAttributeTexture`. Intended for lean static VBO surface draws.
   */
  public vboViewAttributes: boolean;

  /**
   * Enables body hatch logic in triangle body shaders. This is a distinct
   * permutation because ordinary untextured VBO body rendering should not pay
   * the per-mesh hatch slot check or hatch-pattern texture fetches.
   */
  public bodyHatch: boolean;

  /**
   * When true, silhouette shaders draw only meshes whose resolved style bin
   * requests a depth-cleared overlay pass.
   */
  public styleBinOverlay: boolean;

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
    edgeColorMode: WebGLUniformLocation; // 1.0 = base edges use darkened mesh colour; 0.0 = use uSilhouetteColor
    edgeDarken: WebGLUniformLocation; // Multiplier on mesh colour when edgeColorMode is on
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
    /**
     * Single `vec4[MAX_SECTION_PLANES]` location for the packed
     * section-plane bank. Filled per frame from the View's
     * active SectionPlane list. Companion to
     * {@link sectionPlaneCount}, which gates the loop bound in
     * the FS so unused slots cost nothing.
     */
    sectionPlanes: WebGLUniformLocation | null;
    sectionPlaneCount: WebGLUniformLocation | null;
    projMatrix: WebGLUniformLocation;
    /**
     * Logarithmic-depth coefficient (`2 / log2(far + 1)`). Only
     * populated when {@link logDepth} is true on the technique;
     * the VS's `vsLogDepthLogic` snippet reads it to rewrite
     * `gl_Position.z`. Updated once per frame from
     * `view.camera.perspectiveProjection.far`.
     */
    logDepthCoef: WebGLUniformLocation | null;
    lightPos: WebGLUniformLocation[];
    lightDir: WebGLUniformLocation[];
    lightColor: WebGLUniformLocation[];
    lightAttenuation: WebGLUniformLocation[];
    lightAmbient: WebGLUniformLocation;
    primaryLightDirView: WebGLUniformLocation;
    iblMaxSpecularMipLevel: WebGLUniformLocation;
    iblViewToWorldRot: WebGLUniformLocation;
    saoParams: WebGLUniformLocation;
    saoDebugMode: WebGLUniformLocation;
    shadowLightVP: WebGLUniformLocation;       // singular — depth pass uses one cascade at a time
    shadowLightVPs: WebGLUniformLocation;      // mat4[MAX_SHADOW_CASCADES] — color pass picks per fragment
    shadowCascadeSplits: WebGLUniformLocation; // vec4 — view-space |z| boundaries between cascades
    shadowCascadeCount: WebGLUniformLocation;  // int — how many entries of the arrays carry data
    shadowParams: WebGLUniformLocation;
    shadowSoftParams: WebGLUniformLocation;
    shadowCascadeDepthRanges: WebGLUniformLocation;
    shadowCascadeTexelSizes: WebGLUniformLocation;
    shadowPcfRadius: WebGLUniformLocation;
    shadowSlope: WebGLUniformLocation;
    edgeFadeRange: WebGLUniformLocation; // vec2(start, end) view-space distances; only edge techniques declare this
    iblIntensity:        WebGLUniformLocation;  // float — gates the cubemap diffuse + specular contribution
    hemisphereIntensity: WebGLUniformLocation;  // float — gates the analytical hemisphere ambient term
    hemisphereSky:       WebGLUniformLocation;  // vec3 linear-RGB sky colour
    hemisphereGround:    WebGLUniformLocation;  // vec3 linear-RGB ground colour
    hemisphereUpView:    WebGLUniformLocation;  // vec3 world-up direction expressed in view space
    lineWidth:           WebGLUniformLocation;   // float — pixel thickness for quad-expanded thick lines (only declared by thick-line techniques)
    lineJoinRound:       WebGLUniformLocation;   // int — 0 = miter joints (default), 1 = round joints (overlapping half-disc caps)
    linePattern:         WebGLUniformLocation;   // float[8] — dash/gap entries in line-width units (only declared by the thick-line colour FS)
    linePatternLen:      WebGLUniformLocation;   // int — number of pattern entries in use (0 = solid, no pattern walk)
    linePatternPeriod:   WebGLUniformLocation;   // float — sum of in-use pattern entries (the modulus base for the FS walk)
    rtcViewMatrix:       WebGLUniformLocation | null; // Per-tile RTC view matrix for VBO tile-uniform shaders
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
    linePatternTexture: WebGLUniformLocation | null; // Per-batch dash/gap pattern slots (only declared by thick-line techniques)
    polylineCumDistTexture: WebGLUniformLocation | null; // Per-batch per-segment cumulative model distance from polyline start (only declared by thick-line techniques)
    hatchPatternTexture: WebGLUniformLocation | null; // Per-batch screen-space hatch slots (only declared by triangle-surface techniques)
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
    emissiveAtlas: WebGLUniformLocation | null; // sRGB 2D emissive atlas (only when hasUVs)
    occlusionAtlas: WebGLUniformLocation | null; // Linear 2D ambient-occlusion atlas (only when hasUVs)
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
    triplanar?: boolean,
    thickLines?: boolean,
    vboGeometry?: boolean,
    vboTileUniform?: boolean,
    vboViewAttributes?: boolean,
    bodyHatch?: boolean,
    styleBinOverlay?: boolean,
    /**
     * Permutation flag. When `true`, the technique's vertex
     * shader rewrites `gl_Position.z` so the depth-buffer mapping
     * becomes *logarithmic* in view-space distance — same trick
     * Cesium / Three.js use to get usable depth resolution across
     * scenes that span huge distance ranges (UTM-scale terrain +
     * close-up BIM, archipelagos, infinite landscapes). Done
     * vertex-side so early-Z stays on; mid-triangle depth is
     * linearly interpolated (fine for typical BIM-shaped meshes).
     *
     * Default `false`. Picking / snap / shadow-depth techniques
     * deliberately stay linear; their depth read-back math
     * would have to grow a `log2` term to match.
     */
    logDepth?: boolean,
  } = {
    edges: false,
    picking: false,
    snap: 0,
    hasNormals: false,
    hasUVs: false,
    triplanar: false,
    thickLines: false,
    vboGeometry: false,
    vboTileUniform: false,
    vboViewAttributes: false,
    bodyHatch: false,
    styleBinOverlay: false,
    logDepth: false,
  }) {
    if (cfg.picking && cfg.edges) { // Edges are an un-pickable visual effect
      throw new Error("Invalid DrawTechnique configuration: cannot have both picking and edges enabled.");
    }
    if (cfg.snap && cfg.picking) {
      throw new Error("Invalid DrawTechnique configuration: cannot have both picking and snap enabled.");
    }
    if (cfg.triplanar && cfg.hasUVs) { // Triplanar replaces vertex UVs by definition
      throw new Error("Invalid DrawTechnique configuration: cannot have both triplanar and hasUVs enabled.");
    }
    if (cfg.vboGeometry && cfg.thickLines) {
      throw new Error("Invalid DrawTechnique configuration: vboGeometry is supported by triangle surface, pick, edge and snap techniques only.");
    }
    if (cfg.vboGeometry && cfg.snap === 3 && cfg.edges) {
      throw new Error("Invalid DrawTechnique configuration: VBO snap-init must use triangle geometry, not edge geometry.");
    }
    if (cfg.vboGeometry && (cfg.snap === 1 || cfg.snap === 2) && !cfg.edges) {
      throw new Error("Invalid DrawTechnique configuration: VBO vertex/edge snap requires edge geometry.");
    }
    this._renderContext = renderContext;
    this._gpuMemoryReader = gpuMemoryReader;
    this.edges = cfg.edges === true;
    this.picking = cfg.picking === true;
    this.snap = (cfg.snap ?? 0) as (0 | 1 | 2 | 3);
    this.hasNormals = cfg.hasNormals === true;
    this.hasUVs = cfg.hasUVs === true;
    this.triplanar = cfg.triplanar === true;
    this.thickLines = cfg.thickLines === true;
    this.vboGeometry = cfg.vboGeometry === true;
    this.vboTileUniform = cfg.vboTileUniform === true;
    this.vboViewAttributes = cfg.vboViewAttributes === true;
    this.bodyHatch = cfg.bodyHatch === true;
    this.styleBinOverlay = cfg.styleBinOverlay === true;
    this.logDepth = cfg.logDepth === true;
    this._program = null;
  }

  /**
   * Initializes this draw technique by building and compiling the shader program.
   *
   * Calls the abstract methods {@link buildVertexShader} and {@link buildFragmentShader} to generate the shader sources,
   * then compiles the program and retrieves uniform/sampler locations.
   */
  public init(): SDKResult<any> {
    const linkResult = this.linkProgram();
    if (linkResult.ok === false) {
      return linkResult;
    }
    return this.finalizeProgram();
  }

  /**
   * Phase 1: build the shader sources, create the program, and issue the
   * compile/link — **without** reading back compile/link status. Driving a
   * batch of techniques through `linkProgram()` first, then `finalizeProgram()`,
   * lets the driver compile them concurrently instead of one at a time (the
   * status read-backs in {@link finalizeProgram} are what would serialize them).
   */
  public linkProgram(): SDKResult<any> {

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

    return this._program.link();
  }

  /**
   * Phase 2: read back compile/link status and cache uniform/sampler locations.
   * Call after {@link linkProgram}. Split into {@link waitLinked} (compile-wait)
   * and {@link extractLocations} (synchronous location queries) so a batch can
   * be measured / driven in those two sub-phases.
   */
  public finalizeProgram(): SDKResult<any> {
    const waitResult = this.waitLinked();
    if (waitResult.ok === false) {
      return waitResult;
    }
    return this.extractLocations();
  }

  /** Phase 2a — block on the program's compile/link status (compile-wait). */
  public waitLinked(): SDKResult<any> {
    return this._program.waitLinked();
  }

  /** Phase 2b — read program + technique uniform/sampler locations (synchronous). */
  public extractLocations(): SDKResult<any> {
    const result = this._program.extractLocations();
    if (result.ok === false) {
      return result;
    }
    this._extractTechniqueLocations();
    this._viewUniformFrameId = -1;
    return {ok: true, value: null};
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
    // Restore re-links the existing program (single-phase) then re-caches its
    // uniform/sampler locations.
    const result = this._program.init();
    if (result.ok === false) {
      return result;
    }
    this._extractTechniqueLocations();
    this._viewUniformFrameId = -1;
    return {ok: true, value: undefined};
  }

  /**
   * Caches this technique's uniform and sampler locations off the linked
   * program. Call after the program is linked + finalized.
   * @private
   */
  private _extractTechniqueLocations(): void {

    const program = this._program;

    this._uniforms = {
      primBaseIndex: program.getLocation("uPrimBaseIndex"),
      renderPass: program.getLocation("uRenderPass"),
      gammaFactor: program.getLocation("uGammaFactor"),
      projMatrix: program.getLocation("uProjMatrix"),
      logDepthCoef: program.getLocation("uLogDepthCoef"),
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
      lineWidth: program.getLocation("uLineWidth"),
      lineJoinRound: program.getLocation("uLineJoinRound"),
      linePattern: program.getLocation("uLinePattern[0]"),
      linePatternLen: program.getLocation("uLinePatternLen"),
      linePatternPeriod: program.getLocation("uLinePatternPeriod"),
      rtcViewMatrix: program.getLocation("uRTCViewMatrix"),
      silhouetteColor: program.getLocation("uSilhouetteColor"),
      edgeColorMode:     program.getLocation("uEdgeColorMode"),
      edgeDarken:        program.getLocation("uEdgeDarken"),
      sectionPlanes:     program.getLocation("uSectionPlanes[0]"),
      sectionPlaneCount: program.getLocation("uSectionPlaneCount"),
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
      saoDebugMode: program.getLocation("saoDebugMode"),
      shadowLightVP: program.getLocation("uShadowLightVP"),
      shadowLightVPs: program.getLocation("uShadowLightVPs[0]"),
      shadowCascadeSplits: program.getLocation("uShadowCascadeSplits[0]"),
      shadowCascadeCount: program.getLocation("uShadowCascadeCount"),
      shadowParams: program.getLocation("uShadowParams"),
      shadowSoftParams: program.getLocation("uShadowSoftParams"),
      shadowCascadeDepthRanges: program.getLocation("uShadowCascadeDepthRanges[0]"),
      shadowCascadeTexelSizes: program.getLocation("uShadowCascadeTexelSizes[0]"),
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
      // Null for techniques that don't declare uLinePatternTexture
      // (everything except the thick-line VS path). _bindTexture
      // skips a null sampler — no wasted GL binds on the
      // non-line techniques.
      linePatternTexture: program.getSampler("uLinePatternTexture"),
      // Same gate as linePatternTexture — only the thick-line
      // VS path declares the polyline cum-dist sampler.
      polylineCumDistTexture: program.getSampler("uPolylineCumDistTexture"),
      // Null for techniques that don't declare uHatchPatternTexture
      // (everything except triangle-surface techniques that
      // call vsHatchDeclarations). Same no-op binding when null.
      hatchPatternTexture: program.getSampler("uHatchPatternTexture"),
      meshViewAttributeTexture: program.getSampler("uMeshViewAttributeTexture"),
      meshMatrixTexture: program.getSampler("uMeshMatrixTexture"),
      geometryAttributes: program.getSampler("uGeometryAttributeTexture"),
      geometryQuantRangeTexture: program.getSampler("uGeometryQuantRangeTexture"),
      viewTileCameraMatrixTexture: program.getSampler("uViewTileCameraMatrixTexture"),
      vertexPositionTexture: program.getSampler("uVertexPositionTexture"),
      vertexColorTexture: program.getSampler("uVertexColorTexture"),
      vertexNormalTexture: this.hasNormals && !this.vboGeometry ? program.getSampler("uVertexNormalTexture") : null,
      vertexUVTexture: this.hasUVs ? program.getSampler("uVertexUVTexture") : null,
      // Atlas samplers — bound by both the UV-attribute path and the
      // triplanar fallback. Only the UV path samples through `vUV`; the
      // triplanar path derives its sample coordinates from `vWorldPos`
      // but reads through the same per-batch atlases and the same
      // per-mesh sub-rect transforms.
      albedoAtlas:            (this.hasUVs || this.triplanar) ? program.getSampler("uAlbedoAtlas") : null,
      metallicRoughnessAtlas: (this.hasUVs || this.triplanar) ? program.getSampler("uMetallicRoughnessAtlas") : null,
      normalMapAtlas:         (this.hasUVs || this.triplanar) ? program.getSampler("uNormalMapAtlas") : null,
      emissiveAtlas:          (this.hasUVs || this.triplanar) ? program.getSampler("uEmissiveAtlas") : null,
      occlusionAtlas:         (this.hasUVs || this.triplanar) ? program.getSampler("uOcclusionAtlas") : null,
      iblIrradianceCubemap: this.hasNormals ? program.getSampler("uIBLIrradianceCubemap") : null,
      iblPrefilteredCubemap: this.hasNormals ? program.getSampler("uIBLPrefilteredCubemap") : null,
      iblBRDFLUT: this.hasNormals ? program.getSampler("uIBLBRDFLUT") : null,
      indexTexture: program.getSampler("uIndexTexture"),
      edgeIndexTexture: program.getSampler("uEdgeIndexTexture"),
      saoOcclusionTexture: program.getSampler("saoOcclusionTexture"),
      shadowMapTexture: program.getSampler("uShadowMapTexture"),
      shadowMap0: program.getSampler("uShadowMap0"),
      shadowMap1: program.getSampler("uShadowMap1"),
      shadowMap2: program.getSampler("uShadowMap2"),
      shadowMap3: program.getSampler("uShadowMap3"),
      shadowMap4: program.getSampler("uShadowMap4"),
      shadowMap5: program.getSampler("uShadowMap5")
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

  private _logVertexShaderOnFirstUse(meshBatch: MeshBatch, renderPass: RenderPassValue): void {
    if (this._loggedVertexShaderOnUse || !shouldLogUsedVertexShaders()) {
      return;
    }
    this._loggedVertexShaderOnUse = true;

    const primitive: any = meshBatch.primitive;
    const primitiveName = typeof primitive === "function"
      ? primitive.name
      : String(primitive);
    const label = [
      "[xeokit] GLSL vertex shader used",
      this.constructor.name,
      `pass=${renderPass}`,
      `primitive=${primitiveName}`,
      `vboGeometry=${this.vboGeometry}`,
      `vboTileUniform=${this.vboTileUniform}`,
      `vboViewAttributes=${this.vboViewAttributes}`,
      `hasNormals=${this.hasNormals}`,
      `hasUVs=${this.hasUVs}`,
      `triplanar=${this.triplanar}`,
      `bodyHatch=${this.bodyHatch}`,
      `edges=${this.edges}`,
      `picking=${this.picking}`,
      `snap=${this.snap}`,
      `thickLines=${this.thickLines}`
    ].join(" ");
    const entry = {
      label,
      technique: this.constructor.name,
      renderPass,
      primitive: primitiveName,
      vboGeometry: this.vboGeometry,
      vboTileUniform: this.vboTileUniform,
      vboViewAttributes: this.vboViewAttributes,
      hasNormals: this.hasNormals,
      hasUVs: this.hasUVs,
      triplanar: this.triplanar,
      bodyHatch: this.bodyHatch,
      edges: this.edges,
      picking: this.picking,
      snap: this.snap,
      thickLines: this.thickLines,
      vertexShaderSrc: this.vertexShaderSrc
    };
    const debugGlobal = globalThis as any;
    (debugGlobal.XEOKIT_USED_VERTEX_SHADERS ??= []).push(entry);
    console.groupCollapsed?.(label);
    console.log(this.vertexShaderSrc);
    console.groupEnd?.();
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
    const gpuResources = this._gpuMemoryReader.gpuResources;
    const batchResources = gpuResources.batches[meshBatch.gpuMemoryBatchIndex];
    const viewIndex = view.viewIndex;
    const batchViewResources = batchResources.views[viewIndex];
    const geometryBinding = DrawTechniqueGeometryBinding.resolve({
      batchResources,
      primitive: meshBatch.primitive,
      viewIndex,
      renderPass,
      edges: this.edges,
      picking: this.picking,
      snap: this.snap,
      thickLines: this.thickLines,
      hasNormals: this.hasNormals,
      vboGeometry: this.vboGeometry,
      vboTileUniform: this.vboTileUniform,
      vboViewAttributes: this.vboViewAttributes,
      tileMatrixTexture: (this._renderContext.rayPicking
        ? gpuResources.viewTilePickMatrixTexture
        : gpuResources.viewTileCameraMatrixTexture)
        [view.viewIndex],
      setTileViewMatrix: (matrix) => {
        if (this._uniforms.rtcViewMatrix) {
          gl.uniformMatrix4fv(this._uniforms.rtcViewMatrix, false, matrix as any);
        }
      }
    });

    if (!geometryBinding) {
      return {
        ok: true,
        value: null // Nothing to draw for this pass, or no compatible geometry binding.
      };
    }

    this._logVertexShaderOnFirstUse(meshBatch, renderPass);

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

    renderContext.textureUnit = 0;

    // Texture binds are repeated here; batch-level bind caching is a separate optimization.

    if (!this.vboTileUniform) {
      this._bindTexture(samplers.viewTileCameraMatrixTexture,
        (this._renderContext.rayPicking
          ? gpuResources.viewTilePickMatrixTexture
          : gpuResources.viewTileCameraMatrixTexture)
          [view.viewIndex]);
    }

    geometryBinding.bindGeometryTextures(
      samplers,
      (sampler, dataTexture) => this._bindTexture(sampler, dataTexture ?? null)
    );
    if (this.hasNormals && batchResources.vertexNormalTexture) {
      this._bindTexture(samplers.vertexNormalTexture, batchResources.vertexNormalTexture);
    }
    if (this.hasUVs && batchResources.vertexUVTexture) {
      this._bindTexture(samplers.vertexUVTexture, batchResources.vertexUVTexture);
    }
    // Atlas binds — required by both the UV-attribute path and the
    // triplanar fallback. Triplanar batches are routed to a dedicated
    // shader variant that derives sample coordinates from `vWorldPos`,
    // but they still read through the same per-batch atlases populated
    // when each mesh attaches.
    //
    // For mipmapped atlases, `flushMipmaps()` runs immediately
    // before each bind. The call is a one-branch no-op when the
    // atlas isn't dirty (per-bind cost ≈ a property read), and
    // pays one `gl.generateMipmap` per atlas per frame when it
    // is — independent of how many `addTexture` / `updateTexture`
    // calls landed since the previous draw.
    // A mip refresh (only while a model is loading) binds the atlas on the
    // active unit outside the per-unit tracking, so clear the tracking whenever
    // flushMipmaps reports it ran.
    const _bindAtlases = (this.hasUVs || this.triplanar);
    if (_bindAtlases && batchResources.albedoAtlasTexture && batchResources.albedoAtlasTexture.texture) {
      if (batchResources.albedoAtlasTexture.flushMipmaps()) renderContext.resetTextureBindings();
      // The atlas isn't a DataTexture (no CPU buffer, no texelFetch — it's
      // a real sampler2D), but its `.texture` field is shape-compatible
      // with `_bindTexture`'s expectations.
      this._bindTexture(samplers.albedoAtlas, batchResources.albedoAtlasTexture);
    }
    if (_bindAtlases && batchResources.metallicRoughnessAtlasTexture && batchResources.metallicRoughnessAtlasTexture.texture) {
      if (batchResources.metallicRoughnessAtlasTexture.flushMipmaps()) renderContext.resetTextureBindings();
      this._bindTexture(samplers.metallicRoughnessAtlas, batchResources.metallicRoughnessAtlasTexture);
    }
    if (_bindAtlases && batchResources.normalMapAtlasTexture && batchResources.normalMapAtlasTexture.texture) {
      if (batchResources.normalMapAtlasTexture.flushMipmaps()) renderContext.resetTextureBindings();
      this._bindTexture(samplers.normalMapAtlas, batchResources.normalMapAtlasTexture);
    }
    if (_bindAtlases && batchResources.emissiveAtlasTexture && batchResources.emissiveAtlasTexture.texture) {
      if (batchResources.emissiveAtlasTexture.flushMipmaps()) renderContext.resetTextureBindings();
      this._bindTexture(samplers.emissiveAtlas, batchResources.emissiveAtlasTexture);
    }
    if (_bindAtlases && batchResources.occlusionAtlasTexture && batchResources.occlusionAtlasTexture.texture) {
      if (batchResources.occlusionAtlasTexture.flushMipmaps()) renderContext.resetTextureBindings();
      this._bindTexture(samplers.occlusionAtlas, batchResources.occlusionAtlasTexture);
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
    this._bindTexture(samplers.meshAttributeTexture, batchResources.meshAttributeTexture);
    // Bind the per-batch line-pattern table only for techniques
    // that declared `uLinePatternTexture` — the bind code
    // short-circuits a null sampler, so the cost on non-line
    // techniques (which never declared the uniform) is zero.
    this._bindTexture(samplers.linePatternTexture, batchResources.linePatternTexture);
    // Same shape for the polyline cum-dist texture.
    this._bindTexture(samplers.polylineCumDistTexture, batchResources.polylineCumDistTexture);
    // Same shape for the per-batch hatch table — only the
    // triangle-surface colour techniques declare the sampler,
    // everyone else short-circuits on the null location.
    this._bindTexture(samplers.hatchPatternTexture, batchResources.hatchPatternTexture);
    if (!this.vboViewAttributes) {
      this._bindTexture(samplers.meshViewAttributeTexture, batchViewResources.meshViewAttributeTexture);
    }
    this._bindTexture(samplers.geometryAttributes, batchResources.geometryAttributeTexture);

    // Bind SAO occlusion texture after all per-batch data textures so its texture
    // unit isn't clobbered by the data-texture bindings above.
    this._bindSAOTexture();
    this._bindShadowMapTexture();

    if (this._uniforms.batchIndex) {
      gl.uniform1ui(this._uniforms.batchIndex, meshBatch.gpuMemoryBatchIndex);
    }

    gl.uniform1i(this._uniforms.primBaseIndex, 0);

    const drawResult = geometryBinding.draw(gl, drawInspector);
    if (drawResult.ok === false) {
      return drawResult;
    }

    const inspectorRange = geometryBinding.inspectorRange;
    drawInspector?.drawMeshBatch(meshBatch, renderPass, {
      firstPrim: inspectorRange.firstPrim,
      numPrims: inspectorRange.numPrims
    }, this.edges, {
      drawPath: this.vboGeometry ? "vbo" : "dtx",
      technique: this.constructor.name,
      edges: this.edges,
      picking: this.picking,
      snap: this.snap
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

${this.vboGeometry
        ? `// This shader renders triangle geometry from batch-owned VBOs,
// while still fetching mesh/material/view state from GPU data textures.
// The pipeline is:
//   VBO vertex → mesh → geometry metadata → world/RTC tile → view → clip`
        : `// This shader renders primitives by fetching all geometry,
// transform, and attribute data from GPU data textures.
// The pipeline is:
//   gl_VertexID → primitive → mesh → geometry → vertex → model → world → view → clip`}`);
  }

  /**
   * Emits uniforms, samplers, structs, and GPU data-texture helper functions shared by all
   * techniques.  Every vertex shader calls this once, right after {@link vsHeader}.
   */
  protected vsCommonDeclarations() {
    const usesVBOGeometry = this.vboGeometry;
    const usesVBONormals = this.vboGeometry && this.hasNormals;
    const needsNormalTexture = this.hasNormals && !usesVBONormals;
    const needsDTXGeometryFetch = !usesVBOGeometry;
    const needsGeometryAttributes = needsDTXGeometryFetch || needsNormalTexture || this.hasUVs;
    const needsMeshAttributes = needsDTXGeometryFetch || needsGeometryAttributes || this.hasNormals || this.bodyHatch || this.thickLines || this.triplanar;
    const needsQuantRange = needsDTXGeometryFetch;
    const needsMeshMatrix = needsDTXGeometryFetch;
    const needsBillboardHelpers = needsDTXGeometryFetch;
    const needsVertexColor = needsDTXGeometryFetch && this.vertsPerPrim === 1;
    const needsPickPacking = this.picking;
    const needsMaterialPacking = this.hasNormals;
    const needsUVPacking = this.hasUVs || this.triplanar;
    this._vertSrcBuf.push(`

// ─────────────────────────────────────────────────────────────
// Global draw configuration
// ─────────────────────────────────────────────────────────────

uniform int uRenderPass;
uniform int uPrimBaseIndex;

uniform mat4 uProjMatrix;
${this.vboGeometry ? `
// VBO geometry attributes. Layout matches TriangleGeometryVBOBatch's
// hybrid VAO: position is already mesh-matrix-baked in RTC tile space;
// mesh/geometry-vertex indices keep DTX state, normals and UVs addressable.
layout(location = 0) in vec4 aPositionAndTile;
layout(location = 1) in uint aMeshIndex;
layout(location = 2) in uint aGeometryVertexIndex;
${this.vboViewAttributes ? `layout(location = 3) in vec4 aViewColor;
layout(location = 4) in uvec4 aRenderFlags;
` : ``}
${usesVBONormals ? `layout(location = 5) in uvec2 aNormal;
` : ``}
` : ``}

// ─────────────────────────────────────────────────────────────
// GPU data textures (structured storage via texelFetch)
// ─────────────────────────────────────────────────────────────

${needsDTXGeometryFetch ? `
uniform highp usampler2D uPrimitiveMeshIndexTexture;
uniform highp usampler2D uVertexPositionTexture;
${needsVertexColor ? `uniform highp usampler2D uVertexColorTexture;
` : ``}uniform highp usampler2D uIndexTexture;` : ``}${needsNormalTexture ? `
uniform highp usampler2D uVertexNormalTexture;` : ``}${this.hasUVs ? `
uniform highp sampler2D  uVertexUVTexture;` : ``}
// uniform highp usampler2D uEdgeIndexTexture;
${this.vboTileUniform ? `uniform mat4 uRTCViewMatrix;` : `uniform highp sampler2D  uViewTileCameraMatrixTexture;`}
${needsMeshMatrix ? `
uniform highp sampler2D  uMeshMatrixTexture;
` : ``}
${needsMeshAttributes ? `
uniform highp usampler2D uMeshAttributeTexture;
` : ``}
${this.vboViewAttributes ? `` : `uniform highp usampler2D uMeshViewAttributeTexture;`}
${needsGeometryAttributes ? `
uniform highp usampler2D uGeometryAttributeTexture;
` : ``}${needsQuantRange ? `
uniform highp sampler2D  uGeometryQuantRangeTexture;
` : ``}

// ─────────────────────────────────────────────────────────────
// Data structures stored inside textures
// ─────────────────────────────────────────────────────────────

${needsQuantRange ? `struct QuantRange {
  vec3 offset;
  vec3 scale;
};
` : ``}

${needsMeshAttributes ? `struct MeshAttribTable {
  uint tileIndex;
  uint geometryIndex;
  // Packed Cook-Torrance material: byte 0 = roughness, byte 1 = metallic
  // (each in 0..255, mapped from [0, 1]). Bytes 2-3 are reserved for
  // future per-mesh material flags. Only consumed by the smooth-shaded
  // technique variant; flat-shaded shaders ignore it.
  uint material;
  // Packed scalar surface layers: byte 0 = clearcoat strength, byte 1 =
  // clearcoat roughness, byte 2 = sheen strength, byte 3 = sheen roughness
  // (each in 0..255, mapped from [0, 1]).
  uint clearcoat;
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
  uint emissiveUVOffsetPacked;
  uint emissiveUVScalePacked;
  uint occlusionUVOffsetPacked;
  uint occlusionUVScalePacked;
  // Emissive colour factor packed RGB8 (r | g<<8 | b<<16). Multiplied
  // against the emissive texture sample; [0,0,0] (no emissive texture)
  // suppresses the atlas's white sentinel so untextured meshes don't glow.
  uint emissiveColorPacked;
  // World-units-per-repeat for triplanar texture sampling. Stored
  // CPU-side as the IEEE-754 Float32 bit pattern of
  // SceneMaterial.triplanarScale; recovered here with
  // uintBitsToFloat. Only consumed by the triplanar technique
  // variant; UV-bearing variants ignore it.
  float triplanarScale;
  // Per-mesh pixel line thickness, IEEE-754 Float32 bit pattern.
  // 0 means "use the global uLineWidth uniform"; the thick-line
  // technique reads this and falls back if zero.
  float lineWidth;
  // Index into the per-batch line-pattern texture (allocated
  // per-material by GPUMemoryBatch). 0 = no per-mesh pattern
  // (inherit the View's linesMaterial.linePattern); > 0 =
  // texel pair to fetch from uLinePatternTexture.
  uint linePatternSlot;
  // Index into the per-batch hatch-pattern texture. 0 = no
  // hatch (surface renders normally); > 0 = 5-texel slot to
  // fetch from uHatchPatternTexture.
  uint hatchPatternSlot;
  // Billboard mode. 0 = none, 1 = spherical.
  uint billboard;
};
` : ``}

struct MeshViewAttributes {
  uvec4 color;
  uvec4 renderFlags;
};

${needsGeometryAttributes ? `struct GeometryAttributes {
  uint verticesBase;
  uint indicesBase;
  uint edgeIndicesBase;
  uint normalsBase;
  uint uvsBase;
  // Base offset into the per-batch polyline-cum-dist texture.
  // 0 for non-LinesPrimitive geometries and for line geometries
  // whose batch never allocated the cum-dist texture. The
  // thick-line VS reads this + primOffset to fetch one float
  // per segment: the cumulative model-space distance from the
  // segment's polyline start.
  uint polylineCumDistBase;
  uint vertexColorsBase;
};
` : ``}

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
${needsDTXGeometryFetch ? `uvec2 getPrimData(uint primIndex) {
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
` : ``}${needsVertexColor ? `
uvec4 getVertexColor(uint vertexIndexWithinGeometry) {
  const uint texWidth = 4096u;
  return texelFetch(uVertexColorTexture, texCoord(vertexIndexWithinGeometry, texWidth), 0).rgba;
}` : ``}${this.hasNormals ? `

// Octahedral RG16UI normal fetch + decode. The encoder maps unit-vector
// octahedral coords from [-1, 1] to [0, 65535]; we undo that, then run the
// standard signed-zero unwrap before normalising. Decoding in the vertex
// stage so the varying is a vec3 — interpolating octahedral coords across
// the triangle would produce incorrect normals.
${needsNormalTexture ? `
uvec2 getVertexNormalPacked(uint vertexIndexWithinGeometry) {
  const uint texWidth = 4096u;
  return texelFetch(uVertexNormalTexture, texCoord(vertexIndexWithinGeometry, texWidth), 0).rg;
}
` : ``}

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

${needsQuantRange ? `QuantRange getGeometryQuantRange(uint geometryIndex) {
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
` : ``}

${needsGeometryAttributes ? `GeometryAttributes getGeometryAttributeTexture(uint geometryIndex) {
  // Two texels per geometry — the texture holds 8 u32 slots of metadata
  // per item to leave room for future per-attribute base addresses.
  const uint texWidth = 4096u;
  const uint texelsPerItem = 2u;
  uint base = geometryIndex * texelsPerItem;
  uvec4 t0 = texelFetch(uGeometryAttributeTexture, texCoord(base + 0u, texWidth), 0);
  uvec4 t1 = texelFetch(uGeometryAttributeTexture, texCoord(base + 1u, texWidth), 0);
  GeometryAttributes s;
  s.verticesBase         = t0.r;
  s.indicesBase          = t0.g;
  s.edgeIndicesBase      = t0.b;
  s.normalsBase          = t0.a;
  s.uvsBase              = t1.r;
  s.polylineCumDistBase  = t1.g;
  s.vertexColorsBase     = t1.b;
  return s;
}
` : ``}

${needsMeshAttributes ? `MeshAttribTable getMeshAttribTable(uint meshIndex) {
  // Mesh attributes are packed into five texels, but each compiled
  // technique fetches only the texels it can actually consume.
  // texel 0: tile/geometry/material/flags, line + hatch slots.
  // texel 1: albedo + metallic/roughness UV transforms.
  // texel 2: normal-map UV transform, triplanar scale, line width.
  // texel 3: emissive + occlusion UV transforms.
  // texel 4: emissive colour and billboard flag.
  const uint texWidth = 4096u;
  const uint texelsPerItem = 5u;
  uint base = meshIndex * texelsPerItem;
  uvec4 t0 = texelFetch(uMeshAttributeTexture, texCoord(base + 0u, texWidth), 0);
${(this.hasUVs || this.triplanar) ? `  uvec4 t1 = texelFetch(uMeshAttributeTexture, texCoord(base + 1u, texWidth), 0);
` : ``}${(this.hasUVs || this.triplanar || this.thickLines) ? `  uvec4 t2 = texelFetch(uMeshAttributeTexture, texCoord(base + 2u, texWidth), 0);
` : ``}${(this.hasUVs || this.triplanar) ? `  uvec4 t3 = texelFetch(uMeshAttributeTexture, texCoord(base + 3u, texWidth), 0);
` : ``}${(this.hasUVs || this.triplanar || !this.vboGeometry || this.hasNormals) ? `  uvec4 t4 = texelFetch(uMeshAttributeTexture, texCoord(base + 4u, texWidth), 0);
` : ``}
  MeshAttribTable s;
  s.tileIndex            = t0.r;
  s.geometryIndex        = t0.g;
  s.material             = t0.b;
${this.hasNormals ? `  s.clearcoat           = t4.b;
` : ``}
  s.alpha                = t0.a;
${(this.hasUVs || this.triplanar) ? `  s.albedoUVOffsetPacked = t1.r;
  s.albedoUVScalePacked  = t1.g;
  s.mrUVOffsetPacked     = t1.b;
  s.mrUVScalePacked      = t1.a;
  s.normalUVOffsetPacked = t2.r;
  s.normalUVScalePacked  = t2.g;
  s.triplanarScale       = uintBitsToFloat(t2.b);
  s.emissiveUVOffsetPacked  = t3.r;
  s.emissiveUVScalePacked   = t3.g;
  s.occlusionUVOffsetPacked = t3.b;
  s.occlusionUVScalePacked  = t3.a;
  s.emissiveColorPacked     = t4.r;
` : ``}${this.thickLines ? `  s.lineWidth            = uintBitsToFloat(t2.a);
` : ``}${!this.vboGeometry ? `  s.billboard               = t4.g;
` : `  s.billboard               = 0u;
`}
  // Unpack the 16-bit line-pattern slot from bits 16..31 of
  // the alpha slot. Bytes 0/1 carry alphaMode/alphaCutoff;
  // bytes 2-3 carry the slot index into uLinePatternTexture.
  s.linePatternSlot      = (t0.a >> 16u) & 0xFFFFu;
${this.bodyHatch ? `
  // Hatch slot in bits 16..31 of the PBR-material slot. Low
  // 16 bits there carry (roughness, metallic).
  s.hatchPatternSlot     = (t0.b >> 16u) & 0xFFFFu;` : ``}
  return s;
}
` : ``}

// Unpacks the packed Cook-Torrance material into (roughness, metallic).
// Cheap: two bit ops + one divide.
${needsMaterialPacking ? `
vec2 unpackRoughnessMetallic(uint packed) {
  return vec2(
    float(packed & 0xFFu),
    float((packed >> 8u) & 0xFFu)
  ) / 255.0;
}

vec4 unpackClearcoat(uint packed) {
  return vec4(
    float(packed & 0xFFu),
    float((packed >> 8u) & 0xFFu),
    float((packed >> 16u) & 0xFFu),
    float((packed >> 24u) & 0xFFu)
  ) / 255.0;
}
` : ``}

// Unpacks two u16s in [0, 65535] (R = lo, G = hi) to a vec2 in [0, 1].
// WebGL2's GLSL ES 3.00 doesn't have unpackUnorm2x16, so do it manually.
${needsUVPacking ? `
vec2 unpackUnorm2x16FromU32(uint packed) {
  return vec2(
    float(packed & 0xFFFFu),
    float((packed >> 16u) & 0xFFFFu)
  ) / 65535.0;
}
` : ``}

MeshViewAttributes getMeshViewAttributes(uint meshIndex) {
${this.vboViewAttributes ? `  MeshViewAttributes s;
  s.color = uvec4(
    uint(aViewColor.r * 255.0 + 0.5),
    uint(aViewColor.g * 255.0 + 0.5),
    uint(aViewColor.b * 255.0 + 0.5),
    uint(aViewColor.a * 255.0 + 0.5)
  );
  s.renderFlags = aRenderFlags;
  return s;` : `  const uint texWidth = 4096u;
  uint base = meshIndex * 2u;
  MeshViewAttributes s;
  s.color       = texelFetch(uMeshViewAttributeTexture, texCoord(base + 0u, texWidth), 0);
  s.renderFlags = texelFetch(uMeshViewAttributeTexture, texCoord(base + 1u, texWidth), 0);
  return s;`}
}

// ─────────────────────────────────────────────────────────────
// Matrix fetch (stored as 4 consecutive texels per matrix)
// ─────────────────────────────────────────────────────────────

mat4 getTileViewMatrix(uint tileIndex) {
${this.vboTileUniform ? `  return uRTCViewMatrix;` : `
  const uint texWidth = 4096u;
  uint base = tileIndex * 4u;
  vec4 m0 = texelFetch(uViewTileCameraMatrixTexture, texCoord(base + 0u, texWidth), 0);
  vec4 m1 = texelFetch(uViewTileCameraMatrixTexture, texCoord(base + 1u, texWidth), 0);
  vec4 m2 = texelFetch(uViewTileCameraMatrixTexture, texCoord(base + 2u, texWidth), 0);
  vec4 m3 = texelFetch(uViewTileCameraMatrixTexture, texCoord(base + 3u, texWidth), 0);
  return mat4(m0, m1, m2, m3);`}
}

${needsMeshMatrix ? `mat4 getMeshMatrix(uint meshIndex) {
  const uint texWidth = 4096u;
  uint base = meshIndex * 4u;
  vec4 m0 = texelFetch(uMeshMatrixTexture, texCoord(base + 0u, texWidth), 0);
  vec4 m1 = texelFetch(uMeshMatrixTexture, texCoord(base + 1u, texWidth), 0);
  vec4 m2 = texelFetch(uMeshMatrixTexture, texCoord(base + 2u, texWidth), 0);
  vec4 m3 = texelFetch(uMeshMatrixTexture, texCoord(base + 3u, texWidth), 0);
  return mat4(m0, m1, m2, m3);
}
` : ``}

${needsBillboardHelpers ? `
vec3 getMeshScale(mat4 modelMatrix) {
  return vec3(
    length(modelMatrix[0].xyz),
    length(modelMatrix[1].xyz),
    length(modelMatrix[2].xyz)
  );
}

vec3 getCameraRightWorld(mat4 viewMatrix) {
  return normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
}

vec3 getCameraUpWorld(mat4 viewMatrix) {
  return normalize(vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]));
}

vec3 getCameraBackWorld(mat4 viewMatrix) {
  return normalize(vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]));
}

vec4 getMeshWorldPosition(vec4 modelPos, mat4 modelMatrix, mat4 viewMatrix, uint billboard) {
  if (billboard == 1u) {
    vec3 scale = getMeshScale(modelMatrix);
    vec3 centerWorld = modelMatrix[3].xyz;
    vec3 worldPos =
      centerWorld +
      getCameraRightWorld(viewMatrix) * modelPos.x * scale.x +
      getCameraUpWorld(viewMatrix)    * modelPos.y * scale.y +
      getCameraBackWorld(viewMatrix)  * modelPos.z * scale.z;
    return vec4(worldPos, 1.0);
  }
  return modelMatrix * modelPos;
}

vec3 getMeshViewNormal(vec3 modelNormal, mat4 modelMatrix, mat4 viewMatrix, uint billboard) {
  if (billboard == 1u) {
    return normalize(modelNormal);
  }
  return normalize(mat3(viewMatrix) * mat3(modelMatrix) * modelNormal);
}

vec3 getMeshWorldNormal(vec3 modelNormal, mat4 modelMatrix, mat4 viewMatrix, uint billboard) {
  if (billboard == 1u) {
    return normalize(
      getCameraRightWorld(viewMatrix) * modelNormal.x +
      getCameraUpWorld(viewMatrix)    * modelNormal.y +
      getCameraBackWorld(viewMatrix)  * modelNormal.z
    );
  }
  return normalize(mat3(modelMatrix) * modelNormal);
}
` : ``}

// ─────────────────────────────────────────────────────────────
// Packs a uint into an RGBA color (each channel stores one byte).
// Little-endian byte order: R = least significant byte
// ─────────────────────────────────────────────────────────────

${needsPickPacking ? `
vec4 packUintToRGBA8(uint v) {
   return vec4(
     float( ( v        & 0xFFu)),
     float( ((v >> 8u) & 0xFFu)),
     float(((v >> 16u) & 0xFFu)),
     float(((v >> 24u) & 0xFFu))
   ) / 255.0;
}
` : ``}

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
      // `vWorldPos` declared up in vsSlicingDeclarations —
      // every technique already includes that, including
      // the non-Lambert ones (pick / snap / silhouette), so
      // section planes work everywhere. Lambert reads from
      // the same varying for triplanar atlas sampling and
      // world-space hatching.
      // Smooth view-space normal varying. Only emitted on the hasNormals
      // technique variant; the flat-shaded variant keeps deriving the
      // normal in the fragment stage from `vViewPos` derivatives.
      ...(this.hasNormals ? [
        "out vec3 vViewNormal;",
        // Pre-decoded Cook-Torrance material (roughness, metallic), passed
        // flat so every fragment in a triangle sees the source mesh's
        // values verbatim. Decoding here keeps the fragment shader free of
        // bit-shifts on hot paths.
        "flat out vec2 vMaterial;",
        "flat out vec4 vClearcoat;"
      ] : []),
      // UV varying — only emitted on the hasUVs variant. The fragment
      // stage uses it together with the per-mesh atlas transforms to
      // sample each PBR-map atlas.
      ...(this.hasUVs ? [
        "out vec2 vUV;"
      ] : []),
      // Triplanar-only world-space outputs. `vWorldPos` is now
      // declared unconditionally above (the world-space hatch
      // test reads it too), so this block only carries the
      // remaining triplanar-specific varyings.
      ...(this.triplanar ? [
        // World-space normal varying. Carried alongside `vWorldPos` so
        // the fragment stage can derive the triplanar blend weights
        // without an extra normal-matrix multiply per pixel. Only when
        // the batch carries per-vertex normals; the flat-shaded
        // triplanar variant reconstructs a face normal from
        // `dFdx/dFdy(vWorldPos)` instead.
        ...(this.hasNormals ? ["out vec3 vWorldNormal;"] : []),
        // Per-mesh world-units-per-repeat. Flat — the source value is
        // constant for every fragment of a given mesh.
        "flat out float vTriplanarScale;"
      ] : []),
      // Per-mesh atlas transforms + alpha attributes — needed by both
      // the standard UV path and the triplanar path. Same packing on
      // both sides; only the source UVs differ.
      ...((this.hasUVs || this.triplanar) ? [
        // Per-mesh atlas UV transforms: `atlasUV = uv * scale + offset`,
        // one pair per PBR-map type. Passed flat — the source values are
        // constant for every fragment of a given mesh, so interpolation
        // is wrong (and wasteful) here.
        "flat out vec2 vAlbedoUVOffset;",
        "flat out vec2 vAlbedoUVScale;",
        "flat out vec2 vMRUVOffset;",
        "flat out vec2 vMRUVScale;",
        "flat out vec2 vNormalUVOffset;",
        "flat out vec2 vNormalUVScale;",
        "flat out vec2 vEmissiveUVOffset;",
        "flat out vec2 vEmissiveUVScale;",
        "flat out vec2 vOcclusionUVOffset;",
        "flat out vec2 vOcclusionUVScale;",
        "flat out vec3 vEmissiveColor;",
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
// Base-edges colour mode: 1.0 = darken each mesh's own colour, 0.0 = use uSilhouetteColor.
uniform float uEdgeColorMode;
uniform float uEdgeDarken;
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
   * Declares the varyings used by the universal section-plane
   * clip test: world-space fragment position + a per-mesh
   * clippability flag. Declared from every technique's VS so
   * pick / snap / silhouette / edge / colour all share the
   * same clip path — a fragment culled by the colour pass is
   * also culled by the pick pass, the snap pass, etc.
   *
   * `vWorldPos` is shared with the hatch and (optionally)
   * triplanar paths; they read the same varying.
   */
  protected vsSlicingDeclarations() {
    this._vertSrcBuf.push(
      "out vec3 vWorldPos;",
      // 1 = clippable (default), 0 = ignore section planes.
      // Sourced from MeshViewAttributes.renderFlags.g —
      // already packed in the per-view-mesh attribute table.
      "flat out uint vClippable;",
    );
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
   * Declare the `vFragDepth` varying that carries per-vertex
   * `1.0 + gl_Position.w` (i.e. view-space depth + 1) downstream
   * to the FS, where {@link fsLogDepthLogic} writes
   * `gl_FragDepth` per pixel.
   *
   * No-op when {@link logDepth} is false on the technique, so a
   * technique that calls both this and {@link vsLogDepthLogic}
   * is identical to its non-log-depth sibling at the source
   * level — meaning no behavioural change until the technique
   * is constructed with `logDepth: true`.
   *
   * Emit AFTER {@link vsHeader} (so the version directive is in
   * place) and before {@link vsMainBegin}.
   */
  protected vsLogDepthDeclarations() {
    if (!this.logDepth) return;
    this._vertSrcBuf.push("out float vFragDepth;");
  }

  /**
   * Pass view-space depth (`1.0 + gl_Position.w`) through to the
   * FS in the `vFragDepth` varying. The companion FS snippet
   * ({@link fsLogDepthLogic}) writes `gl_FragDepth` per pixel
   * using the exact log-depth formula, so the depth-buffer value
   * follows the true logarithmic curve regardless of how a
   * triangle stretches across view-space depth.
   *
   * This replaces the previous "rewrite `gl_Position.z` in the
   * VS" implementation, which interpolated the log-depth value
   * linearly across each triangle. The linear interpolation
   * doesn't follow the log curve and produces visible artefacts
   * whenever a triangle's depth range is large — most painfully
   * around the camera plane during walkthroughs, where a single
   * floor/wall/ceiling triangle can span 50 cm to 30 m from the
   * eye and the per-fragment depth lands far enough off the
   * true curve to confuse the clipper. Writing the depth value
   * per pixel from the FS eliminates that interpolation error.
   *
   * Trade-off: writing `gl_FragDepth` disables hardware early-Z
   * for these techniques (the GPU can't cull a fragment by depth
   * before running the FS that determines its depth).
   *
   * No-op when {@link logDepth} is false.
   *
   * Emit before {@link vsMainEnd}.
   */
  protected vsLogDepthLogic() {
    if (!this.logDepth) return;
    // gl_Position.w == -view-z for the standard perspective
    // matrix, so `1 + gl_Position.w` is the view-space depth
    // (i.e. how far the vertex sits in front of the camera).
    // Perspective-correct interpolation of `vFragDepth` is
    // exact in view-space distance, so the FS gets the true
    // view-space `1 + w` per pixel.
    this._vertSrcBuf.push("    vFragDepth = 1.0 + gl_Position.w;");
  }

  /**
   * Declare the FS-side inputs consumed by {@link fsLogDepthLogic}:
   * the `vFragDepth` varying produced by {@link vsLogDepthLogic}
   * and the per-frame `uLogDepthCoef` uniform.
   *
   * No-op when {@link logDepth} is false. Emit AFTER {@link fsHeader}
   * and before {@link fsMainBegin}.
   */
  protected fsLogDepthDeclarations() {
    if (!this.logDepth) return;
    // `uLogDepthCoef = 2 / log2(far + 1)` is uploaded once per
    // frame from `view.camera.perspectiveProjection.far` (see
    // the upload routine that ends at `gl.uniform1f(uniforms.logDepthCoef, …)`).
    this._fragSrcBuf.push("in float vFragDepth;");
    this._fragSrcBuf.push("uniform float uLogDepthCoef;");
  }

  /**
   * Write `gl_FragDepth` per pixel using the canonical log-depth
   * formula — `gl_FragDepth = log2(vFragDepth) * uLogDepthCoef * 0.5`.
   *
   * Derivation: the vertex-side scheme used
   *   `gl_Position.z = (log2(1 + w) * coef − 1) * w`
   * which, after the GPU's `/w` divide, gives an NDC z of
   *   `log2(1 + w) * coef − 1` ∈ [-1, 1]
   * mapped to the depth buffer's [0, 1] via `(z + 1) * 0.5`. So
   * the equivalent per-pixel write is
   *   `gl_FragDepth = log2(1 + w) * coef * 0.5`
   * with `1 + w` carried in `vFragDepth` from the VS.
   *
   * The `max(1.0e-6, vFragDepth)` clamp guards against fragments
   * whose interpolated `1 + w` lands ≤ 0 — physically impossible
   * for a fragment in front of the camera, but cheap insurance
   * against a single bad triangle interpolant NaN-ing the depth
   * buffer for the rest of the primitive.
   *
   * No-op when {@link logDepth} is false. Emit inside the FS
   * main body, typically right before {@link fsMainEnd} — the
   * value is independent of color, slicing, etc.
   */
  protected fsLogDepthLogic() {
    if (!this.logDepth) return;
    this._fragSrcBuf.push(
      "    gl_FragDepth = log2(max(1.0e-6, vFragDepth)) * uLogDepthCoef * 0.5;",
    );
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
   * view's `Edges.edgeFadeStart` / `edgeFadeEnd` parameters.
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
   * Writes the section-plane varyings — world-space position
   * and the per-mesh clippable flag. Called from every
   * technique's main() so the FS has a stable clip-test input.
   */
  protected vsSlicingLogic() {
    this._vertSrcBuf.push(
      "    vWorldPos = worldPos.xyz;",
      "    vClippable = meshViewAttributes.renderFlags.g;",
    );
  }

  /**
   * Generates vertex shader logic for mesh processing.
   * @private
   */
  private _vsMeshLogic() { // before renderPass check
    if (this.vboGeometry) {
      this._vertSrcBuf.push(`
    // VBO geometry path: the expanded vertex stream already carries
    // the mesh and geometry vertex indices. DTX is still used below for
    // per-mesh view/material attributes.
    uint meshIndex = aMeshIndex;
    uint vertexIndexWithinGeometry = aGeometryVertexIndex;

    // Fetch mesh view properties (color + flags)
    MeshViewAttributes meshViewAttributes = getMeshViewAttributes( meshIndex );

    // Cull fully-transparent meshes
    if (meshViewAttributes.color.a == 3u) {
      // gl_Position = vec4(3.0, 3.0, 3.0, 1.0); // Cull vertex
     //  return;
    }
    `);
      return;
    }
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
    if (this.vboGeometry) {
      const needsGeometryAttributes = this.hasUVs;
      const needsMeshAttributes = needsGeometryAttributes || this.hasNormals || this.bodyHatch || this.triplanar;
      this._vertSrcBuf.push(`
    // Mesh → tile + geometry resolution. Position/tile come directly from
    // the VBO. Geometry metadata remains in DTX only for variants that
    // still need per-geometry attribute bases, such as UVs.${needsMeshAttributes ? `
    MeshAttribTable meshAttributeTexture = getMeshAttribTable( meshIndex );` : ``}
    uint tileIndex = uint(aPositionAndTile.w + 0.5);${needsGeometryAttributes ? `
    uint geometryIndex = meshAttributeTexture.geometryIndex;
    GeometryAttributes geometryAttributes = getGeometryAttributeTexture( geometryIndex );` : ``}

    // Positions are already dequantized and mesh-matrix-baked by
    // TriangleGeometryVBOBatch. Keep modelMatrix as identity for the
    // default baked-transform variant; a matrix-backed variant can re-enable
    // dynamic transform reads later without disturbing this path.
    mat4 modelMatrix = mat4(1.0);
    mat4 viewMatrix  = getTileViewMatrix(tileIndex);
    vec4 worldPos = vec4(aPositionAndTile.xyz, 1.0);
    vec4 viewPos  = viewMatrix  * worldPos;
    vec4 clipPos  = uProjMatrix * viewPos;

    // Write final clip-space position for rasterization
    gl_Position = clipPos;`
      );
      return;
    }
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

    // Apply transforms through the standard pipeline. Billboarded meshes keep
    // their center in world space but align local axes to the active camera.
    vec4 worldPos = getMeshWorldPosition(modelPos, modelMatrix, viewMatrix, meshAttributeTexture.billboard);
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

    uvec2 packedNormal = ${this.vboGeometry ? `aNormal` : `getVertexNormalPacked(geometryAttributes.normalsBase + vertexIndexWithinGeometry)`};
    vec3  modelNormal  = octDecodeNormalU16(packedNormal);
    vViewNormal        = ${this.vboGeometry
        ? `normalize(mat3(viewMatrix) * modelNormal)`
        : `getMeshViewNormal(modelNormal, modelMatrix, viewMatrix, meshAttributeTexture.billboard)`};
    vMaterial          = unpackRoughnessMetallic(meshAttributeTexture.material);
    vClearcoat         = unpackClearcoat(meshAttributeTexture.clearcoat);` : ``}${this.hasUVs ? `

    vUV              = getVertexUV(geometryAttributes.uvsBase + vertexIndexWithinGeometry);` : ``}${this.triplanar ? `${this.hasNormals ? `
    // Reuse the model-space normal decoded above — rotate just by the
    // model matrix's upper-3x3 to land in world space (assumes the
    // near-rigid model matrix the rest of the pipeline already
    // requires; non-uniform scale would also break the position
    // pipeline).
    vWorldNormal     = ${this.vboGeometry
          ? `normalize(modelNormal)`
          : `getMeshWorldNormal(modelNormal, modelMatrix, viewMatrix, meshAttributeTexture.billboard)`};` : ``}
    vTriplanarScale  = meshAttributeTexture.triplanarScale;` : ``}${(this.hasUVs || this.triplanar) ? `

    vAlbedoUVOffset  = unpackUnorm2x16FromU32(meshAttributeTexture.albedoUVOffsetPacked);
    vAlbedoUVScale   = unpackUnorm2x16FromU32(meshAttributeTexture.albedoUVScalePacked);
    vMRUVOffset      = unpackUnorm2x16FromU32(meshAttributeTexture.mrUVOffsetPacked);
    vMRUVScale       = unpackUnorm2x16FromU32(meshAttributeTexture.mrUVScalePacked);
    vNormalUVOffset  = unpackUnorm2x16FromU32(meshAttributeTexture.normalUVOffsetPacked);
    vNormalUVScale   = unpackUnorm2x16FromU32(meshAttributeTexture.normalUVScalePacked);
    vEmissiveUVOffset  = unpackUnorm2x16FromU32(meshAttributeTexture.emissiveUVOffsetPacked);
    vEmissiveUVScale   = unpackUnorm2x16FromU32(meshAttributeTexture.emissiveUVScalePacked);
    vOcclusionUVOffset = unpackUnorm2x16FromU32(meshAttributeTexture.occlusionUVOffsetPacked);
    vOcclusionUVScale  = unpackUnorm2x16FromU32(meshAttributeTexture.occlusionUVScalePacked);
    vEmissiveColor   = vec3(
      float( meshAttributeTexture.emissiveColorPacked        & 0xFFu),
      float((meshAttributeTexture.emissiveColorPacked >> 8u) & 0xFFu),
      float((meshAttributeTexture.emissiveColorPacked >> 16u)& 0xFFu)
    ) / 255.0;
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
    if (this.styleBinOverlay) {
      this._vertSrcBuf.push(`
    if (meshViewAttributes.renderFlags.a == 0u) {
      vColor = vec4(0.0);
    } else {
      vColor = vec4(meshViewAttributes.color) / 255.0;
    }`);
    } else {
      this._vertSrcBuf.push(`
    // Resolved style-bin passes use each mesh's per-view style color/alpha.
    // Base edges can optionally use darkened mesh color; ordinary silhouettes
    // use the configured uniform color.
    if (uRenderPass == ${RENDER_PASSES.STYLE_BIN_OPAQUE} || uRenderPass == ${RENDER_PASSES.STYLE_BIN_TRANSPARENT}) {
      vColor = vec4(meshViewAttributes.color) / 255.0;
    } else if (uEdgeColorMode > 0.5) {
      vColor = vec4(vec3(meshViewAttributes.color.rgb) / 255.0 * uEdgeDarken, uSilhouetteColor.a);
    } else {
      vColor = vec4(uSilhouetteColor.r, uSilhouetteColor.g, uSilhouetteColor.b, uSilhouetteColor.a);
    }`);
    }
    if (this.edges) {
      this._vertSrcBuf.push(`
    if (meshViewAttributes.renderFlags.b == 0u) {
      vColor.a = 0.0;
    }`);
    }
  }

  /**
   * Declares the thick-line uniforms (`uLineWidth`,
   * `drawingBufferSize`) and the per-vertex AA varying. Call
   * once from a thick-line technique's `buildVertexShader`,
   * after {@link vsCommonDeclarations}.
   *
   * The thick-line path expands each line into two triangles in
   * the vertex shader. `drawingBufferSize` converts the pixel
   * thickness into NDC; `vSide` carries the signed cross-line
   * coordinate (`-1` at one edge, `+1` at the other) to the
   * fragment shader for antialiasing.
   *
   * @param skipDrawingBufferSize When `true`, omit the
   *   `drawingBufferSize` uniform declaration. Set this on
   *   techniques that already declared the same uniform via
   *   {@link vsPickDeclarations} or {@link vsSnapDeclarations}
   *   — GLSL forbids re-declaring a uniform in the same scope.
   */
  protected vsThickLineDeclarations(skipDrawingBufferSize: boolean = false) {
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Thick-line quad expansion
// ─────────────────────────────────────────────────────────────

uniform float uLineWidth;
// Join style at polyline interior endpoints:
//   0 — miter (extend each segment along the bisector to a sharp
//       miter point, clamped at ~4 × halfWidth).
//   1 — round (each joined side is treated as a free end — the
//       SDF paints a half-disc at the segment's endpoint, and
//       two overlapping half-discs from neighbouring segments
//       form a disc-shaped joint of diameter lineWidth).
uniform int   uLineJoinRound;
// View-level dash / gap pattern, in line-width units. Per-mesh
// patterns from the per-material override take precedence — the
// VS resolves which to use and forwards it as flat varyings, so
// the FS only ever reads from the varying side.
uniform float uLinePattern[8];
uniform int   uLinePatternLen;
uniform float uLinePatternPeriod;
// Per-batch per-material line-pattern table. Two RGBA32UI
// texels per slot — entries [0..3] in the first texel, [4..7]
// in the second, all as Float32 bit patterns. The slot index
// lives on MeshAttribTable.linePatternSlot; slot 0 is the
// "no per-mesh pattern" sentinel and is never sampled.
uniform highp usampler2D uLinePatternTexture;
// Per-batch, per-line-segment cumulative model-space distance
// from the parent polyline's start. Indexed at
//   geometryAttributes.polylineCumDistBase + primOffset
// polylineCumDistBase == 0 means the geometry isn't a line
// polyline (or the batch never allocated the texture) — the
// shader then leaves the pattern phase at zero offset, so each
// segment's dash starts fresh (the legacy behaviour).
uniform highp sampler2D uPolylineCumDistTexture;
${skipDrawingBufferSize ? "" : "uniform vec2  drawingBufferSize;"}

// Pixel-space coordinates of this fragment relative to the
// central line segment:
//   .x — signed distance ALONG the line from its start point.
//        Negative inside the start cap, 0..lineLenPx along the
//        line proper, > lineLenPx inside the end cap.
//   .y — signed distance ACROSS the line. 0 on the centreline,
//        ±halfWidth at the quad's perpendicular edges.
// The fragment shader uses these plus vLineDimsPx to evaluate
// the rounded-rect SDF — gives round caps, endpoint AA, and
// width-direction AA from a single distance-field formula.
out vec2 vLineCoordPx;
// (lineLenPx, halfWidthPx) — both constant across the line's
// six vertices, so interpolation preserves them exactly.
out vec2 vLineDimsPx;
// (hasPrevJoin, hasNextJoin) — 1.0 when the corresponding
// endpoint is joined to the previous/next segment in a
// polyline, 0.0 when it's a free end (round cap). Lets the FS
// skip the round-cap clamp on joined sides so fragments past
// the line's start/end land in the joint's "strip" region
// instead of the cap's "disc" region.
flat out vec2 vJointFlags;
// Resolved dash / gap pattern for this segment's mesh. The
// VS picks per-mesh-from-MeshAttribTable when the material
// supplied one, otherwise falls back to the View's uniform.
// Packing the 8 entries into two vec4s keeps the varying
// budget at three vec4 slots; vLinePatternLen == 0 is the
// solid (no-pattern) sentinel and short-circuits the FS walk.
flat out vec4  vLinePattern0123;
flat out vec4  vLinePattern4567;
flat out int   vLinePatternLen;
flat out float vLinePatternPeriod;
// Screen-space pixel offset that brings the pattern phase
// continuous across polyline joints. The VS computes it from
// the per-segment cumulative model distance times the current
// segment's pixels-per-model-unit ratio. The FS adds this to
// alongPx before walking the pattern.
flat out float vPolylinePxOffset;
`);
  }

  /**
   * Emits the full thick-line `main()` body. Pulls *both*
   * endpoints of the current line, projects each to clip space,
   * computes a screen-space perpendicular, and offsets the
   * chosen endpoint by `±uLineWidth / 2` pixels.
   *
   * Stands in for {@link vsMainBegin}; the technique's
   * `buildVertexShader` follows this with any colour / slicing /
   * varying logic the standard path emits AFTER `vsMainBegin`,
   * then closes with {@link vsMainEnd}.
   *
   * `vertsPerPrim` must be `6` on the technique that calls this.
   * The standard `_draw` switch on `LinesPrimitive` then routes
   * to `gl.TRIANGLES` × 6 when `this.thickLines` is set.
   */
  protected vsThickLineMain() {
    this._vertSrcBuf.push(`
void main(void) {

  // 6 vertices per line — two triangles forming the quad.
  // gl_VertexID layout (CCW for both triangles):
  //   0: (start, -1)   3: (start, -1)
  //   1: (end,   -1)   4: (end,   +1)
  //   2: (end,   +1)   5: (start, +1)
  uint drawVertexIndex = uint(gl_VertexID);
  uint lineIndex       = drawVertexIndex / 6u;
  uint vertWithinQuad  = drawVertexIndex % 6u;

  // endpointIdx: 0 picks the line's start vertex, 1 picks the end.
  // side: -1 picks one edge of the quad, +1 picks the other.
  uint endpointIdx;
  float side;
  if      (vertWithinQuad == 0u) { endpointIdx = 0u; side = -1.0; }
  else if (vertWithinQuad == 1u) { endpointIdx = 1u; side = -1.0; }
  else if (vertWithinQuad == 2u) { endpointIdx = 1u; side =  1.0; }
  else if (vertWithinQuad == 3u) { endpointIdx = 0u; side = -1.0; }
  else if (vertWithinQuad == 4u) { endpointIdx = 1u; side =  1.0; }
  else                            { endpointIdx = 0u; side =  1.0; }

  // Resolve line → mesh / geometry (same flow as _vsMeshLogic).
  uint primIndex = uint(uPrimBaseIndex) + lineIndex;
  uvec2 primData  = getPrimData( primIndex );
  uint meshIndex  = primData.r;
  uint primOffset = primData.g;
  MeshViewAttributes meshViewAttributes = getMeshViewAttributes( meshIndex );

  MeshAttribTable meshAttributeTexture  = getMeshAttribTable( meshIndex );
  uint tileIndex     = meshAttributeTexture.tileIndex;
  uint geometryIndex = meshAttributeTexture.geometryIndex;
  GeometryAttributes geometryAttributes = getGeometryAttributeTexture( geometryIndex );
  QuantRange quantRange = getGeometryQuantRange( geometryIndex );

  // Fetch *both* endpoint vertex indices into the geometry's
  // vertex table. Line primitives index through indicesBase;
  // triangle-mesh edges (this.edges) through edgeIndicesBase —
  // the same buffer the thin edge techniques consult, so the
  // quad expansion thickens those exact segments.
  uint baseOffset = primOffset * 2u;
  uint idxA = getVertexIndex( geometryAttributes.${this.edges ? "edgeIndicesBase" : "indicesBase"} + baseOffset );
  uint idxB = getVertexIndex( geometryAttributes.${this.edges ? "edgeIndicesBase" : "indicesBase"} + baseOffset + 1u );

  // ── Polyline-adjacency detection ────────────────────────────
  //
  // A segment is part of a polyline iff the previous (or next)
  // segment in the index buffer is in the SAME mesh AND its
  // last (or first) vertex index matches our first (or last).
  //
  // The prim texture lookup gives us both checks for free:
  //   - same mesh: prevPrim.r == meshIndex
  //   - exactly-one-step neighbour: prevPrim.g + 1 == primOffset
  // — so reads past the batch's end (which return garbage zeros)
  // can't false-positive into "we have a neighbour" because the
  // primOffset comparison fails on uint wrap-around.
  bool hasPrevJoin = false;
  uint idxP = idxA;
  if (primOffset > 0u) {
    uvec2 prevPrimData = getPrimData( primIndex - 1u );
    if (prevPrimData.r == meshIndex && prevPrimData.g + 1u == primOffset) {
      uint prevBase = (primOffset - 1u) * 2u;
      uint prevSegA = getVertexIndex( geometryAttributes.${this.edges ? "edgeIndicesBase" : "indicesBase"} + prevBase );
      uint prevSegB = getVertexIndex( geometryAttributes.${this.edges ? "edgeIndicesBase" : "indicesBase"} + prevBase + 1u );
      if (prevSegB == idxA) {
        hasPrevJoin = true;
        idxP = prevSegA;
      }
    }
  }
  bool hasNextJoin = false;
  uint idxN = idxB;
  {
    uvec2 nextPrimData = getPrimData( primIndex + 1u );
    if (nextPrimData.r == meshIndex && nextPrimData.g == primOffset + 1u) {
      uint nextBase = (primOffset + 1u) * 2u;
      uint nextSegA = getVertexIndex( geometryAttributes.${this.edges ? "edgeIndicesBase" : "indicesBase"} + nextBase );
      uint nextSegB = getVertexIndex( geometryAttributes.${this.edges ? "edgeIndicesBase" : "indicesBase"} + nextBase + 1u );
      if (nextSegA == idxB) {
        hasNextJoin = true;
        idxN = nextSegB;
      }
    }
  }

  uvec3 quantA = getVertexPosition( geometryAttributes.verticesBase + idxA );
  uvec3 quantB = getVertexPosition( geometryAttributes.verticesBase + idxB );
  uvec3 quantP = getVertexPosition( geometryAttributes.verticesBase + idxP );
  uvec3 quantN = getVertexPosition( geometryAttributes.verticesBase + idxN );
  vec4 modelA = vec4( quantRange.offset + quantRange.scale * vec3(quantA), 1.0 );
  vec4 modelB = vec4( quantRange.offset + quantRange.scale * vec3(quantB), 1.0 );
  vec4 modelP = vec4( quantRange.offset + quantRange.scale * vec3(quantP), 1.0 );
  vec4 modelN = vec4( quantRange.offset + quantRange.scale * vec3(quantN), 1.0 );

  mat4 modelMatrix = getMeshMatrix( meshIndex );
  mat4 viewMatrix  = getTileViewMatrix( tileIndex );
  vec4 worldA = getMeshWorldPosition(modelA, modelMatrix, viewMatrix, meshAttributeTexture.billboard);
  vec4 worldB = getMeshWorldPosition(modelB, modelMatrix, viewMatrix, meshAttributeTexture.billboard);
  vec4 worldP = getMeshWorldPosition(modelP, modelMatrix, viewMatrix, meshAttributeTexture.billboard);
  vec4 worldN = getMeshWorldPosition(modelN, modelMatrix, viewMatrix, meshAttributeTexture.billboard);
  vec4 clipA = uProjMatrix * viewMatrix * worldA;
  vec4 clipB = uProjMatrix * viewMatrix * worldB;
  vec4 clipP = uProjMatrix * viewMatrix * worldP;
  vec4 clipN = uProjMatrix * viewMatrix * worldN;

  // Standard view-space + world-space outputs, available for any
  // logic the technique emits after this block (slicing, colour,
  // edge fade …). Use the current endpoint, *un-offset*, so
  // downstream calculations stay correct.
  vec4 modelPos = (endpointIdx == 0u) ? modelA : modelB;
  vec4 worldPos = getMeshWorldPosition(modelPos, modelMatrix, viewMatrix, meshAttributeTexture.billboard);
  vec4 viewPos  = viewMatrix * worldPos;

  // Screen-space line geometry in *real* pixel units. NDC
  // ranges [-1, +1] across drawingBufferSize actual pixels, so
  // the half-extent conversion is "* drawingBufferSize * 0.5".
  vec2 ndcA = clipA.xy / max(clipA.w, 1e-6);
  vec2 ndcB = clipB.xy / max(clipB.w, 1e-6);
  vec2 ndcP = clipP.xy / max(clipP.w, 1e-6);
  vec2 ndcN = clipN.xy / max(clipN.w, 1e-6);
  vec2 dirPx      = (ndcB - ndcA) * drawingBufferSize * 0.5;
  float lineLenPx = length(dirPx);
  vec2 alongUnit  = lineLenPx > 1e-6 ? dirPx / lineLenPx : vec2(1.0, 0.0);

  // ── Polyline-continuous pattern phase ──
  //
  // Look up the segment's cumulative model-space distance from
  // its parent polyline's start. Convert to pixels using the
  // current segment's own pixels-per-model-unit ratio. The FS
  // adds this offset to alongPx before walking the pattern,
  // so the dash phase stays continuous across joints rather
  // than restarting at every segment.
  //
  // Under orthographic projection the ratio is uniform across
  // the whole batch and the offset is exact. Under perspective
  // it varies per segment, so the offset is "approximately
  // continuous" — close enough for engineering drawings,
  // where polylines tend to share a depth band and the
  // per-segment ratio shift is sub-pixel.
  //
  // polylineCumDistBase == 0 means "no polyline-cum-dist
  // table allocated for this geometry's batch" — likely a
  // pure-triangle batch. We then keep the offset at zero,
  // which matches the legacy per-segment-phase behaviour.
  float polylinePxOffset = 0.0;
  if (geometryAttributes.polylineCumDistBase > 0u || primOffset > 0u) {
    float cumModelDist = texelFetch(
      uPolylineCumDistTexture,
      texCoord(geometryAttributes.polylineCumDistBase + primOffset, 4096u),
      0
    ).r;
    if (cumModelDist > 0.0) {
      vec3 modelDelta = modelB.xyz - modelA.xyz;
      float modelLen = length(modelDelta);
      float pxPerModel = (modelLen > 1e-6) ? (lineLenPx / modelLen) : 0.0;
      polylinePxOffset = cumModelDist * pxPerModel;
    }
  }
  vPolylinePxOffset = polylinePxOffset;

  // Perpendicular unit vector — isotropic in pixel space so
  // diagonal lines have the same thickness on non-square canvases.
  vec2 perpUnit   = vec2(-alongUnit.y, alongUnit.x);
  // 1-pixel offset in NDC, per axis (component-wise scale).
  vec2 pxToNDC    = 2.0 / drawingBufferSize;

  // Per-mesh line width takes precedence over the global
  // uLineWidth uniform. A zero per-mesh value (the default for
  // meshes without a SceneMaterial) falls back to uLineWidth.
  float lineWidth = meshAttributeTexture.lineWidth > 0.0
    ? meshAttributeTexture.lineWidth
    : uLineWidth;
  float halfWidth = lineWidth * 0.5;

  // Endpoint offset:
  //   - Joined endpoint (uLineJoinRound == 0, "miter"): extend
  //     along the bisector of the two segments' perpendiculars
  //     to a miter point. Clamped at ~4 × halfWidth so acute
  //     angles don't spike.
  //   - Joined endpoint (uLineJoinRound != 0, "round"): treat
  //     the joined side as a free end — offset perpendicularly
  //     for width AA and along the line direction by halfWidth
  //     so the rounded-rect SDF paints a half-disc here. The
  //     neighbouring segment paints its own half-disc on the
  //     other side; the two together form a circular joint.
  //   - Free endpoint: same offset as the round-joined case
  //     above — round cap.
  vec2 offsetPx;
  bool atStart = (endpointIdx == 0u);
  bool jointHere = atStart ? hasPrevJoin : hasNextJoin;

  // Round-joint mode demotes every interior joint to a free end
  // for both the quad-expansion math (here) and the
  // joint-flag-driven SDF clamp skip below. Keep jointHere
  // tracking the raw geometric adjacency for any future passes
  // that care; gate the actual miter path on a separate flag.
  bool miterHere = jointHere && (uLineJoinRound == 0);

  if (miterHere) {
    // Neighbour-segment direction at this endpoint.
    vec2 dirNeighborPx;
    if (atStart) {
      dirNeighborPx = (ndcA - ndcP) * drawingBufferSize * 0.5;
    } else {
      dirNeighborPx = (ndcN - ndcB) * drawingBufferSize * 0.5;
    }
    float neighborLen = length(dirNeighborPx);
    vec2 alongNeighbor = neighborLen > 1e-6 ? dirNeighborPx / neighborLen : alongUnit;
    vec2 perpNeighbor  = vec2(-alongNeighbor.y, alongNeighbor.x);
    vec2 bisector      = perpUnit + perpNeighbor;
    float bisectorLen  = length(bisector);
    // Degenerate (segments antiparallel): fall back to perpUnit
    // so the joint at least closes cleanly without a NaN.
    vec2 bisectorNorm = bisectorLen > 0.01 ? bisector / bisectorLen : perpUnit;
    // Miter length = halfWidth / cos(angle/2). Clamp the cosine
    // away from 0 so a near-180° turn (cos→0) is truncated at
    // ~4 × halfWidth instead of spiking to infinity.
    float denom = max(abs(dot(bisectorNorm, perpUnit)), 0.25);
    float miterLen = halfWidth / denom;
    offsetPx = bisectorNorm * (miterLen * side);
  } else {
    float alongSign = atStart ? -1.0 : 1.0;
    offsetPx = perpUnit  * (halfWidth * side)
             + alongUnit * (halfWidth * alongSign);
  }

  vec2 offsetNDC  = offsetPx * pxToNDC;

  vec4 chosenClip = atStart ? clipA : clipB;
  // Multiply offsetNDC by .w so the post-divide leaves a
  // constant pixel-space offset — keeps the line at a fixed
  // thickness regardless of depth.
  gl_Position = vec4(
    chosenClip.xy + offsetNDC * chosenClip.w,
    chosenClip.z,
    chosenClip.w
  );

  // Pixel-space coordinates relative to the central line
  // segment. For free endpoints (and round-joined endpoints,
  // which behave the same way geometrically) the quad extends
  // ±halfWidth past the line ends so alongPx hits the round-cap
  // regions. Mitered joints pin alongPx to the line's start /
  // end and rely on the FS skipping the cap clamp on that side
  // (so fragments past the line end land in the joint strip,
  // not a disc).
  float alongPx;
  if (atStart) {
    alongPx = miterHere ? 0.0 : -halfWidth;
  } else {
    alongPx = miterHere ? lineLenPx : (lineLenPx + halfWidth);
  }
  vLineCoordPx = vec2(alongPx, side * halfWidth);
  vLineDimsPx  = vec2(lineLenPx, halfWidth);
  // Joint flags only mark MITERED neighbours — round joints are
  // free ends as far as the SDF is concerned, so the clamp runs
  // and produces the half-disc that completes the round joint.
  float prevMiter = (hasPrevJoin && uLineJoinRound == 0) ? 1.0 : 0.0;
  float nextMiter = (hasNextJoin && uLineJoinRound == 0) ? 1.0 : 0.0;
  vJointFlags  = vec2(prevMiter, nextMiter);

  // ── Resolve which dash/gap pattern applies to this segment ──
  //
  // Per-material override wins over the View-level uniform.
  // The mesh's linePatternSlot is non-zero when its material
  // registered a pattern with this batch (see GPUMemoryBatch.
  // _allocateLinePatternSlot). When set, fetch the 8 entries
  // from uLinePatternTexture at that slot — 2 RGBA32UI texels
  // packed as Float32 bit patterns. Otherwise forward the
  // View's uniform pattern unchanged.
  //
  // Resolving in the VS rather than the FS keeps the FS branch-
  // free — flat varyings preserve the values exactly across all
  // 6 quad vertices, so the FS reads a single resolved pattern
  // per primitive.
  if (meshAttributeTexture.linePatternSlot > 0u) {
    // Layout: width = LinePatternTexture.width (256), two
    // texels per slot. base = slot * 2; convert to a 2D
    // coordinate the same way texCoord() does for the mesh
    // attribute table, but with the LinePatternTexture's
    // narrower row size.
    const uint patTexWidth = 256u;
    uint pBase = meshAttributeTexture.linePatternSlot * 2u;
    uvec4 pe0 = texelFetch(uLinePatternTexture, texCoord(pBase + 0u, patTexWidth), 0);
    uvec4 pe1 = texelFetch(uLinePatternTexture, texCoord(pBase + 1u, patTexWidth), 0);
    vec4 p0123 = vec4(
      uintBitsToFloat(pe0.r),
      uintBitsToFloat(pe0.g),
      uintBitsToFloat(pe0.b),
      uintBitsToFloat(pe0.a));
    vec4 p4567 = vec4(
      uintBitsToFloat(pe1.r),
      uintBitsToFloat(pe1.g),
      uintBitsToFloat(pe1.b),
      uintBitsToFloat(pe1.a));
    vLinePattern0123   = p0123;
    vLinePattern4567   = p4567;
    // The slot is only allocated when the material's pattern
    // length > 0; trailing entries past that length are
    // zero-padded by the CPU encoder. Counting the leading
    // non-zero run gives back the original length, and summing
    // all 8 yields the period — works branch-free because the
    // trailing zeros contribute nothing.
    int len = 0;
    if (p0123.x > 0.0) len = 1;
    if (p0123.y > 0.0) len = 2;
    if (p0123.z > 0.0) len = 3;
    if (p0123.w > 0.0) len = 4;
    if (p4567.x > 0.0) len = 5;
    if (p4567.y > 0.0) len = 6;
    if (p4567.z > 0.0) len = 7;
    if (p4567.w > 0.0) len = 8;
    vLinePatternLen    = len;
    vLinePatternPeriod =
      p0123.x + p0123.y + p0123.z + p0123.w +
      p4567.x + p4567.y + p4567.z + p4567.w;
  } else {
    vLinePattern0123   = vec4(uLinePattern[0], uLinePattern[1], uLinePattern[2], uLinePattern[3]);
    vLinePattern4567   = vec4(uLinePattern[4], uLinePattern[5], uLinePattern[6], uLinePattern[7]);
    vLinePatternLen    = uLinePatternLen;
    vLinePatternPeriod = uLinePatternPeriod;
  }
`);
  }

  /**
   * Declares the thick-line fragment inputs. Call from a
   * thick-line technique's `buildFragmentShader`, after
   * {@link fsPrecisionDeclarations} and the colour-declaration
   * helpers it uses.
   */
  protected fsThickLineDeclarations() {
    this._fragSrcBuf.push(
      "in vec2 vLineCoordPx;",
      "in vec2 vLineDimsPx;",
      "flat in vec2 vJointFlags;",
      // Dash / gap pattern resolved per-segment by the VS —
      // per-material override (from MeshAttribTable) wins over
      // the View-level uniform, both forwarded here as flat
      // varyings. `vLinePatternLen == 0` is the solid sentinel
      // and short-circuits the colour-pass walk. Pick / snap
      // techniques declare these inputs too (unused there) so
      // the VS's flat outs always have a matching FS in,
      // satisfying WebGL2's varying-link rules.
      "flat in vec4  vLinePattern0123;",
      "flat in vec4  vLinePattern4567;",
      "flat in int   vLinePatternLen;",
      "flat in float vLinePatternPeriod;",
      "flat in float vPolylinePxOffset;",
    );
  }

  /**
   * Multiplies `color.a` by signed-distance-field coverage
   * against a rounded rectangle: a line segment of length
   * `lineLenPx` swept to radius `halfWidth`. One SDF gives
   * round caps, smooth endpoint AA, and width-direction AA in
   * a single formula — and the `clamp(0.5 - sdf, 0, 1)` band
   * stays correct down to sub-pixel widths where a smoothstep
   * across `|vSide|` would collapse.
   *
   * Emit AFTER the colour has been assigned to the working
   * `color` variable (typically after {@link fsDrawFlatColorLogic})
   * and BEFORE {@link fsOutputColor}.
   */
  protected fsThickLineLogic() {
    this._fragSrcBuf.push(`
    // Round-rect SDF in pixel space.
    //
    //   alongPx     — signed position along the line (start = 0,
    //                 end = lineLenPx; negative inside start cap,
    //                 > lineLenPx inside end cap).
    //   acrossPx    — signed position across the line.
    //   lineLenPx   — pixel length of the central line segment.
    //   halfWidth   — line half-thickness in pixels.
    //
    // closestAlong clamps onto the central segment; the vector
    // from there to the fragment lives in (along - clamp, across)
    // space — its length is the unsigned distance to the central
    // line. Subtracting halfWidth yields the rounded-rect SDF.
    //
    // Coverage is the SDF passed through a 1-pixel falloff:
    //   sdf = -0.5 → fully covered (coverage = 1)
    //   sdf = +0.5 → fully outside  (coverage = 0)
    // — so the AA band is one pixel wide regardless of line
    // thickness and holds up at sub-pixel widths (where the old
    // smoothstep collapsed to a triangle filter).
    float alongPx   = vLineCoordPx.x;
    float acrossPx  = vLineCoordPx.y;
    float lineLenPx = vLineDimsPx.x;
    float halfWidth = vLineDimsPx.y;
    // Skip the round-cap clamp on joined sides — joined
    // endpoints push their alongPx outside the [0, lineLenPx]
    // range only when the segment's neighbour quad is going
    // to cover that region anyway; treating those fragments
    // as cap-clamped would produce a rounded blob at every
    // joint (the bug we're fixing). The "infinite" sentinels
    // amount to "don't clamp on this side", so toFrag.x is
    // zero in the joint region → SDF reduces to a strip.
    float minAlong = vJointFlags.x > 0.5 ? -1e8 : 0.0;
    float maxAlong = vJointFlags.y > 0.5 ?  1e8 : lineLenPx;
    float closestAlong = clamp(alongPx, minAlong, maxAlong);
    vec2  toFrag       = vec2(alongPx - closestAlong, acrossPx);
    float distToCenter = length(toFrag);
    float sdf          = distToCenter - halfWidth;
    float alpha        = clamp(0.5 - sdf, 0.0, 1.0);
    // Cap-extension corners of the quad sit outside the rounded
    // rectangle (sdf > 0.5, alpha = 0). The opaque pass has
    // blending OFF and fsOutputColor emits premultiplied
    // (color.rgb * color.a, color.a), so writing those
    // zero-coverage fragments would paint pure black straight
    // into the framebuffer — visible as the dark ring at every
    // round cap. Discarding them lets the panel / background
    // show through cleanly.
    if (alpha <= 0.0) discard;

    // Dash / gap pattern.
    //
    // The pattern is a repeating [dash, gap, dash, gap, ...]
    // sequence with entries measured in line-width units, so
    // visual proportions stay constant as lineWidth changes.
    // For each fragment we map alongPx into one period and
    // walk the entry array to decide whether the fragment lies
    // inside a dash (keep) or a gap (discard).
    //
    // Dash boundaries are aliased — the colour-pass SDF only
    // anti-aliases the rounded-rect outline, not the
    // transverse dash edges. Engineering CAD packages render
    // dashed linetypes the same way, so this matches the
    // visual convention.
    //
    // Pick / snap fragment shaders deliberately do NOT call
    // this helper — they let users click and snap inside gap
    // regions, treating a dashed line as conceptually
    // continuous.
    if (vLinePatternLen > 0 && vLinePatternPeriod > 0.0) {
      // Express alongPx in line-width units so the pattern
      // entries (also in line-width units) compare directly.
      // vPolylinePxOffset is the cumulative pixel offset from
      // the parent polyline's start (zero for isolated
      // segments and for the first segment of a polyline) —
      // adding it keeps the pattern phase continuous across
      // joints rather than restarting at every segment.
      float lineWidthPx = halfWidth * 2.0;
      float t = mod((alongPx + vPolylinePxOffset) / lineWidthPx, vLinePatternPeriod);
      // Walk the resolved pattern from the flat varying. GLSL
      // ES 3.00 forbids dynamic indexing into a vec4's
      // components, so unroll the access through the two vec4
      // varyings. Compile-time loop bound is 8; the runtime
      // length cap is enforced by the inner break.
      float acc = 0.0;
      bool  inDash = true;
      for (int i = 0; i < 8; i++) {
        if (i >= vLinePatternLen) break;
        float entry =
          i == 0 ? vLinePattern0123.x :
          i == 1 ? vLinePattern0123.y :
          i == 2 ? vLinePattern0123.z :
          i == 3 ? vLinePattern0123.w :
          i == 4 ? vLinePattern4567.x :
          i == 5 ? vLinePattern4567.y :
          i == 6 ? vLinePattern4567.z :
                   vLinePattern4567.w;
        acc += entry;
        if (t < acc) {
          if (!inDash) discard;
          break;
        }
        inDash = !inDash;
      }
    }

    color.a *= alpha;`);
  }

  /**
   * Discards fragments outside the thick-line's rounded-rectangle SDF,
   * without touching any `color` variable. Used by the pick and snap
   * passes — both rasterise the same quad expansion as the colour pass
   * but write a single MRT (IDs / view position) rather than a blended
   * colour, so the SDF coverage they want is binary "in / out" rather
   * than the soft 1-pixel falloff the colour pass uses.
   *
   * Mirrors the SDF derivation in {@link fsThickLineLogic} (same
   * varyings, same joint-flag clamp skip) but uses `sdf > 0.0` as the
   * discard threshold — keep every fragment whose coverage centre lies
   * within the rounded rectangle, drop the cap-extension corners that
   * sit outside it. Picking the rounded core (not the soft AA halo)
   * is what gives picking / snap a hit area that matches what the
   * user sees as the line's body.
   *
   * Emit AFTER {@link fsThickLineDeclarations} so the varyings are
   * declared, and BEFORE the pick/snap output is written.
   */
  protected fsThickLineDiscardOutside() {
    this._fragSrcBuf.push(`
    // Rounded-rect SDF — same derivation as fsThickLineLogic; see
    // that helper's body for the coordinate-space explanation.
    {
      float alongPx     = vLineCoordPx.x;
      float acrossPx    = vLineCoordPx.y;
      float lineLenPx   = vLineDimsPx.x;
      float halfWidth   = vLineDimsPx.y;
      float minAlong    = vJointFlags.x > 0.5 ? -1e8 : 0.0;
      float maxAlong    = vJointFlags.y > 0.5 ?  1e8 : lineLenPx;
      float closestAlong = clamp(alongPx, minAlong, maxAlong);
      vec2  toFrag       = vec2(alongPx - closestAlong, acrossPx);
      // Drop the cap-extension corners that sit outside the
      // rounded rectangle; keep every fragment whose centre lies
      // within the line body so picking/snap match the visual.
      if (length(toFrag) > halfWidth) discard;
    }`);
  }

  /**
   * Declares the screen-space hatch sampler + the flat varyings
   * the FS consumes. Call from a triangle-surface technique's
   * `buildVertexShader` after {@link vsCommonDeclarations}.
   *
   * Five varyings — four `vec4` line families + a `vec4` ink
   * colour + a flat `int` count — keep the FS test branch-free
   * once the per-primitive resolution has run in the VS.
   */
  protected vsHatchDeclarations() {
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Hatch-pattern table (per-batch) + resolved varyings
// ─────────────────────────────────────────────────────────────

uniform highp sampler2D uHatchPatternTexture;

// Resolved per-primitive hatch — four line families packed as
// (cos(angle), sin(angle), spacing, lineWidth), plus an RGBA
// ink colour. Flat-out because the resolved values are
// constant across a primitive's vertices, so the FS can
// branch-free on a flat varying.
// Each family occupies two flat varyings:
//   FamilyNa = (cos(angle), sin(angle), spacing, lineWidth)
//   FamilyNb = (typeId,     phase,      param1,  param2)
flat out vec4 vHatchFamily0a;
flat out vec4 vHatchFamily0b;
flat out vec4 vHatchFamily1a;
flat out vec4 vHatchFamily1b;
flat out vec4 vHatchFamily2a;
flat out vec4 vHatchFamily2b;
flat out vec4 vHatchFamily3a;
flat out vec4 vHatchFamily3b;
flat out vec4 vHatchColor;
flat out int  vHatchCount;
// Coordinate-space flag — 0 = screen (gl_FragCoord.xy in
// pixels), 1 = world (vWorldPos.xy in world units), 2 = tangent
// (basis derived from dFdx/dFdy(vWorldPos)). Per-pattern,
// fetched from the slot's flags texel by the VS.
flat out int  vHatchSpace;
`);
  }

  /**
   * Resolves the per-mesh hatch slot into the flat varyings.
   * Emit AFTER {@link vsMainBegin} (so `meshAttributeTexture` is
   * in scope) and before {@link vsMainEnd}. Slot 0 means "no
   * hatch" — the resolution then writes zeros and `vHatchCount`
   * stays at 0, which the FS test short-circuits on.
   */
  protected vsHatchLogic() {
    this._vertSrcBuf.push(`
    if (meshAttributeTexture.hatchPatternSlot > 0u) {
      // 10 RGBA32F texels per slot, laid out in a 256-wide row:
      //   pBase + 0..7 — four families × two texels each:
      //                  a: (cos, sin, spacing, lineWidth)
      //                  b: (typeId, phase, param1, param2)
      //   pBase + 8   — ink colour (vec4)
      //   pBase + 9   — flags (space, _, _, _)
      const uint hatchTexWidth = 256u;
      uint pBase = meshAttributeTexture.hatchPatternSlot * 10u;
      vHatchFamily0a = texelFetch(uHatchPatternTexture, texCoord(pBase + 0u, hatchTexWidth), 0);
      vHatchFamily0b = texelFetch(uHatchPatternTexture, texCoord(pBase + 1u, hatchTexWidth), 0);
      vHatchFamily1a = texelFetch(uHatchPatternTexture, texCoord(pBase + 2u, hatchTexWidth), 0);
      vHatchFamily1b = texelFetch(uHatchPatternTexture, texCoord(pBase + 3u, hatchTexWidth), 0);
      vHatchFamily2a = texelFetch(uHatchPatternTexture, texCoord(pBase + 4u, hatchTexWidth), 0);
      vHatchFamily2b = texelFetch(uHatchPatternTexture, texCoord(pBase + 5u, hatchTexWidth), 0);
      vHatchFamily3a = texelFetch(uHatchPatternTexture, texCoord(pBase + 6u, hatchTexWidth), 0);
      vHatchFamily3b = texelFetch(uHatchPatternTexture, texCoord(pBase + 7u, hatchTexWidth), 0);
      vHatchColor    = texelFetch(uHatchPatternTexture, texCoord(pBase + 8u, hatchTexWidth), 0);
      vec4 flags     = texelFetch(uHatchPatternTexture, texCoord(pBase + 9u, hatchTexWidth), 0);
      // The CPU encoder zero-pads trailing families after the
      // in-use count. A family with spacing == 0 is the sentinel
      // for "unused"; count the leading non-zero-spacing runs to
      // recover the family count.
      int n = 0;
      if (vHatchFamily0a.z > 0.0) n = 1;
      if (vHatchFamily1a.z > 0.0) n = 2;
      if (vHatchFamily2a.z > 0.0) n = 3;
      if (vHatchFamily3a.z > 0.0) n = 4;
      vHatchCount = n;
      // Decode space: 0 = screen, 1 = world, 2 = tangent.
      vHatchSpace = int(flags.r + 0.5);
    } else {
      vHatchFamily0a = vec4(0.0);
      vHatchFamily0b = vec4(0.0);
      vHatchFamily1a = vec4(0.0);
      vHatchFamily1b = vec4(0.0);
      vHatchFamily2a = vec4(0.0);
      vHatchFamily2b = vec4(0.0);
      vHatchFamily3a = vec4(0.0);
      vHatchFamily3b = vec4(0.0);
      vHatchColor    = vec4(0.0);
      vHatchCount    = 0;
      vHatchSpace    = 0;
    }`);
  }

  /**
   * Declares the flat-in hatch varyings on the FS side. Emit
   * from a triangle-surface technique's `buildFragmentShader`
   * after {@link fsLambertShadingDeclarations} / colour decls.
   */
  protected fsHatchDeclarations() {
    this._fragSrcBuf.push(
      "flat in vec4 vHatchFamily0a;",
      "flat in vec4 vHatchFamily0b;",
      "flat in vec4 vHatchFamily1a;",
      "flat in vec4 vHatchFamily1b;",
      "flat in vec4 vHatchFamily2a;",
      "flat in vec4 vHatchFamily2b;",
      "flat in vec4 vHatchFamily3a;",
      "flat in vec4 vHatchFamily3b;",
      "flat in vec4 vHatchColor;",
      "flat in int  vHatchCount;",
      "flat in int  vHatchSpace;",
    );
  }

  /**
   * Overlays the hatch on the working `color` variable. For
   * every fragment whose screen-space position lies inside any
   * of the line families' ink lines, blends `vHatchColor` over
   * `color.rgb` using the hatch's alpha channel.
   *
   * Emit AFTER the surface colour has been resolved (typically
   * after {@link fsLambertShadingLogic}) and BEFORE
   * {@link fsOutputColor}. Hatch is purely a visual overlay —
   * the surface's alpha / depth is left untouched, and picking
   * / snap shaders never call this helper.
   */
  protected fsHatchLogic() {
    this._fragSrcBuf.push(`
    if (vHatchCount > 0) {
      // Three coordinate spaces:
      //
      //   - vHatchSpace == 0 (screen): hatch coordinate is
      //     gl_FragCoord.xy. spacing and lineWidth are pixels.
      //     Camera-locked.
      //
      //   - vHatchSpace == 1 (world): hatch coordinate is the
      //     world XY plane (vWorldPos.xy). spacing and
      //     lineWidth are world units. Geometry-locked, fixed
      //     to world axes.
      //
      //   - vHatchSpace == 2 (tangent): hatch coordinate is the
      //     surface's local frame, built from per-fragment
      //     world-position derivatives. The pattern follows
      //     the surface, so curved geometry (cylinders, spheres,
      //     IFC sweeps) shows a uniform-density hatch as if
      //     printed on the surface like a material decal.
      //     Slight per-face frame ambiguity at sharp corners
      //     is the documented trade-off.
      //
      // fwidth() converts world / tangent distances into pixels
      // so the half-pixel AA padding has consistent meaning
      // across all three modes.
      vec2 hatchCoord;
      if (vHatchSpace == 0) {
        hatchCoord = gl_FragCoord.xy;
      } else if (vHatchSpace == 1) {
        hatchCoord = vWorldPos.xy;
      } else {
        // Tangent space — surface basis built from world-pos
        // derivatives, ANCHORED to world up rather than to
        // dFdx itself. A pure-derivative tangent (normalize(dFdx))
        // is parallel to the screen X axis in world space —
        // which rotates as the camera orbits, so the hatch
        // would spin with the view. Projecting world up onto
        // the surface plane gives a tangent that depends only
        // on the surface and the scene's up axis, so the
        // hatch stays fixed to the geometry under camera
        // motion.
        //
        // World up is hard-coded to +Z (xeokit's default scene
        // coordinate system). Y-up scenes are rotated to Z-up
        // by the Scene's coord-system transform before
        // reaching the renderer, so this stays correct without
        // an extra uniform setup.
        //
        // Degenerate case — surface normal parallel to world
        // up (floors, ceilings): swap in world +X as the
        // reference so the projection isn't a zero vector.
        vec3 wDx = dFdx(vWorldPos);
        vec3 wDy = dFdy(vWorldPos);
        vec3 n   = normalize(cross(wDx, wDy));
        vec3 up  = vec3(0.0, 0.0, 1.0);
        vec3 ref = (abs(dot(n, up)) > 0.99) ? vec3(1.0, 0.0, 0.0) : up;
        vec3 t   = normalize(ref - n * dot(ref, n));
        vec3 b   = cross(n, t);
        hatchCoord = vec2(dot(vWorldPos, t), dot(vWorldPos, b));
      }
      float maxCoverage = 0.0;
      for (int i = 0; i < 4; i++) {
        if (i >= vHatchCount) break;
        vec4 famA, famB;
        if      (i == 0) { famA = vHatchFamily0a; famB = vHatchFamily0b; }
        else if (i == 1) { famA = vHatchFamily1a; famB = vHatchFamily1b; }
        else if (i == 2) { famA = vHatchFamily2a; famB = vHatchFamily2b; }
        else             { famA = vHatchFamily3a; famB = vHatchFamily3b; }
        // famA = (cos, sin, spacing, lineWidth)
        // famB = (typeId, phase, param1, param2)
        float cosA      = famA.x;
        float sinA      = famA.y;
        float spacing   = famA.z;
        float lineWidth = famA.w;
        int   typeId    = int(famB.x + 0.5);
        float phase     = famB.y;
        // Tangent direction (along the lines) is perpendicular
        // to the family normal: (-sin, cos).
        float perp  = hatchCoord.x * cosA + hatchCoord.y * sinA;
        float along = -hatchCoord.x * sinA + hatchCoord.y * cosA;

        // fwd is the per-fragment change in perp. In screen
        // mode it's already ~1 pixel; in world / tangent it's
        // the world-units-per-fragment ratio. A near-zero fwd
        // means the surface is parallel to the family normal
        // — that family doesn't intersect this face, so its
        // contribution is 0 (otherwise the unbounded scale
        // would paint the whole face).
        float fwd = (vHatchSpace == 0) ? 1.0 : fwidth(perp);
        if (fwd < 1e-4) continue;
        float scale = (vHatchSpace == 0) ? 1.0 : 1.0 / fwd;
        float spacingPx   = spacing   * scale;
        float lineWidthPx = lineWidth * scale;
        float halfBand    = lineWidthPx * 0.5 + 0.5;

        float coverage = 0.0;
        if (typeId == 1) {
          // ── Dot grid ──
          //
          // Two-axis modulo on the rotated coordinates puts each
          // fragment into a single grid cell. Distance from the
          // cell centre measured against half the dot diameter
          // (= lineWidthPx * 0.5) gives circular coverage.
          float ax = mod((along - phase) * scale, spacingPx) - spacingPx * 0.5;
          float bx = mod((perp  - phase) * scale, spacingPx) - spacingPx * 0.5;
          float dst = sqrt(ax * ax + bx * bx);
          coverage = clamp(halfBand - dst, 0.0, 1.0);
        } else if (typeId == 2) {
          // ── Wavy lines ──
          //
          // Each line's perp position is shifted by a sine of
          // along. Subtract the wave value from perp before
          // walking the line pattern; lines retain constant
          // spacing because every line in the family rides the
          // same wave (phase-locked across the parallel set).
          float amplitude  = famB.z;
          float wavelength = famB.w > 1e-6 ? famB.w : (spacing * 2.0);
          float wave = amplitude * sin(6.28318530718 * along / wavelength + phase);
          float perpAdj = (perp - wave) * scale;
          float m = mod(perpAdj, spacingPx);
          float centerDst = min(m, spacingPx - m);
          coverage = clamp(halfBand - centerDst, 0.0, 1.0);
        } else if (typeId == 3) {
          // ── Brick lattice ──
          //
          // Bricks are spacing wide along the row direction,
          // brickHeight tall along the perpendicular direction,
          // staggered by courseOffset between consecutive rows.
          // Mortar appears wherever a fragment is within
          // (lineWidthPx / 2) of a brick edge — i.e. close to the
          // top/bottom of its row or the left/right of its brick.
          float brickHeight  = famB.z;
          float courseOffset = famB.w;
          float perpScaled  = (perp - phase) * scale;
          float alongScaled = along * scale;
          float brickHeightPx  = brickHeight  * scale;
          float courseOffsetPx = courseOffset * scale;
          float row = floor(perpScaled / brickHeightPx);
          float localPerp  = perpScaled - row * brickHeightPx;
          float alongShifted = alongScaled - row * courseOffsetPx;
          float localAlong = mod(alongShifted, spacingPx);
          float dPerp  = min(localPerp,  brickHeightPx - localPerp);
          float dAlong = min(localAlong, spacingPx     - localAlong);
          float distToMortar = min(dPerp, dAlong);
          coverage = clamp(halfBand - distToMortar, 0.0, 1.0);
        } else {
          // ── Default: straight parallel lines ──
          float m = mod((perp - phase) * scale, spacingPx);
          float centerDst = min(m, spacingPx - m);
          coverage = clamp(halfBand - centerDst, 0.0, 1.0);
        }
        maxCoverage = max(maxCoverage, coverage);
      }
      if (maxCoverage > 0.0) {
        color.rgb = mix(color.rgb, vHatchColor.rgb, vHatchColor.a * maxCoverage);
      }
    }`);
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
    // Vertex color bytes are authored/stored as sRGB; convert to linear for the scene pipeline.
    uvec4 color = getVertexColor(geometryAttributes.vertexColorsBase + vertexIndexWithinGeometry);
    vec3 srgbColor = vec3(float(color.r), float(color.g), float(color.b)) / 255.0;
    vColor = vec4(pow(max(srgbColor, vec3(0.0)), vec3(2.2)), 1.0);`);
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
   * Generates point size logic for point-cloud picking.
   *
   * Pick rendering targets a 1x1 framebuffer viewport centred on the
   * pointer. Keeping point picks at exactly the visible point size makes
   * 1px LAS points effectively unpickable, so the pick pass keeps the
   * visible size as a lower bound but expands tiny points to a small
   * screen-space picking footprint.
   *
   * @protected
   */
  protected vsPointsPickGeometryLogic() {
    this._vertSrcBuf.push(
      `  if (uPerspectivePoints == 1) {
     gl_PointSize = (uNearPlaneHeight * pointSize) / clipPos.w;
     gl_PointSize = max(gl_PointSize, uPerspectivePointsMinMax[0]);
     gl_PointSize = min(gl_PointSize, uPerspectivePointsMinMax[1]);
   } else {
      gl_PointSize = pointSize;
   }
   float pickPointSize = max(gl_PointSize, 7.0);
   gl_Position.xy /= pickPointSize;
   gl_PointSize = pickPointSize;`);
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
    this._fragSrcBuf.push(
      "color = vColor;",
      "if (color.a <= 0.0) discard;");
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
   * Inline gamma-2.2 sRGB encode on the working `color.rgb`. Use
   * when a technique writes straight to the default canvas
   * framebuffer without going through {@link TonemapPipeline}
   * (which is the usual sRGB encoder for the scene render) — for
   * example, the overlay-bin pass that runs *after*
   * `PostProcessChain.composite` so the gizmo / HUD layer doesn't
   * get tonemapped along with the rest of the scene.
   *
   * Matches the same `pow(c, 1/2.2)` curve `TonemapPipeline` uses
   * when its `uSRGBEncode` uniform is set, so a colour authored as
   * `(1, 0, 0)` shows up identically whether it travelled through
   * tonemap or through this inline encoder. `max(c, 0)` guards
   * against negative inputs from bad source data — `pow` of a
   * negative is undefined and yields NaN on some GPUs.
   *
   * Called between whichever chunk fills `color` (typically
   * {@link fsDrawFlatColorLogic}) and {@link fsOutputColor}.
   */
  protected fsSRGBEncodeColor() {
    this._fragSrcBuf.push(
      "color.rgb = pow(max(color.rgb, vec3(0.0)), vec3(1.0 / 2.2));"
    );
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
        "flat in vec2 vMaterial;",
        "flat in vec4 vClearcoat;"
      ] : []),
      ...(this.hasUVs ? [
        "in vec2 vUV;"
      ] : []),
      // `vWorldPos` declared in fsSlicingDeclarations
      // (universal across techniques); Lambert reads it for
      // triplanar atlas sampling and the world-space hatch
      // path. No re-declaration here.
      // Triplanar-only world-space inputs. `vWorldNormal` is the
      // rotated model-space normal (only when the batch carries
      // normals — the flat-shaded triplanar variant reconstructs
      // a face normal from `dFdx/dFdy(vWorldPos)` instead).
      ...(this.triplanar ? [
        ...(this.hasNormals ? ["in vec3 vWorldNormal;"] : []),
        "flat in float vTriplanarScale;"
      ] : []),
      ...((this.hasUVs || this.triplanar) ? [
        "flat in vec2 vAlbedoUVOffset;",
        "flat in vec2 vAlbedoUVScale;",
        "flat in vec2 vMRUVOffset;",
        "flat in vec2 vMRUVScale;",
        "flat in vec2 vNormalUVOffset;",
        "flat in vec2 vNormalUVScale;",
        "flat in vec2 vEmissiveUVOffset;",
        "flat in vec2 vEmissiveUVScale;",
        "flat in vec2 vOcclusionUVOffset;",
        "flat in vec2 vOcclusionUVScale;",
        "flat in vec3 vEmissiveColor;",
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
        "uniform sampler2D uNormalMapAtlas;",
        // Emissive atlas — sRGB-decoded by the GPU (SRGB8_ALPHA8). Multiplied
        // by vEmissiveColor and added to the lit colour.
        "uniform sampler2D uEmissiveAtlas;",
        // Ambient-occlusion atlas — linear RGBA8, AO in R. Multiplies the
        // indirect lighting term. Sentinel white → R = 1 → no occlusion.
        "uniform sampler2D uOcclusionAtlas;"
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
      // the dot of the surface normal with world up. Cheap: one dot,
      // one mix. uHemisphereUpView is
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
        "uniform float       uIBLMaxSpecularMipLevel;"
      ] : []),
      // World-from-view rotation. Bound by the renderer regardless
      // of `hasNormals` because the triplanar variants — both
      // smooth and flat — need it to rotate their world-space
      // perturbed normal back into the view-space frame the BRDF
      // evaluates in. The cubemaps + BRDF LUT above stay
      // smooth-only because IBL itself only fires for the
      // smooth-shaded path.
      ...((this.hasNormals || this.triplanar) ? [
        "uniform mat3        uIBLViewToWorldRot;"
      ] : []),
      // `g_ambient` is the resolved per-fragment ambient (flat or IBL).
      // `g_shadowFloor` is the lower bound used by shadow compositing.
      // Keep them separate: the smooth/PBR path can have a bright IBL
      // ambient term, but using that whole term as the shadow floor
      // makes normal-bearing meshes appear to receive much weaker
      // shadows than flat/no-normal meshes.
      "vec3 g_ambient;",
      "vec3 g_shadowFloor;",
      // Emissive contribution (added to the lit colour) and ambient-occlusion
      // factor (multiplies the indirect term). Defaults mean "no emission /
      // no occlusion"; the UV-bearing variants overwrite them per fragment.
      "vec3 g_emissive = vec3(0.0);",
      "float g_ao = 1.0;");
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
}

vec3 F_SchlickRoughness(vec3 F0, float cosTheta, float roughness) {
  float f = pow(1.0 - cosTheta, 5.0);
  return F0 + (max(vec3(1.0 - roughness), F0) - F0) * f;
}

float specularOcclusion(float NdotV, float ao, float roughness) {
  return clamp(pow(NdotV + ao, exp2(-16.0 * roughness - 1.0)) - 1.0 + ao, 0.0, 1.0);
}

float F_SchlickScalar(float F0, float cosTheta) {
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
        // shadowed fragments. We declare them so the shader still
        // compiles, and set them so shadows DON'T darken the debug
        // colour — `g_shadowFloor = nm_raw`, so the
        // shadow stage's `max(color * shadowFactor, ambientFloor)`
        // clamps back up to the raw normal-map sample. Net effect: the
        // debug viz comes through the BRDF and shadow stages unaffected.
        this._fragSrcBuf.push(`
    vec2 wrappedUV = fract(vUV);
    vec2 normalAtlasUV = wrappedUV * vNormalUVScale + vNormalUVOffset;
    vec3 nm_raw = texture(uNormalMapAtlas, normalAtlasUV).rgb;
    vec3 albedo = nm_raw;
    g_ambient = vec3(1.0);
    g_shadowFloor = nm_raw;
    color = vec4(nm_raw, 1.0);`);
        return;
      }
      // The smooth-shaded variant has three flavours that differ only
      // in how the albedo (base colour) is resolved:
      //   - hasUVs:   sample the atlas via vertex UVs, then tint by vColor
      //   - triplanar: sample the atlas three times via world-space
      //               coordinates, blend by world normal weights
      //   - neither:  vColor IS the albedo
      // The BRDF that follows is identical in all three cases.
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
    float mrMetallicFactor  = mrSample.b;
    // Emissive (sRGB atlas) × per-mesh factor; ambient occlusion (R channel).
    g_emissive = texture(uEmissiveAtlas, wrappedUV * vEmissiveUVScale + vEmissiveUVOffset).rgb * vEmissiveColor;
    g_ao = texture(uOcclusionAtlas, wrappedUV * vOcclusionUVScale + vOcclusionUVOffset).r;`
        : this.triplanar
        ? `// Triplanar (world-space) sampling. Built per-fragment from
    // vWorldPos and the world-space normal — independent of any vertex
    // UV attribute, so it works on BIM, sweeps and any other geometry
    // the loader produced without UVs.
    //
    // Construct three sets of UVs by projecting world position onto the
    // three coordinate planes (each scaled by the per-mesh
    // vTriplanarScale for "world units per repeat"), then blend three
    // texture samples by the absolute world normal raised to a power.
    // The exponent sharpens the blend bands — 4.0 is a common compromise
    // between perceptible blur near the diagonals and visible seams at
    // axis-aligned faces.
    vec3 triNorm = normalize(vWorldNormal);
    vec3 triAbs = abs(triNorm);
    vec3 triW = pow(triAbs, vec3(4.0));
    triW /= max(triW.x + triW.y + triW.z, 1e-5);

    vec3 triP = vWorldPos / max(vTriplanarScale, 1e-4);
    // Per-plane mirror flip on negative-axis-facing fragments keeps the
    // texture from appearing reversed on opposing faces.
    vec2 triUVx = vec2(triNorm.x < 0.0 ? -triP.z : triP.z, triP.y);
    vec2 triUVy = vec2(triP.x, triNorm.y < 0.0 ? -triP.z : triP.z);
    vec2 triUVz = vec2(triNorm.z < 0.0 ? -triP.x : triP.x, triP.y);

    vec2 wrappedX = fract(triUVx);
    vec2 wrappedY = fract(triUVy);
    vec2 wrappedZ = fract(triUVz);

    // Pre-fract derivatives. The atlas-sample coord
    // \`wrappedX * scale + offset\` has a discontinuity at every
    // tile seam (where \`fract\` snaps from ~1 → 0); the GPU's
    // automatic mip selection sees that as a huge gradient and
    // picks the smallest mip, smearing seams. Using the
    // *un-fract'd* triUV gradient — multiplied by the per-mesh
    // atlas scale — gives the true rate of change across the
    // triangle, so mip selection lands on the right level even
    // at tile boundaries. Each per-axis dx/dy is computed once
    // and reused across albedo / MR / normal-map samples.
    vec2 dxX = dFdx(triUVx);
    vec2 dyX = dFdy(triUVx);
    vec2 dxY = dFdx(triUVy);
    vec2 dyY = dFdy(triUVy);
    vec2 dxZ = dFdx(triUVz);
    vec2 dyZ = dFdy(triUVz);

    vec4 albedoX = textureGrad(uAlbedoAtlas, wrappedX * vAlbedoUVScale + vAlbedoUVOffset, dxX * vAlbedoUVScale, dyX * vAlbedoUVScale);
    vec4 albedoY = textureGrad(uAlbedoAtlas, wrappedY * vAlbedoUVScale + vAlbedoUVOffset, dxY * vAlbedoUVScale, dyY * vAlbedoUVScale);
    vec4 albedoZ = textureGrad(uAlbedoAtlas, wrappedZ * vAlbedoUVScale + vAlbedoUVOffset, dxZ * vAlbedoUVScale, dyZ * vAlbedoUVScale);
    vec4 albedoSample = albedoX * triW.x + albedoY * triW.y + albedoZ * triW.z;
    vec3 albedo = albedoSample.rgb * vColor.rgb;
    float albedoAlpha = albedoSample.a * vColor.a;

    // Alpha-mask cutout — same semantics as the UV path above.
    if (vAlphaMode == 1u) {
      float aaAlpha = (albedoAlpha - vAlphaCutoff) / max(fwidth(albedoAlpha), 1e-4) + 0.5;
      if (aaAlpha < 0.5) discard;
    }

    vec4 mrX = textureGrad(uMetallicRoughnessAtlas, wrappedX * vMRUVScale + vMRUVOffset, dxX * vMRUVScale, dyX * vMRUVScale);
    vec4 mrY = textureGrad(uMetallicRoughnessAtlas, wrappedY * vMRUVScale + vMRUVOffset, dxY * vMRUVScale, dyY * vMRUVScale);
    vec4 mrZ = textureGrad(uMetallicRoughnessAtlas, wrappedZ * vMRUVScale + vMRUVOffset, dxZ * vMRUVScale, dyZ * vMRUVScale);
    vec4 mrSample = mrX * triW.x + mrY * triW.y + mrZ * triW.z;
    float mrRoughnessFactor = mrSample.g;
    float mrMetallicFactor  = mrSample.b;
    vec3 emX = textureGrad(uEmissiveAtlas, wrappedX * vEmissiveUVScale + vEmissiveUVOffset, dxX * vEmissiveUVScale, dyX * vEmissiveUVScale).rgb;
    vec3 emY = textureGrad(uEmissiveAtlas, wrappedY * vEmissiveUVScale + vEmissiveUVOffset, dxY * vEmissiveUVScale, dyY * vEmissiveUVScale).rgb;
    vec3 emZ = textureGrad(uEmissiveAtlas, wrappedZ * vEmissiveUVScale + vEmissiveUVOffset, dxZ * vEmissiveUVScale, dyZ * vEmissiveUVScale).rgb;
    g_emissive = (emX * triW.x + emY * triW.y + emZ * triW.z) * vEmissiveColor;
    float aoX = textureGrad(uOcclusionAtlas, wrappedX * vOcclusionUVScale + vOcclusionUVOffset, dxX * vOcclusionUVScale, dyX * vOcclusionUVScale).r;
    float aoY = textureGrad(uOcclusionAtlas, wrappedY * vOcclusionUVScale + vOcclusionUVOffset, dxY * vOcclusionUVScale, dyY * vOcclusionUVScale).r;
    float aoZ = textureGrad(uOcclusionAtlas, wrappedZ * vOcclusionUVScale + vOcclusionUVOffset, dxZ * vOcclusionUVScale, dyZ * vOcclusionUVScale).r;
    g_ao = aoX * triW.x + aoY * triW.y + aoZ * triW.z;`
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

    ${this.hasUVs || this.triplanar
        ? "float outputAlpha = (vAlphaMode == 2u) ? albedoAlpha : vColor.a;"
        : "float outputAlpha = albedoAlpha;"}

    // Re-normalize after rasterizer interpolation; linear blends of unit
    // vectors generally come out sub-unit length. Guard the divide:
    // along sharp normal seams (very common in IFC, where adjacent
    // faces carry opposing normals) the interpolated value collapses
    // to ~zero, and a plain normalize returns NaN. NaN then poisons
    // every downstream BRDF term, propagates through tonemap, and —
    // when bloom samples it — pollutes the entire blur pyramid. Fall
    // back to a forward-facing default in the degenerate case so the
    // pixel still gets sensible (if flat) shading.
    float vnLen2 = dot(vViewNormal, vViewNormal);
    vec3 N_smooth = (vnLen2 > 1e-10)
        ? vViewNormal * inversesqrt(vnLen2)
        : vec3(0.0, 0.0, 1.0);
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
    // Same NaN-guard as the smooth normal: a degenerate triangle has
    // dot(T,T) = dot(B,B) = 0, which would make inversesqrt(0) = INF
    // and the resulting TBN basis send NaN through normalize.
    float tbnMax2 = max(dot(T, T), dot(B, B));
    float tbnInvMax = (tbnMax2 > 1e-12) ? inversesqrt(tbnMax2) : 0.0;
    mat3 TBN = mat3(T * tbnInvMax, B * tbnInvMax, N_smooth);
    vec3 tbnPerturbed = TBN * nm_tangent;
    float tbnPL2 = dot(tbnPerturbed, tbnPerturbed);
    vec3 N = (tbnPL2 > 1e-10)
        ? tbnPerturbed * inversesqrt(tbnPL2)
        : N_smooth;`
    : this.triplanar ? `// Triplanar tangent-space normal map. Sample the atlas three times
    // (once per axis projection), interpret each sample as a perturbation
    // of the world-space basis aligned with that projection, blend by the
    // same triplanar weights, and add to the geometric world normal —
    // the "whiteout" / "swizzle" blend from Barré-Brisebois & Hill 2012.
    // The result is a perturbed world-space normal; the BRDF that follows
    // works in view space, so we rotate back via uIBLViewToWorldRot's
    // inverse (the matrix is a pure rotation, so transpose suffices).
    // textureGrad with the pre-fract derivatives — same anti-seam
    // reasoning as the albedo/MR triplanar samples above.
    vec3 nmX = textureGrad(uNormalMapAtlas, wrappedX * vNormalUVScale + vNormalUVOffset, dxX * vNormalUVScale, dyX * vNormalUVScale).xyz * 2.0 - 1.0;
    vec3 nmY = textureGrad(uNormalMapAtlas, wrappedY * vNormalUVScale + vNormalUVOffset, dxY * vNormalUVScale, dyY * vNormalUVScale).xyz * 2.0 - 1.0;
    vec3 nmZ = textureGrad(uNormalMapAtlas, wrappedZ * vNormalUVScale + vNormalUVOffset, dxZ * vNormalUVScale, dyZ * vNormalUVScale).xyz * 2.0 - 1.0;
    // Mirror the tangent-x channel on negative-axis-facing fragments to
    // match the per-plane UV mirroring above; otherwise the perturbation
    // appears reversed on opposing faces.
    if (triNorm.x < 0.0) nmX.x = -nmX.x;
    if (triNorm.y < 0.0) nmY.x = -nmY.x;
    if (triNorm.z < 0.0) nmZ.x = -nmZ.x;
    // Whiteout swizzle: each axis contributes (tangent_x, tangent_y, 0)
    // in its own local frame, mapped into world coords by axis swap.
    //   X-projection (yz plane): sample (x,y) → world (z,y), normal is X
    //   Y-projection (xz plane): sample (x,y) → world (x,z), normal is Y
    //   Z-projection (xy plane): sample (x,y) → world (x,y), normal is Z
    vec3 nmWorld = (vec3(0.0,    nmX.y,  nmX.x)) * triW.x
                 + (vec3(nmY.x,  0.0,    nmY.y)) * triW.y
                 + (vec3(nmZ.x,  nmZ.y,  0.0))   * triW.z;
    // Blend the perturbation onto the geometric world normal, then
    // bring back into view space. Sentinel \`(0, 0, 1)\` from untextured
    // mesh slots contributes a zero-tangent perturbation, so untextured
    // triplanar meshes fall back to plain \`N_smooth\` automatically.
    vec3 N_world = normalize(triNorm + nmWorld);
    vec3 N = normalize(transpose(uIBLViewToWorldRot) * N_world);
    if (dot(N, vViewPos) > 0.0) N = -N;`
    : `vec3 N = N_smooth;`}
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
    float clearcoat = clamp(vClearcoat.x, 0.0, 1.0);
    float clearcoatRoughness = max(vClearcoat.y, PBR_MIN_ROUGHNESS);
    float sheen = clamp(vClearcoat.z, 0.0, 1.0);
    float sheenRoughness = max(vClearcoat.w, PBR_MIN_ROUGHNESS);
    float a         = roughness * roughness;
    float a2        = a * a;

    vec3 F0 = mix(vec3(0.04), albedo, metallic);

    // Specular term — D * G * F / (4 N·V N·L). The 4 N·V N·L denominator
    // can underflow near grazing angles; clamp via max.
    float D = D_GGX(NdotH, a2);
    float G = G_Smith(NdotL, NdotV, roughness);
    vec3  F = F_Schlick(F0, VdotH);
    vec3  specular = (D * G) * F / max(4.0 * NdotL * NdotV, 1e-4);
    float Fcc = F_SchlickScalar(0.04, VdotH);
    float ccA = clearcoatRoughness * clearcoatRoughness;
    float Dcc = D_GGX(NdotH, ccA * ccA);
    float Gcc = G_Smith(NdotL, NdotV, clearcoatRoughness);
    float clearcoatSpecular = clearcoat * Dcc * Gcc * Fcc / max(4.0 * NdotL * NdotV, 1e-4);

    // Diffuse term — energy conservation: any light reflected as specular
    // can't also be diffuse, and metals have no diffuse term at all.
    vec3 kd = (1.0 - F) * (1.0 - metallic);
    vec3 diffuse = kd * albedo / 3.14159265;

    // Direct lighting contribution from the primary directional light.
    // Light colour (uLightColor1.rgb * .a = colour * intensity) plus N·L.
    vec3 directLight = uLightColor1.rgb * uLightColor1.a * NdotL;
    float clearcoatBaseAttenuation = 1.0 - clearcoat * Fcc;
    float sheenExponent = mix(8.0, 2.0, sheenRoughness);
    vec3 sheenDirect = albedo * sheen * pow(max(1.0 - VdotH, 0.0), sheenExponent) * (1.0 - metallic);
    vec3 directContrib = ((diffuse + specular + sheenDirect) * clearcoatBaseAttenuation + vec3(clearcoatSpecular)) * directLight;

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
    float clearcoatSpecMip = clearcoatRoughness * uIBLMaxSpecularMipLevel;
    vec3 clearcoatSpecEnv = textureLod(uIBLPrefilteredCubemap, worldR, clearcoatSpecMip).rgb;

    // Standard split-sum form: prefilteredColor * (F0 * lut.x + lut.y)
    // where lut.x is the F0 scale factor and lut.y is the F0-independent
    // bias. Encodes both the Fresnel and geometry terms exactly.
    vec3  F_NV    = F_SchlickRoughness(F0, NdotV, roughness);
    vec2  brdfLUT = texture(uIBLBRDFLUT, vec2(NdotV, roughness)).rg;
    float iblSpecOcclusion = specularOcclusion(NdotV, g_ao, roughness);
    vec3  iblSpec = iblSpecEnv * (F0 * brdfLUT.x + brdfLUT.y) * iblSpecOcclusion;
    vec3  iblDiff = (1.0 - F_NV) * (1.0 - metallic) * iblDiffuseEnv * albedo;
    float sheenIBLWeight = sheen * pow(max(1.0 - NdotV, 0.0), mix(4.0, 1.0, sheenRoughness)) * (1.0 - metallic);
    vec3  iblSheen = iblDiffuseEnv * albedo * sheenIBLWeight;
    float clearcoatFNV = F_SchlickScalar(0.04, NdotV);
    vec2  clearcoatBRDFLUT = texture(uIBLBRDFLUT, vec2(NdotV, clearcoatRoughness)).rg;
    float clearcoatIBLOcclusion = specularOcclusion(NdotV, g_ao, clearcoatRoughness);
    vec3  clearcoatIBLSpec = clearcoatSpecEnv * (0.04 * clearcoatBRDFLUT.x + clearcoatBRDFLUT.y) * clearcoat * clearcoatIBLOcclusion;
    vec3  iblContrib = (iblDiff + iblSpec + iblSheen) * (1.0 - clearcoat * clearcoatFNV) + clearcoatIBLSpec;

    // Analytical hemisphere term — gated independently of the cubemap
    // so non-IBL profiles can still get a directional sky/ground fill.
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

    // Ambient occlusion multiplies the indirect (ambient + IBL) term only —
    // direct light is unoccluded. Emissive is added on top, unlit.
    vec3 ambientFloor = ((flatAmbient + hemiAmbient * hemiScale) * albedo
                       + iblDiff * iblScale) * g_ao + g_emissive;
    vec3 indirect = (flatAmbient + hemiAmbient * hemiScale) * albedo
                  + iblContrib * iblScale;
    vec3 indirectFloor = indirect * g_ao + g_emissive;
    g_shadowFloor = mix(ambientFloor, indirectFloor, 0.25);
    vec3 lit = directContrib + indirect * g_ao + g_emissive;
    color = vec4(lit, outputAlpha);`);
      return;
    }
    this._fragSrcBuf.push(`
    // Flat-shaded path. ${this.hasUVs
      ? "UV-bearing variant: sample the albedo atlas just like the\n    // smooth-shaded path so geometries that ship without per-vertex\n    // normals (typical IFC) still pick up textured materials. The\n    // alias keeps shared shadow logic able to reference `albedo`."
      : this.triplanar
      ? "Triplanar variant: derive the world-space face normal from\n    // dFdx/dFdy(vWorldPos) so the blend weights are valid even on\n    // UV-less geometry without per-vertex normals (BIM, sweeps).\n    // Three texture samples, blended."
      : "No UVs, no texture — vColor IS the albedo. The alias\n    // keeps shared shadow logic able to reference `albedo`."}
    ${this.hasUVs
      ? `vec2 wrappedUV = fract(vUV);
    vec2 albedoAtlasUV = wrappedUV * vAlbedoUVScale + vAlbedoUVOffset;
    vec4 albedoSample = texture(uAlbedoAtlas, albedoAtlasUV);
    vec3 albedo = albedoSample.rgb * vColor.rgb;
    float albedoAlpha = albedoSample.a * vColor.a;

    // Alpha-mask cutout — same shape as the hasNormals path. The
    // flat-shaded variant runs the AA-discard so MASK-mode textured
    // triangles (cutout text labels, image masks, decals) drop
    // transparent fragments instead of writing them as opaque black
    // (BLEND on triangles is currently a render-loop no-op, so
    // discard is the only option for triangle alphas).
    if (vAlphaMode == 1u) {
      float aaAlpha = (albedoAlpha - vAlphaCutoff) / max(fwidth(albedoAlpha), 1e-4) + 0.5;
      if (aaAlpha < 0.5) discard;
    }
    g_emissive = texture(uEmissiveAtlas, wrappedUV * vEmissiveUVScale + vEmissiveUVOffset).rgb * vEmissiveColor;
    g_ao = texture(uOcclusionAtlas, wrappedUV * vOcclusionUVScale + vOcclusionUVOffset).r;`
      : this.triplanar
      ? `// World-space face normal from screen-space derivatives.
    vec3 triNorm = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
    vec3 triAbs = abs(triNorm);
    vec3 triW = pow(triAbs, vec3(4.0));
    triW /= max(triW.x + triW.y + triW.z, 1e-5);

    vec3 triP = vWorldPos / max(vTriplanarScale, 1e-4);
    vec2 triUVx = vec2(triNorm.x < 0.0 ? -triP.z : triP.z, triP.y);
    vec2 triUVy = vec2(triP.x, triNorm.y < 0.0 ? -triP.z : triP.z);
    vec2 triUVz = vec2(triNorm.z < 0.0 ? -triP.x : triP.x, triP.y);

    vec2 wrappedX = fract(triUVx);
    vec2 wrappedY = fract(triUVy);
    vec2 wrappedZ = fract(triUVz);

    // Pre-fract derivatives — see the smooth-triplanar variant
    // for why this matters (mip selection across tile seams).
    vec2 dxX = dFdx(triUVx);
    vec2 dyX = dFdy(triUVx);
    vec2 dxY = dFdx(triUVy);
    vec2 dyY = dFdy(triUVy);
    vec2 dxZ = dFdx(triUVz);
    vec2 dyZ = dFdy(triUVz);

    vec4 albedoX = textureGrad(uAlbedoAtlas, wrappedX * vAlbedoUVScale + vAlbedoUVOffset, dxX * vAlbedoUVScale, dyX * vAlbedoUVScale);
    vec4 albedoY = textureGrad(uAlbedoAtlas, wrappedY * vAlbedoUVScale + vAlbedoUVOffset, dxY * vAlbedoUVScale, dyY * vAlbedoUVScale);
    vec4 albedoZ = textureGrad(uAlbedoAtlas, wrappedZ * vAlbedoUVScale + vAlbedoUVOffset, dxZ * vAlbedoUVScale, dyZ * vAlbedoUVScale);
    vec4 albedoSample = albedoX * triW.x + albedoY * triW.y + albedoZ * triW.z;
    vec3 albedo = albedoSample.rgb * vColor.rgb;
    float albedoAlpha = albedoSample.a * vColor.a;

    if (vAlphaMode == 1u) {
      float aaAlpha = (albedoAlpha - vAlphaCutoff) / max(fwidth(albedoAlpha), 1e-4) + 0.5;
      if (aaAlpha < 0.5) discard;
    }`
      : `vec3 albedo = vColor.rgb;
    float albedoAlpha = vColor.a;`}

    ${this.hasUVs || this.triplanar
      ? "float outputAlpha = (vAlphaMode == 2u) ? albedoAlpha : vColor.a;"
      : "float outputAlpha = albedoAlpha;"}

    // Reconstruct a face normal in view space from position derivatives.
    // This gives a flat-shaded normal per fragment without refetching the
    // whole triangle in the vertex shader. Safe-normalize: pixel-thin
    // slivers (the kind a section-plane cut exposes at wall edges) have
    // dFdx/dFdy near zero, and a plain normalize on the cross product
    // returns NaN — same poisoning risk as the smooth path.
    vec3 dX = dFdx(vViewPos);
    vec3 dY = dFdy(vViewPos);
    vec3 faceN = cross(dX, dY);
    float faceNL2 = dot(faceN, faceN);
    vec3 normal = (faceNL2 > 1e-12)
        ? faceN * inversesqrt(faceNL2)
        : vec3(0.0, 0.0, 1.0);
${this.triplanar ? `
    // Triplanar tangent-space normal map override. Sample three
    // times and apply the same whiteout swizzle the smooth path
    // uses (Barré-Brisebois & Hill 2012). The result is a
    // perturbed *world*-space normal; rotate back into view space
    // via \`transpose(uIBLViewToWorldRot)\` (the camera's view
    // rotation, which is orthonormal so transpose == inverse) to
    // override the cross-product face normal computed above.
    {
      // textureGrad with the pre-fract derivatives — mip selection
      // is consistent across tile seams. dxX/dyX/etc. are in scope
      // from the flat-triplanar albedo block above.
      vec3 nmX = textureGrad(uNormalMapAtlas, wrappedX * vNormalUVScale + vNormalUVOffset, dxX * vNormalUVScale, dyX * vNormalUVScale).xyz * 2.0 - 1.0;
      vec3 nmY = textureGrad(uNormalMapAtlas, wrappedY * vNormalUVScale + vNormalUVOffset, dxY * vNormalUVScale, dyY * vNormalUVScale).xyz * 2.0 - 1.0;
      vec3 nmZ = textureGrad(uNormalMapAtlas, wrappedZ * vNormalUVScale + vNormalUVOffset, dxZ * vNormalUVScale, dyZ * vNormalUVScale).xyz * 2.0 - 1.0;
      if (triNorm.x < 0.0) nmX.x = -nmX.x;
      if (triNorm.y < 0.0) nmY.x = -nmY.x;
      if (triNorm.z < 0.0) nmZ.x = -nmZ.x;
      vec3 nmWorld = (vec3(0.0,    nmX.y,  nmX.x)) * triW.x
                   + (vec3(nmY.x,  0.0,    nmY.y)) * triW.y
                   + (vec3(nmZ.x,  nmZ.y,  0.0))   * triW.z;
      vec3 N_world = normalize(triNorm + nmWorld);
      normal = normalize(transpose(uIBLViewToWorldRot) * N_world);
      if (dot(normal, vViewPos) > 0.0) normal = -normal;
    }
` : ``}
    // Lambert diffuse term (N·L), clamped to [0,1]. Light direction is
    // the direction the light travels, so we negate to get surface-to-light.
    float lambertian = max(dot(normal, normalize(-uPrimaryLightDirView)), 0.0);

    // Accumulate reflected/diffuse light contribution.
    // uLightColor1.rgb * uLightColor1.a acts like (color * intensity).
    vec3 reflectedColor = vec3(0.0);
    reflectedColor += lambertian * (uLightColor1.rgb * uLightColor1.a);

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

    // Combine ambient + diffuse lighting. Occlusion multiplies the ambient
    // term only (direct diffuse is unoccluded); emissive adds on top, unlit.
    vec3 lit = (g_ambient * albedo) * g_ao + (albedo * reflectedColor) + g_emissive;
    g_shadowFloor = (g_ambient * albedo) * g_ao + g_emissive;

    color = vec4(lit, outputAlpha);`);
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
      "uniform float     saoDebugMode;",
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
      "   float saoDebugModeId = floor(saoDebugMode + 0.5);",
      "   if (saoDebugModeId >= 1.0 && saoDebugModeId <= 4.0) {",
      "       color = vec4(vec3(saoOcclusion), color.a);",
      "   } else if (saoDebugModeId == 5.0) {",
      "       color = vec4(vec3(clamp(saoAOFactor, 0.0, 1.0)), color.a);",
      "   } else {",
      "       color = vec4(color.rgb * clamp(saoAOFactor, 0.0, 1.0), color.a);",
      "   }");
  }

  /**
   * Declares the shadow-map samplers (one per cascade), the per-cascade
   * light-VP array, the cascade split distances, the scalar shadow params,
   * and the PCF / slope-bias data.
   *
   * Uniform layout:
   *   - `uShadowMap0..5`: raw depth maps, sampled with explicit depth
   *     compares so PCF and contact-hardening blocker search share one path.
   *   - `uShadowLightVPs[4]`: mat4 per cascade, camera-view → cascade light-clip.
   *   - `uShadowCascadeSplits`: view-space `|z|` boundaries between cascades;
   *     entry `i` is the far edge of cascade `i`. Only entries
   *     `0 .. uShadowCascadeCount - 2` are meaningful.
   *   - `uShadowCascadeCount`: number of populated cascades in `[1, 4]`.
   *   - `uShadowParams`: `(intensity, depthBias, texelSize, normalOffsetBias)`.
   *   - `uShadowSoftParams`: `(contactHardening, lightRadius, minRadius, debugMode)`.
   *   - `uShadowCascadeDepthRanges`: light-depth ranges per cascade.
   *   - `uShadowCascadeTexelSizes`: world-space texel sizes per cascade.
   *   - `uShadowSlope`: `(dirViewX, dirViewY, dirViewZ, slopeBias)`.
   *   - `uShadowPcfRadius`: half-width of the PCF kernel (0 = 1×1, 1 = 3×3…).
   *
   * Per-fragment cascade selection happens in {@link fsDrawShadowLogic}, so
   * there's no `vShadowCoord` varying — we transform `vViewPos` through the
   * chosen cascade's matrix at fragment time instead.
   */
  protected fsDrawShadowDeclarations() {
    this._fragSrcBuf.push(
      "uniform sampler2D       uShadowMap0;",
      "uniform sampler2D       uShadowMap1;",
      "uniform sampler2D       uShadowMap2;",
      "uniform sampler2D       uShadowMap3;",
      "uniform sampler2D       uShadowMap4;",
      "uniform sampler2D       uShadowMap5;",
      "uniform mat4            uShadowLightVPs[6];",
      "uniform float           uShadowCascadeSplits[6];",
      "uniform float           uShadowCascadeDepthRanges[6];",
      "uniform float           uShadowCascadeTexelSizes[6];",
      "uniform int             uShadowCascadeCount;",
      "uniform vec4            uShadowParams;",
      "uniform vec4            uShadowSoftParams;",
      "uniform vec4            uShadowSlope;",
      "uniform int             uShadowPcfRadius;",
      `
float shadowDepthAt(int cascade, vec2 uv) {
    if      (cascade == 0) return texture(uShadowMap0, uv).r;
    else if (cascade == 1) return texture(uShadowMap1, uv).r;
    else if (cascade == 2) return texture(uShadowMap2, uv).r;
    else if (cascade == 3) return texture(uShadowMap3, uv).r;
    else if (cascade == 4) return texture(uShadowMap4, uv).r;
    else                   return texture(uShadowMap5, uv).r;
}

float shadowDepthCompare(float depth, float refDepth) {
    return refDepth <= depth ? 1.0 : 0.0;
}

float shadowCompareAt(int cascade, vec2 uv, float refDepth) {
    float texel = max(uShadowParams.z, 0.000001);
    vec2 texelPos = uv / texel - vec2(0.5);
    vec2 base = floor(texelPos);
    vec2 f = fract(texelPos);
    vec2 minUv = vec2(texel * 0.5);
    vec2 maxUv = vec2(1.0 - texel * 0.5);
    vec2 uv00 = clamp((base + vec2(0.5, 0.5)) * texel, minUv, maxUv);
    vec2 uv10 = clamp((base + vec2(1.5, 0.5)) * texel, minUv, maxUv);
    vec2 uv01 = clamp((base + vec2(0.5, 1.5)) * texel, minUv, maxUv);
    vec2 uv11 = clamp((base + vec2(1.5, 1.5)) * texel, minUv, maxUv);
    float c00 = shadowDepthCompare(shadowDepthAt(cascade, uv00), refDepth);
    float c10 = shadowDepthCompare(shadowDepthAt(cascade, uv10), refDepth);
    float c01 = shadowDepthCompare(shadowDepthAt(cascade, uv01), refDepth);
    float c11 = shadowDepthCompare(shadowDepthAt(cascade, uv11), refDepth);
    return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
}

vec3 shadowCascadeDebugColor(int cascade) {
    if      (cascade == 0) return vec3(0.95, 0.18, 0.12);
    else if (cascade == 1) return vec3(0.15, 0.72, 0.25);
    else if (cascade == 2) return vec3(0.15, 0.34, 0.95);
    else if (cascade == 3) return vec3(0.95, 0.78, 0.18);
    else if (cascade == 4) return vec3(0.72, 0.25, 0.95);
    else                   return vec3(0.12, 0.82, 0.90);
}

float shadowAverageBlockerDepth(int cascade, vec2 shadowUv, float refDepth, float texel, int radius) {
    float blockerDepth = 0.0;
    float blockerCount = 0.0;
    for (int dy = -radius; dy <= radius; dy++) {
        for (int dx = -radius; dx <= radius; dx++) {
            vec2 off = vec2(float(dx), float(dy)) * texel;
            float depth = shadowDepthAt(cascade, shadowUv.xy + off);
            if (depth < refDepth) {
                blockerDepth += depth;
                blockerCount += 1.0;
            }
        }
    }
    return blockerCount > 0.0 ? blockerDepth / blockerCount : -1.0;
}

float shadowWeightedPCF(int cascade, vec2 shadowUv, float refDepth, float texel, int radius, float filterRadius) {
    if (radius == 0) {
        return shadowCompareAt(cascade, shadowUv, refDepth);
    }
    float litSum = 0.0;
    float weightSum = 0.0;
    for (int dy = -radius; dy <= radius; dy++) {
        for (int dx = -radius; dx <= radius; dx++) {
            vec2 absOffset = vec2(abs(float(dx)), abs(float(dy)));
            if (absOffset.x <= filterRadius + 0.001 && absOffset.y <= filterRadius + 0.001) {
                vec2 off = vec2(float(dx), float(dy)) * texel;
                float weight = max(filterRadius + 1.0 - absOffset.x, 0.0) * max(filterRadius + 1.0 - absOffset.y, 0.0);
                litSum += shadowCompareAt(cascade, shadowUv.xy + off, refDepth) * weight;
                weightSum += weight;
            }
        }
    }
    return litSum / max(weightSum, 1.0);
}`
    );
  }

  /**
   * Selects the best-fitting cascade for the current fragment (based on its
   * camera-view-space `|z|`), samples that cascade's shadow map with
   * comparison-filtered PCF, and darkens `color`.
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
	        float shadowDebugMode = floor(uShadowSoftParams.w + 0.5);
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
      ? `// Same safe-normalize as the main BRDF path — see N_smooth.
        float shNL2 = dot(vViewNormal, vViewNormal);
        vec3 shadowNormalView = (shNL2 > 1e-10)
            ? vViewNormal * inversesqrt(shNL2)
            : vec3(0.0, 0.0, 1.0);`
      : `vec3 sdX = dFdx(vViewPos);
        vec3 sdY = dFdy(vViewPos);
        vec3 sdN = cross(sdX, sdY);
        float sdNL2 = dot(sdN, sdN);
        vec3 shadowNormalView = (sdNL2 > 1e-10)
            ? sdN * inversesqrt(sdNL2)
            : vec3(0.0, 0.0, 1.0);`}

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

	        if (shadowDebugMode == 3.0) {
	            color = vec4(shadowCascadeDebugColor(shadowCascade), color.a);
	        } else if (inside) {
	            // Slope-scaled bias: tan(angle(normal, light)), clamped.
	            float cosTheta = clamp(dot(shadowNormalView, -uShadowSlope.xyz), 0.001, 1.0);
	            float slopeFactor = min(sqrt(max(0.0, 1.0 - cosTheta * cosTheta)) / cosTheta, 10.0);
	            float totalBias = uShadowParams.y + uShadowSlope.w * slopeFactor;

	            float refDepth  = shadowUv.z - totalBias;
	            float texel     = uShadowParams.z;
	            int   r         = uShadowPcfRadius;
	            float filterRadius = float(r);
	            float blockerDepth = -1.0;
	            float visibility = 1.0;
	            float rawDepth = shadowDepthAt(shadowCascade, shadowUv.xy);
	            if (uShadowSoftParams.x > 0.5 && r > 0) {
	                blockerDepth = shadowAverageBlockerDepth(shadowCascade, shadowUv.xy, refDepth, texel, r);
	                if (blockerDepth >= 0.0) {
	                    float receiverBlockerSeparation = max(refDepth - blockerDepth, 0.0) * uShadowCascadeDepthRanges[shadowCascade];
	                    float penumbraTexels = receiverBlockerSeparation * max(uShadowSoftParams.y, 0.0) / max(uShadowCascadeTexelSizes[shadowCascade], 0.000001);
	                    filterRadius = clamp(max(uShadowSoftParams.z, penumbraTexels), 0.0, float(r));
	                    visibility = shadowWeightedPCF(shadowCascade, shadowUv.xy, refDepth, texel, r, filterRadius);
	                }
	            } else {
	                visibility = shadowWeightedPCF(shadowCascade, shadowUv.xy, refDepth, texel, r, filterRadius);
	            }

	            float shadowFraction = 1.0 - visibility;
	            float shadowFactor   = 1.0 - shadowFraction * uShadowParams.x;

	            if (shadowDebugMode == 1.0) {
	                color = vec4(vec3(shadowFactor), color.a);
	            } else if (shadowDebugMode == 2.0) {
	                color = vec4(vec3(rawDepth), color.a);
	            } else if (shadowDebugMode == 4.0) {
	                color = vec4(vec3(refDepth), color.a);
	            } else if (shadowDebugMode == 5.0) {
	                color = vec4(vec3(clamp(totalBias * 100.0, 0.0, 1.0)), color.a);
	            } else if (shadowDebugMode == 6.0) {
	                color = vec4(vec3(blockerDepth >= 0.0 ? blockerDepth : 1.0), color.a);
	            } else if (shadowDebugMode == 7.0) {
	                color = vec4(vec3(filterRadius / max(float(r), 1.0)), color.a);
	            } else if (shadowDebugMode == 8.0) {
	                color = vec4(vec3(visibility), color.a);
	            } else {
	                // Shadows attenuate lit colour but must not dim the surface
	                // below the indirect floor resolved by the active shading path.
                // The floor is deliberately separate from g_ambient so PBR/IBL
                // receivers do not wash out shadows just because normals are
                // present.
                color = vec4(max(color.rgb * shadowFactor, g_shadowFloor), color.a);
            }
	        } else if (shadowDebugMode > 0.5) {
	            color = shadowDebugMode == 2.0 ? vec4(0.0, 0.0, 1.0, color.a) : vec4(vec3(1.0), color.a);
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
    this._fragSrcBuf.push(
      "in vec3 vWorldPos;",
      "flat in uint vClippable;",
      // Section-plane bank. `uSectionPlaneCount` is the
      // number of active planes, packed at the front of
      // `uSectionPlanes`. The shader is compiled with a
      // fixed `MAX_SECTION_PLANES` constant — the program
      // never recompiles when planes are created or
      // destroyed; the renderer just updates the uniform
      // count + array contents per frame.
      `const int MAX_SECTION_PLANES = ${MAX_SECTION_PLANES};`,
      // Plane equation packed as (normal.xyz, d), where
      // `dot(normal, point) + d > 0` ⇒ point is on the
      // clipped side and the fragment is discarded. Storing
      // the constant `d` rather than a point lets the FS
      // run a single dot+add per plane.
      "uniform vec4 uSectionPlanes[MAX_SECTION_PLANES];",
      "uniform int  uSectionPlaneCount;",
    );
  }

  /**
   * Discards the fragment if any active section plane clips
   * it. The test is short-circuited two ways for performance —
   *
   *   1. `vClippable == 0u` skips the loop entirely for meshes
   *      that opted out of clipping (always-visible labels,
   *      anchor markers, etc.). The branch is on a flat
   *      varying — uniform-coherent across a triangle, so the
   *      GPU sees it as a single test per triangle.
   *
   *   2. `uSectionPlaneCount == 0` skips the loop when no
   *      planes are active. Branch is on a uniform, so all
   *      scenes without active clipping pay one compare and
   *      zero iterations.
   *
   * Active planes are packed at indices `0..count-1`, so the
   * loop bound is uniform and the compiler can emit straight-
   * line code rather than per-iteration active-flag tests.
   */
  protected fsSlicingLogic() {
    this._fragSrcBuf.push(`
    if (vClippable != 0u && uSectionPlaneCount > 0) {
      for (int i = 0; i < uSectionPlaneCount; i++) {
        if (dot(uSectionPlanes[i].xyz, vWorldPos) + uSectionPlanes[i].w > 0.0) {
          discard;
        }
      }
    }`);
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
    const unit = rc.textureUnit;
    const texture = dataTexture.texture;
    rc.bindTexture2D(unit, texture);
    gl.uniform1i(sampler, unit);
    rc.textureUnit = (unit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;
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
    const unit = rc.textureUnit;
    rc.bindCubemapTexture(unit, texture);
    gl.uniform1i(sampler, unit);
    rc.textureUnit = (unit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;
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

    const canCacheViewUniforms = !this.hasUVs && !this.triplanar;
    const uploadViewUniforms = !canCacheViewUniforms || this._viewUniformFrameId !== renderContext.uniformFrameId;
    if (uploadViewUniforms) {
      this._uploadViewStableUniforms(renderPass);
      if (canCacheViewUniforms) {
        this._viewUniformFrameId = renderContext.uniformFrameId;
      }
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

    if (uniforms.silhouetteColor) {
      if (this.edges) {
        const material = view.effects.edges;
        const color = material.edgeColor;
        gl.uniform4f(uniforms.silhouetteColor, color[0], color[1], color[2], material.edgeAlpha);
      } else {
        gl.uniform4fv(uniforms.silhouetteColor, defaultColor);
      }
    }

    // Base-edges "use mesh colour" mode. Only the base edges pass honours it —
    // Style-bin edges keep their configured color, and every
    // fill pass keeps mode off — so the shader's mesh-colour branch is gated to
    // exactly that one case.
    if (uniforms.edgeColorMode) {
      const e = view.effects.edges;
      const baseEdgesPass = this.edges
        && renderPass !== RENDER_PASSES.STYLE_BIN_OPAQUE
        && renderPass !== RENDER_PASSES.STYLE_BIN_TRANSPARENT;
      gl.uniform1f(uniforms.edgeColorMode, (baseEdgesPass && e.useMeshColor) ? 1 : 0);
      if (uniforms.edgeDarken) {
        gl.uniform1f(uniforms.edgeDarken, e.edgeDarken);
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
    if (uniforms.saoDebugMode) {
      gl.uniform1f(uniforms.saoDebugMode, getSAODebugModeId(view.effects.sao.debug));
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
    if (uniforms.shadowSoftParams) {
      gl.uniform4fv(uniforms.shadowSoftParams, renderContext.shadowSoftParams);
    }
    if (uniforms.shadowCascadeDepthRanges) {
      gl.uniform1fv(uniforms.shadowCascadeDepthRanges, renderContext.shadowCascadeDepthRanges);
    }
    if (uniforms.shadowCascadeTexelSizes) {
      gl.uniform1fv(uniforms.shadowCascadeTexelSizes, renderContext.shadowCascadeTexelSizes);
    }
    if (uniforms.shadowPcfRadius) {
      gl.uniform1i(uniforms.shadowPcfRadius, getShadowPcfRadius(view.effects.shadows?.pcfKernelSize, 1));
    }
    if (uniforms.shadowSlope) {
      // (dirViewX, dirViewY, dirViewZ, slopeBias)
      const d = renderContext.shadowLightDirView;
      const slopeBias = Number.isFinite(Number(view.effects.shadows?.slopeBias)) ? Number(view.effects.shadows?.slopeBias) : 0.00125;
      gl.uniform4f(uniforms.shadowSlope,
        d[0], d[1], d[2],
        view.effects.shadows ? slopeBias : 0.0);
    }
    return true;
  }

  private _uploadViewStableUniforms(renderPass: RenderPassValue): void {
    const view = this._renderContext.activeView;
    const gl = this._renderContext.gl;
    const uniforms = this._uniforms;
    const renderContext = this._renderContext;

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

    if (uniforms.logDepthCoef) {
      // Coefficient `Fcoef = 2 / log2(far + 1)` — same form Cesium
      // and Three.js use for logarithmic depth. Read the camera's
      // own far plane so a per-View override on the projection
      // (the archipelago example sets far = 90 000) feeds through
      // automatically. Default far stays around 2000 for typical
      // BIM scenes, which is fine.
      const far = view.camera.perspectiveProjection.far;
      gl.uniform1f(uniforms.logDepthCoef, 2.0 / Math.log2(far + 1.0));
    }

    if (uniforms.drawingBufferSize) {
      gl.uniform2f(uniforms.drawingBufferSize, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }

    if (uniforms.lineWidth) {
      // Thick *edges* take their width from the edges effect; thick
      // *lines* from `linesMaterial`. Default 1 keeps both visually
      // close to the legacy `gl.LINES` path (single-pixel core + 1-pixel
      // smoothstep AA at the edges).
      const width = this.edges
        ? (view.effects.edges?.edgeWidth ?? 1.0)
        : (view.linesMaterial?.lineWidth ?? 1.0);
      gl.uniform1f(uniforms.lineWidth, width);
    }

    if (uniforms.lineJoinRound) {
      // View-level join-style toggle: 0 = miter (default — sharp
      // bisector-extended joints), 1 = round (each joined side
      // is rendered as a round cap, so two neighbouring caps
      // overlap to form a disc-shaped joint).
      gl.uniform1i(uniforms.lineJoinRound,
        view.linesMaterial?.joinStyle === "round" ? 1 : 0);
    }

    if (uniforms.linePatternLen) {
      // Dash / gap pattern, expressed in line-width units. Only
      // the colour-pass thick-line FS declares these uniforms —
      // pick / snap pretend the line is continuous so the user
      // can still click and snap inside gap regions, matching
      // engineering CAD packages where a dashed centreline is
      // still snappable along its whole length.
      const lm = view.linesMaterial;
      const len = lm ? lm._linePatternUniformLen : 0;
      gl.uniform1i(uniforms.linePatternLen, len);
      if (len > 0) {
        if (uniforms.linePattern) {
          gl.uniform1fv(uniforms.linePattern, lm!._linePatternUniformEntries);
        }
        if (uniforms.linePatternPeriod) {
          gl.uniform1f(uniforms.linePatternPeriod, lm!._linePatternUniformPeriod);
        }
      }
    }

    if (uniforms.sectionPlaneCount) {
      // Pack the View's active section planes into the uniform array as
      // (normal.xyz, dist) per plane (see packSectionPlanes). Active planes
      // densely fill `uSectionPlanes[0..count-1]` so the FS loop bound is
      // uniform; inactive entries leave stale memory the shader never reads.
      //
      // Per-frame cost: at most MAX_SECTION_PLANES (8) × 4 floats = 128 bytes
      // of upload, plus one int upload. Scenes with no clipping pay just the
      // int compare.
      const buf = SECTION_PLANE_SCRATCH;
      const count = packSectionPlanes(view.sectionPlanesList, buf);
      gl.uniform1i(uniforms.sectionPlaneCount, count);
      if (count > 0 && uniforms.sectionPlanes) {
        gl.uniform4fv(uniforms.sectionPlanes, buf);
      }
    }

    if (uniforms.lightAmbient) {
      gl.uniform4fv(uniforms.lightAmbient, <any>getAmbientColorAndIntensity(view));
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
    // and Cook-Torrance shading branches read this. Prefer the View's legacy
    // DirLight list; fall back to the shadow direction/default when no
    // directional light is registered.
    if (uniforms.primaryLightDirView) {
      const primaryLight = getPrimaryDirectionalLight(view);
      const sd: any = primaryLight ? primaryLight.dir : ((view.effects.shadows && view.effects.shadows.direction) ? view.effects.shadows.direction : defaultPrimaryLightDir);
      const sdLen = Math.hypot(sd[0], sd[1], sd[2]) || 1.0;
      const sx = sd[0] / sdLen, sy = sd[1] / sdLen, sz = sd[2] / sdLen;
      const vm = view.camera.viewMatrix;
      const transformToView = !primaryLight || primaryLight.space === "world";
      const lvx = transformToView ? vm[0] * sx + vm[4] * sy + vm[8]  * sz : sx;
      const lvy = transformToView ? vm[1] * sx + vm[5] * sy + vm[9]  * sz : sy;
      const lvz = transformToView ? vm[2] * sx + vm[6] * sy + vm[10] * sz : sz;
      const llen = Math.sqrt(lvx * lvx + lvy * lvy + lvz * lvz) || 1.0;
      gl.uniform3f(uniforms.primaryLightDirView, lvx / llen, lvy / llen, lvz / llen);
    }

    // Cubemap IBL multiplier — gates the prefiltered-cubemap diffuse +
    // specular contribution. Zero when IBL is disabled or unavailable; the
    // shader's iblScale=0 path collapses the cubemap term to nothing without
    // recompiling.
    if (uniforms.iblIntensity) {
      const ibl = (view as any).lights?.ibl;
      const iblActive = !!(ibl && ibl.applied && ibl.possible);
      const intensity = iblActive ? ibl.intensity : 0.0;
      gl.uniform1f(uniforms.iblIntensity, intensity);
    }

    // Analytical hemisphere ambient — sky/ground/up plus an intensity,
    // independent of the cubemap path so non-IBL profiles can still
    // get directional fill. Zero when hemispheric lighting is disabled
    // or unavailable.
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

    // Bind up to three directional lights for direct shading.
    // Keep the binding generic here so we do not need concrete light class imports.
    const lights = <any[]>(((view as any).lightsList) || []);
    let lightIndex = 0;
    for (let i = 0; i < lights.length && lightIndex < 3; i++) {
      const light = lights[i];
      if (!isDirectionalLight(light)) {
        continue;
      }
      const dirLoc = uniforms.lightDir[lightIndex];
      const colorLoc = uniforms.lightColor[lightIndex];
      const sd: any = light.dir;
      const sdLen = Math.hypot(sd[0], sd[1], sd[2]) || 1.0;
      const sx = sd[0] / sdLen, sy = sd[1] / sdLen, sz = sd[2] / sdLen;
      const vm = view.camera.viewMatrix;
      const transformToView = light.space === "world";
      const lvx = transformToView ? vm[0] * sx + vm[4] * sy + vm[8]  * sz : sx;
      const lvy = transformToView ? vm[1] * sx + vm[5] * sy + vm[9]  * sz : sy;
      const lvz = transformToView ? vm[2] * sx + vm[6] * sy + vm[10] * sz : sz;
      const llen = Math.sqrt(lvx * lvx + lvy * lvy + lvz * lvz) || 1.0;
      if (dirLoc) {
        gl.uniform3f(dirLoc, lvx / llen, lvy / llen, lvz / llen);
      }
      if (colorLoc) {
        gl.uniform4f(colorLoc, light.color[0], light.color[1], light.color[2], getLightIntensity(light));
      }
      lightIndex++;
    }
    for (; lightIndex < 3; lightIndex++) {
      const dirLoc = uniforms.lightDir[lightIndex];
      const colorLoc = uniforms.lightColor[lightIndex];

      if (dirLoc) {
        gl.uniform3f(dirLoc, 0.0, 1.0, 1.0);
      }

      if (colorLoc) {
        gl.uniform4f(colorLoc, 0.0, 0.0, 0.0, 0.0);
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
    // Bound through a wrapper without exposing the handle, so force any later
    // tracked bind on this unit to re-issue.
    renderContext.invalidateTextureBinding(unit);
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
      // Wrapper bind, handle unknown to the per-unit tracking.
      renderContext.invalidateTextureBinding(unit);
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
