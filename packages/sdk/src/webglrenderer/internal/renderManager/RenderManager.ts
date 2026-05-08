import {WEBGL_INFO} from "../../../webglutils";
import {type RenderContext} from "../RenderContext";
import {type MeshManager} from "../meshManager/MeshManager";
import {type DrawOps, getDrawOps, putDrawOps} from "../drawOps/DrawOps";
import {type ViewRenderState} from "../ViewRenderState";
import {type GPUMemoryReader} from "../gpuMemoryManager/GPUMemoryReader";
import {type MeshBatch} from "../meshManager/MeshBatch";
import {SDKInternalException, type SDKResult} from "../../../core";
import {RENDER_BINS} from "../RENDER_BINS";
import {type RenderPassDrawOps} from "../drawOps/RenderPassDrawOps";
import {InfiniteGridRenderer} from "./environment/InfiniteGridRenderer";
import {SkyRenderer} from "./environment/SkyRenderer";
import {SAOPipeline} from "./sao/SAOPipeline";
import {ShadowPipeline} from "./shadows/ShadowPipeline";
import {PostProcessChain} from "./postprocess/PostProcessChain";
import {BRDFLUTTexture} from "./ibl/BRDFLUTTexture";
import {IBLPrefilter, type SkyParams} from "./ibl/IBLPrefilter";
import {RenderBinClassifier, type RenderBins} from "./RenderBinClassifier";
import type {RenderInspector} from "../inspectors/RenderInspector";


/**
 * Set of WebGL extension handles whose activation is gated by feature flags.
 *
 * Held as references on the manager only to keep the handles alive for the
 * lifetime of the renderer; their behaviour is registered with the GL
 * context at `getExtension` time.
 *
 * @internal
 */
interface ExtensionHandles {
  OES_element_index_uint?: any;
  WEBGL_depth_texture?: any;
  EXT_color_buffer_float?: any;
}


/**
 * Renders mesh batches.
 *
 * Owned by a {@link ViewManager}.
 *
 * `RenderManager` is responsible for:
 * - Translating {@link MeshBatch} state into concrete WebGL draw calls
 * - Managing GPU state (depth, blending, culling) across render phases
 * - Executing multi-pass rendering (opaque, transparent, edges, x-ray, highlight, selection)
 * - Binding draw programs via {@link DrawOps}
 *
 * ### Rendering model
 * Rendering is performed in phases:
 * 1. Opaque geometry
 * 2. Opaque edges
 * 3. X-ray / highlighted / selected silhouettes (opaque)
 * 4. Transparent geometry & edges (with blending)
 * 5. X-ray / highlighted / selected silhouettes (transparent)
 *
 * Meshes are grouped into bins per phase to ensure correct ordering and
 * minimal GPU state changes.
 *
 * @remarks
 * - Uses a shared {@link DrawOps} pool to reduce shader/program churn.
 * - GPU state cleanup is performed explicitly at the end of each render.
 *
 * @internal
 */
/**
 * Coerces a possibly-{@link Vec3} (Float32Array, plain array, etc.) into
 * a fresh `[r, g, b]` triple, falling back to the supplied default when
 * the source is `undefined` or too short. Used by the IBL prep block to
 * ferry colour values from `view.lights.ibl` into the prefilter pipeline.
 */
function arrTriple(src: any, fallback: [number, number, number]): [number, number, number] {
  if (src && src.length >= 3) return [src[0], src[1], src[2]];
  return [fallback[0], fallback[1], fallback[2]];
}

export class RenderManager {

  /** Number of texture units bound per draw call by {@link DrawTechnique._bindTexture}. */
  private static readonly _MAX_DATA_TEXTURE_UNITS = 10;

  /**
   * Active drawing operations (shader programs + draw routines).
   *
   * Populated during {@link init} and returned to the pool during {@link destroy}.
   *
   * Used internally, but made public to support diagnostics and testing.
   */
  public drawOps: DrawOps;

  /**
   * Infinite ground grid renderer. Set {@link InfiniteGridRenderer.enabled} to true to activate.
   */
  public infiniteGrid: InfiniteGridRenderer;

  /** Pre-allocated render bins, reused every frame to avoid per-frame array allocation. */
  private readonly _bins: RenderBins = {
    normalDrawOpaque: [],
    normalDrawSAO: [],
    normalDrawShadow: [],
    normalDrawSAOShadow: [],
    normalEdgesOpaque: [],
    normalFillTransparent: [],
    normalEdgesTransparent: [],
    xrayedSilhouetteOpaque: [],
    xrayEdgesOpaque: [],
    xrayedSilhouetteTransparent: [],
    xrayEdgesTransparent: [],
    highlightedSilhouetteOpaque: [],
    highlightedEdgesOpaque: [],
    highlightedSilhouetteTransparent: [],
    highlightedEdgesTransparent: [],
    selectedSilhouetteOpaque: [],
    selectedEdgesOpaque: [],
    selectedSilhouetteTransparent: [],
    selectedEdgesTransparent: [],
  };

  /** Sorts mesh batches into {@link _bins} once per frame. Stateless helper. */
  private readonly _binClassifier = new RenderBinClassifier();

  /**
   * Sky/environment renderer.
   */
  public skyRenderer: SkyRenderer;

  /** Owns the SAO depth → AO → blur sequence. */
  private _saoPipeline: SAOPipeline;

  /** Owns the shadow light-VP computation and shadow-map depth pass. */
  private _shadowPipeline: ShadowPipeline;

  /**
   * Owns the HDR substrate and the entire post-process chain (bloom →
   * tonemap → FXAA → canvas). Inert when HDR isn't available; the scene
   * draws straight to the canvas in that case.
   */
  private _postProcess: PostProcessChain;

  /** Shared BRDF LUT for the split-sum specular IBL approximation. */
  private _brdfLUT: BRDFLUTTexture | null = null;

  /**
   * One IBL prefilter pipeline per view (each carries its own sky
   * cubemap because each view has independent IBL params and shadow
   * direction). Indexed by viewIndex.
   */
  private _iblPrefilters: Map<number, IBLPrefilter> = new Map();

  /** Cached signature of last-applied sky params per view, for dirty detection. */
  private _iblParamSignatures: Map<number, string> = new Map();

  /** Last-seen `view.lights.ibl.environmentVersion` per view, so the prefilter
   *  only re-uploads its equirect texture when the image actually changes. */
  private _iblEnvVersions: Map<number, number> = new Map();

  /** Shared render context (WebGL state + global flags). */
  private _renderContext: RenderContext;

  /** Provides access to mesh batches and render-pass classification. */
  private _meshManager: MeshManager;

  /** WebGL extension handles enabled for this renderer. */
  private _extensionHandles: ExtensionHandles | null = null;

  /** Read-only interface into GPU memory (geometry, attributes, indices). */
  private _gpuMemoryReader: GPUMemoryReader;


  /**
   * Creates a {@link RenderManager}.
   *
   * @param cfg.renderContext - Shared render context (WebGL state, flags, configs).
   * @param cfg.gpuMemoryReader - Read-only access to GPU memory.
   * @param cfg._meshManager - Provides sorted mesh batches and render-pass queries.
   */
  constructor(cfg: {
    renderContext: RenderContext,
    gpuMemoryReader: GPUMemoryReader,
    meshManager: MeshManager
  }) {
    this._renderContext = cfg.renderContext;
    this._gpuMemoryReader = cfg.gpuMemoryReader;
    this._meshManager = cfg.meshManager;
  }

  /**
   * Initializes draw operations and activates supported WebGL extensions.
   *
   * @returns {@link SDKResult} indicating success or failure.
   *
   * @remarks
   * - Must be called before {@link render}
   * - Draw operations are pooled; this may reuse previously created programs
   */
  public init(): SDKResult<void> {
    if (!this.drawOps) {
      const result = getDrawOps(this._renderContext, this._gpuMemoryReader);
      if (result.ok === false) {
        return result;
      }
      this.drawOps = result.value;
    }

    this._extensionHandles = {};
    this._activateExtensions();

    if (!this.infiniteGrid) {
      this.infiniteGrid = new InfiniteGridRenderer(this._renderContext.gl, {
        minorColor: [0.36, 0.40, 0.42],
        majorColor: [0,0,0],
        xAxisColor: [0.68, 0.42, 0.40],
        zAxisColor: [0.40, 0.58, 0.70]
      });
      const gridResult = this.infiniteGrid.init();
      if (gridResult.ok === false) {
        this.infiniteGrid = null;
        return gridResult;
      }
    }

    if (!this.skyRenderer) {
      this.skyRenderer = new SkyRenderer(this._renderContext.gl, {
        skyColor: [0.74, 0.80, 0.88],
        horizonColor: [0.66, 0.72, 0.74],
        horizonBlend: 0.5,
        groundColor: [0.58, 0.64, 0.60]
      });
      const skyResult = this.skyRenderer.init();
      if (skyResult.ok === false) {
        this.skyRenderer = null;
        return skyResult;
      }
    }

    if (!this._saoPipeline) {
      this._saoPipeline = new SAOPipeline(this._renderContext);
    }
    const saoResult = this._saoPipeline.init();
    if (saoResult.ok === false) {
      // Clean up the partially-constructed pipeline so destroy() and retries
      // don't observe an unusable instance.
      this._saoPipeline.destroy();
      this._saoPipeline = null;
      return saoResult;
    }

    if (!this._shadowPipeline) {
      this._shadowPipeline = new ShadowPipeline(this._renderContext);
    }
    const shadowResult = this._shadowPipeline.init();
    if (shadowResult.ok === false) {
      this._shadowPipeline.destroy();
      this._shadowPipeline = null;
      return shadowResult;
    }

    // Post-process chain owns the HDR substrate (RGBA16F target) and every
    // pass between scene-rendering and the canvas: bloom, tonemap, FXAA. It
    // self-degrades if HDR isn't supported, so init never fails the renderer.
    if (!this._postProcess) {
      this._postProcess = new PostProcessChain(this._renderContext);
    }
    this._postProcess.init();

    // Split-sum BRDF integration LUT — generated once, shared across views.
    // Per-view IBL prefilter pipelines are created lazily in _renderScene
    // when a view first asks for IBL.
    if (!this._brdfLUT) {
      this._brdfLUT = new BRDFLUTTexture(this._renderContext.gl);
      const lutResult = this._brdfLUT.allocate();
      if (lutResult.ok === false) {
        this._brdfLUT = null;
        return lutResult;
      }
    }

    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Refreshes the active view's IBL prefilter pipeline (sky cubemap +
   * irradiance + prefiltered specular) and publishes the resulting
   * texture handles plus the view-to-world rotation matrix on the
   * shared RenderContext so the BRDF technique can bind them.
   *
   * Cheap when params haven't changed — the prefilter dirty-checks
   * itself by signature and only re-renders when sky/sun/up moves.
   */
  private _prepareIBL(view: import("../../../viewer").View): void {
    if (!this._brdfLUT) return; // BRDF LUT init failed earlier; soft-disable.
    // Effect activation is gated entirely by `applied` — when the
    // current View.renderMode isn't in IBL.renderModes we skip the
    // prefilter refresh, sky-param build, and cubemap publish, and let
    // the BRDF's iblIntensity=0 path produce a zero contribution. As
    // soon as renderMode flips back into the list, the next call here
    // notices its dirty signature and re-renders the cubemap chain.
    if (!view.lights.ibl.applied || !view.lights.ibl.possible) return;
    const rc = this._renderContext;
    const viewIndex = view.viewIndex;

    let pipeline = this._iblPrefilters.get(viewIndex);
    if (!pipeline) {
      // HDR cubemaps require EXT_color_buffer_float — already activated in
      // `_activateExtensions`. Without it we silently fall back to RGBA8.
      const hdr = !!(this._extensionHandles && this._extensionHandles.EXT_color_buffer_float);
      pipeline = new IBLPrefilter(rc.gl, this._brdfLUT, { hdr });
      const allocResult = pipeline.allocate();
      if (allocResult.ok === false) {
        // Logged once and the view simply doesn't get IBL; the BRDF
        // shader's null-cubemap path falls back to no IBL contribution.
        console.warn(`[RenderManager] IBL prefilter alloc failed for view ${viewIndex}: ${allocResult.error}`);
        return;
      }
      this._iblPrefilters.set(viewIndex, pipeline);
    }

    // Sync user-supplied equirectangular environment image (if any).
    // The IBL component bumps `environmentVersion` each time the image
    // or HDR slot changes; we re-upload only on a version mismatch.
    // HDR takes priority over LDR; clearing both reverts the prefilter
    // to the procedural sky path.
    const iblComp: any = (view as any).lights?.ibl;
    const envVersion = iblComp ? (iblComp.environmentVersion as number) : 0;
    if (this._iblEnvVersions.get(viewIndex) !== envVersion) {
      const envHDR = iblComp ? iblComp.environmentHDR : undefined;
      const envImage = iblComp ? iblComp.environmentImage : undefined;
      if (envHDR) {
        const r = pipeline.setEnvironmentEquirectHDR(envHDR.data, envHDR.width, envHDR.height);
        if (r.ok === false) {
          console.warn(`[RenderManager] IBL setEnvironmentEquirectHDR failed for view ${viewIndex}: ${r.error}`);
        }
      } else if (envImage) {
        const r = pipeline.setEnvironmentEquirect(envImage as TexImageSource);
        if (r.ok === false) {
          console.warn(`[RenderManager] IBL setEnvironmentEquirect failed for view ${viewIndex}: ${r.error}`);
        }
      } else {
        pipeline.clearEnvironmentEquirect();
      }
      this._iblEnvVersions.set(viewIndex, envVersion);
    }

    // Build sky params from the view's hemisphere ambient colours and
    // shadow direction. The sky/ground/up colours live on
    // `view.lights.hemispheric` (shared with the analytical hemisphere
    // term) so the procedural cubemap and the cheap fallback agree on
    // what "the sky" looks like. The sun direction comes from
    // `view.effects.shadows.direction`, negated to get "direction toward the
    // sun" — matches what the procedural sky expects.
    const hemi: any = (view as any).lights?.hemispheric;
    const shadowDir = view.effects.shadows && view.effects.shadows.direction
      ? view.effects.shadows.direction
      : [-0.45, -0.35, -0.80];
    const sunToward: [number, number, number] = [-shadowDir[0], -shadowDir[1], -shadowDir[2]];
    // Build a horizon colour that's distinctly brighter than either sky
    // or ground — the contrast between zenith / horizon / ground is what
    // makes specular reflections on curved metals look interesting.
    // Without a richer horizon band, smooth metals just reflect a flat
    // disk of zenith colour.
    const skyZenith = arrTriple(hemi?.skyColor, [0.62, 0.72, 0.86]);
    const groundC   = arrTriple(hemi?.groundColor, [0.42, 0.36, 0.30]);
    const horizon: [number, number, number] = [
      Math.min(1, skyZenith[0] * 0.55 + 0.40),
      Math.min(1, skyZenith[1] * 0.55 + 0.40),
      Math.min(1, skyZenith[2] * 0.55 + 0.40)
    ];
    // Sun brightness scales with the cubemap's HDR capability. With
    // RGBA16F we can stamp a genuinely-bright sun (~12× sky luminance,
    // visually bright enough to drive the ACES tonemap into highlight
    // bloom on smooth metal reflections). RGBA8 clamps everything to 1
    // — keep sun close to 1 to avoid wholesale clipping at the disk.
    const hdrPipeline = pipeline.hdr;
    const sunColor: [number, number, number] = hdrPipeline
      ? [12.0, 11.0, 8.5]   // HDR: punchy yellow-white sun
      : [1.5, 1.45, 1.20];  // LDR: just brighter than sky
    const sky: SkyParams = {
      skyColor: skyZenith,
      horizonColor: horizon,
      groundColor: groundC,
      horizonBlend: 0.25,
      sunEnabled: true,
      sunDirection: sunToward,
      sunColor,
      sunAngularSizeDegrees: 4.0,
      sunGlowSize: 8.0,
      sunGlowIntensity: hdrPipeline ? 4.5 : 1.4,
      worldUp: arrTriple(hemi?.worldUp, [0, 0, 1])
    };
    // Dirty-detect via a cheap string signature so we don't repeatedly
    // re-render an unchanged sky.
    const signature = JSON.stringify(sky);
    if (this._iblParamSignatures.get(viewIndex) !== signature) {
      pipeline.setParams(sky);
      this._iblParamSignatures.set(viewIndex, signature);
    }

    const refreshResult = pipeline.refresh();
    if (refreshResult.ok === false) {
      console.warn(`[RenderManager] IBL refresh failed for view ${viewIndex}: ${refreshResult.error}`);
      return;
    }

    // Publish handles + view-to-world rotation for the BRDF binder.
    rc.iblIrradianceCubemap = pipeline.irradianceCubemap;
    rc.iblPrefilteredCubemap = pipeline.environmentCubemap;
    rc.iblBRDFLUT = this._brdfLUT.texture;
    rc.iblMaxSpecularMipLevel = pipeline.maxSpecularMipLevel;
    // Transpose of the view matrix's upper-left 3×3 == inverse rotation
    // (assumes orthonormal view rotation, which xeokit's camera always
    // produces). Column-major mat3 layout for `gl.uniformMatrix3fv`.
    const vm = view.camera.viewMatrix;
    const m = rc.iblViewToWorldRot;
    m[0] = vm[0]; m[1] = vm[4]; m[2] = vm[8];
    m[3] = vm[1]; m[4] = vm[5]; m[5] = vm[9];
    m[6] = vm[2]; m[7] = vm[6]; m[8] = vm[10];
  }

  /** Binds the main colour target for the scene phase (HDR FBO or canvas). */
  private _bindSceneTarget(): void {
    const rc = this._renderContext;
    const w = rc.sceneRenderWidth || rc.gl.drawingBufferWidth;
    const h = rc.sceneRenderHeight || rc.gl.drawingBufferHeight;
    this._postProcess.bindSceneTarget(w, h);
  }

  /**
   * Iterates a bin, dispatching each batch to `drawOps[primitive][opKey]`.
   * Optional `renderBinId` runs the inspector hook (early-exits when the
   * bin is disabled, fires `renderBinStarted` when enabled).
   *
   * Collapses the dozen-plus `bins.X.forEach(b => drawOps[b.primitive].Y?.drawBatch(b))`
   * sites that previously littered the render method.
   */
  private _drawBin(batches: ReadonlyArray<MeshBatch>, opKey: keyof RenderPassDrawOps, renderBinName?: string): void {
    if (renderBinName !== undefined) {
      const ri = this._inspector();
      if (ri) {
        if (!ri.getRenderBinEnabled(renderBinName)) return;
        ri.renderBinStarted(renderBinName);
      }
    }
    const drawOps = this.drawOps.prims;
    for (let i = 0; i < batches.length; i++) {
      const ops = drawOps[batches[i].primitive];
      if (!ops) continue;
      ops[opKey]?.drawBatch(batches[i]);
    }
  }

  /**
   * Returns the active render inspector iff one is attached and currently
   * enabled — otherwise `null`. Centralises the `?.enabled &&` check that
   * every inspector call site previously had to repeat.
   */
  private _inspector(): RenderInspector | null {
    const ri = this._renderContext.renderInspector;
    return ri && ri.enabled ? ri : null;
  }

  /**
   * Reinitializes everything that holds GL state after a context restore.
   *
   * Context loss invalidates every GPU resource — programs, textures,
   * framebuffers, renderbuffers — across the whole renderer. `drawOps`
   * has its own in-place restore hook (the program pool is shared, so it
   * needs to recompile rather than be reconstructed); everything else
   * (sky, grid, SAO pipeline, shadow pipeline, post-process chain) is
   * torn down and re-initialised through {@link init} so each owner
   * walks back through its own lazy-construction path with a fresh GL
   * context.
   */
  webglContextRestored(): SDKResult<void> {
    if (this.drawOps) {
      const result = this.drawOps.webglContextRestored();
      if (result.ok === false) return result;
    }

    this.skyRenderer?.destroy();
    this.skyRenderer = null;
    this.infiniteGrid?.destroy();
    this.infiniteGrid = null;
    this._saoPipeline?.destroy();
    this._saoPipeline = null;
    this._shadowPipeline?.destroy();
    this._shadowPipeline = null;
    this._postProcess?.destroy();
    this._postProcess = null;

    return this.init();
  }

  private _activateExtensions() {
    const gl = this._renderContext.gl;
    const handles = this._extensionHandles!;
    if (WEBGL_INFO.SUPPORTED_EXTENSIONS["OES_element_index_uint"]) {
      handles.OES_element_index_uint = gl.getExtension("OES_element_index_uint");
    }
    if (WEBGL_INFO.SUPPORTED_EXTENSIONS["WEBGL_depth_texture"]) {
      handles.WEBGL_depth_texture = gl.getExtension("WEBGL_depth_texture");
    }
    // Required for RGBA16F colour attachments on the HDR target.
    // If unavailable, HDRRenderTarget.init() returns an error and we fall back to LDR.
    if (WEBGL_INFO.SUPPORTED_EXTENSIONS["EXT_color_buffer_float"]) {
      handles.EXT_color_buffer_float = gl.getExtension("EXT_color_buffer_float");
    }
  }

  /**
   * Renders a single {@link ViewRenderState}.
   *
   * This method:
   * - Configures global WebGL state
   * - Classifies mesh batches into render bins
   * - Executes multi-pass rendering in correct order
   * - Cleans up GPU state after rendering
   *
   * @param rendererView - Renderer-side state for the target view.
   * @param options.clear - Whether to clear color/depth buffers before rendering.
   *
   * @throws {@link SDKInternalException} If called before {@link init}.
   */
  public render(
    rendererView: ViewRenderState,
    options: {
      clear: boolean;
    }): SDKResult<any> {

    if (!this.drawOps) {
      throw new SDKInternalException("[RenderManager.render] RenderManager not initialized");
    }

    const {view} = rendererView;
    const inspector = this._inspector();

    inspector?.frameStarted(view);

    this._beginFrame(rendererView);
    this._classifyBatches(view);
    this._renderScene(rendererView, options);
    this._endFrame();
    this._postProcess.composite(view);

    inspector?.frameEnded();

    return {ok: true, value: undefined};
  }

  // ------------------------------------------------------------------
  // Frame lifecycle: begin → classify → render → end → composite.
  //
  // Each phase is intentionally narrow:
  //   - _beginFrame: scene-render size, GL state, scene target.
  //   - _classifyBatches: bin sort (delegated to RenderBinClassifier).
  //   - _renderScene: SAO/shadow prep, opaque, edges, silhouettes, transparents.
  //   - _endFrame: tear down scene-phase GL state.
  //   - _postProcess.composite: bloom + tonemap + FXAA → canvas.
  // ------------------------------------------------------------------

  /** Sets up scene-phase GL state and binds the target the scene draws into. */
  private _beginFrame(rendererView: ViewRenderState): void {
    const renderContext = this._renderContext;
    const gl = renderContext.gl;
    const view = rendererView.view;

    const resolutionScale = view.resolutionScale.applied ? view.resolutionScale.resolutionScale : 1.0;
    renderContext.webglCanvasElement.width = Math.floor(gl.drawingBufferWidth * resolutionScale);
    renderContext.webglCanvasElement.height = Math.floor(gl.drawingBufferHeight * resolutionScale);

    renderContext.reset();
    renderContext.activeView = view;
    renderContext.pbrEnabled = false;

    // Scene render size: canvas × tonemap.renderScale when HDR is on
    // (supersampling); plain canvas size otherwise.
    const sceneScale = this._postProcess?.hasHDR() ? view.effects.tonemap.renderScale : 1.0;
    const sceneW = Math.max(1, Math.floor(gl.drawingBufferWidth * sceneScale));
    const sceneH = Math.max(1, Math.floor(gl.drawingBufferHeight * sceneScale));
    renderContext.sceneRenderWidth = sceneW;
    renderContext.sceneRenderHeight = sceneH;

    this._bindSceneTarget();

    gl.viewport(0, 0, sceneW, sceneH);
    const bg = view.transparent ? [0, 0, 0, 0] : [...view.backgroundColor, 1];
    gl.clearColor(bg[0], bg[1], bg[2], bg[3]);
    gl.enable(gl.DEPTH_TEST);
    gl.frontFace(gl.CCW);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.lineWidth(1);
    renderContext.lineWidth = 1;

    // Slope-scaled depth offset on filled triangles so coplanar GL_LINES
    // edges naturally win z-test ties (POLYGON_OFFSET_FILL only applies to
    // GL_TRIANGLES). Distance-aware, no far-plane edge poking.
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.0, 1.0);

    // Effect-availability publishing on the render context.
    const drawWithSAO = view.effects.sao.applied && view.effects.sao.possible;
    renderContext.saoOcclusionTexture = drawWithSAO
      ? rendererView.renderBuffers.getRenderBuffer("saoOcclusion", {size: [sceneW, sceneH]})?.getTexture() ?? null
      : null;
    for (let i = 0; i < renderContext.shadowMapTextures.length; i++) {
      renderContext.shadowMapTextures[i] = null;
    }
    renderContext.shadowCascadeCount = 0;
  }

  /** Re-fills {@link _bins} from the current frame's mesh batches. */
  private _classifyBatches(view: import("../../../viewer").View): void {
    const drawWithSAO = view.effects.sao.applied && view.effects.sao.possible;
    const drawWithShadows = view.effects.shadows.applied && view.effects.shadows.possible;
    this._binClassifier.clear(this._bins);
    this._binClassifier.classify({
      meshBatches: this._meshManager.sortedBatches,
      view,
      viewIndex: view.viewIndex,
      bins: this._bins,
      flags: {drawWithSAO, drawWithShadows}
    });
  }

  /**
   * Top-level scene-phase orchestration: sky/grid → SAO+shadow prep →
   * opaque colour → edges → opaque silhouettes → transparents → transparent
   * silhouettes. Each sub-pass is one method call so this body stays readable.
   */
  private _renderScene(rendererView: ViewRenderState, options: { clear: boolean }): void {
    const renderContext = this._renderContext;
    const gl = renderContext.gl;
    const view = rendererView.view;
    const bins = this._bins;

    if (options.clear !== false) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    this.skyRenderer?.render(rendererView);
    this.infiniteGrid?.render(rendererView);

    // IBL prefilter — refreshes the per-view sky cubemap + irradiance +
    // prefiltered specular mip chain when params change. Runs before the
    // BRDF passes so the smooth-shaded technique can sample them.
    this._prepareIBL(view);

    // SAO + shadow prep passes (each runs once per frame, drawing into its
    // own FBO). Both pull their batches from the relevant bin sets.
    const needSAO = bins.normalDrawSAO.length > 0 || bins.normalDrawSAOShadow.length > 0;
    const needShadow = bins.normalDrawShadow.length > 0 || bins.normalDrawSAOShadow.length > 0;
    if (needSAO) {
      this._saoPipeline.render({
        rendererView,
        drawOps: this.drawOps.prims,
        saoBatches: bins.normalDrawSAO,
        comboBatches: bins.normalDrawSAOShadow
      });
    }
    if (needShadow) {
      this._shadowPipeline.render({
        rendererView,
        drawOps: this.drawOps.prims,
        shadowBatches: bins.normalDrawShadow,
        comboBatches: bins.normalDrawSAOShadow
      });
    }

    // Sub-pipelines each bound their own FBOs and unbound to null. Re-bind
    // the scene target and reset the program-id cache before resuming the
    // main scene draw.
    if (needSAO || needShadow) {
      this._bindSceneTarget();
      gl.viewport(0, 0, renderContext.sceneRenderWidth, renderContext.sceneRenderHeight);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      renderContext.lastProgramId = -1;
    }

    // Opaque colour passes — every batch routes to one of these four bins.
    this._drawBin(bins.normalDrawOpaque, "opaque", RENDER_BINS.OPAQUE);
    this._drawBin(bins.normalDrawSAO, "opaqueSAO");
    this._drawBin(bins.normalDrawShadow, "opaqueShadow");
    this._drawBin(bins.normalDrawSAOShadow, "opaqueSAOShadow");

    // Shadow data is no longer needed after the opaque passes.
    for (let i = 0; i < renderContext.shadowMapTextures.length; i++) {
      renderContext.shadowMapTextures[i] = null;
    }
    renderContext.shadowCascadeCount = 0;

    this._drawBin(bins.normalEdgesOpaque, "opaqueEdges", RENDER_BINS.EDGES_OPAQUE);
    this._drawBin(bins.xrayedSilhouetteOpaque, "xrayed", RENDER_BINS.XRAYED_SILHOUETTE_OPAQUE);
    this._drawBin(bins.xrayEdgesOpaque, "xrayedEdges", RENDER_BINS.XRAYED_EDGES_OPAQUE);

    this._renderTransparents();

    gl.disable(gl.CULL_FACE);
    gl.clear(gl.DEPTH_BUFFER_BIT);

    // Always-on-top opaque silhouettes (highlighted/selected). Each edge bin
    // clears the depth buffer first so its lines aren't z-occluded by the
    // silhouette fill we just laid down.
    this._drawBin(bins.highlightedSilhouetteOpaque, "highlighted", RENDER_BINS.HIGHLIGHTED_SILHOUETTE_OPAQUE);
    if (bins.highlightedEdgesOpaque.length) gl.clear(gl.DEPTH_BUFFER_BIT);
    this._drawBin(bins.highlightedEdgesOpaque, "highlightedEdges");
    this._drawBin(bins.selectedSilhouetteOpaque, "selected");
    if (bins.selectedEdgesOpaque.length) gl.clear(gl.DEPTH_BUFFER_BIT);
    this._drawBin(bins.selectedEdgesOpaque, "selectedEdges");

    // Always-on-top transparent silhouettes.
    gl.enable(gl.BLEND);
    this._drawBin(bins.highlightedSilhouetteTransparent, "highlighted", RENDER_BINS.HIGHLIGHTED_SILHOUETTE_TRANSPARENT);
    if (bins.highlightedEdgesTransparent.length) gl.clear(gl.DEPTH_BUFFER_BIT);
    this._drawBin(bins.highlightedEdgesTransparent, "highlightedEdges");
    this._drawBin(bins.selectedSilhouetteTransparent, "selected", RENDER_BINS.SELECTED_SILHOUETTE_TRANSPARENT);
    if (bins.selectedEdgesTransparent.length) gl.clear(gl.DEPTH_BUFFER_BIT);
    this._drawBin(bins.selectedEdgesTransparent, "selectedEdges");
    gl.disable(gl.BLEND);
  }

  /**
   * Transparent block — sets up premultiplied-alpha blending, draws the four
   * transparent bins, then restores depth-write state.
   */
  private _renderTransparents(): void {
    const renderContext = this._renderContext;
    const gl = renderContext.gl;
    const bins = this._bins;

    if (
      !bins.normalFillTransparent.length &&
      !bins.normalEdgesTransparent.length &&
      !bins.xrayedSilhouetteTransparent.length &&
      !bins.xrayEdgesTransparent.length
    ) {
      return;
    }

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    // Premultiplied alpha: fragment shaders emit `(rgb * a, a)`, so source
    // factor is `ONE` (multiplication has already happened in the shader).
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    renderContext.backfaces = false;
    gl.depthMask(false);

    this._drawBin(bins.xrayEdgesTransparent, "xrayedEdges", RENDER_BINS.XRAYED_EDGES_TRANSPARENT);
    this._drawBin(bins.xrayedSilhouetteTransparent, "xrayed", RENDER_BINS.XRAYED_SILHOUETTE_TRANSPARENT);

    if (bins.normalEdgesTransparent.length || bins.normalFillTransparent.length) {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    this._drawBin(bins.normalEdgesTransparent, "transparentEdges", RENDER_BINS.EDGES_TRANSPARENT);
    this._drawBin(bins.normalFillTransparent, "transparent", RENDER_BINS.TRANSPARENT);

    gl.disable(gl.BLEND);
    gl.depthMask(true);
  }

  /** Tears down scene-phase GL state and unbinds the texture units _draw() actually used. */
  private _endFrame(): void {
    const gl = this._renderContext.gl;
    gl.disable(gl.BLEND);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(0.0, 0.0);

    for (let i = 0; i < RenderManager._MAX_DATA_TEXTURE_UNITS; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
  }

  /**
   * @private
   */
  public destroy() {
    if (this.drawOps) {
      putDrawOps(this.drawOps);
      this.drawOps = null;
    }
    if (this.skyRenderer) {
      this.skyRenderer.destroy();
      this.skyRenderer = null;
    }
    if (this._saoPipeline) {
      this._saoPipeline.destroy();
      this._saoPipeline = null;
    }
    if (this._shadowPipeline) {
      this._shadowPipeline.destroy();
      this._shadowPipeline = null;
    }
    if (this._postProcess) {
      this._postProcess.destroy();
      this._postProcess = null;
    }
    if (this.infiniteGrid) {
      this.infiniteGrid.destroy();
      this.infiniteGrid = null;
    }
    for (const pipeline of this._iblPrefilters.values()) {
      pipeline.destroy();
    }
    this._iblPrefilters.clear();
    this._iblParamSignatures.clear();
    if (this._brdfLUT) {
      this._brdfLUT.destroy();
      this._brdfLUT = null;
    }
    this._extensionHandles = null;
    this._renderContext = null;
    this._gpuMemoryReader = null;
  }
}
