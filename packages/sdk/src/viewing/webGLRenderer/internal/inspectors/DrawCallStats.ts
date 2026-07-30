
import {type PrimRange} from "../gpuMemoryManager/geometry/PrimRange";
import {type TimeMs} from "./TimeMs";

/**
 * Log entry for a single draw call.
 */
export interface DrawCallStats {

  /**
   * The render pass for this draw call.
   */
  renderPass: string;

  /**
   * The type of primitive being drawn (e.g., "TRIANGLES", "LINES").
   */
  primitive: string;

  /**
   * The range of primitives being drawn.
   */
  primRange: PrimRange;

  /**
   * Time range for this draw call.
   */
  timeMs?: TimeMs;

  /**
   * The MeshBatch being drawn.
   */
  batchIndex: number;
}
