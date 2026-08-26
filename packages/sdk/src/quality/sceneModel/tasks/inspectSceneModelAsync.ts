import type {InspectSceneModelParams} from "../params/InspectSceneModelParams";
import type {Issue} from "../Issue";
import type {InspectionReport} from "../InspectionReport";
import {DEFAULT_INSPECTION_REGISTRY} from "../DEFAULT_INSPECTION_REGISTRY";
import {getInspectionIndex} from "../internal/getInspectionIndex";


/**
 * Async sibling of {@link inspectSceneModel}. Same orchestration —
 * walk every registered {@link Inspection} and concatenate issues
 * — but yields to the main thread between each inspection so the
 * UI can repaint, and honours {@link InspectSceneModelParams.signal}
 * + {@link InspectSceneModelParams.onProgress} for cancel and
 * progress UX.
 *
 * Returns the same {@link InspectionReport} shape as the
 * synchronous version. On cancel, throws an `AbortError` (a
 * `DOMException` with `name === "AbortError"`); issues collected
 * before the abort are discarded.
 *
 * Yield granularity is **per inspection** — within one
 * inspection's `run` the main thread is still blocked. Most
 * built-in inspections finish in < 100 ms even on large models;
 * the heavy ones (`duplicateGeometries`,
 * `similarGeometries`, `geometryQuality`) can
 * take longer, but progress fires before each begins so the user
 * at least knows what step is in flight.
 */
export async function inspectSceneModelAsync(
  params: InspectSceneModelParams,
): Promise<InspectionReport> {
  const sceneModel = params.sceneModel;
  const issues: Issue[] = [];

  if (!sceneModel || sceneModel.destroyed) {
    issues.push({
      severity: "error",
      code:     "SCENE_MODEL_INVALID",
      message:  "SceneModel is missing or destroyed",
    });
    return finalise(issues);
  }

  const registry = params.registry ?? DEFAULT_INSPECTION_REGISTRY;
  const inspections = registry.inspections();
  const total = inspections.length;
  const onProgress = params.onProgress;
  const signal = params.signal;
  const index = getInspectionIndex(sceneModel);

  for (let i = 0; i < total; i++) {
    throwIfAborted(signal);
    const inspection = inspections[i];
    onProgress?.({current: i, total, label: inspection.description, phase: "before", inspection});
    // Layer the registry-stored overrides under per-call params —
    // see inspectSceneModel for rationale.
    const stored = registry.getConfig(inspection);
    const merged = stored ? {...stored, ...params} as InspectSceneModelParams : params;
    const produced = inspection.run(sceneModel, merged, index);
    if (produced.length > 0) {
      for (const x of produced) issues.push(x);
    }
    onProgress?.({current: i, total, label: inspection.description, phase: "after", inspection});
    await yieldToMainThread();
  }

  // Drop the heaviest cached rows; cheap rows survive for any
  // follow-up applyFixes pass.
  index.releaseHeavyRows();

  onProgress?.({current: total, total, label: "", phase: "after"});
  return finalise(issues);
}


function finalise(issues: Issue[]): InspectionReport {
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
  return {issues, errors, warnings, info, byCode};
}


function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal) return;
  if (typeof signal.throwIfAborted === "function") {
    signal.throwIfAborted();
    return;
  }
  if (signal.aborted) {
    const reason = (signal as { reason?: unknown }).reason;
    if (reason instanceof Error) throw reason;
    throw new DOMException("Inspection aborted", "AbortError");
  }
}


/**
 * Yield to the event loop so the browser can paint / fire input
 * events between chunks. `setTimeout(0)` is throttled to ~4 ms
 * by every browser, which is exactly the cadence we want — fast
 * enough that the user perceives responsiveness, slow enough that
 * we're not paying scheduler overhead on every tick.
 */
function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
