import {createMat4, createVec3} from "../../matrix";
import {createRTCViewMat, worldToRTCCenter} from "../../rtc";
import type {FloatArrayParam} from "../../math";
import {WebGLDataTexture} from "../../webglutils";
import {View, Viewer} from "../../viewer";
import {type DTXTile} from "./DTXTile";
import {DTXMatrixArray} from "../../webglutils/dtx/DTXMatrixArray";

const NUM_VIEWS = 4;
const NUM_TILES = 2000;
const tempVec3a = createVec3();



/**
 * Manages view matrices for a tiled coordinate system.
 *
 * @internal
 */
export class DTXTiles {

  dataTextures: WebGLDataTexture[] = [];

  #gl: WebGL2RenderingContext;
  #viewer: Viewer;
  #tileIndexesUsed: boolean[] = [];
  #lastFreeTileIndex = 0;
  #tiles = new Map<string, DTXTile>();
  #numTiles = 0;
  #onCameraViewMatrix: Array<() => void> = [];
  #tileIds = new Array(NUM_TILES);

  #onViewCreated: () => void;
  #onViewDestroyed: () => void;
  #viewMatrices: DTXMatrixArray[];

  /**
   * Creates a tile manager for a WebGLRenderer.
   */
  constructor( gl:WebGL2RenderingContext, viewer:Viewer,viewMatrices: DTXMatrixArray[]) {
    this.#gl = gl;
    this.#viewer = viewer;
    //this.#allocateDataTextures();
    this.#viewMatrices = viewMatrices;
    for (const viewId in viewer.views) {
      this.#attachView(viewer.views[viewId]);
    }
    this.#onViewCreated = viewer.onViewCreated.sub((_, view) => this.#attachView(view));
    this.#onViewDestroyed = viewer.onViewDestroyed.sub((_, view) => this.#detachView(view));
  }

  #allocateDataTextures() {
    const gl = this.#gl;
    const textureWidth = 512 * 4;
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
      this.dataTextures.push(new WebGLDataTexture({ gl, texture, textureWidth, textureHeight, textureData }));
    }
  }

  #attachView(view: View) {
    this.#synchTilesToViewMatrix(view);
    this.#onCameraViewMatrix[view.viewIndex] = view.camera.onViewMatrix.sub(() => {
      this.#synchTilesToViewMatrix(view);
    });
  }

  #detachView(view: View) {
    const viewIndex = view.viewIndex;
    // const dataTexture = this.dataTextures[viewIndex];
    // if (dataTexture) {
    //   delete this.dataTextures[viewIndex];
    //   dataTexture.destroy();
    // }
    view.camera.onViewMatrix.unsub(this.#onCameraViewMatrix[viewIndex]);
    delete this.#onCameraViewMatrix[viewIndex];
  }

  #synchTilesToViewMatrix(view: View) {
    const viewMatrix = view.camera.viewMatrix;
    const viewIndex = view.viewIndex;
    const viewMatrices = this.#viewMatrices[viewIndex];
    for (const [_, tile] of this.#tiles) {
      const rtcViewMatrix = tile.rtcViewMatrix[viewIndex];
      createRTCViewMat(viewMatrix, tile.center, rtcViewMatrix);
      viewMatrices.setMatrix(tile.index, rtcViewMatrix);
    }
  }

  /**
   * Get a DTXTile that contains the given 3D World-space position.
   * @param worldPos A 3D position in world space.
   */
  getTile(worldPos: FloatArrayParam): DTXTile {
    const rtcCenter = worldToRTCCenter(worldPos, tempVec3a);
    const id = `${rtcCenter[0]}-${rtcCenter[1]}-${rtcCenter[2]}`;
    let tile = this.#tiles.get(id);
    if (!tile) {
      tile = {
        id,
        index: this.#getFreeTileIndex(),
        useCount: 0,
        center: createVec3(rtcCenter),
        rtcViewMatrix: Array.from({ length: NUM_VIEWS }, () => createMat4())
      };
      this.#tiles.set(id, tile);
      this.#numTiles++;
    }
    tile.useCount++;
    return tile;
  }

  /**
   * Releases a DTXTile back to the tile manager.
   * The DTXTile is destroyed as soon as it is released as many times as it was retrieved.
   * @param tile The tile to release.
   */
  putTile(tile: DTXTile) {
    if (--tile.useCount === 0) {
      this.#tiles.delete(tile.id);
      this.#putFreeTileIndex(tile.index);
    }
  }

  /**
   * Move a DTXTile, if necessary, so that it contains the given World-space 3D position.
   * @param tile The tile to potentially move.
   * @param worldPos The target world-space position.
   */
  moveTile(tile: DTXTile, worldPos: FloatArrayParam): DTXTile {
    const newRTCCenter = worldToRTCCenter(worldPos, createVec3());
    const newId = `${newRTCCenter[0]}-${newRTCCenter[1]}-${newRTCCenter[2]}`;
    if (newId === tile.id) {
      return tile;
    }
    this.putTile(tile);
    let newTile = this.#tiles.get(newId);
    if (!newTile) {
      newTile = {
        id: newId,
        index: this.#getFreeTileIndex(),
        useCount: 0,
        center: createVec3(newRTCCenter),
        rtcViewMatrix: Array.from({ length: NUM_VIEWS }, () => createMat4())
      };
      this.#tiles.set(newId, newTile);
      this.#numTiles++;
    }
    newTile.useCount++;
    return newTile;
  }

  #getFreeTileIndex(): number {
    for (let i = this.#lastFreeTileIndex; ; i = (i + 1) % NUM_TILES) {
      if (!this.#tileIndexesUsed[i]) {
        this.#tileIndexesUsed[i] = true;
        this.#lastFreeTileIndex = i;
        return i;
      }
    }
  }

  #putFreeTileIndex(index: number) {
    if (this.#tileIndexesUsed[index]) {
      delete this.#tileIndexesUsed[index];
      this.#lastFreeTileIndex = index;
      this.#numTiles--;
    }
  }

  /**
   * Destroys this tile manager.
   */
  destroy() {
    this.#viewer.onViewCreated.unsub(this.#onViewCreated);
    this.#viewer.onViewDestroyed.unsub(this.#onViewDestroyed);
    this.dataTextures.forEach(tex => tex.destroy());
    this.dataTextures.length = 0;
  }
}
