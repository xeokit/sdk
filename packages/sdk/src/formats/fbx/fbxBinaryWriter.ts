/**
 * Serialises an FBX node tree to binary FBX bytes — the inverse of
 * {@link readFBXBinary}.
 *
 * Emits the version-7400 layout: 27-byte header, then records with 32-bit
 * `endOffset` / `numProperties` / `propertyListLen` fields and 13-byte null
 * terminators. That's exactly what {@link readFBXBinary} reads back, so a tree
 * written here round-trips through the reader unchanged.
 *
 * Properties are explicitly typed (`I` int32, `L` int64, `D` float64, `S`
 * string, `R` raw bytes, `d` float64 array, `i` int32 array) — encoded values
 * lose their FBX type code on read, so the writer takes typed props rather than
 * trying to re-infer types from decoded values.
 *
 * @internal
 */

export type FBXProp =
  | {t: "I"; v: number}
  | {t: "L"; v: number}
  | {t: "D"; v: number}
  | {t: "S"; v: string}
  | {t: "R"; v: Uint8Array<any>}
  | {t: "d"; v: ArrayLike<number>}
  | {t: "i"; v: ArrayLike<number>};

export interface FBXWriteNode {
  name: string;
  props: FBXProp[];
  children: FBXWriteNode[];
}

const FBX_VERSION = 7400;

/** Typed-property builders. */
export const fbxI    = (v: number): FBXProp => ({t: "I", v});
export const fbxL    = (v: number): FBXProp => ({t: "L", v});
export const fbxD    = (v: number): FBXProp => ({t: "D", v});
export const fbxS    = (v: string): FBXProp => ({t: "S", v});
export const fbxR    = (v: Uint8Array<any>): FBXProp => ({t: "R", v});
export const fbxDArr = (v: ArrayLike<number>): FBXProp => ({t: "d", v});
export const fbxIArr = (v: ArrayLike<number>): FBXProp => ({t: "i", v});

export const fbxNode = (
  name: string,
  props: FBXProp[] = [],
  children: FBXWriteNode[] = [],
): FBXWriteNode => ({name, props, children});

/** A leaf record carrying a single property, e.g. `Normals`, `RelativeFilename`. */
export const fbxLeaf = (name: string, prop: FBXProp): FBXWriteNode => ({name, props: [prop], children: []});

/**
 * Serialises top-level FBX nodes (e.g. `Objects`, `Connections`) to binary FBX
 * bytes.
 */
export function writeFBXBinary(nodes: FBXWriteNode[]): ArrayBuffer {
  const parts: Uint8Array<any>[] = [makeHeader(FBX_VERSION)];
  let offset = 27;
  for (const node of nodes) {
    const b = encodeNode(node, offset);
    parts.push(b);
    offset += b.length;
  }
  parts.push(new Uint8Array(13));   // top-level null record closes the document
  const out = concat(parts);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

function makeHeader(version: number): Uint8Array<any> {
  const b = new Uint8Array(27);
  const magic = "Kaydara FBX Binary  ";   // 18 chars + 2 spaces = 20 bytes
  for (let i = 0; i < magic.length; i++) b[i] = magic.charCodeAt(i);
  b[20] = 0x00; b[21] = 0x1a; b[22] = 0x00;
  new DataView(b.buffer).setUint32(23, version, true);
  return b;
}

function encodeNode(node: FBXNodeBytes, start: number): Uint8Array<any> {
  const propBytes = concat(node.props.map(encodeProp));
  let childStart = start + 13 + node.name.length + propBytes.length;
  const childBuffers: Uint8Array<any>[] = [];
  for (const ch of node.children) {
    const cb = encodeNode(ch, childStart);
    childBuffers.push(cb);
    childStart += cb.length;
  }
  const childrenBytes = node.children.length > 0
    ? concat([...childBuffers, new Uint8Array(13)])   // null record closes a child list
    : new Uint8Array(0);

  const endOffset = start + 13 + node.name.length + propBytes.length + childrenBytes.length;

  const header = new Uint8Array(13 + node.name.length);
  const dv = new DataView(header.buffer);
  dv.setUint32(0, endOffset, true);
  dv.setUint32(4, node.props.length, true);
  dv.setUint32(8, propBytes.length, true);
  dv.setUint8(12, node.name.length);
  for (let i = 0; i < node.name.length; i++) header[13 + i] = node.name.charCodeAt(i);

  return concat([header, propBytes, childrenBytes]);
}

type FBXNodeBytes = FBXWriteNode;

function encodeProp(p: FBXProp): Uint8Array<any> {
  switch (p.t) {
    case "I": { const b = new Uint8Array(5); const d = new DataView(b.buffer); d.setUint8(0, 0x49); d.setInt32(1, p.v, true); return b; }
    case "L": { const b = new Uint8Array(9); const d = new DataView(b.buffer); d.setUint8(0, 0x4c); d.setBigInt64(1, BigInt(Math.trunc(p.v)), true); return b; }
    case "D": { const b = new Uint8Array(9); const d = new DataView(b.buffer); d.setUint8(0, 0x44); d.setFloat64(1, p.v, true); return b; }
    case "S": {
      const s = p.v;
      const b = new Uint8Array(5 + s.length); const d = new DataView(b.buffer);
      d.setUint8(0, 0x53); d.setUint32(1, s.length, true);
      for (let i = 0; i < s.length; i++) b[5 + i] = s.charCodeAt(i) & 0xff;
      return b;
    }
    case "R": {
      const a = p.v;
      const b = new Uint8Array(5 + a.length); const d = new DataView(b.buffer);
      d.setUint8(0, 0x52); d.setUint32(1, a.length, true);
      b.set(a, 5);
      return b;
    }
    case "d": {
      const a = p.v; const n = a.length;
      const b = new Uint8Array(13 + n * 8); const d = new DataView(b.buffer);
      d.setUint8(0, 0x64); d.setUint32(1, n, true); d.setUint32(5, 0, true); d.setUint32(9, n * 8, true);
      for (let i = 0; i < n; i++) d.setFloat64(13 + i * 8, a[i], true);
      return b;
    }
    case "i": {
      const a = p.v; const n = a.length;
      const b = new Uint8Array(13 + n * 4); const d = new DataView(b.buffer);
      d.setUint8(0, 0x69); d.setUint32(1, n, true); d.setUint32(5, 0, true); d.setUint32(9, n * 4, true);
      for (let i = 0; i < n; i++) d.setInt32(13 + i * 4, a[i], true);
      return b;
    }
  }
}

function concat(parts: Uint8Array<any>[]): Uint8Array<any> {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
