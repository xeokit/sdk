import type {SDKResult} from "../core";
import type {ApplyFixesParams} from "./ApplyFixesParams";
import type {ApplyFixesResult, ApplyFixesIssueOutcome} from "./ApplyFixesResult";
import {DEFAULT_FIX_REGISTRY} from "./DEFAULT_FIX_REGISTRY";
import {getInspectionIndex} from "./getInspectionIndex";
import type {Issue} from "./Issue";
import type {SceneModelInspectionIndex} from "./SceneModelInspectionIndex";


/**
 * Walk every issue in an {@link InspectionReport} and dispatch each
 * to the {@link Fix} registered under the issue's code in a
 * {@link FixRegistry} — IDE "fix all problems" semantics
 * with one pass, one strategy per matching issue, and a structured
 * outcome list.
 *
 * Resolution per issue (every `skipped` entry carries a
 * {@link FixSkipReason}):
 *
 *   1. If `params.codes` is set and doesn't include the issue's
 *      code → skipped, `reason: "filter-excluded"` (no strategy
 *      considered).
 *   2. Otherwise the strategy registered under the issue's code in
 *      `params.registry` (default
 *      {@link DEFAULT_FIX_REGISTRY}) is invoked.
 *   3. Strategy returns `{fixed: true}` → issue lands in `fixed`.
 *   4. Strategy returns `{fixed: false, reason}` → issue lands in
 *      `skipped` with that reason (the strategy declined; not an
 *      error).
 *   5. Strategy returns `{ok: false}` → issue lands in `errors`
 *      with the strategy's error message attached.
 *   6. No strategy registered for the code → issue lands in
 *      `skipped`, `reason: "no-strategy"`.
 *
 * The function does not re-inspect afterwards. Callers that want a
 * clean post-fix report should call {@link inspectSceneModel} again
 * — the typical pipeline is `inspect → applyFixes → inspect again`.
 */
export function applyFixes(params: ApplyFixesParams): SDKResult<ApplyFixesResult> {
  const {sceneModel, report} = params;
  const registry = params.registry ?? DEFAULT_FIX_REGISTRY;
  const codeFilter = params.codes ? new Set(params.codes) : null;
  const index = getInspectionIndex(sceneModel);

  const fixed:    ApplyFixesIssueOutcome[] = [];
  const skipped:  ApplyFixesIssueOutcome[] = [];
  const errors:   ApplyFixesIssueOutcome[] = [];

  for (const issue of report.issues) {
    if (codeFilter && !codeFilter.has(issue.code)) {
      skipped.push({issue, reason: "filter-excluded"});
      continue;
    }
    const strategy = registry.get(issue.code);
    if (!strategy) {
      skipped.push({issue, reason: "no-strategy"});
      continue;
    }
    const result = strategy.apply(issue, sceneModel);
    if (result.ok === false) {
      errors.push({issue, strategy: strategy.description, error: result.error});
      continue;
    }
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

  return {ok: true, value: {fixed, skipped, errors}};
}


/**
 * Drop index rows touched by a successful fix. Coarse but safe:
 *
 *   - The issue's `resourceId` (canonical / target) row is cleared.
 *   - Any geometry-id list in `issue.context` (`duplicates`,
 *     `similar`, …) is cleared. Picks up the cluster fixes.
 *   - The per-scene reverse-reference tables are cleared
 *     unconditionally — drop / re-parent / repoint fixes all
 *     mutate them and they're cheap to rebuild.
 *   - Owning SceneObject rows are cleared via `highlight.objectIds`
 *     (cluster fixes + mesh-rebuild fixes change world AABBs).
 *
 * Coarser invalidation than strictly needed, but the rebuild cost
 * of any one column is still ≤ what an un-cached re-run would
 * pay, and the savings on un-touched columns + un-touched ids
 * dominate.
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
