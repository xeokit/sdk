import {type MemoryConfigs, type TriangleGeometryVBOConfigs} from "./MemoryConfigs";

const DEFAULT_VBO_GEOMETRY_CONFIGS: TriangleGeometryVBOConfigs = {
  maxBatchPrims: 200000,
  allocationPolicy: "fixedCapacity"
};

const DEFAULT_MEMORY_CONFIGS: MemoryConfigs = {
  triangleGeometryStorage: "auto",
  vboGeometry: DEFAULT_VBO_GEOMETRY_CONFIGS,
  maxViews: 1,
  tileSize: 200,
  maxTiles: 4096,
  maxBatches: 1000,
  maxBatchVertices: 500000,
  maxBatchIndices: 800000,
  maxBatchGeometries: 60000,
  maxBatchMeshes: 20000,
  maxBatchPrims: 400000
};

export function createDefaultMemoryConfigs(overrides: Partial<MemoryConfigs> = {}): MemoryConfigs {
  const {vboGeometry, ...rest} = overrides;
  return {
    ...DEFAULT_MEMORY_CONFIGS,
    ...rest,
    vboGeometry: {
      ...DEFAULT_VBO_GEOMETRY_CONFIGS,
      ...(vboGeometry || {})
    }
  };
}
