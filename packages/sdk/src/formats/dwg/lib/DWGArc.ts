import type {DWGEntityCommon} from "./DWGEntityCommon";
import type {Vec3} from "./Vec3";


/**
 * AutoCAD `ARC` — a partial circle from `startAngle` to `endAngle`
 * (radians, CCW from +X). Tessellated as an open polyline with a
 * step count proportional to {@link DWGLoadOptions.circleSteps}.
 *
 * Note: DXF / libredwg deliver these angles in degrees; the
 * mapping layer in `versions/v1_0/parse.ts` converts to radians
 * before constructing the entity.
 *
 * @private
 */
export interface DWGArc extends DWGEntityCommon {
  type: "ARC";
  center: Vec3;
  radius: number;
  /** Radians; CCW from +X. */
  startAngle: number;
  /** Radians; sweep direction follows DWG convention (CCW from start). */
  endAngle:   number;
}
