/**
 * RVM v2 chunk writer — the inverse of `chunkReader`.
 *
 * RVM has no per-chunk size field; the parser walks tokens. So a
 * writer just emits the preamble (id + 8 unused bytes + version) for
 * each chunk and lets the caller append the chunk's bespoke payload.
 *
 * Buffers writes into a growable `Uint8Array` and resolves to an
 * `ArrayBuffer` on `finish()`. All multi-byte writes are big-endian to
 * match the format.
 *
 * @internal
 */
export class ChunkWriter {
  private _buf: Uint8Array;
  private _view: DataView;
  private _offset: number = 0;
  private _capacity: number;

  constructor(initialCapacity: number = 64 * 1024) {
    this._capacity = initialCapacity;
    this._buf  = new Uint8Array(this._capacity);
    this._view = new DataView(this._buf.buffer);
  }

  get offset(): number { return this._offset; }

  private _ensure(extra: number): void {
    if (this._offset + extra <= this._capacity) return;
    let cap = this._capacity * 2;
    while (cap < this._offset + extra) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this._buf);
    this._buf = next;
    this._view = new DataView(next.buffer);
    this._capacity = cap;
  }

  writeUint32(v: number): void {
    this._ensure(4);
    this._view.setUint32(this._offset, v >>> 0, false);
    this._offset += 4;
  }

  writeInt32(v: number): void {
    this._ensure(4);
    this._view.setInt32(this._offset, v | 0, false);
    this._offset += 4;
  }

  writeFloat32(v: number): void {
    this._ensure(4);
    this._view.setFloat32(this._offset, v, false);
    this._offset += 4;
  }

  /**
   * Writes a 4-character chunk ID. Each char takes 4 bytes (a big-
   * endian uint32 with the ASCII char in the LSB), so the ID consumes
   * 16 bytes total. Short IDs are right-padded with NULs (matches
   * AVEVA's "END:" convention).
   */
  writeChunkId(id: string): void {
    const padded = (id + "\0\0\0\0").substring(0, 4);
    for (let i = 0; i < 4; i++) this.writeUint32(padded.charCodeAt(i));
  }

  /**
   * Writes an RVM-style length-prefixed string: a uint32 word count
   * followed by the bytes, NUL-padded to a 4-byte boundary.
   */
  writeString(s: string): void {
    const bytes = (s.length + 3) & ~3;
    const words = bytes >>> 2;
    this.writeUint32(words);
    this._ensure(bytes);
    for (let i = 0; i < s.length; i++) this._buf[this._offset + i] = s.charCodeAt(i);
    for (let i = s.length; i < bytes; i++) this._buf[this._offset + i] = 0;
    this._offset += bytes;
  }

  /**
   * Writes the 28-byte chunk preamble: 16-byte id + 8 unused bytes +
   * 4-byte version. The caller is responsible for writing whatever
   * payload the chunk type carries.
   */
  writeChunkHeader(id: string, version: number): void {
    this.writeChunkId(id);
    this.writeUint32(0); // unused
    this.writeUint32(0); // unused
    this.writeUint32(version);
  }

  /**
   * Returns a tightly-trimmed ArrayBuffer holding the bytes written
   * so far.
   */
  finish(): ArrayBuffer {
    return this._buf.buffer.slice(0, this._offset);
  }
}
