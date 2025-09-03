type TypedArray =
  | Float32Array<any>
  | Float64Array<any>
  | Uint32Array<any>
  | Uint16Array<any>
  | Uint8Array<any>
  | Int32Array<any>
  | Int16Array<any>
  | Int8Array<any>;

export interface DTXArrayOptions<T extends TypedArray> {
  gl: WebGL2RenderingContext;
  ArrayType: new (size: number) => T;
  capacity: number;
  componentsPerElement?: number;
  usePackedRGBAForUint32?: boolean;
}

/**
 * Represents a portion of a `DTXArray` allocated for storing data.
 *
 * A `DTXArrayPortion` defines a contiguous block of memory within the array,
 * specified by its starting base tileIndex and size. It is used internally to
 * manage dynamic allocation and deallocation of array portions.
 *
 * ### Properties:
 * - `base`: The starting tileIndex of the portion within the array.
 * - `size`: The number of elements in the portion.
 * @private
 */
interface DTXArrayPortion {
  base: number;
  size: number;
}

/**
 * Represents a handle to an allocated portion of a `DTXArray`.
 *
 * A `DTXArrayHandle` is used to reference a specific portion of the array,
 * allowing for dynamic updates, data retrieval, and deallocation.
 *
 * ### Properties:
 * - `id`: A unique identifier for the allocated portion.
 * - `base`: The starting tileIndex of the portion within the array.
 */
export interface DTXArrayHandle {
  id: number;
  base: number;
}

/**
 * Manages a GPU-backed array of data stored in a WebGL texture.
 *
 * The `DTXArray` class provides efficient storage and management of unstructured data
 * (e.g., indices, positions) for use in WebGL rendering. It supports dynamic allocation,
 * updates, and partial uploads to the GPU, minimizing memory fragmentation.
 *
 * ### Features:
 * - **Dynamic Allocation**: Allocates and manages portions of the buffer for different data.
 * - **Efficient Updates**: Buffers changes and uploads only dirty regions to the GPU.
 * - **Fragmentation Handling**: Packs the buffer to eliminate fragmentation when needed.
 * - **Customizable Layout**: Supports different data types and component configurations.
 *
 * ### Usage:
 * - Allocate portions with `getPortion(size)` and free them with `putPortion(handle)`.
 * - Write data using `setPortionData(handle, data)` or `fillPortion(handle, value)`.
 * - Call `flush()` to upload changes to the GPU.
 *
 * ### Lifecycle:
 * 1. Initialize with WebGL context and desired capacity.
 * 2. Allocate and manage portions dynamically.
 * 3. Periodically call `flush()` to synchronize changes with the GPU.
 * 4. Clean up resources with `destroy()` if necessary.
 */
export class DTXArray<T extends TypedArray> {

  /**
   * The WebGL texture storing the array data.
   */
  texture: WebGLTexture;

  /**
   * The backing typed array for data storage.
   */
  public readonly buffer: T;

  private textureWidth = 4096;
  private textureHeight: number;
  private format: GLenum;
  private type: GLenum;

  private readonly gl: WebGL2RenderingContext;

  private readonly capacity: number;
  private readonly componentsPerElement: number;

  private used: Map<number, DTXArrayPortion> = new Map();
  private handles: Map<number, DTXArrayHandle> = new Map();
  private free: DTXArrayPortion[] = [];
  private portionCallbacks: Map<number, (newBase: number) => void> = new Map();

  private nextId = 1;
  private dirtyPortions: Set<number> = new Set();


  private usePackedRGBA: boolean;
  private uploadAllOnFlush: boolean;


  constructor(options: DTXArrayOptions<T>) {
    this.gl = options.gl;
    this.capacity = options.capacity;
    this.componentsPerElement = options.componentsPerElement ?? 1;
    this.usePackedRGBA = options.usePackedRGBAForUint32 ?? false;
    this.uploadAllOnFlush = false;

    const totalElements = this.usePackedRGBA ? this.capacity * 4 : this.capacity * this.componentsPerElement;
    this.buffer = new options.ArrayType(totalElements);
    this.free.push({base: 0, size: this.capacity});

    this.#allocateTexture();
  }

  /** Allocates the backing WebGL texture and sets appropriate internal format */
  #allocateTexture(): void {

    const gl = this.gl;
    const ctor = this.buffer.constructor as Function;
    const comp = this.componentsPerElement;


    let internalFormat: GLenum | GLenum[];
    let bytesPerElement;

    if (ctor === Uint32Array && this.usePackedRGBA && comp === 1) {
      this.type = gl.UNSIGNED_BYTE;
      this.format = gl.RGBA;
      internalFormat = gl.RGBA8;
      bytesPerElement = 1;

    } else if (ctor === Float32Array) {
      this.type = gl.FLOAT;
      this.format = gl.RED;
      internalFormat = [gl.R32F, gl.RG32F, gl.RGB32F, gl.RGBA32F][comp - 1];
      bytesPerElement = 4;

    } else if (ctor === Uint8Array) {
      this.type = gl.UNSIGNED_BYTE;
      this.format = gl.RED_INTEGER;
      internalFormat = [gl.R8UI, gl.RG8UI, gl.RGB8UI, gl.RGBA8UI][comp - 1];
      bytesPerElement = 1;

    } else if (ctor === Uint16Array) {
      this.type = gl.UNSIGNED_SHORT;
      this.format = gl.RED_INTEGER;
      internalFormat = [gl.R16UI, gl.RG16UI, gl.RGB16UI, gl.RGBA16UI][comp - 1];
      bytesPerElement = 2;

    } else if (ctor === Uint32Array) {
      this.type = gl.UNSIGNED_INT;
      this.format = gl.RED_INTEGER;
      internalFormat = [gl.R32UI, gl.RG32UI, gl.RGB32UI, gl.RGBA32UI][comp - 1];
      bytesPerElement = 4;

    } else if (ctor === Int8Array) {
      this.type = gl.BYTE;
      this.format = gl.RED_INTEGER;
      internalFormat = [gl.R8I, gl.RG8I, gl.RGB8I, gl.RGBA8I][comp - 1];
      bytesPerElement = 1;

    } else if (ctor === Int16Array) {
      this.type = gl.SHORT;
      this.format = gl.RED_INTEGER;
      internalFormat = [gl.R16I, gl.RG16I, gl.RGB16I, gl.RGBA16I][comp - 1];
      bytesPerElement = 2;

    } else if (ctor === Int32Array) {
      this.type = gl.INT;
      this.format = gl.RED_INTEGER;
      internalFormat = [gl.R32I, gl.RG32I, gl.RGB32I, gl.RGBA32I][comp - 1];
      bytesPerElement = 4;

    } else {
      throw new Error("Unsupported typed array type.");
    }

    this.textureWidth = 4096;
    const pixelsPerItem = this.usePackedRGBA ? 1 : this.componentsPerElement;
    const itemsPerRow = Math.floor(this.textureWidth / pixelsPerItem);
    this.textureHeight = Math.ceil(this.capacity / itemsPerRow);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      internalFormat,
      this.textureWidth,
      this.textureHeight,
      0,
      this.format,
      this.type,
      null
    );

    this.texture = texture;
  }

  /**
   * Allocates a portion of the buffer.
   */
  getPortion(size: number, onMove?: (newBase: number) => void): DTXArrayHandle {
    const index = this.findFreeBlock(size);
    if (index === -1) {
      this.pack();
      const retryIndex = this.findFreeBlock(size);
      if (retryIndex === -1) {
        throw new Error("Allocation failed");
      }
      return this.allocateHandleAt(retryIndex, size, onMove);
    }
    return this.allocateHandleAt(index, size, onMove);
  }

  /**
   * Gets a typed view of the allocated portion.
   */
  getPortionView(handle: DTXArrayHandle): T {
    const portion = this.used.get(handle.id);
    if (!portion) {
      throw new Error("Invalid handle ID");
    }
    return this.buffer.subarray(
      portion.base * this.componentsPerElement,
      (portion.base + portion.size) * this.componentsPerElement
    ) as T;
  }

  /**
   * Writes data into the allocated region.
   */
  setPortionData(handle: DTXArrayHandle, data: ArrayLike<number>): void {
    const portion = this.used.get(handle.id);
    if (!portion) {
      throw new Error("Invalid handle ID");
    }

    const stride = this.usePackedRGBA ? 4 : this.componentsPerElement;
    const expectedSize = portion.size * (this.usePackedRGBA ? 1 : this.componentsPerElement);
    const offset = portion.base * stride;

    if (data.length !== expectedSize) {
      throw new Error("Mismatched data length");
    }

    if (this.usePackedRGBA && this.buffer instanceof Uint8Array) {
      for (let i = 0; i < data.length; i++) {
        const u32 = data[i] >>> 0;
        const rgba = packUint32ToRGBA(u32);
        this.buffer.set(rgba, offset + i * 4);
      }
    } else {
      this.buffer.set(data, offset);
    }

    this.dirtyPortions.add(handle.id);
  }


  /**
   * Fills the allocated portion with a single value.
   */
  fillPortion(handle: DTXArrayHandle, value: number): void {
    const portion = this.used.get(handle.id);
    if (!portion) {
      throw new Error("Invalid handle ID");
    }

    const stride = this.usePackedRGBA ? 4 : this.componentsPerElement;
    const offset = portion.base * stride;
    const count = portion.size * stride;

    if (this.usePackedRGBA && this.buffer instanceof Uint8Array) {
      const [r, g, b, a] = packUint32ToRGBA(value >>> 0);
      for (let i = offset; i < offset + count; i += 4) {
        this.buffer[i + 0] = r;
        this.buffer[i + 1] = g;
        this.buffer[i + 2] = b;
        this.buffer[i + 3] = a;
      }
    } else {
      this.buffer.fill(value, offset, offset + count);
    }

    this.dirtyPortions.add(handle.id);
  }

  /**
   * Frees an allocated portion.
   */
  putPortion(handle: DTXArrayHandle): void {
    const portion = this.used.get(handle.id);
    if (!portion) {
      return;
    }

    this.used.delete(handle.id);
    this.handles.delete(handle.id);
    this.portionCallbacks.delete(handle.id);

    this.insertFreePortionSorted(portion);
    this.coalesceFree();
  }

  /**
   * Packs the buffer to eliminate fragmentation.
   */
  private pack(): void {
    const sorted = Array.from(this.used.entries()).sort(([, a], [, b]) => a.base - b.base);
    let writeHead = 0;
    const newUsed = new Map<number, DTXArrayPortion>();

    for (const [id, portion] of sorted) {
      if (portion.base !== writeHead) {
        const from = portion.base * this.componentsPerElement;
        const to = writeHead * this.componentsPerElement;
        const count = portion.size * this.componentsPerElement;
        this.buffer.copyWithin(to, from, from + count);

        const callback = this.portionCallbacks.get(id);
        if (callback) callback(writeHead);
        this.uploadAllOnFlush = true;
      }
      newUsed.set(id, {base: writeHead, size: portion.size});
      const handle = this.handles.get(id);
      if (handle) handle.base = writeHead;
      writeHead += portion.size;
    }

    this.used = newUsed;
    this.free = writeHead < this.capacity
      ? [{base: writeHead, size: this.capacity - writeHead}]
      : [];
  }

  private allocateHandleAt(index: number, size: number, onMove?: (newBase: number) => void): DTXArrayHandle {
    const block = this.free[index];
    const id = this.nextId++;
    const portion: DTXArrayPortion = {base: block.base, size};
    this.used.set(id, portion);
    if (size === block.size) {
      this.free.splice(index, 1);
    } else {
      block.base += size;
      block.size -= size;
    }
    const handle: DTXArrayHandle = {id, base: portion.base};
    this.handles.set(id, handle);
    if (onMove) {
      this.portionCallbacks.set(id, onMove);
    }
    return handle;
  }

  private findFreeBlock(size: number): number {
    return this.free.findIndex(block => block.size >= size);
  }

  private insertFreePortionSorted(portion: DTXArrayPortion): void {
    let i = 0;
    while (i < this.free.length && this.free[i].base < portion.base) {
      i++;
    }
    this.free.splice(i, 0, portion);
  }

  private coalesceFree(): void {
    for (let i = 0; i < this.free.length - 1;) {
      const a = this.free[i];
      const b = this.free[i + 1];
      if (a.base + a.size === b.base) {
        a.size += b.size;
        this.free.splice(i + 1, 1);
      } else {
        i++;
      }
    }
  }

  /** Uploads all dirty portions to GPU or the whole buffer if uploadAllOnFlush is set */
  flush(): void {
    const texture = this.texture;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (this.uploadAllOnFlush) { // Efficient after pack()
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        this.textureWidth,
        this.textureHeight,
        this.format,
        this.type,
        this.buffer
      );
      this.dirtyPortions.clear();
      this.uploadAllOnFlush = false;
    } else {
      const stride = this.usePackedRGBA ? 4 : this.componentsPerElement;
      const itemsPerRow = Math.floor(this.textureWidth / (this.usePackedRGBA ? 1 : this.componentsPerElement));
      for (const id of this.dirtyPortions) {
        const portion = this.used.get(id);
        if (!portion) {
          continue;
        }
        let base = portion.base;
        let remaining = portion.size;
        let offset = stride * base;
        while (remaining > 0) {
          const rowX = base % itemsPerRow;
          const rowY = Math.floor(base / itemsPerRow);
          const itemsThisRow = Math.min(remaining, itemsPerRow - rowX);
          gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            rowX,
            rowY,
            itemsThisRow,
            1,
            this.format,
            this.type,
            this.buffer.subarray(offset, offset + itemsThisRow * stride)
          );

          base += itemsThisRow;
          offset += itemsThisRow * stride;
          remaining -= itemsThisRow;
        }
      }
      this.dirtyPortions.clear();
    }
  }

  /**
   * Destroys the internal resources.
   */
  destroy(): void {
    this.gl.deleteTexture(this.texture);
  }
}

// Packing utility (JS):
export function packUint32ToRGBA(u: number): [number, number, number, number] {
  return [
    (u >>> 0) & 0xFF,
    (u >>> 8) & 0xFF,
    (u >>> 16) & 0xFF,
    (u >>> 24) & 0xFF
  ];
}

// GLSL unpacking function:
// uvec4 rgba = texelFetch(uSampler, ivec2(x, y), 0).rgba;
// uint value = rgba.r + (rgba.g << 8u) + (rgba.b << 16u) + (rgba.a << 24u);
