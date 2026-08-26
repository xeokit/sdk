import type {Vec3} from "@xeokit/sdk/base/math/vector";

/**
 * Arbitrary projection ray. `forward` is the camera-look
 * direction (camera→scene) — the projection happens *along*
 * this vector and the image plane is perpendicular to it.
 * `up` defines which world direction reads as "up" on the
 * image; if omitted, the Scene's world up axis is used. Both
 * vectors are auto-normalised and `up` is orthogonalised
 * against `forward`, so the caller doesn't have to feed in a
 * strictly orthonormal pair.
 *
 * The basis derived from this ray is `{right = normalize(forward × up),
 * up = normalize(up_perp), forward}`. A `forward` collinear
 * with `up` falls back to picking an arbitrary perpendicular
 * so projection still resolves rather than failing.
 */
export interface DrawingProjectionRay {
  forward: Vec3;
  up?: Vec3;
}
