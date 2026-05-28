import type {DWGLine} from "./DWGLine";
import type {DWGLwPolyline} from "./DWGLwPolyline";
import type {DWGPolyline} from "./DWGPolyline";
import type {DWGCircle} from "./DWGCircle";
import type {DWGArc} from "./DWGArc";
import type {DWGEllipse} from "./DWGEllipse";
import type {DWGPoint} from "./DWGPoint";
import type {DWG3DFace} from "./DWG3DFace";
import type {DWGInsert} from "./DWGInsert";
import type {DWGText} from "./DWGText";
import type {DWGMText} from "./DWGMText";


/**
 * Discriminated union of supported entity types.
 *
 * Unrecognised `type` strings are skipped silently — the loader
 * walks them but emits no geometry. New entity types can be added
 * to the union without breaking existing adapters as long as their
 * shape matches one of the listed variants. The narrow set here
 * intentionally tracks the geometry the loader can actually emit;
 * HATCH, SPLINE, DIMENSION, 3D solids etc. aren't represented.
 *
 * @private
 */
export type DWGEntity =
  | DWGLine
  | DWGLwPolyline
  | DWGPolyline
  | DWGCircle
  | DWGArc
  | DWGEllipse
  | DWGPoint
  | DWG3DFace
  | DWGInsert
  | DWGText
  | DWGMText;
