import type {IssueSeverity} from "./IssueSeverity";
import type {IssueHighlight} from "./IssueHighlight";


/**
 * One finding produced by {@link inspectSceneModel} — a single
 * inspection rule firing on a single resource. Equivalent to an
 * IDE's "problem" / "diagnostic" record.
 *
 * Issues flow downstream into {@link applyFixes}, where a
 * {@link Fix} keyed by {@link Issue.code} may be able to
 * remediate the issue. The optional {@link Issue.context} field
 * carries structured payload (referenced ids, expected values, etc.)
 * that the strategy needs and that would otherwise have to be
 * re-derived by parsing {@link Issue.message}.
 */
export interface Issue {

  /**
   * Severity tier — see {@link IssueSeverity}.
   */
  severity: IssueSeverity;

  /**
   * Stable code identifying the rule that fired (e.g.
   * `"GEOMETRY_DUPLICATE"`, `"MESH_DANGLING_GEOMETRY"`). Built-in
   * codes are CONSTANT_CASE; custom inspections should namespace
   * theirs (e.g. `"MyApp/CHECK_NAMING"`) to avoid collision.
   *
   * Fix strategies dispatch on this field — see
   * {@link Fix.codes}.
   */
  code: string;

  /**
   * Human-readable description, including the offending resource id
   * where applicable.
   */
  message: string;

  /**
   * Optional short, formatted summary of this issue's specifics —
   * the few numbers / ids a UI wants to surface alongside the
   * resource id without parsing {@link Issue.message}. Examples:
   *
   *   - `"89,500 verts · 41,200 tris"` (`GEOMETRY_OVER_BUDGET`)
   *   - `"→ collapses 3 others"` (`GEOMETRY_DUPLICATE`)
   *   - `"1.2M units from origin"` (`OBJECT_FAR_FROM_ORIGIN`)
   *
   * The inspection that emits the issue is best positioned to
   * format this, so the field is populated at emit time. UIs read
   * it as-is — no per-code formatter map required.
   */
  summary?: string;

  /**
   * Resource id this issue is about (a mesh / geometry / material /
   * transform / texture / object id), when the issue points at one.
   */
  resourceId?: string;

  /**
   * Structured payload used by fix strategies. Inspections populate
   * this with whatever the matching strategy will need — for
   * example, `GEOMETRY_DUPLICATE` carries
   * `{duplicates: string[]}` (the ids of the duplicate geometries
   * that should be repointed to {@link Issue.resourceId}).
   *
   * Strategies should treat missing keys defensively — different
   * inspection-version pairs may emit different fields under the
   * same code.
   */
  context?: Record<string, unknown>;

  /**
   * Optional viewer-highlight payload — see {@link IssueHighlight}.
   *
   * Set by inspections whose target maps cleanly to one or more
   * renderable SceneObjects (the geometry-tied warnings, the
   * material-binding warnings, `OBJECT_DANGLING_MESH`). Left
   * `undefined` for codes whose target won't render — dangling
   * mesh references, malformed positions, transform cycles — since
   * locating them in the Viewer would land the camera on something
   * invisible or broken.
   */
  highlight?: IssueHighlight;
}
