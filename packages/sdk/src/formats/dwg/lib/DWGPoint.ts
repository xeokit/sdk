import type {DWGEntityCommon} from "./DWGEntityCommon";
import type {Vec3} from "./Vec3";


/**
 * AutoCAD `POINT` — a single 3D position. The loader emits a small
 * `+` cross at `position` so the entity is actually visible (a
 * single GL_POINTS pixel disappears at most zoom levels).
 *
 * @private
 */
export interface DWGPoint extends DWGEntityCommon {
  type: "POINT";
  position: Vec3;
}
