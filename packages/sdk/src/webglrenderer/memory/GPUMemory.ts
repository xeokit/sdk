import {SceneMesh} from "../../scene";

import {DTXMatrixArray} from "../../webglutils/dtx/DTXMatrixArray";
import {TileManager} from "./TileManager";
import type {FloatArrayParam} from "../../math";
import {DTXArray} from "../../webglutils/dtx/DTXArray";
import {DTXStructArray, type DTXStructSpec} from "../../webglutils/dtx/DTXStructArray";
import {type Tile} from "./Tile";
import {Viewer} from "../../viewer";
import {type GPUMemoryViewIF} from "./GPUMemoryViewIF";
import {type GPUMemoryEditIF} from "./GPUMemoryEditIF";
import {type DataTextures} from "./DataTextures";
import {DTXPositionsArray} from "../../webglutils";

const MAX_MESHES = 100000;
const MAX_GEOMETRIES = 100000;


/**
 * Manages GPU-resident, dynamically-editable data storage for model geometry and attributes.
 *
 * The `GPUMemory` class implements a data texture-based system for efficient storage and
 * rendering of large-scale 3D scenes. It handles memory allocation, updates, and synchronization
 * for meshes, geometries, and tiles, integrating tightly with WebGL rendering pipelines.
 */
export class GPUMemory implements GPUMemoryViewIF, GPUMemoryEditIF {

  /**
   * The data textures that implement GPU-side model storage for this GPUMemory.
   */
  dataTextures: DataTextures;

  private _indices: DTXArray<any>;
  private _meshAttribs: DTXStructArray;
  private _meshViewAttribs: DTXStructArray[];
  private _tiles: TileManager;
  private _geometryAttribs: DTXStructArray;
  private _edgeIndices: DTXArray<any>;
  private _primToMeshLookup: DTXArray<any>;
  private _positions: DTXPositionsArray;
  private _meshMatrices: DTXMatrixArray;
  private _tileViewMatrices: DTXMatrixArray[];
  private _meshIndicesUsed: boolean[];
  private _meshes: {};
  private _maxTiles: number;
  private _numMeshes: number;
  private _maxMeshes: number;
  private _geometryIndicesUsed: boolean[];
  private _geometries: {};
  private _numGeometries: number;
  private _maxGeometries: number;
  private _lastFreeMeshIndex: number;
  private _lastFreeGeometryIndex: number;
  private _geometryHandles: any;
  private _meshHandles: any;
  private _onTick: () => void;
  private _viewer: Viewer;
  private _maxSlices: number;
  private _maxLights: number;

  /**
   *
   */
  constructor( params: {
    gl: WebGL2RenderingContext,
    viewer: Viewer
  } ) {

    const {gl, viewer} = params;

    this._geometryHandles = {};
    this._meshHandles = {};

    this._meshIndicesUsed = [];
    this._lastFreeMeshIndex = 0;
    this._meshes = {};
    this._numMeshes = 0;
    this._maxMeshes = 20000;
    this._maxSlices = 100;
    this._maxLights = 100;
    this._maxTiles = 20000;
    this._geometryIndicesUsed = [];
    this._lastFreeGeometryIndex = 0;
    this._geometries = {};
    this._numGeometries = 0;
    this._maxGeometries = 20000;

    this._primToMeshLookup = new DTXArray({
      gl,
      capacity: 100000,
      ArrayType: Uint32Array
    });

    // Attributes for each SceneMesh

    this._meshAttribs = new DTXStructArray({
      gl,
      capacity: this._maxMeshes,
      structSpec: {
        name: "MeshAttribs",
        fields: [
          {name: "tileIndex", type: "scalar"},
          {name: "geometryIndex", type: "scalar"},
          {name: "indicesBase", type: "scalar"},
          {name: "edgeIndicesBase", type: "scalar"},
          {name: "pickColor", type: "vec4"}
        ]
      }
    });

    // Per-View attributes for each SceneMesh

    const meshViewAttribsStruct: DTXStructSpec = {
      name: "MeshViewAttribs",
      fields: [
        {name: "flags1", type: "vec4"},
        {name: "flags2", type: "vec4"},
        {name: "color", type: "vec4"}
      ]
    };

    this._meshViewAttribs = [
      new DTXStructArray({gl, capacity: this._maxMeshes, structSpec: meshViewAttribsStruct}),
      new DTXStructArray({gl, capacity: this._maxMeshes, structSpec: meshViewAttribsStruct}),
      new DTXStructArray({gl, capacity: this._maxMeshes, structSpec: meshViewAttribsStruct}),
      new DTXStructArray({gl, capacity: this._maxMeshes, structSpec: meshViewAttribsStruct})
    ];

    // // Per-View slices
    //
    // const slicesStruct: DTXStructSpec = {
    //   name: "Slices",
    //   fields: [
    //     {name: "active", type: "boolean"},
    //     {name: "pos", type: "vec3"},
    //     {name: "flags2", type: "vec4"},
    //     {name: "color", type: "vec4"}
    //   ]
    // };
    //
    // this._viewSlices = [
    //   new DTXStructArray({gl, capacity: this._maxSlices, structSpec: slicesStruct}),
    //   new DTXStructArray({gl, capacity: this._maxSlices, structSpec: slicesStruct}),
    //   new DTXStructArray({gl, capacity: this._maxSlices, structSpec: slicesStruct}),
    //   new DTXStructArray({gl, capacity: this._maxSlices, structSpec: slicesStruct})
    // ];
    //
    // // Per-View lights
    //
    // const lightsStruct: DTXStructSpec = {
    //   name: "Lights",
    //   fields: [
    //     {name: "type", type: "vec3"},
    //     {name: "pos", type: "vec3"},
    //     {name: "dir", type: "vec3"},
    //     {name: "color", type: "vec4"}
    //   ]
    // };
    //
    // this._viewLights = [
    //   new DTXStructArray({gl, capacity: this._maxLights, structSpec: lightsStruct}),
    //   new DTXStructArray({gl, capacity: this._maxLights, structSpec: lightsStruct}),
    //   new DTXStructArray({gl, capacity: this._maxLights, structSpec: lightsStruct}),
    //   new DTXStructArray({gl, capacity: this._maxLights, structSpec: lightsStruct})
    // ];

    // Matrix for each SceneMesh

    this._meshMatrices = new DTXMatrixArray({gl});

    // Attributes for each SceneGeometry

    this._geometryAttribs = new DTXStructArray({
      gl,
      capacity: 10000, // TODO
      structSpec: {
        name: "GeometryAttribs",
        fields: [
          {name: "vertexBase", type: "scalar"}, // Base of the geometry's portion in _positions DTX array
          {name: "dequantizeOffset", type: "vec3"}, // Min position dequantization range
          {name: "dequantizeScale", type: "vec3"} // Position dequantization scale
        ]
      }
    });

    // Concatenation of all indices for the purpose of a gl draw call (ie. gl.drawElements)

    this._indices = new DTXArray({
      gl,
      capacity: 100000,
      ArrayType: Uint32Array
    });

    // Concatenation of all edge indices for a gl draw call (ie. gl.drawElements)

    this._edgeIndices = new DTXArray({
      gl,
      capacity: 100000,
      ArrayType: Uint32Array
    });

    // Concatenation of all vertex positions

    this._positions = new DTXPositionsArray({
      gl,
      capacity: 100000
    });

    // For each View, an array containing a viewing transform matrix for each tile

    this._tileViewMatrices = [
      new DTXMatrixArray({gl, maxMatrices: this._maxTiles}),
      new DTXMatrixArray({gl, maxMatrices: this._maxTiles}),
      new DTXMatrixArray({gl, maxMatrices: this._maxTiles}),
      new DTXMatrixArray({gl, maxMatrices: this._maxTiles})
    ];

    // Tile manager

    this._tiles = new TileManager(gl, viewer, this._tileViewMatrices);

    // Periodically upload dirty data to GPU

    this._onTick = viewer.onTick.subscribe(() => {
      this._indices.flush()
      this._meshAttribs.flush();
      for (let i = 0; i < 4; i++) {
        this._meshViewAttribs[i].flush();
      }
      this._geometryAttribs.flush();
      this._edgeIndices.flush();
      this._primToMeshLookup.flush();
      this._positions.flush();
      this._meshMatrices.flush();
      for (let i = 0; i < 4; i++) {
        this._tileViewMatrices[i].flush();
      }
    });

    // Expose data textures for LayerRenderer to use

    this.dataTextures = {
      indices: this._indices.texture,
      edgeIndices: this._edgeIndices.texture,
      primToMeshLookup: this._primToMeshLookup.texture,
      meshMatrices: this._meshMatrices.texture,
      meshAttribs: this._meshAttribs.texture,
      meshViewAttribs: [
        this._meshViewAttribs[0].texture,
        this._meshViewAttribs[1].texture,
        this._meshViewAttribs[2].texture,
        this._meshViewAttribs[3].texture
      ],
      geometryAttribs: this._geometryAttribs.texture,
      positions: this._positions.texture,
      tileViewMatrices: [
        this._tileViewMatrices[0].texture,
        this._tileViewMatrices[1].texture,
        this._tileViewMatrices[2].texture,
        this._tileViewMatrices[3].texture
      ]
    };

    // this.structSpecs = {
    //   MeshAttribs: this._meshAttribs.structSpec
    // }
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
   * Releases a Tile back to GPUMemory.
   * The Tile is destroyed as soon as it is released as many times as it was retrieved.
   * @param tile The tile to release.
   */
  putTile( tile: Tile ) {
    this._tiles.putTile(tile);
  }

  /**
   * Adds a SceneMesh to data texture memory.
   *
   * Returns an tileIndex/handle through which you can dynamically update attributes for the mesh.
   *
   * @param sceneMesh
   */
  addMesh( sceneMesh: SceneMesh ): number {

    const existingMeshHandle = this._meshHandles[sceneMesh.id];

    if (existingMeshHandle) {
      return existingMeshHandle.meshIndex;
    }

    const meshIndex = this._getFreeMeshIndex();
    const geometry = sceneMesh.geometry;

    let geometryHandle = this._geometryHandles[geometry.id];

    if (!geometryHandle) {

      const geometryIndex = this._getFreeGeometryIndex();

      const positionsPortion = this._positions.getPortion(
        geometry.positionsCompressed.length,
        ( newBase: number ) => {

          this._geometryAttribs.setStructObject(geometryIndex, {
            vertexBase: newBase / 3 // TODO: Assumes triangles
          });
        });

      this._positions.setPortionData(positionsPortion, geometry.positionsCompressed);

      const [xmin, ymin, zmin, xmax, ymax, zmax] = geometry.aabb;

      this._geometryAttribs.setStructObject(geometryIndex, {
        vertexBase: positionsPortion.base / 3, // TODO: Only works for triangles
        dequantizeOffset: [xmin, ymin, zmin],
        dequantizeScale: [xmax - xmin, ymax - ymin, zmax - zmin]
      });

      geometryHandle = {
        positionsPortion,
        geometryIndex,
        useCount: 0
      };

      this._geometryHandles[geometry.id] = geometryHandle;
    }

    geometryHandle.useCount++;

    const primitiveCount = geometry.indices.length / 3; // TODO

    const primToMeshLookupHandle = this._primToMeshLookup.getPortion(
      primitiveCount,
      ( newBase: number ) => {
        // this._meshAttribs.setStructObject(_meshIndex, {
        //   indicesBase: newBase
        // });
      }
    );

    this._primToMeshLookup.fillPortion(primToMeshLookupHandle, meshIndex);

    const indicesHandle = this._indices.getPortion(
      geometry.indices.length,
      ( newBase: number ) => {
        this._meshAttribs.setStructObject(meshIndex, {
          indicesBase: newBase
        });
      }
    );

    this._indices.setPortionData(indicesHandle, geometry.indices);

    const edgeIndicesHandle = this._edgeIndices.getPortion(
      geometry.edgeIndices.length,
      ( newBase: number ) => {
        this._meshAttribs.setStructObject(meshIndex, {
          edgeIndicesBase: newBase
        });
      }
    );

    this._edgeIndices.setPortionData(edgeIndicesHandle, geometry.edgeIndices);

    this._meshAttribs.setStructObject(meshIndex, {
      tileIndex: 0, // Set by setMeshAttribs()
      geometryIndex: geometryHandle.geometryIndex,
      indicesBase: indicesHandle.base,
      edgeIndicesBase: edgeIndicesHandle.base
    });

    this._meshViewAttribs[0].setStructObject(meshIndex, {
      color: [sceneMesh.color[0], sceneMesh.color[1], sceneMesh.color[2], sceneMesh.opacity]
    });

    this._meshMatrices.setMatrix(meshIndex, sceneMesh.matrix);

    this._meshHandles[sceneMesh.id] = {
      meshIndex,
      primToMeshLookupHandle,
      indicesHandle,
      edgeIndicesHandle
    };

    return meshIndex;
  }

  /**
   * Sets the modeling transform matrix for a mesh.
   * The modeling transform is relative to the center of the meshes tile.
   *
   * @param meshIndex
   * @param matrix
   */
  setMeshMatrix(
    meshIndex: number,
    matrix: FloatArrayParam ): void {
    this._meshMatrices.setMatrix(meshIndex, matrix);
  }

  /**
   * Sets attributes for e mesh to apply across all Views.
   *
   * @param meshIndex
   * @param params
   * @param params.tileIndex Optional tileIndex of the Tile containing the mesh. This can be dynamically updated, as mesh can move between tiles.
   */
  setMeshAttribs(
    meshIndex: number,
    params: {
      tileIndex?: number;
    } ) {
    this._meshAttribs.setStructObject(meshIndex, params);
  }

  /**
   * Sets attributes for a mesh within a specific View.
   *
   * @param meshIndex
   * @param viewIndex
   * @param params
   */
  setMeshViewAttribs(
    meshIndex: number,
    viewIndex: number,
    params: {
      flags1?: number;
      flags2?: number;
      color?: number[];
    } ) {
    if (viewIndex < 0 || viewIndex >= this._meshViewAttribs.length) {
      throw "viewIndex out of range";
    }
    this._meshViewAttribs[viewIndex].setStructObject(meshIndex, params);
  }

  /**
   * Removes a SceneMesh from data texture memory.
   *
   * @param sceneMesh
   */
  removeMesh( sceneMesh: SceneMesh ): void {
    const meshHandle = this._meshHandles[sceneMesh.id];
    if (!meshHandle) {
      return;
    }

    const geometry = sceneMesh.geometry;
    const geometryHandle = this._geometryHandles[geometry.id];

    if (geometryHandle && --geometryHandle.useCount <= 0) {
      if (geometryHandle.positionsPortion) {
        this._positions.putPortion(geometryHandle.positionsPortion);
      }
      delete this._geometryHandles[geometry.id];
      this._putFreeGeometryIndex(geometryHandle.geometryIndex);
      this._numGeometries--;
    }
    if (meshHandle.primToMeshLookupHandle) {
      this._primToMeshLookup.putPortion(meshHandle.primToMeshLookupHandle);
    }
    if (meshHandle.indicesHandle) {
      this._indices.putPortion(meshHandle.indicesHandle);
    }
    if (meshHandle.edgeIndicesHandle) {
      this._edgeIndices.putPortion(meshHandle.edgeIndicesHandle);
    }

    delete this._meshHandles[sceneMesh.id];
    this._putFreeMeshIndex(meshHandle.meshIndex);
    this._numMeshes--;
  }

  _getFreeMeshIndex(): number {
    for (let i = this._lastFreeMeshIndex; ; i = (i + 1) % MAX_MESHES) {
      if (!this._meshIndicesUsed[i]) {
        this._meshIndicesUsed[i] = true;
        return i;
      }
    }
  }

  _putFreeMeshIndex( index: number ): void {
    if (this._meshIndicesUsed[index]) {
      delete this._meshIndicesUsed[index];
      this._lastFreeMeshIndex = index;
    }
  }

  _getFreeGeometryIndex(): number {
    for (let i = this._lastFreeGeometryIndex; ; i = (i + 1) % MAX_GEOMETRIES) {
      if (!this._geometryIndicesUsed[i]) {
        this._geometryIndicesUsed[i] = true;
        return i;
      }
    }
  }

  _putFreeGeometryIndex( index: number ): void {
    if (this._geometryIndicesUsed[index]) {
      delete this._geometryIndicesUsed[index];
      this._lastFreeGeometryIndex = index;
    }
  }

  destroy() {
    this._primToMeshLookup.destroy();
    this._meshAttribs.destroy();
    this._meshViewAttribs.forEach(( viewArray ) => viewArray.destroy());
    this._geometryAttribs.destroy();
    this._indices.destroy();
    this._edgeIndices.destroy();
    this._positions.destroy();
    this._meshMatrices.destroy();
    this._tileViewMatrices.forEach(( viewArray ) => viewArray.destroy());
  }
}
