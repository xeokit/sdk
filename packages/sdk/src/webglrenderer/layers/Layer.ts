import {MeshCounts} from "./MeshCounts";

/**
 * Represents a layer in the WebGL renderer, which contains a collection of meshes that can be rendered together.
 */
export interface Layer {

  /**
   * The type of primitive this layer contains, such as triangles, lines, or points.
   */
  primitive: number;

  /**
   * The total number of indices in all meshes of this layer. This is used with WebGL draw calls to determine how many indices to render
   * when drawing this layer.
   */
  numIndices: number;

  /**
   * The base index for the primitive in GPUDataMemory. This is used to offset the indices when rendering.
   */
  primitiveBase: number;

  /**
   * Counts of meshes in this layer and their visibility states for each view.
   */
  meshCounts: MeshCounts[];

  /**
   * Whether this layer supports Screen Space Ambient Occlusion (SSAO).
   */
  saoSupported: boolean;
}
