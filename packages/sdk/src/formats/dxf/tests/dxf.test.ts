import {LinesPrimitive, TrianglesPrimitive} from "../../../base/constants";
import {encode} from "../versions/v1_0/encode";
import {parse} from "../versions/v1_0/parse";

// Quantise positions to uint16 the way SceneGeometry stores them — the inverse
// of the exporter's decompressPoint3WithAABB3.
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

// Build a minimal SceneModel stub the DXF exporter can walk. The exporter
// reads geometry.positionsCompressed / aabb / indices / primitive and bakes
// each mesh's `matrix` (via getMeshWorldMatrix, which reads sceneMesh.matrix).
function buildTriSource(matrix: number[], color: number[]) {
  const geom = {
    id: "g1",
    primitive: TrianglesPrimitive,
    positionsCompressed: quantize(QUAD_POSITIONS, QUAD_AABB),
    aabb: QUAD_AABB,
    indices: QUAD_INDICES,
  };
  const mesh = {id: "mesh1", geometry: geom, color, matrix};
  const sceneModel: any = {
    objects: {Wall1: {id: "Wall1", meshes: [mesh]}},
  };
  return {sceneModel, mesh, geom};
}

// Parse the line-delimited DXF group-code pairs back into a quick lookup so
// tests can assert on structure without re-implementing the tokeniser.
function pairsOf(dxf: string): [string, string][] {
  const lines = dxf.split("\n");
  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    pairs.push([lines[i].trim(), lines[i + 1].trim()]);
  }
  return pairs;
}

// A capturing SceneModel: records every create* call so the round-trip can
// assert what the dwg emit step produced. `destroyed` must be falsy for the
// parser's guard.
function captureScene() {
  const calls: {geom: any[]; material: any[]; mesh: any[]; object: any[]} =
    {geom: [], material: [], mesh: [], object: []};
  const sceneModel: any = {
    id: "m",
    destroyed: false,
    createGeometry: (p: any) => { calls.geom.push(p);     return {ok: true, value: {}}; },
    createMaterial: (p: any) => { calls.material.push(p); return {ok: true, value: {}}; },
    createMesh:     (p: any) => { calls.mesh.push(p);     return {ok: true, value: {}}; },
    createObject:   (p: any) => { calls.object.push(p);   return {ok: true, value: {}}; },
    createTexture:  (p: any) => { return {ok: true, value: {}}; },
  };
  return {sceneModel, calls};
}

describe("DXFExporter / encode", () => {

  it("encodes a SceneModel to a structurally valid DXF text stream", async () => {
    const {sceneModel} = buildTriSource(IDENTITY, [0.2, 0.4, 0.6]);
    const dxf = await encode({sceneModel});

    expect(typeof dxf).toBe("string");
    const pairs = pairsOf(dxf);

    // HEADER section with R2000 version + millimetre units.
    expect(pairs).toContainEqual(["0", "SECTION"]);
    expect(pairs).toContainEqual(["2", "HEADER"]);
    expect(pairs).toContainEqual(["9", "$ACADVER"]);
    expect(pairs).toContainEqual(["1", "AC1015"]);
    expect(pairs).toContainEqual(["9", "$INSUNITS"]);

    // TABLES section with a LAYER table that includes the sanitised object id.
    expect(pairs).toContainEqual(["2", "TABLES"]);
    expect(pairs).toContainEqual(["2", "LAYER"]);
    expect(pairs).toContainEqual(["2", "Wall1"]);   // layer named after the SceneObject

    // ENTITIES section closes with EOF.
    expect(pairs).toContainEqual(["2", "ENTITIES"]);
    expect(pairs[pairs.length - 1]).toEqual(["0", "EOF"]);
  });

  it("emits one 3DFACE per triangle, on the object's layer, with true colour", async () => {
    const {sceneModel} = buildTriSource(IDENTITY, [1, 0, 0]);   // pure red
    const dxf = await encode({sceneModel});
    const pairs = pairsOf(dxf);

    // The quad's 2 triangles → 2 × 3DFACE.
    const faces = pairs.filter(([c, v]) => c === "0" && v === "3DFACE");
    expect(faces).toHaveLength(2);

    // Every face carries layer "Wall1" and true-colour 420. (Group code 62=7
    // is also written per-face as the ACI fallback, but the LAYER table emits
    // 62=7 too, so we don't count it here.)
    expect(pairs.filter(([c, v]) => c === "8" && v === "Wall1")).toHaveLength(2);
    // Pure red packs to (255<<16) = 16711680 on group code 420.
    expect(pairs.filter(([c, v]) => c === "420" && v === "16711680")).toHaveLength(2);

    // First face's first corner (group 10/20/30) is the quad origin (0,0,0).
    const i10 = pairs.findIndex(([c]) => c === "10");
    expect(Number(pairs[i10][1])).toBeCloseTo(0, 6);
    expect(Number(pairs[i10 + 1][1])).toBeCloseTo(0, 6);   // 20
  });

  it("emits LINE entities for a line-primitive geometry", async () => {
    const geom = {
      id: "g1",
      primitive: LinesPrimitive,
      positionsCompressed: quantize([0, 0, 0,  1, 0, 0], [0, 0, 0, 1, 1, 1]),
      aabb: [0, 0, 0, 1, 1, 1],
      indices: new Uint32Array([0, 1]),
    };
    const mesh = {id: "m1", geometry: geom, color: [0, 0, 1], matrix: IDENTITY};
    const sceneModel: any = {objects: {Edge1: {id: "Edge1", meshes: [mesh]}}};

    const dxf = await encode({sceneModel});
    const pairs = pairsOf(dxf);
    expect(pairs.filter(([c, v]) => c === "0" && v === "LINE")).toHaveLength(1);
    expect(pairs.filter(([c, v]) => c === "0" && v === "3DFACE")).toHaveLength(0);
  });

  it("skips empty SceneObjects", async () => {
    const sceneModel: any = {objects: {Empty: {id: "Empty", meshes: []}}};
    const dxf = await encode({sceneModel});
    const pairs = pairsOf(dxf);
    // No entity records, but the file is still well-formed (LAYER table empty,
    // ends in EOF).
    expect(pairs.filter(([c, v]) => c === "0" && v === "3DFACE")).toHaveLength(0);
    expect(pairs[pairs.length - 1]).toEqual(["0", "EOF"]);
  });
});


describe("DXF round-trip (encode → parse)", () => {

  it("round-trips triangle geometry back through the loader as fills", async () => {
    // Translate the mesh by (10, 20, 0): the exporter bakes the matrix into
    // absolute vertices, the loader must recover them.
    const matrix = [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  10, 20, 0, 1];
    const {sceneModel: src} = buildTriSource(matrix, [1, 0, 0]);
    const dxf = await encode({sceneModel: src});

    const {sceneModel: dst, calls} = captureScene();
    const res = await parse({fileData: dxf, sceneModel: dst});

    expect(res.ok).toBe(true);

    // 3DFACEs come back as a triangle fill mesh + object.
    expect(calls.geom.length).toBeGreaterThan(0);
    expect(calls.mesh.length).toBeGreaterThan(0);
    expect(calls.object.length).toBeGreaterThan(0);

    const triGeom = calls.geom.find((g) => g.primitive === TrianglesPrimitive);
    expect(triGeom).toBeDefined();

    // Recovered positions sit around the baked translation (10, 20) within
    // quantisation, proving the world matrix was folded in on export.
    const positions = triGeom.positions;
    let minX = Infinity, minY = Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      minX = Math.min(minX, positions[i]);
      minY = Math.min(minY, positions[i + 1]);
    }
    expect(minX).toBeCloseTo(10, 3);
    expect(minY).toBeCloseTo(20, 3);

    // Colour comes back via the ACI fallback (group 62 = 7 → white), NOT the
    // exported true-colour 420: the dwg emit step's colour resolver reads ACI
    // only. Documented limitation — assert the actual behaviour.
    expect(Array.from(triGeom.positions).length % 9).toBe(0);   // whole triangles
    const fillMesh = calls.mesh[0];
    expect(fillMesh.color).toEqual([1, 1, 1]);
  });

  it("parses a hand-written DXF LINE into a stroke mesh", async () => {
    // Minimal DXF: ENTITIES section with one LINE on layer 'A', ACI red (1).
    const dxf = [
      "0", "SECTION",
      "2", "ENTITIES",
      "0", "LINE",
      "8", "A",
      "62", "1",
      "10", "0",
      "20", "0",
      "30", "0",
      "11", "5",
      "21", "5",
      "31", "0",
      "0", "ENDSEC",
      "0", "EOF",
      "",
    ].join("\n");

    const {sceneModel: dst, calls} = captureScene();
    const res = await parse({fileData: dxf, sceneModel: dst});

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.segmentCount).toBe(1);
    }

    const lineGeom = calls.geom.find((g) => g.primitive === LinesPrimitive);
    expect(lineGeom).toBeDefined();
    // ACI index 1 → red.
    expect(calls.mesh[0].color).toEqual([1, 0, 0]);
    // Object id is derived from the layer name.
    expect(calls.object[0].id).toContain("A");
  });

  it("rejects empty / non-string fileData", async () => {
    const {sceneModel: dst} = captureScene();
    const res = await parse({fileData: "", sceneModel: dst});
    expect(res.ok).toBe(false);
  });
});
