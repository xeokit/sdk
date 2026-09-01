import {GLTFExporter} from "../GLTFExporter";
import {GLTFLoader} from "../GLTFLoader";
import {LinearFilter, LinesPrimitive, PNGMediaType, TrianglesPrimitive} from "../../../base/constants";
import {Scene} from "../../../model/scene";

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
const QUAD_UVS = [0, 0,  1, 0,  1, 1,  0, 1];
const QUAD_AABB = [0, 0, 0, 1, 1, 1];
const QUAD_INDICES = new Uint32Array([0, 1, 2, 0, 2, 3]);
const IDENTITY = [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1];
const PNG = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]).buffer;

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

function readGLBJSON(glb: Uint8Array): any {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const jsonChunkLen = view.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonChunkLen)));
}

function align4(length: number): number {
  return (length + 3) & ~3;
}

function buildLineStripGLB(): ArrayBuffer {
  const positions = new Float32Array([
    0, 0, 0,
    1, 0, 0,
    2, 0, 0,
    3, 0, 0,
    4, 0, 0
  ]);
  const indices = new Uint16Array([0, 1, 2, 3, 4]);
  const positionsBytes = new Uint8Array(positions.buffer);
  const indicesBytes = new Uint8Array(indices.buffer);
  const indicesOffset = align4(positionsBytes.length);
  const binLength = align4(indicesOffset + indicesBytes.length);
  const bin = new Uint8Array(binLength);
  bin.set(positionsBytes, 0);
  bin.set(indicesBytes, indicesOffset);

  const gltf = {
    asset: {version: "2.0"},
    scene: 0,
    scenes: [{nodes: [0]}],
    nodes: [{name: "line-strip", mesh: 0}],
    meshes: [{
      primitives: [{
        mode: 3,
        attributes: {POSITION: 0},
        indices: 1
      }]
    }],
    buffers: [{byteLength: binLength}],
    bufferViews: [
      {buffer: 0, byteOffset: 0, byteLength: positionsBytes.length},
      {buffer: 0, byteOffset: indicesOffset, byteLength: indicesBytes.length}
    ],
    accessors: [
      {bufferView: 0, componentType: 5126, count: 5, type: "VEC3", min: [0, 0, 0], max: [4, 0, 0]},
      {bufferView: 1, componentType: 5123, count: 5, type: "SCALAR", min: [0], max: [4]}
    ]
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonLength = align4(jsonBytes.length);
  const totalLength = 12 + 8 + jsonLength + 8 + binLength;
  const glb = new Uint8Array(totalLength);
  const view = new DataView(glb.buffer);
  view.setUint32(0, 0x46546C67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4E4F534A, true);
  glb.set(jsonBytes, 20);
  glb.fill(0x20, 20 + jsonBytes.length, 20 + jsonLength);
  const binHeader = 20 + jsonLength;
  view.setUint32(binHeader, binLength, true);
  view.setUint32(binHeader + 4, 0x004E4942, true);
  glb.set(bin, binHeader + 8);
  return glb.buffer;
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

  it("exports default SceneTexture mipmap opt-in as a non-mipmapped min filter", async () => {
    const sceneModel = new Scene().createModel({id: "model1"}).value!;
    sceneModel.createGeometry({id: "g", primitive: TrianglesPrimitive, positions: QUAD_POSITIONS, uvs: QUAD_UVS, indices: Array.from(QUAD_INDICES)});
    sceneModel.createTexture({id: "tex", buffers: [PNG()], mediaType: PNGMediaType});
    sceneModel.createMaterial({id: "mat", colorTextureId: "tex"});
    sceneModel.createMesh({id: "mesh", geometryId: "g", materialId: "mat"});
    sceneModel.createObject({id: "obj", meshIds: ["mesh"]});

    const glb = await new GLTFExporter().write({sceneModel} as any);
    const json = readGLBJSON(glb);
    const samplerIndex = json.textures[0].sampler;

    expect(json.samplers[samplerIndex].minFilter).toBe(9729);
  });

  it("exports explicit SceneTexture mipmap opt-in as a mipmapped min filter", async () => {
    const sceneModel = new Scene().createModel({id: "model1"}).value!;
    sceneModel.createGeometry({id: "g", primitive: TrianglesPrimitive, positions: QUAD_POSITIONS, uvs: QUAD_UVS, indices: Array.from(QUAD_INDICES)});
    sceneModel.createTexture({
      id: "tex",
      buffers: [PNG()],
      mediaType: PNGMediaType,
      minFilter: LinearFilter,
      mipmap: true
    });
    sceneModel.createMaterial({id: "mat", colorTextureId: "tex"});
    sceneModel.createMesh({id: "mesh", geometryId: "g", materialId: "mat"});
    sceneModel.createObject({id: "obj", meshIds: ["mesh"]});

    const glb = await new GLTFExporter().write({sceneModel} as any);
    const json = readGLBJSON(glb);
    const samplerIndex = json.textures[0].sampler;

    expect(json.samplers[samplerIndex].minFilter).toBe(9987);
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
    // translation lives on the node matrix, not embedded into positions).
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

  it("round-trips UVs (TEXCOORD_0) — textures are useless without them", async () => {
    // SceneGeometry stores UVs as plain float in `uvsCompressed` with NO
    // `uvsDecompressMatrix` (the matrix exists only for quantised UVs). The
    // exporter must emit those directly; a regression that gated UV export on
    // the matrix silently dropped TEXCOORD_0 and broke every texture.
    const UVS = new Float32Array([0, 0,  1, 0,  1, 1,  0, 1]);
    const geom = {
      id: "g1",
      primitive: TrianglesPrimitive,
      positionsCompressed: quantize(QUAD_POSITIONS, QUAD_AABB),
      aabb: QUAD_AABB,
      indices: QUAD_INDICES,
      uvsCompressed: UVS, // plain float, no decompress matrix
    };
    const mesh = {id: "mesh1", geometry: geom, color: [1, 1, 1], opacity: 1, matrix: IDENTITY};
    const sceneModel: any = {
      id: "model1",
      scene: {coordinateSystem: {}},
      textures: {},
      materials: {},
      geometries: {g1: geom},
      objects: {Building1: {id: "Building1", meshes: [mesh]}},
    };

    const glb = await new GLTFExporter().write({sceneModel} as any);
    const fileData = toArrayBuffer(glb);

    const geomCalls: any[] = [];
    const dstScene: any = {
      objects: {}, geometries: {},
      createGeometry: (p: any) => { geomCalls.push(p); dstScene.geometries[p.id] = p; return {ok: true, value: {id: p.id}}; },
      createMesh:     (p: any) => ({ok: true, value: {id: p.id}}),
      createObject:   (p: any) => { dstScene.objects[p.id] = p; return {ok: true, value: {id: p.id}}; },
      createMaterial: (p: any) => ({ok: true, value: {id: p.id}}),
    };

    await new GLTFLoader().load({fileData, sceneModel: dstScene} as any);

    expect(geomCalls).toHaveLength(1);
    const uvs = geomCalls[0].uvs;
    expect(uvs).toBeDefined();
    expect(uvs).toHaveLength(8);
    expect(Array.from(uvs as Float32Array).map(v => +v.toFixed(4))).toEqual([0, 0,  1, 0,  1, 1,  0, 1]);
  });

  it("round-trips scalar KHR_materials_clearcoat factors", async () => {
    const {sceneModel, mesh} = buildSource(IDENTITY, [1, 1, 1], 1.0);
    const material: any = {
      id: "clearcoatPaint",
      color: [0.1, 0.2, 0.5],
      opacity: 1,
      roughness: 0.4,
      metallic: 0,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      alphaMode: 0,
      alphaCutoff: 0.5,
      emissiveColor: [0, 0, 0],
    };
    sceneModel.materials[material.id] = material;
    mesh.material = material;

    const glb = await new GLTFExporter().write({sceneModel} as any);
    const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
    const jsonChunkLen = view.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonChunkLen)));
    expect(json.extensionsUsed).toContain("KHR_materials_clearcoat");
    expect(json.materials[0].extensions.KHR_materials_clearcoat).toMatchObject({
      clearcoatFactor: 0.85,
      clearcoatRoughnessFactor: 0.12
    });

    const materialCalls: any[] = [];
    const dstScene: any = {
      objects: {},
      geometries: {},
      createGeometry: (p: any) => { dstScene.geometries[p.id] = p; return {ok: true, value: {id: p.id}}; },
      createMesh: (p: any) => ({ok: true, value: {id: p.id}}),
      createObject: (p: any) => { dstScene.objects[p.id] = p; return {ok: true, value: {id: p.id}}; },
      createMaterial: (p: any) => { materialCalls.push(p); return {ok: true, value: {id: p.id}}; },
    };

    await new GLTFLoader().load({fileData: toArrayBuffer(glb), sceneModel: dstScene} as any);

    expect(materialCalls).toHaveLength(1);
    expect(materialCalls[0].clearcoat).toBeCloseTo(0.85, 4);
    expect(materialCalls[0].clearcoatRoughness).toBeCloseTo(0.12, 4);
  });

  it("round-trips scalar KHR_materials_sheen factors", async () => {
    const {sceneModel, mesh} = buildSource(IDENTITY, [1, 1, 1], 1.0);
    const material: any = {
      id: "sheenFabric",
      color: [0.45, 0.12, 0.08],
      opacity: 1,
      roughness: 0.72,
      metallic: 0,
      sheen: 0.65,
      sheenRoughness: 0.38,
      alphaMode: 0,
      alphaCutoff: 0.5,
      emissiveColor: [0, 0, 0],
    };
    sceneModel.materials[material.id] = material;
    mesh.material = material;

    const glb = await new GLTFExporter().write({sceneModel} as any);
    const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
    const jsonChunkLen = view.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonChunkLen)));
    expect(json.extensionsUsed).toContain("KHR_materials_sheen");
    expect(json.materials[0].extensions.KHR_materials_sheen).toMatchObject({
      sheenColorFactor: [0.65, 0.65, 0.65],
      sheenRoughnessFactor: 0.38
    });

    const materialCalls: any[] = [];
    const dstScene: any = {
      objects: {},
      geometries: {},
      createGeometry: (p: any) => { dstScene.geometries[p.id] = p; return {ok: true, value: {id: p.id}}; },
      createMesh: (p: any) => ({ok: true, value: {id: p.id}}),
      createObject: (p: any) => { dstScene.objects[p.id] = p; return {ok: true, value: {id: p.id}}; },
      createMaterial: (p: any) => { materialCalls.push(p); return {ok: true, value: {id: p.id}}; },
    };

    await new GLTFLoader().load({fileData: toArrayBuffer(glb), sceneModel: dstScene} as any);

    expect(materialCalls).toHaveLength(1);
    expect(materialCalls[0].sheen).toBeCloseTo(0.65, 4);
    expect(materialCalls[0].sheenRoughness).toBeCloseTo(0.38, 4);
  });

  it("expands glTF LINE_STRIP primitives to pairwise line indices", async () => {
    const geomCalls: any[] = [];
    const dstScene: any = {
      objects: {},
      geometries: {},
      createGeometry: (p: any) => {
        geomCalls.push(p);
        dstScene.geometries[p.id] = p;
        return {ok: true, value: {id: p.id}};
      },
      createMesh: (p: any) => ({ok: true, value: {id: p.id}}),
      createObject: (p: any) => {
        dstScene.objects[p.id] = p;
        return {ok: true, value: {id: p.id}};
      },
      createMaterial: (p: any) => ({ok: true, value: {id: p.id}}),
    };

    await new GLTFLoader().load({fileData: buildLineStripGLB(), sceneModel: dstScene} as any);

    expect(geomCalls).toHaveLength(1);
    expect(geomCalls[0].primitive).toBe(LinesPrimitive);
    expect(Array.from(geomCalls[0].indices)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });
});
