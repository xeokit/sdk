import {Scene} from "../../../model/scene/Scene";
import {Data} from "../../../model/data/Data";
import {PointsPrimitive, TrianglesPrimitive} from "../../../base/constants";
import {GLTFExporter} from "../../gltf/GLTFExporter";
import {GLTFLoader} from "../../gltf/GLTFLoader";
import {ThreeDTilesLoader} from "../ThreeDTilesLoader";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const QUAD_POSITIONS = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0];
const QUAD_AABB = [0, 0, 0, 1, 1, 1];
const QUAD_INDICES = new Uint32Array([0, 1, 2, 0, 2, 3]);
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

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

async function buildGLB(): Promise<Uint8Array> {
  const geom = {
    id: "g1",
    primitive: TrianglesPrimitive,
    positionsCompressed: quantize(QUAD_POSITIONS, QUAD_AABB),
    aabb: QUAD_AABB,
    indices: QUAD_INDICES,
  };
  const mesh = {id: "mesh1", geometry: geom, color: [1, 0, 0], opacity: 1, matrix: IDENTITY};
  const sceneModel: any = {
    id: "src",
    scene: {coordinateSystem: {}},
    textures: {},
    materials: {},
    geometries: {g1: geom},
    objects: {Building1: {id: "Building1", meshes: [mesh]}},
  };
  return new GLTFExporter().write({sceneModel} as any);
}

const enc = (s: string) => new TextEncoder().encode(s);

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// Feature-table JSON padded with spaces so the binary body that follows the
// header begins on an 8-byte boundary (typed-array views require alignment).
function alignedJSON(obj: object, headerLen: number): Uint8Array {
  let bytes = enc(JSON.stringify(obj));
  const pad = (8 - ((headerLen + bytes.length) % 8)) % 8;
  if (pad) bytes = concat([bytes, new Uint8Array(pad).fill(0x20)]);
  return bytes;
}

function makeB3DM(glb: Uint8Array, featureTable: object, batchTable?: object): ArrayBuffer {
  const ft = alignedJSON(featureTable, 28);
  const bt = batchTable ? enc(JSON.stringify(batchTable)) : new Uint8Array(0);
  const byteLength = 28 + ft.length + bt.length + glb.length;
  const head = new Uint8Array(28);
  const dv = new DataView(head.buffer);
  head.set(enc("b3dm"), 0);
  dv.setUint32(4, 1, true);
  dv.setUint32(8, byteLength, true);
  dv.setUint32(12, ft.length, true);
  dv.setUint32(16, 0, true);
  dv.setUint32(20, bt.length, true);
  dv.setUint32(24, 0, true);
  return concat([head, ft, bt, glb]).buffer;
}

function makePNTS(): ArrayBuffer {
  const ft = alignedJSON(
    {POINTS_LENGTH: 2, POSITION: {byteOffset: 0}, RGB: {byteOffset: 24}},
    28,
  );
  const bin = new Uint8Array(30);
  new Float32Array(bin.buffer, 0, 6).set([0, 0, 0, 1, 2, 3]);
  bin.set([255, 0, 0, 0, 255, 0], 24);
  const byteLength = 28 + ft.length + bin.length;
  const head = new Uint8Array(28);
  const dv = new DataView(head.buffer);
  head.set(enc("pnts"), 0);
  dv.setUint32(4, 1, true);
  dv.setUint32(8, byteLength, true);
  dv.setUint32(12, ft.length, true);
  dv.setUint32(16, bin.length, true);
  dv.setUint32(20, 0, true);
  dv.setUint32(24, 0, true);
  return concat([head, ft, bin]).buffer;
}

function makeI3DM(glb: Uint8Array, instances: number[][], opts: {scale?: number[]} = {}): ArrayBuffer {
  const count = instances.length;
  const ftJSON: any = {INSTANCES_LENGTH: count, POSITION: {byteOffset: 0}};
  let binLen = count * 12;
  let scaleOffset = 0;
  if (opts.scale) {
    scaleOffset = binLen;
    ftJSON.SCALE = {byteOffset: scaleOffset};
    binLen += count * 4;
  }
  const ft = alignedJSON(ftJSON, 32);
  const bin = new Uint8Array(binLen);
  new Float32Array(bin.buffer, 0, count * 3).set(instances.flat());
  if (opts.scale) new Float32Array(bin.buffer, scaleOffset, count).set(opts.scale);
  const byteLength = 32 + ft.length + bin.length + glb.length;
  const head = new Uint8Array(32);
  const dv = new DataView(head.buffer);
  head.set(enc("i3dm"), 0);
  dv.setUint32(4, 1, true);
  dv.setUint32(8, byteLength, true);
  dv.setUint32(12, ft.length, true);
  dv.setUint32(16, bin.length, true);
  dv.setUint32(20, 0, true);
  dv.setUint32(24, 0, true);
  dv.setUint32(28, 1, true); // gltfFormat = 1 (embedded GLB)
  return concat([head, ft, bin, glb]).buffer;
}

function makeCMPT(inner: ArrayBuffer[]): ArrayBuffer {
  const head = new Uint8Array(16);
  const dv = new DataView(head.buffer);
  head.set(enc("cmpt"), 0);
  dv.setUint32(4, 1, true);
  const innerBytes = inner.map(b => new Uint8Array(b));
  const byteLength = 16 + innerBytes.reduce((n, b) => n + b.length, 0);
  dv.setUint32(8, byteLength, true);
  dv.setUint32(12, inner.length, true);
  return concat([head, ...innerBytes]).buffer;
}

function makeSubtree(json: object, bin: Uint8Array): ArrayBuffer {
  let jsonBytes = enc(JSON.stringify(json));
  const jpad = (8 - (jsonBytes.length % 8)) % 8;
  if (jpad) jsonBytes = concat([jsonBytes, new Uint8Array(jpad).fill(0x20)]);
  const bpad = (8 - (bin.length % 8)) % 8;
  const binBytes = bpad ? concat([bin, new Uint8Array(bpad)]) : bin;
  const head = new Uint8Array(24);
  const dv = new DataView(head.buffer);
  head.set(enc("subt"), 0);
  dv.setUint32(4, 1, true);
  dv.setBigUint64(8, BigInt(jsonBytes.length), true);
  dv.setBigUint64(16, BigInt(binBytes.length), true);
  return concat([head, jsonBytes, binBytes]).buffer;
}

function fetcherFor(map: { [url: string]: ArrayBuffer }, log?: string[]) {
  return async (url: string): Promise<ArrayBuffer> => {
    if (log) log.push(url);
    const key = Object.keys(map).find(k => url.endsWith(k));
    if (!key) throw new Error(`no fixture for ${url}`);
    return map[key];
  };
}

const BASE = "http://tiles/";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ThreeDTilesLoader", () => {

  it("places b3dm content with the tile transform and Y-up→Z-up rotation", async () => {
    const glb = await buildGLB();
    const b3dm = makeB3DM(glb, {BATCH_LENGTH: 0});
    const tileset = {
      asset: {version: "1.0"},
      root: {transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1], content: {uri: "a.b3dm"}, geometricError: 0},
    };
    const sceneModel = new Scene().createModel({id: "t"}).value!;

    await new ThreeDTilesLoader().load(
      {fileData: tileset, sceneModel},
      {baseUri: BASE, fetchArrayBuffer: fetcherFor({"a.b3dm": b3dm})},
    );

    const meshes = Object.values(sceneModel.meshes);
    expect(meshes.length).toBe(1);
    const m = meshes[0].matrix as any;
    expect(m[12]).toBeCloseTo(10, 4);
    expect(m[13]).toBeCloseTo(20, 4);
    expect(m[14]).toBeCloseTo(30, 4);
    // Y-up→Z-up: glTF +Y maps to world +Z, glTF +Z maps to world −Y.
    expect(m[6]).toBeCloseTo(1, 6);
    expect(m[9]).toBeCloseTo(-1, 6);
  });

  it("decodes pnts content into a points geometry", async () => {
    const tileset = {asset: {version: "1.0"}, root: {content: {uri: "p.pnts"}, geometricError: 0}};
    const sceneModel = new Scene().createModel({id: "t"}).value!;

    await new ThreeDTilesLoader().load(
      {fileData: tileset, sceneModel},
      {baseUri: BASE, fetchArrayBuffer: fetcherFor({"p.pnts": makePNTS()})},
    );

    const geoms = Object.values(sceneModel.geometries);
    expect(geoms.length).toBe(1);
    expect(geoms[0].primitive).toBe(PointsPrimitive);
  });

  it("decodes cmpt content by recursing over its inner tiles", async () => {
    const cmpt = makeCMPT([makePNTS(), makePNTS()]);
    const tileset = {asset: {version: "1.0"}, root: {content: {uri: "c.cmpt"}, geometricError: 0}};
    const sceneModel = new Scene().createModel({id: "t"}).value!;

    await new ThreeDTilesLoader().load(
      {fileData: tileset, sceneModel},
      {baseUri: BASE, fetchArrayBuffer: fetcherFor({"c.cmpt": cmpt})},
    );

    expect(Object.values(sceneModel.geometries).length).toBe(2);
  });

  it("instances i3dm content, sharing one geometry across instances", async () => {
    const glb = await buildGLB();
    const i3dm = makeI3DM(glb, [[0, 0, 0], [5, 0, 0]]);
    const tileset = {asset: {version: "1.0"}, root: {content: {uri: "i.i3dm"}, geometricError: 0}};
    const sceneModel = new Scene().createModel({id: "t"}).value!;

    await new ThreeDTilesLoader().load(
      {fileData: tileset, sceneModel},
      {baseUri: BASE, fetchArrayBuffer: fetcherFor({"i.i3dm": i3dm})},
    );

    expect(Object.values(sceneModel.objects).length).toBe(2);
    // One shared geometry, one mesh per instance.
    expect(Object.values(sceneModel.geometries).length).toBe(1);
    expect(Object.values(sceneModel.meshes).length).toBe(2);
    expect(Object.values(sceneModel.meshes).map(mesh => mesh.materialId)).toEqual([
      Object.values(sceneModel.meshes)[0].materialId,
      Object.values(sceneModel.meshes)[0].materialId,
    ]);
  });

  it("loads sibling tiles sharing the same content without id collisions", async () => {
    const glb = await buildGLB();
    const b3dm = makeB3DM(glb, {BATCH_LENGTH: 0});
    const tileset = {
      asset: {version: "1.0"},
      root: {
        geometricError: 100,
        children: [
          {transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], geometricError: 0, content: {uri: "s.b3dm"}},
          {transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 0, 0, 1], geometricError: 0, content: {uri: "s.b3dm"}},
        ],
      },
    };
    const sceneModel = new Scene().createModel({id: "t"}).value!;

    await new ThreeDTilesLoader().load(
      {fileData: tileset, sceneModel},
      {baseUri: BASE, fetchArrayBuffer: fetcherFor({"s.b3dm": b3dm})},
    );

    expect(Object.values(sceneModel.objects).length).toBe(2);
    expect(Object.values(sceneModel.meshes).length).toBe(2);
  });

  it("applies i3dm instance scale to the placed content", async () => {
    const glb = await buildGLB();
    const i3dm = makeI3DM(glb, [[0, 0, 0]], {scale: [2]});
    const tileset = {asset: {version: "1.0"}, root: {content: {uri: "i.i3dm"}, geometricError: 0}};
    const sceneModel = new Scene().createModel({id: "t"}).value!;

    await new ThreeDTilesLoader().load(
      {fileData: tileset, sceneModel},
      {baseUri: BASE, fetchArrayBuffer: fetcherFor({"i.i3dm": i3dm})},
    );

    const m = Object.values(sceneModel.meshes)[0].matrix as any;
    // Uniform scale of 2 → each basis column has length 2 (rotation preserves length).
    expect(Math.hypot(m[0], m[1], m[2])).toBeCloseTo(2, 4);
    expect(Math.hypot(m[4], m[5], m[6])).toBeCloseTo(2, 4);
    expect(Math.hypot(m[8], m[9], m[10])).toBeCloseTo(2, 4);
  });

  it("maps b3dm Batch Table features to DataModel objects + property sets", async () => {
    const glb = await buildGLB();
    const b3dm = makeB3DM(glb, {BATCH_LENGTH: 2}, {name: ["wall-a", "wall-b"], height: [3, 4]});
    const tileset = {asset: {version: "1.0"}, root: {content: {uri: "a.b3dm"}, geometricError: 0}};
    const sceneModel = new Scene().createModel({id: "t"}).value!;
    const dataModel = new Data().createModel({id: "t"}).value!;

    await new ThreeDTilesLoader().load(
      {fileData: tileset, sceneModel, dataModel},
      {baseUri: BASE, fetchArrayBuffer: fetcherFor({"a.b3dm": b3dm})},
    );

    // Root tileset object + one object per feature.
    expect(dataModel.objects["tileset"]).toBeDefined();
    const features = Object.values(dataModel.objects).filter(o => o.type === "Feature");
    expect(features.length).toBe(2);
    expect(Object.values(dataModel.propertySets).length).toBe(2);
  });

  it("REPLACE refinement loads only leaf content, not the parent", async () => {
    const glb = await buildGLB();
    const tileset = {
      asset: {version: "1.0"},
      root: {
        refine: "REPLACE",
        content: {uri: "parent.b3dm"},
        geometricError: 100,
        children: [{content: {uri: "child.b3dm"}, geometricError: 0}],
      },
    };
    const sceneModel = new Scene().createModel({id: "t"}).value!;
    const requested: string[] = [];

    await new ThreeDTilesLoader().load(
      {fileData: tileset, sceneModel},
      {
        baseUri: BASE,
        fetchArrayBuffer: fetcherFor(
          {"parent.b3dm": makeB3DM(glb, {BATCH_LENGTH: 0}), "child.b3dm": makeB3DM(glb, {BATCH_LENGTH: 0})},
          requested,
        ),
      },
    );

    expect(requested.some(u => u.endsWith("child.b3dm"))).toBe(true);
    expect(requested.some(u => u.endsWith("parent.b3dm"))).toBe(false);
  });

  it("maxDepth stops descent and loads the coarser tile", async () => {
    const glb = await buildGLB();
    const tileset = {
      asset: {version: "1.0"},
      root: {
        refine: "REPLACE",
        content: {uri: "parent.b3dm"},
        geometricError: 100,
        children: [{content: {uri: "child.b3dm"}, geometricError: 0}],
      },
    };
    const sceneModel = new Scene().createModel({id: "t"}).value!;
    const requested: string[] = [];

    await new ThreeDTilesLoader().load(
      {fileData: tileset, sceneModel},
      {
        baseUri: BASE,
        maxDepth: 0,
        fetchArrayBuffer: fetcherFor(
          {"parent.b3dm": makeB3DM(glb, {BATCH_LENGTH: 0}), "child.b3dm": makeB3DM(glb, {BATCH_LENGTH: 0})},
          requested,
        ),
      },
    );

    expect(requested.some(u => u.endsWith("parent.b3dm"))).toBe(true);
    expect(requested.some(u => u.endsWith("child.b3dm"))).toBe(false);
  });

  it("loads available tiles of an implicit (quadtree) tileset by templated URI", async () => {
    const glb = await buildGLB();
    const b3dm = makeB3DM(glb, {BATCH_LENGTH: 0});
    // 2-level quadtree subtree: root (L0) + 4 leaves (L1) all available (0x1F);
    // content on the 4 leaves only (0x1E); no child subtrees (constant 0).
    const subtree = makeSubtree(
      {
        buffers: [{byteLength: 8}],
        bufferViews: [
          {buffer: 0, byteOffset: 0, byteLength: 1},
          {buffer: 0, byteOffset: 1, byteLength: 1},
        ],
        tileAvailability: {bitstream: 0},
        contentAvailability: [{bitstream: 1}],
        childSubtreeAvailability: {constant: 0},
      },
      new Uint8Array([0x1f, 0x1e]),
    );
    const tileset = {
      asset: {version: "1.1"},
      geometricError: 100,
      root: {
        geometricError: 50,
        refine: "REPLACE",
        content: {uri: "content/{level}/{x}/{y}.b3dm"},
        implicitTiling: {
          subdivisionScheme: "QUADTREE",
          subtreeLevels: 2,
          availableLevels: 2,
          subtrees: {uri: "subtrees/{level}/{x}/{y}.subtree"},
        },
      },
    };
    const sceneModel = new Scene().createModel({id: "t"}).value!;
    const requested: string[] = [];
    const fetchArrayBuffer = async (url: string): Promise<ArrayBuffer> => {
      requested.push(url);
      if (url.endsWith(".subtree")) return subtree;
      if (url.endsWith(".b3dm")) return b3dm;
      throw new Error(`no fixture for ${url}`);
    };

    await new ThreeDTilesLoader().load({fileData: tileset, sceneModel}, {baseUri: BASE, fetchArrayBuffer});

    const contentUrls = requested.filter(u => u.endsWith(".b3dm")).sort();
    expect(contentUrls).toEqual([
      `${BASE}content/1/0/0.b3dm`,
      `${BASE}content/1/0/1.b3dm`,
      `${BASE}content/1/1/0.b3dm`,
      `${BASE}content/1/1/1.b3dm`,
    ]);
    expect(Object.values(sceneModel.objects).length).toBe(4);
  });

  it("rejects a tileset with no root", async () => {
    const sceneModel = new Scene().createModel({id: "t"}).value!;
    await expect(
      new ThreeDTilesLoader().load({fileData: {asset: {version: "1.0"}}, sceneModel}, {baseUri: BASE}),
    ).rejects.toBeDefined();
  });
});

describe("GLTFLoader rootMatrix option", () => {

  it("pre-multiplies rootMatrix into loaded node world matrices", async () => {
    const glb = await buildGLB();
    const fileData = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
    const sceneModel = new Scene().createModel({id: "g"}).value!;

    const rootMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 7, 8, 9, 1] as any;
    await new GLTFLoader().load({fileData, sceneModel} as any, {rootMatrix});

    const m = Object.values(sceneModel.meshes)[0].matrix as any;
    expect(m[12]).toBeCloseTo(7, 4);
    expect(m[13]).toBeCloseTo(8, 4);
    expect(m[14]).toBeCloseTo(9, 4);
  });
});
