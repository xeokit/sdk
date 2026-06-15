import {GaussianSplatLoader} from "../GaussianSplatLoader";
import {SPLAT_RECORD_BYTES} from "../versions/v1/parseSplat";
import {Scene} from "../../../model/scene/Scene";
import {GaussianSplatsPrimitive} from "../../../base/constants";

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

describe("GaussianSplatLoader", () => {
  it("loads a .splat into a SceneModel as a GaussianSplats geometry + mesh + object", async () => {
    // quat file bytes [w,x,y,z] = [200,128,128,128] -> decoded w=(200-128)/128=0.5625, x=y=z=0.
    const buf = buildSplatBuffer([
      {pos: [1, 2, 3], scale: [0.1, 0.2, 0.3], rgba: [255, 0, 0, 255], quatBytes: [200, 128, 128, 128]},
      {pos: [4, 5, 6], scale: [1, 1, 1], rgba: [0, 255, 0, 128], quatBytes: [128, 128, 128, 255]},
    ]);

    const sceneModel = new Scene().createModel({id: "splatScene"}).value!;
    await new GaussianSplatLoader().load({fileData: buf, sceneModel} as any);

    const geom = sceneModel.geometries["splats"];
    expect(geom).toBeDefined();
    expect(geom.primitive).toBe(GaussianSplatsPrimitive);
    expect(geom.scales).toHaveLength(6);     // 2 splats × 3
    expect(geom.rotations).toHaveLength(8);  // 2 splats × 4
    expect(sceneModel.meshes["splatMesh"]).toBeDefined();
    expect(sceneModel.objects["splatObject"]).toBeDefined();

    // Rotation reorder: file [w,x,y,z] -> stored xyzw.
    // splat 0: file decoded (w=0.5625, x=0, y=0, z=0) -> xyzw [0,0,0,0.5625]
    expect(Array.from(geom.rotations!.slice(0, 4)).map(v => +v.toFixed(4))).toEqual([0, 0, 0, 0.5625]);
    // splat 1: file [128,128,128,255] -> w=0,x=0,y=0,z=0.9922 -> xyzw [0,0,0.9922,0]
    expect(Array.from(geom.rotations!.slice(4, 8)).map(v => +v.toFixed(4))).toEqual([0, 0, 0.9922, 0]);
  });

  it("dequantizes positions and stores scales / colours per splat", async () => {
    const buf = buildSplatBuffer([
      {pos: [1, 2, 3], scale: [0.1, 0.2, 0.3], rgba: [255, 0, 0, 255], quatBytes: [200, 128, 128, 128]},
      {pos: [4, 5, 6], scale: [1, 1, 1], rgba: [0, 255, 0, 128], quatBytes: [128, 128, 128, 255]},
    ]);

    const sceneModel = new Scene().createModel({id: "splatScene"}).value!;
    await new GaussianSplatLoader().load({fileData: buf, sceneModel} as any);

    const geom = sceneModel.geometries["splats"];
    expect(geom.positionsCompressed).toHaveLength(6); // quantized uint16, 2 splats × 3
    // Scales survive as floats; colours as the raw RGBA8 bytes.
    expect(Array.from(geom.scales!).map(v => +v.toFixed(4))).toEqual([0.1, 0.2, 0.3, 1, 1, 1]);
    expect(Array.from(geom.colorsCompressed!)).toEqual([255, 0, 0, 255, 0, 255, 0, 128]);
  });

  it("creates no orientation SceneTransform — the mesh is unparented", async () => {
    // The loader used to wrap the mesh in a Z-up-fix SceneTransform; orientation
    // is now the SceneModel coordinateSystem's job, so it must create none.
    const buf = buildSplatBuffer([
      {pos: [1, 2, 3], scale: [1, 1, 1], rgba: [1, 2, 3, 4], quatBytes: [128, 128, 128, 255]},
    ]);
    const sceneModel = new Scene().createModel({id: "splatScene"}).value!;
    await new GaussianSplatLoader().load({fileData: buf, sceneModel} as any);

    expect(Object.keys(sceneModel.transforms)).toHaveLength(0);
    expect(sceneModel.meshes["splatMesh"].parentTransform).toBeNull();
  });

  it("stands splats upright when the model is created with a Y-down coordinateSystem", async () => {
    // The documented usage: declare the .splat / COLMAP Y-down source frame on the
    // model's coordinateSystem. The resulting model->scene matrix must map the
    // source up-axis (-Y) onto the Scene's Z-up world (+Z), and +Z onto +Y.
    const sceneModel = new Scene().createModel({
      id: "splatScene",
      coordinateSystem: {
        basis: [
          1,  0, 0, // Right   (+X)
          0, -1, 0, // Up      (-Y)
          0,  0, 1, // Forward (+Z)
        ],
        origin: [0, 0, 0],
        units: "meters",
      },
    }).value!;
    const buf = buildSplatBuffer([
      {pos: [1, 2, 3], scale: [1, 1, 1], rgba: [255, 255, 255, 255], quatBytes: [128, 128, 128, 255]},
    ]);
    await new GaussianSplatLoader().load({fileData: buf, sceneModel} as any);

    const m = sceneModel.coordinateSystemMatrix; // premultiplied into every mesh matrix
    const transform = (p: [number, number, number]): number[] => [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
    ].map(v => +v.toFixed(6));

    expect(transform([0, -1, 0])).toEqual([0, 0, 1]); // source up -> world up
    expect(transform([0, 0, 1])).toEqual([0, 1, 0]);  // source +Z -> world forward
    expect(transform([1, 0, 0])).toEqual([1, 0, 0]);  // right unchanged
  });

  it("rejects a buffer that is not a whole number of 32-byte records", async () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    await expect(new GaussianSplatLoader().load({fileData: new ArrayBuffer(30), sceneModel} as any))
      .rejects.toBeDefined();
  });

  it("rejects when no sceneModel is supplied", async () => {
    const buf = buildSplatBuffer([{pos: [0, 0, 0], scale: [1, 1, 1], rgba: [0, 0, 0, 0], quatBytes: [128, 128, 128, 128]}]);
    await expect(new GaussianSplatLoader().load({fileData: buf} as any)).rejects.toBeDefined();
  });
});
