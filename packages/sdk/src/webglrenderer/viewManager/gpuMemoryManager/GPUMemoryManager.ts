import {SceneGeometry, SceneMesh} from "../../../scene";
import {RenderContext} from "../RenderContext";
import {GPUTileManager} from "./GPUTileManager";
import {type GPUTile} from "./GPUTile";
import {type GPUMemoryReader} from "./GPUMemoryReader";
import {type GPUMemoryEditor} from "./GPUMemoryEditor";
import {type DataTextures} from "./DataTextures";
import {MatrixTexture} from "./dataTextures/MatrixTexture";
import {GPUMemoryBatch} from "./GPUMemoryBatch";
import {type GPUMemoryMeshHandle} from "./GPUMemoryMeshHandle";
import {Camera, View} from "../../../viewer";
import {type RenderPassValue} from "../RENDER_PASSES";
import {EventEmitter, SDKErrorType, SDKInternalException, type SDKResult} from "../../../core";
import type {Mat4, Vec3} from "../../../math";
import {EventDispatcher} from "strongly-typed-events";
import type {MemoryUsage} from "../../MemoryUsage";

/**
 * Owns GPU-resident, dynamically editable storage for tiles, geometry, and mesh attributes.
 *
 * Owned by a {@link ViewManager}, used by {@link MeshManager}, {@link RenderManager}, and
 * {@link PickManager}.
 *
 * `GPUMemoryManager` implements a data-texture + batch based memory system to support rendering and
 * picking for large scenes with frequent updates.
 *
 * It is responsible for:
 * - Allocating and managing the data textures that encode per-tile camera/pick matrices (per view).
 * - Creating and tracking {@link GPUMemoryBatch} instances, which own GPU storage for geometry and mesh data.
 * - Providing a stable handle ({@link GPUMemoryMeshHandle}) used by higher-level managers to update mesh
 *   state (transform, per-view visibility, render pass, color/opacity, etc.).
 * - Uploading pending changes to the GPU via {@link uploadChanges}.
 * - Tracking and reporting GPU memory usage statistics.
 *
 * # Tiled Coordinate System, RTC (Relative To Center), and GPU Matrix Textures
 *
 * Large-scale 3D scenes require high-precision rendering, which is achieved by partitioning world space into "tiles".
 * Each tile defines a local coordinate system centered at a specific world position, allowing geometry within the tile
 * to be transformed relative to its center (RTC: Relative To Center). This approach minimizes floating-point precision errors
 * when rendering large or distant objects.
 *
 * ## Key Components
 *
 * - {@link GPUTile}:
 *   - Represents a single tile in world space.
 *   - Stores its center position and per-view RTC matrices (for both camera and picking).
 *   - Tracks usage count for efficient allocation and reuse.
 *
 * - {@link GPUTileManager}:
 *   - Allocates, synchronizes, and manages the lifecycle of all tiles.
 *   - Computes and updates RTC view and pick matrices for each tile as cameras move.
 *   - Maintains a mapping from world positions to tiles, and manages tile indices for GPU data textures.
 *   - Uploads updated RTC matrices to {@link MatrixTexture} objects for use in shaders.
 *
 * - {@link MatrixTexture}:
 *   - Stores RTC matrices for all tiles and views in a GPU-friendly format.
 *   - Updated by the {@link TileManager} whenever camera/view state changes.
 *
 * - {@link DataTextures.viewTileCameraMatrixTexture}:
 *   - An array of {@link MatrixTexture} objects, one per view.
 *   - Each texture contains the RTC view matrices for all tiles in that view.
 *   - Automatically updated when a camera moves, ensuring the GPU always has the latest RTC transforms.
 *
 * - {@link DataTextures.viewTilePickMatrixTexture}:
 *   - An array of {@link MatrixTexture} objects, one per view.
 *   - Each texture contains the RTC pick matrices for all tiles in that view, used for accurate object picking.
 *   - Updated as needed before picking operations.
 *
 * ## Matrix Conversion and GPU Upload
 * - When a tile is created or a camera/view changes, the system computes an RTC view matrix for each tile and view.
 * - The RTC view matrix is derived by combining the camera's view matrix with a translation that recenters the world origin at the tile's center.
 * - These RTC matrices are packed into {@link MatrixTexture} objects and uploaded to the GPU as data textures.
 * - Model matrices for objects are also converted to RTC form before upload, ensuring all transformations are relative to the tile center.
 *
 * ## Shader Usage
 * - In the vertex shader, the RTC view and model matrices are fetched from the appropriate {@link MatrixTexture} using the tile and view indices.
 * - Vertex positions are transformed using these RTC matrices, maintaining high precision even for large coordinates.
 * - This enables accurate rendering and picking across vast scenes without floating-point artifacts.
 *
 * ## Workflow Summary
 * 1. Geometry is assigned to a tile based on its world position.
 * 2. The tile's RTC matrices are computed and stored in {@link MatrixTexture} objects.
 * 3. When the camera moves, RTC view matrices are updated and re-uploaded to the GPU.
 * 4. Shaders use the RTC matrices to transform geometry, ensuring high-precision rendering and picking.
 *
 * @remarks
 * - The manager currently assumes a maximum of 4 views for tile matrix tables.
 * - GPUTile allocation/placement and per-view camera/pick matrices are coordinated by {@link GPUTileManager}.
 *
 * @internal
 */



export class GPUMemoryManager implements GPUMemoryReader, GPUMemoryEditor {

  /**
   * Data texture bundle exposed for internal consumers (eg. render passes/shaders).
   *
   * Populated after {@link init} succeeds. Set back to `null` after {@link destroy}.
   */
  public dataTextures: DataTextures | null = null;

  /** GPU memory batches, appended in creation order. */
  private _batches: GPUMemoryBatch[] = [];

  /** Shared renderer context (gl, viewer, configs, etc.). */
  private _renderContext: RenderContext;

  /** Manages tile placement and per-tile matrices. Created in {@link init}. */
  private _tileManager: GPUTileManager;

  /** Total number of meshes currently tracked across all batches. */
  private _numMeshes: number;

  /** Per-view tile -> camera view matrix tables (currently 4 views). */
  private _viewTileCameraMatrixTexture: MatrixTexture[];

  /** Per-view tile -> pick matrix tables (currently 4 views). */
  private _viewTilePickMatrixTexture: MatrixTexture[];

  /**
   * Creates a {@link GPUMemoryManager}.
   *
   * @param renderContext - Shared renderer context used for WebGL access and config.
   */
  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
    this._numMeshes = 0;
  }

  /**
   * Allocates GPU memory and initializes tile-related data textures for this manager.
   *
   * Creates:
   * - `viewTileCameraMatrixTexture[0..3]` mapping tileIndex -> camera view matrix per view
   * - `viewTilePickMatrixTexture[0..3]` mapping tileIndex -> pick matrix per view
   * - A {@link GPUTileManager} for tile allocation and matrix updates
   * - The {@link dataTextures} bundle used by render code
   *
   * @returns {@link SDKResult} that is `ok:true` when initialization succeeds, or `ok:false`
   * when texture allocation fails (typically due to GPU memory limits).
   *
   * @remarks
   * If allocation fails part-way through, already-allocated textures are destroyed before returning.
   */
  public init(): SDKResult<void> {

    const renderContext = this._renderContext;
    const gl = renderContext.gl;

    const maxTiles = renderContext.memoryConfigs.maxTiles;

    // Only GPUTileManager knows the current tile count, but MatrixTexture needs a dynamic count callback.
    const getNumItems = () => this._tileManager ? this._tileManager.numTiles : 0;

    this._viewTileCameraMatrixTexture = [
      new MatrixTexture({gl, maxItems: maxTiles, getNumItems, description: "[View 0] tileIndex → view matrix"}),
      new MatrixTexture({gl, maxItems: maxTiles, getNumItems, description: "[View 1] tileIndex → view matrix"}),
      new MatrixTexture({gl, maxItems: maxTiles, getNumItems, description: "[View 2] tileIndex → view matrix"}),
      new MatrixTexture({gl, maxItems: maxTiles, getNumItems, description: "[View 3] tileIndex → view matrix"})
    ];

    this._viewTilePickMatrixTexture = [
      new MatrixTexture({gl, maxItems: maxTiles, getNumItems, description: "[View 0] tileIndex → pick matrix"}),
      new MatrixTexture({gl, maxItems: maxTiles, getNumItems, description: "[View 1] tileIndex → pick matrix"}),
      new MatrixTexture({gl, maxItems: maxTiles, getNumItems, description: "[View 2] tileIndex → pick matrix"}),
      new MatrixTexture({gl, maxItems: maxTiles, getNumItems, description: "[View 3] tileIndex → pick matrix"})
    ];

    const textures: { allocate(): SDKResult<void>; destroy(): void }[] = [
      ...this._viewTileCameraMatrixTexture,
      ...this._viewTilePickMatrixTexture
    ];

    // Allocate all textures; rollback any that succeeded if one fails.
    for (let i = 0; i < textures.length; i++) {
      const res = textures[i].allocate();
      if (res.ok === false) {
        for (let j = i - 1; j >= 0; j--) {
          textures[j].destroy();
        }
        return {
          ok: false,
          type: SDKErrorType.MemoryExceeded,
          error: "[GPUMemoryManager.init] Out of GPU memory. Try increasing the maximum number of tiles."
        };
      }
    }

    this._tileManager = new GPUTileManager(
      renderContext,
      this._viewTileCameraMatrixTexture,
      this._viewTilePickMatrixTexture
    );

    this.dataTextures = {
      viewTileCameraMatrixTexture: this._viewTileCameraMatrixTexture.map((t) => t),
      viewTilePickMatrixTexture: this._viewTilePickMatrixTexture.map((t) => t),
      batches: [],
      onBatchCreated: new EventEmitter(new EventDispatcher<DataTextures, undefined>())
    };

    return { ok: true, value: undefined };
  }

  /**
   * Recreates GPU resources after a WebGL context restoration.
   *
   * Forwards the restoration event to all GPU-backed resources owned by this manager.
   *
   * @returns {@link SDKResult} indicating success or failure.
   *
   * @throws {@link SDKInternalException} If called before {@link init} created the required resources.
   */
  webglContextRestored(): SDKResult<void> {
    if (!this._viewTileCameraMatrixTexture || !this._viewTilePickMatrixTexture) {
      throw new SDKInternalException("[GPUMemoryManager.webglContextRestored] GPUMemoryManager is not initialized.");
    }

    // NOTE: Keep the existing (odd) iteration pattern out of behavior changes; just document intent.
    for (const contextUsers in [
      ...this._viewTileCameraMatrixTexture,
      ...this._viewTilePickMatrixTexture,
      this._batches
    ]) {
      const result = (<any>contextUsers).webglContextRestored();
      if (!result.ok) {
        return result;
      }
    }

    return { ok: true, value: undefined };
  }

  /**
   * Returns GPU memory usage in megabytes, derived from allocated/used byte totals.
   */
  getMemoryUsage(): MemoryUsage {
    return {
      allocatedMB: this.getAllocatedBytes() / (1024 * 1024),
      usedMB: this.getUsedBytes() / (1024 * 1024)
    };
  }

  /**
   * Returns total GPU memory allocated by this manager in bytes.
   *
   * Includes:
   * - per-view tile matrix tables
   * - all {@link GPUMemoryBatch} allocations
   */
  getAllocatedBytes(): number {
    let allocatedBytes = 0;

    for (const tileCameraMatrixTable of this._viewTileCameraMatrixTexture) {
      allocatedBytes += tileCameraMatrixTable.getAllocatedBytes();
    }
    for (const tilePickMatrixTable of this._viewTilePickMatrixTexture) {
      allocatedBytes += tilePickMatrixTable.getAllocatedBytes();
    }
    for (const batch of this._batches) {
      allocatedBytes += batch.getAllocatedBytes();
    }

    return allocatedBytes;
  }

  /**
   * Returns total GPU memory currently used by this manager in bytes.
   *
   * Includes:
   * - per-view tile matrix table usage
   * - batch usage (meshes/geometry resident in batches)
   */
  getUsedBytes(): number {
    let usedBytes = 0;

    for (const tileCameraMatrixTable of this._viewTileCameraMatrixTexture) {
      usedBytes += tileCameraMatrixTable.getUsedBytes();
    }
    for (const tilePickMatrixTable of this._viewTilePickMatrixTexture) {
      usedBytes += tilePickMatrixTable.getUsedBytes();
    }
    for (const batch of this._batches) {
      usedBytes += batch.getUsedBytes();
    }

    return usedBytes;
  }

  /**
   * Estimated per-item byte sizes managed by {@link GPUMemoryManager}.
   *
   * Useful for debugging/telemetry and rough capacity planning.
   */
  static get itemSizesInBytes(): { [key: string]: number } {
    return Object.assign(
      {
        tile:
          (MatrixTexture.itemSizeInBytes * 4) + // view matrices for 4 views
          (MatrixTexture.itemSizeInBytes * 4),  // pick matrices for 4 views
      },
      GPUMemoryBatch.itemSizesInBytes
    );
  }

  /**
   * Uploads all pending CPU-side changes to GPU textures/buffers.
   *
   * This should be called once per frame (or tick) before rendering, after any state changes have
   * been queued by higher-level managers.
   */
  public uploadChanges(): void {
    for (let i = 0; i < 4; i++) {
      this._viewTileCameraMatrixTexture[i].uploadChanges();
      this._viewTilePickMatrixTexture[i].uploadChanges();
    }
    for (const batch of this._batches) {
      batch.uploadChanges();
    }
  }

  /**
   * Notifies that a camera's view matrix was updated.
   *
   * Forwards to {@link GPUTileManager} so per-tile per-view matrices can be recomputed/updated.
   */
  public cameraViewMatrixUpdated(camera: Camera): void {
    this._tileManager.cameraViewMatrixUpdated(camera);
  }

  /**
   * Sets the pick matrix for a view.
   *
   * The pick matrix is substituted for the normal view matrix when performing ray picking in that
   * view; otherwise the regular view matrix is used.
   *
   * @param view - The target view.
   * @param pickMatrix - Pick matrix to associate with the view.
   */
  public setViewPickMatrix(view: View, pickMatrix: Mat4): void {
    this._tileManager.setViewPickMatrix(view, pickMatrix);
  }

  /**
   * Returns a {@link GPUTile} that contains a given world-space position.
   *
   * @param worldPos - World-space position.
   * @returns The tile containing the position. The tile's reference count is incremented.
   */
  public getTile(worldPos: Vec3): GPUTile {
    return this._tileManager.getTile(worldPos);
  }

  /**
   * Moves a tile (if required) so it contains the given world-space position.
   *
   * @param tile - The tile to potentially move.
   * @param worldPos - Target world-space position.
   * @returns The same tile if no move was needed, otherwise a different tile. When a different tile
   * is returned, the old tile is released back to {@link GPUTileManager}.
   */
  public moveTile(tile: GPUTile, worldPos: Vec3): GPUTile {
    return this._tileManager.moveTile(tile, worldPos);
  }

  /**
   * Releases a tile back to the tile manager.
   *
   * A tile is destroyed/recycled once it has been released as many times as it was acquired.
   *
   * @param tile - The tile to release.
   */
  public putTile(tile: GPUTile): void {
    this._tileManager.putTile(tile);
  }

  /**
   * Creates and allocates a new GPU memory batch.
   *
   * The created {@link GPUMemoryBatch} is appended to {@link dataTextures.batches} and
   * {@link DataTextures.onBatchCreated} is dispatched.
   *
   * @returns {@link SDKResult} containing the new batch index, or `ok:false` if allocation fails.
   */
  public createBatch(): SDKResult<number> {
    if (this._batches.length >= this._renderContext.memoryConfigs.maxBatches) {
      return {
        ok: false,
        type: SDKErrorType.MemoryExceeded,
        error: "[GPUMemoryManager.createBatch] Exceeded maximum number of GPU memory batches."
      };
    }

    const index = this._batches.length;
    const gpuMemoryBatch = new GPUMemoryBatch(index, this._renderContext);

    const allocateResult = gpuMemoryBatch.allocate();
    if (allocateResult.ok === false) {
      gpuMemoryBatch.destroy();
      return {
        ok: false,
        type: SDKErrorType.MemoryExceeded,
        error: `[GPUMemoryManager.createBatch] Out of GPU memory - ${allocateResult.error}`
      };
    }

    this._batches.push(gpuMemoryBatch);

    // dataTextures is created in init(); keep runtime behavior but assume init was called.
    this.dataTextures!.batches.push(gpuMemoryBatch.dataTextures);
    this.dataTextures!.onBatchCreated.dispatch(this.dataTextures!, undefined);

    return { ok: true, value: index };
  }

  /**
   * Returns whether a batch has sufficient remaining space to add the given mesh.
   *
   * @param batchIndex - Target batch index.
   * @param sceneMesh - Mesh to test.
   */
  public hasMemoryForMesh(batchIndex: number, sceneMesh: SceneMesh): boolean {
    const gpuMemoryBatch = this._batches[batchIndex];
    return gpuMemoryBatch ? gpuMemoryBatch.hasMemoryForMesh(sceneMesh) : false;
  }

  /**
   * Adds a {@link SceneMesh} to a batch and returns a {@link GPUMemoryMeshHandle} used for updates.
   *
   * The handle contains:
   * - `gpuMemoryBatchIndex` and `meshIndex` for addressing the mesh
   * - derived `numIndices` / `numVertices` counts for rendering/picking convenience
   *
   * @param batchIndex - Target batch index.
   * @param sceneMesh - Mesh to add.
   *
   * @throws {@link SDKInternalException} If the batch index is invalid.
   */
  public addMesh(batchIndex: number, sceneMesh: SceneMesh): SDKResult<GPUMemoryMeshHandle> {
    const gpuMemoryBatch = this._batches[batchIndex];
    if (!gpuMemoryBatch) {
      throw new SDKInternalException("[GPUMemoryManager.addMesh] Invalid batch index.");
    }

    const meshIdxResult = gpuMemoryBatch.addMesh(sceneMesh);
    if (meshIdxResult.ok === false) {
      return meshIdxResult;
    }

    const meshIdx = meshIdxResult.value;
    this._numMeshes++;

    return {
      ok: true,
      value: <GPUMemoryMeshHandle>{
        meshIndex: meshIdx,
        gpuMemoryBatchIndex: gpuMemoryBatch.index,
        numIndices: sceneMesh.geometry.indices ? sceneMesh.geometry.indices.length : 0,
        numVertices: sceneMesh.geometry.positionsCompressed ? sceneMesh.geometry.positionsCompressed.length / 3 : 0
      }
    };
  }

  /**
   * Sets whether a mesh is visible in a given view.
   *
   * @param meshHandle - Mesh handle returned by {@link addMesh}.
   * @param viewIndex - Target view index.
   * @param visible - Visibility flag.
   *
   * @throws {@link SDKInternalException} If the mesh handle references an invalid batch.
   */
  public setMeshVisible(meshHandle: GPUMemoryMeshHandle, viewIndex: number, visible: boolean) {
    const batch = this._batches[meshHandle.gpuMemoryBatchIndex];
    if (!batch) {
      throw new SDKInternalException("[GPUMemoryManager.setMeshVisible] Invalid batch index in mesh handle.");
    }
    batch.setMeshVisible(meshHandle.meshIndex, viewIndex, visible);
  }

  /**
   * Sets the modeling transform matrix for a mesh.
   *
   * The modeling transform is relative to the center of the mesh's current tile.
   *
   * @param meshHandle - Mesh handle returned by {@link addMesh}.
   * @param matrix - Model matrix.
   *
   * @throws {@link SDKInternalException} If the mesh handle references an invalid batch.
   */
  public setMeshMatrix(meshHandle: GPUMemoryMeshHandle, matrix: Mat4): void {
    const batch = this._batches[meshHandle.gpuMemoryBatchIndex];
    if (!batch) {
      throw new SDKInternalException("[GPUMemoryManager.setMeshMatrix] Invalid batch index in mesh handle.");
    }
    batch.setMeshMatrix(meshHandle.meshIndex, matrix);
  }

  /**
   * Sets batch-wide (all-view) attributes for a mesh.
   *
   * @param meshHandle - Mesh handle returned by {@link addMesh}.
   * @param params - Attribute parameters.
   * @param params.tileIndex - Optional explicit tile index containing the mesh. This can change over time as the
   * mesh moves between tiles.
   *
   * @throws {@link SDKInternalException} If the mesh handle references an invalid batch.
   */
  public setMeshAttribs(meshHandle: GPUMemoryMeshHandle, params: { tileIndex?: number }) {
    const batch = this._batches[meshHandle.gpuMemoryBatchIndex];
    if (!batch) {
      throw new SDKInternalException("[GPUMemoryManager.setMeshAttribs] Invalid batch index in mesh handle.");
    }
    batch.setMeshAttribs(meshHandle.meshIndex, params);
  }

  /**
   * Sets per-view attributes for a mesh.
   *
   * @param meshHandle - Mesh handle returned by {@link addMesh}.
   * @param viewIndex - Target view index.
   * @param params - Per-view attributes.
   * @param params.color - RGB color encoded as bytes 0..255 (packed on upload).
   * @param params.opacity - Opacity in range 0..1.
   * @param params.clippable - Whether the mesh participates in clipping.
   * @param params.pickable - Whether the mesh can be picked.
   *
   * @throws {@link SDKInternalException} If the mesh handle references an invalid batch.
   */
  public setMeshViewAttribs(
    meshHandle: GPUMemoryMeshHandle,
    viewIndex: number,
    params: {
      color?: Vec3;      // uvec3 bytes 0..255
      opacity?: number;  // float 0..1
      clippable?: boolean;
      pickable?: boolean;
    }
  ) {
    const batch = this._batches[meshHandle.gpuMemoryBatchIndex];
    if (!batch) {
      throw new SDKInternalException("[GPUMemoryManager.setMeshViewAttribs] Invalid batch index in mesh handle.");
    }
    batch.setMeshViewAttribs(meshHandle.meshIndex, viewIndex, params);
  }

  /**
   * Sets the render pass state for a mesh within a view.
   *
   * @param meshHandle - Mesh handle returned by {@link addMesh}.
   * @param viewIndex - Target view index.
   * @param renderPass - Render pass value to assign.
   *
   * @throws {@link SDKInternalException} If the mesh handle references an invalid batch.
   */
  public setMeshRenderPass(meshHandle: GPUMemoryMeshHandle, viewIndex: number, renderPass: RenderPassValue): void {
    const batch = this._batches[meshHandle.gpuMemoryBatchIndex];
    if (!batch) {
      throw new SDKInternalException("[GPUMemoryManager.setMeshRenderPass] Invalid batch index in mesh handle.");
    }
    batch.setMeshRenderPass(meshHandle.meshIndex, viewIndex, renderPass);
  }

  /**
   * Removes a mesh from GPU memory.
   *
   * @param meshHandle - Mesh handle returned by {@link addMesh}.
   *
   * @throws {@link SDKInternalException} If the mesh handle references an invalid batch.
   */
  public removeMesh(meshHandle: GPUMemoryMeshHandle): void {
    const batch = this._batches[meshHandle.gpuMemoryBatchIndex];
    if (!batch) {
      throw new SDKInternalException("[GPUMemoryManager.removeMesh] Invalid batch index in mesh handle.");
    }
    batch.removeMesh(meshHandle.meshIndex);
    this._numMeshes--;
  }

  /**
   * Returns geometry for a given (batchIndex, geometryIndex) pair.
   *
   * @param batchIndex - GPU batch index.
   * @param geometryIndex - Geometry index within the batch.
   */
  public getGeometryAtIndex(batchIndex: number, geometryIndex: number): SceneGeometry | null {
    const batch = this._batches[batchIndex];
    if (!batch) {
      return null;
    }
    return batch.getGeometryAtIndex(geometryIndex);
  }

  /**
   * Returns a mesh for a given (batchIndex, meshIndex) pair.
   *
   * @param batchIndex - GPU batch index.
   * @param meshIndex - Mesh index within the batch.
   */
  public getMeshAtIndex(batchIndex: number, meshIndex: number): SceneMesh | null {
    const batch = this._batches[batchIndex];
    if (!batch) {
      return null;
    }
    return batch.getMeshAtIndex(meshIndex);
  }

  /**
   * Returns draw parameters for a mesh in a given batch.
   *
   * Intended to support WebGL `drawArrays(first, count)` style draws.
   *
   * @param batchIndex - GPU batch index.
   * @param meshIndex - Mesh index within the batch.
   */
  public getDrawArraysParamsForMesh(batchIndex: number, meshIndex: number): { first: number, count: number } | null {
    const batch = this._batches[batchIndex];
    if (!batch) {
      return null;
    }
    return batch.getDrawArraysParamsForMesh(meshIndex);
  }

  /**
   * Destroys this manager and all owned GPU resources.
   *
   * @remarks
   * - Destroys all batches first, then tile matrix textures.
   * - Resets references and counters for safety in development.
   */
  public destroy() {
    for (const batch of this._batches) {
      batch.destroy();
    }

    this._numMeshes = 0;
    this._batches.length = 0;
    this.dataTextures = null as any;

    const clear = (ref: any) => {
      if (ref) {
        ref.destroy();
        return null;
      }
      return ref;
    };

    if (this._viewTileCameraMatrixTexture) {
      this._viewTileCameraMatrixTexture = this._viewTileCameraMatrixTexture.map(clear);
    }
    if (this._viewTilePickMatrixTexture) {
      this._viewTilePickMatrixTexture = this._viewTilePickMatrixTexture.map(clear);
    }
  }
}
