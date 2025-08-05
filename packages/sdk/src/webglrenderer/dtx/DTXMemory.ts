import {SceneMesh} from "../../scene";

import {DTXMatrixArray} from "../../webglutils/dtx/DTXMatrixArray";
import {DTXTiles} from "./DTXTiles";
import type {FloatArrayParam} from "../../math";
import {DTXArray} from "../../webglutils/dtx/DTXArray";
import {DTXStructArray, type DTXStructSpec} from "../../webglutils/dtx/DTXStructArray";
import {type WebGLAbstractTexture} from "../../webglutils";
import {type DTXTile} from "./DTXTile";
import {Viewer} from "../../viewer";

const MAX_MESHES = 100000;
const MAX_GEOMETRIES = 100000;


/**
 * GPU-resident dynamically-editable data store for model geometry and attributes, implemented as a set of data textures.
 * @internal
 */
export class DTXMemory {

  /**
   * The data textures that implement GPU-side model storage for this DTXMemory.
   */
  dataTextures: {

    /**
     * Primitive indices for gl.drawArrays
     */
    uniqueIndices: WebGLAbstractTexture;

    /**
     * Edge indices for gl.drawArrays
     */
    uniqueEdgeIndices: WebGLAbstractTexture;

    /**
     * Maps each primitive to its mesh
     */
    primToMeshLookup: WebGLAbstractTexture;

    /**
     * Table of mesh attributes that are global to all Views.
     */
    meshAttributes: WebGLAbstractTexture;

    /**
     * For each View, a table of mesh attributes local to that View.
     */
    meshViewAttributes: WebGLAbstractTexture[];

    meshMatrices: WebGLAbstractTexture;

    geometryAttributes: WebGLAbstractTexture;

    positions: WebGLAbstractTexture;

    tileViewMatrices: WebGLAbstractTexture[];
  };

  #uniqueIndices: DTXArray<any>;
  #meshAttributes: DTXStructArray;
  #meshViewAttributes: DTXStructArray[];
  #tiles: DTXTiles;
  #geometryAttributes: DTXStructArray;
  #uniqueEdgeIndices: DTXArray<any>;
  #primToMeshLookup: DTXArray<any>;
  #positions: DTXArray<any>;
  #meshMatrices: DTXMatrixArray;
  #tileViewMatrices: DTXMatrixArray[];

  #meshIndicesUsed: boolean[];
  #meshes: {};
  #maxTiles: number;
  #numMeshes: number;
  #maxMeshes: number;
  #geometryIndicesUsed: boolean[];
  #geometries: {};
  #numGeometries: number;
  #maxGeometries: number;
  #lastFreeMeshIndex: number;
  #lastFreeGeometryIndex: number;
  #geometryHandles: any;
  #meshHandles: any;
  #onTick: () => void;
  #viewer: Viewer;

  /**
   *
   */
  constructor(params: {
    gl: WebGL2RenderingContext,
    viewer: Viewer
  }) {

    const {gl, viewer} = params;

    this.#viewer = viewer;
    this.#geometryHandles = {};
    this.#meshHandles = {};

    this.#meshIndicesUsed = [];
    this.#lastFreeMeshIndex = 0;
    this.#meshes = {};
    this.#numMeshes = 0;
    this.#maxMeshes = 20000;
    this.#maxTiles = 20000;
    this.#geometryIndicesUsed = [];
    this.#lastFreeGeometryIndex = 0;
    this.#geometries = {};
    this.#numGeometries = 0;
    this.#maxGeometries = 20000;

    this.#primToMeshLookup = new DTXArray({
      gl,
      capacity: 100000,
      ArrayType: Uint32Array
    });

    // Attributes for each SceneMesh

    this.#meshAttributes = new DTXStructArray({
      gl,
      capacity: this.#maxMeshes,
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

    this.#meshViewAttributes = [
      new DTXStructArray({gl, capacity: this.#maxMeshes, structSpec: meshViewAttributesStruct}),
      new DTXStructArray({gl, capacity: this.#maxMeshes, structSpec: meshViewAttributesStruct}),
      new DTXStructArray({gl, capacity: this.#maxMeshes, structSpec: meshViewAttributesStruct}),
      new DTXStructArray({gl, capacity: this.#maxMeshes, structSpec: meshViewAttributesStruct})
    ];

    // Matrix for each SceneMesh

    this.#meshMatrices = new DTXMatrixArray({gl});

    // Attributes for each SceneGeometry

    this.#geometryAttributes = new DTXStructArray({
      gl,
      capacity: 10000, // TODO
      structSpec: {
        name: "GeometryAttributes",
        fields: [
          {name: "vertexBase", type: "scalar"}, // Base of the geometry's portion in #positions DTX array
          {name: "dequantizeOffset", type: "vec3"}, // Min position dequantization range
          {name: "dequantizeScale", type: "vec3"} // Position dequantization scale
        ]
      }
    });

    // Concatenation of all indices for a gl draw call (ie. gl.drawElements)

    this.#uniqueIndices = new DTXArray({
      gl,
      capacity: 100000,
      ArrayType: Uint32Array
    });

    // Concatenation of all edge indices for a gl draw call (ie. gl.drawElements)

    this.#uniqueEdgeIndices = new DTXArray({
      gl, capacity: 100000,
      ArrayType: Uint32Array
    });

    // Concatenation of all vertex positions

    this.#positions = new DTXArray({
      gl, capacity: 100000,
      ArrayType: Uint16Array
    });

    // For each View, an array containing a viewing transform matrix for each tile

    this.#tileViewMatrices = [
      new DTXMatrixArray({gl, maxMatrices: this.#maxTiles}),
      new DTXMatrixArray({gl, maxMatrices: this.#maxTiles}),
      new DTXMatrixArray({gl, maxMatrices: this.#maxTiles}),
      new DTXMatrixArray({gl, maxMatrices: this.#maxTiles})
    ];

    // Tile manager

    this.#tiles = new DTXTiles(gl, viewer, this.#tileViewMatrices);

    // Periodically upload dirty data to GPU

    this.#onTick = viewer.onTick.subscribe(() => {
      this.#uniqueIndices.flush()
      this.#meshAttributes.flush();
      for (let i = 0; i < 4; i++) {
        this.#meshViewAttributes[i].flush();
      }
      this.#geometryAttributes.flush();
      this.#uniqueEdgeIndices.flush();
      this.#primToMeshLookup.flush();
      this.#positions.flush();
      this.#meshMatrices.flush();
      for (let i = 0; i < 4; i++) {
        this.#tileViewMatrices[i].flush();
      }
    });

    // Expose data textures for LayerRenderer to use

    this.dataTextures = {
      uniqueIndices: this.#uniqueIndices.texture,
      uniqueEdgeIndices: this.#uniqueEdgeIndices.texture,
      primToMeshLookup: this.#primToMeshLookup.texture,
      meshMatrices: this.#meshMatrices.texture,
      meshAttributes: this.#meshAttributes.texture,
      meshViewAttributes: [
        this.#meshViewAttributes[0].texture,
        this.#meshViewAttributes[1].texture,
        this.#meshViewAttributes[2].texture,
        this.#meshViewAttributes[3].texture
      ],
      geometryAttributes: this.#geometryAttributes.texture,
      positions: this.#positions.texture,
      tileViewMatrices: [
        this.#tileViewMatrices[0].texture,
        this.#tileViewMatrices[1].texture,
        this.#tileViewMatrices[2].texture,
        this.#tileViewMatrices[3].texture
      ]
    };

    // this.structSpecs = {
    //   MeshAttributes: this.#meshAttributes.structSpec
    // }
  }

  /**
   * Get a DTXTile that contains the given 3D World-space position.
   * @param worldPos A 3D position in world space.
   */
  getTile(worldPos: FloatArrayParam): DTXTile {
    return this.#tiles.getTile(worldPos);
  }

  /**
   * Move a DTXTile, if necessary, so that it contains the given World-space 3D position.
   * @param tile The tile to potentially move.
   * @param worldPos The target world-space position.
   */
  moveTile(tile: DTXTile, worldPos: FloatArrayParam): DTXTile {
    return this.#tiles.moveTile(tile, worldPos);
  }

  /**
   * Releases a DTXTile back to the tile manager.
   * The DTXTile is destroyed as soon as it is released as many times as it was retrieved.
   * @param tile The tile to release.
   */
  putTile(tile: DTXTile) {
    this.#tiles.putTile(tile);
  }

  /**
   * Adds a SceneMesh to data texture memory.
   *
   * Returns an index/handle through which you can dynamically update attributes for the mesh.
   *
   * @param sceneMesh
   */
  addMesh(sceneMesh: SceneMesh): number {

    const existingMeshHandle = this.#meshHandles[sceneMesh.id];

    if (existingMeshHandle) {
      return existingMeshHandle.meshIndex;
    }

    const meshIndex = this.#getFreeMeshIndex();
    const geometry = sceneMesh.geometry;

    let geometryHandle = this.#geometryHandles[geometry.id];

    if (!geometryHandle) {

      const geometryIndex = this.#getFreeGeometryIndex();

      const positionsPortion = this.#positions.getPortion(
        geometry.positionsCompressed.length,
        (newBase: number) => {

          this.#geometryAttributes.setStructObject(geometryIndex, {
            vertexBase: newBase / 3 // TODO: Assumes triangles
          });
        });

      this.#positions.setPortionData(positionsPortion, geometry.positionsCompressed);

      this.#geometryAttributes.setStructObject(geometryIndex, {
        vertexBase: positionsPortion.base / 3,
        dequantizeOffset: [], // TODO
        dequantizeScale: [] // TODO
      });

      geometryHandle = {
        positionsPortion,
        geometryIndex,
        useCount: 0
      };

      this.#geometryHandles[geometry.id] = geometryHandle;
    }

    geometryHandle.useCount++;

    const primitiveCount = geometry.indices.length / 3; // TODO

    const primToMeshLookupHandle = this.#primToMeshLookup.getPortion(
      primitiveCount,
      (newBase: number) => {
        // this.#meshAttributes.setStructObject(meshIndex, {
        //   uniqueIndicesBase: newBase
        // });
      }
    );

    this.#primToMeshLookup.fillPortion(primToMeshLookupHandle, meshIndex);

    const uniqueIndicesHandle = this.#uniqueIndices.getPortion(
      geometry.indices.length,
      (newBase: number) => {
        this.#meshAttributes.setStructObject(meshIndex, {
          uniqueIndicesBase: newBase
        });
      }
    );

    this.#uniqueIndices.setPortionData(uniqueIndicesHandle, geometry.indices);

    const uniqueEdgeIndicesHandle = this.#uniqueEdgeIndices.getPortion(
      geometry.edgeIndices.length,
      (newBase: number) => {
        this.#meshAttributes.setStructObject(meshIndex, {
          uniqueEdgeIndicesBase: newBase
        });
      }
    );

    this.#uniqueEdgeIndices.setPortionData(uniqueEdgeIndicesHandle, geometry.edgeIndices);

    this.#meshAttributes.setStructObject(meshIndex, {
      tileIndex: 987654321,
      geometryIndex: geometryHandle.geometryIndex,
      uniqueIndicesBase: uniqueIndicesHandle.base,
      uniqueEdgeIndicesBase: uniqueEdgeIndicesHandle.base
      // pickColor redundant
    });

    this.#meshViewAttributes[0].setStructObject(meshIndex, {
      ///////////////////////
      // TODO
      ///////////////////////
      color: [1, 1, 1]
    });

    this.#meshViewAttributes[1].setStructObject(meshIndex, {
      color: [1, 1, 1]
    });

    //...

    this.#meshMatrices.setMatrix(meshIndex, sceneMesh.matrix);

    this.#meshHandles[sceneMesh.id] = {
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
  setMeshMatrix(meshIndex: number, matrix: FloatArrayParam): void {
    this.#meshMatrices.setMatrix(meshIndex, matrix);
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
    this.#meshAttributes.setStructObject(meshIndex, params);
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
    if (viewIndex < 0 || viewIndex >= this.#meshViewAttributes.length) {
      throw "viewIndex out of range";
    }
    this.#meshViewAttributes[viewIndex].setStructObject(meshIndex, params);
  }

  /**
   * Removes a SceneMesh from data texture memory.
   *
   * @param sceneMesh
   */
  removeMesh(sceneMesh: SceneMesh): void {
    const meshHandle = this.#meshHandles[sceneMesh.id];
    if (!meshHandle) return;

    const geometry = sceneMesh.geometry;
    const geometryHandle = this.#geometryHandles[geometry.id];

    if (geometryHandle && --geometryHandle.useCount <= 0) {
      if (geometryHandle.positionsPortion) {
        this.#positions.putPortion(geometryHandle.positionsPortion);
      }
      delete this.#geometryHandles[geometry.id];
      this.#putFreeGeometryIndex(geometryHandle.geometryIndex);
      this.#numGeometries--;
    }

    if (meshHandle.primToMeshLookupHandle) {
      this.#primToMeshLookup.putPortion(meshHandle.primToMeshLookupHandle);
    }
    if (meshHandle.uniqueIndicesHandle) {
      this.#uniqueIndices.putPortion(meshHandle.uniqueIndicesHandle);
    }
    if (meshHandle.uniqueEdgeIndicesHandle) {
      this.#uniqueEdgeIndices.putPortion(meshHandle.uniqueEdgeIndicesHandle);
    }

    delete this.#meshHandles[sceneMesh.id];
    this.#putFreeMeshIndex(meshHandle.meshIndex);
    this.#numMeshes--;
  }

  #getFreeMeshIndex(): number {
    for (let i = this.#lastFreeMeshIndex; ; i = (i + 1) % MAX_MESHES) {
      if (!this.#meshIndicesUsed[i]) {
        this.#meshIndicesUsed[i] = true;
        return i;
      }
    }
  }

  #putFreeMeshIndex(index: number): void {
    if (this.#meshIndicesUsed[index]) {
      delete this.#meshIndicesUsed[index];
      this.#lastFreeMeshIndex = index;
    }
  }

  #getFreeGeometryIndex(): number {
    for (let i = this.#lastFreeGeometryIndex; ; i = (i + 1) % MAX_GEOMETRIES) {
      if (!this.#geometryIndicesUsed[i]) {
        this.#geometryIndicesUsed[i] = true;
        return i;
      }
    }
  }

  #putFreeGeometryIndex(index: number): void {
    if (this.#geometryIndicesUsed[index]) {
      delete this.#geometryIndicesUsed[index];
      this.#lastFreeGeometryIndex = index;
    }
  }
}
