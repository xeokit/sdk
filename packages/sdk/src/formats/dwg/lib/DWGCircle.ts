import type {DWGEntityCommon} from "./DWGEntityCommon";
import type {Vec3} from "./Vec3";


/**
 * AutoCAD `CIRCLE` — a full circle in the XY plane at `center.z`.
 * The loader tessellates it into a closed polyline with
 * {@link DWGLoadOptions.circleSteps} segments per revolution.
 *
 * @private
 */
export interface DWGCircle extends DWGEntityCommon {
  type: "CIRCLE";
  center: Vec3;
  radius: number;
}
