import {parseE57Header} from "../parser/parseE57Header";

function buildHeader(over: Partial<Record<string, number>> = {}): ArrayBuffer {
  const buf = new ArrayBuffer(48);
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  const sig = over.sig === 0 ? "BADSIG\0\0" : "ASTM-E57";
  for (let i = 0; i < 8; i++) u8[i] = sig.charCodeAt(i);
  dv.setUint32(8, over.versionMajor ?? 1, true);
  dv.setUint32(12, over.versionMinor ?? 0, true);
  dv.setBigUint64(16, BigInt(over.filePhysicalLength ?? 4096), true);
  dv.setBigUint64(24, BigInt(over.xmlPhysicalOffset ?? 1234), true);
  dv.setBigUint64(32, BigInt(over.xmlLogicalLength ?? 567), true);
  dv.setBigUint64(40, BigInt(over.pageSize ?? 1024), true);
  return buf;
}

describe("parseE57Header", () => {

  it("parses the 48-byte header fields (little-endian)", () => {
    const h = parseE57Header(buildHeader());
    expect(h.signature).toBe("ASTM-E57");
    expect(h.versionMajor).toBe(1);
    expect(h.filePhysicalLength).toBe(4096);
    expect(h.xmlPhysicalOffset).toBe(1234);
    expect(h.xmlLogicalLength).toBe(567);
    expect(h.pageSize).toBe(1024);
  });

  it("throws on a bad signature", () => {
    expect(() => parseE57Header(buildHeader({sig: 0}))).toThrow(/signature/);
  });

  it("throws when the buffer is too short", () => {
    expect(() => parseE57Header(new ArrayBuffer(16))).toThrow(/too short/);
  });

  it("throws on an invalid pageSize", () => {
    expect(() => parseE57Header(buildHeader({pageSize: 4}))).toThrow(/pageSize/);
  });
});
