import {GaussianSplatExporter} from "../GaussianSplatExporter";
import {GaussianSplatLoader} from "../GaussianSplatLoader";
import {parseSplat, SPLAT_RECORD_BYTES} from "../versions/v1/parseSplat";
import {Scene} from "../../../model/scene/Scene";
import {GaussianSplatsPrimitive, PointsPrimitive} from "../../../base/constants";

// Build a synthetic .splat. quatBytes are in FILE order [w, x, y, z].
function buildSplatBuffer(splats: Array<{
  pos: [number, number, number];
  scale: [number, number, number];
  rgba: [number, number, number, number];
  quatBytes: [number, number, number, number]; // [w,x,y,z]
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

describe("GaussianSplatExporter", () => {
  it("round-trips a loaded .splat back to the original attributes", async () => {
    const splats = [
      {pos: [1, 2, 3], scale: [0.1, 0.2, 0.3], rgba: [255, 0, 0, 255], quatBytes: [200, 128, 128, 128] as [number, number, number, number]},
      {pos: [-4, 5, -6], scale: [1, 1, 1], rgba: [0, 255, 0, 128], quatBytes: [128, 128, 128, 255] as [number, number, number, number]},
    ];
    const buf = buildSplatBuffer(splats);

    const sceneModel = new Scene().createModel({id: "splatScene"}).value!;
    await new GaussianSplatLoader().load({fileData: buf, sceneModel} as any);

    const out = await new GaussianSplatExporter().write({sceneModel});
    const r = parseSplat(out);

    expect(r.count).toBe(2);

    // Positions survive a 16-bit quantize/dequantize round-trip — compare with a
    // tolerance derived from the AABB extent (here ~10 units / 65535).
    splats.forEach((s, i) => {
      expect(r.positions[i * 3]).toBeCloseTo(s.pos[0], 2);
      expect(r.positions[i * 3 + 1]).toBeCloseTo(s.pos[1], 2);
      expect(r.positions[i * 3 + 2]).toBeCloseTo(s.pos[2], 2);
    });

    // Scales (stored as float) and colours (RGBA8) round-trip exactly.
    expect(Array.from(r.scales).map(v => +v.toFixed(4))).toEqual([0.1, 0.2, 0.3, 1, 1, 1]);
    expect(Array.from(r.colors)).toEqual([255, 0, 0, 255, 0, 255, 0, 128]);

    // Rotation bytes round-trip exactly (8-bit encode is the exact inverse of
    // the decode). parseSplat emits file order [w, x, y, z].
    const reBytes = new Uint8Array(out);
    expect(Array.from(reBytes.subarray(28, 32))).toEqual([200, 128, 128, 128]);
    expect(Array.from(reBytes.subarray(60, 64))).toEqual([128, 128, 128, 255]);
  });

  it("rejects when no sceneModel is supplied", async () => {
    await expect(new GaussianSplatExporter().write({} as any)).rejects.toBeDefined();
  });

  it("produces an empty buffer for a model with no splat geometry", async () => {
    const sceneModel = new Scene().createModel({id: "empty"}).value!;
    const out = await new GaussianSplatExporter().write({sceneModel});
    expect(out.byteLength).toBe(0);
  });

  it("concatenates multiple splat geometries and ignores non-splat geometry", async () => {
    const sceneModel = new Scene().createModel({id: "mixed"}).value!;
    // A non-splat geometry that must be skipped by the exporter.
    sceneModel.createGeometry({
      id: "points",
      primitive: PointsPrimitive,
      positions: [0, 0, 0, 1, 1, 1],
    });
    // Two separate splat geometries, exported in insertion order.
    sceneModel.createGeometry({
      id: "splatsA",
      primitive: GaussianSplatsPrimitive,
      positions: [0, 0, 0, 1, 0, 0],
      scales: [0.1, 0.1, 0.1, 0.2, 0.2, 0.2],
      rotations: [0, 0, 0, 1, 0, 0, 0, 1],
      colorsCompressed: [10, 20, 30, 40, 50, 60, 70, 80],
    });
    sceneModel.createGeometry({
      id: "splatsB",
      primitive: GaussianSplatsPrimitive,
      positions: [2, 0, 0, 3, 0, 0],
      scales: [1, 1, 1, 2, 2, 2],
      rotations: [0, 0, 0, 1, 0, 0, 0, 1],
      colorsCompressed: [1, 2, 3, 4, 5, 6, 7, 8],
    });

    const out = await new GaussianSplatExporter().write({sceneModel});
    const r = parseSplat(out);

    expect(r.count).toBe(4); // 2 + 2 splats; the points geometry is ignored
    // Colours concatenate A then B in insertion order.
    expect(Array.from(r.colors)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("defaults to opaque white when a splat geometry has no colours", async () => {
    const sceneModel = new Scene().createModel({id: "noColours"}).value!;
    sceneModel.createGeometry({
      id: "splats",
      primitive: GaussianSplatsPrimitive,
      positions: [0, 0, 0, 1, 0, 0],
      scales: [1, 1, 1, 1, 1, 1],
      rotations: [0, 0, 0, 1, 0, 0, 0, 1],
    });

    const out = await new GaussianSplatExporter().write({sceneModel});
    const r = parseSplat(out);

    expect(r.count).toBe(2);
    expect(Array.from(r.colors)).toEqual([255, 255, 255, 255, 255, 255, 255, 255]);
  });
});
