/**
 * Minimal ZIP reader for USDZ packages.
 *
 * USDZ is an **uncompressed** ZIP: the spec mandates `STORED` (method 0)
 * entries, 64-byte aligned, so a runtime can mmap them directly. We
 * therefore need no inflate for conformant files. As a tolerance for
 * non-conformant exporters we also accept `DEFLATE` (method 8) via `pako`,
 * which the SDK already depends on.
 *
 * ZIP is little-endian. We locate the End-Of-Central-Directory record,
 * walk the central directory for the authoritative entry list, then
 * resolve each entry's bytes through its local file header — whose
 * name / extra-field lengths carry the USDZ alignment padding, so the
 * data offset can't be computed from the central directory alone.
 *
 * ZIP64 and encrypted entries are not supported (USDZ uses neither).
 *
 * @internal
 */
import {inflateRaw} from "pako";

const SIG_EOCD = 0x06054b50;   // "PK\x05\x06"  end of central directory
const SIG_CDFH = 0x02014b50;   // "PK\x01\x02"  central directory file header
const SIG_LFH  = 0x04034b50;   // "PK\x03\x04"  local file header

const textDecoder = new TextDecoder();

/** A single unpacked file within a USDZ package. */
export interface USDZEntry {
  /** Archive-relative path, e.g. `"model.usdc"` or `"0/textures/wood.png"`. */
  name: string;
  /** Decompressed file bytes. */
  data: Uint8Array;
}

/** The unpacked contents of a USDZ package. */
export interface USDZArchive {
  /** Entries in central-directory order. */
  entries: USDZEntry[];
  /** Lookup by archive path. */
  byName: Map<string, Uint8Array>;
  /**
   * The default root layer — per the USDZ spec, the first native USD file
   * (`.usdc` / `.usda` / `.usd`) in the package. Empty string if none.
   */
  rootLayerName: string;
}

/** Cheap ZIP magic check (`"PK\x03\x04"`); USDZ is a ZIP container. */
export function isUSDZ(fileData: ArrayBuffer): boolean {
  if (!(fileData instanceof ArrayBuffer) || fileData.byteLength < 4) {
    return false;
  }
  return new DataView(fileData).getUint32(0, true) === SIG_LFH;
}

/** Unpacks a USDZ (`.usdz`) ZIP package into its files. */
export function unpackUSDZ(fileData: ArrayBuffer): USDZArchive {
  const view = new DataView(fileData);
  const bytes = new Uint8Array(fileData);

  const eocd = findEOCD(view);
  if (eocd < 0) {
    throw new Error("[USDZLoader] not a ZIP archive (no end-of-central-directory record)");
  }

  const cdCount = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);

  const entries: USDZEntry[] = [];
  const byName = new Map<string, Uint8Array>();

  let p = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    if (view.getUint32(p, true) !== SIG_CDFH) {
      throw new Error(`[USDZLoader] corrupt central directory at byte ${p}`);
    }
    const method      = view.getUint16(p + 10, true);
    const compSize    = view.getUint32(p + 20, true);
    const nameLen     = view.getUint16(p + 28, true);
    const extraLen    = view.getUint16(p + 30, true);
    const commentLen  = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = textDecoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;

    // Directory entries (trailing slash) carry no data.
    if (name.endsWith("/")) {
      continue;
    }

    const data = readLocalEntry(view, bytes, localOffset, method, compSize, name);
    entries.push({name, data});
    byName.set(name, data);
  }

  return {entries, byName, rootLayerName: pickRootLayer(entries)};
}

/**
 * Resolves an entry's bytes via its local file header. The local header's
 * name + extra lengths (which include USDZ's alignment padding) determine
 * where the file data actually starts.
 */
function readLocalEntry(
  view: DataView,
  bytes: Uint8Array,
  localOffset: number,
  method: number,
  compSize: number,
  name: string,
): Uint8Array {
  if (view.getUint32(localOffset, true) !== SIG_LFH) {
    throw new Error(`[USDZLoader] corrupt local header for '${name}' at byte ${localOffset}`);
  }
  const nameLen  = view.getUint16(localOffset + 26, true);
  const extraLen = view.getUint16(localOffset + 28, true);
  const dataStart = localOffset + 30 + nameLen + extraLen;
  const raw = bytes.subarray(dataStart, dataStart + compSize);

  if (method === 0) {
    return raw;                  // STORED — the USDZ norm
  }
  if (method === 8) {
    return inflateRaw(raw);      // tolerate non-conformant DEFLATE
  }
  throw new Error(
    `[USDZLoader] unsupported ZIP compression method ${method} for '${name}' ` +
    `(USDZ requires stored/uncompressed entries)`,
  );
}

/** Scans backwards for the EOCD record (it precedes an optional comment). */
function findEOCD(view: DataView): number {
  const len = view.byteLength;
  if (len < 22) {
    return -1;
  }
  // EOCD is 22 bytes + up to a 65535-byte comment.
  const minPos = Math.max(0, len - 22 - 0xffff);
  for (let p = len - 22; p >= minPos; p--) {
    if (view.getUint32(p, true) === SIG_EOCD) {
      return p;
    }
  }
  return -1;
}

/** The first native USD layer in the package is the default root. */
function pickRootLayer(entries: USDZEntry[]): string {
  for (const e of entries) {
    if (/\.usd[ac]?$/i.test(e.name)) {
      return e.name;
    }
  }
  return "";
}
