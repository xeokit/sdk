import {createMat4Float64} from "../../../math/matrix";
import {createVec3Float64} from "../../../math/vector";
import {createRTCViewMat, getRTCTileSize, worldToRTCCenter} from "../../../math/rtc";
import type { Mat4} from "../../../math/matrix";
import type {Vec3} from "../../../math/vector";
import {Camera, View} from "../../../viewer";
import {type GPUTile} from "./GPUTile";
import {MatrixTexture} from "./dataTextures/MatrixTexture";
import {RenderContext} from "./../RenderContext";

const tempVec3a = createVec3Float64();

/**
 * Manages a tiled coordinate system for efficient WebGL rendering.
 *
 * Owned and used internally by {@link GPUMemoryManager}.
 *
 * The `GPUTileManager` class handles the allocation, synchronization, and lifecycle of tiles
 * in a tiled coordinate system. It tracks RTC (Relative to Center) view and pick matrices for each tile
 * and synchronizes them with camera view matrices to optimize rendering performance.

 * @internal
 */
export class GPUTileManager {
  private _renderContext: RenderContext;
  private _viewTileCameraMatrixTexture: MatrixTexture[] = [];
  private _viewTilePickMatrixTexture: MatrixTexture[] = [];
  private _tileIndexesUsed: boolean[] = [];
  private _lastFreeTileIndex = 0;
  private _tiles = new Map<string, GPUTile>();
  private _numTiles = 0;

  /**
   * Creates a tile manager for a WebGLRenderer.
   */
  constructor(
    renderContext: RenderContext,
    viewTileCameraMatrixTexture: MatrixTexture[],
    viewTilePickMatrixTexture: MatrixTexture[]) {
    this._renderContext = renderContext;
    this._viewTileCameraMatrixTexture = viewTileCameraMatrixTexture;
    this._viewTilePickMatrixTexture = viewTilePickMatrixTexture;
  }

  /**
   * Called when a View's camera view matrix is updated.
   * Synchronizes all tile RTC view matrices to the given Camera's view matrix.
   */
  public cameraViewMatrixUpdated(camera: Camera) {
    if (camera.view.viewIndex >= this._renderContext.memoryConfigs.maxViews) {
      return;
    }
    this._synchTilesToViewMatrix(camera);
  }

  /**
   * Get a GPUTile that contains the given 3D World-space position.
   */
  getTile(worldPos: Vec3): GPUTile {
    const tileSize = getRTCTileSize(worldPos);
    const rtcCenter = worldToRTCCenter(worldPos, tempVec3a, tileSize);
    const id = this._makeTileId(rtcCenter);
    let tile = this._tiles.get(id) ?? this._createTile(id, rtcCenter, tileSize);
    tile.useCount++;
    if (this._renderContext.renderInspector.enabled) {
      this._renderContext.renderInspector.tileAcquired(tile);
    }
    return tile;
  }

  /**
   * Releases a GPUTile back to the tile manager.
   * The GPUTile is destroyed as soon as it is released as many times as it was retrieved.
   */
  putTile(tile: GPUTile) {
    tile.useCount--;
    if (this._renderContext.renderInspector.enabled) {
      this._renderContext.renderInspector.tileReleased(tile);
    }
    if (tile.useCount === 0) {
      this._tiles.delete(tile.id);
      this._putFreeTileIndex(tile.tileIndex);
    }
  }

  /**
   * Move a GPUTile, if necessary, so that it contains the given World-space 3D position.
   */
  moveTile(tile: GPUTile, worldPos: Vec3): GPUTile {
    const tileSize = getRTCTileSize(worldPos);
    const newRTCCenter = worldToRTCCenter(worldPos, tempVec3a, tileSize);
    const newId = this._makeTileId(newRTCCenter);
    if (newId === tile.id) {
      return tile;
    }
    this.putTile(tile);
    let newTile = this._tiles.get(newId) ?? this._createTile(newId, newRTCCenter, tileSize);
    newTile.useCount++;
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
  public setViewPickMatrix(view: View, pickMatrix: Mat4) {
    const viewIndex = view.viewIndex;
    if (viewIndex >= this._renderContext.memoryConfigs.maxViews) {
      return;
    }
    const viewTilePickMatrixTexture = this._viewTilePickMatrixTexture[viewIndex];
    for (const [_, tile] of this._tiles) {
      const rtcPickMatrix = tile.rtcRayPickMatrix[viewIndex];
      createRTCViewMat(pickMatrix, tile.center, rtcPickMatrix);
      viewTilePickMatrixTexture.setItem(tile.tileIndex, rtcPickMatrix);
    }
  }

  /**
   * Destroys this tile manager.
   */
  destroy() {
    console.log(`GPUTileManager.destroy: Destroying GPUTileManager with ${this._numTiles} tiles`);
  }

  /**
   * Synchronizes all tile RTC view matrices to the given View's camera view matrix.
   */
  private _synchTilesToViewMatrix(camera: Camera) {
    const view = camera.view;
    const viewMatrix = camera.viewMatrix;
    const viewIndex = view.viewIndex;
    const matrixTexture = this._viewTileCameraMatrixTexture[viewIndex];
    if (!matrixTexture) {
      console.warn(`[GPUTileManager] No camera matrix texture for view index ${viewIndex}`);
      return;
    }
    for (const [_, tile] of this._tiles) {
      const rtcViewMatrix = tile.rtcViewMatrix[viewIndex];
      createRTCViewMat(viewMatrix, tile.center, rtcViewMatrix);
      matrixTexture.setItem(tile.tileIndex, rtcViewMatrix);
    }
  }

  private _makeTileId(rtcCenter: Vec3): string {
    return rtcCenter.join("-");
  }

  private _createTile(id: string, rtcCenter: Vec3, tileSize: number): GPUTile {
    const {viewList} = this._renderContext.viewer;
    const center = createVec3Float64(rtcCenter);
    const numViews = this._renderContext.memoryConfigs.maxViews;
    const rtcViewMatrix = Array.from({length: numViews}, (_, i) =>
      i < numViews
        ? createRTCViewMat(viewList[i].camera.viewMatrix, center, createMat4Float64())
        : createMat4Float64()
    );
    const rtcPickMatrix = Array.from({length: numViews}, (_, i) =>
      i < numViews
        ? createRTCViewMat(viewList[i].camera.viewMatrix, center, createMat4Float64())
        : createMat4Float64()
    );
    const tileIndex = this._getFreeTileIndex();
    const tile: GPUTile = {
      id,
      tileIndex,
      useCount: 0,              // callers will increment once per acquisition
      center,
      size: tileSize,
      rtcViewMatrix,
      rtcRayPickMatrix: rtcPickMatrix
    };
    for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
      this._viewTileCameraMatrixTexture[viewIndex].setItem(tileIndex, rtcViewMatrix[viewIndex] as unknown as Mat4);
      this._viewTilePickMatrixTexture[viewIndex].setItem(tileIndex, rtcPickMatrix[viewIndex] as unknown as Mat4);
    }
    this._tiles.set(id, tile);
    this._numTiles++;
    return tile;
  }

  private _getFreeTileIndex(): number {
    const numTiles = this._renderContext.memoryConfigs.maxTiles;
    for (let i = this._lastFreeTileIndex; ; i = (i + 1) % numTiles) {
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
