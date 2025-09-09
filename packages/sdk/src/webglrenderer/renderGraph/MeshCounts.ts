
/**
 * Tracks various counts related to meshes in a `RenderLayerImpl` within a `WebGLRenderer`.
 *
 * This class is used to keep track of the number of meshes and their states,
 * such as visibility, transparency, and selection, during rendering.
 *
 * @private
 */
export class MeshCounts {

  /**
   * Total number of meshes.
   */
  numMeshes: number;

  /**
   * Number of visible meshes.
   */
  numVisible: number;

  /**
   * Number of transparent meshes.
   */
  numTransparent: number;

  /**
   * Number of x-rayed meshes.
   */
  numXRayed: number;

  /**
   * Number of selected meshes.
   */
  numSelected: number;

  /**
   * Number of highlighted meshes.
   */
  numHighlighted: number;

  /**
   * Number of clippable meshes.
   */
  numClippable: number;

  /**
   * Number of pickable meshes.
   */
  numPickable: number;

  /**
   * Number of culled meshes (not rendered).
   */
  numCulled: number;

  /**
   * Initializes a new instance of `MeshCounts` and resets all counts to zero.
   */
  constructor() {
    this.reset();
  }

  /**
   * Resets all mesh counts to zero.
   */
  reset() {
    this.numMeshes = 0;
    this.numVisible = 0;
    this.numTransparent = 0;
    this.numXRayed = 0;
    this.numSelected = 0;
    this.numHighlighted = 0;
    this.numClippable = 0;
    this.numPickable = 0;
    this.numCulled = 0;
  }
}
