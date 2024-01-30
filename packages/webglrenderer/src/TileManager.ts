import type {FloatArrayParam} from "@xeokit/math";
import type {Tile} from "./WebGLTileManager";

/**
 * @private
 */
export interface TileManager {

    getTile(center: FloatArrayParam): Tile;

    putTile(tile: Tile): void;

    updateTileCenter(tile: Tile, newCenter: FloatArrayParam): Tile;

    refreshMatrices(): void;
}