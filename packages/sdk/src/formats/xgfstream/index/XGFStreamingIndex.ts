import type {XGFChunkManifest} from "../chunk/XGFChunkManifest";

export interface XGFStreamingCoordinateSystem {
  basis?: number[];
  origin?: [number, number, number];
  units?: string;
  scaleToMeters?: number;
}

/**
 * Reference to a child XGF stream index. Child indexes use the same schema and
 * are fetched lazily by view-stream controllers when their aggregate AABB is
 * relevant.
 */
export interface XGFSubstreamManifest {
  /** Stable stream ID within the parent stream index. */
  id: string;
  /** Parent-index-relative URI of the child stream index. */
  uri: string;
  /** Aggregate world-space AABB for the child stream. */
  aabb: number[];
  /** Optional world-space translation applied to this child stream. */
  origin?: [number, number, number];
  /** Optional scheduler priority. Lower values load first. */
  priority?: number;
  /** Optional application metadata copied through unchanged. */
  metadata?: Record<string, any>;
}

/**
 * Human-readable index for an XGF stream dataset.
 */
export interface XGFStreamingIndex {
  /** Index format identifier. */
  format: "XGFStreamingIndex";
  /** Index schema version. */
  indexVersion: "1.0.0" | "1.1.0" | "1.2.0";
  /** All chunk manifests in the stream. */
  chunks: XGFChunkManifest[];
  /** Child stream indexes referenced by this stream. */
  streams?: XGFSubstreamManifest[];
  /** IDs of primary scene-content chunks. */
  rootChunkIds?: string[];
  /** Aggregate stream AABB. */
  aabb?: number[];
  /** Optional coordinate system for the stream's chunk coordinates. */
  coordinateSystem?: XGFStreamingCoordinateSystem;
  /** Optional application metadata copied through unchanged. */
  metadata?: Record<string, any>;
}
