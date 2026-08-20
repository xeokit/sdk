/**
 * Parameters for {@link SectionPlaneCaps}.
 *
 * * Returned by {@link SectionPlaneCaps.toParams | SectionPlaneCaps.toParams}
 * * Passed to {@link SectionPlaneCaps.fromParams | SectionPlaneCaps.fromParams}
 * * Located at {@link EffectsParams.sectionPlaneCaps}
 */
export interface SectionPlaneCapsParams {
  /**
   * Whether stencil-based section-plane caps are drawn.
   *
   * Default is `false`.
   */
  enabled?: boolean;
}
