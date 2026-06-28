import {Scene} from "../../model/scene";
import {TrianglesPrimitive} from "../../base/constants";
import {GLTFExporter} from "../gltf/GLTFExporter";

const TRI = {positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2]};
const PNG = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]).buffer;

// Textured material on UV-less geometry → triplanar → texture dropped on export.
function triplanarModel() {
  const sm = new Scene().createModel({id: "m"}).value!;
  sm.createGeometry({id: "g", primitive: TrianglesPrimitive, ...TRI}); // no uvs
  sm.createTexture({id: "tex", buffers: [PNG()], mediaType: 10002});
  sm.createMaterial({id: "mat", color: [1, 1, 1], colorTextureId: "tex"});
  sm.createMesh({id: "mesh", geometryId: "g", materialId: "mat"});
  sm.createObject({id: "obj", meshIds: ["mesh"]});
  return sm;
}

describe("exporter onWarning channel", () => {

  it("routes the triplanar drop to onWarning instead of console.warn when provided", async () => {
    const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const warnings: string[] = [];

    await new GLTFExporter().write(
      {sceneModel: triplanarModel()} as any,
      {onWarning: (m: string) => warnings.push(m)},
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/triplanar/i);
    expect(consoleWarn).not.toHaveBeenCalled();
    consoleWarn.mockRestore();
  });
});
