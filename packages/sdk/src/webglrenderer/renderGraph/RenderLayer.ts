import {MeshCounts} from "./MeshCounts";

/**
 * A RenderLayer represents a collection of meshes that share the same rendering properties and can be rendered together in a single draw call.
 */
export interface RenderLayer {

  /**
   * Primitive type of the meshes in this layer.
   */
  primitive: number;

  /**
   * Base primitive tileIndex for this layer.
   */
  primBaseIndex: number;

  /**
   * Whether this layer supports Screen Space Ambient Occlusion (SSAO) rendering.
   */
  saoSupported: boolean;

  /**
   * The total number of indices in all meshes of this layer. This is used with WebGL draw calls to determine how many indices to draw
   * when drawing this layer.
   */
  numIndices: number;

  /**
   * The total number of vertices in all meshes of this layer. This is used for various calculations and optimizations related to rendering.
   */
  numVertices: number;

  /**
   * Counts of meshes and their visibility states for each view. These are used to build the render flags for the views.
   */
  meshCounts: MeshCounts[];

  /**
   * The index of this layer in the GPUMemory system.
   */
  gpuLayerIndex: number;
}
