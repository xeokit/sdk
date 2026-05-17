import type {SceneModel} from "../../model/scene";
import type {Issue} from "./Issue";
import type {InspectSceneModelParams} from "./params/InspectSceneModelParams";
import type {SceneModelInspectionIndex} from "./internal/SceneModelInspectionIndex";
import type {ConfigSchema} from "./Config";


/**
 * One pluggable check in the demo's inspect pipeline. Mirrors
 * {@link Fix}: each inspection declares which
 * {@link Issue.code | issue codes} it can emit and a single `run`
 * function that walks the {@link model!scene.SceneModel | SceneModel} and returns the issues
 * it found. Plays the role of an `eslint` rule.
 *
 * Granularity is "topical concern", not "one rule per code" — a
 * single inspection often emits several related codes from one walk
 * (e.g. {@link geometryDataIntegrity} covers eight `GEOMETRY_*`
 * codes that all derive from one pass over `sceneModel.geometries`).
 *
 * Inspections that are expensive or domain-specific (e.g.
 * {@link duplicateGeometries}) declare {@link optIn} and
 * are skipped by {@link inspectSceneModel} unless the caller
 * explicitly asks for them via the matching
 * {@link InspectSceneModelParams} flag.
 */
export interface Inspection {

  /**
   * Issue codes this inspection can emit. Used by the registry as
   * the "what does this rule contribute?" map and surfaced to UI
   * code that wants to enumerate every possible code even when no
   * issues have fired yet. The codes a `run` actually produces on a
   * given SceneModel are a subset of this list.
   */
  codes: string[];

  /**
   * Short human-readable label describing what the inspection looks
   * for. Equivalent to {@link Fix.description}.
   */
  description: string;

  /**
   * `true` when this inspection should run only if the caller
   * explicitly enables it through {@link InspectSceneModelParams}.
   * Defaults to `false` — most inspections are cheap data-integrity
   * checks that always run.
   *
   * Opt-in inspections read their toggle from `params` themselves —
   * the orchestrator doesn't know which key is which. Convention:
   * use a `check…` boolean (`checkDuplicateGeometries`,
   * `checkDenseGeometries`, …).
   */
  optIn?: boolean;

  /**
   * For opt-in inspections — the {@link InspectSceneModelParams}
   * boolean key that gates the inspection's runtime behaviour
   * (e.g. `"checkDuplicateGeometries"`). The inspection's own
   * `run` reads `params[paramsKey]` to decide whether to do work;
   * the orchestrator never reads it.
   *
   * Purely metadata — surfaced for UIs that want to render a
   * checkbox per inspection without hardcoding the param mapping.
   * Always-on inspections leave this `undefined`.
   */
  paramsKey?: string;

  /**
   * Optional human-readable labels for the {@link Inspection.codes}
   * this inspection emits. Keyed by code, so a UI rendering an
   * inspection's codes can show
   * `"Duplicate geometry · GEOMETRY_DUPLICATE"` rather than the
   * raw constant.
   *
   * The matching helper {@link labelForCode} walks
   * {@link DEFAULT_INSPECTION_REGISTRY} (or any custom registry)
   * to find a code's label, falling back to the code itself when
   * no label is registered. Plugin authors who add a custom
   * inspection with new codes just declare their labels here —
   * no central table to coordinate against.
   */
  labels?: Record<string, string>;

  /**
   * Optional plain-English descriptions of what each
   * {@link Inspection.codes | code} means — a sentence or two
   * explaining why the issue matters and what's wrong, suitable
   * for surfacing in a "What is this?" pane next to a list of
   * issues sharing one code.
   *
   * Keyed by code. Resolve via {@link descriptionForCode}, which
   * walks the registry the same way {@link labelForCode} does.
   * Plugin inspections that introduce new codes ship their own
   * descriptions here; no central table to coordinate against.
   */
  descriptions?: Record<string, string>;

  /**
   * Optional declarative configuration schema — the list of
   * tunable knobs (opt-in toggle, numeric thresholds, enumerated
   * choices) this inspection exposes. When present, `run` is
   * expected to consume `resolveConfig(this.config, params)`
   * instead of pulling individual fields off `params`.
   *
   * Carries enough metadata (labels, units, min/max, descriptions)
   * for a UI to auto-render a settings form per inspection — the
   * DemoHelper's planned "Inspection settings" panel walks every
   * registered inspection's schema and renders one form per
   * inspection without per-inspection UI code. Plugins that
   * declare a schema inherit that UI for free.
   *
   * Optional — inspections without a schema continue to read
   * fields directly off `params`, same as before. The two
   * patterns coexist while the schema-driven approach rolls out.
   */
  config?: ConfigSchema;

  /**
   * Walk the SceneModel and produce zero or more issues. Read any
   * inspection-specific knobs (thresholds, opt-in flags) directly
   * from `params`. Pure with respect to `sceneModel` —
   * {@link inspectSceneModel} guarantees the model is never mutated
   * during the inspection pass.
   *
   * `index` is the shared {@link SceneModelInspectionIndex} the
   * orchestrator builds and threads through every inspection in a
   * pass — so expensive derived data (content hashes, vertex
   * dedup maps, edge incidence counts, decompressed positions) is
   * computed at most once per SceneModel and reused by every
   * inspection (and follow-up fix) that needs it.
   *
   * Optional in this signature for backwards compatibility with
   * pre-index inspections — the orchestrator always passes one.
   * New inspections should treat it as required.
   */
  run(
    sceneModel: SceneModel,
    params: InspectSceneModelParams,
    index?: SceneModelInspectionIndex,
  ): Issue[];
}
