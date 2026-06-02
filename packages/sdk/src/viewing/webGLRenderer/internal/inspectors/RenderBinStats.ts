import {type DrawCallStats} from "./DrawCallStats";
import {type TimeMs} from "./TimeMs";

/**
 * Log entry for a single render bin, made up of multiple draw calls.
 */
export interface RenderBinStats {

  /**
   * Name of the render bin.
   */
  name: string;

  /**
   * Draw calls made within this render bin.
   */
  drawCalls: DrawCallStats[];

  /**
   * Time range for this render bin.
   */
  timeMs?: TimeMs;

  /**
   * GPU time (ms) for this render bin, measured with EXT_disjoint_timer_query_webgl2.
   * Filled in 1–2 frames after the bin ran, once the GPU has reported the query result.
   * Undefined when the extension is unavailable or the result is still pending.
   */
  gpuTimeMs?: number;
}
