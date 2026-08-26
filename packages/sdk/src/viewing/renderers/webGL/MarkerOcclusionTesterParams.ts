import type {Vec3} from "../../../base/math/vector";

/**
 * CPU/GPU backend selection for marker occlusion testing.
 *
 * `auto` currently resolves to the BVH backend. A GPU depth backend can be
 * added behind the same public tester surface without changing callers.
 */
export type MarkerOcclusionMode = "auto" | "bvh";

/**
 * Marker whose projected screen-space visibility should be tested.
 */
export interface MarkerOcclusionMarker {
  /** Stable marker identifier used to report visibility state. */
  id: string;

  /** Marker anchor position in world coordinates. */
  worldPos: Vec3;

  /**
   * Object IDs that should not occlude this marker. Useful when the marker is
   * pinned to a known object and small depth differences would otherwise count
   * the host surface as an occluder.
   */
  excludeObjectIds?: readonly string[];

  /**
   * Marker-local occluder filter. Return `false` to ignore an object before
   * triangle tests continue.
   */
  occluderFilter?: (objectId: string) => boolean;
}

/**
 * Options for {@link MarkerOcclusionTester}.
 */
export interface MarkerOcclusionTesterParams {
  /**
   * Occlusion backend. Defaults to `auto`, which currently uses the BVH path.
   */
  mode?: MarkerOcclusionMode;

  /**
   * Distance, in world units along the view ray, subtracted from the marker
   * distance when testing for nearer occluders. Prevents surface-pinned
   * markers from hiding behind their own surface because of tiny numeric
   * differences. Defaults to `0.01`.
   */
  depthBias?: number;

  /**
   * Visible objects whose view opacity override is below one still count as
   * occluders when this is `true`. Defaults to `false`.
   */
  includeTransparent?: boolean;

  /**
   * X-rayed objects still count as occluders when this is `true`.
   * Defaults to `false`.
   */
  includeXRayed?: boolean;

  /**
   * Respect active SectionPlanes by continuing past clipped ray hits.
   * Defaults to `true`.
   */
  respectSectionPlanes?: boolean;

  /**
   * Object IDs that never occlude any marker in this tester.
   */
  excludeObjectIds?: readonly string[];

  /**
   * Global occluder filter. Return `false` to ignore an object before triangle
   * tests continue.
   */
  occluderFilter?: (objectId: string, marker: MarkerOcclusionMarker) => boolean;

  /**
   * Number of consecutive occluded frames required before a currently-visible
   * marker becomes hidden. Defaults to `2`.
   */
  hideDelayFrames?: number;

  /**
   * Number of consecutive unoccluded frames required before a currently-hidden
   * marker becomes visible. Defaults to `1`.
   */
  showDelayFrames?: number;

  /**
   * Maximum clipped hits to skip while looking for a real occluder. Defaults
   * to `32`.
   */
  maxRaycastSteps?: number;
}
