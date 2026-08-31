var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
var __accessCheck = (obj, member, msg) => {
  if (!member.has(obj))
    throw TypeError("Cannot " + msg);
};
var __privateGet = (obj, member, getter) => {
  __accessCheck(obj, member, "read from private field");
  return getter ? getter.call(obj) : member.get(obj);
};
var __privateAdd = (obj, member, value) => {
  if (member.has(obj))
    throw TypeError("Cannot add the same private member more than once");
  member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
};
var __privateSet = (obj, member, value, setter) => {
  __accessCheck(obj, member, "write to private field");
  setter ? setter.call(obj, value) : member.set(obj, value);
  return value;
};
var __privateMethod = (obj, member, method) => {
  __accessCheck(obj, member, "access private method");
  return method;
};

// libs/examples/src/physics/PhysicsMath.ts
function createAABB3Float64() {
  return [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
}
function collapseAABB3(aabb) {
  aabb[0] = Infinity;
  aabb[1] = Infinity;
  aabb[2] = Infinity;
  aabb[3] = -Infinity;
  aabb[4] = -Infinity;
  aabb[5] = -Infinity;
  return aabb;
}
function expandAABB3(aabb, other) {
  aabb[0] = Math.min(aabb[0], other[0]);
  aabb[1] = Math.min(aabb[1], other[1]);
  aabb[2] = Math.min(aabb[2], other[2]);
  aabb[3] = Math.max(aabb[3], other[3]);
  aabb[4] = Math.max(aabb[4], other[4]);
  aabb[5] = Math.max(aabb[5], other[5]);
  return aabb;
}
function createMat4Float64() {
  return identityMat4();
}
function identityMat4() {
  return [
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1
  ];
}
function composeMat4(position, quaternion, scale, out = createMat4Float64()) {
  const x = quaternion[0], y = quaternion[1], z = quaternion[2], w = quaternion[3];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  const sx = scale[0], sy = scale[1], sz = scale[2];
  out[0] = (1 - (yy + zz)) * sx;
  out[1] = (xy + wz) * sx;
  out[2] = (xz - wy) * sx;
  out[3] = 0;
  out[4] = (xy - wz) * sy;
  out[5] = (1 - (xx + zz)) * sy;
  out[6] = (yz + wx) * sy;
  out[7] = 0;
  out[8] = (xz + wy) * sz;
  out[9] = (yz - wx) * sz;
  out[10] = (1 - (xx + yy)) * sz;
  out[11] = 0;
  out[12] = position[0];
  out[13] = position[1];
  out[14] = position[2];
  out[15] = 1;
  return out;
}
function mulMat4(a, b, out = createMat4Float64()) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  const b00 = b[0], b01 = b[1], b02 = b[2], b03 = b[3];
  const b10 = b[4], b11 = b[5], b12 = b[6], b13 = b[7];
  const b20 = b[8], b21 = b[9], b22 = b[10], b23 = b[11];
  const b30 = b[12], b31 = b[13], b32 = b[14], b33 = b[15];
  out[0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
  out[1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
  out[2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
  out[3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;
  out[4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
  out[5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
  out[6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
  out[7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;
  out[8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
  out[9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
  out[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
  out[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;
  out[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
  out[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
  out[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
  out[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;
  return out;
}
function inverseMat4(a, out = createMat4Float64()) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) {
    return identityMat4();
  }
  det = 1 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}

// libs/examples/src/physics/ScenePhysics.ts
var _rapier, _autoCreate, _bodies, _pending, _unsubscribers, _scratchBodyMat, _scratchMeshMat, _scratchInvMat, _scratchAABB, _scratchMeshAABB, _detachMeshFromBody, detachMeshFromBody_fn, _attachMeshToBody, attachMeshToBody_fn, _computeInvParent, computeInvParent_fn, _createBody, createBody_fn, _computeObjectAABB, computeObjectAABB_fn;
var ScenePhysics = class {
  constructor(scene, params) {
    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------
    /**
     * Drops `mesh` from the body's `meshRelMatrices` if present.
     * Triggered by `onSceneObjectMeshRemoved` so the per-step writeback
     * stops touching meshes that are no longer part of the SceneObject
     * (which would either NPE on a destroyed mesh or move an orphan
     * no longer attached to the Scene).
     */
    __privateAdd(this, _detachMeshFromBody);
    /**
     * Appends `mesh` to the body's `meshRelMatrices` with its rest pose
     * derived from the body's *current* world transform. Triggered by
     * `onSceneObjectMeshAdded` so a re-style cycle (destroy old mesh →
     * create new mesh on the same SceneObject) immediately re-attaches
     * the new mesh to the body — the new mesh tracks the body from the
     * very next `step()` instead of being silently dropped.
     *
     * Idempotent: if `mesh` is already in the list (some loader paths
     * fire add twice during a transactional reskin), the second call is
     * a no-op.
     */
    __privateAdd(this, _attachMeshToBody);
    /**
     * Inverse of the mesh's parent-world transform — the matrix that maps a
     * world matrix back to `SceneMesh.matrix`'s local frame. Derived purely
     * from public API: `worldMatrix = parentWorld · matrix`, so
     * `parentWorld = worldMatrix · inv(matrix)` and
     * `inv(parentWorld) = matrix · inv(worldMatrix)`. Identity when the model's
     * coordinate-system matrix (and any parent transform) is identity, in which
     * case the world-space body transform is written straight to the local matrix.
     */
    __privateAdd(this, _computeInvParent);
    __privateAdd(this, _createBody);
    /**
     * World-space AABB unioned across every mesh of `sceneObject`. Returns
     * `null` for objects with no usable geometry. Same construction as the
     * BVH's per-object AABB so the body sizing matches what spatial queries
     * see.
     */
    __privateAdd(this, _computeObjectAABB);
    /** The Scene this engine drives. */
    __publicField(this, "scene");
    /**
     * The Rapier `World` instance. Exposed for advanced users who want to
     * reach in and use Rapier directly (e.g. add joints, queries, sensors).
     */
    __publicField(this, "world");
    __privateAdd(this, _rapier, void 0);
    __privateAdd(this, _autoCreate, void 0);
    /** objectId → BodyRecord. */
    __privateAdd(this, _bodies, /* @__PURE__ */ new Map());
    /** objectIds queued for default-body creation on the next step. */
    __privateAdd(this, _pending, /* @__PURE__ */ new Set());
    __privateAdd(this, _unsubscribers, []);
    /** Reusable scratch — never read between iterations of step(). */
    __privateAdd(this, _scratchBodyMat, createMat4Float64());
    __privateAdd(this, _scratchMeshMat, createMat4Float64());
    __privateAdd(this, _scratchInvMat, createMat4Float64());
    __privateAdd(this, _scratchAABB, createAABB3Float64());
    __privateAdd(this, _scratchMeshAABB, createAABB3Float64());
    this.scene = scene;
    __privateSet(this, _rapier, params.rapier);
    __privateSet(this, _autoCreate, params.autoCreateBodies !== false);
    const g = params.gravity ?? [0, 0, -9.81];
    this.world = new (__privateGet(this, _rapier)).World({ x: g[0], y: g[1], z: g[2] });
    if (__privateGet(this, _autoCreate)) {
      const objects = scene.objects;
      for (const id in objects)
        __privateGet(this, _pending).add(id);
    }
    __privateGet(this, _unsubscribers).push(
      scene.events.onSceneObjectCreated.subscribe((_, obj) => {
        if (__privateGet(this, _autoCreate))
          __privateGet(this, _pending).add(obj.id);
      }),
      scene.events.onSceneObjectDestroyed.subscribe((_, obj) => {
        this.removeBody(obj.id);
        __privateGet(this, _pending).delete(obj.id);
      }),
      scene.events.onSceneModelDestroyed.subscribe((_, model) => {
        const objs = model.objects;
        for (const id in objs) {
          this.removeBody(id);
          __privateGet(this, _pending).delete(id);
        }
      }),
      // Mesh-membership events. The re-style flow used by
      // `applyHeatMapMaterials` and `applyIFCMaterials` swaps a
      // mesh's material by destroying the old SceneMesh and
      // creating a fresh one with the same id and matrix on the
      // same SceneObject. Without these handlers, the body's
      // `meshRelMatrices` keeps a reference to the destroyed
      // mesh — `step()` then writes `.matrix` onto an orphan and
      // the freshly-created mesh never tracks the body. We just
      // patch the entry list in-place: drop the dead mesh on
      // remove, append the new one on add (with its rel-pose
      // recomputed against the body's current world transform so
      // the swap is seamless mid-simulation).
      scene.events.onSceneObjectMeshRemoved.subscribe((obj, mesh) => {
        __privateMethod(this, _detachMeshFromBody, detachMeshFromBody_fn).call(this, obj.id, mesh);
      }),
      scene.events.onSceneObjectMeshAdded.subscribe((obj, mesh) => {
        __privateMethod(this, _attachMeshToBody, attachMeshToBody_fn).call(this, obj.id, mesh);
      })
    );
  }
  /**
   * Sets gravity on the world. `[x, y, z]` in the scene's coordinate basis.
   */
  setGravity(g) {
    this.world.gravity = { x: g[0], y: g[1], z: g[2] };
  }
  /**
   * Creates or replaces the body for one SceneObject. Returns the new
   * Rapier `RigidBody`, or `null` when the object isn't in the scene or
   * has no usable geometry.
   *
   * Use this to upgrade a default-fixed body to dynamic, swap a cuboid
   * for a ball, or attach friction/restitution to specific objects.
   */
  setBody(objectId, params = {}) {
    const sceneObject = this.scene.objects[objectId];
    if (!sceneObject)
      return null;
    if (__privateGet(this, _bodies).has(objectId))
      this.removeBody(objectId);
    __privateGet(this, _pending).delete(objectId);
    return __privateMethod(this, _createBody, createBody_fn).call(this, sceneObject, params);
  }
  /**
   * Removes the body for an object. No-op if there's no body.
   */
  removeBody(objectId) {
    const record = __privateGet(this, _bodies).get(objectId);
    if (!record)
      return;
    this.world.removeRigidBody(record.body);
    __privateGet(this, _bodies).delete(objectId);
  }
  /**
   * Returns the underlying Rapier `RigidBody`, or `null` if there's none.
   * Use it to call Rapier APIs not surfaced here (joints, sleeping,
   * additional colliders, ...).
   */
  getBody(objectId) {
    return __privateGet(this, _bodies).get(objectId)?.body ?? null;
  }
  /**
   * Applies an instantaneous impulse at the body's centre of mass.
   * Wakes the body if it was sleeping. No-op for fixed / non-existent
   * bodies.
   */
  applyImpulse(objectId, impulse) {
    const record = __privateGet(this, _bodies).get(objectId);
    if (!record || !record.isDynamic)
      return;
    record.body.applyImpulse({ x: impulse[0], y: impulse[1], z: impulse[2] }, true);
  }
  /**
   * Sets a dynamic body's linear velocity outright.
   */
  setLinvel(objectId, vel) {
    const record = __privateGet(this, _bodies).get(objectId);
    if (!record || !record.isDynamic)
      return;
    record.body.setLinvel({ x: vel[0], y: vel[1], z: vel[2] }, true);
  }
  /**
   * Number of bodies currently in the world.
   */
  get size() {
    return __privateGet(this, _bodies).size;
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
  step(dt) {
    if (__privateGet(this, _pending).size > 0) {
      const ids = Array.from(__privateGet(this, _pending));
      __privateGet(this, _pending).clear();
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        if (__privateGet(this, _bodies).has(id))
          continue;
        const obj = this.scene.objects[id];
        if (obj)
          __privateMethod(this, _createBody, createBody_fn).call(this, obj, {});
      }
    }
    if (dt !== void 0 && dt > 0) {
      this.world.timestep = dt;
    }
    this.world.step();
    const bodyMat = __privateGet(this, _scratchBodyMat);
    const meshMat = __privateGet(this, _scratchMeshMat);
    for (const record of __privateGet(this, _bodies).values()) {
      if (!record.isDynamic && !record.isKinematic)
        continue;
      const t = record.body.translation();
      const r = record.body.rotation();
      composeMat4(
        [t.x, t.y, t.z],
        [r.x, r.y, r.z, r.w],
        [1, 1, 1],
        bodyMat
      );
      for (let i = 0, n = record.meshRelMatrices.length; i < n; i++) {
        const entry = record.meshRelMatrices[i];
        mulMat4(bodyMat, entry.rel, meshMat);
        mulMat4(entry.invParent, meshMat, meshMat);
        entry.mesh.matrix = meshMat;
      }
    }
  }
  /**
   * Tears down event subscriptions and frees the Rapier world. After this
   * call the engine is unusable.
   */
  destroy() {
    for (const u of __privateGet(this, _unsubscribers))
      u();
    __privateGet(this, _unsubscribers).length = 0;
    __privateGet(this, _bodies).clear();
    __privateGet(this, _pending).clear();
    if (typeof this.world.free === "function")
      this.world.free();
  }
};
_rapier = new WeakMap();
_autoCreate = new WeakMap();
_bodies = new WeakMap();
_pending = new WeakMap();
_unsubscribers = new WeakMap();
_scratchBodyMat = new WeakMap();
_scratchMeshMat = new WeakMap();
_scratchInvMat = new WeakMap();
_scratchAABB = new WeakMap();
_scratchMeshAABB = new WeakMap();
_detachMeshFromBody = new WeakSet();
detachMeshFromBody_fn = function(objectId, mesh) {
  const record = __privateGet(this, _bodies).get(objectId);
  if (!record)
    return;
  const list = record.meshRelMatrices;
  for (let i = 0, n = list.length; i < n; i++) {
    if (list[i].mesh === mesh) {
      list.splice(i, 1);
      return;
    }
  }
};
_attachMeshToBody = new WeakSet();
attachMeshToBody_fn = function(objectId, mesh) {
  const record = __privateGet(this, _bodies).get(objectId);
  if (!record)
    return;
  const list = record.meshRelMatrices;
  for (let i = 0, n = list.length; i < n; i++) {
    if (list[i].mesh === mesh)
      return;
  }
  const t = record.body.translation();
  const r = record.body.rotation();
  composeMat4(
    [t.x, t.y, t.z],
    [r.x, r.y, r.z, r.w],
    [1, 1, 1],
    __privateGet(this, _scratchBodyMat)
  );
  inverseMat4(__privateGet(this, _scratchBodyMat), __privateGet(this, _scratchInvMat));
  const rel = createMat4Float64();
  mulMat4(__privateGet(this, _scratchInvMat), mesh.worldMatrix, rel);
  list.push({ mesh, rel, invParent: __privateMethod(this, _computeInvParent, computeInvParent_fn).call(this, mesh) });
};
_computeInvParent = new WeakSet();
computeInvParent_fn = function(mesh) {
  const invWorld = inverseMat4(mesh.worldMatrix, createMat4Float64());
  return mulMat4(mesh.matrix, invWorld, createMat4Float64());
};
_createBody = new WeakSet();
createBody_fn = function(sceneObject, params) {
  const aabb = __privateMethod(this, _computeObjectAABB, computeObjectAABB_fn).call(this, sceneObject);
  if (!aabb)
    return null;
  const cx = (aabb[0] + aabb[3]) * 0.5;
  const cy = (aabb[1] + aabb[4]) * 0.5;
  const cz = (aabb[2] + aabb[5]) * 0.5;
  const hx = Math.max((aabb[3] - aabb[0]) * 0.5, 1e-4);
  const hy = Math.max((aabb[4] - aabb[1]) * 0.5, 1e-4);
  const hz = Math.max((aabb[5] - aabb[2]) * 0.5, 1e-4);
  const RAPIER = __privateGet(this, _rapier);
  const type = params.type ?? "fixed";
  let bodyDesc;
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
  let colliderDesc;
  switch (params.shape ?? "cuboid") {
    case "ball":
      colliderDesc = RAPIER.ColliderDesc.ball(Math.max(hx, hy, hz));
      break;
    case "cuboid":
    default:
      colliderDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz);
      break;
  }
  if (params.density !== void 0)
    colliderDesc.setDensity(params.density);
  if (params.friction !== void 0)
    colliderDesc.setFriction(params.friction);
  if (params.restitution !== void 0)
    colliderDesc.setRestitution(params.restitution);
  const collider = this.world.createCollider(colliderDesc, body);
  const initialBodyMat = identityMat4();
  initialBodyMat[12] = cx;
  initialBodyMat[13] = cy;
  initialBodyMat[14] = cz;
  inverseMat4(initialBodyMat, __privateGet(this, _scratchInvMat));
  const meshRelMatrices = [];
  const meshes = sceneObject.meshes;
  for (let i = 0, n = meshes.length; i < n; i++) {
    const mesh = meshes[i];
    const rel = createMat4Float64();
    mulMat4(__privateGet(this, _scratchInvMat), mesh.worldMatrix, rel);
    meshRelMatrices.push({ mesh, rel, invParent: __privateMethod(this, _computeInvParent, computeInvParent_fn).call(this, mesh) });
  }
  const record = {
    body,
    collider,
    meshRelMatrices,
    isDynamic: type === "dynamic",
    isKinematic: type === "kinematicPositionBased"
  };
  __privateGet(this, _bodies).set(sceneObject.id, record);
  return body;
};
_computeObjectAABB = new WeakSet();
computeObjectAABB_fn = function(sceneObject) {
  const out = __privateGet(this, _scratchAABB);
  collapseAABB3(out);
  let found = false;
  const meshes = sceneObject.meshes;
  for (let i = 0, n = meshes.length; i < n; i++) {
    const mesh = meshes[i];
    const geom = mesh.geometry;
    if (!geom)
      continue;
    transformAABB3(geom.aabb, mesh.worldMatrix, __privateGet(this, _scratchMeshAABB));
    expandAABB3(out, __privateGet(this, _scratchMeshAABB));
    found = true;
  }
  return found ? out : null;
};
function transformAABB3(local, matrix, out) {
  const minX = local[0], minY = local[1], minZ = local[2];
  const maxX = local[3], maxY = local[4], maxZ = local[5];
  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  const ex = (maxX - minX) * 0.5;
  const ey = (maxY - minY) * 0.5;
  const ez = (maxZ - minZ) * 0.5;
  const m00 = matrix[0], m01 = matrix[4], m02 = matrix[8], m03 = matrix[12];
  const m10 = matrix[1], m11 = matrix[5], m12 = matrix[9], m13 = matrix[13];
  const m20 = matrix[2], m21 = matrix[6], m22 = matrix[10], m23 = matrix[14];
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

// libs/examples/src/physics/getScenePhysics.ts
var scenePhysicsCache = {};
function getScenePhysics(scene, params) {
  let physics = scenePhysicsCache[scene.id];
  if (!physics) {
    physics = new ScenePhysics(scene, params);
    scenePhysicsCache[scene.id] = physics;
    scene.events.onSceneDestroyed.subscribe((destroyedScene) => {
      scenePhysicsCache[destroyedScene.id]?.destroy();
      delete scenePhysicsCache[destroyedScene.id];
    });
  }
  return physics;
}
export {
  ScenePhysics,
  getScenePhysics
};
//# sourceMappingURL=index.js.map
