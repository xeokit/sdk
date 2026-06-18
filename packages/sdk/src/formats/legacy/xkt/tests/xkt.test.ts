import * as fs from "fs";
import * as path from "path";
import {Scene} from "../../../../model/scene/Scene";
import {Data} from "../../../../model/data/Data";
import {XKTLoader} from "../XKTLoader";

// Integration test against a real XKT v12 file: the classic Duplex BIM model
// produced by xeokit-convert (vendored from the xeokit website models). It
// exercises the uncompressed offset-table container, instanced + single-use
// geometry decode, and metadata → DataModel mapping.

const XKT = path.resolve(__dirname, "fixtures/Duplex.xkt");

async function loadDuplex() {
  const bytes = fs.readFileSync(XKT);
  const fileData = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const sceneModel = new Scene().createModel({id: "duplex"}).value!;
  const dataModel = new Data().createModel({id: "duplex"}).value!;
  await new XKTLoader().load({fileData, sceneModel, dataModel}, {});
  return {sceneModel, dataModel};
}

describe("XKTLoader — XKT v12", () => {
  it("detects version 12 from the header", () => {
    const bytes = fs.readFileSync(XKT);
    expect(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true)).toBe(12);
  });

  it("loads geometries, instanced meshes, and objects into the SceneModel", async () => {
    const {sceneModel} = await loadDuplex();
    // 382 pooled geometries / 872 meshes, less one degenerate geometry and the
    // single mesh that referenced it. Instancing is in play (meshes > geometries).
    expect(Object.keys(sceneModel.geometries).length).toBe(381);
    expect(Object.keys(sceneModel.meshes).length).toBe(871);
    // One SceneObject per entity that produced at least one mesh.
    expect(Object.keys(sceneModel.objects).length).toBe(237);
  });

  it("maps metadata metaObjects into the DataModel as an object tree", async () => {
    const {dataModel} = await loadDuplex();
    expect(Object.keys(dataModel.objects).length).toBe(238);
    // At least one aggregation relationship links a child to its parent.
    const aggregations = dataModel.relationships.filter((r: any) => r.type === "BasicAggregation");
    expect(aggregations.length).toBeGreaterThan(0);
  });

  it("links SceneObjects to DataObjects by shared id", async () => {
    const {sceneModel, dataModel} = await loadDuplex();
    const sceneObjectIds = Object.keys(sceneModel.objects);
    const linked = sceneObjectIds.filter(id => dataModel.objects[id]);
    // Every loaded SceneObject is an XKT entity with matching metadata.
    expect(linked.length).toBe(sceneObjectIds.length);
  });
});
