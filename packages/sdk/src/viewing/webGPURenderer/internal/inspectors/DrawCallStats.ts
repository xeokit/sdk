import type {TimeMs} from "./TimeMs";

/**
 * Log entry for one submitted WebGPU draw call.
 *
 * @internal
 */
export interface DrawCallStats {
  renderPass: string;
  primitive: "TRIANGLES" | "EDGES";
  technique: string;
  batchLabel: string;
  segmentKey: string;
  bufferPageKey?: string;
  renderStateKey?: string;
  indexCount: number;
  numPrims: number;
  instanceCount: number;
  timeMs?: TimeMs;
}
