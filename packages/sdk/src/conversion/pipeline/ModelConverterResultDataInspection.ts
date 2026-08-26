import type {InspectionReport} from "../../quality/dataModel";

/**
 * Per-DataModel inspection record stored on
 * {@link ModelConverterResult.inspection.byDataModel}.
 *
 * DataModel inspection is validation-only (no fixes by SDK policy), so unlike
 * {@link ModelConverterResultInspection} there is no `fixResult`/`reReport`.
 */
export interface ModelConverterResultDataInspection {

  /** DataModel id (mirrors the map key). */
  dataModel: string;

  /** Inspection report for the DataModel. */
  report: InspectionReport;

  /** Wall-clock time for this DataModel's inspection, in ms. */
  durationMs: number;
}
