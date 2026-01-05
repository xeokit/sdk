import { DataTexture } from "./DataTexture";
import { SDKInternalException } from "../../../../core";

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
   * Allocates a portion of the given size, optionally with a move callback.
   * @param size Number of items in the portion.
   * @param onMove Optional callback invoked if the portion is moved during packing.
   * @throws SDKInternalException if allocation fails.
   */
  public getPortion(size: number, onMove?: (newBase: number) => void): PortionHandle {
    this.isPacked = false;
    let index = this.findFreeBlock(size);
    if (index === -1) {
      this.pack();
      index = this.findFreeBlock(size);
      if (index === -1) {
        throw new SDKInternalException("Allocation failed");
      }
    }
    this._numItems += size;
    return this.allocateHandleAt(index, size, onMove);
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
  public setPortionData(handle: PortionHandle, data: ArrayLike<number>): void {
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
   * Fills the buffer for the given portion handle with a value.
   * @param handle Portion handle.
   * @param value Value to fill.
   */
  public fillPortion(handle: PortionHandle, value: number): void {
    const portion = this.usedPortions.get(handle.id);
    if (!portion) {
      throw new SDKInternalException("Invalid handle ID");
    }
    const offset = portion.base * this.elementsPerItem;
    const count = portion.size * this.elementsPerItem;
    this.buffer.fill(value, offset, offset + count);
    this.dirtyPortionIds.add(handle.id);
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
    const id = this.nextPortionId++;
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
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, this.format, this.type, this.buffer);
      this.dirtyPortionIds.clear();
      this.uploadAllOnFlush = false;
      gl.bindTexture(gl.TEXTURE_2D, null);
      if (this.debugging) {
        this.lastUploadTimeMS = performance.now() - startTimeMs;
      }
      this.notifyUpdated();
      return true;
    }

    // Gather segments to upload
    const itemsPerRow = this.width;
    const segments: Portion[] = [];
    for (const id of this.dirtyPortionIds) {
      const portion = this.usedPortions.get(id);
      if (portion) {
        segments.push({ base: portion.base, size: portion.size });
      }
    }
    this.dirtyPortionIds.clear();

    // Sort and coalesce adjacent segments
    segments.sort((a, b) => a.base - b.base);
    const coalesced: Portion[] = [];
    for (const seg of segments) {
      const last = coalesced[coalesced.length - 1];
      if (last && (last.base + last.size) === seg.base) {
        last.size += seg.size;
      } else {
        coalesced.push({ base: seg.base, size: seg.size });
      }
    }

    // Upload row-split chunks
    for (const portion of coalesced) {
      let base = portion.base;
      let remaining = portion.size;
      while (remaining > 0) {
        const xOffset = base % itemsPerRow;
        const yOffset = Math.floor(base / itemsPerRow);
        const chunkSize = Math.min(remaining, itemsPerRow - xOffset);
        const bufferStart = base * this.elementsPerItem;
        const bufferEnd = (base + chunkSize) * this.elementsPerItem;
        const pixelData = this.buffer.subarray(bufferStart, bufferEnd);
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          xOffset,
          yOffset,
          chunkSize,
          1,
          this.format,
          this.type,
          pixelData
        );
        base += chunkSize;
        remaining -= chunkSize;
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, null);

    if (this.debugging) {
      this.lastUploadTimeMS = performance.now() - startTimeMs;
    }

    this.notifyUpdated();

    return true;
  }
}
