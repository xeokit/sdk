import {type MemoryConfigs} from "./MemoryConfigs";
import {GPUMemoryManager} from "./internal/gpuMemoryManager/GPUMemoryManager";

/**
 *  Generates a set of GPU memory configuration values for 3D rendering,
 *  based on the provided parameters and device capabilities.
 *  This function calculates optimal limits for various GPU memory allocations,
 *  such as the number of mesh batches, tiles, vertices, indices, geometries, meshes, and primitives.
 *  These values are used to optimize memory usage and rendering performance for 3D building models,
 *  especially those with geometry similar to IFC (Industry Foundation Classes) models.
 *  @param params - Parameters for generating the GPU memory configurations.
 */
export function createMemoryConfigs(params:{
    grossMemoryMB: number,
    user: Partial<MemoryConfigs>,
    device: "low" | "medium" | "high",
    utilization: number
}): MemoryConfigs {

    const elementSizes = GPUMemoryManager.itemSizesInBytes;

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
    const maxBatchesBase = user.maxBatches ?? perf.meshBatches;
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

    const maxBatches = clamp(maxBatchesBase, 8, 1024);

    // Meshes per batch from mesh metadata budget
    const totalMeshCapacity       = Math.floor(meshBudgetBytes / BYTES_PER_MESH);
    const meshesPerBatchFromBudget =
        Math.floor(totalMeshCapacity / Math.max(1, maxBatches));

    const maxBatchMeshes = clamp(
        user.maxBatchMeshes ?? meshesPerBatchFromBudget,
        100,
        16_384
    );

    let maxBatchGeometries =
        user.maxBatchGeometries ?? maxBatchMeshes;

    // Per-batch geometry from *linked* vertex/index/prim cost
    const bytesPerBatch = maxBatches > 0
        ? geometryBudgetBytes / maxBatches
        : geometryBudgetBytes;

    const costPerVertex =
        BYTES_PER_VERTEX +
        INDICES_PER_VERTEX * BYTES_PER_INDEX +
        PRIMS_PER_VERTEX   * BYTES_PER_PRIM;

    const maxBatchVerticesRaw = Math.floor(bytesPerBatch / costPerVertex);

    const maxBatchVertices = user.maxBatchVertices ?? clamp(
        maxBatchVerticesRaw,
        100_000,
        16_000_000
    );

    const maxBatchIndices = user.maxBatchIndices ?? clamp(
        Math.floor(maxBatchVertices * INDICES_PER_VERTEX),
        100_000,
        16_000_000
    );

    const maxBatchPrims = user.maxBatchPrims ?? clamp(
        Math.floor(maxBatchVertices * PRIMS_PER_VERTEX),
        100_000,
        16_000_000
    );

    // Sanity caps: how many geometries fit with this topology
    const maxGeometriesByVerts = Math.floor(
        maxBatchVertices / AVG_VERTICES_PER_GEOMETRY
    );
    const maxGeometriesByIdx = Math.floor(
        maxBatchIndices / AVG_INDICES_PER_GEOMETRY
    );
    const maxGeometriesByPrims = Math.floor(
        maxBatchPrims / AVG_PRIMS_PER_GEOMETRY
    );

    const geomCap = Math.max(
        1,
        Math.min(maxGeometriesByVerts, maxGeometriesByIdx, maxGeometriesByPrims)
    );

    maxBatchGeometries = clamp(
        Math.min(maxBatchGeometries, geomCap),
        1,
        maxBatchGeometries
    );

    const finalMaxBatchMeshes = clamp(
        Math.min(maxBatchMeshes, maxBatchGeometries),
        100,
        16_384
    );

    const tileSize = user.tileSize ?? 1000;

    return {
        tileSize,
        maxTiles,
        maxBatches,
        maxBatchVertices,
        maxBatchIndices,
        maxBatchGeometries,
        maxBatchMeshes: finalMaxBatchMeshes,
        maxBatchPrims
    };
}
