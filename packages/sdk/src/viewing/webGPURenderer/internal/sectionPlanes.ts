import type {Vec3} from "../../../base/math/vector";
import type {View} from "../../viewer";

export interface SectionPlaneLike {
  readonly active: boolean;
  readonly dir: ArrayLike<number>;
  readonly dist: number;
}

/**
 * Tests the WebGLRenderer-compatible section-plane convention:
 * `dot(plane.dir, worldPos) + plane.dist > 0` is clipped.
 *
 * @internal
 */
export function isWorldPosClipped(view: View, worldPos: Vec3, clippable: boolean): boolean {
  if (!clippable) {
    return false;
  }
  const planes = view.sectionPlanesList as SectionPlaneLike[] | undefined;
  if (!planes) {
    return false;
  }
  for (let i = 0, len = planes.length; i < len; i++) {
    const plane = planes[i];
    if (!plane.active) {
      continue;
    }
    const dir = plane.dir;
    if (dir[0] * worldPos[0] + dir[1] * worldPos[1] + dir[2] * worldPos[2] + plane.dist > 0) {
      return true;
    }
  }
  return false;
}
