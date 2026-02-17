/**
 * Represents statistics for an RTC tile.
 */
export interface TileStats {

    /**
    * Unique identifier for the tile.
    */
    id: string;

  /**
   * The 3D center of the tile in world coordinates [x, y, z].
   */
  rtcCenter : [number, number, number];

  /**
   * The index of the tile within the renderer.
   */
  tileIndex: number;

  /**
   * The number of meshes contained within this tile.
   */
  numMeshes: number;
}
