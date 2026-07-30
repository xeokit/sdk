import {createDefaultMemoryConfigs} from "../defaultMemoryConfigs";
import {createMemoryConfigs} from "../createMemoryConfigs";

describe("WebGLRenderer memory configs", () => {
  test("uses large-model defaults", () => {
    const configs = createDefaultMemoryConfigs();

    expect(configs).toMatchObject({
      triangleGeometryStorage: "auto",
      maxViews: 1,
      tileSize: 200,
      maxTiles: 4096,
      maxBatches: 1000,
      maxBatchVertices: 500000,
      maxBatchIndices: 800000,
      maxBatchGeometries: 60000,
      maxBatchMeshes: 20000,
      maxBatchPrims: 400000,
      vboGeometry: {
        maxBatchPrims: 200000,
        allocationPolicy: "fixedCapacity"
      }
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
    expect(configs.triangleGeometryStorage).toBe("auto");
    expect(configs.vboGeometry).toMatchObject({
      maxBatchPrims: 200000,
      allocationPolicy: "fixedCapacity"
    });
  });

  test("merges partial VBO geometry overrides with VBO defaults", () => {
    const configs = createDefaultMemoryConfigs({
      vboGeometry: {
        maxBatchPrims: 250000
      }
    });

    expect(configs.maxBatchPrims).toBe(400000);
    expect(configs.vboGeometry).toMatchObject({
      maxBatchPrims: 250000,
      allocationPolicy: "fixedCapacity"
    });
  });

  test("derives memory configs with one-view defaults and the default VBO cap", () => {
    const configs = createMemoryConfigs({
      grossMemoryMB: 3000,
      user: {},
      device: "high",
      utilization: 0.8
    });

    expect(configs.maxViews).toBe(1);
    expect(configs.tileSize).toBe(200);
    expect(configs.vboGeometry).toMatchObject({
      maxBatchPrims: 200000,
      allocationPolicy: "fixedCapacity"
    });
  });
});
