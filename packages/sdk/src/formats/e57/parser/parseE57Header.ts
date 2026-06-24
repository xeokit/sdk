import type {E57Header} from "./types";

/** Bytes in the E57 file header. */
export const E57_HEADER_LENGTH = 48;

const SIGNATURE = "ASTM-E57";

/**
 * Parses the 48-byte E57 file header from the start of the file.
 *
 * Layout (little-endian): `char[8]` signature, `uint32` versionMajor,
 * `uint32` versionMinor, then four `uint64`s — filePhysicalLength,
 * xmlPhysicalOffset, xmlLogicalLength, pageSize.
 *
 * @throws if the buffer is too short or the signature isn't `"ASTM-E57"`.
 */
export function parseE57Header(fileData: ArrayBuffer): E57Header {
  if (fileData.byteLength < E57_HEADER_LENGTH) {
    throw new Error(
      `[parseE57Header] file is ${fileData.byteLength} bytes — too short for a ${E57_HEADER_LENGTH}-byte E57 header`);
  }
  const bytes = new Uint8Array(fileData, 0, E57_HEADER_LENGTH);
  let signature = "";
  for (let i = 0; i < 8; i++) signature += String.fromCharCode(bytes[i]);
  if (signature !== SIGNATURE) {
    throw new Error(`[parseE57Header] bad signature '${signature}' (expected '${SIGNATURE}') — not an E57 file`);
  }
  const view = new DataView(fileData, 0, E57_HEADER_LENGTH);
  const u64 = (off: number) => Number(view.getBigUint64(off, true));
  const header: E57Header = {
    signature,
    versionMajor: view.getUint32(8, true),
    versionMinor: view.getUint32(12, true),
    filePhysicalLength: u64(16),
    xmlPhysicalOffset: u64(24),
    xmlLogicalLength: u64(32),
    pageSize: u64(40),
  };
  if (header.pageSize <= 4) {
    throw new Error(`[parseE57Header] invalid pageSize ${header.pageSize}`);
  }
  return header;
}
