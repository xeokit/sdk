/**
 * Encoder for the compact `.splat` 3D-Gaussian-Splatting format
 * (the antimatter15/splat layout) — the exact inverse of {@link parseSplat}.
 * The file is headerless: a flat array of fixed-size 32-byte records.
 *
 * Per-splat record (little-endian):
 *   - bytes  0..11  position   : 3 × float32
 *   - bytes 12..23  scale      : 3 × float32   (per-axis gaussian std-dev)
 *   - bytes 24..27  colour     : 4 × uint8     (RGBA, baked — no SH)
 *   - bytes 28..31  rotation   : 4 × uint8     (quaternion, encoded round(q·128 + 128))
 *
 * Baked-RGB profile only (no spherical harmonics).
 */

import {SPLAT_RECORD_BYTES} from "./parseSplat";

/** Splat attribute buffers to encode — mirrors {@link ParsedSplats}. */
export interface SplatBuffers {
  /** Number of splats. */
  count: number;
  /** `count × 3` packed positions (xyz), in the `.splat` file's coordinate frame. */
  positions: ArrayLike<number>;
  /** `count × 3` packed per-axis scales (xyz). */
  scales: ArrayLike<number>;
  /** `count × 4` packed rotation quaternions, in file order (matching {@link parseSplat} output). */
  rotations: ArrayLike<number>;
  /** Optional `count × 4` packed RGBA colour bytes (0..255). Defaults to opaque white per splat. */
  colors?: ArrayLike<number>;
}

/** Clamps to a byte, matching the renderer's saturating quantisation. */
function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * Encodes splat attribute buffers into a compact `.splat` buffer.
 *
 * Inverse of {@link parseSplat}: `encodeSplat(parseSplat(buf))` reproduces `buf`
 * byte-for-byte. The quaternion byte encode `round(q·128 + 128)` is the exact
 * inverse of the parser's `(b - 128) / 128` decode, so rotations round-trip
 * losslessly; positions/scales are stored verbatim as float32.
 *
 * @param buffers - The splat attributes to encode. `rotations` must be in the
 * same file order that {@link parseSplat} emits (not SceneGeometry's xyzw order).
 * @returns The encoded `.splat` file bytes.
 */
export function encodeSplat(buffers: SplatBuffers): ArrayBuffer {
  const {count, positions, scales, rotations, colors} = buffers;
  const buffer = new ArrayBuffer(count * SPLAT_RECORD_BYTES);
  const view = new DataView(buffer);
  const u8 = new Uint8Array(buffer);

  for (let i = 0; i < count; i++) {
    const base = i * SPLAT_RECORD_BYTES;
    view.setFloat32(base,      positions[i * 3],     true);
    view.setFloat32(base + 4,  positions[i * 3 + 1], true);
    view.setFloat32(base + 8,  positions[i * 3 + 2], true);
    view.setFloat32(base + 12, scales[i * 3],        true);
    view.setFloat32(base + 16, scales[i * 3 + 1],    true);
    view.setFloat32(base + 20, scales[i * 3 + 2],    true);
    if (colors) {
      u8[base + 24] = clampByte(colors[i * 4]);
      u8[base + 25] = clampByte(colors[i * 4 + 1]);
      u8[base + 26] = clampByte(colors[i * 4 + 2]);
      u8[base + 27] = clampByte(colors[i * 4 + 3]);
    } else {
      u8[base + 24] = u8[base + 25] = u8[base + 26] = u8[base + 27] = 255;
    }
    // Inverse of the parser's (b - 128) / 128 decode; clamp covers any
    // un-normalised quaternion component that lands outside [-1, 1].
    u8[base + 28] = clampByte(Math.round(rotations[i * 4]     * 128 + 128));
    u8[base + 29] = clampByte(Math.round(rotations[i * 4 + 1] * 128 + 128));
    u8[base + 30] = clampByte(Math.round(rotations[i * 4 + 2] * 128 + 128));
    u8[base + 31] = clampByte(Math.round(rotations[i * 4 + 3] * 128 + 128));
  }

  return buffer;
}
