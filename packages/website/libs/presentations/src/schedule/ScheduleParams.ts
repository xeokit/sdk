import type {ScheduleTaskParams} from "./ScheduleTaskParams";

/**
 * Parameters for {@link Schedule | Schedule}.
 *
 * @module presentations/schedule
 */
export interface ScheduleParams {

  /** Flat list of tasks. Hierarchy (summary / sub-tasks) is encoded
   *  through each task's `parentId` field — there's no separate tree
   *  structure to assemble; the schedule holds the flat list and
   *  callers walk by parentId when they need a tree view. */
  tasks: ScheduleTaskParams[];
}
