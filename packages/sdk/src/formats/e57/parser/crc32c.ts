/**
 * CRC-32C (Castagnoli, reflected polynomial `0x82F63B78`) — the checksum E57
 * stores in the last 4 bytes of every physical page. The reader can skip it,
 * but a conformant writer must emit it correctly or other tools (libE57,
 * CloudCompare) reject the file.
 *
 * Distinct from the zip CRC-32 (`0xEDB88320`) used elsewhere in the SDK.
 */
const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0x82F63B78 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32C of `bytes` (optionally a sub-range), returned as an unsigned 32-bit int. */
export function crc32c(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let crc = 0xFFFFFFFF;
  for (let i = start; i < end; i++) {
    crc = (crc >>> 8) ^ TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
