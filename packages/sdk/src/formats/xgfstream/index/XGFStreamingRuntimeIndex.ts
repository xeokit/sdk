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
  indexVersion: "1.0.0";
  /** Role lookup table used by compact chunk tuples. */
  roles: ["full", "assetLibrary", "referencesOnly"];
  /** Count lookup table used by compact chunk tuples. */
  counts: ["transforms", "geometries", "materials", "textures", "meshes", "objects"];
  /** Compact chunk tuples. */
  chunks: XGFStreamingRuntimeChunk[];
  /** IDs of primary scene-content chunks. */
  root?: string[];
  /** Aggregate stream AABB. */
  aabb?: number[];
  /** Optional application metadata copied through unchanged. */
  metadata?: Record<string, any>;
}

/** @internal */
export type XGFStreamingRuntimeChunk = [
  id: string,
  uri: string | null,
  role: number,
  dependencies: Array<string | [string | null, string | null]>,
  aabb: number[] | null,
  counts: [number, number, number, number, number, number],
  priority?: number | null,
  lod?: number | string | null
];
