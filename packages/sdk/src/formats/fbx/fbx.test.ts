import {parse} from "./versions/binary/parse";
import {encode} from "./versions/binary/encode";
import {isBinaryFBX} from "./fbxBinaryReader";

// FBX name property separator: "Name" + \0\x01 + "Class".
const SEP = "\0\x01";

describe("FBXLoader (binary)", () => {

  it("parses a synthesized binary FBX into geometry, material, mesh, object", async () => {
    const fbx = buildFixtureFBX();
    expect(isBinaryFBX(fbx)).toBe(true);

    const calls: {geom: any[]; mesh: any[]; object: any[]; material: any[]; texture: any[]} = {
      geom: [], mesh: [], object: [], material: [], texture: [],
    };
    const sceneModel: any = {
      destroyed: false,
      createGeometry: (p: any) => { calls.geom.push(p);     return {ok: true, value: {}}; },
      createTexture:  (p: any) => { calls.texture.push(p);  return {ok: true, value: {}}; },
      createMaterial: (p: any) => { calls.material.push(p); return {ok: true, value: {}}; },
      createMesh:     (p: any) => { calls.mesh.push(p);     return {ok: true, value: {}}; },
      createObject:   (p: any) => { calls.object.push(p);   return {ok: true, value: {}}; },
    };

    await parse({fileData: fbx, sceneModel});

    // One quad → 2 triangles → 6 expanded corners.
    expect(calls.geom).toHaveLength(1);
    expect(calls.geom[0].positions).toHaveLength(18);
    expect(calls.geom[0].normals).toHaveLength(18);
    expect(calls.geom[0].uvs).toHaveLength(12);
    expect(calls.geom[0].indices).toHaveLength(6);
    expect(Array.from(calls.geom[0].indices)).toEqual([0, 1, 2, 3, 4, 5]);
    // First corner is control point 0 = (0,0,0); its normal = +Z.
    expect(Array.from(calls.geom[0].positions.slice(0, 3))).toEqual([0, 0, 0]);
    expect(Array.from(calls.geom[0].normals.slice(0, 3))).toEqual([0, 0, 1]);

    expect(calls.material).toHaveLength(1);
    expect(Array.from(calls.material[0].color)).toEqual([0.5, 0.6, 0.7]);

    // Embedded diffuse texture: created from the Video's Content bytes and
    // wired to the material's colorTextureId.
    expect(calls.texture).toHaveLength(1);
    expect(calls.texture[0].buffers).toBeDefined();
    expect(calls.texture[0].buffers[0].byteLength).toBe(4);
    expect(calls.material[0].colorTextureId).toBe(calls.texture[0].id);

    expect(calls.mesh).toHaveLength(1);
    expect(calls.mesh[0].geometryId).toBe(calls.geom[0].id);
    expect(calls.mesh[0].materialId).toBe(calls.material[0].id);
    // Lcl Translation [1,2,3] lands in the matrix's translation column (12..14).
    expect(Array.from(calls.mesh[0].matrix.slice(12, 15))).toEqual([1, 2, 3]);

    expect(calls.object).toHaveLength(1);
    expect(calls.object[0].id).toBe("Cube");
    expect(calls.object[0].meshIds).toEqual([calls.mesh[0].id]);
  });

  it("round-trips a SceneModel through FBXExporter → FBXLoader", async () => {
    // A quad (2 triangles), a diffuse material with an embedded texture, one
    // mesh translated by (2,3,4), grouped under object "myObject".
    const aabb = [0, 0, 0, 1, 1, 1];
    const positions = [0, 0, 0,  1, 0, 0,  1, 1, 0,  0, 1, 0];
    const geom = {
      id: "g1",
      positionsCompressed: quantize(positions, aabb),
      aabb,
      indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    };
    const tex = {id: "tex1", buffers: [new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer]};
    const mat = {id: "m1", color: [0.5, 0.6, 0.7], colorTexture: tex};
    const mesh = {
      id: "mesh1", geometry: geom, material: mat,
      matrix: [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  2, 3, 4, 1],
    };
    const srcModel: any = {
      geometries: {g1: geom}, materials: {m1: mat}, textures: {tex1: tex},
      meshes: {mesh1: mesh}, objects: {myObject: {id: "myObject", meshes: [mesh]}},
    };

    const fbx = await encode({sceneModel: srcModel});
    expect(isBinaryFBX(fbx)).toBe(true);

    // Re-import the exported bytes into a capturing stub.
    const calls: {geom: any[]; mesh: any[]; object: any[]; material: any[]; texture: any[]} = {
      geom: [], mesh: [], object: [], material: [], texture: [],
    };
    const dstModel: any = {
      destroyed: false,
      createGeometry: (p: any) => { calls.geom.push(p);     return {ok: true, value: {}}; },
      createTexture:  (p: any) => { calls.texture.push(p);  return {ok: true, value: {}}; },
      createMaterial: (p: any) => { calls.material.push(p); return {ok: true, value: {}}; },
      createMesh:     (p: any) => { calls.mesh.push(p);     return {ok: true, value: {}}; },
      createObject:   (p: any) => { calls.object.push(p);   return {ok: true, value: {}}; },
    };
    await parse({fileData: fbx, sceneModel: dstModel});

    // Geometry: 2 triangles → 6 expanded corners; first corner is (0,0,0).
    expect(calls.geom).toHaveLength(1);
    expect(calls.geom[0].positions).toHaveLength(18);
    expect(Array.from(calls.geom[0].positions.slice(0, 3))).toEqual([0, 0, 0]);
    expect(calls.geom[0].positions[3]).toBeCloseTo(1, 3);   // control point 1 = (1,0,0)

    // Material colour survives exactly (written as float64).
    expect(calls.material).toHaveLength(1);
    expect(Array.from(calls.material[0].color)).toEqual([0.5, 0.6, 0.7]);

    // Embedded texture re-imported and wired to the material.
    expect(calls.texture).toHaveLength(1);
    expect(calls.material[0].colorTextureId).toBe(calls.texture[0].id);

    // Transform: translation (2,3,4) survives the matrix→TRS→matrix round-trip.
    expect(calls.mesh).toHaveLength(1);
    expect(Array.from(calls.mesh[0].matrix.slice(12, 15)).map((v: any) => Math.round(v)))
      .toEqual([2, 3, 4]);

    // Object id recovered from the Model name.
    expect(calls.object).toHaveLength(1);
    expect(calls.object[0].id).toBe("myObject");
  });

  it("rejects non-binary input", () => {
    const ascii = new TextEncoder().encode("; FBX 7.4.0 project file\n").buffer;
    expect(isBinaryFBX(ascii)).toBe(false);
    expect(isBinaryFBX(new ArrayBuffer(4))).toBe(false);
  });
});


// ── Minimal binary-FBX encoder (test fixture) ─────────────────────
// Produces version-7400 binary FBX matching the reader's layout.

type Prop = {t: "L" | "I" | "D" | "S" | "R" | "d" | "i"; v: any};
interface ENode {name: string; props: Prop[]; children: ENode[]}

function buildFixtureFBX(): ArrayBuffer {
  const geomId = 1000, modelId = 2000, matId = 3000;

  const verts = [0, 0, 0,  1, 0, 0,  1, 1, 0,  0, 1, 0];   // a unit quad in XY
  const polys = [0, 1, 2, -4];                              // one quad (cp 0,1,2,3)
  const norms = [0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1];    // per polygon-vertex
  const uvs   = [0, 0,  1, 0,  1, 1,  0, 1];

  const geometry: ENode = {
    name: "Geometry",
    props: [{t: "L", v: geomId}, {t: "S", v: "Cube" + SEP + "Geometry"}, {t: "S", v: "Mesh"}],
    children: [
      leaf("Vertices", [{t: "d", v: verts}]),
      leaf("PolygonVertexIndex", [{t: "i", v: polys}]),
      {
        name: "LayerElementNormal", props: [{t: "I", v: 0}],
        children: [
          leaf("MappingInformationType", [{t: "S", v: "ByPolygonVertex"}]),
          leaf("ReferenceInformationType", [{t: "S", v: "Direct"}]),
          leaf("Normals", [{t: "d", v: norms}]),
        ],
      },
      {
        name: "LayerElementUV", props: [{t: "I", v: 0}],
        children: [
          leaf("MappingInformationType", [{t: "S", v: "ByPolygonVertex"}]),
          leaf("ReferenceInformationType", [{t: "S", v: "Direct"}]),
          leaf("UV", [{t: "d", v: uvs}]),
        ],
      },
    ],
  };

  const model: ENode = {
    name: "Model",
    props: [{t: "L", v: modelId}, {t: "S", v: "Cube" + SEP + "Model"}, {t: "S", v: "Mesh"}],
    children: [{name: "Properties70", props: [], children: [p70("Lcl Translation", "Lcl Translation", [1, 2, 3])]}],
  };

  const material: ENode = {
    name: "Material",
    props: [{t: "L", v: matId}, {t: "S", v: "Steel" + SEP + "Material"}, {t: "S", v: ""}],
    children: [{name: "Properties70", props: [], children: [p70("DiffuseColor", "Color", [0.5, 0.6, 0.7])]}],
  };

  const videoId = 4000, texId = 5000;
  const video: ENode = {
    name: "Video",
    props: [{t: "L", v: videoId}, {t: "S", v: "clip" + SEP + "Video"}, {t: "S", v: "Clip"}],
    children: [leaf("Content", [{t: "R", v: [0x89, 0x50, 0x4e, 0x47]}])],   // 4 dummy image bytes
  };
  const texture: ENode = {
    name: "Texture",
    props: [{t: "L", v: texId}, {t: "S", v: "tex" + SEP + "Texture"}, {t: "S", v: ""}],
    children: [leaf("RelativeFilename", [{t: "S", v: "tex.png"}])],
  };

  const objects: ENode = {name: "Objects", props: [], children: [geometry, model, material, video, texture]};
  const connections: ENode = {
    name: "Connections", props: [],
    children: [
      conn(geomId, modelId),
      conn(matId, modelId),
      conn(modelId, 0),
      connOP(texId, matId, "DiffuseColor"),   // texture → material's diffuse slot
      conn(videoId, texId),                    // embedded media → texture
    ],
  };

  const header = makeHeader(7400);
  let offset = 27;
  const objBytes = encodeNode(objects, offset); offset += objBytes.length;
  const conBytes = encodeNode(connections, offset); offset += conBytes.length;
  const out = concat([header, objBytes, conBytes, new Uint8Array(13)]);   // + top-level null record
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

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

function leaf(name: string, props: Prop[]): ENode { return {name, props, children: []}; }
function conn(childId: number, parentId: number): ENode {
  return {name: "C", props: [{t: "S", v: "OO"}, {t: "L", v: childId}, {t: "L", v: parentId}], children: []};
}
function connOP(childId: number, parentId: number, prop: string): ENode {
  return {name: "C", props: [{t: "S", v: "OP"}, {t: "L", v: childId}, {t: "L", v: parentId}, {t: "S", v: prop}], children: []};
}
function p70(name: string, type: string, vals: number[]): ENode {
  return {
    name: "P",
    props: [{t: "S", v: name}, {t: "S", v: type}, {t: "S", v: ""}, {t: "S", v: "A"}, ...vals.map(v => ({t: "D" as const, v}))],
    children: [],
  };
}

function makeHeader(version: number): Uint8Array {
  const b = new Uint8Array(27);
  const magic = "Kaydara FBX Binary  ";            // 18 chars + 2 spaces = 20
  for (let i = 0; i < magic.length; i++) b[i] = magic.charCodeAt(i);
  b[20] = 0x00; b[21] = 0x1a; b[22] = 0x00;
  new DataView(b.buffer).setUint32(23, version, true);
  return b;
}

function encodeNode(node: ENode, start: number): Uint8Array {
  const propBytes = concat(node.props.map(encodeProp));
  let childStart = start + 13 + node.name.length + propBytes.length;
  const childBuffers: Uint8Array[] = [];
  for (const ch of node.children) {
    const cb = encodeNode(ch, childStart);
    childBuffers.push(cb);
    childStart += cb.length;
  }
  const childrenBytes = node.children.length > 0
    ? concat([...childBuffers, new Uint8Array(13)])   // null record closes a child list
    : new Uint8Array(0);

  const total = 13 + node.name.length + propBytes.length + childrenBytes.length;
  const endOffset = start + total;

  const header = new Uint8Array(13 + node.name.length);
  const dv = new DataView(header.buffer);
  dv.setUint32(0, endOffset, true);
  dv.setUint32(4, node.props.length, true);
  dv.setUint32(8, propBytes.length, true);
  dv.setUint8(12, node.name.length);
  for (let i = 0; i < node.name.length; i++) header[13 + i] = node.name.charCodeAt(i);

  return concat([header, propBytes, childrenBytes]);
}

function encodeProp(p: Prop): Uint8Array {
  switch (p.t) {
    case "L": { const b = new Uint8Array(9);  const d = new DataView(b.buffer); d.setUint8(0, 0x4c); d.setBigInt64(1, BigInt(p.v), true); return b; }
    case "I": { const b = new Uint8Array(5);  const d = new DataView(b.buffer); d.setUint8(0, 0x49); d.setInt32(1, p.v, true); return b; }
    case "D": { const b = new Uint8Array(9);  const d = new DataView(b.buffer); d.setUint8(0, 0x44); d.setFloat64(1, p.v, true); return b; }
    case "S": {
      const s: string = p.v;
      const b = new Uint8Array(5 + s.length); const d = new DataView(b.buffer);
      d.setUint8(0, 0x53); d.setUint32(1, s.length, true);
      for (let i = 0; i < s.length; i++) b[5 + i] = s.charCodeAt(i);
      return b;
    }
    case "R": {
      const a: number[] = p.v;
      const b = new Uint8Array(5 + a.length); const d = new DataView(b.buffer);
      d.setUint8(0, 0x52); d.setUint32(1, a.length, true);
      for (let i = 0; i < a.length; i++) b[5 + i] = a[i];
      return b;
    }
    case "d": {
      const a: number[] = p.v;
      const b = new Uint8Array(13 + a.length * 8); const d = new DataView(b.buffer);
      d.setUint8(0, 0x64); d.setUint32(1, a.length, true); d.setUint32(5, 0, true); d.setUint32(9, a.length * 8, true);
      for (let i = 0; i < a.length; i++) d.setFloat64(13 + i * 8, a[i], true);
      return b;
    }
    case "i": {
      const a: number[] = p.v;
      const b = new Uint8Array(13 + a.length * 4); const d = new DataView(b.buffer);
      d.setUint8(0, 0x69); d.setUint32(1, a.length, true); d.setUint32(5, 0, true); d.setUint32(9, a.length * 4, true);
      for (let i = 0; i < a.length; i++) d.setInt32(13 + i * 4, a[i], true);
      return b;
    }
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
