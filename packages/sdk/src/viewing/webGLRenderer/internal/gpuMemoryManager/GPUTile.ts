import type {Vec3} from "../../../../base/math/vector";
import type {Mat4} from "../../../../base/math/matrix";

/**
 * Represents a single tile in a tiled coordinate system.
 *
 * Owned by a {@link GPUTileManager}.
 *
 * Tracks world-space positions, RTC matrices, and usage counts for efficient rendering
 * and memory management. Integrates with `GPUTileManager` to manage tile-based rendering.
 *
 * ## Features:
 * - Stores world-space center and RTC matrices for multiple views.
 * - Tracks usage count for efficient memory allocation.
 * - Supports dynamic movement and reassignment within the tiled system.
 *
 * ## Overview
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
 *   - Updated by the {@link GPUTileManager} whenever camera/view state changes.
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
 * @internal
 */
export interface GPUTile {

  /**
   * Unique ID of this GPUTile
   */
  id: string;

  /**
   * Index of this GPUTile within GPUTileManager
   */
  tileIndex: number;

  /**
   * Count of users of this tile.
   */
  useCount: number;

  /**
   * World-space 3D tile center
   */
  center: Vec3;

  /**
   * The size of this tile in world units on each side.
   * The tile is a cube, so this is the same for all dimensions.
   */
  size: number;

  /**
   * A relative-to-center (RTC) view matrix for each existing View. This is stored in DataTexturesLayer.viewTileCameraMatrixTexture
   * and automatically updates on all Tiles whenever the View's Camera moves.
   */
  rtcViewMatrix: Mat4[];

  /**
   * A relative-to-center (RTC) pick matrix for each existing View. This is stored in DataTexturesLayer.viewTilePickMatrixTexture
   * and is manually updated on all Tiles for a target View before picking in that View.
   */
  rtcRayPickMatrix: Mat4[];
}
