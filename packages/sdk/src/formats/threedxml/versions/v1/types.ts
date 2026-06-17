/**
 * Parsed intermediate types for the 3DXML v1 pipeline.
 *
 * @internal
 */

/** A tessellated representation — triangle geometry + optional flat colour. */
export interface ParsedRep {
  /** `ReferenceRep` id this geometry belongs to. */
  id: string;
  /** Flat `[x,y,z,…]` vertex positions. */
  positions: Float32Array;
  /** Flat `[x,y,z,…]` vertex normals, when the file supplies them. */
  normals?: Float32Array;
  /** Triangle indices into the vertex buffer. */
  indices: Uint32Array;
  /** Flat RGBA `[0,1]` surface colour, when present. */
  color?: [number, number, number, number];
}

/** An assembly node — a `Reference3D` (a part/product that can be instanced). */
export interface Reference3D {
  id: string;
  name?: string;
}

/** A representation reference — names the file holding a part's tessellation. */
export interface ReferenceRep {
  id: string;
  name?: string;
  /** Archive-relative (or URN) path to the representation document. */
  associatedFile?: string;
}

/** A positioned occurrence of one `Reference3D` under another. */
export interface Instance3D {
  id: string;
  name?: string;
  /** Parent `Reference3D` id (`IsAggregatedBy`). */
  aggregatedBy: string;
  /** Child `Reference3D` id (`IsInstanceOf`). */
  instanceOf: string;
  /** 4×4 column-major local transform (from `RelativeMatrix`); identity if absent. */
  matrix: number[];
}

/** Attaches a `ReferenceRep` to a `Reference3D`. */
export interface InstanceRep {
  id: string;
  name?: string;
  /** Owning `Reference3D` id (`IsAggregatedBy`). */
  aggregatedBy: string;
  /** Referenced `ReferenceRep` id (`IsInstanceOf`). */
  instanceOf: string;
}

/** The parsed product structure (assembly graph). */
export interface ProductStructure {
  /** Root `Reference3D` id to traverse from. */
  rootRef: string;
  references: Map<string, Reference3D>;
  referenceReps: Map<string, ReferenceRep>;
  instance3Ds: Instance3D[];
  instanceReps: InstanceRep[];
}
