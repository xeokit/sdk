import {type DrawCallLog} from "./DrawCallLog";
import {type TimeMs} from "./TimeMs";

/**
 * Log entry for a single render bin, made up of multiple draw calls.
 */
export interface RenderBinLog {

  /**
   * Name of the render bin.
   */
  name: string;

  /**
   * Draw calls made within this render bin.
   */
  drawCalls: DrawCallLog[];

  /**
   * Time range for this render bin.
   */
  timeMs?: TimeMs;
}
