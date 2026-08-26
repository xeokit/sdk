/**
 * A raw RGBA8 pixel buffer with explicit dimensions.
 *
 * Fields:
 *
 *   - `data` — `width * height * 4` bytes, packed `[R, G, B, A, …]`
 *              in row-major, top-down order. Alpha is stored
 *              straight (not pre-multiplied).
 *   - `width`, `height` — pixel dimensions.
 *
 * The shape is structurally compatible with
 * `scene!SceneTexturePixelBuffer`, so a `MaterialPixelBuffer` is
 * accepted directly by `SceneModel.createTexture({ imageData })`.
 *
 * The buffer is DOM-free, allowing painters to run in Node and
 * web-worker contexts. The underlying `Uint8ClampedArray.buffer` is
 * `postMessage`-transferable.
 */
export interface MaterialPixelBuffer {
  data: Uint8ClampedArray<any>;
  width: number;
  height: number;
}
