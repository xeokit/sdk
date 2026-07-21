import type {XGFStreamingIndex} from "./XGFStreamingIndex";

/**
 * Creates a JSON-safe copy of a human-readable XGF stream index.
 */
export function writeXGFStreamingIndex(index: XGFStreamingIndex): any {
  return JSON.parse(JSON.stringify(index));
}
