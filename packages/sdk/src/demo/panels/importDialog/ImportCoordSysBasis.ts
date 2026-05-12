/**
 * @module demo/panels/importDialog/ImportCoordSysBasis
 */

import type {Vec9} from "../../../math/vector";


/**
 * One named coordinate-system basis the user can pick from the
 * Import dialog's Basis dropdown. Each entry pairs a label
 * (which calls out the authoring apps that emit this basis) with
 * the column-major 3×3 rotation that maps local axes to world.
 *
 * The special "auto" entry has `basis: null` — that means the
 * dialog passes no override and the loader (or coord-sys sidecar
 * file) decides.
 */
export interface ImportCoordSysBasis {
  id: string;
  label: string;
  /** Column-major `[x0,x1,x2, y0,y1,y2, z0,z1,z2]`, or `null` for "auto". */
  basis: Vec9 | null;
}
