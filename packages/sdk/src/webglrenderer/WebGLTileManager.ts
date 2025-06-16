import {createMat4, createVec3} from "../matrix";
import {createRTCViewMat, worldToRTCCenter} from "../rtc";
import type {FloatArrayParam} from "../math";
import {WebGLDataTexture} from "../webglutils";
import {WebGLRenderer} from "./WebGLRenderer";
import {View, Viewer} from "../viewer";

const NUM_VIEWS = 4;
const NUM_TILES = 2000;

const tempVec3a = createVec3();

/**
 * A Tile within a WebGLTileManager.
 *
 * @internal
 */
export interface Tile {

  /**
   * Unique ID of this Tile
   */
  id: string;

  /**
   * Index of this Tile within the WebGLTileManager
   */
  index: number;

  /**
   * Count of mshes in this tile.
   */
  useCount: number;

  /**
   * World-space 3D tile center
   */
  center: FloatArrayParam;

  /**
   * An RTC view matrix for each View
   */
  rtcViewMatrix: FloatArrayParam[];
}

/**
 * Manages view matrices for a tiled coordinate system.
 *
 * @internal
 */
export class WebGLTileManager {

  #viewer: Viewer;
  #tileIndexesUsed: boolean[];
  #tiles: { [key: string]: Tile };
  #lastFreeTileIndex: number;
  #numTiles: number;
  #webglRenderer: WebGLRenderer;

  #onViewCreated: () => void;
  #onViewDestroyed: () => void;

  #onCameraViewMatrix: (()=>void)[];

  /**
   * A data texture for each View, containing an RTC view matrix for each Tile.
   * Each data texture gets updated with new matrices for each tile each time its View's Camera moves.
   * This is indexed with View.viewIndex.
   */
  dataTextures: WebGLDataTexture[];

  /**
   * Creates a tile manager for a Viewer and WebGLRenderer.
   * @param viewer
   * @param webGLRenderer
   */
  constructor(viewer: Viewer, webGLRenderer: WebGLRenderer) {

    this.#webglRenderer = webGLRenderer;

    this.#viewer = viewer;
    this.#tileIndexesUsed = [];
    this.#lastFreeTileIndex = 0;
    this.#tiles = {};
    this.#numTiles = 0;

    /**
     * A data texture per View, each holding an RTC View matrix for each tile
     */
    this.dataTextures = [];

    this.#initDataTextures();

    this.#onCameraViewMatrix = [];

    for (let viewId in viewer.views) {
      const view = viewer.views[viewId];
      this.#attachView(view);
    }

    this.#onViewCreated = this.#viewer.onViewCreated.sub((viewer, view) => {
      this.#attachView(view);
    });

    this.#onViewDestroyed = this.#viewer.onViewDestroyed.sub((viewer, view) => {
      this.#detachView(view);
    });
  }

   #attachView(view: View) {
    this.#updateDataTextures(view);
    this.#onCameraViewMatrix[view.viewIndex] = view.camera.onViewMatrix.sub(() => {
      this.#updateDataTextures(view);
    });
  }

  #detachView(view: View) {
    const viewIndex = view.viewIndex;
    const dataTexture = this.dataTextures[viewIndex];
    if (dataTexture) {
      delete this.dataTextures[viewIndex];
      dataTexture.destroy();
    }
    view.camera.onViewMatrix.unsub(this.#onCameraViewMatrix[viewIndex]);
    delete this.#onCameraViewMatrix[viewIndex];
  }

  #initDataTextures() {
    const gl = this.#webglRenderer.gl;
    const textureWidth = 512 * 4; // In one row we can fit 512 matrices
    const textureHeight = Math.ceil(NUM_TILES / (textureWidth / 4));
    for (let i = 0; i < NUM_VIEWS; i++) {
      const textureData = new Float32Array(4 * textureWidth * textureHeight);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, textureWidth, textureHeight);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGBA, gl.FLOAT, textureData, 0);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
      this.dataTextures.push(new WebGLDataTexture({gl, texture, textureWidth, textureHeight, textureData}));
    }
  }

  #updateDataTextures(view: View) {
    const viewMatrix = view.camera.viewMatrix;
    const viewIndex = view.viewIndex;
    const tileIds = Object.keys(this.#tiles);
    const numTiles = tileIds.length;
    if (numTiles > 0) {
      const gl = this.#webglRenderer.gl;
      const data = new Float32Array(16 * numTiles);
      for (let i = 0; i < numTiles; i++) {
        const tileId = tileIds[i];
        const tile = this.#tiles[tileId];
        createRTCViewMat(viewMatrix, tile.center, tile.rtcViewMatrix[viewIndex]);
        data.set(<any>tile.rtcViewMatrix[viewIndex], tile.index * 16);
      }
      gl.bindTexture(gl.TEXTURE_2D, this.dataTextures[viewIndex].texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RGBA, gl.FLOAT, data);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
  }

  /**
   * Get a Tile that contains the given 3D World-space position.
   * @param worldPos
   */
  getTile(worldPos: FloatArrayParam): Tile {
    const rtcCenter = worldToRTCCenter(worldPos, tempVec3a);
    const id = `${rtcCenter[0]}-${rtcCenter[1]}-${rtcCenter[2]}`;
    let tile = this.#tiles[id];
    if (!tile) {
      tile = {
        id,
        index: this.#getFreeTileIndex(),
        useCount: 0,
        center: createVec3(rtcCenter),
        rtcViewMatrix: [
          createMat4(),
          createMat4(),
          createMat4(),
          createMat4()
        ]
      };
      this.#tiles[tile.id] = tile;
      this.#numTiles++;
    }
    tile.useCount++;
    return tile;
  }

  /**
   * Releases a Tile back to the tile manager.
   * The Tile is destroyed as soon as it is released as many times as it was got.
   * @param tile
   */
  putTile(tile: Tile) {
    if (--tile.useCount === 0) {
      delete this.#tiles[tile.id];
      this.#putFreeTileIndex(tile.index);
      this.#numTiles--;
    }
  }

  /**
   * Move a Tile, if neccessary, so that it contains the given World-space 3D position.
   * @param tile
   * @param worldPos
   */
  moveTile(tile: Tile, worldPos: FloatArrayParam): Tile {
    const newRTCCenter = worldToRTCCenter(worldPos, createVec3());
    const newId = `${newRTCCenter[0]}-${newRTCCenter[1]}-${newRTCCenter[2]}`;
    if (newId === tile.id) {
      return tile;
    }
    this.putTile(tile);
    let newTile = this.#tiles[newId];
    if (!newTile) {
      newTile = {
        id: newId,
        index: this.#getFreeTileIndex(),
        useCount: 0,
        center: createVec3(),
        rtcViewMatrix: [
          createMat4(),
          createMat4(),
          createMat4(),
          createMat4()
        ]
      };
      this.#tiles[newTile.id] = newTile;
    }
    newTile.useCount++;
    return newTile;
  }

  #getFreeTileIndex(): number {
    for (let tileIndex = this.#lastFreeTileIndex; ; tileIndex = (tileIndex + 1) % NUM_TILES) {
      if (!this.#tileIndexesUsed[tileIndex]) {
        this.#tileIndexesUsed[tileIndex] = true;
        return tileIndex;
      }
    }
  }

  #putFreeTileIndex(tileIndex: number) {
    if (this.#tileIndexesUsed[tileIndex]) {
      delete this.#tileIndexesUsed[tileIndex];
      this.#lastFreeTileIndex = tileIndex;
      this.#numTiles--;
    }
  }

  /**
   * Destroys this tile manager.
   */
  destroy() {
    this.#viewer.onViewCreated.unsub(this.#onViewCreated);
    this.#viewer.onViewCreated.unsub(this.#onViewDestroyed);
  }
}
