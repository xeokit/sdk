
import {WebGLDataTexture} from "@xeokit/webglutils";
import type {FloatArrayParam} from "@xeokit/math";
import {createMat4, createVec3} from "@xeokit/matrix";
import {createRTCViewMat, worldToRTCCenter} from "@xeokit/rtc";
import type {Camera} from "@xeokit/viewer";
import type {TileManager} from "./TileManager";

const NUM_TILES = 2000;

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
export class WebGLTileManager implements TileManager {

    #gl: WebGL2RenderingContext;
    #indexesUsed: boolean[];
    #tiles: { [key: string]: Tile };
    #dataTexture: WebGLDataTexture;
    #camera: Camera;
    #lastFreeIndex: number;
    #numTiles: number;

    constructor(params: {
        camera: Camera,
        gl: WebGL2RenderingContext
    }) {
        this.#camera = params.camera;
        this.#gl = params.gl;
        this.#indexesUsed = [];
        this.#lastFreeIndex = 0;
        this.#tiles = {};
        this.#dataTexture = this.#createMatricesDataTexture(NUM_TILES);
        this.#numTiles = 0;
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
            this.#numTiles++;
        }
        tile.useCount++;
        return tile;
    }

    putTile(tile: Tile) {
        if (--tile.useCount === 0) {
            delete this.#tiles[tile.id];
            this.#putFreeTile(tile.index);
            this.#numTiles--;
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
        const tileIds = Object.keys(this.#tiles);
        const numTiles = tileIds.length;
        if (numTiles > 0) {
            const gl = this.#gl;
            const viewMatrix = this.#camera.viewMatrix;
            const data = new Float32Array(16 * numTiles);
            for (let i = 0; i < numTiles; i++) {
                const tileId = tileIds[i];
                const tile = this.#tiles[tileId];
                createRTCViewMat(viewMatrix, tile.center, tile.rtcViewMatrix);
                data.set(tile.rtcViewMatrix, tile.index * 16);
            }
            gl.bindTexture(gl.TEXTURE_2D, this.#dataTexture.texture);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RGBA, gl.FLOAT, data);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
    }

    #putFreeTile(index: number) {
        if (this.#indexesUsed[index]) {
            delete this.#indexesUsed[index];
            this.#lastFreeIndex = index;
            this.#numTiles--;
        }
    }

    #findFreeTile(): number {
        for (let index = this.#lastFreeIndex; ; index = (index + 1) % NUM_TILES) {
            if (!this.#indexesUsed[index]) {
                this.#indexesUsed[index] = true;
                return index;
            }
        }
    }

    #createMatricesDataTexture(numMatrices: number): WebGLDataTexture {
        if (numMatrices === 0) {
            throw "num instance matrices===0";
        }
        // in one row we can fit 512 matrices
        const textureWidth = 512 * 4;
        const textureHeight = Math.ceil(numMatrices / (textureWidth / 4));
        const textureData = new Float32Array(4 * textureWidth * textureHeight);
        // dataTextureRamStats.sizeDataPositionDecompressMatrices += textureData.byteLength;
        const gl = this.#gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, textureWidth, textureHeight);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGBA, gl.FLOAT, textureData, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return new WebGLDataTexture({gl, texture, textureWidth, textureHeight, textureData});
    }
}
