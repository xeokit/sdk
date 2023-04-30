import type { FloatArrayParam } from "@xeokit/math";
import type { Camera } from "@xeokit/viewer";
export interface Tile {
    id: string;
    index: number;
    useCount: number;
    center: FloatArrayParam;
    rtcViewMatrix: FloatArrayParam;
}
export declare class TileManager {
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
