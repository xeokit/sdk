import type {InspectDataModelParams} from "./params/InspectDataModelParams";
import type {Inspection} from "./Inspection";
import type {Issue} from "./Issue";
import type {InspectionReport} from "./InspectionReport";
import {DEFAULT_INSPECTION_REGISTRY} from "./DEFAULT_INSPECTION_REGISTRY";


/**
 * Validate a {@link model!data.DataModel | DataModel} against optional schema rules.
 *
 * Walks every {@link Inspection} in the configured
 * {@link InspectionRegistry}, returns an {@link InspectionReport}
 * bucketed by severity and by code. **Never mutates the
 * DataModel.** No auto-fix counterpart — SDK policy is to surface
 * defects rather than rewrite user data.
 *
 * Inspections that need a schema no-op silently when one isn't
 * supplied; the always-on structural checks still fire. Opt-in
 * inspections gate themselves against their `check…` flag.
 *
 * ```ts
 * import {inspectDataModel} from "@xeokit/sdk/inspect/dataModel";
 *
 * const report = inspectDataModel({dataModel, schema});
 * if (report.errors.length > 0) { ... }
 * ```
 */
export function inspectDataModel(
  params: InspectDataModelParams,
): InspectionReport {

  const dataModel = params.dataModel;
  const issues: Issue[] = [];

  if (!dataModel || dataModel.destroyed) {
    issues.push({
      severity: "error",
      code:     "DATA_MODEL_INVALID",
      message:  "DataModel is missing or destroyed",
    });
    return finalise(issues, []);
  }

  const registry = params.registry ?? DEFAULT_INSPECTION_REGISTRY;
  const expectedSchema = params.schema?.id ?? dataModel.schema;
  const inspectionsRun: Inspection[] = [];
  for (const inspection of registry.inspections()) {
    if (!schemaApplies(inspection.schemas, expectedSchema)) continue;
    inspectionsRun.push(inspection);
    const produced = inspection.run(dataModel, params);
    for (const i of produced) issues.push(i);
  }
  return finalise(issues, inspectionsRun);
}

/**
 * `true` when the inspection's schema constraint is satisfied —
 * either it has none, or `expected` is in the list. An undefined
 * `expected` (no schema id known) blocks schema-tied inspections.
 */
function schemaApplies(
  schemas:  readonly string[] | undefined,
  expected: string | undefined,
): boolean {
  if (!schemas || schemas.length === 0) return true;
  if (!expected) return false;
  return schemas.indexOf(expected) !== -1;
}


function finalise(issues: Issue[], inspectionsRun: readonly Inspection[]): InspectionReport {
  const errors:   Issue[] = [];
  const warnings: Issue[] = [];
  const info:     Issue[] = [];
  const byCode = new Map<string, Issue[]>();
  for (const i of issues) {
    if (i.severity === "error")        errors.push(i);
    else if (i.severity === "warning") warnings.push(i);
    else                                info.push(i);
    const bucket = byCode.get(i.code);
    if (bucket) bucket.push(i);
    else byCode.set(i.code, [i]);
  }
  return {issues, errors, warnings, info, byCode, inspectionsRun};
}
