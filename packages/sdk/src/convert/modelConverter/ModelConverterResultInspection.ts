import type {ApplyFixesResult, InspectionReport} from "../../inspect/sceneModel";

/** Per-SceneModel inspection record stored on `ModelConverterResult.inspection.bySceneModel`. */
export interface ModelConverterResultInspection {

  /** SceneModel id (mirrors the map key — convenient when iterating
   * the entries detached from their parent map). */
  sceneModel: string;

  /** Inspection report from the pre-fix walk. Always present when
   * the inspect step ran. */
  report: InspectionReport;

  /** Result of `applyFixes`. Only present when
   * {@link ModelConverterInspectConfig.fix} was `true` *and* the
   * pre-fix report had no errors. */
  fixResult?: ApplyFixesResult;

  /** Post-fix inspection. Present iff a fix ran and `reInspect`
   * wasn't disabled. */
  reReport?: InspectionReport;

  /** Wall-clock time for the whole inspect (+fix +reinspect) pass
   * for this SceneModel, in ms. */
  durationMs: number;
}
