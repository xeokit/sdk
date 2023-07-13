import {FloatArrayParam} from "@xeokit/math";
import {Tile} from "./WebGLTileManager";

export interface TileManager {

    getTile(center: FloatArrayParam): Tile;

    putTile(tile: Tile): void;

    updateTileCenter(tile: Tile, newCenter: FloatArrayParam): Tile;

    refreshMatrices(): void;
}