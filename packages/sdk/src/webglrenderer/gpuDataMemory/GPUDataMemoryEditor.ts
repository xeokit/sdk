import { type FloatArrayParam } from "../../math";
import { type RenderTile } from "./RenderTile";
import { type SceneMesh } from "../../scene";

/**
 * Interface for managing data texture memory in a WebGL rendering context.
 * Provides methods for handling tiles, meshes, and their attributes.
 */
export interface GPUDataMemoryEditor {

  /**
   * Retrieves a RenderTile that contains the specified 3D world-space position.
   * @param worldPos - A 3D position in world space.
   * @returns The RenderTile containing the given position.
   */
  getTile(worldPos: FloatArrayParam): RenderTile;

  /**
   * Moves a RenderTile, if necessary, to ensure it contains the specified 3D world-space position.
   * @param tile - The tile to potentially move.
   * @param worldPos - The target world-space position.
   * @returns The updated RenderTile.
   */
  moveTile(tile: RenderTile, worldPos: FloatArrayParam): RenderTile;

  /**
   * Releases a RenderTile back to the tile manager.
   * The tile is destroyed once it is released as many times as it was retrieved.
   * @param tile - The tile to release.
   */
  putTile(tile: RenderTile): void;

  /**
   * Adds a SceneMesh to the data texture memory.
   * Returns an index/handle for dynamically updating attributes of the mesh.
   * @param sceneMesh - The mesh to add.
   * @returns The index/handle of the added mesh.
   */
  addMesh(sceneMesh: SceneMesh): number;

  /**
   * Sets the modeling transform matrix for a mesh.
   * The transform is relative to the center of the mesh's tile.
   * @param meshIndex - The index/handle of the mesh.
   * @param matrix - The modeling transform matrix.
   */
  setMeshMatrix(meshIndex: number, matrix: FloatArrayParam): void;

  /**
   * Sets attributes for a mesh to apply across all views.
   * @param meshIndex - The index/handle of the mesh.
   * @param params - The attributes to set, including optional tile index.
   */
  setMeshAttributes(
    meshIndex: number,
    params: {
      tileIndex?: number;
    }
  ): void;

  /**
   * Sets attributes for a mesh within a specific view.
   * @param meshIndex - The index/handle of the mesh.
   * @param viewIndex - The index of the view.
   * @param params - The attributes to set, including flags, flags2, and color.
   */
  setMeshViewAttributes(
    meshIndex: number,
    viewIndex: number,
    params: {
      flags?: number;
      flags2?: number;
      color?: number[];
    }
  ): void;

  /**
   * Removes a SceneMesh from the data texture memory.
   * @param sceneMesh - The mesh to remove.
   */
  removeMesh(sceneMesh: SceneMesh): void;
}
