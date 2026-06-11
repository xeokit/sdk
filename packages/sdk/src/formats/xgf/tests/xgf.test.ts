import {encode as encodeV1} from "../versions/v1/encode";
import {parse as parseV1} from "../versions/v1/parse";
import {encode as encodeV2} from "../versions/v2/encode";
import {parse as parseV2} from "../versions/v2/parse";

import {TrianglesPrimitive} from "../../../base/constants";

// A unit quad (2 triangles) in the XY plane, positions pre-quantised to the
// uint16 range the SceneGeometry stores. The exact dequantised values don't
// matter for the round-trip — we assert the raw compressed bytes survive.
const QUAD_AABB = [0, 0, 0, 1, 1, 1];
const QUAD_POSITIONS = new Uint16Array([
  0,     0,     0,
  65535, 0,     0,
  65535, 65535, 0,
  0,     65535, 0,
]);
const QUAD_INDICES = new Uint32Array([0, 1, 2, 0, 2, 3]);
const QUAD_EDGE_INDICES = new Uint32Array([0, 1, 1, 2, 2, 3, 3, 0]);
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// Build the minimal in-memory SceneModel shape the encoders read: a single
// triangle geometry, one mesh referencing it with an identity world matrix,
// and one object owning that mesh.
function buildSource(color: number[], opacity: number) {
  const geom: any = {
    id: "g1",
    primitive: TrianglesPrimitive,
    aabb: QUAD_AABB,
    positionsCompressed: QUAD_POSITIONS,
    indices: QUAD_INDICES,
    edgeIndices: QUAD_EDGE_INDICES,
  };
  const mesh: any = {
    id: "mesh1",
    geometry: geom,
    matrix: IDENTITY,
    effectiveColor: color,
    effectiveOpacity: opacity,
    material: null,
  };
  const sceneModel: any = {
    id: "sourceModel",
    scene: {coordinateSystem: {}},
    geometries: {g1: geom},
    meshes: {mesh1: mesh},
    objects: {Building1: {id: "Building1", meshes: [mesh]}},
    textures: {},
    materials: {},
  };
  return {sceneModel, mesh, geom};
}

// Capturing stubs standing in for a destination SceneModel / DataModel.
function makeCapturingScene() {
  const calls: {geom: any[]; mesh: any[]; object: any[]} = {geom: [], mesh: [], object: []};
  const sceneModel: any = {
    id: "destModel",
    geometries: {} as Record<string, any>,
    createGeometryCompressed: (p: any) => {
      calls.geom.push(p);
      sceneModel.geometries[p.id] = p;
    },
    createMesh: (p: any) => calls.mesh.push(p),
    createObject: (p: any) => calls.object.push(p),
    createTexture: () => {},
    createMaterial: () => {},
  };
  return {sceneModel, calls};
}

describe("xgf", () => {

  describe("v1", () => {

    it("encodes a SceneModel to a non-empty ArrayBuffer tagged version 1", async () => {
      const {sceneModel} = buildSource([0.2, 0.4, 0.6], 0.6);
      const buffer = await encodeV1({sceneModel} as any, {});

      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBeGreaterThan(0);
      // Header: first uint32 (little-endian) is the XGF version tag.
      expect(new DataView(buffer).getUint32(0, true)).toBe(1);
    });

    it("round-trips geometry + object back through the v1 loader", async () => {
      const {sceneModel} = buildSource([0.2, 0.4, 0.6], 0.6);
      const buffer = await encodeV1({sceneModel} as any, {});

      const {sceneModel: dstScene, calls} = makeCapturingScene();
      await parseV1({fileData: buffer, sceneModel: dstScene} as any, {});

      // One geometry recreated, carrying the quantised positions + indices.
      expect(calls.geom).toHaveLength(1);
      const geom = calls.geom[0];
      expect(geom.primitive).toBe(TrianglesPrimitive);
      expect(Array.from(geom.positionsCompressed)).toEqual(Array.from(QUAD_POSITIONS));
      expect(Array.from(geom.indices)).toEqual(Array.from(QUAD_INDICES));
      expect(Array.from(geom.aabb)).toEqual(QUAD_AABB);

      // One mesh, carrying the encoded RGBA (8-bit quantised).
      expect(calls.mesh).toHaveLength(1);
      const mesh = calls.mesh[0];
      expect(mesh.geometryId).toBe(geom.id);
      expect(Array.from(mesh.color).map((v: any) => Math.round(v * 255)))
        .toEqual([Math.round(0.2 * 255), Math.round(0.4 * 255), Math.round(0.6 * 255)]);
      expect(Math.round(mesh.opacity * 255)).toBe(Math.round(0.6 * 255));

      // The source object id survives the round-trip.
      expect(calls.object).toHaveLength(1);
      expect(calls.object[0].id).toBe("Building1");
    });
  });

  describe("v2", () => {

    it("encodes a SceneModel to a non-empty ArrayBuffer tagged version 2", async () => {
      const {sceneModel} = buildSource([0.2, 0.4, 0.6], 0.6);
      const buffer = await encodeV2({sceneModel} as any, {});

      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBeGreaterThan(0);
      expect(new DataView(buffer).getUint32(0, true)).toBe(2);
    });

    it("round-trips geometry + object back through the v2 loader", async () => {
      const {sceneModel} = buildSource([0.2, 0.4, 0.6], 0.6);
      const buffer = await encodeV2({sceneModel} as any, {});

      const {sceneModel: dstScene, calls} = makeCapturingScene();
      await parseV2({fileData: buffer, sceneModel: dstScene} as any, {});

      expect(calls.geom).toHaveLength(1);
      const geom = calls.geom[0];
      expect(geom.primitive).toBe(TrianglesPrimitive);
      expect(Array.from(geom.positionsCompressed)).toEqual(Array.from(QUAD_POSITIONS));
      expect(Array.from(geom.indices)).toEqual(Array.from(QUAD_INDICES));
      expect(Array.from(geom.aabb)).toEqual(QUAD_AABB);

      // No material reference on the source mesh, so v2 falls back to the
      // inline RGBA attributes (same form as v1).
      expect(calls.mesh).toHaveLength(1);
      const mesh = calls.mesh[0];
      expect(mesh.geometryId).toBe(geom.id);
      expect(Array.from(mesh.color).map((v: any) => Math.round(v * 255)))
        .toEqual([Math.round(0.2 * 255), Math.round(0.4 * 255), Math.round(0.6 * 255)]);
      expect(Math.round(mesh.opacity * 255)).toBe(Math.round(0.6 * 255));

      expect(calls.object).toHaveLength(1);
      expect(calls.object[0].id).toBe("Building1");
    });
  });
});
