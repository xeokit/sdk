import type {Scene, SceneMesh, SceneObject} from "../../scene";
import {
  type AABB3,
  type AABB3Float,
  collapseAABB3,
  createAABB3Float64,
  expandAABB3
} from "../../math/boundaries";
import type {Vec3} from "../../math/vector";
import {
  composeMat4,
  createMat4Float64,
  identityMat4,
  inverseMat4,
  type Mat4,
  mulMat4
} from "../../math/matrix";
import type {Quat} from "../../math/quat";

import type {ScenePhysicsParams} from "./ScenePhysicsParams";
import type {PhysicsBodyParams} from "./PhysicsBodyParams";


// Rapier is injected by the caller — the SDK never imports
// `@dimforge/rapier3d-compat`. The shape of the namespace surfaces we touch is
// captured loosely below; the caller passes in the real module and the engine
// uses it untyped at runtime.
//
// Treat `RapierAPI` as the "namespace" object exported by the rapier
// module (i.e. what you get from `import RAPIER from "@dimforge/rapier3d-compat"`
// after `await RAPIER.init()`). `RapierWorld`, `RapierRigidBody`, etc. are the
// runtime types from the same module.
//
// We deliberately type these as `any` so the SDK compiles without rapier
// installed; the public API uses concrete TypeScript types where possible
// and falls back to `any` only at the rapier boundary.
type RapierAPI       = any;
type RapierWorld     = any;
type RapierRigidBody = any;


/**
 * Internal record kept per object that has a body in the world.
 *
 * `meshRelMatrices` is the per-mesh "rest pose" relative to the body's
 * initial transform — at every step we just multiply by the body's current
 * world transform to get each mesh's new world matrix, with no decompose /
 * recompose cycle.
 *
 * @internal
 */
interface BodyRecord {
  body: RapierRigidBody;
  collider: any;
  meshRelMatrices: { mesh: SceneMesh; rel: Mat4 }[];
  isDynamic: boolean;
  isKinematic: boolean;
}


/**
 * High-performance physics engine bound to a {@link Scene}, backed by a
 * caller-injected Rapier 3D world.
 *
 * Mirrors the cached-singleton pattern of `SceneCollisionIndex` — get one
 * via {@link getScenePhysics} and the engine self-maintains: it watches
 * `onSceneObjectCreated` / `onSceneObjectDestroyed` /
 * `onSceneModelDestroyed` and keeps Rapier rigid bodies in step with the
 * Scene.
 *
 * ## Usage
 *
 * ```ts
 * import RAPIER from "@dimforge/rapier3d-compat";
 * await RAPIER.init();
 *
 * const physics = getScenePhysics(scene, { rapier: RAPIER });
 *
 * // The default body for every SceneObject is fixed + cuboid (city stays put).
 * // Upgrade specific objects to dynamic to drop them under gravity:
 * physics.setBody("ball-1", { type: "dynamic", shape: "ball", restitution: 0.6 });
 *
 * function frame() {
 *   physics.step();             // advances Rapier and writes mesh transforms
 *   requestAnimationFrame(frame);
 * }
 * frame();
 * ```
 *
 * ## Architecture
 *
 * - **Body per SceneObject** — multi-mesh objects move rigidly together.
 *   Each mesh's world matrix at body-creation time is recorded relative to
 *   the body's starting transform, and reproduced post-step by one matrix
 *   multiply.
 * - **Cuboid AABB colliders by default** — cheap, fits BIM blocks, swap to
 *   `"ball"` per-object when needed. Trimesh / convex hull is doable but
 *   not enabled here; AABB is enough for the demo cases this is built for.
 * - **Lazy + event-driven** — bodies created on first call to
 *   {@link step} (so a freshly-loaded city doesn't pay the body-creation
 *   cost until the simulation actually starts), then refreshed
 *   incrementally as the scene mutates.
 * - **No allocations per step** — temp matrices and the body-iteration
 *   loop reuse pre-allocated scratch.
 *
 * Setting `mesh.matrix` per step fires `onSceneMeshMatrixChanged` (which
 * triggers a re-render) but not `onSceneMeshMoved`, so the
 * {@link SceneCollisionIndex} BVH is *not* invalidated by physics motion —
 * BVH ray picks remain cheap during simulation.
 */
export class ScenePhysics {

  /** The Scene this engine drives. */
  public readonly scene: Scene;

  /**
   * The Rapier `World` instance. Exposed for advanced users who want to
   * reach in and use Rapier directly (e.g. add joints, queries, sensors).
   */
  public readonly world: RapierWorld;

  readonly #rapier: RapierAPI;
  readonly #autoCreate: boolean;

  /** objectId → BodyRecord. */
  readonly #bodies: Map<string, BodyRecord> = new Map();

  /** objectIds queued for default-body creation on the next step. */
  readonly #pending: Set<string> = new Set();

  readonly #unsubscribers: (() => void)[] = [];

  /** Reusable scratch — never read between iterations of step(). */
  readonly #scratchBodyMat:  Mat4 = createMat4Float64();
  readonly #scratchMeshMat:  Mat4 = createMat4Float64();
  readonly #scratchInvMat:   Mat4 = createMat4Float64();
  readonly #scratchAABB:     AABB3Float = createAABB3Float64();
  readonly #scratchMeshAABB: AABB3Float = createAABB3Float64();

  constructor(scene: Scene, params: ScenePhysicsParams) {
    this.scene = scene;
    this.#rapier = params.rapier;
    this.#autoCreate = params.autoCreateBodies !== false;

    const g = params.gravity ?? [0, 0, -9.81];
    this.world = new this.#rapier.World({x: g[0], y: g[1], z: g[2]});

    if (this.#autoCreate) {
      // Mark every existing SceneObject pending so it gets a default body
      // on the first step(). New objects join the queue via the listener
      // below — this stays uniform whether you load the scene before or
      // after creating the engine.
      const objects = scene.objects;
      for (const id in objects) this.#pending.add(id);
    }

    this.#unsubscribers.push(
      scene.events.onSceneObjectCreated.subscribe((_, obj) => {
        if (this.#autoCreate) this.#pending.add(obj.id);
      }),
      scene.events.onSceneObjectDestroyed.subscribe((_, obj) => {
        this.removeBody(obj.id);
        this.#pending.delete(obj.id);
      }),
      scene.events.onSceneModelDestroyed.subscribe((_, model) => {
        const objs = model.objects;
        for (const id in objs) {
          this.removeBody(id);
          this.#pending.delete(id);
        }
      })
    );
  }

  /**
   * Sets gravity on the world. `[x, y, z]` in the scene's coordinate basis.
   */
  setGravity(g: Vec3): void {
    this.world.gravity = {x: g[0], y: g[1], z: g[2]};
  }

  /**
   * Creates or replaces the body for one SceneObject. Returns the new
   * Rapier `RigidBody`, or `null` when the object isn't in the scene or
   * has no usable geometry.
   *
   * Use this to upgrade a default-fixed body to dynamic, swap a cuboid
   * for a ball, or attach friction/restitution to specific objects.
   */
  setBody(objectId: string, params: PhysicsBodyParams = {}): RapierRigidBody | null {
    const sceneObject = this.scene.objects[objectId];
    if (!sceneObject) return null;

    if (this.#bodies.has(objectId)) this.removeBody(objectId);

    // Take this id off the auto-create queue. If it stayed there, the next
    // step() drain would overwrite our explicit dynamic body with a default
    // fixed one — the cause of "balls don't move" until you click step()
    // hard enough to lose the race.
    this.#pending.delete(objectId);

    return this.#createBody(sceneObject, params);
  }

  /**
   * Removes the body for an object. No-op if there's no body.
   */
  removeBody(objectId: string): void {
    const record = this.#bodies.get(objectId);
    if (!record) return;
    // Removing the body also removes its colliders.
    this.world.removeRigidBody(record.body);
    this.#bodies.delete(objectId);
  }

  /**
   * Returns the underlying Rapier `RigidBody`, or `null` if there's none.
   * Use it to call Rapier APIs not surfaced here (joints, sleeping,
   * additional colliders, ...).
   */
  getBody(objectId: string): RapierRigidBody | null {
    return this.#bodies.get(objectId)?.body ?? null;
  }

  /**
   * Applies an instantaneous impulse at the body's centre of mass.
   * Wakes the body if it was sleeping. No-op for fixed / non-existent
   * bodies.
   */
  applyImpulse(objectId: string, impulse: Vec3): void {
    const record = this.#bodies.get(objectId);
    if (!record || !record.isDynamic) return;
    record.body.applyImpulse({x: impulse[0], y: impulse[1], z: impulse[2]}, true);
  }

  /**
   * Sets a dynamic body's linear velocity outright.
   */
  setLinvel(objectId: string, vel: Vec3): void {
    const record = this.#bodies.get(objectId);
    if (!record || !record.isDynamic) return;
    record.body.setLinvel({x: vel[0], y: vel[1], z: vel[2]}, true);
  }

  /**
   * Number of bodies currently in the world.
   */
  get size(): number {
    return this.#bodies.size;
  }

  /**
   * Advances the simulation one step and writes the new world transforms
   * back to every dynamic / kinematic SceneMesh.
   *
   * Lazy-creates default bodies for any SceneObject queued by event since
   * the previous step. Fixed bodies are never written back — they don't
   * move.
   *
   * Optional `dt` overrides Rapier's integration timestep for this call;
   * use it when you want to drive the simulation at a fixed rate
   * independent of frame rate. Otherwise Rapier uses its default
   * `1/60` s.
   */
  step(dt?: number): void {

    // Drain pending SceneObjects into the world before stepping so a
    // freshly-spawned object becomes part of this frame's simulation.
    // Skip ids that already have an explicit body (set via setBody between
    // the create-event and this drain) — overwriting them with a default
    // fixed body would silently freeze a dynamic ball in mid-air.
    if (this.#pending.size > 0) {
      const ids = Array.from(this.#pending);
      this.#pending.clear();
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        if (this.#bodies.has(id)) continue;
        const obj = this.scene.objects[id];
        if (obj) this.#createBody(obj, {});
      }
    }

    if (dt !== undefined && dt > 0) {
      this.world.timestep = dt;
    }
    this.world.step();

    // Sync dynamic + kinematic bodies back to mesh transforms. Fixed
    // bodies never move, so they don't need writing.
    const bodyMat = this.#scratchBodyMat;
    const meshMat = this.#scratchMeshMat;

    for (const record of this.#bodies.values()) {
      if (!record.isDynamic && !record.isKinematic) continue;

      const t = record.body.translation();
      const r = record.body.rotation();
      composeMat4(
        [t.x, t.y, t.z],
        [r.x, r.y, r.z, r.w] as Quat,
        [1, 1, 1],
        bodyMat
      );

      for (let i = 0, n = record.meshRelMatrices.length; i < n; i++) {
        const entry = record.meshRelMatrices[i];
        mulMat4(bodyMat, entry.rel, meshMat);
        // SceneMesh.matrix takes a Mat4 by value; we pass the scratch and
        // the setter copies it. The scratch is safe to reuse next iter.
        entry.mesh.matrix = meshMat;
      }
    }
  }

  /**
   * Tears down event subscriptions and frees the Rapier world. After this
   * call the engine is unusable.
   */
  destroy(): void {
    for (const u of this.#unsubscribers) u();
    this.#unsubscribers.length = 0;
    this.#bodies.clear();
    this.#pending.clear();
    if (typeof this.world.free === "function") this.world.free();
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  #createBody(sceneObject: SceneObject, params: PhysicsBodyParams): RapierRigidBody | null {
    const aabb = this.#computeObjectAABB(sceneObject);
    if (!aabb) return null;

    const cx = (aabb[0] + aabb[3]) * 0.5;
    const cy = (aabb[1] + aabb[4]) * 0.5;
    const cz = (aabb[2] + aabb[5]) * 0.5;
    const hx = Math.max((aabb[3] - aabb[0]) * 0.5, 1e-4);
    const hy = Math.max((aabb[4] - aabb[1]) * 0.5, 1e-4);
    const hz = Math.max((aabb[5] - aabb[2]) * 0.5, 1e-4);

    const RAPIER = this.#rapier;
    const type = params.type ?? "fixed";

    let bodyDesc: any;
    switch (type) {
      case "dynamic":
        bodyDesc = RAPIER.RigidBodyDesc.dynamic();
        break;
      case "kinematicPositionBased":
        bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
        break;
      case "fixed":
      default:
        bodyDesc = RAPIER.RigidBodyDesc.fixed();
        break;
    }
    bodyDesc.setTranslation(cx, cy, cz);
    const body = this.world.createRigidBody(bodyDesc);

    let colliderDesc: any;
    switch (params.shape ?? "cuboid") {
      case "ball":
        colliderDesc = RAPIER.ColliderDesc.ball(Math.max(hx, hy, hz));
        break;
      case "cuboid":
      default:
        colliderDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz);
        break;
    }
    if (params.density    !== undefined) colliderDesc.setDensity(params.density);
    if (params.friction   !== undefined) colliderDesc.setFriction(params.friction);
    if (params.restitution!== undefined) colliderDesc.setRestitution(params.restitution);

    const collider = this.world.createCollider(colliderDesc, body);

    // Per-mesh "rest pose" relative to the body's initial transform. The
    // body starts at (cx, cy, cz) with identity rotation, so the inverse
    // of its initial transform is just translation by -centre.
    const initialBodyMat = identityMat4();
    initialBodyMat[12] = cx;
    initialBodyMat[13] = cy;
    initialBodyMat[14] = cz;
    inverseMat4(initialBodyMat, this.#scratchInvMat);

    const meshRelMatrices: { mesh: SceneMesh; rel: Mat4 }[] = [];
    const meshes = sceneObject.meshes;
    for (let i = 0, n = meshes.length; i < n; i++) {
      const mesh = meshes[i];
      const rel = createMat4Float64();
      mulMat4(this.#scratchInvMat, mesh.matrix as Mat4, rel);
      meshRelMatrices.push({mesh, rel});
    }

    const record: BodyRecord = {
      body,
      collider,
      meshRelMatrices,
      isDynamic:   type === "dynamic",
      isKinematic: type === "kinematicPositionBased"
    };
    this.#bodies.set(sceneObject.id, record);
    return body;
  }

  /**
   * World-space AABB unioned across every mesh of `sceneObject`. Returns
   * `null` for objects with no usable geometry. Same construction as the
   * BVH's per-object AABB so the body sizing matches what spatial queries
   * see.
   */
  #computeObjectAABB(sceneObject: SceneObject): AABB3Float | null {
    const out = this.#scratchAABB;
    collapseAABB3(out);
    let found = false;
    const meshes = sceneObject.meshes;
    for (let i = 0, n = meshes.length; i < n; i++) {
      const mesh = meshes[i];
      const geom = mesh.geometry;
      if (!geom) continue;
      transformAABB3(geom.aabb, mesh.worldMatrix, this.#scratchMeshAABB);
      expandAABB3(out, this.#scratchMeshAABB);
      found = true;
    }
    return found ? out : null;
  }
}


/**
 * Center/extents transform of a local-space AABB by an affine 4×4 matrix.
 * Inlined here rather than imported to keep ScenePhysics self-contained.
 *
 * @internal
 */
function transformAABB3(local: AABB3, matrix: Mat4, out: AABB3Float): AABB3Float {
  const minX = local[0], minY = local[1], minZ = local[2];
  const maxX = local[3], maxY = local[4], maxZ = local[5];

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  const ex = (maxX - minX) * 0.5;
  const ey = (maxY - minY) * 0.5;
  const ez = (maxZ - minZ) * 0.5;

  const m00 = matrix[0],  m01 = matrix[4],  m02 = matrix[8],  m03 = matrix[12];
  const m10 = matrix[1],  m11 = matrix[5],  m12 = matrix[9],  m13 = matrix[13];
  const m20 = matrix[2],  m21 = matrix[6],  m22 = matrix[10], m23 = matrix[14];

  const wcx = m00 * cx + m01 * cy + m02 * cz + m03;
  const wcy = m10 * cx + m11 * cy + m12 * cz + m13;
  const wcz = m20 * cx + m21 * cy + m22 * cz + m23;
  const wex = Math.abs(m00) * ex + Math.abs(m01) * ey + Math.abs(m02) * ez;
  const wey = Math.abs(m10) * ex + Math.abs(m11) * ey + Math.abs(m12) * ez;
  const wez = Math.abs(m20) * ex + Math.abs(m21) * ey + Math.abs(m22) * ez;

  out[0] = wcx - wex;
  out[1] = wcy - wey;
  out[2] = wcz - wez;
  out[3] = wcx + wex;
  out[4] = wcy + wey;
  out[5] = wcz + wez;
  return out;
}
