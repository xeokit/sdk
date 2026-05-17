import {SDKInternalException} from "../../../../../base/core";
import {DataBuffer} from "./DataBuffer";
import {type PrimRange} from "./PrimRange";

/**
 * Runtime identifier for a render pass.
 *
 * Unlike the original implementation, render passes are not restricted to a
 * fixed enum. Any numeric ID can be registered at runtime.
 *
 * Built-in pass IDs can still be used directly.
 */
export type PrimitiveRenderPassId = number;

/**
 * Handle to an allocated portion in {@link PrimitiveMeshIndexBuffer}.
 *
 * A portion represents a contiguous range of primitives belonging to a single mesh
 * and assigned to a specific render pass.
 *
 * Portions are opaque handles owned by the buffer. Their `offset` is updated during
 * {@link uploadChanges}, when the internal CPU buffer is rebuilt and repacked.
 */
export interface PrimitiveMeshIndexTexturePortionHandle {
  /**
   * Unique portion identifier.
   */
  id: number;

  /**
   * Offset of the portion within the packed primitive buffer.
   *
   * This is updated during {@link uploadChanges}.
   */
  offset: number;

  /**
   * Number of primitives in this portion.
   */
  size: number;

  /**
   * Index of the mesh that owns this portion.
   */
  meshIndex: number;

  /**
   * Object-level visibility flag.
   */
  objectVisible: boolean;

  /**
   * Mesh-level visibility flag.
   */
  meshVisible: boolean;

  /**
   * Render pass this portion belongs to.
   */
  renderPass: PrimitiveRenderPassId;
}

/**
 * Options when registering a render pass.
 */
export interface RegisterRenderPassOptions {
  /**
   * Insert the new pass before an existing pass.
   */
  before?: PrimitiveRenderPassId;

  /**
   * Insert the new pass after an existing pass.
   */
  after?: PrimitiveRenderPassId;
}

/**
 * Options when unregistering a render pass.
 */
export interface UnregisterRenderPassOptions {
  /**
   * Policy for portions currently assigned to the pass being removed.
   *
   * - `"throw"`: Throws if any portions still reference the pass.
   * - `"move"`: Reassigns them to {@link targetRenderPass}.
   * - `"hide"`: Marks them invisible.
   */
  onAssignedPortions?: "throw" | "move" | "hide";

  /**
   * Target render pass when `onAssignedPortions === "move"`.
   */
  targetRenderPass?: PrimitiveRenderPassId;
}

/**
 * GPU data buffer mapping each primitive to its owning mesh for a given render pass.
 *
 * `PrimitiveMeshIndexBuffer` is now backed by a WebGL2 buffer object instead of a data texture.
 * It stores a packed table used by the renderer to efficiently determine, for each primitive
 * (triangle, line, or point), which mesh it belongs to and its offset within that mesh.
 *
 * ## Structure
 * - Each item stores two `uint32` values:
 *   - `meshIndex`: index of the owning mesh
 *   - `offset`: primitive index within that mesh
 * - Items are grouped into "portions", each associated with:
 *   - a mesh (`meshIndex`)
 *   - a render pass (`renderPass`)
 * - Portions are dynamically packed into contiguous runs per render pass during {@link uploadChanges}.
 *
 * ## Render pass model
 * - Render passes are registered at runtime using {@link registerRenderPass}.
 * - Each registered pass gets a contiguous primitive range stored in {@link passRanges}.
 * - Pass registration order defines packing order, which also defines draw order for users
 *   that consume the ranges sequentially.
 *
 * ## Visibility
 * A portion is included in packing only when both:
 * - `objectVisible === true`
 * - `meshVisible === true`
 *
 * Invisible portions remain allocated, but do not contribute to packed primitive ranges.
 *
 * ## Usage
 * Typical flow:
 * 1. Register render passes
 * 2. Create portions
 * 3. Modify visibility and/or render passes
 * 4. Call {@link uploadChanges}
 * 5. Use {@link getPassRange} to drive draw calls
 *
 * @remarks
 * This class preserves the original public API as much as possible, even though the
 * underlying GPU resource is now a WebGL buffer rather than a texture.
 */
export class PrimitiveMeshIndexBuffer extends DataBuffer {
  /**
   * All allocated portions indexed by portion ID.
   */
  private readonly portions = new Map<number, PrimitiveMeshIndexTexturePortionHandle>();

  /**
   * Ordered list of registered render passes.
   *
   * This defines packing order and, by extension, the order of contiguous pass ranges.
   */
  private readonly renderPassOrder: PrimitiveRenderPassId[] = [];

  /**
   * Set of registered render passes for fast membership checks.
   */
  private readonly registeredRenderPasses = new Set<PrimitiveRenderPassId>();

  /**
   * Per-pass primitive ranges.
   *
   * Each entry defines a contiguous segment within the packed primitive buffer.
   */
  public readonly passRanges = new Map<PrimitiveRenderPassId, PrimRange>();

  /**
   * Full range of drawable primitives across all visible portions and all registered passes.
   *
   * This is useful for passes such as picking that want to consider all visible primitives
   * regardless of render pass.
   */
  public readonly primRange: PrimRange = {firstPrim: 0, numPrims: 0};

  private nextPortionId = 1;
  private numAllocatedItems = 0;
  private needUpload = true;

  /**
   * Size of a single item in bytes.
   *
   * Each item stores:
   * - `meshIndex` (`uint32`)
   * - `offset` (`uint32`)
   */
  public static readonly itemSizeInBytes = 8;

  /**
   * @private
   * @param options Constructor options.
   */
  constructor(options: {
    gl: WebGL2RenderingContext;
    bins?: PrimitiveRenderPassId[];
    maxItems: number;
    description: string;
  }) {
    super({
      gl: options.gl,
      description: options.description,
      maxItems: options.maxItems,
      getNumItems: () => this.numItems,
      itemSizeInBytes: PrimitiveMeshIndexBuffer.itemSizeInBytes,
      elementsPerItem: 2,
      bufferClass: Uint32Array,
      target: options.gl.ARRAY_BUFFER,
      usage: options.gl.DYNAMIC_DRAW
    });

    for (const passId of options.bins ?? []) {
      this.registerRenderPass(passId);
    }
  }

  /**
   * Number of allocated primitives across all portions, including invisible ones.
   */
  public get numItems(): number {
    return this.numAllocatedItems;
  }

  /**
   * Number of primitives currently drawable after the most recent packing pass.
   *
   * This counts only visible primitives in registered render passes.
   */
  public get numPrimitives(): number {
    return this.primRange.numPrims;
  }

  /**
   * Checks if a new portion of the given size fits within capacity.
   *
   * This check considers allocation only and ignores visibility/culling.
   *
   * @param size Number of items to allocate.
   */
  public canGetPortion(size: number): boolean {
    return this.numAllocatedItems + (size | 0) <= this.maxItems;
  }

  /**
   * Checks whether a render pass is currently registered.
   *
   * @param renderPass Render pass ID.
   */
  public hasRenderPass(renderPass: PrimitiveRenderPassId): boolean {
    return this.registeredRenderPasses.has(renderPass);
  }

  /**
   * Gets the ordered list of registered render pass IDs.
   *
   * The returned array is a copy and can be safely modified by the caller.
   */
  public getRenderPassIds(): PrimitiveRenderPassId[] {
    return this.renderPassOrder.slice();
  }

  /**
   * Registers a render pass at runtime.
   *
   * If the pass is already registered, this is a no-op.
   *
   * Ordering can optionally be controlled relative to an existing pass.
   * If neither `before` nor `after` is provided, the pass is appended.
   *
   * @param renderPass Unique pass ID.
   * @param options Optional ordering constraints.
   */
  public registerRenderPass(
    renderPass: PrimitiveRenderPassId,
    options?: RegisterRenderPassOptions
  ): void {
    if (this.registeredRenderPasses.has(renderPass)) {
      return;
    }

    const {before, after} = options ?? {};

    if (before !== undefined && after !== undefined) {
      throw new SDKInternalException(
        "[PrimitiveMeshIndexBuffer.registerRenderPass]: Specify only one of 'before' or 'after'"
      );
    }

    if (before !== undefined) {
      const idx = this.renderPassOrder.indexOf(before);
      if (idx === -1) {
        throw new SDKInternalException(
          "[PrimitiveMeshIndexBuffer.registerRenderPass]: 'before' pass is not registered"
        );
      }
      this.renderPassOrder.splice(idx, 0, renderPass);
    } else if (after !== undefined) {
      const idx = this.renderPassOrder.indexOf(after);
      if (idx === -1) {
        throw new SDKInternalException(
          "[PrimitiveMeshIndexBuffer.registerRenderPass]: 'after' pass is not registered"
        );
      }
      this.renderPassOrder.splice(idx + 1, 0, renderPass);
    } else {
      this.renderPassOrder.push(renderPass);
    }

    this.registeredRenderPasses.add(renderPass);
    this.passRanges.set(renderPass, {firstPrim: 0, numPrims: 0});
    this.needUpload = true;
  }

  /**
   * Unregisters a render pass.
   *
   * By default this throws if any portions are still assigned to the pass.
   * Callers may instead choose to move or hide those portions.
   *
   * If the pass is not registered, this is a no-op.
   *
   * @param renderPass Render pass ID to remove.
   * @param options Behavior for portions still assigned to the pass.
   */
  public unregisterRenderPass(
    renderPass: PrimitiveRenderPassId,
    options?: UnregisterRenderPassOptions
  ): void {
    if (!this.registeredRenderPasses.has(renderPass)) {
      return;
    }

    const onAssignedPortions = options?.onAssignedPortions ?? "throw";
    const affected: PrimitiveMeshIndexTexturePortionHandle[] = [];

    for (const portion of this.portions.values()) {
      if (portion.renderPass === renderPass) {
        affected.push(portion);
      }
    }

    if (affected.length > 0) {
      switch (onAssignedPortions) {
        case "throw":
          throw new SDKInternalException(
            "[PrimitiveMeshIndexBuffer.unregisterRenderPass]: Pass still has assigned portions"
          );

        case "move": {
          const target = options?.targetRenderPass;
          if (target === undefined) {
            throw new SDKInternalException(
              "[PrimitiveMeshIndexBuffer.unregisterRenderPass]: targetRenderPass is required when onAssignedPortions='move'"
            );
          }
          if (target === renderPass) {
            throw new SDKInternalException(
              "[PrimitiveMeshIndexBuffer.unregisterRenderPass]: targetRenderPass must differ from renderPass"
            );
          }
          if (!this.registeredRenderPasses.has(target)) {
            throw new SDKInternalException(
              "[PrimitiveMeshIndexBuffer.unregisterRenderPass]: targetRenderPass is not registered"
            );
          }
          for (const portion of affected) {
            portion.renderPass = target;
          }
          break;
        }

        case "hide":
          for (const portion of affected) {
            portion.objectVisible = false;
            portion.meshVisible = false;
          }
          break;

        default:
          throw new SDKInternalException(
            "[PrimitiveMeshIndexBuffer.unregisterRenderPass]: Unsupported onAssignedPortions policy"
          );
      }
    }

    this.registeredRenderPasses.delete(renderPass);
    const idx = this.renderPassOrder.indexOf(renderPass);
    if (idx !== -1) {
      this.renderPassOrder.splice(idx, 1);
    }
    this.passRanges.delete(renderPass);
    this.needUpload = true;
  }

  /**
   * Allocates a portion belonging to a given render pass.
   *
   * The render pass must already be registered.
   *
   * @param size Number of items in the portion.
   * @param meshIndex Mesh index for the portion.
   * @param renderPass Render pass ID.
   */
  public createPortion(
    size: number,
    meshIndex: number,
    renderPass: PrimitiveRenderPassId
  ): PrimitiveMeshIndexTexturePortionHandle {
    if (size <= 0) {
      throw new SDKInternalException(
        "[PrimitiveMeshIndexBuffer.createPortion]: size must be > 0"
      );
    }
    if (this.numAllocatedItems + size > this.maxItems) {
      throw new SDKInternalException(
        "[PrimitiveMeshIndexBuffer.createPortion]: Not enough capacity"
      );
    }
    if (!this.registeredRenderPasses.has(renderPass)) {
      throw new SDKInternalException(
        "[PrimitiveMeshIndexBuffer.createPortion]: Render pass is not registered"
      );
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
   *
   * @param handle Portion handle.
   */
  public deletePortion(handle: PrimitiveMeshIndexTexturePortionHandle): void {
    const removed = this.portions.get(handle.id);
    if (!removed) {
      throw new SDKInternalException(
        "[PrimitiveMeshIndexBuffer.deletePortion]: Unknown portion handle"
      );
    }
    this.portions.delete(handle.id);
    this.numAllocatedItems -= removed.size;
    this.needUpload = true;
  }

  /**
   * Changes a portion's render pass.
   *
   * The target render pass must already be registered.
   *
   * @param handle Portion handle.
   * @param renderPass New render pass ID.
   */
  public setRenderPass(
    handle: PrimitiveMeshIndexTexturePortionHandle,
    renderPass: PrimitiveRenderPassId
  ): void {
    const portion = this.portions.get(handle.id);
    if (!portion) {
      throw new SDKInternalException(
        "[PrimitiveMeshIndexBuffer.setRenderPass]: Unknown portion handle"
      );
    }
    if (!this.registeredRenderPasses.has(renderPass)) {
      throw new SDKInternalException(
        "[PrimitiveMeshIndexBuffer.setRenderPass]: Render pass is not registered"
      );
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
   *
   * @param handle Portion handle.
   * @param objectVisible Whether the portion is visible at the object level.
   */
  public setObjectVisible(
    handle: PrimitiveMeshIndexTexturePortionHandle,
    objectVisible: boolean
  ): void {
    const portion = this.portions.get(handle.id);
    if (!portion) {
      throw new SDKInternalException(
        "[PrimitiveMeshIndexBuffer.setObjectVisible]: Unknown portion handle"
      );
    }
    portion.objectVisible = !!objectVisible;
    handle.objectVisible = portion.objectVisible;
    this.needUpload = true;
  }

  /**
   * Sets the mesh-level visibility of a portion.
   *
   * @param handle Portion handle.
   * @param meshVisible Whether the portion is visible at the mesh level.
   */
  public setMeshVisible(
    handle: PrimitiveMeshIndexTexturePortionHandle,
    meshVisible: boolean
  ): void {
    const portion = this.portions.get(handle.id);
    if (!portion) {
      throw new SDKInternalException(
        "[PrimitiveMeshIndexBuffer.setMeshVisible]: Unknown portion handle"
      );
    }
    portion.meshVisible = !!meshVisible;
    handle.meshVisible = portion.meshVisible;
    this.needUpload = true;
  }

  /**
   * Gets the current visibility of a portion.
   *
   * This mirrors the original behavior: if the handle is still known by the buffer,
   * visibility is read from internal state; otherwise the visibility recorded on the handle
   * is returned as a fallback.
   *
   * @param handle Portion handle.
   */
  public isVisible(handle: PrimitiveMeshIndexTexturePortionHandle): boolean {
    const portion = this.portions.get(handle.id);
    return portion ? portion.meshVisible : handle.meshVisible;
  }

  /**
   * Gets the first/count range for a render pass.
   *
   * If the pass has no drawable primitives, a zero-length range is returned.
   *
   * @param renderPass Render pass ID.
   */
  public getPassRange(renderPass: PrimitiveRenderPassId): PrimRange {
    return this.passRanges.get(renderPass) ?? {firstPrim: 0, numPrims: 0};
  }

  /**
   * Gets the full range of drawable primitives, for picking or other whole-buffer passes.
   *
   * This can be used for passes that want to consider all visible primitives regardless of render pass.
   */
  public getPrimRange(): PrimRange {
    return this.primRange;
  }

  /**
   * Gets the mesh index and primitive offset for a packed primitive index.
   *
   * The `offset` is the primitive index within its mesh. For example, for a triangle mesh,
   * the offset will be `0` for the first triangle, `1` for the second triangle, and so on.
   *
   * @param primIndex Packed primitive index.
   */
  public getItem(primIndex: number): { meshIndex: number; offset: number } {
    const buffer = this.buffer as Uint32Array<any>;
    const meshIndex = buffer[primIndex * 2];
    const offset = buffer[primIndex * 2 + 1];
    return {meshIndex, offset};
  }

  /**
   * Cancels any pending uploads.
   *
   * This clears the dirty flag without modifying the current buffer contents.
   */
  protected cancelUploads(): void {
    this.needUpload = false;
  }

  /**
   * Uploads the current CPU buffer if dirty and rebuilds packed runs when necessary.
   *
   * Internal algorithm:
   * - If no upload is needed, returns `false`.
   * - If no items are allocated, clears ranges, zeroes the CPU buffer, uploads that zeroed
   *   buffer to the GPU buffer, and returns `true`.
   * - Otherwise:
   *   - groups visible portions by render pass
   *   - packs contiguous runs in registered render pass order
   *   - updates {@link passRanges}
   *   - updates {@link primRange}
   *   - uploads the buffer to the GPU
   *   - clears the dirty flag
   *
   * @returns `true` if a GPU upload occurred, otherwise `false`.
   */
  public uploadChanges(): boolean {
    if (!this.needUpload) {
      return false;
    }

    const buffer = this.buffer as Uint32Array<any>;

    if (this.numAllocatedItems === 0) {
      buffer.fill(0);
      this.passRanges.clear();
      for (const renderPass of this.renderPassOrder) {
        this.passRanges.set(renderPass, {firstPrim: 0, numPrims: 0});
      }
      this.primRange.firstPrim = 0;
      this.primRange.numPrims = 0;
      this.needUpload = false;
      return this.uploadFullBuffer();
    }

    this._rebuildRunsAndBuffer();
    const uploaded = this.uploadFullBuffer();
    this.needUpload = false;
    return uploaded;
  }

  /**
   * Frees GPU resources and clears internal state.
   */
  public destroy(): void {
    super.destroy();
    this.portions.clear();
    this.passRanges.clear();
    this.renderPassOrder.length = 0;
    this.registeredRenderPasses.clear();
  }

  // ---------------- Internals ----------------

  /**
   * Rebuilds packed runs and the CPU buffer for all visible portions, grouped by render pass.
   *
   * Packing is performed in registered render pass order. Each pass receives a contiguous
   * primitive range in {@link passRanges}.
   *
   * For each packed primitive:
   * - `buffer[n * 2 + 0] = meshIndex`
   * - `buffer[n * 2 + 1] = primitive offset within mesh`
   */
  private _rebuildRunsAndBuffer(): void {
    const buffer = this.buffer as Uint32Array<any>;
    const buckets = new Map<PrimitiveRenderPassId, PrimitiveMeshIndexTexturePortionHandle[]>();

    for (const renderPass of this.renderPassOrder) {
      buckets.set(renderPass, []);
    }

    for (const portion of this.portions.values()) {
      if (!portion.objectVisible || !portion.meshVisible) {
        continue;
      }
      if (!this.registeredRenderPasses.has(portion.renderPass)) {
        continue;
      }
      buckets.get(portion.renderPass)!.push(portion);
    }

    let base = 0;
    this.passRanges.clear();

    for (const renderPass of this.renderPassOrder) {
      const bucket = buckets.get(renderPass)!;
      const firstPrim = base;

      for (const portion of bucket) {
        portion.offset = base;

        for (let i = 0; i < portion.size; i++) {
          const bufIdx = (base + i) * 2;
          buffer[bufIdx] = portion.meshIndex;
          buffer[bufIdx + 1] = i;
        }

        base += portion.size;
      }

      this.passRanges.set(renderPass, {
        firstPrim,
        numPrims: base - firstPrim,
      });
    }

    this.primRange.firstPrim = 0;
    this.primRange.numPrims = base;

    if (base * 2 < buffer.length) {
      buffer.fill(0, base * 2);
    }
  }

  /**
   * Encodes `(x, y)` into a linear address for a 2D table with known width.
   *
   * Retained for compatibility with callers that may still use the original helper,
   * even though this implementation is buffer-backed rather than texture-backed.
   *
   * @param x X coordinate.
   * @param y Y coordinate.
   * @param width Table width.
   */
  public static encodeAddress(x: number, y: number, width: number): number {
    return (((y | 0) * (width | 0)) + (x | 0)) >>> 0;
  }

  /**
   * Decodes a linear address into `(x, y)` for a 2D table with known width.
   *
   * Retained for compatibility with callers that may still use the original helper,
   * even though this implementation is buffer-backed rather than texture-backed.
   *
   * @param addr Linear address.
   * @param width Table width.
   */
  public static decodeAddress(addr: number, width: number): { x: number; y: number } {
    const a = addr >>> 0;
    const w = width | 0;
    return {x: (a % w) | 0, y: (a / w) | 0};
  }
}
