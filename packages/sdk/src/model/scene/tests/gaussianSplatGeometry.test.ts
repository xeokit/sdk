import {Scene} from "../Scene";
import {GaussianSplatsPrimitive} from "../../../base/constants";

// Two splats: positions (3/splat), scales (3/splat), rotations (4/splat, identity
// quats xyzw), colorsCompressed (4/splat RGBA). Scales/rotations are carried
// uncompressed in P1, so they round-trip exactly.
const POSITIONS = [0, 0, 0,  1, 2, 3];
const SCALES =    [0.1, 0.2, 0.3,  1, 1, 1];
const ROTATIONS = [0, 0, 0, 1,  0, 0, 0, 1];
const COLORS =    [255, 0, 0, 255,  0, 255, 0, 128];

function splatGeomParams(id: string) {
  return {
    id,
    primitive: GaussianSplatsPrimitive,
    positions: POSITIONS,
    scales: SCALES,
    rotations: ROTATIONS,
    colorsCompressed: COLORS,
  };
}

describe("GaussianSplats geometry on SceneModel", () => {

  it("createGeometry accepts the splat primitive with no indices and stores scales/rotations", () => {
    const model = new Scene().createModel({id: "splatModel"}).value!;

    const res = model.createGeometry(splatGeomParams("splats"));

    expect(res.ok).toBe(true);
    const geom = model.geometries["splats"];
    expect(geom.primitive).toBe(GaussianSplatsPrimitive);
    expect(Array.from(geom.scales!)).toEqual(SCALES);
    expect(Array.from(geom.rotations!)).toEqual(ROTATIONS);
    expect(geom.positionsCompressed).toHaveLength(6); // 2 splats × 3, quantized to uint16
    expect(geom.indices).toBeUndefined();              // no indices for splats
  });

  it("splats flow through the standard geometry -> mesh -> object triad", () => {
    const model = new Scene().createModel({id: "m"}).value!;
    expect(model.createGeometry(splatGeomParams("g")).ok).toBe(true);
    expect(model.createMesh({id: "mesh", geometryId: "g"}).ok).toBe(true);
    expect(model.createObject({id: "obj", meshIds: ["mesh"]}).ok).toBe(true);
    expect(model.objects["obj"]).toBeDefined();
  });

  it("round-trips scales/rotations through toParams() -> fromParams()", () => {
    const src = new Scene().createModel({id: "src"}).value!;
    src.createGeometry(splatGeomParams("g"));

    const params = src.toParams().value!;

    const dst = new Scene().createModel({id: "dst"}).value!;
    expect(dst.fromParams(params).ok).toBe(true);

    const geom = dst.geometries["g"];
    expect(geom.primitive).toBe(GaussianSplatsPrimitive);
    expect(Array.from(geom.scales!)).toEqual(SCALES);
    expect(Array.from(geom.rotations!)).toEqual(ROTATIONS);
  });

  it("rejects an unknown primitive (sanity: the allow-list still gates)", () => {
    const model = new Scene().createModel({id: "m"}).value!;
    const res = model.createGeometry({id: "bad", primitive: 99999, positions: POSITIONS} as any);
    expect(res.ok).toBe(false);
  });
});
