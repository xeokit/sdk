import {createMat4, createVec3} from "../../matrix";
import {createRTCViewMat, worldToRTCCenter} from "../../rtc";
import type {FloatArrayParam} from "../../math";
import {View, Viewer} from "../../viewer";
import {type Tile} from "./Tile";
import {DTXMatrixArray} from "./dtx/DTXMatrixArray";

const NUM_VIEWS = 4;
const NUM_TILES = 2000;
const tempVec3a = createVec3();

/**
 * Manages a tiled coordinate system for efficient WebGL rendering.
 *
 * The `TileManager` class handles the allocation, synchronization, and lifecycle of tiles
 * in a tiled coordinate system. It tracks RTC (Relative to Center) matrices for each tile
 * and synchronizes them with camera view matrices to optimize rendering performance.
 *
 * ### Features:
 * - Allocates and manages tiles for a tiled coordinate system.
 * - Tracks world-space centers and RTC matrices for multiple views.
 * - Dynamically moves or reassigns tiles based on world-space positions.
 * - Synchronizes tile RTC matrices with camera view matrices.
 * - Efficiently manages gpuMemory and tile lifecycle.
 *
 * ### Usage:
 * - Retrieve tiles with `getTile(worldPos)`.
 * - Move tiles with `moveTile(tile, worldPos)`.
 * - Release tiles with `putTile(tile)`.
 * - Automatically updates RTC matrices for all views.
 *
 * ### Lifecycle:
 * 1. Attach views and synchronize tiles with `#attachView()`.
 * 2. Retrieve or move tiles as needed for rendering.
 * 3. Release tiles when no longer in use.
 * 4. Clean up resources with `destroy()`.
 *
 * @private
 */
export class TileManager {

  private _gl: WebGL2RenderingContext;
  private _viewer: Viewer;
  private _viewMatrices: DTXMatrixArray[];
  private _tileIndexesUsed: boolean[] = [];
  private _lastFreeTileIndex = 0;
  private _tiles = new Map<string, Tile>();
  private _numTiles = 0;
  private _onCameraViewMatrix: Array<() => void> = [];

  private _onViewCreated: () => void;
  private _onViewDestroyed: () => void;

  /**
   * Creates a tile manager for a WebGLRenderer.
   */
  constructor( gl: WebGL2RenderingContext, viewer: Viewer, viewMatrices: DTXMatrixArray[] ) {
    this._gl = gl;
    this._viewer = viewer;
    // this._allocateDataTextures();
    this._viewMatrices = viewMatrices;
    for (const viewId in viewer.views) {
      this._attachView(viewer.views[viewId]);
    }
    this._onViewCreated = viewer.onViewCreated.sub(( _, view ) => this._attachView(view));
    this._onViewDestroyed = viewer.onViewDestroyed.sub(( _, view ) => this._detachView(view));
  }

  private _attachView( view: View ) {
    this._synchTilesToViewMatrix(view);
    this._onCameraViewMatrix[view.viewIndex] = view.camera.onViewMatrix.sub(() => {
      this._synchTilesToViewMatrix(view);
    });
  }

  private _detachView( view: View ) {
    const viewIndex = view.viewIndex;
    // const dataTexture = this.dataTextures[viewIndex];
    // if (dataTexture) {
    //   delete this.dataTextures[viewIndex];
    //   dataTexture.destroy();
    // }
    view.camera.onViewMatrix.unsub(this._onCameraViewMatrix[viewIndex]);
    delete this._onCameraViewMatrix[viewIndex];
  }

  private _synchTilesToViewMatrix( view: View ) {
    const viewMatrix = view.camera.viewMatrix;
    const viewIndex = view.viewIndex;
    const viewMatrices = this._viewMatrices[viewIndex];
    for (const [_, tile] of this._tiles) {
      const rtcViewMatrix = tile.rtcViewMatrix[viewIndex];
      createRTCViewMat(viewMatrix, tile.center, rtcViewMatrix);
      viewMatrices.setMatrix(tile.tileIndex, rtcViewMatrix);
    }
  }

  private _makeTileId( rtcCenter: FloatArrayParam ): string {
    return rtcCenter.join("-");
  }

  private _createTile( id: string, rtcCenter: FloatArrayParam ): Tile {
    const {viewList, numViews} = this._viewer;
    const center = createVec3(rtcCenter);
    const rtcViewMatrix = Array.from({length: NUM_VIEWS}, ( _, i ) =>
      i < numViews
        ? createRTCViewMat(viewList[i].camera.viewMatrix, center, createMat4())
        : createMat4()
    );
    const tile: Tile = {
      id,
      tileIndex: this._getFreeTileIndex(),
      useCount: 0,              // callers will increment once per acquisition
      center,
      rtcViewMatrix
    };
    for (let viewIndex = 0; viewIndex < NUM_VIEWS; viewIndex++) {
      this._viewMatrices[viewIndex].setMatrix(tile.tileIndex, tile.rtcViewMatrix[viewIndex]);
    }
    this._tiles.set(id, tile);
    this._numTiles++;
    return tile;
  }

  /**
   * Get a Tile that contains the given 3D World-space position.
   * @param worldPos A 3D position in world space.
   */
  getTile( worldPos: FloatArrayParam ): Tile {
    const rtcCenter = worldToRTCCenter(worldPos, tempVec3a);
    const id = this._makeTileId(rtcCenter);
    let tile = this._tiles.get(id) ?? this._createTile(id, rtcCenter);
    tile.useCount++;
    return tile;
  }

  /**
   * Releases a Tile back to the tile manager.
   * The Tile is destroyed as soon as it is released as many times as it was retrieved.
   * @param tile The tile to release.
   */
  putTile( tile: Tile ) {
    if (--tile.useCount === 0) {
      this._tiles.delete(tile.id);
      this._putFreeTileIndex(tile.tileIndex);
    }
  }

  /**
   * Move a Tile, if necessary, so that it contains the given World-space 3D position.
   * @param tile The tile to potentially move.
   * @param worldPos The target world-space position.
   */
  moveTile( tile: Tile, worldPos: FloatArrayParam ): Tile {
    const newRTCCenter = worldToRTCCenter(worldPos, tempVec3a);
    const newId = this._makeTileId(newRTCCenter);
    if (newId === tile.id) {
      return tile;
    }
    this.putTile(tile);
    let newTile = this._tiles.get(newId) ?? this._createTile(newId, newRTCCenter);
    newTile.useCount++;
    return newTile;
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

  private _putFreeTileIndex( index: number ) {
    if (this._tileIndexesUsed[index]) {
      delete this._tileIndexesUsed[index];
      this._lastFreeTileIndex = index;
      this._numTiles--;
    }
  }

  /**
   * Destroys this tile manager.
   */
  destroy() {
    this._onViewCreated();
    this._onViewDestroyed();
  }
}
