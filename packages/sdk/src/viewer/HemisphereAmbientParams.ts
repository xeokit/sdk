import type {Vec3} from "../math/vector";


/**
 * Parameters for {@link HemisphereAmbient}.
 *
 * * Returned by {@link HemisphereAmbient.toParams}
 * * Passed to {@link HemisphereAmbient.fromParams}
 * * Located at {@link LightsParams.hemispheric}
 */
export interface HemisphereAmbientParams {

  /**
   * Which rendering modes in which to apply the hemisphere ambient term.
   *
   * The {@link View} will apply the hemisphere ambient whenever
   * {@link View.renderMode} is set to one of these values.
   *
   * Default value is
   * `[NavigationRender, DetailedRender, RealisticRender]` — the
   * hemisphere term is cheap and applies in every mode by default, so
   * non-IBL modes don't drop back to flat ambient.
   */
  renderModes?: number[];

  /**
   * Multiplier on the hemisphere ambient contribution. Range `[0, ∞)`.
   * At `0` the hemisphere term contributes nothing (and the renderer
   * falls back to flat ambient only). At `1` it contributes at full
   * strength.
   *
   * Default value is `1.0`.
   */
  intensity?: number;

  /**
   * Linear-space RGB colour returned for normals that face the world's
   * up direction. Stored as `[r, g, b]` in `[0, 1]`.
   *
   * Default value is a temperate-overcast pale blue
   * `[0.62, 0.72, 0.86]`. Tonemap and exposure operate on the result
   * downstream.
   */
  skyColor?: Vec3;

  /**
   * Linear-space RGB colour returned for normals that face the world's
   * down direction. Stored as `[r, g, b]` in `[0, 1]`.
   *
   * Default value is a warm tan `[0.42, 0.36, 0.30]`, picked to
   * approximate the soft uplight you get on the underside of objects
   * standing on a wood / concrete floor.
   */
  groundColor?: Vec3;

  /**
   * World-space "up" axis used to weight the sky / ground sample.
   * Default `[0, 0, 1]` for the SDK's standard Z-up convention.
   * Override (e.g. `[0, 1, 0]`) when the scene authored axis runs
   * differently.
   */
  worldUp?: Vec3;
}
