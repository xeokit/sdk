import type {Inspection} from "./Inspection";


/**
 * Progress payload fired by {@link inspectSceneModelAsync} as it
 * walks each registered {@link Inspection}. UIs render the bar
 * straight off `{current, total}` and label the current step from
 * `label`. Two events fire per inspection: one before its `run`
 * begins (`phase: "before"`), one after (`phase: "after"`). The
 * orchestrator also fires one final `{current: total, total,
 * phase: "after", label: ""}` once every inspection has finished.
 */
export interface InspectProgress {

  /**
   * Index of the inspection in the registry's iteration order:
   * `0..total-1` for in-flight progress, `total` once everything
   * has finished.
   */
  current: number;

  /**
   * Number of registered inspections being walked (snapshot at
   * the start of the run).
   */
  total: number;

  /**
   * Human-readable label — the current inspection's
   * {@link Inspection.description} during the walk, or the empty
   * string on the final "complete" event.
   */
  label: string;

  /**
   * `"before"` — the inspection's `run` is about to begin.
   * `"after"` — `run` has just finished (or every inspection has
   * finished, on the final completion event).
   */
  phase: "before" | "after";

  /**
   * The {@link Inspection} the event refers to. Absent on the
   * final completion event (after the last inspection's
   * `phase: "after"`).
   */
  inspection?: Inspection;
}
