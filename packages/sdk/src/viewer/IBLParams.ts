import type {Vec3} from "../math/vector";


/**
 * Parameters for {@link IBL}.
 *
 * * Returned by {@link IBL.toParams}
 * * Passed to {@link IBL.fromParams}
 * * Located at {@link ViewParams.ibl}
 */
export interface IBLParams {

  /**
   * Which rendering modes in which to apply {@link IBL}.
   *
   * Default value is [{@link constants!DetailedRender | DetailedRender},
   * {@link constants!RealisticRender | RealisticRender}].
   */
  renderModes?: number[];

  /**
   * Multiplier on the IBL ambient contribution. Range `[0, 1]`. At `1`
   * IBL fully replaces the flat ambient term; at `0` IBL contributes
   * nothing even when the active {@link View.renderMode} is in
   * {@link IBLParams.renderModes}.
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
