/**
 * Provides scratch memory for methods like TrianglesBatchingLayer setFlags() and setColors(),
 * so they don't need to allocate temporary arrays that need garbage collection.
 *
 * @private
 */
class ScratchMemory {
    #uint8Arrays: { [key: string]: Uint8Array };
    private _float32Arrays: { [key: string]: Float32Array };

    constructor() {
        this.#uint8Arrays = {};
        this._float32Arrays = {};
    }

    _clear() {
        this.#uint8Arrays = {};
        this._float32Arrays = {};
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
        let float32Array = this._float32Arrays[len];
        if (!float32Array) {
            float32Array = new Float32Array(len);
            this._float32Arrays[len] = float32Array;
        }
        return float32Array;
    }
}

const batchingLayerScratchMemory = new ScratchMemory();

let countUsers = 0;

/**
 * @private
 */
function getScratchMemory() {
    countUsers++;
    return batchingLayerScratchMemory;
}

/**
 * @private
 */
function putScratchMemory() {
    if (countUsers === 0) {
        return;
    }
    countUsers--;
    if (countUsers === 0) {
        batchingLayerScratchMemory._clear();
    }
}

export {getScratchMemory, putScratchMemory, ScratchMemory};