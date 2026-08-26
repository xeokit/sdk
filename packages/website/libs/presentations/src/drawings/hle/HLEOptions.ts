/**
 * Tuning parameters for hidden-line elimination. All optional;
 * defaults work well for typical BIM geometry.
 */
export interface HLEOptions {
  /**
   * Depth-buffer resolution along the longer (u, v) axis of
   * the projection plane (the shorter axis is scaled to match
   * the AABB aspect). Default `2048`. Higher gives finer
   * occlusion boundaries at proportionally higher build cost.
   */
  resolution?: number;
  /**
   * Number of points sampled along each edge for the
   * visibility test. Default `5`. Higher catches edges that
   * cross visibility boundaries between samples; lower is
   * faster.
   */
  samples?: number;
  /**
   * Depth-bias tolerance, in world units. An edge sample is
   * considered visible when its depth is within this much of
   * the buffer depth. Default `0.01` (1 cm) — large enough to
   * keep crease edges of the model itself from self-occluding
   * under floating-point noise, small enough that real
   * occluders still hide what they should.
   */
  tolerance?: number;
}
