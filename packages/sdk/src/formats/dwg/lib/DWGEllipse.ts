import type {DWGEntityCommon} from "./DWGEntityCommon";
import type {Vec3} from "./Vec3";


/**
 * AutoCAD `ELLIPSE` — full or partial. The ellipse plane and major
 * axis come from `majorAxis` (a vector from `center` to the
 * major-axis endpoint); the minor axis is implied by `ratio` times
 * the major-axis length. `startAngle` / `endAngle` (radians,
 * measured around the ellipse, both omitted = full ellipse) cut a
 * sweep out of it. Sampled parametrically with a step count
 * proportional to {@link DWGLoadOptions.circleSteps}.
 *
 * @private
 */
export interface DWGEllipse extends DWGEntityCommon {
  type: "ELLIPSE";
  center:   Vec3;
  /** Vector from center to major-axis endpoint. */
  majorAxis: Vec3;
  /** Minor-axis length as ratio of major-axis length. */
  ratio:    number;
  startAngle?: number;
  endAngle?:   number;
}
