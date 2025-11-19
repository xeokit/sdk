import {GPUMemoryConfigs} from "./GPUMemoryConfigs";
import {GPUMemoryManager} from "./viewManager/gpuMemoryManager/GPUMemoryManager";

/**
 *  Generates a set of GPU memory configuration values for 3D rendering,
 *  based on the provided parameters and device capabilities.
 *  This function calculates optimal limits for various GPU memory allocations,
 *  such as the number of mesh batches, tiles, vertices, indices, geometries, meshes, and primitives.
 *  These values are used to optimize memory usage and rendering performance for 3D building models,
 *  especially those with geometry similar to IFC (Industry Foundation Classes) models.
 *  @param params - Parameters for generating the GPU memory configurations.
 */
export function createGPUMemoryConfigs(params:{
    grossMemoryMB: number,
    user: Partial<GPUMemoryConfigs>,
    device: "low" | "medium" | "high",
    utilization: number
}): GPUMemoryConfigs {

    const elementSizes = GPUMemoryManager.elementSizesInBytes;

    const user = params.user || {};

    // Device presets (shape)
    const perf = {
        low:    { meshBatches: 64,  tiles: 256 },
        medium: { meshBatches: 128, tiles: 512 },
        high:   { meshBatches: 256, tiles: 1024 }
    }[params.device];

    // Per-element byte estimates
    const BYTES_PER_VERTEX = elementSizes.vertex;
    const BYTES_PER_INDEX  = elementSizes.index;
    const BYTES_PER_PRIM   = elementSizes.prim;
    const BYTES_PER_MESH   = elementSizes.mesh;
    const BYTES_PER_TILE   = elementSizes.tile;

    // Plausible topology ratios
    const INDICES_PER_VERTEX = 1.6; // ~1.5–1.8 is typical for triangle meshes
    const PRIMS_PER_VERTEX   = 0.8; // ~1 primitive per vertex-ish

    // Avg geometry (only for sanity caps later)
    const AVG_VERTICES_PER_GEOMETRY = 200;
    const AVG_INDICES_PER_GEOMETRY  = 400;
    const AVG_PRIMS_PER_GEOMETRY    = 200;

    const clamp = (v: number, min: number, max: number) =>
        Math.max(min, Math.min(v, max));

    const MB_TO_BYTES = 1024 * 1024;
    const grossBytes  = params.grossMemoryMB * MB_TO_BYTES;
    const usableBytes = grossBytes * params.utilization;

    // Memory splits
    const geometryBudgetBytes = usableBytes * 0.7;
    const meshBudgetBytes     = usableBytes * 0.2;
    const tileBudgetBytes     = usableBytes * 0.1;

    // Shape from device, clamped by budgets
    const maxMeshBatchesBase = user.maxMeshBatches ?? perf.meshBatches;
    const maxTilesBase       = user.maxTiles       ?? perf.tiles;

    const derivedMaxTiles = clamp(
        Math.floor(tileBudgetBytes / BYTES_PER_TILE),
        64,
        4096
    );
    const maxTiles = clamp(
        Math.min(maxTilesBase, derivedMaxTiles),
        64,
        4096
    );

    const maxMeshBatches = clamp(maxMeshBatchesBase, 8, 1024);

    // Meshes per batch from mesh metadata budget
    const totalMeshCapacity       = Math.floor(meshBudgetBytes / BYTES_PER_MESH);
    const meshesPerBatchFromBudget =
        Math.floor(totalMeshCapacity / Math.max(1, maxMeshBatches));

    const maxMeshesPerBatch = clamp(
        user.maxMeshesPerBatch ?? meshesPerBatchFromBudget,
        100,
        16_384
    );

    let maxGeometriesPerBatch =
        user.maxGeometriesPerBatch ?? maxMeshesPerBatch;

    // Per-batch geometry from *linked* vertex/index/prim cost
    const bytesPerBatch = maxMeshBatches > 0
        ? geometryBudgetBytes / maxMeshBatches
        : geometryBudgetBytes;

    const costPerVertex =
        BYTES_PER_VERTEX +
        INDICES_PER_VERTEX * BYTES_PER_INDEX +
        PRIMS_PER_VERTEX   * BYTES_PER_PRIM;

    const maxVerticesPerBatchRaw = Math.floor(bytesPerBatch / costPerVertex);

    const maxVerticesPerBatch = user.maxVerticesPerBatch ?? clamp(
        maxVerticesPerBatchRaw,
        100_000,
        16_000_000
    );

    const maxIndicesPerBatch = user.maxIndicesPerBatch ?? clamp(
        Math.floor(maxVerticesPerBatch * INDICES_PER_VERTEX),
        100_000,
        16_000_000
    );

    const maxPrimsPerBatch = user.maxPrimsPerBatch ?? clamp(
        Math.floor(maxVerticesPerBatch * PRIMS_PER_VERTEX),
        100_000,
        16_000_000
    );

    // Sanity caps: how many geometries fit with this topology
    const maxGeometriesByVerts = Math.floor(
        maxVerticesPerBatch / AVG_VERTICES_PER_GEOMETRY
    );
    const maxGeometriesByIdx = Math.floor(
        maxIndicesPerBatch / AVG_INDICES_PER_GEOMETRY
    );
    const maxGeometriesByPrims = Math.floor(
        maxPrimsPerBatch / AVG_PRIMS_PER_GEOMETRY
    );

    const geomCap = Math.max(
        1,
        Math.min(maxGeometriesByVerts, maxGeometriesByIdx, maxGeometriesByPrims)
    );

    maxGeometriesPerBatch = clamp(
        Math.min(maxGeometriesPerBatch, geomCap),
        1,
        maxGeometriesPerBatch
    );

    const finalMaxMeshesPerBatch = clamp(
        Math.min(maxMeshesPerBatch, maxGeometriesPerBatch),
        100,
        16_384
    );

    return {
        maxTiles,
        maxMeshBatches,
        maxVerticesPerBatch,
        maxIndicesPerBatch,
        maxGeometriesPerBatch,
        maxMeshesPerBatch: finalMaxMeshesPerBatch,
        maxPrimsPerBatch
    };
}
