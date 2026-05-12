import type {
  ApplyFixesResultJson,
  InspectionReportJson,
} from "../../../sceneModelInspector";

/**
 * Per-SceneModel entry in {@link ModelConverterInspectionReport}.
 * One entry per inspected SceneModel, JSON-serialised via
 * {@link inspectionReportToJson} / {@link applyFixesResultToJson}
 * so the whole report is `JSON.stringify`-safe.
 */
export interface ModelConverterInspectionReportEntry {

  /** SceneModel id. */
  sceneModel: string;

  /** Pre-fix inspection report (JSON-shape). */
  report: InspectionReportJson;

  /** Result of `applyFixes`. Only present when `inspect.fix` was
   * `true` *and* the pre-fix report had no errors. */
  fixResult?: ApplyFixesResultJson;

  /** Post-fix inspection. Present iff a fix ran and `reInspect`
   * wasn't disabled. */
  reReport?: InspectionReportJson;

  /** Wall-clock time for this SceneModel's inspect (+fix +reinspect)
   * pass, in ms. */
  durationMs: number;
}

/**
 * JSON-ready report produced by {@link createInspectionReport}.
 * Top-level shape mirrors the other reporters
 * ({@link ModelConverterStatsReport},
 * {@link ModelConverterManifestReport}) so the CLI's
 * `--<reporterId> <file>` flag pattern keeps working without
 * special-casing.
 */
export interface ModelConverterInspectionReport {

  description: string;

  /** ISO timestamp when the report was generated. */
  generatedAt: string;

  /** Pipeline id from the converter result. */
  pipeline: string;

  /** Aggregate counts across every inspected SceneModel — handy
   * for at-a-glance "did this conversion produce a clean model?"
   * in CI logs. */
  counts: {
    sceneModels: number;
    errors:      number;
    warnings:    number;
    info:        number;
    fixed:       number;
    skipped:     number;
    fixErrors:   number;
  };

  /** One entry per inspected SceneModel, keyed by SceneModel id. */
  bySceneModel: { [sceneModelId: string]: ModelConverterInspectionReportEntry };
}
