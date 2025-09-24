import type {FloatArrayParam} from "../../math";
import {SceneMesh} from "../../scene";
import {RenderContext} from "../RenderContext";
import {TileManager} from "./TileManager";
import {type Tile} from "./Tile";
import {type GPUMemoryReadIF} from "./GPUMemoryReadIF";
import {type GPUMemoryWriteIF} from "./GPUMemoryWriteIF";
import {DataTextures} from "./DataTextures";
import {DTXMatrixArray} from "./dtx/DTXMatrixArray";
import {GPUMemoryLayer} from "./GPUMemoryLayer";
import {GPUMemoryMeshHandle} from "./GPUMemoryMeshHandle";


/**
 * Manages GPU-resident, dynamically-editable data storage for model geometry and attributes.
 *
 * The `GPUMemoryLayer` class implements a data texture-based system for efficient storage and
 * rendering of large-scale 3D scenes. It handles gpuMemory allocation, updates, and synchronization
 * for meshes, geometries, and tiles, integrating tightly with WebGL rendering pipelines.
 */
export class GPUMemory implements GPUMemoryReadIF, GPUMemoryWriteIF {

  /**
   * The data textures that implement GPU-side model storage for this GPUMemoryLayer.
   */
  dataTextures: DataTextures;

  private _layers: GPUMemoryLayer[] = [];
  private _maxLayers: number;
  private _renderContext: RenderContext;
  private _tileViewMatrices: DTXMatrixArray[];
  private _maxTiles: number;
  private _tiles: TileManager;
  private _onTick: () => void;
  private _numMeshes: Number;

  /**
   * Constructs a GPUMemory instance.
   */
  constructor( renderContext: RenderContext ) {

    this._renderContext = renderContext;
    this._maxLayers = 100;
    this._maxTiles = 1000;

    this._numMeshes = 0;

    const gl = renderContext.gl;

    // For each View, an array containing a viewing transform matrix for each tile

    this.dataTextures = {

      /**
       * Array of data textures, each containing tile view matrices for specific views.
       * These are global to all GPUMemoryLayer instances.
       */
      tileViewMatrices : [
        new DTXMatrixArray({gl, maxMatrices: this._maxTiles}),
        new DTXMatrixArray({gl, maxMatrices: this._maxTiles}),
        new DTXMatrixArray({gl, maxMatrices: this._maxTiles}),
        new DTXMatrixArray({gl, maxMatrices: this._maxTiles})
      ],

      /**
       *
       */
      layers: []
    };

    this._tiles = new TileManager(gl, renderContext.viewer, this.dataTextures.tileViewMatrices);

    this._onTick = renderContext.viewer.onTick.sub(()=>{
      for (let i = 0; i < 4; i++) {
        this.dataTextures.tileViewMatrices[i].flush();
      }
      for (const layer of this._layers) {
        layer.flush();
      }
    });
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
   * Releases a Tile back to GPUMemoryLayer.
   * The Tile is destroyed as soon as it is released as many times as it was retrieved.
   * @param tile The tile to release.
   */
  putTile( tile: Tile ) {
    this._tiles.putTile(tile);
  }

  /**
   * Creates a new GPUMemoryLayer instance, up to the maximum number of instances allowed.
   */
  createLayer(): number {
    if (this._layers.length < this._maxLayers) {
      const index = this._layers.length;
      const gpuMemoryLayer = new GPUMemoryLayer(index, this._renderContext);
      this._layers.push(gpuMemoryLayer);
      this.dataTextures.layers.push(gpuMemoryLayer.dataTextures);
      console.log("Created GPUMEmoryLayer: " + index);
      return index;
    }
    throw new Error('GPUMemoryPool: Maximum number of GPUMemoryLayer instances reached.');
  }

  /**
   * Checks if there is enough gpuMemory in a specific layer for a SceneMesh.
   * @param layerIndex
   * @param sceneMesh
   */
  hasMemoryForMesh( layerIndex: number, sceneMesh: SceneMesh ): boolean {
    const gpuMemoryLayer = this._layers[layerIndex];
    return gpuMemoryLayer ? gpuMemoryLayer.hasMemoryForMesh(sceneMesh) : false;
  }

  /**
   * Adds a SceneMesh to the data texture gpuMemory in a specific layer.
   *
   * Returns an tileIndex/handle through which you can dynamically update attributes for the mesh.
   *
   * @param layerIndex
   * @param sceneMesh
   */
  addMesh( layerIndex: number, sceneMesh: SceneMesh ): GPUMemoryMeshHandle {
    const gpuMemoryLayer = this._layers[layerIndex];
    if (!gpuMemoryLayer) {
      throw new Error('GPUMemory.addMesh: Invalid layer index.');
    }
    const meshIdx = gpuMemoryLayer?.addMesh(sceneMesh);
    this._numMeshes++;
    console.log("addMesh() Num meshes = " + this._numMeshes);
    return <GPUMemoryMeshHandle>{
      meshIndex: meshIdx,
      layerIndex: gpuMemoryLayer.index,
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
    meshHandle: GPUMemoryMeshHandle,
    matrix: FloatArrayParam ): void {
    const layer = this._layers[meshHandle.layerIndex];
    if (!layer) {
      throw new Error('GPUMemory.setMeshMatrix: Invalid layer index in mesh handle.');
    }
    layer.setMeshMatrix(meshHandle.meshIndex, matrix);
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
    meshHandle: GPUMemoryMeshHandle,
    params: {
      tileIndex?: number;
    } ) {
    const layer = this._layers[meshHandle.layerIndex];
    if (!layer) {
      throw new Error('GPUMemory.setMeshAttribs: Invalid layer index in mesh handle.');
    }
    layer.setMeshAttribs(meshHandle.meshIndex, params);
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
    meshHandle: GPUMemoryMeshHandle,
    viewIndex: number,
    params: {
      color?: number[];   // uvec4 bytes 0..255
      flags1?: number;  // uvec4 bytes 0..255
      flags2?: number;  // uvec4 bytes 0..255
    } ) {
    const layer = this._layers[meshHandle.layerIndex];
    if (!layer) {
      throw new Error('GPUMemory.setMeshViewAttribs: Invalid layer index in mesh handle.');
    }
    layer.setMeshViewAttribs(meshHandle.meshIndex, viewIndex, params);
    this._needRenderView(viewIndex);
  }

  private _needRenderView( viewIndex: number ) {
    this._renderContext.viewFlags[viewIndex].needsRender = true;
  }

  /**
   * Removes a SceneMesh from data texture gpuMemory.
   *
   * @param meshHandle
   */
  removeMesh( meshHandle: GPUMemoryMeshHandle ): void {
    const layer = this._layers[meshHandle.layerIndex];
    if (!layer) {
      throw new Error('GPUMemory.removeMesh: Invalid layer index in mesh handle.');
    }
    layer.removeMesh(meshHandle.meshIndex);
    this._needRenderAllViews();
    this._numMeshes--;
 //   console.log("removeMesh() Num meshes = " + this._numMeshes);
  }

  /**
   * Destroys this GPUMemory instance and all its resources.
   */
  destroy() {
    for (const gpuMemory of this._layers) {
      gpuMemory.destroy();
    }
    this._numMeshes = 0;
    this._layers.length = 0;
    this.dataTextures.layers.length = 0;
    const clear = ( ref: any ) => {
      if (ref) {
        ref.destroy();
        return null;
      }
      return ref;
    };
    this._tileViewMatrices = this._tileViewMatrices.map(clear);
    this._onTick();
  }
}
