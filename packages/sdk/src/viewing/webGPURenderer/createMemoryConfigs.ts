import {type MemoryConfigs} from "./MemoryConfigs";

/**
 * Generates WebGPU renderer memory configuration values.
 *
 * The shape follows {@link webGLRenderer!MemoryConfigs} where the two renderers
 * share a batching responsibility, while omitting WebGL-only RTC tile settings.
 */
export function createMemoryConfigs(params: {
  grossMemoryMB: number;
  user?: Partial<MemoryConfigs>;
  device: "low" | "medium" | "high";
  utilization: number;
}): MemoryConfigs {
  const user = params.user ?? {};
  const maxViews = user.maxViews ?? 1;

  const preset = {
    low: {
      maxBatches: 64,
      maxBatchVertices: 75000,
      maxBatchIndices: 225000,
      maxBatchGeometries: 2048,
      maxBatchMeshes: 2048,
      maxBatchPrims: 75000,
      maxBatchBuildTimeMs: 4,
      maxBatchBuildSegments: -1
    },
    medium: {
      maxBatches: 128,
      maxBatchVertices: 150000,
      maxBatchIndices: 450000,
      maxBatchGeometries: 4096,
      maxBatchMeshes: 4096,
      maxBatchPrims: 150000,
      maxBatchBuildTimeMs: 6,
      maxBatchBuildSegments: -1
    },
    high: {
      maxBatches: 256,
      maxBatchVertices: 300000,
      maxBatchIndices: 900000,
      maxBatchGeometries: 8192,
      maxBatchMeshes: 8192,
      maxBatchPrims: 300000,
      maxBatchBuildTimeMs: 10,
      maxBatchBuildSegments: -1
    }
  }[params.device];

  const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(value, max));
  const usableBytes = Math.max(1, params.grossMemoryMB * 1024 * 1024 * params.utilization);

  // Approximate packed triangle storage: position vec3, mesh index, and uint32 index topology.
  const bytesPerVertex = 16;
  const bytesPerIndex = 4;
  const maxVerticesByBudget = Math.floor((usableBytes * 0.2) / bytesPerVertex);
  const maxIndicesByBudget = Math.floor((usableBytes * 0.2) / bytesPerIndex);

  const maxBatchVertices = user.maxBatchVertices ?? clamp(
    Math.min(preset.maxBatchVertices, maxVerticesByBudget),
    10000,
    1000000
  );
  const maxBatchIndices = user.maxBatchIndices ?? clamp(
    Math.min(preset.maxBatchIndices, maxIndicesByBudget),
    30000,
    3000000
  );
  const maxBatchPrims = user.maxBatchPrims ?? clamp(
    Math.min(preset.maxBatchPrims, Math.floor(maxBatchIndices / 3)),
    10000,
    1000000
  );
  const maxBatchGeometries = user.maxBatchGeometries ?? preset.maxBatchGeometries;
  const maxBatchMeshes = user.maxBatchMeshes ?? Math.min(preset.maxBatchMeshes, maxBatchGeometries);

  return {
    maxViews,
    tileSize: user.tileSize ?? 200,
    maxTiles: user.maxTiles ?? 4096,
    maxBatches: user.maxBatches ?? preset.maxBatches,
    maxBatchVertices,
    maxBatchIndices,
    maxBatchGeometries,
    maxBatchMeshes,
    maxBatchPrims,
    maxBatchBuildTimeMs: user.maxBatchBuildTimeMs ?? preset.maxBatchBuildTimeMs,
    maxBatchBuildSegments: user.maxBatchBuildSegments ?? preset.maxBatchBuildSegments,
    frustumCulling: user.frustumCulling ?? false,
    minProjectedCanvasSize: user.minProjectedCanvasSize ?? 0,
    compactSealedStreamPages: user.compactSealedStreamPages ?? true,
    compactStreamPages: user.compactStreamPages ?? false
  };
}
