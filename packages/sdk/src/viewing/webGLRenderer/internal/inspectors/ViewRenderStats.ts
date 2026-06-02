import {type RenderBinStats} from "./RenderBinStats";
import {type TimeMs} from "./TimeMs";

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
}
