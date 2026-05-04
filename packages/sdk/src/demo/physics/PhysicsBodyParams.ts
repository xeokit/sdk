/**
 * Per-object body configuration accepted by {@link ScenePhysics.setBody}.
 */
export interface PhysicsBodyParams {

  /**
   * Body type:
   *   - `"fixed"` (default) — never moves. Static collider.
   *   - `"dynamic"` — pushed around by gravity, impulses, and contacts.
   *   - `"kinematicPositionBased"` — moved by the caller via setNextKinematicTranslation;
   *     not affected by gravity but pushes dynamic bodies aside.
   */
  type?: "fixed" | "dynamic" | "kinematicPositionBased";

  /**
   * Collider shape:
   *   - `"cuboid"` (default) — a box matching the object's world AABB. Cheap,
   *     handles every BIM-style block geometry.
   *   - `"ball"` — a sphere whose radius is the largest world-AABB half-extent.
   *     Useful for projectiles, droplets, marbles.
   */
  shape?: "cuboid" | "ball";

  /** Collider density (kg / m³ at unit gravity). Defaults to `1.0`. */
  density?: number;

  /** Coulomb friction coefficient. Defaults to `0.5`. */
  friction?: number;

  /**
   * Coefficient of restitution (0 = inelastic, 1 = perfectly elastic).
   * Defaults to `0.0`.
   */
  restitution?: number;
}
