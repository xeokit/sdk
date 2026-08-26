import type {DrawCallStats} from "./DrawCallStats";
import type {TimeMs} from "./TimeMs";
import type {CommandEncoderStats} from "./CommandEncoderStats";

/**
 * Log entry for one WebGPU render bin.
 *
 * @internal
 */
export interface RenderBinStats {
  name: string;
  drawCalls: DrawCallStats[];
  commandState: CommandEncoderStats;
  timeMs?: TimeMs;
}
