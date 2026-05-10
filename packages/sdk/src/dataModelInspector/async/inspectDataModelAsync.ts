import type {InspectDataModelParams} from "../params/InspectDataModelParams";
import type {Inspection} from "../Inspection";
import type {Issue} from "../Issue";
import type {InspectionReport} from "../InspectionReport";
import type {InspectProgress} from "../params/InspectProgress";
import {DEFAULT_INSPECTION_REGISTRY} from "../DEFAULT_INSPECTION_REGISTRY";
import {yieldToHost} from "../../utils";


/**
 * Async variant of {@link inspectDataModel}. Yields between
 * inspections and honours `params.signal` / `params.onProgress`.
 * Throws an `AbortError` (`DOMException` with
 * `name === "AbortError"`) when `signal.aborted` becomes true.
 */
export async function inspectDataModelAsync(
  params: InspectDataModelParams,
): Promise<InspectionReport> {

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
  // Pre-filter so progress totals reflect what'll actually run, and
  // so the resulting `inspectionsRun` mirrors the actual loop.
  const inspections: Inspection[] = registry.inspections().filter(
    (insp) => schemaApplies(insp.schemas, expectedSchema),
  );
  const total = inspections.length;
  const onProgress = params.onProgress;
  const signal = params.signal;

  // Reusable progress payload — consumers must copy out fields they
  // retain.
  const progress: InspectProgress = {
    current: 0,
    total,
    label: "",
    phase: "before",
  };

  for (let i = 0; i < total; i++) {
    if (signal?.aborted) throwAborted();

    const inspection = inspections[i];
    if (onProgress) {
      progress.current    = i;
      progress.label      = inspection.description;
      progress.phase      = "before";
      progress.inspection = inspection;
      onProgress(progress);
    }
    await yieldToHost(signal);

    const produced = inspection.run(dataModel, params);
    for (const issue of produced) issues.push(issue);

    if (onProgress) {
      progress.phase = "after";
      onProgress(progress);
    }
  }

  if (onProgress) {
    progress.current    = total;
    progress.label      = "";
    progress.phase      = "after";
    progress.inspection = undefined;
    onProgress(progress);
  }

  return finalise(issues, inspections);
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

function schemaApplies(
  schemas:  readonly string[] | undefined,
  expected: string | undefined,
): boolean {
  if (!schemas || schemas.length === 0) return true;
  if (!expected) return false;
  return schemas.indexOf(expected) !== -1;
}

function throwAborted(): never {
  // Prefer DOMException so callers checking err.name === "AbortError"
  // match. Fall back to plain Error in Node test envs without one.
  if (typeof DOMException !== "undefined") {
    throw new DOMException("Inspection aborted", "AbortError");
  }
  const err = new Error("Inspection aborted");
  err.name = "AbortError";
  throw err;
}
