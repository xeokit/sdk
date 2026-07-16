import {SplatDataTexture} from "./dataTextures/SplatDataTexture";
import {packSplats, SPLAT_FLOATS_PER_ITEM, type SplatAttributes} from "../../../../formats/gaussiansplat/utils/packSplats";
import type {PortionHandle} from "./dataTextures/PortionDataTexture";
import {SDKErrorType, type SDKResult} from "../../../../base/core";
import type {FloatArrayParam} from "../../../../base/math";

/** A live splat portion: first splat item-index (`base`) and splat `count`. */
export interface SplatPortion {
  base: number;
  count: number;
}

/**
 * Streamable GPU storage for gaussian splats — the splat analogue of a
 * {@link GPUMemoryBatch}, but far thinner (no geometry/material/edge machinery).
 *
 * Splats are added/removed as freeable {@link PortionDataTexture} portions, so a
 * splat geometry streams in and out exactly like mesh vertex data. Each portion's
 * `{base, size}` gives the first splat index and splat count for the draw + sort.
 *
 * NOT unit-tested (owns a live GL texture) — the load-bearing packing it relies on
 * ({@link packSplats}) is. Verify end-to-end in the browser.
 */
export class SplatBatch {

  /** The shared splat-record texture (read by the GaussianSplatTechnique). */
  public readonly texture: SplatDataTexture;

  private readonly _portions = new Map<PortionHandle, SplatPortion>();

  /** Bumped on every add/remove, so consumers (the sort worker) know to re-read. */
  private _revision = 0;

  constructor(gl: WebGL2RenderingContext, maxSplats: number) {
    this.texture = new SplatDataTexture({gl, maxItems: maxSplats, description: "SplatBatch"});
  }

  /** Allocates the GPU texture. Call once before the first {@link addSplats}. */
  allocate(): SDKResult<void> {
    return this.texture.allocate();
  }

  /** Streams a splat geometry in. Returns its portion handle (`base`, `size`). */
  addSplats(attrs: SplatAttributes, worldMatrix?: FloatArrayParam, meshPickId = 0): SDKResult<PortionHandle> {
    const packed = packSplats(attrs, worldMatrix, meshPickId);
    const count = (packed.length / SPLAT_FLOATS_PER_ITEM) | 0;
    const portion: SplatPortion = {base: 0, count};
    // onMove keeps `base` valid if the texture packs/compacts later.
    const handle = this.texture.getPortion(packed, (newBase) => { portion.base = newBase; });
    if (!handle) {
      return {
        ok: false,
        type: SDKErrorType.MemoryAllocationFailed,
        error: "[SplatBatch.addSplats] Out of splat texture memory.",
      };
    }
    portion.base = handle.base;
    this._portions.set(handle, portion);
    this._revision++;
    return {ok: true, value: handle};
  }

  /**
   * Re-packs an existing portion with a new world matrix (live re-transform).
   * In-place (same splat count) and bumps the revision so the sort re-runs.
   */
  updateSplats(handle: PortionHandle, attrs: SplatAttributes, worldMatrix?: FloatArrayParam, meshPickId = 0): void {
    if (!this._portions.has(handle)) return;
    const packed = packSplats(attrs, worldMatrix, meshPickId);
    this.texture.setPortionData(handle, packed);
    this._revision++;
  }

  /** Streams a splat geometry out, freeing its portion back to the texture. */
  removeSplats(handle: PortionHandle): void {
    if (this._portions.delete(handle)) {
      this.texture.putPortion(handle);
      this._revision++;
    }
  }

  /** Flushes dirty portions to the GPU. Call after add/remove, before draw. */
  uploadChanges(): void {
    this.texture.uploadChanges();
  }

  /**
   * Recreates the splat texture after a WebGL context restore, re-uploading the
   * packed splat records from the texture's CPU mirror. Bumps the revision so
   * the draw technique re-feeds its sort worker.
   */
  webglContextRestored(): SDKResult<void> {
    const result = this.texture.webglContextRestored();
    if (result.ok === false) {
      return result;
    }
    this._revision++;
    return {ok: true, value: undefined};
  }

  /**
   * Rebinds this wrapper to a restored WebGL context before reallocating its
   * splat texture.
   * @internal
   */
  setWebGLContext(gl: WebGL2RenderingContext): void {
    this.texture.setWebGLContext(gl);
  }

  /** Live portions, each carrying `{base, count}` for the sort/draw. */
  get portions(): Iterable<SplatPortion> {
    return this._portions.values();
  }

  /** Total splats currently resident. */
  get numSplats(): number {
    return this.texture.numItems;
  }

  /** Increments whenever splats are added/removed (for sort-worker invalidation). */
  get revision(): number {
    return this._revision;
  }

  destroy(): void {
    this.texture.destroy();
  }
}
