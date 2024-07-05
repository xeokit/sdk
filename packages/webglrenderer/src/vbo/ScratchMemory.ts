/**
 * Provides scratch memory for methods like TrianglesBatchingLayer setFlags() and setColors(),
 * so they don't need to allocate temporary arrays that need garbage collection.
 *
 * @private
 */
class ScratchMemory {
    #uint8Arrays: {};
    #float32Arrays: {};

    constructor() {
        this.#uint8Arrays = {};
        this.#float32Arrays = {};
    }

    _clear(): void {
        this.#uint8Arrays = {};
        this.#float32Arrays = {};
    }

    getUInt8Array(len: number): Uint8Array {
        let uint8Array = this.#uint8Arrays[len];
        if (!uint8Array) {
            uint8Array = new Uint8Array(len);
            this.#uint8Arrays[len] = uint8Array;
        }
        return uint8Array;
    }

    getFloat32Array(len: number): Float32Array {
        let float32Array = this.#float32Arrays[len];
        if (!float32Array) {
            float32Array = new Float32Array(len);
            this.#float32Arrays[len] = float32Array;
        }
        return float32Array;
    }
}

const batchingLayerScratchMemory = new ScratchMemory();

let countUsers = 0;

/**
 * @private
 */
function getScratchMemory(): ScratchMemory {
    countUsers++;
    return batchingLayerScratchMemory;
}

/**
 * @private
 */
function putScratchMemory(): void {
    if (countUsers === 0) {
        return;
    }
    countUsers--;
    if (countUsers === 0) {
        batchingLayerScratchMemory._clear();
    }
}

export {getScratchMemory, putScratchMemory};
