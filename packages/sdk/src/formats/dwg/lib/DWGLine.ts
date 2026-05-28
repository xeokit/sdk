import type {DWGEntityCommon} from "./DWGEntityCommon";
import type {Vec3} from "./Vec3";


/**
 * AutoCAD `LINE` — a single straight segment from `start` to `end`.
 * Emitted as a one-segment line mesh in the layer/colour/width
 * bucket inherited from {@link DWGEntityCommon}.
 *
 * @private
 */
export interface DWGLine extends DWGEntityCommon {
  type: "LINE";
  start: Vec3;
  end:   Vec3;
}
