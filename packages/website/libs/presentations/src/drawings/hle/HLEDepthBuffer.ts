import type {ProjectionBasis} from "../ProjectionBasis";

/**
 * Frontmost-triangle depth buffer used by the projection
 * pipeline for hidden-line elimination and (optionally) for
 * driving per-pixel ownership during fill extraction.
 *
 * Owner tracking is at *source-mesh* granularity so downstream
 * code that emits projected geometry can partition output to
 * mirror the source SceneModel's hierarchy one-to-one. Two
 * parallel index tables map the integer owner back to source
 * identifiers:
 *
 * - {@link HLEDepthBuffer.ownerMeshIds | ownerMeshIds}`[i]`   — source SceneMesh id.
 * - {@link HLEDepthBuffer.ownerObjectIds | ownerObjectIds}`[i]` — id of the SceneObject the mesh belongs to.
 *
 * Cells the rasteriser never touched are `-1`. All three
 * owner-related fields are `null` when owner tracking was
 * disabled.
 */
export interface HLEDepthBuffer {
  width: number;
  height: number;
  /** `width × height` Float32 depth values. */
  data: Float32Array;
  /** Basis-space u extent (right-axis projection of the AABB). */
  uMin: number; uMax: number;
  /** Basis-space v extent (up-axis projection of the AABB). */
  vMin: number; vMax: number;
  /** Projection basis used to build the buffer. */
  basis: ProjectionBasis;
  /**
   * Optional per-pixel owner index, parallel to {@link data}.
   * `-1` means the pixel was never touched by any triangle.
   * Present only when the buffer was built with `withOwners`.
   */
  owners: Int32Array | null;
  /**
   * Owner index → source SceneMesh id. Same length as the
   * number of source SceneMeshes that contributed at least one
   * triangle to the rasteriser.
   */
  ownerMeshIds: string[] | null;
  /**
   * Owner index → id of the source SceneObject the mesh at
   * that index belongs to. Same length as `ownerMeshIds`. Lets
   * the fill extractor partition by SceneObject while keeping
   * per-mesh fidelity inside each object.
   */
  ownerObjectIds: string[] | null;
}
