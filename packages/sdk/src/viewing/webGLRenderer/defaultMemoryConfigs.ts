import {type MemoryConfigs} from "./MemoryConfigs";

const DEFAULT_MEMORY_CONFIGS: MemoryConfigs = {
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
  return {
    ...DEFAULT_MEMORY_CONFIGS,
    ...overrides
  };
}
