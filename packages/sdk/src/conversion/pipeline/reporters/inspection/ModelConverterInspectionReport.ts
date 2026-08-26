import type {
  ApplyFixesResultJson,
  InspectionReportJson,
} from "../../../../quality/sceneModel";
import type {InspectionReportJson as DataInspectionReportJson} from "../../../../quality/dataModel";

/**
 * Size record for one input or output file, surfaced from the converter
 * result. `fileDataSizeBytes` is the byte length the {@link ModelConverter}
 * measured at the I/O boundary; the reporter only reads it (it never touches
 * the filesystem).
 */
export interface ModelConverterReportFile {
  /** Path the data was read from / written to, when the conversion used one. */
  filePath?: string;
  /** Format id (loader/exporter) for this file. */
  fileFormat: string;
  /** Byte length of the file data. */
  fileDataSizeBytes: number;
}

/**
 * Per-DataModel entry in {@link ModelConverterInspectionReport}. DataModel
 * inspection is validation-only, so there is no fix/re-inspect.
 */
export interface ModelConverterDataInspectionReportEntry {
  /** DataModel id. */
  dataModel: string;
  /** Inspection report (JSON-shape). */
  report: DataInspectionReportJson;
  /** Wall-clock time for this DataModel's inspection, in ms. */
  durationMs: number;
}

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
    dataModels:  number;
    errors:      number;
    warnings:    number;
    info:        number;
    fixed:       number;
    skipped:     number;
    fixErrors:   number;
  };

  /** One entry per inspected SceneModel, keyed by SceneModel id. */
  bySceneModel: { [sceneModelId: string]: ModelConverterInspectionReportEntry };

  /** One entry per inspected DataModel, keyed by DataModel id. Present when the
   * conversion produced DataModels. */
  byDataModel?: { [dataModelId: string]: ModelConverterDataInspectionReportEntry };

  /** Input/output file sizes, surfaced from the converter result. `outputs` is
   * empty for validate-only runs (no exporter). `totalBytes` is the summed
   * `fileDataSizeBytes` on each side. */
  files: {
    inputs:  { [inputId: string]:  ModelConverterReportFile };
    outputs: { [outputId: string]: ModelConverterReportFile };
    totalInputBytes:  number;
    totalOutputBytes: number;
  };
}
