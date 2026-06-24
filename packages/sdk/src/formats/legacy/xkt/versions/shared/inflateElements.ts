import {inflate} from "pako";

/**
 * Inflate a deflated element into its raw `ArrayBuffer`, for reinterpretation
 * as a typed array. An empty element inflates to an empty buffer.
 *
 * @private
 */
export function inflateBuffer(array: Uint8Array): ArrayBuffer {
  return array.length === 0 ? new ArrayBuffer(0) : inflate(array).buffer as ArrayBuffer;
}

/**
 * Inflate a deflated element to a UTF-8 string (used for JSON payloads).
 *
 * @private
 */
export function inflateString(array: Uint8Array): string {
  return array.length === 0 ? "" : inflate(array, {to: "string"});
}
