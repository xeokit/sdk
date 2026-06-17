import {Data} from "../../../../../model/data/Data";
import {parse as parse_v6} from "../parse";
import {encode as encode_v6} from "../encode";

async function roundTrip(text: string) {
  const data1 = new Data();
  const model1 = data1.createModel({id: "src"});
  expect(model1.ok).toBe(true);
  if (model1.ok === false) throw new Error(model1.error);

  await parse_v6({fileData: text, dataModel: model1.value});

  const emitted = await encode_v6({dataModel: model1.value});

  const data2 = new Data();
  const model2 = data2.createModel({id: "rt"});
  expect(model2.ok).toBe(true);
  if (model2.ok === false) throw new Error(model2.error);

  await parse_v6({fileData: emitted, dataModel: model2.value});

  return {first: model1.value, second: model2.value, emitted};
}

describe("FDS encode round-trip", () => {

  it("preserves HEAD title", async () => {
    const {second} = await roundTrip(
      "&HEAD CHID='compartment', TITLE='Open plan' /\n"
    );
    const projects = Object.values(second.objects).filter(o => o.type === "FDSProject");
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("Open plan");
  });

  it("preserves OBST XB and SURF_ID wiring", async () => {
    const {second} = await roundTrip(
      "&SURF ID='WALL', RGB=200,180,180 /\n" +
      "&OBST XB=0.0,1.0, 0.0,2.0, 0.0,3.0, SURF_ID='WALL' /\n"
    );
    const obsts = Object.values(second.objects).filter(o => o.type === "FDSObstruction");
    expect(obsts).toHaveLength(1);
    const obst = obsts[0];
    const geom = obst.propertySets!.find(p => p.name === "Geometry")!;
    const get = (n: string) => geom.properties.find(p => p.name === n)!.value;
    expect(get("XMIN")).toBeCloseTo(0); expect(get("XMAX")).toBeCloseTo(1);
    expect(get("YMIN")).toBeCloseTo(0); expect(get("YMAX")).toBeCloseTo(2);
    expect(get("ZMIN")).toBeCloseTo(0); expect(get("ZMAX")).toBeCloseTo(3);

    // SURF_ID linking survives the round-trip as a usesSurface
    // relationship to the FDSSurface DataObject. See encode.ts:surfIdOf
    // for why the relationship lives on `related`, not `relating`.
    const rels = (obst.related as any).usesSurface;
    expect(rels).toBeDefined();
    expect(rels[0].relatedObject.type).toBe("FDSSurface");
    expect(rels[0].relatedObject.name).toBe("WALL");
  });

  it("preserves SURF colour fields", async () => {
    const {second, emitted} = await roundTrip(
      "&SURF ID='WALL', RGB=200,180,180, COLOR='RED', TRANSPARENCY=0.4 /\n"
    );
    expect(emitted).toMatch(/&SURF.*ID='WALL'.*RGB=200,180,180.*COLOR='RED'.*TRANSPARENCY=0\.4/);
    const surf = Object.values(second.objects).find(o => o.type === "FDSSurface")!;
    const fds = surf.propertySets!.find(p => p.name === "FDS")!;
    const rgb = fds.properties.find(p => p.name === "RGB")!.value as number[];
    expect(rgb).toEqual([200, 180, 180]);
    expect(fds.properties.find(p => p.name === "COLOR")!.value).toBe("RED");
    expect(fds.properties.find(p => p.name === "TRANSPARENCY")!.value).toBeCloseTo(0.4);
  });

  it("preserves HOLE XB", async () => {
    const {second} = await roundTrip(
      "&OBST XB=0,2, 0,2, 0,2, SURF_ID='WALL' /\n" +
      "&HOLE XB=0.5,1.5, 0.5,1.5, 0,2 /\n"
    );
    const holes = Object.values(second.objects).filter(o => o.type === "FDSHole");
    expect(holes).toHaveLength(1);
    const geom = holes[0].propertySets!.find(p => p.name === "Geometry")!;
    const xmin = geom.properties.find(p => p.name === "XMIN")!.value;
    expect(xmin).toBeCloseTo(0.5);
  });

  it("preserves arbitrary FDS extras as FDS propset entries", async () => {
    const {second, emitted} = await roundTrip(
      "&OBST XB=0,1, 0,1, 0,1, BULK_DENSITY=400, THICKNESS=0.012 /\n"
    );
    const obst = Object.values(second.objects).find(o => o.type === "FDSObstruction")!;
    const fds = obst.propertySets!.find(p => p.name === "FDS")!;
    expect(fds.properties.find(p => p.name === "BULK_DENSITY")!.value).toBe(400);
    expect(fds.properties.find(p => p.name === "THICKNESS")!.value).toBeCloseTo(0.012);
    expect(emitted).toContain("BULK_DENSITY=400");
    expect(emitted).toContain("THICKNESS=0.012");
  });
});
