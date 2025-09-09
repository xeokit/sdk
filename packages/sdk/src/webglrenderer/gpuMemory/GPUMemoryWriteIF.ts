import { type FloatArrayParam } from "../../math";
import { type Tile } from "./Tile";
import { type SceneMesh } from "../../scene";

/**
 * Interface for managing data texture gpuMemory in a WebGL rendering context.
 * Provides methods for handling tiles, meshes, and their attributes.
 */
export interface GPUMemoryWriteIF {

  /**
   * Retrieves a Tile that contains the specified 3D world-space position.
   * @param worldPos - A 3D position in world space.
   * @returns The Tile containing the given position.
   */
  getTile(worldPos: FloatArrayParam): Tile;

  /**
   * Moves a Tile, if necessary, to ensure it contains the specified 3D world-space position.
   * @param tile - The tile to potentially move.
   * @param worldPos - The target world-space position.
   * @returns The updated Tile.
   */
  moveTile( tile: Tile, worldPos: FloatArrayParam): Tile;

  /**
   * Releases a Tile back to the tile manager.
   * The tile is destroyed once it is released as many times as it was retrieved.
   * @param tile - The tile to release.
   */
  putTile(tile: Tile): void;

  /**
   * Adds a SceneMesh to the data texture gpuMemory.
   * Returns an tileIndex/handle for dynamically updating attributes of the mesh.
   * @param sceneMesh - The mesh to add.
   * @returns The tileIndex/handle of the added mesh.
   */
  addMesh(sceneMesh: SceneMesh): number;

  /**
   * Sets the modeling transform matrix for a mesh.
   * The transform is relative to the center of the mesh's tile.
   * The matrix is stored in DataTextures.meshMatrices.
   * @param meshIndex - The tileIndex/handle of the mesh.
   * @param matrix - The modeling transform matrix.
   */
  setMeshMatrix(meshIndex: number, matrix: FloatArrayParam): void;

  /**
   * Sets attributes for a mesh to apply across all views.
   * The attributes are stored in DataTextures.meshAttribs.
   * @param meshIndex - The tileIndex/handle of the mesh.
   * @param params - The attributes to set, including optional tile tileIndex.
   */
  setMeshAttribs(
    meshIndex: number,
    params: {
      tileIndex?: number;
    }
  ): void;

  /**
   * Sets attributes for a mesh within a specific view.
   * The attributes are stored in DataTextures.meshViewAttribs.
   * @param meshIndex - The tileIndex/handle of the mesh.
   * @param viewIndex - The tileIndex of the view.
   * @param params - The attributes to set, including flags, flags2, and color.
   */
  setMeshViewAttribs(
    meshIndex: number,
    viewIndex: number,
    params: {
      flags?: number;
      flags2?: number;
      color?: number[];
    }
  ): void;

  /**
   * Removes a SceneMesh from the data texture gpuMemory.
   * @param sceneMesh - The mesh to remove.
   */
  removeMesh(sceneMesh: SceneMesh): void;
}
