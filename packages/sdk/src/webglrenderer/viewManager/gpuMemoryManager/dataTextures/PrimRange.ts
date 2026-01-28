/**
 * Describes a range of primitives in a `PrimitiveMeshIndexTexture`.
 * Primitive ranges are used with `gl.drawArrays` to efficiently render specific passes.
 * The `primitiveMeshIndexTexture` contains all primitives for a View within a render batch, partitioned
 * by render pass.
 */
export interface PrimRange {

  /** First primitive index for this pass (inclusive). */
  firstPrim: number;

  /** Number of primitives in this pass. */
  numPrims: number;
}
