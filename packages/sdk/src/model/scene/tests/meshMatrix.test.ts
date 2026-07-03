import {buildMat4} from "../buildMat4";
import {getMeshWorldMatrix} from "../getMeshWorldMatrix";
import {Scene} from "../Scene";
import {TrianglesPrimitive} from "../../../base/constants";

// A right-handed Z-up basis (column-major), matching CoordinateSystem's default.
const Z_UP_BASIS = [1, 0, 0, 0, 0, 1, 0, 1, 0];

// Minimal CoordinateSystem stub — getMeshWorldMatrix/createCoordinateSystemTransform
// only read basis/origin/units/scaleToMeters off it.
function coordSystem(overrides: any = {}): any {
  return {basis: Z_UP_BASIS, origin: [0, 0, 0], units: "meters", scaleToMeters: 1, ...overrides};
}

describe("buildMat4", () => {

  it("returns the identity matrix for no transform params", () => {
    const m = buildMat4({});
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    for (let i = 0; i < 16; i++) {
      expect(m[i]).toBeCloseTo(identity[i], 6);
    }
  });

  it("returns the identity matrix for unit scale and zero translation", () => {
    const m = buildMat4({position: [0, 0, 0], scale: [1, 1, 1]});
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    for (let i = 0; i < 16; i++) {
      expect(m[i]).toBeCloseTo(identity[i], 6);
    }
  });

  it("places a pure translation in elements [12,13,14]", () => {
    const m = buildMat4({position: [10, 20, 30]});
    // Rotation/scale block stays identity.
    expect(m[0]).toBeCloseTo(1, 6);
    expect(m[5]).toBeCloseTo(1, 6);
    expect(m[10]).toBeCloseTo(1, 6);
    // Translation column.
    expect(m[12]).toBeCloseTo(10, 6);
    expect(m[13]).toBeCloseTo(20, 6);
    expect(m[14]).toBeCloseTo(30, 6);
    expect(m[15]).toBeCloseTo(1, 6);
  });

  it("places a pure uniform scale on the diagonal", () => {
    const m = buildMat4({scale: [2, 3, 4]});
    expect(m[0]).toBeCloseTo(2, 6);
    expect(m[5]).toBeCloseTo(3, 6);
    expect(m[10]).toBeCloseTo(4, 6);
    expect(m[15]).toBeCloseTo(1, 6);
    // No translation.
    expect(m[12]).toBeCloseTo(0, 6);
    expect(m[13]).toBeCloseTo(0, 6);
    expect(m[14]).toBeCloseTo(0, 6);
  });

  it("accepts rotation as an [x,y,z,w] quaternion", () => {
    // Identity quaternion → identity rotation block.
    const m = buildMat4({quaternion: [0, 0, 0, 1]});
    expect(m[0]).toBeCloseTo(1, 6);
    expect(m[5]).toBeCloseTo(1, 6);
    expect(m[10]).toBeCloseTo(1, 6);
  });
});

describe("getMeshWorldMatrix", () => {

  const translation = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 6, 7, 1];

  it("returns the mesh's own matrix when there is no parent transform", () => {
    const mesh: any = {matrix: translation};
    const result = getMeshWorldMatrix(mesh);
    expect(result).toBe(mesh.matrix);
  });

  it("returns an equivalent transform for an identity-equivalent target coordinate system", () => {
    const mesh: any = {
      matrix: translation,
      model: {coordinateSystem: coordSystem()},
    };
    // Same basis/origin/units/scale on both sides → the coord transform is identity,
    // so the world matrix is unchanged.
    const result = getMeshWorldMatrix(mesh, coordSystem());
    for (let i = 0; i < 16; i++) {
      expect(result[i]).toBeCloseTo(translation[i], 6);
    }
  });
});

describe("SceneMesh lazy world matrix + shared identity", () => {

  const QUAD_POSITIONS = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0];
  const QUAD_INDICES = [0, 1, 2, 0, 2, 3];
  const TRANSLATE = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 6, 7, 1];
  const PARENT_TRANSLATE = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 0, 1];

  function model() {
    const m = new Scene().createModel({id: "m"}).value!;
    m.createGeometry({id: "g", primitive: TrianglesPrimitive, positions: QUAD_POSITIONS, indices: QUAD_INDICES});
    return m;
  }

  it("does not allocate _worldMatrix when world equals local (identity coord system, no parent)", () => {
    const m = model();
    m.createMesh({id: "plain", geometryId: "g"});
    m.createMesh({id: "instanced", geometryId: "g", matrix: TRANSLATE as any});
    const plain = m.meshes["plain"] as any;
    const instanced = m.meshes["instanced"] as any;

    // Reading worldMatrix must not allocate the redundant copy...
    expect(plain.worldMatrix).toBe(plain.matrix);
    expect(instanced.worldMatrix).toBe(instanced.matrix);
    // ...and it must equal the local matrix value.
    expect(Array.from(instanced.worldMatrix)).toEqual(TRANSLATE);
    expect(plain._worldMatrix).toBeNull();
    expect(instanced._worldMatrix).toBeNull();
  });

  it("shares one identity matrix across untransformed meshes without cross-contamination", () => {
    const m = model();
    m.createMesh({id: "a", geometryId: "g"});
    m.createMesh({id: "b", geometryId: "g"});
    const a = m.meshes["a"] as any;
    const b = m.meshes["b"] as any;

    // Both untransformed meshes share the single identity sentinel.
    expect(a._localMatrix).toBe(b._localMatrix);

    // Writing a matrix to one must give it a private copy, leaving the other identity.
    a.matrix = TRANSLATE as any;
    expect(a._localMatrix).not.toBe(b._localMatrix);
    expect(Array.from(a.matrix)).toEqual(TRANSLATE);
    expect(Array.from(b.matrix)).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });

  it("allocates and uses _worldMatrix when a parent transform makes world != local", () => {
    const m = model();
    m.createTransform({id: "t", matrix: TRANSLATE as any}); // translation (5,6,7)
    m.createMesh({id: "x", geometryId: "g"});               // identity local
    const mesh = m.meshes["x"] as any;
    mesh.setParentTransformId("t");

    const world = mesh.worldMatrix;
    // Non-fast-path: the cache is allocated and returned.
    expect(mesh._worldMatrix).not.toBeNull();
    expect(world).toBe(mesh._worldMatrix);
    // parent translation composed with identity local.
    expect(world[12]).toBeCloseTo(5, 6);
    expect(world[13]).toBeCloseTo(6, 6);
    expect(world[14]).toBeCloseTo(7, 6);
  });

  it("preserves world matrix when reparenting a mesh with preserveWorld", () => {
    const m = model();
    m.createTransform({id: "parent", matrix: PARENT_TRANSLATE as any});
    m.createMesh({id: "x", geometryId: "g", matrix: TRANSLATE as any});
    const mesh = m.meshes["x"] as any;

    const before = Array.from(mesh.worldMatrix);
    const result = mesh.setParentTransformId("parent", {preserveWorld: true});

    expect(result.ok).toBe(true);
    expect(mesh.parentTransform).toBe(m.transforms["parent"]);
    const after = Array.from(mesh.worldMatrix);
    for (let i = 0; i < 16; i++) {
      expect(after[i]).toBeCloseTo(before[i], 6);
    }
    expect(mesh.matrix[12]).toBeCloseTo(-5, 6);
    expect(mesh.matrix[13]).toBeCloseTo(6, 6);
    expect(mesh.matrix[14]).toBeCloseTo(7, 6);
  });

  it("detaches child meshes when their parent transform is destroyed", () => {
    const m = model();
    m.createTransform({id: "t", matrix: TRANSLATE as any});
    m.createMesh({id: "x", geometryId: "g"});
    const transform = m.transforms["t"] as any;
    const mesh = m.meshes["x"] as any;

    mesh.setParentTransformId("t");
    expect(mesh.parentTransform).toBe(transform);
    expect(transform.childMeshes).toContain(mesh);

    const result = transform.destroy();

    expect(result.ok).toBe(true);
    expect(m.transforms["t"]).toBeUndefined();
    expect(transform.childMeshes).toHaveLength(0);
    expect(mesh.parentTransform).toBeNull();
    expect(mesh.worldMatrix).toBe(mesh.matrix);
  });

  it("preserves transform world matrix when detaching to root with a model coordinate system", () => {
    const m = new Scene().createModel({
      id: "m",
      coordinateSystem: {
        basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
        origin: [0, 0, 0],
        units: "meters",
        scaleToMeters: 1,
      },
    }).value!;
    m.createTransform({id: "parent", matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1] as any});
    m.createTransform({id: "child", parentTransformId: "parent", matrix: TRANSLATE as any});
    const child = m.transforms["child"] as any;

    const before = Array.from(child.worldMatrix);
    const result = child.setParentTransformId(null, {preserveWorld: true});

    expect(result.ok).toBe(true);
    expect(child.parentTransform).toBeNull();
    const after = Array.from(child.worldMatrix);
    for (let i = 0; i < 16; i++) {
      expect(after[i]).toBeCloseTo(before[i], 6);
    }
  });
});
