import type {Vec3} from "../../math/vector";

// Rapier is injected by the caller — the SDK never imports
// `@dimforge/rapier3d-compat`. We treat the namespace as `any` so the
// SDK compiles without rapier installed; the public API uses concrete
// TypeScript types where possible and falls back to `any` only at the
// rapier boundary.
type RapierAPI = any;

/**
 * Construction parameters for {@link ScenePhysics}.
 */
export interface ScenePhysicsParams {

  /**
   * Initialised Rapier 3D module — typically the namespace returned by
   * `import RAPIER from "@dimforge/rapier3d-compat"` after the WASM module
   * has been loaded with `await RAPIER.init()`.
   *
   * Externally injected so the SDK does not bundle Rapier.
   */
  rapier: RapierAPI;

  /**
   * World gravity, in scene units per second². Defaults to a Z-up gravity
   * of `[0, 0, -9.81]` to match the cityscape and other Z-up models in the
   * demo set.
   */
  gravity?: Vec3;

  /**
   * Whether to auto-create a default `fixed`-type body (cuboid sized to
   * the object's world AABB) for every {@link scene!SceneObject} that
   * appears in the scene, including ones added later via
   * `onSceneObjectCreated`. Default `true`.
   *
   * When `false`, the engine creates no bodies on its own — the caller
   * decides which objects participate in physics by calling
   * {@link ScenePhysics.setBody}.
   */
  autoCreateBodies?: boolean;
}
