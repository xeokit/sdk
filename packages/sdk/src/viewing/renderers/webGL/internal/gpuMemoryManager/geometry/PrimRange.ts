/**
 * Primitive interval used by geometry storage to render a specific pass.
 *
 * DTX storage maps this to a `gl.drawArrays` range in its primitive-mesh-index
 * texture. VBO storage maps the same shape to a `gl.drawElements` range in its
 * index buffer.
 *
 * @internal
 */
export interface PrimRange {

  /** First primitive index for this pass (inclusive). */
  firstPrim: number;

  /** Number of primitives in this pass. */
  numPrims: number;
}
