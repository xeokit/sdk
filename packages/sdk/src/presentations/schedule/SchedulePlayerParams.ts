import type {Schedule} from "./Schedule";
import type {View} from "../../viewing/viewer";


/**
 * Parameters for {@link SchedulePlayer | SchedulePlayer}.
 *
 * @module presentations/schedule
 */
export interface SchedulePlayerParams {

  /** The schedule the player will visualise. */
  schedule: Schedule;

  /**
   * View whose objects the player drives. The player calls
   * `view.setObjectsVisible / setObjectsColorized / setObjectsOpacity /
   * setObjectsXrayed` against this view's ViewObjects — bulk
   * data-texture writes, not buffer rebuilds.
   */
  view: View;

  /**
   * Starting position of the time cursor. Defaults to the
   * schedule's `startDate` so the scene opens on its empty state.
   */
  currentDate?: Date | string;

  /**
   * Playback speed in **schedule-days per real-time second**. Default
   * `7`. The timeline advances one week per second of wall-clock
   * playback, so a 24-week schedule plays out in ~24 s.
   */
  playbackSpeed?: number;

  /**
   * When `true`, pending tasks' objects are shown as a low-opacity
   * ghost (x-rayed + tinted). When `false`, pending objects are hidden.
   * Default `true`.
   */
  ghostUpcoming?: boolean;

  /**
   * RGB tint applied to pending-task objects when `ghostUpcoming`
   * is on. Default `[0.6, 0.7, 0.85]`.
   */
  ghostColor?: [number, number, number];

  /**
   * Opacity used for pending-task objects when `ghostUpcoming` is
   * on. Default `0.18`.
   */
  ghostOpacity?: number;

  /**
   * Opacity used for `InProgress` task objects. Default `0.85`,
   * with the trade colour from each task driving the tint.
   */
  inProgressOpacity?: number;

  /**
   * Whether the player begins playing immediately. Default `false`
   * The player constructs paused at `currentDate` so callers can
   * wire their UI before time starts advancing.
   */
  autoPlay?: boolean;
}
