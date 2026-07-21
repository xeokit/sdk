import type {XGFChunkLoadOptions} from "./XGFChunkLoadOptions";

/**
 * Options used when loading multiple XGF stream chunks.
 */
export interface XGFChunksLoadOptions extends XGFChunkLoadOptions {
  /** Maximum number of chunk fetches allowed at the same time. */
  fetchConcurrency?: number;
}
