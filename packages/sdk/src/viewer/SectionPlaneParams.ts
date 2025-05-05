import type { FloatArrayParam } from "../math";

/**
 * Parameters for a {@link SectionPlane}.
 *
 * * Returned by {@link SectionPlane.toParams | SectionPlane.toParams}
 * * Passed to {@link SectionPlane.fromParams | SectionPlane.fromParams} and {@link View.createSectionPlane | View.createSectionPlane}
 * * Located at {@link ViewParams.sectionPlanes | ViewParams.sectionPlanes}
 */
export interface SectionPlaneParams {
  id?: string;

  /**
     * The World-space 3D position of the {@link SectionPlane}.
     *
     * Default value is ````[0, 0, 0]````.
     */
  pos?: FloatArrayParam;

  /**
     * 3D direction of the {@link SectionPlane}.
     *
     * Range is `[-1..1, -1..1, -1..1]`.
     *
     * Default value is `[0.0, 0.0, -1.0]`.
     */
  dir?: FloatArrayParam;

  /**
     * Whether the {@link SectionPlane} is active or not.
     *
     * Default value is ````true````.
     */
  active?: boolean;
}
