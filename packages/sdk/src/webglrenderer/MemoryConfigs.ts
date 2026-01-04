/**
 * GPU memory configuration options for the WebGLRenderer.
 *
 * This interface defines the limits for various GPU memory allocations used by the renderer,
 * such as the number of render batches, tiles, vertices, indices, geometries, meshes, and primitives.
 * These values are used to optimize memory usage and rendering performance for 3D building models,
 * especially those with geometry similar to IFC (Industry Foundation Classes) models.
 */
export interface MemoryConfigs {

    /**
     * Maximum number of RTC (Relative To Center) tiles that can be allocated in GPU memory.
     * A tile is a region of 3D space that holds RTC-relative vertex positions for a subset of meshes.
     * Tiles break up the world space into chunks, allowing vertex positions to be stored and rendered
     * with higher precision using single-precision coordinates relative to the tile origin.
     */
    maxTiles: number;

    /**
     * Maximum number of render batches that can be allocated in GPU memory.
     * A render batch is a collection of meshes that share the same primitive type and can be rendered
     * in a single draw call.
     */
    maxBatches: number;

    /**
     * Maximum number of vertices allocated in a single render batch.
     * A vertex may contain position, normal, color, and other attributes depending on the mesh type.
     */
    maxBatchVertices: number;

    /**
     * Maximum number of indices allocated in a single render batch.
     * Indices are used to define the connectivity of vertices for rendering primitives.
     */
    maxBatchIndices: number;

    /**
     * Maximum number of geometries that can be allocated in a single render batch.
     * In this context, each mesh uses exactly one geometry.
     */
    maxBatchGeometries: number;

    /**
     * Maximum number of meshes that can be allocated in a single render batch.
     * Each mesh is associated with one geometry.
     */
    maxBatchMeshes: number;

    /**
     * Maximum number of primitives (triangles, lines, or points) that can be allocated in a single render batch.
     * A primitive can be a triangle (3 indices), a line (2 indices), or a point (no indices).
     */
    maxBatchPrims: number;
}

