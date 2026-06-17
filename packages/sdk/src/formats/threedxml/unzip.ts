/**
 * Minimal ZIP reader for `.3dxml` packages.
 *
 * A 3DXML file is a ZIP archive of XML documents (a `Manifest.xml`, a product-
 * structure model file, and one or more tessellated representation files).
 * Unlike USDZ, 3DXML entries are normally DEFLATE-compressed (method 8), so we
 * inflate via `pako` (already an SDK dependency); STORED (method 0) entries are
 * passed through.
 *
 * ZIP is little-endian. We locate the End-Of-Central-Directory record, walk the
 * central directory for the authoritative entry list, then resolve each entry's
 * bytes through its local file header (whose name/extra lengths determine where
 * the data actually starts). ZIP64 and encrypted entries are not supported.
 *
 * @internal
 */
import {inflateRaw} from "pako";

const SIG_EOCD = 0x06054b50;   // "PK\x05\x06"  end of central directory
const SIG_CDFH = 0x02014b50;   // "PK\x01\x02"  central directory file header
const SIG_LFH  = 0x04034b50;   // "PK\x03\x04"  local file header

const textDecoder = new TextDecoder();

/** The unpacked contents of a `.3dxml` package. */
export interface ZipArchive {
  /** Entry names in central-directory order. */
  names: string[];
  /** Lookup of decompressed bytes by archive-relative path. */
  byName: Map<string, Uint8Array>;
}

/** Cheap ZIP magic check (`"PK\x03\x04"`); 3DXML is a ZIP container. */
export function isZip(fileData: ArrayBuffer): boolean {
  if (!(fileData instanceof ArrayBuffer) || fileData.byteLength < 4) {
    return false;
  }
  return new DataView(fileData).getUint32(0, true) === SIG_LFH;
}

/** Unpacks a ZIP archive into its files. Throws on a non-ZIP / corrupt input. */
export function unzip(fileData: ArrayBuffer): ZipArchive {
  const view = new DataView(fileData);
  const bytes = new Uint8Array(fileData);

  const eocd = findEOCD(view);
  if (eocd < 0) {
    throw new Error("[3DXMLLoader] not a ZIP archive (no end-of-central-directory record)");
  }

  const cdCount = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);

  const names: string[] = [];
  const byName = new Map<string, Uint8Array>();

  let p = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    if (view.getUint32(p, true) !== SIG_CDFH) {
      throw new Error(`[3DXMLLoader] corrupt central directory at byte ${p}`);
    }
    const method      = view.getUint16(p + 10, true);
    const compSize    = view.getUint32(p + 20, true);
    const nameLen     = view.getUint16(p + 28, true);
    const extraLen    = view.getUint16(p + 30, true);
    const commentLen  = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = textDecoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith("/")) {
      continue;   // directory entry, no data
    }

    names.push(name);
    byName.set(name, readLocalEntry(view, bytes, localOffset, method, compSize, name));
  }

  return {names, byName};
}

function readLocalEntry(
  view: DataView, bytes: Uint8Array, localOffset: number, method: number, compSize: number, name: string,
): Uint8Array {
  if (view.getUint32(localOffset, true) !== SIG_LFH) {
    throw new Error(`[3DXMLLoader] corrupt local header for '${name}' at byte ${localOffset}`);
  }
  const nameLen  = view.getUint16(localOffset + 26, true);
  const extraLen = view.getUint16(localOffset + 28, true);
  const dataStart = localOffset + 30 + nameLen + extraLen;
  const raw = bytes.subarray(dataStart, dataStart + compSize);

  if (method === 0) {
    return raw;                  // STORED
  }
  if (method === 8) {
    return inflateRaw(raw);      // DEFLATE — the 3DXML norm
  }
  throw new Error(`[3DXMLLoader] unsupported ZIP compression method ${method} for '${name}'`);
}

/** Scans backwards for the EOCD record (it precedes an optional comment). */
function findEOCD(view: DataView): number {
  const len = view.byteLength;
  if (len < 22) {
    return -1;
  }
  const minPos = Math.max(0, len - 22 - 0xffff);
  for (let p = len - 22; p >= minPos; p--) {
    if (view.getUint32(p, true) === SIG_EOCD) {
      return p;
    }
  }
  return -1;
}

/** Decodes an archive entry's bytes as a UTF-8 string (for the XML documents). */
export function entryText(archive: ZipArchive, name: string): string | null {
  const data = archive.byName.get(name);
  return data ? textDecoder.decode(data) : null;
}
