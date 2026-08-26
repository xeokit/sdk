import type {ViewRenderStats} from "./ViewRenderStats";

/**
 * Aggregate WebGPU render stats.
 *
 * @internal
 */
export interface RenderStats {
  views?: ViewRenderStats[];
}
