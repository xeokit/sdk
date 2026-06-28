import {Scene} from "../../../model/scene/Scene";
import {TrianglesPrimitive} from "../../../base/constants";
import {
  composeMat4,
  createMat4Float64,
  identityMat4,
  inverseMat4,
  type Mat4,
  mulMat4,
} from "../../../base/math/matrix";
import type {Quat} from "../../../base/math/quat";
import {ScenePhysics} from "../ScenePhysics";

// Unit cube spanning [0,0,0]..[1,1,1].
const CUBE_POSITIONS = [
  0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0,
  0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1,
];
const CUBE_INDICES = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7];

const LOCAL_MATRIX: Mat4 = createMat4Float64([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  5, 6, 7, 1,
]);

// Prescribed rigid motion for the single step: translate + 90° about Z.
const MOTION_T: [number, number, number] = [3, -2, 1];
const MOTION_R: Quat = [0, 0, Math.SQRT1_2, Math.SQRT1_2];

/**
 * Minimal stand-in for the injected Rapier module. Every body reports the
 * caller-prescribed translation + rotation after `step()`, so one step
 * reproduces an arbitrary rigid motion deterministically.
 */
function makeFakeRapier() {
  const bodies: any[] = [];

  const makeBody = () => ({
    _t: {x: 0, y: 0, z: 0},
    _r: {x: 0, y: 0, z: 0, w: 1},
    translation() { return this._t; },
    rotation() { return this._r; },
  });

  const makeDesc = () => {
    const desc: any = {_t: [0, 0, 0]};
    desc.setTranslation = (x: number, y: number, z: number) => { desc._t = [x, y, z]; return desc; };
    return desc;
  };

  const makeCollider = () => {
    const c: any = {};
    c.setDensity = () => c;
    c.setFriction = () => c;
    c.setRestitution = () => c;
    return c;
  };

  return {
    World: class {
      gravity: any;
      timestep = 1 / 60;
      constructor(g: any) { this.gravity = g; }
      createRigidBody(desc: any) {
        const b = makeBody();
        b._t = {x: desc._t[0], y: desc._t[1], z: desc._t[2]};
        bodies.push(b);
        return b;
      }
      createCollider() { return makeCollider(); }
      removeRigidBody(b: any) {
        const i = bodies.indexOf(b);
        if (i >= 0) bodies.splice(i, 1);
      }
      step() {
        for (const b of bodies) {
          b._t = {x: MOTION_T[0], y: MOTION_T[1], z: MOTION_T[2]};
          b._r = {x: MOTION_R[0], y: MOTION_R[1], z: MOTION_R[2], w: MOTION_R[3]};
        }
      }
    },
    RigidBodyDesc: {dynamic: makeDesc, fixed: makeDesc, kinematicPositionBased: makeDesc},
    ColliderDesc: {cuboid: makeCollider, ball: makeCollider},
  };
}

function buildSceneWithModel(coordinateSystemBasis: number[]) {
  const scene = new Scene();
  const model = scene.createModel({
    id: "m",
    coordinateSystem: {basis: coordinateSystemBasis, origin: [0, 0, 0], units: "meters"},
  }).value!;
  model.createGeometry({
    id: "g", primitive: TrianglesPrimitive, positions: CUBE_POSITIONS, indices: CUBE_INDICES,
  });
  model.createMesh({id: "mesh", geometryId: "g", matrix: LOCAL_MATRIX});
  model.createObject({id: "obj", meshIds: ["mesh"]});
  return {scene, model};
}

describe("ScenePhysics writeback frame", () => {

  // A dynamic body undergoing rigid motion M (relative to its starting
  // transform) moves every mesh's WORLD matrix by exactly that same rigid
  // motion: worldAfter == M_now · inv(M_initial) · worldBefore. This must hold
  // regardless of the model's coordinate-system matrix, which the body
  // simulates in world space but writes back through the mesh's local matrix.
  function expectRigidMotionInWorld(coordinateSystemBasis: number[]) {
    const {scene, model} = buildSceneWithModel(coordinateSystemBasis);
    const mesh = model.objects["obj"].meshes[0];

    const worldBefore = createMat4Float64(mesh.worldMatrix as Mat4);

    const rapier = makeFakeRapier();
    const physics = new ScenePhysics(scene, {rapier, autoCreateBodies: false});
    physics.setBody("obj", {type: "dynamic"});

    // The body starts at the object's world-AABB centre with identity rotation.
    const t0 = physics.getBody("obj")!.translation();
    const initialBody = identityMat4();
    initialBody[12] = t0.x; initialBody[13] = t0.y; initialBody[14] = t0.z;

    physics.step();

    const bodyNow = composeMat4(MOTION_T, MOTION_R, [1, 1, 1], createMat4Float64());
    const invInitial = inverseMat4(initialBody, createMat4Float64());
    const rel = mulMat4(invInitial, worldBefore, createMat4Float64());
    const expectedWorld = mulMat4(bodyNow, rel, createMat4Float64());

    const worldAfter = mesh.worldMatrix as Mat4;
    for (let i = 0; i < 16; i++) {
      expect(worldAfter[i]).toBeCloseTo(expectedWorld[i], 6);
    }

    physics.destroy();
  }

  it("applies rigid body motion in world space with an identity coordinate system", () => {
    // Model basis == scene default (Z-up) => identity coordinateSystemMatrix.
    expectRigidMotionInWorld([1, 0, 0, 0, 0, 1, 0, 1, 0]);
  });

  it("applies rigid body motion in world space with a non-identity coordinate system", () => {
    // Y-up model basis vs the scene's Z-up default => non-identity
    // coordinateSystemMatrix, so world and local mesh frames differ.
    const {model} = buildSceneWithModel([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const csm = model.coordinateSystemMatrix as Mat4;
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const isIdentity = identity.every((v, i) => Math.abs(csm[i] - v) < 1e-9);
    expect(isIdentity).toBe(false); // guard: the test case is actually exercising a non-identity CSM

    expectRigidMotionInWorld([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });
});
