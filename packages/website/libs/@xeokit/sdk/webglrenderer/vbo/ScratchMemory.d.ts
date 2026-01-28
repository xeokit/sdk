/**
 * Provides scratch _gpuMemoryManager for methods like TrianglesBatchingLayer setFlags() and setColors(),
 * so they don't need to allocate temporary arrays that need garbage collection.
 *
 * @private
 */
declare class ScratchMemory {
    #private;
    constructor();
    _clear(): void;
    getUInt8Array(len: number): Uint8Array;
    getFloat32Array(len: number): Float32Array;
}
/**
 * @private
 */
declare function getScratchMemory(): ScratchMemory;
/**
 * @private
 */
declare function putScratchMemory(): void;
export { getScratchMemory, putScratchMemory };
//# sourceMappingURL=ScratchMemory.d.ts.map
