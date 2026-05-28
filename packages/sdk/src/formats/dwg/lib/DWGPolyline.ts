import type {DWGEntityCommon} from "./DWGEntityCommon";
import type {Vec3} from "./Vec3";


/**
 * AutoCAD `POLYLINE` — the full 3D polyline with per-vertex Z (the
 * heavier sibling of {@link DWGLwPolyline}). `closed: true` connects
 * the last vertex back to the first.
 *
 * The built-in DXF parser only fills in the header — VERTEX
 * sub-entities aren't gathered. Hosts that need full POLYLINE
 * support should pre-process the DXF with `dxf-parser` and feed
 * the resulting `DWGDocument` into the emit step directly.
 *
 * @private
 */
export interface DWGPolyline extends DWGEntityCommon {
  type: "POLYLINE";
  vertices: Vec3[];
  closed?: boolean;
}
