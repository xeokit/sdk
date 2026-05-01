/**
 * Why a {@link Fix.apply} call resulted in `{fixed: false}` (or
 * why the orchestrator never invoked a strategy at all). Surfaces
 * in {@link ApplyFixesIssueOutcome.reason} so UIs can render more
 * specific feedback than a flat "skipped".
 *
 *   - `filter-excluded` — orchestrator: the issue's code wasn't in
 *     the {@link ApplyFixesParams.codes | codes} filter the caller
 *     passed. The strategy never ran. Common when a "Fix all
 *     X-CODE" button funnels other codes from the same report
 *     through the dispatcher.
 *
 *   - `no-strategy` — orchestrator: no {@link Fix} is registered
 *     for the issue's code in the active {@link FixRegistry}.
 *     Either the code is informational (we shipped no remediation)
 *     or a registry was passed that omits it.
 *
 *   - `target-missing` — strategy: the canonical / target resource
 *     the fix would operate on is missing or already destroyed —
 *     usually because an earlier fix in the same applyFixes pass
 *     swept it up. The issue is effectively obsolete; re-inspecting
 *     would drop it.
 *
 *   - `malformed-issue` — strategy: the issue's
 *     {@link Issue.context} is missing fields the strategy needs
 *     (or has the wrong types). The inspection that produced the
 *     issue is buggy, or the issue list is stale relative to the
 *     SceneModel.
 *
 *   - `precondition-failed` — strategy: a safety / quality gate the
 *     fix needs to clear didn't pass. Examples: a residual
 *     tolerance test in pose-fit, a watertightness check, a
 *     vertex-count parity check between two geometries.
 *
 *   - `no-op` — strategy: the fix would do nothing because the
 *     SceneModel is already in the desired state for this issue —
 *     no resources to drop, no meshes to rebuild, the issue's
 *     payload was empty by design.
 */
export type FixSkipReason =
  | "filter-excluded"
  | "no-strategy"
  | "target-missing"
  | "malformed-issue"
  | "precondition-failed"
  | "no-op";
