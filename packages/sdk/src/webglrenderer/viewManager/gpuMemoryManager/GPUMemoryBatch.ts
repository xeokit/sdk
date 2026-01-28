
import {SceneGeometry, SceneMesh} from "../../../scene";
import {RenderContext} from "../RenderContext";
import {MeshViewAttributeTexture} from "./dataTextures/MeshViewAttributeTexture";
import {MeshAttributeTexture} from "./dataTextures/MeshAttributeTexture";
import {GeometryQuantRangeTexture} from "./dataTextures/GeometryQuantRangeTexture";
import {VertexPositionTexture} from "./dataTextures/VertexPositionTexture";
import {VertexColorTexture} from "./dataTextures/VertexColorTexture";
import {MatrixTexture} from "./dataTextures/MatrixTexture";
import {IndexTexture} from "./dataTextures/IndexTexture";
import {GeometryAttributeTexture} from "./dataTextures/GeometryAttributeTexture";
import {type BatchDataTextures} from "./BatchDataTextures";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../../constants";
import {PrimitiveMeshIndexTexture} from "./dataTextures/PrimitiveMeshIndexTexture";
import {RENDER_PASSES, type RenderPassValue} from "../RENDER_PASSES";
import {SDKErrorType, SDKInternalException, type SDKResult} from "../../../core";
import {type MemoryConfigs} from "../../MemoryConfigs";
import type { Mat4} from "../../../math/matrix";
import type {Vec3, Vec4} from "../../../math/vector";

const MAX_MESHES = 500000;
const MAX_GEOMETRIES = 500000;

/**
 * Manages GPU-resident, dynamically-editable data storage for model geometry and attributes.
 *
 * @internal
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

  private _indexTexture: IndexTexture;
  private _meshAttributeTexture: MeshAttributeTexture;
  private _meshViewAttributeTexture: MeshViewAttributeTexture[];
  private _geometryQuantRangeTexture: GeometryQuantRangeTexture;
  private _geometryAttributeTexture: GeometryAttributeTexture;
  private _edgeIndexTexture: IndexTexture;
  private _primitiveMeshIndexTexture: PrimitiveMeshIndexTexture[];
  private _vertexPositionTexture: VertexPositionTexture;
  private _vertexColorTexture: VertexColorTexture;
  private _meshMatrixTexture: MatrixTexture;

  private _meshIndicesUsed: boolean[];
  private _meshes: {};
  private _sceneMeshes: {};
  private _numMeshes: number;
  private _geometryIndicesUsed: boolean[];
  private _sceneGeometries: {};
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
    this._sceneGeometries = {};

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

    this._primitiveMeshIndexTexture = [
      new PrimitiveMeshIndexTexture({
        gl,
        maxItems: memoryConfigs.maxBatchPrims,
        bins,
        description: `[Batch ${this.index}, View 0] - primIndex -> meshIndex`
      }),
      // new DTXPrimDrawList({gl, maxItems: this._maxPrims, bins}),
      // new DTXPrimDrawList({gl, maxItems: this._maxPrims, bins}),
      // new DTXPrimDrawList({gl, maxItems: this._maxPrims, bins})
    ];

    this._meshAttributeTexture = new MeshAttributeTexture({
      gl,
      maxItems: memoryConfigs.maxBatchMeshes,
      description: `[Batch ${this.index}] - meshIndex -> geometryIndex, tileIndex`,
      getNumItems: () => this._numMeshes
    });

    this._meshViewAttributeTexture = [
      new MeshViewAttributeTexture({
        gl,
        maxItems: memoryConfigs.maxBatchMeshes,
        getNumItems: () => this._numMeshes,
        description: `[Batch ${this.index}, View 0] - meshIndex -> color, opacity, flags`
      }), // FIXME: Only defined for View 0
      // new DTXMeshViewAttribs({gl, maxItems: this._maxMeshes}),
      // new DTXMeshViewAttribs({gl, maxItems: this._maxMeshes}),
      // new DTXMeshViewAttribs({gl, maxItems: this._maxMeshes})

    ];

    this._meshMatrixTexture = new MatrixTexture({
      gl,
      maxItems: memoryConfigs.maxBatchMeshes,
      getNumItems: () => this._numMeshes,
      description: `[Batch ${this.index}] - meshIndex -> modelMatrix`
    });

    this._geometryAttributeTexture = new GeometryAttributeTexture({
      gl,
      maxItems: memoryConfigs.maxBatchGeometries,
      getNumItems: () => this._numGeometries,
      description: `[Batch ${this.index}] - geometryIndex -> verticesBase, indicesBase, edgeIndicesBase`
    });

    this._geometryQuantRangeTexture = new GeometryQuantRangeTexture({
      gl,
      maxItems: memoryConfigs.maxBatchGeometries,
      getNumItems: () => this._numGeometries,
      description: `[Batch ${this.index}] - geometryIndex -> quantization ranges (offset, scale)`
    });

    this._indexTexture = new IndexTexture({
      gl,
      maxItems: memoryConfigs.maxBatchIndices,
      description: `[Batch ${this.index}] - primitive indices`
    });

    this._edgeIndexTexture = new IndexTexture({
      gl,
      maxItems: memoryConfigs.maxBatchIndices,
      description: `[Batch ${this.index}] - edge indices`
    });

    this._vertexPositionTexture = new VertexPositionTexture({
      gl,
      maxItems: memoryConfigs.maxBatchVertices,
      description: `[Batch ${this.index}] - vertex XYZ positions`
    });

    this._vertexColorTexture = new VertexColorTexture({
      gl,
      maxItems: memoryConfigs.maxBatchVertices,
      description: `[Batch ${this.index}] - vertex RGB colors`
    });

    const textures: {
      allocate(): SDKResult<void>;
      destroy(): void;
    }[] = [
      ...this._primitiveMeshIndexTexture,
      this._meshAttributeTexture,
      ...this._meshViewAttributeTexture,
      this._meshMatrixTexture,
      this._geometryAttributeTexture,
      this._geometryQuantRangeTexture,
      this._indexTexture,
      this._edgeIndexTexture,
      this._vertexPositionTexture,
      this._vertexColorTexture
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
          primitiveMeshIndexTexture: this._primitiveMeshIndexTexture[0],
          meshViewAttributeTexture: this._meshViewAttributeTexture[0],
          renderPassPrimitiveRanges: this._primitiveMeshIndexTexture[0].passRanges //  FIXME:
        },
        //     {
        //       numDrawablePrims: 0,
        //       primitiveMeshIndexTexture: this._primitiveMeshIndexTexture[1],
        //         meshViewAttribs: this._meshViewAttributeTexture[1],
        //       passRanges: this._primitiveMeshIndexTexture[1].passRanges
        //     },
        //     {
        //       numDrawablePrims: 0,
        //       primitiveMeshIndexTexture: this._primitiveMeshIndexTexture[2],
        //         meshViewAttribs: this._meshViewAttributeTexture[2],
        //       passRanges: this._primitiveMeshIndexTexture[2].passRanges
        //     },
        //     {
        //       numDrawablePrims: 0,
        //       primitiveMeshIndexTexture: this._primitiveMeshIndexTexture[3],
        //         meshViewAttribs: this._meshViewAttributeTexture[3],
        //       passRanges: this._primitiveMeshIndexTexture[3].passRanges
        // }
      ],
      indexTexture: this._indexTexture,
      edgeIndexTexture: this._edgeIndexTexture,
      meshMatrixTexture: this._meshMatrixTexture,
      meshAttributeTexture: this._meshAttributeTexture,
      geometryAttributeTexture: this._geometryAttributeTexture,
      geometryQuantRangeTexture: this._geometryQuantRangeTexture,
      vertexPositionTexture: this._vertexPositionTexture,
      vertexColorTexture: this._vertexColorTexture
    };

    // this.structSpecs = {
    //   MeshAttribs: this._meshAttributeTexture.structSpec
    // }

    return {
      ok: true,
      value: undefined
    };
  }

  static get itemSizesInBytes(): { [key: string]: number } {
    return {
      mesh: MeshAttributeTexture.itemSizeInBytes
        + MeshViewAttributeTexture.itemSizeInBytes * 4 // 4 views FIXME
        + MatrixTexture.itemSizeInBytes,
      geometry: GeometryAttributeTexture.itemSizeInBytes + GeometryQuantRangeTexture.itemSizeInBytes,
      vertex: VertexPositionTexture.itemSizeInBytes + VertexColorTexture.itemSizeInBytes,
      index: IndexTexture.itemSizeInBytes,
      prim: PrimitiveMeshIndexTexture.itemSizeInBytes
    }
  }

  getAllocatedBytes(): number {
    let total = 0;
    total += this._vertexPositionTexture.getAllocatedBytes();
    total += this._vertexColorTexture.getAllocatedBytes();
    total += this._indexTexture.getAllocatedBytes();
    total += this._edgeIndexTexture.getAllocatedBytes();
    total += this._meshAttributeTexture.getAllocatedBytes();
    total += this._geometryAttributeTexture.getAllocatedBytes();
    total += this._geometryQuantRangeTexture.getAllocatedBytes();
    total += this._meshMatrixTexture.getAllocatedBytes();
    for (let i = 0; i < this._primitiveMeshIndexTexture.length; i++) {
      total += this._primitiveMeshIndexTexture[i].getAllocatedBytes();
    }
    return total;
  }

  /**
   * Returns the total number of bytes currently used by all managed arrays in this batch.
   */
  getUsedBytes(): number {
    let total = 0;
    total += this._vertexPositionTexture.getUsedBytes();
    total += this._vertexColorTexture.getUsedBytes();
    total += this._indexTexture.getUsedBytes();
    total += this._edgeIndexTexture.getUsedBytes();
    total += this._meshAttributeTexture.getUsedBytes();
    total += this._geometryAttributeTexture.getUsedBytes();
    total += this._geometryQuantRangeTexture.getUsedBytes();
    total += this._meshMatrixTexture.getUsedBytes();
    for (let i = 0; i < this._primitiveMeshIndexTexture.length; i++) {
      total += this._primitiveMeshIndexTexture[i].getUsedBytes();
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
    const vertCount = (geometry.positionsCompressed?.length ?? 0) / 3;
    const geometryExists = !!this._geometryHandles[geometry.id];
    if (!geometryExists) {
    if (this._numGeometries >= this._maxGeometries) {
      return false;
    }
    // Vertex count (assumes 3 components per vertex)
      if (vertCount <= 0 || this._vertexPositionTexture.canGetPortion(vertCount) === false) {
        return false;
      }
    }
    const isPoints = geometry.primitive === PointsPrimitive;
    if (isPoints) {
      // For points, prim→mesh lookup is sized by vertex count
      if (this._primitiveMeshIndexTexture[0].canGetPortion(vertCount) === false) {
        // Only need to check one view, as they are sized the same
        return false;
      }
    } else {
      // For triangles, prim→mesh lookup is sized by triangle count
      const indexCount = geometry.indices?.length ?? 0;
      const triCount = indexCount / 3;
      if (this._primitiveMeshIndexTexture[0].canGetPortion(triCount) === false) {
        return false;
      }
      if (!geometryExists) {
        if (geometry.indices && this._indexTexture.canGetPortion(indexCount) === false) {
          return false;
        }
        if (geometry.edgeIndices && this._edgeIndexTexture.canGetPortion(geometry.edgeIndices.length) === false) {
          return false;
        }
      }
    }
    if (!geometryExists) {
      if (geometry.colorsCompressed && this._vertexColorTexture.canGetPortion(geometry.colorsCompressed.length) === false) {
        return false;
      }
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
        this._vertexPositionTexture.putPortion(positionsPortion);
      }
      if (vertexColorsPortion) {
        this._vertexColorTexture.putPortion(vertexColorsPortion);
      }
      if (indicesHandle) {
        this._indexTexture.putPortion(indicesHandle);
      }
      if (edgeIndicesHandle) {
        this._edgeIndexTexture.putPortion(edgeIndicesHandle);
      }
      if (geometryIndex !== -1) {
        this._putFreeGeometryIndex(geometryIndex);
      }
      if (meshIndex !== -1) {
        this._putFreeMeshIndex(meshIndex);
      }
    };

    meshIndex = this._getFreeMeshIndex();

    const sceneGeometry = sceneMesh.geometry;

    let geometryHandle = this._geometryHandles[sceneGeometry.id];

    if (!geometryHandle) {

      geometryIndex = this._getFreeGeometryIndex();

      positionsPortion = this._vertexPositionTexture.getPortion(
        sceneGeometry.positionsCompressed, // 3xcomponents per position
        (newBase: number) => {
          const verticesBase = newBase / 3 // 3xcomponents per position
          this._geometryAttributeTexture.setItem(geometryIndex, {
            verticesBase
          });
        });

      if (positionsPortion === null) {
        cleanup();
        return {
          ok: false,
          type: SDKErrorType.MemoryAllocationFailed,
          error: `GPUMemoryBatch.addMesh: Unable to allocate positions portion for geometry ${sceneGeometry.id}`
        }
      }

      const [xmin, ymin, zmin, xmax, ymax, zmax] = sceneGeometry.aabb;

      this._geometryQuantRangeTexture.setItem(geometryIndex, {
          offset: [xmin, ymin, zmin],
          scale: [(xmax - xmin) / 65536, (ymax - ymin) / 65536, (zmax - zmin) / 65536]
        });

      if (sceneGeometry.colorsCompressed) {
        vertexColorsPortion = this._vertexColorTexture.getPortion(sceneGeometry.colorsCompressed); // RGB (0..255, 0..255, 0..255)
        if (vertexColorsPortion === null) {
          cleanup();
          return {
            ok: false,
            type: SDKErrorType.MemoryAllocationFailed,
            error: `GPUMemoryBatch.addMesh: Unable to allocate vertex colors portion for geometry ${sceneGeometry.id}`
          }
        }
      }

      if (sceneGeometry.primitive !== PointsPrimitive && sceneGeometry.indices) {
        indicesHandle = this._indexTexture.getPortion(
          sceneGeometry.indices,
          (newBase: number) => {
            this._geometryAttributeTexture.setItem(geometryIndex, {
              indicesBase: newBase
            });
          }
        );

        if (indicesHandle === null) {
          cleanup();
          return {
            ok: false,
            type: SDKErrorType.MemoryAllocationFailed,
            error: `GPUMemoryBatch.addMesh: Unable to allocate indices portion for geometry ${sceneGeometry.id}`
          }
        }

        if (sceneGeometry.primitive === TrianglesPrimitive && sceneGeometry.edgeIndices) {
          edgeIndicesHandle = this._edgeIndexTexture.getPortion(
            sceneGeometry.edgeIndices,
            (newBase: number) => {
              this._geometryAttributeTexture.setItem(geometryIndex, {
                edgeIndicesBase: newBase
              });
            }
          );

          if (edgeIndicesHandle === null) {
            cleanup();
            return {
              ok: false,
              type: SDKErrorType.MemoryAllocationFailed,
              error: `GPUMemoryBatch.addMesh: Unable to allocate edge indices portion for geometry ${sceneGeometry.id}`
            }
          }
        }
      }

      this._geometryAttributeTexture.setItem(geometryIndex, {
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

      this._geometryHandles[sceneGeometry.id] = geometryHandle;

      this._numGeometries++;
    }

    geometryHandle.useCount++;

    this._meshAttributeTexture.setItem(meshIndex, {
      tileIndex: 0, // Set by setMeshAttribs()
      geometryIndex: geometryHandle.geometryIndex
    });

    this._meshViewAttributeTexture[0].setItem(meshIndex, { // FIXME: Only defined for View 0
      color: [
        Math.floor(sceneMesh.color[0] * 255.0),
        Math.floor(sceneMesh.color[1] * 255.0),
        Math.floor(sceneMesh.color[2] * 255.0)
      ],
      opacity: Math.floor(sceneMesh.opacity * 255.0),
      pickable: true,
      clippable: true
    });

    this._meshMatrixTexture.setItem(meshIndex, sceneMesh.matrix);

    const primitiveCount = sceneGeometry.primitive === PointsPrimitive
      ? sceneGeometry.positionsCompressed.length / 3
      : sceneGeometry.primitive === LinesPrimitive
        ? sceneGeometry.indices.length / 2
        : sceneGeometry.indices.length / 3;

    const primitiveMeshIndexTextureHandles = [ // one per view
      this._primitiveMeshIndexTexture[0].createPortion(primitiveCount, meshIndex, RENDER_PASSES.OPAQUE), // FIXME: Only defined for View 0
      // this._primitiveMeshIndexTexture[1].createPortion(primitiveCount, meshIndex, 0),
      // this._primitiveMeshIndexTexture[2].createPortion(primitiveCount, meshIndex, 0),
      // this._primitiveMeshIndexTexture[3].createPortion(primitiveCount, meshIndex, 0)
    ];

    this._meshHandles[sceneMesh.id] = {
      meshIndex,
      primitiveMeshIndexTextureHandles
    };

    this._sceneGeometries[geometryHandle.geometryIndex] = sceneGeometry;
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
    this._meshMatrixTexture.setItem(meshIndex, matrix);
  }

  /**
   * Sets attributes for e mesh to apply across all Views.
   *
   * Sets RenderContext.viewFlags[...].needsRender to true.
   *
   * @param meshIndex
   * @param params
   * @param params.tileIndex Optional tileIndex of the GPUTile containing the mesh. This can be dynamically updated, as mesh can move between tiles.
   */
  setMeshAttribs(
    meshIndex: number,
    params: {
      tileIndex?: number;
    }) {
    this._meshAttributeTexture.setItem(meshIndex, params);
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
    if (viewIndex < 0 || viewIndex >= this._meshViewAttributeTexture.length) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshViewAttribs: Invalid viewIndex ${viewIndex}`);
    }
    this._meshViewAttributeTexture[viewIndex].setItem(meshIndex, params);
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
    const primitiveMeshIndexTextureHandle = meshHandle.primitiveMeshIndexTextureHandles[viewIndex];
    if (!primitiveMeshIndexTextureHandle) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshRenderBin: Mesh ${meshIndex} has no primitiveMeshIndexTextureHandle`);
    }
    this._primitiveMeshIndexTexture[viewIndex].setRenderPass(primitiveMeshIndexTextureHandle, renderPass);
  }

  /**
   * TODO
   *
   * @param meshIndex
   * @param viewIndex
   * @param visible
   */
  setMeshObjectVisible(
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
    const primitiveMeshIndexTextureHandle = meshHandle.primitiveMeshIndexTextureHandles[viewIndex];
    if (!primitiveMeshIndexTextureHandle) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshVisible: Mesh ${meshIndex} has no primitiveMeshIndexTextureHandle`);
    }
    this._primitiveMeshIndexTexture[viewIndex].setObjectVisible(primitiveMeshIndexTextureHandle, visible);
  }

  /**
   * TODO
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
    const primitiveMeshIndexTextureHandle = meshHandle.primitiveMeshIndexTextureHandles[viewIndex];
    if (!primitiveMeshIndexTextureHandle) {
      throw new SDKInternalException(`GPUMemoryBatch.setMeshVisible: Mesh ${meshIndex} has no primitiveMeshIndexTextureHandle`);
    }
    this._primitiveMeshIndexTexture[viewIndex].setMeshVisible(primitiveMeshIndexTextureHandle, visible);
  }

  // setGeometryPositions(geometryIndex: number, positionsCompressed: FloatArrayParam): SDKResult<void> {
  //   const geometryHandle = this._geometryHandles[geometryIndex];
  //   if (!geometryHandle) {
  //     return {
  //       ok: false,
  //       type: SDKErrorType.ResourceNotFound,
  //       error: `GPUMemoryBatch.setGeometryPositions: No geometryHandle for geometryIndex ${geometryIndex}`
  //     }
  //   }
  //   const newPositionsPortion = this._vertexPositionTexture.getPortion(
  //     positionsCompressed,
  //     (newBase: number) => {
  //       const verticesBase = newBase / 3 // 3xcomponents per position
  //       this._geometryAttributeTexture.setItem(geometryIndex, {
  //         verticesBase
  //       });
  //     });
  //
  //   if (newPositionsPortion === null) {
  //     return {
  //       ok: false,
  //       type: SDKErrorType.MemoryAllocationFailed,
  //       error: `GPUMemoryBatch.setGeometryPositions: Unable to allocate new positions portion for geometryIndex ${geometryIndex}`
  //     }
  //   }
  //
  //   // Free old portion
  //   if (geometryHandle.positionsPortion) {
  //     this._vertexPositionTexture.putPortion(geometryHandle.positionsPortion);
  //   }
  //
  //   // Update handle
  //   geometryHandle.positionsPortion = newPositionsPortion;
  //
  //   return {
  //     ok: true,
  //     value: undefined
  //   };
  // }

  /**
   * Removes a SceneMesh from data texture manager.
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
    const sceneGeometry = sceneMesh.geometry;
    const geometryHandle = this._geometryHandles[sceneGeometry.id];
    if (geometryHandle && --geometryHandle.useCount <= 0) {
      if (geometryHandle.positionsPortion) {
        this._vertexPositionTexture.putPortion(geometryHandle.positionsPortion);
      }
      if (geometryHandle.vertexColorsPortion) {
        this._vertexColorTexture.putPortion(geometryHandle.vertexColorsPortion);
      }
      delete this._geometryHandles[sceneGeometry.id];
      this._putFreeGeometryIndex(geometryHandle.geometryIndex);
      this._numGeometries--;
    }

    if (meshHandle.primitiveMeshIndexTextureHandles) {
      this._primitiveMeshIndexTexture[0].deletePortion(meshHandle.primitiveMeshIndexTextureHandles[0]); // FIXME: Only defined for View 0
      // this._primitiveMeshIndexTexture[1].deletePortion(meshHandle.primitiveMeshIndexTextureHandles[1]);
      // this._primitiveMeshIndexTexture[2].deletePortion(meshHandle.primitiveMeshIndexTextureHandles[2]);
      // this._primitiveMeshIndexTexture[3].deletePortion(meshHandle.primitiveMeshIndexTextureHandles[3]);
    }
    if (meshHandle.indicesHandle) {
      this._indexTexture.putPortion(meshHandle.indicesHandle);
    }
    if (meshHandle.edgeIndicesHandle) {
      this._edgeIndexTexture.putPortion(meshHandle.edgeIndicesHandle);
    }

    delete this._meshHandles[sceneMesh.id];

    this._putFreeMeshIndex(meshIndex);

    delete this._sceneGeometries[meshIndex];
    delete this._sceneMeshes[meshIndex];

    this._numMeshes--;
  }

  /**
   * Retrieves a SceneGeometry by its geometryIndex.
   * @param geometryIndex
   */
  getGeometryAtIndex(geometryIndex: number): SceneGeometry | null {
    return this._sceneGeometries[geometryIndex] ?? null;
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
    const sceneGeometry = sceneMesh.geometry;
    if (!sceneGeometry) {
      return null;
    }
    const meshHandle = this._meshHandles[sceneMesh.id];
    if (!meshHandle) {
      return null;
    }
    const primsBase = meshHandle.primsBase;
    if (sceneGeometry.primitive === PointsPrimitive) {
      const count = sceneGeometry.positionsCompressed.length / 3; // 3xcomponents per position
      return {
        count,
        first: primsBase
      };
    } else if (sceneGeometry.primitive === LinesPrimitive) {
      const count = (sceneGeometry.indices?.length ?? 0);
      return {
        count,
        first: primsBase
      };
    } else if (sceneGeometry.primitive === TrianglesPrimitive) {
      const count = (sceneGeometry.indices?.length ?? 0);
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
    didFlush = this._indexTexture.uploadChanges() || didFlush;
    didFlush = this._meshAttributeTexture.uploadChanges() || didFlush;
    for (let i = 0, len = this._meshViewAttributeTexture.length; i < len; i++) {
      didFlush = this._meshViewAttributeTexture[i].uploadChanges() || didFlush;
    }
    didFlush = this._geometryQuantRangeTexture.uploadChanges() || didFlush;
    didFlush = this._geometryAttributeTexture.uploadChanges() || didFlush;
    didFlush = this._edgeIndexTexture.uploadChanges() || didFlush;
    didFlush = this._vertexPositionTexture.uploadChanges() || didFlush;
    didFlush = this._vertexColorTexture.uploadChanges() || didFlush;
    didFlush = this._meshMatrixTexture.uploadChanges() || didFlush;
    for (let i = 0; i < 4; i++) {
      const primitiveMeshIndexTexture = this._primitiveMeshIndexTexture[i];
      if (primitiveMeshIndexTexture) {
        const primitiveMeshIndexTextureFlushed = primitiveMeshIndexTexture.uploadChanges()
        didFlush = primitiveMeshIndexTextureFlushed;
        if (primitiveMeshIndexTextureFlushed) {
          this.dataTextures.views[i].numDrawablePrims = primitiveMeshIndexTexture.numPrimitives;
        }
      }
    }
    return didFlush;
  }

  webglContextRestored(): SDKResult<void> {
    for (const dataTexture in  [
      ...this._primitiveMeshIndexTexture,
      this._meshAttributeTexture,
      ...this._meshViewAttributeTexture,
      this._meshMatrixTexture,
      this._geometryAttributeTexture,
      this._geometryQuantRangeTexture,
      this._indexTexture,
      this._edgeIndexTexture,
      this._vertexPositionTexture,
      this._vertexColorTexture
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
    for (let i = 0; i < this._primitiveMeshIndexTexture.length; i++) {
      this._primitiveMeshIndexTexture[i].destroy();
    }
    this._primitiveMeshIndexTexture = [];
    this._meshAttributeTexture = clear(this._meshAttributeTexture);
    this._meshViewAttributeTexture = this._meshViewAttributeTexture.map(clear);
    this._geometryAttributeTexture = clear(this._geometryAttributeTexture);
    this._indexTexture = clear(this._indexTexture);
    this._edgeIndexTexture = clear(this._edgeIndexTexture);
    this._vertexPositionTexture = clear(this._vertexPositionTexture);
    this._vertexColorTexture = clear(this._vertexColorTexture);
    this._meshMatrixTexture = clear(this._meshMatrixTexture);

  }
}
