import {type Mat4} from "../../../../base/math/matrix";
import {type Vec3} from "../../../../base/math/vector";
import {type GPUTile} from "./GPUTile";
import {type SceneMesh} from "../../../../model/scene";
import type {GPUMemoryMeshHandle} from "./GPUMemoryMeshHandle";
import type {RenderPassValue} from "../RENDER_PASSES";
import type {Camera} from "../../../viewer";
import type {SDKResult} from "../../../../base/core";
import {GPUMemoryCheckResult} from "./GPUMemoryCheckResult";
import type {GPUMemoryBatchOptions} from "./GPUMemoryBatch";

/**
 * Interface for creating and updating GPU memory resources.
 *
 * @internal
 */
export interface GPUMemoryEditor {

  /**
   * Retrieves a GPUTile that contains the specified 3D world-space position.
   * @param worldPos - A 3D position in world space.
   * @returns The GPUTile containing the given position.
   */
  getTile( worldPos: Vec3 ): GPUTile;

  /**
   * Moves a GPUTile, if necessary, to ensure it contains the specified 3D world-space position.
   * @param tile - The tile to potentially move.
   * @param worldPos - The target world-space position.
   * @returns The updated GPUTile.
   */
  moveTile(tile: GPUTile, worldPos: Vec3 ): GPUTile;

  /**
   * Releases a GPUTile back to the tile manager.
   * The tile is destroyed once it is released as many times as it was retrieved.
   * @param tile - The tile to release.
   */
  putTile( tile: GPUTile ): void;

  /**
   * Creates a new GPU memory batch, up to the configured maximum number of batches.
   * The new batch is added to the `GPUMemoryManager.gpuResources.batches` resource array.
   * @returns The index of the newly created batch, or an error if the maximum number of batches has been reached.
   */
  createBatch(options?: GPUMemoryBatchOptions): SDKResult<number>;

  /**
   * Checks if there is enough memory in a specific GPU memory batch for a SceneMesh.
   * @param batchIndex
   * @param sceneMesh
   */
  hasMemoryForMesh( batchIndex: number, sceneMesh: SceneMesh ): GPUMemoryCheckResult;

  /**
   * Adds a SceneMesh to a specific GPU memory batch.
   * Returns a handle for dynamically updating attributes of the mesh.
   * @param batchIndex - The index of the batch to which the mesh should be added.
   * @param sceneMesh - The mesh to add.
   * @returns Handle to the added mesh.
   */
  addMesh( batchIndex: number, sceneMesh: SceneMesh ): SDKResult<GPUMemoryMeshHandle> ;

  /**
   * Sets whether a mesh is visible in a specific view.
   * @param meshHandle
   * @param viewIndex
   * @param visible
   */
  setMeshVisible(meshHandle: GPUMemoryMeshHandle, viewIndex: number, visible: boolean): void;

  /**
   * Sets whether a mesh is culled in a specific view. Independent of
   * visibility; the mesh is drawn only when visible and not culled.
   * @param meshHandle
   * @param viewIndex
   * @param culled
   */
  setMeshCulled(meshHandle: GPUMemoryMeshHandle, viewIndex: number, culled: boolean): void;

  /**
   * Sets the modeling transform matrix for a mesh.
   * The transform is relative to the center of the mesh's tile.
   * The matrix is stored in BatchGPUResources.meshMatrixTexture.
   * @param meshHandle - The handle of the mesh.
   * @param matrix - The modeling transform matrix.
   */
  setMeshMatrix(meshHandle: GPUMemoryMeshHandle, matrix: Mat4 ): void;

  /**
   * Sets attributes for a mesh to apply across all views.
   * The attributes are stored in BatchGPUResources.meshAttributeTexture.
   * @param meshHandle
   * @param params - The attributes to set, including optional tile index.
   */
  setMeshAttribs(
    meshHandle: GPUMemoryMeshHandle,
    params: {
      tileIndex?: number;
    }
  ): void;

  /**
   * Sets attributes for a mesh within a specific view.
   * The attributes are stored in BatchGPUResources.views[].meshViewAttributeTexture.
   * @param meshHandle
   * @param viewIndex - The index of the view.
   * @param params - The attributes to set, including flags and color.
   */
  setMeshViewAttribs(
    meshHandle: GPUMemoryMeshHandle,
    viewIndex: number,
    params: {
      color?: Vec3;   // uvec3 bytes 0..255
      opacity?: number; // float 0..1
      clippable?: boolean;
      pickable?: boolean;
    }
  ): void;

  /**
   *
   * @param meshHandle
   * @param viewIndex
   * @param renderPass
   */
  setMeshRenderPass(meshHandle: GPUMemoryMeshHandle, viewIndex: number, renderPass: RenderPassValue): void;

  /**
   * Retrieves a SceneMesh from a specific batch at the given index.
   * This supports picking, where we need to map from each mesh's fragments, containing the RGBA-encoded batch and mesh indices,
   * back to the SceneMesh instance.
   * @param batchIndex
   * @param meshIndex
   */
  getMeshAtIndex(batchIndex: number, meshIndex: number): SceneMesh;

  /**
   * Retrieves parameters for a drawArrays() call to render a specific mesh within a specific batch.
   * @param batchIndex
   * @param meshIndex
   */
  getDrawArraysParamsForMesh( batchIndex: number, meshIndex: number ): { first: number, count: number} | null;

  /**
   * Removes a SceneMesh.
   * @param meshHandle - Handle to the mesh to remove.
   */
  removeMesh( meshHandle: GPUMemoryMeshHandle ): void;

  /**
   * Called when the camera's view matrix is updated.
   * Internally updates all tile RTC view matrices.
   */
  cameraViewMatrixUpdated(camera: Camera): void;

  /**
   * Uploads all pending changes to GPU memory.
   * This is typically called once per frame.
   */
  uploadChanges(): void;
}
