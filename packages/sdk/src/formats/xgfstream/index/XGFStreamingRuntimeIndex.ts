/**
 * Compact runtime index for an XGF stream dataset.
 *
 * This representation minimizes repeated JSON property names in large stream
 * indexes. Decode it with {@link readXGFStreamingRuntimeIndex} before passing
 * it to loaders or view controllers.
 */
export interface XGFStreamingRuntimeIndex {
  /** Runtime index format identifier. */
  format: "XGFStreamingRuntimeIndex";
  /** Runtime index schema version. */
  indexVersion: "1.0.0" | "1.1.0";
  /** Role lookup table used by compact chunk tuples. */
  roles?: ["full", "assetLibrary", "referencesOnly"];
  /** Count lookup table used by compact chunk tuples. */
  counts?: ["transforms", "geometries", "materials", "textures", "meshes", "objects"];
  /** String lookup table used by runtime index v1.1. */
  strings?: string[];
  /** AABB quantization used by runtime index v1.1 chunk tuples. */
  aabbQuantization?: XGFStreamingRuntimeAABBQuantization;
  /** Compact chunk tuples. */
  chunks: XGFStreamingRuntimeChunk[];
  /** IDs of primary scene-content chunks. */
  root?: Array<string | number>;
  /** Aggregate stream AABB. */
  aabb?: number[];
  /** Optional application metadata copied through unchanged. */
  metadata?: Record<string, any>;
}

/** @internal */
export type XGFStreamingRuntimeChunk = [
  id: string | number,
  uri: string | number | null,
  role: number,
  dependencies: Array<string | number | [string | number | null, string | number | null]>,
  aabb: number[] | null,
  counts: [number, number, number, number, number, number],
  priority?: number | null,
  lod?: number | string | null
];

/** @internal */
export interface XGFStreamingRuntimeAABBQuantization {
  bits: 16;
  origin: [number, number, number];
  scale: [number, number, number];
}
