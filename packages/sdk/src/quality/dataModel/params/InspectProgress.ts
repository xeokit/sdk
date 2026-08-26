import type {Inspection} from "../Inspection";


/**
 * Progress payload fired by {@link inspectDataModelAsync}. Two
 * events per inspection (`phase: "before"`, `phase: "after"`),
 * plus one final completion event with `current === total` and
 * empty `label`.
 */
export interface InspectProgress {

  /** `0..total-1` during the walk, `total` on completion. */
  current: number;

  total: number;

  /** Current inspection's `description`; empty on completion. */
  label: string;

  phase: "before" | "after";

  /** Absent on the final completion event. */
  inspection?: Inspection;
}
