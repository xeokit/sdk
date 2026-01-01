import type {RenderPassValue} from "../../RENDER_PASSES";
import {SDKInternalException} from "../../../../core";
import {DataTexture} from "./DataTexture";

export interface DTXPrimDrawListOptions {
  bins: number[];
  gl: WebGL2RenderingContext;
  /** Number of 32-bit entries (one texel per entry). */
  maxItems: number;
  /** Optional fixed texture width. Defaults to 4096. */
  texWidth?: number;
  description?: string;
}

/** Handle to an allocated portion. */
export interface DTXPrimDrawListHandle {
  id: number;
  /** Fixed slot start (linear index into the R32UI texture). */
  offset: number;
  /** Portion size in texels. */
  size: number;
  meshIndex: number;
  visible: boolean;
  renderPass: RenderPassValue;
}

/** Range info for a render pass/bin. */
export interface DTXPassRange {
  //   renderPass: number;
  /** First primitive index for this pass (inclusive). */
  firstPrim: number;
  /** Number of primitives in this pass. */
  numPrims: number;
}

/**
 * DTXPrimList
 * ---------
 * GPU-backed array of 32-bit unsigned integers stored in an R32UI texture.
 * Each element is one texel (RED_INTEGER / UNSIGNED_INT).
 *
 * This version partitions allocated portions into **runs by arbitrary type** (bins),
 * e.g. "color", "transparent", "selected", "highlighted", "xrayed", ...
 * The same texture can thus hold prim lists for multiple render passes.
 *
 * For each type/bin, the class tracks the \`first\` and \`count\` for use with \`drawArrays\`.
 *
 * - getPortion / putPortion
 * - setCulled / setType
 * - uploadChanges() rebuilds runs and uploads only when needed
 * - canGetPortion() to check maxItems
 */
export class DTXPrimDrawList extends DataTexture {

  readonly maxItems: number;

  private _gl: WebGL2RenderingContext;
  private _portions: Map<number, DTXPrimDrawListHandle> = new Map();
  private _nextId = 1;
  private _needFlush = true;

  /** Total allocated primitives across all portions (visible or not). Capacity check uses this. */
  private _totalAllocatedPrims = 0;

  /** Total *drawable* primitives in the last rebuild (excludes visible). */
  public numDrawablePrims = 0;

  private _renderPassIds: RenderPassValue[];

  /** Ranges per pass/type after the last rebuild. */
  public passRanges: Map<number, DTXPassRange> = new Map();

  constructor(opts: DTXPrimDrawListOptions) {
    super();
    this.description = opts.description ||  "primIndex -> meshIndex";
    const gl = opts.gl;
    this._gl = gl;
    this.maxItems = opts.maxItems | 0;
    this._renderPassIds = opts.bins;
    const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) | 0; // reserved for future validation
    this.width = Math.min(Math.max(1, opts.texWidth ?? 4096), maxSize);
    this.height = Math.max(1, Math.ceil(this.maxItems / this.width));
  }

  /**
   * Size in bytes of a single element (uint32).
   */
  static get itemSizeInBytes(): number {
    return 8; // 1 uint32 per prim + 1 uint32 offset
  }

  /**
   * Gets the total capacity in bytes of the primitive draw list.
   */
  getAllocatedBytes(): number {
    return this.maxItems * DTXPrimDrawList.itemSizeInBytes;
  }

  /**
   * Gets the currently allocated bytes based on number of primitives in use.
   */
  getUsedBytes(): number {
    return this._totalAllocatedPrims * DTXPrimDrawList.itemSizeInBytes;
  }

  allocate(): boolean {
    // Allocate CPU buffer to full texture area (padding at end is harmless)
    const totalTexels = this.width * this.height;
    // Create R32UI texture
    const gl = this._gl;
    const tex = gl.createTexture();
    if (!tex) {
      return false;
    }
    this.texture = tex;
    try {
      this.buffer = new Uint32Array(totalTexels * 2); // 2x uint32 per prim (meshIndex, offset)
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R32UI, this.width, this.height);
      gl.bindTexture(gl.TEXTURE_2D, null);
    } catch (e) {
      gl.deleteTexture(tex);
      return false;
    }
    return true;
  }

  /** Texture width (in texels). */
  get texWidth(): number {
    return this.width;
  }

  /** Texture height (in texels). */
  get texHeight(): number {
    return this.height;
  }

  /** Number of primitives currently drawable (post-\`uploadChanges\`). */
  get numPrimitives(): number {
    return this.numDrawablePrims;
  }

  /** Check if a new portion of \`size\` fits (ignores culling). */
  canGetPortion(size: number): boolean {
    return this._totalAllocatedPrims + (size | 0) <= this.maxItems;
  }

  /**
   * Allocate a portion belonging to a given \`renderPass\` bin.
   * Portions participate in their bin's run while visible.
   */
  createPortion(size: number, meshIndex: number, renderPass: RenderPassValue): DTXPrimDrawListHandle {
    size |= 0;
    if (size <= 0) throw new Error("DTXPrimList: size must be > 0");
    if (this._totalAllocatedPrims + size > this.maxItems) {
      throw new SDKInternalException("DTXPrimList: Not enough capacity");
    }
    const id = this._nextId++;
    const portion = {id, size, meshIndex, offset: 0, renderPass, visible: true} as const;
    this._portions.set(id, portion);
    this._totalAllocatedPrims += size;
    this._needFlush = true;
    return portion;
  }

  /** Free a previously allocated portion. */
  deletePortion(portion: DTXPrimDrawListHandle): void {
    const removed = this._portions.get(portion.id);
    if (!removed) {
       throw new SDKInternalException("DTXPrimDrawList: Unknown portion handle");
    }
    this._portions.delete(portion.id);
    this._totalAllocatedPrims -= removed.size;
    this._needFlush = true;
  }

  /** Change a portion's bin/renderPass. */
  setRenderPass(handle: DTXPrimDrawListHandle, renderPass: RenderPassValue): void {
    const p = this._portions.get(handle.id);
    if (!p) {
      throw new SDKInternalException("DTXPrimDrawList: Unknown portion handle");
    }
    if (p.renderPass === renderPass) {
      return;
    }
    (p as any).renderPass = renderPass;
    handle.renderPass = renderPass;
    this._needFlush = true;
  }

  setVisible(handle: DTXPrimDrawListHandle, visible: boolean): void {
    const p = this._portions.get(handle.id);
    if (!p) {
      throw new SDKInternalException("DTXPrimDrawList: Unknown portion handle");
    }
    p.visible = !!visible;
    handle.visible = p.visible;
    this._needFlush = true;
  }

  isVisible(handle: DTXPrimDrawListHandle): boolean {
    const p = this._portions.get(handle.id);
    return p ? p.visible : handle.visible;
  }

  /** Upload current CPU buffer if dirty; rebuilds runs when necessary. */
  uploadChanges(): boolean {
    if (!this._needFlush) {
      return false;
    }
    if (this._totalAllocatedPrims === 0) {
      // Nothing allocated; still clear ranges.
      this.passRanges.clear();
      this.numDrawablePrims = 0;
      this._needFlush = false;
      return false;
    }
    this._rebuildRunsAndBuffer();
    this.bufferUpdated();
    const gl = this._gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      this.width,
      this.height,
      gl.RED_INTEGER,
      gl.UNSIGNED_INT,
      this.buffer
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
    this._needFlush = false;
    console.log(`DTXPrimDrawList: uploadChanges uploaded ${this.numDrawablePrims} drawable prims`);
    return true;
  }

  /** Get first/count for a pass type. Returns {first:0,count:0} if absent. */
  getPassRange(renderPass: RenderPassValue): DTXPassRange {
    const r = this.passRanges.get(renderPass);
    if (!r) {
      throw new Error(`DTXPrimDrawList: Unknown pass renderPass ${renderPass}`);
    }
    return r;
  }

  readAtTexel(x: number, y: number): { meshIndex: number, offset: number } {
    const addr = DTXPrimDrawList.encodeAddress(x, y, this.width);
    const meshIndex = this.buffer[addr*2];
    const offset = this.buffer[addr*2 + 1];
    return {meshIndex, offset};
  }

  getItem(primIndex: number): { meshIndex: number, offset: number} {
    const meshIndex = this.buffer[primIndex*2];
    const offset = this.buffer[primIndex*2 + 1];
    return {meshIndex, offset};
  }

  /** Destroy GL resources. */
  destroy(): void {
    if (this.texture) {
      this._gl.deleteTexture(this.texture);
      this.texture = null;
    }
    (this.buffer as any) = null;
    this._portions.clear();
    this.passRanges.clear();

  }

  // ---------------- Internals ----------------

  private _rebuildRunsAndBuffer(): void {
    // Build buckets by renderPass while preserving *global* insertion order of portions
    const buckets = new Map<number, Array<DTXPrimDrawListHandle>>();
    for (const p of this._portions.values()) {
      if (!p.visible) continue; // invisible portions don't contribute to runs
      let arr = buckets.get(p.renderPass);
      if (!arr) {
        arr = [];
        buckets.set(p.renderPass, arr);
      }
      arr.push(p);
    }

    // Walk types in stable order and pack contiguous runs per renderPass
    let base = 0;
    this.passRanges.clear();

    for (const renderPass of this._renderPassIds) {
      const group = buckets.get(renderPass);
      const start = base;
      if (group && group.length) {
        for (const portion of group) {
          const end = base + portion.size;
          // Fill with meshIndex for each prim in this portion
          for (let i = base, offset =0; i < end; i+=2, offset++) {
            this.buffer[i] = portion.meshIndex >>> 0;
            this.buffer[i+1] = offset;
          }
      //    this.buffer.fill(portion.meshIndex >>> 0, base, end);
          base = end;
        }
      }
      const count = base - start;
      if (count > 0) {
        this.passRanges.set(renderPass, {firstPrim: start, numPrims: count});
      } else {
        // Ensure a zeroed entry exists only if previously known; consumers can ignore zeros.
        if (this.passRanges.has(renderPass)) {
          this.passRanges.set(renderPass, {firstPrim: 0, numPrims: 0});
        }
      }
    }

    // Zero out the remainder (optional but keeps content deterministic for debugging)
    // if (base < this.buffer.length) this.buffer.fill(0, base);

    this.numDrawablePrims = base;
  }

  /** Encode (x,y) → linear address for a 2D table with known width. */
  static encodeAddress(x: number, y: number, width: number): number {
    return ((y | 0) * (width | 0) + (x | 0)) >>> 0;
  }

  /** Decode linear address → (x,y) for a given width. */
  static decodeAddress(addr: number, width: number): { x: number; y: number } {
    const a = addr >>> 0;
    const w = width | 0;
    return {x: (a % w) | 0, y: (a / w) | 0};
  }
}
