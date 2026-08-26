import type {SceneMesh, SceneObject} from "@xeokit/sdk/model/scene";

/**
 * Options for {@link buildHLEDepthBuffer}. All optional;
 * defaults work well for typical BIM geometry.
 */
export interface BuildHLEDepthBufferOptions {
  /**
   * Optional per-mesh predicate. Returning `false` excludes the
   * mesh from the depth buffer entirely — its triangles aren't
   * rasterised and it never appears in the owner tables.
   * `buildDrawing` uses this to make transparent meshes
   * non-occluding (a window stops blocking the room behind it),
   * but the hook is general: any caller that wants to spike out
   * a subset can pass a filter.
   */
  meshFilter?: (mesh: SceneMesh, object: SceneObject) => boolean;
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
   * Optional cut-away clip planes. Each plane is `{point, normal}`
   * in world space, with `normal` unit length and pointing toward
   * the **kept** half-space. A triangle is rasterised only when
   * its centroid satisfies `dot(centroid - point, normal) >= 0`
   * for **every** plane — i.e. the kept region is the
   * intersection of all planes' kept sides. Pass an empty array
   * (or omit) to disable clipping; pass one plane to reproduce
   * the previous single-plane behaviour; pass several to mirror
   * the View's active {@link viewing!viewer.SectionPlane | SectionPlane}s.
   */
  clipPlanes?: Array<{point: ArrayLike<number>; normal: ArrayLike<number>}>;
}
