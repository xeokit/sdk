import type {Vec3} from "../../base/math/vector";

/**
 * World-space plane that {@link buildSectionCaps} treats as a cut
 * through the source {@link model!scene.SceneModel | SceneModel}.
 *
 * Convention matches {@link viewing!viewer.SectionPlane | SectionPlane}: the half-space
 * `dot(dir, p) + dist > 0` is clipped (discarded), the half-space
 * `dot(dir, p) + dist <= 0` is kept. `dir` need not be normalised;
 * the extractor normalises internally and rescales `dist` to match.
 *
 * For a `viewer!SectionPlane`, build a `CapPlane` directly from its
 * `dir` and `dist` accessors — the conventions agree.
 */
export interface CapPlane {

  /**
   * Plane normal in world space. Points into the clipped half-space.
   * Auto-normalised by the extractor.
   */
  dir: Vec3;

  /**
   * Plane constant — the signed distance from world origin to the
   * plane along `dir`, negated. Equivalent to `-dot(dir, pos)` for
   * any point `pos` on the plane.
   */
  dist: number;
}
