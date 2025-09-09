/**
 * A type representing a Blob that works across both browser and Node.js environments.
 *
 * In the browser, this refers to the global `Blob` type.
 * In Node.js, this refers to the `Blob` type from the `_buffer` module.
 */
export type CrossPlatformBlob = globalThis.Blob | import('buffer').Blob;
