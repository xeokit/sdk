/**
 * Lazily initialises the `tinyusdz` wasm module, once, and caches it.
 *
 * The published `tinyusdz` wasm is built for the **browser/worker only**
 * (it asserts against Node), so USDZ loading is a browser-only feature in
 * v1. We fetch the wasm bytes from a CDN and hand them to the emscripten
 * factory as `wasmBinary` — this side-steps the module's own
 * relative-path wasm lookup, which breaks once the SDK is bundled (the
 * same reason {@link getInitializedIFCAPI} points web-ifc at a CDN).
 *
 * @internal
 */
const WASM_URL = "https://cdn.jsdelivr.net/npm/tinyusdz@0.9.1/tinyusdz.wasm";

let modulePromise: Promise<any> | null = null;

/** Returns the initialised tinyusdz wasm `Module` (cached after first call). */
export function getTinyUSDZ(): Promise<any> {
  if (!modulePromise) {
    // Cache the in-flight init; on failure clear it so a later call retries
    // rather than re-throwing a stale rejection forever.
    modulePromise = init().catch((err) => {
      modulePromise = null;
      throw err;
    });
  }
  return modulePromise;
}

async function init(): Promise<any> {
  if (typeof window === "undefined" || typeof fetch === "undefined") {
    throw new Error(
      "[USDZLoader] requires a browser environment — the tinyusdz wasm is web-only " +
      "and not available under Node (CLI / headless).",
    );
  }
  const initTinyUSDZNative = (await import("tinyusdz")).default;
  const wasmBinary = await (await fetch(WASM_URL)).arrayBuffer();
  return initTinyUSDZNative({wasmBinary});
}
