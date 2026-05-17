/**
 * Encoder for the Radiance HDR (`.hdr`) image format.
 *
 * @module procgen/paintEnvironments/encodeRadianceHDR
 */

/**
 * Encodes Float32 RGBA pixel data as a Radiance HDR (`.hdr`)
 * `ArrayBuffer`, suitable for hand-off to
 * `IBL.setEnvironmentHDRBuffer`.
 *
 * Emits the uncompressed RGBE form (no adaptive-RLE markers); standard
 * `.hdr` parsers fall back to that path when the RLE marker is absent,
 * which keeps the encoder small. The cost is roughly 2× the bytes of
 * the RLE form — irrelevant for in-memory use, where nothing touches
 * disk.
 *
 * Pixels are read in row-major, top-down order. Alpha is ignored.
 *
 * @param pixels Float32 RGBA pixel data, `width * height * 4` floats.
 * @param width  Pixel width.
 * @param height Pixel height.
 * @returns Radiance HDR file bytes as an `ArrayBuffer`.
 */
export function encodeRadianceHDR(
  pixels: Float32Array | number[],
  width: number,
  height: number
): ArrayBuffer {
  const header = `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`;
  const headerBytes = new TextEncoder().encode(header);
  const body = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const r = Math.max(0, pixels[i * 4]);
    const g = Math.max(0, pixels[i * 4 + 1]);
    const b = Math.max(0, pixels[i * 4 + 2]);
    const m = Math.max(r, g, b);
    if (m < 1e-32) {
      body[i * 4]     = 0;
      body[i * 4 + 1] = 0;
      body[i * 4 + 2] = 0;
      body[i * 4 + 3] = 0;
    } else {
      const exp = Math.ceil(Math.log2(m));
      const scale = Math.pow(2, -exp) * 256;
      body[i * 4]     = Math.min(255, Math.floor(r * scale));
      body[i * 4 + 1] = Math.min(255, Math.floor(g * scale));
      body[i * 4 + 2] = Math.min(255, Math.floor(b * scale));
      body[i * 4 + 3] = Math.max(0, Math.min(255, exp + 128));
    }
  }
  const out = new Uint8Array(headerBytes.length + body.length);
  out.set(headerBytes, 0);
  out.set(body, headerBytes.length);
  return out.buffer as ArrayBuffer;
}
