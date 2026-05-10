import {type ViewRenderStats} from "./ViewRenderStats";
import {type TileStats} from "./TileStats";

/**
 * A log of rendering statistics for a single frame.
 */
export interface RenderStats {

  /**
   * Currently existing RTC tiles, mapped to IDs.
   */
  tiles: { [key: string]: TileStats };

  /**
   * Render statistics for each View.
   */
  views?: ViewRenderStats[];
}
