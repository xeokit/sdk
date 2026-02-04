import {type ViewRenderStats} from "./ViewRenderStats";

/**
 * A log of rendering statistics for a single frame.
 */
export interface RenderStats {

  /**
   * Render statistics for each View.
   */
  views?: ViewRenderStats[];
};
