import type {Issue} from "./Issue";
import type {FixSkipReason} from "./FixSkipReason";


/** Outcome record for one issue processed by {@link applyFixes}. */
export interface ApplyFixesIssueOutcome {

  /** The original issue that was considered. */
  issue: Issue;

  /** Description from the strategy that handled (or declined) this issue. */
  strategy?: string;

  /**
   * Error message from the strategy when it threw / returned
   * `ok: false`. Absent on success or when no strategy matched.
   */
  error?: string;

  /**
   * Short trace string returned by the strategy — peripheral ids
   * destroyed / created / re-parented, new pieces a split
   * produced, etc. UIs surface this as a debugging aid; the
   * framework never inspects it. May be present alongside
   * {@link reason} on a declined fix when the strategy wants to
   * say more than the reason category alone conveys.
   */
  trace?: string;

  /**
   * Why this issue ended up in {@link ApplyFixesResult.skipped}.
   * Absent on `fixed` and `errors` outcomes — only populated for
   * skipped entries. See {@link FixSkipReason} for the categories.
   */
  reason?: FixSkipReason;
}


/** Result of {@link applyFixes}. */
export interface ApplyFixesResult {

  /** Issues whose strategy returned `{fixed: true}`. */
  fixed: ApplyFixesIssueOutcome[];

  /**
   * Issues that couldn't be auto-fixed — either no registered
   * strategy matched the code, or the strategy returned
   * `{fixed: false}` without raising an error. Callers typically
   * surface these to a user with the issue list, the way an IDE
   * shows "could not auto-fix N problems".
   */
  skipped: ApplyFixesIssueOutcome[];

  /**
   * Issues whose strategy raised an error (returned `ok: false`
   * from `apply`). Each entry carries the strategy's description
   * and the error message so calling code can log / present them.
   */
  errors: ApplyFixesIssueOutcome[];
}
