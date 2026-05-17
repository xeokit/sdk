import type {Issue} from "./Issue";


/**
 * Result of {@link inspectSceneModel} — the full set of findings
 * across every inspection that ran. Mirrors the shape of an IDE's
 * "Problems" panel: a flat list, plus per-severity convenience
 * accessors and a per-code grouping (one issue list per code) that
 * downstream {@link applyFixes} dispatches against.
 */
export interface InspectionReport {

  /** All issues, in detection order, regardless of severity. */
  issues: Issue[];

  /** Subset with `severity: "error"`. Blocks downstream optimisation. */
  errors: Issue[];

  /** Subset with `severity: "warning"`. Advisory. */
  warnings: Issue[];

  /** Subset with `severity: "info"`. Informational. */
  info: Issue[];

  /**
   * Issues bucketed by {@link Issue.code}. Each bucket is itself a
   * list of issues that fired the same rule. Fix strategies iterate
   * one bucket at a time — typically a strategy declares the codes
   * it handles and processes every issue in those buckets.
   *
   * Iteration order matches the insertion order of the first
   * occurrence of each code, so reports read top-to-bottom in the
   * same order the inspections fired.
   */
  byCode: Map<string, Issue[]>;
}
