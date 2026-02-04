import {type RenderBinLog} from "./RenderBinLog";
import {type TimeMs} from "./TimeMs";

/**
 * Log entry for a single render frame, made up of multiple render passes.
 */
export interface FrameLog {

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
  renderBins: RenderBinLog[];

  /**
   * Time range for this frame.
   */
  timeMs?: TimeMs;

  /**
   * Total number of draw calls made during this frame.
   */
  numDrawCalls: number;
}
