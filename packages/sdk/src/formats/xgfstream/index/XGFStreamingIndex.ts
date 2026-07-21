import type {XGFChunkManifest} from "../chunk/XGFChunkManifest";

/**
 * Human-readable index for an XGF stream dataset.
 */
export interface XGFStreamingIndex {
  /** Index format identifier. */
  format: "XGFStreamingIndex";
  /** Index schema version. */
  indexVersion: "1.0.0";
  /** All chunk manifests in the stream. */
  chunks: XGFChunkManifest[];
  /** IDs of primary scene-content chunks. */
  rootChunkIds?: string[];
  /** Aggregate stream AABB. */
  aabb?: number[];
  /** Optional application metadata copied through unchanged. */
  metadata?: Record<string, any>;
}
