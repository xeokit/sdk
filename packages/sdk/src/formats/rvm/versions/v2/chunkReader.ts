/**
 * RVM v2 chunk reader.
 *
 * RVM files are big-endian binary streams composed of chunks. Each
 * chunk has a 28-byte preamble:
 *
 *   - 16 bytes  ID  — four ASCII chars stored as four big-endian
 *                     uint32s where the char goes in the LSB. So
 *                     "HEAD" is `0x00000048 0x00000045 0x00000041
 *                     0x00000044`, NOT `'H','E','A','D'` packed.
 *   -  8 bytes  unused — pmuc's reader calls this "garbage"; it's
 *                        ignored by every known parser.
 *   -  4 bytes  version
 *
 * Crucially there is **no size field** — chunks know their own layout
 * and the reader walks token-by-token. CNTB is recursive: its
 * children are sibling chunks following the CNTB payload, terminated
 * by a matching CNTE. The top-level loop runs until the `"END"` id is
 * read.
 *
 * Strings are length-prefixed by a uint32 word count where each "word"
 * holds 4 ASCII bytes — strings are right-padded with NULs to the next
 * 4-byte boundary. Floats are 32-bit IEEE big-endian.
 *
 * @internal
 */
export class ChunkReader {
  private readonly _view: DataView;
  private _offset: number;

  constructor(buffer: ArrayBuffer, offset: number = 0) {
    this._view = new DataView(buffer);
    this._offset = offset;
  }

  get offset(): number  { return this._offset; }
  get length(): number  { return this._view.byteLength; }
  get atEnd(): boolean  { return this._offset >= this._view.byteLength; }

  seek(offset: number): void { this._offset = offset; }
  skip(bytes: number): void  { this._offset += bytes; }

  /** Reads a big-endian uint32. */
  readUint32(): number {
    const v = this._view.getUint32(this._offset, false);
    this._offset += 4;
    return v;
  }

  /** Reads a big-endian int32. */
  readInt32(): number {
    const v = this._view.getInt32(this._offset, false);
    this._offset += 4;
    return v;
  }

  /** Reads a big-endian float32. */
  readFloat32(): number {
    const v = this._view.getFloat32(this._offset, false);
    this._offset += 4;
    return v;
  }

  /** Reads `count` big-endian float32s into a fresh `Float32Array`. */
  readFloat32Array(count: number): Float32Array {
    const out = new Float32Array(count);
    for (let i = 0; i < count; i++) out[i] = this.readFloat32();
    return out;
  }

  /**
   * Reads an RVM-style length-prefixed string. The length is given as a
   * uint32 count of 4-byte words; the bytes that follow are ASCII,
   * trailing NULs stripped.
   */
  readString(): string {
    const words = this.readUint32();
    const byteCount = words * 4;
    let out = "";
    for (let i = 0; i < byteCount; i++) {
      const c = this._view.getUint8(this._offset + i);
      if (c !== 0) out += String.fromCharCode(c);
    }
    this._offset += byteCount;
    return out;
  }

  /**
   * Reads a 4-character chunk ID. Each char takes 4 bytes (a big-
   * endian uint32 with the ASCII byte in the LSB), so the ID consumes
   * 16 bytes total. Trailing nulls / spaces are stripped.
   */
  readChunkId(): string {
    let id = "";
    for (let i = 0; i < 4; i++) {
      const c = this.readUint32() & 0xff;
      if (c !== 0) id += String.fromCharCode(c);
    }
    return id.trimEnd();
  }

  /**
   * Reads the 12-byte preamble that follows every chunk's id: 8 bytes
   * of unused/reserved data + 4-byte version. Returns the version.
   */
  readChunkPreamble(): number {
    this.skip(8); // pmuc-style "garbage" — never consulted
    return this.readUint32();
  }
}
