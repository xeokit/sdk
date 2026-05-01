import type {ApplyFixesResult, ApplyFixesIssueOutcome} from "./ApplyFixesResult";
import type {FixSkipReason} from "./FixSkipReason";
import {issueToJson, type IssueJson} from "./inspectionReportToJson";


/**
 * One outcome record (fixed / skipped / errored) in JSON-ready
 * shape. Matches {@link ApplyFixesIssueOutcome} field-for-field
 * with optional fields elided when absent.
 */
export interface ApplyFixesIssueOutcomeJson {
  issue:     IssueJson;
  strategy?: string;
  trace?:    string;
  error?:    string;
  reason?:   FixSkipReason;
}


/**
 * JSON-ready snapshot of an {@link ApplyFixesResult}.
 */
export interface ApplyFixesResultJson {

  /** ISO-8601 UTC timestamp when the JSON was produced. */
  generatedAt: string;

  /** Bucket counts plus the grand total. */
  counts: {
    fixed:   number;
    skipped: number;
    errors:  number;
    total:   number;
  };

  fixed:   ApplyFixesIssueOutcomeJson[];
  skipped: ApplyFixesIssueOutcomeJson[];
  errors:  ApplyFixesIssueOutcomeJson[];
}


/**
 * Convert an {@link ApplyFixesResult} to a plain JSON-serializable
 * object — bucket counts, plus each outcome with its strategy
 * label, fix-emitted trace string, and the originating issue.
 *
 * Sample output:
 *
 * ```json
 * {
 *   "generatedAt": "2026-04-30T12:35:01.123Z",
 *   "counts": {"fixed": 8, "skipped": 0, "errors": 0, "total": 8},
 *   "fixed": [
 *     {
 *       "issue":    {"severity": "warning", "code": "GEOMETRY_DUPLICATE", ...},
 *       "strategy": "Coalesce duplicate geometries",
 *       "trace":    "'geom-47' kept; merged 4 meshes, destroyed: geom-3, geom-12, geom-89"
 *     }
 *   ],
 *   "skipped": [],
 *   "errors":  []
 * }
 * ```
 */
export function applyFixesResultToJson(
  result: ApplyFixesResult,
): ApplyFixesResultJson {
  return {
    generatedAt: new Date().toISOString(),
    counts: {
      fixed:   result.fixed.length,
      skipped: result.skipped.length,
      errors:  result.errors.length,
      total:   result.fixed.length + result.skipped.length + result.errors.length,
    },
    fixed:   result.fixed.map(outcomeToJson),
    skipped: result.skipped.map(outcomeToJson),
    errors:  result.errors.map(outcomeToJson),
  };
}


/**
 * Convert one {@link ApplyFixesIssueOutcome} to a JSON-ready
 * object. Optional fields elided when absent.
 */
export function outcomeToJson(o: ApplyFixesIssueOutcome): ApplyFixesIssueOutcomeJson {
  const out: ApplyFixesIssueOutcomeJson = {issue: issueToJson(o.issue)};
  if (o.strategy !== undefined) out.strategy = o.strategy;
  if (o.trace    !== undefined) out.trace    = o.trace;
  if (o.error    !== undefined) out.error    = o.error;
  if (o.reason   !== undefined) out.reason   = o.reason;
  return out;
}
