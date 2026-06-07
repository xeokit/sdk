/**
 * Typed shapes for the records the v6 namelist tokenizer emits, after
 * dispatch by group name. Only the namelist groups that v1 of the
 * loader honours are modelled here; everything else is collected as a
 * load warning and discarded.
 *
 * @internal
 */

/** XB = (x1, x2, y1, y2, z1, z2) — every FDS volume primitive uses this layout. */
export type FDSXB = readonly [number, number, number, number, number, number];

/** XYZ = (x, y, z) — point primitives. */
export type FDSXYZ = readonly [number, number, number];

/** RGB = (r, g, b) — FDS RGB triples are integer 0–255. */
export type FDSRGB = readonly [number, number, number];

/** `&HEAD CHID='…', TITLE='…' /` */
export interface FDSHead {
  chid?: string;
  title?: string;
}

/** `&MESH IJK=…, XB=… /` — computational grid. */
export interface FDSMesh {
  id?: string;
  xb: FDSXB;
  ijk?: readonly [number, number, number];
}

/**
 * `&SURF ID='…', RGB=…, COLOR='…', TRANSPARENCY=… /` — material
 * referenced by OBST/VENT via SURF_ID.
 */
export interface FDSSurf {
  id: string;
  rgb?: FDSRGB;
  /** CSS-ish color name; the loader maps a small palette and falls back to grey. */
  color?: string;
  transparency?: number;
  /** All remaining namelist parameters preserved as-typed for the FDS propset. */
  extras: ReadonlyMap<string, unknown>;
}

/**
 * `&OBST XB=…, SURF_ID='…', COLOR='…', RGB=…, ID='…' /` — solid
 * obstruction, an axis-aligned box that participates in HOLE
 * subtraction.
 */
export interface FDSObst {
  id?: string;
  xb: FDSXB;
  surfId?: string;
  rgb?: FDSRGB;
  color?: string;
  extras: ReadonlyMap<string, unknown>;
}

/**
 * `&VENT XB=…, SURF_ID='…', MB='…', IOR=… /` — boundary on one face
 * of a MESH or OBST. Rendered as a quad.
 *
 * MB is a face mnemonic ("XMIN" | "XMAX" | "YMIN" | "YMAX" | "ZMIN" |
 * "ZMAX"); when XB is supplied directly, the quad is whichever face
 * has zero extent.
 */
export interface FDSVent {
  id?: string;
  xb?: FDSXB;
  mb?: string;
  ior?: number;
  surfId?: string;
  rgb?: FDSRGB;
  color?: string;
  extras: ReadonlyMap<string, unknown>;
}

/** `&HOLE XB=… /` — subtractive volume against OBSTs. */
export interface FDSHole {
  id?: string;
  xb: FDSXB;
  extras: ReadonlyMap<string, unknown>;
}

/**
 * Aggregate of every dispatched record in a parsed .fds file.
 * `unknown` records (groups the loader doesn't honour, e.g. `&REAC`,
 * `&CTRL`, `&MULT`, `&GEOM`, `&DEVC`) are collected into `warnings`
 * and otherwise ignored.
 */
export interface FDSModel {
  head: FDSHead | null;
  meshes: FDSMesh[];
  surfs: Map<string, FDSSurf>;
  obsts: FDSObst[];
  vents: FDSVent[];
  holes: FDSHole[];
  warnings: string[];
}

/** A single tokenizer-emitted record, pre-dispatch. */
export interface FDSRecord {
  group: string;
  /** 1-based line where this record opened. Used in warnings. */
  line: number;
  params: Map<string, unknown>;
}
