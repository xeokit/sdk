import {SceneGeometry, SceneMesh} from "../../../scene";
import {RenderContext} from "../RenderContext";
import {TileManager} from "./TileManager";
import {type Tile} from "./Tile";
import {type GPUMemoryReader} from "./GPUMemoryReader";
import {type GPUMemoryEditor} from "./GPUMemoryEditor";
import {type DataTextures} from "./DataTextures";
import {MatrixTexture} from "./dataTextures/MatrixTexture";
import {GPUMemoryBatch} from "./GPUMemoryBatch";
import {type GPUMemoryMeshHandle} from "./GPUMemoryMeshHandle";
import {Camera, View} from "../../../viewer";
import {type RenderPassValue} from "../RENDER_PASSES";
import {EventEmitter, SDKErrorType, SDKInternalException, type SDKResult} from "../../../core";
import type {Mat4, Vec3} from "../../../math";
import {EventDispatcher} from "strongly-typed-events";
import type {MemoryUsage} from "../../MemoryUsage";


/**
 * Manages GPU-resident, dynamically-editable data storage for model geometry and attributes.
 *
 * The `GPUMemoryManager` class implements a data texture-based system for efficient storage and
 * rendering of large-scale 3D scenes. It handles gpuMemoryManager allocation, updates, and synchronization
 * for meshes, geometries, and tiles, integrating tightly with WebGL rendering pipelines.
 *
 * @internal
 */
export class GPUMemoryManager implements GPUMemoryReader, GPUMemoryEditor {

  /**
   * The data textures that implement GPU-side model storage for this GPUMemoryManager.
   */
  public dataTextures: DataTextures | null = null;

  private _batches: GPUMemoryBatch[] = [];
  private _renderContext: RenderContext;
  private _tiles: TileManager;
  private _numMeshes: number;
  private _viewTileCameraMatrixTexture: MatrixTexture[];
  private _viewTilePickMatrixTexture: MatrixTexture[];

  /**
   * Constructs a GPUMemoryManager instance.
   */
  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
    this._numMeshes = 0;
  }

  /**
   * Allocates GPU memory for this GPUMemoryManager.
   */
  public init(): SDKResult<void> {

    const renderContext = this._renderContext;
    const gl = this._renderContext.gl;

    const maxTiles = renderContext.memoryConfigs.maxTiles;

    const getNumItems = () => this._tiles ? this._tiles.numTiles : 0; // Only tile manager knows current tile count

    this._viewTileCameraMatrixTexture = [
      new MatrixTexture({gl, maxItems: maxTiles, getNumItems, description: '[View 0] - tileIndex->(view matrix)'}),
      new MatrixTexture({gl, maxItems: maxTiles, getNumItems, description: '[View 1] - tileIndex->(view matrix)'}),
      new MatrixTexture({gl, maxItems: maxTiles, getNumItems, description: '[View 2] - tileIndex->(view matrix)'}),
      new MatrixTexture({gl, maxItems: maxTiles, getNumItems, description: '[View 3] - tileIndex->(view matrix)'})
    ];

    this._viewTilePickMatrixTexture = [
      new MatrixTexture({gl, maxItems: maxTiles, getNumItems, description: '[View 0] - tileIndex->(pick matrix)'}),
      new MatrixTexture({gl, maxItems: maxTiles, getNumItems, description: '[View 1] - tileIndex->(pick matrix)'}),
      new MatrixTexture({gl, maxItems: maxTiles, getNumItems, description: '[View 2] - tileIndex->(pick matrix)'}),
      new MatrixTexture({gl, maxItems: maxTiles, getNumItems, description: '[View 3] - tileIndex->(pick matrix)'})
    ];

    const textures: {
      allocate(): SDKResult<void>;
      destroy(): void;
    }[] = [
      ...this._viewTileCameraMatrixTexture,
      ...this._viewTilePickMatrixTexture
    ];

    for (let i = 0, leni = textures.length; i < leni; i++) {
      const res = textures[i].allocate()
      if (res.ok === false) {
        for (let j = i - 1; j >= 0; j--) {
          textures[j].destroy();
        }
        return {
          ok: false,
          type: SDKErrorType.MemoryExceeded,
          error: '[GPUMemoryManager.init] Out of GPU memory. Try increasing the maximum number of tiles.'
        };
      }
    }

    this._tiles = new TileManager(renderContext.viewer, this._viewTileCameraMatrixTexture, this._viewTilePickMatrixTexture);

    this.dataTextures = {
      viewTileCameraMatrixTexture: this._viewTileCameraMatrixTexture.map((t) => (t)),
      viewTilePickMatrixTexture: this._viewTilePickMatrixTexture.map((t) => (t)),
      batches: [],
      onBatchCreated: new EventEmitter(new EventDispatcher<DataTextures, undefined>())
    };

    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Notifies the GPUMemoryManager that the WebGL context has been restored.
   */
  webglContextRestored(): SDKResult<void> {
    for (const contextUsers in  [
      ...this._viewTileCameraMatrixTexture,
      ...this._viewTilePickMatrixTexture,
      this._batches
    ]) {
      const result = (<any>contextUsers).webglContextRestored();
      if (!result.ok) {
        return result;
      }
    }
    return {ok: true, value: undefined};
  }

  /**
   * Retrieves GPU memory usage statistics.
   */
  getMemoryUsage(): MemoryUsage {
    return {
      allocatedMB: this.getAllocatedBytes() / (1024 * 1024),
      usedMB: this.getUsedBytes() / (1024 * 1024)
    };
  }

  /**
   * Retrieves the total allocated GPU memory in bytes.
   */
  getAllocatedBytes() : number {
    let allocatedBytes = 0;
    for (const tileCameraMatrixTable of this._viewTileCameraMatrixTexture) {
      allocatedBytes += tileCameraMatrixTable.getAllocatedBytes();
    }
    for (const tilePickMatrixTable of this._viewTilePickMatrixTexture) {
      allocatedBytes += tilePickMatrixTable.getAllocatedBytes();
    }
    for (const batch of this._batches) {
      allocatedBytes += batch.getAllocatedBytes();
    }
    return allocatedBytes;
  }

  /**
   * Retrieves the total used GPU memory in bytes.
   */
  getUsedBytes() : number {
    let usedBytes = 0;
    for (const tileCameraMatrixTable of this._viewTileCameraMatrixTexture) {
      usedBytes += tileCameraMatrixTable.getUsedBytes();
    }
    for (const tilePickMatrixTable of this._viewTilePickMatrixTexture) {
      usedBytes += tilePickMatrixTable.getUsedBytes();
    }
    for (const batch of this._batches) {
      usedBytes += batch.getUsedBytes();
    }
    return usedBytes;
  }

  /**
   * Gets the size in bytes of each element managed by GPUMemoryManager.
   */
  static get itemSizesInBytes(): { [key: string]: number } {
    return Object.assign({
        tile:
          (MatrixTexture.itemSizeInBytes * 4) + // view matrices for 4 views
          (MatrixTexture.itemSizeInBytes * 4), // ray pick matrices for 4 views
      },
      GPUMemoryBatch.itemSizesInBytes);
  }

  /**
   * Called on each tick to upload any pending changes to GPU memory.
   */
  public uploadChanges(): void {
    for (let i = 0; i < 4; i++) {
      this._viewTileCameraMatrixTexture[i].uploadChanges();
      this._viewTilePickMatrixTexture[i].uploadChanges();
    }
    for (const batch of this._batches) {
      batch.uploadChanges();
    }
  }

  /**
   * Notifies the GPUMemoryManager that a Camera's view matrix has been updated.
   * @param camera
   */
  public cameraViewMatrixUpdated(camera: Camera): void {
    this._tiles.cameraViewMatrixUpdated(camera);
  }

  /**
   * Sets the pick matrix for a specific View. The pick matrix is substituted for the view matrix when
   * we are picking along a ray in that View. Otherwise, the standard view matrix is used.
   * @param view The target View.
   * @param pickMatrix The pick matrix to set for the View.
   */
  public setViewPickMatrix(view: View, pickMatrix: Mat4): void {
    this._tiles.setPickMatrix(view, pickMatrix);
  }

  /**
   * Get a Tile that contains the given 3D World-space position.
   * @param worldPos A 3D position in world space.
   * @returns The Tile containing the position. The tile's use count is incremented.
   */
  public getTile(worldPos: Vec3): Tile {
    return this._tiles.getTile(worldPos);
  }

  /**
   * Move a Tile, if necessary, so that it contains the given World-space 3D position.
   * @param tile The tile to potentially move.
   * @param worldPos The target world-space position.
   * @returns The original tile if no move was needed, otherwise a different tile.
   * When returing a different tile, old tile is released back to the TileManager.
   */
  public moveTile(tile: Tile, worldPos: Vec3): Tile {
    return this._tiles.moveTile(tile, worldPos);
  }

  /**
   * Releases a Tile back to GPUMemoryManager.
   * The Tile is destroyed as soon as it is released as many times as it was retrieved.
   * @param tile The tile to release.
   */
  public putTile(tile: Tile) {
    this._tiles.putTile(tile);
  }

  /**
   * Creates a new GPU memory batch.
   * The new batch is added to the  `GPUMemoryEditor.dataTextures.sortedBatches` array.
   * @returns SDKResult containing the index of the new batch, or an error if out of memory.
   */
  public createBatch(): SDKResult<number> {
    if (this._batches.length >= this._renderContext.memoryConfigs.maxBatches) {
      return {
        ok: false,
        type: SDKErrorType.MemoryExceeded,
        error: '[GPUMemoryManager.createBatch] Exceeded maximum number of GPU memory batches.'
      };
    }
    const index = this._batches.length;
    const gpuMemoryBatch = new GPUMemoryBatch(index, this._renderContext);
    const allocateResult = gpuMemoryBatch.allocate();
    if (allocateResult.ok === false) {
      gpuMemoryBatch.destroy();
      return {
        ok: false,
        type: SDKErrorType.MemoryExceeded,
        error: `[GPUMemoryManager.createBatch] Out of GPU memory - ${allocateResult.error}`
      };
    }
    this._batches.push(gpuMemoryBatch);
    this.dataTextures.batches.push(gpuMemoryBatch.dataTextures);
    this.dataTextures.onBatchCreated.dispatch(this.dataTextures, undefined);
    return {
      ok: true,
      value: index
    };
  }

  /**
   * Checks if there is enough memory in a specific batch for a SceneMesh.
   * @param batchIndex
   * @param sceneMesh
   */
  public hasMemoryForMesh(batchIndex: number, sceneMesh: SceneMesh): boolean {
    const gpuMemoryBatch = this._batches[batchIndex];
    return gpuMemoryBatch ? gpuMemoryBatch.hasMemoryForMesh(sceneMesh) : false;
  }

  /**
   * Adds a SceneMesh to a specific batch.
   *
   * Returns an tileIndex/handle through which you can dynamically update attributes for the mesh.
   *
   * @param batchIndex
   * @param sceneMesh
   */
  public addMesh(batchIndex: number, sceneMesh: SceneMesh): SDKResult<GPUMemoryMeshHandle> {
    const gpuMemoryBatch = this._batches[batchIndex];
    if (!gpuMemoryBatch) {
      throw new SDKInternalException('[GPUMemoryManager.addMesh] Invalid batch index.');
    }
    const meshIdxResult = gpuMemoryBatch?.addMesh(sceneMesh);
    if (meshIdxResult.ok === false) {
      return meshIdxResult;
    }
    const meshIdx = meshIdxResult.value;
    this._numMeshes++;
    return {
      ok: true,
      value: <GPUMemoryMeshHandle>{
        meshIndex: meshIdx,
        gpuMemoryBatchIndex: gpuMemoryBatch.index,
        numIndices: sceneMesh.geometry.indices ? sceneMesh.geometry.indices.length : 0,
        numVertices: sceneMesh.geometry.positionsCompressed ? sceneMesh.geometry.positionsCompressed.length / 3 : 0
      }
    };
  }

  /**
   * Sets whether a mesh is visible .
   *
   * @param meshHandle
   * @param viewIndex
   * @param visible
   */
  public setMeshVisible(
    meshHandle: GPUMemoryMeshHandle,
    viewIndex: number,
    visible: boolean) {
    const batch = this._batches[meshHandle.gpuMemoryBatchIndex];
    if (!batch) {
      throw new SDKInternalException('GPUMemoryManager.setMeshVisible: Invalid batch index in mesh handle.');
    }
    batch.setMeshVisible(meshHandle.meshIndex, viewIndex, visible);
    //this._needRenderAllViews();
  }

  /**
   * Sets the modeling transform matrix for a mesh.
   * The modeling transform is relative to the center of the meshes tile.
   *
   * Sets RenderContext.viewFlags[...].needsRender to true.
   *
   * @param meshHandle
   * @param matrix
   */
  public setMeshMatrix(
    meshHandle: GPUMemoryMeshHandle,
    matrix: Mat4): void {
    const batch = this._batches[meshHandle.gpuMemoryBatchIndex];
    if (!batch) {
      throw new SDKInternalException('[GPUMemoryManager.setMeshMatrix] Invalid batch index in mesh handle.');
    }
    batch.setMeshMatrix(meshHandle.meshIndex, matrix);
  }

  /**
   * Sets attributes for e mesh to apply across all Views.
   *
   * Sets RenderContext.viewFlags[...].needsRender to true.
   *
   * @param meshHandle
   * @param params
   * @param params.tileIndex Optional tileIndex of the Tile containing the mesh. This can be dynamically updated, as mesh can move between tiles.
   */
  public setMeshAttribs(
    meshHandle: GPUMemoryMeshHandle,
    params: {
      tileIndex?: number;
    }) {
    const batch = this._batches[meshHandle.gpuMemoryBatchIndex];
    if (!batch) {
      throw new SDKInternalException('[GPUMemoryManager.setMeshAttribs] Invalid batch index in mesh handle.');
    }
    batch.setMeshAttribs(meshHandle.meshIndex, params);
  }

  /**
   * Sets attributes for a mesh within a specific View.
   *
   * Sets RenderContext.viewFlags[viewIndex].needsRender to true.
   *
   * @param meshHandle
   * @param viewIndex
   * @param params
   */
  public setMeshViewAttribs(
    meshHandle: GPUMemoryMeshHandle,
    viewIndex: number,
    params: {
      color?: Vec3;   // uvec3 bytes 0..255
      opacity?: number; // float 0..1
      clippable?: boolean;
      pickable?: boolean;
    }) {
    const batch = this._batches[meshHandle.gpuMemoryBatchIndex];
    if (!batch) {
      throw new SDKInternalException('[GPUMemoryManager.setMeshViewAttribs] Invalid batch index in mesh handle.');
    }
    batch.setMeshViewAttribs(meshHandle.meshIndex, viewIndex, params);
  }

  /**
   * Sets the state for a mesh within a specific View.
   * @param meshHandle
   * @param viewIndex
   * @param renderPass
   */
  public setMeshRenderPass(
    meshHandle: GPUMemoryMeshHandle,
    viewIndex: number,
    renderPass: RenderPassValue): void {
    const batch = this._batches[meshHandle.gpuMemoryBatchIndex];
    if (!batch) {
      throw new SDKInternalException('[GPUMemoryManager.setMeshRenderPass] Invalid batch index in mesh handle.');
    }
    batch.setMeshRenderPass(meshHandle.meshIndex, viewIndex, renderPass);
  }

  /**
   * Removes a SceneMesh from data texture gpuMemoryManager.
   *
   * @param meshHandle
   */
  public removeMesh(meshHandle: GPUMemoryMeshHandle): void {
    const batch = this._batches[meshHandle.gpuMemoryBatchIndex];
    if (!batch) {
      throw new SDKInternalException('[GPUMemoryManager.removeMesh] Invalid batch index in mesh handle.');
    }
    batch.removeMesh(meshHandle.meshIndex);
    this._numMeshes--;
    //   console.log("removeMesh() Num meshes = " + this._numMeshes);
  }

  /**
   * Retrieves a SceneGeometry within a specific batch at the given index.
   * @param batchIndex
   * @param geometryIndex
   */
  public getGeometryAtIndex(batchIndex: number, geometryIndex: number) : SceneGeometry | null {
    const batch = this._batches[batchIndex];
    if (!batch) {
      return null;
    }
    return batch.getGeometryAtIndex(geometryIndex);
  }

  /**
   * Retrieves a SceneMesh within a specific batch at the given index.
   * @param batchIndex
   * @param meshIndex
   */
  public getMeshAtIndex(batchIndex: number, meshIndex: number): SceneMesh | null {
    const batch = this._batches[batchIndex];
    if (!batch) {
      return null;
    }
    return batch.getMeshAtIndex(meshIndex);
  }

  /**
   * Retrieves parameters for a drawArrays() call to render a specific mesh within a specific batch.
   * @param batchIndex
   * @param meshIndex
   */
  public getDrawArraysParamsForMesh(batchIndex: number, meshIndex: number): { first: number, count: number } | null {
    const batch = this._batches[batchIndex];
    if (!batch) {
      return null;
    }
    return batch.getDrawArraysParamsForMesh(meshIndex);
  }

  /**
   * Destroys this GPUMemoryManager instance and all its resources.
   */
  public destroy() {
    for (const batch of this._batches) {
      batch.destroy();
    }
    this._numMeshes = 0;
    this._batches.length = 0;
    this.dataTextures = null as any;
    const clear = (ref: any) => {
      if (ref) {
        ref.destroy();
        return null;
      }
      return ref;
    };
    if (this._viewTileCameraMatrixTexture) {
      this._viewTileCameraMatrixTexture = this._viewTileCameraMatrixTexture.map(clear);
    }
    if (this._viewTilePickMatrixTexture) {
      this._viewTilePickMatrixTexture = this._viewTilePickMatrixTexture.map(clear);
    }
  }
}
