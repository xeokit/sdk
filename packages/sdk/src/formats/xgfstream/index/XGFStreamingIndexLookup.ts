import type {XGFChunkManifest} from "../chunk/XGFChunkManifest";
import type {XGFStreamingIndex} from "./XGFStreamingIndex";

/**
 * O(1) lookup helper for chunks in an {@link XGFStreamingIndex}.
 */
export class XGFStreamingIndexLookup {

  /** Source stream index. */
  readonly index: XGFStreamingIndex;
  /** Chunk manifests keyed by chunk ID. */
  readonly byId: Record<string, XGFChunkManifest>;
  /** Chunk manifests keyed by chunk URI. */
  readonly byUri: Record<string, XGFChunkManifest>;

  /**
   * Creates a lookup from a stream index.
   */
  constructor(index: XGFStreamingIndex) {
    this.index = index;
    this.byId = {};
    this.byUri = {};
    for (const chunk of index.chunks || []) {
      this.byId[chunk.id] = chunk;
      if (chunk.uri) {
        this.byUri[chunk.uri] = chunk;
      }
    }
  }

  /**
   * Gets a chunk manifest by dependency ID or URI.
   */
  get(dependency: { id?: string; uri?: string }): XGFChunkManifest | undefined {
    return (dependency.id && this.byId[dependency.id])
      || (dependency.uri && this.byUri[dependency.uri])
      || undefined;
  }
}
