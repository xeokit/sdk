import type {XGFChunkManifest} from "../chunk/XGFChunkManifest";

/**
 * Creates a JSON-safe copy of an XGF chunk manifest.
 */
export function writeXGFChunkManifest(manifest: XGFChunkManifest): any {
  return JSON.parse(JSON.stringify(manifest));
}
