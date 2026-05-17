import {type Vec3} from "../../base/math/vector";

/**
 * Parameters for a {@link SectionPlane}.
 *
 * * Returned by {@link SectionPlane.toParams | SectionPlane.toParams}
 * * Passed to {@link SectionPlane.fromParams | SectionPlane.fromParams} and {@link View.createSectionPlane | View.createSectionPlane}
 * * Located at {@link ViewParams.sectionPlanes | ViewParams.sectionPlanes}
 */
export interface SectionPlaneParams {

  /**
   * The unique ID of the {@link SectionPlane}.
   */
  id?: string;

  /**
   * The World-space 3D position of the {@link SectionPlane}.
   *
   * Default value is ````[0, 0, 0]````.
   */
  pos?: Vec3;

  /**
   * 3D direction of the {@link SectionPlane}.
   *
   * Range is `[-1..1, -1..1, -1..1]`.
   *
   * Default value is `[0.0, 0.0, -1.0]`.
   */
  dir?: Vec3;

  /**
   * Whether the {@link SectionPlane} is active or not.
   *
   * Default value is ````true````.
   */
  active?: boolean;

  /**
   * Optional RGB colour to use as a "cap fill" on the
   * cross-section surface. Each channel in `[0, 1]`. When
   * unset (the default), the plane behaves as a pure clipping
   * plane — back-faces in the clipped half-space are discarded
   * along with front-faces and the cut-away is empty.
   *
   * When set, back-facing fragments in the clipped region
   * survive and are recoloured with this value, producing a
   * visible "fill" on the cut surface. The material's hatch
   * pattern (if any) still applies, so masonry / steel / etc.
   * cross-sections retain their conventional fill.
   */
  capColor?: Vec3;
}
