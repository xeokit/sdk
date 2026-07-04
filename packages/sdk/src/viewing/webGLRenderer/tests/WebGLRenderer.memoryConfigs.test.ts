import {createDefaultMemoryConfigs} from "../defaultMemoryConfigs";

describe("WebGLRenderer memory configs", () => {
  test("uses large-model defaults", () => {
    const configs = createDefaultMemoryConfigs();

    expect(configs).toMatchObject({
      maxViews: 1,
      tileSize: 200,
      maxTiles: 4096,
      maxBatches: 1000,
      maxBatchVertices: 500000,
      maxBatchIndices: 800000,
      maxBatchGeometries: 60000,
      maxBatchMeshes: 20000,
      maxBatchPrims: 400000
    });
  });

  test("merges partial overrides with defaults", () => {
    const configs = createDefaultMemoryConfigs({
      maxBatchVertices: 1000000
    });

    expect(configs.maxBatchVertices).toBe(1000000);
    expect(configs.maxBatchIndices).toBe(800000);
    expect(configs.maxBatchMeshes).toBe(20000);
    expect(configs.maxViews).toBe(1);
  });
});
