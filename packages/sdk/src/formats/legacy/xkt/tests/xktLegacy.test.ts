import {deflate} from "pako";
import {Scene} from "../../../../model/scene/Scene";
import {Data} from "../../../../model/data/Data";
import {XKTLoader} from "../XKTLoader";

// Synthetic single-triangle, single-tile, single-entity models for each legacy
// XKT version, hand-assembled in each version's container. There are no real
// fixtures for these versions, so these exercise the full path: container split
// / offset-table read → inflate → shared tiled build → SceneModel + DataModel.

type Typed = Uint8Array | Int8Array | Uint16Array | Uint32Array | Int32Array | Float32Array | Float64Array;

function bytesOf(a: Typed): Uint8Array {
  return new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
}

/** Assemble a deflated, length-prefixed container (XKT versions 7-10). */
function deflatedContainer(version: number, elements: (Typed | string)[]): ArrayBuffer {
  const deflated = elements.map((el) => deflate(typeof el === "string" ? el : bytesOf(el)));
  const n = deflated.length;
  const headerWords = 2 + n;
  let total = headerWords * 4;
  for (const d of deflated) total += d.length;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, version, true);
  dv.setUint32(4, n, true);
  let off = headerWords * 4;
  for (let i = 0; i < n; i++) {
    dv.setUint32((i + 2) * 4, deflated[i].length, true);
    out.set(deflated[i], off);
    off += deflated[i].length;
  }
  return out.buffer;
}

/** Assemble an uncompressed offset-table container (XKT versions 11-12). */
function offsetTableContainer(version: number, arrays: Typed[]): ArrayBuffer {
  const n = arrays.length;
  const headerBytes = (1 + 2 * n) * 4;
  const offsets: number[] = [];
  let off = headerBytes;
  for (const a of arrays) {
    off = Math.ceil(off / 8) * 8; // 8-byte align covers every element type
    offsets.push(off);
    off += a.byteLength;
  }
  const buf = new ArrayBuffer(Math.ceil(off / 8) * 8);
  const dv = new DataView(buf);
  dv.setUint32(0, version, true);
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < n; i++) {
    dv.setUint32((1 + 2 * i) * 4, offsets[i], true);
    dv.setUint32((1 + 2 * i + 1) * 4, arrays[i].byteLength, true);
    u8.set(bytesOf(arrays[i]), offsets[i]);
  }
  return buf;
}

const POSITIONS = new Uint16Array([0, 0, 0, 65535, 0, 0, 0, 65535, 0]);
const INDICES = new Uint32Array([0, 1, 2]);
const TILE_AABB = new Float64Array([0, 0, 0, 10, 10, 10]);
const META = {metaObjects: [{id: "obj1", type: "IfcWall", name: "Wall", parent: null}], propertySets: []};

async function load(fileData: ArrayBuffer) {
  const sceneModel = new Scene().createModel({id: "m"}).value!;
  const dataModel = new Data().createModel({id: "m"}).value!;
  await new XKTLoader().load({fileData, sceneModel, dataModel}, {});
  return {sceneModel, dataModel};
}

// V7: deflated, RGB material, no embedded metadata.
function v7(): ArrayBuffer {
  const E: (Typed | string)[] = [];
  E[0] = POSITIONS;
  E[1] = new Int8Array(0);
  E[2] = new Uint8Array(0);
  E[3] = INDICES;
  E[4] = new Uint32Array(0);
  E[5] = new Float32Array(0);
  E[6] = new Float32Array(0);
  E[7] = new Uint8Array([1]); // surface
  E[8] = new Uint32Array([0]);
  E[9] = new Uint32Array([0]);
  E[10] = new Uint32Array([0]);
  E[11] = new Uint32Array([0]);
  E[12] = new Uint32Array([0]);
  E[13] = new Uint32Array([0]);
  E[14] = new Uint32Array([0]);
  E[15] = new Uint8Array([255, 0, 0, 255, 0, 0]);
  E[16] = JSON.stringify(["obj1"]);
  E[17] = new Uint32Array([0]);
  E[18] = TILE_AABB;
  E[19] = new Uint32Array([0]);
  return deflatedContainer(7, E);
}

// V9: deflated, embedded metadata JSON, RGBA material.
function v9(): ArrayBuffer {
  const E: (Typed | string)[] = [];
  E[0] = JSON.stringify(META);
  E[1] = POSITIONS;
  E[2] = new Int8Array(0);
  E[3] = new Uint8Array(0);
  E[4] = INDICES;
  E[5] = new Uint32Array(0);
  E[6] = new Float32Array(0);
  E[7] = new Float32Array(0);
  E[8] = new Uint8Array([1]);
  E[9] = new Uint32Array([0]);
  E[10] = new Uint32Array([0]);
  E[11] = new Uint32Array([0]);
  E[12] = new Uint32Array([0]);
  E[13] = new Uint32Array([0]);
  E[14] = new Uint32Array([0]);
  E[15] = new Uint32Array([0]);
  E[16] = new Uint8Array([0, 255, 0, 255, 0, 0]);
  E[17] = JSON.stringify(["obj1"]);
  E[18] = new Uint32Array([0]);
  E[19] = TILE_AABB;
  E[20] = new Uint32Array([0]);
  return deflatedContainer(9, E);
}

// V8: deflated, metadata as parallel arrays, RGB material, entity id by index.
function v8(): ArrayBuffer {
  const E: (Typed | string)[] = [];
  E[0] = JSON.stringify(["IfcWall"]); // types
  E[1] = JSON.stringify(["obj1"]);    // eachMetaObjectId
  E[2] = new Uint32Array([0]);        // eachMetaObjectType → types[0]
  E[3] = JSON.stringify(["Wall"]);    // eachMetaObjectName
  E[4] = new Uint32Array([0]);        // eachMetaObjectParent (self → null)
  E[5] = POSITIONS;
  E[6] = new Int8Array(0);
  E[7] = new Uint8Array(0);
  E[8] = INDICES;
  E[9] = new Uint32Array(0);
  E[10] = new Float32Array(0);
  E[11] = new Float32Array(0);
  E[12] = new Uint8Array([1]);
  E[13] = new Uint32Array([0]);
  E[14] = new Uint32Array([0]);
  E[15] = new Uint32Array([0]);
  E[16] = new Uint32Array([0]);
  E[17] = new Uint32Array([0]);
  E[18] = new Uint32Array([0]);
  E[19] = new Uint32Array([0]);
  E[20] = new Uint8Array([255, 0, 0, 255, 0, 0]);
  E[21] = new Uint32Array([0]); // eachEntityMetaObject → metaObject 0 → "obj1"
  E[22] = new Uint32Array([0]);
  E[23] = TILE_AABB;
  E[24] = new Uint32Array([0]);
  return deflatedContainer(8, E);
}

// V10: deflated, embedded metadata JSON, RGBA material, empty texture elements.
function v10(): ArrayBuffer {
  const E: (Typed | string)[] = [];
  E[0] = JSON.stringify(META);
  E[1] = new Uint8Array(0);   // textureData
  E[2] = new Uint32Array(0);  // eachTextureDataPortion
  E[3] = new Uint16Array(0);  // eachTextureAttributes
  E[4] = POSITIONS;
  E[5] = new Int8Array(0);
  E[6] = new Uint8Array(0);
  E[7] = new Float32Array(0); // uvs
  E[8] = INDICES;
  E[9] = new Uint32Array(0);
  E[10] = new Int32Array(0);  // eachTextureSetTextures
  E[11] = new Float32Array(0);
  E[12] = new Float32Array(0);
  E[13] = new Uint8Array([1]);
  E[14] = new Uint32Array([0]);
  E[15] = new Uint32Array([0]);
  E[16] = new Uint32Array([0]);
  E[17] = new Uint32Array([0]); // uvsPortion
  E[18] = new Uint32Array([0]);
  E[19] = new Uint32Array([0]);
  E[20] = new Uint32Array([0]);
  E[21] = new Uint32Array([0]);
  E[22] = new Int32Array([-1]); // eachMeshTextureSet
  E[23] = new Uint8Array([0, 0, 255, 255, 0, 0]);
  E[24] = JSON.stringify(["obj1"]);
  E[25] = new Uint32Array([0]);
  E[26] = TILE_AABB;
  E[27] = new Uint32Array([0]);
  return deflatedContainer(10, E);
}

// V11: offset-table, embedded metadata JSON, RGBA material.
function v11(): ArrayBuffer {
  const enc = new TextEncoder();
  const A: Typed[] = [];
  A[0] = enc.encode(JSON.stringify(META)); // metadata
  A[1] = new Uint8Array(0);   // textureData
  A[2] = new Uint32Array(0);  // eachTextureDataPortion
  A[3] = new Uint16Array(0);  // eachTextureAttributes
  A[4] = POSITIONS;
  A[5] = new Int8Array(0);    // normals
  A[6] = new Uint8Array(0);   // colors
  A[7] = new Float32Array(0); // uvs
  A[8] = INDICES;
  A[9] = new Uint32Array(0);  // edgeIndices
  A[10] = new Int32Array(0);  // eachTextureSetTextures
  A[11] = new Float32Array(0);// matrices
  A[12] = new Float32Array(0);// reusedGeometriesDecodeMatrix
  A[13] = new Uint8Array([1]);// eachGeometryPrimitiveType
  A[14] = new Uint32Array([0]);
  A[15] = new Uint32Array([0]);// normalsPortion
  A[16] = new Uint32Array([0]);// colorsPortion
  A[17] = new Uint32Array([0]);// uvsPortion
  A[18] = new Uint32Array([0]);// indicesPortion
  A[19] = new Uint32Array([0]);// edgeIndicesPortion
  A[20] = new Uint32Array([0]);// eachMeshGeometriesPortion
  A[21] = new Uint32Array([0]);// eachMeshMatricesPortion
  A[22] = new Int32Array([-1]);// eachMeshTextureSet
  A[23] = new Uint8Array([0, 0, 255, 255, 0, 0]); // material
  A[24] = enc.encode(JSON.stringify(["obj1"]));    // eachEntityId
  A[25] = new Uint32Array([0]);// eachEntityMeshesPortion
  A[26] = TILE_AABB;
  A[27] = new Uint32Array([0]);// eachTileEntitiesPortion
  return offsetTableContainer(11, A);
}

// V12 compressed: deflated container, the v11 layout plus a per-geometry
// axis-label element at index 14, with the header's high (zip) bit set.
function v12z(): ArrayBuffer {
  const E: (Typed | string)[] = [];
  E[0] = JSON.stringify(META);
  E[1] = new Uint8Array(0);   // textureData
  E[2] = new Uint32Array(0);  // eachTextureDataPortion
  E[3] = new Uint16Array(0);  // eachTextureAttributes
  E[4] = POSITIONS;
  E[5] = new Int8Array(0);    // normals
  E[6] = new Uint8Array(0);   // colors
  E[7] = new Float32Array(0); // uvs
  E[8] = INDICES;
  E[9] = new Uint32Array(0);  // edgeIndices
  E[10] = new Int32Array(0);  // eachTextureSetTextures
  E[11] = new Float32Array(0);// matrices
  E[12] = new Float32Array(0);// reusedGeometriesDecodeMatrix
  E[13] = new Uint8Array([1]);// eachGeometryPrimitiveType
  E[14] = JSON.stringify([]); // eachGeometryAxisLabel (skipped by the parser)
  E[15] = new Uint32Array([0]);
  E[16] = new Uint32Array([0]);// normalsPortion
  E[17] = new Uint32Array([0]);// colorsPortion
  E[18] = new Uint32Array([0]);// uvsPortion
  E[19] = new Uint32Array([0]);// indicesPortion
  E[20] = new Uint32Array([0]);// edgeIndicesPortion
  E[21] = new Uint32Array([0]);// eachMeshGeometriesPortion
  E[22] = new Uint32Array([0]);// eachMeshMatricesPortion
  E[23] = new Int32Array([-1]);// eachMeshTextureSet
  E[24] = new Uint8Array([0, 0, 255, 255, 0, 0]);
  E[25] = JSON.stringify(["obj1"]);
  E[26] = new Uint32Array([0]);
  E[27] = TILE_AABB;
  E[28] = new Uint32Array([0]);
  return deflatedContainer(12 | 0x80000000, E); // high bit marks the deflated form
}

describe("XKTLoader — legacy versions", () => {

  it.each([
    ["v7", 7, v7],
    ["v8", 8, v8],
    ["v9", 9, v9],
    ["v10", 10, v10],
    ["v11", 11, v11],
    ["v12-compressed", 12, v12z],
  ])("%s: detects the version and builds one geometry, mesh and object", async (_name, version, build) => {
    const fileData = build();
    expect(new DataView(fileData).getUint32(0, true) & 0x7fffffff).toBe(version);

    const {sceneModel} = await load(fileData);
    expect(Object.keys(sceneModel.geometries).length).toBe(1);
    expect(Object.keys(sceneModel.meshes).length).toBe(1);
    expect(Object.keys(sceneModel.objects).length).toBe(1);
    expect(sceneModel.objects["obj1"]).toBeDefined();
  });

  it("v7 has no embedded metadata, so the DataModel stays empty", async () => {
    const {dataModel} = await load(v7());
    expect(Object.keys(dataModel.objects).length).toBe(0);
  });

  it.each([
    ["v8", v8],
    ["v9", v9],
    ["v10", v10],
    ["v11", v11],
    ["v12-compressed", v12z],
  ])("%s maps embedded metadata into the DataModel", async (_name, build) => {
    const {dataModel} = await load(build());
    expect(dataModel.objects["obj1"]).toBeDefined();
    expect(dataModel.objects["obj1"].type).toBe("IfcWall");
  });
});
