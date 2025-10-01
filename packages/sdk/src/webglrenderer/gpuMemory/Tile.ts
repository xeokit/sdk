import type {FloatArrayParam} from "../../math";

/**
 * Represents a single tile in a tiled coordinate system.
 *
 * Tracks world-space positions, RTC matrices, and usage counts for efficient rendering
 * and gpuMemory management. Integrates with `TileManager` to manage tile-based rendering.
 *
 * ### Features:
 * - Stores world-space center and RTC matrices for multiple views.
 * - Tracks usage count for efficient gpuMemory allocation.
 * - Supports dynamic movement and reassignment within the tiled system.
 *
 * @interface
 */
export interface Tile {

  /**
   * Unique ID of this Tile
   */
  id: string;

  /**
   * Index of this Tile within TileManager
   */
  tileIndex: number;

  /**
   * Count of users of this tile.
   */
  useCount: number;

  /**
   * World-space 3D tile center
   */
  center: FloatArrayParam;

  /**
   * A relative-to-center (RTC) view matrix for each existing View. This is stored in DataTexturesLayer.tileViewMatrices
   * and automatically updates on all Tiles whenever the View's Camera moves.
   */
  rtcViewMatrix: FloatArrayParam[];

  /**
   * A relative-to-center (RTC) pick matrix for each existing View. This is stored in DataTexturesLayer.tileRayPickMatrices
   * and is manually updated on all Tiles for a target View before picking in that View.
   */
  rtcRayPickMatrix: FloatArrayParam[];
}
