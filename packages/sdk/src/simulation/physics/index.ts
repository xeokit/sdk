/**
 * # xeokit Scene Physics
 *
 * ---
 *
 * **Rigid-body physics for a {@link model!scene.Scene | Scene}, backed by a
 * caller-injected Rapier 3D world. One body per
 * {@link model!scene.SceneObject | SceneObject}, kept in step with the Scene
 * graph automatically.**
 *
 * ---
 *
 * The `physics` module attaches a Rapier rigid-body simulation to an
 * existing Scene. Each {@link model!scene.SceneObject | SceneObject} maps
 * one-to-one to a Rapier `RigidBody`; every constituent
 * {@link model!scene.SceneMesh | SceneMesh} moves together as one rigid body
 * via a cached rest-pose matrix multiply per step.
 *
 * Rapier is **not bundled** with the SDK — the caller supplies the
 * initialised Rapier module via {@link ScenePhysicsParams.rapier}. This
 * keeps the SDK Rapier-version-agnostic and lets demo / app code own
 * the WASM init step.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class getScenePhysics {
 *       +(scene, params) ScenePhysics
 *     }
 *     class ScenePhysics {
 *       +scene : Scene
 *       +world : Rapier.World
 *       +size  : number
 *       +setGravity(g)
 *       +setBody(objectId, params)
 *       +removeBody(objectId)
 *       +getBody(objectId)
 *       +applyImpulse(objectId, impulse)
 *       +setLinvel(objectId, vel)
 *       +step(dt?)
 *       +destroy()
 *     }
 *     class ScenePhysicsParams {
 *       +rapier            : RapierAPI
 *       +gravity?          : Vec3
 *       +autoCreateBodies? : boolean
 *     }
 *     class PhysicsBodyParams {
 *       +type?        : fixed | dynamic | kinematicPositionBased
 *       +shape?       : cuboid | ball
 *       +density?     : number
 *       +friction?    : number
 *       +restitution? : number
 *     }
 *     class Scene {
 *       <<scene>>
 *     }
 *     class SceneObject {
 *       <<scene>>
 *     }
 *     class RapierWorld {
 *       <<rapier>>
 *     }
 *     getScenePhysics ..> ScenePhysicsParams : reads
 *     getScenePhysics ..> ScenePhysics : caches
 *     ScenePhysics o-- Scene : observes
 *     ScenePhysics o-- RapierWorld : drives
 *     ScenePhysics "1" *-- "*" SceneObject : body per object
 *     ScenePhysics ..> PhysicsBodyParams : reads on setBody
 * ```
 *
 * <br>
 *
 * ## Lifecycle
 *
 * One {@link ScenePhysics} per {@link model!scene.Scene | Scene}, regardless
 * of how many panels / demos ask for it — {@link getScenePhysics}
 * caches by `scene.id` and auto-destroys on `onSceneDestroyed`.
 *
 * The engine self-maintains: it subscribes to
 * `onSceneObjectCreated` / `onSceneObjectDestroyed` /
 * `onSceneModelDestroyed` so Rapier bodies stay in step with the
 * Scene graph without caller bookkeeping.
 *
 * ```mermaid
 * flowchart TD
 *     A[Scene] -- created --> B[getScenePhysics]
 *     B --> C[ScenePhysics]
 *     C -- onSceneObjectCreated --> D[queue default body]
 *     C -- onSceneObjectDestroyed --> E[remove body]
 *     C -- step --> F[drain pending<br/>advance world<br/>write mesh.matrix]
 *     C -- onSceneDestroyed --> G[destroy]
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Caller-injected Rapier** — the SDK never imports
 *   `@dimforge/rapier3d-compat`; pass the initialised namespace via
 *   `params.rapier` so the host owns version + WASM init.
 * - **Body per SceneObject** — multi-mesh objects move rigidly
 *   together via one matrix multiply per mesh per step. No
 *   decompose / recompose cycle.
 * - **Auto-bodies** — every existing and future
 *   {@link model!scene.SceneObject | SceneObject} gets a default
 *   `fixed`-type cuboid body sized to its world AABB. Call
 *   {@link ScenePhysics.setBody | setBody} to upgrade specific
 *   objects to `"dynamic"` or `"kinematicPositionBased"`.
 * - **Lazy body creation** — bodies are queued on object-create
 *   events and only materialised at the next {@link ScenePhysics.step | step},
 *   so a freshly-loaded city pays no physics cost until the
 *   simulation actually runs.
 * - **Allocation-free step** — temp matrices and the iteration loop
 *   reuse pre-allocated scratch; the body-write pass is one matrix
 *   multiply per mesh.
 * - **Collision-index friendly** — `step` writes `mesh.matrix`
 *   without firing `onSceneMeshMoved`, so the
 *   {@link spatial!collision.SceneCollisionIndex | SceneCollisionIndex} BVH
 *   is *not* invalidated by physics motion and ray picks stay cheap
 *   during simulation.
 * - **Direct Rapier access** — {@link ScenePhysics.world | world}
 *   and {@link ScenePhysics.getBody | getBody} expose the raw
 *   Rapier objects for advanced use (joints, sensors, sleeping,
 *   queries) the surfaced API doesn't cover.
 *
 * <br>
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk @dimforge/rapier3d-compat
 * ```
 *
 * <br>
 *
 * ## Quick Start
 *
 * ### 1) Import the entry point
 *
 * ```javascript
 * import RAPIER from "@dimforge/rapier3d-compat";
 * import { getScenePhysics } from "@xeokit/sdk/studio/systems/physics";
 * ```
 *
 * <br>
 *
 * ### 2) Init the Rapier WASM module
 *
 * Rapier's `compat` build ships its WASM as a separate file that has
 * to be fetched and instantiated before the namespace is usable.
 * `await RAPIER.init()` does both. Run this once at app start.
 *
 * ```javascript
 * await RAPIER.init();
 * ```
 *
 * <br>
 *
 * ### 3) Get the cached engine for a Scene
 *
 * One engine per Scene — subsequent `getScenePhysics(scene, …)` calls
 * return the same instance regardless of `params`. The first caller
 * sets gravity and the auto-create policy; later callers' `params`
 * are ignored.
 *
 * ```javascript
 * const physics = getScenePhysics(scene, {
 *   rapier:  RAPIER,
 *   gravity: [0, 0, -9.81]      // Z-up scene; default is [0, 0, -9.81]
 * });
 * ```
 *
 * <br>
 *
 * ### 4) Drive the step loop
 *
 * Call `step()` once per frame. The engine drains pending body
 * creations, advances Rapier, then writes the new world transform
 * onto every dynamic / kinematic mesh.
 *
 * ```javascript
 * function frame() {
 *   physics.step();             // default 1/60 s timestep
 *   requestAnimationFrame(frame);
 * }
 * frame();
 * ```
 *
 * Pass `dt` for a fixed-rate sim independent of frame rate:
 *
 * ```javascript
 * physics.step(1 / 60);
 * ```
 *
 * <br>
 *
 * ### 5) Upgrade a body to dynamic
 *
 * Every SceneObject starts with a `fixed` cuboid body (so a loaded
 * BIM stays put). {@link ScenePhysics.setBody | setBody} replaces it
 * — pass `"dynamic"` + a shape and material params for the bodies
 * that should fall, roll, and collide.
 *
 * ```javascript
 * physics.setBody("ball-1", {
 *   type:        "dynamic",
 *   shape:       "ball",
 *   density:     2.0,
 *   friction:    0.3,
 *   restitution: 0.6
 * });
 * ```
 *
 * <br>
 *
 * ### 6) Push a body around
 *
 * Apply instantaneous impulses or set linear velocity directly. Both
 * no-op on `fixed` bodies; only dynamics respond.
 *
 * ```javascript
 * physics.applyImpulse("ball-1", [0, 0, 5]);       // kick up
 * physics.setLinvel  ("ball-1", [3, 0, 0]);        // slide along +X
 * ```
 *
 * <br>
 *
 * ### 7) Disable auto-bodies for fine-grained control
 *
 * When `autoCreateBodies: false`, the engine creates no bodies of
 * its own — the caller decides which objects participate by calling
 * {@link ScenePhysics.setBody | setBody}. Right for scenes where
 * most geometry is decorative and only a handful of objects need
 * simulation.
 *
 * ```javascript
 * const physics = getScenePhysics(scene, {
 *   rapier:           RAPIER,
 *   autoCreateBodies: false
 * });
 *
 * for (const id of dynamicObjectIds) {
 *   physics.setBody(id, { type: "dynamic", shape: "cuboid" });
 * }
 * ```
 *
 * <br>
 *
 * ### 8) Reach the raw Rapier API
 *
 * `physics.world` is the Rapier `World`; `physics.getBody(id)`
 * returns the `RigidBody`. Use them for everything the surface API
 * doesn't cover — joints, character controllers, shape-casts,
 * sleeping, etc.
 *
 * ```javascript
 * const ballBody = physics.getBody("ball-1");
 * const hingeJoint = physics.world.createImpulseJoint(
 *   RAPIER.JointData.revolute(
 *     { x: 0, y: 0, z: 0 },
 *     { x: 0, y: 0, z: 0 },
 *     { x: 0, y: 0, z: 1 }
 *   ),
 *   ballBody,
 *   physics.getBody("hinge"),
 *   true
 * );
 * ```
 *
 * <br>
 *
 * ### 9) Tearing down
 *
 * Teardown is automatic — the engine destroys itself when its Scene
 * fires `onSceneDestroyed`. To detach earlier, call
 * {@link ScenePhysics.destroy | destroy} directly; the next
 * `getScenePhysics(scene, …)` call will create a fresh engine.
 *
 * ```javascript
 * physics.destroy();
 * ```
 *
 * @module physics
 */
export * from "./ScenePhysics";
export * from "./ScenePhysicsParams";
export * from "./PhysicsBodyParams";
export * from "./getScenePhysics";
