/**
 * Describes a range of primitives in a `DTXPrimMeshIndexTable`.
 * Primitive ranges are used with `gl.drawArrays` to efficiently render specific passes.
 * The `primMeshIndexTable` contains all primitives for a View within a render batch, partitioned
 * by render pass.
 */
export interface PrimRange {

  /** First primitive index for this pass (inclusive). */
  firstPrim: number;

  /** Number of primitives in this pass. */
  numPrims: number;
}
