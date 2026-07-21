import type {XGFStreamingIndex} from "./XGFStreamingIndex";
import {XGFStreamingIndexLookup} from "./XGFStreamingIndexLookup";

/**
 * Creates an ID/URI lookup helper for an XGF stream index.
 */
export function createXGFStreamingIndexLookup(index: XGFStreamingIndex): XGFStreamingIndexLookup {
  return new XGFStreamingIndexLookup(index);
}
