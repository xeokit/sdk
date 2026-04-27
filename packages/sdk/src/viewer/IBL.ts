import type {IBLParams} from "./IBLParams";
import type {View} from "./View";
import {createVec3Float64, type Vec3, type Vec3Float} from "../math/vector";
import {SDKErrorType, type SDKResult} from "../core";
import {DetailedRender, RealisticRender} from "../constants";


/**
 * Configures hemispherical image-based lighting (IBL) for a {@link View}.
 *
 * * Located at {@link View.ibl}.
 *
 * Layer 1 of the IBL feature set — diffuse-only, analytical hemisphere
 * model. The renderer evaluates an ambient irradiance term per fragment
 * by lerping between {@link IBL.skyColor} and {@link IBL.groundColor}
 * based on how much the fragment's normal faces world up vs. world
 * down. No cubemap textures, no specular reflections, no prefiltering —
 * just a smooth two-colour gradient that replaces the existing flat
 * ambient when enabled.
 *
 * The point: indoor BIM scenes look noticeably more "lit" than they do
 * with a constant ambient grey, especially under directional shadows
 * where the unlit side of every object now picks up a colour-correct
 * fill. Cost is two uniforms and one `mix`-and-`dot` per fragment.
 *
 * Future layers will extend this with cubemap-based irradiance + a
 * prefiltered specular map — those will hang on the same component
 * without breaking the Layer-1 surface.
 *
 * See {@link viewer | @xeokit/sdk/viewer} for usage info.
 */
class IBL {

  /**
   * The View to which this IBL belongs.
   */
  public readonly view: View;

  #renderModes: number[];
  #enabled: boolean;
  #intensity: number;
  #skyColor: Vec3Float;
  #groundColor: Vec3Float;
  #worldUp: Vec3Float;
  #destroyed: boolean = false;

  // User-supplied equirectangular environment map. When set, the
  // renderer projects it onto the IBL source cubemap instead of using
  // the procedural sky. `#environmentSrc` is the URL the user passed
  // (kept for round-trip serialisation); `#environmentImage` is the
  // decoded `HTMLImageElement` (or canvas / bitmap) the renderer reads.
  #environmentSrc: string | undefined = undefined;
  #environmentImage: HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas | undefined = undefined;
  // Bumped whenever the environment image changes; the renderer
  // compares against its own last-seen value to push a new texture
  // upload to the prefilter only on change.
  #environmentVersion: number = 0;

  /**
   * @private
   */
  constructor(view: View, params: IBLParams = {}) {
    this.view = view;
    this.#renderModes = [DetailedRender, RealisticRender];
    // IBL fires under DetailedRender/RealisticRender by default — the
    // renderMode gate is what decides whether it contributes, just like
    // every other effect. The legacy `enabled === true` default left
    // IBL silently inert under the standard render presets, which has
    // surprised every demo author who relied on it.
    this.#enabled = params.enabled !== false;
    this.#intensity = params.intensity !== undefined ? params.intensity : 1.0;
    this.#skyColor = createVec3Float64(params.skyColor || [0.62, 0.72, 0.86]);
    this.#groundColor = createVec3Float64(params.groundColor || [0.42, 0.36, 0.30]);
    this.#worldUp = createVec3Float64(params.worldUp || [0, 0, 1]);
  }

  /**
   * Sets which rendering modes in which to apply IBL.
   *
   * The {@link View} will apply IBL whenever {@link View.renderMode} has been set one of these values.
   *
   * Default value is [{@link constants!DetailedRender | DetailedRender},
   * {@link constants!RealisticRender | RealisticRender}].
   */
  set renderModes(value: number[]) {
    this.#renderModes = value;
    this.view.needsRender();
  }

  /**
   * Gets which rendering modes in which to apply IBL.
   *
   * The {@link View} will apply IBL whenever {@link View.renderMode} has been set one of these values.
   *
   * Default value is [{@link constants!DetailedRender | DetailedRender},
   * {@link constants!RealisticRender | RealisticRender}].
   */
  get renderModes(): number[] {
    return this.#renderModes;
  }

  /**
   * Gets whether IBL is supported by this browser and GPU.
   */
  get supported(): boolean {
    return true;
  }

  /**
   * Returns true if IBL is currently possible (supported, and the current
   * view state is compatible). Called internally by renderer logic.
   * @private
   */
  get possible(): boolean {
    return this.supported;
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
   * Sets whether IBL is active. When `false`, the renderer keeps using
   * the flat ambient term from {@link View.getAmbientColorAndIntensity}.
   *
   * Default value is `true` — IBL fires whenever the active render
   * mode is in {@link IBL.renderModes}. Set this to `false` only when
   * you specifically want to disable IBL across all modes.
   */
  set enabled(value: boolean) {
    value = value === true;
    if (this.#enabled === value) return;
    this.#enabled = value;
    this.view.needsRender();
  }

  /**
   * Gets whether IBL is active.
   */
  get enabled(): boolean {
    return this.#enabled;
  }

  /**
   * Sets the IBL contribution multiplier. Range `[0, 1]`. Effectively
   * acts as a fade between the flat ambient (0) and full hemisphere
   * IBL (1). Has no effect while {@link IBL.enabled} is `false`.
   *
   * Default value is `1.0x`.
   */
  set intensity(value: number) {
    if (typeof value !== "number") return;
    if (this.#intensity === value) return;
    this.#intensity = value;
    this.view.needsRender();
  }

  /**
   * Gets the IBL contribution multiplier.
   */
  get intensity(): number {
    return this.#intensity;
  }

  /**
   * Sets the linear-space RGB colour the renderer returns for normals
   * facing world up.
   *
   * Default value is `[0.62, 0.72, 0.86]`.
   */
  set skyColor(value: Vec3) {
    if (!value || value.length < 3) {
      this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[IBL set skyColor] Invalid colour parameter."
      });
      return;
    }
    const c = this.#skyColor;
    if (c[0] === value[0] && c[1] === value[1] && c[2] === value[2]) return;
    c[0] = value[0]; c[1] = value[1]; c[2] = value[2];
    this.view.needsRender();
  }

  /**
   * Gets the linear-space RGB sky colour.
   */
  get skyColor(): Vec3 {
    return this.#skyColor;
  }

  /**
   * Sets the linear-space RGB colour the renderer returns for normals
   * facing world down.
   *
   * Default value is `[0.42, 0.36, 0.30]`.
   */
  set groundColor(value: Vec3) {
    if (!value || value.length < 3) {
      this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[IBL set groundColor] Invalid colour parameter."
      });
      return;
    }
    const c = this.#groundColor;
    if (c[0] === value[0] && c[1] === value[1] && c[2] === value[2]) return;
    c[0] = value[0]; c[1] = value[1]; c[2] = value[2];
    this.view.needsRender();
  }

  /**
   * Gets the linear-space RGB ground colour.
   */
  get groundColor(): Vec3 {
    return this.#groundColor;
  }

  /**
   * Sets the world-space up axis used to weight the sky/ground sample.
   * Override for non-Z-up scenes (e.g. `[0, 1, 0]` for Y-up).
   *
   * Default value is `[0, 0, 1]`.
   */
  set worldUp(value: Vec3) {
    if (!value || value.length < 3) return;
    const c = this.#worldUp;
    if (c[0] === value[0] && c[1] === value[1] && c[2] === value[2]) return;
    c[0] = value[0]; c[1] = value[1]; c[2] = value[2];
    this.view.needsRender();
  }

  /**
   * Gets the world-space up axis.
   */
  get worldUp(): Vec3 {
    return this.#worldUp;
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
    if (!this.#environmentImage && !this.#environmentSrc) return;
    this.#environmentSrc = undefined;
    this.#environmentImage = undefined;
    this.#environmentVersion++;
    this.view.needsRender();
  }

  /** The decoded environment image currently driving IBL, if any. */
  get environmentImage():
    HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas | undefined {
    return this.#environmentImage;
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
        enabled: this.enabled,
        intensity: this.intensity,
        skyColor: <Vec3>Array.from(this.skyColor),
        groundColor: <Vec3>Array.from(this.groundColor),
        worldUp: <Vec3>Array.from(this.worldUp)
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
    if (params.enabled !== undefined)     this.enabled     = params.enabled;
    if (params.intensity !== undefined)   this.intensity   = params.intensity;
    if (params.skyColor !== undefined)    this.skyColor    = <Vec3>Array.from(params.skyColor);
    if (params.groundColor !== undefined) this.groundColor = <Vec3>Array.from(params.groundColor);
    if (params.worldUp !== undefined)     this.worldUp     = <Vec3>Array.from(params.worldUp);
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
