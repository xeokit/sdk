import {GLTFExporter} from "../GLTFExporter";
import {GLTFLoader} from "../GLTFLoader";
import {TrianglesPrimitive} from "../../../base/constants";

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

// The exporter reads geometry attributes (positionsCompressed/aabb/indices/
// primitive), reuses one accessor bundle per geom.id, and walks
// sceneModel.objects -> object.meshes. getMeshWorldMatrix reads sceneMesh.matrix
// (not worldMatrix), and meshes WITHOUT a `material` get a per-mesh inline
// material made of mesh.color x mesh.opacity (no textures -> no canvas/PNG).
function buildSource(matrix: number[], color: number[], opacity: number) {
  const geom = {
    id: "g1",
    primitive: TrianglesPrimitive,
    positionsCompressed: quantize(QUAD_POSITIONS, QUAD_AABB),
    aabb: QUAD_AABB,
    indices: QUAD_INDICES,
  };
  const mesh = {id: "mesh1", geometry: geom, color, opacity, matrix};
  const sceneModel: any = {
    id: "model1",
    scene: {coordinateSystem: {}},
    textures: {},
    materials: {},
    geometries: {g1: geom},
    objects: {Building1: {id: "Building1", meshes: [mesh]}},
  };
  return {sceneModel, mesh, geom};
}

// Convert the exporter's Uint8Array view into a clean standalone ArrayBuffer —
// ModelLoader.load requires `fileData instanceof ArrayBuffer`.
function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

describe("GLTFExporter / GLTFLoader", () => {

  it("writes a non-empty .glb with the glTF magic + version header", async () => {
    const {sceneModel} = buildSource(IDENTITY, [0.2, 0.4, 0.6], 1.0);

    const glb = await new GLTFExporter().write({sceneModel} as any);

    expect(glb).toBeInstanceOf(Uint8Array);
    expect(glb.length).toBeGreaterThan(20);

    // glb header: magic "glTF" (0x46546C67 little-endian), version, length.
    const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
    expect(view.getUint32(0, true)).toBe(0x46546C67); // "glTF"
    expect(String.fromCharCode(glb[0], glb[1], glb[2], glb[3])).toBe("glTF");
    expect(view.getUint32(4, true)).toBe(2);          // glTF version 2
    expect(view.getUint32(8, true)).toBe(glb.length); // total length

    // First chunk is JSON and must mention our mesh + accessors.
    const jsonChunkLen = view.getUint32(12, true);
    const jsonBytes = glb.subarray(20, 20 + jsonChunkLen);
    const json = JSON.parse(new TextDecoder().decode(jsonBytes));
    expect(json.asset.version).toBe("2.0");
    expect(json.meshes.length).toBeGreaterThan(0);
    expect(json.accessors.length).toBeGreaterThan(0);
    expect(json.nodes.some((n: any) => n.name === "Building1")).toBe(true);
    expect(json.nodes.some((n: any) => n.name === "mesh1")).toBe(true);
  });

  it("round-trips geometry + colour back through the GLTFLoader", async () => {
    // Translate the mesh by (10,20,30): the exporter writes this as the mesh
    // node's matrix, and the loader recovers it onto the round-tripped mesh.
    const matrix = [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  10, 20, 30, 1];
    const {sceneModel} = buildSource(matrix, [0.2, 0.4, 0.6], 0.5);

    const glb = await new GLTFExporter().write({sceneModel} as any);
    const fileData = toArrayBuffer(glb);

    // Re-import the exported .glb into capturing stubs.
    const calls: {geom: any[]; mesh: any[]; object: any[]; material: any[]} =
      {geom: [], mesh: [], object: [], material: []};
    const dstScene: any = {
      // The loader checks `sceneModel.objects[id]` / `sceneModel.geometries[id]`
      // for dedupe, so back these by live maps the stubs populate.
      objects: {},
      geometries: {},
      createGeometry: (p: any) => { calls.geom.push(p); dstScene.geometries[p.id] = p; return {ok: true, value: {id: p.id}}; },
      createMesh:     (p: any) => { calls.mesh.push(p);   return {ok: true, value: {id: p.id}}; },
      createObject:   (p: any) => { calls.object.push(p); dstScene.objects[p.id] = p; return {ok: true, value: {id: p.id}}; },
      createMaterial: (p: any) => { calls.material.push(p); return {ok: true, value: {id: p.id}}; },
    };

    await new GLTFLoader().load({fileData, sceneModel: dstScene} as any);

    // One geometry, one mesh, one object recovered.
    expect(calls.geom).toHaveLength(1);
    expect(calls.mesh).toHaveLength(1);
    expect(calls.object).toHaveLength(1);

    // Geometry survived: 4 quad corners (12 floats), 2 triangles (6 indices).
    const geom = calls.geom[0];
    expect(geom.primitive).toBe(TrianglesPrimitive);
    expect(geom.positions).toHaveLength(12);
    expect(geom.indices).toHaveLength(6);
    expect(Array.from(geom.indices)).toEqual([0, 1, 2, 0, 2, 3]);

    // Positions recover the source quad corners (mesh-local; the world
    // translation lives on the node matrix, not baked into positions).
    const positions = Array.from(geom.positions as Float32Array).map(v => +v.toFixed(4));
    expect(positions).toEqual([0, 0, 0,  1, 0, 0,  1, 1, 0,  0, 1, 0]);

    // The (10,20,30) translation came back as the mesh node matrix.
    const m = calls.mesh[0].matrix;
    expect(m[12]).toBeCloseTo(10, 4);
    expect(m[13]).toBeCloseTo(20, 4);
    expect(m[14]).toBeCloseTo(30, 4);

    // Colour + opacity round-tripped via the per-mesh inline glTF material.
    // The mesh has no explicit material, so the exporter wrote an inline one
    // (baseColorFactor = color x opacity), which the loader rebuilt as a
    // SceneMaterial the mesh now references by materialId.
    expect(calls.material).toHaveLength(1);
    const mat = calls.material[0];
    expect(Array.from(mat.color).map((v: any) => +v.toFixed(2))).toEqual([0.2, 0.4, 0.6]);
    expect(mat.opacity).toBeCloseTo(0.5, 2);
    expect(calls.mesh[0].materialId).toBe(mat.id);
  });
});
