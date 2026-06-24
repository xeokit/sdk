import {assertValidGLBHeader} from "../GLTFLoader";

const GLB_MAGIC = 0x46546c67; // "glTF"

/** Build a GLB-ish buffer: `declaredLength` in the header, `actualBytes` real size. */
function glb(declaredLength: number, actualBytes: number, magic = GLB_MAGIC): ArrayBuffer {
  const buf = new ArrayBuffer(Math.max(actualBytes, 12));
  const dv = new DataView(buf);
  dv.setUint32(0, magic, true);
  dv.setUint32(4, 2, true); // version 2
  dv.setUint32(8, declaredLength, true);
  return buf;
}

describe("assertValidGLBHeader", () => {

  it("throws on a GLB whose declared length exceeds the file (the corrupt-asset case)", () => {
    // Mirrors the real Duplex/IfcOpenHouse4 glbs: huge declared length, tiny file.
    expect(() => assertValidGLBHeader(glb(951959535, 535500))).toThrow(/Corrupt GLB/);
    expect(() => assertValidGLBHeader(glb(951959535, 535500)))
      .toThrow(/declares a total length of 951959535 bytes but the file is only 535500/);
  });

  it("accepts a GLB whose declared length matches the file", () => {
    expect(() => assertValidGLBHeader(glb(2048, 2048))).not.toThrow();
  });

  it("accepts a declared length smaller than the file (trailing data is loaders.gl's call)", () => {
    expect(() => assertValidGLBHeader(glb(512, 2048))).not.toThrow();
  });

  it("ignores non-GLB binary (wrong magic — e.g. JSON .gltf) even with a bad length", () => {
    expect(() => assertValidGLBHeader(glb(999999999, 100, 0x7b226173 /* '{"as' */))).not.toThrow();
  });

  it("ignores string / object input (JSON .gltf) and undersized buffers", () => {
    expect(() => assertValidGLBHeader('{"asset":{"version":"2.0"}}')).not.toThrow();
    expect(() => assertValidGLBHeader({} as any)).not.toThrow();
    expect(() => assertValidGLBHeader(new ArrayBuffer(8))).not.toThrow();
  });

  it("handles ArrayBufferView input (Uint8Array/Buffer), not just ArrayBuffer", () => {
    const view = new Uint8Array(glb(951959535, 535500));
    expect(() => assertValidGLBHeader(view)).toThrow(/Corrupt GLB/);
    // Also when the view is offset into a larger buffer.
    const big = new Uint8Array(600000);
    big.set(new Uint8Array(glb(2048, 2048)), 0);
    expect(() => assertValidGLBHeader(big.subarray(0, 2048))).not.toThrow();
  });
});
