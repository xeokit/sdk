import type {FloatArrayParam} from "../../math";
import {SceneMesh} from "../../scene";
import {RenderContext} from "../RenderContext";
import {DTXMeshViewAttribs} from "./dtx/DTXMeshViewAttribs";
import {DTXMeshAttribs} from "./dtx/DTXMeshAttribs";
import {DTXQuantRanges} from "./dtx/DTXQuantRanges";
import {DTXPositionsArray} from "./dtx/DTXPositionsArray";
import {DTXVertexColorsArray} from "./dtx/DTXVertexColorsArray";
import {DTXMatrixArray} from "./dtx/DTXMatrixArray";
import {DTXPointerArray} from "./dtx/DTXPointerArray";
import {DTXGeometryAttribs} from "./dtx/DTXGeometryAttribs";
import {DataTexturesLayer} from "./DataTexturesLayer";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../constants";

const MAX_MESHES = 500000;
const MAX_GEOMETRIES = 500000;

/**
 * Manages GPU-resident, dynamically-editable data storage for model geometry and attributes.
 *
 * @private
 */
export class GPUMemoryLayer {

  /**
   * The data textures that implement GPU-side model storage for this GPUMemoryLayer.
   */
  dataTextures: DataTexturesLayer;

  /**
   * Index of this GPUMemoryLayer within the GPUMemory.layers array.
   */
  public index: number;

  private _indices: DTXPointerArray;
  private _meshAttribs: DTXMeshAttribs;
  private _meshViewAttribs: DTXMeshViewAttribs[];
  private _geometryQuantRanges: DTXQuantRanges;
  private _geometryAttribs: DTXGeometryAttribs;
  private _edgeIndices: DTXPointerArray;
  private _primToMeshLookup: DTXPointerArray;
  private _positions: DTXPositionsArray;
  private _vertexColors: DTXVertexColorsArray;
  private _meshMatrices: DTXMatrixArray;

  private _meshIndicesUsed: boolean[];
  private _meshes: {};
  private _sceneMeshes: {};
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
  private _maxSlices: number;
  private _maxLights: number;
  private _renderContext: RenderContext;
  private _maxIndices: number;
  private _maxPositions: number;
  private _maxPrims: number;

  /**
   *
   */
  constructor( index: number, renderContext: RenderContext ) {

    this.index = index;

    this._renderContext = renderContext;

    this._geometryHandles = {};
    this._meshHandles = {};
    this._sceneMeshes = {};

    this._meshIndicesUsed = [];
    this._lastFreeMeshIndex = 0;
    this._meshes = {};
    this._geometryIndicesUsed = [];
    this._lastFreeGeometryIndex = 0;
    this._geometries = {};

    this._numGeometries = 0;
    this._numMeshes = 0;

    this._maxMeshes = 1000000;
    this._maxGeometries = 1000000;
    this._maxIndices = 8000000;
    this._maxPrims = this._maxIndices / 3; // TODO: Assumes triangles
    this._maxPositions = 8000000;

    this._maxSlices = 100;
    this._maxLights = 100;
    this._maxTiles = 20000;

    const gl = renderContext.gl;

    this._primToMeshLookup = new DTXPointerArray({gl, capacity: this._maxPrims});
    this._meshAttribs = new DTXMeshAttribs({gl, capacity: this._maxMeshes});
    this._meshViewAttribs = [
      new DTXMeshViewAttribs({gl, capacity: this._maxMeshes}),
      new DTXMeshViewAttribs({gl, capacity: this._maxMeshes}),
      new DTXMeshViewAttribs({gl, capacity: this._maxMeshes}),
      new DTXMeshViewAttribs({gl, capacity: this._maxMeshes})
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

    this._meshMatrices = new DTXMatrixArray({gl, maxMatrices: this._maxMeshes});
    this._geometryAttribs = new DTXGeometryAttribs({gl, capacity: this._maxGeometries});
    this._geometryQuantRanges = new DTXQuantRanges({gl, capacity: this._maxMeshes});
    this._indices = new DTXPointerArray({gl, capacity: this._maxIndices});
    this._edgeIndices = new DTXPointerArray({gl, capacity: this._maxIndices});
    this._positions = new DTXPositionsArray({gl, capacity: this._maxPositions});
    this._vertexColors = new DTXVertexColorsArray({gl, capacity: this._maxPositions});

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
      geometryQuantRanges: this._geometryQuantRanges.texture,
      positions: this._positions.texture,
      vertexColors: this._vertexColors.texture
    };

    // this.structSpecs = {
    //   MeshAttribs: this._meshAttribs.structSpec
    // }
  }

  /**
   * Check if there is enough memory for a SceneMesh.
   * @param sceneMesh
   */
  hasMemoryForMesh( sceneMesh: SceneMesh ): boolean {
    // Mesh capacity
    if (this._numMeshes >= this._maxMeshes) {
      return false;
    }
    const geometry = sceneMesh.geometry;
    if (!geometry) return false;
    // New geometry handle capacity (only if not already tracked)
    if (!this._geometryHandles[geometry.id] && this._numGeometries >= this._maxGeometries) {
      return false;
    }
    // Vertex count (assumes 3 components per vertex)
    const vertCount = (geometry.positionsCompressed?.length ?? 0) / 3;
    if (vertCount <= 0 || this._positions.canGetPortion(vertCount) === false) {
      return false;
    }
    const isPoints = geometry.primitive === PointsPrimitive;
    if (isPoints) {
      // For points, prim→mesh lookup is sized by vertex count
      if (this._primToMeshLookup.canGetPortion(vertCount) === false) {
        return false;
      }
    } else {
      // For triangles, prim→mesh lookup is sized by triangle count
      const indexCount = geometry.indices?.length ?? 0;
      const triCount = indexCount / 3;
      if (this._primToMeshLookup.canGetPortion(triCount) === false) {
        return false;
      }
      if (geometry.indices && this._indices.canGetPortion(indexCount) === false) {
        return false;
      }
      if (geometry.edgeIndices && this._edgeIndices.canGetPortion(geometry.edgeIndices.length) === false) {
        return false;
      }
    }
    if (geometry.colorsCompressed && this._vertexColors.canGetPortion(geometry.colorsCompressed.length) === false) {
      return false;
    }
    return true;
  }


  /**
   * Adds a SceneMesh to data texture gpuMemory.
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
        geometry.positionsCompressed.length / 3, // 3xcomponents per position
        ( newBase: number ) => {
          const verticesBase = newBase / 3 // 3xcomponents per position
          this._geometryAttribs.setAttribs(geometryIndex, {verticesBase});
        });

      this._positions.setPortionData(positionsPortion, geometry.positionsCompressed);

      const [xmin, ymin, zmin, xmax, ymax, zmax] = geometry.aabb;

      this._geometryQuantRanges.setQuantRange(
        geometryIndex,
        [xmin, ymin, zmin],
        [(xmax - xmin) / 65536, (ymax - ymin) / 65536, (zmax - zmin) / 65536]);

      let vertexColorsPortion = null;
      if (geometry.colorsCompressed) {
        vertexColorsPortion = this._vertexColors.getPortion(geometry.colorsCompressed.length / 3); // RGB (0..255, 0..255, 0..255)
        this._vertexColors.setPortionData(vertexColorsPortion, geometry.colorsCompressed);
      }

      this._geometryAttribs.setAttribs(geometryIndex, {
        verticesBase: positionsPortion.base / 3 // XYZ
      });

      geometryHandle = {
        positionsPortion,
        vertexColorsPortion,
        geometryIndex,
        useCount: 0
      };

      this._geometryHandles[geometry.id] = geometryHandle;

      this._numGeometries++;
    }

    geometryHandle.useCount++;

    const primitiveCount = geometry.primitive === PointsPrimitive
      ? geometry.positionsCompressed.length / 3
      : geometry.primitive === LinesPrimitive
        ? geometry.indices.length / 2
        : geometry.indices.length / 3;

    const primToMeshLookupHandle = this._primToMeshLookup.getPortion(
      // geometry.indices.length, // Per-index
      primitiveCount, // Per-prim
      ( newBase: number ) => {
        this._meshAttribs.setAttribs(meshIndex, {
          primsBase: newBase
        });
      }
    );

    this._primToMeshLookup.fillPortion(primToMeshLookupHandle, meshIndex);

    let indicesHandle = null; // Only used for Lines and Triangles
    let edgeIndicesHandle = null; // Only used for Triangles

    if (geometry.primitive !== PointsPrimitive && geometry.indices) {

      indicesHandle = this._indices.getPortion(
        geometry.indices.length,
        ( newBase: number ) => {
          this._meshAttribs.setAttribs(meshIndex, {
            indicesBase: newBase
          });
        }
      );

      this._indices.setPortionData(indicesHandle, geometry.indices);

      if (geometry.primitive === TrianglesPrimitive && geometry.edgeIndices) {

        edgeIndicesHandle = this._edgeIndices.getPortion(
          geometry.edgeIndices.length,
          ( newBase: number ) => {
            this._meshAttribs.setAttribs(meshIndex, {
              edgeIndicesBase: newBase
            });
          }
        );

        this._edgeIndices.setPortionData(edgeIndicesHandle, geometry.edgeIndices);
      }
    }

    this._meshAttribs.setAttribs(meshIndex, {
      tileIndex: 0, // Set by setMeshAttribs()
      geometryIndex: geometryHandle.geometryIndex,
      indicesBase: indicesHandle?.base,
      edgeIndicesBase: edgeIndicesHandle?.base,
      primsBase: primToMeshLookupHandle.base
    });

    this._meshViewAttribs[0].setAttribs(meshIndex, { // FIXME: Only defined for View 0
      color: [
        Math.floor(sceneMesh.color[0] * 255.0),
        Math.floor(sceneMesh.color[1] * 255.0),
        Math.floor(sceneMesh.color[2] * 255.0),
        Math.floor(sceneMesh.opacity * 255.0)
      ]
    });

    this._meshMatrices.setMatrix(meshIndex, sceneMesh.matrix);

    this._meshHandles[sceneMesh.id] = {
      meshIndex,
      primToMeshLookupHandle,
      indicesHandle,
      edgeIndicesHandle
    };

    this._sceneMeshes[meshIndex] = sceneMesh;

    this._numMeshes++;

    this._needRenderAllViews();

    return meshIndex;
  }

  /**
   * Sets the modeling transform matrix for a mesh.
   * The modeling transform is relative to the center of the meshes tile.
   *
   * Sets RenderContext.viewFlags[...].needsRender to true.
   *
   * @param meshIndex
   * @param matrix
   */
  setMeshMatrix(
    meshIndex: number,
    matrix: FloatArrayParam ): void {
    this._meshMatrices.setMatrix(meshIndex, matrix);
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
   * @param meshIndex
   * @param params
   * @param params.tileIndex Optional tileIndex of the Tile containing the mesh. This can be dynamically updated, as mesh can move between tiles.
   */
  setMeshAttribs(
    meshIndex: number,
    params: {
      tileIndex?: number;
    } ) {
    this._meshAttribs.setAttribs(meshIndex, params);
    this._needRenderAllViews();
  }

  /**
   * Sets attributes for a mesh within a specific View.
   *
   * Sets RenderContext.viewFlags[viewIndex].needsRender to true.
   *
   * @param meshIndex
   * @param viewIndex
   * @param params
   */
  setMeshViewAttribs(
    meshIndex: number,
    viewIndex: number,
    params: {
      color?: number[];   // uvec4 bytes 0..255
      flags1?: number;  // uvec4 bytes 0..255
      flags2?: number;  // uvec4 bytes 0..255
    } ) {
    if (viewIndex < 0 || viewIndex >= this._meshViewAttribs.length) {
      throw new Error(`GPUMemoryLayer.setMeshViewAttribs: Invalid viewIndex ${viewIndex}`);
    }
    this._meshViewAttribs[viewIndex].setAttribs(meshIndex, params);
    this._needRenderView(viewIndex);
  }

  private _needRenderView( viewIndex: number ) {
    this._renderContext.viewFlags[viewIndex].needsRender = true;
  }

  /**
   * Removes a SceneMesh from data texture gpuMemory.
   *
   * @param meshIndex
   */
  removeMesh( meshIndex: number ): void {
    const sceneMesh = this._sceneMeshes[meshIndex];
    if (!sceneMesh) {
      return;
    }
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
      if (geometryHandle.vertexColorsPortion) {
        this._vertexColors.putPortion(geometryHandle.vertexColorsPortion);
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
    delete this._sceneMeshes[meshIndex];
    this._numMeshes--;
    this._needRenderAllViews();
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

  /**
   * Flush any pending updates to the GPU.
   */
  flush() {
    this._indices.flush()
    this._meshAttribs.flush();
    for (let i = 0; i < 4; i++) {
      this._meshViewAttribs[i].flush();
    }
    this._geometryQuantRanges.flush();
    this._geometryAttribs.flush();
    this._edgeIndices.flush();
    this._positions.flush();
    this._vertexColors.flush();
    this._meshMatrices.flush();
    this._primToMeshLookup.flush();
  }

  destroy() {
    const clear = ( ref: any ) => {
      if (ref) {
        ref.destroy();
        return null;
      }
      return ref;
    };
    this._onTick = clear(this._onTick);
    this._primToMeshLookup = clear(this._primToMeshLookup);
    this._meshAttribs = clear(this._meshAttribs);
    this._meshViewAttribs = this._meshViewAttribs.map(clear);
    this._geometryAttribs = clear(this._geometryAttribs);
    this._indices = clear(this._indices);
    this._edgeIndices = clear(this._edgeIndices);
    this._positions = clear(this._positions);
    this._vertexColors = clear(this._vertexColors);
    this._meshMatrices = clear(this._meshMatrices);

  }
}
