import {encode} from "../versions/v1_0/encode";
import {parse} from "../versions/v1_0/parse";
import {TrianglesPrimitive} from "../../../base/constants";

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

const TRI_POSITIONS = [0, 0, 0, 1, 0, 0, 0, 1, 0];
const TRI_AABB = [0, 0, 0, 1, 1, 1];
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

describe("PLYExporter / PLYLoader", () => {
  it("encodes triangle geometry to ASCII PLY", async () => {
    const geom = {
      id: "g1",
      primitive: TrianglesPrimitive,
      positionsCompressed: quantize(TRI_POSITIONS, TRI_AABB),
      colorsCompressed: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 128]),
      aabb: TRI_AABB,
      indices: new Uint32Array([0, 1, 2]),
    };
    const mesh = {id: "m1", geometry: geom, matrix: IDENTITY};
    const sceneModel: any = {
      id: "model",
      objects: {o1: {id: "o1", meshes: [mesh]}},
    };

    const ply = await encode({sceneModel} as any);
    const lines = ply.split("\n");

    expect(lines).toContain("format ascii 1.0");
    expect(lines).toContain("element vertex 3");
    expect(lines).toContain("element face 1");
    expect(lines).toContain("property uchar red");
    expect(lines[lines.length - 1]).toBe("3 0 1 2");
  });

  it("parses ASCII PLY faces, normals, UVs and colors", async () => {
    const ply = [
      "ply",
      "format ascii 1.0",
      "element vertex 4",
      "property float x",
      "property float y",
      "property float z",
      "property float nx",
      "property float ny",
      "property float nz",
      "property float s",
      "property float t",
      "property uchar red",
      "property uchar green",
      "property uchar blue",
      "property uchar alpha",
      "element face 1",
      "property list uchar int vertex_indices",
      "end_header",
      "0 0 0 0 0 1 0 0 255 0 0 255",
      "1 0 0 0 0 1 1 0 0 255 0 255",
      "1 1 0 0 0 1 1 1 0 0 255 255",
      "0 1 0 0 0 1 0 1 255 255 255 128",
      "4 0 1 2 3",
    ].join("\n");

    const calls: {geom: any[]; mesh: any[]; object: any[]} = {geom: [], mesh: [], object: []};
    const dstScene: any = {
      createGeometry: (p: any) => { calls.geom.push(p); return {ok: true, value: {}}; },
      createMesh: (p: any) => { calls.mesh.push(p); return {ok: true, value: {}}; },
      createObject: (p: any) => { calls.object.push(p); return {ok: true, value: {}}; },
    };

    await parse({fileData: ply, sceneModel: dstScene} as any, {});

    expect(calls.geom).toHaveLength(1);
    expect(calls.mesh).toHaveLength(1);
    expect(calls.object).toHaveLength(1);
    expect(calls.geom[0].positions).toHaveLength(12);
    expect(calls.geom[0].normals).toHaveLength(12);
    expect(calls.geom[0].uvs).toHaveLength(8);
    expect(calls.geom[0].colors).toHaveLength(16);
    expect(calls.geom[0].indices).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it("rejects binary PLY clearly", async () => {
    const ply = [
      "ply",
      "format binary_little_endian 1.0",
      "element vertex 0",
      "end_header",
    ].join("\n");

    await expect(parse({fileData: ply, sceneModel: {}} as any, {})).rejects.toThrow("Only ascii 1.0 is supported");
  });
});
