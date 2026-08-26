import {ModelConverter} from "../ModelConverter";
import {GLTFExporter} from "../../../formats/gltf/GLTFExporter";
import {TrianglesPrimitive} from "../../../base/constants";
import {createConversionReport} from "../reporters/conversion/createConversionReport";

const PNG = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]).buffer;

// Stub loader that builds a triplanar model: a textured material on UV-less
// geometry, which the renderer samples via triplanar projection and which
// glTF cannot represent — so the exporter drops the texture and warns.
const triplanarLoader = {
  format: "stub",
  fileDataType: "arraybuffer",
  async load({sceneModel}: any) {
    sceneModel.createGeometry({id: "g", primitive: TrianglesPrimitive, positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2]});
    sceneModel.createTexture({id: "tex", buffers: [PNG()], mediaType: 10002});
    sceneModel.createMaterial({id: "mat", color: [1, 1, 1], colorTextureId: "tex"});
    sceneModel.createMesh({id: "mesh", geometryId: "g", materialId: "mat"});
    sceneModel.createObject({id: "obj", meshIds: ["mesh"]});
  },
};

describe("conversion-fidelity warnings end-to-end", () => {

  it("captures the exporter's triplanar warning into output.warnings and the conversion report", async () => {
    const converter = new ModelConverter({
      loaders: {stub: triplanarLoader as any},
      exporters: {gltf: new GLTFExporter()},
      pipelines: {p: {inputs: {in: {loader: "stub"}}, outputs: {out: {exporter: "gltf"}}}},
    } as any);

    const result = await converter.convert({pipeline: "p", inputs: {in: {fileData: new ArrayBuffer(0)}}} as any);

    const output = result.outputs.out;
    expect(output.warnings.some((w: string) => /triplanar/i.test(w))).toBe(true);

    const report = createConversionReport(result);
    expect(report.summary).toMatchObject({outputs: 1, ok: 0, lossy: 1, failed: 0});
    expect(report.summary.byOutput.out.status).toBe("lossy");
    expect(report.warnings.some((w: any) => /triplanar/i.test(w.message))).toBe(true);
  });
});
