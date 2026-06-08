/**
 * Minimal ZIP writer for USDZ packages — the inverse of
 * {@link unpackUSDZ}.
 *
 * USDZ requires **stored** (uncompressed) entries whose file data starts
 * on a **64-byte boundary** (so a runtime can mmap them). We achieve the
 * alignment by padding each local file header's extra field; readers skip
 * the extra field by its declared length, so the padding is opaque. The
 * central directory carries no extra field (only the local data needs
 * aligning).
 *
 * CRC-32 is computed per entry so the archive is a valid ZIP.
 *
 * @internal
 */
const SIG_LFH  = 0x04034b50;
const SIG_CDFH = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const ALIGN = 64;

const textEncoder = new TextEncoder();

export interface USDZWriteEntry {
  /** Archive-relative path, e.g. `"model.usda"`. */
  name: string;
  /** File bytes (stored uncompressed). */
  data: Uint8Array;
}

/** Packs entries into a stored, 64-byte-aligned USDZ (ZIP) ArrayBuffer. */
export function packUSDZ(entries: USDZWriteEntry[]): ArrayBuffer {
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  let cdSize = 0;

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    // Pad the local extra field so the data starts on a 64-byte boundary.
    const extraLen = (ALIGN - ((offset + 30 + nameBytes.length) % ALIGN)) % ALIGN;

    const lh = new Uint8Array(30 + nameBytes.length + extraLen);
    const ldv = new DataView(lh.buffer);
    ldv.setUint32(0, SIG_LFH, true);
    ldv.setUint16(4, 20, true);            // version needed to extract
    ldv.setUint16(6, 0, true);             // flags
    ldv.setUint16(8, 0, true);             // method 0 = STORED
    ldv.setUint32(14, crc, true);          // CRC-32
    ldv.setUint32(18, size, true);         // compressed size
    ldv.setUint32(22, size, true);         // uncompressed size
    ldv.setUint16(26, nameBytes.length, true);
    ldv.setUint16(28, extraLen, true);
    lh.set(nameBytes, 30);                  // extra bytes stay zero (opaque pad)

    local.push(lh, entry.data);

    const ch = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(ch.buffer);
    cdv.setUint32(0, SIG_CDFH, true);
    cdv.setUint16(4, 20, true);            // version made by
    cdv.setUint16(6, 20, true);            // version needed
    cdv.setUint16(10, 0, true);            // method STORED
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, size, true);
    cdv.setUint32(24, size, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint32(42, offset, true);       // relative offset of local header
    ch.set(nameBytes, 46);
    central.push(ch);
    cdSize += ch.length;

    offset += lh.length + size;
  }

  const cdOffset = offset;
  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, SIG_EOCD, true);
  edv.setUint16(8, entries.length, true);
  edv.setUint16(10, entries.length, true);
  edv.setUint32(12, cdSize, true);
  edv.setUint32(16, cdOffset, true);

  const parts = [...local, ...central, eocd];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out.buffer;
}

// ── CRC-32 (IEEE 802.3, the ZIP polynomial) ─────────────────────────────

let crcTable: Uint32Array | null = null;

function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}
