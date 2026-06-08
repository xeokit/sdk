import {packUSDZ} from "./usdzWriter";
import {unpackUSDZ, isUSDZ} from "./usdzArchive";

const enc = new TextEncoder();

describe("packUSDZ", () => {
  it("round-trips through unpackUSDZ with byte-identical contents", () => {
    const usda = enc.encode("#usda 1.0\ndef Xform \"World\" {}\n");
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

    const ab = packUSDZ([
      {name: "model.usda", data: usda},
      {name: "textures/wood.png", data: png},
    ]);

    expect(isUSDZ(ab)).toBe(true);
    const archive = unpackUSDZ(ab);
    expect(archive.entries.map(e => e.name)).toEqual(["model.usda", "textures/wood.png"]);
    expect(archive.byName.get("model.usda")).toEqual(usda);
    expect(archive.byName.get("textures/wood.png")).toEqual(png);
    expect(archive.rootLayerName).toBe("model.usda");
  });

  it("aligns each entry's data to a 64-byte boundary", () => {
    // Names of differing length would misalign without extra-field padding.
    const ab = packUSDZ([
      {name: "a.usda", data: enc.encode("hello")},
      {name: "longer/name/two.bin", data: new Uint8Array([1, 2, 3, 4, 5])},
    ]);
    const bytes = new Uint8Array(ab);
    const view = new DataView(ab);

    // Walk the local headers and check each data offset % 64 === 0.
    let p = 0;
    let checked = 0;
    while (view.getUint32(p, true) === 0x04034b50) {
      const nameLen = view.getUint16(p + 26, true);
      const extraLen = view.getUint16(p + 28, true);
      const compSize = view.getUint32(p + 18, true);
      const dataStart = p + 30 + nameLen + extraLen;
      expect(dataStart % 64).toBe(0);
      checked++;
      p = dataStart + compSize;
    }
    expect(checked).toBe(2);
    void bytes;
  });

  it("writes a correct CRC-32 the reader-independent way", () => {
    // CRC of "123456789" is the well-known 0xCBF43926.
    const ab = packUSDZ([{name: "x", data: enc.encode("123456789")}]);
    const view = new DataView(ab);
    expect(view.getUint32(14, true) >>> 0).toBe(0xcbf43926);
  });
});
