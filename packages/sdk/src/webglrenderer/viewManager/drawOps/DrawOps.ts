import type {GPUMemoryReader} from "../gpuMemoryManager/GPUMemoryReader";
import type {SDKResult} from "../../../core";
import {RenderContext} from "../RenderContext";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../../constants";
import {TrianglesDrawColorTechnique} from "./techniques/triangles/TrianglesDrawColorTechnique";
import {GenericDrawSilhouetteTechnique} from "./techniques/generic/GenericDrawSilhouetteTechnique";
import {PointsDrawColorTechnique} from "./techniques/points/PointsDrawColorTechnique";
import {LinesDrawColorTechnique} from "./techniques/lines/LinesDrawColorTechnique";
import {type RenderPassDrawOps} from "./RenderPassDrawOps";
import {DrawOp} from "./DrawOp";
import {RENDER_PASSES} from "../RENDER_PASSES";
import {TrianglesDrawEdgeSilhouetteTechnique} from "./techniques/triangles/TrianglesDrawEdgeSilhouetteTechnique";
import {DrawTechnique} from "./DrawTechnique";
import {GenericPickMeshTechnique} from "./techniques/generic/GenericPickMeshTechnique";
import {GenericPickDepthTechnique} from "./techniques/generic/GenericPickDepthTechnique";
import {TrianglesDrawEdgeColorTechnique} from "./techniques/triangles/TrianglesDrawEdgeColorTechnique";
import {SDKInternalException} from "../../../core";

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

    const silhouette = saveForCleanup(new GenericDrawSilhouetteTechnique(renderContext, gpuMemoryReader));
    const trianglesDrawColor = saveForCleanup(new TrianglesDrawColorTechnique(renderContext, gpuMemoryReader));
    const trianglesDrawEdgeSilhouette = saveForCleanup(new TrianglesDrawEdgeSilhouetteTechnique(renderContext, gpuMemoryReader));
    const trianglesDrawEdgeColor = saveForCleanup(new TrianglesDrawEdgeColorTechnique(renderContext, gpuMemoryReader));
    const pickMesh = saveForCleanup(new GenericPickMeshTechnique(renderContext, gpuMemoryReader));
    const pickDepth = saveForCleanup(new GenericPickDepthTechnique(renderContext, gpuMemoryReader));
    const linesDrawColor = saveForCleanup(new LinesDrawColorTechnique(renderContext, gpuMemoryReader));
    const pointsDrawColor = saveForCleanup(new PointsDrawColorTechnique(renderContext, gpuMemoryReader));

    for (let i = 0, len = this._techniques.length; i < len; i++) {
      const result = this._techniques[i].init();
      if (!result.ok) {
        for (let j = i - 1; j >= 0; j--) {
          this._techniques[j].destroy();
        }
        this._techniques = [];
        return result;
      }
    }

    const {OPAQUE, TRANSPARENT, HIGHLIGHTED, SELECTED, XRAYED, PICK} = RENDER_PASSES;

    // DrawOp instances are just thin wrappers around DrawTechniques for specific render passes.

    this.prims = {

      [TrianglesPrimitive]: {
        opaque: new DrawOp(trianglesDrawColor, OPAQUE),
        opaqueEdges: new DrawOp(trianglesDrawEdgeColor, OPAQUE),
        transparent: new DrawOp(trianglesDrawColor, TRANSPARENT),
        transparentEdges: new DrawOp(trianglesDrawEdgeColor, TRANSPARENT),
        highlighted: new DrawOp(silhouette, HIGHLIGHTED),
        highlightedEdges: new DrawOp(trianglesDrawEdgeSilhouette, HIGHLIGHTED),
        selected: new DrawOp(silhouette, SELECTED),
        selectedEdges: new DrawOp(trianglesDrawEdgeSilhouette, SELECTED),
        xrayed: new DrawOp(silhouette, XRAYED),
        xrayedEdges: new DrawOp(trianglesDrawEdgeSilhouette, XRAYED),
        pick: new DrawOp(pickMesh, PICK),
        pickDepth: new DrawOp(pickDepth, PICK)
      },

      [LinesPrimitive]: {
        opaque: new DrawOp(linesDrawColor, OPAQUE),
        transparent: new DrawOp(linesDrawColor, TRANSPARENT),
        highlighted: new DrawOp(silhouette, HIGHLIGHTED),
        selected: new DrawOp(silhouette, SELECTED),
        xrayed: new DrawOp(silhouette, XRAYED),
        pick: new DrawOp(pickMesh, PICK),
        pickDepth: new DrawOp(pickDepth, PICK)
      },

      [PointsPrimitive]: {
        opaque: new DrawOp(pointsDrawColor, OPAQUE),
        transparent: new DrawOp(pointsDrawColor, TRANSPARENT),
        // highlighted: new DrawOp(pointsSilhouette, HIGHLIGHTED),
        // selected: new DrawOp(pointsSilhouette, SELECTED),
        // xrayed: new DrawOp(pointsSilhouette, XRAYED),
        pick: new DrawOp(pickMesh, PICK),
        pickDepth: new DrawOp(pickDepth, PICK)
      }
    };
    return {
      ok: true,
      value: null
    };
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

