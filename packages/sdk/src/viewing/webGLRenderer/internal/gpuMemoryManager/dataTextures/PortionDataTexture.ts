import { DataTexture } from "./DataTexture";
import {SDKErrorType, SDKInternalException, type SDKResult} from "../../../../../base/core";

/**
 * Portion representing a contiguous block of items.
 */
interface Portion {
  base: number;
  size: number;
}

/**
 * Handle representing an allocated portion in the PortionDataTexture.
 */
export interface PortionHandle {
  id: number;
  base: number;
}

/**
 * DataTexture subclass that manages allocation and efficient updates of variable-sized portions.
 *
 * Each portion represents a contiguous block of items within the texture's buffer.
 * Portions can be allocated, updated, and freed dynamically.
 * The class tracks dirty portions and uploads only the changed data to the GPU.
 * Portions can also be moved during packing to eliminate fragmentation, with optional callbacks.
 * Items can be individually addressed within each portion.
 */
export abstract class PortionDataTexture extends DataTexture {

  private readonly freePortions: Portion[] = [];
  private usedPortions: Map<number, Portion> = new Map();
  private readonly portionHandles: Map<number, PortionHandle> = new Map();
  private readonly portionCallbacks: Map<number, (newBase: number) => void> = new Map();
  private readonly dirtyPortionIds: Set<number> = new Set<number>();
  private nextPortionId: number = 1;
  private uploadAllOnFlush: boolean = false;
  private isPacked: boolean = false;

  private _numItems: number = 0;

  /**
   * Number of items currently allocated.
   */
  get numItems(): number {
    return this._numItems;
  }

  /**
   * Checks if a portion of the given size can be allocated.
   * @param size Number of items in the portion.
   */
  public canGetPortion(size: number): boolean {
    if (size <= 0 || size > this.maxItems) {
      return false;
    }
    if (this.findFreeBlock(size) !== -1) {
      return true;
    }
    this.pack();
    return this.findFreeBlock(size) !== -1;
  }

  /**
   * Allocates a portion of the given size and sets its data.
   * @param data Data array (must be a multiple of elementsPerItem).
   * @param onMove Optional callback invoked if the portion is moved during packing.
   * @returns Portion handle, or null if allocation failed.
   */
  public getPortion(
    data: ArrayLike<number>,
    onMove?: (newBase: number) => void
  ): PortionHandle | null {
    const size = (data.length / this.elementsPerItem) | 0;
    if (size <= 0 || (data.length % this.elementsPerItem) !== 0) {
      throw new SDKInternalException("getPortion: data length must be a positive multiple of elementsPerItem");
    }
    let index = this.findFreeBlock(size);
    if (index === -1) {
      this.pack();
      index = this.findFreeBlock(size);
      if (index === -1) {
        return null;
      }
    }
    this._numItems += size;
    const handle = this.allocateHandleAt(index, size, onMove);
    this._setPortionData(handle, data);
    return handle;
  }

  /**
   * Gets a view of the buffer for the given portion handle.
   * @param handle Portion handle.
   */
  public getPortionView(handle: PortionHandle): ArrayLike<number> {
    const portion = this.usedPortions.get(handle.id);
    if (!portion) {
      throw new SDKInternalException("Invalid handle ID");
    }
    return this.buffer.subarray(
      portion.base * this.elementsPerItem,
      (portion.base + portion.size) * this.elementsPerItem
    );
  }

  /**
   * Sets the buffer data for the given portion handle.
   * @param handle Portion handle.
   * @param data Data to set.
   */
  private _setPortionData(handle: PortionHandle, data: ArrayLike<number>): void {
    const portion = this.usedPortions.get(handle.id);
    if (!portion) {
      throw new SDKInternalException("Invalid handle ID");
    }
    const expectedItems = portion.size;
    if ((data.length / this.elementsPerItem) !== expectedItems) {
      throw new SDKInternalException("Mismatched data length");
    }
    const offset = portion.base * this.elementsPerItem;
    this.buffer.set(data as ArrayLike<number>, offset);
    this.dirtyPortionIds.add(handle.id);
  }

  /**
   * Replaces the data for a portion, resizing the portion if needed.
   * If the new data is longer or shorter than the current portion, reallocates as needed.
   * Updates the handle's base and size if the portion moves.
   * @param handle Portion handle to update (will be mutated if moved).
   * @param data New data array (must be a multiple of elementsPerItem).
   * @returns SDKResult with updated PortionHandle.
   */
  public setPortionData(handle: PortionHandle, data: ArrayLike<number>): SDKResult<PortionHandle> {
    const portion = this.usedPortions.get(handle.id);
    if (!portion) {
      throw new SDKInternalException("Invalid handle ID");
    }
    const newSize = (data.length / this.elementsPerItem) | 0;
    if (newSize <= 0) {
      throw new SDKInternalException("New portion size must be > 0");
    }
    if (newSize === portion.size) {
      // In-place update
      this._setPortionData(handle, data);
      return { ok: true, value: handle};
    }
    // Try to grow/shrink in-place if possible
    const canGrowInPlace =
      newSize > portion.size &&
      this.freePortions.length > 0 &&
      this.freePortions.some(f =>
        f.base === portion.base + portion.size && f.size >= (newSize - portion.size)
      );
    if (canGrowInPlace) {
      // Extend into adjacent free block
      const growBy = newSize - portion.size;
      const freeIdx = this.freePortions.findIndex(f =>
        f.base === portion.base + portion.size && f.size >= growBy
      );
      if (freeIdx !== -1) {
        const free = this.freePortions[freeIdx];
        free.base += growBy;
        free.size -= growBy;
        if (free.size === 0) this.freePortions.splice(freeIdx, 1);
        portion.size = newSize;
        this._setPortionData(handle, data);
        this.dirtyPortionIds.add(handle.id);
        this._numItems += (newSize - portion.size);
        return { ok: true, value: handle  };
      }
    }
    // Otherwise, allocate a new portion, copy data, free old
    let newHandle: PortionHandle;
    try {
      newHandle = this.getPortion(data, this.portionCallbacks.get(handle.id));
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.MemoryAllocationFailed,
        error: "[PortionDataTexture] Failed to allocate new portion: " + e
      };
    }
    this._setPortionData(newHandle, data);
    this.putPortion(handle);
    // Update handle in-place
    handle.base = newHandle.base;
    handle.id = newHandle.id;
    this.portionHandles.set(handle.id, handle);
    return { ok: true, value: handle  };
  }

  /**
   * Frees the given portion handle.
   * @param handle Portion handle.
   */
  public putPortion(handle: PortionHandle): void {
    const portion = this.usedPortions.get(handle.id);
    if (!portion) {
      return;
    }
    this._numItems -= portion.size;
    this.isPacked = false;
    this.usedPortions.delete(handle.id);
    this.portionHandles.delete(handle.id);
    this.portionCallbacks.delete(handle.id);
    this.insertFreePortionSorted(portion);
    this.coalesceFree();
  }

  /**
   * Gets the item at the given index within its portion.
   * @param itemIndex
   */
  public abstract getItem(itemIndex: number): any;

  /**
   * Packs all used portions to eliminate fragmentation.
   * Moves portions to the start of the buffer and updates handles/callbacks.
   */
  private pack(): void {
    if (this.isPacked) {
      return;
    }
    const sorted = Array.from(this.usedPortions.entries()).sort(([, a], [, b]) => a.base - b.base);
    let writeHead = 0;
    const newUsed = new Map<number, Portion>();
    const elementsPerItem = this.elementsPerItem;
    for (const [id, portion] of sorted) {
      if (portion.base !== writeHead) {
        const from = portion.base * elementsPerItem;
        const to = writeHead * elementsPerItem;
        const count = portion.size * elementsPerItem;
        this.buffer.copyWithin(to, from, from + count);
        const callback = this.portionCallbacks.get(id);
        if (callback) {
          callback(writeHead);
        }
        this.uploadAllOnFlush = true;
      }
      newUsed.set(id, { base: writeHead, size: portion.size });
      const handle = this.portionHandles.get(id);
      if (handle) {
        handle.base = writeHead;
      }
      writeHead += portion.size;
    }
    this.usedPortions = newUsed;
    this.freePortions.length = 0;
    if (writeHead < this.maxItems) {
      this.freePortions.push({ base: writeHead, size: this.maxItems - writeHead });
    }
    this.isPacked = true;
  }

  /**
   * Allocates a handle for a portion at the given free block index.
   * @param index Index in freePortions array.
   * @param size Number of items in the portion.
   * @param onMove Optional move callback.
   */
  private allocateHandleAt(
    index: number,
    size: number,
    onMove?: (newBase: number) => void
  ): PortionHandle {
    const block = this.freePortions[index];
    const id = ++this.nextPortionId;
    const portion: Portion = { base: block.base, size };
    this.usedPortions.set(id, portion);
    if (size === block.size) {
      this.freePortions.splice(index, 1);
    } else {
      block.base += size;
      block.size -= size;
    }
    const handle: PortionHandle = { id, base: portion.base };
    this.portionHandles.set(id, handle);
    if (onMove) {
      this.portionCallbacks.set(id, onMove);
    }
    return handle;
  }

  /**
   * Finds a free block of at least the given size.
   * @param size Number of items required.
   */
  private findFreeBlock(size: number): number {
    return this.freePortions.findIndex((block) => block.size >= size);
  }

  /**
   * Inserts a free portion into the sorted free list.
   * @param portion Portion to insert.
   */
  private insertFreePortionSorted(portion: Portion): void {
    let i = 0;
    while (i < this.freePortions.length && this.freePortions[i].base < portion.base) {
      i++;
    }
    this.freePortions.splice(i, 0, portion);
  }

  /**
   * Coalesces adjacent free portions.
   */
  private coalesceFree(): void {
    for (let i = 0; i < this.freePortions.length - 1;) {
      const a = this.freePortions[i], b = this.freePortions[i + 1];
      if (a.base + a.size === b.base) {
        a.size += b.size;
        this.freePortions.splice(i + 1, 1);
      } else {
        i++;
      }
    }
  }

  /**
   * Cancels all pending uploads.
   */
  public cancelUploads(): void {
    this.dirtyPortionIds.clear();
    this.uploadAllOnFlush = false;
  }

  /**
   * Uploads all dirty portions to the GPU as efficiently as possible.
   *
   * Internal algorithm:
   * - If a full flush is needed, uploads the entire buffer.
   * - Otherwise, collects all dirty portions, sorts and coalesces them.
   * - For each coalesced segment, uploads row-split chunks using texSubImage2D.
   * - Clears dirty set and notifies update.
   *
   * @returns True if any uploads occurred, false otherwise.
   */
  public uploadChanges(): boolean {
    if (this.dirtyPortionIds.size === 0 && !this.uploadAllOnFlush) {
      return false;
    }

    const startTimeMs = this.debugging ? performance.now() : 0;
    const gl = this.gl;

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    if (this.uploadAllOnFlush) {
      // Full reupload — used after pack() moved portions around, so every
      // texel may have changed.
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, this.format, this.type, this.buffer);
    } else {
      // Upload only the dirty portions: gather them, coalesce adjacent runs,
      // then split each run at texture-row boundaries (one texSubImage2D per
      // row-span). An item spans `texelsPerItem` consecutive texels, and the
      // texture is `width` texels wide, so all row/column maths is done in
      // texels (not items) — otherwise textures with texelsPerItem > 1 (e.g.
      // the 4-texel splat record) land at the wrong texels.
      const texelsPerItem = this.texelsPerItem;
      const texelsPerRow = this.width;
      const elementsPerTexel = this.elementsPerTexel;
      const segments: Portion[] = [];
      for (const id of this.dirtyPortionIds) {
        const portion = this.usedPortions.get(id);
        if (portion) {
          segments.push({base: portion.base, size: portion.size});
        }
      }
      segments.sort((a, b) => a.base - b.base);
      const coalesced: Portion[] = [];
      for (const seg of segments) {
        const last = coalesced[coalesced.length - 1];
        if (last && (last.base + last.size) === seg.base) {
          last.size += seg.size;
        } else {
          coalesced.push({base: seg.base, size: seg.size});
        }
      }
      for (const portion of coalesced) {
        let texelBase = portion.base * texelsPerItem;
        let remainingTexels = portion.size * texelsPerItem;
        while (remainingTexels > 0) {
          const xOffset = texelBase % texelsPerRow;
          const yOffset = Math.floor(texelBase / texelsPerRow);
          const chunkTexels = Math.min(remainingTexels, texelsPerRow - xOffset);
          const bufferStart = texelBase * elementsPerTexel;
          const bufferEnd = (texelBase + chunkTexels) * elementsPerTexel;
          const pixelData = this.buffer.subarray(bufferStart, bufferEnd);
          gl.texSubImage2D(gl.TEXTURE_2D, 0, xOffset, yOffset, chunkTexels, 1, this.format, this.type, pixelData);
          texelBase += chunkTexels;
          remainingTexels -= chunkTexels;
        }
      }
    }

    // Clear the dirty state in BOTH branches — the previous code path uploaded
    // the whole buffer but never cleared, so every frame re-uploaded everything.
    this.dirtyPortionIds.clear();
    this.uploadAllOnFlush = false;

    gl.bindTexture(gl.TEXTURE_2D, null);

    if (this.debugging) {
      this.lastUploadTimeMS = performance.now() - startTimeMs;
    }

    this.notifyUpdated();

    return true;
  }
}
