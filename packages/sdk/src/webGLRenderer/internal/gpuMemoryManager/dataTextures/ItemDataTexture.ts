import { DataTexture } from "./DataTexture";

/**
 * DataTexture subclass that tracks dirty items for efficient GPU updates.
 */
export abstract class ItemDataTexture extends DataTexture {

  private readonly dirtyItemIndices: Set<number> = new Set<number>();

  /**
   * Marks an item as dirty, so it will be uploaded on the next update.
   * @param itemIndex Index of the item to mark as dirty.
   */
  protected setItemDirty(itemIndex: number): void {
    this.dirtyItemIndices.add(itemIndex);
  }

  /**
   * Gets the item at the given index within its portion.
   * @param itemIndex
   */
  public abstract getItem(itemIndex: number): any;

  /**
   * Cancels all pending uploads by clearing the dirty set.
   */
  public cancelUploads(): void {
    this.dirtyItemIndices.clear();
  }

  /**
   * Uploads all dirty items to the GPU as efficiently as possible.
   *
   * Internal algorithm:
   * - Dirty items are indices of items whose data has changed and needs to be uploaded to the GPU.
   * - The method sorts all dirty indices and finds contiguous runs (sequences of adjacent indices).
   * - For each run, it uploads the run in chunks, where each chunk fits within a row of the texture.
   * - This minimizes the number of WebGL `texSubImage2D` calls by uploading as large a block as possible per call.
   * - After all dirty items are uploaded, the dirty set is cleared, the texture is unbound, and update notifications are sent.
   *
   * @returns True if any uploads occurred, false otherwise.
   */
  public uploadChanges(): boolean {
    if (this.dirtyItemIndices.size === 0) {
      return false;
    }

    const startTimeMs = this.debugging ? performance.now() : 0;
    const gl = this.gl;

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    // const texelsPerItem = this.texelsPerItem;
    // const elementsPerItem = this.elementsPerItem;
    // const itemsPerRow = this.width / texelsPerItem;
    // const sortedItemIndices = Array.from(this.dirtyItemIndices).sort((a, b) => a - b);
    //
    // let runStartIdx = -1;
    // let prevIdx = -2;
    //
    // const uploadRun = (startIdx: number, endIdx: number): void => {
    //   let currentIdx = startIdx;
    //   while (currentIdx <= endIdx) {
    //     const xOffset = currentIdx % itemsPerRow;
    //     const yOffset = Math.floor(currentIdx / texelsPerItem);
    //     const rowItemsLeft = itemsPerRow - xOffset;
    //     const maxChunkItems = endIdx - currentIdx + 1;
    //     const chunkItemCount = Math.min(rowItemsLeft, maxChunkItems);
    //     const bufferStartIdx = currentIdx * elementsPerItem;
    //     const bufferEndIdx = bufferStartIdx + chunkItemCount * elementsPerItem;
    //     const pixelData = this.buffer.subarray(bufferStartIdx, bufferEndIdx);
    //     gl.texSubImage2D(
    //       gl.TEXTURE_2D,
    //       0,
    //       xOffset,
    //       yOffset,
    //       chunkItemCount,
    //       1,
    //       this.format,
    //       this.type,
    //       pixelData
    //     );
    //     currentIdx += chunkItemCount;
    //   }
    // };
    //
    // for (const itemIdx of sortedItemIndices) {
    //   if (itemIdx !== prevIdx + 1) {
    //     if (runStartIdx >= 0) {
    //       uploadRun(runStartIdx, prevIdx);
    //     }
    //     runStartIdx = itemIdx;
    //   }
    //   prevIdx = itemIdx;
    // }
    //
    // if (runStartIdx >= 0) {
    //   uploadRun(runStartIdx, prevIdx);
    // }
    //
    // if (this.debugging) {
    //   this.lastUploadTimeMS = performance.now() - startTimeMs;
    // }

    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      this.width,
      this.height,
      this.format,
      this.type,
      this.buffer
    );

    this.dirtyItemIndices.clear();
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.notifyUpdated();

    return true;
  }
}
