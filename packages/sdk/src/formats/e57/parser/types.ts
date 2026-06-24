/**
 * Pure data types for the E57 reader. The parser layer is deliberately free of
 * any SceneModel / SDK coupling so it can be unit-tested against raw byte
 * buffers; {@link E57Loader} composes these into geometry.
 */

/** Parsed 48-byte E57 file header (all multi-byte fields little-endian). */
export interface E57Header {
  /** File signature — always `"ASTM-E57"`. */
  signature: string;
  versionMajor: number;
  versionMinor: number;
  /** Total file length in physical (CRC-inclusive) bytes. */
  filePhysicalLength: number;
  /** Physical offset of the XML section. */
  xmlPhysicalOffset: number;
  /** Length of the XML section in logical (CRC-stripped) bytes. */
  xmlLogicalLength: number;
  /** Physical page size (the last 4 bytes of each page are a CRC-32C). */
  pageSize: number;
}

/** One field in a point record's prototype. */
export interface E57Field {
  /** Element name, e.g. `cartesianX`, `colorRed`, `cartesianInvalidState`. */
  name: string;
  type: "Float" | "Integer" | "ScaledInteger";
  /** Float only: `"single"` (32-bit) or `"double"` (64-bit, the E57 default). */
  precision?: "single" | "double";
  /** Raw integer bounds (Integer/ScaledInteger) — drive the packed bit width. */
  minimum: number;
  maximum: number;
  /** ScaledInteger multiplier (1 for plain Integer). */
  scale: number;
  /** ScaledInteger additive offset (0 for plain Integer). */
  offset: number;
}

/** Rigid-body placement of a scan in the file's global frame. */
export interface E57Pose {
  /** Unit quaternion `[w, x, y, z]`. */
  rotation: [number, number, number, number];
  translation: [number, number, number];
}

/** Axis-aligned cartesian bounds of a scan (from the XML; used for validation). */
export interface E57CartesianBounds {
  xMinimum: number; xMaximum: number;
  yMinimum: number; yMaximum: number;
  zMinimum: number; zMaximum: number;
}

/** A single `data3D` scan: metadata + the CompressedVector descriptor. */
export interface E57PointCloud {
  guid?: string;
  name?: string;
  pose?: E57Pose;
  cartesianBounds?: E57CartesianBounds;
  /** Field layout of one point record. */
  prototype: E57Field[];
  recordCount: number;
  /** Physical offset of this scan's CompressedVector section. */
  pointsFileOffset: number;
}

/** Top-level parsed structure of an E57 file (point clouds only; images ignored). */
export interface E57Document {
  pointClouds: E57PointCloud[];
}

/** Decoded point columns, keyed by prototype field name. */
export type E57Columns = Map<string, Float64Array>;
