import {SceneMesh} from "../../scene";

import {DTXMatrixArray} from "../../webglutils/dtx/DTXMatrixArray";
import {TileManager} from "./TileManager";
import type {FloatArrayParam} from "../../math";
import {DTXArray} from "../../webglutils/dtx/DTXArray";
import {DTXStructArray, type DTXStructSpec} from "../../webglutils/dtx/DTXStructArray";
import {type RenderTile} from "./RenderTile";
import {Viewer} from "../../viewer";
import {type GPUDataMemoryViewIF} from "./GPUDataMemoryViewIF";
import {type GPUDataMemoryEditorIF} from "./GPUDataMemoryEditorIF";
import {type GPUDataTextures} from "./GPUDataTextures";
import {DTXPositionsArray} from "../../webglutils";

const MAX_MESHES = 100000;
const MAX_GEOMETRIES = 100000;


/**
 * Manages GPU-resident, dynamically-editable data storage for model geometry and attributes.
 *
 * The `GPUDataMemory` class implements a data texture-based system for efficient storage and
 * rendering of large-scale 3D scenes. It handles memory allocation, updates, and synchronization
 * for meshes, geometries, and tiles, integrating tightly with WebGL rendering pipelines.
 */
export class GPUDataMemory implements GPUDataMemoryViewIF, GPUDataMemoryEditorIF  {

  /**
   * The data textures that implement GPU-side model storage for this GPUDataMemory.
   */
  dataTextures: GPUDataTextures;

  private _uniqueIndices: DTXArray<any>;
  private _meshAttributes: DTXStructArray;
  private _meshViewAttributes: DTXStructArray[];
  private _tiles: TileManager;
  private _geometryAttributes: DTXStructArray;
  private _uniqueEdgeIndices: DTXArray<any>;
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
  constructor(params: {
    gl: WebGL2RenderingContext,
    viewer: Viewer
  }) {

    const {gl, viewer} = params;

    this._viewer = viewer;
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

    this._meshAttributes = new DTXStructArray({
      gl,
      capacity: this._maxMeshes,
      structSpec: {
        name: "MeshAttributes",
        fields: [
          {name: "tileIndex", type: "scalar"},
          {name: "geometryIndex", type: "scalar"},
          {name: "uniqueIndicesBase", type: "scalar"},
          {name: "uniqueEdgeIndicesBase", type: "scalar"},
          {name: "pickColor", type: "vec4"}
        ]
      }
    });

    // Per-View attributes for each SceneMesh

    const meshViewAttributesStruct: DTXStructSpec = {
      name: "MeshViewAttributes",
      fields: [
        {name: "flags1", type: "vec4"},
        {name: "flags2", type: "vec4"},
        {name: "color", type: "vec4"}
      ]
    };

    this._meshViewAttributes = [
      new DTXStructArray({gl, capacity: this._maxMeshes, structSpec: meshViewAttributesStruct}),
      new DTXStructArray({gl, capacity: this._maxMeshes, structSpec: meshViewAttributesStruct}),
      new DTXStructArray({gl, capacity: this._maxMeshes, structSpec: meshViewAttributesStruct}),
      new DTXStructArray({gl, capacity: this._maxMeshes, structSpec: meshViewAttributesStruct})
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

    this._geometryAttributes = new DTXStructArray({
      gl,
      capacity: 10000, // TODO
      structSpec: {
        name: "GeometryAttributes",
        fields: [
          {name: "vertexBase", type: "scalar"}, // Base of the geometry's portion in _positions DTX array
          {name: "dequantizeOffset", type: "vec3"}, // Min position dequantization range
          {name: "dequantizeScale", type: "vec3"} // Position dequantization scale
        ]
      }
    });

    // Concatenation of all indices for a gl draw call (ie. gl.drawElements)

    this._uniqueIndices = new DTXArray({
      gl,
      capacity: 100000,
      ArrayType: Uint32Array
    });

    // Concatenation of all edge indices for a gl draw call (ie. gl.drawElements)

    this._uniqueEdgeIndices = new DTXArray({
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
      this._uniqueIndices.flush()
      this._meshAttributes.flush();
      for (let i = 0; i < 4; i++) {
        this._meshViewAttributes[i].flush();
      }
      this._geometryAttributes.flush();
      this._uniqueEdgeIndices.flush();
      this._primToMeshLookup.flush();
      this._positions.flush();
      this._meshMatrices.flush();
      for (let i = 0; i < 4; i++) {
        this._tileViewMatrices[i].flush();
      }
    });

    // Expose data textures for LayerRenderer to use

    this.dataTextures = {
      uniqueIndices: this._uniqueIndices.texture,
      uniqueEdgeIndices: this._uniqueEdgeIndices.texture,
      primToMeshLookup: this._primToMeshLookup.texture,
      meshMatrices: this._meshMatrices.texture,
      meshAttributes: this._meshAttributes.texture,
      meshViewAttributes: [
        this._meshViewAttributes[0].texture,
        this._meshViewAttributes[1].texture,
        this._meshViewAttributes[2].texture,
        this._meshViewAttributes[3].texture
      ],
      geometryAttributes: this._geometryAttributes.texture,
      positions: this._positions.texture,
      tileViewMatrices: [
        this._tileViewMatrices[0].texture,
        this._tileViewMatrices[1].texture,
        this._tileViewMatrices[2].texture,
        this._tileViewMatrices[3].texture
      ]
    };

    // this.structSpecs = {
    //   MeshAttributes: this._meshAttributes.structSpec
    // }
  }

  /**
   * Get a RenderTile that contains the given 3D World-space position.
   * @param worldPos A 3D position in world space.
   */
  getTile(worldPos: FloatArrayParam): RenderTile {
    return this._tiles.getTile(worldPos);
  }

  /**
   * Move a RenderTile, if necessary, so that it contains the given World-space 3D position.
   * @param tile The tile to potentially move.
   * @param worldPos The target world-space position.
   */
  moveTile(tile: RenderTile, worldPos: FloatArrayParam): RenderTile {
    return this._tiles.moveTile(tile, worldPos);
  }

  /**
   * Releases a RenderTile back to GPUDataMemory.
   * The RenderTile is destroyed as soon as it is released as many times as it was retrieved.
   * @param tile The tile to release.
   */
  putTile(tile: RenderTile) {
    this._tiles.putTile(tile);
  }

  /**
   * Adds a SceneMesh to data texture memory.
   *
   * Returns an index/handle through which you can dynamically update attributes for the mesh.
   *
   * @param sceneMesh
   */
  addMesh(sceneMesh: SceneMesh): number {

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
        (newBase: number) => {

          this._geometryAttributes.setStructObject(geometryIndex, {
            vertexBase: newBase / 3 // TODO: Assumes triangles
          });
        });

      this._positions.setPortionData(positionsPortion, geometry.positionsCompressed);

      this._geometryAttributes.setStructObject(geometryIndex, {
        vertexBase: positionsPortion.base / 3,
        dequantizeOffset: [], // TODO
        dequantizeScale: [] // TODO
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
      (newBase: number) => {
        // this._meshAttributes.setStructObject(meshIndex, {
        //   uniqueIndicesBase: newBase
        // });
      }
    );

    this._primToMeshLookup.fillPortion(primToMeshLookupHandle, meshIndex);

    const uniqueIndicesHandle = this._uniqueIndices.getPortion(
      geometry.indices.length,
      (newBase: number) => {
        this._meshAttributes.setStructObject(meshIndex, {
          uniqueIndicesBase: newBase
        });
      }
    );

    this._uniqueIndices.setPortionData(uniqueIndicesHandle, geometry.indices);

    const uniqueEdgeIndicesHandle = this._uniqueEdgeIndices.getPortion(
      geometry.edgeIndices.length,
      (newBase: number) => {
        this._meshAttributes.setStructObject(meshIndex, {
          uniqueEdgeIndicesBase: newBase
        });
      }
    );

    this._uniqueEdgeIndices.setPortionData(uniqueEdgeIndicesHandle, geometry.edgeIndices);

    this._meshAttributes.setStructObject(meshIndex, {
      tileIndex: 987654321,
      geometryIndex: geometryHandle.geometryIndex,
      uniqueIndicesBase: uniqueIndicesHandle.base,
      uniqueEdgeIndicesBase: uniqueEdgeIndicesHandle.base
      // pickColor redundant
    });

    this._meshViewAttributes[0].setStructObject(meshIndex, {
      ///////////////////////
      // TODO
      ///////////////////////
      color: [1, 1, 1, 1]
    });

    this._meshViewAttributes[1].setStructObject(meshIndex, {
      color: [1, 1, 1, 1]
    });

    //...

    this._meshMatrices.setMatrix(meshIndex, sceneMesh.matrix);

    this._meshHandles[sceneMesh.id] = {
      meshIndex,
      primToMeshLookupHandle,
      uniqueIndicesHandle,
      uniqueEdgeIndicesHandle
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
    matrix: FloatArrayParam): void {
    this._meshMatrices.setMatrix(meshIndex, matrix);
  }

  /**
   * Sets attributes for e mesh to apply across all Views.
   *
   * @param meshIndex
   * @param params
   */
  setMeshAttributes(
    meshIndex: number,
    params: {
      tileIndex?: number;
    }) {
    this._meshAttributes.setStructObject(meshIndex, params);
  }

  /**
   * Sets attributes for a mesh within a specific View.
   *
   * @param meshIndex
   * @param viewIndex
   * @param params
   */
  setMeshViewAttributes(
    meshIndex: number,
    viewIndex: number,
    params: {
      flags?: number;
      flags2?: number;
      color?: number[];
    }) {
    if (viewIndex < 0 || viewIndex >= this._meshViewAttributes.length) {
      throw "viewIndex out of range";
    }
    this._meshViewAttributes[viewIndex].setStructObject(meshIndex, params);
  }

  /**
   * Removes a SceneMesh from data texture memory.
   *
   * @param sceneMesh
   */
  removeMesh(sceneMesh: SceneMesh): void {
    const meshHandle = this._meshHandles[sceneMesh.id];
    if (!meshHandle) return;

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
    if (meshHandle.uniqueIndicesHandle) {
      this._uniqueIndices.putPortion(meshHandle.uniqueIndicesHandle);
    }
    if (meshHandle.uniqueEdgeIndicesHandle) {
      this._uniqueEdgeIndices.putPortion(meshHandle.uniqueEdgeIndicesHandle);
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

  _putFreeMeshIndex(index: number): void {
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

  _putFreeGeometryIndex(index: number): void {
    if (this._geometryIndicesUsed[index]) {
      delete this._geometryIndicesUsed[index];
      this._lastFreeGeometryIndex = index;
    }
  }

  destroy() {
    this._primToMeshLookup.destroy();
    this._meshAttributes.destroy();
    this._meshViewAttributes.forEach((viewArray) => viewArray.destroy());
    this._geometryAttributes.destroy();
    this._uniqueIndices.destroy();
    this._uniqueEdgeIndices.destroy();
    this._positions.destroy();
    this._meshMatrices.destroy();
    this._tileViewMatrices.forEach((viewArray) => viewArray.destroy());

  }
}
