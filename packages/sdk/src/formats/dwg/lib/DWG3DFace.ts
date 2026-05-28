import type {DWGEntityCommon} from "./DWGEntityCommon";
import type {Vec3} from "./Vec3";


/**
 * AutoCAD `3DFACE` — a planar 3- or 4-corner facet. The loader
 * emits one triangle for a 3-corner face (the fourth corner
 * repeats the third, per DWG convention) and two for a 4-corner
 * face. The sole filled-geometry primitive in DWG v1; HATCH /
 * SOLID are not supported.
 *
 * @private
 */
export interface DWG3DFace extends DWGEntityCommon {
  type: "3DFACE";
  /** Four corners — for a triangle, repeat the fourth corner as the third. */
  corners: [Vec3, Vec3, Vec3, Vec3];
}
