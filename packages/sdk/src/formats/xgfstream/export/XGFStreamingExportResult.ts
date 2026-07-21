import type {XGFChunkManifest} from "../chunk/XGFChunkManifest";
import type {XGFStreamingIndex} from "../index/XGFStreamingIndex";
import type {XGFStreamingRuntimeIndex} from "../index/XGFStreamingRuntimeIndex";

/** @internal */
export interface XGFStreamingExportResult {
  index: XGFStreamingIndex;
  manifests: XGFChunkManifest[];
  files: Record<string, ArrayBuffer | XGFChunkManifest | XGFStreamingIndex | XGFStreamingRuntimeIndex>;
}
