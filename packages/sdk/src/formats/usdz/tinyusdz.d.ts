/**
 * Ambient declaration for the `tinyusdz` npm package, which ships a wasm
 * build + emscripten glue but no TypeScript types. We only use the default
 * export (the emscripten module factory) and the `TinyUSDZLoaderNative`
 * class it exposes; the rest is treated as `any`.
 *
 * @internal
 */
declare module "tinyusdz" {
  /** Emscripten module factory. Resolves to the wasm `Module`. */
  const initTinyUSDZNative: (options?: any) => Promise<any>;
  export default initTinyUSDZNative;
}
