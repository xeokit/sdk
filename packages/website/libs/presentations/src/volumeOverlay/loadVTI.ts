import type {VoxelGrid} from "./VoxelGrid";
import type {VectorGrid} from "./VectorGrid";
import {SDKErrorType, type SDKResult} from "@xeokit/sdk/base/core";


/**
 * Parsed contents of a VTK XML ImageData (`.vti`) file. A single
 * `.vti` may carry multiple named arrays (temperature + velocity +
 * pressure on the same grid is the common case), so the loader
 * returns them keyed by name and partitioned by component count.
 *
 * Example:
 *
 * ```ts
 * const r = loadVTI(text);
 * if (r.ok !== true) {
 *   studio.reportError(r);
 *   return;
 * }
 * const T   = r.value.scalars["Temperature"];
 * const vel = r.value.vectors["Velocity"];
 * panel.open(..., { grid: T, vectorGrid: vel });
 * ```
 *
 * `warnings` carries non-fatal skip notices, for example an N-component
 * array that doesn't fit the scalar / vector buckets, or a
 * compressed `<DataArray>` block that is not supported.
 *
 * @module presentations/volumeOverlay
 */
export interface VTIFile {
  /** Single-component arrays — Voxel grids (temperature, pressure, etc). */
  scalars: Record<string, VoxelGrid>;
  /** Three-component arrays — Vector grids (velocity, etc). */
  vectors: Record<string, VectorGrid>;
  /** Names of every array, in file order. Convenience for "pick the first". */
  arrayNames: string[];
  /** Non-fatal warnings collected while parsing (skipped arrays, unsupported encodings). */
  warnings: string[];
}


/**
 * Parse a VTK XML ImageData (`.vti`) file into voxel / vector
 * grids. Handles these `<DataArray>` encodings:
 *
 *   - `format="ascii"` — whitespace-separated numbers in the XML
 *     text node.
 *   - `format="binary"` — base64-encoded raw bytes with a 4-byte
 *     UInt32 length-header prefix (VTK's canonical layout).
 *
 * Does NOT support:
 *
 *   - `format="appended"` — raw bytes after the XML doc.
 *   - Compression (`zlib`, `lz4`).
 *   - Big-endian byte order.
 *
 * Component count picks the destination bucket: `1` → scalar
 * (VoxelGrid); `3` → vector (VectorGrid). Other counts are
 * skipped and surfaced as a warning in {@link VTIFile.warnings}.
 *
 * Returns `SDKResult<VTIFile>` — never throws.
 */
export function loadVTI(text: string): SDKResult<VTIFile> {

  const warnings: string[] = [];

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(text, "application/xml");
  } catch (e) {
    return {ok: false, error: `[loadVTI] XML parse exception: ${(e as Error).message}`, type: SDKErrorType.InvalidInput};
  }

  const err = doc.querySelector("parsererror");
  if (err) {
    return {ok: false, error: `[loadVTI] XML parse error: ${err.textContent}`, type: SDKErrorType.InvalidInput};
  }

  const root = doc.querySelector("VTKFile");
  if (!root) {
    return {ok: false, error: "[loadVTI] missing <VTKFile> root", type: SDKErrorType.InvalidInput};
  }

  const type = root.getAttribute("type") ?? "";
  if (type !== "ImageData") {
    return {ok: false, error: `[loadVTI] expected type="ImageData", got "${type}"`, type: SDKErrorType.NotSupported};
  }
  const byteOrder = root.getAttribute("byte_order") ?? "LittleEndian";
  if (byteOrder !== "LittleEndian") {
    return {ok: false, error: `[loadVTI] only LittleEndian byte_order supported (got "${byteOrder}")`, type: SDKErrorType.NotSupported};
  }
  const headerType = root.getAttribute("header_type") ?? "UInt32";
  const headerWidth = (headerType === "UInt64") ? 8 : 4;

  const imageData = root.querySelector("ImageData");
  if (!imageData) {
    return {ok: false, error: "[loadVTI] missing <ImageData>", type: SDKErrorType.InvalidInput};
  }

  const wholeExtR = parseInts(imageData.getAttribute("WholeExtent"), 6);
  if (wholeExtR.ok !== true) return wholeExtR;
  const wholeExt = wholeExtR.value;
  const nx = wholeExt[1] - wholeExt[0] + 1;
  const ny = wholeExt[3] - wholeExt[2] + 1;
  const nz = wholeExt[5] - wholeExt[4] + 1;

  const originR  = parseFloats(imageData.getAttribute("Origin"),  3, [0, 0, 0]);
  if (originR.ok !== true) return originR;
  const spacingR = parseFloats(imageData.getAttribute("Spacing"), 3, [1, 1, 1]);
  if (spacingR.ok !== true) return spacingR;
  const origin = originR.value;
  const spacing = spacingR.value;

  const min: [number, number, number] = [origin[0], origin[1], origin[2]];
  const max: [number, number, number] = [
    origin[0] + spacing[0] * (nx - 1),
    origin[1] + spacing[1] * (ny - 1),
    origin[2] + spacing[2] * (nz - 1),
  ];

  const piece = imageData.querySelector("Piece");
  if (!piece) {
    return {ok: false, error: "[loadVTI] missing <Piece>", type: SDKErrorType.InvalidInput};
  }

  const arrayNames: string[] = [];
  const scalars: Record<string, VoxelGrid> = {};
  const vectors: Record<string, VectorGrid> = {};

  const ingestArray = (
    arr: Element, expectedPointCount: number, isCellData: boolean,
  ) => {
    const name = arr.getAttribute("Name") ?? "<unnamed>";
    const nc   = parseInt(arr.getAttribute("NumberOfComponents") ?? "1", 10);
    const dataR = decodeDataArray(arr, headerWidth, expectedPointCount * nc);
    if (dataR.ok !== true) {
      warnings.push(dataR.error);
      return;
    }
    const data = dataR.value;
    if (!data) return;       // soft-skip (empty text, etc.)
    arrayNames.push(name);

    const effRes: [number, number, number] = isCellData
      ? [Math.max(1, nx - 1), Math.max(1, ny - 1), Math.max(1, nz - 1)]
      : [nx, ny, nz];

    if (nc === 1) {
      scalars[name] = {data, resolution: effRes, min, max, name};
    } else if (nc === 3) {
      vectors[name] = {data, resolution: effRes, min, max, name};
    } else {
      warnings.push(`[loadVTI] skipping ${name}: ${nc}-component arrays aren't supported (only 1 = scalar, 3 = vector).`);
    }
  };

  const pointData = piece.querySelector("PointData");
  if (pointData) {
    const N = nx * ny * nz;
    pointData.querySelectorAll("DataArray").forEach(arr => ingestArray(arr, N, false));
  }
  const cellData = piece.querySelector("CellData");
  if (cellData) {
    const N = Math.max(1, nx - 1) * Math.max(1, ny - 1) * Math.max(1, nz - 1);
    cellData.querySelectorAll("DataArray").forEach(arr => ingestArray(arr, N, true));
  }

  return {ok: true, value: {scalars, vectors, arrayNames, warnings}};
}


// ─────────────────────────────────────────────────────────────────────
// Internals — every helper returns SDKResult; nothing throws.
// ─────────────────────────────────────────────────────────────────────

function parseInts(s: string | null, n: number, fallback?: number[]): SDKResult<number[]> {
  if (!s) {
    if (fallback) return {ok: true, value: fallback};
    return {ok: false, error: `[loadVTI] missing required attribute (expected ${n} ints)`, type: SDKErrorType.InvalidInput};
  }
  const out = s.trim().split(/\s+/).map(t => parseInt(t, 10));
  if (out.length !== n || out.some(v => !Number.isFinite(v))) {
    return {ok: false, error: `[loadVTI] expected ${n} ints, got "${s}"`, type: SDKErrorType.InvalidInput};
  }
  return {ok: true, value: out};
}

function parseFloats(s: string | null, n: number, fallback?: number[]): SDKResult<number[]> {
  if (!s) return {ok: true, value: fallback ?? new Array(n).fill(0)};
  const out = s.trim().split(/\s+/).map(t => parseFloat(t));
  if (out.length !== n || out.some(v => !Number.isFinite(v))) {
    return {ok: false, error: `[loadVTI] expected ${n} floats, got "${s}"`, type: SDKErrorType.InvalidInput};
  }
  return {ok: true, value: out};
}


/**
 * Decode a `<DataArray>` into a `Float32Array`.
 *
 * Returns `{ok: true, value: null}` for soft-skip cases (empty
 * text), `{ok: true, value: Float32Array}` on success. Unsupported
 * encodings / dtype mismatches return `ok: false` with a warning-
 * style message — the caller collects these into the VTIFile's
 * `warnings` array rather than aborting the whole load.
 */
function decodeDataArray(
  arr: Element,
  headerWidth: number,
  expectedFloats: number,
): SDKResult<Float32Array | null> {

  const dtype  = arr.getAttribute("type") ?? "Float32";
  const format = arr.getAttribute("format") ?? "ascii";
  const name   = arr.getAttribute("Name") ?? "<unnamed>";

  if (dtype !== "Float32" && dtype !== "Float64") {
    return {ok: false, error: `[loadVTI] ${name}: only Float32 / Float64 supported (got "${dtype}"). Skipping.`, type: SDKErrorType.NotSupported};
  }

  if (format === "appended") {
    return {ok: false, error: `[loadVTI] ${name}: format="appended" not yet supported. Skipping.`, type: SDKErrorType.NotSupported};
  }
  if (arr.querySelector("[encoding]") || arr.getAttribute("compressor")) {
    return {ok: false, error: `[loadVTI] ${name}: compressed DataArray not yet supported. Skipping.`, type: SDKErrorType.NotSupported};
  }

  const text = arr.textContent?.trim() ?? "";
  if (text.length === 0) return {ok: true, value: null};

  if (format === "ascii") {
    const numbers = text.split(/\s+/).map(Number);
    if (numbers.length !== expectedFloats) {
      return {ok: false, error: `[loadVTI] ${name}: expected ${expectedFloats} values, got ${numbers.length}. Skipping.`, type: SDKErrorType.InvalidInput};
    }
    return {ok: true, value: new Float32Array(numbers)};
  }

  if (format === "binary") {
    const bytesR = base64ToBytes(text);
    if (bytesR.ok !== true) return bytesR;
    const bytes = bytesR.value;
    if (bytes.length < headerWidth) {
      return {ok: false, error: `[loadVTI] ${name}: binary block shorter than header (${bytes.length} < ${headerWidth}). Skipping.`, type: SDKErrorType.InvalidInput};
    }
    const headerView = new DataView(bytes.buffer, bytes.byteOffset, headerWidth);
    const payloadBytes = headerWidth === 8
      ? Number(headerView.getBigUint64(0, true))
      : headerView.getUint32(0, true);
    const payloadStart = bytes.byteOffset + headerWidth;

    if (dtype === "Float32") {
      if (payloadBytes !== expectedFloats * 4) {
        return {ok: false, error: `[loadVTI] ${name}: payload mismatch: ${payloadBytes} bytes != ${expectedFloats * 4}. Skipping.`, type: SDKErrorType.InvalidInput};
      }
      const aligned = new Uint8Array(bytes.buffer.slice(payloadStart, payloadStart + payloadBytes));
      return {ok: true, value: new Float32Array(aligned.buffer)};
    }
    if (payloadBytes !== expectedFloats * 8) {
      return {ok: false, error: `[loadVTI] ${name}: Float64 payload mismatch: ${payloadBytes} bytes != ${expectedFloats * 8}. Skipping.`, type: SDKErrorType.InvalidInput};
    }
    const aligned = new Uint8Array(bytes.buffer.slice(payloadStart, payloadStart + payloadBytes));
    const f64 = new Float64Array(aligned.buffer);
    const f32 = new Float32Array(f64.length);
    for (let i = 0; i < f64.length; i++) f32[i] = f64[i];
    return {ok: true, value: f32};
  }

  return {ok: false, error: `[loadVTI] ${name}: unknown format "${format}". Skipping.`, type: SDKErrorType.NotSupported};
}


function base64ToBytes(s: string): SDKResult<Uint8Array> {
  const clean = s.replace(/\s+/g, "");
  if (typeof atob !== "undefined") {
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return {ok: true, value: out};
  }
  const NodeBuffer = (globalThis as any).Buffer;
  if (NodeBuffer) return {ok: true, value: new Uint8Array(NodeBuffer.from(clean, "base64"))};
  return {ok: false, error: "[loadVTI] no base64 decoder available (need either atob or Buffer)", type: SDKErrorType.NotSupported};
}
