import {encodeSplat} from "../versions/v1/encodeSplat";
import {parseSplat, SPLAT_RECORD_BYTES} from "../versions/v1/parseSplat";

// Mirrors the parseSplat test's builder: quatBytes are written verbatim at the
// record's rotation offset, so parseSplat decodes them in file order.
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
    view.setFloat32(b, s.pos[0], true); view.setFloat32(b + 4, s.pos[1], true); view.setFloat32(b + 8, s.pos[2], true);
    view.setFloat32(b + 12, s.scale[0], true); view.setFloat32(b + 16, s.scale[1], true); view.setFloat32(b + 20, s.scale[2], true);
    u8.set(s.rgba, b + 24);
    u8.set(s.quatBytes, b + 28);
  });
  return buf;
}

describe("encodeSplat", () => {
  it("is the exact byte-for-byte inverse of parseSplat", () => {
    // Quat bytes chosen to exercise the decode/encode endpoints: 128->0,
    // 255->0.9921875 (re-encodes to 255), 0->-1 (re-encodes to 0).
    const buf = buildSplatBuffer([
      {pos: [1, 2, 3], scale: [0.1, 0.2, 0.3], rgba: [10, 20, 30, 255], quatBytes: [128, 128, 128, 255]},
      {pos: [-4, 5, -6], scale: [1, 1, 1], rgba: [0, 128, 255, 100], quatBytes: [0, 255, 128, 128]},
    ]);

    const reencoded = encodeSplat(parseSplat(buf));

    expect(new Uint8Array(reencoded)).toEqual(new Uint8Array(buf));
  });

  it("defaults to opaque white when no colours are supplied", () => {
    const out = encodeSplat({
      count: 1,
      positions: [1, 2, 3],
      scales: [0.5, 0.5, 0.5],
      rotations: [0, 0, 0, 1], // file order [w,x,y,z] -> identity-ish
    });
    const u8 = new Uint8Array(out);
    expect(Array.from(u8.subarray(24, 28))).toEqual([255, 255, 255, 255]);
  });

  it("clamps out-of-range quaternion components to the byte range", () => {
    const out = encodeSplat({
      count: 1,
      positions: [0, 0, 0],
      scales: [0, 0, 0],
      rotations: [2, -2, 0, 0], // 2*128+128=384 -> 255 ; -2*128+128=-128 -> 0
    });
    const u8 = new Uint8Array(out);
    expect(Array.from(u8.subarray(28, 32))).toEqual([255, 0, 128, 128]);
  });
});
