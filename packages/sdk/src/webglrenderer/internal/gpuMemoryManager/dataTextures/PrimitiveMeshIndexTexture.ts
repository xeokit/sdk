import type { RenderPassValue } from "../../RENDER_PASSES";
import { SDKInternalException } from "../../../../core";
import { DataTexture } from "./DataTexture";
import { type PrimRange } from "./PrimRange";

/**
 * Handle to an allocated portion in PrimitiveMeshIndexTexture.
 */
export interface PrimitiveMeshIndexTexturePortionHandle {
  id: number;
  offset: number;
  size: number;
  meshIndex: number;
  objectVisible: boolean;
  meshVisible: boolean;
  renderPass: RenderPassValue;
}

/**
 * GPU data texture mapping each primitive to its owning mesh for a given render pass.
 *
 * `PrimitiveMeshIndexTexture` is a GPU-resident table used by the renderer to efficiently determine,
 * for each primitive (triangle, line, or point), which mesh it belongs to and its offset within that mesh.
 *
 * ## Structure
 * - Each item stores two `uint32` values: `meshIndex` and `offset`.
 * - Items are grouped into "portions", each associated with a mesh and a render pass (e.g., OPAQUE, XRAYED).
 * - The texture maintains a mapping of render pass IDs to primitive ranges, enabling fast per-pass rendering.
 */
export class PrimitiveMeshIndexTexture extends DataTexture {

  private readonly portions: Map<number, PrimitiveMeshIndexTexturePortionHandle> = new Map();
  private readonly renderPassIds: RenderPassValue[];

  public readonly passRanges: Map<number, PrimRange> = new Map();

  public readonly primRange: PrimRange = { firstPrim: 0, numPrims: 0 };

  private nextPortionId: number = 1;
  private numAllocatedItems: number = 0;
  private needUpload: boolean = true;

  public static readonly itemSizeInBytes = 8; // 2 × uint32 per item (meshIndex, offset)

  /**
   * @private
   * @param options
   */
  constructor(options: {
    gl: WebGL2RenderingContext;
    bins: RenderPassValue[];
    maxItems: number;
    description: string;
  }) {
    super({
      gl: options.gl,
      description: options.description,
      format: options.gl.RED_INTEGER,
      type: options.gl.UNSIGNED_INT,
      internalFormat: options.gl.R32UI,
      maxItems: options.maxItems,
      getNumItems: () => this.numItems,
      width: 4096,
      itemSizeInBytes: PrimitiveMeshIndexTexture.itemSizeInBytes,
      texelsPerItem: 1,
      elementsPerTexel: 2,
    });
    this.renderPassIds = options.bins;
  }

  /**
   * Number of allocated primitives (across all portions).
   */
  public get numItems(): number {
    return this.numAllocatedItems;
  }

  /**
   * Number of primitives currently drawable (post-uploadChanges).
   * This is also the number of pickable primitives, since picking considers all primitives regardless of render pass.
   */
  public get numPrimitives(): number {
    return this.primRange.numPrims;
  }

  /**
   * Checks if a new portion of the given size fits (ignores culling).
   * @param size Number of items to allocate.
   */
  public canGetPortion(size: number): boolean {
    return this.numAllocatedItems + (size | 0) <= this.maxItems;
  }

  /**
   * Allocates a portion belonging to a given renderPass bin.
   * @param size Number of items in the portion.
   * @param meshIndex Mesh index for the portion.
   * @param renderPass Render pass bin.
   */
  public createPortion(size: number, meshIndex: number, renderPass: RenderPassValue): PrimitiveMeshIndexTexturePortionHandle {
    if (size <= 0) {
      throw new SDKInternalException("[PrimitiveMeshIndexTexture.createPortion]: size must be > 0");
    }
    if (this.numAllocatedItems + size > this.maxItems) {
      throw new SDKInternalException("[PrimitiveMeshIndexTexture.createPortion]: Not enough capacity");
    }
    const id = this.nextPortionId++;
    const handle: PrimitiveMeshIndexTexturePortionHandle = {
      id,
      size,
      meshIndex,
      offset: 0,
      renderPass,
      objectVisible: true,
      meshVisible: true,
    };
    this.portions.set(id, handle);
    this.numAllocatedItems += size;
    this.needUpload = true;
    return handle;
  }

  /**
   * Frees a previously allocated portion.
   * @param handle Portion handle.
   */
  public deletePortion(handle: PrimitiveMeshIndexTexturePortionHandle): void {
    const removed = this.portions.get(handle.id);
    if (!removed) {
      throw new SDKInternalException("[PrimitiveMeshIndexTexture.deletePortion]: Unknown portion handle");
    }
    this.portions.delete(handle.id);
    this.numAllocatedItems -= removed.size;
    this.needUpload = true;
  }

  /**
   * Changes a portion's renderPass bin.
   * @param handle Portion handle.
   * @param renderPass New render pass bin.
   */
  public setRenderPass(handle: PrimitiveMeshIndexTexturePortionHandle, renderPass: RenderPassValue): void {
    const portion = this.portions.get(handle.id);
    if (!portion) {
      throw new SDKInternalException("[PrimitiveMeshIndexTexture.setRenderPass]: Unknown portion handle");
    }
    if (portion.renderPass === renderPass) {
      return;
    }
    portion.renderPass = renderPass;
    handle.renderPass = renderPass;
    this.needUpload = true;
  }

  /**
   * Sets the object-level visibility of a portion.
   * @param handle Portion handle.
   * @param objectVisible Whether the portion is visible at the object level.
   */
  public setObjectVisible(handle: PrimitiveMeshIndexTexturePortionHandle, objectVisible: boolean): void {
    const portion = this.portions.get(handle.id);
    if (!portion) {
      throw new SDKInternalException("[PrimitiveMeshIndexTexture.setObjectVisible]: Unknown portion handle");
    }
    portion.objectVisible = !!objectVisible;
    handle.objectVisible = portion.objectVisible;
    this.needUpload = true;
  }

  /**
   * Sets the mesh-level visibility of a portion.
   * @param handle Portion handle.
   * @param meshVisible Whether the portion is visible at the mesh level.
   */
  public setMeshVisible(handle: PrimitiveMeshIndexTexturePortionHandle, meshVisible: boolean): void {
    const portion = this.portions.get(handle.id);
    if (!portion) {
      throw new SDKInternalException("[PrimitiveMeshIndexTexture.setMeshVisible]: Unknown portion handle");
    }
    portion.meshVisible = !!meshVisible;
    handle.meshVisible = portion.meshVisible;
    this.needUpload = true;
  }

  /**
   * Gets the visibility of a portion.
   * @param handle Portion handle.
   */
  public isVisible(handle: PrimitiveMeshIndexTexturePortionHandle): boolean {
    const portion = this.portions.get(handle.id);
    return portion ? portion.meshVisible : handle.meshVisible;
  }

  /**
   * Gets the first/count for a renderPass bin.
   * @param renderPass Render pass bin.
   */
  public getPassRange(renderPass: RenderPassValue): PrimRange {
    return this.passRanges.get(renderPass) ?? { firstPrim: 0, numPrims: 0 };
  }

  /**
   * Gets the full range of drawable primitives, for picking.
   * This can be used for picking passes that want to consider all primitives regardless of render pass.
   */
  public getPrimRange(): PrimRange {
    return this.primRange;
  }

  /**
   * Gets the meshIndex and offset for a primitive index.
   *
   * The offset is the index of the primitive within its mesh. For example, for a triangle mesh,
   * the offset will be 0 for the first triangle, 1 for the second triangle, and so on. This
   * allows the vertex shader to determine which vertices to use when rendering the primitive.
   * @param primIndex Primitive index.
   */
  public getItem(primIndex: number): { meshIndex: number; offset: number } {
    const meshIndex = this.buffer[primIndex * 2];
    const offset = this.buffer[primIndex * 2 + 1];
    return { meshIndex, offset };
  }

  /**
   * Cancels any pending uploads.
   */
  protected cancelUploads(): void {
    this.needUpload = false;
  }

  /**
   * Uploads current CPU buffer if dirty; rebuilds runs when necessary.
   *
   * Internal algorithm:
   * - If no upload is needed, returns false.
   * - If no items are allocated, clears buffer and returns false.
   * - Otherwise, rebuilds runs and buffer:
   *   - Groups portions by renderPass, preserving insertion order.
   *   - Packs contiguous runs per renderPass, updating offsets.
   *   - Updates passRanges for each renderPass.
   *   - Uploads buffer to GPU.
   *   - Updates numDrawablePrims.
   * - Notifies update and resets needUpload.
   *
   * @returns True if any uploads occurred, false otherwise.
   */
  public uploadChanges(): boolean {
    if (!this.needUpload) {
      return false;
    }
    if (this.numAllocatedItems === 0) {
      this.buffer.fill(0);
      this.passRanges.clear();
      this.needUpload = false;
      return false;
    }
    this._rebuildRunsAndBuffer();
    this.notifyUpdated();
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
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
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.needUpload = false;
    return true;
  }

  /**
   * Frees GPU resources and clears internal state.
   */
  public destroy(): void {
    super.destroy();
    this.portions.clear();
    this.passRanges.clear();
  }

  // ---------------- Internals ----------------

  /**
   * Rebuilds runs and buffer for all portions, grouped by renderPass.
   */
  private _rebuildRunsAndBuffer(): void {
    // Group portions by renderPass, preserving insertion order
    const buckets = new Map<number, PrimitiveMeshIndexTexturePortionHandle[]>();
    for (const portion of this.portions.values()) {
      if (!portion.objectVisible || !portion.meshVisible) continue;
      if (!buckets.has(portion.renderPass)) {
        buckets.set(portion.renderPass, []);
      }
      buckets.get(portion.renderPass)!.push(portion);
    }

    // Pack contiguous runs per renderPass
    let base = 0;
    this.passRanges.clear();
    for (const renderPass of this.renderPassIds) {
      const bucket = buckets.get(renderPass);
      if (!bucket || bucket.length === 0) {
        this.passRanges.set(renderPass, { firstPrim: base, numPrims: 0 });
        continue;
      }
      for (const portion of bucket) {
        portion.offset = base;
        for (let i = 0; i < portion.size; i++) {
          const bufIdx = (base + i) * 2;
          this.buffer[bufIdx] = portion.meshIndex;
          this.buffer[bufIdx + 1] = i;
        }
        base += portion.size;
      }
      this.passRanges.set(renderPass, {
        firstPrim: base - (bucket.reduce((sum, p) => sum + p.size, 0)),
        numPrims: bucket.reduce((sum, p) => sum + p.size, 0) });
    }
    this.primRange.numPrims = base;
    // Optionally zero out remainder for debugging
    // if (base < this.buffer.length) this.buffer.fill(0, base * 2);
  }

  /**
   * Encode (x, y) → linear address for a 2D table with known width.
   */
  public static encodeAddress(x: number, y: number, width: number): number {
    return ((y | 0) * (width | 0) + (x | 0)) >>> 0;
  }

  /**
   * Decode linear address → (x, y) for a given width.
   */
  public static decodeAddress(addr: number, width: number): { x: number; y: number } {
    const a = addr >>> 0;
    const w = width | 0;
    return { x: (a % w) | 0, y: (a / w) | 0 };
  }
}
