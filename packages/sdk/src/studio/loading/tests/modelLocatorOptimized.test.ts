import {DefaultModelLocator, optimizedSetFromIndex} from "../ModelLocator";

describe("DefaultModelLocator optimized resolution", () => {

  it("resolves the original file when no optimized set is given", () => {
    const loc = new DefaultModelLocator("models");
    expect(loc.resolve("Box", "xgf")).toBe("models/Box/xgf/model.xgf");
    expect(loc.resolve("Box", "gltf")).toBe("models/Box/gltf/model.glb"); // gltf → glb ext
  });

  it("resolves the optimized file only for (modelId, format) pairs in the set", () => {
    const loc = new DefaultModelLocator("models", undefined, new Set(["Box/xgf", "Box/gltf"]));
    expect(loc.resolve("Box", "xgf")).toBe("models/Box/xgf/model.optimized.xgf");
    expect(loc.resolve("Box", "gltf")).toBe("models/Box/gltf/model.optimized.glb");
    // Format not in the set → original.
    expect(loc.resolve("Box", "ifc")).toBe("models/Box/ifc/model.ifc");
    // Different model, same format → original.
    expect(loc.resolve("Other", "xgf")).toBe("models/Other/xgf/model.xgf");
  });

  it("optimizedSetFromIndex collects modelId/format from each model's `optimized` array", () => {
    const set = optimizedSetFromIndex({
      Box: {optimized: ["xgf", "gltf"]},
      Duplex: {optimized: ["ifc"]},
      Plain: {} as any,        // no optimized field
      Empty: {optimized: []},
    });
    expect([...set].sort()).toEqual(["Box/gltf", "Box/xgf", "Duplex/ifc"]);
  });

  it("optimizedSetFromIndex tolerates null/empty input", () => {
    expect(optimizedSetFromIndex(null as any).size).toBe(0);
    expect(optimizedSetFromIndex({} as any).size).toBe(0);
  });

  it("preload is idempotent and a no-op when an explicit set was supplied", async () => {
    const loc = new DefaultModelLocator("models", undefined, new Set(["Box/xgf"]));
    await loc.preload(); // should not overwrite the explicit set or throw
    expect(loc.resolve("Box", "xgf")).toBe("models/Box/xgf/model.optimized.xgf");
  });
});
