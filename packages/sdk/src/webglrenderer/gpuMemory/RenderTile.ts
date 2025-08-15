import type {FloatArrayParam} from "../../math";

/**
 * Represents a single tile in a tiled coordinate system.
 *
 * Tracks world-space positions, RTC matrices, and usage counts for efficient rendering
 * and memory management. Integrates with `TileManager` to manage tile-based rendering.
 *
 * ### Features:
 * - Stores world-space center and RTC matrices for multiple views.
 * - Tracks usage count for efficient memory allocation.
 * - Supports dynamic movement and reassignment within the tiled system.
 *
 * @interface
 */
export interface RenderTile {

  /**
   * Unique ID of this RenderTile
   */
  id: string;

  /**
   * Index of this RenderTile within TileManager
   */
  index: number;

  /**
   * Count of users of this tile.
   */
  useCount: number;

  /**
   * World-space 3D tile center
   */
  center: FloatArrayParam;

  /**
   * An RTC view matrix for each existing View
   */
  rtcViewMatrix: FloatArrayParam[];
}
