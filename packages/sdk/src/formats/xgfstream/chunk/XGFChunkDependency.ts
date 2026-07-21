/**
 * Reference to another chunk required before a stream chunk can be loaded.
 */
export interface XGFChunkDependency {
  /** Stable chunk ID in the stream index. */
  id?: string;
  /** URI of the dependency chunk when no ID lookup is available. */
  uri?: string;
}
