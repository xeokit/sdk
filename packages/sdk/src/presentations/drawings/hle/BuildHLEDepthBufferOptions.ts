/**
 * Options for {@link buildHLEDepthBuffer}. All optional;
 * defaults work well for typical BIM geometry.
 */
export interface BuildHLEDepthBufferOptions {
  /**
   * Buffer resolution along the longer of (u, v). Default `2048`.
   * Drives both edge-HLE precision and (when paired with
   * `withOwners`) the silhouette fidelity of fill extraction —
   * 2048 gives ~5 mm/pixel on a 10 m model, fine enough that
   * Douglas-Peucker simplification stays sub-mm.
   */
  resolution?: number;
  /**
   * When `true`, also rasterise a per-pixel owner index parallel
   * to the depth buffer — see {@link HLEDepthBuffer.owners}. Used
   * by the fill-polygon extractor to know which source
   * SceneObject owns each pixel; ignored by edge-only HLE.
   * Default `false`.
   */
  withOwners?: boolean;
  /**
   * Optional callback awaited every `yieldEveryObjects` source
   * SceneObjects so the host renderer can paint between
   * batches. Without it the rasteriser runs straight through
   * to completion (the right shape when the caller wants a
   * single atomic build).
   */
  yield?: () => Promise<void>;
  /**
   * How many source SceneObjects to rasterise between
   * `yield()` calls. Default `25`. A 1024² buffer with HLE
   * defaults raster-fills one ~1000-object IFC building at
   * roughly 25 objects per frame on a desktop, so 25 paces the
   * yields to ~one per frame.
   */
  yieldEveryObjects?: number;
  /**
   * Optional check called between yield batches. Return `true`
   * to abort the build; the returned buffer is the partial
   * one (still usable for visualisation but missing
   * unprocessed source objects).
   */
  cancelled?: () => boolean;
  /**
   * Optional cut-away clip plane. When supplied, triangles
   * whose **centroid** satisfies
   * `dot(centroid - clipPoint, clipNormal) < 0` are skipped
   * during rasterisation — i.e. the side `clipNormal` points
   * toward is kept, the opposite side is discarded. Used to
   * render sliced cross-section / cut-away drawings.
   * `clipNormal` must be unit length.
   */
  clipPoint?: ArrayLike<number>;
  clipNormal?: ArrayLike<number>;
}
