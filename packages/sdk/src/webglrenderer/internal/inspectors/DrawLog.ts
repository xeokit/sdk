import {type FrameLog} from "./FrameLog";

/**
 * A log of a single frame's rendering operations.
 */
export interface DrawLog {
  frames?: FrameLog[];
  [k: string]: unknown;
};
