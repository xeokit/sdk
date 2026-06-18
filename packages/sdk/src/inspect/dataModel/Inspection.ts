import type {DataModel} from "../../model/data";
import type {Issue} from "./Issue";
import type {InspectDataModelParams} from "./params/InspectDataModelParams";


/**
 * One pluggable check in the DataModel inspector pipeline. Mirrors
 * {@link inspect!sceneModel.Inspection | Inspection} without the fix half — SDK
 * policy is to report defects in user data, not auto-mutate.
 */
export interface Inspection {

  /** Issue codes this inspection can emit. */
  codes: string[];

  description: string;

  /**
   * When set, restricts this inspection to DataModels whose
   * schema id matches one of these. The orchestrator resolves
   * the model's schema id as `params.schema?.id ?? dataModel.schema`
   * and skips the inspection when neither side is set or the
   * resolved id isn't in the list.
   *
   * Schema-agnostic inspections leave this `undefined` — they
   * run regardless of schema id.
   */
  schemas?: readonly string[];

  /** When `true`, the inspection runs only when a matching
   *  `check…` flag is set on `params`. */
  optIn?: boolean;

  /** For opt-in inspections — the {@link InspectDataModelParams}
   *  key that gates the work. Metadata only; the orchestrator
   *  doesn't read it. */
  paramsKey?: string;

  /** Per-code human-readable labels for UI rendering. Resolve via
   *  {@link labelForCode}. */
  labels?: Record<string, string>;

  /** Per-code plain-English descriptions for "What is this?"
   *  tooltips. Resolve via {@link descriptionForCode}. */
  descriptions?: Record<string, string>;

  /** Walk the DataModel and return zero or more issues. Pure with
   *  respect to `dataModel`. */
  run(
    dataModel: DataModel,
    params:    InspectDataModelParams,
  ): Issue[];
}
