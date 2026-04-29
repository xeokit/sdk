/**
 * Radiance RGBE (`.hdr`) parser.
 *
 * The `.hdr` format stores HDR pixels as four bytes each — R, G, B
 * mantissas plus a shared exponent — packing roughly 32 bits of
 * floating-point dynamic range into one byte per channel. This module
 * decodes a Radiance file's bytes into a row-major Float32Array of
 * RGBA pixels (alpha pinned to 1.0) suitable for direct upload as a
 * `RGBA16F` / `FLOAT` texture.
 *
 * Supports the standard adaptive-RLE compression (the form most HDRIs
 * ship with — channel runs prefixed by `0x02 0x02 width-hi width-lo`
 * scanline markers) plus the older uncompressed form.
 *
 * Returns a buffer in top-down row order (`v = 0` at the top of the
 * image), which matches the equirect projection shader's expectation.
 *
 * @module viewer/hdrLoader
 * @internal
 */

import {SDKErrorType, type SDKResult} from "../core";

/** Decoded Radiance file as linear-space Float32 RGBA pixels. */
export interface HDRImage {
  /** Row-major RGBA, top-down, alpha pinned to 1.0. */
  data: Float32Array<any>;
  width: number;
  height: number;
}

/**
 * Parse a Radiance RGBE file into a linear-space Float32 RGBA buffer.
 *
 * @param arrayBuffer Raw `.hdr` file bytes (e.g. from `fetch().arrayBuffer()`).
 * @returns On success, `{ ok: true, value: { data, width, height } }`.
 *   On parse failure, `{ ok: false }` with a message describing the
 *   malformed header / scanline.
 */
export function parseHDR(arrayBuffer: ArrayBuffer): SDKResult<HDRImage> {
  const fail = (error: string): SDKResult<HDRImage> => ({
    ok: false,
    type: SDKErrorType.InvalidInput,
    error
  });
  const bytes = new Uint8Array(arrayBuffer);

  // ── Locate header end ────────────────────────────────────────────
  // Headers are ASCII; the data section starts after the first
  // double-newline. Scan only the first ~4 KB so a malformed file
  // can't pull us through megabytes of binary garbage.
  const SCAN_LIMIT = Math.min(bytes.length, 4096);
  let headerEnd = -1;
  for (let i = 0; i < SCAN_LIMIT - 1; i++) {
    if (bytes[i] === 0x0A && bytes[i + 1] === 0x0A) {
      headerEnd = i + 2;
      break;
    }
  }
  if (headerEnd < 0) {
    return fail("HDR: no header terminator");
  }

  const headerText = new TextDecoder("ascii").decode(bytes.subarray(0, headerEnd));
  if (!/^#\?(RADIANCE|RGBE)/.test(headerText)) {
    return fail("HDR: not a Radiance file (missing #?RADIANCE magic)");
  }
  const formatMatch = headerText.match(/FORMAT=(\S+)/);
  if (!formatMatch || formatMatch[1] !== "32-bit_rle_rgbe") {
    return fail(`HDR: unsupported FORMAT '${formatMatch ? formatMatch[1] : "missing"}', expected 32-bit_rle_rgbe`);
  }

  // Resolution line: "-Y <height> +X <width>" or "+X <width> -Y <height>".
  // The Y sign tells us scan order — `-Y` is top-down (matches our
  // shader's v=0-at-top convention); `+Y` is bottom-up and we flip.
  //
  // Per the Radiance HDR spec the resolution line lives AFTER the
  // empty-line header terminator (i.e. starting at `headerEnd`),
  // not within the meta-variable header. Read it from there and fall
  // back to the meta-header for files that put it inline.
  let resLineEnd = headerEnd;
  while (resLineEnd < bytes.length && resLineEnd < SCAN_LIMIT && bytes[resLineEnd] !== 0x0A) {
    resLineEnd++;
  }
  const resText = new TextDecoder("ascii").decode(bytes.subarray(headerEnd, resLineEnd));
  let resMatch = resText.match(/([+\-])([XY])\s+(\d+)\s+([+\-])([XY])\s+(\d+)/);
  if (!resMatch) {
    resMatch = headerText.match(/([+\-])([XY])\s+(\d+)\s+([+\-])([XY])\s+(\d+)/);
  }
  if (!resMatch) {
    return fail("HDR: missing or malformed resolution line");
  }
  // Advance the read cursor past the resolution line so the binary
  // section starts at the correct offset.
  let dataStart = resLineEnd;
  if (dataStart < bytes.length && bytes[dataStart] === 0x0A) dataStart++;
  const dim1 = { sign: resMatch[1], axis: resMatch[2], n: parseInt(resMatch[3], 10) };
  const dim2 = { sign: resMatch[4], axis: resMatch[5], n: parseInt(resMatch[6], 10) };
  let width: number, height: number, ySign: string;
  if (dim1.axis === "Y") {
    height = dim1.n; ySign = dim1.sign;
    width  = dim2.n;
  } else {
    width  = dim1.n;
    height = dim2.n; ySign = dim2.sign;
  }
  if (width <= 0 || height <= 0) {
    return fail(`HDR: invalid resolution ${width}x${height}`);
  }

  // ── Decode scanlines ─────────────────────────────────────────────
  const rgbe = new Uint8Array(width * height * 4);
  let dataPos = dataStart;

  for (let y = 0; y < height; y++) {
    if (dataPos + 4 > bytes.length) {
      return fail(`HDR: truncated at scanline ${y} of ${height}`);
    }
    // Adaptive-RLE scanline marker: 0x02 0x02 followed by the width
    // high/low bytes. If absent, the scanline is uncompressed RGBE
    // quads (or a now-rare older RLE form we treat as uncompressed).
    const adaptive =
      bytes[dataPos]     === 0x02 &&
      bytes[dataPos + 1] === 0x02 &&
      ((bytes[dataPos + 2] << 8) | bytes[dataPos + 3]) === width &&
      width >= 8 && width <= 0x7FFF;

    const rowBase = y * width * 4;

    if (adaptive) {
      dataPos += 4;
      // Each of the 4 channels is RLE-encoded separately end-to-end
      // across the row — repeat-bytes have the high bit set, literal
      // runs don't.
      for (let chan = 0; chan < 4; chan++) {
        let xpos = 0;
        while (xpos < width) {
          if (dataPos >= bytes.length) {
            return fail(`HDR: truncated RLE on scanline ${y} chan ${chan}`);
          }
          const b = bytes[dataPos++];
          if (b > 128) {
            const runLen = b - 128;
            if (dataPos >= bytes.length) {
              return fail(`HDR: truncated run on scanline ${y} chan ${chan}`);
            }
            const v = bytes[dataPos++];
            for (let k = 0; k < runLen; k++) {
              rgbe[rowBase + (xpos + k) * 4 + chan] = v;
            }
            xpos += runLen;
          } else {
            const litLen = b;
            if (dataPos + litLen > bytes.length) {
              return fail(`HDR: truncated literal on scanline ${y} chan ${chan}`);
            }
            for (let k = 0; k < litLen; k++) {
              rgbe[rowBase + (xpos + k) * 4 + chan] = bytes[dataPos++];
            }
            xpos += litLen;
          }
          if (xpos > width) {
            return fail(`HDR: RLE overshoot on scanline ${y} chan ${chan}`);
          }
        }
      }
    } else {
      // Uncompressed fallback — `width` raw RGBE quads.
      const need = width * 4;
      if (dataPos + need > bytes.length) {
        return fail(`HDR: truncated uncompressed scanline ${y}`);
      }
      rgbe.set(bytes.subarray(dataPos, dataPos + need), rowBase);
      dataPos += need;
    }
  }

  // ── RGBE → Float32 RGBA ──────────────────────────────────────────
  const data = new Float32Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const r = rgbe[i * 4    ];
    const g = rgbe[i * 4 + 1];
    const b = rgbe[i * 4 + 2];
    const e = rgbe[i * 4 + 3];
    if (e === 0) {
      // Convention: e=0 means the pixel is black.
      data[i * 4    ] = 0;
      data[i * 4 + 1] = 0;
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 1;
    } else {
      // Mantissa is in [0, 255] with implicit /256 scale; exponent
      // bias is 128 (RGBE shorthand).
      const scale = Math.pow(2, e - 128) / 256;
      data[i * 4    ] = r * scale;
      data[i * 4 + 1] = g * scale;
      data[i * 4 + 2] = b * scale;
      data[i * 4 + 3] = 1;
    }
  }

  // Flip in place if the file stored the image bottom-up.
  if (ySign === "+") {
    flipRows(data, width, height);
  }

  return { ok: true, value: { data, width, height } };
}

function flipRows(data: Float32Array, width: number, height: number): void {
  const rowFloats = width * 4;
  const tmp = new Float32Array(rowFloats);
  for (let y = 0; y < (height >> 1); y++) {
    const top = y * rowFloats;
    const bot = (height - 1 - y) * rowFloats;
    tmp.set(data.subarray(top, top + rowFloats));
    data.copyWithin(top, bot, bot + rowFloats);
    data.set(tmp, bot);
  }
}
