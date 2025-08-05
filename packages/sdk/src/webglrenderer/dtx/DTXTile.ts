import type {FloatArrayParam} from "../../math";

/**
 * A DTXTile within a DTXTiles.
 *
 * @internal
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
