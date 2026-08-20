import {compressGeometryParams} from "../compressGeometryParams";
import {ensureGeometryAttribs} from "../ensureGeometryAttribs";
import {TrianglesPrimitive} from "../../../base/constants";
import {decompressPositions3WithAABB3} from "../../../base/math/compression";

// A unit quad (2 triangles) in the XY plane at z=0.
const QUAD_POSITIONS = [0, 0, 0,  1, 0, 0,  1, 1, 0,  0, 1, 0];
const QUAD_INDICES = new Uint32Array([0, 1, 2, 0, 2, 3]);

describe("compressGeometryParams", () => {

  it("quantizes a triangle quad to uint16 positions against a 6-float AABB", () => {
    const compressed = compressGeometryParams({
      id: "g1",
      primitive: TrianglesPrimitive,
      positions: QUAD_POSITIONS,
      indices: QUAD_INDICES,
    });

    expect(compressed.id).toBe("g1");
    expect(compressed.primitive).toBe(TrianglesPrimitive);

    // positionsCompressed is a Uint16Array, same length as the source stream.
    expect(compressed.positionsCompressed).toBeInstanceOf(Uint16Array);
    expect(compressed.positionsCompressed.length).toBe(QUAD_POSITIONS.length);

    // AABB is a 6-tuple [xmin,ymin,zmin, xmax,ymax,zmax] enclosing the quad.
    expect(compressed.aabb).toHaveLength(6);
    expect(compressed.aabb![0]).toBeCloseTo(0, 5); // xmin
    expect(compressed.aabb![1]).toBeCloseTo(0, 5); // ymin
    expect(compressed.aabb![2]).toBeCloseTo(0, 5); // zmin
    expect(compressed.aabb![3]).toBeCloseTo(1, 5); // xmax
    expect(compressed.aabb![4]).toBeCloseTo(1, 5); // ymax
    expect(compressed.aabb![5]).toBeCloseTo(0, 5); // zmax — quad is planar at z=0

    // Indices are passed through verbatim (no dedupe/reorder for tris).
    expect(compressed.indices).toBe(QUAD_INDICES);
  });

  it("recovers a corner within quantization error by decompressing via the AABB", () => {
    // Non-planar triangle so the AABB has non-zero extent on all three axes
    // (a flat quad's zmax-zmin == 0 would make z-decompression undefined).
    const positions = [0, 0, 0,  2, 0, 1,  1, 3, 2];
    const indices = new Uint32Array([0, 1, 2]);
    const compressed = compressGeometryParams({
      id: "g1",
      primitive: TrianglesPrimitive,
      positions,
      indices,
    });

    // Inverse of the quantizer: decompress with the actual SDK routine, which
    // maps the uint16 range back into the AABB. Quantization step over the
    // largest span here is ~3/65525, so a 3-dp tolerance is comfortable.
    const decompressed = new Float32Array(compressed.positionsCompressed.length);
    decompressPositions3WithAABB3(
      compressed.positionsCompressed,
      compressed.aabb!,
      decompressed,
    );

    // Corner vertex 2 is (1, 3, 2).
    expect(decompressed[6]).toBeCloseTo(1, 3); // x
    expect(decompressed[7]).toBeCloseTo(3, 3); // y
    expect(decompressed[8]).toBeCloseTo(2, 3); // z
  });

  it("encodes supplied normals to a Uint16Array, omits them when absent", () => {
    const withNormals = compressGeometryParams({
      id: "g1",
      primitive: TrianglesPrimitive,
      positions: QUAD_POSITIONS,
      indices: QUAD_INDICES,
      normals: [0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1],
    });
    expect(withNormals.normalsCompressed).toBeInstanceOf(Uint16Array);

    const withoutNormals = compressGeometryParams({
      id: "g1",
      primitive: TrianglesPrimitive,
      positions: QUAD_POSITIONS,
      indices: QUAD_INDICES,
    });
    expect(withoutNormals.normalsCompressed).toBeUndefined();
  });

  it("preserves explicit triangle edge indices", () => {
    const edgeIndices = new Uint16Array([0, 1, 1, 2]);
    const compressed = compressGeometryParams({
      id: "g1",
      primitive: TrianglesPrimitive,
      positions: QUAD_POSITIONS,
      indices: QUAD_INDICES,
      edgeIndices
    });

    expect(compressed.edgeIndices).toBe(edgeIndices);
  });
});

// ensureGeometryAttribs operates on a SceneModel's compressed geometries, not a
// raw params object: it inspects sceneModel.geometries[id] and, when the source
// lacks an attribute the caller needs, creates an augmented sibling geometry via
// createGeometryCompressed and returns the new id. The source is never mutated.
//
// We drive it with a stub SceneModel that captures createGeometryCompressed
// calls — same approach as the CityJSONLoader round-trip stub in cityjson.test.ts.
function makeSceneModel(sourceGeom: any) {
  const created: any[] = [];
  const geometries: Record<string, any> = {[sourceGeom.id]: sourceGeom};
  const sceneModel: any = {
    geometries,
    createGeometryCompressed: (params: any) => {
      created.push(params);
      geometries[params.id] = params; // register so idempotency check sees it
      return {ok: true, value: {}};
    },
  };
  return {sceneModel, created};
}

describe("ensureGeometryAttribs", () => {

  // A compressed triangle quad WITHOUT normals — the input that needs synthesis.
  function quadCompressedNoNormals() {
    const c = compressGeometryParams({
      id: "src",
      primitive: TrianglesPrimitive,
      positions: QUAD_POSITIONS,
      indices: QUAD_INDICES,
    });
    return c;
  }

  it("synthesizes normals for a normal-less triangle geometry, leaving the source intact", () => {
    const source = quadCompressedNoNormals();
    expect(source.normalsCompressed).toBeUndefined();

    const {sceneModel, created} = makeSceneModel(source);
    const result = ensureGeometryAttribs(sceneModel, "src");

    expect(result.ok).toBe(true);
    // A sibling was created with the default suffix.
    expect((result as any).value).toBe("src__augmented");
    expect(created).toHaveLength(1);

    const sibling = created[0];
    // The sibling got freshly-synthesised octahedral normals (2 per vertex).
    expect(sibling.normalsCompressed).toBeInstanceOf(Uint16Array);
    expect(sibling.normalsCompressed.length).toBe((source.positionsCompressed.length / 3) * 2);
    // Heavy buffers are shared by reference, not recompressed.
    expect(sibling.positionsCompressed).toBe(source.positionsCompressed);
    expect(sibling.indices).toBe(source.indices);
    expect(sibling.primitive).toBe(TrianglesPrimitive);

    // Source geometry untouched.
    expect(source.normalsCompressed).toBeUndefined();
  });

  it("is a no-op when the source already has normals and no UVs are requested", () => {
    const source = compressGeometryParams({
      id: "src",
      primitive: TrianglesPrimitive,
      positions: QUAD_POSITIONS,
      indices: QUAD_INDICES,
      normals: [0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1],
    });
    expect(source.normalsCompressed).toBeInstanceOf(Uint16Array);

    const {sceneModel, created} = makeSceneModel(source);
    const result = ensureGeometryAttribs(sceneModel, "src");

    expect(result.ok).toBe(true);
    // Already satisfied → returns the source id, creates nothing.
    expect((result as any).value).toBe("src");
    expect(created).toHaveLength(0);
  });

  it("packs supplied UVs onto an augmented sibling (even when normals already exist)", () => {
    const source = compressGeometryParams({
      id: "src",
      primitive: TrianglesPrimitive,
      positions: QUAD_POSITIONS,
      indices: QUAD_INDICES,
      normals: [0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1],
    });

    const {sceneModel, created} = makeSceneModel(source);
    const uvs = [0, 0,  1, 0,  1, 1,  0, 1];
    const result = ensureGeometryAttribs(sceneModel, "src", {uvs});

    expect(result.ok).toBe(true);
    expect((result as any).value).toBe("src__augmented");
    expect(created).toHaveLength(1);
    expect(created[0].uvsCompressed).toBeInstanceOf(Float32Array);
    expect(created[0].uvsCompressed.length).toBe(uvs.length);
    // Pre-existing source normals are carried over to the sibling.
    expect(created[0].normalsCompressed).toBe(source.normalsCompressed);
  });

  it("is idempotent — a second call reuses the existing sibling", () => {
    const source = quadCompressedNoNormals();
    const {sceneModel, created} = makeSceneModel(source);

    const r1 = ensureGeometryAttribs(sceneModel, "src");
    const r2 = ensureGeometryAttribs(sceneModel, "src");

    expect((r1 as any).value).toBe("src__augmented");
    expect((r2 as any).value).toBe("src__augmented");
    expect(created).toHaveLength(1); // built once, reused thereafter
  });

  it("errors when the source geometry id is unknown", () => {
    const source = quadCompressedNoNormals();
    const {sceneModel} = makeSceneModel(source);
    const result = ensureGeometryAttribs(sceneModel, "does-not-exist");
    expect(result.ok).toBe(false);
  });
});
