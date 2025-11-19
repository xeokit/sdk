import type {FloatArrayParam} from "../../../math";
import {SceneMesh} from "../../../scene";
import {RenderContext} from "../RenderContext";
import {TileManager} from "./TileManager";
import {type Tile} from "./Tile";
import {type GPUMemoryReader} from "./GPUMemoryReader";
import {type GPUMemoryEditor} from "./GPUMemoryEditor";
import {DataTextures} from "./DataTextures";
import {DTXMatrixArray} from "./dtx/DTXMatrixArray";
import {GPUMemoryBatch} from "./GPUMemoryBatch";
import {GPUMemoryMeshHandle} from "./GPUMemoryMeshHandle";
import {Camera, TickParams, View} from "../../../viewer";
import {RenderPassValue} from "../RENDER_PASSES";
import {SDKErrorType, SDKInternalException, SDKResult} from "../../../core";


/**
 * Manages GPU-resident, dynamically-editable data storage for model geometry and attributes.
 *
 * The `GPUMemoryManager` class implements a data texture-based system for efficient storage and
 * rendering of large-scale 3D scenes. It handles gpuMemoryManager allocation, updates, and synchronization
 * for meshes, geometries, and tiles, integrating tightly with WebGL rendering pipelines.
 */
export class GPUMemoryManager implements GPUMemoryReader, GPUMemoryEditor {

  /**
   * The data textures that implement GPU-side model storage for this GPUMemoryManager.
   */
  public dataTextures: DataTextures| null = null;

  private _batches: GPUMemoryBatch[] = [];
  private _renderContext: RenderContext;
  private _tiles: TileManager;
  private _onTick: () => void;
  private _numMeshes: Number;
  private _tileViewMatrices: DTXMatrixArray[];
  private _tileRayPickMatrices: DTXMatrixArray[];

  /**
   * Constructs a GPUMemoryManager instance.
   */
  constructor( renderContext: RenderContext ) {
    this._renderContext = renderContext;
    this._numMeshes = 0;
  }

  /**
   * Allocates GPU memory for this GPUMemoryManager.
   */
  public init(): SDKResult<void, string> {

    const renderContext = this._renderContext;
    const gl = renderContext.gl;
    const maxTiles = renderContext.memConfigs.maxTiles;

    this._tileViewMatrices = [
      new DTXMatrixArray({gl, maxMatrices: maxTiles}),
      new DTXMatrixArray({gl, maxMatrices: maxTiles}),
      new DTXMatrixArray({gl, maxMatrices: maxTiles}),
      new DTXMatrixArray({gl, maxMatrices: maxTiles})
    ];

    this._tileRayPickMatrices = [
      new DTXMatrixArray({gl, maxMatrices: maxTiles}),
      new DTXMatrixArray({gl, maxMatrices: maxTiles}),
      new DTXMatrixArray({gl, maxMatrices: maxTiles}),
      new DTXMatrixArray({gl, maxMatrices: maxTiles})
    ];

    const textures: {
      allocate(): Boolean;
      destroy(): void;
    }[] = [
      ...this._tileViewMatrices,
      ...this._tileRayPickMatrices
    ];

    for (let i = 0, leni = textures.length; i < leni; i++) {
      if (!textures[i].allocate()) {
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

    this._tiles = new TileManager(renderContext.viewer, this._tileViewMatrices, this._tileRayPickMatrices);

    this.dataTextures = {
      tileViewMatrices : this._tileViewMatrices.map((t)=>(t.texture)),
      tileRayPickMatrices : this._tileRayPickMatrices.map((t)=>(t.texture)),
      batches: []
    };

    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Gets the size in bytes of each element managed by GPUMemoryManager.
   */
  static get elementSizesInBytes(): { [key: string]: number } {
    return Object.assign({
      tile: (DTXMatrixArray.elementSizeInBytes * 4)
          + (DTXMatrixArray.elementSizeInBytes * 4),
    }, GPUMemoryBatch.elementSizesInBytes);
  }

  /**
   * Called on each tick to upload any pending changes to GPU memory.
   */
  public uploadChanges():void{
    for (let i = 0; i < 4; i++) {
      this._tileViewMatrices[i].uploadChanges();
      this._tileRayPickMatrices[i].uploadChanges();
    }
    for (const batch of this._batches) {
     batch.uploadChanges();
    }
  }

  /**
   * Notifies the GPUMemoryManager that a Camera's view matrix has been updated.
   * @param camera
   */
  public cameraViewMatrixUpdated(camera: Camera) : void {
    this._tiles.cameraViewMatrixUpdated(camera);
  }

  /**
   * Sets the pick matrix for a specific View. The pick matrix is substituted for the view matrix when
   * we are picking along a ray in that View. Otherwise, the standard view matrix is used.
   * @param view The target View.
   * @param pickMatrix The pick matrix to set for the View.
   */
  public setViewPickMatrix(view: View, pickMatrix: FloatArrayParam ): void {
    this._tiles.setPickMatrix(view, pickMatrix);
  }

  /**
   * Get a Tile that contains the given 3D World-space position.
   * @param worldPos A 3D position in world space.
   * @returns The Tile containing the position. The tile's use count is incremented.
   */
  public getTile( worldPos: FloatArrayParam ): Tile {
    return this._tiles.getTile(worldPos);
  }

  /**
   * Move a Tile, if necessary, so that it contains the given World-space 3D position.
   * @param tile The tile to potentially move.
   * @param worldPos The target world-space position.
   * @returns The original tile if no move was needed, otherwise a different tile.
   * When returing a different tile, old tile is released back to the TileManager.
   */
  public moveTile( tile: Tile, worldPos: FloatArrayParam ): Tile {
    return this._tiles.moveTile(tile, worldPos);
  }

  /**
   * Releases a Tile back to GPUMemoryManager.
   * The Tile is destroyed as soon as it is released as many times as it was retrieved.
   * @param tile The tile to release.
   */
  public putTile( tile: Tile ) {
    this._tiles.putTile(tile);
  }

  /**
   * Creates a new GPU memory batch.
   * The new batch is added to the  `GPUMemoryEditor.dataTextures.sortedBatches` array.
   * @returns SDKResult containing the index of the new batch, or an error if out of memory.
   */
  public createBatch(): SDKResult<number, string> {
    if (this._batches.length >= this._renderContext.memConfigs.maxMeshBatches) {
        return {
            ok: false,
            type: SDKErrorType.MemoryExceeded,
            error: '[GPUMemoryManager.createBatch] Exceeded maximum number of GPU memory batches.'
        };
    }
      const index = this._batches.length;
      const gpuMemoryBatch = new GPUMemoryBatch(index, this._renderContext);
      if (!gpuMemoryBatch.allocate()) {
        gpuMemoryBatch.destroy();
        return {
          ok: false,
          type: SDKErrorType.MemoryExceeded,
          error: '[GPUMemoryManager.createBatch] Out of GPU memory'
        };
      }
      this._batches.push(gpuMemoryBatch);
      this.dataTextures.batches.push(gpuMemoryBatch.dataTextures);
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
  public hasMemoryForMesh( batchIndex: number, sceneMesh: SceneMesh ): boolean {
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
  public addMesh( batchIndex: number, sceneMesh: SceneMesh ): GPUMemoryMeshHandle {
    const gpuMemoryBatch = this._batches[batchIndex];
    if (!gpuMemoryBatch) {
      throw new SDKInternalException('[GPUMemoryManager.addMesh] Invalid batch index.');
    }
    const meshIdx = gpuMemoryBatch?.addMesh(sceneMesh);
    this._numMeshes++;
    // console.log("addMesh() Num meshes = " + this._numMeshes);
    return <GPUMemoryMeshHandle>{
      meshIndex: meshIdx,
      gpuMemoryBatchIndex: gpuMemoryBatch.index,
      numIndices: sceneMesh.geometry.indices ? sceneMesh.geometry.indices.length : 0,
      numVertices: sceneMesh.geometry.positionsCompressed ? sceneMesh.geometry.positionsCompressed.length / 3 : 0
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
    batch.setMeshVisible( meshHandle.meshIndex, viewIndex,visible);
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
    matrix: FloatArrayParam ): void {
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
    } ) {
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
      color?: number[];   // uvec4 bytes 0..255
      clippable?: boolean;
      pickable?: boolean;
    } ) {
    const batch = this._batches[meshHandle.gpuMemoryBatchIndex];
    if (!batch) {
      throw new SDKInternalException('[GPUMemoryManager.setMeshViewAttribs] Invalid batch index in mesh handle.');
    }
    batch.setMeshViewAttribs(meshHandle.meshIndex, viewIndex, params);
  }

  /**
   * Sets the state for a mesh within a specific View.
   * @param meshHandle1
   * @param viewIndex
   * @param renderPass
   */
  public setMeshRenderPass(
      meshHandle1: GPUMemoryMeshHandle,
      viewIndex: number,
      renderPass: RenderPassValue): void {
    const batch = this._batches[meshHandle1.gpuMemoryBatchIndex];
    if (!batch) {
      throw new SDKInternalException('[GPUMemoryManager.setMeshRenderPass] Invalid batch index in mesh handle.');
    }
    batch.setMeshRenderPass(meshHandle1.meshIndex, viewIndex, renderPass);
  }

  /**
   * Removes a SceneMesh from data texture gpuMemoryManager.
   *
   * @param meshHandle
   */
  public removeMesh( meshHandle: GPUMemoryMeshHandle ): void {
    const batch = this._batches[meshHandle.gpuMemoryBatchIndex];
    if (!batch) {
      throw new SDKInternalException('[GPUMemoryManager.removeMesh] Invalid batch index in mesh handle.');
    }
    batch.removeMesh(meshHandle.meshIndex);
    this._numMeshes--;
 //   console.log("removeMesh() Num meshes = " + this._numMeshes);
  }

  /**
   * Retrieves a SceneMesh within a specific batch at the given index.
   * @param batchIndex
   * @param meshIndex
   */
  public getMeshAtIndex( batchIndex: number, meshIndex: number ): SceneMesh | null {
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
  public getDrawArraysParamsForMesh( batchIndex: number, meshIndex: number ): { first: number, count: number} | null {
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
    for (const gpuMemory of this._batches) {
      gpuMemory.destroy();
    }
    this._numMeshes = 0;
    this._batches.length = 0;
    this.dataTextures = null as any;
    const clear = ( ref: any ) => {
      if (ref) {
        ref.destroy();
        return null;
      }
      return ref;
    };
    if (this._tileViewMatrices) {
      this._tileViewMatrices = this._tileViewMatrices.map(clear);
    }
    if (this._tileRayPickMatrices) {
      this._tileRayPickMatrices = this._tileRayPickMatrices.map(clear);
    }
    this._onTick();
  }
}
