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

    // Upload only the dirty items, not the whole texture. Each item occupies
    // `texelsPerItem` consecutive texels starting at `itemIndex * texelsPerItem`;
    // coalesce contiguous dirty items into runs, then split each run at texture
    // row boundaries (one texSubImage2D per row-span). All row/column maths is in
    // TEXELS, not items — otherwise textures with texelsPerItem > 1 land at the
    // wrong texels.
    const texelsPerItem = this.texelsPerItem;
    const texelsPerRow = this.width;
    const elementsPerTexel = this.elementsPerTexel;
    const buffer = this.buffer;

    const uploadRun = (startItem: number, count: number): void => {
      let texelBase = startItem * texelsPerItem;
      let remainingTexels = count * texelsPerItem;
      while (remainingTexels > 0) {
        const xOffset = texelBase % texelsPerRow;
        const yOffset = Math.floor(texelBase / texelsPerRow);
        const chunkTexels = Math.min(remainingTexels, texelsPerRow - xOffset);
        const bufferStart = texelBase * elementsPerTexel;
        const bufferEnd = (texelBase + chunkTexels) * elementsPerTexel;
        gl.texSubImage2D(gl.TEXTURE_2D, 0, xOffset, yOffset, chunkTexels, 1,
          this.format, this.type, buffer.subarray(bufferStart, bufferEnd));
        texelBase += chunkTexels;
        remainingTexels -= chunkTexels;
      }
    };

    const sorted = Array.from(this.dirtyItemIndices).sort((a, b) => a - b);
    let runStart = sorted[0];
    let runCount = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === runStart + runCount) {
        runCount++;
      } else {
        uploadRun(runStart, runCount);
        runStart = sorted[i];
        runCount = 1;
      }
    }
    uploadRun(runStart, runCount);

    this.dirtyItemIndices.clear();
    gl.bindTexture(gl.TEXTURE_2D, null);

    if (this.debugging) {
      this.lastUploadTimeMS = performance.now() - startTimeMs;
    }

    this.notifyUpdated();

    return true;
  }
}
