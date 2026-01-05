
import {SceneMesh} from "../../../scene";
import {RenderContext} from "../RenderContext";
import {DTXViewMeshAttribTable} from "./dtx/DTXViewMeshAttribTable";
import {DTXMeshAttribTable} from "./dtx/DTXMeshAttribTable";
import {DTXGeometryQuantRangeTable} from "./dtx/DTXGeometryQuantRangeTable";
import {DTXVertexPositions} from "./dtx/DTXVertexPositions";
import {DTXVertexColors} from "./dtx/DTXVertexColors";
import {DTXMatrixTable} from "./dtx/DTXMatrixTable";
import {DTXPointerArray} from "./dtx/DTXPointerArray";
import {DTXGeometryAttribTable} from "./dtx/DTXGeometryAttribTable";
import {type BatchDataTextures} from "./BatchDataTextures";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../../constants";
import {DTXPrimMeshIndexTable} from "./dtx/DTXPrimMeshIndexTable";
import {RENDER_PASSES, type RenderPassValue} from "../RENDER_PASSES";
import {SDKErrorType, SDKInternalException, type SDKResult} from "../../../core";
import {type MemoryConfigs} from "../../MemoryConfigs";
import type {Mat4, Vec3, Vec4} from "../../../math";
import {DataTexture} from "./dtx/DataTexture";

const MAX_MESHES = 500000;
const MAX_GEOMETRIES = 500000;

/**
 * Manages GPU-resident, dynamically-editable data storage for model geometry and attributes.
 *
 * @private
 */
export class GPUMemoryBatch {

  /**
   * The data textures that implement GPU-side model storage for this GPUMemoryBatch.
   */
  public dataTextures: BatchDataTextures;

  /**
   * Index of this GPUMemoryBatch within the GPUMemoryManager.sortedBatches array.
   */
  public index: number;

  private _indices: DTXPointerArray;
  private _mashAttribTable: DTXMeshAttribTable;
  private _meshViewAttribTable: DTXViewMeshAttribTable[];
  private _geometryQuantRangeTable: DTXGeometryQuantRangeTable;
  private _geometryAttribTable: DTXGeometryAttribTable;
  private _edgeIndices: DTXPointerArray;
  private primMeshIndexTables: DTXPrimMeshIndexTable[];
  private _vertexPositions: DTXVertexPositions;
  private _vertexColors: DTXVertexColors;
  private _meshMatrixTable: DTXMatrixTable;

  private _meshIndicesUsed: boolean[];
  private _meshes: {};
  private _sceneMeshes: {};
  private _numMeshes: number;
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
   * Creates a new GPUMemoryBatch.
   */
  constructor(index: number, renderContext: RenderContext) {

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
  }

  /**
   * Allocates all data textures for this GPUMemoryBatch.
   */
  allocate(): SDKResult<void> {

    const gl = this._renderContext.gl;

    const memoryConfigs: MemoryConfigs = this._renderContext.memoryConfigs;

    const bins = [
      RENDER_PASSES.OPAQUE,
      RENDER_PASSES.TRANSPARENT,
      RENDER_PASSES.HIGHLIGHTED,
      RENDER_PASSES.SELECTED,
      RENDER_PASSES.XRAYED
    ];

    this.primMeshIndexTables = [
      new DTXPrimMeshIndexTable({
        gl,
        maxItems: memoryConfigs.maxBatchPrims,
        bins,
        description: `[Batch ${this.index}, View 0] - primIndex -> meshIndex`
      }),
      // new DTXPrimDrawList({gl, maxItems: this._maxPrims, bins}),
      // new DTXPrimDrawList({gl, maxItems: this._maxPrims, bins}),
      // new DTXPrimDrawList({gl, maxItems: this._maxPrims, bins})
    ];

    this._mashAttribTable = new DTXMeshAttribTable({
      gl,
      maxItems: memoryConfigs.maxBatchMeshes,
      description: `[Batch ${this.index}] - meshIndex -> geometryIndex, tileIndex`,
      getNumItems: () => this._numMeshes
    });

    this._meshViewAttribTable = [
      new DTXViewMeshAttribTable({
        gl,
        maxItems: memoryConfigs.maxBatchMeshes,
        getNumItems: () => this._numMeshes,
        description: `[Batch ${this.index}, View 0] - meshIndex -> color, opacity, flags`
      }), // FIXME: Only defined for View 0
      // new DTXMeshViewAttribs({gl, maxItems: this._maxMeshes}),
      // new DTXMeshViewAttribs({gl, maxItems: this._maxMeshes}),
      // new DTXMeshViewAttribs({gl, maxItems: this._maxMeshes})

    ];

    this._meshMatrixTable = new DTXMatrixTable({
      gl,
      maxItems: memoryConfigs.maxBatchMeshes,
      getNumItems: () => this._numMeshes,
      description: `[Batch ${this.index}] - meshIndex -> modelMatrix`
    });

    this._geometryAttribTable = new DTXGeometryAttribTable({
      gl,
      maxItems: memoryConfigs.maxBatchGeometries,
      getNumItems: () => this._numGeometries,
      description: `[Batch ${this.index}] - geometryIndex -> verticesBase, indicesBase, edgeIndicesBase`
    });

    this._geometryQuantRangeTable = new DTXGeometryQuantRangeTable({
      gl,
      maxItems: memoryConfigs.maxBatchGeometries,
      getNumItems: () => this._numGeometries,
      description: `[Batch ${this.index}] - geometryIndex -> quantization ranges (offset, scale)`
    });

    this._indices = new DTXPointerArray({
      gl,
      maxItems: memoryConfigs.maxBatchIndices,
      description: `[Batch ${this.index}] - primitive indices`
    });

    this._edgeIndices = new DTXPointerArray({
      gl,
      maxItems: memoryConfigs.maxBatchIndices,
      description: `[Batch ${this.index}] - edge indices`
    });

    this._vertexPositions = new DTXVertexPositions({
      gl,
      maxItems: memoryConfigs.maxBatchVertices,
      description: `[Batch ${this.index}] - vertex XYZ positions`
    });

    this._vertexColors = new DTXVertexColors({
      gl,
      maxItems: memoryConfigs.maxBatchVertices,
      description: `[Batch ${this.index}] - vertex RGB colors`
    });

    const textures: {
      allocate(): SDKResult<void>;
      destroy(): void;
    }[] = [
      ...this.primMeshIndexTables,
      this._mashAttribTable,
      ...this._meshViewAttribTable,
      this._meshMatrixTable,
      this._geometryAttribTable,
      this._geometryQuantRangeTable,
      this._indices,
      this._edgeIndices,
      this._vertexPositions,
      this._vertexColors
    ];

    for (let i = 0, leni = textures.length; i < leni; i++) {
      const result = textures[i].allocate();
      if (result.ok === false) {
        for (let j = i - 1; j >= 0; j--) {
          textures[j].destroy();
        }
        return result;
      }
    }

    this.dataTextures = {
      views: [
        {
          numDrawablePrims: 0,
          primMeshIndexTable: this.primMeshIndexTables[0],
          meshViewAttribTable: this._meshViewAttribTable[0],
          renderPassPrimRanges: this.primMeshIndexTables[0].passRanges //  FIXME:
        },
        //     {
        //       numDrawablePrims: 0,
        //       primMeshIndexTable: this.primMeshIndexTables[1],
        //         meshViewAttribs: this._meshViewAttribTable[1],
        //       passRanges: this.primMeshIndexTables[1].passRanges
        //     },
        //     {
        //       numDrawablePrims: 0,
        //       primMeshIndexTable: this.primMeshIndexTables[2],
        //         meshViewAttribs: this._meshViewAttribTable[2],
        //       passRanges: this.primMeshIndexTables[2].passRanges
        //     },
        //     {
        //       numDrawablePrims: 0,
        //       primMeshIndexTable: this.primMeshIndexTables[3],
        //         meshViewAttribs: this._meshViewAttribTable[3],
        //       passRanges: this.primMeshIndexTables[3].passRanges
        // }
      ],
      indices: this._indices,
      edgeIndices: this._edgeIndices,
      meshMatrixTable: this._meshMatrixTable,
      meshAttribTable: this._mashAttribTable,
      geometryAttribTable: this._geometryAttribTable,
      geometryQuantRangeTable: this._geometryQuantRangeTable,
      vertexPositions: this._vertexPositions,
      vertexColors: this._vertexColors
    };

    // this.structSpecs = {
    //   MeshAttribs: this._mashAttribTable.structSpec
    // }

    return {
      ok: true,
      value: undefined
    };
  }

  static get itemSizesInBytes(): { [key: string]: number } {
    return {
      mesh: DTXMeshAttribTable.itemSizeInBytes
        + DTXViewMeshAttribTable.itemSizeInBytes * 4 // 4 views FIXME
        + DTXMatrixTable.itemSizeInBytes,
      geometry: DTXGeometryAttribTable.itemSizeInBytes + DTXGeometryQuantRangeTable.itemSizeInBytes,
      vertex: DTXVertexPositions.itemSizeInBytes + DTXVertexColors.itemSizeInBytes,
      index: DTXPointerArray.itemSizeInBytes,
      prim: DTXPrimMeshIndexTable.itemSizeInBytes
    }
  }

  getAllocatedBytes(): number {
    let total = 0;
    total += this._vertexPositions.getAllocatedBytes();
    total += this._vertexColors.getAllocatedBytes();
    total += this._indices.getAllocatedBytes();
    total += this._edgeIndices.getAllocatedBytes();
    total += this._mashAttribTable.getAllocatedBytes();
    total += this._geometryAttribTable.getAllocatedBytes();
    total += this._geometryQuantRangeTable.getAllocatedBytes();
    total += this._meshMatrixTable.getAllocatedBytes();
    for (let i = 0; i < this.primMeshIndexTables.length; i++) {
      total += this.primMeshIndexTables[i].getAllocatedBytes();
    }
    return total;
  }

  /**
   * Returns the total number of bytes currently used by all managed arrays in this batch.
   */
  getUsedBytes(): number {
    let total = 0;
    total += this._vertexPositions.getUsedBytes();
    total += this._vertexColors.getUsedBytes();
    total += this._indices.getUsedBytes();
    total += this._edgeIndices.getUsedBytes();
    total += this._mashAttribTable.getUsedBytes();
    total += this._geometryAttribTable.getUsedBytes();
    total += this._geometryQuantRangeTable.getUsedBytes();
    total += this._meshMatrixTable.getUsedBytes();
    for (let i = 0; i < this.primMeshIndexTables.length; i++) {
      total += this.primMeshIndexTables[i].getUsedBytes();
    }
    return total;
  }

  /**
   * Check if there is enough memory for a SceneMesh.
   * @param sceneMesh
   */
  hasMemoryForMesh(sceneMesh: SceneMesh): boolean {
    // Mesh capacity
    if (this._numMeshes >= this._renderContext.memoryConfigs.maxBatchMeshes) {
      return false;
    }
    const geometry = sceneMesh.geometry;
    if (!geometry) {
      return false;
    }
    // New geometry handle capacity (only if not already tracked)
    if (!this._geometryHandles[geometry.id] && this._numGeometries >= this._maxGeometries) {
      return false;
    }
    // Vertex count (assumes 3 components per vertex)
    const vertCount = (geometry.positionsCompressed?.length ?? 0) / 3;
    if (vertCount <= 0 || this._vertexPositions.canGetPortion(vertCount) === false) {
      return false;
    }
    const isPoints = geometry.primitive === PointsPrimitive;
    if (isPoints) {
      // For points, prim→mesh lookup is sized by vertex count
      if (this.primMeshIndexTables[0].canGetPortion(vertCount) === false) {
        // Only need to check one view, as they are sized the same
        return false;
      }
    } else {
      // For triangles, prim→mesh lookup is sized by triangle count
      const indexCount = geometry.indices?.length ?? 0;
      const triCount = indexCount / 3;
      if (this.primMeshIndexTables[0].canGetPortion(triCount) === false) {
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
   * Adds a SceneMesh to this GPUMemoryBatch.
   *
   * Returns an index through which you can dynamically update attributes for the mesh.
   *
   * @param sceneMesh
   */
  addMesh(sceneMesh: SceneMesh): SDKResult<number> {

    const existingMeshHandle = this._meshHandles[sceneMesh.id];

    if (existingMeshHandle) {
      return existingMeshHandle.meshIndex;
    }

    if (this._numMeshes >= MAX_MESHES) {
      return {
        ok: false,
        type: SDKErrorType.MemoryAllocationFailed,
        error: `GPUMemoryBatch.addMesh: Exceeded maximum number of meshes (${MAX_MESHES})`
      }
    }

    if (this._numGeometries >= MAX_GEOMETRIES) {
      return {
        ok: false,
        type: SDKErrorType.MemoryAllocationFailed,
        error: `GPUMemoryBatch.addMesh: Exceeded maximum number of geometries (${MAX_GEOMETRIES})`
      }
    }

    let positionsPortion = null;
    let vertexColorsPortion = null;
    let indicesHandle = null;
    let edgeIndicesHandle = null;
    let geometryIndex = -1;
    let meshIndex = -1;

    const cleanup = () => {
      if (positionsPortion) {
        this._vertexPositions.putPortion(positionsPortion);
      }
      if (vertexColorsPortion) {
        this._vertexColors.putPortion(vertexColorsPortion);
      }
      if (indicesHandle) {
        this._indices.putPortion(indicesHandle);
      }
      if (edgeIndicesHandle) {
        this._edgeIndices.putPortion(edgeIndicesHandle);
      }
      if (geometryIndex !== -1) {
        this._putFreeGeometryIndex(geometryIndex);
      }
      if (meshIndex !== -1) {
        this._putFreeMeshIndex(meshIndex);
      }
    }

    meshIndex = this._getFreeMeshIndex();

    const geometry = sceneMesh.geometry;

    let geometryHandle = this._geometryHandles[geometry.id];

    if (!geometryHandle) {

      geometryIndex = this._getFreeGeometryIndex();

      positionsPortion = this._vertexPositions.getPortion(
        geometry.positionsCompressed.length / 3, // 3xcomponents per position
        (newBase: number) => {
          const verticesBase = newBase / 3 // 3xcomponents per position
          this._geometryAttribTable.setItem(geometryIndex, {
            verticesBase
          });
        });

      if (positionsPortion === null) {
        cleanup();
        return {
          ok: false,
          type: SDKErrorType.MemoryAllocationFailed,
          error: `GPUMemoryBatch.addMesh: Unable to allocate positions portion for geometry ${geometry.id}`
        }
      }

      this._vertexPositions.setPortionData(positionsPortion, geometry.positionsCompressed);

      const [xmin, ymin, zmin, xmax, ymax, zmax] = geometry.aabb;

      this._geometryQuantRangeTable.setItem(geometryIndex, {
          offset: [xmin, ymin, zmin],
          scale: [(xmax - xmin) / 65536, (ymax - ymin) / 65536, (zmax - zmin) / 65536]
        });

      if (geometry.colorsCompressed) {
        vertexColorsPortion = this._vertexColors.getPortion(geometry.colorsCompressed.length / 3); // RGB (0..255, 0..255, 0..255)
        if (vertexColorsPortion === null) {
          cleanup();
          return {
            ok: false,
            type: SDKErrorType.MemoryAllocationFailed,
            error: `GPUMemoryBatch.addMesh: Unable to allocate vertex colors portion for geometry ${geometry.id}`
          }
        }
        this._vertexColors.setPortionData(vertexColorsPortion, geometry.colorsCompressed);
      }

      if (geometry.primitive !== PointsPrimitive && geometry.indices) {
        indicesHandle = this._indices.getPortion(
          geometry.indices.length,
          (newBase: number) => {
            this._geometryAttribTable.setItem(geometryIndex, {
              indicesBase: newBase
            });
          }
        );

        if (indicesHandle === null) {
          cleanup();
          return {
            ok: false,
            type: SDKErrorType.MemoryAllocationFailed,
            error: `GPUMemoryBatch.addMesh: Unable to allocate indices portion for geometry ${geometry.id}`
          }
        }

        this._indices.setPortionData(indicesHandle, geometry.indices);

        if (geometry.primitive === TrianglesPrimitive && geometry.edgeIndices) {
          edgeIndicesHandle = this._edgeIndices.getPortion(
            geometry.edgeIndices.length,
            (newBase: number) => {
              this._geometryAttribTable.setItem(geometryIndex, {
                edgeIndicesBase: newBase
              });
            }
          );

          if (edgeIndicesHandle === null) {
            cleanup();
            return {
              ok: false,
              type: SDKErrorType.MemoryAllocationFailed,
              error: `GPUMemoryBatch.addMesh: Unable to allocate edge indices portion for geometry ${geometry.id}`
            }
          }

          this._edgeIndices.setPortionData(edgeIndicesHandle, geometry.edgeIndices);
        }
      }

      this._geometryAttribTable.setItem(geometryIndex, {
        verticesBase: positionsPortion.base, // XYZ
        indicesBase: indicesHandle ? indicesHandle.base : 0,
        edgeIndicesBase: edgeIndicesHandle ? edgeIndicesHandle.base : 0
      });

      geometryHandle = {
        positionsPortion,
        vertexColorsPortion,
        geometryIndex,
        indicesHandle,
        edgeIndicesHandle,
        useCount: 0
      };

      this._geometryHandles[geometry.id] = geometryHandle;

      this._numGeometries++;
    }

    geometryHandle.useCount++;

    this._mashAttribTable.setItem(meshIndex, {
      tileIndex: 0, // Set by setMeshAttribs()
      geometryIndex: geometryHandle.geometryIndex
    });

    this._meshViewAttribTable[0].setItem(meshIndex, { // FIXME: Only defined for View 0
      color: [
        Math.floor(sceneMesh.color[0] * 255.0),
        Math.floor(sceneMesh.color[1] * 255.0),
        Math.floor(sceneMesh.color[2] * 255.0)
      ],
      opacity: Math.floor(sceneMesh.opacity * 255.0)
    });

    this._meshMatrixTable.setItem(meshIndex, sceneMesh.matrix);

    const primitiveCount = geometry.primitive === PointsPrimitive
      ? geometry.positionsCompressed.length / 3
      : geometry.primitive === LinesPrimitive
        ? geometry.indices.length / 2
        : geometry.indices.length / 3;

    const primMeshIndexTableHandles = [ // one per view
      this.primMeshIndexTables[0].createPortion(primitiveCount, meshIndex, RENDER_PASSES.OPAQUE), // FIXME: Only defined for View 0
      // this.primMeshIndexTables[1].createPortion(primitiveCount, meshIndex, 0),
      // this.primMeshIndexTables[2].createPortion(primitiveCount, meshIndex, 0),
      // this.primMeshIndexTables[3].createPortion(primitiveCount, meshIndex, 0)
    ];

    this._meshHandles[sceneMesh.id] = {
      meshIndex,
      primMeshIndexTableHandles
    };

    this._sceneMeshes[meshIndex] = sceneMesh;

    this._numMeshes++;

    return {
      ok: true,
      value: meshIndex
    };
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
    matrix: Mat4): void {
    this._meshMatrixTable.setItem(meshIndex, matrix);
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
    }) {
    this._mashAttribTable.setItem(meshIndex, params);
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
      color?: Vec3;   // uvec3 bytes 0..255
      opacity?: number; // byte 0..255
      pickable?: boolean;
      clippable?: boolean;
    }) {
    if (viewIndex < 0 || viewIndex >= this._meshViewAttribTable.length) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshViewAttribs: Invalid viewIndex ${viewIndex}`);
    }
    this._meshViewAttribTable[viewIndex].setItem(meshIndex, params);
  }

  /**
   * Sets the renderPass for a SceneMesh within a specific View.
   *
   * @param meshIndex
   * @param viewIndex
   * @param renderPass
   */
  setMeshRenderPass(
    meshIndex: number,
    viewIndex: number,
    renderPass: RenderPassValue) {
    const sceneMesh = this._sceneMeshes[meshIndex];
    if (!sceneMesh) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshRenderBin: No SceneMesh at index ${meshIndex}`);
    }
    const meshHandle = this._meshHandles[sceneMesh.id];
    if (!meshHandle) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshRenderBin: Mesh ${meshIndex} has no meshHandle`);
    }
    const primMeshIndexTableHandle = meshHandle.primMeshIndexTableHandles[viewIndex];
    if (!primMeshIndexTableHandle) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshRenderBin: Mesh ${meshIndex} has no primMeshIndexTableHandle`);
    }
    this.primMeshIndexTables[viewIndex].setRenderPass(primMeshIndexTableHandle, renderPass);
  }

  /**
   * Sets whether a SceneMesh is visible in a specific View.
   *
   * @param meshIndex
   * @param viewIndex
   * @param visible
   */
  setMeshVisible(
    meshIndex: number,
    viewIndex: number,
    visible: boolean) {
    const sceneMesh = this._sceneMeshes[meshIndex];
    if (!sceneMesh) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshVisible: No SceneMesh at index ${meshIndex}`);
    }
    const meshHandle = this._meshHandles[sceneMesh.id];
    if (!meshHandle) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshVisible: Mesh ${meshIndex} has no meshHandle`);
    }
    const primMeshIndexTableHandle = meshHandle.primMeshIndexTableHandles[viewIndex];
    if (!primMeshIndexTableHandle) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshVisible: Mesh ${meshIndex} has no primMeshIndexTableHandle`);
    }
    this.primMeshIndexTables[viewIndex].setVisible(primMeshIndexTableHandle, visible);
  }

  /**
   * Removes a SceneMesh from data texture gpuMemoryManager.
   *
   * @param meshIndex
   */
  removeMesh(meshIndex: number): void {
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
        this._vertexPositions.putPortion(geometryHandle.positionsPortion);
      }
      if (geometryHandle.vertexColorsPortion) {
        this._vertexColors.putPortion(geometryHandle.vertexColorsPortion);
      }
      delete this._geometryHandles[geometry.id];
      this._putFreeGeometryIndex(geometryHandle.geometryIndex);
      this._numGeometries--;
    }

    if (meshHandle.primMeshIndexTableHandles) {
      this.primMeshIndexTables[0].deletePortion(meshHandle.primMeshIndexTableHandles[0]); // FIXME: Only defined for View 0
      // this.primMeshIndexTables[1].deletePortion(meshHandle.primMeshIndexTableHandles[1]);
      // this.primMeshIndexTables[2].deletePortion(meshHandle.primMeshIndexTableHandles[2]);
      // this.primMeshIndexTables[3].deletePortion(meshHandle.primMeshIndexTableHandles[3]);
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
  }

  /**
   * Retrieves a SceneMesh by its meshIndex.
   * @param meshIndex
   */
  getMeshAtIndex(meshIndex: number): SceneMesh | null {
    return this._sceneMeshes[meshIndex] ?? null;
  }

  /**
   * Retrieves parameters for a drawArrays() call to render a specific mesh.
   * @param meshIndex
   */
  getDrawArraysParamsForMesh(meshIndex: number): { first: number, count: number } | null {
    const sceneMesh = this._sceneMeshes[meshIndex];
    if (!sceneMesh) {
      return null;
    }
    const geometry = sceneMesh.geometry;
    if (!geometry) {
      return null;
    }
    const meshHandle = this._meshHandles[sceneMesh.id];
    if (!meshHandle) {
      return null;
    }
    const primsBase = meshHandle.primsBase;
    if (geometry.primitive === PointsPrimitive) {
      const count = geometry.positionsCompressed.length / 3; // 3xcomponents per position
      return {
        count,
        first: primsBase
      };
    } else if (geometry.primitive === LinesPrimitive) {
      const count = (geometry.indices?.length ?? 0);
      return {
        count,
        first: primsBase
      };
    } else if (geometry.primitive === TrianglesPrimitive) {
      const count = (geometry.indices?.length ?? 0);
      return {
        count,
        first: primsBase
      };
    }
    return null;
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

  /**
   * Flush any pending updates to the GPU.
   */
  uploadChanges(): boolean {
    let didFlush = false;
    didFlush = this._indices.uploadChanges() || didFlush;
    didFlush = this._mashAttribTable.uploadChanges() || didFlush;
    for (let i = 0, len = this._meshViewAttribTable.length; i < len; i++) {
      didFlush = this._meshViewAttribTable[i].uploadChanges() || didFlush;
    }
    didFlush = this._geometryQuantRangeTable.uploadChanges() || didFlush;
    didFlush = this._geometryAttribTable.uploadChanges() || didFlush;
    didFlush = this._edgeIndices.uploadChanges() || didFlush;
    didFlush = this._vertexPositions.uploadChanges() || didFlush;
    didFlush = this._vertexColors.uploadChanges() || didFlush;
    didFlush = this._meshMatrixTable.uploadChanges() || didFlush;
    for (let i = 0; i < 4; i++) {
      const primMeshIndexTable = this.primMeshIndexTables[i];
      if (primMeshIndexTable) {
        const primMeshIndexTableFlushed = primMeshIndexTable.uploadChanges()
        didFlush = primMeshIndexTableFlushed;
        if (primMeshIndexTableFlushed) {
          this.dataTextures.views[i].numDrawablePrims = primMeshIndexTable.numPrimitives;
        }
      }
    }
    return didFlush;
  }

  webglContextRestored(): SDKResult<void> {
    for (const dataTexture in  [
      ...this.primMeshIndexTables,
      this._mashAttribTable,
      ...this._meshViewAttribTable,
      this._meshMatrixTable,
      this._geometryAttribTable,
      this._geometryQuantRangeTable,
      this._indices,
      this._edgeIndices,
      this._vertexPositions,
      this._vertexColors
    ]) {
      const result = (<any>dataTexture).webglContextRestored();
      if (!result.ok) {
        return result;
      }
    }
    return {ok: true, value: undefined};
  }

  destroy() {
    const clear = (ref: any) => {
      if (ref) {
        ref.destroy();
        return null;
      }
      return ref;
    };
    this._onTick = clear(this._onTick);
    for (let i = 0; i < this.primMeshIndexTables.length; i++) {
      this.primMeshIndexTables[i].destroy();
    }
    this.primMeshIndexTables = [];
    this._mashAttribTable = clear(this._mashAttribTable);
    this._meshViewAttribTable = this._meshViewAttribTable.map(clear);
    this._geometryAttribTable = clear(this._geometryAttribTable);
    this._indices = clear(this._indices);
    this._edgeIndices = clear(this._edgeIndices);
    this._vertexPositions = clear(this._vertexPositions);
    this._vertexColors = clear(this._vertexColors);
    this._meshMatrixTable = clear(this._meshMatrixTable);

  }
}
