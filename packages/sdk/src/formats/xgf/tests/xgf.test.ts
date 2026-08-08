import {encode} from "../versions/v1/encode";
import {parse} from "../versions/v1/parse";

import {GaussianSplatsPrimitive, TrianglesPrimitive} from "../../../base/constants";
import {SDKErrorType} from "../../../base/core";
import {Scene} from "../../../model/scene/Scene";
import {XGFExporter} from "../XGFExporter";
import {XGFLoader} from "../XGFLoader";
import {XGFStreamExporter} from "../../xgfstream/XGFStreamExporter";
import {XGFStreamingExporter} from "../../xgfstream/XGFStreamingExporter";
import {XGFStreamingLoader} from "../../xgfstream/XGFStreamingLoader";
import {createXGFManifest} from "../../xgfstream/XGFManifest";
import {readXGFChunkManifest} from "../../xgfstream/manifest/readXGFChunkManifest";
import {writeXGFChunkManifest} from "../../xgfstream/manifest/writeXGFChunkManifest";
import {readXGFStreamingIndex} from "../../xgfstream/index/readXGFStreamingIndex";
import {writeXGFStreamingIndex} from "../../xgfstream/index/writeXGFStreamingIndex";
import {readXGFStreamingRuntimeIndex} from "../../xgfstream/index/readXGFStreamingRuntimeIndex";
import {writeXGFStreamingRuntimeIndex} from "../../xgfstream/index/writeXGFStreamingRuntimeIndex";
import {createXGFStreamingIndexLookup} from "../../xgfstream/index/createXGFStreamingIndexLookup";

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

// Build the minimal in-memory SceneModel shape the encoder reads: a single
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
  const calls: {geom: any[]; material: any[]; mesh: any[]; object: any[]} = {geom: [], material: [], mesh: [], object: []};
  const sceneModel: any = {
    id: "destModel",
    geometries: {} as Record<string, any>,
    materials: {} as Record<string, any>,
    createGeometryCompressed: (p: any) => {
      calls.geom.push(p);
      sceneModel.geometries[p.id] = p;
      return {ok: true, value: p};
    },
    createMesh: (p: any) => {
      calls.mesh.push(p);
      return {ok: true, value: p};
    },
    createObject: (p: any) => calls.object.push(p),
    createTexture: () => {},
    createMaterial: (p: any) => {
      calls.material.push(p);
      sceneModel.materials[p.id] = p;
      return {ok: true, value: p};
    },
  };
  return {sceneModel, calls};
}

// XGF carries the full format in one container (header tag 1): base geometry,
// splats, materials, textures, triplanar. (Material/texture-specific coverage
// lives in xgfTriplanar / xgfTextureEncoding.)
describe("xgf", () => {

  it("encodes a SceneModel to a non-empty ArrayBuffer tagged version 1", async () => {
    const {sceneModel} = buildSource([0.2, 0.4, 0.6], 0.6);
    const buffer = await encode({sceneModel} as any, {});

    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(buffer.byteLength).toBeGreaterThan(0);
    // Header: first uint32 (little-endian) is the XGF version tag.
    expect(new DataView(buffer).getUint32(0, true)).toBe(1);
  });

  it("round-trips geometry + object", async () => {
    const {sceneModel} = buildSource([0.2, 0.4, 0.6], 0.6);
    const buffer = await encode({sceneModel} as any, {});

    const {sceneModel: dstScene, calls} = makeCapturingScene();
    await parse({fileData: buffer, sceneModel: dstScene} as any, {});

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

  it("round-trips a Gaussian-splat geometry", async () => {
    const {sceneModel} = buildSplatSource();
    const buffer = await encode({sceneModel} as any, {});

    const {sceneModel: dstScene, calls} = makeCapturingScene();
    await parse({fileData: buffer, sceneModel: dstScene} as any, {});

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

    const buffer = await encode({sceneModel} as any, {});
    const {sceneModel: dstScene, calls} = makeCapturingScene();
    await parse({fileData: buffer, sceneModel: dstScene} as any, {});

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

  describe("XGFExporter", () => {

    // Real Scene/SceneModel here (not the encoder stubs) so the test exercises
    // the exporter end-to-end. The default exporter writes v2; v1 remains
    // explicitly available for compatibility.
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

    it("writes version 2 for a triangle model by default", async () => {
      const buffer = await new XGFExporter().write({sceneModel: realTriangleModel()});
      expect(versionTag(buffer)).toBe(2);
    });

    it("still writes version 1 when requested", async () => {
      const buffer = await new XGFExporter().write({sceneModel: realTriangleModel(), version: "1.0.0"});
      expect(versionTag(buffer)).toBe(1);
    });

    it("writes version 2 for a splat model (splat geometry survives)", async () => {
      const buffer = await new XGFExporter().write({sceneModel: realSplatModel()});
      expect(versionTag(buffer)).toBe(2);
    });

    it("falls back to full v2 output for unsupported assetMode values", async () => {
      const src = realTriangleModel();

      const buffer = await new XGFExporter().write(
        {sceneModel: src},
        {assetMode: "bad-mode"} as any
      );

      expect(versionTag(buffer)).toBe(2);

      const dst = new Scene().createModel({id: "dst"}).value!;
      await new XGFLoader().load({fileData: buffer, sceneModel: dst});

      expect(dst.geometries["t"]).toBeDefined();
      expect(dst.meshes["0"].geometry.id).toBe("t");
      expect(dst.objects["obj"]).toBeDefined();
    });

    it("loads v2 binary string refs when the table starts with a JSON-looking byte", async () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      for (let i = 0; i < 123; i++) {
        const meshId = `mesh-${i}`;
        const objectId = `object-${String(i).padStart(3, "0")}`;
        src.createMesh({id: meshId, geometryId: "shared-geom"});
        src.createObject({id: objectId, meshIds: [meshId]});
      }

      const buffer = await new XGFExporter().write({sceneModel: src});
      const dst = new Scene().createModel({id: "dst"}).value!;

      await expect(new XGFLoader().load({fileData: buffer, sceneModel: dst}))
        .resolves.toBeUndefined();

      expect(Object.keys(dst.objects)).toHaveLength(123);
      expect(dst.objects["object-122"]).toBeDefined();
    });

    it("loads v2 asset-library and references-only chunks into one SceneModel", async () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createMaterial({id: "shared-mat", color: [0.2, 0.4, 0.6]});
      src.createMesh({id: "mesh", geometryId: "shared-geom", materialId: "shared-mat"});
      src.createObject({id: "obj", meshIds: ["mesh"]});

      const exporter = new XGFExporter();
      const assetLibrary = await exporter.write(
        {sceneModel: src},
        {assetMode: "assetLibrary"}
      );
      const referencesOnly = await exporter.write(
        {sceneModel: src},
        {assetMode: "referencesOnly"}
      );

      expect(versionTag(assetLibrary)).toBe(2);
      expect(versionTag(referencesOnly)).toBe(2);

      const dst = new Scene().createModel({id: "dst"}).value!;
      const loader = new XGFLoader();

      await loader.load({fileData: assetLibrary, sceneModel: dst});
      expect(dst.geometries["shared-geom"]).toBeDefined();
      expect(dst.materials["shared-mat"]).toBeDefined();
      expect(Object.keys(dst.meshes)).toHaveLength(0);

      await loader.load({fileData: referencesOnly, sceneModel: dst});
      expect(Object.keys(dst.geometries)).toEqual(["shared-geom"]);
      expect(dst.meshes["0"].geometry.id).toBe("shared-geom");
      expect(dst.meshes["0"].material?.id).toBe("shared-mat");
      expect(dst.objects["obj"]).toBeDefined();
    });

    it("writes an XGF Stream file map through the ModelExporter contract", async () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createMaterial({id: "shared-mat", color: [0.2, 0.4, 0.6]});
      src.createMesh({id: "mesh", geometryId: "shared-geom", materialId: "shared-mat"});
      src.createObject({id: "obj", meshIds: ["mesh"]});

      const output = await new XGFStreamExporter().write(
        {sceneModel: src},
        {
          chunkSize: 1,
          runtimeIndex: "index.runtime.json"
        }
      );

      expect(output.files["index.json"]).toBeDefined();
      expect(output.files["index.runtime.json"]).toBeDefined();
      expect(output.files["chunks/assets.xgf"]).toBeInstanceOf(ArrayBuffer);
      const referencesOnlyChunk = output.index.chunks.find((manifest: any) => manifest.role === "referencesOnly");
      expect(referencesOnlyChunk?.id).toMatch(/^chunk-00000-x[+-]?\d+-y[+-]?\d+-z[+-]?\d+$/);
      expect(output.files[referencesOnlyChunk!.uri]).toBeInstanceOf(ArrayBuffer);
      expect(output.index.chunks.map((manifest: any) => manifest.role).sort()).toEqual(["assetLibrary", "referencesOnly"]);
    });

    it("can localize reused XGF Stream assets instead of creating one shared library", async () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createMaterial({id: "shared-mat", color: [0.2, 0.4, 0.6]});
      src.createMesh({id: "mesh-a", geometryId: "shared-geom", materialId: "shared-mat"});
      src.createMesh({id: "mesh-b", geometryId: "shared-geom", materialId: "shared-mat"});
      src.createObject({id: "obj-a", meshIds: ["mesh-a"]});
      src.createObject({id: "obj-b", meshIds: ["mesh-b"]});

      const output = await new XGFStreamExporter().write(
        {sceneModel: src},
        {
          partition: "object-order",
          chunkSize: 1,
          assetLibraryChunkSize: 1,
          sharedAssetMode: "local"
        }
      );

      const assetLibraries = output.index.chunks
        .filter((manifest: any) => manifest.role === "assetLibrary")
        .map((manifest: any) => manifest.id)
        .sort();
      const referenceChunks = output.index.chunks
        .filter((manifest: any) => manifest.role === "referencesOnly")
        .sort((a: any, b: any) => a.id.localeCompare(b.id));

      expect(assetLibraries).toEqual(["assets-000", "assets-001"]);
      expect(output.files["chunks/assets-shared.xgf"]).toBeUndefined();
      expect(referenceChunks.map((manifest: any) => manifest.dependencies.chunks.map((dependency: any) => dependency.id))).toEqual([
        ["assets-000"],
        ["assets-001"]
      ]);
    });

    it("can shard reused XGF Stream assets into reusable dependency chunks", async () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createMaterial({id: "shared-mat", color: [0.2, 0.4, 0.6]});
      src.createMesh({id: "mesh-a", geometryId: "shared-geom", materialId: "shared-mat"});
      src.createMesh({id: "mesh-b", geometryId: "shared-geom", materialId: "shared-mat"});
      src.createObject({id: "obj-a", meshIds: ["mesh-a"]});
      src.createObject({id: "obj-b", meshIds: ["mesh-b"]});

      const output = await new XGFStreamExporter().write(
        {sceneModel: src},
        {
          partition: "object-order",
          chunkSize: 1,
          assetLibraryChunkSize: 1,
          sharedAssetMode: "sharded",
          sharedAssetShardSize: 1
        }
      );

      const assetLibraries = output.index.chunks
        .filter((manifest: any) => manifest.role === "assetLibrary")
        .map((manifest: any) => manifest.id)
        .sort();
      const referenceChunks = output.index.chunks
        .filter((manifest: any) => manifest.role === "referencesOnly")
        .sort((a: any, b: any) => a.id.localeCompare(b.id));

      expect(assetLibraries).toEqual(["assets-shared-000", "assets-shared-001"]);
      expect(output.files["chunks/assets-shared.xgf"]).toBeUndefined();
      expect(referenceChunks.map((manifest: any) => manifest.dependencies.chunks.map((dependency: any) => dependency.id))).toEqual([
        ["assets-shared-000", "assets-shared-001"],
        ["assets-shared-000", "assets-shared-001"]
      ]);
    });

    it("packs co-used XGF Stream assets into the same shared shard", async () => {
      const src = new Scene().createModel({id: "src"}).value!;
      for (const id of ["g-a", "g-b", "g-c", "g-d", "local"]) {
        src.createGeometry({
          id,
          primitive: TrianglesPrimitive,
          positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
          indices: [0, 1, 2],
        });
      }
      for (const [meshId, geometryId] of [
        ["m0a", "g-a"], ["m0b", "g-b"], ["m0c", "g-c"], ["m0d", "g-d"],
        ["m1", "local"],
        ["m2a", "g-a"], ["m2c", "g-c"],
        ["m3b", "g-b"], ["m3d", "g-d"]
      ]) {
        src.createMesh({id: meshId, geometryId});
      }
      src.createObject({id: "obj-0", meshIds: ["m0a", "m0b", "m0c", "m0d"]});
      src.createObject({id: "obj-1", meshIds: ["m1"]});
      src.createObject({id: "obj-2", meshIds: ["m2a", "m2c"]});
      src.createObject({id: "obj-3", meshIds: ["m3b", "m3d"]});

      const output = await new XGFStreamExporter().write(
        {sceneModel: src},
        {
          partition: "object-order",
          chunkSize: 1,
          assetLibraryChunkSize: 1,
          sharedAssetMode: "sharded",
          sharedAssetShardSize: 2
        }
      );

      const chunkById = new Map(output.index.chunks.map((manifest: any) => [manifest.id, manifest]));
      expect(chunkById.get("assets-shared-000")?.assets.geometries).toEqual(["g-a", "g-c"]);
      expect(chunkById.get("assets-shared-001")?.assets.geometries).toEqual(["g-b", "g-d"]);

      const referenceChunks = output.index.chunks
        .filter((manifest: any) => manifest.role === "referencesOnly")
        .sort((a: any, b: any) => a.id.localeCompare(b.id));
      expect(referenceChunks.map((manifest: any) => manifest.dependencies.chunks.map((dependency: any) => dependency.id))).toEqual([
        ["assets-shared-000", "assets-shared-001"],
        ["assets-001"],
        ["assets-shared-000"],
        ["assets-shared-001"]
      ]);
    });

    it("creates v2 asset-library chunk manifests", () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createMaterial({id: "shared-mat", color: [0.2, 0.4, 0.6]});
      src.createMesh({id: "mesh", geometryId: "shared-geom", materialId: "shared-mat"});
      src.createObject({id: "obj", meshIds: ["mesh"]});

      const manifest = createXGFManifest(
        {sceneModel: src},
        {id: "lib-a", uri: "lib-a.xgf", assetMode: "assetLibrary", priority: 5}
      );

      expect(manifest).toMatchObject({
        format: "XGF",
        manifestVersion: "1.0.0",
        xgfVersion: "2.0.0",
        id: "lib-a",
        uri: "lib-a.xgf",
        role: "assetLibrary",
        priority: 5,
        assets: {
          geometries: ["shared-geom"],
          materials: ["shared-mat"],
          textures: []
        },
        dependencies: {
          chunks: [],
          geometries: [],
          materials: [],
          textures: []
        },
        counts: {
          transforms: 0,
          geometries: 1,
          materials: 1,
          textures: 0,
          meshes: 0,
          objects: 0
        }
      });
      expect(manifest.aabb).toEqual([0, 0, 0, 1, 1, 0]);
    });

    it("creates v2 references-only chunk manifests with asset dependencies and bounds", () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createMaterial({id: "shared-mat", color: [0.2, 0.4, 0.6]});
      src.createMesh({
        id: "mesh",
        geometryId: "shared-geom",
        materialId: "shared-mat",
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 6, 7, 1] as any,
      });
      src.createObject({id: "obj", meshIds: ["mesh"]});

      const manifest = createXGFManifest(
        {sceneModel: src},
        {
          id: "tile-a",
          uri: "tile-a.xgf",
          assetMode: "referencesOnly",
          dependencies: [{id: "lib-a", uri: "lib-a.xgf"}],
          lod: 2
        }
      );

      expect(manifest).toMatchObject({
        id: "tile-a",
        uri: "tile-a.xgf",
        role: "referencesOnly",
        lod: 2,
        assets: {
          geometries: [],
          materials: [],
          textures: []
        },
        dependencies: {
          chunks: [{id: "lib-a", uri: "lib-a.xgf"}],
          geometries: ["shared-geom"],
          materials: ["shared-mat"],
          textures: []
        },
        counts: {
          transforms: 0,
          geometries: 0,
          materials: 0,
          textures: 0,
          meshes: 1,
          objects: 1
        }
      });
      expect(manifest.aabb).toEqual([5, 6, 7, 6, 7, 7]);
    });

    it("writes and reads v2 chunk manifest JSON", () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createMesh({id: "mesh", geometryId: "shared-geom"});
      src.createObject({id: "obj", meshIds: ["mesh"]});

      const manifest = createXGFManifest(
        {sceneModel: src},
        {
          id: "tile-a",
          uri: "tile-a.xgf",
          assetMode: "referencesOnly",
          dependencies: [{id: "lib-a"}],
          priority: 3,
          lod: "medium"
        }
      );
      const json = writeXGFChunkManifest(manifest);
      manifest.dependencies.chunks.push({id: "later"});

      const result = readXGFChunkManifest(json);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toMatchObject({
          id: "tile-a",
          uri: "tile-a.xgf",
          role: "referencesOnly",
          priority: 3,
          lod: "medium",
          dependencies: {
            chunks: [{id: "lib-a"}],
            geometries: ["shared-geom"],
            materials: [],
            textures: []
          }
        });
      }
    });

    it("rejects invalid v2 chunk manifest JSON", () => {
      const result = readXGFChunkManifest({
        format: "XGF",
        manifestVersion: "1.0.0",
        xgfVersion: "2.0.0",
        id: "tile-a",
        role: "referencesOnly",
        dependencies: {
          chunks: [{id: "lib-a"}],
          geometries: ["shared-geom"],
          materials: [],
          textures: []
        },
        assets: {
          geometries: [],
          materials: [],
          textures: []
        },
        counts: {
          transforms: 0,
          geometries: 0,
          materials: 0,
          textures: 0,
          meshes: -1,
          objects: 1
        }
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.type).toBe(SDKErrorType.InvalidInput);
        expect(result.error).toContain("meshes must be a non-negative integer");
      }
    });

    it("writes and reads v2 streaming index JSON", () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createMesh({id: "mesh", geometryId: "shared-geom"});
      src.createObject({id: "obj", meshIds: ["mesh"]});

      const exporter = new XGFExporter();
      const libraryManifest = createXGFManifest(
        {sceneModel: src},
        {id: "lib-a", uri: "lib-a.xgf", assetMode: "assetLibrary"}
      );
      const chunkManifest = createXGFManifest(
        {sceneModel: src},
        {
          id: "tile-a",
          uri: "tile-a.xgf",
          assetMode: "referencesOnly",
          dependencies: [{id: "lib-a"}],
          lod: 1
        }
      );
      const index = {
        format: "XGFStreamingIndex" as const,
        indexVersion: "1.0.0" as const,
        chunks: [libraryManifest, chunkManifest],
        rootChunkIds: ["tile-a"],
        aabb: [0, 0, 0, 1, 1, 0],
        metadata: {name: "test-index"}
      };
      const json = writeXGFStreamingIndex(index);
      index.chunks.length = 0;

      const result = readXGFStreamingIndex(json);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.chunks.map(chunk => chunk.id)).toEqual(["lib-a", "tile-a"]);
        expect(result.value.rootChunkIds).toEqual(["tile-a"]);
        expect(result.value.metadata).toEqual({name: "test-index"});
      }
    });

    it("writes and reads compact v2 runtime streaming indexes", () => {
      const exporter = new XGFExporter();
      const libraryManifest = createXGFManifest(
        {sceneModel: realTriangleModel()},
        {id: "lib-a", uri: "lib-a.xgf", assetMode: "assetLibrary"}
      );
      const chunkManifest = createXGFManifest(
        {sceneModel: realTriangleModel()},
        {
          id: "tile-a",
          uri: "tile-a.xgf",
          assetMode: "referencesOnly",
          dependencies: [{id: "lib-a", uri: "lib-a.xgf"}],
          priority: 7,
          lod: "fine"
        }
      );
      const runtime = writeXGFStreamingRuntimeIndex({
        format: "XGFStreamingIndex",
        indexVersion: "1.0.0",
        chunks: [libraryManifest, chunkManifest],
        rootChunkIds: ["tile-a"],
        aabb: [0, 0, 0, 1, 1, 1]
      });

      expect(runtime.format).toBe("XGFStreamingRuntimeIndex");
      expect(runtime.indexVersion).toBe("1.1.0");
      expect(runtime.roles).toBeUndefined();
      expect(runtime.counts).toBeUndefined();
      expect(runtime.strings).toEqual(expect.arrayContaining(["lib-a", "lib-a.xgf", "tile-a", "tile-a.xgf"]));
      expect(typeof runtime.chunks[1][0]).toBe("number");
      expect(runtime.chunks[1][3]).toEqual([[0, 1]]);
      expect(runtime.root).toEqual([2]);
      expect(runtime.aabbQuantization).toBeDefined();

      const result = readXGFStreamingRuntimeIndex(runtime);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.rootChunkIds).toEqual(["tile-a"]);
        expect(result.value.chunks[1].id).toBe("tile-a");
        expect(result.value.chunks[1].uri).toBe("tile-a.xgf");
        expect(result.value.chunks[1].dependencies.chunks).toEqual([{id: "lib-a", uri: "lib-a.xgf"}]);
        expect(result.value.chunks[1].priority).toBe(7);
        expect(result.value.chunks[1].lod).toBe("fine");
        expect(result.value.chunks[1].assets.geometries).toEqual([]);
      }
    });

    it("reads legacy compact runtime streaming indexes", () => {
      const result = readXGFStreamingRuntimeIndex({
        format: "XGFStreamingRuntimeIndex",
        indexVersion: "1.0.0",
        roles: ["full", "assetLibrary", "referencesOnly"],
        counts: ["transforms", "geometries", "materials", "textures", "meshes", "objects"],
        root: ["tile-a"],
        aabb: [0, 0, 0, 1, 1, 1],
        chunks: [
          ["lib-a", "lib-a.xgf", 1, [], null, [0, 1, 0, 0, 0, 0]],
          ["tile-a", "tile-a.xgf", 2, [["lib-a", "lib-a.xgf"]], [0, 0, 0, 1, 1, 1], [0, 0, 0, 0, 0, 1], 7, "fine"]
        ]
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.rootChunkIds).toEqual(["tile-a"]);
        expect(result.value.chunks[1].dependencies.chunks).toEqual([{id: "lib-a", uri: "lib-a.xgf"}]);
        expect(result.value.chunks[1].priority).toBe(7);
        expect(result.value.chunks[1].lod).toBe("fine");
      }
    });

    it("rejects invalid v2 streaming index JSON", () => {
      const manifest = createXGFManifest(
        {sceneModel: realTriangleModel()},
        {id: "tile-a", assetMode: "full"}
      );

      const result = readXGFStreamingIndex({
        format: "XGFStreamingIndex",
        indexVersion: "1.0.0",
        chunks: [manifest],
        rootChunkIds: ["missing-tile"]
      });

      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.type).toBe(SDKErrorType.InvalidInput);
        expect(result.error).toContain("rootChunkIds references missing chunk 'missing-tile'");
      }
    });

    it("creates lookup maps for v2 streaming indexes", () => {
      const exporter = new XGFExporter();
      const libraryManifest = createXGFManifest(
        {sceneModel: realTriangleModel()},
        {id: "lib-a", uri: "lib-a.xgf", assetMode: "assetLibrary"}
      );
      const chunkManifest = createXGFManifest(
        {sceneModel: realTriangleModel()},
        {id: "tile-a", uri: "tile-a.xgf", assetMode: "full"}
      );

      const lookup = createXGFStreamingIndexLookup({
        format: "XGFStreamingIndex",
        indexVersion: "1.0.0",
        chunks: [libraryManifest, chunkManifest]
      });

      expect(lookup.byId["lib-a"]).toBe(libraryManifest);
      expect(lookup.byUri["tile-a.xgf"]).toBe(chunkManifest);
      expect(lookup.get({id: "lib-a"})).toBe(libraryManifest);
      expect(lookup.get({uri: "tile-a.xgf"})).toBe(chunkManifest);
    });

    it("loads v2 streaming chunks after declared dependency chunks", async () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createMaterial({id: "shared-mat", color: [0.2, 0.4, 0.6]});
      src.createMesh({id: "mesh", geometryId: "shared-geom", materialId: "shared-mat"});
      src.createObject({id: "obj", meshIds: ["mesh"]});

      const exporter = new XGFExporter();
      const assetLibrary = await exporter.write({sceneModel: src}, {assetMode: "assetLibrary"});
      const referencesOnly = await exporter.write({sceneModel: src}, {assetMode: "referencesOnly"});
      const libraryManifest = createXGFManifest(
        {sceneModel: src},
        {id: "lib-a", uri: "lib-a.xgf", assetMode: "assetLibrary"}
      );
      const chunkManifest = createXGFManifest(
        {sceneModel: src},
        {
          id: "tile-a",
          uri: "tile-a.xgf",
          assetMode: "referencesOnly",
          dependencies: [{id: "lib-a", uri: "lib-a.xgf"}]
        }
      );

      const scene = new Scene();
      const dst = scene.createModel({id: "dst", lifecycle: "streaming", memoryPolicy: "compact"}).value!;
      const batchEvents: string[] = [];
      scene.events.onSceneModelBatchCommitted.subscribe((sceneModel, batch) => {
        if (sceneModel === dst) {
          batchEvents.push(batch.id);
        }
      });
      const loadedChunks: string[] = [];
      await new XGFStreamingLoader().loadChunk(
        {manifest: chunkManifest, fileData: referencesOnly, sceneModel: dst},
        {
          manifests: [libraryManifest],
          fileDataByChunkId: {"lib-a": assetLibrary},
          onChunkLoaded: manifest => loadedChunks.push(manifest.id)
        }
      );

      expect(loadedChunks).toEqual(["lib-a", "tile-a"]);
      expect(batchEvents).toEqual([]);
      expect(dst.activeBatch).toBeNull();
      expect(dst.geometries["shared-geom"]).toBeDefined();
      expect(dst.materials["shared-mat"]).toBeDefined();
      expect(dst.objects["obj"]).toBeDefined();
      expect(dst.objects["obj"].meshes[0].id).toBe("tile-a/mesh/0");
      expect(dst.objects["obj"].meshes[0].geometry.id).toBe("shared-geom");
    });

    it("loads v2 streaming chunks through an indexed manifest lookup", async () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createMesh({id: "mesh", geometryId: "shared-geom"});
      src.createObject({id: "obj", meshIds: ["mesh"]});

      const exporter = new XGFExporter();
      const assetLibrary = await exporter.write({sceneModel: src}, {assetMode: "assetLibrary"});
      const referencesOnly = await exporter.write({sceneModel: src}, {assetMode: "referencesOnly"});
      const libraryManifest = createXGFManifest(
        {sceneModel: src},
        {id: "lib-a", uri: "lib-a.xgf", assetMode: "assetLibrary"}
      );
      const chunkManifest = createXGFManifest(
        {sceneModel: src},
        {
          id: "tile-a",
          uri: "tile-a.xgf",
          assetMode: "referencesOnly",
          dependencies: [{id: "lib-a"}]
        }
      );
      const lookup = createXGFStreamingIndexLookup({
        format: "XGFStreamingIndex",
        indexVersion: "1.0.0",
        chunks: [libraryManifest, chunkManifest]
      });

      const dst = new Scene().createModel({id: "dst"}).value!;
      await new XGFStreamingLoader().loadChunk(
        {manifest: chunkManifest, fileData: referencesOnly, sceneModel: dst},
        {
          manifests: lookup,
          fileDataByChunkId: {"lib-a": assetLibrary}
        }
      );

      expect(dst.geometries["shared-geom"]).toBeDefined();
      expect(dst.objects["obj"]).toBeDefined();
      expect(dst.objects["obj"].meshes[0].id).toBe("tile-a/mesh/0");
      expect(dst.objects["obj"].meshes[0].geometry.id).toBe("shared-geom");
    });

    it("exports v2 streaming chunks with object-derived and explicit library asset IDs", async () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createGeometry({
        id: "extra-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 2, 0, 0, 0, 2, 0],
        indices: [0, 1, 2],
      });
      src.createMaterial({id: "shared-mat", color: [0.2, 0.4, 0.6]});
      src.createMaterial({id: "extra-mat", color: [0.8, 0.7, 0.1]});
      src.createMesh({id: "mesh", geometryId: "shared-geom", materialId: "shared-mat"});
      src.createObject({id: "obj", meshIds: ["mesh"]});

      const exportResult = await new XGFStreamingExporter().write({
        sceneModel: src,
        assetLibraries: [{
          id: "lib-a",
          uri: "lib-a.xgf",
          objectIds: ["obj"],
          geometryIds: ["extra-geom"],
          materialIds: ["extra-mat"]
        }],
        chunks: [{
          id: "tile-a",
          uri: "tile-a.xgf",
          objectIds: ["obj"],
          assetLibraryIds: ["lib-a"]
        }],
        indexUri: "scene.index.json",
        runtimeIndexUri: "scene.runtime.json"
      });

      expect(exportResult.ok).toBe(true);
      if (exportResult.ok === false) {
        return;
      }

      const {files, index, manifests} = exportResult.value;
      expect(Object.keys(files).sort()).toEqual([
        "lib-a.xgf",
        "scene.index.json",
        "scene.runtime.json",
        "tile-a.xgf"
      ]);
      expect(index.rootChunkIds).toEqual(["tile-a"]);

      const libraryManifest = manifests.find(manifest => manifest.id === "lib-a")!;
      const chunkManifest = manifests.find(manifest => manifest.id === "tile-a")!;
      expect(libraryManifest.role).toBe("assetLibrary");
      expect(libraryManifest.assets.geometries).toEqual(expect.arrayContaining(["shared-geom", "extra-geom"]));
      expect(libraryManifest.assets.materials).toEqual(expect.arrayContaining(["shared-mat", "extra-mat"]));
      expect(chunkManifest.role).toBe("referencesOnly");
      expect(chunkManifest.dependencies.chunks).toEqual([{id: "lib-a", uri: "lib-a.xgf"}]);
      expect(chunkManifest.dependencies.geometries).toEqual(["shared-geom"]);
      expect(chunkManifest.dependencies.materials).toEqual(["shared-mat"]);

      const dst = new Scene().createModel({id: "dst"}).value!;
      await new XGFStreamingLoader().loadChunk(
        {
          manifest: chunkManifest,
          fileData: files["tile-a.xgf"] as ArrayBuffer,
          sceneModel: dst
        },
        {
          manifests: createXGFStreamingIndexLookup(index),
          fileDataByChunkId: {"lib-a": files["lib-a.xgf"] as ArrayBuffer}
        }
      );

      expect(dst.geometries["shared-geom"]).toBeDefined();
      expect(dst.geometries["extra-geom"]).toBeDefined();
      expect(dst.materials["shared-mat"]).toBeDefined();
      expect(dst.materials["extra-mat"]).toBeDefined();
      expect(dst.objects["obj"]).toBeDefined();
      expect(dst.objects["obj"].meshes[0].id).toBe("tile-a/mesh/0");
      expect(dst.objects["obj"].meshes[0].geometry.id).toBe("shared-geom");
      expect(dst.objects["obj"].meshes[0].material?.id).toBe("shared-mat");

      const runtimeIndexResult = readXGFStreamingRuntimeIndex(files["scene.runtime.json"]);
      expect(runtimeIndexResult.ok).toBe(true);
      if (runtimeIndexResult.ok === false) {
        return;
      }
      const runtimeChunkManifest = runtimeIndexResult.value.chunks.find(manifest => manifest.id === "tile-a")!;
      expect(runtimeChunkManifest.dependencies.geometries).toEqual([]);
      const runtimeDst = new Scene().createModel({id: "runtime-dst"}).value!;
      await new XGFStreamingLoader().loadChunk(
        {
          manifest: runtimeChunkManifest,
          fileData: files["tile-a.xgf"] as ArrayBuffer,
          sceneModel: runtimeDst
        },
        {
          manifests: createXGFStreamingIndexLookup(runtimeIndexResult.value),
          fileDataByChunkId: {"lib-a": files["lib-a.xgf"] as ArrayBuffer}
        }
      );

      expect(runtimeDst.geometries["shared-geom"]).toBeDefined();
      expect(runtimeDst.geometries["extra-geom"]).toBeDefined();
      expect(runtimeDst.objects["obj"]).toBeDefined();
      expect(runtimeDst.objects["obj"].meshes[0].id).toBe("tile-a/mesh/0");
    });

    it("loads multiple v2 references-only chunks without mesh id collisions", async () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createMaterial({id: "shared-mat", color: [0.2, 0.4, 0.6]});
      src.createMesh({id: "mesh-a", geometryId: "shared-geom", materialId: "shared-mat"});
      src.createObject({id: "obj-a", meshIds: ["mesh-a"]});
      src.createMesh({
        id: "mesh-b",
        geometryId: "shared-geom",
        materialId: "shared-mat",
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 0, 0, 1] as any
      });
      src.createObject({id: "obj-b", meshIds: ["mesh-b"]});

      const exportResult = await new XGFStreamingExporter().write({
        sceneModel: src,
        assetLibraries: [{
          id: "lib-a",
          uri: "lib-a.xgf",
          objectIds: ["obj-a"]
        }],
        chunks: [
          {id: "tile-a", uri: "tile-a.xgf", objectIds: ["obj-a"], assetLibraryIds: ["lib-a"]},
          {id: "tile-b", uri: "tile-b.xgf", objectIds: ["obj-b"], assetLibraryIds: ["lib-a"]}
        ]
      });

      expect(exportResult.ok).toBe(true);
      if (exportResult.ok === false) {
        return;
      }

      const {files, index, manifests} = exportResult.value;
      const tileA = manifests.find(manifest => manifest.id === "tile-a")!;
      const tileB = manifests.find(manifest => manifest.id === "tile-b")!;
      const dst = new Scene().createModel({id: "dst"}).value!;
      const loader = new XGFStreamingLoader();
      const options = {
        manifests: createXGFStreamingIndexLookup(index),
        fileDataByChunkId: {"lib-a": files["lib-a.xgf"] as ArrayBuffer}
      };

      await loader.loadChunk({manifest: tileA, fileData: files["tile-a.xgf"] as ArrayBuffer, sceneModel: dst}, options);
      await loader.loadChunk({manifest: tileB, fileData: files["tile-b.xgf"] as ArrayBuffer, sceneModel: dst}, options);

      expect(Object.keys(dst.meshes).sort()).toEqual(["tile-a/mesh/0", "tile-b/mesh/0"]);
      expect(dst.objects["obj-a"]).toBeDefined();
      expect(dst.objects["obj-b"]).toBeDefined();
      expect(dst.objects["obj-a"].meshes[0]).toBe(dst.meshes["tile-a/mesh/0"]);
      expect(dst.objects["obj-b"].meshes[0]).toBe(dst.meshes["tile-b/mesh/0"]);
    });

    it("batch-loads v2 chunks with shared dependency fetches de-duplicated", async () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createMaterial({id: "shared-mat", color: [0.2, 0.4, 0.6]});
      src.createMesh({id: "mesh-a", geometryId: "shared-geom", materialId: "shared-mat"});
      src.createObject({id: "obj-a", meshIds: ["mesh-a"]});
      src.createMesh({
        id: "mesh-b",
        geometryId: "shared-geom",
        materialId: "shared-mat",
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 0, 0, 1] as any
      });
      src.createObject({id: "obj-b", meshIds: ["mesh-b"]});

      const exportResult = await new XGFStreamingExporter().write({
        sceneModel: src,
        assetLibraries: [{
          id: "lib-a",
          uri: "lib-a.xgf",
          objectIds: ["obj-a"]
        }],
        chunks: [
          {id: "tile-a", uri: "tile-a.xgf", objectIds: ["obj-a"], assetLibraryIds: ["lib-a"]},
          {id: "tile-b", uri: "tile-b.xgf", objectIds: ["obj-b"], assetLibraryIds: ["lib-a"]}
        ]
      });

      expect(exportResult.ok).toBe(true);
      if (exportResult.ok === false) {
        return;
      }

      const {files, index, manifests} = exportResult.value;
      const fetched: string[] = [];
      const loaded: string[] = [];
      const dst = new Scene().createModel({id: "dst"}).value!;
      const loader = new XGFStreamingLoader();
      await loader.loadChunks(
        {
          manifests: manifests.filter(manifest => manifest.role === "referencesOnly"),
          sceneModel: dst
        },
        {
          manifests: createXGFStreamingIndexLookup(index),
          fetchConcurrency: 2,
          getFileData: async (manifest) => {
            fetched.push(manifest.id);
            return files[manifest.uri!] as ArrayBuffer;
          },
          onChunkLoaded: (manifest) => {
            loaded.push(manifest.id);
          }
        }
      );

      expect(fetched.sort()).toEqual(["lib-a", "tile-a", "tile-b"]);
      expect(loaded).toEqual(["lib-a", "tile-a", "tile-b"]);
      expect(Object.keys(dst.meshes).sort()).toEqual(["tile-a/mesh/0", "tile-b/mesh/0"]);
      expect(dst.objects["obj-a"]).toBeDefined();
      expect(dst.objects["obj-b"]).toBeDefined();
      expect(dst.geometries["shared-geom"]).toBeDefined();
    });

    it("does not fetch file data for already-loaded v2 dependencies", async () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createMaterial({id: "shared-mat", color: [0.2, 0.4, 0.6]});
      src.createMesh({id: "mesh", geometryId: "shared-geom", materialId: "shared-mat"});
      src.createObject({id: "obj", meshIds: ["mesh"]});

      const exportResult = await new XGFStreamingExporter().write({
        sceneModel: src,
        assetLibraries: [{
          id: "lib-a",
          uri: "lib-a.xgf",
          objectIds: ["obj"]
        }],
        chunks: [{
          id: "tile-a",
          uri: "tile-a.xgf",
          objectIds: ["obj"],
          assetLibraryIds: ["lib-a"]
        }]
      });

      expect(exportResult.ok).toBe(true);
      if (exportResult.ok === false) {
        return;
      }

      const {files, index, manifests} = exportResult.value;
      const library = manifests.find(manifest => manifest.id === "lib-a")!;
      const tile = manifests.find(manifest => manifest.id === "tile-a")!;
      const dst = new Scene().createModel({id: "dst"}).value!;
      const loader = new XGFStreamingLoader();
      const options = {
        manifests: createXGFStreamingIndexLookup(index),
        getFileData: async (manifest: any) => {
          throw new Error(`unexpected dependency fetch for ${manifest.id}`);
        }
      };

      await loader.loadChunk({manifest: library, fileData: files["lib-a.xgf"] as ArrayBuffer, sceneModel: dst}, options);
      await loader.loadChunk({manifest: tile, fileData: files["tile-a.xgf"] as ArrayBuffer, sceneModel: dst}, options);

      expect(dst.objects["obj"]).toBeDefined();
      expect(dst.geometries["shared-geom"]).toBeDefined();
    });

    it("coalesces concurrent loads of the same v2 streaming chunk", async () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createMaterial({id: "shared-mat", color: [0.2, 0.4, 0.6]});
      src.createMesh({id: "mesh", geometryId: "shared-geom", materialId: "shared-mat"});
      src.createObject({id: "obj", meshIds: ["mesh"]});

      const exportResult = await new XGFStreamingExporter().write({
        sceneModel: src,
        assetLibraries: [{
          id: "lib-a",
          uri: "lib-a.xgf",
          objectIds: ["obj"]
        }],
        chunks: [{
          id: "tile-a",
          uri: "tile-a.xgf",
          objectIds: ["obj"],
          assetLibraryIds: ["lib-a"]
        }]
      });

      expect(exportResult.ok).toBe(true);
      if (exportResult.ok === false) {
        return;
      }

      const {files, index, manifests} = exportResult.value;
      const tile = manifests.find(manifest => manifest.id === "tile-a")!;
      const scene = new Scene();
      const errors: any[] = [];
      scene.events.onError.subscribe((_scene, error) => errors.push(error));
      const dst = scene.createModel({id: "dst"}).value!;
      const fetched: string[] = [];
      const loaded: string[] = [];
      const loader = new XGFStreamingLoader();
      const options = {
        manifests: createXGFStreamingIndexLookup(index),
        getFileData: async (manifest: any) => {
          fetched.push(manifest.id);
          await new Promise(resolve => setTimeout(resolve, 5));
          return files[manifest.uri] as ArrayBuffer;
        },
        onChunkLoaded: (manifest: any) => loaded.push(manifest.id)
      };

      await Promise.all([
        loader.loadChunk({manifest: tile, sceneModel: dst}, options),
        loader.loadChunk({manifest: tile, sceneModel: dst}, options)
      ]);

      expect(fetched.sort()).toEqual(["lib-a", "tile-a"]);
      expect(loaded).toEqual(["lib-a", "tile-a"]);
      expect(errors).toHaveLength(0);
      expect(Object.keys(dst.meshes)).toEqual(["tile-a/mesh/0"]);
      expect(dst.objects["obj"]).toBeDefined();
      expect(dst.objects["obj"].meshes[0]).toBe(dst.meshes["tile-a/mesh/0"]);
    });

    it("serializes concurrent v2 streaming chunk applies into one SceneModel", async () => {
      const scene = new Scene();
      const errors: any[] = [];
      scene.events.onError.subscribe((_scene, error) => errors.push(error));
      const dst = scene.createModel({id: "dst"}).value!;
      dst.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });

      const xgfLoader = {
        load: async ({sceneModel}: any) => {
          let nextMeshId = 0;
          while (sceneModel.meshes[`${nextMeshId}`]) {
            nextMeshId++;
          }
          await new Promise(resolve => setTimeout(resolve, 5));
          const meshId = `${nextMeshId}`;
          sceneModel.createMesh({id: meshId, geometryId: "shared-geom"});
          sceneModel.createObject({id: `obj-${meshId}`, meshIds: [meshId]});
        }
      };
      const loader = new XGFStreamingLoader({xgfLoader: xgfLoader as any});
      const batchEvents: string[] = [];
      scene.events.onSceneModelBatchCommitted.subscribe((sceneModel, batch) => {
        if (sceneModel === dst) {
          batchEvents.push(batch.id);
        }
      });
      const manifestA = createXGFManifest(
        {sceneModel: dst},
        {id: "tile-a", uri: "tile-a.xgf", assetMode: "full"}
      );
      const manifestB = createXGFManifest(
        {sceneModel: dst},
        {id: "tile-b", uri: "tile-b.xgf", assetMode: "full"}
      );
      const fileData = new ArrayBuffer(1);

      await Promise.all([
        loader.loadChunk({manifest: manifestA, fileData, sceneModel: dst}),
        loader.loadChunk({manifest: manifestB, fileData, sceneModel: dst})
      ]);

      expect(errors).toHaveLength(0);
      expect(batchEvents).toEqual([]);
      expect(dst.activeBatch).toBeNull();
      expect(Object.keys(dst.meshes).sort()).toEqual(["0", "1"]);
      expect(dst.objects["obj-0"]).toBeDefined();
      expect(dst.objects["obj-1"]).toBeDefined();
    });

    it("removes created XGF stream chunk content when apply fails", async () => {
      const scene = new Scene();
      const errors: any[] = [];
      scene.events.onError.subscribe((_scene, error) => errors.push(error));
      const dst = scene.createModel({id: "dst", lifecycle: "streaming", memoryPolicy: "compact"}).value!;
      const batchEvents: string[] = [];
      scene.events.onSceneModelBatchCommitted.subscribe((sceneModel, batch) => {
        if (sceneModel === dst) {
          batchEvents.push(batch.id);
        }
      });
      const xgfLoader = {
        load: async ({sceneModel}: any, options: any) => {
          sceneModel.createGeometry({
            id: "temp-geom",
            primitive: TrianglesPrimitive,
            positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
            indices: [0, 1, 2],
          });
          options.createdIds?.geometries.push("temp-geom");
          throw new Error("synthetic chunk failure");
        }
      };
      const manifest = createXGFManifest(
        {sceneModel: dst},
        {id: "tile-fail", uri: "tile-fail.xgf", assetMode: "full"}
      );

      await new XGFStreamingLoader({xgfLoader: xgfLoader as any})
        .loadChunk({manifest, fileData: new ArrayBuffer(1), sceneModel: dst});

      expect(dst.activeBatch).toBeNull();
      expect(batchEvents).toEqual([]);
      expect(dst.geometries["temp-geom"]).toBeUndefined();
      expect(errors[0].error).toContain("synthetic chunk failure");
    });

    it("unloads v2 references-only chunks without destroying shared assets", async () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createMaterial({id: "shared-mat", color: [0.2, 0.4, 0.6]});
      src.createMesh({id: "mesh", geometryId: "shared-geom", materialId: "shared-mat"});
      src.createObject({id: "obj", meshIds: ["mesh"]});

      const exporter = new XGFExporter();
      const assetLibrary = await exporter.write({sceneModel: src}, {assetMode: "assetLibrary"});
      const referencesOnly = await exporter.write({sceneModel: src}, {assetMode: "referencesOnly"});
      const libraryManifest = createXGFManifest(
        {sceneModel: src},
        {id: "lib-a", uri: "lib-a.xgf", assetMode: "assetLibrary"}
      );
      const chunkManifest = createXGFManifest(
        {sceneModel: src},
        {
          id: "tile-a",
          uri: "tile-a.xgf",
          assetMode: "referencesOnly",
          dependencies: [{id: "lib-a", uri: "lib-a.xgf"}]
        }
      );

      const dst = new Scene().createModel({id: "dst"}).value!;
      const loader = new XGFStreamingLoader();
      await loader.loadChunk(
        {manifest: chunkManifest, fileData: referencesOnly, sceneModel: dst},
        {
          manifests: [libraryManifest],
          fileDataByChunkId: {"lib-a": assetLibrary}
        }
      );

      const unloadResult = loader.unloadChunk({sceneModel: dst, chunkId: "tile-a"});

      expect(unloadResult.ok).toBe(true);
      expect(dst.geometries["shared-geom"]).toBeDefined();
      expect(dst.materials["shared-mat"]).toBeDefined();
      expect(Object.keys(dst.meshes)).toHaveLength(0);
      expect(Object.keys(dst.objects)).toHaveLength(0);
    });

    it("refuses to unload v2 asset libraries while loaded chunks reference them", async () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createMaterial({id: "shared-mat", color: [0.2, 0.4, 0.6]});
      src.createMesh({id: "mesh", geometryId: "shared-geom", materialId: "shared-mat"});
      src.createObject({id: "obj", meshIds: ["mesh"]});

      const exporter = new XGFExporter();
      const assetLibrary = await exporter.write({sceneModel: src}, {assetMode: "assetLibrary"});
      const referencesOnly = await exporter.write({sceneModel: src}, {assetMode: "referencesOnly"});
      const libraryManifest = createXGFManifest(
        {sceneModel: src},
        {id: "lib-a", uri: "lib-a.xgf", assetMode: "assetLibrary"}
      );
      const chunkManifest = createXGFManifest(
        {sceneModel: src},
        {
          id: "tile-a",
          uri: "tile-a.xgf",
          assetMode: "referencesOnly",
          dependencies: [{id: "lib-a", uri: "lib-a.xgf"}]
        }
      );

      const scene = new Scene();
      const errors: any[] = [];
      scene.events.onError.subscribe((_scene, error) => errors.push(error));
      const dst = scene.createModel({id: "dst"}).value!;
      const loader = new XGFStreamingLoader();
      await loader.loadChunk(
        {manifest: chunkManifest, fileData: referencesOnly, sceneModel: dst},
        {
          manifests: [libraryManifest],
          fileDataByChunkId: {"lib-a": assetLibrary}
        }
      );

      const blocked = loader.unloadChunk({sceneModel: dst, chunkId: "lib-a"});
      expect(blocked.ok).toBe(false);
      if (blocked.ok === false) {
        expect(blocked.type).toBe(SDKErrorType.InvalidOperation);
        expect(blocked.error).toContain("geometry:shared-geom");
      }
      expect(dst.geometries["shared-geom"]).toBeDefined();

      expect(loader.unloadChunk({sceneModel: dst, chunkId: "tile-a"}).ok).toBe(true);
      expect(loader.unloadChunk({sceneModel: dst, chunkId: "lib-a"}).ok).toBe(true);
      expect(dst.geometries["shared-geom"]).toBeUndefined();
      expect(dst.materials["shared-mat"]).toBeUndefined();
      expect(errors).toHaveLength(1);
    });

    it("logs invalid input when a streaming chunk dependency cannot be resolved", async () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createMesh({id: "mesh", geometryId: "shared-geom"});
      src.createObject({id: "obj", meshIds: ["mesh"]});

      const exporter = new XGFExporter();
      const referencesOnly = await exporter.write({sceneModel: src}, {assetMode: "referencesOnly"});
      const chunkManifest = createXGFManifest(
        {sceneModel: src},
        {
          id: "tile-a",
          assetMode: "referencesOnly",
          dependencies: [{id: "missing-lib"}]
        }
      );

      const scene = new Scene();
      const errors: any[] = [];
      scene.events.onError.subscribe((_scene, error) => errors.push(error));
      const dst = scene.createModel({id: "dst"}).value!;

      await expect(new XGFStreamingLoader().loadChunk(
        {manifest: chunkManifest, fileData: referencesOnly, sceneModel: dst}
      )).resolves.toBeUndefined();

      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe(SDKErrorType.InvalidInput);
      expect(errors[0].error).toContain("Dependency chunk manifest not found");
      expect(Object.keys(dst.meshes)).toHaveLength(0);
    });

    it("logs invalid input instead of throwing when a v2 mesh references a missing geometry", async () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createMesh({id: "mesh", geometryId: "shared-geom"});
      src.createObject({id: "obj", meshIds: ["mesh"]});

      const referencesOnly = await new XGFExporter().write(
        {sceneModel: src},
        {assetMode: "referencesOnly"}
      );

      const scene = new Scene();
      const errors: any[] = [];
      scene.events.onError.subscribe((_scene, error) => errors.push(error));
      const dst = scene.createModel({id: "dst"}).value!;

      await expect(new XGFLoader().load({fileData: referencesOnly, sceneModel: dst}))
        .resolves.toBeUndefined();

      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe(SDKErrorType.InvalidInput);
      expect(errors[0].error).toContain("references missing geometry 'shared-geom'");
      expect(Object.keys(dst.meshes)).toHaveLength(0);
      expect(dst.objects["obj"]).toBeUndefined();
    });

    it("round-trips v2 SceneTransform hierarchies and mesh parent links", async () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "g",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createTransform({
        id: "root",
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 0, 1] as any,
      });
      src.createTransform({
        id: "child",
        parentTransformId: "root",
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 20, 0, 1] as any,
      });
      src.createMesh({
        id: "mesh",
        geometryId: "g",
        parentTransformId: "child",
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 30, 1] as any,
      });
      src.createObject({id: "obj", meshIds: ["mesh"]});

      const buffer = await new XGFExporter().write({sceneModel: src});
      expect(versionTag(buffer)).toBe(2);

      const dst = new Scene().createModel({id: "dst"}).value!;
      await new XGFLoader().load({fileData: buffer, sceneModel: dst});

      expect(dst.transforms["child"].parentTransform).toBe(dst.transforms["root"]);
      const mesh = dst.meshes["0"];
      expect(mesh.parentTransform).toBe(dst.transforms["child"]);
      expect(Array.from(mesh.matrix)).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 30, 1]);
      expect(mesh.worldMatrix[12]).toBeCloseTo(10, 6);
      expect(mesh.worldMatrix[13]).toBeCloseTo(20, 6);
      expect(mesh.worldMatrix[14]).toBeCloseTo(30, 6);
    });

    it("keeps transforms in v2 references-only chunks", async () => {
      const src = new Scene().createModel({id: "src"}).value!;
      src.createGeometry({
        id: "shared-geom",
        primitive: TrianglesPrimitive,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
      });
      src.createTransform({
        id: "placement",
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 7, 8, 9, 1] as any,
      });
      src.createMesh({id: "mesh", geometryId: "shared-geom", parentTransformId: "placement"});
      src.createObject({id: "obj", meshIds: ["mesh"]});

      const exporter = new XGFExporter();
      const assetLibrary = await exporter.write({sceneModel: src}, {assetMode: "assetLibrary"});
      const referencesOnly = await exporter.write({sceneModel: src}, {assetMode: "referencesOnly"});

      const dst = new Scene().createModel({id: "dst"}).value!;
      const loader = new XGFLoader();
      await loader.load({fileData: assetLibrary, sceneModel: dst});
      await loader.load({fileData: referencesOnly, sceneModel: dst});

      expect(dst.transforms["placement"]).toBeDefined();
      expect(dst.meshes["0"].parentTransform).toBe(dst.transforms["placement"]);
      expect(dst.meshes["0"].worldMatrix[12]).toBeCloseTo(7, 6);
      expect(dst.meshes["0"].worldMatrix[13]).toBeCloseTo(8, 6);
      expect(dst.meshes["0"].worldMatrix[14]).toBeCloseTo(9, 6);
    });
  });
});
