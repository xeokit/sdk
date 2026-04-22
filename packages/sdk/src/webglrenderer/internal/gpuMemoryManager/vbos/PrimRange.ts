/**
 * Describes a range of primitives in a `PrimitiveMeshIndexBuffer`.
 * Primitive ranges are used with `gl.drawArrays` to efficiently render specific passes.
 * The `primitiveMeshIndexBuffer` contains all primitives for a View within a render batch, partitioned
 * by render pass.
 *
 * @internal
 */
export interface PrimRange {

  /** First primitive index for this pass (inclusive). */
  firstPrim: number;

  /** Number of primitives in this pass. */
  numPrims: number;
}
