import type {InspectionReport} from "../InspectionReport";
import type {InspectionRegistry} from "../InspectionRegistry";
import type {Issue} from "../Issue";
import type {IssueSeverity} from "../params/IssueSeverity";
import type {IssueHighlight} from "../params/IssueHighlight";
import {DEFAULT_INSPECTION_REGISTRY} from "../DEFAULT_INSPECTION_REGISTRY";
import {labelForCode} from "../labels/labelForCode";


/**
 * One issue, in JSON-ready shape. Same fields as
 * {@link Issue}, just with the optional fields elided when absent
 * so the serialized output stays compact.
 */
export interface IssueJson {
  severity:    IssueSeverity;
  code:        string;
  message:     string;
  summary?:    string;
  resourceId?: string;
  context?:    Record<string, unknown>;
  highlight?:  IssueHighlight;
}


/**
 * Per-code aggregation in {@link InspectionReportJson.byCode}.
 */
export interface CodeAggregateJson {
  count: number;
  /** Friendly label from {@link labelForCode}. Equal to `code` when no label is registered. */
  label: string;
  /** Severity all issues with this code share (codes don't mix severities). */
  severity: IssueSeverity;
}


/**
 * JSON-ready snapshot of an {@link InspectionReport}.
 */
export interface InspectionReportJson {

  /** ISO-8601 UTC timestamp when the JSON was produced. */
  generatedAt: string;

  /** Total counts by severity, plus the grand total. */
  counts: {
    error:   number;
    warning: number;
    info:    number;
    total:   number;
  };

  /**
   * Per-code aggregation. Codes ordered by descending count, with
   * the friendly label embedded so consumers (CI dashboards, BCF
   * exports) don't need their own label table.
   */
  byCode: CodeAggregateJson[];

  /** Every issue, in report order. */
  issues: IssueJson[];
}


/**
 * Optional knobs for {@link inspectionReportToJson}.
 */
export interface InspectionReportToJsonParams {
  /**
   * Registry to consult for friendly labels. Defaults to
   * {@link DEFAULT_INSPECTION_REGISTRY}; pass a custom registry
   * when you've registered plugin inspections that ship their
   * own labels.
   */
  registry?: InspectionRegistry;
}


/**
 * Convert an {@link InspectionReport} to a plain JSON-serializable
 * object — counts, per-code aggregation (with friendly labels),
 * and every issue. Suitable for `JSON.stringify` straight out of
 * the box.
 *
 * Sample output:
 *
 * ```json
 * {
 *   "generatedAt": "2026-04-30T12:34:56.789Z",
 *   "counts": {"error": 0, "warning": 12, "info": 0, "total": 12},
 *   "byCode": [
 *     {"code": "GEOMETRY_DUPLICATE", "label": "Duplicate geometry", "count": 8, "severity": "warning"},
 *     ...
 *   ],
 *   "issues": [
 *     {"severity": "warning", "code": "GEOMETRY_DUPLICATE", "message": "...", "summary": "...", ...},
 *     ...
 *   ]
 * }
 * ```
 */
export function inspectionReportToJson(
  report: InspectionReport,
  params: InspectionReportToJsonParams = {},
): InspectionReportJson {
  const registry = params.registry ?? DEFAULT_INSPECTION_REGISTRY;

  const counts = {
    error:   report.errors.length,
    warning: report.warnings.length,
    info:    report.info.length,
    total:   report.issues.length,
  };

  const byCode: CodeAggregateJson[] = [];
  for (const [code, issues] of report.byCode) {
    byCode.push({
      code,
      label:    labelForCode(code, registry),
      count:    issues.length,
      severity: issues[0].severity,
    } as CodeAggregateJson & {code: string});
  }
  byCode.sort((a, b) => b.count - a.count);

  return {
    generatedAt: new Date().toISOString(),
    counts,
    byCode,
    issues: report.issues.map(issueToJson),
  };
}


/**
 * Convert one {@link Issue} to a JSON-ready object. Optional
 * fields (`summary` / `resourceId` / `context` / `highlight`) are
 * elided when absent so the serialized output stays compact.
 */
export function issueToJson(issue: Issue): IssueJson {
  const out: IssueJson = {
    severity: issue.severity,
    code:     issue.code,
    message:  issue.message,
  };
  if (issue.summary    !== undefined) out.summary    = issue.summary;
  if (issue.resourceId !== undefined) out.resourceId = issue.resourceId;
  if (issue.context    !== undefined) out.context    = issue.context;
  if (issue.highlight  !== undefined) out.highlight  = issue.highlight;
  return out;
}
