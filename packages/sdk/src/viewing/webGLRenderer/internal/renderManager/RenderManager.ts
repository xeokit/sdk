import {WEBGL_INFO} from "../webGL";
import {LinesPrimitive, TrianglesPrimitive} from "../../../../base/constants";
import {type RenderContext} from "../RenderContext";
import {type MeshManager} from "../meshManager/MeshManager";
import {type DrawOps, getDrawOps, putDrawOps} from "../drawOps/DrawOps";
import {type ViewRenderState} from "../ViewRenderState";
import {type GPUMemoryReader} from "../gpuMemoryManager/GPUMemoryReader";
import {type MeshBatch} from "../meshManager/MeshBatch";
import {SDKInternalException, type SDKResult} from "../../../../base/core";
import {RENDER_BINS} from "../RENDER_BINS";
import {type RenderPassDrawOps} from "../drawOps/RenderPassDrawOps";
import {InfiniteGridRenderer} from "./environment/InfiniteGridRenderer";
import {GaussianSplatTechnique} from "../drawOps/techniques/splats/GaussianSplatTechnique";
import {SkyRenderer} from "./environment/SkyRenderer";
import {SAOPipeline} from "./sao/SAOPipeline";
import {ShadowPipeline} from "./shadows/ShadowPipeline";
import {PostProcessChain} from "./postprocess/PostProcessChain";
import {BRDFLUTTexture} from "./ibl/BRDFLUTTexture";
import {IBLPrefilter, type SkyParams} from "./ibl/IBLPrefilter";
import {RenderBinClassifier, type RenderBins} from "./RenderBinClassifier";
import type {RenderInspector} from "../inspectors/RenderInspector";
import {CapPlaneRenderer} from "./sectionPlaneCaps/CapPlaneRenderer";
import type {TrianglesStencilMaskTechnique} from "../drawOps/techniques/triangles/TrianglesStencilMaskTechnique";
import {matrix} from "../../../../base/math";


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

  /**
   * 3D Gaussian Splatting draw pass. Renders the {@link MeshManager}'s splat
   * batch after opaque geometry, depth-sorted + alpha-blended. Null until init.
   */
  public gaussianSplats: GaussianSplatTechnique | null = null;

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
   * tonemap -> final AA -> canvas). Inert when HDR isn't available; the scene
   * draws straight to the canvas in that case.
   */
  private _postProcess: PostProcessChain;

  /**
   * Renders one section-plane cap as a fullscreen triangle masked by
   * the stencil mask laid down by the stencil-mask pass. Created at
   * {@link init}; null if its shader failed to compile (cap pass then
   * stays inert regardless of {@link Effects.sectionPlaneCaps}).
   */
  private _capPlaneRenderer: CapPlaneRenderer | null = null;

  /** Scratch viewProj product for cap rendering. */
  private readonly _capViewProj = new Float32Array(16);

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
   * @param cfg.meshManager - Provides sorted mesh batches and render-pass queries.
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
   * @returns {@link base!core.SDKResult | SDKResult} indicating success or failure.
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

    if (!this.gaussianSplats) {
      this.gaussianSplats = new GaussianSplatTechnique(this._renderContext.gl);
      const splatResult = this.gaussianSplats.init();
      if (splatResult.ok === false) {
        this.gaussianSplats = null;
        return splatResult;
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
    // pass between scene-rendering and the canvas: bloom, tonemap, final AA. It
    // self-degrades if HDR isn't supported, so init never fails the renderer.
    if (!this._postProcess) {
      this._postProcess = new PostProcessChain(this._renderContext);
    }
    this._postProcess.init();

    // Section-plane caps — fullscreen triangle that paints capColor
    // wherever the stencil-mask pass laid down a non-zero count.
    // Compile failure leaves the cap pass inert; the colour pass
    // is unaffected.
    if (!this._capPlaneRenderer) {
      const r = new CapPlaneRenderer(this._renderContext);
      const result = r.init();
      if (result.ok) {
        this._capPlaneRenderer = r;
      } else {
        r.destroy();
      }
    }

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
   * `binFilter` scopes the iteration to batches whose
   * {@link MeshBatch.bin | bin} equals the filter value. The default
   * (`undefined`) draws only batches in the implicit "default" bin —
   * the existing call sites all get this behaviour automatically.
   * Pass `"overlay"` (or any other bin id) to draw the matching batches
   * in a later, depth-cleared pass; see `_renderScene`'s tail.
   *
   * Collapses the dozen-plus `bins.X.forEach(b => drawOps[b.primitive].Y?.drawBatch(b))`
   * sites that previously littered the render method.
   */
  private _drawBin(
      batches: ReadonlyArray<MeshBatch>,
      opKey: keyof RenderPassDrawOps,
      renderBinName?: string,
      binFilter?: string,
  ): void {
    if (renderBinName !== undefined) {
      const ri = this._inspector();
      if (ri) {
        if (!ri.getRenderBinEnabled(renderBinName)) return;
        ri.renderBinStarted(renderBinName);
      }
    }
    const drawOps = this.drawOps.prims;
    const gl = this._renderContext.gl;
    // Start of an uninterrupted batch-draw run — clear the per-unit
    // bound-texture tracking so the draw path's redundant-bind skip can't act
    // on state left by a sub-pipeline, the splat pass, or a previous frame.
    this._renderContext.resetTextureBindings();
    // Lines need blending for the thick-line SDF AA — without it
    // the AA fringe pixels write `lineColor * alpha` as
    // premultiplied colours straight into the framebuffer
    // (opaque pass has BLEND off by default), painting a dark
    // halo around every round cap and edge. Triangles in the
    // same bin keep blending off so their alpha-test paths
    // aren't perturbed. Toggle around line batches, restore
    // after — fine grained but cheap (a handful of state
    // changes per frame for a typical scene).
    let blendOn = false;
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      // Bin filter: every batch is bin-homogeneous (MeshManager hashes by
      // SceneMesh.bin), so strict equality here cleanly partitions the
      // iteration. `undefined === undefined` lets existing call sites
      // continue to draw only default-bin batches with no code change.
      if (batch.bin !== binFilter) continue;
      const ops = drawOps[batch.primitive];
      if (!ops) continue;
      const op = ops[opKey];
      if (!op) continue;
      const needBlend = batch.primitive === LinesPrimitive;
      if (needBlend !== blendOn) {
        if (needBlend) {
          gl.enable(gl.BLEND);
          gl.blendEquation(gl.FUNC_ADD);
          // Premultiplied-alpha source: fsOutputColor already
          // emits `(rgb * a, a)`, so the source factor is `ONE`.
          gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        } else {
          gl.disable(gl.BLEND);
        }
        blendOn = needBlend;
      }
      op.drawBatch(batch);
    }
    if (blendOn) {
      gl.disable(gl.BLEND);
    }
  }

  /**
   * Draws a base-edges bin, choosing the thin `gl.LINES` technique (default)
   * or the thick quad-expanded one when `edges.edgeWidth > 1` — `gl.lineWidth`
   * can't widen lines on most WebGL stacks, so wide edges expand to triangles.
   *
   * Thick edges are TRIANGLES, so two pieces of GL state the thin path got for
   * free are set here and restored after:
   * - Polygon offset biased *toward* the camera — thin `gl.LINES` are immune to
   *   polygon offset, so they win z-ties at true depth while the scene pushes
   *   filled surfaces back. Thick edge triangles are subject to it and would
   *   z-fight the coplanar surface, so they get a slope-scaled negative offset
   *   (`polygonOffset(-1, -1)`): the standard coplanar-outline/decal fix, robust
   *   at grazing angles because the bias tracks the surface's depth slope (a
   *   constant NDC bias can't), yet small enough to only break coplanar ties —
   *   it won't punch through genuinely-closer geometry. The scene's surface
   *   offset (`polygonOffset(1, 1)`) pushes the other way, so they compound.
   * - BLEND on (premultiplied) — for the round-rect SDF antialiasing fringe.
   */
  private _drawEdgeBin(
      batches: ReadonlyArray<MeshBatch>,
      baseOpKey: keyof RenderPassDrawOps,
      thickOpKey: keyof RenderPassDrawOps,
      renderBinName: string,
      view: import("../../../viewer").View,
  ): void {
    if (view.effects.edges.edgeWidth > 1 && batches.length > 0) {
      const gl = this._renderContext.gl;
      const offsetWas = gl.isEnabled(gl.POLYGON_OFFSET_FILL);
      const blendWas = gl.isEnabled(gl.BLEND);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(-1.0, -1.0);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      this._drawBin(batches, thickOpKey, renderBinName);
      if (!blendWas) gl.disable(gl.BLEND);
      gl.polygonOffset(1.0, 1.0);   // restore the scene's surface offset
      if (!offsetWas) gl.disable(gl.POLYGON_OFFSET_FILL);
    } else {
      this._drawBin(batches, baseOpKey, renderBinName);
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
   * Releases GL-backed resources when the WebGL context is lost.
   *
   * Runs while the context is still flagged lost, so the `destroy()` calls'
   * `gl.delete*` operations are no-ops rather than errors issued against the
   * later-restored context. The lazily-constructed subsystems (sky, grid,
   * SAO/shadow pipelines, post-process chain) are nulled so {@link init}
   * recreates them on restore; `drawOps` keeps its shared program pool and
   * recompiles in {@link webglContextRestored}.
   */
  webglContextLost(): void {
    this.skyRenderer?.destroy();
    this.skyRenderer = null;
    this.infiniteGrid?.destroy();
    this.infiniteGrid = null;
    this.gaussianSplats?.destroy();
    this.gaussianSplats = null;
    this._saoPipeline?.destroy();
    this._saoPipeline = null;
    this._shadowPipeline?.destroy();
    this._shadowPipeline = null;
    this._postProcess?.destroy();
    this._postProcess = null;
    this._capPlaneRenderer?.destroy();
    this._capPlaneRenderer = null;
    this._releaseIBLResources();
    this._renderContext.renderInspector?.webglContextLost();
  }

  /**
   * Reinitializes everything that holds GL state after a context restore.
   *
   * The subsystems invalidated by the loss were nulled in
   * {@link webglContextLost}; here `drawOps` recompiles its shared program
   * pool in place and {@link init} walks each nulled subsystem back through
   * its lazy-construction path against the restored context.
   */
  webglContextRestored(): SDKResult<void> {
    this._renderContext.renderInspector?.webglContextRestored();
    this._releaseIBLResources();

    if (this.drawOps) {
      const result = this.drawOps.webglContextRestored();
      if (result.ok === false) return result;
    }

    return this.init();
  }

  private _releaseIBLResources(): void {
    for (const pipeline of this._iblPrefilters.values()) {
      pipeline.destroy();
    }
    this._iblPrefilters.clear();
    this._iblParamSignatures.clear();
    // A recreated prefilter pipeline must re-receive the environment image,
    // which `_prepareIBL` only re-uploads on a version mismatch.
    this._iblEnvVersions.clear();
    this._brdfLUT?.destroy();
    this._brdfLUT = null;
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
   * @throws {@link base!core.SDKInternalException | SDKInternalException} If called before {@link init}.
   */
  public render(
    rendererView: ViewRenderState,
    options: {
      clear: boolean;
    }): SDKResult<any> {

    if (!this.drawOps) {
      throw new SDKInternalException("[RenderManager.render] RenderManager not initialized");
    }

    // GPU resources are invalid while the context is lost; skip the frame
    // entirely until restoration rebuilds them.
    if (this._renderContext.contextLost) {
      return {ok: true, value: undefined};
    }

    // Complete the deferred shader build before the first draw. No-op after the
    // first frame.
    const finalizeResult = this.drawOps.ensureFinalized();
    if (finalizeResult.ok === false) {
      return finalizeResult;
    }

    const {view} = rendererView;
    const inspector = this._inspector();

    inspector?.frameStarted(view);

    this._beginFrame(rendererView);
    this._classifyBatches(view);
    this._renderScene(rendererView, options);
    this._endFrame();
    this._postProcess.composite(view);
    this._renderOverlay(rendererView);

    inspector?.frameEnded();

    return {ok: true, value: undefined};
  }

  // ------------------------------------------------------------------
  // Frame lifecycle: begin → classify → render → end → composite.
  //
  // Each phase is intentionally narrow:
  //   - _beginFrame: scene-render size, GL state, scene target.
  //   - _classifyBatches: bin sort (delegated to RenderBinClassifier).
  //   - _renderScene: SAO/shadow/scene-depth prep, opaque, edges, silhouettes, transparents.
  //   - _endFrame: tear down scene-phase GL state.
  //   - _postProcess.composite: bloom + depth-aware effects + tonemap + final AA -> canvas.
  // ------------------------------------------------------------------

  /** Sets up scene-phase GL state and binds the target the scene draws into. */
  private _beginFrame(rendererView: ViewRenderState): void {
    const renderContext = this._renderContext;
    const gl = renderContext.gl;
    const view = rendererView.view;

    // Canvas backing-buffer sizing (including resolution scaling) is owned by
    // ViewManager._alignCanvasToView, which runs before each render. Sizing
    // here as well would apply the scale twice and clear the drawing buffer
    // an extra time per frame.
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
    renderContext.sceneDepthTexture = null;
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

    // Each prep-phase draw goes through inspector.drawMeshBatch, which
    // bootstraps "UnnamedPass" if no preceding renderBinStarted ran.
    // Front-load the names so SAO/shadow prep and sky/grid cost is
    // attributed to its own bin in the inspector's per-frame report.
    const ri = this._inspector();
    if (this.skyRenderer) {
      ri?.renderBinStarted("sky");
      this.skyRenderer.render(rendererView);
    }
    if (this.infiniteGrid) {
      ri?.renderBinStarted("grid");
      this.infiniteGrid.render(rendererView);
    }

    // IBL prefilter — refreshes the per-view sky cubemap + irradiance +
    // prefiltered specular mip chain when params change. Runs before the
    // BRDF passes so the smooth-shaded technique can sample them.
    this._prepareIBL(view);

    // SAO + shadow + scene-depth prep passes (each runs once per frame,
    // drawing into its own FBO). All pull their batches from the relevant
    // bin sets.
    const needSAO = bins.normalDrawSAO.length > 0 || bins.normalDrawSAOShadow.length > 0;
    const needShadow = bins.normalDrawShadow.length > 0 || bins.normalDrawSAOShadow.length > 0;
    const needSceneDepth = this._postProcess.needsSceneDepth(view);
    if (needSAO) {
      ri?.renderBinStarted("saoPrep");
      this._saoPipeline.render({
        rendererView,
        drawOps: this.drawOps.prims,
        saoBatches: bins.normalDrawSAO,
        comboBatches: bins.normalDrawSAOShadow
      });
    }
    if (needShadow) {
      ri?.renderBinStarted("shadowPrep");
      this._shadowPipeline.render({
        rendererView,
        drawOps: this.drawOps.prims,
        shadowBatches: bins.normalDrawShadow,
        comboBatches: bins.normalDrawSAOShadow
      });
    }
    if (needSceneDepth) {
      ri?.renderBinStarted("sceneDepthPrep");
      this._renderSceneDepth(rendererView);
    }

    // Sub-pipelines each bound their own FBOs and unbound to null. Re-bind
    // the scene target and reset the program-id cache before resuming the
    // main scene draw.
    if (needSAO || needShadow || needSceneDepth) {
      this._bindSceneTarget();
      gl.viewport(0, 0, renderContext.sceneRenderWidth, renderContext.sceneRenderHeight);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      renderContext.lastProgramId = -1;
    }

    // Opaque colour passes — every batch routes to one of these four bins.
    // Each variant gets its own inspector bin so adaptive-quality decisions
    // can see SAO vs shadow vs combined cost separately.
    this._drawBin(bins.normalDrawOpaque, "opaque", RENDER_BINS.OPAQUE);
    this._drawBin(bins.normalDrawSAO, "opaqueSAO", "opaqueSAO");
    this._drawBin(bins.normalDrawShadow, "opaqueShadow", "opaqueShadow");
    this._drawBin(bins.normalDrawSAOShadow, "opaqueSAOShadow", "opaqueSAOShadow");

    // Section-plane caps. Runs after opaque colour (so the cap
    // draws on top of the cleanly-clipped model) and before edges
    // (so the cap surface gets edge-enhanced like real geometry).
    // Inert when no plane is cap-enabled or the effect is off.
    this._renderCaps(rendererView);

    // Shadow data is no longer needed after the opaque passes.
    for (let i = 0; i < renderContext.shadowMapTextures.length; i++) {
      renderContext.shadowMapTextures[i] = null;
    }
    renderContext.shadowCascadeCount = 0;

    this._drawEdgeBin(bins.normalEdgesOpaque, "opaqueEdges", "opaqueEdgesThick", RENDER_BINS.EDGES_OPAQUE, view);
    this._drawBin(bins.xrayedSilhouetteOpaque, "xrayed", RENDER_BINS.XRAYED_SILHOUETTE_OPAQUE);
    this._drawBin(bins.xrayEdgesOpaque, "xrayedEdges", RENDER_BINS.XRAYED_EDGES_OPAQUE);

    // Gaussian splats: after opaque (so they depth-test against it), before the
    // transparent mesh pass. Self-contained blended pass; no-op when no splats.
    if (this.gaussianSplats) {
      ri?.renderBinStarted("gaussianSplats");
      this.gaussianSplats.render(rendererView, this._meshManager.getSplatBatch());
    }

    this._renderTransparents(view);

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

    // SceneMesh.bin overlay batches used to render here, into the
    // HDR scene target. They now render *after*
    // `PostProcessChain.composite` so the gizmo / HUD layer lands
    // straight on the canvas with its authored colours instead of
    // being tonemapped along with the rest of the scene. See
    // {@link _renderOverlay}.
  }

  /**
   * Renders a depth-only scene prepass for depth-aware post-processing.
   *
   * We do this only when a depth-aware post-process is active. The main scene
   * depth attachment cannot be used directly because later always-on-top
   * highlight/selection rendering clears it before post-processing runs.
   */
  private _renderSceneDepth(rendererView: ViewRenderState): void {
    const renderContext = this._renderContext;
    const gl = renderContext.gl;
    const sceneW = renderContext.sceneRenderWidth || gl.drawingBufferWidth;
    const sceneH = renderContext.sceneRenderHeight || gl.drawingBufferHeight;
    const depthBuffer = rendererView.renderBuffers.getRenderBuffer("sceneDepth", {
      depthTexture: true,
      size: [sceneW, sceneH]
    });
    const bins = this._bins;
    const opaqueBins = [
      bins.normalDrawOpaque,
      bins.normalDrawSAO,
      bins.normalDrawShadow,
      bins.normalDrawSAOShadow,
    ];

    renderContext.resetTextureBindings();
    depthBuffer.bind();
    gl.viewport(0, 0, sceneW, sceneH);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.colorMask(false, false, false, false);
    renderContext.lastProgramId = -1;

    const drawOps = this.drawOps.prims;
    for (let binIndex = 0; binIndex < opaqueBins.length; binIndex++) {
      const batches = opaqueBins[binIndex];
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        if (batch.bin !== undefined) continue;
        drawOps[batch.primitive]?.opaque?.drawBatch(batch);
      }
    }

    gl.colorMask(true, true, true, true);
    depthBuffer.unbind();
    renderContext.sceneDepthTexture = depthBuffer.getDepthTexture();
    renderContext.lastProgramId = -1;
  }

  /**
   * True if any batch carries a non-default {@link MeshBatch.bin | bin}.
   * Cheap early-out for the overlay pass — no allocation, no extra state
   * tracked across frames.
   */
  private _anyOverlayBatches(bins: RenderBins): boolean {
    const anyIn = (arr: MeshBatch[]) => {
      for (let i = 0; i < arr.length; i++) {
        if (arr[i].bin === "overlay") return true;
      }
      return false;
    };
    return anyIn(bins.normalDrawOpaque)
      || anyIn(bins.normalDrawSAO)
      || anyIn(bins.normalDrawShadow)
      || anyIn(bins.normalDrawSAOShadow)
      || anyIn(bins.normalEdgesOpaque)
      || anyIn(bins.normalFillTransparent)
      || anyIn(bins.normalEdgesTransparent);
  }

  /**
   * Re-issues SceneMesh.bin `"overlay"` batches to the default
   * canvas framebuffer **after**
   * {@link "../postprocess/PostProcessChain".PostProcessChain.composite | PostProcessChain.composite},
   * so the gizmo / HUD layer renders with its authored colours
   * instead of being run through HDR tonemap with the rest of the
   * scene.
   *
   * The overlay's flat-color shader does its own inline sRGB
   * encode ({@link "../../drawOps/DrawTechnique".DrawTechnique.fsSRGBEncodeColor | DrawTechnique.fsSRGBEncodeColor}),
   * matching the encoded canvas the tonemap pass wrote — so a
   * gizmo colour authored as `(1, 0, 0)` lands at the same final
   * RGB as a tonemapped scene fragment of the same colour, with
   * no double-encoding.
   *
   * Force-on-top semantics are preserved by clearing the canvas
   * depth attachment and switching to `depthFunc(ALWAYS)` — same
   * setup the old in-HDR overlay block used. The default
   * comparator is restored on exit so any later canvas use sees
   * standard `LEQUAL` behaviour.
   *
   * Edge-bin draws (`opaqueEdges` / `transparentEdges`) are
   * skipped here because those techniques are shared with the
   * scene-render path and don't have the inline sRGB encode; the
   * current overlay use-case (transform gizmo) has no edge
   * geometry, so this is a no-op for now and can be revisited if
   * a future overlay host needs edges.
   */
  private _renderOverlay(rendererView: ViewRenderState): void {
    const bins = this._bins;
    if (!this._anyOverlayBatches(bins)) return;

    const renderContext = this._renderContext;
    const gl = renderContext.gl;

    // composite() typically leaves the default framebuffer bound,
    // but be defensive — a future post-process step (DoF, SSR,
    // etc.) might unbind / change it.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    // Force-on-top: depthFunc(ALWAYS) makes every overlay fragment
    // pass regardless of the canvas depth attachment's stored
    // values; depthMask(true) keeps writes on so subsequent
    // overlay passes (and any later canvas use) can read fresh
    // depth.
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.depthFunc(gl.ALWAYS);

    // The classifier puts overlay batches in `normalDrawOpaque`
    // only (it skips the SAO / shadow bins for overlay), so the
    // SAO / shadow / SAOShadow `_drawBin` calls are a defensive
    // no-op for now — kept for symmetry should that policy change.
    this._drawBin(bins.normalDrawOpaque,    "flatColor", undefined, "overlay");
    this._drawBin(bins.normalDrawSAO,       "flatColor", undefined, "overlay");
    this._drawBin(bins.normalDrawShadow,    "flatColor", undefined, "overlay");
    this._drawBin(bins.normalDrawSAOShadow, "flatColor", undefined, "overlay");

    if (bins.normalFillTransparent.length) {
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      this._drawBin(bins.normalFillTransparent, "flatColorTransparent", undefined, "overlay");
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    gl.depthFunc(gl.LEQUAL);
  }

  /**
   * Section-plane cap pass.
   *
   * Per cap-enabled plane (active plane carrying a non-null
   * {@link SectionPlane.capColor}):
   *   1. Clear stencil to 0.
   *   2. Two invisible model passes — front-cull DECR, back-cull
   *      INCR — write a count to the stencil at every pixel
   *      where the cap plane sits between the camera and the
   *      model's exit point.
   *   3. Fullscreen cap quad with `stencilFunc(NOTEQUAL, 0)`
   *      paints the cap colour at the plane's depth.
   *
   * Cost: per cap-enabled plane, two re-traversals of the
   * opaque triangle bins + one fullscreen pass. Inert when
   * {@link SectionPlaneCaps.applied} is false or no plane
   * carries a {@link SectionPlane.capColor}.
   */
  private _renderCaps(rendererView: ViewRenderState): void {
    const renderContext = this._renderContext;
    const gl = renderContext.gl;
    const view = rendererView.view;
    const capRenderer = this._capPlaneRenderer;

    if (!capRenderer) return;
    if (!view.effects.sectionPlaneCaps.applied) return;

    // Collect cap-enabled planes in the same dense-active order
    // the colour technique uses to upload `uSectionPlanes[]`. The
    // stencil-mask FS reads that same array, so the index into
    // the activePlanes list IS the FS's `uCapPlaneIndex`.
    const all = view.sectionPlanesList;
    if (!all || all.length === 0) return;
    const activePlanes: any[] = [];
    for (let i = 0; i < all.length; i++) {
      if (all[i].active) activePlanes.push(all[i]);
    }
    if (activePlanes.length === 0) return;
    let anyCap = false;
    for (let i = 0; i < activePlanes.length; i++) {
      if (activePlanes[i].capColor) { anyCap = true; break; }
    }
    if (!anyCap) return;

    // Stencil-mask draw op — re-walks the opaque triangle bins
    // with our minimal stencil-only technique.
    const trianglesOps: RenderPassDrawOps | undefined = this.drawOps.prims[TrianglesPrimitive];
    const stencilOp = trianglesOps?.stencilMask;
    if (!stencilOp) return;
    const stencilTech = stencilOp.technique as TrianglesStencilMaskTechnique;

    const bins = this._bins;
    const allOpaqueBins = [
      bins.normalDrawOpaque,
      bins.normalDrawSAO,
      bins.normalDrawShadow,
      bins.normalDrawSAOShadow,
    ];

    // View-projection matrix used to compute correct depth for
    // the cap quad. Standard column-major OpenGL convention:
    // composed as proj * view.
    const proj = view.camera.projMatrix as any;
    const viewM = view.camera.viewMatrix as any;
    matrix.mulMat4(proj, viewM, this._capViewProj as any);
    const eyeWorldPos = view.camera.eye;

    // Save GL state we're about to stomp; restore once at the end.
    gl.enable(gl.STENCIL_TEST);
    gl.colorMask(false, false, false, false);
    gl.depthMask(false);
    // Depth test OFF for the stencil writes — the cap counter
    // needs every entry/exit along the camera ray, not just
    // crossings in front of the closest visible surface. With
    // LESS we'd reject every front-face that matches the opaque
    // pass's depth and every back-face that lies behind it, and
    // the count would come out as garbage. Depth test is
    // re-enabled before the cap quad below.
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    const w = renderContext.sceneRenderWidth  || gl.drawingBufferWidth;
    const h = renderContext.sceneRenderHeight || gl.drawingBufferHeight;

    for (let i = 0; i < activePlanes.length; i++) {
      const plane = activePlanes[i];
      if (!plane.capColor) continue;

      // Per-plane stencil clear — counter starts at 0.
      gl.clearStencil(0);
      gl.clear(gl.STENCIL_BUFFER_BIT);

      stencilTech.setCapPlaneIndex(i);

      // Pass 1: front-faces enter the model; DECR_WRAP stencil
      // where the front-face is past the cap plane.
      gl.cullFace(gl.BACK);
      gl.stencilFunc(gl.ALWAYS, 0, 0xFF);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.DECR_WRAP);
      for (let b = 0; b < allOpaqueBins.length; b++) {
        this._drawBin(allOpaqueBins[b], "stencilMask");
      }

      // Pass 2: back-faces exit the model; INCR_WRAP stencil
      // where the back-face is past the cap plane.
      gl.cullFace(gl.FRONT);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR_WRAP);
      for (let b = 0; b < allOpaqueBins.length; b++) {
        this._drawBin(allOpaqueBins[b], "stencilMask");
      }

      // Restore visible-pass state for the cap quad: full colour
      // write, depth write+test on, BACK culling. Stencil func
      // gates the cap to pixels where the mask ended up non-zero.
      gl.colorMask(true, true, true, true);
      gl.depthMask(true);
      gl.enable(gl.DEPTH_TEST);
      gl.cullFace(gl.BACK);
      gl.stencilFunc(gl.NOTEQUAL, 0, 0xFF);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

      // Other active planes — used by the cap quad's union clip.
      // We pass them by reference; the cap renderer copies into
      // its own scratch buffer.
      const otherPlanes: {dir: ArrayLike<number>; dist: number}[] = [];
      for (let j = 0; j < activePlanes.length; j++) {
        if (j === i) continue;
        otherPlanes.push({dir: activePlanes[j].dir, dist: activePlanes[j].dist});
      }

      capRenderer.render({
        viewProj: this._capViewProj,
        eyeWorldPos: eyeWorldPos as any,
        capPlaneNormal: plane.dir,
        capPlaneDist: plane.dist,
        capColor: plane.capColor,
        viewportWidth: w,
        viewportHeight: h,
        otherPlanes,
      });

      // Re-enter the loop in stencil-write mode for the next plane.
      gl.colorMask(false, false, false, false);
      gl.depthMask(false);
      gl.disable(gl.DEPTH_TEST);
    }

    // Restore default state. Subsequent passes (edges, silhouettes)
    // expect no stencil filtering and standard colour/depth writes.
    gl.colorMask(true, true, true, true);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
    gl.stencilFunc(gl.ALWAYS, 0, 0xFF);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.CULL_FACE);
    // Cap-quad call stomped the bound program — reset the cache so
    // the next DrawTechnique re-uploads its uniforms.
    renderContext.lastProgramId = -1;
  }

  /**
   * Transparent block — sets up premultiplied-alpha blending, draws the four
   * transparent bins, then restores depth-write state.
   */
  private _renderTransparents(view: import("../../../viewer").View): void {
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

    this._drawEdgeBin(bins.normalEdgesTransparent, "transparentEdges", "transparentEdgesThick", RENDER_BINS.EDGES_TRANSPARENT, view);
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
    if (this._capPlaneRenderer) {
      this._capPlaneRenderer.destroy();
      this._capPlaneRenderer = null;
    }
    if (this.infiniteGrid) {
      this.infiniteGrid.destroy();
      this.infiniteGrid = null;
    }
    if (this.gaussianSplats) {
      this.gaussianSplats.destroy();
      this.gaussianSplats = null;
    }
    this._releaseIBLResources();
    this._extensionHandles = null;
    this._renderContext = null;
    this._gpuMemoryReader = null;
  }
}
