/**
 * Reads a binary Autodesk FBX file into a tree of {@link FBXNode}s.
 *
 * Binary FBX layout:
 *  - 27-byte header: 21-byte magic `"Kaydara FBX Binary  \0"`, two bytes
 *    `0x1A 0x00`, then a little-endian `uint32` version at offset 23.
 *  - A sequence of node records, terminated by a null record (an all-zero
 *    record header). For version ≥ 7500 the record offset/count fields are
 *    `uint64` (and the null record is 25 bytes); below that they're `uint32`
 *    (null record 13 bytes).
 *  - Each record: `endOffset`, `numProperties`, `propertyListLen`, a `uint8`
 *    name length, the name, the property list, then (optionally) a nested
 *    record list ending in a null record.
 *  - Property: a 1-char type code then its payload. Scalars `Y C I F D L`;
 *    `S` string / `R` raw (uint32 length + bytes); typed arrays `f d l i b`
 *    (uint32 length, uint32 encoding (1 = zlib-deflated), uint32 byte length,
 *    then the data).
 *
 * @internal
 */
import {inflate} from "pako";
import type {FBXNode} from "./FBXNode";

// Binary-FBX magic: "Kaydara FBX Binary" then two spaces and a NUL byte. We
// match the printable prefix only — enough to identify a binary FBX.
const MAGIC = [0x4b, 0x61, 0x79, 0x64, 0x61, 0x72, 0x61, 0x20, 0x46, 0x42, 0x58,
               0x20, 0x42, 0x69, 0x6e, 0x61, 0x72, 0x79];

/** True if `fileData` begins with the binary-FBX magic prefix. @internal */
export function isBinaryFBX(fileData: ArrayBuffer): boolean {
  if (fileData.byteLength < 27) return false;
  const view = new DataView(fileData);
  for (let i = 0; i < MAGIC.length; i++) {
    if (view.getUint8(i) !== MAGIC[i]) return false;
  }
  return true;
}

/** Throws if `fileData` isn't a binary FBX; otherwise returns its tree root. */
export function readFBXBinary(fileData: ArrayBuffer): FBXNode {
  if (!isBinaryFBX(fileData)) {
    throw new Error("Not a binary FBX file (bad magic header)");
  }
  const view = new DataView(fileData);
  const version = view.getUint32(23, true);
  const is64 = version >= 7500;
  const nullLen = is64 ? 25 : 13;

  const root: FBXNode = {name: "", props: [], children: []};
  let offset = 27;
  while (offset < view.byteLength - nullLen) {
    const r = readNode(view, offset, is64, nullLen);
    if (!r) break;          // top-level null record
    root.children.push(r.node);
    offset = r.end;
  }
  return root;
}

interface NodeResult {
  node: FBXNode;
  end: number;
}

function readNode(view: DataView, offset: number, is64: boolean, nullLen: number): NodeResult | null {
  let p = offset;
  let endOffset: number, numProps: number, propLen: number;
  if (is64) {
    endOffset = Number(view.getBigUint64(p, true)); p += 8;
    numProps  = Number(view.getBigUint64(p, true)); p += 8;
    propLen   = Number(view.getBigUint64(p, true)); p += 8;
  } else {
    endOffset = view.getUint32(p, true); p += 4;
    numProps  = view.getUint32(p, true); p += 4;
    propLen   = view.getUint32(p, true); p += 4;
  }
  const nameLen = view.getUint8(p); p += 1;

  // A null record (all-zero header) terminates a sibling list.
  if (endOffset === 0 && numProps === 0 && propLen === 0 && nameLen === 0) {
    return null;
  }

  const name = readLatin1(view, p, nameLen); p += nameLen;

  const props: any[] = [];
  for (let i = 0; i < numProps; i++) {
    const r = readProperty(view, p);
    props.push(r.value);
    p = r.next;
  }

  const node: FBXNode = {name, props, children: []};

  // Anything left before endOffset is a nested record list (closed by a null
  // record). When properties fill the record exactly there are no children.
  while (p < endOffset - nullLen) {
    const child = readNode(view, p, is64, nullLen);
    if (!child) break;
    node.children.push(child.node);
    p = child.end;
  }

  return {node, end: endOffset};
}

function readProperty(view: DataView, p: number): {value: any; next: number} {
  const type = String.fromCharCode(view.getUint8(p)); p += 1;
  switch (type) {
    case "Y": return {value: view.getInt16(p, true),    next: p + 2};
    case "C": return {value: view.getUint8(p) !== 0,    next: p + 1};
    case "I": return {value: view.getInt32(p, true),    next: p + 4};
    case "F": return {value: view.getFloat32(p, true),  next: p + 4};
    case "D": return {value: view.getFloat64(p, true),  next: p + 8};
    case "L": return {value: Number(view.getBigInt64(p, true)), next: p + 8};
    case "S":
    case "R": {
      const len = view.getUint32(p, true); p += 4;
      if (type === "S") return {value: readLatin1(view, p, len), next: p + len};
      return {value: new Uint8Array(view.buffer.slice(view.byteOffset + p, view.byteOffset + p + len)), next: p + len};
    }
    case "f":
    case "d":
    case "l":
    case "i":
    case "b": {
      const arrayLen = view.getUint32(p, true); p += 4;
      const encoding = view.getUint32(p, true); p += 4;
      const compLen  = view.getUint32(p, true); p += 4;
      const elemSize = (type === "d" || type === "l") ? 8 : (type === "b" ? 1 : 4);

      let raw: Uint8Array;
      if (encoding === 1) {
        raw = inflate(new Uint8Array(view.buffer, view.byteOffset + p, compLen));
      } else {
        raw = new Uint8Array(view.buffer, view.byteOffset + p, arrayLen * elemSize);
      }
      // Copy into a fresh, aligned buffer before constructing the typed array
      // (the source view may be unaligned for the requested element size).
      const aligned = new Uint8Array(raw).buffer;
      let value: any;
      switch (type) {
        case "f": value = new Float32Array(aligned, 0, arrayLen); break;
        case "d": value = new Float64Array(aligned, 0, arrayLen); break;
        case "i": value = new Int32Array(aligned, 0, arrayLen); break;
        case "l": {
          const big = new BigInt64Array(aligned, 0, arrayLen);
          value = new Float64Array(arrayLen);
          for (let k = 0; k < arrayLen; k++) value[k] = Number(big[k]);
          break;
        }
        default: value = new Uint8Array(aligned, 0, arrayLen); break;   // "b"
      }
      return {value, next: p + compLen};
    }
    default:
      throw new Error(`Unknown FBX property type code '${type}' (0x${view.getUint8(p - 1).toString(16)})`);
  }
}

/** FBX names/strings are byte strings (with `\0\x01` separators); read raw. */
function readLatin1(view: DataView, p: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(p + i));
  return s;
}
