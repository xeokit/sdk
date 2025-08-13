import type {FloatArrayParam} from "../../math";

/**
 * Represents a single tile in a tiled coordinate system.
 *
 * Tracks world-space positions, RTC matrices, and usage counts for efficient rendering
 * and memory management. Integrates with `DTXTiles` to manage tile-based rendering.
 *
 * ### Features:
 * - Stores world-space center and RTC matrices for multiple views.
 * - Tracks usage count for efficient memory allocation.
 * - Supports dynamic movement and reassignment within the tiled system.
 *
 * @interface
 */
export interface DTXTile {

  /**
   * Unique ID of this DTXTile
   */
  id: string;

  /**
   * Index of this DTXTile within DTXTiles
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
