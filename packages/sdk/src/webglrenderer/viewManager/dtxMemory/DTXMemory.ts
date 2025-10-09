import type {FloatArrayParam} from "../../../math";
import {SceneMesh} from "../../../scene";
import {RenderContext} from "../../RenderContext";
import {TileManager} from "./TileManager";
import {type Tile} from "./Tile";
import {type DTXMemoryReader} from "./DTXMemoryReader";
import {type DTXMemoryEditor} from "./DTXMemoryEditor";
import {DataTextures} from "./DataTextures";
import {DTXMatrixArray} from "./dtx/DTXMatrixArray";
import {DTXMemoryBatch} from "./DTXMemoryBatch";
import {DTXMemoryMeshHandle} from "./DTXMemoryMeshHandle";
import {View} from "../../../viewer";
import {MeshBatchMeshHandle} from "../meshBatches/MeshBatchMeshHandle";


/**
 * Manages GPU-resident, dynamically-editable data storage for model geometry and attributes.
 *
 * The `DTXMemoryBatch` class implements a data texture-based system for efficient storage and
 * rendering of large-scale 3D scenes. It handles dtxMemory allocation, updates, and synchronization
 * for meshes, geometries, and tiles, integrating tightly with WebGL rendering pipelines.
 */
export class DTXMemory implements DTXMemoryReader, DTXMemoryEditor {

  /**
   * The data textures that implement GPU-side model storage for this DTXMemoryBatch.
   */
  dataTextures: DataTextures;

  private _batches: DTXMemoryBatch[] = [];
  private _maxBatches: number;
  private _renderContext: RenderContext;
  private _maxTiles: number;
  private _tiles: TileManager;
  private _onTick: () => void;
  private _numMeshes: Number;
  private _tileViewMatrices: DTXMatrixArray[];
  private _tileRayPickMatrices: DTXMatrixArray[];

  /**
   * Constructs a DTXMemory instance.
   */
  constructor( renderContext: RenderContext ) {

    this._renderContext = renderContext;
    this._maxBatches = 100;
    this._maxTiles = 1000;

    this._numMeshes = 0;

    const gl = renderContext.gl;

    this._tileViewMatrices = [
      new DTXMatrixArray({gl, maxMatrices: this._maxTiles}),
      new DTXMatrixArray({gl, maxMatrices: this._maxTiles}),
      new DTXMatrixArray({gl, maxMatrices: this._maxTiles}),
      new DTXMatrixArray({gl, maxMatrices: this._maxTiles})
    ];

      this._tileRayPickMatrices = [
      new DTXMatrixArray({gl, maxMatrices: this._maxTiles}),
      new DTXMatrixArray({gl, maxMatrices: this._maxTiles}),
      new DTXMatrixArray({gl, maxMatrices: this._maxTiles}),
      new DTXMatrixArray({gl, maxMatrices: this._maxTiles})
    ];

    this.dataTextures = {
      tileViewMatrices : this._tileViewMatrices.map((t)=>(t.texture)),
      tileRayPickMatrices : this._tileRayPickMatrices.map((t)=>(t.texture)),
      batches: []
    };

    this._tiles = new TileManager(gl, renderContext.viewer, this._tileViewMatrices, this._tileRayPickMatrices);

    this._onTick = renderContext.viewer.onTick.sub(()=>{
      for (let i = 0; i < 4; i++) {
        this._tileViewMatrices[i].flush();
        this._tileRayPickMatrices[i].flush();
      }
      for (const batch of this._batches) {
        batch.flush();
      }
    });
  }

  /**
   * Sets the pick matrix for a specific View. The pick matrix is substituted for the view matrix when
   * we are picking along a ray in that View. Otherwise, the standard view matrix is used.
   * @param view The target View.
   * @param pickMatrix The pick matrix to set for the View.
   */
  setViewPickMatrix(view: View, pickMatrix: FloatArrayParam ): void {
    this._tiles.setPickMatrix(view, pickMatrix);
  }

  /**
   * Get a Tile that contains the given 3D World-space position.
   * @param worldPos A 3D position in world space.
   * @returns The Tile containing the position. The tile's use count is incremented.
   */
  getTile( worldPos: FloatArrayParam ): Tile {
    return this._tiles.getTile(worldPos);
  }

  /**
   * Move a Tile, if necessary, so that it contains the given World-space 3D position.
   * @param tile The tile to potentially move.
   * @param worldPos The target world-space position.
   * @returns The original tile if no move was needed, otherwise a different tile.
   * When returing a different tile, old tile is released back to the TileManager.
   */
  moveTile( tile: Tile, worldPos: FloatArrayParam ): Tile {
    return this._tiles.moveTile(tile, worldPos);
  }

  /**
   * Releases a Tile back to DTXMemoryBatch.
   * The Tile is destroyed as soon as it is released as many times as it was retrieved.
   * @param tile The tile to release.
   */
  putTile( tile: Tile ) {
    this._tiles.putTile(tile);
  }

  /**
   * Creates a new GPU memory batch, up to the maximum number of sortedBatches allowed.
   * The new batch is added to the  `DTXMemoryEditor.dataTextures.sortedBatches` array.
   * Returns the index of the new batch.
   */
  createBatch(): number {
    if (this._batches.length < this._maxBatches) {
      const index = this._batches.length;
      const dtxMemoryBatch = new DTXMemoryBatch(index, this._renderContext);
      this._batches.push(dtxMemoryBatch);
      this.dataTextures.batches.push(dtxMemoryBatch.dataTextures);
      // console.log("Created DTXMemoryBatch: " + index);
      return index;
    }
    throw new Error('GPUMemoryPool: Maximum number of DTXMemoryBatch instances reached.');
  }

  /**
   * Checks if there is enough memory in a specific batch for a SceneMesh.
   * @param batchIndex
   * @param sceneMesh
   */
  hasMemoryForMesh( batchIndex: number, sceneMesh: SceneMesh ): boolean {
    const dtxMemoryBatch = this._batches[batchIndex];
    return dtxMemoryBatch ? dtxMemoryBatch.hasMemoryForMesh(sceneMesh) : false;
  }

  /**
   * Adds a SceneMesh to a specific batch.
   *
   * Returns an tileIndex/handle through which you can dynamically update attributes for the mesh.
   *
   * @param batchIndex
   * @param sceneMesh
   */
  addMesh( batchIndex: number, sceneMesh: SceneMesh ): DTXMemoryMeshHandle {
    const dtxMemoryBatch = this._batches[batchIndex];
    if (!dtxMemoryBatch) {
      throw new Error('DTXMemory.addMesh: Invalid batch index.');
    }
    const meshIdx = dtxMemoryBatch?.addMesh(sceneMesh);
    this._numMeshes++;
    // console.log("addMesh() Num meshes = " + this._numMeshes);
    return <DTXMemoryMeshHandle>{
      meshIndex: meshIdx,
      batchIndex: dtxMemoryBatch.index,
      numIndices: sceneMesh.geometry.indices ? sceneMesh.geometry.indices.length : 0,
      numVertices: sceneMesh.geometry.positionsCompressed ? sceneMesh.geometry.positionsCompressed.length / 3 : 0
    };
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
  setMeshMatrix(
    meshHandle: DTXMemoryMeshHandle,
    matrix: FloatArrayParam ): void {
    const batch = this._batches[meshHandle.batchIndex];
    if (!batch) {
      throw new Error('DTXMemory.setMeshMatrix: Invalid batch index in mesh handle.');
    }
    batch.setMeshMatrix(meshHandle.meshIndex, matrix);
    this._needRenderAllViews();
  }

  private _needRenderAllViews() {
    for (let i = 0; i < this._renderContext.viewFlags.length; i++) {
      this._renderContext.viewFlags[i].needsRender = true;
    }
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
  setMeshAttribs(
    meshHandle: DTXMemoryMeshHandle,
    params: {
      tileIndex?: number;
    } ) {
    const batch = this._batches[meshHandle.batchIndex];
    if (!batch) {
      throw new Error('DTXMemory.setMeshAttribs: Invalid batch index in mesh handle.');
    }
    batch.setMeshAttribs(meshHandle.meshIndex, params);
    this._needRenderAllViews();
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
  setMeshViewAttribs(
    meshHandle: DTXMemoryMeshHandle,
    viewIndex: number,
    params: {
      color?: number[];   // uvec4 bytes 0..255
      flags1?: number;  // uvec4 bytes 0..255
      flags2?: number;  // uvec4 bytes 0..255
    } ) {
    const batch = this._batches[meshHandle.batchIndex];
    if (!batch) {
      throw new Error('DTXMemory.setMeshViewAttribs: Invalid batch index in mesh handle.');
    }
    batch.setMeshViewAttribs(meshHandle.meshIndex, viewIndex, params);
    this._needRenderView(viewIndex);
  }

  private _needRenderView( viewIndex: number ) {
    this._renderContext.viewFlags[viewIndex].needsRender = true;
  }

  /**
   * Removes a SceneMesh from data texture dtxMemory.
   *
   * @param meshHandle
   */
  removeMesh( meshHandle: DTXMemoryMeshHandle ): void {
    const batch = this._batches[meshHandle.batchIndex];
    if (!batch) {
      throw new Error('DTXMemory.removeMesh: Invalid batch index in mesh handle.');
    }
    batch.removeMesh(meshHandle.meshIndex);
    this._needRenderAllViews();
    this._numMeshes--;
 //   console.log("removeMesh() Num meshes = " + this._numMeshes);
  }

  /**
   * Retrieves a SceneMesh within a specific batch at the given index.
   * @param batchIndex
   * @param meshIndex
   */
  getMeshAtIndex( batchIndex: number, meshIndex: number ): SceneMesh | null {
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
  getDrawArraysParamsForMesh( batchIndex: number, meshIndex: number ): { first: number, count: number} | null {
    const batch = this._batches[batchIndex];
    if (!batch) {
      return null;
    }
    return batch.getDrawArraysParamsForMesh(meshIndex);
  }

  /**
   * Destroys this DTXMemory instance and all its resources.
   */
  destroy() {
    for (const dtxMemory of this._batches) {
      dtxMemory.destroy();
    }
    this._numMeshes = 0;
    this._batches.length = 0;
    this.dataTextures.batches.length = 0;
    const clear = ( ref: any ) => {
      if (ref) {
        ref.destroy();
        return null;
      }
      return ref;
    };
    this._tileViewMatrices = this._tileViewMatrices.map(clear);
    this._tileRayPickMatrices = this._tileRayPickMatrices.map(clear);
    this._onTick();
  }
}
