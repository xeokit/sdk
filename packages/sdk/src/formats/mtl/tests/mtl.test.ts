import {encode} from "../versions/v1_0/encode";
import {parse} from "../versions/v1_0/parse";

// Builds a minimal SceneModel-like stub carrying explicit SceneMaterials.
function buildSource(materials: Record<string, any>) {
  const sceneModel: any = {
    id: "myModel",
    materials,
    meshes: {},
  };
  return {sceneModel};
}

describe("MTLExporter / MTLLoader", () => {

  it("encodes SceneMaterials to MTL text with the expected lines", async () => {
    const {sceneModel} = buildSource({
      red: {id: "red", color: [1, 0, 0], opacity: 0.5},
    });

    const mtl = await encode({sceneModel} as any);

    expect(typeof mtl).toBe("string");
    expect(mtl).toContain("# WaveFront MTL");
    expect(mtl).toContain("newmtl red");
    expect(mtl).toContain("Kd 1 0 0");
    // opacity 0.5 → dissolve d=0.5, Tr=0.5
    expect(mtl).toContain("d 0.5");
    expect(mtl).toContain("Tr 0.5");
    expect(mtl).toContain("illum 2");
  });

  it("sanitises material names with whitespace", async () => {
    const {sceneModel} = buildSource({
      m1: {id: "my material", color: [0.1, 0.2, 0.3], opacity: 1},
    });
    const mtl = await encode({sceneModel} as any);
    expect(mtl).toContain("newmtl my_material");
  });

  it("emits a colour texture map when present", async () => {
    const {sceneModel} = buildSource({
      tex: {id: "tex", color: [1, 1, 1], opacity: 1, colorTexture: {src: "wood.png"}},
    });
    const mtl = await encode({sceneModel} as any);
    expect(mtl).toContain("newmtl tex");
    expect(mtl).toContain("map_Kd wood.png");
  });

  it("exports a fallback material for a mesh with no SceneMaterial", async () => {
    const sceneModel: any = {
      id: "myModel",
      materials: {},
      meshes: {
        mesh1: {id: "mesh1", color: [0, 1, 0], opacity: 0.25},
      },
    };
    const mtl = await encode({sceneModel} as any);
    expect(mtl).toContain("newmtl mesh_mesh1");
    expect(mtl).toContain("Kd 0 1 0");
    expect(mtl).toContain("d 0.25");
  });

  it("round-trips materials back through the MTLLoader", async () => {
    const {sceneModel} = buildSource({
      red: {id: "red", color: [1, 0, 0], opacity: 0.5},
      blue: {id: "blue", color: [0, 0, 1], opacity: 1},
    });

    const mtl = await encode({sceneModel} as any);

    // Re-import the exported text into a capturing stub.
    const created: any[] = [];
    const dstScene: any = {
      createMaterial: (p: any) => {
        created.push(p);
        return {ok: true, value: {}};
      },
    };

    await parse({fileData: mtl, sceneModel: dstScene} as any);

    expect(created).toHaveLength(2);

    const byId: Record<string, any> = {};
    for (const m of created) byId[m.id] = m;

    expect(byId.red).toBeDefined();
    expect(byId.red.color.map((v: number) => +v.toFixed(3))).toEqual([1, 0, 0]);
    // d=0.5 then Tr=0.5 → loader's final opacity = 1 - Tr = 0.5
    expect(byId.red.opacity).toBeCloseTo(0.5, 6);

    expect(byId.blue).toBeDefined();
    expect(byId.blue.color.map((v: number) => +v.toFixed(3))).toEqual([0, 0, 1]);
    expect(byId.blue.opacity).toBeCloseTo(1, 6);
  });
});
