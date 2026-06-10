import {isUSDZ, unpackUSDZ} from "../usdzArchive";
import {detectUSDLayer} from "../usdLayer";

const enc = new TextEncoder();

/**
 * Builds a minimal STORED (uncompressed) ZIP — the encoding USDZ
 * mandates — from a list of files, so the reader can be tested without a
 * real `.usdz` fixture. Layout: [local header + name + data]* then
 * [central header + name]* then EOCD.
 */
function makeStoredZip(files: Array<{name: string; data: Uint8Array}>): ArrayBuffer {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;

  for (const f of files) {
    const name = enc.encode(f.name);

    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);   // local file header sig
    lh.setUint16(4, 20, true);           // version needed
    lh.setUint16(8, 0, true);            // method = STORED
    lh.setUint32(18, f.data.length, true); // compressed size
    lh.setUint32(22, f.data.length, true); // uncompressed size
    lh.setUint16(26, name.length, true);   // name length
    lh.setUint16(28, 0, true);             // extra length

    offsets.push(offset);
    const lhBytes = new Uint8Array(lh.buffer);
    localParts.push(lhBytes, name, f.data);
    offset += lhBytes.length + name.length + f.data.length;
  }

  files.forEach((f, i) => {
    const name = enc.encode(f.name);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);   // central dir header sig
    ch.setUint16(10, 0, true);           // method = STORED
    ch.setUint32(20, f.data.length, true); // compressed size
    ch.setUint32(24, f.data.length, true); // uncompressed size
    ch.setUint16(28, name.length, true);   // name length
    ch.setUint32(42, offsets[i], true);    // local header offset
    centralParts.push(new Uint8Array(ch.buffer), name);
  });

  const cdStart = offset;
  let cdSize = 0;
  for (const part of centralParts) cdSize += part.length;

  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);       // EOCD sig
  eocd.setUint16(8, files.length, true);     // records on this disk
  eocd.setUint16(10, files.length, true);    // total records
  eocd.setUint32(12, cdSize, true);          // central dir size
  eocd.setUint32(16, cdStart, true);         // central dir offset

  const all = [...localParts, ...centralParts, new Uint8Array(eocd.buffer)];
  const total = all.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of all) { out.set(p, pos); pos += p.length; }
  return out.buffer;
}

const CRATE_HEADER = enc.encode("PXR-USDC\0\0\0\0");   // binary crate magic
const ASCII_HEADER = enc.encode("#usda 1.0\n");

describe("USDZ archive unpack + detection", () => {
  it("isUSDZ recognises the ZIP magic and rejects non-ZIP", () => {
    const zip = makeStoredZip([{name: "model.usdc", data: CRATE_HEADER}]);
    expect(isUSDZ(zip)).toBe(true);
    expect(isUSDZ(enc.encode("not a zip").buffer)).toBe(false);
    expect(isUSDZ(new ArrayBuffer(2))).toBe(false);
  });

  it("unpacks stored entries and exposes them by name", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
    const zip = makeStoredZip([
      {name: "model.usdc", data: CRATE_HEADER},
      {name: "0/textures/wood.png", data: png},
    ]);

    const archive = unpackUSDZ(zip);
    expect(archive.entries.map(e => e.name)).toEqual(["model.usdc", "0/textures/wood.png"]);
    expect(archive.byName.get("0/textures/wood.png")).toEqual(png);
  });

  it("picks the first native USD layer as the root", () => {
    const zip = makeStoredZip([
      {name: "textures/a.png", data: new Uint8Array([1])},
      {name: "scene.usdc", data: CRATE_HEADER},
      {name: "extra.usda", data: ASCII_HEADER},
    ]);
    expect(unpackUSDZ(zip).rootLayerName).toBe("scene.usdc");
  });

  it("detects a binary crate root layer", () => {
    const zip = makeStoredZip([{name: "model.usdc", data: CRATE_HEADER}]);
    const archive = unpackUSDZ(zip);
    expect(detectUSDLayer(archive.byName.get(archive.rootLayerName)!)).toBe("crate");
  });

  it("detects an ASCII usda root layer", () => {
    const zip = makeStoredZip([{name: "model.usda", data: ASCII_HEADER}]);
    const archive = unpackUSDZ(zip);
    expect(detectUSDLayer(archive.byName.get(archive.rootLayerName)!)).toBe("ascii");
  });

  it("throws a clear error on a non-ZIP buffer", () => {
    expect(() => unpackUSDZ(enc.encode("garbage").buffer)).toThrow(/end-of-central-directory/);
  });
});
