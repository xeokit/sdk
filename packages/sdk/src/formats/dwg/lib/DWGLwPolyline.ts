import type {DWGEntityCommon} from "./DWGEntityCommon";
import type {Vec2} from "./Vec2";


/**
 * AutoCAD `LWPOLYLINE` — the lightweight, planar polyline. All
 * vertices share a single `elevation` (Z); accepts either a flat
 * interleaved `[x0, y0, x1, y1, …]` number list or a `Vec2[]`
 * (whichever the adapter finds cheaper to produce). `closed: true`
 * reconnects the last vertex back to the first.
 *
 * @private
 */
export interface DWGLwPolyline extends DWGEntityCommon {
  type: "LWPOLYLINE";
  /** 2D vertex list — interleaved as `[x0, y0, x1, y1, …]` OR `Vec2[]`. */
  vertices: number[] | Vec2[];
  /** Z elevation applied to every vertex (LWPOLYLINE is planar). */
  elevation?: number;
  /** Closes the last vertex back to the first when `true`. */
  closed?: boolean;
}
