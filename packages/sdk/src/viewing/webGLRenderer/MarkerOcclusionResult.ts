import type {Vec2, Vec3} from "../../base/math/vector";
import type {MarkerOcclusionMarker, MarkerOcclusionMode} from "./MarkerOcclusionTesterParams";

/**
 * Visibility result for a marker after one occlusion update.
 */
export interface MarkerOcclusionResult {
  /** Stable ID from {@link MarkerOcclusionMarker.id}. */
  markerId: string;

  /** Marker input that produced this result. */
  marker: MarkerOcclusionMarker;

  /** Backend used for this result. */
  mode: Exclude<MarkerOcclusionMode, "auto">;

  /** `true` when the marker should be shown after frustum and hysteresis rules. */
  visible: boolean;

  /** Raw occlusion result for this update before hysteresis is applied. */
  occluded: boolean;

  /** `true` when the marker projects inside the view frustum. */
  inFrustum: boolean;

  /** Canvas-space marker position in CSS pixels, or `null` when not projectable. */
  canvasPos: Vec2 | null;

  /** World-space ray origin used by the occlusion test, or `null` when skipped. */
  rayOrigin: Vec3 | null;

  /** World-space ray direction used by the occlusion test, or `null` when skipped. */
  rayDir: Vec3 | null;

  /** Distance from ray origin to marker along {@link rayDir}, or `null` when skipped. */
  distanceToMarker: number | null;

  /** Object ID of the occluder, if any. */
  occluderObjectId: string | null;

  /** Mesh ID of the occluder, if any. */
  occluderMeshId: string | null;
}
