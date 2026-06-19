import {parse} from "@loaders.gl/core";
import {GLTFLoader} from "../GLTFLoader";

// The Draco decoder is injected by the caller; the loader must forward it to
// the glTF parser as `modules.draco3d`. loaders.gl owns the actual decode, so
// this verifies only the wiring by capturing the options passed to `parse`.
jest.mock("@loaders.gl/core", () => ({parse: jest.fn()}));
jest.mock("@loaders.gl/gltf", () => ({GLTFLoader: {name: "gltf"}, postProcessGLTF: (x: any) => x}));

function stubSceneModel(): any {
  const ok = () => ({ok: true, value: {id: "x"}});
  return {objects: {}, geometries: {}, createGeometry: ok, createMesh: ok, createObject: ok, createMaterial: ok, createTexture: ok};
}

describe("GLTFLoader Draco injection", () => {

  beforeEach(() => {
    (parse as jest.Mock).mockReset();
    (parse as jest.Mock).mockResolvedValue({scene: {nodes: []}, scenes: [{nodes: []}]});
  });

  it("forwards an injected dracoModule to the glTF parser as modules.draco3d", async () => {
    const draco = {createDecoderModule: () => {}};
    await new GLTFLoader().load(
      {fileData: new ArrayBuffer(8), sceneModel: stubSceneModel()} as any,
      {dracoModule: draco},
    );
    const opts = (parse as jest.Mock).mock.calls[0][2];
    expect(opts.modules.draco3d).toBe(draco);
  });

  it("passes no modules when no dracoModule is given", async () => {
    await new GLTFLoader().load(
      {fileData: new ArrayBuffer(8), sceneModel: stubSceneModel()} as any,
      {},
    );
    const opts = (parse as jest.Mock).mock.calls[0][2];
    expect(opts.modules).toBeUndefined();
  });
});
