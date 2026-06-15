import {parseSplat, SPLAT_RECORD_BYTES} from "../versions/v1/parseSplat";

// Builds a synthetic .splat buffer from known per-splat values so the byte
// layout (offsets, endianness, quat decode) is pinned exactly.
function buildSplatBuffer(splats: Array<{
  pos: [number, number, number];
  scale: [number, number, number];
  rgba: [number, number, number, number];
  quatBytes: [number, number, number, number];
}>): ArrayBuffer {
  const buf = new ArrayBuffer(splats.length * SPLAT_RECORD_BYTES);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);
  splats.forEach((s, i) => {
    const b = i * SPLAT_RECORD_BYTES;
    view.setFloat32(b, s.pos[0], true);
    view.setFloat32(b + 4, s.pos[1], true);
    view.setFloat32(b + 8, s.pos[2], true);
    view.setFloat32(b + 12, s.scale[0], true);
    view.setFloat32(b + 16, s.scale[1], true);
    view.setFloat32(b + 20, s.scale[2], true);
    u8.set(s.rgba, b + 24);
    u8.set(s.quatBytes, b + 28);
  });
  return buf;
}

describe("parseSplat", () => {
  it("derives count from byteLength / 32 and extracts all attributes", () => {
    const buf = buildSplatBuffer([
      {pos: [1, 2, 3], scale: [0.1, 0.2, 0.3], rgba: [10, 20, 30, 255], quatBytes: [128, 128, 128, 255]},
      {pos: [-4, 5, -6], scale: [1, 1, 1], rgba: [0, 128, 255, 100], quatBytes: [0, 255, 128, 128]},
    ]);

    const r = parseSplat(buf);

    expect(r.count).toBe(2);
    expect(Array.from(r.positions)).toEqual([1, 2, 3, -4, 5, -6]);
    expect(Array.from(r.scales).map(v => +v.toFixed(4))).toEqual([0.1, 0.2, 0.3, 1, 1, 1]);
    expect(Array.from(r.colors)).toEqual([10, 20, 30, 255, 0, 128, 255, 100]);
    // Quat decode: (b - 128) / 128  ->  128->0, 255->0.9921875, 0->-1.
    expect(Array.from(r.rotations).map(v => +v.toFixed(4))).toEqual([
      0, 0, 0, 0.9922,
      -1, 0.9922, 0, 0,
    ]);
  });

  it("accepts a Uint8Array view as well as a raw ArrayBuffer", () => {
    const buf = buildSplatBuffer([{pos: [7, 8, 9], scale: [2, 2, 2], rgba: [1, 2, 3, 4], quatBytes: [128, 128, 128, 255]}]);
    const r = parseSplat(new Uint8Array(buf));
    expect(r.count).toBe(1);
    expect(Array.from(r.positions)).toEqual([7, 8, 9]);
  });

  it("respects a non-zero byteOffset on a Uint8Array view", () => {
    const inner = buildSplatBuffer([{pos: [1, 1, 1], scale: [1, 1, 1], rgba: [9, 9, 9, 9], quatBytes: [128, 128, 128, 128]}]);
    // Place the 32-byte record inside a larger buffer at offset 16.
    const outer = new Uint8Array(16 + SPLAT_RECORD_BYTES);
    outer.set(new Uint8Array(inner), 16);
    const r = parseSplat(outer.subarray(16));
    expect(r.count).toBe(1);
    expect(Array.from(r.positions)).toEqual([1, 1, 1]);
    expect(Array.from(r.colors)).toEqual([9, 9, 9, 9]);
  });

  it("throws when the buffer is not a whole number of 32-byte records", () => {
    expect(() => parseSplat(new ArrayBuffer(33))).toThrow(/multiple of 32/);
  });
});
