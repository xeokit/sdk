/**
 * Options for {@link extractFills}.
 */
export interface ExtractFillsOptions {
  /**
   * Drop fills with fewer than this many pixels in the owner
   * buffer. Filters out salt-and-pepper noise from triangles
   * that only barely win the depth test. Default `4` — low
   * enough to keep thin features (chair legs, door handles)
   * once the depth buffer is at the default `2048` resolution.
   */
  minPixelArea?: number;
  /**
   * Douglas-Peucker tolerance, in pixel units. `0.25` (default)
   * preserves sub-pixel detail at 2048 px while still dropping
   * the redundant collinear vertices marching squares emits
   * along straight edges. Set to `0` to keep every
   * marching-squares vertex.
   */
  simplifyEpsilon?: number;
}
