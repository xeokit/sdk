import {encode} from "../versions/v1_0/encode";
import {parse} from "../versions/v1_0/parse";

// Quantise positions to uint16 the way SceneGeometry stores them — the inverse
// of the encoder's decompressPoint3WithAABB3.
function quantize(positions: number[], aabb: number[]): Uint16Array {
  const q = new Uint16Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const min = aabb[k], max = aabb[k + 3];
      q[i + k] = Math.round(((positions[i + k] - min) / (max - min)) * 65535);
    }
  }
  return q;
}

// A unit quad (2 triangles) in the XY plane.
const QUAD_POSITIONS = [0, 0, 0,  1, 0, 0,  1, 1, 0,  0, 1, 0];
const QUAD_AABB = [0, 0, 0, 1, 1, 1];
const QUAD_INDICES = new Uint32Array([0, 1, 2, 0, 2, 3]);
const IDENTITY = [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1];

// getMeshWorldMatrix reads sceneMesh.matrix (and walks parentTransform), so the
// stub mesh carries `matrix`, not `worldMatrix`.
function buildSource(matrix: number[]) {
  const geom = {
    id: "g1",
    positionsCompressed: quantize(QUAD_POSITIONS, QUAD_AABB),
    aabb: QUAD_AABB,
    indices: QUAD_INDICES,
  };
  const mesh = {id: "mesh1", geometry: geom, matrix};
  const sceneModel: any = {
    id: "model1",
    geometries: {g1: geom},
    objects: {Building1: {id: "Building1", meshes: [mesh]}},
  };
  return {sceneModel, mesh, geom};
}

describe("OBJExporter / OBJLoader", () => {

  it("encodes a SceneModel to OBJ text with v / f lines", async () => {
    const {sceneModel} = buildSource(IDENTITY);

    const obj = await encode({sceneModel} as any);

    const lines = obj.split("\n");
    const vLines = lines.filter(l => l.startsWith("v "));
    const fLines = lines.filter(l => l.startsWith("f "));

    // One object/group declared for the SceneObject.
    expect(lines.some(l => l.startsWith("o "))).toBe(true);
    expect(lines.some(l => l.startsWith("g "))).toBe(true);

    // 4 quad corners -> 4 `v` lines; 2 triangles -> 2 `f` lines.
    expect(vLines).toHaveLength(4);
    expect(fLines).toHaveLength(2);

    // Vertices recover the source corners (identity matrix, exact AABB).
    expect(vLines[0]).toBe("v 0 0 0");
    expect(vLines[1]).toBe("v 1 0 0");
    expect(vLines[2]).toBe("v 1 1 0");
    expect(vLines[3]).toBe("v 0 1 0");

    // OBJ faces are 1-based: indices [0,1,2, 0,2,3] -> [1 2 3, 1 3 4].
    expect(fLines[0]).toBe("f 1 2 3");
    expect(fLines[1]).toBe("f 1 3 4");
  });

  it("offsets face indices across multiple meshes", async () => {
    // Two SceneObjects, each one quad. The second mesh's faces must reference
    // vertices 5..8, not 1..4, via the running vertexOffset.
    const geomFor = () => ({
      id: "g",
      positionsCompressed: quantize(QUAD_POSITIONS, QUAD_AABB),
      aabb: QUAD_AABB,
      indices: QUAD_INDICES,
    });
    const sceneModel: any = {
      id: "model2",
      objects: {
        A: {id: "A", meshes: [{id: "ma", geometry: geomFor(), matrix: IDENTITY}]},
        B: {id: "B", meshes: [{id: "mb", geometry: geomFor(), matrix: IDENTITY}]},
      },
    };

    const obj = await encode({sceneModel} as any);
    const fLines = obj.split("\n").filter(l => l.startsWith("f "));

    expect(fLines).toHaveLength(4);
    expect(fLines[0]).toBe("f 1 2 3");
    expect(fLines[1]).toBe("f 1 3 4");
    expect(fLines[2]).toBe("f 5 6 7");
    expect(fLines[3]).toBe("f 5 7 8");
  });

  it("emits a mtllib directive when mtlFileName is supplied", async () => {
    const {sceneModel} = buildSource(IDENTITY);
    const obj = await encode({sceneModel} as any, {mtlFileName: "scene.mtl"});
    expect(obj.split("\n")).toContain("mtllib scene.mtl");
  });

  it("round-trips geometry back through the OBJ parser", async () => {
    // Translate the mesh by (10,20,30): the encoder bakes the matrix into the
    // OBJ vertices, and the parser reads them back as absolute positions.
    const matrix = [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  10, 20, 30, 1];
    const {sceneModel} = buildSource(matrix);

    const obj = await encode({sceneModel} as any);

    // Re-import the exported text into capturing stubs.
    const calls: {geom: any[]; mesh: any[]; object: any[]} = {geom: [], mesh: [], object: []};
    const dstScene: any = {
      createGeometry: (p: any) => { calls.geom.push(p);   return {ok: true, value: {}}; },
      createMesh:     (p: any) => { calls.mesh.push(p);   return {ok: true, value: {}}; },
      createObject:   (p: any) => { calls.object.push(p); return {ok: true, value: {}}; },
    };

    await parse({fileData: obj, sceneModel: dstScene} as any, {});

    // One geometry, one mesh, one object recovered.
    expect(calls.geom).toHaveLength(1);
    expect(calls.mesh).toHaveLength(1);
    expect(calls.object).toHaveLength(1);

    // Geometry survived: 4 deduped vertices, 2 triangles (6 indices).
    const geom = calls.geom[0];
    expect(geom.positions).toHaveLength(12);
    expect(geom.indices).toHaveLength(6);

    // Absolute vertices recovered around the baked translation (10,20,30).
    const positions = geom.positions;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      minX = Math.min(minX, positions[i]);
      minY = Math.min(minY, positions[i + 1]);
      minZ = Math.min(minZ, positions[i + 2]);
    }
    expect(minX).toBeCloseTo(10, 6);
    expect(minY).toBeCloseTo(20, 6);
    expect(minZ).toBeCloseTo(30, 6);
  });
});
