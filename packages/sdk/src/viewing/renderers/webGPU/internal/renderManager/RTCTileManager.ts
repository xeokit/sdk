import {SDKErrorType, type SDKResult} from "../../../../../base/core";
import {createMat4Float64, mulMat4, transformVec4, type Mat4} from "../../../../../base/math/matrix";
import {worldToRTCCenter} from "../../../../../base/math/rtc";
import {createVec3Float64, type Vec3} from "../../../../../base/math/vector";
import type {View} from "../../../../viewer";
import type {WebGPUBufferLike} from "../../core";
import {GPU_BUFFER_USAGE, RTC_TILE_BYTES, RTC_TILE_FLOATS, WEBGPU_CLIP_SPACE_MATRIX} from "../constants";
import {RenderContext} from "../RenderContext";

export interface WebGPURTCTilePlacement {
  tileIndex: number;
  center: Vec3;
}

interface RTCTile {
  id: string;
  tileIndex: number;
  center: Vec3;
  useCount: number;
}

export interface RTCTileManagerStats {
  tiles: number;
  tileMatrixUploads: number;
  meshesWithRTCTile: number;
  meshesUsingFallback: number;
}

export interface RTCTileMemoryStats {
  capacity: number;
  tiles: number;
  bytes: number;
}

const tempRTCCenter = createVec3Float64();
const tempClipCenter = new Float64Array(4);
const tempWorldCenter = new Float64Array(4);
const tempWebGPUViewProjection = createMat4Float64();
const tempTileMatrix = createMat4Float64();

/**
 * Owns WebGPU RTC tile assignment and per-tile view-projection matrices.
 *
 * Meshes keep dynamic tile membership independent of packed geometry storage:
 * moving a mesh between RTC tiles rewrites only its instance record with a new
 * tile index and tile-relative model matrix.
 *
 * @internal
 */
export class RTCTileManager {

  private readonly _renderContext: RenderContext;
  private readonly _tiles = new Map<string, RTCTile>();
  private readonly _meshTileIds = new Map<string, string>();
  private readonly _fallbackMeshIds = new Set<string>();
  private readonly _tileIndexesUsed: boolean[] = [];
  private _lastTileMatrixUploads = 0;
  private _buffer: WebGPUBufferLike | null = null;

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
  }

  public get buffer(): WebGPUBufferLike {
    if (this._buffer) {
      return this._buffer;
    }
    this._buffer = this._renderContext.device.createBuffer({
      label: "xeokit-webgpu-rtc-tile-buffer",
      size: Math.max(1, this._renderContext.memoryConfigs.maxTiles) * RTC_TILE_BYTES,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    });
    this._writeOriginTile();
    return this._buffer;
  }

  public assignMesh(meshId: string, worldCenter: Vec3): WebGPURTCTilePlacement {
    const tileSize = this._renderContext.memoryConfigs.tileSize;
    if (!Number.isFinite(tileSize) || tileSize <= 0 || this._getMaxTiles() <= 1) {
      return {
        tileIndex: 0,
        center: ORIGIN_TILE_CENTER
      };
    }

    const rtcCenter = worldToRTCCenter(worldCenter, tempRTCCenter, tileSize);
    const previousTileId = this._meshTileIds.get(meshId);
    if (rtcCenter[0] === 0 && rtcCenter[1] === 0 && rtcCenter[2] === 0) {
      if (previousTileId) {
        this._meshTileIds.delete(meshId);
        this._releaseTile(previousTileId);
      }
      this._fallbackMeshIds.delete(meshId);
      return {
        tileIndex: 0,
        center: ORIGIN_TILE_CENTER
      };
    }
    const tileId = this._makeTileId(rtcCenter);
    if (previousTileId === tileId) {
      const existing = this._tiles.get(tileId);
      if (existing) {
        this._fallbackMeshIds.delete(meshId);
        return existing;
      }
    }

    if (previousTileId) {
      this._releaseTile(previousTileId);
    }

    const existingTile = this._tiles.get(tileId);
    const tile = existingTile ?? this._createTile(tileId, rtcCenter);
    if (!tile) {
      this._fallbackMeshIds.add(meshId);
      return {
        tileIndex: 0,
        center: ORIGIN_TILE_CENTER
      };
    }
    tile.useCount++;
    this._meshTileIds.set(meshId, tileId);
    this._fallbackMeshIds.delete(meshId);
    return tile;
  }

  public releaseMesh(meshId: string): void {
    const tileId = this._meshTileIds.get(meshId);
    if (!tileId) {
      this._fallbackMeshIds.delete(meshId);
      return;
    }
    this._meshTileIds.delete(meshId);
    this._fallbackMeshIds.delete(meshId);
    this._releaseTile(tileId);
  }

  public releaseAll(): void {
    this._meshTileIds.clear();
    this._fallbackMeshIds.clear();
    this._tiles.clear();
    this._tileIndexesUsed.length = 0;
    this._lastTileMatrixUploads = 0;
  }

  public getStats(): RTCTileManagerStats {
    return {
      tiles: this._tiles.size,
      tileMatrixUploads: this._lastTileMatrixUploads,
      meshesWithRTCTile: this._meshTileIds.size,
      meshesUsingFallback: this._fallbackMeshIds.size
    };
  }

  public getMemoryStats(): RTCTileMemoryStats {
    const capacity = this._getMaxTiles();
    return {
      capacity,
      tiles: this._tiles.size,
      bytes: capacity * RTC_TILE_BYTES
    };
  }

  public writeTileMatrices(view: View): SDKResult<void> {
    const camera = view.camera;
    const viewMatrix = camera.viewMatrix as Mat4;
    const projMatrix = camera.projMatrix as Mat4;
    mulMat4(projMatrix, viewMatrix, tempWebGPUViewProjection);
    mulMat4(WEBGPU_CLIP_SPACE_MATRIX as Mat4, tempWebGPUViewProjection, tempWebGPUViewProjection);
    return this.writeTileMatricesForWebGPUViewProjection(tempWebGPUViewProjection);
  }

  public writeTileMatricesForWebGPUViewProjection(webGPUViewProjectionMatrix: Mat4): SDKResult<void> {
    try {
      this._lastTileMatrixUploads = 0;
      this._writeTileMatrix(0, ORIGIN_TILE_CENTER, webGPUViewProjectionMatrix);
      for (const tile of this._tiles.values()) {
        this._writeTileMatrix(tile.tileIndex, tile.center, webGPUViewProjectionMatrix);
      }
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[RTCTileManager.writeTileMatricesForWebGPUViewProjection] Failed to upload WebGPU RTC tile matrices: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {
      ok: true,
      value: undefined
    };
  }

  public destroy(): void {
    this.releaseAll();
    try {
      this._buffer?.destroy?.();
    } catch {
      // Ignore buffer destruction failures during teardown.
    }
    this._buffer = null;
  }

  private _createTile(id: string, rtcCenter: Vec3): RTCTile | null {
    const tileIndex = this._getFreeTileIndex();
    if (tileIndex <= 0) {
      return null;
    }
    const tile: RTCTile = {
      id,
      tileIndex,
      center: createVec3Float64(rtcCenter),
      useCount: 0
    };
    this._tiles.set(id, tile);
    return tile;
  }

  private _releaseTile(tileId: string): void {
    const tile = this._tiles.get(tileId);
    if (!tile) {
      return;
    }
    tile.useCount--;
    if (tile.useCount > 0) {
      return;
    }
    this._tiles.delete(tileId);
    this._putFreeTileIndex(tile.tileIndex);
  }

  private _getFreeTileIndex(): number {
    const maxTiles = this._getMaxTiles();
    if (maxTiles <= 1) {
      return 0;
    }
    for (let i = 1; i < maxTiles; i++) {
      if (!this._tileIndexesUsed[i]) {
        this._tileIndexesUsed[i] = true;
        return i;
      }
    }
    return 0;
  }

  private _getMaxTiles(): number {
    const maxTiles = this._renderContext.memoryConfigs.maxTiles;
    return Number.isFinite(maxTiles) ? Math.max(1, Math.floor(maxTiles)) : 1;
  }

  private _putFreeTileIndex(index: number): void {
    if (index <= 0) {
      return;
    }
    delete this._tileIndexesUsed[index];
  }

  private _writeOriginTile(): void {
    this._writeTileMatrix(0, ORIGIN_TILE_CENTER, IDENTITY_WEBGPU_VIEW_PROJECTION);
  }

  private _writeTileMatrix(tileIndex: number, center: Vec3, webGPUViewProjectionMatrix: Mat4): void {
    createRTCViewProjectionMat(webGPUViewProjectionMatrix, center, tempTileMatrix);
    const data = new Float32Array(RTC_TILE_FLOATS);
    for (let i = 0; i < 16; i++) {
      data[i] = tempTileMatrix[i];
    }
    data[16] = center[0];
    data[17] = center[1];
    data[18] = center[2];
    data[19] = 0;
    this._renderContext.device.queue.writeBuffer(this.buffer, tileIndex * RTC_TILE_BYTES, data);
    this._lastTileMatrixUploads++;
  }

  private _makeTileId(rtcCenter: Vec3): string {
    return `${rtcCenter[0]}:${rtcCenter[1]}:${rtcCenter[2]}`;
  }
}

function createRTCViewProjectionMat(webGPUViewProjectionMatrix: Mat4, rtcCenter: Vec3, target: Mat4): Mat4 {
  for (let i = 0; i < 16; i++) {
    target[i] = webGPUViewProjectionMatrix[i];
  }
  tempWorldCenter[0] = rtcCenter[0];
  tempWorldCenter[1] = rtcCenter[1];
  tempWorldCenter[2] = rtcCenter[2];
  tempWorldCenter[3] = 1;
  transformVec4(webGPUViewProjectionMatrix, tempWorldCenter, tempClipCenter);
  target[12] = tempClipCenter[0];
  target[13] = tempClipCenter[1];
  target[14] = tempClipCenter[2];
  target[15] = tempClipCenter[3];
  return target;
}

const ORIGIN_TILE_CENTER = createVec3Float64([0, 0, 0]);
const IDENTITY_WEBGPU_VIEW_PROJECTION = createMat4Float64();
