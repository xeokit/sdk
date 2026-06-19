import {Data} from "../../../model/data/Data";
import {GLTFLoader} from "../GLTFLoader";

// Builds a minimal GLB carrying EXT_structural_metadata: one property table
// (class "building") with a SCALAR FLOAT32 property "height" for two features
// [1.5, 2.5], packed into the BIN chunk. loaders.gl decodes the columns; the
// loader maps each feature to a DataObject + property set.
function buildGLBWithStructuralMetadata(): ArrayBuffer {
  const bin = new Uint8Array(8);
  new Float32Array(bin.buffer).set([1.5, 2.5]);
  const gltf = {
    asset: {version: "2.0"},
    extensionsUsed: ["EXT_structural_metadata"],
    extensions: {
      EXT_structural_metadata: {
        schema: {classes: {building: {properties: {height: {type: "SCALAR", componentType: "FLOAT32"}}}}},
        propertyTables: [{class: "building", count: 2, properties: {height: {values: 0}}}],
      },
    },
    buffers: [{byteLength: 8}],
    bufferViews: [{buffer: 0, byteOffset: 0, byteLength: 8}],
    scenes: [{nodes: []}],
    scene: 0,
  };
  let json = new TextEncoder().encode(JSON.stringify(gltf));
  const jpad = (4 - (json.length % 4)) % 4;
  if (jpad) json = new Uint8Array([...json, ...new Uint8Array(jpad).fill(0x20)]);
  const total = 12 + 8 + json.length + 8 + bin.length;
  const buf = new Uint8Array(total);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, json.length, true);
  dv.setUint32(16, 0x4e4f534a, true);
  buf.set(json, 20);
  const o = 20 + json.length;
  dv.setUint32(o, bin.length, true);
  dv.setUint32(o + 4, 0x004e4942, true);
  buf.set(bin, o + 8);
  return buf.buffer;
}

describe("GLTFLoader EXT_structural_metadata", () => {

  it("maps property-table features to DataObjects with property sets", async () => {
    const dataModel = new Data().createModel({id: "m"}).value!;

    await new GLTFLoader().load(
      {fileData: buildGLBWithStructuralMetadata(), dataModel} as any,
      {},
    );

    const features = Object.values(dataModel.objects).filter(o => o.type === "building");
    expect(features.length).toBe(2);

    const heights = features
      .map(f => f.propertySets![0].properties.find(p => p.name === "height")!.value)
      .sort((a, b) => a - b);
    expect(heights[0]).toBeCloseTo(1.5, 5);
    expect(heights[1]).toBeCloseTo(2.5, 5);
  });

  it("aggregates features under dataParentId when provided", async () => {
    const dataModel = new Data().createModel({id: "m"}).value!;
    dataModel.createObject({id: "root", type: "Tileset", name: "root"});

    await new GLTFLoader().load(
      {fileData: buildGLBWithStructuralMetadata(), dataModel} as any,
      {dataParentId: "root"},
    );

    const features = Object.values(dataModel.objects).filter(o => o.type === "building");
    expect(features.length).toBe(2);
    // Each feature is related to the provided parent.
    expect(dataModel.relationships.length).toBeGreaterThanOrEqual(2);
  });
});
