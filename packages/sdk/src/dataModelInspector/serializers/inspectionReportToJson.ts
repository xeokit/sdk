import type {InspectionReport} from "../InspectionReport";
import type {Issue} from "../Issue";
import type {IssueSeverity} from "../params/IssueSeverity";
import type {InspectionRegistry} from "../InspectionRegistry";
import {DEFAULT_INSPECTION_REGISTRY} from "../DEFAULT_INSPECTION_REGISTRY";
import {labelForCode} from "../labels/labelForCode";


export interface IssueJson {
  severity:   IssueSeverity;
  code:       string;
  message:    string;
  summary?:   string;
  resourceId?: string;
  context?:   Record<string, unknown>;
}

export interface CodeAggregateJson {
  code:     string;
  /** Human-readable label resolved from the inspection registry. */
  label:    string;
  count:    number;
  severity: IssueSeverity;
}

export interface InspectionRunJson {
  /** Inspection's `description`. */
  description: string;
  /** The codes the inspection can emit. */
  codes:       string[];
  /** Schema-id whitelist, if any. */
  schemas?:    string[];
  /** `true` for opt-in inspections. */
  optIn?:      boolean;
  /** Param key the user toggles to enable an opt-in inspection. */
  paramsKey?:  string;
}

export interface InspectionReportJson {

  generatedAt: string;

  counts: {
    error:   number;
    warning: number;
    info:    number;
    total:   number;
  };

  /** Inspections that fired, in execution order. */
  inspectionsRun: InspectionRunJson[];

  /** One row per code, sorted by count descending. */
  byCode: CodeAggregateJson[];

  /** Every issue, in detection order. */
  issues: IssueJson[];
}

export interface InspectionReportToJsonParams {
  /** Defaults to {@link DEFAULT_INSPECTION_REGISTRY}. */
  registry?: InspectionRegistry;
}


/** Serialise an {@link InspectionReport} for log / file / API
 *  output. `byCode` sorts loudest codes first; `issues` preserves
 *  detection order. */
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
    });
  }
  byCode.sort((a, b) => b.count - a.count);

  const inspectionsRun: InspectionRunJson[] = report.inspectionsRun.map((insp) => {
    const out: InspectionRunJson = {
      description: insp.description,
      codes:       [...insp.codes],
    };
    if (insp.schemas)   out.schemas   = [...insp.schemas];
    if (insp.optIn)     out.optIn     = true;
    if (insp.paramsKey) out.paramsKey = insp.paramsKey;
    return out;
  });

  return {
    generatedAt: new Date().toISOString(),
    counts,
    inspectionsRun,
    byCode,
    issues: report.issues.map(issueToJson),
  };
}


/** Convert one {@link Issue} to a JSON-ready object. Optional
 *  fields are elided when absent. */
export function issueToJson(issue: Issue): IssueJson {
  const out: IssueJson = {
    severity: issue.severity,
    code:     issue.code,
    message:  issue.message,
  };
  if (issue.summary    !== undefined) out.summary    = issue.summary;
  if (issue.resourceId !== undefined) out.resourceId = issue.resourceId;
  if (issue.context    !== undefined) out.context    = issue.context;
  return out;
}
