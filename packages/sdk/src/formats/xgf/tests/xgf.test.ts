import {encode as encodeV1} from "../versions/v1/encode";
import {parse as parseV1} from "../versions/v1/parse";
import {encode as encodeV2} from "../versions/v2/encode";
import {parse as parseV2} from "../versions/v2/parse";
import {encode as encodeV3} from "../versions/v3/encode";
import {parse as parseV3} from "../versions/v3/parse";

import {GaussianSplatsPrimitive, TrianglesPrimitive} from "../../../base/constants";
import {Scene} from "../../../model/scene/Scene";
import {XGFExporter} from "../XGFExporter";

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

// Two splats, attribute arrays in the exact shapes a GaussianSplatsPrimitive
// SceneGeometry stores: quantised uint16 centres, float scales (xyz), float
// rotation quaternions (xyzw), RGBA8 colours. Rotation values are multiples of
// 1/128 so the 8-bit XGF quantise/dequantise round-trips them exactly.
const SPLAT_AABB = [0, 0, 0, 1, 1, 1];
const SPLAT_POSITIONS = new Uint16Array([0, 0, 0, 65535, 32768, 16384]);
const SPLAT_SCALES = new Float32Array([0.1, 0.2, 0.3, 1, 2, 3]);
const SPLAT_ROTATIONS = new Float32Array([0, 0, 0, 0.5, 0.25, -0.25, 0.5, -0.5]);
const SPLAT_COLORS = new Uint8Array([10, 20, 30, 255, 40, 50, 60, 128]);

function buildSplatSource() {
  const geom: any = {
    id: "splat1",
    primitive: GaussianSplatsPrimitive,
    aabb: SPLAT_AABB,
    positionsCompressed: SPLAT_POSITIONS,
    colorsCompressed: SPLAT_COLORS,
    scales: SPLAT_SCALES,
    rotations: SPLAT_ROTATIONS,
  };
  const mesh: any = {
    id: "mesh1", geometry: geom, matrix: IDENTITY,
    effectiveColor: [1, 1, 1], effectiveOpacity: 1, material: null,
  };
  const sceneModel: any = {
    id: "splatModel",
    scene: {coordinateSystem: {}},
    geometries: {splat1: geom},
    meshes: {mesh1: mesh},
    objects: {SplatObject: {id: "SplatObject", meshes: [mesh]}},
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

  describe("v3", () => {

    it("encodes a SceneModel to a non-empty ArrayBuffer tagged version 3", async () => {
      const {sceneModel} = buildSplatSource();
      const buffer = await encodeV3({sceneModel} as any, {});

      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBeGreaterThan(0);
      expect(new DataView(buffer).getUint32(0, true)).toBe(3);
    });

    it("round-trips a Gaussian-splat geometry through the v3 loader", async () => {
      const {sceneModel} = buildSplatSource();
      const buffer = await encodeV3({sceneModel} as any, {});

      const {sceneModel: dstScene, calls} = makeCapturingScene();
      await parseV3({fileData: buffer, sceneModel: dstScene} as any, {});

      expect(calls.geom).toHaveLength(1);
      const geom = calls.geom[0];
      expect(geom.primitive).toBe(GaussianSplatsPrimitive);
      // Splats carry no indices.
      expect(geom.indices).toBeUndefined();
      // Centres (uint16) and colours (uint8) survive exactly.
      expect(Array.from(geom.positionsCompressed)).toEqual(Array.from(SPLAT_POSITIONS));
      expect(Array.from(geom.colorsCompressed)).toEqual(Array.from(SPLAT_COLORS));
      // Scales are float32 — bit-identical round-trip.
      expect(Array.from(geom.scales)).toEqual(Array.from(SPLAT_SCALES));
      // Rotations round-trip through 8-bit quantisation — exact here by construction.
      expect(Array.from(geom.rotations).map((v: any) => +v.toFixed(6)))
        .toEqual(Array.from(SPLAT_ROTATIONS).map(v => +v.toFixed(6)));

      expect(calls.object).toHaveLength(1);
      expect(calls.object[0].id).toBe("SplatObject");
    });

    it("round-trips a mixed triangle + splat model (sparse scale/rotation bases)", async () => {
      // One triangle geometry (no scales/rotations → NO_INDEX bases) and one
      // splat geometry in the same file, to exercise the sparse base-pointer walk.
      const tri = buildSource([0.2, 0.4, 0.6], 0.6).geom;
      const {geom: splat, mesh: splatMesh} = buildSplatSource();
      const triMesh: any = {
        id: "triMesh", geometry: tri, matrix: IDENTITY,
        effectiveColor: [0.2, 0.4, 0.6], effectiveOpacity: 0.6, material: null,
      };
      const sceneModel: any = {
        id: "mixed",
        scene: {coordinateSystem: {}},
        geometries: {g1: tri, splat1: splat},
        meshes: {triMesh, mesh1: splatMesh},
        objects: {
          TriObject: {id: "TriObject", meshes: [triMesh]},
          SplatObject: {id: "SplatObject", meshes: [splatMesh]},
        },
        textures: {}, materials: {},
      };

      const buffer = await encodeV3({sceneModel} as any, {});
      const {sceneModel: dstScene, calls} = makeCapturingScene();
      await parseV3({fileData: buffer, sceneModel: dstScene} as any, {});

      expect(calls.geom).toHaveLength(2);
      const triOut = calls.geom.find((g: any) => g.primitive === TrianglesPrimitive);
      const splatOut = calls.geom.find((g: any) => g.primitive === GaussianSplatsPrimitive);

      // Triangle geometry: indices preserved, no splat attributes.
      expect(Array.from(triOut.indices)).toEqual(Array.from(QUAD_INDICES));
      expect(triOut.scales).toBeUndefined();
      expect(triOut.rotations).toBeUndefined();

      // Splat geometry: attributes intact despite the interleaving.
      expect(Array.from(splatOut.positionsCompressed)).toEqual(Array.from(SPLAT_POSITIONS));
      expect(Array.from(splatOut.scales)).toEqual(Array.from(SPLAT_SCALES));
      expect(Array.from(splatOut.rotations).map((v: any) => +v.toFixed(6)))
        .toEqual(Array.from(SPLAT_ROTATIONS).map(v => +v.toFixed(6)));
    });
  });

  describe("XGFExporter version auto-selection", () => {

    // Real Scene/SceneModel here (not the encoder stubs) so the test exercises
    // SceneModel.containsPrimitive + the exporter's version promotion end-to-end.
    const versionTag = (buffer: ArrayBuffer) => new DataView(buffer).getUint32(0, true);

    function realSplatModel() {
      const sceneModel = new Scene().createModel({id: "m"}).value!;
      sceneModel.createGeometry({
        id: "s", primitive: GaussianSplatsPrimitive,
        positions: [0, 0, 0, 1, 1, 1],
        scales: [1, 1, 1, 1, 1, 1],
        rotations: [0, 0, 0, 1, 0, 0, 0, 1],
        colorsCompressed: [255, 0, 0, 255, 0, 255, 0, 255],
      });
      sceneModel.createMesh({id: "mesh", geometryId: "s"});
      sceneModel.createObject({id: "obj", meshIds: ["mesh"]});
      return sceneModel;
    }

    function realTriangleModel() {
      const sceneModel = new Scene().createModel({id: "m"}).value!;
      sceneModel.createGeometry({
        id: "t", primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 1, 0, 1, 1, 1],
        indices: [0, 1, 2],
      });
      sceneModel.createMesh({id: "mesh", geometryId: "t"});
      sceneModel.createObject({id: "obj", meshIds: ["mesh"]});
      return sceneModel;
    }

    it("auto-selects v3 for a model containing splats", async () => {
      const buffer = await new XGFExporter().write({sceneModel: realSplatModel()});
      expect(versionTag(buffer)).toBe(3);
    });

    it("keeps the default version (v1) for a non-splat model", async () => {
      const buffer = await new XGFExporter().write({sceneModel: realTriangleModel()});
      expect(versionTag(buffer)).toBe(1);
    });

    it("honours an explicit version even when the model has splats", async () => {
      const buffer = await new XGFExporter().write({sceneModel: realSplatModel(), version: "1.0.0"});
      expect(versionTag(buffer)).toBe(1);
    });
  });
});
