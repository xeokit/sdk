/**
 * @jest-environment jsdom
 */
// 3DXML parse needs a DOMParser, hence the jsdom environment (docblock must be
// the file's first comment for Jest to honour it). Synthesises a STORED (method
// 0) ZIP of XML documents in memory — no deflate writer, no external files — and
// runs the parser against a capturing SceneModel stub (the FBX/USDZ test pattern).

// jsdom doesn't define TextEncoder/TextDecoder — polyfill from node's `util`
// before the SDK modules load (they `new TextDecoder()` at module scope). Static
// imports hoist above this, so the modules under test are require()'d below.
import {TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder} from "util";
const _g = globalThis as any;
if (typeof _g.TextEncoder === "undefined") { _g.TextEncoder = NodeTextEncoder; }
if (typeof _g.TextDecoder === "undefined") { _g.TextDecoder = NodeTextDecoder; }

const {parse} = require("../versions/v1/parse");
const {encode} = require("../versions/v1/encode");
const {ThreeDXMLLoader} = require("../ThreeDXMLLoader");
const {TrianglesPrimitive} = require("../../../base/constants");
const {Scene} = require("../../../model/scene/Scene");

// ── Synthetic STORED ZIP builder ────────────────────────────────────────────
function makeZip(files: {name: string; content: string}[]): ArrayBuffer {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.content);

    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);            // local file header sig
    lh.setUint16(4, 20, true);                    // version needed
    lh.setUint16(8, 0, true);                     // method 0 (STORED)
    lh.setUint32(18, data.length, true);          // compressed size
    lh.setUint32(22, data.length, true);          // uncompressed size
    lh.setUint16(26, name.length, true);          // name length
    chunks.push(new Uint8Array(lh.buffer), name, data);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);            // central dir header sig
    ch.setUint16(10, 0, true);                    // method 0
    ch.setUint32(20, data.length, true);          // compressed size
    ch.setUint32(24, data.length, true);          // uncompressed size
    ch.setUint16(28, name.length, true);          // name length
    ch.setUint32(42, offset, true);               // local header offset
    centrals.push(new Uint8Array(ch.buffer), name);

    offset += 30 + name.length + data.length;
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const c of centrals) {
    cdSize += c.length;
  }

  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);            // EOCD sig
  eocd.setUint16(8, files.length, true);          // entries on this disk
  eocd.setUint16(10, files.length, true);         // total entries
  eocd.setUint32(12, cdSize, true);               // central dir size
  eocd.setUint32(16, cdStart, true);              // central dir offset

  const all = [...chunks, ...centrals, new Uint8Array(eocd.buffer)];
  const total = all.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out.buffer;
}

// A minimal but complete 3DXML: root assembly → one instanced part → one
// triangle representation, translated by (10, 20, 30) and coloured red.
const MANIFEST = `<Manifest xmlns="http://www.3ds.com/xsd/3DXML"><Root>model.3dxml</Root></Manifest>`;
const MODEL = `<Model_3dxml xmlns="http://www.3ds.com/xsd/3DXML">
  <ProductStructure root="R1">
    <Reference3D id="R1" name="Root"/>
    <Reference3D id="R2" name="Part"/>
    <Instance3D id="I1" name="inst">
      <IsAggregatedBy>R1</IsAggregatedBy>
      <IsInstanceOf>R2</IsInstanceOf>
      <RelativeMatrix>1 0 0 0 1 0 0 0 1 10 20 30</RelativeMatrix>
    </Instance3D>
    <ReferenceRep id="RR1" name="rep" associatedFile="urn:3DXML:rep.3DRep"/>
    <InstanceRep id="IR1" name="instrep">
      <IsAggregatedBy>R2</IsAggregatedBy>
      <IsInstanceOf>RR1</IsInstanceOf>
    </InstanceRep>
  </ProductStructure>
</Model_3dxml>`;
const REP = `<XMLRepresentation xmlns="http://www.3ds.com/xsd/3DXML">
  <Rep>
    <SurfaceAttributes><Color red="1" green="0" blue="0" alpha="1"/></SurfaceAttributes>
    <Faces><Face triangles="0 1 2"/></Faces>
    <VertexBuffer><Positions>0 0 0 1 0 0 0 1 0</Positions><Normals>0 0 1 0 0 1 0 0 1</Normals></VertexBuffer>
  </Rep>
</XMLRepresentation>`;

function capturingScene() {
  const calls: {geom: any[]; mesh: any[]; object: any[]} = {geom: [], mesh: [], object: []};
  const sceneModel: any = {
    geometries: {} as Record<string, any>,
    createGeometry: (p: any) => { calls.geom.push(p); sceneModel.geometries[p.id] = p; return {ok: true, value: p}; },
    createMesh: (p: any) => { calls.mesh.push(p); return {ok: true, value: p}; },
    createObject: (p: any) => { calls.object.push(p); return {ok: true, value: p}; },
  };
  return {sceneModel, calls};
}

describe("3DXML loader", () => {

  it("loads geometry, a baked-transform mesh, and an object from a .3dxml archive", async () => {
    const fileData = makeZip([
      {name: "Manifest.xml", content: MANIFEST},
      {name: "model.3dxml", content: MODEL},
      {name: "rep.3DRep", content: REP},
    ]);

    const {sceneModel, calls} = capturingScene();
    await parse({fileData, sceneModel} as any);

    // One geometry, created once for the ReferenceRep.
    expect(calls.geom).toHaveLength(1);
    const g = calls.geom[0];
    expect(g.primitive).toBe(TrianglesPrimitive);
    expect(Array.from(g.positions)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(Array.from(g.indices)).toEqual([0, 1, 2]);
    expect(Array.from(g.normals)).toHaveLength(9);

    // One mesh, carrying the composed world transform (10, 20, 30) and the flat colour.
    expect(calls.mesh).toHaveLength(1);
    const m = calls.mesh[0];
    expect(m.geometryId).toBe(g.id);
    expect(m.matrix[12]).toBe(10);
    expect(m.matrix[13]).toBe(20);
    expect(m.matrix[14]).toBe(30);
    expect(m.color).toEqual([1, 0, 0]);
    expect(m.opacity).toBe(1);

    // One object grouping that mesh.
    expect(calls.object).toHaveLength(1);
    expect(calls.object[0].meshIds).toEqual([m.id]);
  });

  it("instances a shared part at multiple transforms, reusing one geometry", async () => {
    const model = `<Model_3dxml xmlns="x">
      <ProductStructure root="R1">
        <Reference3D id="R1"/><Reference3D id="R2"/>
        <Instance3D id="IA"><IsAggregatedBy>R1</IsAggregatedBy><IsInstanceOf>R2</IsInstanceOf>
          <RelativeMatrix>1 0 0 0 1 0 0 0 1 0 0 0</RelativeMatrix></Instance3D>
        <Instance3D id="IB"><IsAggregatedBy>R1</IsAggregatedBy><IsInstanceOf>R2</IsInstanceOf>
          <RelativeMatrix>1 0 0 0 1 0 0 0 1 5 0 0</RelativeMatrix></Instance3D>
        <ReferenceRep id="RR1" associatedFile="rep.3DRep"/>
        <InstanceRep id="IR1"><IsAggregatedBy>R2</IsAggregatedBy><IsInstanceOf>RR1</IsInstanceOf></InstanceRep>
      </ProductStructure></Model_3dxml>`;
    const fileData = makeZip([
      {name: "Manifest.xml", content: MANIFEST},
      {name: "model.3dxml", content: model},
      {name: "rep.3DRep", content: REP},
    ]);

    const {sceneModel, calls} = capturingScene();
    await parse({fileData, sceneModel} as any);

    expect(calls.geom).toHaveLength(1);          // geometry created once
    expect(calls.mesh).toHaveLength(2);          // one mesh per instance
    expect(calls.object).toHaveLength(2);
    // The two occurrences sit at different X translations.
    const xs = calls.mesh.map((m: any) => m.matrix[12]).sort();
    expect(xs).toEqual([0, 5]);
  });

  it("rejects a non-ZIP file via the loader's version check", async () => {
    const notZip = new TextEncoder().encode("<not a zip>").buffer;
    const {sceneModel} = capturingScene();
    await expect(new ThreeDXMLLoader().load({fileData: notZip, sceneModel} as any)).rejects.toBeDefined();
  });

  it("round-trips a SceneModel: export → re-import reproduces geometry, transform and colour", async () => {
    // Build a real SceneModel (one triangle, a translated mesh, an object).
    const src = new Scene().createModel({id: "src"}).value;
    src.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1],
      indices: [0, 1, 2, 0, 2, 3],
      normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    });
    src.createMesh({
      id: "m", geometryId: "g",
      matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1],
      color: [1, 0, 0], opacity: 0.5,
    });
    src.createObject({id: "obj", meshIds: ["m"]});

    const fileData = await encode({sceneModel: src});
    expect(new DataView(fileData).getUint32(0, true)).toBe(0x04034b50);   // valid ZIP

    // Re-import into a capturing stub.
    const {sceneModel: dst, calls} = capturingScene();
    await parse({fileData, sceneModel: dst} as any);

    expect(calls.geom).toHaveLength(1);
    const g = calls.geom[0];
    expect(g.primitive).toBe(TrianglesPrimitive);
    expect(Array.from(g.indices)).toEqual([0, 1, 2, 0, 2, 3]);
    // Positions survive a quantize→dequantize round-trip (compare with tolerance).
    expect(g.positions[0]).toBeCloseTo(0, 3);
    expect(g.positions[6]).toBeCloseTo(1, 3);   // vertex 2 = (1,1,1)
    expect(g.positions[8]).toBeCloseTo(1, 3);

    expect(calls.mesh).toHaveLength(1);
    const m = calls.mesh[0];
    expect(m.matrix[12]).toBeCloseTo(10, 3);
    expect(m.matrix[13]).toBeCloseTo(20, 3);
    expect(m.matrix[14]).toBeCloseTo(30, 3);
    expect(m.color[0]).toBeCloseTo(1, 3);
    expect(m.color[1]).toBeCloseTo(0, 3);
    expect(m.opacity).toBeCloseTo(0.5, 3);

    expect(calls.object).toHaveLength(1);
  });
});
