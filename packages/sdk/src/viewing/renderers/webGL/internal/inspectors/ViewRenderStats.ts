import {type RenderBinStats} from "./RenderBinStats";
import {type TimeMs} from "./TimeMs";

export interface TriangleVBOGeometryFrameStats {
  handledBatches: number;
  fallbackBatches: number;
  blockedBatches: number;
  handledPrims: number;
  fallbackPrims: number;
  blockedPrims: number;
}

export interface DrawPathFrameStats {
  dtxDrawCalls: number;
  vboDrawCalls: number;
  dtxPrims: number;
  vboPrims: number;
  dtxBatches: number[];
  vboBatches: number[];
  byTechnique: Record<string, {
    drawCalls: number;
    prims: number;
    path: "dtx" | "vbo";
    batchStorage: "dtx" | "vbo";
    hasNormals: boolean;
    hasUVs: boolean;
    edges: boolean;
    picking: boolean;
    snap: number;
  }>;
}

/**
 * Log entry for a single render frame, made up of multiple render passes.
 */
export interface ViewRenderStats {

  /**
   * The View being rendered.
   */
  viewId: string;

  /**
   * Size of the canvas in pixels [width, height].
   */
  canvasSize: [number, number];

  /**
   * Render passes made during this frame.
   */
  renderBins: RenderBinStats[];

  /**
   * Time range for this frame.
   */
  timeMs?: TimeMs;

  /**
   * Total number of draw calls made during this frame.
   */
  numDrawCalls: number;

  /**
   * Total number of primitives rendered during this frame.
   */
  numPrims: number;

  /**
   * Sum of per-bin GPU time (ms) for this frame. Filled in after every bin's query has
   * resolved; undefined when the timer-query extension is unavailable or any bin is
   * still pending.
   */
  gpuTimeMs?: number;

  /**
   * Internal stats for DrawTechnique triangle surface draws that source
   * primitive/index/position geometry from VBOs while keeping mesh/material
   * attributes in data textures.
   *
   * @internal
   */
  vboGeometryTriangles?: TriangleVBOGeometryFrameStats;

  /**
   * Per-frame summary of the geometry draw paths that actually rendered.
   *
   * @internal
   */
  drawPaths?: DrawPathFrameStats;
}
