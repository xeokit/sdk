/**
 * Represents a portion of a `DTXPositionsArray` allocated for storing data.
 * (One item = one vertex = 3 Uint16 components)
 */
import {SDKInternalException} from "../../../../core";

interface DTXPositionsArrayPortion {
  base: number; // item tileIndex
  size: number; // number of items (vertices)
}

/** Handle to an allocated portion */
export interface DTXPositionsArrayHandle {
  id: number;
  base: number; // item tileIndex
}

/** Options: only gl + capacity matter now */
export interface DTXPositionsArrayOptions {
  gl: WebGL2RenderingContext;
  capacity: number; // number of items (vertices)
}

/**
 * DTXPositionsArray — Uint16 positions only (XYZ per item), stored in a RGBA16UI texture.
 * - CPU _buffer layout: tightly-packed RGBRGB... (3 Uint16 per item)
 * - GPU texture layout: one texel per item (RGBA16UI), RGB = XYZ, A = 0
 */
export class DTXPositionsArray {

  /**
   * WebGL texture (RGBA16UI).
   */
  public texture: WebGLTexture;

  /**
   * CPU-side data _buffer holds 3 components per item.
   */
  public buffer: Uint16Array<any>;

  private readonly gl: WebGL2RenderingContext;
  private readonly capacity: number;

  // Geometry/packing constants
  private readonly componentsPerItem = 3; // XYZ
  private readonly texChannelsPerItem = 4; // RGBA texel, A unused
  private readonly textureWidth = 4096; // matches the example

  private used: Map<number, DTXPositionsArrayPortion> = new Map();
  private handles: Map<number, DTXPositionsArrayHandle> = new Map();
  private free: DTXPositionsArrayPortion[] = [];
  private portionCallbacks: Map<number, ( newBase: number ) => void> = new Map();

  private numUsedElements = 0;
  private nextId = 1;
  private dirtyPortions: Set<number> = new Set();
  private textureHeight: number;

  private uploadAllOnFlush = false;
  private isPacked: boolean = true;

  constructor( options: DTXPositionsArrayOptions ) {
    this.gl = options.gl;
    this.capacity = options.capacity;
  }

  static get elementSizeInBytes() {
    return 3 * 2; // 3 Uint16 components per item, 2 bytes each
  }

  allocate(): boolean {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) {
     return false;
    }
    try {
      // CPU _buffer is RGB triplets per item
      this.buffer = new Uint16Array(this.capacity * this.componentsPerItem);
      // One texel per item, so itemsPerRow == textureWidth
      const itemsPerRow = this.textureWidth;
      this.textureHeight = Math.max(1, Math.ceil(this.capacity / itemsPerRow));
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16UI, this.textureWidth, this.textureHeight);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    } catch (e) {
        gl.deleteTexture(texture);
        return false;
    }
    this.texture = texture;
    // Start with a single free block spanning all items
    this.free=[
      {base: 0, size: this.capacity}
    ];
    return true;
  }

  /**
   * Returns the total number of bytes allocated.
   */
  getCapacityBytes() {
    return this.capacity * DTXPositionsArray.elementSizeInBytes;
  }

  /**
   * Returns the total number of bytes currently used.
   */
  getUsedBytes(): number {
    return this.numUsedElements * DTXPositionsArray.elementSizeInBytes;
  }


  /** Check if a portion of given size (in items/vertices) can be allocated. */
  canGetPortion( size: number ): boolean {
    if (size <= 0 || size > this.capacity) {
      return false;
    }
    if (this.findFreeBlock(size) !== -1) {
      return true;
    }
    this.pack();
    return this.findFreeBlock(size) !== -1;
  }

  /**
   * Allocate a portion (in items/vertices).
   * Returns null if allocation fails.
   */

  getPortion( size: number, onMove?: ( newBase: number ) => void ): DTXPositionsArrayHandle | null{
    this.isPacked = false;
    const index = this.findFreeBlock(size);
    if (index === -1) {
      this.pack();
      const retryIndex = this.findFreeBlock(size);
      if (retryIndex === -1) {
        return null;
      }
      this.numUsedElements += size;
      return this.allocateHandleAt(retryIndex, size, onMove);
    }
    this.numUsedElements += size;
    return this.allocateHandleAt(index, size, onMove);
  }

  /** View into the CPU _buffer (RGB tightly packed). */
  getPortionView( handle: DTXPositionsArrayHandle ): Uint16Array<any> {
    const portion = this.used.get(handle.id);
    if (!portion) {
      throw new SDKInternalException("Invalid handle ID");
    }
    return this.buffer.subarray(
      portion.base * this.componentsPerItem,
      (portion.base + portion.size) * this.componentsPerItem
    );
  }

  /** Write RGB triplets (Uint16) into the allocated region. `data.length == size*3` */
  setPortionData( handle: DTXPositionsArrayHandle, data: ArrayLike<number> ): void {
    const portion = this.used.get(handle.id);
    if (!portion) {
      throw new SDKInternalException('Invalid handle ID');
    }
    //  const expected = portion.size * this.componentsPerItem; // RGB per item
    const expected = portion.size; // RGB per item
    if ((data.length / this.componentsPerItem) !== expected) {
      throw new SDKInternalException('Mismatched data length');
    }
    const offset = portion.base * this.componentsPerItem;
    this.buffer.set(data, offset);
    this.dirtyPortions.add(handle.id);
  }

  /** Fill the portion with one scalar value across all RGB components. */
  fillPortion( handle: DTXPositionsArrayHandle, value: number ): void {
    const portion = this.used.get(handle.id);
    if (!portion) {
      throw new SDKInternalException("Invalid handle ID");
    }
    const offset = portion.base * this.componentsPerItem;
    const count = portion.size * this.componentsPerItem;
    this.buffer.fill(value, offset, offset + count);
    this.dirtyPortions.add(handle.id);
  }

  /** Free an allocated portion. */
  putPortion( handle: DTXPositionsArrayHandle ): void {
    const portion = this.used.get(handle.id);
    if (!portion) {
      return;
    }
    this.numUsedElements -= portion.size;
    this.isPacked = false;
    this.used.delete(handle.id);
    this.handles.delete(handle.id);
    this.portionCallbacks.delete(handle.id);
    this.insertFreePortionSorted(portion);
    this.coalesceFree();
  }

  /** Defragment: compacts items to the start; marks full reupload. */
  private pack(): void {
    if (this.isPacked) {
      return;
    }
    const sorted = Array.from(this.used.entries()).sort(( [, a], [, b] ) => a.base - b.base);
    let writeHead = 0;
    const newUsed = new Map<number, DTXPositionsArrayPortion>();

    for (const [id, portion] of sorted) {
      if (portion.base !== writeHead) {
        const from = portion.base * this.componentsPerItem;
        const to = writeHead * this.componentsPerItem;
        const count = portion.size * this.componentsPerItem;
        this.buffer.copyWithin(to, from, from + count);

        const callback = this.portionCallbacks.get(id);
        if (callback) callback(writeHead);
        this.uploadAllOnFlush = true;
      }
      newUsed.set(id, {base: writeHead, size: portion.size});

      const handle = this.handles.get(id);
      if (handle) {
        handle.base = writeHead;
      }

      writeHead += portion.size;
    }

    this.used = newUsed;
    this.free = writeHead < this.capacity
      ? [{base: writeHead, size: this.capacity - writeHead}]
      : [];
    this.isPacked = true;
  }

  private allocateHandleAt( index: number, size: number, onMove?: ( newBase: number ) => void ): DTXPositionsArrayHandle {
    const block = this.free[index];
    const id = this.nextId++;
    const portion: DTXPositionsArrayPortion = {base: block.base, size};
    this.used.set(id, portion);

    if (size === block.size) {
      this.free.splice(index, 1);
    } else {
      block.base += size;
      block.size -= size;
    }

    const handle: DTXPositionsArrayHandle = {id, base: portion.base};
    this.handles.set(id, handle);
    if (onMove) this.portionCallbacks.set(id, onMove);
    return handle;
  }

  private findFreeBlock( size: number ): number {
    return this.free.findIndex(block => block.size >= size);
  }

  private insertFreePortionSorted( portion: DTXPositionsArrayPortion ): void {
    let i = 0;
    while (i < this.free.length && this.free[i].base < portion.base) i++;
    this.free.splice(i, 0, portion);
  }

  private coalesceFree(): void {
    for (let i = 0; i < this.free.length - 1;) {
      const a = this.free[i], b = this.free[i + 1];
      if (a.base + a.size === b.base) {
        a.size += b.size;
        this.free.splice(i + 1, 1);
      } else {
        i++;
      }
    }
  }

  /**
   * Flush CPU _buffer to GPU.
   * Expands RGB (CPU) -> RGBA (GPU) on the fly, 1 texel per item.
   */
  uploadChanges(): boolean {

    if (this.dirtyPortions.size === 0 && !this.uploadAllOnFlush) {
      return;
    }
    const {gl, texture} = this;
    const itemsPerRow = this.textureWidth;

    gl.bindTexture(gl.TEXTURE_2D, texture);

    if (this.uploadAllOnFlush) {
      // Upload every row with temporary RGBA16UI staging
      let itemBase = 0;
      for (let y = 0; y < this.textureHeight; y++) {
        const remaining = this.capacity - itemBase;
        const itemsThisRow = Math.max(0, Math.min(itemsPerRow, remaining));
        if (itemsThisRow <= 0) break;

        const rgba = this.#expandRowToRGBA(itemBase, itemsThisRow);
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          0,
          y,
          itemsThisRow,
          1,
          gl.RGBA_INTEGER,
          gl.UNSIGNED_SHORT,
          rgba
        );

        itemBase += itemsThisRow;
      }
      this.dirtyPortions.clear();
      this.uploadAllOnFlush = false;
      return;
    }

    // Upload only dirty portions (split across rows)
    for (const id of this.dirtyPortions) {
      const portion = this.used.get(id);
      if (!portion) continue;

      let base = portion.base;
      let remaining = portion.size;

      while (remaining > 0) {
        const rowY = Math.floor(base / itemsPerRow);
        const rowX = base % itemsPerRow;
        const itemsThisRow = Math.min(remaining, itemsPerRow - rowX);

        const rgba = this.#expandRowToRGBA(base, itemsThisRow);
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          rowX,
          rowY,
          itemsThisRow,
          1,
          gl.RGBA_INTEGER,
          gl.UNSIGNED_SHORT,
          rgba
        );

        base += itemsThisRow;
        remaining -= itemsThisRow;
      }
    }
    this.dirtyPortions.clear();

    return true;
  }

  /** Expand CPU RGB triplets [base .. base+count) into a RGBA16UI row (A=0). */
  #expandRowToRGBA( baseItem: number, count: number ): Uint16Array<any> {
    const out = new Uint16Array(count * this.texChannelsPerItem);
    const srcOffset = baseItem * this.componentsPerItem;
    const src = this.buffer;

    for (let i = 0; i < count; i++) {
      const s = srcOffset + i * 3;
      const d = i * 4;
      out[d + 0] = src[s + 0]; // R = X
      out[d + 1] = src[s + 1]; // G = Y
      out[d + 2] = src[s + 2]; // B = Z
      out[d + 3] = 0;          // A = 0 (unused)
    }
    return out;
  }

  destroy(): void {
    if (this.texture) {
      this.gl.deleteTexture(this.texture);
    }
  }
}
