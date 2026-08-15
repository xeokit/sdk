import type {IBLParams} from "./IBLParams";
import type {View} from "./View";
import {SDKErrorType, type SDKResult} from "../../base/core";
import {RealisticRender} from "../../base/constants";
import {parseHDR, type HDRImage} from "./hdrLoader";


/**
 * Configures cubemap-based image-based lighting (IBL) for a {@link viewing!viewer.View | View}.
 *
 * * Located at {@link Lights.ibl}, which lives at {@link View.lights}.
 *
 * Drives the prefiltered-cubemap diffuse + specular contribution to
 * each fragment's BRDF: the renderer projects either a procedural sky
 * (built from {@link Lights.hemispheric}) or a user-supplied
 * equirectangular environment image onto a cubemap, then prefilters
 * the diffuse irradiance and GGX-convolved specular for fast lookup at
 * draw time. Active whenever the current {@link View.renderMode} is in
 * {@link IBL.renderModes}.
 *
 * The cheap analytical sky/ground/up gradient lives separately on
 * {@link Lights.hemispheric}. By default, IBL is reserved for quality
 * rendering while the analytical hemisphere term lights the faster
 * interactive modes.
 *
 * See {@link viewer | @xeokit/sdk/viewing/viewer} for usage info.
 */
class IBL {

  /**
   * The View to which this IBL belongs.
   */
  public readonly view: View;

  #renderModes: number[];
  #intensity: number;
  #destroyed: boolean = false;

  // User-supplied equirectangular environment map. When set, the
  // renderer projects it onto the IBL source cubemap instead of using
  // the procedural sky. `#environmentSrc` is the URL the user passed
  // (kept for round-trip serialisation); `#environmentImage` is the
  // decoded `HTMLImageElement` (or canvas / bitmap) the renderer reads.
  // `#environmentHDR` holds a parsed Radiance `.hdr` decode (Float32
  // RGBA) — set by the HDR APIs and uploaded as RGBA16F so super-bright
  // sun pixels survive the prefilter without clamping. Only one of the
  // LDR / HDR slots is active at a time; setting one clears the other.
  #environmentSrc: string | undefined = undefined;
  #environmentImage: HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas | undefined = undefined;
  #environmentHDR: HDRImage | undefined = undefined;
  // Bumped whenever the environment image changes; the renderer
  // compares against its own last-seen value to push a new texture
  // upload to the prefilter only on change.
  #environmentVersion: number = 0;

  /**
   * @private
   */
  constructor(view: View, params: IBLParams = {}) {
    this.view = view;
    this.#renderModes = params.renderModes ?? [RealisticRender];
    this.#intensity = params.intensity !== undefined ? params.intensity : 1.0;
  }

  /**
   * Sets which rendering modes in which to apply IBL.
   *
   * The {@link viewing!viewer.View | View} will apply IBL whenever {@link View.renderMode} has been set one of these values.
   *
   * Default value is [{@link base!constants.RealisticRender | RealisticRender}].
   */
  set renderModes(value: number[]) {
    this.#renderModes = value;
    this.view.needsRender();
  }

  /**
   * Gets which rendering modes in which to apply IBL.
   *
   * The {@link viewing!viewer.View | View} will apply IBL whenever {@link View.renderMode} has been set one of these values.
   *
   * Default value is [{@link base!constants.RealisticRender | RealisticRender}].
   */
  get renderModes(): number[] {
    return this.#renderModes;
  }

  /**
   * Returns true if IBL is currently possible given the View's state.
   * The renderer is the authority on whether the GPU can actually run
   * it.
   * @private
   */
  get possible(): boolean {
    return true;
  }

  /**
   * Gets if IBL is currently applied.
   *
   * This is `true` when {@link View.renderMode | View.renderMode} is
   * in {@link IBL.renderModes | IBL.renderModes}.
   */
  get applied(): boolean {
    for (let i = 0, len = this.#renderModes.length; i < len; i++) {
      if (this.view.renderMode === this.#renderModes[i]) {
        return true;
      }
    }
    return false;
  }

  /**
   * Sets the cubemap IBL contribution multiplier. Range `[0, ∞)`. At
   * `0` the cubemap contributes nothing even when the active
   * {@link View.renderMode} is in {@link IBL.renderModes}.
   *
   * Default value is `1.0`.
   */
  set intensity(value: number) {
    if (typeof value !== "number") return;
    if (this.#intensity === value) return;
    this.#intensity = value;
    this.view.needsRender();
  }

  /**
   * Gets the cubemap IBL contribution multiplier.
   */
  get intensity(): number {
    return this.#intensity;
  }

  /**
   * Replaces the procedural sky with an equirectangular environment
   * image fetched from `url`. Once loaded, the renderer projects it
   * onto the IBL source cubemap and runs the same prefilter /
   * irradiance pipeline as the procedural sky — so the BRDF picks up
   * real environment reflections on metals and the diffuse ambient
   * term reflects the actual scene context.
   *
   * Resolves with `{ ok: true }` once the image has loaded and the
   * renderer has been notified. Rejects with `{ ok: false }` on
   * fetch / decode failure.
   *
   * Pass any URL form — `http(s):`, `blob:`, `data:`. Cross-origin
   * URLs need CORS headers from the host or the GPU upload will throw
   * a `SecurityError`.
   */
  async setEnvironment(url: string): Promise<SDKResult<void>> {
    if (this.#destroyed) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[IBL.setEnvironment] IBL has been destroyed."
      });
    }
    try {
      const image = await loadImage(url);
      this.#environmentSrc = url;
      this.#environmentImage = image;
      this.#environmentHDR = undefined;
      this.#environmentVersion++;
      this.view.needsRender();
      return { ok: true, value: undefined };
    } catch (e) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[IBL.setEnvironment] Failed to load '${url}': ${e instanceof Error ? e.message : String(e)}`
      });
    }
  }

  /**
   * Replaces the procedural sky with an already-decoded equirectangular
   * environment image. Same effect as {@link setEnvironment} but
   * synchronous — useful when the caller has already produced a canvas
   * or `ImageBitmap` (for example, from a bundled PNG or a
   * `createImageBitmap` decode).
   */
  setEnvironmentImage(
    image: HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas
  ): SDKResult<void> {
    if (this.#destroyed) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[IBL.setEnvironmentImage] IBL has been destroyed."
      });
    }
    if (!image) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[IBL.setEnvironmentImage] image is required."
      });
    }
    this.#environmentSrc = undefined;
    this.#environmentImage = image;
    this.#environmentHDR = undefined;
    this.#environmentVersion++;
    this.view.needsRender();
    return { ok: true, value: undefined };
  }

  /**
   * Replaces the procedural sky with a Radiance HDR (`.hdr`) file
   * fetched from `url`. Same effect as {@link setEnvironment} but the
   * environment is uploaded as `RGBA16F` so super-bright pixels
   * (the sun, sky-glow) survive the prefilter at full intensity, giving
   * smooth metals a proper HDR specular bloom under tonemapping.
   *
   * Resolves with `{ ok: true }` once the file has fetched and decoded.
   * Rejects on network failure or malformed `.hdr` contents.
   *
   * Pass any URL form — `http(s):`, `blob:`, `data:`. Cross-origin URLs
   * need CORS headers from the host.
   */
  async setEnvironmentHDR(url: string): Promise<SDKResult<void>> {
    if (this.#destroyed) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[IBL.setEnvironmentHDR] IBL has been destroyed."
      });
    }
    let buffer: ArrayBuffer;
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        return this.view.viewer.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `[IBL.setEnvironmentHDR] Fetch '${url}' failed: ${resp.status} ${resp.statusText}`
        });
      }
      buffer = await resp.arrayBuffer();
    } catch (e) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[IBL.setEnvironmentHDR] Fetch '${url}' failed: ${e instanceof Error ? e.message : String(e)}`
      });
    }
    const result = this.setEnvironmentHDRBuffer(buffer);
    if (result.ok) this.#environmentSrc = url;
    return result;
  }

  /**
   * Replaces the procedural sky with a Radiance HDR file already
   * fetched into an `ArrayBuffer`. Same effect as {@link setEnvironmentHDR}
   * but synchronous — useful when the caller has already produced the
   * bytes (bundler import, IndexedDB, etc.).
   */
  setEnvironmentHDRBuffer(buffer: ArrayBuffer): SDKResult<void> {
    if (this.#destroyed) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[IBL.setEnvironmentHDRBuffer] IBL has been destroyed."
      });
    }
    const parsed = parseHDR(buffer);
    if (!parsed.ok) {
      return this.view.viewer.logError(parsed);
    }
    this.#environmentSrc = undefined;
    this.#environmentImage = undefined;
    this.#environmentHDR = parsed.value;
    this.#environmentVersion++;
    this.view.needsRender();
    return { ok: true, value: undefined };
  }

  /**
   * Drops any user-supplied environment image and reverts to the
   * procedural sky. Cheap; the renderer detaches the equirect texture
   * on the next frame.
   */
  clearEnvironment(): void {
    if (!this.#environmentImage && !this.#environmentSrc && !this.#environmentHDR) return;
    this.#environmentSrc = undefined;
    this.#environmentImage = undefined;
    this.#environmentHDR = undefined;
    this.#environmentVersion++;
    this.view.needsRender();
  }

  /** The decoded environment image currently driving IBL, if any. */
  get environmentImage():
    HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas | undefined {
    return this.#environmentImage;
  }

  /**
   * The decoded HDR environment currently driving IBL, if any. Holds
   * row-major top-down Float32 RGBA pixels (linear-space) plus the
   * source dimensions. Mutually exclusive with {@link environmentImage}
   * — at most one slot is populated at a time.
   *
   * @internal
   */
  get environmentHDR(): HDRImage | undefined {
    return this.#environmentHDR;
  }

  /** The URL the environment was loaded from, if any. Empty string
   *  when the image was supplied directly via {@link setEnvironmentImage}. */
  get environmentSrc(): string | undefined {
    return this.#environmentSrc;
  }

  /**
   * Monotonically-increasing version number, bumped each time the
   * environment image changes. Renderers compare against their own
   * last-seen value to detect changes — an integer beats hashing the
   * image bytes every frame.
   *
   * @internal
   */
  get environmentVersion(): number {
    return this.#environmentVersion;
  }

  /**
   * Gets the current configuration of this IBL component.
   */
  toParams(): SDKResult<IBLParams> {
    return {
      ok: true,
      value: {
        renderModes: this.renderModes,
        intensity: this.intensity
      }
    };
  }

  /**
   * Configures this IBL component from a params object.
   */
  fromParams(params: IBLParams): SDKResult<void> {
    if (this.#destroyed) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[IBL.fromParams] IBL has been destroyed."
      });
    }
    if (params.renderModes !== undefined) this.renderModes = params.renderModes;
    if (params.intensity !== undefined)   this.intensity   = params.intensity;
    return { ok: true, value: undefined };
  }

  /**
   * @private
   */
  destroy() {
    this.#destroyed = true;
  }
}

/**
 * Resolve an image URL into an `HTMLImageElement` ready for GPU
 * upload. `crossOrigin = anonymous` so cross-origin hosts that send
 * the right CORS headers don't taint the resulting texture.
 *
 * @internal
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (ev) => reject(new Error(`image failed to load: ${ev}`));
    img.src = url;
  });
}

export {IBL};
