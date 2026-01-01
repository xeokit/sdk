
import {SceneMesh} from "../../../scene";
import {RenderContext} from "../RenderContext";
import {DTXMeshViewAttribs} from "./dtx/DTXMeshViewAttribs";
import {DTXMeshAttribs} from "./dtx/DTXMeshAttribs";
import {DTXQuantRanges} from "./dtx/DTXQuantRanges";
import {DTXPositionsArray} from "./dtx/DTXPositionsArray";
import {DTXVertexColorsArray} from "./dtx/DTXVertexColorsArray";
import {DTXMatrixArray} from "./dtx/DTXMatrixArray";
import {DTXPointerArray} from "./dtx/DTXPointerArray";
import {DTXGeometryAttribs} from "./dtx/DTXGeometryAttribs";
import {type DataTexturesBatch} from "./DataTexturesBatch";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../../constants";
import {DTXPrimDrawList} from "./dtx/DTXPrimDrawList";
import {RENDER_PASSES, type RenderPassValue} from "../RENDER_PASSES";
import {SDKErrorType, SDKInternalException, type SDKResult} from "../../../core";
import {type GPUMemoryConfigs} from "../../GPUMemoryConfigs";
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
  public dataTextures: DataTexturesBatch;

  /**
   * Index of this GPUMemoryBatch within the GPUMemoryManager.sortedBatches array.
   */
  public index: number;

  private _indices: DTXPointerArray;
  private _meshAttribs: DTXMeshAttribs;
  private _meshViewAttribs: DTXMeshViewAttribs[];
  private _geometryQuantRanges: DTXQuantRanges;
  private _geometryAttribs: DTXGeometryAttribs;
  private _edgeIndices: DTXPointerArray;
  private primDrawLists: DTXPrimDrawList[];
  private _positions: DTXPositionsArray;
  private _vertexColors: DTXVertexColorsArray;
  private _meshMatrices: DTXMatrixArray;

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
  allocate(): boolean {
    const gl = this._renderContext.gl;
    const memConfigs: GPUMemoryConfigs = this._renderContext.memConfigs;

    const bins = [
      RENDER_PASSES.OPAQUE,
      RENDER_PASSES.TRANSPARENT,
      RENDER_PASSES.HIGHLIGHTED,
      RENDER_PASSES.SELECTED,
      RENDER_PASSES.XRAYED
    ];

    this.primDrawLists = [
      new DTXPrimDrawList({
        gl,
        maxItems: memConfigs.maxPrimsPerBatch,
        bins,
        description: `[Batch ${this.index}, View 0] - primIndex -> meshIndex`
      }),
      // new DTXPrimDrawList({gl, maxItems: this._maxPrims, bins}),
      // new DTXPrimDrawList({gl, maxItems: this._maxPrims, bins}),
      // new DTXPrimDrawList({gl, maxItems: this._maxPrims, bins})
    ];

    this._meshAttribs = new DTXMeshAttribs({
      gl,
      maxItems: memConfigs.maxMeshesPerBatch,
      description: `[Batch ${this.index}] - meshIndex -> geometryIndex, tileIndex`
    });

    this._meshViewAttribs = [
      new DTXMeshViewAttribs({
        gl,
        maxItems: memConfigs.maxMeshesPerBatch,
        description: `[Batch ${this.index}, View 0] - meshIndex -> color, opacity, flags`
      }), // FIXME: Only defined for View 0
      // new DTXMeshViewAttribs({gl, maxItems: this._maxMeshes}),
      // new DTXMeshViewAttribs({gl, maxItems: this._maxMeshes}),
      // new DTXMeshViewAttribs({gl, maxItems: this._maxMeshes})
    ];

    this._meshMatrices = new DTXMatrixArray({
      gl,
      maxItems: memConfigs.maxMeshesPerBatch,
      description: `[Batch ${this.index}] - meshIndex -> modelMatrix`
    });

    this._geometryAttribs = new DTXGeometryAttribs({
      gl,
      maxItems: memConfigs.maxGeometriesPerBatch,
      description: `[Batch ${this.index}] - geometryIndex -> verticesBase, indicesBase, edgeIndicesBase`
    });

    this._geometryQuantRanges = new DTXQuantRanges({
      gl,
      maxItems: memConfigs.maxGeometriesPerBatch,
      description: `[Batch ${this.index}] - geometryIndex -> quantization ranges (offset, scale)`
    });

    this._indices = new DTXPointerArray({
      gl,
      maxItems: memConfigs.maxIndicesPerBatch,
      description: `[Batch ${this.index}] - primitive indices`
    });

    this._edgeIndices = new DTXPointerArray({
      gl,
      maxItems: memConfigs.maxIndicesPerBatch,
      description: `[Batch ${this.index}] - edge indices`
    });

    this._positions = new DTXPositionsArray({
      gl,
      maxItems: memConfigs.maxVerticesPerBatch,
      description: `[Batch ${this.index}] - vertex XYZ positions`
    });

    this._vertexColors = new DTXVertexColorsArray({
      gl,
      maxItems: memConfigs.maxVerticesPerBatch,
      description: `[Batch ${this.index}] - vertex RGB colors`
    });

    const textures: {
      allocate(): Boolean;
      destroy(): void;
    }[] = [
      ...this.primDrawLists,
      this._meshAttribs,
      ...this._meshViewAttribs,
      this._meshMatrices,
      this._geometryAttribs,
      this._geometryQuantRanges,
      this._indices,
      this._edgeIndices,
      this._positions,
      this._vertexColors
    ];

    for (let i = 0, leni = textures.length; i < leni; i++) {
      if (!textures[i].allocate()) {
        for (let j = i - 1; j >= 0; j--) {
          textures[j].destroy();
        }
        return false;
      }
    }

    this.dataTextures = {
      views: [
        {
          numDrawablePrims: 0,
          primToMeshLookup: this.primDrawLists[0],
          meshViewAttribs: this._meshViewAttribs[0],
          renderPassDrawRanges: this.primDrawLists[0].passRanges //  FIXME:
        },
        //     {
        //       numDrawablePrims: 0,
        //       primToMeshLookup: this.primDrawLists[1],
        //         meshViewAttribs: this._meshViewAttribs[1],
        //       passRanges: this.primDrawLists[1].passRanges
        //     },
        //     {
        //       numDrawablePrims: 0,
        //       primToMeshLookup: this.primDrawLists[2],
        //         meshViewAttribs: this._meshViewAttribs[2],
        //       passRanges: this.primDrawLists[2].passRanges
        //     },
        //     {
        //       numDrawablePrims: 0,
        //       primToMeshLookup: this.primDrawLists[3],
        //         meshViewAttribs: this._meshViewAttribs[3],
        //       passRanges: this.primDrawLists[3].passRanges
        // }
      ],
      indices: this._indices,
      edgeIndices: this._edgeIndices,
      meshMatrices: this._meshMatrices,
      meshAttribs: this._meshAttribs,
      geometryAttribs: this._geometryAttribs,
      geometryQuantRanges: this._geometryQuantRanges,
      positions: this._positions,
      vertexColors: this._vertexColors
    };

    // this.structSpecs = {
    //   MeshAttribs: this._meshAttribs.structSpec
    // }

    return true;
  }

  static get itemSizesInBytes(): { [key: string]: number } {
    return {
      mesh: DTXMeshAttribs.itemSizeInBytes
        + DTXMeshViewAttribs.itemSizeInBytes * 4 // 4 views FIXME
        + DTXMatrixArray.itemSizeInBytes,
      geometry: DTXGeometryAttribs.itemSizeInBytes + DTXQuantRanges.itemSizeInBytes,
      vertex: DTXPositionsArray.itemSizeInBytes + DTXVertexColorsArray.itemSizeInBytes,
      index: DTXPointerArray.itemSizeInBytes,
      prim: DTXPrimDrawList.itemSizeInBytes
    }
  }

  getAllocatedBytes(): number {
    let total = 0;
    total += this._positions.getAllocatedBytes();
    total += this._vertexColors.getAllocatedBytes();
    total += this._indices.getAllocatedBytes();
    total += this._edgeIndices.getAllocatedBytes();
    total += this._meshAttribs.getAllocatedBytes();
    total += this._geometryAttribs.getAllocatedBytes();
    total += this._geometryQuantRanges.getAllocatedBytes();
    total += this._meshMatrices.getAllocatedBytes();
    for (let i = 0; i < this.primDrawLists.length; i++) {
      total += this.primDrawLists[i].getAllocatedBytes();
    }
    return total;
  }

  /**
   * Returns the total number of bytes currently used by all managed arrays in this batch.
   */
  getUsedBytes(): number {
    let total = 0;
    total += this._positions.getUsedBytes();
    total += this._vertexColors.getUsedBytes();
    total += this._indices.getUsedBytes();
    total += this._edgeIndices.getUsedBytes();
    total += this._numMeshes * DTXMeshAttribs.itemSizeInBytes;
    total += this._numGeometries * DTXGeometryAttribs.itemSizeInBytes;
    total += this._numGeometries * DTXQuantRanges.itemSizeInBytes;
    total += this._numMeshes * DTXMatrixArray.itemSizeInBytes;
    for (let i = 0; i < this.primDrawLists.length; i++) {
      total += this.primDrawLists[i].getUsedBytes();
    }
    return total;
  }

  /**
   * Check if there is enough memory for a SceneMesh.
   * @param sceneMesh
   */
  hasMemoryForMesh(sceneMesh: SceneMesh): boolean {
    // Mesh capacity
    if (this._numMeshes >= this._renderContext.memConfigs.maxMeshesPerBatch) {
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
      if (this.primDrawLists[0].canGetPortion(vertCount) === false) {
        return false;
      }
    } else {
      // For triangles, prim→mesh lookup is sized by triangle count
      const indexCount = geometry.indices?.length ?? 0;
      const triCount = indexCount / 3;
      if (this.primDrawLists[0].canGetPortion(triCount) === false) {
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
        this._positions.putPortion(positionsPortion);
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

      positionsPortion = this._positions.getPortion(
        geometry.positionsCompressed.length / 3, // 3xcomponents per position
        (newBase: number) => {
          const verticesBase = newBase / 3 // 3xcomponents per position
          this._geometryAttribs.setAttribs(geometryIndex, {
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

      this._positions.setPortionData(positionsPortion, geometry.positionsCompressed);

      const [xmin, ymin, zmin, xmax, ymax, zmax] = geometry.aabb;

      this._geometryQuantRanges.setQuantRange(
        geometryIndex,
        [xmin, ymin, zmin],
        [(xmax - xmin) / 65536, (ymax - ymin) / 65536, (zmax - zmin) / 65536]);

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
            this._geometryAttribs.setAttribs(geometryIndex, {
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
              this._geometryAttribs.setAttribs(geometryIndex, {
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

      this._geometryAttribs.setAttribs(geometryIndex, {
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

    this._meshAttribs.setAttribs(meshIndex, {
      tileIndex: 0, // Set by setMeshAttribs()
      geometryIndex: geometryHandle.geometryIndex
    });

    this._meshViewAttribs[0].setAttribs(meshIndex, { // FIXME: Only defined for View 0
      color: [
        Math.floor(sceneMesh.color[0] * 255.0),
        Math.floor(sceneMesh.color[1] * 255.0),
        Math.floor(sceneMesh.color[2] * 255.0)
      ],
      opacity: Math.floor(sceneMesh.opacity * 255.0)
    });

    this._meshMatrices.setMatrix(meshIndex, sceneMesh.matrix);

    const primitiveCount = geometry.primitive === PointsPrimitive
      ? geometry.positionsCompressed.length / 3
      : geometry.primitive === LinesPrimitive
        ? geometry.indices.length / 2
        : geometry.indices.length / 3;

    const primToMeshLookupHandles = [ // one per view
      this.primDrawLists[0].createPortion(primitiveCount, meshIndex, RENDER_PASSES.OPAQUE), // FIXME: Only defined for View 0
      // this.primDrawLists[1].createPortion(primitiveCount, meshIndex, 0),
      // this.primDrawLists[2].createPortion(primitiveCount, meshIndex, 0),
      // this.primDrawLists[3].createPortion(primitiveCount, meshIndex, 0)
    ];

    this._meshHandles[sceneMesh.id] = {
      meshIndex,
      primToMeshLookupHandles
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
    this._meshMatrices.setMatrix(meshIndex, matrix);
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
    this._meshAttribs.setAttribs(meshIndex, params);
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
    if (viewIndex < 0 || viewIndex >= this._meshViewAttribs.length) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshViewAttribs: Invalid viewIndex ${viewIndex}`);
    }
    this._meshViewAttribs[viewIndex].setAttribs(meshIndex, params);
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
    const primToMeshLookupHandle = meshHandle.primToMeshLookupHandles[viewIndex];
    if (!primToMeshLookupHandle) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshRenderBin: Mesh ${meshIndex} has no primToMeshLookupHandle`);
    }
    this.primDrawLists[viewIndex].setRenderPass(primToMeshLookupHandle, renderPass);
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
    const primToMeshLookupHandle = meshHandle.primToMeshLookupHandles[viewIndex];
    if (!primToMeshLookupHandle) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshVisible: Mesh ${meshIndex} has no primToMeshLookupHandle`);
    }
    this.primDrawLists[viewIndex].setVisible(primToMeshLookupHandle, visible);
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
        this._positions.putPortion(geometryHandle.positionsPortion);
      }
      if (geometryHandle.vertexColorsPortion) {
        this._vertexColors.putPortion(geometryHandle.vertexColorsPortion);
      }
      delete this._geometryHandles[geometry.id];
      this._putFreeGeometryIndex(geometryHandle.geometryIndex);
      this._numGeometries--;
    }

    if (meshHandle.primToMeshLookupHandles) {
      this.primDrawLists[0].deletePortion(meshHandle.primToMeshLookupHandles[0]); // FIXME: Only defined for View 0
      // this.primDrawLists[1].deletePortion(meshHandle.primToMeshLookupHandles[1]);
      // this.primDrawLists[2].deletePortion(meshHandle.primToMeshLookupHandles[2]);
      // this.primDrawLists[3].deletePortion(meshHandle.primToMeshLookupHandles[3]);
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

    // Check uploadChanges calls and update the flag if any returns true
    didFlush = this._indices.uploadChanges() || didFlush;
    didFlush = this._meshAttribs.uploadChanges() || didFlush;
    for (let i = 0, len = this._meshViewAttribs.length; i < len; i++) {
      didFlush = this._meshViewAttribs[i].uploadChanges() || didFlush;
    }
    didFlush = this._geometryQuantRanges.uploadChanges() || didFlush;
    didFlush = this._geometryAttribs.uploadChanges() || didFlush;
    didFlush = this._edgeIndices.uploadChanges() || didFlush;
    didFlush = this._positions.uploadChanges() || didFlush;
    didFlush = this._vertexColors.uploadChanges() || didFlush;
    didFlush = this._meshMatrices.uploadChanges() || didFlush;
    for (let i = 0; i < 4; i++) {
      const primToMeshLookup = this.primDrawLists[i];
      if (primToMeshLookup) {
        const primToMeshLookupFlushed = primToMeshLookup.uploadChanges()
        didFlush = primToMeshLookupFlushed;
        if (primToMeshLookupFlushed) {
          this.dataTextures.views[i].numDrawablePrims = primToMeshLookup.numPrimitives;
        }
      }
    }

    // Return whether any uploadChanges call returned true
    return didFlush;
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
    for (let i = 0; i < this.primDrawLists.length; i++) {
      this.primDrawLists[i].destroy();
    }
    this.primDrawLists = [];
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
