import type {Vec3} from "@xeokit/sdk/base/math/vector";


/**
 * Tuning parameters for {@link planCameraTour}. Every field is
 * optional; defaults target a typical AECO walkthrough at
 * metre-scale.
 *
 * Forwarded verbatim to the pluggable {@link SpaceExtractor},
 * {@link ViewpointSampler}, and {@link TourPlanner} so custom
 * implementations can honour the same caller intent.
 */
export interface CameraTourPlanOptions {

  /**
   * Camera eye height above each space's floor, world units.
   * Default `1.7` (≈ standing eye level in metres).
   */
  eyeHeight?: number;

  /**
   * Minimum clearance from any wall or occluder when placing a
   * viewpoint, world units. Default `0.4`.
   */
  wallClearance?: number;

  /**
   * Maximum viewpoint candidates the sampler emits per space.
   * The tour planner picks one; higher budgets give the planner
   * more headroom at the cost of sampling time. Default `8`.
   */
  maxViewpointsPerRoom?: number;

  /**
   * Number of rays cast per viewpoint when scoring visibility.
   * Default `64`. `0` disables visibility scoring and relies on
   * centroid placement.
   */
  visibilityRayCount?: number;

  /**
   * Dwell duration at each in-space waypoint, ms.
   * Default `2000`.
   */
  dwellMs?: number;

  /**
   * Inter-waypoint flight duration estimate, ms. Used to bill
   * the {@link CameraTour.estimatedDurationMs} and to seed
   * playback when the caller doesn't override per-leg timing.
   * Default `1500`.
   */
  flightDurationMs?: number;

  /**
   * Vertical field-of-view used to score visibility coverage,
   * degrees. Default `60`. Independent of the playing View's
   * actual FOV unless `playCameraTour` is asked to override.
   */
  fovDeg?: number;

  /**
   * Up vector. Defaults to the source Scene's
   * `coordinateSystem.worldUp`.
   */
  up?: Vec3;

  /**
   * Optional starting space hint — either a SceneObject id or
   * an `IfcSpace` DataObject id. When supplied, the tour begins
   * in this space; otherwise the planner picks one (typically
   * the largest ground-floor space).
   */
  startSpaceId?: string;

  /**
   * Progress callback fired once per planning stage with `t` in
   * `[0, 1]`. Useful for HUD progress bars on big buildings
   * where the visibility scoring takes a few hundred ms.
   */
  onProgress?: (stage: "extract" | "sample" | "plan" | "smooth", t: number) => void;
}
