/**
 * Shared utilities for the procedural-material painters.
 *
 * Three concerns:
 *
 *   1. **Pixel-buffer allocation** — `newPixelBuffer`, `clamp01`.
 *      Painters allocate a {@link MaterialPixelBuffer} and write
 *      RGBA8 bytes directly into `.data`.
 *   2. **Procedural noise** — `hash2` (deterministic, non-periodic)
 *      and the periodic family `periodicHash2` / `periodicNoise2` /
 *      `periodicFbm`. The periodic variants wrap seamlessly over a
 *      caller-supplied lattice period.
 *   3. **Map composition helpers** — `heightToNormal` (heightfield →
 *      tangent-space normal map), `flatNormal` (identity normal),
 *      `flatMR` (constant metallic-roughness), `paintMR` (per-pixel
 *      metallic-roughness via callback).
 *
 * Painters compose these to produce a {@link MaterialMaps} triple.
 *
 * @module procgen/paintMaterials/utils
 * @internal
 */

import type {MaterialPixelBuffer} from "./MaterialPixelBuffer";

// ---------------------------------------------------------------------
// Pixel-buffer plumbing
// ---------------------------------------------------------------------

/**
 * Allocate a `size × size` RGBA8 pixel buffer with alpha pre-set to
 * 255 (opaque). Painters mutate `.data` in place and return the
 * buffer.
 */
export function newPixelBuffer(size: number): MaterialPixelBuffer {
  const data = new Uint8ClampedArray(size * size * 4);
  // Pre-fill alpha so painters that only write RGB don't need to set
  // A in their inner loop.
  for (let i = 3, n = data.length; i < n; i += 4) data[i] = 255;
  return {data, width: size, height: size};
}

/** Clamp `v` to the closed interval `[0, 1]`. */
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ---------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------

/**
 * Deterministic pseudo-random hash returning `[0, 1)`. Suitable for
 * stipple, speckle, and per-cell jitter. Not periodic.
 */
export function hash2(x: number, y: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Periodic per-lattice-cell hash. Wraps modulo `(pX, pY)`, so values
 * on opposite edges of the lattice match. Use this in place of
 * {@link hash2} when the resulting texture must tile without a wrap
 * seam. `pX` and `pY` are positive integer lattice repeats per axis.
 */
export function periodicHash2(x: number, y: number, pX: number, pY: number): number {
  const ix = ((Math.floor(x) % pX) + pX) % pX;
  const iy = ((Math.floor(y) % pY) + pY) % pY;
  return hash2(ix, iy);
}

/**
 * Periodic value-noise. Bilinear interpolation between four lattice
 * corners, each sampled via {@link periodicHash2} so the output tiles
 * seamlessly over `(pX, pY)`.
 */
export function periodicNoise2(x: number, y: number, pX: number, pY: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const a = periodicHash2(ix,     iy,     pX, pY);
  const b = periodicHash2(ix + 1, iy,     pX, pY);
  const c = periodicHash2(ix,     iy + 1, pX, pY);
  const d = periodicHash2(ix + 1, iy + 1, pX, pY);
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return (a * (1 - ux) + b * ux) * (1 - uy)
       + (c * (1 - ux) + d * ux) *      uy;
}

/**
 * Periodic fractional Brownian motion. Sums `octaves` octaves of
 * {@link periodicNoise2}, each sampled at `lacunarity ×` the previous
 * frequency and scaled by `gain ×` the previous amplitude. The
 * lattice period passed to each octave scales with the frequency, so
 * the wrap stays consistent across the spectrum. `pX` and `pY`
 * describe the base octave's period.
 */
export function periodicFbm(
  x: number, y: number,
  pX: number, pY: number,
  octaves: number = 4,
  lacunarity: number = 2.0,
  gain: number = 0.5
): number {
  let amp = 0.5, freq = 1.0, sum = 0.0, norm = 0.0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * periodicNoise2(x * freq, y * freq, pX * freq, pY * freq);
    norm += amp;
    amp *= gain; freq *= lacunarity;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------
// Map composition
// ---------------------------------------------------------------------

/**
 * Convert a greyscale heightfield buffer into a tangent-space normal
 * map buffer via central-difference gradient. `strength` scales the
 * gradient (higher values produce more pronounced relief). The
 * gradient lookup wraps at the buffer edges, so the output tiles
 * seamlessly when the input does.
 */
export function heightToNormal(
  height: MaterialPixelBuffer,
  strength: number = 1.0
): MaterialPixelBuffer {
  const size = height.width;   // assumes square input
  const src = height.data;
  const out = newPixelBuffer(size);
  const dst = out.data;

  const h = (x: number, y: number): number => {
    const xx = (x + size) % size;
    const yy = (y + size) % size;
    return src[(yy * size + xx) * 4] / 255;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const nx = -dx, ny = -dy, nz = 1.0;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      dst[i    ] = Math.round((nx / len * 0.5 + 0.5) * 255);
      dst[i + 1] = Math.round((ny / len * 0.5 + 0.5) * 255);
      dst[i + 2] = Math.round((nz / len * 0.5 + 0.5) * 255);
      dst[i + 3] = 255;
    }
  }
  return out;
}

/**
 * Build a flat normal-map buffer with every texel set to the identity
 * tangent-space normal `(0, 0, 1)`, encoded as `(128, 128, 255)`. Use
 * for surfaces whose appearance is determined entirely by the BRDF.
 */
export function flatNormal(size: number): MaterialPixelBuffer {
  return flatRGBA(size, 128, 128, 255);
}

/**
 * Build a metallic-roughness buffer with constant values across the
 * whole surface. R is unused; G = roughness × 255; B = metallic × 255.
 */
export function flatMR(
  size: number,
  roughness: number,
  metallic: number
): MaterialPixelBuffer {
  return flatRGBA(size, 0, Math.round(roughness * 255), Math.round(metallic * 255));
}

/**
 * Per-pixel metallic-roughness painter. The callback receives
 * `(x, y, size)` and returns `[roughness, metallic]`. R is written
 * as 0; G = roughness × 255; B = metallic × 255.
 */
export function paintMR(
  size: number,
  fn: (x: number, y: number, size: number) => [number, number]
): MaterialPixelBuffer {
  const out = newPixelBuffer(size);
  const data = out.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, m] = fn(x, y, size);
      const i = (y * size + x) * 4;
      data[i    ] = 0;
      data[i + 1] = Math.round(r * 255);
      data[i + 2] = Math.round(m * 255);
      data[i + 3] = 255;
    }
  }
  return out;
}

/**
 * Allocate a buffer and fill every texel with `(r, g, b, 255)` from
 * sRGB float input in `[0..1]`. Used by mirror-metal painters that
 * carry a single uniform F0 colour.
 */
export function solidColor(size: number, rgb: [number, number, number]): MaterialPixelBuffer {
  return flatRGBA(
    size,
    Math.round(clamp01(rgb[0]) * 255),
    Math.round(clamp01(rgb[1]) * 255),
    Math.round(clamp01(rgb[2]) * 255)
  );
}

/**
 * Allocate a buffer and fill every texel with `(r, g, b, 255)`.
 * Used by the constant-fill flat-* builders.
 */
function flatRGBA(size: number, r: number, g: number, b: number): MaterialPixelBuffer {
  const out = newPixelBuffer(size);
  const data = out.data;
  for (let i = 0, n = data.length; i < n; i += 4) {
    data[i    ] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return out;
}
