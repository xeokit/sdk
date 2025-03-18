import type { FloatArrayParam } from "../math";
import type { Camera } from "../viewer";
import type { TileManager } from "./TileManager";
/**
 * @private
 */
export interface Tile {
    id: string;
    index: number;
    useCount: number;
    center: FloatArrayParam;
    rtcViewMatrix: FloatArrayParam;
}
/**
 * @private
 */
export declare class WebGLTileManager implements TileManager {
    #private;
    constructor(params: {
        camera: Camera;
        gl: WebGL2RenderingContext;
    });
    getTile(center: FloatArrayParam): Tile;
    putTile(tile: Tile): void;
    updateTileCenter(tile: Tile, newCenter: FloatArrayParam): Tile;
    refreshMatrices(): void;
}
//# sourceMappingURL=WebGLTileManager.d.ts.map