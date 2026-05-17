import type {Inspection} from "./Inspection";
import type {Issue} from "./Issue";


/** Result of {@link inspectDataModel}. */
export interface InspectionReport {

  issues: Issue[];

  errors:   Issue[];
  warnings: Issue[];
  info:     Issue[];

  /** Issues bucketed by {@link Issue.code}. Iteration order matches
   *  the insertion order of the first issue per code. */
  byCode: Map<string, Issue[]>;

  /**
   * Inspections that actually fired during this run, in execution order.
   */
  inspectionsRun: readonly Inspection[];
}
