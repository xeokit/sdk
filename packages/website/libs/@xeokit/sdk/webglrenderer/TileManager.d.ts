import type { FloatArrayParam } from "../math";
import type { Tile } from "./WebGLTileManager";
/**
 * @private
 */
export interface TileManager {
    getTile(center: FloatArrayParam): Tile;
    putTile(tile: Tile): void;
    moveTile(tile: Tile, newCenter: FloatArrayParam): Tile;
    refreshMatrices(): void;
}
//# sourceMappingURL=TileManager.d.ts.map
