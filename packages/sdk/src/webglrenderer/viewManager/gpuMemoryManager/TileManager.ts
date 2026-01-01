import {createMat4Float64, createVec3Float64} from "../../../math";
import {createRTCViewMat, worldToRTCCenter} from "../../../rtc";
import type {Vec3, Mat4} from "../../../math";
import {Camera, View, Viewer} from "../../../viewer";
import {type Tile} from "./Tile";
import {DTXMatrixArray} from "./dtx/DTXMatrixArray";

const NUM_VIEWS = 4;
const NUM_TILES = 2000;
const tempVec3a = createVec3Float64();

/**
 * Manages a tiled coordinate system for efficient WebGL rendering.
 *
 * The `TileManager` class handles the allocation, synchronization, and lifecycle of tiles
 * in a tiled coordinate system. It tracks RTC (Relative to Center) view and pick matrices for each tile
 * and synchronizes them with camera view matrices to optimize rendering performance.

 *
 * @private
 */
export class TileManager {

  private _viewer: Viewer;
  private _viewMatrices: DTXMatrixArray[] = [];
  private _pickMatrices: DTXMatrixArray[] = [];
  private _tileIndexesUsed: boolean[] = [];
  private _lastFreeTileIndex = 0;
  private _tiles = new Map<string, Tile>();
  private _numTiles = 0;

  /**
   * Creates a tile manager for a WebGLRenderer.
   */
  constructor(viewer: Viewer, viewMatrices: DTXMatrixArray[], pickMatrices: DTXMatrixArray[]) {
    this._viewer = viewer;
    // this._allocateDataTextures();
    this._viewMatrices = viewMatrices;
    this._pickMatrices = pickMatrices;
  }

  /**
   * Called when a View's camera view matrix is updated.
   * Synchronizes all tile RTC view matrices to the given Camera's view matrix.
   */
  public cameraViewMatrixUpdated(camera: Camera) {
    this._synchTilesToViewMatrix(camera);
  }

  /**
   * Get a Tile that contains the given 3D World-space position.
   */
  getTile(worldPos: Vec3): Tile {
    const rtcCenter = worldToRTCCenter(worldPos, tempVec3a);
    const id = this._makeTileId(rtcCenter);
    let tile = this._tiles.get(id) ?? this._createTile(id, rtcCenter);
    tile.useCount++;
    //console.log(`TileManager.getTile: getTile id=${id} useCount=${tile.useCount}`);
    return tile;
  }

  /**
   * Releases a Tile back to the tile manager.
   * The Tile is destroyed as soon as it is released as many times as it was retrieved.
   */
  putTile(tile: Tile) {
    if (--tile.useCount === 0) {
      this._tiles.delete(tile.id);
      this._putFreeTileIndex(tile.tileIndex);
      //console.log(`TileManager.putTile: putTile id=${tile.id} DESTROYED`);
    }
  }

  /**
   * Move a Tile, if necessary, so that it contains the given World-space 3D position.
   */
  moveTile(tile: Tile, worldPos: Vec3): Tile {
    const newRTCCenter = worldToRTCCenter(worldPos, tempVec3a);
    const newId = this._makeTileId(newRTCCenter);
    if (newId === tile.id) {
      return tile;
    }
    this.putTile(tile);
    let newTile = this._tiles.get(newId) ?? this._createTile(newId, newRTCCenter);
    newTile.useCount++;
    //console.log(`TileManager.moveTile: moveTile oldId=${tile.id} newId=${newId} useCount=${newTile.useCount}`);
    return newTile;
  }

  /**
   * Number of currently allocated tiles.
   */
  public get numTiles() : number {
    return this._numTiles;
  }

  /**
   * Sets the pick matrices for all tiles for the given view.
   */
  public setPickMatrix(view: View, pickMatrix: Mat4) {
   // console.log(`TileManager.setPickMatrix: viewIndex=${view.viewIndex}`);
    const viewIndex = view.viewIndex;
    const pickMatrices = this._pickMatrices[viewIndex];
    for (const [_, tile] of this._tiles) {
      const rtcPickMatrix = tile.rtcRayPickMatrix[viewIndex];
      createRTCViewMat(pickMatrix, tile.center, rtcPickMatrix);
      pickMatrices.setMatrix(tile.tileIndex, rtcPickMatrix);
    }
  }

  /**
   * Destroys this tile manager.
   */
  destroy() {
    console.log(`TileManager.destroy: Destroying TileManager with ${this._numTiles} tiles`);
  }

  /**
   * Synchronizes all tile RTC view matrices to the given View's camera view matrix.
   */
  private _synchTilesToViewMatrix(camera: Camera) {
  //  console.log(`TileManager._synchTilesToViewMatrix: viewIndex=${camera.view.viewIndex}`);
    const view = camera.view;
    const viewMatrix = camera.viewMatrix;
    const viewIndex = view.viewIndex;
    const viewMatrices = this._viewMatrices[viewIndex];
    for (const [_, tile] of this._tiles) {
      const rtcViewMatrix = tile.rtcViewMatrix[viewIndex];
      createRTCViewMat(viewMatrix, tile.center, rtcViewMatrix);
      viewMatrices.setMatrix(tile.tileIndex, rtcViewMatrix);
      //  console.log(`TileManager: synchTilesToViewMatrix  Tile id=${tile.id} View matrix updated`);
    }
  }

  private _makeTileId(rtcCenter: Vec3): string {
    return rtcCenter.join("-");
  }

  private _createTile(id: string, rtcCenter: Vec3): Tile {
    const {viewList, numViews} = this._viewer;
    const center = createVec3Float64(rtcCenter);
    const rtcViewMatrix = Array.from({length: NUM_VIEWS}, (_, i) =>
      i < numViews
        ? createRTCViewMat(viewList[i].camera.viewMatrix, center, createMat4Float64())
        : createMat4Float64()
    );
    const rtcPickMatrix = Array.from({length: NUM_VIEWS}, (_, i) =>
      i < numViews
        ? createRTCViewMat(viewList[i].camera.viewMatrix, center, createMat4Float64())
        : createMat4Float64()
    );
    const tileIndex = this._getFreeTileIndex();
    const tile: Tile = {
      id,
      tileIndex,
      useCount: 0,              // callers will increment once per acquisition
      center,
      rtcViewMatrix,
      rtcRayPickMatrix: rtcPickMatrix
    };
    for (let viewIndex = 0; viewIndex < NUM_VIEWS; viewIndex++) {
      this._viewMatrices[viewIndex].setMatrix(tileIndex, rtcViewMatrix[viewIndex] as unknown as Mat4);
      this._pickMatrices[viewIndex].setMatrix(tileIndex, rtcPickMatrix[viewIndex] as unknown as Mat4);
    }
    this._tiles.set(id, tile);
    this._numTiles++;
    return tile;
  }

  private _getFreeTileIndex(): number {
    for (let i = this._lastFreeTileIndex; ; i = (i + 1) % NUM_TILES) {
      if (!this._tileIndexesUsed[i]) {
        this._tileIndexesUsed[i] = true;
        this._lastFreeTileIndex = i;
        return i;
      }
    }
  }

  private _putFreeTileIndex(index: number) {
    if (this._tileIndexesUsed[index]) {
      delete this._tileIndexesUsed[index];
      this._lastFreeTileIndex = index;
      this._numTiles--;
    }
  }
}
