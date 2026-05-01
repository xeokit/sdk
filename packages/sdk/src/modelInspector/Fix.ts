import type {SceneModel} from "../scene";
import type {SDKResult} from "../core";
import type {Issue} from "./Issue";
import type {FixSkipReason} from "./FixSkipReason";


/**
 * Return type of {@link Fix.apply}. Discriminated on `fixed`:
 * successful fixes carry an optional `trace`; declined fixes
 * carry a {@link FixSkipReason} so UIs can show why the strategy
 * declined rather than a flat "skipped".
 */
export type FixApplyResult =
  | {fixed: true;  trace?: string}
  | {fixed: false; reason: FixSkipReason; trace?: string};


/**
 * One quick-fix in the demo's IDE-style inspect / fix pipeline.
 *
 * Each strategy declares which {@link Issue.code | issue codes} it
 * handles and a single `apply` function that takes a matching
 * {@link Issue} (plus the SceneModel it lives in) and applies the
 * remediation in-place.
 *
 * `apply` is invoked once per matching issue. Strategies that
 * naturally process a group of issues together (e.g.
 * `GEOMETRY_DUPLICATE` deduplicates a bucket of duplicate ids) read
 * the structured payload from {@link Issue.context} — the inspection
 * that produced the issue is responsible for putting whatever the
 * strategy needs into context.
 *
 * The return value reports whether the issue actually got fixed.
 * Returning `{fixed: false}` (without an error) means the strategy
 * decided the issue couldn't be safely auto-resolved — the caller
 * sees that the issue wasn't fixed and can present it to the user.
 */
export interface Fix {

  /**
   * Issue codes this strategy handles. Multiple codes can share a
   * strategy when the remediation is the same — e.g. both
   * `MATERIAL_TEXTURED_GEOMETRY_NO_UVS` and
   * `MATERIAL_PBR_GEOMETRY_NO_NORMALS` route to "synthesize the
   * missing geometry attribute".
   */
  codes: string[];

  /**
   * Short human-readable label — what an IDE would render next to
   * the lightbulb. Useful for surfacing in custom UIs.
   */
  description: string;

  /**
   * Optional second-level breakdown — a brief, ordered list of the
   * concrete steps the strategy performs on each call to
   * {@link Fix.apply | apply}. Mirrors what an IDE shows in
   * a hover tooltip for a quick-fix: "what will this actually do?".
   *
   * Kept terse — one short imperative phrase per step, no
   * punctuation. Caller renders as an ordered list / numbered
   * sequence; the framework itself never inspects the contents.
   *
   * Example for `splitDenseGeometry`:
   *
   * ```
   * [
   *   "Split the geometry in two on its midpoint",
   *   "Snapshot every mesh that referenced it",
   *   "Destroy and recreate each mesh as two halves on the SceneObject",
   *   "Destroy the original geometry"
   * ]
   * ```
   */
  procedure?: string[];

  /**
   * Apply the remediation to a single issue.
   *
   * Strategies should be idempotent — running twice on the same
   * issue should not corrupt anything. A strategy that decided to
   * decline returns `{fixed: false, reason}` with a
   * {@link FixSkipReason} explaining why; one that succeeded
   * returns `{fixed: true}`. Errors from underlying SDK calls
   * bubble up via `SDKResult`.
   *
   * Optionally, a successful strategy returns a short `trace`
   * string describing exactly what it did — peripheral resource
   * ids destroyed / created / re-parented, the new pieces a split
   * produced, etc. UIs surface this as a debugging aid; the
   * framework itself never inspects it.
   *
   * @param issue The issue to fix.
   * @param sceneModel SceneModel context, for any
   *   `createMesh` / `destroy` / etc. the strategy needs to make.
   */
  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult>;
}
