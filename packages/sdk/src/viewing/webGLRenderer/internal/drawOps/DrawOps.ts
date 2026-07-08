import type {GPUMemoryReader} from "../gpuMemoryManager/GPUMemoryReader";
import type {SDKResult} from "../../../../base/core";
import {RenderContext} from "../RenderContext";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../../../base/constants";
import {TrianglesDrawColorTechnique} from "./techniques/triangles/TrianglesDrawColorTechnique";
import {TrianglesDrawColorFlatTechnique} from "./techniques/triangles/TrianglesDrawColorFlatTechnique";
import {TrianglesDrawColorSAOTechnique} from "./techniques/triangles/TrianglesDrawColorSAOTechnique";
import {TrianglesDrawColorShadowTechnique} from "./techniques/triangles/TrianglesDrawColorShadowTechnique";
import {TrianglesDrawColorSAOShadowTechnique} from "./techniques/triangles/TrianglesDrawColorSAOShadowTechnique";
import {TrianglesShadowDepthTechnique} from "./techniques/triangles/TrianglesShadowDepthTechnique";
import {GenericDrawSilhouetteTechnique} from "./techniques/generic/GenericDrawSilhouetteTechnique";
import {PointsDrawColorTechnique} from "./techniques/points/PointsDrawColorTechnique";
import {PointsPickMeshTechnique} from "./techniques/points";
import {ThickLinesDrawColorTechnique} from "./techniques/lines/ThickLinesDrawColorTechnique";
import {ThickLinesPickMeshTechnique} from "./techniques/lines/ThickLinesPickMeshTechnique";
import {LinesSnapTechnique} from "./techniques/lines/LinesSnapTechnique";
import {type RenderPassDrawOps} from "./RenderPassDrawOps";
import {DrawOp} from "./DrawOp";
import {RENDER_PASSES} from "../RENDER_PASSES";
import {TrianglesDrawEdgeSilhouetteTechnique} from "./techniques/triangles/TrianglesDrawEdgeSilhouetteTechnique";
import {DrawTechnique} from "./DrawTechnique";
import {TrianglesDrawEdgeColorTechnique} from "./techniques/triangles/TrianglesDrawEdgeColorTechnique";
import {TrianglesDrawEdgeColorThickTechnique} from "./techniques/triangles/TrianglesDrawEdgeColorThickTechnique";
import {SDKInternalException} from "../../../../base/core";
import {TrianglesDrawSilhouetteTechnique} from "./techniques/triangles/TrianglesDrawSilhouetteTechnique";
import {GenericPickMeshTechnique} from "./techniques/generic";
import {TrianglesSnapInitTechnique} from "./techniques/triangles/TrianglesSnapInitTechnique";
import {TrianglesSnapTechnique} from "./techniques/triangles/TrianglesSnapTechnique";
import {TrianglesStencilMaskTechnique} from "./techniques/triangles/TrianglesStencilMaskTechnique";

/**
 * Owns and manages all {@link DrawTechnique} instances
 * required to render every supported primitive type across all render passes.
 *
 * ## Structure
 *
 * - One {@link DrawOps} exists per {@link WebGLRenderer} / viewer.
 * - Draw operations are organized:
 *   1. by **primitive type** (triangles, lines, points)
 *   2. then by **render pass** (opaque, transparent, highlighted, selected, xrayed, pick, etc.)
 *
 * Each leaf entry is a {@link DrawOp}, which binds a {@link DrawTechnique} to a
 * specific render pass.
 *
 * ## Usage
 *
 * To render a batch of geometry, callers retrieve the appropriate {@link DrawOp}
 * and invoke it:
 *
 * ```ts
 * drawOps.prims[primitiveType][renderPass].draw(meshBatch);
 * ```
 *
 * or, to draw a single mesh:
 *
 * ```ts
 * drawOps.prims[primitiveType][renderPass].drawMesh(meshBatch, meshIndex);
 * ```
 *
 * ## Lifecycle
 *
 * - {@link DrawTechnique} instances are created once and may be shared by multiple {@link DrawOp}s.
 * - Initialization is fail-fast: if any technique fails to initialize, all previously
 *   initialized techniques are destroyed.
 * - Techniques are reference-counted via {@link getDrawOps} / {@link putDrawOps}.
 *
 * @internal
 */

export class DrawOps {

  /**
   * Reference count used to share a single DrawOps instance across multiple users
   * within the same viewer.
   *
   * @private
   */
  public _useCount: number = 0;

  /**
   * Render context associated with this DrawOps instance.
   *
   * @private
   */
  public _renderContext: RenderContext;

  /**
   * Interface for reading GPU-resident data via data textures.
   */
  public readonly gpuMemoryReader: GPUMemoryReader;

  /**
   * All draw techniques owned by this DrawOps instance.
   *
   * Stored for initialization, context restoration, and cleanup.
   *
   * @private
   */
  private _techniques: DrawTechnique[];

  /**
   * Set after {@link init} issues the program links but before the blocking
   * compile-wait runs. {@link ensureFinalized} clears it. Lets the driver
   * compile the program batch in the background while the rest of startup
   * (model fetch / decode / GPU upload) runs, instead of blocking init on it.
   *
   * @private
   */
  private _finalizePending: boolean;

  /**
   * Time spent issuing the program links in {@link init} (no status read-back),
   * carried so {@link ensureFinalized} can log the full compile breakdown.
   *
   * @private
   */
  private _linkMs: number;

  /** Whether KHR_parallel_shader_compile was available at link time. @private */
  private _parallelCompile: boolean;

  /**
   * Draw operations indexed first by primitive type, then by render pass.
   *
   * Each entry is a {@link DrawOp}, which applies a {@link DrawTechnique}
   * within a specific render pass.
   */
  prims: {
    [TrianglesPrimitive]?: RenderPassDrawOps;
    [LinesPrimitive]?: RenderPassDrawOps;
    [PointsPrimitive]?: RenderPassDrawOps;
  };

  /**
   * Initializes the draw operationa with the given rendering context and GPU memory reader interface.
   *
   * @param renderContext - The rendering context used for WebGL operations.
   * @param gpuMemoryReader - Reads GPU memory - provides data textures.
   */
  constructor(renderContext: RenderContext, gpuMemoryReader: GPUMemoryReader) {
    this._renderContext = renderContext;
    this.gpuMemoryReader = gpuMemoryReader;
    this._techniques = [];
  }

  /**
   * Initializes all draw techniques and builds the primitive/render-pass map.
   *
   * This method:
   * - Instantiates all required {@link DrawTechnique}s
   * - Initializes them in sequence
   * - Cleans up fully if any initialization step fails
   * - Constructs {@link DrawOp} wrappers for each primitive/pass combination
   *
   * @returns
   * Result indicating success or failure. Errors are emitted via
   * {@link WebGLRendererEvents.onError}.
   */

  init(): SDKResult<null> {

    const renderContext = this._renderContext;
    const gpuMemoryReader = this.gpuMemoryReader;

    this._techniques = [];

    /**
     * The draw operations grouped by primitive type, and then sub-grouped by render pass.
     */
    this.prims = {};

    const saveForCleanup = (drawTechnique: DrawTechnique): DrawTechnique => {
      this._techniques.push(drawTechnique);
      return drawTechnique;
    }

    // Some draw techniques are shared between multiple draw ops.
    // A draw op applies a draw technique to a specific render pass.
    // E.g. the silhouetteTechnique draw technique is used for highlighted, selected and xrayed triangles.

    // Logarithmic depth buffer — opt every camera-visible
    // technique (colour, edges, silhouette, lines, points) into
    // the vertex-side log-depth permutation so depth precision
    // stays usable across scenes with huge near/far ratios
    // (UTM-scale terrain + close-up BIM, archipelagos, infinite
    // landscapes). Picking / snap / shadow-depth techniques
    // deliberately stay linear — their depth read-back math
    // would have to grow a `log2` term to match.
    const LOG_DEPTH = true;

    const linesDrawSilhouette = saveForCleanup(new GenericDrawSilhouetteTechnique(renderContext, gpuMemoryReader, 2, {logDepth: LOG_DEPTH}));
    const trianglesSilhouette = saveForCleanup(new TrianglesDrawSilhouetteTechnique(renderContext, gpuMemoryReader, {logDepth: LOG_DEPTH}));
    // Lambert colour techniques exist as 6-way variants on the
    // `(hasNormals, hasUVs, triplanar)` axes (`hasUVs && triplanar`
    // excluded by construction). The DrawOp picks at draw time via
    // `MeshBatch.hasNormals` / `hasUVs` / `triplanar`, so batches
    // that don't carry an attribute don't pay for shaders that
    // sample it. Each helper below returns a `DrawOpVariants`
    // object the DrawOp wires straight into its 6-slot lookup.
    //
    // `logDepth` is folded into every variant — it's a global
    // depth-precision choice, not a per-batch axis.
    const lambertVariants = <T extends new (...args: any[]) => any>(Cls: T) => ({
      technique:               saveForCleanup(new Cls(renderContext, gpuMemoryReader, {logDepth: LOG_DEPTH})),
      withNormals:             saveForCleanup(new Cls(renderContext, gpuMemoryReader, {hasNormals: true, logDepth: LOG_DEPTH})),
      withUVs:                 saveForCleanup(new Cls(renderContext, gpuMemoryReader, {hasUVs: true, logDepth: LOG_DEPTH})),
      withNormalsAndUVs:       saveForCleanup(new Cls(renderContext, gpuMemoryReader, {hasNormals: true, hasUVs: true, logDepth: LOG_DEPTH})),
      withTriplanar:           saveForCleanup(new Cls(renderContext, gpuMemoryReader, {triplanar: true, logDepth: LOG_DEPTH})),
      withNormalsAndTriplanar: saveForCleanup(new Cls(renderContext, gpuMemoryReader, {hasNormals: true, triplanar: true, logDepth: LOG_DEPTH})),
    });
    const trianglesDrawColor          = lambertVariants(TrianglesDrawColorTechnique);
    const trianglesDrawColorSAO       = lambertVariants(TrianglesDrawColorSAOTechnique);
    const trianglesDrawColorShadow    = lambertVariants(TrianglesDrawColorShadowTechnique);
    const trianglesDrawColorSAOShadow = lambertVariants(TrianglesDrawColorSAOShadowTechnique);
    // Unlit pure-colour technique for the overlay bin (gizmos, HUD chrome).
    // No Lambert / PBR, no SAO, no shadow — fragment colour comes straight
    // from `MeshViewAttributes.color`. Single variant (none of the
    // hasNormals / hasUVs / triplanar axes are sampled).
    const trianglesDrawColorFlat = saveForCleanup(new TrianglesDrawColorFlatTechnique(renderContext, gpuMemoryReader, {logDepth: LOG_DEPTH}));
    const trianglesShadowDepth = saveForCleanup(new TrianglesShadowDepthTechnique(renderContext, gpuMemoryReader));
    const trianglesDrawEdgeSilhouette = saveForCleanup(new TrianglesDrawEdgeSilhouetteTechnique(renderContext, gpuMemoryReader, {logDepth: LOG_DEPTH}));
    const trianglesDrawEdgeColor = saveForCleanup(new TrianglesDrawEdgeColorTechnique(renderContext, gpuMemoryReader, {logDepth: LOG_DEPTH}));
    const trianglesDrawEdgeColorThick = saveForCleanup(new TrianglesDrawEdgeColorThickTechnique(renderContext, gpuMemoryReader, {logDepth: LOG_DEPTH}));
    const trianglesPickMesh = saveForCleanup(new GenericPickMeshTechnique(renderContext, gpuMemoryReader, 3));
    // Thick-line pick — same quad-expansion as the colour pass,
    // so the pickable region matches what the user sees as the
    // line's body (not the 1-pixel `gl.LINES` core the legacy
    // GenericPickMeshTechnique would write).
    const linesPickMesh = saveForCleanup(new ThickLinesPickMeshTechnique(renderContext, gpuMemoryReader));
    const pointsPickMesh = saveForCleanup(new PointsPickMeshTechnique(renderContext, gpuMemoryReader));
    const linesDrawColor = saveForCleanup(new ThickLinesDrawColorTechnique(renderContext, gpuMemoryReader, {logDepth: LOG_DEPTH}));
    const pointsDrawColor = saveForCleanup(new PointsDrawColorTechnique(renderContext, gpuMemoryReader, {logDepth: LOG_DEPTH}));
    const trianglesSnapInit   = saveForCleanup(new TrianglesSnapInitTechnique(renderContext, gpuMemoryReader));
    const trianglesSnapVertex = saveForCleanup(new TrianglesSnapTechnique(renderContext, gpuMemoryReader, 1));
    const trianglesSnapEdge   = saveForCleanup(new TrianglesSnapTechnique(renderContext, gpuMemoryReader, 2));
    // Lines snap to the mathematical centerline of each line —
    // vertex snap is endpoints rasterised as POINTS, edge snap is
    // the lines rasterised as 1-pixel `gl.LINES`. The snap-radius
    // window in SnapManager catches the user's clicks anywhere
    // near the visible (quad-expanded) line body.
    const linesSnapVertex = saveForCleanup(new LinesSnapTechnique(renderContext, gpuMemoryReader, 1));
    const linesSnapEdge   = saveForCleanup(new LinesSnapTechnique(renderContext, gpuMemoryReader, 2));
    // Single shared stencil-mask technique reused across the
    // section-plane cap pass — RenderManager handles cull-face
    // and stencil-op flips between the two stencil writes per
    // cap plane, and uses `setCapPlaneIndex()` to pick which
    // active plane the FS is computing the mask for.
    const trianglesStencilMask = saveForCleanup(new TrianglesStencilMaskTechnique(renderContext, gpuMemoryReader));

    // Two-phase shader build so the driver compiles the whole batch
    // concurrently instead of one technique at a time. Pass 1 issues every
    // compile + link without reading status back; pass 2 reads status and
    // caches locations. The blocking status read-backs that would otherwise
    // serialize each technique now all happen after every compile is in flight.
    // KHR_parallel_shader_compile, when present, lets the driver compile off the
    // main thread; requesting it is a hint and a no-op where unsupported.
    const cleanupOnFail = (result: SDKResult<any>): SDKResult<null> => {
      for (let j = 0, n = this._techniques.length; j < n; j++) {
        this._techniques[j].destroy();
      }
      this._techniques = [];
      return result;
    };

    this._parallelCompile = !!renderContext.gl.getExtension("KHR_parallel_shader_compile");

    // Issue every compile + link, but don't read status back here — the blocking
    // compile-wait is deferred to ensureFinalized() so the driver can compile the
    // batch in the background during the rest of startup (model fetch / decode /
    // upload), instead of blocking this synchronous init path on it.
    const tStart = performance.now();
    for (let i = 0, len = this._techniques.length; i < len; i++) {
      const result = this._techniques[i].linkProgram();
      if (!result.ok) {
        return cleanupOnFail(result);
      }
    }
    this._linkMs = performance.now() - tStart;
    this._finalizePending = true;

    const {OPAQUE, TRANSPARENT, HIGHLIGHTED, SELECTED, XRAYED, PICK, SNAP_INIT, SNAP} = RENDER_PASSES;

    // DrawOp instances are just thin wrappers around DrawTechniques for specific render passes.

    this.prims = {

      [TrianglesPrimitive]: {
        opaque: new DrawOp(trianglesDrawColor, OPAQUE),
        opaqueSAO: new DrawOp(trianglesDrawColorSAO, OPAQUE),
        opaqueShadow: new DrawOp(trianglesDrawColorShadow, OPAQUE),
        opaqueSAOShadow: new DrawOp(trianglesDrawColorSAOShadow, OPAQUE),
        // Unlit pure-colour ops — used by the overlay-bin pass for gizmos.
        flatColor: new DrawOp(trianglesDrawColorFlat, OPAQUE),
        flatColorTransparent: new DrawOp(trianglesDrawColorFlat, TRANSPARENT),
        shadowDepth: new DrawOp(trianglesShadowDepth, OPAQUE),
        opaqueEdges: new DrawOp(trianglesDrawEdgeColor, OPAQUE),
        opaqueEdgesThick: new DrawOp(trianglesDrawEdgeColorThick, OPAQUE),
        transparent: new DrawOp(trianglesDrawColor, TRANSPARENT),
        transparentEdges: new DrawOp(trianglesDrawEdgeColor, TRANSPARENT),
        transparentEdgesThick: new DrawOp(trianglesDrawEdgeColorThick, TRANSPARENT),
        highlighted: new DrawOp(trianglesSilhouette, HIGHLIGHTED),
        highlightedEdges: new DrawOp(trianglesDrawEdgeSilhouette, HIGHLIGHTED),
        selected: new DrawOp(trianglesSilhouette, SELECTED),
        selectedEdges: new DrawOp(trianglesDrawEdgeSilhouette, SELECTED),
        xrayed: new DrawOp(trianglesSilhouette, XRAYED),
        xrayedEdges: new DrawOp(trianglesDrawEdgeSilhouette, XRAYED),
        pick: new DrawOp(trianglesPickMesh, PICK),
        // Stencil-mask uses the OPAQUE render pass to walk every
        // visible triangle batch; FS does no colour / depth
        // writes, so it doesn't matter which pass selects the
        // bin so long as we iterate the same batches the colour
        // pass did.
        stencilMask: new DrawOp(trianglesStencilMask, OPAQUE),
        snapInit:   new DrawOp(trianglesSnapInit,   SNAP_INIT),
        snapVertex: new DrawOp(trianglesSnapVertex, SNAP),
        snapEdge:   new DrawOp(trianglesSnapEdge,   SNAP),
      },

      [LinesPrimitive]: {
        opaque: new DrawOp(linesDrawColor, OPAQUE),
        transparent: new DrawOp(linesDrawColor, TRANSPARENT),
        highlighted: new DrawOp(linesDrawSilhouette, HIGHLIGHTED),
        selected: new DrawOp(linesDrawSilhouette, SELECTED),
        xrayed: new DrawOp(linesDrawSilhouette, XRAYED),
        pick: new DrawOp(linesPickMesh, PICK),
        // Line batches don't carry surface triangles, so they don't
        // contribute a depth baseline themselves — they rely on any
        // co-rendered triangle batches' snapInit pass for occlusion
        // testing, and on the cleared snap-FBO depth otherwise.
        // The lines themselves rasterise into the snap FBO as POINTS
        // (vertex snap) or 1-pixel LINES (edge snap).
        snapVertex: new DrawOp(linesSnapVertex, SNAP),
        snapEdge:   new DrawOp(linesSnapEdge,   SNAP),
      },

      [PointsPrimitive]: {
        opaque: new DrawOp(pointsDrawColor, OPAQUE),
        transparent: new DrawOp(pointsDrawColor, TRANSPARENT),
        // highlighted: new DrawOp(pointsSilhouette, HIGHLIGHTED),
        // selected: new DrawOp(pointsSilhouette, SELECTED),
        // xrayed: new DrawOp(pointsSilhouette, XRAYED),
        pick: new DrawOp(pointsPickMesh, PICK)
      }
    };
    return {
      ok: true,
      value: null
    };
  }

  /**
   * Completes the deferred shader build: reads back the program compile/link
   * status (the blocking compile-wait) and caches uniform/attribute locations.
   *
   * Idempotent — a no-op once the batch has been finalized. Must be called
   * before any technique is used to draw, pick, or snap; the render, pick, and
   * snap entry points call it. By the time the first frame reaches here the
   * driver has typically finished compiling in the background, so the wait is
   * short or zero.
   *
   * @returns {@link base!core.SDKResult | SDKResult} carrying any shader
   * compile/link error surfaced by the deferred status read-back.
   */
  public ensureFinalized(): SDKResult<void> {
    if (!this._finalizePending) {
      return {ok: true, value: undefined};
    }
    this._finalizePending = false;

    const tStart = performance.now();
    for (let i = 0, len = this._techniques.length; i < len; i++) {
      const result = this._techniques[i].waitLinked();
      if (!result.ok) {
        this._destroy();
        this._techniques = [];
        return result;
      }
    }
    const tWaited = performance.now();
    for (let i = 0, len = this._techniques.length; i < len; i++) {
      const result = this._techniques[i].extractLocations();
      if (!result.ok) {
        this._destroy();
        this._techniques = [];
        return result;
      }
    }
    const tDone = performance.now();

    if (this._renderContext.debugging) {
      const ms = (a: number) => a.toFixed(1);
      // Most of the wall-clock should land in "compile-wait" — the blocking
      // status read-backs waiting on the concurrently-compiling batch. A small
      // compile-wait here means the driver finished while startup ran in
      // parallel. "extract" is the synchronous uniform/attribute location
      // queries. A large "link" share would indicate compilation isn't being
      // parallelized (no KHR ext, or a driver that compiles synchronously).
      console.log(
        `[shader-compile] ${this._techniques.length} programs in ${ms(this._linkMs + (tDone - tStart))}ms ` +
        `(link ${ms(this._linkMs)}ms, compile-wait ${ms(tWaited - tStart)}ms, ` +
        `extract ${ms(tDone - tWaited)}ms), ` +
        `KHR_parallel_shader_compile=${this._parallelCompile}`,
      );
    }

    return {ok: true, value: undefined};
  }

  /**
   * Notifies all draw techniques that the WebGL context has been restored.
   *
   * This allows techniques to recreate GPU resources after context loss.
   *
   * @returns Result indicating success or failure.
   */
  webglContextRestored(): SDKResult<void> {
    for (let i = 0, len = this._techniques.length; i < len; i++) {
      const result = this._techniques[i].webglContextRestored();
      if (result.ok === false) {
        return result;
      }
    }
    return {
      ok: true,
      value: undefined
    };
  }

  /** @private */
  _destroy() {
    // @ts-ignore
    Object.values(this._techniques).forEach(drawTechnique => drawTechnique.destroy());
  }
}

const drawOpsInstances = {};

/**
 * Gets or creates a set of draw operations for the given RenderContext.
 *
 * @param renderContext The rendering context.
 * @param gpuMemoryReader The GPU memory reader.
 *
 * @internal
 */
export function getDrawOps(renderContext: RenderContext, gpuMemoryReader: GPUMemoryReader): SDKResult<DrawOps> {
  const viewerId = renderContext.viewer.id;
  let drawOps = drawOpsInstances[viewerId];
  if (!drawOps) {
    drawOps = new DrawOps(renderContext, gpuMemoryReader);
    const result = drawOps.init();
    if (!result.ok) {
      // DrawOps init failure cleaned up after itself
      return result;
    }
    drawOpsInstances[viewerId] = drawOps;
  }
  drawOps._useCount++;
  return {
    ok: true,
    value: drawOps
  };
}

/**
 * Releases a DrawOps, destroying it if no longer in use.
 *
 * @param drawOps The DrawOps to release.
 * @internal
 */
export function putDrawOps(drawOps: DrawOps) {
  if (drawOps._useCount === 0) {
    throw new SDKInternalException("DrawOps use count is already zero");
  }
  drawOps._useCount--;
  if (drawOps._useCount === 0) {
    const viewerId = drawOps._renderContext.viewer.id;
    delete drawOpsInstances[viewerId];
    drawOps._destroy();
  }
}
