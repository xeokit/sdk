import type {SDKResult} from "../core";
import type {ApplyFixesParams} from "./ApplyFixesParams";
import type {ApplyFixesResult, ApplyFixesIssueOutcome} from "./ApplyFixesResult";
import {DEFAULT_FIX_REGISTRY} from "./DEFAULT_FIX_REGISTRY";
import {getInspectionIndex} from "./getInspectionIndex";
import type {Issue} from "./Issue";
import type {SceneModelInspectionIndex} from "./SceneModelInspectionIndex";


const YIELD_EVERY = 8;


/**
 * Async sibling of {@link applyFixes}. Same dispatch semantics —
 * one strategy per matching issue, outcomes bucketed into
 * `fixed` / `skipped` / `errors` — but yields to the main thread
 * every {@link YIELD_EVERY} issues so the UI can repaint, and
 * honours {@link ApplyFixesParams.signal} + `onProgress` for
 * cancel + progress UX.
 *
 * On cancel, throws an `AbortError` (a `DOMException` with
 * `name === "AbortError"`). The SceneModel keeps any mutations
 * that landed before the abort, so a re-inspect after
 * cancellation reflects post-abort state truthfully. Outcomes
 * collected before the abort are discarded — the caller gets
 * either a complete result or an exception, not a partial result.
 *
 * Yield granularity is per-batch, not per-issue, because some
 * fixes (e.g. {@link splitDenseGeometry}) take milliseconds
 * each and yielding between every one would be unnecessary
 * scheduling overhead. Eight issues / yield strikes a reasonable
 * balance.
 */
export async function applyFixesAsync(
  params: ApplyFixesParams,
): Promise<SDKResult<ApplyFixesResult>> {
  const {sceneModel, report} = params;
  const registry = params.registry ?? DEFAULT_FIX_REGISTRY;
  const codeFilter = params.codes ? new Set(params.codes) : null;
  const onProgress = params.onProgress;
  const signal = params.signal;
  const index = getInspectionIndex(sceneModel);

  const fixed:   ApplyFixesIssueOutcome[] = [];
  const skipped: ApplyFixesIssueOutcome[] = [];
  const errors:  ApplyFixesIssueOutcome[] = [];

  const issues = report.issues;
  const total = issues.length;

  for (let i = 0; i < total; i++) {
    if ((i % YIELD_EVERY) === 0) {
      throwIfAborted(signal);
      if (i > 0) await yieldToMainThread();
    }

    const issue = issues[i];
    onProgress?.({current: i, total, label: issue.code, phase: "before", issue});

    if (codeFilter && !codeFilter.has(issue.code)) {
      skipped.push({issue, reason: "filter-excluded"});
      onProgress?.({current: i, total, label: issue.code, phase: "after", issue});
      continue;
    }
    const strategy = registry.get(issue.code);
    if (!strategy) {
      skipped.push({issue, reason: "no-strategy"});
      onProgress?.({current: i, total, label: issue.code, phase: "after", issue});
      continue;
    }
    const result = strategy.apply(issue, sceneModel);
    if (result.ok === false) {
      errors.push({issue, strategy: strategy.description, error: result.error});
    } else {
      const value = result.value;
      if (value.fixed === true) {
        fixed.push({issue, strategy: strategy.description, trace: value.trace});
        invalidateForIssue(index, issue);
      } else {
        skipped.push({
          issue,
          strategy: strategy.description,
          reason: value.reason,
          ...(value.trace !== undefined ? {trace: value.trace} : {}),
        });
      }
    }
    onProgress?.({current: i, total, label: issue.code, phase: "after", issue});
  }

  onProgress?.({current: total, total, label: "", phase: "after"});
  return {ok: true, value: {fixed, skipped, errors}};
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
    throw new DOMException("applyFixes aborted", "AbortError");
  }
}


function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}


/**
 * Drop index rows touched by a successful fix. Mirror of the
 * helper in {@link applyFixes} — kept inline rather than shared
 * to avoid a new public utility module just for this.
 */
function invalidateForIssue(
  index: SceneModelInspectionIndex,
  issue: Issue,
): void {
  if (issue.resourceId) {
    index.invalidateGeometry(issue.resourceId);
    index.invalidateObject(issue.resourceId);
  }
  const ctx = issue.context;
  if (ctx) {
    for (const key of GEOM_ID_LIST_KEYS) {
      const arr = ctx[key];
      if (Array.isArray(arr)) {
        for (const id of arr) {
          if (typeof id === "string") index.invalidateGeometry(id);
        }
      }
    }
  }
  if (issue.highlight) {
    for (const objId of issue.highlight.objectIds) {
      index.invalidateObject(objId);
    }
  }
  index.invalidateReferences();
}

const GEOM_ID_LIST_KEYS = ["duplicates", "similar"];
