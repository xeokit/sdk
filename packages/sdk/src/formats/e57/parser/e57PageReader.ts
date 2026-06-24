/**
 * E57 physical→logical page layer.
 *
 * An E57 file is a sequence of `pageSize`-byte physical pages whose last 4
 * bytes are a CRC-32C of the preceding `pageSize - 4` data bytes. Every offset
 * the format records is *physical* (CRC-inclusive); reading actual content
 * means working in the *logical* stream with those CRC bytes removed.
 *
 * v1 strips the CRC bytes without verifying them (a corrupt page surfaces later
 * as a decode error); CRC-32C verification can be layered on without changing
 * this interface.
 */

/**
 * Builds the logical byte stream by concatenating each page's `pageSize - 4`
 * data bytes (dropping the trailing CRC of every page).
 */
export function buildLogicalStream(fileData: ArrayBuffer, pageSize: number): Uint8Array {
  const data = new Uint8Array(fileData);
  const dataPerPage = pageSize - 4;
  const pageCount = Math.ceil(data.length / pageSize);
  const out = new Uint8Array(pageCount * dataPerPage);
  let w = 0;
  for (let p = 0; p < pageCount; p++) {
    const start = p * pageSize;
    const end = Math.min(start + dataPerPage, data.length);
    out.set(data.subarray(start, end), w);
    w += end - start;
  }
  return out.subarray(0, w);
}

/**
 * Maps a physical offset (as recorded in the header / XML) to its index in the
 * logical stream produced by {@link buildLogicalStream}.
 */
export function physicalToLogical(physicalOffset: number, pageSize: number): number {
  const dataPerPage = pageSize - 4;
  return Math.floor(physicalOffset / pageSize) * dataPerPage + (physicalOffset % pageSize);
}

/**
 * Inverse of {@link physicalToLogical}: maps a logical-stream offset to its
 * physical (CRC-inclusive) offset. Used by the exporter to record physical
 * offsets in the header and XML.
 */
export function logicalToPhysical(logicalOffset: number, pageSize: number): number {
  const dataPerPage = pageSize - 4;
  return Math.floor(logicalOffset / dataPerPage) * pageSize + (logicalOffset % dataPerPage);
}
