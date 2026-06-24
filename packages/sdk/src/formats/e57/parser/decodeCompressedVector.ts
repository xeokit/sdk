import type {E57Columns, E57Field, E57PointCloud} from "./types";
import {physicalToLogical} from "./e57PageReader";

const DATA_PACKET = 1;
const SECTION_HEADER_LENGTH = 32;

/**
 * Decodes one scan's CompressedVector binary section into per-field columns.
 *
 * The `bitPackCodec` (the only standard E57 codec) stores one logical
 * bytestream per prototype field, chunked across data packets. We concatenate
 * each field's chunks, then pull exactly `recordCount` values — record counts
 * are NOT inferred from bytestream length, since bit padding makes that
 * ambiguous. Float fields default to 64-bit precision when unspecified.
 *
 * @param logical CRC-stripped logical stream (from `buildLogicalStream`).
 * @param scan The scan descriptor parsed from the XML.
 * @param pageSize Physical page size (to map the section's physical offsets).
 */
export function decodeCompressedVector(
  logical: Uint8Array,
  scan: E57PointCloud,
  pageSize: number,
): E57Columns {
  const view = new DataView(logical.buffer, logical.byteOffset, logical.byteLength);
  const fields = scan.prototype;
  const n = scan.recordCount;

  // CompressedVectorSectionHeader: uint8 sectionId, 7 reserved, uint64
  // sectionLogicalLength, uint64 dataPhysicalOffset, uint64 indexPhysicalOffset.
  const sectionStart = physicalToLogical(scan.pointsFileOffset, pageSize);
  if (sectionStart + SECTION_HEADER_LENGTH > logical.length) {
    throw new Error("[decodeCompressedVector] section header runs past end of stream");
  }
  const dataPhysicalOffset = Number(view.getBigUint64(sectionStart + 16, true));

  // Bytes each field needs to yield `n` records, and a per-field chunk list.
  const required = fields.map(f => requiredBytes(f, n));
  const chunks: Uint8Array[][] = fields.map(() => []);
  const have = new Array(fields.length).fill(0);

  let off = physicalToLogical(dataPhysicalOffset, pageSize);
  while (off + 6 <= logical.length && view.getUint8(off) === DATA_PACKET) {
    const packetLength = view.getUint16(off + 2, true) + 1;
    const bytestreamCount = view.getUint16(off + 4, true);
    let p = off + 6;
    const bsLengths: number[] = [];
    for (let i = 0; i < bytestreamCount; i++) { bsLengths.push(view.getUint16(p, true)); p += 2; }
    for (let i = 0; i < bytestreamCount && i < fields.length; i++) {
      chunks[i].push(logical.subarray(p, p + bsLengths[i]));
      have[i] += bsLengths[i];
      p += bsLengths[i];
    }
    off += packetLength + ((4 - (packetLength & 3)) & 3); // packets are 4-byte aligned
    if (have.every((h, i) => h >= required[i])) break;
  }

  const columns: E57Columns = new Map();
  for (let i = 0; i < fields.length; i++) {
    columns.set(fields[i].name, decodeField(fields[i], concat(chunks[i]), n));
  }
  return columns;
}

function requiredBytes(field: E57Field, n: number): number {
  if (field.type === "Float") {
    return n * (field.precision === "single" ? 4 : 8);
  }
  return Math.ceil((n * bitWidth(field)) / 8);
}

/** Minimum bits to hold the raw range `[minimum, maximum]`. */
function bitWidth(field: E57Field): number {
  const range = field.maximum - field.minimum;
  return range <= 0 ? 0 : Math.floor(Math.log2(range)) + 1;
}

function decodeField(field: E57Field, bytes: Uint8Array, n: number): Float64Array {
  const out = new Float64Array(n);
  if (field.type === "Float") {
    const single = field.precision === "single"; // E57 default is double
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let k = 0; k < n; k++) out[k] = single ? dv.getFloat32(k * 4, true) : dv.getFloat64(k * 8, true);
    return out;
  }
  // Integer / ScaledInteger: LSB-first bit-packed raw, then (raw + min) * scale + offset.
  const width = bitWidth(field);
  const {minimum, scale, offset} = field;
  let bitPos = 0;
  for (let k = 0; k < n; k++) {
    let raw = 0;
    for (let b = 0; b < width; b++) {
      raw |= ((bytes[bitPos >> 3] >> (bitPos & 7)) & 1) << b;
      bitPos++;
    }
    // `>>> 0` keeps widths up to 32 bits unsigned (E57 packs ≤ 32-bit fields).
    out[k] = ((raw >>> 0) + minimum) * scale + offset;
  }
  return out;
}

function concat(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) return chunks[0];
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let w = 0;
  for (const c of chunks) { out.set(c, w); w += c.length; }
  return out;
}
