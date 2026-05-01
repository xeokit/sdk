import type {Issue} from "./Issue";


/**
 * Progress payload fired by {@link applyFixesAsync} as it walks
 * each {@link Issue} in the report. Same shape as
 * {@link InspectProgress}; events fire `phase: "before"` ahead of
 * each issue's strategy invocation and `phase: "after"` once it
 * resolves. A final `{current: total, total, phase: "after",
 * label: ""}` lands when every issue has been processed.
 */
export interface ApplyFixesProgress {

  /**
   * Index of the issue in the report's iteration order:
   * `0..total-1` for in-flight progress, `total` on completion.
   */
  current: number;

  /**
   * Total number of issues in the report (snapshot at the start
   * of the run; the code-filter doesn't change `total` — issues
   * filtered out still contribute to the index, the strategy
   * just skips them).
   */
  total: number;

  /**
   * Human-readable label — the issue's {@link Issue.code} during
   * the walk, or the empty string on the final "complete" event.
   */
  label: string;

  /**
   * `"before"` — the strategy is about to be dispatched (or the
   * issue is about to be skipped because it doesn't match the
   * code filter).
   * `"after"` — the strategy has resolved (or every issue has
   * been processed, on the final completion event).
   */
  phase: "before" | "after";

  /**
   * The {@link Issue} the event refers to. Absent on the final
   * completion event.
   */
  issue?: Issue;
}
