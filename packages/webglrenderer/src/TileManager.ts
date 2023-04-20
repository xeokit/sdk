import {createMatricesDataTexture} from "./dataTextures";
import {GLDataTexture} from "@xeokit/webglutils";
import {FloatArrayParam} from "@xeokit/math/math";
import {createMat4, createVec3} from "@xeokit/math/matrix";
import {createRTCViewMat, worldToRTCCenter} from "@xeokit/math/rtc";
import {Camera} from "@xeokit/viewer";

const NUM_TILES = 2000;

export interface Tile {
    id: string;
    index: number;
    useCount: number;
    center: FloatArrayParam;
    rtcViewMatrix: FloatArrayParam;
}

export class TileManager {

    #gl: WebGL2RenderingContext;
    #indexesUsed: boolean[];
    #tiles: { [key: string]: Tile };
    #dataTexture: GLDataTexture;
    #camera: Camera;
    #lastFreeIndex: number;

    constructor(params: {
        camera: Camera,
        gl: WebGL2RenderingContext
    }) {
        this.#camera = params.camera;
        this.#gl = params.gl;
        this.#indexesUsed = [];
        this.#lastFreeIndex = 0;
        this.#tiles = {};
        this.#dataTexture = createMatricesDataTexture(this.#gl, NUM_TILES);
    }

    getTile(center: FloatArrayParam): Tile {
        const rtcCenter = worldToRTCCenter(center, createVec3());
        const id = `${rtcCenter[0]}-${rtcCenter[1]}-${rtcCenter[2]}`;
        let tile = this.#tiles[id];
        if (!tile) {
            tile = {
                id,
                index: this.#findFreeTile(),
                useCount: 0,
                center: createVec3(),
                rtcViewMatrix: createMat4()
            };
            this.#tiles[tile.id] = tile;
        }
        tile.useCount++;
        return tile;
    }

    putTile(tile: Tile) {
        if (--tile.useCount <= 0) {
            delete this.#tiles[tile.id];
            this.#putFreeTile(tile.index);
        }
    }

    updateTileCenter(tile: Tile, newCenter: FloatArrayParam): Tile {
        const newRTCCenter = worldToRTCCenter(newCenter, createVec3());
        const newId = `${newRTCCenter[0]}-${newRTCCenter[1]}-${newRTCCenter[2]}`;
        if (newId === tile.id) {
            return tile;
        }
        this.putTile(tile);
        let newTile = this.#tiles[newId];
        if (!newTile) {
            newTile = {
                id: newId,
                index: this.#findFreeTile(),
                useCount: 0,
                center: createVec3(),
                rtcViewMatrix: createMat4()
            };
            this.#tiles[newTile.id] = newTile;
        }
        newTile.useCount++;
        return newTile;
    }

    refreshMatrices() {
        if (!this.#dataTexture.texture) {
            return;
        }
        const gl = this.#gl;
        const viewMatrix = this.#camera.viewMatrix;
        const tileIds = Object.keys(this.#tiles);
        const numTiles = tileIds.length;
        const data = new Float32Array(16 * numTiles);
        for (let i = 0, len = tileIds.length; i < len; i++) {
            const tileId = tileIds[i];
            const tile = this.#tiles[tileId];
            createRTCViewMat(viewMatrix, tile.center, tile.rtcViewMatrix);
            data.set(tile.rtcViewMatrix, tile.index * 16);
        }
        gl.bindTexture(gl.TEXTURE_2D, this.#dataTexture.texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RGBA, gl.FLOAT, data);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    #putFreeTile(index: number) {
        delete this.#indexesUsed[index];
        this.#lastFreeIndex = index;
    }

    #findFreeTile(): number {
        for (let index = this.#lastFreeIndex; ; index = (index + 1) % NUM_TILES) {
            if (!this.#indexesUsed[index]) {
                this.#indexesUsed[index] = true;
                return index;
            }
        }
    }


}